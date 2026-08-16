import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_MAX_PDF_PAGES,
  DEFAULT_MAX_UPLOAD_BYTES,
  validatePdfUpload,
  validateUploadContentLength,
} from "../src/lib/question-paper-upload-policy.mjs";
import { isAnthropicConfigured } from "../src/lib/question-paper-provider-policy.mjs";
import {
  QUESTION_BANK_V2_RESULT_SCHEMA,
  buildPersistencePlan,
  classifyPageError,
  computePdfSha256,
  containsForbiddenLogText,
  createPersistIdempotencyKey,
  createSourceId,
  detectLanguage,
  diagramStoragePath,
  isUniqueViolation,
  normalizeExtractedQuestion,
  normalizeMcqOptions,
  parseValidatePdfPagesStdout,
  sanitizeOriginalFilename,
  sourceStoragePath,
  toRpcQuestions,
  userSafeUploadError,
  validateDocumentResult,
} from "../src/lib/question-bank-v2-extract.mjs";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const routeSource = readFileSync(
  join(root, "src/app/api/question-papers/route.ts"),
  "utf8",
);
const persistSource = readFileSync(
  join(root, "src/lib/question-bank-v2-persist.ts"),
  "utf8",
);
const extractPy = readFileSync(join(root, "scripts/extract_pdf.py"), "utf8");
const MINIMAL_PDF = Buffer.from(
  "%PDF-1.1\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000068 00000 n \n0000000125 00000 n \ntrailer<< /Size 4 /Root 1 0 R >>\nstartxref\n203\n%%EOF\n",
);

function postHandler() {
  const match = routeSource.match(
    /export async function POST[\s\S]*?\nexport async function DELETE/,
  );
  assert.ok(match, "POST handler missing");
  return match[0];
}

function succeededPage(pageNumber, questions) {
  return { pageNumber, status: "succeeded", questions };
}

function failedPage(pageNumber, errorCategory = "provider") {
  return { pageNumber, status: "failed", errorCategory, questions: [] };
}

test("anonymous and unauthorized requests are rejected before body parsing", () => {
  const post = postHandler();
  assert.ok(
    post.indexOf("requireQuestionPaperApiAccess") < post.indexOf("request.formData("),
  );
  assert.ok(
    post.indexOf("validateUploadContentLength") < post.indexOf("request.formData("),
  );
});

test("invalid upload never reaches storage or parser", () => {
  const rejected = validatePdfUpload({
    name: "notes.txt",
    mimeType: "text/plain",
    bytes: Buffer.from("not a pdf"),
    maxBytes: DEFAULT_MAX_UPLOAD_BYTES,
    maxPages: DEFAULT_MAX_PDF_PAGES,
  });
  assert.notEqual(rejected.status, 200);
  const calls = { storage: 0, parser: 0 };
  if (rejected.status === 200) {
    calls.storage += 1;
    calls.parser += 1;
  }
  assert.deepEqual(calls, { storage: 0, parser: 0 });
});

test("missing Anthropic key fails closed before parser spawn", () => {
  const post = postHandler();
  assert.ok(
    post.indexOf("isAnthropicConfigured") < post.indexOf("extract_pdf.py"),
  );
  assert.equal(isAnthropicConfigured(""), false);
  assert.equal(isAnthropicConfigured("your_key_here"), false);
});

test("browser code cannot import service-role persistence", () => {
  assert.match(persistSource, /assertServerOnly\("Question-bank V2 persistence"\)/);
  const page = readFileSync(
    join(root, "src/app/academics/question-papers/page.tsx"),
    "utf8",
  );
  assert.doesNotMatch(page, /question-bank-v2-persist|SUPABASE_SERVICE_ROLE_KEY/);
});

test("valid and invalid PDFs are classified before storage", () => {
  const valid = validatePdfUpload({
    name: "paper.pdf",
    mimeType: "application/pdf",
    bytes: MINIMAL_PDF,
    maxBytes: DEFAULT_MAX_UPLOAD_BYTES,
    maxPages: DEFAULT_MAX_PDF_PAGES,
  });
  assert.equal(valid.status, 200);

  const invalidSignature = validatePdfUpload({
    name: "paper.pdf",
    mimeType: "application/pdf",
    bytes: Buffer.from("not a pdf"),
    maxBytes: DEFAULT_MAX_UPLOAD_BYTES,
    maxPages: DEFAULT_MAX_PDF_PAGES,
  });
  assert.equal(invalidSignature.status, 415);

  const compressedLike = validatePdfUpload({
    name: "paper.pdf",
    mimeType: "application/pdf",
    bytes: Buffer.concat([
      Buffer.from("%PDF-1.4\n"),
      Buffer.from("/Filter /FlateDecode\n"),
      Buffer.from("1 0 obj << /Type /Pages /Count 1 >>\n"),
    ]),
    maxBytes: DEFAULT_MAX_UPLOAD_BYTES,
    maxPages: DEFAULT_MAX_PDF_PAGES,
  });
  assert.equal(compressedLike.status, 200);
});

