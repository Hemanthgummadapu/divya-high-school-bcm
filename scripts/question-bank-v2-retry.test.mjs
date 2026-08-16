import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canShowRetryExtraction,
  evaluateRetryClaim,
  isFailedSourceRetryEligible,
} from "../src/lib/question-bank-v2-retry.mjs";
import {
  buildExtractionDiagnostic,
  sanitizeRpcErrorCategory,
} from "../src/lib/question-bank-v2-diagnostics.mjs";
import { containsForbiddenLogText } from "../src/lib/question-bank-v2-extract.mjs";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const retryRoute = readFileSync(
  join(root, "src/app/api/question-papers/[id]/retry/route.ts"),
  "utf8",
);
const persistSource = readFileSync(
  join(root, "src/lib/question-bank-v2-persist.ts"),
  "utf8",
);
const pageSource = readFileSync(
  join(root, "src/app/academics/question-papers/page.tsx"),
  "utf8",
);
const extractRun = readFileSync(
  join(root, "src/lib/question-bank-v2-extract-run.ts"),
  "utf8",
);

const FAILED = {
  extraction_status: "failed",
  extracted_question_count: 0,
};

test("retry is eligible only for failed sources with zero questions", () => {
  assert.equal(isFailedSourceRetryEligible(FAILED), true);
  assert.equal(canShowRetryExtraction({ status: "failed", savedQuestionCount: 0 }), true);
  assert.equal(
    isFailedSourceRetryEligible({ ...FAILED, extraction_status: "partial" }),
    false,
  );
  assert.equal(
    isFailedSourceRetryEligible({ ...FAILED, extraction_status: "completed" }),
    false,
  );
  assert.equal(
    isFailedSourceRetryEligible({ ...FAILED, extracted_question_count: 3 }),
    false,
  );
  assert.equal(
    isFailedSourceRetryEligible(FAILED, { linkedQuestionCount: 1 }),
    false,
  );
});

test("retry is forbidden when checksum, object, or page count do not match", () => {
  assert.equal(evaluateRetryClaim({
    sourceStatus: "failed",
    extractedCount: 0,
    linkedQuestionCount: 0,
    objectPresent: false,
    checksumMatch: true,
    pageCountMatch: true,
    updatedRows: 1,
  }).reason, "missing_object");
  assert.equal(evaluateRetryClaim({
    sourceStatus: "failed",
    extractedCount: 0,
    linkedQuestionCount: 0,
    objectPresent: true,
    checksumMatch: false,
    pageCountMatch: true,
    updatedRows: 1,
  }).reason, "checksum_mismatch");
  assert.equal(evaluateRetryClaim({
    sourceStatus: "failed",
    extractedCount: 0,
    linkedQuestionCount: 0,
    objectPresent: true,
    checksumMatch: true,
    pageCountMatch: false,
    updatedRows: 1,
  }).reason, "page_count_mismatch");
});

test("concurrent retry claim is a 409 and does not spawn Anthropic", () => {
  const conflict = evaluateRetryClaim({
    sourceStatus: "failed",
    extractedCount: 0,
    linkedQuestionCount: 0,
    objectPresent: true,
    checksumMatch: true,
    pageCountMatch: true,
    updatedRows: 0,
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.status, 409);
  const body = retryRoute.slice(retryRoute.indexOf("export async function POST"));
  assert.ok(body.indexOf("claimFailedSourceForRetry") < body.lastIndexOf("runExtractAndPersist"));
  assert.ok(body.indexOf("if (!claimedRow.ok)") < body.lastIndexOf("runExtractAndPersist"));
});

test("retry reuses the same source and does not create a new row or object", () => {
  assert.doesNotMatch(retryRoute, /createProcessingSource|uploadSourcePdf|createSourceId/);
  assert.match(retryRoute, /downloadSourcePdfBytes/);
  assert.match(retryRoute, /runExtractAndPersist/);
  assert.match(persistSource, /persist_idempotency_key:\s*null/);
  assert.match(persistSource, /extraction_status:\s*"processing"/);
  assert.match(persistSource, /\.eq\("extraction_status", "failed"\)/);
});

test("retry returns the same terminal states as upload", () => {
  assert.match(extractRun, /status: "completed"/);
  assert.match(extractRun, /status: "partial"/);
  assert.match(extractRun, /status: "failed"/);
  assert.match(extractRun, /persist_extracted_questions/);
  assert.doesNotMatch(retryRoute, /\.from\(\s*["']questions["']\)/);
  assert.doesNotMatch(retryRoute, /\.from\(\s*["']question_papers["']\)/);
  assert.doesNotMatch(retryRoute, /\.from\(\s*["']generated_pdfs["']\)/);
});

test("UI shows Retry Extraction only for eligible failed sources", () => {
  assert.match(pageSource, /source\.retryEligible/);
  assert.match(pageSource, /Retry Extraction/);
  assert.match(pageSource, /\/api\/question-papers\/\$\{sourceId\}\/retry/);
  assert.equal(canShowRetryExtraction({ status: "partial", savedQuestionCount: 2 }), false);
  assert.equal(canShowRetryExtraction({ status: "completed", savedQuestionCount: 0 }), false);
});

test("sanitized diagnostics omit secrets, paths, and content", () => {
  const diagnostic = buildExtractionDiagnostic({
    requestId: "11111111-1111-1111-1111-111111111111",
    sourceId: "4b04d3ce-632b-45f5-a6a4-939ee69c37c8",
    stage: "persistence_rpc",
    pageNumber: 2,
    errorCategory: "internal",
    providerHttpStatusClass: 503,
    elapsedMs: 25000,
    questionText: "should not appear",
    apiKey: "sk-ant-secret",
  });
  const serialized = JSON.stringify(diagnostic);
  assert.equal(diagnostic.requestId, "11111111-1111-1111-1111-111111111111");
  assert.equal(diagnostic.stage, "persistence_rpc");
  assert.equal(diagnostic.providerHttpStatusClass, "5xx");
  assert.equal(diagnostic.elapsedMs, 25000);
  assert.equal("questionText" in diagnostic, false);
  assert.equal(containsForbiddenLogText(serialized), false);
  assert.doesNotMatch(serialized, /sk-ant|questionText|source-pdfs\//);
  assert.equal(sanitizeRpcErrorCategory({ message: "invalid_question_text" }), "invalid_question_text");
  assert.equal(sanitizeRpcErrorCategory({ code: "42702", message: "column reference \"page_number\" is ambiguous" }), "ambiguous_column");
  assert.equal(sanitizeRpcErrorCategory({ message: "boom with secrets sk-ant-x" }), "rpc_error");
});

test("retry route authorizes mutations before any source access", () => {
  const authIndex = retryRoute.indexOf("requireQuestionPaperApiAccess");
  assert.ok(authIndex >= 0);
  assert.ok(authIndex < retryRoute.indexOf("inspectRetryEligibility"));
  assert.ok(authIndex < retryRoute.indexOf("claimFailedSourceForRetry"));
  assert.ok(authIndex < retryRoute.indexOf("downloadSourcePdfBytes"));
  assert.match(retryRoute, /mutation:\s*true/);
});
