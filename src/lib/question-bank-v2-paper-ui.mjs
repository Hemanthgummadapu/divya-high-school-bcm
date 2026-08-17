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
