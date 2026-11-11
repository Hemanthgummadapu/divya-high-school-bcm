-- A failed upload must not lock the file out of ever being uploaded again.
--
-- An upload whose extraction fails still writes its source row, and that row
-- carries the file's checksum. The checksum is unique among sources in use,
-- so the file was claimed by an attempt that saved nothing: re-uploading it
-- came back "This PDF was already uploaded", pointing at a source with no
-- questions in it. That is exactly the case you most need to retry, and it
-- happened for real when the extraction key expired — two papers failed with
-- zero questions and then could not be uploaded again.
--
-- Retrying extraction on the existing source still works and is the quicker
-- path. This only stops the failed row from standing in the way of a fresh
-- upload. A source that saved even one question still holds the file, so a
-- genuine duplicate of real work is refused exactly as before.
DROP INDEX IF EXISTS public.question_sources_content_sha256_key;

CREATE UNIQUE INDEX question_sources_content_sha256_key
  ON public.question_sources (content_sha256)
  WHERE extraction_status <> 'archived'
    AND NOT (extraction_status = 'failed' AND extracted_question_count = 0);
