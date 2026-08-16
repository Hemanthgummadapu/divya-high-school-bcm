import {
  ALLOWED_QUESTION_TYPES,
  isCanonicalDiagramStoragePath,
} from "./question-bank-v2-extract.mjs";
import { UUID_RE, isUuid, parsePositiveInt } from "./question-bank-v2-review.mjs";

export const MAX_PAPER_ITEMS = 200;
export const MAX_TITLE_LENGTH = 300;
export const MAX_SECTION_TITLE_LENGTH = 200;
export const MAX_SECTION_INSTRUCTIONS_LENGTH = 2000;
export const MAX_DURATION_MINUTES = 600;
export const MIN_CREATION_KEY_LENGTH = 8;
export const MAX_CREATION_KEY_LENGTH = 128;
export const MAX_GENERATE_BODY_BYTES = 256 * 1024;
export const MAX_GENERATED_PDF_BYTES = 50 * 1024 * 1024;
export const GENERATED_PAPERS_BUCKET = "generated-papers";
export const CLIENT_SNAPSHOT_KEYS = Object.freeze([
  "snapshotText",
  "snapshot_text",
  "snapshotOptions",
  "snapshot_options",
  "snapshotMarks",
  "snapshot_marks",
  "snapshotQuestionType",
  "snapshot_question_type",
  "snapshotDiagramPath",
  "snapshot_diagram_path",
  "totalMarks",
  "total_marks",
  "reviewStatus",
  "review_status",
  "pdfStoragePath",
  "pdf_storage_path",
  "pdfSha256",
  "pdf_sha256",
  "pdfByteSize",
  "pdf_byte_size",
  "storagePath",
  "storage_path",
]);

export const ALLOWED_PAPER_STATUSES = Object.freeze([
  "draft",
  "final",
  "archived",
]);

const ROMAN = Object.freeze([
  "",
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
]);

export function romanClass(grade) {
  return ROMAN[grade] || String(grade);
}

export function formatDuration(minutes) {
  if (!Number.isSafeInteger(minutes) || minutes < 1) return "";
  if (minutes % 60 === 0) return `${minutes / 60}.00 Hrs`;
  return `${minutes} min`;
}

export function isValidCreationKey(value) {
  return (
    typeof value === "string" &&
    value.length >= MIN_CREATION_KEY_LENGTH &&
    value.length <= MAX_CREATION_KEY_LENGTH &&
    !/\s/.test(value)
  );
}

export function generatedPaperObjectKey(paperId, exportId) {
  return `${paperId}/${exportId}.pdf`;
}

export function generatedPaperStoragePath(paperId, exportId) {
  return `${GENERATED_PAPERS_BUCKET}/${generatedPaperObjectKey(paperId, exportId)}`;
}

export function isCanonicalGeneratedPaperPath(paperId, storedPath) {
  return (
    typeof storedPath === "string" &&
    storedPath ===
      `${GENERATED_PAPERS_BUCKET}/${paperId}/${storedPath.split("/").pop()}` &&
    new RegExp(
      `^generated-papers/${paperId}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.pdf$`,
    ).test(storedPath)
  );
}

export function canSignGeneratedPaper(paperId, storedPath) {
  return isUuid(paperId) && isCanonicalGeneratedPaperPath(paperId, storedPath);
}

export function pdfStatusLabel(row) {
  if (row.status === "archived") return "Archived";
  if (row.status === "final" && row.pdf_storage_path && row.pdf_sha256) {
    return "Ready";
  }
  return "PDF pending";
}

export function findClientSnapshotKeys(body) {
  if (!body || typeof body !== "object") return [];
  const found = [];
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    for (const key of Object.keys(value)) {
      if (CLIENT_SNAPSHOT_KEYS.includes(key)) found.push(key);
      visit(value[key]);
    }
  };
  visit(body);
  return [...new Set(found)];
}

