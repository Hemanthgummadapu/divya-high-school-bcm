export const DEFAULT_MAX_UPLOAD_BYTES: number;
export const DEFAULT_MAX_PDF_PAGES: number;
export const MAX_CONFIGURED_UPLOAD_BYTES: number;
export const MAX_CONFIGURED_PDF_PAGES: number;
export const MULTIPART_OVERHEAD_ALLOWANCE: number;
export const DEFAULT_MAX_DIAGRAM_BYTES: number;
export const MAX_CONFIGURED_DIAGRAM_BYTES: number;
export const DEFAULT_OCR_TIMEOUT_MS: number;
export const MAX_CONFIGURED_OCR_TIMEOUT_MS: number;
export const DEFAULT_PDF_TIMEOUT_MS: number;
export const MAX_CONFIGURED_PDF_TIMEOUT_MS: number;

export interface UploadLimits {
  maxBytes: number;
  maxPages: number;
  maxDiagramBytes: number;
  ocrTimeoutMs: number;
  pdfTimeoutMs: number;
}

export interface UploadValidationError {
  status: 413 | 415 | 422;
  error: string;
}

export function getUploadLimits(
  env?: Record<string, string | undefined>,
): UploadLimits;
export function validateUploadContentLength(
  contentLength: string | null,
  maxBytes: number,
  options?: { required?: boolean },
): UploadValidationError | null;
export function countPdfPages(bytes: Uint8Array): number;
export function validatePngDiagram(
  value: string,
  maxBytes: number,
):
  | UploadValidationError
  | { status: 200; bytes: Buffer };
export function validatePdfUpload(input: {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
  maxBytes: number;
  maxPages: number;
}): UploadValidationError | { status: 200; pageCount: number | null };
