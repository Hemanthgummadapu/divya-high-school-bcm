export const MAX_PAGE_SIZE: number;
export const DEFAULT_PAGE_SIZE: number;
export const MAX_SEARCH_LENGTH: number;
export const SIGNED_URL_TTL_SECONDS: number;
export const PROCESSING_STALE_MS: number;
export const UUID_RE: RegExp;
export const ALLOWED_REVIEW_STATUSES: readonly string[];
export const ALLOWED_SOURCE_STATUSES: readonly string[];
export const ALLOWED_STATUS_TRANSITIONS: Readonly<Record<string, readonly string[]>>;
export const STATUS_ACTIONS: Readonly<Record<string, string | null>>;
export const FORBIDDEN_QUESTION_PATCH_KEYS: readonly string[];

export type ReviewStatus =
  | "needs_review"
  | "approved"
  | "rejected"
  | "archived";

export interface ListQuery {
  view: "bank" | "review" | "sources";
  page: number;
  pageSize: number;
  search: string;
  grade: number | null;
  year: number | null;
  subject: string;
  type: string;
  status: string;
  sourceId: string;
}

export interface PublicQuestion {
  id: string;
  sourceId: string | null;
  sourcePageNumber: number | null;
  sourceFilename: string | null;
  grade: number;
  subject: string;
  academicYear: number;
  questionType: string;
  language: string;
  questionText: string;
  rawExtractedText: string | null;
  options: Array<{ label: string; text: string }>;
  correctAnswer: string | null;
  marks: number;
  sectionLabel: string | null;
  chapter: string | null;
  topic: string | null;
  reviewStatus: ReviewStatus;
  lockVersion: number;
  diagramUrl: string | null;
  approvedAt: string | null;
  updatedAt: string | null;
}

export interface PublicSource {
  id: string;
  filename: string;
  grade: number;
  subject: string;
  academicYear: number;
  pageCount: number;
  status: string;
  statusLabel: string;
  processedPageCount: number;
  failedPages: number[];
  savedQuestionCount: number;
  createdAt: string;
  possiblyInterrupted: boolean;
  retryEligible: boolean;
}

export function parsePositiveInt(value: unknown, fallback?: number | null): number | null;
export function parseListQuery(
  searchParams: URLSearchParams,
): { ok: false; status: number; error: string } | { ok: true; query: ListQuery };
export function isUuid(value: unknown): boolean;
export function escapeIlike(value: string): string;
export function parseRequiredLockVersion(
  value: unknown,
): { ok: false; error: string } | { ok: true; lockVersion: number };
export function findForbiddenPatchKeys(body: unknown): string[];
export function canSignSourcePdf(sourceId: string, storedPath: unknown): boolean;
export function canSignDiagram(questionId: string, storedPath: unknown): boolean;
export function canTransitionStatus(fromStatus: string, toStatus: string): boolean;
export function resolveStatusAction(
  action: unknown,
  currentStatus: string,
): { ok: false; error: string } | { ok: true; nextStatus: string };
export function validateQuestionFields(
  input: Record<string, unknown>,
  options?: { requireClassification?: boolean },
):
  | { ok: false; error: string }
  | { ok: true; fields: Record<string, unknown> };
export function approvedAtForStatus(status: string): string | null;
export function isProcessingStale(createdAt: string, now?: number): boolean;
export function sourceStatusLabel(status: string, createdAt: string): string;
export function formatFailedPages(pages: unknown): number[];
export function uploadResultMessage(payload: {
  duplicate?: boolean;
  status?: string;
  savedQuestionCount?: number;
  failedPages?: number[];
  sourceId?: string;
  error?: string;
}): {
  kind: "duplicate" | "completed" | "partial" | "failed";
  text: string;
  sourceId: string | null;
  failedPages?: number[];
};
export function publicQuestion(
  row: Record<string, unknown>,
  extras?: { sourceFilename?: string | null; diagramUrl?: string | null },
): PublicQuestion;
export function publicSource(row: Record<string, unknown>): PublicSource;
