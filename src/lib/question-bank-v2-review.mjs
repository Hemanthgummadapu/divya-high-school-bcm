import {
  ALLOWED_LANGUAGES,
  ALLOWED_QUESTION_TYPES,
  detectLanguage,
  isCanonicalDiagramStoragePath,
  isCanonicalSourceStoragePath,
  normalizeMcqOptions,
} from "./question-bank-v2-extract.mjs";
import { isSupportedSubject, isValidSubjectForGrade } from "./subjects.mjs";
import {
  canShowRetryExtraction,
  canShowRetryFailedPages,
} from "./question-bank-v2-retry.mjs";
import {
  PROCESSING_STALE_MS,
  formatFailedPages,
  isProcessingStale,
  sourceStatusLabel,
  uploadResultMessage,
} from "./question-bank-v2-review-ui.mjs";

export {
  PROCESSING_STALE_MS,
  formatFailedPages,
  isProcessingStale,
  sourceStatusLabel,
  uploadResultMessage,
};

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_SEARCH_LENGTH = 200;
export const SIGNED_URL_TTL_SECONDS = 60 * 60;
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ALLOWED_SOURCE_STATUSES = Object.freeze([
  "uploaded",
  "processing",
  "completed",
  "partial",
  "failed",
  "archived",
]);

export const FORBIDDEN_QUESTION_PATCH_KEYS = Object.freeze([
  "rawExtractedText",
  "raw_extracted_text",
  "sourceId",
  "source_id",
  "sourcePageNumber",
  "source_page_number",
  "sourceOrder",
  "source_order",
  "grade",
  "subject",
  "academicYear",
  "year",
]);

export const ALLOWED_REVIEW_STATUSES = Object.freeze([
  "needs_review",
  "approved",
  "rejected",
  "archived",
]);

export const ALLOWED_STATUS_TRANSITIONS = Object.freeze({
  needs_review: Object.freeze(["approved", "rejected"]),
  rejected: Object.freeze(["needs_review"]),
  approved: Object.freeze(["archived"]),
  archived: Object.freeze(["needs_review"]),
});

export const STATUS_ACTIONS = Object.freeze({
  save: null,
  approve: "approved",
  reject: "rejected",
  restore: "needs_review",
  archive: "archived",
});

export function parsePositiveInt(value, fallback = null) {
  if (value == null || value === "") return fallback;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(parsed)) return null;
  return parsed;
}

