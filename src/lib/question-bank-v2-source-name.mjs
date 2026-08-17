export const MAX_DISPLAY_NAME_LENGTH = 160;

export function suggestPaperNameFromFilename(filename) {
  const base = String(filename ?? "")
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    .replace(/\.pdf$/i, "")
    .replace(/[\u0000-\u001F]/g, "")
    .trim();
  if (!base) return "";
  return base.slice(0, MAX_DISPLAY_NAME_LENGTH);
}

/**
 * @param {unknown} value
 * @returns {{ ok: false, error: string } | { ok: true, displayName: string }}
 */
export function validateDisplayName(value) {
  const displayName = String(value ?? "").trim();
  if (displayName.length < 1 || displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return {
      ok: false,
      error: "Paper name must be between 1 and 160 characters",
    };
  }
  return { ok: true, displayName };
}
