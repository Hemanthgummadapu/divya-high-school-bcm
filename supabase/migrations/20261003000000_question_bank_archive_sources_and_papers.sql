-- Question bank: archive uploaded sources and saved papers.
--
-- Reviewers need a way to clear an upload off the Sources list once its
-- questions are in the bank, and to clear a saved paper off Saved Papers.
-- Both screens previously answered 405: deletion was never built.
--
-- Archiving, not deleting, is what this adds, and deliberately so:
--   * question_bank_questions.source_id is ON DELETE RESTRICT, so a real
--     delete would either fail or force us to destroy reviewed questions.
--     The questions are the whole point of the upload; they stay.
--   * Both tables already carry an 'archived' status the original schema
--     anticipated, so this uses the seam that was left for it.
--   * The row is kept, so content_sha256 still blocks a duplicate re-upload
--     and the audit trail of what was processed survives.
-- The stored PDF itself is released by the caller after this returns the
-- path, which is the part that actually frees space.

-- Archive one uploaded source. Idempotent: archiving twice is a no-op that
-- still reports the storage path, so a retried request finishes the cleanup
-- rather than failing. Returns the path so the caller can drop the object.
CREATE OR REPLACE FUNCTION public.archive_question_source(p_source_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  source public.question_sources%ROWTYPE;
BEGIN
  IF p_source_id IS NULL THEN
    RAISE EXCEPTION 'source_id_required';
  END IF;

  SELECT * INTO source
  FROM public.question_sources
  WHERE id = p_source_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'source_not_found';
  END IF;

  -- An extraction in flight still reads the PDF; let it finish or fail first.
  IF source.extraction_status = 'processing' THEN
    RAISE EXCEPTION 'source_is_processing';
  END IF;

  IF source.extraction_status = 'archived' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'source_id', source.id,
      'storage_path', source.storage_path,
      'kept_question_count', source.extracted_question_count
    );
  END IF;

  UPDATE public.question_sources
  SET extraction_status = 'archived'
  WHERE id = p_source_id
  RETURNING * INTO source;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'source_id', source.id,
    'storage_path', source.storage_path,
    'kept_question_count', source.extracted_question_count
  );
END;
$$;

-- A finalized paper is immutable, and stays immutable in every way that
-- changes what the paper SAYS: title, grade, subject, marks, composition and
-- finalize snapshot are all still frozen, and its items are untouched. The
-- one transition opened here is retiring it from the list and releasing its
-- generated PDF, which alters no exam content.
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
  archive_transition boolean;
  identity_unchanged boolean;
BEGIN
  IF TG_TABLE_NAME = 'saved_question_papers' THEN
    IF TG_OP = 'DELETE' AND OLD.status = 'final' THEN
      RAISE EXCEPTION 'final papers are immutable';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.status = 'final' THEN
      identity_unchanged :=
        NEW.title IS NOT DISTINCT FROM OLD.title
        AND NEW.grade IS NOT DISTINCT FROM OLD.grade
        AND NEW.subject IS NOT DISTINCT FROM OLD.subject
        AND NEW.academic_year IS NOT DISTINCT FROM OLD.academic_year
        AND NEW.duration_minutes IS NOT DISTINCT FROM OLD.duration_minutes
        AND NEW.total_marks IS NOT DISTINCT FROM OLD.total_marks
        AND NEW.creation_key IS NOT DISTINCT FROM OLD.creation_key
        AND NEW.finalize_snapshot IS NOT DISTINCT FROM OLD.finalize_snapshot
        AND NEW.lock_version IS NOT DISTINCT FROM OLD.lock_version
        AND NEW.finalized_at IS NOT DISTINCT FROM OLD.finalized_at;
      pdf_fill_in :=
        NEW.status = 'final'
        AND identity_unchanged
        AND OLD.pdf_storage_path IS NULL
        AND OLD.pdf_sha256 IS NULL
        AND OLD.pdf_byte_size IS NULL
        AND NEW.pdf_storage_path IS NOT NULL
        AND NEW.pdf_sha256 IS NOT NULL
        AND NEW.pdf_byte_size IS NOT NULL;
      archive_transition :=
        NEW.status = 'archived'
        AND identity_unchanged
        AND NEW.pdf_storage_path IS NULL
        AND NEW.pdf_sha256 IS NULL
        AND NEW.pdf_byte_size IS NULL;
      IF NOT (pdf_fill_in OR archive_transition) THEN
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

-- Archive one saved paper and release its generated PDF. The paper's items
-- are left in place, so the questions stay in the bank and the record of what
-- the paper contained survives. Idempotent for the same reason as above.
CREATE OR REPLACE FUNCTION public.archive_saved_question_paper(p_paper_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  paper public.saved_question_papers%ROWTYPE;
  released_path text;
BEGIN
  IF p_paper_id IS NULL THEN
    RAISE EXCEPTION 'paper_id_required';
  END IF;

  SELECT * INTO paper
  FROM public.saved_question_papers
  WHERE id = p_paper_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'paper_not_found';
  END IF;

  IF paper.status = 'archived' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'paper_id', paper.id,
      'storage_path', NULL
    );
  END IF;

  released_path := paper.pdf_storage_path;

  UPDATE public.saved_question_papers
  SET
    status = 'archived',
    pdf_storage_path = NULL,
    pdf_sha256 = NULL,
    pdf_byte_size = NULL
  WHERE id = p_paper_id
  RETURNING * INTO paper;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'paper_id', paper.id,
    'storage_path', released_path
  );
END;
$$;

-- Same containment as every other routine in this schema: unreachable from
-- anon/authenticated, callable only by the service role the server uses.
DO $containment$
DECLARE
  routine_record record;
BEGIN
  FOR routine_record IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS routine_name,
      pg_get_function_identity_arguments(p.oid) AS identity_arguments
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'archive_question_source',
        'archive_saved_question_paper',
        'question_bank_reject_final_paper_mutation'
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
