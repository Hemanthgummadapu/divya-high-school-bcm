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

// Longest LaTeX commands first so "\cosec" is not eaten as "\cos" + "ec".
const LATEX_COMMANDS = Object.freeze([
  ["\\Leftrightarrow", "⇔"],
  ["\\rightarrow", "→"],
  ["\\leftarrow", "←"],
  ["\\therefore", "∴"],
  ["\\because", "∵"],
  ["\\infty", "∞"],
  ["\\times", "×"],
  ["\\cdot", "·"],
  ["\\div", "÷"],
  ["\\pm", "±"],
  ["\\neq", "≠"],
  ["\\approx", "≈"],
  ["\\equiv", "≡"],
  ["\\propto", "∝"],
  ["\\leq", "≤"],
  ["\\geq", "≥"],
  ["\\ll", "≪"],
  ["\\gg", "≫"],
  ["\\subset", "⊂"],
  ["\\supset", "⊃"],
  ["\\subseteq", "⊆"],
  ["\\supseteq", "⊇"],
  ["\\notin", "∉"],
  ["\\in", "∈"],
  ["\\cup", "∪"],
  ["\\cap", "∩"],
  ["\\emptyset", "∅"],
  ["\\varnothing", "∅"],
  ["\\triangle", "△"],
  ["\\angle", "∠"],
  ["\\perp", "⊥"],
  ["\\parallel", "∥"],
  ["\\circ", "○"],
  ["\\odot", "⊙"],
  ["\\degree", "°"],
  ["\\theta", "θ"],
  ["\\Theta", "Θ"],
  ["\\phi", "φ"],
  ["\\Phi", "Φ"],
  ["\\alpha", "α"],
  ["\\beta", "β"],
  ["\\gamma", "γ"],
  ["\\delta", "δ"],
  ["\\lambda", "λ"],
  ["\\mu", "μ"],
  ["\\pi", "π"],
  ["\\sigma", "σ"],
  ["\\Sigma", "Σ"],
  ["\\omega", "ω"],
  ["\\Omega", "Ω"],
  ["\\cosec", "cosec"],
  ["\\arcsin", "sin⁻¹"],
  ["\\arccos", "cos⁻¹"],
  ["\\arctan", "tan⁻¹"],
  ["\\sin", "sin"],
  ["\\cos", "cos"],
  ["\\tan", "tan"],
  ["\\cot", "cot"],
  ["\\sec", "sec"],
  ["\\csc", "csc"],
  ["\\log", "log"],
  ["\\ln", "ln"],
  ["\\lim", "lim"],
]);

// A single run of letters, digits, scripts, accents or dots ("n", "f₁",
// "c.f.", "x̅") already binds tighter than the slash, so wrapping it would
// only add noise: "n/2" reads, "(n)/(2)" does not. Anything carrying an
// operator or a space keeps its parentheses, which is what holds
// "(f₁ - f₀)/(2f₁ - f₀ - f₂)" together.
const FRACTION_ATOM = /^[\p{L}\p{N}.̀-ͯ⃐-⃿⁰-ₜ]+$/u;

function wrapFractionOperand(operand) {
  const trimmed = operand.trim();
  return FRACTION_ATOM.test(trimmed) ? trimmed : `(${trimmed})`;
}

function replaceLatexFractions(text) {
  let out = text;
  // Innermost first, so "\frac{\frac{n}{2} - c.f.}{f}" resolves outwards.
  for (let i = 0; i < 8; i += 1) {
    const next = out.replace(
      /\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g,
      (_match, numerator, denominator) =>
        `${wrapFractionOperand(numerator)}/${wrapFractionOperand(denominator)}`,
    );
    if (next === out) break;
    out = next;
  }
  return out;
}

// Accents that sit over the whole token: segment/ray bars, vectors, hats.
// Longest command first so "\overline" is not matched as part of another name.
// NotoSans (the question-paper PDF font) carries U+0305/U+0332/U+0302 and
// NotoSansMath carries U+20D7, so every mark below survives into the PDF.
// "tile" repeats the mark on every character: adjacent bars join into one
// continuous line over "AP". An arrow or a hat must not repeat — two arrows
// is a different statement from one arrow over the pair — so it rides the
// last character, which is the usual plain-text convention.
const LATEX_ACCENTS = Object.freeze([
  ["overrightarrow", "⃗", "last"],
  ["overline", "̅", "tile"],
  ["underline", "̲", "tile"],
  ["widehat", "̂", "last"],
  ["vec", "⃗", "last"],
  ["bar", "̅", "tile"],
  ["hat", "̂", "last"],
]);

