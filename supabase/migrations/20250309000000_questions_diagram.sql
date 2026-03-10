-- Add diagram column for text description of figures/diagrams next to questions
ALTER TABLE questions ADD COLUMN IF NOT EXISTS diagram TEXT;
