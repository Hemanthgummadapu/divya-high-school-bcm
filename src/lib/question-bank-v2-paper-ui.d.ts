export function romanClass(grade: number): string;
export function formatDuration(minutes: number): string;
export function detectSelectionConflicts(
  questions: Array<{ grade: number; subject: string }>,
):
  | { ok: true; grade: number | null; subject: string | null }
  | { ok: false; grades: number[]; subjects: string[]; error: string };
export function previewMarks(questions: Array<{ marks: number }>): number;
