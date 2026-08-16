export const QUESTION_DIAGRAM_BUCKET = "diagrams";

export function getQuestionDiagramPath(questionId, storedValue) {
  if (
    typeof questionId !== "string" ||
    questionId.length > 128 ||
    !/^[A-Za-z0-9_-]+$/.test(questionId) ||
    typeof storedValue !== "string" ||
    storedValue.trim() === ""
  ) {
    return null;
  }

  const expectedPath = `${questionId}.png`;
  const value = storedValue.trim();
  if (!/^https?:\/\//i.test(value)) {
    return value.replace(/^\/+/, "") === expectedPath ? expectedPath : null;
  }

  try {
    const url = new URL(value);
    const marker = `/storage/v1/object/public/${QUESTION_DIAGRAM_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex < 0) return null;
    const storedPath = decodeURIComponent(
      url.pathname.slice(markerIndex + marker.length),
    );
    return storedPath === expectedPath ? expectedPath : null;
  } catch {
    return null;
  }
}

export async function renewQuestionDiagramUrl({
  questionId,
  storedValue,
  sign,
}) {
  const path = getQuestionDiagramPath(questionId, storedValue);
  if (!path) return undefined;
  return sign(path);
}
