import {
  canBeginFailedPageRetryPaidWork,
  evaluateFailedPageRetryClaim,
} from "./question-bank-v2-retry.mjs";

export async function runFailedPageRetrySpendControl(input, deps) {
  const inspected = await deps.inspectFailedPageRetryEligibility(input.sourceId);
  if (!inspected.ok) {
    deps.logRetryRejection({
      requestId: input.requestId,
      sourceId: input.sourceId,
      stage: "retry_claim",
      retryRejectionReason: inspected.reason,
      elapsedMs: input.elapsedMs,
    });
    return {
      ok: false,
      status: inspected.status,
      reason: inspected.reason,
      claimed: false,
    };
  }

  if (deps.isAnthropicConfigured && !deps.isAnthropicConfigured()) {
    return {
      ok: false,
      status: 500,
      reason: "provider",
      claimed: false,
    };
  }

  const claimedRow = await deps.claimPartialSourceForFailedPageRetry(input.sourceId);
  const claimDecision = evaluateFailedPageRetryClaim({
    sourceStatus: inspected.source.extraction_status,
    extractedCount: inspected.source.extracted_question_count,
    linkedQuestionCount: inspected.linkedQuestionCount,
    failedPages: inspected.failedPages,
    pageCount: inspected.source.page_count,
    questionsOnFailedPages: inspected.questionsOnFailedPages,
    objectPresent: inspected.objectPresent,
    storedChecksumValid: inspected.storedChecksumValid,
    storedPageCountValid: inspected.storedPageCountValid,
    updatedRows: claimedRow.ok ? 1 : 0,
  });
  if (!canBeginFailedPageRetryPaidWork(claimDecision)) {
    deps.logRetryRejection({
      requestId: input.requestId,
      sourceId: input.sourceId,
      stage: "retry_claim",
      retryRejectionReason: claimDecision.reason,
      elapsedMs: input.elapsedMs,
    });
    return {
      ok: false,
      status: 409,
      reason: claimDecision.reason,
      claimed: false,
    };
  }

  const selectedPages = inspected.failedPages;

  let downloaded;
  try {
    downloaded = await deps.downloadSourcePdfBytes(input.sourceId);
  } catch {
    await deps.restorePartialSource(input.sourceId, "internal");
    return {
      ok: false,
      status: 409,
      reason: "download_failed",
      claimed: true,
      selectedPages,
    };
  }

  const checksum = deps.computePdfSha256(downloaded);
  if (
    checksum !== inspected.source.content_sha256 ||
    downloaded.byteLength !== inspected.source.byte_size
  ) {
    await deps.restorePartialSource(input.sourceId, "validation");
    return {
      ok: false,
      status: 409,
      reason: "checksum_mismatch",
      claimed: true,
      selectedPages,
    };
  }

  const workDir = await deps.createTempDir();
  await deps.writeSourcePdf(workDir, downloaded);

  let pageCount;
  try {
    pageCount = await deps.validatePdfPages(workDir);
  } catch {
    await deps.restorePartialSource(input.sourceId, "validation");
    return {
      ok: false,
      status: 422,
      reason: "page_count_mismatch",
      claimed: true,
      workDir,
      selectedPages,
    };
  }
  if (!pageCount || pageCount !== inspected.source.page_count) {
    await deps.restorePartialSource(input.sourceId, "validation");
    return {
      ok: false,
      status: 409,
      reason: "page_count_mismatch",
      claimed: true,
      workDir,
      selectedPages,
    };
  }

  const response = await deps.runFailedPageExtractAndPersist({
    sourceId: input.sourceId,
    workDir,
    pageCount,
    source: inspected.source,
    selectedPages,
  });
  return {
    ok: true,
    status: 200,
    reason: "claimed",
    claimed: true,
    workDir,
    selectedPages,
    response,
  };
}
