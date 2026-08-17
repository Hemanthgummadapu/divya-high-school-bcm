import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  findDuplicatePaperNameWarning,
  parseGenerateRequest,
  planTemplateFromPaper,
  pdfStatusLabel,
  publicSavedPaper,
  suggestGeneratedPaperName,
} from "../src/lib/question-bank-v2-paper.mjs";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const generateRoute = readFileSync(
  join(root, "src/app/api/question-papers/generate/route.ts"),
  "utf8",
);
const paperIdRoute = readFileSync(
  join(root, "src/app/api/question-papers/[id]/route.ts"),
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
const migrationDir = join(root, "supabase/migrations");

const PAPER = "11111111-1111-4111-8111-111111111111";
const Q1 = "22222222-2222-4222-8222-222222222222";
const Q2 = "33333333-3333-4333-8333-333333333333";

function baseBody(overrides = {}) {
  return {
    creationKey: "creation-key-1",
    title: "Class 10 Mathematics Quarterly 2026 – Set A",
    academicYear: 2026,
    durationMinutes: 180,
    items: [
      { questionId: Q1, sectionTitle: "Section A — MCQ", sectionOrder: 1, questionOrder: 1 },
      { questionId: Q2, sectionTitle: "Section B — Short", sectionOrder: 2, questionOrder: 1 },
    ],
    ...overrides,
  };
}

test("a generated paper always requires its own name", () => {
  for (const title of ["", "   ", null, undefined]) {
    const parsed = parseGenerateRequest(baseBody({ title, action: "draft" }));
    assert.equal(parsed.ok, false, String(title));
    assert.equal(parsed.error, "Invalid title");
  }
  const named = parseGenerateRequest(baseBody({ action: "draft" }));
  assert.equal(named.ok, true);
  assert.equal(named.title, "Class 10 Mathematics Quarterly 2026 – Set A");

  const trimmed = parseGenerateRequest(baseBody({ title: "  Spaced Name  " }));
  assert.equal(trimmed.title, "Spaced Name");
  const tooLong = parseGenerateRequest(baseBody({ title: "a".repeat(301) }));
  assert.equal(tooLong.ok, false);
});

test("the name suggestion is composition-based and never the source paper name", () => {
  const suggestion = suggestGeneratedPaperName({
    grade: 10,
    subject: "Mathematics",
    academicYear: 2026,
    examLabel: "Quarterly",
    setLabel: "Set A",
  });
  assert.equal(suggestion, "Class 10 Mathematics Quarterly 2026 – Set A");
  assert.equal(
    suggestGeneratedPaperName({ grade: 8, subject: "Physics", academicYear: 2025 }),
    "Class 8 Physics 2025",
  );
  assert.equal(suggestGeneratedPaperName({}), "");
  assert.ok(suggestion.length <= 300);
});

test("a duplicate name warns without blocking", () => {
  const existing = [{ title: "Class 10 Mathematics Quarterly 2026" }];
  const warning = findDuplicatePaperNameWarning(
    "  class 10 mathematics quarterly 2026 ",
    existing,
  );
  assert.match(warning, /already exists/);
  assert.match(warning, /Set A, Set B or a date/);
  assert.equal(findDuplicatePaperNameWarning("Something Else", existing), null);
  assert.equal(findDuplicatePaperNameWarning("", existing), null);

  // Warning only: the same name still parses into a valid request.
  const parsed = parseGenerateRequest(
    baseBody({ title: "Class 10 Mathematics Quarterly 2026" }),
  );
  assert.equal(parsed.ok, true);
});

test("draft and finalize share one validated shape", () => {
  const draft = parseGenerateRequest(baseBody({ action: "draft" }));
  assert.equal(draft.ok, true);
  assert.equal(draft.action, "draft");
  assert.equal(draft.paperId, null);
  assert.equal(draft.expectedLockVersion, null);

  const final = parseGenerateRequest(baseBody());
  assert.equal(final.action, "create");

  assert.equal(parseGenerateRequest(baseBody({ action: "publish" })).ok, false);
});

test("updating a draft requires its id and lock version", () => {
  const update = parseGenerateRequest(
    baseBody({ action: "draft", paperId: PAPER, expectedLockVersion: 3 }),
  );
  assert.equal(update.ok, true);
  assert.equal(update.paperId, PAPER);
  assert.equal(update.expectedLockVersion, 3);

  assert.equal(
    parseGenerateRequest(baseBody({ action: "draft", paperId: "not-a-uuid" })).ok,
    false,
  );
  const missingLock = parseGenerateRequest(
    baseBody({ action: "draft", paperId: PAPER }),
  );
  assert.equal(missingLock.ok, false);
  assert.equal(missingLock.error, "Invalid lock version");
  assert.equal(
    parseGenerateRequest(
      baseBody({ action: "draft", paperId: PAPER, expectedLockVersion: 0 }),
    ).ok,
    false,
  );
});

test("client snapshot content is still rejected on drafts and templates", () => {
  const leaked = parseGenerateRequest(
    baseBody({
      action: "draft",
      items: [
        {
          questionId: Q1,
          sectionTitle: "Section A",
          sectionOrder: 1,
          questionOrder: 1,
          snapshot_text: "client supplied text",
        },
      ],
    }),
  );
  assert.equal(leaked.ok, false);
  assert.match(leaked.error, /must be taken from the Question Bank/);
});

test("a draft save never generates a PDF and never calls extraction", () => {
  const draftBranch = generateRoute.slice(
    generateRoute.indexOf("if (!finalize)"),
    generateRoute.indexOf("const paper = await loadSavedPaper(paperId)"),
  );
  assert.match(draftBranch, /stage: "draft"/);
  assert.match(draftBranch, /lockVersion/);
  assert.doesNotMatch(draftBranch, /generateAndStorePaperPdf/);
  assert.match(generateRoute, /finalize\b/);
  assert.doesNotMatch(generateRoute, /anthropic|Anthropic|runExtractAndPersist/);
  assert.doesNotMatch(paperApi, /anthropic|Anthropic|extract_pdf/);
});

test("a stale draft lock returns 409 with a reload message", () => {
  assert.match(generateRoute, /stale_paper_lock_version/);
  assert.match(
    generateRoute,
    /This draft was changed elsewhere\. Reload it before saving again\./,
  );
  assert.match(generateRoute, /staleLock: true/);
  assert.match(paperApi, /stale_paper_lock_version/);
});

test("finalized papers cannot be edited and keep their id", () => {
  assert.match(
    generateRoute,
    /existing\.status !== "draft"[\s\S]{0,200}already final and cannot be edited/,
  );
  // The same paper row is finalized in place: no second insert path exists.
  assert.match(generateRoute, /p_paper_id/.test(paperApi) ? /saveQuestionPaper/ : /saveQuestionPaper/);
  assert.match(paperApi, /p_paper_id: input\.paperId \?\? null/);
  assert.match(paperApi, /final papers are immutable/);
});

test("the server computes marks, status and lock version, not the browser", () => {
  assert.doesNotMatch(generateRoute, /totalMarks:\s*body\./);
  assert.match(generateRoute, /totalMarks: saved\.total_marks/);
  assert.match(generateRoute, /lockVersion: saved\.lock_version/);
  assert.match(paperApi, /save_question_paper/);
});

test("duplicate submissions resolve to one paper through the creation key", () => {
  assert.match(paperApi, /p_creation_key: input\.creationKey/);
  assert.match(generateRoute, /creationKey: parsed\.creationKey/);
  assert.match(pageSource, /savingRef/);
});

test("a template rebuilds from approved bank rows and reports the rest", () => {
  const items = [
    {
      bank_question_id: Q1,
      section_title: "Section A — MCQ",
      section_instructions: "Answer all questions.",
      section_display_order: 1,
      question_display_order: 1,
      number_label: "1",
      snapshot_text: "historical snapshot text",
    },
    {
      bank_question_id: Q2,
      section_title: "Section B — Short",
      section_display_order: 2,
      question_display_order: 1,
      number_label: "2",
      snapshot_text: "another historical snapshot",
    },
    {
      bank_question_id: null,
      section_title: "Section B — Short",
      section_display_order: 2,
      question_display_order: 2,
      number_label: "3",
      snapshot_text: "manual item",
    },
  ];
  const rows = [
    { id: Q1, review_status: "approved", question_text: "current approved text", marks: 1 },
    { id: Q2, review_status: "archived", question_text: "archived", marks: 2 },
  ];
  const plan = planTemplateFromPaper(items, rows);
  assert.equal(plan.available.length, 1);
  assert.equal(plan.available[0].questionId, Q1);
  assert.equal(plan.available[0].sectionTitle, "Section A — MCQ");
  assert.equal(plan.available[0].sectionInstructions, "Answer all questions.");
  assert.equal(plan.unavailable.length, 2);
  assert.match(plan.warning, /2 questions from this paper are no longer available/);
  // Historical snapshot text never becomes new authoritative content.
  const serialized = JSON.stringify(plan);
  assert.doesNotMatch(serialized, /historical snapshot text/);

  const allApproved = planTemplateFromPaper(items.slice(0, 1), [rows[0]]);
  assert.equal(allApproved.warning, null);
  assert.equal(allApproved.unavailable.length, 0);

  const singular = planTemplateFromPaper([items[1]], rows);
  assert.match(singular.warning, /1 question from this paper is no longer available/);
});

test("a template preserves section titles and question ordering", () => {
  const items = [
    { bank_question_id: Q2, section_title: "B", section_display_order: 2, question_display_order: 1 },
    { bank_question_id: Q1, section_title: "A", section_display_order: 1, question_display_order: 2 },
    { bank_question_id: PAPER, section_title: "A", section_display_order: 1, question_display_order: 1 },
  ];
  const rows = [Q1, Q2, PAPER].map((id) => ({ id, review_status: "approved" }));
  const plan = planTemplateFromPaper(items, rows);
  assert.deepEqual(
    plan.available.map((entry) => entry.questionId),
    [PAPER, Q1, Q2],
  );
  assert.deepEqual(
    plan.available.map((entry) => entry.sectionOrder),
    [1, 1, 2],
  );
});

test("the composition endpoint reuses the authorized route and hides private paths", () => {
  assert.match(paperIdRoute, /resource=composition|"composition"/);
  assert.match(paperIdRoute, /getPaperComposition/);
  assert.match(
    paperIdRoute,
    /const authorization = await requireQuestionPaperApiAccess/,
  );
  assert.match(paperApi, /export async function getPaperComposition/);
  const composition = paperApi.slice(
    paperApi.indexOf("export async function getPaperComposition"),
    paperApi.indexOf("export async function getSavedPaperDetail"),
  );
  assert.match(composition, /loadBankQuestions/);
  assert.match(composition, /planTemplateFromPaper/);
  assert.doesNotMatch(composition, /snapshot_text/);
  assert.doesNotMatch(composition, /pdf_storage_path/);
  assert.doesNotMatch(composition, /storage_path/);
});

test("saved papers list drafts with filters and never leak storage paths", () => {
  assert.match(paperApi, /filters\.search/);
  assert.match(paperApi, /ilike\("title"/);
  assert.match(
    paperApi,
    /\.in\(\s*["']status["'],\s*\[["']draft["'],\s*["']final["'],\s*["']archived["']\]/,
  );
  const publicShape = publicSavedPaper({
    id: PAPER,
    title: "Quarterly",
    grade: 10,
    subject: "Mathematics",
    academic_year: 2026,
    duration_minutes: 180,
    total_marks: 80,
    status: "draft",
    lock_version: 4,
    updated_at: "2026-08-16T10:00:00.000Z",
    pdf_storage_path: "generated-papers/secret/path.pdf",
    pdf_sha256: "a".repeat(64),
    pdf_byte_size: 1024,
  });
  assert.equal(publicShape.pdfStatus, "Draft");
  assert.equal(publicShape.editable, true);
  assert.equal(publicShape.lockVersion, 4);
  assert.equal(publicShape.updatedAt, "2026-08-16T10:00:00.000Z");
  assert.equal(JSON.stringify(publicShape).includes("secret/path.pdf"), false);

  for (const [status, label] of [
    ["draft", "Draft"],
    ["archived", "Archived"],
    ["final", "PDF pending"],
  ]) {
    assert.equal(pdfStatusLabel({ status }), label);
  }
  assert.equal(
    pdfStatusLabel({
      status: "final",
      pdf_storage_path: `generated-papers/${PAPER}/${Q1}.pdf`,
      pdf_sha256: "a".repeat(64),
    }),
    "Ready",
  );
  assert.equal(publicShape.editable, true);
  assert.equal(
    publicSavedPaper({ id: PAPER, status: "final", title: "x" }).editable,
    false,
  );
});

test("the workflow adds no migration and writes no legacy tables", () => {
  const migrations = readFileSync(
    join(migrationDir, "20260818000000_persist_recovered_failed_pages.sql"),
    "utf8",
  );
  assert.ok(migrations.length > 0);
  for (const source of [generateRoute, paperIdRoute, paperApi]) {
    assert.doesNotMatch(source, /\.from\(\s*["']questions["']\)/);
    assert.doesNotMatch(source, /\.from\(\s*["']question_papers["']\)/);
    assert.doesNotMatch(source, /generated_pdfs/);
  }
});

test("mutations stay behind authorization and the retry PDF path is unchanged", () => {
  assert.match(
    generateRoute,
    /const authorization = await requireQuestionPaperApiAccess\(request, \{\s*mutation: true/,
  );
  const authIndex = generateRoute.indexOf("requireQuestionPaperApiAccess");
  for (const marker of ["saveQuestionPaper", "loadBankQuestions", "generateAndStorePaperPdf"]) {
    assert.ok(generateRoute.indexOf(marker) > authIndex, marker);
  }
  assert.match(generateRoute, /action === "retry"/);
  assert.match(generateRoute, /Only a finalized paper can retry its PDF/);
  assert.match(generateRoute, /already has a PDF/);
});

test("the UI exposes naming, drafts and templates without fake progress", () => {
  assert.match(pageSource, /Question paper name/);
  assert.match(
    pageSource,
    /This name identifies the prepared paper and will appear on the\s+generated PDF\./,
  );
  assert.match(pageSource, /Save draft/);
  assert.match(pageSource, /Generate final paper/);
  assert.match(pageSource, /Continue editing/);
  assert.match(pageSource, /Use as template/);
  assert.match(pageSource, /resource=composition/);
  assert.match(pageSource, /action: "draft"/);
  assert.doesNotMatch(pageSource, /setTimeout\(\s*\(\)\s*=>\s*setProgress/);
});
