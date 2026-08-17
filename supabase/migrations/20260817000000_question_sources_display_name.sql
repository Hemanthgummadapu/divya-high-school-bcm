-- Forward-only: named source papers on question_sources.
-- Does not edit applied migrations, V2 question rows, or legacy tables.
-- Backfill is fail-closed: an invalid value raises and rolls back.

ALTER TABLE public.question_sources
  ADD COLUMN display_name text;

UPDATE public.question_sources
SET display_name = coalesce(
  nullif(
    btrim(
      left(
        coalesce(
          nullif(
            btrim(regexp_replace(btrim(original_filename), '\.pdf$', '', 'i')),
            ''
          ),
          nullif(btrim(original_filename), ''),
          'Untitled paper'
        ),
        160
      )
    ),
    ''
  ),
  'Untitled paper'
)
WHERE display_name IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.question_sources
    WHERE display_name IS NULL
       OR display_name <> btrim(display_name)
       OR char_length(display_name) < 1
       OR char_length(display_name) > 160
  ) THEN
    RAISE EXCEPTION 'display_name backfill produced an invalid value';
  END IF;
END
$$;

ALTER TABLE public.question_sources
  ALTER COLUMN display_name SET NOT NULL;

ALTER TABLE public.question_sources
  ADD CONSTRAINT question_sources_display_name_len
  CHECK (
    display_name = btrim(display_name)
    AND char_length(display_name) BETWEEN 1 AND 160
  );
