import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canSignDiagram,
  canSignSourcePdf,
  canTransitionStatus,
  escapeIlike,
  findForbiddenPatchKeys,
  formatFailedPages,
  isProcessingStale,
  parseListQuery,
  parseRequiredLockVersion,
  publicQuestion,
  publicSource,
  resolveStatusAction,
  sourceStatusLabel,
  uploadResultMessage,
  validateQuestionFields,
} from "../src/lib/question-bank-v2-review.mjs";
import {
  diagramStoragePath,
  isCanonicalDiagramStoragePath,
  isCanonicalSourceStoragePath,
  sourceStoragePath,
} from "../src/lib/question-bank-v2-extract.mjs";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const listRoute = readFileSync(
  join(root, "src/app/api/question-papers/route.ts"),
  "utf8",
);
const sourceRoute = readFileSync(
  join(root, "src/app/api/question-papers/[id]/route.ts"),
  "utf8",
);
const questionPatchRoute = readFileSync(
  join(root, "src/app/api/questions/[id]/route.ts"),
  "utf8",
);
const questionCreateRoute = readFileSync(
  join(root, "src/app/api/questions/route.ts"),
  "utf8",
);
const reviewApi = readFileSync(
  join(root, "src/lib/question-bank-v2-review-api.ts"),
  "utf8",
);
const pageSource = readFileSync(
  join(root, "src/app/academics/question-papers/page.tsx"),
  "utf8",
);

function handler(source, method) {
  const starts = Array.from(
    source.matchAll(/export\s+async\s+function\s+(GET|POST|PATCH|PUT|DELETE)\b/g),
  );
  const match = starts.find((entry) => entry[1] === method);
  assert.ok(match, `${method} handler missing`);
  const index = starts.indexOf(match);
  return source.slice(match.index, starts[index + 1]?.index ?? source.length);
}

const SOURCE_ID = "11111111-1111-1111-1111-111111111111";
const QUESTION_ID = "22222222-2222-2222-2222-222222222222";
const ASSET_ID = "33333333-3333-3333-3333-333333333333";

test("anonymous and unauthorized requests are rejected before database access", () => {
  for (const [source, method] of [
    [listRoute, "GET"],
    [listRoute, "DELETE"],
    [sourceRoute, "GET"],
    [sourceRoute, "POST"],
    [sourceRoute, "DELETE"],
    [questionPatchRoute, "PATCH"],
    [questionCreateRoute, "POST"],
  ]) {
    const body = handler(source, method);
    const authIndex = body.indexOf("requireQuestionPaperApiAccess");
    assert.ok(authIndex >= 0, `${method} is missing authorization`);
    for (const marker of [
      "listV2Questions(",
      "listV2Sources(",
      "getV2SourceDetail(",
      "getV2Question(",
      "updateV2Question(",
      "createManualV2Question(",
      "getSupabase()",
      "request.json(",
    ]) {
      const markerIndex = body.indexOf(marker);
      if (markerIndex >= 0) {
        assert.ok(authIndex < markerIndex, `${method} uses ${marker} before auth`);
      }
    }
  }
});

test("default bank listing is approved-only and review listing is needs_review", () => {
  const bank = parseListQuery(new URLSearchParams());
  assert.equal(bank.ok, true);
  assert.equal(bank.query.view, "bank");
  assert.equal(bank.query.status, "approved");

  const review = parseListQuery(new URLSearchParams("view=review"));
  assert.equal(review.ok, true);
  assert.equal(review.query.status, "needs_review");

  const explicit = parseListQuery(
    new URLSearchParams("view=bank&status=archived"),
  );
  assert.equal(explicit.ok, true);
  assert.equal(explicit.query.status, "archived");
});

test("source filtering, pagination bounds, and search limits are enforced", () => {
  const valid = parseListQuery(
    new URLSearchParams(
      `view=review&sourceId=${SOURCE_ID}&page=2&pageSize=50&q=triangle`,
    ),
  );
  assert.equal(valid.ok, true);
  assert.equal(valid.query.sourceId, SOURCE_ID);
  assert.equal(valid.query.page, 2);
  assert.equal(valid.query.pageSize, 50);

  assert.equal(parseListQuery(new URLSearchParams("page=0")).ok, false);
  assert.equal(parseListQuery(new URLSearchParams("pageSize=101")).ok, false);
  assert.equal(parseListQuery(new URLSearchParams("pageSize=0")).ok, false);
  assert.equal(
    parseListQuery(new URLSearchParams(`q=${"a".repeat(201)}`)).ok,
    false,
  );
  assert.equal(parseListQuery(new URLSearchParams("type=Essay")).ok, false);
  assert.equal(parseListQuery(new URLSearchParams("status=published")).ok, false);
  assert.equal(parseListQuery(new URLSearchParams("sourceId=not-a-uuid")).ok, false);
  assert.equal(parseListQuery(new URLSearchParams("grade=11")).ok, false);
  assert.equal(
    parseListQuery(new URLSearchParams("view=sources&status=partial")).ok,
    true,
  );
});

