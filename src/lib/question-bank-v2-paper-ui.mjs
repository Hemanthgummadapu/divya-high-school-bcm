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
