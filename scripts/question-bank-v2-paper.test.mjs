import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPaperSnapshots,
  detectSelectionConflicts,
  findClientSnapshotKeys,
  generatedPaperObjectKey,
  generatedPaperStoragePath,
  canSignGeneratedPaper,
  isCanonicalGeneratedPaperPath,
  isValidCreationKey,
  isValidGeneratedPdf,
  parseGenerateRequest,
  pdfStatusLabel,
  publicSavedPaper,
  verifyBankQuestions,
} from "../src/lib/question-bank-v2-paper.mjs";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const generateRoute = readFileSync(
  join(root, "src/app/api/question-papers/generate/route.ts"),
  "utf8",
);
const retiredGenerate = readFileSync(
  join(root, "src/app/api/questions/generate/route.ts"),
  "utf8",
);
const retiredPdf = readFileSync(
  join(root, "src/app/api/question-papers/generate-pdf/route.ts"),
  "utf8",
);
const paperApi = readFileSync(
  join(root, "src/lib/question-bank-v2-paper-api.ts"),
  "utf8",
);
const pageSource = readFileSync(
  join(root, "src/app/academics/question-papers/page.tsx"),
  "utf8",
);
const jk82 = readFileSync(join(root, "scripts/generate_jk82_pdf.py"), "utf8");

const Q1 = "11111111-1111-1111-1111-111111111111";
const Q2 = "22222222-2222-2222-2222-222222222222";
const PAPER = "33333333-3333-3333-3333-333333333333";
const EXPORT = "44444444-4444-4444-4444-444444444444";

function approvedRow(id, extra = {}) {
  return {
    id,
    grade: 10,
    subject: "Mathematics",
    academic_year: 2024,
    question_type: "Short",
    question_text: extra.text || "Find the area",
    options: [],
    marks: extra.marks || 2,
    diagram_path: extra.diagram_path || null,
    review_status: extra.review_status || "approved",
    ...extra,
  };
}