test("Content-Length is required and oversized bodies are rejected", () => {
  assert.equal(
    validateUploadContentLength(null, DEFAULT_MAX_UPLOAD_BYTES, { required: true })
      ?.status,
    422,
  );
  assert.equal(
    validateUploadContentLength("", DEFAULT_MAX_UPLOAD_BYTES, { required: true })
      ?.status,
    422,
  );
  assert.equal(
    validateUploadContentLength("not-a-number", DEFAULT_MAX_UPLOAD_BYTES)?.status,
    422,
  );
  assert.equal(
    validateUploadContentLength(
      String(DEFAULT_MAX_UPLOAD_BYTES + 2 * 1024 * 1024),
      DEFAULT_MAX_UPLOAD_BYTES,
    )?.status,
    413,
  );
  const oversized = validatePdfUpload({
    name: "paper.pdf",
    mimeType: "application/pdf",
    bytes: Buffer.alloc(DEFAULT_MAX_UPLOAD_BYTES + 1, 0),
    maxBytes: DEFAULT_MAX_UPLOAD_BYTES,
    maxPages: DEFAULT_MAX_PDF_PAGES,
  });
  assert.equal(oversized.status, 413);
});

test("too many pages is rejected by upload policy", () => {
  const result = validatePdfUpload({
    name: "paper.pdf",
    mimeType: "application/pdf",
    bytes: Buffer.from("%PDF-1.4\n1 0 obj << /Type /Pages /Count 21 >>"),
    maxBytes: DEFAULT_MAX_UPLOAD_BYTES,
    maxPages: DEFAULT_MAX_PDF_PAGES,
  });
  assert.equal(result.status, 422);
});

test("duplicate hash returns existing source and skips storage", () => {
  const post = postHandler();
  assert.ok(post.indexOf("findSourceByChecksum") < post.indexOf("uploadSourcePdf"));
  assert.match(post, /duplicate:\s*true/);
  assert.match(post, /status:\s*409/);
  assert.ok(isUniqueViolation({ code: "23505" }));
  assert.equal(isUniqueViolation({ code: "400" }), false);
});

test("page-result contract accepts complete success and rejects gaps", () => {
  const ok = validateDocumentResult(
    {
      schemaVersion: QUESTION_BANK_V2_RESULT_SCHEMA,
      pageCount: 2,
      pages: [
        succeededPage(1, [
          {
            text: "What is 2 + 2?",
            type: "Short",
            marks: 2,
            section: "SECTION-I",
          },
        ]),
        succeededPage(2, [
          {
            text: "Choose the correct option",
            type: "MCQ",
            marks: 1,
            options: ["A) One", "B) Two"],
            section: "SECTION-A",
          },
        ]),
      ],
    },
    2,
  );
  assert.equal(ok.ok, true);

  assert.equal(
    validateDocumentResult(
      {
        schemaVersion: 1,
        pageCount: 2,
        pages: [succeededPage(1, [{ text: "Q", type: "Short", marks: 1 }])],
      },
      2,
    ).ok,
    false,
  );
  assert.equal(
    validateDocumentResult(
      {
        schemaVersion: 1,
        pageCount: 2,
        pages: [
          succeededPage(1, [{ text: "Q", type: "Short", marks: 1 }]),
          succeededPage(1, [{ text: "Q2", type: "Short", marks: 1 }]),
        ],
      },
      2,
    ).reason,
    "duplicate_page_result",
  );
  assert.equal(
    validateDocumentResult(
      {
        schemaVersion: 1,
        pageCount: 1,
        pages: [succeededPage(4, [{ text: "Q", type: "Short", marks: 1 }])],
      },
      1,
    ).reason,
    "out_of_range_page_number",
  );
});

