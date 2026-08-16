export const EXTRACTION_STAGES: readonly string[];

export interface ExtractionDiagnostic {
  requestId: string | null;
  sourceId: string | null;
  stage: string;
  pageNumber: number | null;
  errorCategory: string | null;
  providerHttpStatusClass: string | null;
  elapsedMs: number | null;
}

export function sanitizeRequestId(value: unknown): string | null;
export function sanitizeSourceId(value: unknown): string | null;
export function sanitizeStage(value: unknown): string;
export function sanitizePageNumber(value: unknown): number | null;
export function sanitizeErrorCategory(value: unknown): string | null;
export function sanitizeHttpStatusClass(value: unknown): string | null;
export function sanitizeElapsedMs(value: unknown): number | null;
export function sanitizeRpcErrorCategory(error: unknown): string;
export function buildExtractionDiagnostic(
  input?: Record<string, unknown>,
): ExtractionDiagnostic;
export function logExtractionStage(
  input?: Record<string, unknown>,
): ExtractionDiagnostic;