function applyCombiningMark(text, mark, spread) {
  const chars = Array.from(String(text));
  if (spread === "tile") {
    return chars.map((ch) => (ch.trim() === "" ? ch : ch + mark)).join("");
  }
  let lastVisible = -1;
  for (let i = 0; i < chars.length; i += 1) {
    if (chars[i].trim() !== "") lastVisible = i;
  }
  if (lastVisible === -1) return chars.join("");
  return chars.map((ch, i) => (i === lastVisible ? ch + mark : ch)).join("");
}

function replaceLatexAccents(text) {
  let out = text;
  for (let i = 0; i < 8; i += 1) {
    let changed = false;
    for (const [name, mark, spread] of LATEX_ACCENTS) {
      const next = out.replace(
        new RegExp(`\\\\${name}\\s*\\{([^{}]*)\\}`, "g"),
        (_match, inner) => applyCombiningMark(inner, mark, spread),
      );
      if (next !== out) {
        out = next;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return out;
}

/**
 * Convert every character or return null. A partly converted script (say
 * "f₁₀" losing a character that has no Unicode form) would silently corrupt
 * the formula, so a group that cannot be fully mapped is left as written.
 */
function toScriptStrict(content, mode) {
  const map = mapFor(mode);
  const chars = Array.from(String(content));
  if (chars.length === 0) return null;
  const converted = [];
  for (const ch of chars) {
    const mapped = map[ch] ?? map[ch.toLowerCase()];
    if (mapped === undefined) return null;
    converted.push(mapped);
  }
  return converted.join("");
}

function replaceLatexScripts(text) {
  let out = text;
  // "^\circ" is the degree sign. It has to win before \circ becomes "○".
  out = out.replace(/\^\s*\{\s*\\circ\s*\}/g, "°");
  out = out.replace(/\^\s*\\circ(?![A-Za-z])/g, "°");
  out = out.replace(/([_^])\{([^{}]*)\}/g, (match, marker, inner) => {
    return toScriptStrict(inner, marker === "_" ? "sub" : "sup") ?? match;
  });
  out = out.replace(/([_^])([A-Za-z0-9])/g, (match, marker, ch) => {
    return toScriptStrict(ch, marker === "_" ? "sub" : "sup") ?? match;
  });
  return out;
}

/**
 * "\left( \frac{a}{b} \right)" decodes to "( (a)/(b) )". The outer pair adds
 * nothing once the fraction is bracketed, and the doubled parentheses are the
 * hardest part of a scanned formula to read.
 */
function collapseRedundantFractionParens(text) {
  let out = text;
  for (let i = 0; i < 8; i += 1) {
    const next = out.replace(
      /\(\s*(\([^()]*\)\s*\/\s*\([^()]*\))\s*\)/g,
      "$1",
    );
    if (next === out) break;
    out = next;
  }
  return out;
}

/**
 * Turn common extracted LaTeX tokens into the Unicode symbols the rest of
 * the bank already uses (θ, not "\\theta"). Leaves ordinary text alone.
 */
export function decodeLatexMath(text) {
  let out = String(text ?? "");
  if (!out.includes("\\") && !out.includes("$")) return out;
  out = out.replace(/\$\$([\s\S]+?)\$\$/g, "$1");
  out = out.replace(/\$([^$]+)\$/g, "$1");
  // Accents and scripts resolve first so a fraction sees plain operands:
  // "\frac{\bar{x}}{n}" has braces the fraction pattern cannot span, and
  // "\frac{f_1}{f_2}" would otherwise be measured as "f_1" rather than "f₁"
  // and pick up parentheses it does not need.
  out = replaceLatexAccents(out);
  out = replaceLatexScripts(out);
  out = replaceLatexFractions(out);
  out = out.replace(/\\left\s*/g, "");
  out = out.replace(/\\right\s*/g, "");
  out = collapseRedundantFractionParens(out);
  out = out.replace(/\\,/g, " ");
  out = out.replace(/\\ /g, " ");
  for (const [command, symbol] of LATEX_COMMANDS) {
    const escaped = command.replace(/\\/g, "\\\\");
    out = out.replace(new RegExp(`${escaped}(?![A-Za-z])`, "g"), symbol);
  }
  return out;
}

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
