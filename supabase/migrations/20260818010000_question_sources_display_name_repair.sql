-- Forward-only repair of question_sources.display_name.
--
-- 20260817000000 was applied before its backfill was hardened. Supabase tracks
-- migrations by version rather than by content, so the hardened backfill can
-- never rerun where that version is already recorded. This migration re-applies
-- the same normalization as a separate forward step.
--
-- Touches nothing but invalid display_name values: no schema, grant, RLS,
-- storage, question, paper-item or legacy-table change. A database that already
-- holds only valid names is left completely unchanged (no-op).

BEGIN;

-- Only rows that fail the hardened rules are rewritten, so a name the user
-- typed themselves is preserved exactly as it is.
UPDATE public.question_sources
SET display_name = coalesce(
  -- 1. Salvage the existing name: trim, drop a trailing ".pdf", trim again.
  nullif(
    btrim(
      left(
        btrim(regexp_replace(btrim(coalesce(display_name, '')), '\.pdf$', '', 'i')),
        160
      )
    ),
    ''
  ),
  -- 2. Fall back to the original filename under the same rules.
  nullif(
    btrim(
      left(
        btrim(regexp_replace(btrim(coalesce(original_filename, '')), '\.pdf$', '', 'i')),
        160
      )
    ),
    ''
  ),
  -- 3. Only when nothing usable remains.
  'Untitled paper'
)
WHERE display_name IS NULL
   OR display_name <> btrim(display_name)
   OR char_length(btrim(coalesce(display_name, ''))) < 1
   OR char_length(display_name) > 160
   OR display_name ~* '\.pdf$';

-- Fail closed: any remaining invalid value rolls the whole migration back.
DO $$
DECLARE
  invalid_count integer;
BEGIN
  SELECT count(*) INTO invalid_count
  FROM public.question_sources
  WHERE display_name IS NULL
     OR display_name <> btrim(display_name)
     OR char_length(display_name) < 1
     OR char_length(display_name) > 160
     OR display_name ~* '\.pdf$';

  IF invalid_count > 0 THEN
    RAISE EXCEPTION
      'display_name repair left % invalid value(s)', invalid_count;
  END IF;
END
$$;

COMMIT;
