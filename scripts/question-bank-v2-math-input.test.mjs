import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyScriptTransform,
  insertAtSelection,
  toScript,
} from "../src/lib/question-bank-v2-math-input.mjs";

const root = join(fileURLToPath(new URL("..", import.meta.url)));

test("caret notation from scanned papers becomes a real power in one tap", () => {
  // Reviewer clicks after "2^p" (collapsed caret) and taps Make power.
  assert.deepEqual(applyScriptTransform("2^p", 3, 3, "sup"), {
    value: "2ᵖ",
    selStart: 2,
    selEnd: 2,
  });
  // Same for a selected digit: "x^2" with "2" selected.
  assert.deepEqual(applyScriptTransform("x^2", 2, 3, "sup"), {
    value: "x²",
    selStart: 2,
    selEnd: 2,
  });
  // The caret marker is only removed when it directly precedes the range.
  assert.equal(applyScriptTransform("2p", 2, 2, "sup").value, "2ᵖ");
});

test("log bases become real subscripts", () => {
  assert.equal(applyScriptTransform("log10", 3, 5, "sub").value, "log₁₀");
  assert.equal(applyScriptTransform("log_2 x", 4, 5, "sub").value, "log₂ x");
  assert.equal(applyScriptTransform("a1 + a2", 1, 2, "sub").value, "a₁ + a2");
});

test("multi-character selections convert every mappable character", () => {
  assert.equal(toScript("(n-1)", "sup"), "⁽ⁿ⁻¹⁾");
  assert.equal(toScript("10", "sub"), "₁₀");
  // Letters without a Unicode subscript stay unchanged instead of breaking.
  assert.equal(toScript("qb", "sub"), "qb");
  assert.equal(toScript("q", "sup"), "q"); // no superscript q in Unicode
});

test("nothing convertible returns null so the field is left untouched", () => {
  assert.equal(applyScriptTransform("", 0, 0, "sup"), null);
  assert.equal(applyScriptTransform("△", 1, 1, "sup"), null);
  assert.equal(applyScriptTransform("abc", 0, 0, "sup"), null);
});

test("insertAtSelection replaces the selection and reports the new caret", () => {
  assert.deepEqual(insertAtSelection("AB=CD", 2, 2, "∥"), {
    value: "AB∥=CD",
    selStart: 3,
    selEnd: 3,
  });
  assert.equal(insertAtSelection("choose", 0, 6, "√").value, "√");
  // Out-of-range selections are clamped, never thrown.
  assert.equal(insertAtSelection("ab", 99, 99, "²").value, "ab²");
});

test("the editors insert at the caret and the diagram upload opens the gallery", () => {
  const pageSource = readFileSync(
    join(root, "src/app/academics/question-papers/page.tsx"),
    "utf8",
  );
  assert.match(pageSource, /applyToFocusedField/);
  assert.match(pageSource, /insertAtSelection/);
  assert.match(pageSource, /applyScriptTransform/);
  // The old append-at-end insertion is gone.
  assert.doesNotMatch(
    pageSource,
    /questionText: `\$\{draft\.questionText\}\$\{symbol\}`/,
  );

  const keyboard = readFileSync(
    join(root, "src/components/MathKeyboard.tsx"),
    "utf8",
  );
  assert.match(keyboard, /onTransform\("sup"\)/);
  assert.match(keyboard, /onTransform\("sub"\)/);

  const sketch = readFileSync(
    join(root, "src/components/DiagramSketchTool.tsx"),
    "utf8",
  );
  // `capture` forces the phone camera and skips the gallery.
  assert.doesNotMatch(sketch, /capture=/);
  assert.match(sketch, /accept="image\/\*"/);
});
