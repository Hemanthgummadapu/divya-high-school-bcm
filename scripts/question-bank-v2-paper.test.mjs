import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import {
  EXCLUDED_RELEASE_SUBJECTS,
  getSubjectsForGrade,
  isSupportedSubject,
  listSupportedSubjects,
} from "../src/lib/subjects.mjs";
import { ALLOWED_LANGUAGES } from "../src/lib/question-bank-v2-extract.mjs";
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
  assert.match(generateRoute, /saveQuestionPaper/);
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
  assert.match(
    paperApi,
    // Retired papers are archived, so the default list is drafts and finals.
    /\.in\(\s*["']status["'],\s*\[["']draft["'],\s*["']final["']\]/,
  );
  assert.match(paperApi, /generatedPaperObjectKey/);
  assert.match(paperApi, /storedPath\.slice\(`\$\{GENERATED_PAPERS_BUCKET\}\/`/);
});

test("UI builder and saved papers do not call legacy generate routes", () => {
  assert.match(pageSource, /view === "saved"/);
  assert.match(pageSource, /Prepare Paper/);
  assert.match(pageSource, /disabled=\{selectedCount === 0\}/);
  assert.match(pageSource, /Paper builder/);
  assert.match(pageSource, /Retry PDF/);
  assert.match(pageSource, /groupQuestionsIntoSections/);
  assert.doesNotMatch(pageSource, /This paper uses one section/);
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
  assert.equal(pdfStatusLabel({ status: "draft" }), "Draft");
  assert.notEqual(pdfStatusLabel({ status: "final" }), "Generating");
  assert.equal(generatedPaperObjectKey(PAPER, EXPORT), `${PAPER}/${EXPORT}.pdf`);
  assert.doesNotMatch(generatedPaperObjectKey(PAPER, EXPORT), /^generated-papers\//);
});

test("selecting a question narrows the bank to its class and subject", () => {
  const page = readFileSync(
    join(root, "src/app/academics/question-papers/page.tsx"),
    "utf8",
  );
  // The bank is the selection screen. A live selection pins class and subject
  // there, so the list cannot keep offering questions a paper could not hold.
  assert.match(page, /const selectionScope = useMemo/);
  assert.match(page, /const scope = view === "bank" \? selectionScope : null/);
  assert.match(page, /scope \? scope\.subject : filters\.subject/);
  assert.match(page, /scope \? scope\.grade : filters\.grade/);
  // The pinned filters are shown as pinned, with the way out spelled out.
  assert.match(page, /disabled=\{Boolean\(selectionScope\)\}/);
  assert.match(page, /to match the questions you have/);
  // Subject no longer waits on a class: it used to sit disabled with no
  // options while the list showed every subject at once.
  assert.match(page, /: listSupportedSubjects\(\)/);
  assert.doesNotMatch(page, /id="filter-subject"[\s\S]{0,120}disabled=\{!filters\.grade\}/);
  assert.doesNotMatch(page, /id="saved-subject"[\s\S]{0,120}disabled=\{!filters\.grade\}/);
});

test("the subject catalogue offers every subject when no class is chosen", () => {
  const all = listSupportedSubjects();
  assert.deepEqual(all, [
    "Telugu",
    "Hindi",
    "English",
    "Mathematics",
    "Science",
    "Social Studies",
    "Physics",
    "Biology",
  ]);
  // Telugu and Hindi were held back while the generator could not shape them.
  // They are real subjects now, so a first-language paper can be built.
  assert.ok(all.includes("Telugu"));
  assert.ok(all.includes("Hindi"));
  // Every one of them has to survive the server's own filter validation,
  // otherwise choosing it would 400 instead of narrowing the list.
  for (const subject of all) {
    assert.ok(isSupportedSubject(subject), `${subject} must be filterable`);
  }
  assert.equal(EXCLUDED_RELEASE_SUBJECTS.length, 0, "nothing is held back today");
});

test("generated papers set options two to a row and give figures room", () => {
  const generator = readFileSync(
    join(root, "scripts/generate_jk82_pdf.py"),
    "utf8",
  );
  // Options are laid A B / C D the way the printed papers set them, instead
  // of one per line down the page.
  assert.match(generator, /def draw_option_grid\(/);
  assert.match(generator, /y = draw_option_grid\(/);
  assert.doesNotMatch(
    generator,
    /for opt in option_lines\(q\.get\("options"\) or \[\]\):/,
  );
  // A long option keeps the full width and wraps rather than running under
  // its neighbour.
  assert.match(generator, /if not fits_two_up:/);
  // Figures: the box is no longer a third of the page, and a small crop is
  // allowed to grow instead of being drawn at its own pixel size.
  assert.match(generator, /DIAGRAM_MAX_W = 170/);
  assert.match(generator, /DIAGRAM_MAX_H = 140/);
  assert.match(generator, /MAX_DIAGRAM_UPSCALE = 1\.5/);
  assert.match(generator, /min\(max_w \/ iw, max_h \/ ih, MAX_DIAGRAM_UPSCALE\)/);
  // Text beside a figure still has to fit next to the wider box.
  assert.match(generator, /TEXT_WIDTH_RATIO_WITH_DIAGRAM = 0\.62/);
});

test("papers are laid out by a shaping engine so Telugu and Hindi are correct", () => {
  const renderer = readFileSync(
    join(root, "scripts/generate_paper_html_pdf.py"),
    "utf8",
  );
  const api = readFileSync(
    join(root, "src/lib/question-bank-v2-paper-api.ts"),
    "utf8",
  );
  // The drawing generator mapped one codepoint to one glyph and never ran a
  // font's shaping tables: Telugu conjuncts broke, "ప" came out as "వ", and
  // Devanagari never reordered its i-matra. Papers go through WeasyPrint now.
  assert.match(api, /generate_paper_html_pdf\.py/);
  assert.doesNotMatch(api, /generate_jk82_pdf\.py/);
  assert.match(renderer, /from weasyprint import HTML/);
  // Symbol faces are pinned to the blocks they own, so a glyph is taken from
  // the font that really has it rather than composed from a base plus a
  // combining mark, which rendered correctly but broke the PDF's text layer.
  assert.match(renderer, /unicode-range: U\+2190-21FF, U\+2200-22FF/);
  // Options stay two to a row, and a question stays with its options.
  assert.match(renderer, /grid-template-columns: 1fr 1fr/);
  assert.match(renderer, /break-inside: avoid/);
  // A heading at the foot of a page with its questions overleaf reads as an
  // empty section.
  assert.match(renderer, /break-after: avoid/);
  // The figure sits in the question's row: .q-head is a flex container and
  // flex items do not flow around a float, so a floated figure was drawn
  // over the question text and cut it off.
  assert.doesNotMatch(renderer, /\.q-figure \{\{ float: right/);
  // Underlined parts survive as a real underline; some questions are about
  // "the parts that are underlined" and cannot be answered without them.
  assert.match(renderer, /def mark_underlines/);
  assert.match(renderer, /<u>/);
});

test("Telugu and Hindi are offerable and extractable", () => {
  for (const grade of [1, 8, 10]) {
    const subjects = getSubjectsForGrade(grade);
    assert.ok(subjects.includes("Telugu"), `class ${grade} offers Telugu`);
    assert.ok(subjects.includes("Hindi"), `class ${grade} offers Hindi`);
  }
  assert.ok(isSupportedSubject("Telugu"));
  assert.ok(isSupportedSubject("Hindi"));
  // The extractor has to accept a Hindi paper as well as a Telugu one.
  assert.ok(ALLOWED_LANGUAGES.includes("te"));
  assert.ok(ALLOWED_LANGUAGES.includes("hi"));
});

test("mixed-class helper blocks the builder", () => {
  const conflict = detectSelectionConflicts([
    { grade: 9, subject: "Mathematics" },
    { grade: 10, subject: "Mathematics" },
  ]);
  assert.equal(conflict.ok, false);
  assert.match(conflict.error, /different classes/);
});
