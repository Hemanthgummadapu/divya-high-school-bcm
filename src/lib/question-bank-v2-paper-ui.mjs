export const MAX_PAPER_TITLE_LENGTH = 300;

/**
 * Suggest a generated-paper name from the composition. The source-paper name
 * is never used here: it identifies where questions came from, not the paper
 * being prepared. The suggestion is a starting point the user can edit.
 */
export function suggestGeneratedPaperName(input = {}) {
  const grade = Number(input.grade);
  const subject = String(input.subject ?? "").trim();
  const year = Number(input.academicYear);
  const parts = [];
  if (Number.isSafeInteger(grade) && grade >= 1 && grade <= 10) {
    parts.push(`Class ${grade}`);
  }
  if (subject) parts.push(subject);
  const examLabel = String(input.examLabel ?? "").trim();
  if (examLabel) parts.push(examLabel);
  if (Number.isSafeInteger(year) && year >= 2000 && year <= 2100) {
    parts.push(String(year));
  }
  const base = parts.join(" ").trim();
  if (!base) return "";
  const setLabel = String(input.setLabel ?? "").trim();
  const suggestion = setLabel ? `${base} – ${setLabel}` : base;
  return suggestion.slice(0, MAX_PAPER_TITLE_LENGTH);
}

/**
 * Names may legitimately repeat (Set A / Set B), so a clash is a warning the
 * user can ignore, never a block and never a database constraint.
 */
export function findDuplicatePaperNameWarning(title, papers) {
  const normalized = String(title ?? "").trim().toLowerCase();
  if (!normalized || !Array.isArray(papers)) return null;
  const clash = papers.some(
    (paper) => String(paper?.title ?? "").trim().toLowerCase() === normalized,
  );
  if (!clash) return null;
  return "A paper with this name already exists. Consider adding Set A, Set B or a date.";
}

/**
 * Suggest a source-paper name from what the user has already chosen. A
 * filename like "Screenshot 2026-02-22 at 10.38.pdf" is useless in the Source
 * Paper filter, so class/subject/year is preferred and the filename is only a
 * last resort. The result stays required and editable.
 */
export function suggestSourcePaperName({ grade, subject, academicYear } = {}) {
  const gradeNumber = Number(grade);
  const parts = [];
  if (Number.isSafeInteger(gradeNumber) && gradeNumber >= 1 && gradeNumber <= 10) {
    parts.push(`Class ${gradeNumber}`);
  }
  const subjectName = String(subject ?? "").trim();
  if (subjectName) parts.push(subjectName);
  const year = Number(academicYear);
  if (Number.isSafeInteger(year) && year >= 2000 && year <= 2100) {
    parts.push(String(year));
  }
  return parts.join(" ").trim();
}

export function romanClass(grade) {
  const roman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  return roman[grade] || String(grade);
}

export function formatDuration(minutes) {
  if (!Number.isSafeInteger(minutes) || minutes < 1) return "";
  if (minutes % 60 === 0) return `${minutes / 60}.00 Hrs`;
  return `${minutes} min`;
}

export function detectSelectionConflicts(questions) {
  const grades = [...new Set(questions.map((question) => question.grade))];
  const subjects = [...new Set(questions.map((question) => question.subject))];
  if (grades.length <= 1 && subjects.length <= 1) {
    return { ok: true, grade: grades[0] ?? null, subject: subjects[0] ?? null };
  }
  return {
    ok: false,
    grades,
    subjects,
    error:
      grades.length > 1
        ? `These questions are from different classes: ${grades.join(", ")}`
        : `These questions are from different subjects: ${subjects.join(", ")}`,
  };
}

export function previewMarks(questions) {
  return questions.reduce((sum, question) => sum + (Number(question.marks) || 0), 0);
}

export const QUESTION_TYPE_LABELS = Object.freeze({
  MCQ: "MCQ",
  Short: "Short Answer",
  Medium: "Medium Answer",
  Long: "Long Answer",
});

export const SECTION_GROUP_ORDER = Object.freeze(["MCQ", "Short", "Medium", "Long"]);

export const DEFAULT_SECTION_TITLES = Object.freeze({
  MCQ: "Section A — MCQ",
  Short: "Section B — Short Answer",
  Medium: "Section C — Medium Answer",
  Long: "Section D — Long Answer",
});

export function questionTypeLabel(type) {
  return QUESTION_TYPE_LABELS[type] || type;
}

export function summarizeSelection(questions) {
  const counts = { MCQ: 0, Short: 0, Medium: 0, Long: 0 };
  let marks = 0;
  for (const question of questions) {
    if (Object.prototype.hasOwnProperty.call(counts, question.questionType)) {
      counts[question.questionType] += 1;
    }
    marks += Number(question.marks) || 0;
  }
  return {
    total: questions.length,
    mcq: counts.MCQ,
    short: counts.Short,
    medium: counts.Medium,
    long: counts.Long,
    marks,
  };
}

export function groupQuestionsIntoSections(questions) {
  return SECTION_GROUP_ORDER.flatMap((type) => {
    const questionIds = questions
      .filter((question) => question.questionType === type)
      .map((question) => question.id);
    if (questionIds.length === 0) return [];
    return [
      {
        key: type,
        title: DEFAULT_SECTION_TITLES[type],
        instructions: "",
        questionIds,
      },
    ];
  });
}
