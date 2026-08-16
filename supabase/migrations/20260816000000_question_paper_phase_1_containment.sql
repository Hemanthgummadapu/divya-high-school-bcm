-- UNAPPLIED: Phase 1 question-paper containment.
-- Do not apply automatically during application deployment.
-- Deploy the Phase 1 application first, then apply this SQL manually.
-- Scope: public.questions, public.question_papers, public.generated_pdfs,
-- their owned sequences, routines whose definitions reference those objects,
-- and the dedicated storage bucket "diagrams" when it exists.
--
-- Prerequisites before execution:
-- 1. Confirm all three tables belong only to the question-paper subsystem.
-- 2. Capture current table, sequence, routine, RLS-policy, and bucket grants.
-- 3. Confirm the deployed server uses SUPABASE_SERVICE_ROLE_KEY only after
--    question-paper authorization.
-- 4. Inspect storage.objects policies separately. Do not remove a broad
--    policy unless its impact on unrelated buckets has been established.
-- 5. Schedule a maintenance window: authenticated/anon PostgREST access is
--    intentionally denied immediately.

BEGIN;

DO $containment$
DECLARE
  target_table_name text;
  table_object regclass;
  column_name text;
BEGIN
  FOREACH target_table_name IN ARRAY ARRAY[
    'questions',
    'question_papers',
    'generated_pdfs'
  ]
  LOOP
    table_object := to_regclass(format('public.%I', target_table_name));
    IF table_object IS NULL THEN
      RAISE EXCEPTION 'Required question-paper table public.% is missing', target_table_name;
    END IF;

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
  END LOOP;
END
$containment$;

DO $containment$
DECLARE
  sequence_record record;
BEGIN
  FOR sequence_record IN
    SELECT DISTINCT sequence_namespace.nspname AS schema_name,
           sequence_object.relname AS object_name
    FROM pg_class AS sequence_object
    JOIN pg_namespace AS sequence_namespace
      ON sequence_namespace.oid = sequence_object.relnamespace
    JOIN pg_depend AS dependency
      ON dependency.classid = 'pg_class'::regclass
      AND dependency.objid = sequence_object.oid
      AND dependency.refclassid = 'pg_class'::regclass
      AND dependency.deptype = 'a'
    JOIN pg_class AS owning_table
      ON owning_table.oid = dependency.refobjid
    JOIN pg_namespace AS table_namespace
      ON table_namespace.oid = owning_table.relnamespace
    WHERE sequence_object.relkind = 'S'
      AND table_namespace.nspname = 'public'
      AND owning_table.relname IN (
        'questions',
        'question_papers',
        'generated_pdfs'
      )
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON SEQUENCE %I.%I FROM PUBLIC, anon, authenticated',
      sequence_record.schema_name,
      sequence_record.object_name
    );
  END LOOP;
END
$containment$;

DO $containment$
DECLARE
  routine_record record;
BEGIN
  FOR routine_record IN
    SELECT DISTINCT routine.oid,
           routine_namespace.nspname AS schema_name,
           routine.proname AS routine_name,
           CASE WHEN routine.prokind = 'p' THEN 'PROCEDURE' ELSE 'FUNCTION' END
             AS object_keyword,
           pg_get_function_identity_arguments(routine.oid) AS identity_arguments
    FROM pg_proc AS routine
    JOIN pg_namespace AS routine_namespace
      ON routine_namespace.oid = routine.pronamespace
    JOIN pg_depend AS routine_dependency
      ON routine_dependency.classid = 'pg_proc'::regclass
      AND routine_dependency.objid = routine.oid
      AND routine_dependency.refclassid = 'pg_class'::regclass
    JOIN pg_class AS referenced_table
      ON referenced_table.oid = routine_dependency.refobjid
    JOIN pg_namespace AS referenced_namespace
      ON referenced_namespace.oid = referenced_table.relnamespace
    WHERE routine_namespace.nspname = 'public'
      AND routine.prokind IN ('f', 'p')
      AND referenced_namespace.nspname = 'public'
      AND referenced_table.relname IN (
        'questions',
        'question_papers',
        'generated_pdfs'
      )
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON %s %I.%I(%s) FROM PUBLIC, anon, authenticated',
      routine_record.object_keyword,
      routine_record.schema_name,
      routine_record.routine_name,
      routine_record.identity_arguments
    );
  END LOOP;
END
$containment$;

-- PL/pgSQL and dynamic-SQL references may not create pg_depend records. Stop
-- the transaction if an unclassified security-definer routine appears to
-- reference a protected object. Review it and add an exact REVOKE before retry.
DO $containment$
DECLARE
  routine_record record;
