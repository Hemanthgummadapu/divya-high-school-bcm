-- UNAPPLIED: Phase 2B additive question-bank foundation.
-- Do not apply automatically during application deployment.
-- Do not alter legacy public.questions, public.question_papers, or
-- public.generated_pdfs. Do not backfill those tables.
--
-- Scope: four new tables, containment grants, two private buckets,
-- and SECURITY INVOKER RPCs for persist, save/finalize, and PDF metadata.
-- Reversible by scripts/question-bank-v2-rollback.sql when the new
-- objects are empty.
--
-- Final-paper PDF: content and items stay immutable. The only allowed
-- UPDATE on a final paper is the one-time fill of empty pdf_* columns
-- with a complete valid metadata set (via record_final_paper_pdf).

BEGIN;

CREATE OR REPLACE FUNCTION public.question_bank_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.question_bank_normalize_mcq_options(p_options jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  normalized jsonb := '[]'::jsonb;
  elem jsonb;
  idx integer := 0;
  label text;
  option_text text;
  labels text[] := ARRAY['A', 'B', 'C', 'D', 'E', 'F'];
BEGIN
  IF p_options IS NULL OR jsonb_typeof(p_options) <> 'array' THEN
    RETURN '[]'::jsonb;
  END IF;

  FOR elem IN SELECT value FROM jsonb_array_elements(p_options)
  LOOP
    idx := idx + 1;
    IF idx > 6 THEN
      RETURN '[]'::jsonb;
    END IF;
    IF jsonb_typeof(elem) = 'object' THEN
      label := btrim(coalesce(elem->>'label', ''));
      option_text := btrim(coalesce(elem->>'text', ''));
    ELSIF jsonb_typeof(elem) = 'string' THEN
      label := labels[idx];
      option_text := btrim(elem #>> '{}');
    ELSE
      RETURN '[]'::jsonb;
    END IF;
    IF label = '' OR option_text = '' OR char_length(option_text) > 2000 THEN
      RETURN '[]'::jsonb;
    END IF;
    normalized := normalized || jsonb_build_array(
      jsonb_build_object('label', label, 'text', option_text)
    );
  END LOOP;

  RETURN normalized;
END;
$$;

CREATE OR REPLACE FUNCTION public.question_bank_mcq_options_are_valid_normalized(p_options jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    jsonb_typeof(p_options) = 'array'
    AND jsonb_array_length(p_options) BETWEEN 2 AND 6
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_options) AS elem
      WHERE jsonb_typeof(elem) <> 'object'
         OR btrim(coalesce(elem->>'label', '')) = ''
         OR btrim(coalesce(elem->>'text', '')) = ''
         OR char_length(elem->>'text') > 2000
    );
$$;

CREATE OR REPLACE FUNCTION public.question_bank_mcq_options_are_valid(p_options jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.question_bank_mcq_options_are_valid_normalized(
    public.question_bank_normalize_mcq_options(p_options)
  );
$$;

CREATE TABLE public.question_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_filename text NOT NULL
    CHECK (
      btrim(original_filename) <> ''
      AND char_length(original_filename) <= 255
      AND original_filename !~ '[\\/]'
    ),
  storage_path text NOT NULL
    CHECK (storage_path ~ '^source-pdfs/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/original\.pdf$'),
  content_sha256 text NOT NULL
    CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  mime_type text NOT NULL
    CHECK (mime_type = 'application/pdf'),
  byte_size integer NOT NULL
    CHECK (byte_size > 0 AND byte_size <= 52428800),
  page_count integer NOT NULL
    CHECK (page_count > 0 AND page_count <= 100),
  grade integer NOT NULL
    CHECK (grade BETWEEN 1 AND 10),
  subject text NOT NULL
    CHECK (btrim(subject) <> '' AND char_length(subject) <= 100),
  academic_year integer NOT NULL
    CHECK (academic_year BETWEEN 2000 AND 2100),
  extraction_status text NOT NULL
    CHECK (extraction_status IN (
      'uploaded', 'processing', 'completed', 'partial', 'failed', 'archived'
    )),
  processed_page_count integer NOT NULL DEFAULT 0
    CHECK (processed_page_count >= 0),
  failed_page_numbers integer[] NOT NULL DEFAULT '{}'::integer[]
    CHECK (cardinality(failed_page_numbers) <= 100),
  extracted_question_count integer NOT NULL DEFAULT 0
    CHECK (extracted_question_count >= 0),
  error_category text
    CHECK (error_category IS NULL OR error_category IN (
      'timeout', 'provider', 'parse', 'validation', 'internal'
    )),
  error_message text
    CHECK (error_message IS NULL OR char_length(error_message) <= 500),
  persist_idempotency_key text
    CHECK (
      persist_idempotency_key IS NULL
      OR (
        char_length(persist_idempotency_key) BETWEEN 8 AND 128
        AND persist_idempotency_key !~ '[[:space:]]'
      )
    ),
  persist_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT question_sources_processed_pages_bound
    CHECK (processed_page_count <= page_count),
  CONSTRAINT question_sources_failed_pages_bound
    CHECK (
      NOT EXISTS (
        SELECT 1
        FROM unnest(failed_page_numbers) AS page_number
        WHERE page_number < 1 OR page_number > page_count
      )
    ),
  CONSTRAINT question_sources_completed_has_no_failed_pages
    CHECK (
      extraction_status <> 'completed'
      OR (
        cardinality(failed_page_numbers) = 0
        AND processed_page_count = page_count
      )
    )
);

CREATE UNIQUE INDEX question_sources_content_sha256_key
  ON public.question_sources (content_sha256);
CREATE UNIQUE INDEX question_sources_storage_path_key
  ON public.question_sources (storage_path);
CREATE UNIQUE INDEX question_sources_persist_idempotency_key
  ON public.question_sources (persist_idempotency_key)
  WHERE persist_idempotency_key IS NOT NULL;
CREATE INDEX question_sources_class_subject_year_idx
  ON public.question_sources (grade, subject, academic_year);
CREATE INDEX question_sources_status_idx
  ON public.question_sources (extraction_status);

CREATE TRIGGER question_sources_set_updated_at
  BEFORE UPDATE ON public.question_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.question_bank_set_updated_at();

CREATE TABLE public.question_bank_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.question_sources (id) ON DELETE RESTRICT,
  source_page_number integer
    CHECK (source_page_number IS NULL OR source_page_number >= 1),
  source_order integer
    CHECK (source_order IS NULL OR source_order >= 1),
  grade integer NOT NULL
    CHECK (grade BETWEEN 1 AND 10),
  subject text NOT NULL
    CHECK (btrim(subject) <> '' AND char_length(subject) <= 100),
  academic_year integer NOT NULL
    CHECK (academic_year BETWEEN 2000 AND 2100),
  chapter text
    CHECK (chapter IS NULL OR char_length(chapter) <= 200),
  topic text
    CHECK (topic IS NULL OR char_length(topic) <= 200),
  section_label text
    CHECK (section_label IS NULL OR char_length(section_label) <= 200),
  question_type text NOT NULL
    CHECK (question_type IN ('MCQ', 'Short', 'Medium', 'Long')),
  language text NOT NULL DEFAULT 'en'
    CHECK (language IN ('en', 'te', 'mixed')),
  raw_extracted_text text
    CHECK (raw_extracted_text IS NULL OR char_length(raw_extracted_text) <= 20000),
  question_text text NOT NULL
    CHECK (btrim(question_text) <> '' AND char_length(question_text) <= 20000),
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer text
    CHECK (correct_answer IS NULL OR char_length(correct_answer) <= 2000),
  marks integer NOT NULL
    CHECK (marks > 0 AND marks <= 100),
  diagram_path text
    CHECK (
      diagram_path IS NULL
      OR diagram_path ~ '^diagrams/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$'
    ),
  review_status text NOT NULL DEFAULT 'needs_review'
    CHECK (review_status IN ('needs_review', 'approved', 'rejected', 'archived')),
  lock_version integer NOT NULL DEFAULT 1
    CHECK (lock_version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  CONSTRAINT question_bank_questions_source_page_required
    CHECK (source_id IS NULL OR source_page_number IS NOT NULL),
  CONSTRAINT question_bank_questions_mcq_options
    CHECK (
      question_type <> 'MCQ'
      OR public.question_bank_mcq_options_are_valid_normalized(options)
    ),
  CONSTRAINT question_bank_questions_approved_timestamp
    CHECK (
      (review_status = 'approved' AND approved_at IS NOT NULL)
      OR (review_status <> 'approved' AND approved_at IS NULL)
    )
);

CREATE UNIQUE INDEX question_bank_questions_source_order_key
  ON public.question_bank_questions (source_id, source_page_number, source_order)
  WHERE source_id IS NOT NULL AND source_order IS NOT NULL;
CREATE INDEX question_bank_questions_class_subject_year_idx
  ON public.question_bank_questions (grade, subject, academic_year);
CREATE INDEX question_bank_questions_status_idx
  ON public.question_bank_questions (review_status);
CREATE INDEX question_bank_questions_type_idx
  ON public.question_bank_questions (question_type);
CREATE INDEX question_bank_questions_source_id_idx
  ON public.question_bank_questions (source_id);

CREATE OR REPLACE FUNCTION public.question_bank_protect_question_immutables()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.raw_extracted_text IS DISTINCT FROM OLD.raw_extracted_text THEN
    RAISE EXCEPTION 'raw_extracted_text is immutable';
  END IF;
  IF NEW.diagram_path IS DISTINCT FROM OLD.diagram_path
     AND NEW.diagram_path IS NOT NULL
     AND NEW.diagram_path !~ '^diagrams/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$' THEN
    RAISE EXCEPTION 'diagram_path must be a new UUID object path';
  END IF;
  NEW.lock_version := OLD.lock_version + 1;
  RETURN NEW;
END;
$$;

CREATE TRIGGER question_bank_questions_set_updated_at
  BEFORE UPDATE ON public.question_bank_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.question_bank_set_updated_at();

CREATE TRIGGER question_bank_questions_protect_immutables
  BEFORE UPDATE ON public.question_bank_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.question_bank_protect_question_immutables();

CREATE TABLE public.saved_question_papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL
    CHECK (btrim(title) <> '' AND char_length(title) <= 300),
  grade integer NOT NULL
    CHECK (grade BETWEEN 1 AND 10),
  subject text NOT NULL
    CHECK (btrim(subject) <> '' AND char_length(subject) <= 100),
  academic_year integer NOT NULL
    CHECK (academic_year BETWEEN 2000 AND 2100),
  duration_minutes integer
    CHECK (duration_minutes IS NULL OR (duration_minutes > 0 AND duration_minutes <= 600)),
  total_marks integer NOT NULL DEFAULT 0
    CHECK (total_marks >= 0),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'final', 'archived')),
  pdf_storage_path text
    CHECK (
      pdf_storage_path IS NULL
      OR pdf_storage_path ~ '^generated-papers/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
    ),
  pdf_sha256 text
    CHECK (pdf_sha256 IS NULL OR pdf_sha256 ~ '^[0-9a-f]{64}$'),
  pdf_byte_size integer
    CHECK (pdf_byte_size IS NULL OR pdf_byte_size > 0),
  creation_key text
    CHECK (
      creation_key IS NULL
      OR (
        char_length(creation_key) BETWEEN 8 AND 128
        AND creation_key !~ '[[:space:]]'
      )
    ),
  finalize_snapshot jsonb,
  lock_version integer NOT NULL DEFAULT 1
    CHECK (lock_version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz,
  CONSTRAINT saved_question_papers_final_requires_timestamp
    CHECK (
      (status = 'final' AND finalized_at IS NOT NULL)
      OR (status <> 'final')
    ),
  CONSTRAINT saved_question_papers_pdf_metadata_together
    CHECK (
      (pdf_storage_path IS NULL AND pdf_sha256 IS NULL AND pdf_byte_size IS NULL)
      OR (pdf_storage_path IS NOT NULL AND pdf_sha256 IS NOT NULL AND pdf_byte_size IS NOT NULL)
    )
);

