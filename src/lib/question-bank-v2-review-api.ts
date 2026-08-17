import { randomUUID } from "crypto";
import { assertServerOnly } from "@/lib/assert-server-only";
import { getSupabase } from "@/lib/supabase-server";
import {
  DIAGRAM_BUCKET,
  SOURCE_PDF_BUCKET,
  diagramObjectKey,
  diagramSignedObjectKey,
  diagramStoragePath,
  sourceSignedObjectKey,
} from "@/lib/question-bank-v2-extract.mjs";
import {
  SIGNED_URL_TTL_SECONDS,
  approvedAtForStatus,
  canSignDiagram,
  canSignSourcePdf,
  escapeIlike,
  publicQuestion,
  publicSource,
} from "@/lib/question-bank-v2-review.mjs";

type ListQuery = {
  view: "bank" | "review" | "sources";
  page: number;
  pageSize: number;
  search: string;
  grade: number | null;
  year: number | null;
  subject: string;
  type: string;
  marks: number | null;
  status: string;
  sourceId: string;
};

type PublicQuestion = ReturnType<typeof publicQuestion>;
type PublicSource = ReturnType<typeof publicSource>;

assertServerOnly("Question-bank V2 review");

const QUESTION_COLUMNS =
  "id, source_id, source_page_number, source_order, grade, subject, academic_year, chapter, topic, section_label, question_type, language, raw_extracted_text, question_text, options, correct_answer, marks, diagram_path, review_status, lock_version, created_at, updated_at, approved_at";

const SOURCE_LIST_COLUMNS =
  "id, original_filename, display_name, grade, subject, academic_year, page_count, extraction_status, processed_page_count, failed_page_numbers, extracted_question_count, created_at";

type QuestionRow = Record<string, unknown> & {
  id: string;
  source_id?: string | null;
  diagram_path?: string | null;
  review_status: string;
  lock_version: number;
};

function hasSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function requireSupabaseConfig() {
  if (!hasSupabaseConfig()) {
    throw new Error("supabase_unconfigured");
  }
}

