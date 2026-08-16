-- READ ONLY. Post-check for 20260816020000_persist_extracted_questions_page_number.sql
-- Returns one row: verify_json.

BEGIN TRANSACTION READ ONLY;

WITH
fn AS (
  SELECT
    p.oid,
    p.proname,
    pg_get_function_identity_arguments(p.oid) AS identity_args,
    pg_get_function_result(p.oid) AS result,
    p.prosecdef AS security_definer,
    p.proconfig,
    pg_get_userbyid(p.proowner) AS owner,
    pg_get_functiondef(p.oid) AS definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'persist_extracted_questions'
),
grants AS (
  SELECT rp.grantee, rp.privilege_type
  FROM information_schema.routine_privileges rp
  WHERE rp.routine_schema = 'public'
    AND rp.routine_name = 'persist_extracted_questions'
),
legacy AS (
  SELECT
    (SELECT count(*) FROM public.questions) AS questions,
    (SELECT count(*) FROM public.question_papers) AS question_papers,
    (SELECT count(*) FROM public.generated_pdfs) AS generated_pdfs
)
SELECT json_build_object(
  'persist_ambiguity_passed',
    (SELECT count(*) FROM fn) = 1
    AND (SELECT NOT security_definer FROM fn)
    AND (SELECT result FROM fn) = 'jsonb'
    AND (SELECT identity_args FROM fn) =
      'p_source_id uuid, p_idempotency_key text, p_processed_page_count integer, p_failed_page_numbers integer[], p_error_category text, p_error_message text, p_questions jsonb'
    AND (SELECT proconfig FROM fn) @> ARRAY['search_path=public']
    AND (SELECT owner FROM fn) = 'postgres'
    AND (SELECT definition FROM fn) LIKE '%failed_page(page_no)%'
    AND (SELECT definition FROM fn) NOT LIKE '%unnest(failed_pages) AS page_number%'
    AND (SELECT count(*) FROM grants WHERE grantee IN ('PUBLIC', 'anon', 'authenticated')) = 0
    AND (SELECT count(*) FROM grants WHERE grantee = 'service_role' AND privilege_type = 'EXECUTE') = 1,
  'security_invoker', (SELECT NOT security_definer FROM fn),
  'service_role_execute', (
    SELECT count(*) FROM grants
    WHERE grantee = 'service_role' AND privilege_type = 'EXECUTE'
  ) = 1,
  'anon_authenticated_execute', (
    SELECT count(*) FROM grants
    WHERE grantee IN ('PUBLIC', 'anon', 'authenticated')
  ),
  'legacy_counts', (SELECT row_to_json(legacy) FROM legacy)
) AS verify_json;

COMMIT;
