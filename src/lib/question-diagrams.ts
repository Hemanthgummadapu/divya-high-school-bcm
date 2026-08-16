import { assertServerOnly } from "@/lib/assert-server-only";
import { getSupabase } from "@/lib/supabase-server";
import {
  getQuestionDiagramPath,
  QUESTION_DIAGRAM_BUCKET,
  renewQuestionDiagramUrl,
} from "@/lib/question-diagram-policy.mjs";

assertServerOnly("Question diagram storage");

export { QUESTION_DIAGRAM_BUCKET };
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function createSignedQuestionDiagramUrl(
  questionId: string,
  storedValue?: string | null,
): Promise<string | undefined> {
  return renewQuestionDiagramUrl({
    questionId,
    storedValue,
    sign: async (path: string) => {
      const { data, error } = await getSupabase()
        .storage.from(QUESTION_DIAGRAM_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (error || !data?.signedUrl) {
        throw new Error("Unable to create diagram access URL");
      }
      return data.signedUrl;
    },
  });
}

export async function createSignedQuestionDiagramUrls(
  rows: Array<{ id: string; diagram_url?: string | null }>,
): Promise<Map<string, string>> {
  const rowPaths = rows
    .map((row) => ({
      id: row.id,
      path: getQuestionDiagramPath(row.id, row.diagram_url),
    }))
    .filter((entry): entry is { id: string; path: string } =>
      Boolean(entry.path),
    );
  if (rowPaths.length === 0) return new Map();

  const uniquePaths = [...new Set(rowPaths.map(({ path }) => path))];
  const { data, error } = await getSupabase()
    .storage.from(QUESTION_DIAGRAM_BUCKET)
    .createSignedUrls(uniquePaths, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    throw new Error("Unable to create diagram access URLs");
  }

  const urlsByPath = new Map(
    data
      .filter((entry) => entry.signedUrl)
      .map((entry) => [entry.path, entry.signedUrl as string]),
  );
  return new Map(
    rowPaths.flatMap(({ id, path }) => {
      const signedUrl = urlsByPath.get(path);
      return signedUrl ? [[id, signedUrl]] : [];
    }),
  );
}
