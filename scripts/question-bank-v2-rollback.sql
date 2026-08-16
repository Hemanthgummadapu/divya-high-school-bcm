-- EMERGENCY ROLLBACK for Phase 2B additive objects only.
-- Do not run unless the V2 tables are empty and the migration must be reversed.
-- Does not modify public.questions, public.question_papers, or public.generated_pdfs.
-- Does not modify the diagrams bucket.

BEGIN;

DO $rollback_prereq$
DECLARE
  leftover text;
BEGIN
  SELECT string_agg(format('%I=%s', t.table_name, t.row_count), ', ')
    INTO leftover
  FROM (
    SELECT 'question_sources'::text AS table_name, count(*) AS row_count
    FROM public.question_sources
    UNION ALL
    SELECT 'question_bank_questions', count(*) FROM public.question_bank_questions
    UNION ALL
    SELECT 'saved_question_papers', count(*) FROM public.saved_question_papers
    UNION ALL
    SELECT 'saved_question_paper_items', count(*) FROM public.saved_question_paper_items
  ) AS t
  WHERE t.row_count > 0;

  IF leftover IS NOT NULL THEN
    RAISE EXCEPTION
      'Rollback aborted: Phase 2B tables are not empty (%). Archive or export first.',
      leftover;
  END IF;
END
$rollback_prereq$;

DROP TABLE IF EXISTS public.saved_question_paper_items;
DROP TABLE IF EXISTS public.saved_question_papers;
DROP TABLE IF EXISTS public.question_bank_questions;
DROP TABLE IF EXISTS public.question_sources;

DROP FUNCTION IF EXISTS public.record_final_paper_pdf(uuid, text, text, integer);
DROP FUNCTION IF EXISTS public.save_question_paper(uuid, text, integer, text, integer, text, integer, integer, jsonb, boolean);
DROP FUNCTION IF EXISTS public.persist_extracted_questions(uuid, text, integer, integer[], text, text, jsonb);
DROP FUNCTION IF EXISTS public.question_bank_reject_final_paper_mutation();
DROP FUNCTION IF EXISTS public.question_bank_protect_question_immutables();
DROP FUNCTION IF EXISTS public.question_bank_mcq_options_are_valid(jsonb);
DROP FUNCTION IF EXISTS public.question_bank_mcq_options_are_valid_normalized(jsonb);
DROP FUNCTION IF EXISTS public.question_bank_normalize_mcq_options(jsonb);
DROP FUNCTION IF EXISTS public.question_bank_set_updated_at();

DO $rollback_buckets$
DECLARE
  leftover_objects integer;
BEGIN
  SELECT count(*)
    INTO leftover_objects
  FROM storage.objects
  WHERE bucket_id IN ('source-pdfs', 'generated-papers');

  IF leftover_objects > 0 THEN
    RAISE EXCEPTION
      'Rollback aborted: % objects remain in source-pdfs or generated-papers',
      leftover_objects;
  END IF;

  DELETE FROM storage.buckets
  WHERE id IN ('source-pdfs', 'generated-papers');
END
$rollback_buckets$;

SELECT
  to_regclass('public.question_sources') IS NULL AS sources_dropped,
  to_regclass('public.question_bank_questions') IS NULL AS questions_dropped,
  to_regclass('public.saved_question_papers') IS NULL AS papers_dropped,
  to_regclass('public.saved_question_paper_items') IS NULL AS items_dropped,
  (SELECT count(*) FROM public.questions) AS legacy_questions,
  (SELECT count(*) FROM public.question_papers) AS legacy_question_papers,
  (SELECT count(*) FROM public.generated_pdfs) AS legacy_generated_pdfs;

COMMIT;
