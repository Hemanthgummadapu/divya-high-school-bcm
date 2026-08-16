export const QUESTION_BANK_V2_RESULT_SCHEMA: 1;
export const SOURCE_PDF_BUCKET: "source-pdfs";
export const DIAGRAM_BUCKET: "diagrams";
export const MAX_EXTRACT_RESULT_BYTES: number;
export const MAX_QUESTIONS_PER_DOCUMENT: number;
export const MAX_QUESTIONS_PER_PAGE: number;
export const ALLOWED_QUESTION_TYPES: readonly string[];
export const ALLOWED_LANGUAGES: readonly string[];
export const ALLOWED_ERROR_CATEGORIES: readonly string[];

export type QuestionType = "MCQ" | "Short" | "Medium" | "Long";
export type QuestionLanguage = "en" | "te" | "mixed";
export type ErrorCategory =
  | "timeout"
  | "provider"
  | "parse"
  | "validation"
  | "internal";
export type SourceStatus = "completed" | "partial" | "failed";

export interface NormalizedMcqOption {
  label: string;
  text: string;
}

export interface NormalizedQuestion {
  source_page_number: number;
  source_order: number;
  question_type: QuestionType;
  language: QuestionLanguage;
  raw_extracted_text: string;
  question_text: string;
  options: NormalizedMcqOption[];
  correct_answer: string | null;
  marks: number;
  section_label: string | null;
  diagramPngBase64: string | null;
  diagramDescription: string | null;
}

export interface PersistencePlan {
  ok: true;
  status: SourceStatus;
  processedPageCount: number;
  failedPageNumbers: number[];
  questions: NormalizedQuestion[];
  errorCategory: ErrorCategory | null;
}

export function computePdfSha256(bytes: Uint8Array): string;
export function createSourceId(): string;
export function createPersistIdempotencyKey(sourceId: string): string;
export function sourceObjectKey(sourceId: string): string;
export function sourceStoragePath(sourceId: string): string;
export function diagramObjectKey(questionId: string, assetId: string): string;
export function diagramStoragePath(questionId: string, assetId: string): string;
export function sanitizeOriginalFilename(name: string): string;
export function detectLanguage(text: string): QuestionLanguage;
export function normalizeMcqOptions(
  options: unknown,
): NormalizedMcqOption[] | null;
export function classifyPageError(error: unknown): ErrorCategory;
export function normalizeExtractedQuestion(
  raw: unknown,
  pageNumber: number,
  sourceOrder: number,
): { ok: false; reason: string } | { ok: true; question: NormalizedQuestion };
export function validateDocumentResult(
  result: unknown,
  expectedPageCount: number,
):
  | { ok: false; reason: string }
  | {
      ok: true;
      pages: Array<{
        pageNumber: number;
        status: "succeeded" | "failed";
        errorCategory?: ErrorCategory;
        questions: unknown[];
      }>;
    };
export function normalizeSucceededPage(page: {
  pageNumber: number;
  status: "succeeded" | "failed";
  errorCategory?: ErrorCategory;
  questions?: unknown[];
}): {
  pageNumber: number;
  status: "succeeded" | "failed";
  errorCategory?: ErrorCategory;
  questions: NormalizedQuestion[];
};
export function buildPersistencePlan(
  pages: Array<{
    pageNumber: number;
    status: "succeeded" | "failed";
    errorCategory?: ErrorCategory;
    questions?: unknown[];
  }>,
): PersistencePlan | { ok: false; reason: string };
export function toRpcQuestions(
  questions: NormalizedQuestion[],
): Array<Record<string, unknown>>;
export function parseValidatePdfPagesStdout(stdout: string): number | null;
export function isUniqueViolation(error: { code?: string } | null): boolean;
export function userSafeUploadError(
  kind: "duplicate" | "partial" | "failed" | "invalid" | string,
): string;
export function containsForbiddenLogText(
  value: unknown,
  secrets?: string[],
): boolean;
