import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRetryClick,
  applyRetryListReload,
  canBeginRetryPaidWork,
  canShowRetryExtraction,
  createRetryClickLock,
  evaluateRetryClaim,
  evaluateRetryEligibility,
  isFailedSourceRetryEligible,
  isStoredChecksumValid,
  isStoredPageCountValid,
  sanitizeRetryRejectionReason,
  shouldRenderRetryButton,
  statusRejectionReason,
} from "../src/lib/question-bank-v2-retry.mjs";
import { runRetrySpendControl } from "../src/lib/question-bank-v2-retry-run.mjs";
import {
  buildExtractionDiagnostic,
  buildRetryRejectionLog,
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
const uploadRoute = readFileSync(
  join(root, "src/app/api/question-papers/route.ts"),
  "utf8",
);
const retryRun = readFileSync(
  join(root, "src/lib/question-bank-v2-retry-run.mjs"),
  "utf8",
);

const SOURCE_ID = "4b04d3ce-632b-45f5-a6a4-939ee69c37c8";
const REQUEST_ID = "11111111-1111-1111-1111-111111111111";
const CHECKSUM = "872134ec1ab2a6312e6b434e390c27933cafab52b6c60f7553d1bcc43926aec7";

const ELIGIBLE_SOURCE = {
  extraction_status: "failed",
  extracted_question_count: 0,
  content_sha256: CHECKSUM,
  byte_size: 9,
  page_count: 6,
  subject: "Mathematics",
  grade: 10,
  academic_year: 2026,
};

const ELIGIBLE_INSPECT = {
  ok: true,
  source: ELIGIBLE_SOURCE,
  linkedQuestionCount: 0,
  objectPresent: true,
  storedChecksumValid: true,
  storedPageCountValid: true,
};

const ELIGIBLE_CLAIM = {
  sourceStatus: "failed",
  extractedCount: 0,
  linkedQuestionCount: 0,
  objectPresent: true,
  storedChecksumValid: true,
  storedPageCountValid: true,
  updatedRows: 1,
};

function createPaidWorkSpies(overrides = {}) {
  const calls = {
    inspect: 0,
    claim: 0,
    download: 0,
    temp: 0,
    write: 0,
    python: 0,
    extract: 0,
    anthropic: 0,
    markFailed: 0,
    logs: [],
  };
  const bytes = Buffer.from("pdf-bytes");
  const deps = {
    inspectRetryEligibility: async () => {
      calls.inspect += 1;
      return overrides.inspect ?? ELIGIBLE_INSPECT;
    },
    claimFailedSourceForRetry: async () => {
      calls.claim += 1;
      return overrides.claim ?? { ok: true };
    },
    isAnthropicConfigured: () => overrides.anthropicConfigured ?? true,
    downloadSourcePdfBytes: async () => {
      calls.download += 1;
      if (overrides.downloadError) throw new Error("download");
      return overrides.downloaded ?? bytes;
    },
    computePdfSha256: () => overrides.checksum ?? CHECKSUM,
    createTempDir: async () => {
      calls.temp += 1;
      return "/tmp/qb-retry-test";
    },
    writeSourcePdf: async () => {
      calls.write += 1;
    },
    validatePdfPages: async () => {
      calls.python += 1;
      if (overrides.pageError) throw new Error("pages");
      return overrides.pageCount ?? 6;
    },
    runExtractAndPersist: async () => {
      calls.extract += 1;
      calls.anthropic += 1;
      return { success: true, status: "completed" };
    },
    markSourceFailed: async () => {
      calls.markFailed += 1;
    },
    logRetryRejection: (entry) => {
      calls.logs.push(entry);
    },
  };
  return { calls, deps };
}

async function runPipeline(overrides = {}) {
  const { calls, deps } = createPaidWorkSpies(overrides);
  const result = await runRetrySpendControl(
    { sourceId: SOURCE_ID, requestId: REQUEST_ID, elapsedMs: 12 },
    deps,
  );
  return { result, calls };
}

test("retry is eligible only for failed sources with zero questions", () => {
  assert.equal(
    isFailedSourceRetryEligible({
      extraction_status: "failed",
      extracted_question_count: 0,
    }),
    true,
  );
  assert.equal(
    canShowRetryExtraction({
      status: "failed",
      savedQuestionCount: 0,
      retryEligible: true,
    }),
    true,
  );
  assert.equal(
    isFailedSourceRetryEligible({
      extraction_status: "partial",
      extracted_question_count: 0,
    }),
    false,
  );
  assert.equal(
    isFailedSourceRetryEligible({
      extraction_status: "failed",
      extracted_question_count: 3,
    }),
    false,
  );
});

test("ineligible sources never reach download, temp, python, or Anthropic", async () => {
  const blocked = [
    {
      name: "completed",
      inspect: { ok: false, status: 409, reason: "status_completed" },
    },
    {
      name: "partial",
      inspect: { ok: false, status: 409, reason: "status_partial" },
    },
    {
      name: "processing",
      inspect: { ok: false, status: 409, reason: "status_processing" },
    },
    {
      name: "archived",
      inspect: { ok: false, status: 409, reason: "status_archived" },
    },
    {
      name: "failed with saved questions",
      inspect: { ok: false, status: 409, reason: "has_questions" },
    },
    {
      name: "failed with linked questions",
      inspect: { ok: false, status: 409, reason: "has_questions" },
    },
    {
      name: "missing object",
      inspect: { ok: false, status: 409, reason: "missing_object" },
    },
    {
      name: "invalid checksum",
      inspect: { ok: false, status: 409, reason: "invalid_checksum" },
    },
    {
      name: "invalid page count",
      inspect: { ok: false, status: 409, reason: "invalid_page_count" },
    },
  ];

  for (const item of blocked) {
    const { result, calls } = await runPipeline({ inspect: item.inspect });
    assert.equal(result.ok, false, item.name);
    assert.equal(result.status, 409, item.name);
    assert.equal(result.claimed, false, item.name);
    assert.equal(result.reason, item.inspect.reason, item.name);
    assert.equal(calls.claim, 0, `${item.name} claimed`);
    assert.equal(calls.download, 0, `${item.name} downloaded`);
    assert.equal(calls.temp, 0, `${item.name} temp`);
    assert.equal(calls.write, 0, `${item.name} write`);
    assert.equal(calls.python, 0, `${item.name} python`);
    assert.equal(calls.extract, 0, `${item.name} extract`);
    assert.equal(calls.anthropic, 0, `${item.name} anthropic`);
    assert.equal(calls.logs[0]?.retryRejectionReason, item.inspect.reason, item.name);
  }
});

test("CAS conflict never reaches download, temp, python, or Anthropic", async () => {
  const { result, calls } = await runPipeline({ claim: { ok: false } });
  assert.equal(result.ok, false);
  assert.equal(result.status, 409);
  assert.equal(result.reason, "conflict");
  assert.equal(result.claimed, false);
  assert.equal(calls.claim, 1);
  assert.equal(calls.download, 0);
  assert.equal(calls.temp, 0);
  assert.equal(calls.python, 0);
  assert.equal(calls.extract, 0);
  assert.equal(calls.anthropic, 0);
});

test("valid failed zero-question source reaches the claim then paid work", async () => {
  const { result, calls } = await runPipeline();
  assert.equal(result.ok, true);
  assert.equal(result.claimed, true);
  assert.equal(result.reason, "claimed");
  assert.equal(calls.inspect, 1);
  assert.equal(calls.claim, 1);
  assert.equal(calls.download, 1);
  assert.equal(calls.temp, 1);
  assert.equal(calls.python, 1);
  assert.equal(calls.extract, 1);
  assert.equal(calls.anthropic, 1);
  assert.equal(canBeginRetryPaidWork(evaluateRetryClaim(ELIGIBLE_CLAIM)), true);
});

test("actual checksum and page-count checks happen only after claim and download", async () => {
  const inspectOnly = evaluateRetryEligibility({
    sourceStatus: "failed",
    extractedCount: 0,
    linkedQuestionCount: 0,
    objectPresent: true,
    storedChecksumValid: true,
    storedPageCountValid: true,
  });
  assert.equal(inspectOnly.ok, true);
  assert.equal(inspectOnly.allowPaidWork, false);

  const badChecksum = await runPipeline({ checksum: "0".repeat(64) });
  assert.equal(badChecksum.result.ok, false);
  assert.equal(badChecksum.result.reason, "checksum_mismatch");
  assert.equal(badChecksum.calls.claim, 1);
  assert.equal(badChecksum.calls.download, 1);
  assert.equal(badChecksum.calls.temp, 0);
  assert.equal(badChecksum.calls.python, 0);
  assert.equal(badChecksum.calls.anthropic, 0);
  assert.equal(badChecksum.calls.markFailed, 1);

  const badPages = await runPipeline({ pageCount: 3 });
  assert.equal(badPages.result.ok, false);
  assert.equal(badPages.result.reason, "page_count_mismatch");
  assert.equal(badPages.calls.claim, 1);
  assert.equal(badPages.calls.download, 1);
  assert.equal(badPages.calls.temp, 1);
  assert.equal(badPages.calls.python, 1);
  assert.equal(badPages.calls.anthropic, 0);
  assert.equal(badPages.calls.markFailed, 1);
});

test("double-click produces one request and hides Retry immediately", () => {
  const source = {
    id: SOURCE_ID,
    retryEligible: true,
    status: "failed",
    savedQuestionCount: 0,
  };
  assert.equal(shouldRenderRetryButton(source), true);

  const lock = createRetryClickLock();
  let requests = 0;
  const click = () => {
    if (!lock.tryAcquire()) return;
    requests += 1;
  };
  click();
  click();
  click();
  assert.equal(requests, 1);

  const afterClick = applyRetryClick({ sources: [source], lockedSourceIds: [] }, SOURCE_ID);
  assert.equal(afterClick.retryingSourceId, SOURCE_ID);
  assert.equal(afterClick.sources[0].retryEligible, false);
  assert.equal(
    shouldRenderRetryButton(afterClick.sources[0], {
      retryingSourceId: afterClick.retryingSourceId,
      lockedSourceIds: afterClick.lockedSourceIds,
    }),
    false,
  );
});

test("completed and partial responses remove Retry after authoritative reload", () => {
  const clicked = applyRetryClick(
    {
      sources: [{
        id: SOURCE_ID,
        retryEligible: true,
        status: "failed",
        savedQuestionCount: 0,
      }],
    },
    SOURCE_ID,
  );
  const completed = applyRetryListReload(clicked, {
    reloaded: true,
    sourceId: SOURCE_ID,
    sources: [{
      id: SOURCE_ID,
      retryEligible: false,
      status: "completed",
      savedQuestionCount: 8,
    }],
  });
  assert.equal(
    shouldRenderRetryButton(completed.sources[0], completed),
    false,
  );

  const partial = applyRetryListReload(clicked, {
    reloaded: true,
    sourceId: SOURCE_ID,
    sources: [{
      id: SOURCE_ID,
      retryEligible: false,
      status: "partial",
      savedQuestionCount: 3,
    }],
  });
  assert.equal(shouldRenderRetryButton(partial.sources[0], partial), false);
});

test("failed response cannot re-enable Retry until an authoritative reload", () => {
  const source = {
    id: SOURCE_ID,
    retryEligible: true,
    status: "failed",
    savedQuestionCount: 0,
  };
  const clicked = applyRetryClick({ sources: [source] }, SOURCE_ID);
  const stale = {
    ...source,
    retryEligible: true,
  };
  const failedReload = applyRetryListReload(clicked, {
    reloaded: false,
    sourceId: SOURCE_ID,
    sources: [stale],
  });
  assert.equal(
    shouldRenderRetryButton(stale, failedReload),
    false,
  );

  const reloaded = applyRetryListReload(clicked, {
    reloaded: true,
    sourceId: SOURCE_ID,
    sources: [source],
  });
  assert.equal(shouldRenderRetryButton(source, reloaded), true);
  assert.equal(
    shouldRenderRetryButton({ ...source, status: "processing" }, reloaded),
    false,
  );
  assert.equal(
    shouldRenderRetryButton({ ...source, status: "archived" }, reloaded),
    false,
  );
  assert.equal(
    shouldRenderRetryButton({ ...source, savedQuestionCount: 2 }, reloaded),
    false,
  );
});

test("upload and retry await extraction before deleting the work directory", () => {
  assert.match(retryRoute, /await runExtractAndPersist/);
  assert.match(uploadRoute, /await runExtractAndPersist/);
  assert.match(retryRun, /await deps\.runExtractAndPersist/);
  assert.doesNotMatch(retryRoute, /return runExtractAndPersist\(/);
  assert.doesNotMatch(uploadRoute, /return runExtractAndPersist\(/);
  assert.ok(
    retryRoute.indexOf("await runExtractAndPersist") <
      retryRoute.lastIndexOf("rm(workDir"),
  );
  assert.ok(
    uploadRoute.indexOf("await runExtractAndPersist") <
      uploadRoute.lastIndexOf("rm(workDir"),
  );
  assert.ok(
    retryRoute.indexOf("await runRetrySpendControl") <
      retryRoute.lastIndexOf("rm(workDir"),
  );
  assert.match(extractRun, /spawnExtractChild/);
});

test("inspect rejects status and questions before object list or download", () => {
  const inspectBody = persistSource.slice(
    persistSource.indexOf("export async function inspectRetryEligibility"),
    persistSource.indexOf("export async function claimFailedSourceForRetry"),
  );
  assert.ok(inspectBody.indexOf("evaluateRetryEligibility") < inspectBody.indexOf("sourcePdfObjectExists"));
  assert.ok(inspectBody.indexOf("if (!statusDecision.ok)") < inspectBody.indexOf("sourcePdfObjectExists"));
  assert.doesNotMatch(inspectBody, /downloadSourcePdfBytes/);
  assert.match(persistSource, /\.list\(sourceId/);
  assert.match(persistSource, /\.eq\("extraction_status", "failed"\)/);
  assert.match(persistSource, /extraction_status:\s*"processing"/);
});

test("retry reuses the same source and does not create a new row or object", () => {
  assert.doesNotMatch(retryRoute, /createProcessingSource|uploadSourcePdf|createSourceId/);
  assert.match(retryRoute, /downloadSourcePdfBytes/);
  assert.match(retryRoute, /await runExtractAndPersist/);
  assert.doesNotMatch(retryRoute, /\.from\(\s*["']questions["']\)/);
  assert.doesNotMatch(retryRoute, /\.from\(\s*["']question_papers["']\)/);
  assert.doesNotMatch(retryRoute, /\.from\(\s*["']generated_pdfs["']\)/);
  assert.match(extractRun, /status: "completed"/);
  assert.match(extractRun, /status: "partial"/);
  assert.match(extractRun, /status: "failed"/);
});

test("UI shows Retry Extraction only for authoritative failed zero-question sources", () => {
  assert.match(pageSource, /shouldRenderRetryButton/);
  assert.match(pageSource, /createRetryClickLock/);
  assert.match(pageSource, /Retry Extraction/);
  assert.match(pageSource, /retryEligible: false/);
  assert.match(pageSource, /listReloaded = \(await fetchList\(\)\) === true/);
  assert.doesNotMatch(pageSource, />Retrying…</);
  assert.match(pageSource, /Retry Extraction/);
  assert.equal(
    shouldRenderRetryButton({
      id: SOURCE_ID,
      retryEligible: true,
      status: "failed",
      savedQuestionCount: 0,
    }),
    true,
  );
  for (const status of ["completed", "partial", "processing", "archived"]) {
    assert.equal(
      shouldRenderRetryButton({
        id: SOURCE_ID,
        retryEligible: true,
        status,
        savedQuestionCount: 0,
      }),
      false,
      status,
    );
  }
  assert.equal(
    shouldRenderRetryButton({
      id: SOURCE_ID,
      retryEligible: true,
      status: "failed",
      savedQuestionCount: 1,
    }),
    false,
  );
  assert.equal(
    shouldRenderRetryButton({
      id: SOURCE_ID,
      retryEligible: false,
      status: "failed",
      savedQuestionCount: 0,
    }),
    false,
  );
});

test("retry rejection logs stay within the safe field set", () => {
  const diagnostic = buildRetryRejectionLog({
    requestId: REQUEST_ID,
    sourceId: SOURCE_ID,
    stage: "retry_claim",
    retryRejectionReason: "status_completed",
    exitCode: 1,
    signalName: "SIGKILL",
    elapsedMs: 40,
    questionText: "should not appear",
    apiKey: "sk-ant-secret",
    privatePath: `source-pdfs/${SOURCE_ID}/original.pdf`,
    stderr: "Traceback",
  });
  const keys = Object.keys(diagnostic).sort();
  assert.deepEqual(keys, [
    "elapsedMs",
    "exitCode",
    "requestId",
    "retryRejectionReason",
    "signalName",
    "sourceId",
    "stage",
  ]);
  const serialized = JSON.stringify(diagnostic);
  assert.equal(diagnostic.retryRejectionReason, "status_completed");
  assert.equal(containsForbiddenLogText(serialized), false);
  assert.doesNotMatch(serialized, /sk-ant|questionText|source-pdfs\/|Traceback/);
  assert.equal(sanitizeRetryRejectionReason("has_questions"), "has_questions");
  assert.equal(sanitizeRetryRejectionReason("What is the value of x?"), null);
  assert.equal(statusRejectionReason("completed"), "status_completed");
  assert.equal(isStoredChecksumValid(CHECKSUM), true);
  assert.equal(isStoredChecksumValid("not-a-checksum"), false);
  assert.equal(isStoredPageCountValid(6), true);
  assert.equal(isStoredPageCountValid(0), false);

  const extractLog = buildExtractionDiagnostic({
    requestId: REQUEST_ID,
    sourceId: SOURCE_ID,
    stage: "retry_claim",
    retryRejectionReason: "conflict",
    questionText: "hidden",
    apiKey: "sk-ant-secret",
  });
  assert.equal(extractLog.retryRejectionReason, "conflict");
  assert.equal("questionText" in extractLog, false);
  assert.equal(sanitizeRpcErrorCategory({ message: "invalid_question_text" }), "invalid_question_text");
});

test("retry route authorizes mutations before any source access", () => {
  const authIndex = retryRoute.indexOf("requireQuestionPaperApiAccess");
  assert.ok(authIndex >= 0);
  assert.ok(authIndex < retryRoute.indexOf("runRetrySpendControl"));
  assert.ok(authIndex < retryRoute.indexOf("inspectRetryEligibility"));
  assert.ok(authIndex < retryRoute.indexOf("claimFailedSourceForRetry"));
  assert.ok(authIndex < retryRoute.indexOf("downloadSourcePdfBytes"));
  assert.match(retryRoute, /mutation:\s*true/);
});
