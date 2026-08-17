-- Read-only audit of question_sources.display_name on a live database.
--
-- Why this exists: 20260817000000_question_sources_display_name.sql was
-- applied to production in its original form, before aa798f8 hardened the
-- backfill. Supabase tracks migrations by version, not by content, so the
-- hardened backfill will never re-run where it already applied. This audit
-- reports whether the original backfill left any value the hardened version
-- would have rejected.
--
-- Safe to run against production: SELECT only, no writes, no row contents.

select
  count(*)                                                    as sources_total,
  count(*) filter (where display_name is null)                as null_names,
  count(*) filter (where btrim(coalesce(display_name, '')) = '')
                                                              as empty_names,
  count(*) filter (where display_name <> btrim(display_name)) as untrimmed_names,
  count(*) filter (where display_name ~* '\.pdf$')            as still_ends_in_pdf,
  count(*) filter (where char_length(display_name) > 160)     as too_long,
  count(*) filter (where char_length(display_name) < 1)       as too_short
from public.question_sources;

-- Any row the hardened guard would have raised on. Shows lengths and flags
-- only, never the stored name itself, so this can be pasted into a ticket.
select
  id,
  char_length(display_name)                    as name_length,
  display_name is null                         as is_null,
  display_name <> btrim(display_name)          as is_untrimmed,
  display_name ~* '\.pdf$'                     as keeps_pdf_extension,
  char_length(display_name) > 160              as is_too_long
from public.question_sources
where display_name is null
   or display_name <> btrim(display_name)
   or char_length(display_name) < 1
   or char_length(display_name) > 160
   or display_name ~* '\.pdf$'
order by id;
