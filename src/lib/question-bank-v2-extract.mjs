import { createHash, randomUUID } from "node:crypto";

export const QUESTION_BANK_V2_RESULT_SCHEMA = 1;
export const SOURCE_PDF_BUCKET = "source-pdfs";
export const DIAGRAM_BUCKET = "diagrams";
export const MAX_EXTRACT_RESULT_BYTES = 2 * 1024 * 1024;
export const MAX_QUESTIONS_PER_DOCUMENT = 200;
export const MAX_QUESTIONS_PER_PAGE = 50;
export const ALLOWED_QUESTION_TYPES = Object.freeze(["MCQ", "Short", "Medium", "Long"]);
export const ALLOWED_LANGUAGES = Object.freeze(["en", "te", "mixed"]);
export const ALLOWED_ERROR_CATEGORIES = Object.freeze([
  "timeout",
  "provider",
  "parse",
  "validation",
  "internal",
]);
export const MCQ_LABELS = Object.freeze(["A", "B", "C", "D", "E", "F"]);

const TELUGU_RE = /[\u0C00-\u0C7F]/;
const LATIN_RE = /[A-Za-z]/;
const OPTION_PREFIX_RE = /^[A-Fa-f][\)\].:]\s*/;
const DIAGRAM_PATH_RE =
  /^diagrams\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/;
const SOURCE_PATH_RE =
  /^source-pdfs\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/original\.pdf$/;

export function computePdfSha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function createSourceId() {
  return randomUUID();
}

export function createPersistIdempotencyKey(sourceId) {
  return `persist-${sourceId}`;
}

export function sourceObjectKey(sourceId) {
  return `${sourceId}/original.pdf`;
}

export function sourceStoragePath(sourceId) {
  const path = `${SOURCE_PDF_BUCKET}/${sourceObjectKey(sourceId)}`;
  if (!SOURCE_PATH_RE.test(path)) {
    throw new Error("invalid_source_storage_path");
  }
  return path;
}

export function diagramObjectKey(questionId, assetId) {
  return `${questionId}/${assetId}.png`;
}

export function diagramStoragePath(questionId, assetId) {
  const path = `${DIAGRAM_BUCKET}/${diagramObjectKey(questionId, assetId)}`;
  if (!DIAGRAM_PATH_RE.test(path)) {
    throw new Error("invalid_diagram_storage_path");
  }
  return path;
}

export function isCanonicalSourceStoragePath(sourceId, storedPath) {
  return storedPath === sourceStoragePath(sourceId);
}

export function isCanonicalDiagramStoragePath(questionId, storedPath) {
  return (
    typeof storedPath === "string" &&
    DIAGRAM_PATH_RE.test(storedPath) &&
    storedPath.startsWith(`${DIAGRAM_BUCKET}/${questionId}/`)
  );
}

export function sourceSignedObjectKey(sourceId) {
  return sourceObjectKey(sourceId);
}

export function diagramSignedObjectKey(storedPath) {
  if (typeof storedPath !== "string" || !DIAGRAM_PATH_RE.test(storedPath)) {
    return null;
  }
  return storedPath.slice(`${DIAGRAM_BUCKET}/`.length);
}

export function sanitizeOriginalFilename(name) {
  const base = String(name ?? "")
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    .replace(/[\u0000-\u001F]/g, "")
    .trim();
  if (!base || !/\.pdf$/i.test(base) || /[\\/]/.test(base)) {
    return "upload.pdf";
  }
  return base.slice(0, 255);
}

export function detectLanguage(text) {
  const value = String(text ?? "");
  const hasTelugu = TELUGU_RE.test(value);
  const hasLatin = LATIN_RE.test(value);
  if (hasTelugu && hasLatin) return "mixed";
  if (hasTelugu) return "te";
  return "en";
}

export function normalizeMcqOptions(options) {
  if (!Array.isArray(options) || options.length < 2 || options.length > 6) {
    return null;
  }
  const normalized = [];
  for (let index = 0; index < options.length; index += 1) {
    const item = options[index];
    let label = MCQ_LABELS[index];
    let text = "";
    if (item && typeof item === "object" && !Array.isArray(item)) {
      label = String(item.label ?? "").trim() || label;
      text = String(item.text ?? "").trim();
    } else if (typeof item === "string") {
      text = item.replace(OPTION_PREFIX_RE, "").trim();
    } else {
      return null;
    }
    if (!label || !text || text.length > 2000) return null;
    normalized.push({ label, text });
  }
  return normalized;
}

