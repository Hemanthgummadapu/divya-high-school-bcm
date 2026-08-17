export function runFailedPageRetrySpendControl(
  input: {
    sourceId: string;
    requestId?: string;
    elapsedMs?: number;
  },
  deps: {
    inspectFailedPageRetryEligibility: (sourceId: string) => Promise<{
      ok: boolean;
      status?: number;
      reason?: string;
      source?: Record<string, unknown>;
      failedPages?: number[];
      linkedQuestionCount?: number;
      questionsOnFailedPages?: number;
      objectPresent?: boolean;
      storedChecksumValid?: boolean;
      storedPageCountValid?: boolean;
    }>;
    claimPartialSourceForFailedPageRetry: (
      sourceId: string,
    ) => Promise<{ ok: boolean }>;
    isAnthropicConfigured?: () => boolean;
    downloadSourcePdfBytes: (sourceId: string) => Promise<Buffer>;
    computePdfSha256: (bytes: Buffer) => string;
    createTempDir: () => Promise<string>;
    writeSourcePdf: (workDir: string, bytes: Buffer) => Promise<void>;
    validatePdfPages: (workDir: string) => Promise<number | null>;
    runFailedPageExtractAndPersist: (input: {
      sourceId: string;
      workDir: string;
      pageCount: number;
      source: Record<string, unknown>;
      selectedPages: number[];
    }) => Promise<unknown>;
    restorePartialSource: (
      sourceId: string,
      category: string,
    ) => Promise<unknown>;
    logRetryRejection: (input: Record<string, unknown>) => unknown;
  },
): Promise<{
  ok: boolean;
  status: number;
  reason: string;
  claimed: boolean;
  workDir?: string;
  selectedPages?: number[];
  response?: unknown;
}>;