CREATE UNIQUE INDEX saved_question_papers_pdf_storage_path_key
  ON public.saved_question_papers (pdf_storage_path)
  WHERE pdf_storage_path IS NOT NULL;
CREATE UNIQUE INDEX saved_question_papers_creation_key
  ON public.saved_question_papers (creation_key)
  WHERE creation_key IS NOT NULL;
CREATE INDEX saved_question_papers_class_subject_year_idx
  ON public.saved_question_papers (grade, subject, academic_year);
CREATE INDEX saved_question_papers_status_idx
  ON public.saved_question_papers (status);

CREATE TRIGGER saved_question_papers_set_updated_at
  BEFORE UPDATE ON public.saved_question_papers
  FOR EACH ROW
  EXECUTE FUNCTION public.question_bank_set_updated_at();

CREATE TABLE public.saved_question_paper_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL
    REFERENCES public.saved_question_papers (id) ON DELETE RESTRICT,
  bank_question_id uuid
    REFERENCES public.question_bank_questions (id) ON DELETE RESTRICT,
  section_title text NOT NULL
    CHECK (btrim(section_title) <> '' AND char_length(section_title) <= 200),
  section_instructions text
    CHECK (section_instructions IS NULL OR char_length(section_instructions) <= 2000),
  section_display_order integer NOT NULL
    CHECK (section_display_order >= 1 AND section_display_order <= 50),
  question_display_order integer NOT NULL
    CHECK (question_display_order >= 1 AND question_display_order <= 200),
  number_label text NOT NULL
    CHECK (btrim(number_label) <> '' AND char_length(number_label) <= 32),
  snapshot_text text NOT NULL
    CHECK (btrim(snapshot_text) <> '' AND char_length(snapshot_text) <= 20000),
  snapshot_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  snapshot_marks integer NOT NULL
    CHECK (snapshot_marks > 0 AND snapshot_marks <= 100),
  snapshot_question_type text NOT NULL
    CHECK (snapshot_question_type IN ('MCQ', 'Short', 'Medium', 'Long')),
  snapshot_diagram_path text
    CHECK (
      snapshot_diagram_path IS NULL
      OR snapshot_diagram_path ~ '^diagrams/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$'
    ),
  choice_group text
    CHECK (choice_group IS NULL OR char_length(choice_group) <= 64),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saved_question_paper_items_mcq_options
    CHECK (
      snapshot_question_type <> 'MCQ'
      OR public.question_bank_mcq_options_are_valid_normalized(snapshot_options)
    )
);

