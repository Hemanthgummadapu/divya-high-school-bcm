-- Add diagram_url for storing public URL of uploaded diagram image (Supabase Storage).
-- Create a storage bucket named "diagrams" in Supabase Dashboard (Storage) and set it to public.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS diagram_url TEXT;