BEGIN
  FOR routine_record IN
    SELECT routine.oid,
           routine_namespace.nspname AS schema_name,
           routine.proname AS routine_name
    FROM pg_proc AS routine
    JOIN pg_namespace AS routine_namespace
      ON routine_namespace.oid = routine.pronamespace
    WHERE routine_namespace.nspname = 'public'
      AND routine.prosecdef
      AND routine.prokind IN ('f', 'p')
      AND pg_get_functiondef(routine.oid)
        ~* '\m(from|join|update|into|table|delete[[:space:]]+from)[[:space:]]+(public\.)?(questions|question_papers|generated_pdfs)\M'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend AS routine_dependency
        JOIN pg_class AS referenced_table
          ON referenced_table.oid = routine_dependency.refobjid
        JOIN pg_namespace AS referenced_namespace
          ON referenced_namespace.oid = referenced_table.relnamespace
        WHERE routine_dependency.classid = 'pg_proc'::regclass
          AND routine_dependency.objid = routine.oid
          AND routine_dependency.refclassid = 'pg_class'::regclass
          AND referenced_namespace.nspname = 'public'
          AND referenced_table.relname IN (
            'questions',
            'question_papers',
            'generated_pdfs'
          )
      )
  LOOP
    RAISE EXCEPTION
      'Unreviewed security-definer routine %.% must be classified before containment',
      routine_record.schema_name,
      routine_record.routine_name;
  END LOOP;
END
$containment$;

UPDATE storage.buckets
SET public = false
WHERE id = 'diagrams';

COMMIT;

-- Verification queries (expected result follows each query):
--
-- SELECT table_name, grantee, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public'
--   AND table_name IN ('questions', 'question_papers', 'generated_pdfs')
--   AND grantee IN ('PUBLIC', 'anon', 'authenticated');
-- Expected: zero rows.
--
-- SELECT table_name, column_name, grantee, privilege_type
-- FROM information_schema.column_privileges
-- WHERE table_schema = 'public'
--   AND table_name IN ('questions', 'question_papers', 'generated_pdfs')
--   AND grantee IN ('PUBLIC', 'anon', 'authenticated');
-- Expected: zero rows.
--
-- WITH protected_sequences AS (
--   SELECT DISTINCT sequence_namespace.nspname AS sequence_schema,
--          sequence_object.relname AS sequence_name
--   FROM pg_class AS sequence_object
--   JOIN pg_namespace AS sequence_namespace
--     ON sequence_namespace.oid = sequence_object.relnamespace
--   JOIN pg_depend AS dependency
--     ON dependency.classid = 'pg_class'::regclass
--     AND dependency.objid = sequence_object.oid
--     AND dependency.refclassid = 'pg_class'::regclass
--     AND dependency.deptype = 'a'
--   JOIN pg_class AS owning_table ON owning_table.oid = dependency.refobjid
--   WHERE sequence_object.relkind = 'S'
--     AND owning_table.relname IN (
--       'questions', 'question_papers', 'generated_pdfs'
--     )
-- )
-- SELECT grants.sequence_schema, grants.sequence_name,
--        grants.grantee, grants.privilege_type
-- FROM information_schema.role_usage_grants AS grants
-- JOIN protected_sequences USING (sequence_schema, sequence_name)
-- WHERE grants.grantee IN ('PUBLIC', 'anon', 'authenticated');
-- Expected: zero rows.
--
-- SELECT relname, relrowsecurity
-- FROM pg_class
-- WHERE oid IN (
--   'public.questions'::regclass,
--   'public.question_papers'::regclass,
--   'public.generated_pdfs'::regclass
-- );
-- Expected: all relrowsecurity values are true.
--
-- SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('questions', 'question_papers', 'generated_pdfs');
-- Expected: no policy grants PUBLIC/anon/authenticated access. This migration creates
-- no permissive policy; no matching policy means direct access remains denied.
--
-- SELECT routine_schema, routine_name, grantee, privilege_type
-- FROM information_schema.routine_privileges
-- WHERE routine_schema = 'public'
--   AND grantee IN ('PUBLIC', 'anon', 'authenticated')
--   AND routine_name IN (
--     SELECT routine.proname
--     FROM pg_proc AS routine
--     JOIN pg_depend AS dependency
--       ON dependency.classid = 'pg_proc'::regclass
--       AND dependency.objid = routine.oid
--       AND dependency.refclassid = 'pg_class'::regclass
--     JOIN pg_class AS referenced_table
--       ON referenced_table.oid = dependency.refobjid
--     WHERE referenced_table.relname IN (
--       'questions', 'question_papers', 'generated_pdfs'
--     )
--   );
-- Expected: zero rows for routines dependent on protected tables.
--
-- SELECT id, public FROM storage.buckets WHERE id = 'diagrams';
-- Expected: zero rows if the bucket does not exist, otherwise public = false.
--
-- SELECT policyname, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'storage' AND tablename = 'objects';
-- Expected: manually verify no policy grants anon/authenticated access to
-- bucket_id = 'diagrams'. Stop if a broad policy also serves unrelated buckets.
--
-- Manual emergency rollback:
-- Do not use generic GRANT ALL or blindly disable RLS. Before applying this
-- migration, generate and securely retain an exact rollback script containing:
--   * each pre-change table/sequence/routine grant;
--   * each table's pre-change relrowsecurity value;
--   * the diagrams bucket's pre-change public value.
-- Restore only those captured values inside a transaction, then rerun the
-- verification queries. If that inventory was not captured, stop and restore
-- from a reviewed database backup instead of guessing historical privileges.