test("search escaping and deterministic public payloads omit private paths", () => {
  assert.equal(escapeIlike("50%_off\\x"), "50\\%\\_off\\\\x");
  const question = publicQuestion(
    {
      id: QUESTION_ID,
      source_id: SOURCE_ID,
      source_page_number: 2,
      grade: 10,
      subject: "Mathematics",
      academic_year: 2026,
      question_type: "Short",
      language: "te",
      question_text: "త్రిభుజం",
      raw_extracted_text: "raw",
      options: [],
      correct_answer: null,
      marks: 2,
      section_label: "PART-A",
      review_status: "needs_review",
      lock_version: 3,
      diagram_path: `diagrams/${QUESTION_ID}/${ASSET_ID}.png`,
    },
    { sourceFilename: "exam.pdf", diagramUrl: "https://signed.example/diagram" },
  );
  assert.equal(question.questionText, "త్రిభుజం");
  assert.equal(question.diagramUrl, "https://signed.example/diagram");
  assert.equal("diagram_path" in question, false);
  assert.equal("storage_path" in question, false);

  const source = publicSource({
    id: SOURCE_ID,
    original_filename: "exam.pdf",
    grade: 10,
    subject: "Mathematics",
    academic_year: 2026,
    page_count: 4,
    extraction_status: "partial",
    processed_page_count: 3,
    failed_page_numbers: [4],
    extracted_question_count: 8,
    created_at: new Date().toISOString(),
    storage_path: sourceStoragePath(SOURCE_ID),
  });
  assert.equal(source.statusLabel, "Partially extracted");
  assert.deepEqual(source.failedPages, [4]);
  assert.equal("storage_path" in source, false);
});

