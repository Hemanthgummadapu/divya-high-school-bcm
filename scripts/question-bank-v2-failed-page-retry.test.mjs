import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRetryClick,
  applyRetryListReload,
  canBeginFailedPageRetryPaidWork,
  canShowRetryExtraction,
  canShowRetryFailedPages,
  createRetryClickLock,
  evaluateFailedPageRetryClaim,
  evaluateFailedPageRetryEligibility,
  evaluateRetryEligibility,
  failedPageRetryLabel,
  failedPageRetryingLabel,
  normalizeFailedPages,
  shouldRenderFailedPageRetryButton,
  shouldRenderRetryButton,
} from "../src/lib/question-bank-v2-retry.mjs";
import { runFailedPageRetrySpendControl } from "../src/lib/question-bank-v2-failed-page-retry-run.mjs";
import { runRetrySpendControl } from "../src/lib/question-bank-v2-retry-run.mjs";
import { publicSource } from "../src/lib/question-bank-v2-review.mjs";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const failedPageRoute = readFileSync(
  join(root, "src/app/api/question-papers/[id]/retry-failed-pages/route.ts"),
  "utf8",
);
const fullRetryRoute = readFileSync(
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
const extractPy = readFileSync(join(root, "scripts/extract_pdf.py"), "utf8");
const migration = readFileSync(
  join(root, "supabase/migrations/20260818000000_persist_recovered_failed_pages.sql"),
  "utf8",
);

const SOURCE_ID = "4b04d3ce-632b-45f5-a6a4-939ee69c37c8";
const REQUEST_ID = "11111111-1111-1111-1111-111111111111";
const CHECKSUM = "872134ec1ab2a6312e6b434e390c27933cafab52b6c60f7553d1bcc43926aec7";

const PRODUCTION_PARTIAL = {
  id: SOURCE_ID,
  extraction_status: "partial",
  extracted_question_count: 31,
  failed_page_numbers: [1],
  page_count: 6,
  content_sha256: CHECKSUM,
  byte_size: 9,
  subject: "Mathematics",
  grade: 10,
  academic_year: 2026,
};

const ELIGIBLE_INSPECT = {
  ok: true,
  source: PRODUCTION_PARTIAL,
  failedPages: [1],
  linkedQuestionCount: 31,
  questionsOnFailedPages: 0,
  objectPresent: true,
  storedChecksumValid: true,
  storedPageCountValid: true,
};

function publicPartial(overrides = {}) {
  return publicSource({
    id: SOURCE_ID,
    original_filename: "exam.pdf",
    display_name: "exam",
    grade: 10,
    subject: "Mathematics",
    academic_year: 2026,
    page_count: 6,
    extraction_status: "partial",
    processed_page_count: 5,
    failed_page_numbers: [1],
    extracted_question_count: 31,
    created_at: new Date().toISOString(),
    ...overrides,
  });
}

function createFailedPageSpies(overrides = {}) {
  const calls = {
    inspect: 0,
    claim: 0,
    download: 0,
    temp: 0,
    write: 0,
    python: 0,
    extract: 0,
    anthropic: 0,
    restore: 0,
    selectedPages: null,
    logs: [],
  };
  const bytes = Buffer.from("pdf-bytes");
  const deps = {
    inspectFailedPageRetryEligibility: async () => {
      calls.inspect += 1;
      return overrides.inspect ?? ELIGIBLE_INSPECT;
    },
    claimPartialSourceForFailedPageRetry: async () => {
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
      return "/tmp/qb-failed-page-retry-test";
    },
    writeSourcePdf: async () => {
      calls.write += 1;
    },
    validatePdfPages: async () => {
      calls.python += 1;
      if (overrides.pageError) throw new Error("pages");
      return overrides.pageCount ?? 6;
    },
    runFailedPageExtractAndPersist: async (input) => {
      calls.extract += 1;
      calls.anthropic += 1;
      calls.selectedPages = input.selectedPages;
      return { success: true, status: "completed" };
    },
    restorePartialSource: async () => {
      calls.restore += 1;
    },
    logRetryRejection: (entry) => {
      calls.logs.push(entry);
    },
  };
  return { calls, deps };
}

async function runFailedPagePipeline(overrides = {}) {
  const { calls, deps } = createFailedPageSpies(overrides);
  const result = await runFailedPageRetrySpendControl(
    { sourceId: SOURCE_ID, requestId: REQUEST_ID, elapsedMs: 12 },
    deps,
  );
  return { result, calls };
}

test("1. failed + zero questions shows full Retry Extraction", () => {
  const source = {
    id: SOURCE_ID,
    retryEligible: true,
    failedPageRetryEligible: false,
    status: "failed",
    savedQuestionCount: 0,
    failedPages: [1, 2],
    pageCount: 6,
  };
  assert.equal(canShowRetryExtraction(source), true);
  assert.equal(shouldRenderRetryButton(source), true);
  assert.equal(shouldRenderFailedPageRetryButton(source), false);
});

test("2. partial + failed pages shows failed-page retry", () => {
  const source = publicPartial();
  assert.equal(source.failedPageRetryEligible, true);
  assert.equal(shouldRenderFailedPageRetryButton(source), true);
  assert.equal(shouldRenderRetryButton(source), false);
  assert.equal(failedPageRetryLabel(source.failedPages), "Retry failed page 1");
  assert.equal(failedPageRetryLabel([1, 3, 5]), "Retry 3 failed pages");
});

test("3. completed never shows retry", () => {
  const source = publicPartial({
    extraction_status: "completed",
    failed_page_numbers: [],
    processed_page_count: 6,
  });
  assert.equal(shouldRenderRetryButton(source), false);
  assert.equal(shouldRenderFailedPageRetryButton(source), false);
});

test("4. processing never shows retry", () => {
  const source = publicPartial({ extraction_status: "processing" });
  assert.equal(shouldRenderRetryButton(source), false);
  assert.equal(shouldRenderFailedPageRetryButton(source), false);
});

test("5. partial with no failed pages never shows retry", () => {
  const source = publicPartial({
    failed_page_numbers: [],
    processed_page_count: 6,
  });
  assert.equal(canShowRetryFailedPages(source), false);
  assert.equal(shouldRenderFailedPageRetryButton(source), false);
});

test("6. full retry never accepts a partial source", () => {
  const decision = evaluateRetryEligibility({
    sourceStatus: "partial",
    extractedCount: 31,
    linkedQuestionCount: 31,
  });
  assert.equal(decision.ok, false);
  assert.equal(decision.reason, "status_partial");
  assert.equal(decision.allowPaidWork, false);
});

test("7. partial retry never accepts a completed or fully failed source", () => {
  assert.equal(
    evaluateFailedPageRetryEligibility({
      sourceStatus: "completed",
      extractedCount: 31,
      linkedQuestionCount: 31,
      failedPages: [],
      pageCount: 6,
    }).reason,
    "status_completed",
  );
  assert.equal(
    evaluateFailedPageRetryEligibility({
      sourceStatus: "failed",
      extractedCount: 0,
      linkedQuestionCount: 0,
      failedPages: [1],
      pageCount: 6,
    }).reason,
    "status_failed",
  );
});

test("8. browser cannot choose arbitrary page numbers", () => {
  assert.doesNotMatch(failedPageRoute, /await request\.json/);
  assert.doesNotMatch(failedPageRoute, /selectedPages\s*=\s*body/);
  assert.match(failedPageRoute, /inspectFailedPageRetryEligibility/);
  assert.match(failedPageRoute, /Page numbers are loaded from the database/);
  assert.match(persistSource, /failedPages: failedPages \?\? eligibility\.failedPages/);
});

test("9. ineligible requests cannot download, create temp files, spawn Python or call Anthropic", async () => {
  const blocked = [
    { name: "completed", inspect: { ok: false, status: 409, reason: "status_completed" } },
    { name: "failed", inspect: { ok: false, status: 409, reason: "status_failed" } },
    { name: "processing", inspect: { ok: false, status: 409, reason: "status_processing" } },
    { name: "no questions", inspect: { ok: false, status: 409, reason: "no_saved_questions" } },
    { name: "empty failed pages", inspect: { ok: false, status: 409, reason: "empty_failed_pages" } },
    {
      name: "questions on failed pages",
      inspect: { ok: false, status: 409, reason: "questions_on_failed_pages" },
    },
    { name: "missing object", inspect: { ok: false, status: 409, reason: "missing_object" } },
  ];
  for (const item of blocked) {
    const { result, calls } = await runFailedPagePipeline({ inspect: item.inspect });
    assert.equal(result.ok, false, item.name);
    assert.equal(result.claimed, false, item.name);
    assert.equal(calls.claim, 0, item.name);
    assert.equal(calls.download, 0, item.name);
    assert.equal(calls.temp, 0, item.name);
    assert.equal(calls.python, 0, item.name);
    assert.equal(calls.extract, 0, item.name);
    assert.equal(calls.anthropic, 0, item.name);
  }
});

test("10-11. current [1] case passes only page 1 and never pages 2-6", async () => {
  const { result, calls } = await runFailedPagePipeline();
  assert.equal(result.ok, true);
  assert.deepEqual(result.selectedPages, [1]);
  assert.deepEqual(calls.selectedPages, [1]);
  assert.equal(calls.extract, 1);
  assert.equal(calls.anthropic, 1);
  assert.match(extractRun, /args\.push\("--pages", selectedPages\.join\(","\)\)/);
  assert.match(extractPy, /_extract_selected_pages/);
  assert.match(failedPageRoute, /selectedPages/);
  assert.match(failedPageRoute, /recoveryMode:\s*true/);
  assert.equal(normalizeFailedPages([1], 6).join(","), "1");
});

test("12. existing questions and approvals remain unchanged", () => {
  assert.match(migration, /INSERT INTO public\.question_bank_questions/);
  assert.doesNotMatch(
    migration.replace(/INSERT INTO public\.question_bank_questions[\s\S]*?;/, ""),
    /UPDATE public\.question_bank_questions/,
  );
  assert.doesNotMatch(migration, /DELETE FROM public\.question_bank_questions/);
  assert.match(persistSource, /extraction_status:\s*"processing"/);
  assert.doesNotMatch(
    persistSource.slice(
      persistSource.indexOf("claimPartialSourceForFailedPageRetry"),
      persistSource.indexOf("restorePartialSource"),
    ),
    /failed_page_numbers:\s*\[\]/,
  );
});

test("13. recovered questions cannot duplicate page/order positions", () => {
  assert.match(migration, /duplicate_question_position/);
  assert.match(migration, /existing\.source_page_number = question_page_number/);
  assert.match(migration, /existing\.source_order = question_source_order/);
});

test("14. concurrent retries result in one successful claim and one 409", async () => {
  const first = await runFailedPagePipeline();
  assert.equal(first.result.ok, true);
  assert.equal(first.result.claimed, true);
  const second = await runFailedPagePipeline({ claim: { ok: false } });
  assert.equal(second.result.ok, false);
  assert.equal(second.result.status, 409);
  assert.equal(second.result.reason, "conflict");
  assert.equal(second.result.claimed, false);
  assert.equal(second.calls.download, 0);
  assert.equal(second.calls.anthropic, 0);
  assert.equal(
    canBeginFailedPageRetryPaidWork(
      evaluateFailedPageRetryClaim({
        sourceStatus: "partial",
        extractedCount: 31,
        linkedQuestionCount: 31,
        failedPages: [1],
        pageCount: 6,
        questionsOnFailedPages: 0,
        objectPresent: true,
        storedChecksumValid: true,
        storedPageCountValid: true,
        updatedRows: 0,
      }),
    ),
    false,
  );
});

test("15. extraction failure restores partial", async () => {
  const { result, calls } = await runFailedPagePipeline({ downloadError: true });
  assert.equal(result.ok, false);
  assert.equal(result.claimed, true);
  assert.equal(calls.restore, 1);
  assert.equal(calls.temp, 0);
  assert.equal(calls.anthropic, 0);
  assert.match(persistSource, /extraction_status:\s*"partial"/);
  assert.match(failedPageRoute, /restorePartialSource/);
  assert.doesNotMatch(failedPageRoute, /markSourceFailed/);
});

test("16-17. recovered page status and failed-again pages stay honest", () => {
  assert.match(migration, /new_status := 'completed'/);
  assert.match(migration, /new_status := 'partial'/);
  assert.match(migration, /remaining_failed/);
  assert.match(migration, /extracted_question_count = extracted_count/);
  assert.match(migration, /processed_page_count = processed_count/);
  assert.match(
    migration,
    /NOT EXISTS \(\s*SELECT 1\s*FROM public\.question_bank_questions recovered/,
  );
});

test("18. anonymous and untrusted-origin calls are rejected before paid work", () => {
  const authIndex = failedPageRoute.indexOf("requireQuestionPaperApiAccess");
  assert.ok(authIndex >= 0);
  assert.ok(authIndex < failedPageRoute.indexOf("runFailedPageRetrySpendControl"));
  assert.ok(authIndex < failedPageRoute.indexOf("inspectFailedPageRetryEligibility"));
  assert.ok(authIndex < failedPageRoute.indexOf("downloadSourcePdfBytes"));
  assert.match(failedPageRoute, /mutation:\s*true/);
  assert.ok(
    fullRetryRoute.indexOf("requireQuestionPaperApiAccess") <
      fullRetryRoute.indexOf("runRetrySpendControl"),
  );
});

test("19. no legacy tables are written", () => {
  assert.doesNotMatch(failedPageRoute, /\.from\(\s*["']questions["']\)/);
  assert.doesNotMatch(failedPageRoute, /\.from\(\s*["']question_papers["']\)/);
  assert.doesNotMatch(failedPageRoute, /\.from\(\s*["']generated_pdfs["']\)/);
  assert.doesNotMatch(persistSource, /\.from\(\s*["']questions["']\)/);
  assert.doesNotMatch(persistSource, /\.from\(\s*["']question_papers["']\)/);
  assert.doesNotMatch(persistSource, /\.from\(\s*["']generated_pdfs["']\)/);
  assert.doesNotMatch(migration, /\b(public\.)?(question_papers|generated_pdfs)\b/);
  assert.doesNotMatch(migration, /FROM public\.questions|INTO public\.questions/);
});

test("20. new RPC has correct grants and remains SECURITY INVOKER", () => {
  assert.match(migration, /SECURITY INVOKER/);
  assert.doesNotMatch(migration, /SECURITY DEFINER/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.persist_recovered_failed_pages/);
  assert.match(migration, /FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.persist_recovered_failed_pages/);
  assert.match(migration, /TO service_role/);
  assert.match(migration, /current_user IS DISTINCT FROM 'service_role'/);
});

test("inconsistent failed source with linked questions never shows full retry", () => {
  const source = {
    id: SOURCE_ID,
    retryEligible: false,
    failedPageRetryEligible: false,
    status: "failed",
    savedQuestionCount: 31,
    failedPages: [1],
    pageCount: 6,
  };
  assert.equal(shouldRenderRetryButton(source), false);
  assert.equal(canShowRetryExtraction(source), false);
});

test("failed-page retry UI hides immediately and reappears only after reload", () => {
  const source = publicPartial();
  assert.equal(shouldRenderFailedPageRetryButton(source), true);
  const lock = createRetryClickLock();
  let requests = 0;
  const click = () => {
    if (!lock.tryAcquire()) return;
    requests += 1;
  };
  click();
  click();
  assert.equal(requests, 1);

  const afterClick = applyRetryClick({ sources: [source], lockedSourceIds: [] }, SOURCE_ID);
  assert.equal(afterClick.sources[0].failedPageRetryEligible, false);
  assert.equal(
    shouldRenderFailedPageRetryButton(afterClick.sources[0], afterClick),
    false,
  );
  assert.equal(failedPageRetryingLabel([1]), "Retrying failed page…");
  assert.equal(failedPageRetryingLabel([1, 2, 3]), "Retrying 3 failed pages…");

  const failedReload = applyRetryListReload(afterClick, {
    reloaded: false,
    sourceId: SOURCE_ID,
    sources: [source],
  });
  assert.equal(
    shouldRenderFailedPageRetryButton(source, failedReload),
    false,
  );

  const completed = applyRetryListReload(afterClick, {
    reloaded: true,
    sourceId: SOURCE_ID,
    sources: [publicPartial({
      extraction_status: "completed",
      failed_page_numbers: [],
      extracted_question_count: 36,
    })],
  });
  assert.equal(shouldRenderFailedPageRetryButton(completed.sources[0], completed), false);

  const stillPartial = applyRetryListReload(afterClick, {
    reloaded: true,
    sourceId: SOURCE_ID,
    sources: [publicPartial({ failed_page_numbers: [1, 4] })],
  });
  assert.equal(
    shouldRenderFailedPageRetryButton(stillPartial.sources[0], stillPartial),
    true,
  );
  assert.equal(failedPageRetryLabel([1, 4]), "Retry 2 failed pages");
});

test("Sources card wires the separate retry routes and helper text", () => {
  assert.match(pageSource, /shouldRenderFailedPageRetryButton/);
  assert.match(pageSource, /handleRetryFailedPages/);
  assert.match(pageSource, /retry-failed-pages/);
  assert.match(pageSource, /failedPageRetryLabel\(source\.failedPages\)/);
  assert.match(
    pageSource,
    /Only failed pages are rescanned\. Previously saved\s+questions are kept\./,
  );
  assert.match(pageSource, /failedPageRetryingLabel/);
  assert.doesNotMatch(pageSource, /automatically retry|setInterval.*retry/i);
});

test("inspect rejects status and questions before object list or download", () => {
  const inspectBody = persistSource.slice(
    persistSource.indexOf("export async function inspectFailedPageRetryEligibility"),
    persistSource.indexOf("export async function claimPartialSourceForFailedPageRetry"),
  );
  assert.ok(inspectBody.indexOf("evaluateFailedPageRetryEligibility") < inspectBody.indexOf("sourcePdfObjectExists"));
  assert.ok(inspectBody.indexOf("if (!statusDecision.ok)") < inspectBody.indexOf("sourcePdfObjectExists"));
  assert.doesNotMatch(inspectBody, /downloadSourcePdfBytes/);
  assert.match(persistSource, /\.eq\("extraction_status", "partial"\)/);
});

test("full retry spend-control still rejects the production partial source", async () => {
  const result = await runRetrySpendControl(
    { sourceId: SOURCE_ID, requestId: REQUEST_ID, elapsedMs: 1 },
    {
      inspectRetryEligibility: async () => ({
        ok: false,
        status: 409,
        reason: "status_partial",
      }),
      claimFailedSourceForRetry: async () => {
        throw new Error("should not claim");
      },
      downloadSourcePdfBytes: async () => {
        throw new Error("should not download");
      },
      computePdfSha256: () => CHECKSUM,
      createTempDir: async () => {
        throw new Error("should not temp");
      },
      writeSourcePdf: async () => {},
      validatePdfPages: async () => 6,
      runExtractAndPersist: async () => {
        throw new Error("should not extract");
      },
      markSourceFailed: async () => {},
      logRetryRejection: () => {},
    },
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, "status_partial");
  assert.equal(result.claimed, false);
});