export function parseListQuery(searchParams) {
  const view = String(searchParams.get("view") || "bank");
  if (!["bank", "review", "sources", "saved"].includes(view)) {
    return { ok: false, status: 400, error: "Invalid view" };
  }

  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(
    searchParams.get("pageSize"),
    DEFAULT_PAGE_SIZE,
  );
  if (page == null || page < 1) {
    return { ok: false, status: 400, error: "Invalid page" };
  }
  if (pageSize == null || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    return { ok: false, status: 400, error: "Invalid page size" };
  }

  const search = String(searchParams.get("q") || "").trim();
  if (search.length > MAX_SEARCH_LENGTH) {
    return { ok: false, status: 400, error: "Search text is too long" };
  }

  const grade = parsePositiveInt(searchParams.get("grade"), null);
  if (searchParams.get("grade") && (grade == null || grade < 1 || grade > 10)) {
    return { ok: false, status: 400, error: "Invalid grade" };
  }

  const subjectFilter = String(searchParams.get("subject") || "").trim();
  if (subjectFilter) {
    if (!isSupportedSubject(subjectFilter)) {
      return { ok: false, status: 400, error: "Invalid subject" };
    }
    if (grade != null && !isValidSubjectForGrade(subjectFilter, grade)) {
      return { ok: false, status: 400, error: "Invalid subject for the selected grade" };
    }
  }

  const year = parsePositiveInt(searchParams.get("year"), null);
  if (
    searchParams.get("year") &&
    (year == null || year < 2000 || year > 2100)
  ) {
    return { ok: false, status: 400, error: "Invalid academic year" };
  }

  const type = searchParams.get("type") || "";
  if (type && !ALLOWED_QUESTION_TYPES.includes(type)) {
    return { ok: false, status: 400, error: "Invalid question type" };
  }

  const marks = parsePositiveInt(searchParams.get("marks"), null);
  if (
    searchParams.get("marks") &&
    (marks == null || marks < 1 || marks > 100)
  ) {
    return { ok: false, status: 400, error: "Invalid marks" };
  }

  const requestedStatus = searchParams.get("status") || "";
  if (view === "sources") {
    if (requestedStatus && !ALLOWED_SOURCE_STATUSES.includes(requestedStatus)) {
      return { ok: false, status: 400, error: "Invalid status" };
    }
  } else if (view === "saved") {
    if (
      requestedStatus &&
      !["draft", "final", "archived"].includes(requestedStatus)
    ) {
      return { ok: false, status: 400, error: "Invalid status" };
    }
  } else if (requestedStatus && !ALLOWED_REVIEW_STATUSES.includes(requestedStatus)) {
    return { ok: false, status: 400, error: "Invalid status" };
  }

  const sourceId = searchParams.get("sourceId") || "";
  if (sourceId && !UUID_RE.test(sourceId)) {
    return { ok: false, status: 400, error: "Invalid source" };
  }

  let status = requestedStatus;
  if (!status && view === "bank") status = "approved";
  if (!status && view === "review") status = "needs_review";

  return {
    ok: true,
    query: {
      view,
      page,
      pageSize,
      search,
      grade,
      year,
      subject: subjectFilter,
      type,
      marks,
      status,
      sourceId,
    },
  };
}

export function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

