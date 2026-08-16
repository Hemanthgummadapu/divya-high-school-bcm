export const PROCESSING_STALE_MS: number;
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