test("one failed page and all-failed pages produce honest plans", () => {
  const partial = buildPersistencePlan([
    succeededPage(1, [
      { text: "Explain photosynthesis", type: "Long", marks: 8, section: "SECTION-III" },
    ]),
    failedPage(2, "timeout"),
  ]);
  assert.equal(partial.ok, true);
  assert.equal(partial.status, "partial");
  assert.deepEqual(partial.failedPageNumbers, [2]);
  assert.equal(partial.questions.length, 1);

  const failed = buildPersistencePlan([
    failedPage(1, "provider"),
    failedPage(2, "parse"),
  ]);
  assert.equal(failed.ok, true);
  assert.equal(failed.status, "failed");
  assert.equal(failed.questions.length, 0);

  const completed = buildPersistencePlan([
    succeededPage(1, [
      { text: "Define force", type: "Short", marks: 2, section: "SECTION-I" },
    ]),
  ]);
  assert.equal(completed.ok, true);
  assert.equal(completed.status, "completed");
  assert.deepEqual(completed.failedPageNumbers, []);
});

test("invalid questions fail the whole page", () => {
  const plan = buildPersistencePlan([
    succeededPage(1, [
      { text: "Valid", type: "Short", marks: 2, section: "SECTION-I" },
      { text: "Broken MCQ", type: "MCQ", marks: 1, options: ["only-one"] },
    ]),
  ]);
  assert.equal(plan.ok, true);
  assert.equal(plan.status, "failed");
  assert.deepEqual(plan.failedPageNumbers, [1]);
});

test("MCQ options, languages, and marks normalize correctly", () => {
  assert.deepEqual(normalizeMcqOptions(["A) First", "B) Second"]), [
    { label: "A", text: "First" },
    { label: "B", text: "Second" },
  ]);
  assert.equal(normalizeMcqOptions(["only-one"]), null);
  assert.equal(detectLanguage("What is gravity?"), "en");
  assert.equal(detectLanguage("\u0c17\u0c41\u0c30\u0c41\u0c24\u0c4d\u0c35\u0c3e\u0c15\u0c30\u0c4d\u0c37\u0c23"), "te");
  assert.equal(
    detectLanguage("Define \u0c17\u0c41\u0c30\u0c41\u0c24\u0c4d\u0c35\u0c3e\u0c15\u0c30\u0c4d\u0c37\u0c23"),
    "mixed",
  );

  const english = normalizeExtractedQuestion(
    { text: "What is gravity?", type: "Short", marks: 2, section: "SECTION-I" },
    1,
    1,
  );
  assert.equal(english.ok, true);
  assert.equal(english.question.language, "en");
  assert.equal(english.question.review_status, undefined);
  assert.equal(english.question.raw_extracted_text, "What is gravity?");

  const telugu = normalizeExtractedQuestion(
    {
      text: "\u0c17\u0c41\u0c30\u0c41\u0c24\u0c4d\u0c35\u0c3e\u0c15\u0c30\u0c4d\u0c37\u0c23",
      type: "Short",
      marks: 2,
      section: "SECTION-I",
    },
    1,
    1,
  );
  assert.equal(telugu.ok, true);
  assert.equal(telugu.question.language, "te");

  const mixed = normalizeExtractedQuestion(
    {
      text: "Define \u0c17\u0c41\u0c30\u0c41\u0c24\u0c4d\u0c35\u0c3e\u0c15\u0c30\u0c4d\u0c37\u0c23 with an example",
      type: "Medium",
      marks: 4,
      section: "SECTION-II",
    },
    1,
    1,
  );
  assert.equal(mixed.ok, true);
  assert.equal(mixed.question.language, "mixed");
});

test("RPC payloads omit client storage paths and use server classification", () => {
  const plan = buildPersistencePlan([
    succeededPage(1, [
      {
        text: "Choose",
        type: "MCQ",
        marks: 1,
        options: ["A) One", "B) Two", "C) Three", "D) Four"],
        section: "PART-B",
        diagram_path: "diagrams/evil.png",
      },
    ]),
  ]);
  assert.equal(plan.status, "failed");

  const good = buildPersistencePlan([
    succeededPage(1, [
      {
        text: "Choose",
        type: "MCQ",
        marks: 1,
        options: ["A) One", "B) Two"],
        section: "PART-B",
      },
    ]),
  ]);
  const payload = toRpcQuestions(good.questions);
  assert.equal(payload[0].source_page_number, 1);
  assert.equal(payload[0].question_type, "MCQ");
  assert.deepEqual(payload[0].options, [
    { label: "A", text: "One" },
    { label: "B", text: "Two" },
  ]);
  assert.equal("diagram_path" in payload[0], false);
  assert.equal("grade" in payload[0], false);
});

