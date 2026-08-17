-- Assert display_name backfill on disposable fixtures, then remove them
-- so RPC integration tests start from an empty V2 schema.

DO $$
DECLARE
  production_name text;
  case_name text;
  trimmed_name text;
  empty_strip_name text;
  invalid_count integer;
BEGIN
  SELECT display_name INTO production_name
  FROM public.question_sources
  WHERE id = '4b04d3ce-632b-45f5-a6a4-939ee69c37c8';
  IF production_name IS NULL OR btrim(production_name) = '' THEN
    RAISE EXCEPTION 'production source backfill was empty';
  END IF;
  IF production_name <> 'Class 10 Mathematics 2026' THEN
    RAISE EXCEPTION 'production source backfill mismatch: %', production_name;
  END IF;

  SELECT display_name INTO case_name
  FROM public.question_sources
  WHERE id = '11111111-1111-4111-8111-aaaaaaaaaaa1';
  IF case_name <> 'Pre-Final Mathematics' THEN
    RAISE EXCEPTION 'case-insensitive .pdf strip failed: %', case_name;
  END IF;

  SELECT display_name INTO trimmed_name
  FROM public.question_sources
  WHERE id = '11111111-1111-4111-8111-aaaaaaaaaaa2';
  IF trimmed_name <> 'Class 9 Science 2025' THEN
    RAISE EXCEPTION 'whitespace trim backfill failed: %', trimmed_name;
  END IF;

  SELECT display_name INTO empty_strip_name
  FROM public.question_sources
  WHERE id = '11111111-1111-4111-8111-aaaaaaaaaaa3';
  IF empty_strip_name IS NULL
     OR btrim(empty_strip_name) = ''
     OR char_length(empty_strip_name) > 160
     OR empty_strip_name <> btrim(empty_strip_name) THEN
    RAISE EXCEPTION 'empty-after-.pdf backfill was invalid: %', empty_strip_name;
  END IF;

  SELECT count(*) INTO invalid_count
  FROM public.question_sources
  WHERE display_name IS NULL
     OR display_name <> btrim(display_name)
     OR char_length(display_name) < 1
     OR char_length(display_name) > 160;
  IF invalid_count <> 0 THEN
    RAISE EXCEPTION 'backfill left % invalid display_name rows', invalid_count;
  END IF;

  BEGIN
    UPDATE public.question_sources
    SET display_name = '  padded  '
    WHERE id = '4b04d3ce-632b-45f5-a6a4-939ee69c37c8';
    RAISE EXCEPTION 'constraint should have rejected a padded display_name';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;
END
$$;

DELETE FROM public.question_sources
WHERE id IN (
  '4b04d3ce-632b-45f5-a6a4-939ee69c37c8',
  '11111111-1111-4111-8111-aaaaaaaaaaa1',
  '11111111-1111-4111-8111-aaaaaaaaaaa2',
  '11111111-1111-4111-8111-aaaaaaaaaaa3'
);
