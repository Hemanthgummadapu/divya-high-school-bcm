export const RETRY_FORBIDDEN_STATUSES = Object.freeze([
  "partial",
  "completed",
  "archived",
  "processing",
  "uploaded",
]);

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
  if (extras.checksumMatch === false) return false;
  if (extras.pageCountMatch === false) return false;
  return true;
}

export function evaluateRetryClaim(input = {}) {
  const status = String(input.sourceStatus ?? "");
  if (RETRY_FORBIDDEN_STATUSES.includes(status)) {
    return { ok: false, status: 409, reason: "retry_not_allowed" };
  }
  if (status !== "failed") {
    return { ok: false, status: 409, reason: "retry_not_allowed" };
  }
  if (Number(input.extractedCount ?? 0) !== 0) {
    return { ok: false, status: 409, reason: "has_questions" };
  }
  if (Number(input.linkedQuestionCount ?? 0) !== 0) {
    return { ok: false, status: 409, reason: "has_questions" };
  }
  if (input.objectPresent === false) {
    return { ok: false, status: 409, reason: "missing_object" };
  }
  if (input.checksumMatch === false) {
    return { ok: false, status: 409, reason: "checksum_mismatch" };
  }
  if (input.pageCountMatch === false) {
    return { ok: false, status: 409, reason: "page_count_mismatch" };
  }
  if (Number(input.updatedRows ?? 0) !== 1) {
    return { ok: false, status: 409, reason: "conflict" };
  }
  return { ok: true, status: 200, reason: "claimed" };
}

export function canShowRetryExtraction(source) {
  return isFailedSourceRetryEligible({
    extraction_status: source?.status ?? source?.extraction_status,
    extracted_question_count:
      source?.savedQuestionCount ?? source?.extracted_question_count,
  });
}
