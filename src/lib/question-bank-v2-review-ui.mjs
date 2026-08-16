export const PROCESSING_STALE_MS = 30 * 60 * 1000;

export function isProcessingStale(createdAt, now = Date.now()) {
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return false;
  return now - created >= PROCESSING_STALE_MS;
}

export function sourceStatusLabel(status, createdAt) {
  if (status === "completed") return "Completed";
  if (status === "partial") return "Partially extracted";
  if (status === "failed") return "Failed";
  if (status === "processing") {
    return isProcessingStale(createdAt)
      ? "Processing (possibly interrupted)"
      : "Processing";
  }
  if (status === "uploaded") return "Uploaded";
  if (status === "archived") return "Archived";
  return status;
}

export function formatFailedPages(pages) {
  if (!Array.isArray(pages) || pages.length === 0) return [];
  return pages.filter((page) => Number.isSafeInteger(page) && page > 0);
}

export function uploadResultMessage(payload) {
  if (payload?.duplicate) {
    return {
      kind: "duplicate",
      text: "This PDF was already uploaded.",
      sourceId: payload.sourceId || null,
    };
  }
  if (payload?.status === "completed") {
    return {
      kind: "completed",
      text: `PDF extracted. ${payload.savedQuestionCount ?? 0} questions are ready for review.`,
      sourceId: payload.sourceId || null,
    };
  }
  if (payload?.status === "partial") {
    const pages = formatFailedPages(payload.failedPages).join(", ");
    return {
      kind: "partial",
      text: `${payload.savedQuestionCount ?? 0} questions were saved, but pages ${pages || "some pages"} could not be extracted.`,
      sourceId: payload.sourceId || null,
      failedPages: formatFailedPages(payload.failedPages),
    };
  }
  return {
    kind: "failed",
    text: payload?.error || "No questions could be saved from this PDF",
    sourceId: payload?.sourceId || null,
  };
}