export function parseGenerateRequest(body) {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request" };
  }
  const action = String(body.action || "create");
  if (action === "retry") {
    if (!isUuid(body.paperId)) {
      return { ok: false, error: "Invalid paper" };
    }
    return { ok: true, action: "retry", paperId: body.paperId };
  }
  if (action !== "create") {
    return { ok: false, error: "Invalid action" };
  }

  const leaked = findClientSnapshotKeys(body);
  if (leaked.length > 0) {
    return { ok: false, error: "Paper content must be taken from the Question Bank" };
  }

  const title = String(body.title ?? "").trim();
  if (!title || title.length > MAX_TITLE_LENGTH) {
    return { ok: false, error: "Invalid title" };
  }
  const academicYear = parsePositiveInt(body.academicYear, null);
  if (academicYear == null || academicYear < 2000 || academicYear > 2100) {
    return { ok: false, error: "Invalid academic year" };
  }
  const durationMinutes = parsePositiveInt(body.durationMinutes, null);
  if (
    durationMinutes == null ||
    durationMinutes < 1 ||
    durationMinutes > MAX_DURATION_MINUTES
  ) {
    return { ok: false, error: "Invalid duration" };
  }
  if (!isValidCreationKey(body.creationKey)) {
    return { ok: false, error: "Invalid creation key" };
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return { ok: false, error: "Select at least one question" };
  }
  if (body.items.length > MAX_PAPER_ITEMS) {
    return { ok: false, error: "Too many questions" };
  }

  const items = [];
  const seenIds = new Set();
  const seenPositions = new Set();
  for (const raw of body.items) {
    if (!raw || typeof raw !== "object") {
      return { ok: false, error: "Invalid item" };
    }
    const questionId = raw.questionId || raw.bankQuestionId;
    if (!isUuid(questionId)) {
      return { ok: false, error: "Invalid question" };
    }
    if (seenIds.has(questionId)) {
      return { ok: false, error: "Duplicate question" };
    }
    seenIds.add(questionId);
    const sectionTitle = String(raw.sectionTitle ?? "").trim() || "SECTION-I";
    if (sectionTitle.length > MAX_SECTION_TITLE_LENGTH) {
      return { ok: false, error: "Section title is too long" };
    }
    const sectionInstructions = String(raw.sectionInstructions ?? "").trim();
    if (sectionInstructions.length > MAX_SECTION_INSTRUCTIONS_LENGTH) {
      return { ok: false, error: "Section instructions are too long" };
    }
    const sectionOrder = parsePositiveInt(raw.sectionOrder, null);
    const questionOrder = parsePositiveInt(raw.questionOrder, null);
    if (sectionOrder == null || sectionOrder < 1 || sectionOrder > 50) {
      return { ok: false, error: "Invalid section order" };
    }
    if (questionOrder == null || questionOrder < 1 || questionOrder > 200) {
      return { ok: false, error: "Invalid question order" };
    }
    const position = `${sectionOrder}:${questionOrder}`;
    if (seenPositions.has(position)) {
      return { ok: false, error: "Duplicate item position" };
    }
    seenPositions.add(position);
    items.push({
      questionId,
      sectionTitle,
      sectionInstructions: sectionInstructions || null,
      sectionOrder,
      questionOrder,
    });
  }

  items.sort((a, b) =>
    a.sectionOrder === b.sectionOrder
      ? a.questionOrder - b.questionOrder
      : a.sectionOrder - b.sectionOrder,
  );

  return {
    ok: true,
    action: "create",
    creationKey: body.creationKey,
    title,
    academicYear,
    durationMinutes,
    items,
  };
}