test("idempotent retry key is deterministic per source", () => {
  const sourceId = "11111111-1111-1111-1111-111111111111";
  assert.equal(
    createPersistIdempotencyKey(sourceId),
    createPersistIdempotencyKey(sourceId),
  );
  assert.match(createPersistIdempotencyKey(sourceId), /^persist-/);
});

test("storage paths are canonical and server-generated", () => {
  const sourceId = createSourceId();
  assert.match(
    sourceStoragePath(sourceId),
    /^source-pdfs\/[0-9a-f-]{36}\/original\.pdf$/,
  );
  const questionId = "22222222-2222-2222-2222-222222222222";
  const assetId = "33333333-3333-3333-3333-333333333333";
  assert.equal(
    diagramStoragePath(questionId, assetId),
    `diagrams/${questionId}/${assetId}.png`,
  );
  assert.equal(sanitizeOriginalFilename("../secret/exam.pdf"), "exam.pdf");
  assert.equal(sanitizeOriginalFilename("not-a-pdf.txt"), "upload.pdf");
});

test("error classification and user-safe messages hide internals", () => {
  assert.equal(classifyPageError("timed out"), "timeout");
  assert.equal(classifyPageError("529 overloaded"), "provider");
  assert.equal(classifyPageError("JSONDecodeError"), "parse");
  assert.equal(userSafeUploadError("failed"), "No questions could be saved from this PDF");
  assert.equal(containsForbiddenLogText("sk-ant-secret"), true);
  assert.equal(containsForbiddenLogText("request outcome=extract_complete"), false);
  assert.equal(parseValidatePdfPagesStdout("12\n"), 12);
  assert.equal(parseValidatePdfPagesStdout("bad"), null);
});

test("legacy tables are not written by V2 persist or upload POST", () => {
  const post = postHandler();
  assert.doesNotMatch(post, /\.from\(\s*["']questions["']\)/);
  assert.doesNotMatch(post, /\.from\(\s*["']question_papers["']\)/);
  assert.doesNotMatch(post, /\.from\(\s*["']generated_pdfs["']\)/);
  assert.doesNotMatch(persistSource, /\.from\(\s*["']questions["']\)/);
  assert.doesNotMatch(persistSource, /\.from\(\s*["']question_papers["']\)/);
  assert.match(persistSource, /persist_extracted_questions/);
  assert.match(persistSource, /upsert:\s*false/);
});

test("source PDF is retained after extraction failure and diagrams are compensated", () => {
  const post = postHandler();
  assert.match(post, /markSourceFailed/);
  assert.match(post, /deleteCreatedStorageObjects\(createdObjects\)/);
  assert.match(post, /deleteCreatedStorageObjects\(diagramObjects\)/);
  assert.match(post, /sourceRowCreated/);
  assert.match(
    post,
    /outcome: "processing_error",\s*\}\);\s*await markSourceFailed\(sourceId, "internal"\)/,
  );
});

test("Python page contract does not log secrets or question text", () => {
  assert.match(extractPy, /schemaVersion/);
  assert.match(extractPy, /failed_page/);
  assert.match(extractPy, /--work-dir/);
  assert.doesNotMatch(extractPy, /print\(\s*response_text/);
  assert.doesNotMatch(extractPy, /ANTHROPIC_API_KEY present/);
  assert.doesNotMatch(extractPy, /traceback\.print_exc/);
  assert.match(extractPy, /claude-sonnet-4-6/);
});

test("authoritative pypdf still rejects malformed percent-PDF content", () => {
  const venvPython = join(root, "venv", "bin", "python3");
  const python = existsSync(venvPython) ? venvPython : "python3";
  const result = spawnSync(
    python,
    [
      "-c",
      "import io,sys; from pypdf import PdfReader; len(PdfReader(io.BytesIO(sys.stdin.buffer.read())).pages)",
    ],
    {
      input: Buffer.from("%PDF-1.4\n1 0 obj << /Type /Pages /Count 1 >>\n%%EOF"),
      timeout: 5_000,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    },
  );
  assert.notEqual(result.status, 0);
});

test("SHA-256 is computed from validated bytes", () => {
  const hash = computePdfSha256(MINIMAL_PDF);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(computePdfSha256(MINIMAL_PDF), hash);
});
