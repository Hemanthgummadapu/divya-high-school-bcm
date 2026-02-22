/**
 * Question Papers Database Utilities
 */

export interface Question {
  id: string;
  number: string;
  text: string;
  options: string[];
  section: string;
  type: "MCQ" | "Short" | "Long";
  marks: number;
}

export interface QuestionPaper {
  id: string;
  filename: string;
  subject: string;
  grade: string;
  year: string;
  uploadedAt: string;
  totalPages: number;
  questions: Question[];
}

export interface QuestionPapersDB {
  papers: QuestionPaper[];
}

export interface FilterOptions {
  subject?: string;
  grade?: string;
  year?: string;
  type?: "MCQ" | "Short" | "Long";
  section?: string;
}

/**
 * Read the question papers database
 */
export async function readDatabase(): Promise<QuestionPapersDB> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const dbPath = path.join(process.cwd(), "data", "question-papers.json");
    
    const data = await fs.readFile(dbPath, "utf-8");
    return JSON.parse(data) as QuestionPapersDB;
  } catch (error) {
    // Return empty database if file doesn't exist
    return { papers: [] };
  }
}

/**
 * Write to the question papers database
 */
export async function writeDatabase(db: QuestionPapersDB): Promise<void> {
  const fs = await import("fs/promises");
  const path = await import("path");
  const dbPath = path.join(process.cwd(), "data", "question-papers.json");
  
  // Ensure directory exists
  const dir = path.dirname(dbPath);
  await fs.mkdir(dir, { recursive: true });
  
  await fs.writeFile(dbPath, JSON.stringify(db, null, 2), "utf-8");
}

/**
 * Filter questions based on criteria
 */
export function filterQuestions(
  questions: Question[],
  filters: FilterOptions
): Question[] {
  return questions.filter((q) => {
    if (filters.type && q.type !== filters.type) return false;
    if (filters.section && q.section !== filters.section) return false;
    return true;
  });
}

/**
 * Filter papers based on criteria
 */
export function filterPapers(
  papers: QuestionPaper[],
  filters: FilterOptions
): QuestionPaper[] {
  return papers.filter((paper) => {
    if (filters.subject && paper.subject !== filters.subject) return false;
    if (filters.grade && paper.grade !== filters.grade) return false;
    if (filters.year && paper.year !== filters.year) return false;
    return true;
  });
}

/**
 * Get all unique subjects from papers
 */
export function getUniqueSubjects(papers: QuestionPaper[]): string[] {
  const subjects = new Set(papers.map((p) => p.subject));
  return Array.from(subjects).sort();
}

/**
 * Get all unique grades from papers
 */
export function getUniqueGrades(papers: QuestionPaper[]): string[] {
  const grades = new Set(papers.map((p) => p.grade));
  return Array.from(grades).sort();
}

/**
 * Get all unique years from papers
 */
export function getUniqueYears(papers: QuestionPaper[]): string[] {
  const years = new Set(papers.map((p) => p.year));
  return Array.from(years).sort().reverse();
}

/**
 * Get statistics from papers
 */
export function getStatistics(papers: QuestionPaper[]) {
  const totalQuestions = papers.reduce((sum, p) => sum + p.questions.length, 0);
  
  const bySubject = papers.reduce((acc, paper) => {
    acc[paper.subject] = (acc[paper.subject] || 0) + paper.questions.length;
    return acc;
  }, {} as Record<string, number>);
  
  const byType = papers.reduce((acc, paper) => {
    paper.questions.forEach((q) => {
      acc[q.type] = (acc[q.type] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);
  
  return {
    totalPapers: papers.length,
    totalQuestions,
    bySubject,
    byType,
  };
}