test("generate request rejects empty, invalid, duplicate, and leaked snapshot fields", () => {
  assert.equal(parseGenerateRequest({}).ok, false);
  assert.equal(
    parseGenerateRequest({
      creationKey: "create-01",
      title: "Paper",
      academicYear: 2026,
      durationMinutes: 180,
      items: [],
    }).ok,
    false,
  );
  assert.equal(
    parseGenerateRequest({
      creationKey: "create-01",
      title: "Paper",
      academicYear: 2026,
      durationMinutes: 180,
      items: [{ questionId: "not-a-uuid", sectionOrder: 1, questionOrder: 1 }],
    }).ok,
    false,
  );
  assert.equal(
    parseGenerateRequest({
      creationKey: "create-01",
      title: "Paper",
      academicYear: 2026,
      durationMinutes: 180,
      items: [
        { questionId: Q1, sectionOrder: 1, questionOrder: 1 },
        { questionId: Q1, sectionOrder: 1, questionOrder: 2 },
      ],
    }).error,
    "Duplicate question",
  );
  assert.equal(
    parseGenerateRequest({
      creationKey: "create-01",
      title: "Paper",
      academicYear: 2026,
      durationMinutes: 180,
      items: [{ questionId: Q1, sectionOrder: 1, questionOrder: 1, snapshot_text: "evil" }],
    }).ok,
    false,
  );
  assert.deepEqual(findClientSnapshotKeys({ items: [{ snapshotMarks: 99 }] }), [
    "snapshotMarks",
  ]);
  const tooMany = Array.from({ length: 201 }, (_, index) => ({
    questionId: `00000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
    sectionOrder: 1,
    questionOrder: index + 1,
  }));
  assert.equal(
    parseGenerateRequest({
      creationKey: "create-01",
      title: "Paper",
      academicYear: 2026,
      durationMinutes: 180,
      items: tooMany,
    }).error,
    "Too many questions",
  );
});

test("bank verification requires approved same-class same-subject rows", () => {
  assert.equal(verifyBankQuestions([Q1], []).error.includes("not found"), true);
  assert.equal(
    verifyBankQuestions([Q1], [approvedRow(Q1, { review_status: "needs_review" })]).ok,
    false,
  );
  assert.equal(
    verifyBankQuestions([Q1], [approvedRow(Q1, { review_status: "archived" })]).error.includes(
      "archived",
    ),
    true,
  );
  assert.equal(
    verifyBankQuestions(
      [Q1, Q2],
      [approvedRow(Q1), approvedRow(Q2, { grade: 9 })],
    ).error.includes("same class"),
    true,
  );
  assert.equal(
    verifyBankQuestions(
      [Q1, Q2],
      [approvedRow(Q1), approvedRow(Q2, { subject: "Physics" })],
    ).error.includes("same subject"),
    true,
  );
  const reusedYear = verifyBankQuestions(
    [Q1, Q2],
    [approvedRow(Q1, { academic_year: 2020 }), approvedRow(Q2, { academic_year: 2026 })],
  );
  assert.equal(reusedYear.ok, true);
  assert.equal(reusedYear.grade, 10);
});

test("snapshots come from bank rows and ignore later text changes", () => {
  const parsed = parseGenerateRequest({
    creationKey: "create-01",
    title: "Paper",
    academicYear: 2026,
    durationMinutes: 180,
    items: [
      { questionId: Q1, sectionTitle: "SECTION-I", sectionOrder: 1, questionOrder: 2 },
      { questionId: Q2, sectionTitle: "SECTION-I", sectionOrder: 1, questionOrder: 1 },
    ],
  });
  const built = buildPaperSnapshots(parsed.items, [
    approvedRow(Q1, { text: "Second", marks: 4 }),
    approvedRow(Q2, { text: "First", marks: 2 }),
  ]);
  assert.equal(built.ok, true);
  assert.equal(built.snapshots[0].snapshot_text, "First");
  assert.equal(built.snapshots[0].number_label, "1");
  assert.equal(built.snapshots[1].snapshot_text, "Second");
  assert.equal(built.snapshots[1].number_label, "2");
  assert.equal(built.totalMarks, 6);
  const later = buildPaperSnapshots(parsed.items, [
    approvedRow(Q1, { text: "Edited later", marks: 4 }),
    approvedRow(Q2, { text: "First", marks: 2 }),
  ]);
  assert.notEqual(later.snapshots[1].snapshot_text, built.snapshots[1].snapshot_text);
});

test("PDF path signing and status labels stay honest", () => {
  const path = generatedPaperStoragePath(PAPER, EXPORT);
  assert.equal(isCanonicalGeneratedPaperPath(PAPER, path), true);
  assert.equal(isCanonicalGeneratedPaperPath(Q1, path), false);
  assert.equal(isValidCreationKey("create-01"), true);
  assert.equal(isValidCreationKey("short"), false);
  assert.equal(
    pdfStatusLabel({ status: "final", pdf_storage_path: path, pdf_sha256: "a".repeat(64) }),
    "Ready",
  );
  assert.equal(pdfStatusLabel({ status: "final" }), "PDF pending");
  assert.equal(pdfStatusLabel({ status: "archived" }), "Archived");
  const paper = publicSavedPaper({
    id: PAPER,
    title: "Pre-final",
    grade: 10,
    subject: "Mathematics",
    academic_year: 2026,
    duration_minutes: 180,
    total_marks: 80,
    status: "final",
    pdf_storage_path: path,
    pdf_sha256: "a".repeat(64),
    pdf_byte_size: 1000,
    finalized_at: "2026-01-01T00:00:00Z",
  });
  assert.equal(paper.pdfAvailable, true);
  assert.equal("pdf_storage_path" in paper, false);
  assert.equal(isValidGeneratedPdf(Buffer.from("%PDF-"), 1), false);
  assert.equal(isValidGeneratedPdf(Buffer.from("%PDF-1.4\n..."), 2), true);
});

test("canonical generate route is the only writer and retired routes return 410", () => {
  assert.match(generateRoute, /saveFinalPaper/);
  assert.match(generateRoute, /generateAndStorePaperPdf/);
  assert.match(generateRoute, /loadSavedPaperItems/);
  assert.match(generateRoute, /action === "retry"/);
  assert.doesNotMatch(generateRoute, /generated_pdfs/);
  assert.doesNotMatch(generateRoute, /\.from\(\s*["']questions["']\)/);
  assert.match(retiredGenerate, /status: 410/);
  assert.match(retiredPdf, /status: 410/);
  assert.doesNotMatch(retiredGenerate, /spawn\(/);
  assert.doesNotMatch(retiredPdf, /spawn\(/);
  assert.match(paperApi, /save_question_paper/);
  assert.match(paperApi, /record_final_paper_pdf/);
  assert.match(paperApi, /upsert:\s*false/);
  assert.match(paperApi, /remove\(createdObjects\.map/);
  assert.match(paperApi, /loadSavedPaperItems/);
  assert.doesNotMatch(paperApi, /question_bank_questions[\s\S]*retry/);
  assert.match(paperApi, /diagramStatus/);
  assert.match(paperApi, /\.in\(\s*["']status["'],\s*\[["']final["'],\s*["']archived["']\]/);
  assert.match(paperApi, /generatedPaperObjectKey/);
  assert.match(paperApi, /storedPath\.slice\(`\$\{GENERATED_PAPERS_BUCKET\}\/`/);
});

test("UI builder and saved papers do not call legacy generate routes", () => {
  assert.match(pageSource, /view === "saved"/);
  assert.match(pageSource, /Generate paper/);
  assert.match(pageSource, /disabled=\{selectedCount === 0\}/);
  assert.match(pageSource, /Paper builder/);
  assert.match(pageSource, /Retry PDF/);
  assert.match(pageSource, /This paper uses one section/);
  assert.doesNotMatch(pageSource, /Generating/);
  assert.match(pageSource, /Saving paper/);
  assert.match(pageSource, /\/api\/question-papers\/generate/);
  assert.doesNotMatch(pageSource, /\/api\/questions\/generate/);
  assert.doesNotMatch(pageSource, /\/api\/question-papers\/generate-pdf/);
  assert.doesNotMatch(pageSource, /coming next/);
  assert.match(pageSource, /detectSelectionConflicts/);
  assert.match(pageSource, /Move up/);
  assert.match(pageSource, /Remove/);
});

test("JK-82 generator accepts V2 sections and Telugu", () => {
  assert.match(jk82, /render_v2_sections/);
  assert.match(jk82, /NotoSansTelugu/);
  assert.match(jk82, /0x0C00/);
  assert.match(jk82, /--work-dir/);
  assert.match(jk82, /Diagram unavailable/);
  assert.match(jk82, /assert_path_in_work_dir/);
  const requiredFonts = [
    "NotoSans-Regular.ttf",
    "NotoSansTelugu-Regular.ttf",
    "NotoSansSymbols2-Regular.ttf",
    "NotoSansMath-Regular.ttf",
    "PlayfairDisplay-Bold.ttf",
    "OFL.txt",
    "SHA256SUMS",
  ];
  for (const file of requiredFonts) {
    assert.equal(existsSync(join(root, "public/fonts", file)), true, file);
  }
});

test("retry, signing, and generated-PDF bounds reject unsafe input", () => {
  const retry = parseGenerateRequest({
    action: "retry",
    paperId: PAPER,
  });
  assert.equal(retry.ok, true);
  assert.equal(retry.action, "retry");
  assert.equal(
    parseGenerateRequest({ action: "retry", paperId: "not-a-uuid" }).ok,
    false,
  );
  assert.equal(
    canSignGeneratedPaper(PAPER, `generated-papers/${PAPER}/${EXPORT}.pdf`),
    true,
  );
  assert.equal(
    canSignGeneratedPaper(PAPER, `generated-papers/${Q1}/${EXPORT}.pdf`),
    false,
  );
  assert.equal(
    canSignGeneratedPaper(PAPER, "../../../etc/passwd"),
    false,
  );
  const oversized = Buffer.alloc(50 * 1024 * 1024 + 1, 0);
  oversized.write("%PDF-", 0);
  assert.equal(isValidGeneratedPdf(oversized, 1), false);
  assert.equal(isValidGeneratedPdf(Buffer.from("%PDF-1.4\n..."), 0), false);
  assert.equal(pdfStatusLabel({ status: "draft" }), "PDF pending");
  assert.notEqual(pdfStatusLabel({ status: "final" }), "Generating");
  assert.equal(generatedPaperObjectKey(PAPER, EXPORT), `${PAPER}/${EXPORT}.pdf`);
  assert.doesNotMatch(generatedPaperObjectKey(PAPER, EXPORT), /^generated-papers\//);
});

test("mixed-class helper blocks the builder", () => {
  const conflict = detectSelectionConflicts([
    { grade: 9, subject: "Mathematics" },
    { grade: 10, subject: "Mathematics" },
  ]);
  assert.equal(conflict.ok, false);
  assert.match(conflict.error, /different classes/);
});