export function classifyPageError(error) {
  const message = String(error ?? "").toLowerCase();
  if (message.includes("timeout") || message.includes("timed out")) return "timeout";
  if (
    message.includes("overloaded") ||
    message.includes("529") ||
    message.includes("anthropic") ||
    message.includes("provider")
  ) {
    return "provider";
  }
  if (message.includes("json") || message.includes("parse")) return "parse";
  if (message.includes("valid")) return "validation";
  return "internal";
}

function boundedText(value, max) {
  if (value == null) return null;
  const text = String(value);
  if (text.length > max) return null;
  return text;
}

export function normalizeExtractedQuestion(raw, pageNumber, sourceOrder) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "invalid_question_object" };
  }
  const questionText = boundedText(raw.questionText ?? raw.text, 20000);
  if (!questionText || questionText.trim() === "") {
    return { ok: false, reason: "invalid_question_text" };
  }
  const rawExtracted = boundedText(
    raw.rawExtractedText ?? raw.questionText ?? raw.text,
    20000,
  );
  if (rawExtracted == null) {
    return { ok: false, reason: "invalid_raw_extracted_text" };
  }
  let questionType = String(raw.questionType ?? raw.type ?? "").trim();
  if (!ALLOWED_QUESTION_TYPES.includes(questionType)) {
    return { ok: false, reason: "invalid_question_type" };
  }
  const marks = Number.parseInt(String(raw.marks ?? ""), 10);
  if (!Number.isSafeInteger(marks) || marks < 1 || marks > 100) {
    return { ok: false, reason: "invalid_marks" };
  }
  let language = String(raw.language ?? "").trim();
  if (!ALLOWED_LANGUAGES.includes(language)) {
    language = detectLanguage(questionText);
  }
  const sectionRaw = boundedText(raw.sectionLabel ?? raw.section, 200);
  const sectionLabel =
    sectionRaw && sectionRaw.trim() !== "" ? sectionRaw.trim() : null;
  let options = [];
  if (questionType === "MCQ") {
    options = normalizeMcqOptions(raw.options);
    if (!options) return { ok: false, reason: "invalid_mcq_options" };
  }
  const correctAnswer = boundedText(raw.correctAnswer ?? raw.correct_answer, 2000);
  if (pageNumber < 1 || sourceOrder < 1 || sourceOrder > 200) {
    return { ok: false, reason: "invalid_question_position" };
  }
  if (raw.diagram_path || raw.diagramPath || raw.bucket) {
    return { ok: false, reason: "client_supplied_storage_path_not_allowed" };
  }

  const diagramPng =
    typeof raw.diagramPngBase64 === "string" ? raw.diagramPngBase64 : null;
  const diagramDescription =
    typeof raw.diagram === "string" && raw.diagram.trim() !== ""
      ? raw.diagram.trim().slice(0, 2000)
      : null;
  const editableText =
    diagramDescription && !diagramPng
      ? `${questionText}\n\n[Diagram: ${diagramDescription}]`.slice(0, 20000)
      : questionText;

  return {
    ok: true,
    question: {
      source_page_number: pageNumber,
      source_order: sourceOrder,
      question_type: questionType,
      language,
      raw_extracted_text: rawExtracted,
      question_text: editableText,
      options,
      correct_answer: correctAnswer || null,
      marks,
      section_label: sectionLabel,
      diagramPngBase64: diagramPng,
      diagramDescription,
    },
  };
}

export function validateDocumentResult(result, expectedPageCount) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return { ok: false, reason: "invalid_document_result" };
  }
  if (result.schemaVersion !== QUESTION_BANK_V2_RESULT_SCHEMA) {
    return { ok: false, reason: "unsupported_schema_version" };
  }
  if (result.pageCount !== expectedPageCount) {
    return { ok: false, reason: "page_count_mismatch" };
  }
  if (!Array.isArray(result.pages) || result.pages.length !== expectedPageCount) {
    return { ok: false, reason: "missing_page_result" };
  }

  const seen = new Set();
  const pages = [];
  for (const page of result.pages) {
    if (!page || typeof page !== "object") {
      return { ok: false, reason: "invalid_page_result" };
    }
    const pageNumber = Number.parseInt(String(page.pageNumber ?? ""), 10);
    if (
      !Number.isSafeInteger(pageNumber) ||
      pageNumber < 1 ||
      pageNumber > expectedPageCount
    ) {
      return { ok: false, reason: "out_of_range_page_number" };
    }
    if (seen.has(pageNumber)) {
      return { ok: false, reason: "duplicate_page_result" };
    }
    seen.add(pageNumber);
    if (page.status !== "succeeded" && page.status !== "failed") {
      return { ok: false, reason: "invalid_page_status" };
    }
    if (page.status === "failed") {
      if (!ALLOWED_ERROR_CATEGORIES.includes(page.errorCategory)) {
        return { ok: false, reason: "invalid_error_category" };
      }
      pages.push({
        pageNumber,
        status: "failed",
        errorCategory: page.errorCategory,
        questions: [],
      });
      continue;
    }
    if (!Array.isArray(page.questions) || page.questions.length > MAX_QUESTIONS_PER_PAGE) {
      return { ok: false, reason: "invalid_page_questions" };
    }
    pages.push({
      pageNumber,
      status: "succeeded",
      questions: page.questions,
    });
  }

  for (let pageNumber = 1; pageNumber <= expectedPageCount; pageNumber += 1) {
    if (!seen.has(pageNumber)) {
      return { ok: false, reason: "missing_page_result" };
    }
  }

  pages.sort((a, b) => a.pageNumber - b.pageNumber);
  return { ok: true, pages };
}

