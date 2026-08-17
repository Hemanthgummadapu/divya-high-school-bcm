import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import zlib from "node:zlib";
import {
  buildPersistencePlan,
  isSafeDiagramCropRef,
  normalizeExtractedQuestion,
  normalizeSucceededPage,
  validateDocumentResult,
} from "../src/lib/question-bank-v2-extract.mjs";
import { inlineDiagramCrops } from "../src/lib/question-bank-v2-diagram-crop.mjs";

function crc32Buffer(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function pngChunk(tag, data) {
  const body = Buffer.concat([Buffer.from(tag, "ascii"), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32Buffer(body));
  return Buffer.concat([length, body, crc]);
}

function makePng(width = 8, height = 8) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0xcc)]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const CROP_REF = `crops/${randomUUID()}.png`;

test("crop refs accept only the canonical work-dir-relative shape", () => {
  assert.equal(isSafeDiagramCropRef(CROP_REF), true);
  for (const bad of [
    null,
    undefined,
    42,
    "",
    "crops/x.png",
    "crops/../secret.png",
    `/etc/${CROP_REF}`,
    `crops/${randomUUID()}.PNG`,
    `crops/nested/${randomUUID()}.png`,
    `${randomUUID()}.png`,
    `source-pdfs/${randomUUID()}.png`,
  ]) {
    assert.equal(isSafeDiagramCropRef(bad), false, String(bad));
  }
});

test("inlineDiagramCrops loads valid request-owned crops and drops the rest", async () => {
  const workDir = await mkdtemp(join(tmpdir(), "qb-crop-test-"));
  try {
    await mkdir(join(workDir, "crops"), { recursive: true });
    const goodRef = `crops/${randomUUID()}.png`;
    const corruptRef = `crops/${randomUUID()}.png`;
    const oversizedRef = `crops/${randomUUID()}.png`;
    const png = makePng();
    await writeFile(join(workDir, goodRef), png);
    await writeFile(join(workDir, corruptRef), Buffer.from("not-a-png"));
    await writeFile(join(workDir, oversizedRef), png);

    const pages = [
      {
        pageNumber: 1,
        status: "succeeded",
        questions: [
          { text: "good", diagramCropRef: goodRef },
          { text: "corrupt", diagramCropRef: corruptRef },
          { text: "missing", diagramCropRef: `crops/${randomUUID()}.png` },
          { text: "traversal", diagramCropRef: "crops/../original.pdf" },
          { text: "none" },
        ],
      },
      { pageNumber: 2, status: "failed", questions: [] },
    ];

    await inlineDiagramCrops(pages, workDir, 1024 * 1024);
    const [good, corrupt, missing, traversal, none] = pages[0].questions;
    assert.equal(good.diagramPngBase64, png.toString("base64"));
    assert.equal(corrupt.diagramPngBase64, undefined);
    assert.equal(missing.diagramPngBase64, undefined);
    assert.equal(traversal.diagramPngBase64, undefined);
    assert.equal(none.diagramPngBase64, undefined);
    for (const question of pages[0].questions) {
      assert.equal("diagramCropRef" in question, false);
    }

    const oversizedPages = [
      {
        pageNumber: 1,
        status: "succeeded",
        questions: [{ text: "big", diagramCropRef: oversizedRef }],
      },
    ];
    await inlineDiagramCrops(oversizedPages, workDir, png.byteLength - 1);
    assert.equal(oversizedPages[0].questions[0].diagramPngBase64, undefined);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
});

test("normalization keeps inlined PNGs and falls back to a visible description", () => {
  const png = makePng().toString("base64");
  const withPng = normalizeExtractedQuestion(
    {
      questionText: "In △ABC, ∠B = 90°. Find AC using a² + b² = c².",
      questionType: "Medium",
      marks: 4,
      diagram: "right triangle ABC",
      diagramPngBase64: png,
    },
    3,
    1,
  );
  assert.equal(withPng.ok, true);
  assert.equal(withPng.question.diagramPngBase64, png);
  assert.equal(withPng.question.question_text.includes("[Diagram:"), false);
  assert.equal(withPng.question.source_page_number, 3);

  const withoutPng = normalizeExtractedQuestion(
    {
      questionText: "Interpret the printed graph.",
      questionType: "Short",
      marks: 2,
      diagram: "bar graph of rainfall",
    },
    3,
    2,
  );
  assert.equal(withoutPng.ok, true);
  assert.match(withoutPng.question.question_text, /\[Diagram: bar graph of rainfall\]/);
  assert.equal(withoutPng.question.diagramPngBase64, null);
});

test("mathematical symbols survive validation and the persistence plan", () => {
  const text =
    "If l ∥ m and PQ ⊥ RS with θ ≤ 45°, evaluate √49 × ½ ÷ π ± 3, where h₁ = 12 and 7 ≠ 2³.";
  const document = validateDocumentResult(
    {
      schemaVersion: 1,
      pageCount: 1,
      pages: [
        {
          pageNumber: 1,
          status: "succeeded",
          questions: [
            {
              questionText: text,
              rawExtractedText: text,
              questionType: "Long",
              marks: 8,
              sectionLabel: "SECTION-III",
            },
          ],
        },
      ],
    },
    1,
  );
  assert.equal(document.ok, true);
  const plan = buildPersistencePlan(document.pages);
  assert.equal(plan.ok, true);
  assert.equal(plan.status, "completed");
  assert.equal(plan.questions[0].question_text, text);
  assert.equal(plan.questions[0].raw_extracted_text, text);
  for (const symbol of ["∥", "⊥", "θ", "≤", "°", "√", "×", "½", "÷", "π", "±", "₁", "≠", "³"]) {
    assert.ok(plan.questions[0].question_text.includes(symbol), symbol);
  }
});

test("a succeeded page with zero questions stays a deliberate validation failure", () => {
  const normalized = normalizeSucceededPage({
    pageNumber: 1,
    status: "succeeded",
    questions: [],
  });
  assert.equal(normalized.status, "failed");
  assert.equal(normalized.errorCategory, "validation");
});
