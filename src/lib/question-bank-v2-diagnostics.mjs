import { ALLOWED_ERROR_CATEGORIES } from "./question-bank-v2-extract.mjs";
import {
  sanitizeExitCode,
  sanitizePythonClassification,
  sanitizeSignalName,
} from "./question-bank-v2-python-child.mjs";
import { sanitizeRetryRejectionReason } from "./question-bank-v2-retry.mjs";

export const EXTRACTION_STAGES = Object.freeze([
  "authorization",
  "request_validation",
  "pdf_validation",
  "storage_upload",
  "source_row_creation",
  "python_spawn",
  "pdf_rendering",
  "anthropic_request",
  "provider_response",
  "json_parsing",
  "node_normalization",
  "persistence_rpc",
  "failed_source_update",
  "retry_claim",
  "source_download",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const KNOWN_RPC_EXCEPTIONS = Object.freeze([
  "invalid_idempotency_key",
  "questions_must_be_array",
  "too_many_questions",
  "invalid_processed_page_count",
  "invalid_error_category",
  "source_not_found",
  "idempotency_key_payload_mismatch",
  "source_already_persisted",
  "invalid_failed_page_numbers",
  "completed_source_cannot_include_failed_pages",
  "invalid_question_object",
  "invalid_source_page_number",
  "invalid_source_order",
  "duplicate_question_position",
  "invalid_question_type",
  "invalid_language",
  "invalid_marks",
  "invalid_question_text",
  "invalid_raw_extracted_text",
  "client_supplied_storage_path_not_allowed",
  "invalid_mcq_options",
  "persist_rpc_failed",
]);

export function sanitizeRequestId(value) {
  const text = String(value ?? "").trim();
  return UUID_RE.test(text) ? text : null;
}

export function sanitizeSourceId(value) {
  const text = String(value ?? "").trim();
  return UUID_RE.test(text) ? text : null;
}

export function sanitizeStage(value) {
  return EXTRACTION_STAGES.includes(value) ? value : "unknown";
}

export function sanitizePageNumber(value) {
  const page = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100) return null;
  return page;
}

export function sanitizeErrorCategory(value) {
  if (value == null || value === "") return null;
  return ALLOWED_ERROR_CATEGORIES.includes(value) ? value : "internal";
}

export function sanitizeHttpStatusClass(value) {
  const status = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isSafeInteger(status) || status < 100 || status > 599) return null;
  return `${Math.floor(status / 100)}xx`;
}

export function sanitizeElapsedMs(value) {
  const elapsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isSafeInteger(elapsed) || elapsed < 0 || elapsed > 3_600_000) {
    return null;
  }
  return elapsed;
}

export function sanitizeRpcErrorCategory(error) {
  const message = String(error?.message ?? error ?? "");
  const matched = KNOWN_RPC_EXCEPTIONS.find((name) => message.includes(name));
  if (matched) return matched;
  const code = String(error?.code ?? "");
  if (code === "57014") return "timeout";
  if (code === "42702") return "ambiguous_column";
  if (code === "08006" || code === "08001" || code === "57P01") return "connection";
  if (/^PGRST/i.test(code)) return "rpc_error";
  return "rpc_error";
}

export function buildExtractionDiagnostic(input = {}) {
  return {
    requestId: sanitizeRequestId(input.requestId),
    sourceId: sanitizeSourceId(input.sourceId),
    stage: sanitizeStage(input.stage),
    pageNumber: sanitizePageNumber(input.pageNumber),
    errorCategory: sanitizeErrorCategory(input.errorCategory),
    classification: sanitizePythonClassification(input.classification),
    retryRejectionReason: sanitizeRetryRejectionReason(input.retryRejectionReason),
    exitCode: sanitizeExitCode(input.exitCode),
    signalName: sanitizeSignalName(input.signalName),
    providerHttpStatusClass: sanitizeHttpStatusClass(input.providerHttpStatusClass),
    elapsedMs: sanitizeElapsedMs(input.elapsedMs),
  };
}

export function buildRetryRejectionLog(input = {}) {
  return {
    requestId: sanitizeRequestId(input.requestId),
    sourceId: sanitizeSourceId(input.sourceId),
    stage: sanitizeStage(input.stage),
    retryRejectionReason: sanitizeRetryRejectionReason(input.retryRejectionReason),
    exitCode: sanitizeExitCode(input.exitCode),
    signalName: sanitizeSignalName(input.signalName),
    elapsedMs: sanitizeElapsedMs(input.elapsedMs),
  };
}

export function logRetryRejection(input = {}) {
  const diagnostic = buildRetryRejectionLog(input);
  console.warn("[question-paper-extract]", diagnostic);
  return diagnostic;
}

export function logExtractionStage(input = {}) {
  const diagnostic = buildExtractionDiagnostic(input);
  console.warn("[question-paper-extract]", diagnostic);
  return diagnostic;
}