CREATE UNIQUE INDEX saved_question_paper_items_order_key
  ON public.saved_question_paper_items (
    paper_id,
    section_display_order,
    question_display_order
  );
CREATE UNIQUE INDEX saved_question_paper_items_number_label_key
  ON public.saved_question_paper_items (paper_id, number_label);
CREATE INDEX saved_question_paper_items_paper_id_idx
  ON public.saved_question_paper_items (paper_id);
CREATE INDEX saved_question_paper_items_bank_question_id_idx
  ON public.saved_question_paper_items (bank_question_id);

CREATE OR REPLACE FUNCTION public.question_bank_reject_final_paper_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  paper_status text;
  target_paper_id uuid;
  pdf_fill_in boolean;
BEGIN
  IF TG_TABLE_NAME = 'saved_question_papers' THEN
    IF TG_OP = 'DELETE' AND OLD.status = 'final' THEN
      RAISE EXCEPTION 'final papers are immutable';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.status = 'final' THEN
      pdf_fill_in :=
        NEW.status = 'final'
        AND NEW.title IS NOT DISTINCT FROM OLD.title
        AND NEW.grade IS NOT DISTINCT FROM OLD.grade
        AND NEW.subject IS NOT DISTINCT FROM OLD.subject
        AND NEW.academic_year IS NOT DISTINCT FROM OLD.academic_year
        AND NEW.duration_minutes IS NOT DISTINCT FROM OLD.duration_minutes
        AND NEW.total_marks IS NOT DISTINCT FROM OLD.total_marks
        AND NEW.creation_key IS NOT DISTINCT FROM OLD.creation_key
        AND NEW.finalize_snapshot IS NOT DISTINCT FROM OLD.finalize_snapshot
        AND NEW.lock_version IS NOT DISTINCT FROM OLD.lock_version
        AND NEW.finalized_at IS NOT DISTINCT FROM OLD.finalized_at
        AND OLD.pdf_storage_path IS NULL
        AND OLD.pdf_sha256 IS NULL
        AND OLD.pdf_byte_size IS NULL
        AND NEW.pdf_storage_path IS NOT NULL
        AND NEW.pdf_sha256 IS NOT NULL
        AND NEW.pdf_byte_size IS NOT NULL;
      IF NOT pdf_fill_in THEN
        RAISE EXCEPTION 'final papers are immutable';
      END IF;
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  target_paper_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.paper_id ELSE NEW.paper_id END;
  SELECT status INTO paper_status
  FROM public.saved_question_papers
  WHERE id = target_paper_id;

  IF paper_status = 'final' THEN
    RAISE EXCEPTION 'final paper items are immutable';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER saved_question_papers_reject_final_mutation
  BEFORE UPDATE OR DELETE ON public.saved_question_papers
  FOR EACH ROW
  EXECUTE FUNCTION public.question_bank_reject_final_paper_mutation();

