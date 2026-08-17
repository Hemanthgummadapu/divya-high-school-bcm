export const MAX_DISPLAY_NAME_LENGTH: number;
export function suggestPaperNameFromFilename(filename: string): string;
export function validateDisplayName(
  value: unknown,
): { ok: false; error: string } | { ok: true; displayName: string };