export function escapeIlike(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function parseRequiredLockVersion(value) {
  const lockVersion = parsePositiveInt(value, null);
  if (lockVersion == null || lockVersion < 1) {
    return { ok: false, error: "lockVersion is required" };
  }
  return { ok: true, lockVersion };
}

export function findForbiddenPatchKeys(body) {
  if (!body || typeof body !== "object") return [];
  return FORBIDDEN_QUESTION_PATCH_KEYS.filter((key) =>
    Object.prototype.hasOwnProperty.call(body, key),
  );
}

export function canSignSourcePdf(sourceId, storedPath) {
  return isUuid(sourceId) && isCanonicalSourceStoragePath(sourceId, storedPath);
}

export function canSignDiagram(questionId, storedPath) {
  return isUuid(questionId) && isCanonicalDiagramStoragePath(questionId, storedPath);
}

export function canTransitionStatus(fromStatus, toStatus) {
  if (fromStatus === toStatus) return true;
  return Boolean(ALLOWED_STATUS_TRANSITIONS[fromStatus]?.includes(toStatus));
}

export function resolveStatusAction(action, currentStatus) {
  if (action == null || action === "" || action === "save") {
    return { ok: true, nextStatus: currentStatus };
  }
  const nextStatus = STATUS_ACTIONS[action];
  if (!nextStatus) {
    return { ok: false, error: "Invalid action" };
  }
  if (
    nextStatus === currentStatus ||
    !canTransitionStatus(currentStatus, nextStatus)
  ) {
    return { ok: false, error: "Invalid status transition" };
  }
  return { ok: true, nextStatus };
}

export function validateQuestionFields(input, { requireClassification = false } = {}) {
  const questionText = String(input.questionText ?? input.text ?? "").trim();
  if (!questionText || questionText.length > 20000) {
    return { ok: false, error: "Question text is required" };
  }

  const questionType = String(input.questionType ?? input.type ?? "").trim();
  if (!ALLOWED_QUESTION_TYPES.includes(questionType)) {
    return { ok: false, error: "Invalid question type" };
  }

  const marks = parsePositiveInt(input.marks, null);
  if (marks == null || marks < 1 || marks > 100) {
    return { ok: false, error: "Invalid marks" };
  }

  let language = String(input.language ?? "").trim();
  if (language && !ALLOWED_LANGUAGES.includes(language)) {
    return { ok: false, error: "Invalid language" };
  }
  if (!language) language = detectLanguage(questionText);

  const sectionLabel = String(input.sectionLabel ?? input.section ?? "").trim();
  if (sectionLabel.length > 200) {
    return { ok: false, error: "Section label is too long" };
  }

  const chapter = String(input.chapter ?? "").trim();
  const topic = String(input.topic ?? "").trim();
  if (chapter.length > 200 || topic.length > 200) {
    return { ok: false, error: "Chapter or topic is too long" };
  }

  let options = [];
  if (questionType === "MCQ") {
    options = normalizeMcqOptions(input.options);
    if (!options) {
      return { ok: false, error: "MCQ questions need 2 to 6 valid options" };
    }
  }

  const correctAnswer = String(input.correctAnswer ?? "").trim();
  if (correctAnswer.length > 2000) {
    return { ok: false, error: "Correct answer is too long" };
  }

  const classification = {};
  if (requireClassification) {
    const grade = parsePositiveInt(input.grade, null);
    const academicYear = parsePositiveInt(
      input.academicYear ?? input.year,
      null,
    );
    const subject = String(input.subject ?? "").trim();
    if (grade == null || grade < 1 || grade > 10) {
      return { ok: false, error: "Invalid grade" };
    }
    if (!subject || subject.length > 100 || !isValidSubjectForGrade(subject, grade)) {
      return { ok: false, error: "Invalid subject for the selected grade" };
    }
    if (academicYear == null || academicYear < 2000 || academicYear > 2100) {
      return { ok: false, error: "Invalid academic year" };
    }
    classification.grade = grade;
    classification.subject = subject;
    classification.academic_year = academicYear;
  }

  return {
    ok: true,
    fields: {
      question_text: questionText,
      question_type: questionType,
      marks,
      language,
      section_label: sectionLabel || null,
      chapter: chapter || null,
      topic: topic || null,
      options,
      correct_answer: correctAnswer || null,
      ...classification,
    },
  };
}

export function approvedAtForStatus(status) {
  return status === "approved" ? new Date().toISOString() : null;
}

export function publicQuestion(row, extras = {}) {
  return {
    id: row.id,
    sourceId: row.source_id ?? null,
    sourcePageNumber: row.source_page_number ?? null,
    sourceDisplayName: extras.sourceDisplayName ?? null,
    sourceFilename: extras.sourceFilename ?? null,
    grade: row.grade,
    subject: row.subject,
    academicYear: row.academic_year,
    questionType: row.question_type,
    language: row.language,
    questionText: row.question_text,
    rawExtractedText: row.raw_extracted_text ?? null,
    options: Array.isArray(row.options) ? row.options : [],
    correctAnswer: row.correct_answer ?? null,
    marks: row.marks,
    sectionLabel: row.section_label ?? null,
    chapter: row.chapter ?? null,
    topic: row.topic ?? null,
    reviewStatus: row.review_status,
    lockVersion: row.lock_version,
    diagramUrl: extras.diagramUrl ?? null,
    approvedAt: row.approved_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export function publicSource(row) {
  return {
    id: row.id,
    displayName: row.display_name ?? null,
    filename: row.original_filename,
    grade: row.grade,
    subject: row.subject,
    academicYear: row.academic_year,
    pageCount: row.page_count,
    status: row.extraction_status,
    statusLabel: sourceStatusLabel(row.extraction_status, row.created_at),
    processedPageCount: row.processed_page_count,
    failedPages: formatFailedPages(row.failed_page_numbers),
    savedQuestionCount: row.extracted_question_count,
    createdAt: row.created_at,
    possiblyInterrupted:
      row.extraction_status === "processing" &&
      isProcessingStale(row.created_at),
    retryEligible: canShowRetryExtraction(row),
    failedPageRetryEligible: canShowRetryFailedPages(row),
  };
}
