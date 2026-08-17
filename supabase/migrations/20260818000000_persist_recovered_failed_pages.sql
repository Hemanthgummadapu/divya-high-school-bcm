-- Recover questions for failed pages on a partial source that is currently
-- processing. Does not replace persist_extracted_questions. Never edits
-- existing questions or the source PDF. Do not edit applied migrations.

BEGIN;

CREATE OR REPLACE FUNCTION public.persist_recovered_failed_pages(
  p_source_id uuid,
  p_expected_failed_pages integer[],
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
  expected_pages integer[];
  stored_pages integer[];
  remaining_failed integer[];
  new_status text;
  extracted_count integer := 0;
  processed_count integer := 0;
  question_row jsonb;
  normalized_options jsonb;
  question_page_number integer;
  question_source_order integer;
  question_type text;
  language text;
  marks integer;
  question_text text;
  raw_text text;
  seen_positions text[] := '{}';
  position_key text;
BEGIN
  IF current_user IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;
  IF p_questions IS NULL OR jsonb_typeof(p_questions) <> 'array' THEN
    RAISE EXCEPTION 'questions_must_be_array';
  END IF;
  IF jsonb_array_length(p_questions) > 200 THEN
    RAISE EXCEPTION 'too_many_questions';
  END IF;
  IF p_error_category IS NOT NULL
     AND p_error_category NOT IN ('timeout', 'provider', 'parse', 'validation', 'internal') THEN
    RAISE EXCEPTION 'invalid_error_category';
  END IF;
  IF p_expected_failed_pages IS NULL
     OR cardinality(p_expected_failed_pages) = 0 THEN
    RAISE EXCEPTION 'invalid_expected_failed_pages';
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT page_no
    FROM unnest(p_expected_failed_pages) AS expected_page(page_no)
    ORDER BY page_no
  ) INTO expected_pages;
  IF cardinality(expected_pages) IS DISTINCT FROM cardinality(p_expected_failed_pages) THEN
    RAISE EXCEPTION 'invalid_expected_failed_pages';
  END IF;

  SELECT * INTO src
  FROM public.question_sources
  WHERE id = p_source_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'source_not_found';
  END IF;
  IF src.extraction_status IS DISTINCT FROM 'processing' THEN
    RAISE EXCEPTION 'source_not_processing';
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT page_no
    FROM unnest(src.failed_page_numbers) AS stored_page(page_no)
    ORDER BY page_no
  ) INTO stored_pages;
  IF expected_pages IS DISTINCT FROM stored_pages THEN
    RAISE EXCEPTION 'failed_pages_mismatch';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(expected_pages) AS expected_page(page_no)
    WHERE expected_page.page_no < 1 OR expected_page.page_no > src.page_count
  ) THEN
    RAISE EXCEPTION 'invalid_expected_failed_pages';
  END IF;

  FOR question_row IN
    SELECT value FROM jsonb_array_elements(p_questions)
  LOOP
    IF jsonb_typeof(question_row) <> 'object' THEN
      RAISE EXCEPTION 'invalid_question_object';
    END IF;
    question_page_number := NULLIF(question_row->>'source_page_number', '')::integer;
    question_source_order := NULLIF(question_row->>'source_order', '')::integer;
    question_type := question_row->>'question_type';
    language := coalesce(NULLIF(question_row->>'language', ''), 'en');
    marks := NULLIF(question_row->>'marks', '')::integer;
    question_text := question_row->>'question_text';
    raw_text := question_row->>'raw_extracted_text';

    IF question_page_number IS NULL
       OR question_page_number < 1
       OR question_page_number > src.page_count THEN
      RAISE EXCEPTION 'invalid_source_page_number';
    END IF;
    IF question_page_number != ALL (expected_pages) THEN
      RAISE EXCEPTION 'page_outside_failed_set';
    END IF;
    IF question_source_order IS NULL OR question_source_order < 1 OR question_source_order > 200 THEN
      RAISE EXCEPTION 'invalid_source_order';
    END IF;
    position_key := question_page_number::text || ':' || question_source_order::text;
    IF position_key = ANY (seen_positions) THEN
      RAISE EXCEPTION 'duplicate_question_position';
    END IF;
    seen_positions := array_append(seen_positions, position_key);
    IF EXISTS (
      SELECT 1
      FROM public.question_bank_questions existing
      WHERE existing.source_id = src.id
        AND existing.source_page_number = question_page_number
        AND existing.source_order = question_source_order
    ) THEN
      RAISE EXCEPTION 'duplicate_question_position';
    END IF;
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
      question_page_number,
      question_source_order,
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
  END LOOP;

  SELECT ARRAY(
    SELECT page_no
    FROM unnest(expected_pages) AS expected_page(page_no)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.question_bank_questions recovered
      WHERE recovered.source_id = src.id
        AND recovered.source_page_number = expected_page.page_no
    )
    ORDER BY page_no
  ) INTO remaining_failed;
  remaining_failed := coalesce(remaining_failed, '{}'::integer[]);

  SELECT count(*)
  INTO extracted_count
  FROM public.question_bank_questions
  WHERE source_id = src.id;

  processed_count := src.page_count - cardinality(remaining_failed);
  IF processed_count < 0 THEN
    processed_count := 0;
  END IF;

  IF cardinality(remaining_failed) = 0 THEN
    new_status := 'completed';
  ELSE
    new_status := 'partial';
  END IF;

  UPDATE public.question_sources
  SET
    extraction_status = new_status,
    processed_page_count = processed_count,
    failed_page_numbers = remaining_failed,
    extracted_question_count = extracted_count,
    error_category = CASE WHEN new_status = 'completed' THEN NULL ELSE p_error_category END,
    error_message = CASE
      WHEN new_status = 'completed' THEN NULL
      ELSE left(p_error_message, 500)
    END
  WHERE id = src.id;

  RETURN jsonb_build_object(
    'ok', true,
    'source_id', src.id,
    'extraction_status', new_status,
    'extracted_question_count', extracted_count,
    'processed_page_count', processed_count,
    'failed_page_numbers', to_jsonb(remaining_failed)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.persist_recovered_failed_pages(
  uuid, integer[], text, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.persist_recovered_failed_pages(
  uuid, integer[], text, text, jsonb
) TO service_role;

COMMIT;