CREATE TRIGGER saved_question_paper_items_reject_final_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.saved_question_paper_items
  FOR EACH ROW
  EXECUTE FUNCTION public.question_bank_reject_final_paper_mutation();

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

CREATE OR REPLACE FUNCTION public.save_question_paper(
  p_paper_id uuid,
  p_creation_key text,
  p_expected_lock_version integer,
  p_title text,
  p_grade integer,
  p_subject text,
  p_academic_year integer,
  p_duration_minutes integer,
  p_items jsonb,
  p_finalize boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  paper public.saved_question_papers%ROWTYPE;
  v_paper_id uuid := p_paper_id;
  resolved_by_creation_key boolean := false;
  item_row jsonb;
  computed_marks integer := 0;
  item_count integer := 0;
  next_status text;
  snapshot jsonb := '[]'::jsonb;
  normalized_options jsonb;
  section_order integer;
  question_order integer;
  number_label text;
  snapshot_text text;
  snapshot_marks integer;
  snapshot_type text;
  snapshot_diagram text;
  seen_positions text[] := '{}';
  seen_labels text[] := '{}';
  position_key text;
BEGIN
  IF p_title IS NULL OR btrim(p_title) = '' OR char_length(p_title) > 300 THEN
    RAISE EXCEPTION 'invalid_title';
  END IF;
  IF p_grade IS NULL OR p_grade < 1 OR p_grade > 10 THEN
    RAISE EXCEPTION 'invalid_grade';
  END IF;
  IF p_subject IS NULL OR btrim(p_subject) = '' OR char_length(p_subject) > 100 THEN
    RAISE EXCEPTION 'invalid_subject';
  END IF;
  IF p_academic_year IS NULL OR p_academic_year < 2000 OR p_academic_year > 2100 THEN
    RAISE EXCEPTION 'invalid_academic_year';
  END IF;
  IF p_duration_minutes IS NOT NULL
     AND (p_duration_minutes < 1 OR p_duration_minutes > 600) THEN
    RAISE EXCEPTION 'invalid_duration';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'items_must_be_array';
  END IF;

  item_count := jsonb_array_length(p_items);
  IF item_count > 200 THEN
    RAISE EXCEPTION 'too_many_items';
  END IF;
  IF coalesce(p_finalize, false) AND item_count < 1 THEN
    RAISE EXCEPTION 'final_paper_requires_items';
  END IF;

  IF v_paper_id IS NULL THEN
    IF p_creation_key IS NULL
       OR char_length(p_creation_key) < 8
       OR char_length(p_creation_key) > 128
       OR p_creation_key ~ '[[:space:]]' THEN
      RAISE EXCEPTION 'invalid_creation_key';
    END IF;
    SELECT * INTO paper
    FROM public.saved_question_papers
    WHERE creation_key = p_creation_key
    FOR UPDATE;
    IF FOUND THEN
      v_paper_id := paper.id;
      resolved_by_creation_key := true;
    ELSE
      INSERT INTO public.saved_question_papers (
        title,
        grade,
        subject,
        academic_year,
        duration_minutes,
        status,
        creation_key,
        lock_version
      ) VALUES (
        p_title,
        p_grade,
        p_subject,
        p_academic_year,
        p_duration_minutes,
        'draft',
        p_creation_key,
        1
      )
      RETURNING * INTO paper;
      v_paper_id := paper.id;
    END IF;
  ELSE
    SELECT * INTO paper
    FROM public.saved_question_papers
    WHERE id = v_paper_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'paper_not_found';
    END IF;
  END IF;

  FOR item_row IN
    SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF jsonb_typeof(item_row) <> 'object' THEN
      RAISE EXCEPTION 'invalid_item_object';
    END IF;
    section_order := NULLIF(item_row->>'section_display_order', '')::integer;
    question_order := NULLIF(item_row->>'question_display_order', '')::integer;
    number_label := item_row->>'number_label';
    snapshot_text := item_row->>'snapshot_text';
    snapshot_marks := NULLIF(item_row->>'snapshot_marks', '')::integer;
    snapshot_type := item_row->>'snapshot_question_type';
    snapshot_diagram := NULLIF(item_row->>'snapshot_diagram_path', '');
    IF section_order IS NULL OR section_order < 1 OR section_order > 50 THEN
      RAISE EXCEPTION 'invalid_section_display_order';
    END IF;
    IF question_order IS NULL OR question_order < 1 OR question_order > 200 THEN
      RAISE EXCEPTION 'invalid_question_display_order';
    END IF;
    IF item_row->>'section_title' IS NULL
       OR btrim(item_row->>'section_title') = ''
       OR char_length(item_row->>'section_title') > 200 THEN
      RAISE EXCEPTION 'invalid_section_title';
    END IF;
    IF number_label IS NULL OR btrim(number_label) = '' OR char_length(number_label) > 32 THEN
      RAISE EXCEPTION 'invalid_number_label';
    END IF;
    IF snapshot_text IS NULL OR btrim(snapshot_text) = '' OR char_length(snapshot_text) > 20000 THEN
      RAISE EXCEPTION 'invalid_snapshot_text';
    END IF;
    IF snapshot_marks IS NULL OR snapshot_marks < 1 OR snapshot_marks > 100 THEN
      RAISE EXCEPTION 'invalid_snapshot_marks';
    END IF;
    IF snapshot_type NOT IN ('MCQ', 'Short', 'Medium', 'Long') THEN
      RAISE EXCEPTION 'invalid_snapshot_question_type';
    END IF;
    IF snapshot_diagram IS NOT NULL
       AND snapshot_diagram !~ '^diagrams/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$' THEN
      RAISE EXCEPTION 'invalid_snapshot_diagram_path';
    END IF;
    IF item_row ? 'pdf_storage_path' OR item_row ? 'bucket' THEN
      RAISE EXCEPTION 'client_supplied_storage_path_not_allowed';
    END IF;
    position_key := section_order::text || ':' || question_order::text;
    IF position_key = ANY (seen_positions) THEN
      RAISE EXCEPTION 'duplicate_item_position';
    END IF;
    IF number_label = ANY (seen_labels) THEN
      RAISE EXCEPTION 'duplicate_number_label';
    END IF;
    seen_positions := array_append(seen_positions, position_key);
    seen_labels := array_append(seen_labels, number_label);
    normalized_options := public.question_bank_normalize_mcq_options(
      coalesce(item_row->'snapshot_options', '[]'::jsonb)
    );
    IF snapshot_type = 'MCQ'
       AND NOT public.question_bank_mcq_options_are_valid_normalized(normalized_options) THEN
      RAISE EXCEPTION 'invalid_mcq_options';
    END IF;
    IF snapshot_type <> 'MCQ' THEN
      normalized_options := '[]'::jsonb;
    END IF;
    snapshot := snapshot || jsonb_build_array(
      jsonb_build_object(
        'section_display_order', section_order,
        'question_display_order', question_order,
        'number_label', number_label,
        'snapshot_text', snapshot_text,
        'snapshot_options', normalized_options,
        'snapshot_marks', snapshot_marks,
        'snapshot_question_type', snapshot_type,
        'snapshot_diagram_path', snapshot_diagram
      )
    );
    computed_marks := computed_marks + snapshot_marks;
  END LOOP;

  IF paper.status = 'final' THEN
    IF paper.finalize_snapshot IS NOT DISTINCT FROM snapshot THEN
      RETURN jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'paper_id', paper.id,
        'status', paper.status,
        'total_marks', paper.total_marks,
        'lock_version', paper.lock_version
      );
    END IF;
    RAISE EXCEPTION 'final papers are immutable';
  END IF;

  IF resolved_by_creation_key THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'paper_id', paper.id,
      'status', paper.status,
      'total_marks', paper.total_marks,
      'lock_version', paper.lock_version
    );
  END IF;

  IF p_paper_id IS NOT NULL THEN
    IF p_expected_lock_version IS NULL OR p_expected_lock_version <> paper.lock_version THEN
      RAISE EXCEPTION 'stale_paper_lock_version';
    END IF;
  END IF;

  DELETE FROM public.saved_question_paper_items
  WHERE saved_question_paper_items.paper_id = v_paper_id;

  FOR item_row IN
    SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    snapshot_type := item_row->>'snapshot_question_type';
    normalized_options := public.question_bank_normalize_mcq_options(
      coalesce(item_row->'snapshot_options', '[]'::jsonb)
    );
    IF snapshot_type <> 'MCQ' THEN
      normalized_options := '[]'::jsonb;
    END IF;
    INSERT INTO public.saved_question_paper_items (
      paper_id,
      bank_question_id,
      section_title,
      section_instructions,
      section_display_order,
      question_display_order,
      number_label,
      snapshot_text,
      snapshot_options,
      snapshot_marks,
      snapshot_question_type,
      snapshot_diagram_path,
      choice_group
    ) VALUES (
      v_paper_id,
      NULLIF(item_row->>'bank_question_id', '')::uuid,
      item_row->>'section_title',
      NULLIF(item_row->>'section_instructions', ''),
      NULLIF(item_row->>'section_display_order', '')::integer,
      NULLIF(item_row->>'question_display_order', '')::integer,
      item_row->>'number_label',
      item_row->>'snapshot_text',
      normalized_options,
      NULLIF(item_row->>'snapshot_marks', '')::integer,
      snapshot_type,
      NULLIF(item_row->>'snapshot_diagram_path', ''),
      NULLIF(item_row->>'choice_group', '')
    );
  END LOOP;

  next_status := CASE WHEN coalesce(p_finalize, false) THEN 'final' ELSE 'draft' END;

  UPDATE public.saved_question_papers
  SET
    title = p_title,
    grade = p_grade,
    subject = p_subject,
    academic_year = p_academic_year,
    duration_minutes = p_duration_minutes,
    total_marks = computed_marks,
    status = next_status,
    finalized_at = CASE WHEN next_status = 'final' THEN now() ELSE NULL END,
    finalize_snapshot = CASE WHEN next_status = 'final' THEN snapshot ELSE NULL END,
    lock_version = paper.lock_version + 1
  WHERE id = v_paper_id
  RETURNING * INTO paper;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'paper_id', paper.id,
    'status', paper.status,
    'total_marks', paper.total_marks,
    'item_count', item_count,
    'lock_version', paper.lock_version
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_final_paper_pdf(
  p_paper_id uuid,
  p_pdf_storage_path text,
  p_pdf_sha256 text,
  p_pdf_byte_size integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  paper public.saved_question_papers%ROWTYPE;
  expected_prefix text;
BEGIN
  IF p_paper_id IS NULL THEN
    RAISE EXCEPTION 'paper_id_required';
  END IF;
  expected_prefix := 'generated-papers/' || p_paper_id::text || '/';
  IF p_pdf_storage_path IS NULL
     OR p_pdf_storage_path !~ (
       '^generated-papers/'
       || replace(p_paper_id::text, '-', '\-')
       || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
     ) THEN
    RAISE EXCEPTION 'invalid_pdf_storage_path';
  END IF;
  IF p_pdf_sha256 IS NULL OR p_pdf_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid_pdf_sha256';
  END IF;
  IF p_pdf_byte_size IS NULL OR p_pdf_byte_size < 1 THEN
    RAISE EXCEPTION 'invalid_pdf_byte_size';
  END IF;
  IF left(p_pdf_storage_path, char_length(expected_prefix)) <> expected_prefix THEN
    RAISE EXCEPTION 'pdf_path_must_match_paper';
  END IF;

  SELECT * INTO paper
  FROM public.saved_question_papers
  WHERE id = p_paper_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'paper_not_found';
  END IF;
  IF paper.status <> 'final' THEN
    RAISE EXCEPTION 'paper_not_final';
  END IF;
  IF paper.pdf_storage_path IS NOT NULL THEN
    IF paper.pdf_storage_path = p_pdf_storage_path
       AND paper.pdf_sha256 = p_pdf_sha256
       AND paper.pdf_byte_size = p_pdf_byte_size THEN
      RETURN jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'paper_id', paper.id
      );
    END IF;
    RAISE EXCEPTION 'final_pdf_already_recorded';
  END IF;

  UPDATE public.saved_question_papers
  SET
    pdf_storage_path = p_pdf_storage_path,
    pdf_sha256 = p_pdf_sha256,
    pdf_byte_size = p_pdf_byte_size
  WHERE id = p_paper_id
  RETURNING * INTO paper;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'paper_id', paper.id,
    'pdf_storage_path', paper.pdf_storage_path
  );
