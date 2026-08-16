-- READ ONLY. Phase 2B question-bank foundation verification.
-- Do not apply the migration with this file.
-- Returns one row: verify_json.

BEGIN TRANSACTION READ ONLY;

WITH
expected_tables(table_name) AS (
  VALUES
    ('question_sources'),
    ('question_bank_questions'),
    ('saved_question_papers'),
    ('saved_question_paper_items')
),
legacy_tables(table_name, expected_rows) AS (
  VALUES
    ('questions', 0),
    ('question_papers', 4),
    ('generated_pdfs', 51)
),
expected_routines(routine_name) AS (
  VALUES
    ('persist_extracted_questions'),
    ('save_question_paper'),
    ('record_final_paper_pdf'),
    ('question_bank_set_updated_at'),
    ('question_bank_normalize_mcq_options'),
    ('question_bank_mcq_options_are_valid'),
    ('question_bank_mcq_options_are_valid_normalized'),
    ('question_bank_page_numbers_are_valid'),
    ('question_bank_protect_question_immutables'),
    ('question_bank_reject_final_paper_mutation')
),
table_state AS (
  SELECT
    expected.table_name,
    EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = expected.table_name
        AND c.relkind = 'r'
    ) AS exists,
    COALESCE(c.relrowsecurity, false) AS rls_enabled,
    COALESCE(c.relforcerowsecurity, false) AS rls_forced,
    CASE expected.table_name
      WHEN 'question_sources' THEN (SELECT count(*) FROM public.question_sources)
      WHEN 'question_bank_questions' THEN (SELECT count(*) FROM public.question_bank_questions)
      WHEN 'saved_question_papers' THEN (SELECT count(*) FROM public.saved_question_papers)
      WHEN 'saved_question_paper_items' THEN (SELECT count(*) FROM public.saved_question_paper_items)
    END AS row_count
  FROM expected_tables AS expected
  LEFT JOIN pg_class c
    ON c.oid = to_regclass(format('public.%I', expected.table_name))
),
legacy_state AS (
  SELECT
    legacy.table_name,
    legacy.expected_rows,
    CASE legacy.table_name
      WHEN 'questions' THEN (SELECT count(*) FROM public.questions)
      WHEN 'question_papers' THEN (SELECT count(*) FROM public.question_papers)
      WHEN 'generated_pdfs' THEN (SELECT count(*) FROM public.generated_pdfs)
    END AS row_count
  FROM legacy_tables AS legacy
),
anon_auth_table_grants AS (
  SELECT g.table_name, g.grantee, g.privilege_type
  FROM information_schema.role_table_grants AS g
  WHERE g.table_schema = 'public'
    AND g.table_name IN (
      SELECT table_name FROM expected_tables
      UNION ALL
      SELECT table_name FROM legacy_tables
    )
    AND g.grantee IN ('PUBLIC', 'anon', 'authenticated')
),
anon_auth_column_grants AS (
  SELECT g.table_name, g.column_name, g.grantee, g.privilege_type
  FROM information_schema.column_privileges AS g
  WHERE g.table_schema = 'public'
    AND g.table_name IN (
      SELECT table_name FROM expected_tables
      UNION ALL
      SELECT table_name FROM legacy_tables
    )
    AND g.grantee IN ('PUBLIC', 'anon', 'authenticated')
),
service_role_table_grants AS (
  SELECT g.table_name, g.privilege_type
  FROM information_schema.role_table_grants AS g
  WHERE g.table_schema = 'public'
    AND g.table_name IN (SELECT table_name FROM expected_tables)
    AND g.grantee = 'service_role'
    AND g.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
),
table_policies AS (
  SELECT c.relname AS table_name, p.polname AS policy_name
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN (
      SELECT table_name FROM expected_tables
      UNION ALL
      SELECT table_name FROM legacy_tables
    )
),
routines AS (
  SELECT
    expected.routine_name,
    routine.prosecdef AS security_definer,
    pg_get_userbyid(routine.proowner) AS owner,
    routine.proconfig
  FROM expected_routines AS expected
  LEFT JOIN pg_proc AS routine
    ON routine.proname = expected.routine_name
   AND routine.pronamespace = 'public'::regnamespace
),
routine_grants AS (
  SELECT rp.routine_name, rp.grantee, rp.privilege_type
  FROM information_schema.routine_privileges rp
  WHERE rp.routine_schema = 'public'
    AND rp.routine_name IN (
      'persist_extracted_questions',
      'save_question_paper',
      'record_final_paper_pdf'
    )
    AND rp.grantee IN ('PUBLIC', 'anon', 'authenticated')
),
service_role_rpc_grants AS (
  SELECT rp.routine_name, rp.privilege_type
  FROM information_schema.routine_privileges rp
  WHERE rp.routine_schema = 'public'
    AND rp.routine_name IN (
      'persist_extracted_questions',
      'save_question_paper',
      'record_final_paper_pdf'
    )
    AND rp.grantee = 'service_role'
    AND rp.privilege_type = 'EXECUTE'
),
buckets AS (
  SELECT b.id, b.public
  FROM storage.buckets AS b
  WHERE b.id IN ('source-pdfs', 'generated-papers', 'diagrams')
),
legacy_rls AS (
  SELECT
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('questions', 'question_papers', 'generated_pdfs')
),
checks AS (
  SELECT
    (SELECT bool_and(table_state.exists AND table_state.rls_enabled) FROM table_state)
      AS v2_tables_exist_with_rls,
    (SELECT bool_and(table_state.row_count = 0) FROM table_state)
      AS v2_tables_empty,
    (SELECT count(*) = 0 FROM table_policies) AS no_public_policies,
    (SELECT count(*) = 0 FROM anon_auth_table_grants) AS no_anon_authenticated_table_grants,
    (SELECT count(*) = 0 FROM anon_auth_column_grants) AS no_anon_authenticated_column_grants,
    (
      SELECT bool_and(EXISTS (
        SELECT 1
        FROM service_role_table_grants g
        WHERE g.table_name = t.table_name
          AND g.privilege_type = p.priv
      ))
      FROM expected_tables t
      CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) AS p(priv)
    ) AS service_role_table_grants_intact,
    (SELECT count(*) = 0 FROM routine_grants) AS no_anon_authenticated_rpc_grants,
    (
      SELECT bool_and(EXISTS (
        SELECT 1
        FROM service_role_rpc_grants g
        WHERE g.routine_name = r.routine_name
      ))
      FROM (VALUES
        ('persist_extracted_questions'),
        ('save_question_paper'),
        ('record_final_paper_pdf')
      ) AS r(routine_name)
    ) AS service_role_rpc_grants_intact,
    (
      SELECT bool_and(NOT coalesce(routines.security_definer, true))
      FROM routines
    ) AS functions_are_security_invoker,
    (
      SELECT bool_and(coalesce(routines.proconfig, ARRAY[]::text[]) @> ARRAY['search_path=public'])
      FROM routines
    ) AS functions_have_fixed_search_path,
    (
      SELECT count(*) = 10 FROM routines WHERE routines.owner IS NOT NULL
    ) AS expected_functions_exist,
    (
      SELECT bool_and(b.public = false)
      FROM buckets AS b
      WHERE b.id IN ('source-pdfs', 'generated-papers')
    ) AS new_buckets_are_private,
    (
      SELECT EXISTS (
        SELECT 1 FROM buckets AS b WHERE b.id = 'diagrams' AND b.public = false
      )
    ) AS diagrams_bucket_still_private,
    (SELECT bool_and(legacy_state.row_count = legacy_state.expected_rows) FROM legacy_state)
      AS legacy_counts_unchanged,
    (SELECT bool_and(legacy_rls.rls_enabled) FROM legacy_rls)
      AS phase_1_legacy_rls_enabled
)
SELECT jsonb_build_object(
  'tables', COALESCE((SELECT jsonb_agg(to_jsonb(table_state) ORDER BY table_state.table_name) FROM table_state), '[]'::jsonb),
  'legacy', COALESCE((SELECT jsonb_agg(to_jsonb(legacy_state) ORDER BY legacy_state.table_name) FROM legacy_state), '[]'::jsonb),
  'anon_authenticated_table_grants', COALESCE((SELECT jsonb_agg(to_jsonb(anon_auth_table_grants)) FROM anon_auth_table_grants), '[]'::jsonb),
  'table_policies', COALESCE((SELECT jsonb_agg(to_jsonb(table_policies)) FROM table_policies), '[]'::jsonb),
  'routines', COALESCE((SELECT jsonb_agg(to_jsonb(routines) ORDER BY routines.routine_name) FROM routines), '[]'::jsonb),
  'buckets', COALESCE((SELECT jsonb_agg(to_jsonb(buckets) ORDER BY buckets.id) FROM buckets), '[]'::jsonb),
  'checks', to_jsonb(checks),
  'phase_2b_passed', (
    checks.v2_tables_exist_with_rls
    AND checks.v2_tables_empty
    AND checks.no_public_policies
    AND checks.no_anon_authenticated_table_grants
    AND checks.no_anon_authenticated_column_grants
    AND checks.service_role_table_grants_intact
    AND checks.no_anon_authenticated_rpc_grants
    AND checks.service_role_rpc_grants_intact
    AND checks.functions_are_security_invoker
    AND checks.functions_have_fixed_search_path
    AND checks.expected_functions_exist
    AND checks.new_buckets_are_private
    AND checks.diagrams_bucket_still_private
    AND checks.legacy_counts_unchanged
    AND checks.phase_1_legacy_rls_enabled
  )
) AS verify_json
FROM checks;

COMMIT;
