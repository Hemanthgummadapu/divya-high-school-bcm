export const SUBJECTS_BY_GRADE = Object.freeze({
  1: Object.freeze(["English", "Mathematics", "Science", "Social Studies"]),
  2: Object.freeze(["English", "Mathematics", "Science", "Social Studies"]),
  3: Object.freeze(["English", "Mathematics", "Science", "Social Studies"]),
  4: Object.freeze(["English", "Mathematics", "Science", "Social Studies"]),
  5: Object.freeze(["English", "Mathematics", "Science", "Social Studies"]),
  6: Object.freeze(["English", "Mathematics", "Science", "Social Studies"]),
  7: Object.freeze(["English", "Mathematics", "Science", "Social Studies"]),
  8: Object.freeze(["English", "Mathematics", "Physics", "Biology", "Social Studies"]),
  9: Object.freeze(["English", "Mathematics", "Physics", "Biology", "Social Studies"]),
  10: Object.freeze(["English", "Mathematics", "Physics", "Biology", "Social Studies"]),
});

export const ALL_GRADES = Object.freeze(
  Array.from({ length: 10 }, (_, i) => i + 1),
);

export const ALL_YEARS = Object.freeze(
  Array.from({ length: 7 }, (_, i) => 2020 + i),
);

export const EXCLUDED_RELEASE_SUBJECTS = Object.freeze(["Telugu", "Hindi"]);

export function getSubjectsForGrade(grade) {
  return SUBJECTS_BY_GRADE[grade] ? [...SUBJECTS_BY_GRADE[grade]] : [];
}

export function isValidSubjectForGrade(subject, grade) {
  return SUBJECTS_BY_GRADE[grade]?.includes(subject) ?? false;
}

export function isSupportedSubject(subject) {
  if (typeof subject !== "string" || subject.trim() === "") return false;
  if (EXCLUDED_RELEASE_SUBJECTS.includes(subject)) return false;
  return ALL_GRADES.some((grade) => isValidSubjectForGrade(subject, grade));
}

export function listSupportedGradeSubjectPairs() {
  const pairs = [];
  for (const grade of ALL_GRADES) {
    for (const subject of SUBJECTS_BY_GRADE[grade]) {
      pairs.push({ grade, subject });
    }
  }
  return pairs;
}
