export const SUBJECTS_BY_GRADE: Record<number, string[]> = {
  1: ["Telugu", "Hindi", "English", "Mathematics", "Science", "Social Studies"],
  2: ["Telugu", "Hindi", "English", "Mathematics", "Science", "Social Studies"],
  3: ["Telugu", "Hindi", "English", "Mathematics", "Science", "Social Studies"],
  4: ["Telugu", "Hindi", "English", "Mathematics", "Science", "Social Studies"],
  5: ["Telugu", "Hindi", "English", "Mathematics", "Science", "Social Studies"],
  6: ["Telugu", "Hindi", "English", "Mathematics", "Science", "Social Studies"],
  7: ["Telugu", "Hindi", "English", "Mathematics", "Science", "Social Studies"],
  8: ["Telugu", "Hindi", "English", "Mathematics", "Physics", "Biology", "Social Studies"],
  9: ["Telugu", "Hindi", "English", "Mathematics", "Physics", "Biology", "Social Studies"],
  10: ["Telugu", "Hindi", "English", "Mathematics", "Physics", "Biology", "Social Studies"],
};

export const ALL_GRADES = Array.from({ length: 10 }, (_, i) => i + 1);

export const ALL_YEARS = Array.from({ length: 7 }, (_, i) => 2020 + i);

export function getSubjectsForGrade(grade: number): string[] {
  return SUBJECTS_BY_GRADE[grade] ?? [];
}

export function isValidSubjectForGrade(subject: string, grade: number): boolean {
  return SUBJECTS_BY_GRADE[grade]?.includes(subject) ?? false;
}
