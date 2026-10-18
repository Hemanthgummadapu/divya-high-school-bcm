export const SUBJECTS_BY_GRADE: Readonly<Record<number, readonly string[]>>;
export const ALL_GRADES: readonly number[];
export const ALL_YEARS: readonly number[];
export const EXCLUDED_RELEASE_SUBJECTS: readonly string[];

export const LANGUAGE_SUBJECTS: readonly string[];
export function isLanguageSubject(subject: unknown): boolean;
export function getSubjectsForGrade(grade: number): string[];
export function listSupportedSubjects(): string[];
export function isValidSubjectForGrade(subject: string, grade: number): boolean;
export function isSupportedSubject(subject: string): boolean;
export function listSupportedGradeSubjectPairs(): Array<{
  grade: number;
  subject: string;
}>;