test("signed PDF and diagram helpers reject arbitrary or mismatched paths", () => {
  const canonicalSource = sourceStoragePath(SOURCE_ID);
  const canonicalDiagram = diagramStoragePath(QUESTION_ID, ASSET_ID);
  assert.equal(canSignSourcePdf(SOURCE_ID, canonicalSource), true);
  assert.equal(canSignSourcePdf(SOURCE_ID, "source-pdfs/other/original.pdf"), false);
  assert.equal(
    canSignSourcePdf(SOURCE_ID, `source-pdfs/${QUESTION_ID}/original.pdf`),
    false,
  );
  assert.equal(isCanonicalSourceStoragePath(SOURCE_ID, canonicalSource), true);
  assert.equal(canSignDiagram(QUESTION_ID, canonicalDiagram), true);
  assert.equal(
    canSignDiagram(QUESTION_ID, `diagrams/${SOURCE_ID}/${ASSET_ID}.png`),
    false,
  );
  assert.equal(canSignDiagram(QUESTION_ID, `${QUESTION_ID}.png`), false);
  assert.equal(
    isCanonicalDiagramStoragePath(QUESTION_ID, "diagrams/evil.png"),
    false,
  );
  assert.match(sourceRoute, /getV2SourceDetail/);
  assert.doesNotMatch(sourceRoute, /searchParams\.get\(["']path["']\)/);
  assert.match(reviewApi, /canSignSourcePdf/);
  assert.match(reviewApi, /canSignDiagram/);
  assert.match(reviewApi, /SIGNED_URL_TTL_SECONDS/);
});

test("successful edits require a lock version and reject stale or forbidden fields", () => {
  const valid = validateQuestionFields({
    questionText: "Find the area",
    questionType: "Short",
    marks: 4,
    language: "en",
  });
  assert.equal(valid.ok, true);

  const telugu = validateQuestionFields({
    questionText: "త్రిభుజం యొక్క వైశాల్యం ఎంత? Explain.",
    questionType: "Medium",
    marks: 4,
  });
  assert.equal(telugu.ok, true);
  assert.equal(telugu.fields.language, "mixed");

  assert.equal(parseRequiredLockVersion(2).ok, true);
  assert.equal(parseRequiredLockVersion(undefined).ok, false);
  assert.deepEqual(findForbiddenPatchKeys({ rawExtractedText: "x" }), [
    "rawExtractedText",
  ]);
  assert.deepEqual(findForbiddenPatchKeys({ grade: 10, sourceId: SOURCE_ID }), [
    "sourceId",
    "grade",
  ]);
  assert.match(questionPatchRoute, /lockVersion/);
  assert.match(questionPatchRoute, /status: 409/);
  assert.match(questionPatchRoute, /findForbiddenPatchKeys/);
  assert.match(reviewApi, /eq\("lock_version", input.lockVersion\)/);
});

test("MCQ options are normalized and invalid marks or types are rejected", () => {
  const mcq = validateQuestionFields({
    questionText: "Choose",
    questionType: "MCQ",
    marks: 1,
    options: ["A) One", "B) Two", "C) Three", "D) Four"],
  });
  assert.equal(mcq.ok, true);
  assert.deepEqual(mcq.fields.options, [
    { label: "A", text: "One" },
    { label: "B", text: "Two" },
    { label: "C", text: "Three" },
    { label: "D", text: "Four" },
  ]);
  assert.equal(
    validateQuestionFields({
      questionText: "Choose",
      questionType: "MCQ",
      marks: 1,
      options: ["only one"],
    }).ok,
    false,
  );
  assert.equal(
    validateQuestionFields({
      questionText: "Q",
      questionType: "Essay",
      marks: 2,
    }).ok,
    false,
  );
  assert.equal(
    validateQuestionFields({
      questionText: "Q",
      questionType: "Short",
      marks: 0,
    }).ok,
    false,
  );
  assert.equal(
    validateQuestionFields({
      questionText: "Q",
      questionType: "Short",
      marks: 2,
      language: "fr",
    }).ok,
    false,
  );
});

test("status transitions are limited to the allowed review workflow", () => {
  assert.equal(canTransitionStatus("needs_review", "approved"), true);
  assert.equal(canTransitionStatus("needs_review", "rejected"), true);
  assert.equal(canTransitionStatus("rejected", "needs_review"), true);
  assert.equal(canTransitionStatus("approved", "archived"), true);
  assert.equal(canTransitionStatus("archived", "needs_review"), true);
  assert.equal(canTransitionStatus("approved", "rejected"), false);
  assert.equal(canTransitionStatus("rejected", "approved"), false);
  assert.equal(canTransitionStatus("needs_review", "archived"), false);
  assert.equal(resolveStatusAction("approve", "needs_review").nextStatus, "approved");
  assert.equal(resolveStatusAction("reject", "needs_review").ok, true);
  assert.equal(resolveStatusAction("restore", "rejected").nextStatus, "needs_review");
  assert.equal(resolveStatusAction("archive", "approved").ok, true);
  assert.equal(resolveStatusAction("approve", "archived").ok, false);
  assert.equal(resolveStatusAction("approve", "approved").ok, false);
});

test("manual questions require classification and never attach a fake source", () => {
  const created = validateQuestionFields(
    {
      questionText: "Add 2 and 3",
      questionType: "Short",
      marks: 1,
      grade: 6,
      subject: "Mathematics",
      academicYear: 2026,
    },
    { requireClassification: true },
  );
  assert.equal(created.ok, true);
  assert.equal(created.fields.grade, 6);
  assert.equal(
    validateQuestionFields(
      { questionText: "Add 2 and 3", questionType: "Short", marks: 1 },
      { requireClassification: true },
    ).ok,
    false,
  );
  assert.match(questionCreateRoute, /source_id/);
  assert.match(questionCreateRoute, /Manual questions cannot be attached to a source/);
  assert.match(reviewApi, /source_id: null/);
  assert.match(reviewApi, /raw_extracted_text: input.rawExtractedText/);
  assert.match(questionCreateRoute, /action === "approve" \? "approved" : "needs_review"/);
});

test("diagram replacement uses a new UUID path and compensates only the new object", () => {
  assert.match(reviewApi, /randomUUID\(\)/);
  assert.match(reviewApi, /diagramStoragePath\(input.questionId, assetId\)/);
  assert.match(reviewApi, /upsert:\s*false/);
  assert.match(
    reviewApi,
    /if \(createdDiagram\) \{\s*await getSupabase\(\)[\s\S]*remove\(\[createdDiagram.path\]\)/,
  );
  assert.doesNotMatch(reviewApi, /remove\(\[.*previous/);
  assert.doesNotMatch(questionPatchRoute, /upsert:\s*true/);
  assert.match(questionPatchRoute, /validatePngDiagram/);
  const validateIndex = handler(questionPatchRoute, "PATCH").indexOf(
    "validatePngDiagram",
  );
  const dbIndex = handler(questionPatchRoute, "PATCH").indexOf("getV2Question(");
  assert.ok(validateIndex < dbIndex);
});

test("upload response helpers stay user-safe and honest", () => {
  assert.equal(
    uploadResultMessage({
      status: "completed",
      savedQuestionCount: 12,
      sourceId: SOURCE_ID,
    }).text,
    "PDF extracted. 12 questions are ready for review.",
  );
  assert.equal(
    uploadResultMessage({
      status: "partial",
      savedQuestionCount: 5,
      failedPages: [2, 4],
    }).text,
    "5 questions were saved, but pages 2, 4 could not be extracted.",
  );
  assert.equal(
    uploadResultMessage({ duplicate: true, sourceId: SOURCE_ID }).text,
    "This PDF was already uploaded.",
  );
  assert.equal(
    uploadResultMessage({ status: "failed", error: "No questions could be saved from this PDF" })
      .kind,
    "failed",
  );
  assert.equal(sourceStatusLabel("completed"), "Completed");
  assert.equal(sourceStatusLabel("partial"), "Partially extracted");
  assert.equal(sourceStatusLabel("failed"), "Failed");
  assert.equal(sourceStatusLabel("processing", new Date().toISOString()), "Processing");
  assert.equal(
    sourceStatusLabel("processing", new Date(Date.now() - 31 * 60 * 1000).toISOString()),
    "Processing (possibly interrupted)",
  );
  assert.equal(isProcessingStale(new Date(Date.now() - 10 * 60 * 1000).toISOString()), false);
  assert.deepEqual(formatFailedPages([1, 0, "x", 3]), [1, 3]);
});

test("UI uses V2 views and does not present local-only or hard-delete success", () => {
  assert.match(pageSource, /view === "review"/);
  assert.match(pageSource, /view === "bank"/);
  assert.match(pageSource, /view === "sources"/);
  assert.match(pageSource, /uploadResultMessage/);
  assert.match(pageSource, /Save for review/);
  assert.match(pageSource, /Save and approve/);
  assert.match(pageSource, /selectedIds/);
  assert.match(pageSource, /Generate paper \(coming next\)/);
  assert.match(pageSource, /No questions are waiting for review/);
  assert.match(pageSource, /No approved questions match these filters/);
  assert.match(pageSource, /No uploaded PDFs yet/);
  assert.doesNotMatch(pageSource, /Clear All Questions/);
  assert.doesNotMatch(pageSource, /method:\s*["']DELETE["']/);
  assert.doesNotMatch(pageSource, /\/api\/question-papers\/generate/);
  assert.doesNotMatch(pageSource, /\/api\/questions\/generate/);
  assert.doesNotMatch(pageSource, /data\.paper\.questions/);
  assert.match(pageSource, /if \(!response\.ok \|\| !data\.success\)/);
  assert.match(pageSource, /disabled=\{mutating\}/);
});

test("legacy tables are not written or deleted by V2 review routes", () => {
  for (const source of [
    listRoute,
    sourceRoute,
    questionPatchRoute,
    questionCreateRoute,
    reviewApi,
  ]) {
    assert.doesNotMatch(source, /\.from\(\s*["']questions["']\)/);
    assert.doesNotMatch(source, /\.from\(\s*["']question_papers["']\)/);
    assert.doesNotMatch(source, /\.from\(\s*["']generated_pdfs["']\)/);
  }
  assert.match(handler(listRoute, "DELETE"), /status: 405/);
  assert.match(handler(sourceRoute, "DELETE"), /status: 405/);
  assert.match(handler(sourceRoute, "POST"), /status: 410/);
  assert.doesNotMatch(handler(listRoute, "GET"), /from\("questions"\)/);
  assert.match(handler(listRoute, "GET"), /listV2Questions|listV2Sources/);
});

test("source details hide rejected and archived questions unless requested", () => {
  assert.match(reviewApi, /not\(\s*"review_status",\s*"in",\s*"\(rejected,archived\)"/);
  assert.match(sourceRoute, /status: status \|\| undefined/);
});

test("list GET and source GET do not return private storage paths", () => {
  assert.doesNotMatch(handler(listRoute, "GET"), /storage_path/);
  assert.doesNotMatch(publicSource.toString(), /storage_path:/);
  assert.match(reviewApi, /SOURCE_LIST_COLUMNS/);
  assert.doesNotMatch(
    reviewApi.slice(
      reviewApi.indexOf("SOURCE_LIST_COLUMNS"),
      reviewApi.indexOf("SOURCE_LIST_COLUMNS") + 220,
    ),
    /storage_path/,
  );
});
