export const RETRY_FORBIDDEN_STATUSES: readonly string[];
export const RETRY_REJECTION_REASONS: readonly string[];

export function sanitizeRetryRejectionReason(value: unknown): string | null;
export function isStoredChecksumValid(value: unknown): boolean;
export function isStoredPageCountValid(value: unknown): boolean;
export function statusRejectionReason(status: unknown): string;

export function isFailedSourceRetryEligible(
  source: Record<string, unknown> | null | undefined,
  extras?: {
    linkedQuestionCount?: number;
    objectPresent?: boolean;
    storedChecksumValid?: boolean;
    storedPageCountValid?: boolean;
    checksumMatch?: boolean;
    pageCountMatch?: boolean;
    extractionRunning?: boolean;
  },
): boolean;

export type RetryDecision = {
  ok: boolean;
  status: number;
  reason: string;
  allowPaidWork: boolean;
};

export function evaluateRetryEligibility(input?: {
  sourceStatus?: string;
  extractedCount?: number;
  linkedQuestionCount?: number;
  objectPresent?: boolean;
  storedChecksumValid?: boolean;
  storedPageCountValid?: boolean;
  checksumMatch?: boolean;
  pageCountMatch?: boolean;
  extractionRunning?: boolean;
}): RetryDecision;

export function evaluateRetryClaim(input?: {
  sourceStatus?: string;
  extractedCount?: number;
  linkedQuestionCount?: number;
  objectPresent?: boolean;
  storedChecksumValid?: boolean;
  storedPageCountValid?: boolean;
  checksumMatch?: boolean;
  pageCountMatch?: boolean;
  extractionRunning?: boolean;
  updatedRows?: number;
}): RetryDecision;

export function canBeginRetryPaidWork(decision: RetryDecision | null | undefined): boolean;

export function runRetryIfEligible(
  decision: RetryDecision | null | undefined,
  paidWork: () => void,
): {
  ok: boolean;
  status: number;
  reason: string;
  paidWorkStarted: boolean;
};

export function canShowRetryExtraction(
  source: Record<string, unknown> | null | undefined,
): boolean;

export function shouldRenderRetryButton(
  source: Record<string, unknown> | null | undefined,
  ui?: {
    retryingSourceId?: string | null;
    lockedSourceIds?: Set<string> | string[];
  },
): boolean;

export function createRetryClickLock(): {
  tryAcquire(): boolean;
  release(): void;
};

export function applyRetryClick(
  state: {
    lockedSourceIds?: Iterable<string>;
    sources?: Array<Record<string, unknown> & { id: string }>;
  },
  sourceId: string,
): {
  retryingSourceId: string;
  lockedSourceIds: Set<string>;
  sources: Array<Record<string, unknown> & { id: string }>;
};

export function applyRetryListReload(
  state: {
    lockedSourceIds?: Iterable<string>;
    sources?: Array<Record<string, unknown> & { id: string }>;
  },
  input?: {
    reloaded?: boolean;
    sourceId?: string;
    sources?: Array<Record<string, unknown> & { id: string }>;
  },
): {
  retryingSourceId: null;
  lockedSourceIds: Set<string>;
  sources: Array<Record<string, unknown> & { id: string }>;
};
