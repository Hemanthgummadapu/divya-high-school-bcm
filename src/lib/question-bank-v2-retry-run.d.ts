export function runRetrySpendControl(
  input: {
    sourceId: string;
    requestId?: string;
    elapsedMs?: number;
  },
  deps: {
    inspectRetryEligibility: (sourceId: string) => Promise<{
      ok: boolean;
      status?: number;
      reason?: string;
      source?: Record<string, unknown>;
      linkedQuestionCount?: number;
      objectPresent?: boolean;
      storedChecksumValid?: boolean;
      storedPageCountValid?: boolean;
    }>;
    claimFailedSourceForRetry: (sourceId: string) => Promise<{ ok: boolean }>;
    isAnthropicConfigured?: () => boolean;
    downloadSourcePdfBytes: (sourceId: string) => Promise<Buffer>;
    computePdfSha256: (bytes: Buffer) => string;
    createTempDir: () => Promise<string>;
    writeSourcePdf: (workDir: string, bytes: Buffer) => Promise<void>;
    validatePdfPages: (workDir: string) => Promise<number | null>;
    runExtractAndPersist: (input: {
      sourceId: string;
      workDir: string;
      pageCount: number;
      source: Record<string, unknown>;
    }) => Promise<unknown>;
    markSourceFailed: (sourceId: string, category: string) => Promise<unknown>;
    logRetryRejection: (input: Record<string, unknown>) => unknown;
  },
): Promise<{
  ok: boolean;
  status: number;
  reason: string;
  claimed: boolean;
  workDir?: string;
  response?: unknown;
}>;