async function signDiagramUrls(rows: QuestionRow[]) {
  const verified = rows.flatMap((row) => {
    if (!row.diagram_path || !canSignDiagram(row.id, row.diagram_path)) {
      return [];
    }
    const objectKey = diagramSignedObjectKey(row.diagram_path);
    return objectKey ? [{ id: row.id, objectKey }] : [];
  });
  if (verified.length === 0) return new Map<string, string>();

  const uniqueKeys = [...new Set(verified.map((entry) => entry.objectKey))];
  const { data, error } = await getSupabase()
    .storage.from(DIAGRAM_BUCKET)
    .createSignedUrls(uniqueKeys, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return new Map<string, string>();

  const urlsByKey = new Map(
    data
      .filter((entry) => entry.signedUrl)
      .map((entry) => [entry.path, entry.signedUrl as string]),
  );
  return new Map(
    verified.flatMap(({ id, objectKey }) => {
      const url = urlsByKey.get(objectKey);
      return url ? [[id, url] as const] : [];
    }),
  );
}

async function signSourcePdfUrl(sourceId: string, storedPath: string | null) {
  if (!canSignSourcePdf(sourceId, storedPath)) return null;
  const { data, error } = await getSupabase()
    .storage.from(SOURCE_PDF_BUCKET)
    .createSignedUrl(sourceSignedObjectKey(sourceId), SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

async function sourceMeta(sourceIds: string[]) {
  const unique = [...new Set(sourceIds.filter(Boolean))];
  if (unique.length === 0) {
    return new Map<string, { filename: string; displayName: string | null }>();
  }
  const { data, error } = await getSupabase()
    .from("question_sources")
    .select("id, original_filename, display_name")
    .in("id", unique);
  if (error || !data) {
    return new Map<string, { filename: string; displayName: string | null }>();
  }
  return new Map(
    data.map((row) => [
      row.id as string,
      {
        filename: row.original_filename as string,
        displayName: (row.display_name as string | null) ?? null,
      },
    ]),
  );
}

async function toPublicQuestions(rows: QuestionRow[]): Promise<PublicQuestion[]> {
  const [diagramUrls, sources] = await Promise.all([
    signDiagramUrls(rows),
    sourceMeta(
      rows
        .map((row) => row.source_id)
        .filter((id): id is string => typeof id === "string"),
    ),
  ]);
  return rows.map((row) => {
    const meta = row.source_id ? sources.get(row.source_id) : null;
    return publicQuestion(row, {
      sourceDisplayName: meta?.displayName ?? null,
      sourceFilename: meta?.filename ?? null,
      diagramUrl: diagramUrls.get(row.id) ?? null,
    });
  });
}

function applyQuestionFilters(query: any, filters: ListQuery) {
  let next = query;
  if (filters.status) next = next.eq("review_status", filters.status);
  if (filters.grade != null) next = next.eq("grade", filters.grade);
  if (filters.subject) next = next.eq("subject", filters.subject);
  if (filters.year != null) next = next.eq("academic_year", filters.year);
  if (filters.type) next = next.eq("question_type", filters.type);
  if (filters.marks != null) next = next.eq("marks", filters.marks);
  if (filters.sourceId) next = next.eq("source_id", filters.sourceId);
  if (filters.search) {
    next = next.ilike("question_text", `%${escapeIlike(filters.search)}%`);
  }
  return next;
}

export async function listV2Questions(filters: ListQuery): Promise<{
  questions: PublicQuestion[];
  page: number;
  pageSize: number;
  total: number;
}> {
  requireSupabaseConfig();
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  let query = getSupabase()
    .from("question_bank_questions")
    .select(QUESTION_COLUMNS, { count: "exact" });
  query = applyQuestionFilters(query, filters);
  const { data, error, count } = await query
    .order("grade", { ascending: true })
    .order("subject", { ascending: true })
    .order("academic_year", { ascending: true })
    .order("source_page_number", { ascending: true, nullsFirst: false })
    .order("source_order", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true })
    .range(from, to);
  if (error) throw new Error("question_list_failed");
  return {
    questions: await toPublicQuestions((data ?? []) as QuestionRow[]),
    page: filters.page,
    pageSize: filters.pageSize,
    total: count ?? 0,
  };
}

export async function listV2Sources(filters: ListQuery): Promise<{
  sources: PublicSource[];
  page: number;
  pageSize: number;
  total: number;
}> {
  requireSupabaseConfig();
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  let query = getSupabase()
    .from("question_sources")
    .select(SOURCE_LIST_COLUMNS, { count: "exact" });
  if (filters.grade != null) query = query.eq("grade", filters.grade);
  if (filters.subject) query = query.eq("subject", filters.subject);
  if (filters.year != null) query = query.eq("academic_year", filters.year);
  if (filters.status) query = query.eq("extraction_status", filters.status);
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, to);
  if (error) throw new Error("source_list_failed");
  return {
    sources: (data ?? []).map((row) => publicSource(row)),
    page: filters.page,
    pageSize: filters.pageSize,
    total: count ?? 0,
  };
}

export async function listV2SourceOptions(filters: {
  grade: number | null;
  subject: string;
  year: number | null;
}): Promise<Array<{ id: string; displayName: string }>> {
  requireSupabaseConfig();
  let query = getSupabase()
    .from("question_sources")
    .select("id, display_name")
    .neq("extraction_status", "archived");
  if (filters.grade != null) query = query.eq("grade", filters.grade);
  if (filters.subject) query = query.eq("subject", filters.subject);
  if (filters.year != null) query = query.eq("academic_year", filters.year);
  const { data, error } = await query
    .order("display_name", { ascending: true })
    .order("id", { ascending: true })
    .limit(200);
  if (error) throw new Error("source_options_failed");
  return (data ?? []).map((row) => ({
    id: row.id as string,
    displayName: (row.display_name as string) || "",
  }));
}

export async function renameV2Source(sourceId: string, displayName: string) {
  requireSupabaseConfig();
  const { data, error } = await getSupabase()
    .from("question_sources")
    .update({ display_name: displayName })
    .eq("id", sourceId)
    .select(SOURCE_LIST_COLUMNS)
    .maybeSingle();
  if (error) throw new Error("source_rename_failed");
  if (!data) return null;
  return publicSource(data);
}

export async function getV2SourceDetail(input: {
  sourceId: string;
  page: number;
  pageSize: number;
  status?: string;
}) {
  requireSupabaseConfig();
  const { data: source, error: sourceError } = await getSupabase()
    .from("question_sources")
    .select(`${SOURCE_LIST_COLUMNS}, storage_path`)
    .eq("id", input.sourceId)
    .maybeSingle();
  if (sourceError) throw new Error("source_lookup_failed");
  if (!source) return null;

  const from = (input.page - 1) * input.pageSize;
  const to = from + input.pageSize - 1;
  let questionQuery = getSupabase()
    .from("question_bank_questions")
    .select(QUESTION_COLUMNS, { count: "exact" })
    .eq("source_id", input.sourceId);
  if (input.status) {
    questionQuery = questionQuery.eq("review_status", input.status);
  } else {
    questionQuery = questionQuery.not(
      "review_status",
      "in",
      "(rejected,archived)",
    );
  }
  const { data: questions, error: questionError, count } = await questionQuery
    .order("source_page_number", { ascending: true })
    .order("source_order", { ascending: true })
    .order("id", { ascending: true })
    .range(from, to);
  if (questionError) throw new Error("source_questions_failed");

  const pdfUrl = await signSourcePdfUrl(
    source.id as string,
    source.storage_path as string,
  );

  return {
    source: publicSource(source),
    pdfUrl,
    questions: await toPublicQuestions((questions ?? []) as QuestionRow[]),
    page: input.page,
    pageSize: input.pageSize,
    total: count ?? 0,
  };
}

export async function getV2Question(questionId: string) {
  requireSupabaseConfig();
  const { data, error } = await getSupabase()
    .from("question_bank_questions")
    .select(QUESTION_COLUMNS)
    .eq("id", questionId)
    .maybeSingle();
  if (error) throw new Error("question_lookup_failed");
  if (!data) return null;
  const [question] = await toPublicQuestions([data as QuestionRow]);
  return { row: data as QuestionRow, question };
}

export async function updateV2Question(input: {
  questionId: string;
  lockVersion: number;
  fields: Record<string, unknown>;
  nextStatus: string;
  diagramBytes?: Buffer;
}) {
  requireSupabaseConfig();
  const updates: Record<string, unknown> = {
    ...input.fields,
    review_status: input.nextStatus,
    approved_at: approvedAtForStatus(input.nextStatus),
  };

  let createdDiagram: { bucket: string; path: string } | null = null;
  if (input.diagramBytes) {
    const assetId = randomUUID();
    const objectKey = diagramObjectKey(input.questionId, assetId);
    const { error: uploadError } = await getSupabase()
      .storage.from(DIAGRAM_BUCKET)
      .upload(objectKey, input.diagramBytes, {
        contentType: "image/png",
        upsert: false,
      });
    if (uploadError) throw new Error("diagram_upload_failed");
    createdDiagram = { bucket: DIAGRAM_BUCKET, path: objectKey };
    updates.diagram_path = diagramStoragePath(input.questionId, assetId);
  }

  const { data, error } = await getSupabase()
    .from("question_bank_questions")
    .update(updates)
    .eq("id", input.questionId)
    .eq("lock_version", input.lockVersion)
    .select(QUESTION_COLUMNS)
    .maybeSingle();

  if (error || !data) {
    if (createdDiagram) {
      await getSupabase()
        .storage.from(createdDiagram.bucket)
        .remove([createdDiagram.path]);
    }
    if (!error && !data) return { stale: true as const, question: null };
    throw new Error("question_update_failed");
  }

  const [question] = await toPublicQuestions([data as QuestionRow]);
  return { stale: false as const, question };
}

export async function createManualV2Question(input: {
  fields: Record<string, unknown>;
  reviewStatus: "needs_review" | "approved";
  rawExtractedText: string;
}) {
  requireSupabaseConfig();
  const { data, error } = await getSupabase()
    .from("question_bank_questions")
    .insert({
      source_id: null,
      source_page_number: null,
      source_order: null,
      ...input.fields,
      raw_extracted_text: input.rawExtractedText,
      review_status: input.reviewStatus,
      approved_at: approvedAtForStatus(input.reviewStatus),
    })
    .select(QUESTION_COLUMNS)
    .single();
  if (error || !data) throw new Error("question_create_failed");
  const [question] = await toPublicQuestions([data as QuestionRow]);
  return question;
}