export function verifyBankQuestions(requestedIds, rows) {
  if (!Array.isArray(requestedIds) || requestedIds.length === 0) {
    return { ok: false, error: "Select at least one question" };
  }
  if (rows.length !== requestedIds.length) {
    return { ok: false, error: "One or more selected questions were not found" };
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  const grades = new Set();
  const subjects = new Set();
  for (const id of requestedIds) {
    const row = byId.get(id);
    if (!row) {
      return { ok: false, error: "One or more selected questions were not found" };
    }
    if (row.review_status !== "approved") {
      return {
        ok: false,
        error:
          row.review_status === "archived"
            ? "An archived question cannot be used"
            : "Only approved questions can be used",
      };
    }
    if (!String(row.question_text || "").trim()) {
      return { ok: false, error: "A selected question has no text" };
    }
    if (!ALLOWED_QUESTION_TYPES.includes(row.question_type)) {
      return { ok: false, error: "A selected question has an invalid type" };
    }
    if (!Number.isSafeInteger(row.marks) || row.marks < 1 || row.marks > 100) {
      return { ok: false, error: "A selected question has invalid marks" };
    }
    grades.add(row.grade);
    subjects.add(row.subject);
  }
  if (grades.size !== 1) {
    return { ok: false, error: "Selected questions must be from the same class" };
  }
  if (subjects.size !== 1) {
    return { ok: false, error: "Selected questions must be from the same subject" };
  }
  return {
    ok: true,
    grade: [...grades][0],
    subject: [...subjects][0],
  };
}

export function buildPaperSnapshots(items, rows) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const snapshots = [];
  let number = 0;
  const sectionRanks = [];
  for (const item of items) {
    if (!sectionRanks.includes(item.sectionOrder)) {
      sectionRanks.push(item.sectionOrder);
    }
  }
  const sectionIndex = new Map(sectionRanks.map((order, index) => [order, index + 1]));
  const questionIndexBySection = new Map();

  for (const item of items) {
    const row = byId.get(item.questionId);
    if (!row) {
      return { ok: false, error: "One or more selected questions were not found" };
    }
    const sectionDisplayOrder = sectionIndex.get(item.sectionOrder);
    const nextInSection = (questionIndexBySection.get(sectionDisplayOrder) || 0) + 1;
    questionIndexBySection.set(sectionDisplayOrder, nextInSection);
    number += 1;
    const diagramPath =
      row.diagram_path && isCanonicalDiagramStoragePath(row.id, row.diagram_path)
        ? row.diagram_path
        : null;
    snapshots.push({
      bank_question_id: row.id,
      section_title: item.sectionTitle,
      section_instructions: item.sectionInstructions,
      section_display_order: sectionDisplayOrder,
      question_display_order: nextInSection,
      number_label: String(number),
      snapshot_text: row.question_text,
      snapshot_options: row.question_type === "MCQ" ? row.options || [] : [],
      snapshot_marks: row.marks,
      snapshot_question_type: row.question_type,
      snapshot_diagram_path: diagramPath,
    });
  }
  return {
    ok: true,
    snapshots,
    totalMarks: snapshots.reduce((sum, item) => sum + item.snapshot_marks, 0),
  };
}

export function detectSelectionConflicts(questions) {
  const grades = [...new Set(questions.map((question) => question.grade))];
  const subjects = [...new Set(questions.map((question) => question.subject))];
  if (grades.length <= 1 && subjects.length <= 1) {
    return { ok: true, grade: grades[0] ?? null, subject: subjects[0] ?? null };
  }
  return {
    ok: false,
    grades,
    subjects,
    error:
      grades.length > 1
        ? `These questions are from different classes: ${grades.join(", ")}`
        : `These questions are from different subjects: ${subjects.join(", ")}`,
  };
}

export function publicSavedPaper(row, extras = {}) {
  const pdfReady = Boolean(row.pdf_storage_path && row.pdf_sha256 && row.pdf_byte_size);
  return {
    id: row.id,
    title: row.title,
    grade: row.grade,
    subject: row.subject,
    academicYear: row.academic_year,
    durationMinutes: row.duration_minutes,
    totalMarks: row.total_marks,
    itemCount: extras.itemCount ?? null,
    status: row.status,
    pdfAvailable: pdfReady,
    pdfStatus: pdfStatusLabel(row),
    finalizedAt: row.finalized_at ?? null,
    createdAt: row.created_at ?? null,
    pdfUrl: extras.pdfUrl ?? null,
  };
}

export function isValidGeneratedPdf(bytes, pageCount) {
  if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) return false;
  if (bytes.byteLength < 8 || bytes.byteLength > MAX_GENERATED_PDF_BYTES) return false;
  const header = Buffer.from(bytes.subarray(0, 5)).toString("latin1");
  if (header !== "%PDF-") return false;
  if (!Number.isSafeInteger(pageCount) || pageCount < 1) return false;
  return true;
}
