export const QUESTION_DIAGRAM_BUCKET: "diagrams";

export function getQuestionDiagramPath(
  questionId: string,
  storedValue?: string | null,
): string | null;

export function renewQuestionDiagramUrl(input: {
  questionId: string;
  storedValue?: string | null;
  sign: (path: string) => Promise<string>;
}): Promise<string | undefined>;
