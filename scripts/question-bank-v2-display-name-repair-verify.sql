-- Verifies the display_name repair migration on a disposable local Postgres.
-- Every check raises, so ON_ERROR_STOP=1 fails the run on any regression.

DO $$
DECLARE
  v text;
  n integer;
BEGIN
  -- 1. Trailing whitespace hid the extension from the original backfill.
  SELECT display_name INTO v FROM public.question_sources
   WHERE id = 'a0000000-0000-4000-8000-000000000001';
  IF v <> 'Class 9 Physics 2025' THEN
    RAISE EXCEPTION 'case 1 trim-before-strip failed: %', quote_literal(v);
  END IF;

  -- 2. Untrimmed value is trimmed.
  SELECT display_name INTO v FROM public.question_sources
   WHERE id = 'a0000000-0000-4000-8000-000000000002';
  IF v <> 'Class 8 Biology 2025' THEN
    RAISE EXCEPTION 'case 2 trim failed: %', quote_literal(v);
  END IF;

  -- 3. Empty string falls back to the filename, extension removed.
  SELECT display_name INTO v FROM public.question_sources
   WHERE id = 'a0000000-0000-4000-8000-000000000003';
  IF v <> 'Class 7 English 2024' THEN
    RAISE EXCEPTION 'case 3 empty fallback failed: %', quote_literal(v);
  END IF;

  -- 4. Null falls back to the filename.
  SELECT display_name INTO v FROM public.question_sources
   WHERE id = 'a0000000-0000-4000-8000-000000000004';
  IF v <> 'Class 6 Social Studies 2024' THEN
    RAISE EXCEPTION 'case 4 null fallback failed: %', quote_literal(v);
  END IF;

  -- 5. Overlong value is cut to exactly 160 characters.
  SELECT display_name INTO v FROM public.question_sources
   WHERE id = 'a0000000-0000-4000-8000-000000000005';
  IF char_length(v) <> 160 OR v <> repeat('L', 160) THEN
    RAISE EXCEPTION 'case 5 length cap failed: %', char_length(v);
  END IF;

  -- 6 & 7. Extension removal is case-insensitive.
  SELECT display_name INTO v FROM public.question_sources
   WHERE id = 'a0000000-0000-4000-8000-000000000006';
  IF v <> 'Class 10 Mathematics 2026' THEN
    RAISE EXCEPTION 'case 6 uppercase .PDF failed: %', quote_literal(v);
  END IF;
  SELECT display_name INTO v FROM public.question_sources
   WHERE id = 'a0000000-0000-4000-8000-000000000007';
  IF v <> 'Class 9 English 2025' THEN
    RAISE EXCEPTION 'case 7 mixed-case .Pdf failed: %', quote_literal(v);
  END IF;

  -- 8. Whitespace-only name falls back to the filename.
  SELECT display_name INTO v FROM public.question_sources
   WHERE id = 'a0000000-0000-4000-8000-000000000008';
  IF v <> 'Class 8 Mathematics Half Yearly' THEN
    RAISE EXCEPTION 'case 8 filename fallback failed: %', quote_literal(v);
  END IF;

  -- 9. Nothing usable anywhere.
  SELECT display_name INTO v FROM public.question_sources
   WHERE id = 'a0000000-0000-4000-8000-000000000009';
  IF v <> 'Untitled paper' THEN
    RAISE EXCEPTION 'case 9 Untitled paper failed: %', quote_literal(v);
  END IF;

  -- 10. A valid custom name is preserved byte-for-byte, including "pdf" used
  --     inside the name rather than as an extension.
  SELECT display_name INTO v FROM public.question_sources
   WHERE id = 'a0000000-0000-4000-8000-00000000000a';
  IF v <> 'Class 10 Mathematics Pre-Final 2026 (pdf scan)' THEN
    RAISE EXCEPTION 'case 10 custom name was modified: %', quote_literal(v);
  END IF;

  -- 11. Exactly 160 characters is valid and untouched.
  SELECT display_name INTO v FROM public.question_sources
   WHERE id = 'a0000000-0000-4000-8000-00000000000b';
  IF v <> repeat('E', 160) THEN
    RAISE EXCEPTION 'case 11 boundary length was modified';
  END IF;

  -- 12. No invalid value survives anywhere in the table.
  SELECT count(*) INTO n FROM public.question_sources
   WHERE display_name IS NULL
      OR display_name <> btrim(display_name)
      OR char_length(display_name) < 1
      OR char_length(display_name) > 160
      OR display_name ~* '\.pdf$';
  IF n <> 0 THEN
    RAISE EXCEPTION 'repair left % invalid display_name value(s)', n;
  END IF;
END
$$;

-- The repaired data satisfies the real production constraints, which the
-- fixtures dropped in order to exercise the wider damage cases. Re-adding them
-- here fails loudly if the repair produced anything the production schema
-- would reject.
-- This verifier runs twice (once after the repair, once after proving the
-- repair is a no-op), so re-adding is written to be repeatable.
ALTER TABLE public.question_sources ALTER COLUMN display_name SET NOT NULL;
ALTER TABLE public.question_sources
  DROP CONSTRAINT IF EXISTS question_sources_display_name_len;
ALTER TABLE public.question_sources
  ADD CONSTRAINT question_sources_display_name_len
  CHECK (
    display_name = btrim(display_name)
    AND char_length(display_name) BETWEEN 1 AND 160
  );
