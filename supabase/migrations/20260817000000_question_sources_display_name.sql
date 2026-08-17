-- Forward-only: named source papers on question_sources.
-- Does not edit applied migrations, V2 question rows, or legacy tables.

ALTER TABLE public.question_sources
  ADD COLUMN display_name text;

UPDATE public.question_sources
SET display_name = left(
  nullif(btrim(regexp_replace(original_filename, '\.pdf$', '', 'i')), ''),
  160
)
WHERE display_name IS NULL;

UPDATE public.question_sources
SET display_name = left(btrim(original_filename), 160)
WHERE display_name IS NULL OR btrim(display_name) = '';

ALTER TABLE public.question_sources
  ALTER COLUMN display_name SET NOT NULL;

ALTER TABLE public.question_sources
  ADD CONSTRAINT question_sources_display_name_len
  CHECK (
    display_name = btrim(display_name)
    AND char_length(display_name) BETWEEN 1 AND 160
  );