/**
 * Prefer rejecting the entire page when any question is invalid.
 * The schema tracks failed pages, not per-question extraction warnings.
 */
export function normalizeSucceededPage(page) {
  if (page.status !== "succeeded") {
    return {
      pageNumber: page.pageNumber,
      status: "failed",
      errorCategory: page.errorCategory || "internal",
      questions: [],
    };
  }
  if (!Array.isArray(page.questions) || page.questions.length === 0) {
    return {
      pageNumber: page.pageNumber,
      status: "failed",
      errorCategory: "validation",
      questions: [],
    };
  }

  const questions = [];
  for (let index = 0; index < page.questions.length; index += 1) {
    const normalized = normalizeExtractedQuestion(
      page.questions[index],
      page.pageNumber,
      index + 1,
    );
    if (!normalized.ok) {
      return {
        pageNumber: page.pageNumber,
        status: "failed",
        errorCategory: "validation",
        questions: [],
      };
    }
    questions.push(normalized.question);
  }
  return {
    pageNumber: page.pageNumber,
    status: "succeeded",
    questions,
  };
}

export function buildPersistencePlan(pages) {
  const failedPageNumbers = [];
  const questions = [];
  let processedPageCount = 0;
  const errorCategories = [];

  for (const page of pages) {
    const normalized = normalizeSucceededPage(page);
    if (normalized.status === "failed") {
      failedPageNumbers.push(normalized.pageNumber);
      errorCategories.push(normalized.errorCategory);
      continue;
    }
    processedPageCount += 1;
    questions.push(...normalized.questions);
  }

  if (questions.length > MAX_QUESTIONS_PER_DOCUMENT) {
    return { ok: false, reason: "too_many_questions" };
  }

  let status = "failed";
  if (failedPageNumbers.length === 0 && processedPageCount > 0 && questions.length > 0) {
    status = "completed";
  } else if (questions.length > 0) {
    status = "partial";
  }

  return {
    ok: true,
    status,
    processedPageCount,
    failedPageNumbers,
    questions,
    errorCategory: status === "completed" ? null : errorCategories[0] || "validation",
  };
}

export function toRpcQuestions(questions) {
  return questions.map((question) => ({
    source_page_number: question.source_page_number,
    source_order: question.source_order,
    question_type: question.question_type,
    language: question.language,
    raw_extracted_text: question.raw_extracted_text,
    question_text: question.question_text,
    options: question.options,
    correct_answer: question.correct_answer,
    marks: question.marks,
    section_label: question.section_label,
  }));
}

export function parseValidatePdfPagesStdout(stdout) {
  const value = Number.parseInt(String(stdout ?? "").trim(), 10);
  if (!Number.isSafeInteger(value) || value < 1) return null;
  return value;
}

export function isUniqueViolation(error) {
  return Boolean(error && (error.code === "23505" || error.code === "409"));
}

export function userSafeUploadError(kind) {
  switch (kind) {
    case "duplicate":
      return "This PDF was already uploaded";
    case "partial":
      return "Some pages could not be extracted";
    case "failed":
      return "No questions could be saved from this PDF";
    case "invalid":
      return "The uploaded document could not be processed";
    default:
      return "The request could not be completed";
  }
}

export function containsForbiddenLogText(value, secrets = []) {
  const text = String(value ?? "");
  if (/sk-ant-|ANTHROPIC_API_KEY\s*[:=]/i.test(text)) return true;
  for (const secret of secrets) {
    if (secret && text.includes(secret)) return true;
  }
  return false;
}
