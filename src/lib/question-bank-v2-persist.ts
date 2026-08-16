import { randomUUID } from "crypto";
import { assertServerOnly } from "@/lib/assert-server-only";
import { getSupabase } from "@/lib/supabase-server";
import { validatePngDiagram } from "@/lib/question-paper-upload-policy.mjs";
import {
  DIAGRAM_BUCKET,
  SOURCE_PDF_BUCKET,
  createPersistIdempotencyKey,
  diagramObjectKey,
  diagramStoragePath,
  isUniqueViolation,
  sourceObjectKey,
  sourceStoragePath,
  toRpcQuestions,
} from "@/lib/question-bank-v2-extract.mjs";

type NormalizedQuestion = {
  source_page_number: number;
  source_order: number;
  question_type: string;
  language: string;
  raw_extracted_text: string;
  question_text: string;
  options: Array<{ label: string; text: string }>;
  correct_answer: string | null;
  marks: number;
  section_label: string | null;
  diagramPngBase64: string | null;
  diagramDescription: string | null;
};

type PersistencePlan = {
  status: string;
  processedPageCount: number;
  failedPageNumbers: number[];
  questions: NormalizedQuestion[];
  errorCategory: string | null;
};

assertServerOnly("Question-bank V2 persistence");

export type CreatedStorageObject = {
  bucket: string;
  path: string;
};

export async function findSourceByChecksum(contentSha256: string) {
  const { data, error } = await getSupabase()
    .from("question_sources")
    .select("id, extraction_status, extracted_question_count, page_count")
    .eq("content_sha256", contentSha256)
    .maybeSingle();
  if (error) throw new Error("source_lookup_failed");
  return data;
}

export async function uploadSourcePdf(
  sourceId: string,
  bytes: Buffer,
): Promise<CreatedStorageObject> {
  const path = sourceObjectKey(sourceId);
  const { error } = await getSupabase()
    .storage
    .from(SOURCE_PDF_BUCKET)
    .upload(path, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (error) throw new Error("source_upload_failed");
  return { bucket: SOURCE_PDF_BUCKET, path };
}

export async function createProcessingSource(input: {
  id: string;
  originalFilename: string;
  contentSha256: string;
  byteSize: number;
  pageCount: number;
  grade: number;
  subject: string;
  academicYear: number;
}) {
  const { error } = await getSupabase().from("question_sources").insert({
    id: input.id,
    original_filename: input.originalFilename,
    storage_path: sourceStoragePath(input.id),
    content_sha256: input.contentSha256,
    mime_type: "application/pdf",
    byte_size: input.byteSize,
    page_count: input.pageCount,
    grade: input.grade,
    subject: input.subject,
    academic_year: input.academicYear,
    extraction_status: "processing",
  });
  if (error) {
    if (isUniqueViolation(error)) {
      const existing = await findSourceByChecksum(input.contentSha256);
      return { duplicate: true as const, existing };
    }
    throw new Error("source_insert_failed");
  }
  return { duplicate: false as const, existing: null };
}

export async function markSourceFailed(
  sourceId: string,
  errorCategory: string,
) {
  await getSupabase()
    .from("question_sources")
    .update({
      extraction_status: "failed",
      error_category: errorCategory,
      error_message: "Extraction produced no persistable result",
    })
    .eq("id", sourceId)
    .eq("extraction_status", "processing");
}

export async function persistExtractedQuestions(input: {
  sourceId: string;
  plan: PersistencePlan;
}) {
  const { data, error } = await getSupabase().rpc("persist_extracted_questions", {
    p_source_id: input.sourceId,
    p_idempotency_key: createPersistIdempotencyKey(input.sourceId),
    p_processed_page_count: input.plan.processedPageCount,
    p_failed_page_numbers: input.plan.failedPageNumbers,
    p_error_category: input.plan.errorCategory,
    p_error_message:
      input.plan.status === "completed"
        ? null
        : input.plan.status === "partial"
          ? "Some pages could not be extracted"
          : "No questions could be saved from this PDF",
    p_questions: toRpcQuestions(input.plan.questions),
  });
  if (error) throw new Error("persist_rpc_failed");
  return data as {
    ok?: boolean;
    idempotent?: boolean;
    source_id?: string;
    extraction_status?: string;
    extracted_question_count?: number;
  };
}

export async function attachQuestionDiagrams(input: {
  sourceId: string;
  questions: NormalizedQuestion[];
  maxDiagramBytes: number;
}): Promise<CreatedStorageObject[]> {
  const created: CreatedStorageObject[] = [];
  const withPng = input.questions.filter((question) => question.diagramPngBase64);
  if (withPng.length === 0) return created;

  const { data: rows, error } = await getSupabase()
    .from("question_bank_questions")
    .select("id, source_page_number, source_order")
    .eq("source_id", input.sourceId);
  if (error) throw new Error("diagram_lookup_failed");

  const byPosition = new Map(
    (rows ?? []).map((row) => [
      `${row.source_page_number}:${row.source_order}`,
      row.id as string,
    ]),
  );

  for (const question of withPng) {
    const questionId = byPosition.get(
      `${question.source_page_number}:${question.source_order}`,
    );
    if (!questionId) continue;
    const validated = validatePngDiagram(
      question.diagramPngBase64 as string,
      input.maxDiagramBytes,
    );
    if (validated.status !== 200 || !("bytes" in validated) || !validated.bytes) {
      continue;
    }
    const pngBytes = validated.bytes;
    const assetId = randomUUID();
    const path = diagramObjectKey(questionId, assetId);
    const { error: uploadError } = await getSupabase()
      .storage
      .from(DIAGRAM_BUCKET)
      .upload(path, pngBytes, {
        contentType: "image/png",
        upsert: false,
      });
    if (uploadError) throw new Error("diagram_upload_failed");
    created.push({ bucket: DIAGRAM_BUCKET, path });
    const { error: updateError } = await getSupabase()
      .from("question_bank_questions")
      .update({ diagram_path: diagramStoragePath(questionId, assetId) })
      .eq("id", questionId);
    if (updateError) throw new Error("diagram_update_failed");
  }
  return created;
}

export async function deleteCreatedStorageObjects(
  objects: CreatedStorageObject[],
) {
  const byBucket = new Map<string, string[]>();
  for (const object of objects) {
    const paths = byBucket.get(object.bucket) ?? [];
    paths.push(object.path);
    byBucket.set(object.bucket, paths);
  }
  for (const [bucket, paths] of byBucket) {
    if (paths.length === 0) continue;
    await getSupabase().storage.from(bucket).remove(paths);
  }
}
