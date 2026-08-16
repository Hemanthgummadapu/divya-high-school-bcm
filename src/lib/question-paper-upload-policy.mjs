export const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const DEFAULT_MAX_PDF_PAGES = 20;
export const MAX_CONFIGURED_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_CONFIGURED_PDF_PAGES = 100;
export const MULTIPART_OVERHEAD_ALLOWANCE = 1024 * 1024;
export const DEFAULT_MAX_DIAGRAM_BYTES = 2 * 1024 * 1024;
export const MAX_CONFIGURED_DIAGRAM_BYTES = 10 * 1024 * 1024;
export const DEFAULT_OCR_TIMEOUT_MS = 3 * 60 * 1000;
export const MAX_CONFIGURED_OCR_TIMEOUT_MS = 10 * 60 * 1000;
export const DEFAULT_PDF_TIMEOUT_MS = 60 * 1000;
export const MAX_CONFIGURED_PDF_TIMEOUT_MS = 3 * 60 * 1000;

function positiveBoundedInteger(value, fallback, maximum) {
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
}

export function getUploadLimits(env = process.env) {
  return {
    maxBytes: positiveBoundedInteger(
      env.QUESTION_PAPER_MAX_UPLOAD_BYTES,
      DEFAULT_MAX_UPLOAD_BYTES,
      MAX_CONFIGURED_UPLOAD_BYTES,
    ),
    maxPages: positiveBoundedInteger(
      env.QUESTION_PAPER_MAX_PDF_PAGES,
      DEFAULT_MAX_PDF_PAGES,
      MAX_CONFIGURED_PDF_PAGES,
    ),
    maxDiagramBytes: positiveBoundedInteger(
      env.QUESTION_PAPER_MAX_DIAGRAM_BYTES,
      DEFAULT_MAX_DIAGRAM_BYTES,
      MAX_CONFIGURED_DIAGRAM_BYTES,
    ),
    ocrTimeoutMs: positiveBoundedInteger(
      env.QUESTION_PAPER_OCR_TIMEOUT_MS,
      DEFAULT_OCR_TIMEOUT_MS,
      MAX_CONFIGURED_OCR_TIMEOUT_MS,
    ),
    pdfTimeoutMs: positiveBoundedInteger(
      env.QUESTION_PAPER_PDF_TIMEOUT_MS,
      DEFAULT_PDF_TIMEOUT_MS,
      MAX_CONFIGURED_PDF_TIMEOUT_MS,
    ),
  };
}

export function validatePngDiagram(value, maxBytes) {
  if (typeof value !== "string" || value.trim() === "") {
    return { status: 422, error: "Invalid diagram image" };
  }

  const base64 = value.trim();
  if (
    base64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)
  ) {
    return { status: 422, error: "Invalid diagram encoding" };
  }

  const bytes = Buffer.from(base64, "base64");
  if (bytes.toString("base64") !== base64) {
    return { status: 422, error: "Invalid diagram encoding" };
  }
  if (bytes.byteLength === 0) {
    return { status: 422, error: "Diagram image is empty" };
  }
  if (bytes.byteLength > maxBytes) {
    return { status: 413, error: "Diagram image is too large" };
  }

  const pngSignature = bytes.subarray(0, 8).toString("hex");
  if (pngSignature !== "89504e470d0a1a0a") {
    return { status: 415, error: "Only PNG diagram images are supported" };
  }
  if (bytes.byteLength < 33) {
    return { status: 415, error: "Only PNG diagram images are supported" };
  }
  const trailer = bytes.subarray(bytes.byteLength - 8).toString("hex");
  if (trailer !== "49454e44ae426082") {
    return { status: 415, error: "Only complete PNG diagram images are supported" };
  }

  return { status: 200, bytes };
}

export function validateUploadContentLength(contentLength, maxBytes) {
  if (contentLength == null || contentLength === "") return null;
  if (!/^\d+$/.test(contentLength)) {
    return { status: 422, error: "Invalid Content-Length header" };
  }

  const receivedBytes = Number.parseInt(contentLength, 10);
  if (
    !Number.isSafeInteger(receivedBytes) ||
    receivedBytes <= 0
  ) {
    return { status: 422, error: "Invalid request size" };
  }

  if (receivedBytes > maxBytes + MULTIPART_OVERHEAD_ALLOWANCE) {
    return { status: 413, error: "Uploaded document is too large" };
  }

  return null;
}

export function countPdfPages(bytes) {
  const source = Buffer.from(bytes).toString("latin1");
  const declaredCounts = Array.from(
    source.matchAll(/\/Count\s+(\d+)\b/g),
    (match) => Number.parseInt(match[1], 10),
  ).filter((count) => Number.isSafeInteger(count) && count > 0);
  const pageObjects = source.match(/\/Type\s*\/Page\b/g)?.length ?? 0;
  const declaredPageCount =
    declaredCounts.length > 0 ? Math.max(...declaredCounts) : 0;
  return Math.max(declaredPageCount, pageObjects);
}

export function validatePdfUpload({
  name,
  mimeType,
  bytes,
  maxBytes,
  maxPages,
}) {
  if (!(bytes instanceof Uint8Array) && !Buffer.isBuffer(bytes)) {
    return { status: 422, error: "Invalid uploaded document" };
  }
  if (bytes.byteLength === 0) {
    return { status: 422, error: "Uploaded document is empty" };
  }
  if (bytes.byteLength > maxBytes) {
    return { status: 413, error: "Uploaded document is too large" };
  }
  if (mimeType !== "application/pdf") {
    return { status: 415, error: "Only PDF documents are supported" };
  }
  if (typeof name !== "string" || !/\.pdf$/i.test(name.trim())) {
    return { status: 415, error: "The file extension must be .pdf" };
  }

  const signature = Buffer.from(bytes).subarray(0, 5).toString("ascii");
  if (signature !== "%PDF-") {
    return { status: 415, error: "The file content is not a valid PDF" };
  }

  const pageCount = countPdfPages(bytes);
  if (pageCount > maxPages) {
    return {
      status: 422,
      error: `PDF documents may contain at most ${maxPages} pages`,
    };
  }

  return { status: 200, pageCount: pageCount || null };
}
