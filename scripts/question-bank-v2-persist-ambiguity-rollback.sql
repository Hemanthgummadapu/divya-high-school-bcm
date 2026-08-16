-- Rollback for 20260816020000_persist_extracted_questions_page_number.sql only.
-- Restores the Phase 2B function body. That body reintroduces PostgreSQL 42702
-- on persist. Do not use this to roll back Phase 1 or Phase 2B objects.
-- Do not delete question sources or retained PDFs.

BEGIN;

CREATE OR REPLACE FUNCTION public.persist_extracted_questions(
  p_source_id uuid,
  p_idempotency_key text,
  p_processed_page_count integer,
  p_failed_page_numbers integer[],
  p_error_category text,
  p_error_message text,
  p_questions jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  src public.question_sources%ROWTYPE;
  new_status text;
  inserted_count integer := 0;
  question_row jsonb;
  failed_pages integer[] := coalesce(p_failed_page_numbers, '{}'::integer[]);
  payload jsonb;
  normalized_options jsonb;
  page_number integer;
  source_order integer;
  question_type text;
  language text;
  marks integer;
  question_text text;
  raw_text text;
  seen_positions text[] := '{}';
  position_key text;
BEGIN
  IF p_idempotency_key IS NULL
     OR char_length(p_idempotency_key) < 8
     OR char_length(p_idempotency_key) > 128
     OR p_idempotency_key ~ '[[:space:]]' THEN
    RAISE EXCEPTION 'invalid_idempotency_key';
  END IF;
  IF p_questions IS NULL OR jsonb_typeof(p_questions) <> 'array' THEN
    RAISE EXCEPTION 'questions_must_be_array';
  END IF;
  IF jsonb_array_length(p_questions) > 200 THEN
    RAISE EXCEPTION 'too_many_questions';
  END IF;
  IF p_processed_page_count IS NULL OR p_processed_page_count < 0 THEN
    RAISE EXCEPTION 'invalid_processed_page_count';
  END IF;
  IF p_error_category IS NOT NULL
     AND p_error_category NOT IN ('timeout', 'provider', 'parse', 'validation', 'internal') THEN
    RAISE EXCEPTION 'invalid_error_category';
  END IF;

  payload := jsonb_build_object(
    'processed_page_count', p_processed_page_count,
    'failed_page_numbers', to_jsonb(failed_pages),
    'questions', p_questions
  );

  SELECT * INTO src
  FROM public.question_sources
  WHERE id = p_source_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'source_not_found';
  END IF;

  IF src.persist_idempotency_key IS NOT NULL
     AND src.persist_idempotency_key = p_idempotency_key THEN
    IF src.persist_payload IS NOT DISTINCT FROM payload THEN
      RETURN jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'source_id', src.id,
        'extraction_status', src.extraction_status,
        'extracted_question_count', src.extracted_question_count
      );
    END IF;
    RAISE EXCEPTION 'idempotency_key_payload_mismatch';
  END IF;

  IF src.extraction_status IN ('completed', 'partial', 'archived') THEN
    RAISE EXCEPTION 'source_already_persisted';
  END IF;

  IF p_processed_page_count > src.page_count THEN
    RAISE EXCEPTION 'invalid_processed_page_count';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(failed_pages) AS page_number
    WHERE page_number < 1 OR page_number > src.page_count
  ) THEN
    RAISE EXCEPTION 'invalid_failed_page_numbers';
  END IF;

  IF cardinality(failed_pages) > 0
     AND p_processed_page_count = src.page_count THEN
    RAISE EXCEPTION 'completed_source_cannot_include_failed_pages';
  END IF;

  IF cardinality(failed_pages) = 0
     AND p_processed_page_count = src.page_count THEN
    new_status := 'completed';
  ELSIF p_processed_page_count > 0 OR jsonb_array_length(p_questions) > 0 THEN
    new_status := 'partial';
  ELSE
    new_status := 'failed';
  END IF;

  FOR question_row IN
    SELECT value FROM jsonb_array_elements(p_questions)
  LOOP
    IF jsonb_typeof(question_row) <> 'object' THEN
      RAISE EXCEPTION 'invalid_question_object';
    END IF;
    page_number := NULLIF(question_row->>'source_page_number', '')::integer;
    source_order := NULLIF(question_row->>'source_order', '')::integer;
    question_type := question_row->>'question_type';
    language := coalesce(NULLIF(question_row->>'language', ''), 'en');
    marks := NULLIF(question_row->>'marks', '')::integer;
    question_text := question_row->>'question_text';
    raw_text := question_row->>'raw_extracted_text';

    IF page_number IS NULL OR page_number < 1 OR page_number > src.page_count THEN
      RAISE EXCEPTION 'invalid_source_page_number';
    END IF;
    IF source_order IS NULL OR source_order < 1 OR source_order > 200 THEN
      RAISE EXCEPTION 'invalid_source_order';
    END IF;
    position_key := page_number::text || ':' || source_order::text;
    IF position_key = ANY (seen_positions) THEN
      RAISE EXCEPTION 'duplicate_question_position';
    END IF;
    seen_positions := array_append(seen_positions, position_key);
    IF question_type NOT IN ('MCQ', 'Short', 'Medium', 'Long') THEN
      RAISE EXCEPTION 'invalid_question_type';
    END IF;
    IF language NOT IN ('en', 'te', 'mixed') THEN
      RAISE EXCEPTION 'invalid_language';
    END IF;
    IF marks IS NULL OR marks < 1 OR marks > 100 THEN
      RAISE EXCEPTION 'invalid_marks';
    END IF;
    IF question_text IS NULL OR btrim(question_text) = '' OR char_length(question_text) > 20000 THEN
      RAISE EXCEPTION 'invalid_question_text';
    END IF;
    IF raw_text IS NOT NULL AND char_length(raw_text) > 20000 THEN
      RAISE EXCEPTION 'invalid_raw_extracted_text';
    END IF;
    IF question_row ? 'diagram_path' AND NULLIF(question_row->>'diagram_path', '') IS NOT NULL THEN
      RAISE EXCEPTION 'client_supplied_storage_path_not_allowed';
    END IF;

    normalized_options := public.question_bank_normalize_mcq_options(
      coalesce(question_row->'options', '[]'::jsonb)
    );
    IF question_type = 'MCQ'
       AND NOT public.question_bank_mcq_options_are_valid_normalized(normalized_options) THEN
      RAISE EXCEPTION 'invalid_mcq_options';
    END IF;
    IF question_type <> 'MCQ' THEN
      normalized_options := '[]'::jsonb;
    END IF;

    INSERT INTO public.question_bank_questions (
      source_id,
      source_page_number,
      source_order,
      grade,
      subject,
      academic_year,
      chapter,
      topic,
      section_label,
      question_type,
      language,
      raw_extracted_text,
      question_text,
      options,
      correct_answer,
      marks,
      review_status
    ) VALUES (
      src.id,
      page_number,
      source_order,
      src.grade,
      src.subject,
      src.academic_year,
      NULLIF(btrim(question_row->>'chapter'), ''),
      NULLIF(btrim(question_row->>'topic'), ''),
      NULLIF(btrim(question_row->>'section_label'), ''),
      question_type,
      language,
      raw_text,
      question_text,
      normalized_options,
      NULLIF(question_row->>'correct_answer', ''),
      marks,
      'needs_review'
    );
    inserted_count := inserted_count + 1;
  END LOOP;

  UPDATE public.question_sources
  SET
    extraction_status = new_status,
    processed_page_count = p_processed_page_count,
    failed_page_numbers = failed_pages,
    extracted_question_count = inserted_count,
    error_category = p_error_category,
    error_message = left(p_error_message, 500),
    persist_idempotency_key = p_idempotency_key,
    persist_payload = payload
  WHERE id = src.id;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'source_id', src.id,
    'extraction_status', new_status,
    'extracted_question_count', inserted_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.persist_extracted_questions(
  uuid, text, integer, integer[], text, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.persist_extracted_questions(
  uuid, text, integer, integer[], text, text, jsonb
) TO service_role;

COMMIT;
