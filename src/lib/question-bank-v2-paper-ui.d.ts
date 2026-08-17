export function romanClass(grade: number): string;
export function formatDuration(minutes: number): string;
export function detectSelectionConflicts(
  questions: Array<{ grade: number; subject: string }>,
):
  | { ok: true; grade: number | null; subject: string | null }
  | { ok: false; grades: number[]; subjects: string[]; error: string };
export function previewMarks(questions: Array<{ marks: number }>): number;

export const QUESTION_TYPE_LABELS: Readonly<Record<string, string>>;
export const SECTION_GROUP_ORDER: readonly string[];
export const DEFAULT_SECTION_TITLES: Readonly<Record<string, string>>;

export function questionTypeLabel(type: string): string;
export function summarizeSelection(
  questions: Array<{ questionType?: string; marks?: number }>,
): {
  total: number;
  mcq: number;
  short: number;
  medium: number;
  long: number;
  marks: number;
};
export function groupQuestionsIntoSections(
  questions: Array<{ id: string; questionType: string }>,
): Array<{
  key: string;
  title: string;
  instructions: string;
  questionIds: string[];
}>;
