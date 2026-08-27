// Cursor-aware math input helpers for the question editors.
//
// Scanned papers arrive with caret notation ("2^p", "x^2") and hand-typed
// bases ("log10"). These helpers convert a reviewer's selection into real
// Unicode superscripts/subscripts so any base or power can be edited —
// including letters (2ᵖ) and log bases (log₁₀) — without an equation engine.

export const SUPERSCRIPT_MAP = Object.freeze({
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾",
  a: "ᵃ", b: "ᵇ", c: "ᶜ", d: "ᵈ", e: "ᵉ", f: "ᶠ", g: "ᵍ", h: "ʰ",
  i: "ⁱ", j: "ʲ", k: "ᵏ", l: "ˡ", m: "ᵐ", n: "ⁿ", o: "ᵒ", p: "ᵖ",
  r: "ʳ", s: "ˢ", t: "ᵗ", u: "ᵘ", v: "ᵛ", w: "ʷ", x: "ˣ", y: "ʸ", z: "ᶻ",
});

export const SUBSCRIPT_MAP = Object.freeze({
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
  "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎",
  a: "ₐ", e: "ₑ", h: "ₕ", i: "ᵢ", j: "ⱼ", k: "ₖ", l: "ₗ", m: "ₘ",
  n: "ₙ", o: "ₒ", p: "ₚ", r: "ᵣ", s: "ₛ", t: "ₜ", u: "ᵤ", v: "ᵥ", x: "ₓ",
});

function mapFor(mode) {
  return mode === "sub" ? SUBSCRIPT_MAP : SUPERSCRIPT_MAP;
}

/** Convert every mappable character; unmappable characters stay unchanged. */
export function toScript(text, mode) {
  const map = mapFor(mode);
  return String(text ?? "")
    .split("")
    .map((ch) => map[ch] ?? map[ch.toLowerCase()] ?? ch)
    .join("");
}

/**
 * Convert the selection [selStart, selEnd) of value to superscript or
 * subscript. With a collapsed selection the single character before the
 * caret is converted, so a reviewer can simply click after "2^p" and tap
 * Superscript. A "^" (superscript) or "_" (subscript) marker immediately
 * before the converted range is removed, turning "2^p" into "2ᵖ" in one tap.
 * Returns null when there is nothing convertible.
 */
export function applyScriptTransform(value, selStart, selEnd, mode) {
  const text = String(value ?? "");
  let start = Math.max(0, Math.min(Number(selStart) || 0, text.length));
  let end = Math.max(start, Math.min(Number(selEnd) || 0, text.length));
  if (start === end) {
    if (start === 0) return null;
    start -= 1; // convert the character before the caret
  }
  const selected = text.slice(start, end);
  const converted = toScript(selected, mode);
  if (converted === selected) return null;
  const marker = mode === "sub" ? "_" : "^";
  const removeMarker = start > 0 && text[start - 1] === marker;
  const before = text.slice(0, removeMarker ? start - 1 : start);
  const after = text.slice(end);
  const nextValue = before + converted + after;
  const nextCaret = before.length + converted.length;
  return { value: nextValue, selStart: nextCaret, selEnd: nextCaret };
}

/** Insert text at the selection, replacing it. Returns the new value/caret. */
export function insertAtSelection(value, selStart, selEnd, insert) {
  const text = String(value ?? "");
  const start = Math.max(0, Math.min(Number(selStart) || 0, text.length));
  const end = Math.max(start, Math.min(Number(selEnd) || 0, text.length));
  const symbol = String(insert ?? "");
  const nextValue = text.slice(0, start) + symbol + text.slice(end);
  const caret = start + symbol.length;
  return { value: nextValue, selStart: caret, selEnd: caret };
}
