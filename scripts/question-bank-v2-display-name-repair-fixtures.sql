-- Disposable fixtures for the display_name repair migration. Applied to a
-- local throwaway Postgres after 20260817000000, then verified and discarded.
-- These rows simulate what the original un-hardened backfill could leave
-- behind. No production data is used.

-- 20260817000000 leaves behind NOT NULL plus a CHECK constraint requiring a
-- trimmed value of 1..160 characters. Production therefore cannot hold a null,
-- empty, untrimmed or overlong name; the one damage case the constraint does
-- NOT catch is a name that still ends in ".pdf", which happens when the
-- original filename had trailing whitespace and the old backfill's "\.pdf$"
-- anchor could not match.
--
-- Both constraints are dropped here so the repair can be proven against the
-- wider set of cases as well. The verifier re-adds both, which asserts that
-- the repaired data satisfies the real production constraints.
ALTER TABLE public.question_sources ALTER COLUMN display_name DROP NOT NULL;
ALTER TABLE public.question_sources
  DROP CONSTRAINT question_sources_display_name_len;

INSERT INTO public.question_sources (
  id, original_filename, display_name, storage_path, content_sha256, mime_type,
  byte_size, page_count, grade, subject, academic_year, extraction_status,
  processed_page_count, failed_page_numbers, extracted_question_count
) VALUES
  -- 1. Trailing whitespace meant the ".pdf" anchor never matched (the bug).
  ('a0000000-0000-4000-8000-000000000001', 'Class 9 Physics 2025.pdf ',
   'Class 9 Physics 2025.pdf ',
   'source-pdfs/a0000000-0000-4000-8000-000000000001/original.pdf',
   repeat('a', 64), 'application/pdf', 1024, 3, 9, 'Physics', 2025, 'completed', 3, '{}', 5),
  -- 2. Untrimmed only.
  ('a0000000-0000-4000-8000-000000000002', 'Class 8 Biology 2025.pdf',
   '   Class 8 Biology 2025   ',
   'source-pdfs/a0000000-0000-4000-8000-000000000002/original.pdf',
   repeat('b', 64), 'application/pdf', 1024, 3, 8, 'Biology', 2025, 'completed', 3, '{}', 4),
  -- 3. Empty string.
  ('a0000000-0000-4000-8000-000000000003', 'Class 7 English 2024.pdf', '',
   'source-pdfs/a0000000-0000-4000-8000-000000000003/original.pdf',
   repeat('c', 64), 'application/pdf', 1024, 2, 7, 'English', 2024, 'completed', 2, '{}', 3),
  -- 4. Null (constraint-free database only).
  ('a0000000-0000-4000-8000-000000000004', 'Class 6 Social Studies 2024.pdf', NULL,
   'source-pdfs/a0000000-0000-4000-8000-000000000004/original.pdf',
   repeat('d', 64), 'application/pdf', 1024, 2, 6, 'Social Studies', 2024, 'completed', 2, '{}', 2),
  -- 5. Over 160 characters.
  ('a0000000-0000-4000-8000-000000000005', 'long.pdf', repeat('L', 200),
   'source-pdfs/a0000000-0000-4000-8000-000000000005/original.pdf',
   repeat('e', 64), 'application/pdf', 1024, 2, 10, 'Mathematics', 2026, 'completed', 2, '{}', 2),
  -- 6. Uppercase extension.
  ('a0000000-0000-4000-8000-000000000006', 'SCAN2026.PDF', 'Class 10 Mathematics 2026.PDF',
   'source-pdfs/a0000000-0000-4000-8000-000000000006/original.pdf',
   repeat('f', 64), 'application/pdf', 1024, 2, 10, 'Mathematics', 2026, 'completed', 2, '{}', 2),
  -- 7. Mixed-case extension.
  ('a0000000-0000-4000-8000-000000000007', 'paper.Pdf', 'Class 9 English 2025.Pdf',
   'source-pdfs/a0000000-0000-4000-8000-000000000007/original.pdf',
   repeat('1', 64), 'application/pdf', 1024, 2, 9, 'English', 2025, 'completed', 2, '{}', 2),
  -- 8. Nothing usable in display_name; falls back to the filename.
  ('a0000000-0000-4000-8000-000000000008', 'Class 8 Mathematics Half Yearly.pdf', '   ',
   'source-pdfs/a0000000-0000-4000-8000-000000000008/original.pdf',
   repeat('2', 64), 'application/pdf', 1024, 2, 8, 'Mathematics', 2025, 'completed', 2, '{}', 2),
  -- 9. Nothing usable anywhere; must become 'Untitled paper'.
  ('a0000000-0000-4000-8000-000000000009', '.pdf', '.pdf',
   'source-pdfs/a0000000-0000-4000-8000-000000000009/original.pdf',
   repeat('3', 64), 'application/pdf', 1024, 2, 7, 'Science', 2024, 'completed', 2, '{}', 2),
  -- 10. Already valid custom name: must be preserved byte-for-byte, including
  --     the word "pdf" used legitimately inside the name.
  ('a0000000-0000-4000-8000-00000000000a', 'whatever.pdf',
   'Class 10 Mathematics Pre-Final 2026 (pdf scan)',
   'source-pdfs/a0000000-0000-4000-8000-00000000000a/original.pdf',
   repeat('4', 64), 'application/pdf', 1024, 2, 10, 'Mathematics', 2026, 'completed', 2, '{}', 2),
  -- 11. Exactly 160 characters: valid, must be untouched.
  ('a0000000-0000-4000-8000-00000000000b', 'edge.pdf', repeat('E', 160),
   'source-pdfs/a0000000-0000-4000-8000-00000000000b/original.pdf',
   repeat('5', 64), 'application/pdf', 1024, 2, 10, 'Mathematics', 2026, 'completed', 2, '{}', 2);
