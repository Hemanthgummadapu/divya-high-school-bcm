import {
  canBeginRetryPaidWork,
  evaluateRetryClaim,
} from "./question-bank-v2-retry.mjs";

export async function runRetrySpendControl(input, deps) {
  const inspected = await deps.inspectRetryEligibility(input.sourceId);
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

  const claimedRow = await deps.claimFailedSourceForRetry(input.sourceId);
  const claimDecision = evaluateRetryClaim({
    sourceStatus: inspected.source.extraction_status,
    extractedCount: inspected.source.extracted_question_count,
    linkedQuestionCount: inspected.linkedQuestionCount,
    objectPresent: inspected.objectPresent,
    storedChecksumValid: inspected.storedChecksumValid,
    storedPageCountValid: inspected.storedPageCountValid,
    updatedRows: claimedRow.ok ? 1 : 0,
  });
  if (!canBeginRetryPaidWork(claimDecision)) {
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

  let downloaded;
  try {
    downloaded = await deps.downloadSourcePdfBytes(input.sourceId);
  } catch {
    await deps.markSourceFailed(input.sourceId, "internal");
    return {
      ok: false,
      status: 409,
      reason: "download_failed",
      claimed: true,
    };
  }

  const checksum = deps.computePdfSha256(downloaded);
  if (
    checksum !== inspected.source.content_sha256 ||
    downloaded.byteLength !== inspected.source.byte_size
  ) {
    await deps.markSourceFailed(input.sourceId, "validation");
    return {
      ok: false,
      status: 409,
      reason: "checksum_mismatch",
      claimed: true,
    };
  }

  const workDir = await deps.createTempDir();
  await deps.writeSourcePdf(workDir, downloaded);

  let pageCount;
  try {
    pageCount = await deps.validatePdfPages(workDir);
  } catch {
    await deps.markSourceFailed(input.sourceId, "validation");
    return {
      ok: false,
      status: 422,
      reason: "page_count_mismatch",
      claimed: true,
      workDir,
    };
  }
  if (!pageCount || pageCount !== inspected.source.page_count) {
    await deps.markSourceFailed(input.sourceId, "validation");
    return {
      ok: false,
      status: 409,
      reason: "page_count_mismatch",
      claimed: true,
      workDir,
    };
  }

  const response = await deps.runExtractAndPersist({
    sourceId: input.sourceId,
    workDir,
    pageCount,
    source: inspected.source,
  });
  return {
    ok: true,
    status: 200,
    reason: "claimed",
    claimed: true,
    workDir,
    response,
  };
}
