export const RETRY_FORBIDDEN_STATUSES = Object.freeze([
  "partial",
  "completed",
  "archived",
  "processing",
  "uploaded",
]);

export const RETRY_REJECTION_REASONS = Object.freeze([
  "not_found",
  "status_completed",
  "status_partial",
  "status_processing",
  "status_archived",
  "status_uploaded",
  "retry_not_allowed",
  "has_questions",
  "missing_object",
  "invalid_checksum",
  "invalid_page_count",
  "checksum_mismatch",
  "page_count_mismatch",
  "conflict",
]);

const SHA256_RE = /^[0-9a-f]{64}$/;
const MAX_STORED_PAGE_COUNT = 100;

function reject(reason) {
  return {
    ok: false,
    status: 409,
    reason,
    allowPaidWork: false,
  };
}

export function sanitizeRetryRejectionReason(value) {
  return RETRY_REJECTION_REASONS.includes(value) ? value : null;
}

export function isStoredChecksumValid(value) {
  return typeof value === "string" && SHA256_RE.test(value);
}

export function isStoredPageCountValid(value) {
  const pages = Number(value);
  return Number.isSafeInteger(pages) && pages >= 1 && pages <= MAX_STORED_PAGE_COUNT;
}

export function statusRejectionReason(status) {
  if (status === "completed") return "status_completed";
  if (status === "partial") return "status_partial";
  if (status === "processing") return "status_processing";
  if (status === "archived") return "status_archived";
  if (status === "uploaded") return "status_uploaded";
  return "retry_not_allowed";
}

export function isFailedSourceRetryEligible(source, extras = {}) {
  if (!source || typeof source !== "object") return false;
  if (source.extraction_status !== "failed" && source.status !== "failed") {
    return false;
  }
  const extractedCount = Number(
    source.extracted_question_count ?? source.savedQuestionCount ?? 0,
  );
  if (!Number.isSafeInteger(extractedCount) || extractedCount !== 0) {
    return false;
  }
  if (Number(extras.linkedQuestionCount ?? 0) !== 0) return false;
  if (extras.objectPresent === false) return false;
  if (extras.storedChecksumValid === false) return false;
  if (extras.storedPageCountValid === false) return false;
  if (extras.checksumMatch === false) return false;
  if (extras.pageCountMatch === false) return false;
  if (extras.extractionRunning === true) return false;
  return true;
}

export function evaluateRetryEligibility(input = {}) {
  const status = String(input.sourceStatus ?? "");
  if (status === "processing" || input.extractionRunning === true) {
    return reject("status_processing");
  }
  if (RETRY_FORBIDDEN_STATUSES.includes(status) || status !== "failed") {
    return reject(statusRejectionReason(status));
  }
  if (Number(input.extractedCount ?? 0) !== 0) {
    return reject("has_questions");
  }
  if (Number(input.linkedQuestionCount ?? 0) !== 0) {
    return reject("has_questions");
  }
  if (input.objectPresent === false) {
    return reject("missing_object");
  }
  if (input.storedChecksumValid === false) {
    return reject("invalid_checksum");
  }
  if (input.storedPageCountValid === false) {
    return reject("invalid_page_count");
  }
  if (input.checksumMatch === false) {
    return reject("checksum_mismatch");
  }
  if (input.pageCountMatch === false) {
    return reject("page_count_mismatch");
  }
  return {
    ok: true,
    status: 200,
    reason: "eligible",
    allowPaidWork: false,
  };
}

export function evaluateRetryClaim(input = {}) {
  const eligibility = evaluateRetryEligibility(input);
  if (!eligibility.ok) {
    return eligibility;
  }
  if (Number(input.updatedRows ?? 0) !== 1) {
    return reject("conflict");
  }
  return {
    ok: true,
    status: 200,
    reason: "claimed",
    allowPaidWork: true,
  };
}

export function canBeginRetryPaidWork(decision) {
  return (
    decision?.ok === true &&
    decision?.allowPaidWork === true &&
    decision?.reason === "claimed"
  );
}

export function runRetryIfEligible(decision, paidWork) {
  if (!canBeginRetryPaidWork(decision)) {
    return {
      ok: false,
      status: decision?.status ?? 409,
      reason:
        sanitizeRetryRejectionReason(decision?.reason) ?? "retry_not_allowed",
      paidWorkStarted: false,
    };
  }
  paidWork();
  return {
    ok: true,
    status: 200,
    reason: "claimed",
    paidWorkStarted: true,
  };
}

export function canShowRetryExtraction(source) {
  if (source?.retryEligible === false) return false;
  const status = source?.status ?? source?.extraction_status;
  if (status !== "failed") return false;
  const savedCount = Number(
    source?.savedQuestionCount ?? source?.extracted_question_count ?? 0,
  );
  if (!Number.isSafeInteger(savedCount) || savedCount !== 0) return false;
  return isFailedSourceRetryEligible({
    extraction_status: status,
    extracted_question_count: savedCount,
  });
}

export function shouldRenderRetryButton(source, ui = {}) {
  if (!source) return false;
  if (ui.retryingSourceId === source.id) return false;
  const locked = ui.lockedSourceIds;
  if (locked && (locked.has?.(source.id) || locked.includes?.(source.id))) {
    return false;
  }
  if (source.retryEligible !== true) return false;
  if ((source.status ?? source.extraction_status) !== "failed") return false;
  if (Number(source.savedQuestionCount ?? source.extracted_question_count ?? 0) !== 0) {
    return false;
  }
  return canShowRetryExtraction(source);
}

export function createRetryClickLock() {
  let held = false;
  return {
    tryAcquire() {
      if (held) return false;
      held = true;
      return true;
    },
    release() {
      held = false;
    },
  };
}

export function applyRetryClick(state, sourceId) {
  const locked = new Set(state.lockedSourceIds ?? []);
  locked.add(sourceId);
  return {
    retryingSourceId: sourceId,
    lockedSourceIds: locked,
    sources: (state.sources ?? []).map((source) =>
      source.id === sourceId ? { ...source, retryEligible: false } : source,
    ),
  };
}

export function applyRetryListReload(state, { reloaded, sourceId, sources } = {}) {
  if (!reloaded) {
    return {
      retryingSourceId: null,
      lockedSourceIds: new Set(state.lockedSourceIds ?? []),
      sources: state.sources ?? [],
    };
  }
  const locked = new Set(state.lockedSourceIds ?? []);
  if (sourceId) locked.delete(sourceId);
  return {
    retryingSourceId: null,
    lockedSourceIds: locked,
    sources: sources ?? state.sources ?? [],
  };
}
