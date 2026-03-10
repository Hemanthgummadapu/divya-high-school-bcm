-- Drop old table
DROP TABLE IF EXISTS questions;

-- Create new single production table
CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  paper_id TEXT NOT NULL,
  grade INT NOT NULL CHECK (grade BETWEEN 1 AND 10),
  subject TEXT NOT NULL,
  year INT NOT NULL,
  number TEXT,
  text TEXT NOT NULL,
  marks INT DEFAULT 1,
  type TEXT CHECK (type IN ('MCQ', 'Short', 'Medium', 'Long')),
  section TEXT,
  options JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast filtering
CREATE INDEX idx_questions_grade ON questions(grade);
CREATE INDEX idx_questions_subject ON questions(subject);
CREATE INDEX idx_questions_grade_subject ON questions(grade, subject);
CREATE INDEX idx_questions_year ON questions(year);
CREATE INDEX idx_questions_type ON questions(type);
CREATE INDEX idx_questions_paper ON questions(paper_id);

-- Permissions
GRANT ALL ON questions TO anon, authenticated;

-- Also fix question_papers table
ALTER TABLE question_papers ADD COLUMN IF NOT EXISTS grade INT CHECK (grade BETWEEN 1 AND 10);
ALTER TABLE question_papers ADD COLUMN IF NOT EXISTS subject TEXT;
GRANT ALL ON question_papers TO anon, authenticated;
GRANT ALL ON generated_pdfs TO anon, authenticated;