END;
$$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('source-pdfs', 'source-pdfs', false, 52428800, ARRAY['application/pdf']::text[]),
  ('generated-papers', 'generated-papers', false, 20971520, ARRAY['application/pdf']::text[])
ON CONFLICT (id) DO UPDATE
SET public = false;

DO $containment$
DECLARE
  target_table_name text;
  table_object regclass;
  column_name text;
  routine_record record;
BEGIN
  FOREACH target_table_name IN ARRAY ARRAY[
    'question_sources',
    'question_bank_questions',
    'saved_question_papers',
    'saved_question_paper_items'
  ]
  LOOP
    table_object := to_regclass(format('public.%I', target_table_name));
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE %s FROM PUBLIC, anon, authenticated',
      table_object
    );
    FOR column_name IN
      SELECT columns.column_name
      FROM information_schema.columns
      WHERE columns.table_schema = 'public'
        AND columns.table_name = target_table_name
    LOOP
      EXECUTE format(
        'REVOKE ALL PRIVILEGES (%I) ON TABLE %s FROM PUBLIC, anon, authenticated',
        column_name,
        table_object
      );
    END LOOP;
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', table_object);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %s TO service_role', table_object);
  END LOOP;

  FOR routine_record IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS routine_name,
      pg_get_function_identity_arguments(p.oid) AS identity_arguments
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'question_bank_set_updated_at',
        'question_bank_normalize_mcq_options',
        'question_bank_mcq_options_are_valid',
        'question_bank_mcq_options_are_valid_normalized',
        'question_bank_protect_question_immutables',
        'question_bank_reject_final_paper_mutation',
        'persist_extracted_questions',
        'save_question_paper',
        'record_final_paper_pdf'
      )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
      routine_record.schema_name,
      routine_record.routine_name,
      routine_record.identity_arguments
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role',
      routine_record.schema_name,
      routine_record.routine_name,
      routine_record.identity_arguments
    );
  END LOOP;
END
$containment$;

COMMIT;
