export const RETRY_FORBIDDEN_STATUSES: readonly string[];

export function isFailedSourceRetryEligible(
  source: Record<string, unknown> | null | undefined,
  extras?: {
    linkedQuestionCount?: number;
    objectPresent?: boolean;
    checksumMatch?: boolean;
    pageCountMatch?: boolean;
  },
): boolean;

export function evaluateRetryClaim(input?: {
  sourceStatus?: string;
  extractedCount?: number;
  linkedQuestionCount?: number;
  objectPresent?: boolean;
  checksumMatch?: boolean;
  pageCountMatch?: boolean;
  updatedRows?: number;
}): { ok: boolean; status: number; reason: string };

export function canShowRetryExtraction(
  source: Record<string, unknown> | null | undefined,
): boolean;
