-- Removing a source should let the same PDF be uploaded again.
--
-- Removing archives the row rather than deleting it, because
-- question_bank_questions references it with ON DELETE RESTRICT and the
-- questions must survive. But content_sha256 is UNIQUE across every row, so
-- the archived row kept matching the file and the upload came back "This PDF
-- was already uploaded" with no way forward: the source was gone from the
-- list, yet still holding the only slot for that file.
--
-- The uniqueness that matters is among sources still in use. Archived rows
-- are retired and no longer hold the file's slot, so the index is now
-- partial. A live duplicate is still refused exactly as before.
DROP INDEX IF EXISTS public.question_sources_content_sha256_key;

CREATE UNIQUE INDEX question_sources_content_sha256_key
  ON public.question_sources (content_sha256)
  WHERE extraction_status <> 'archived';
