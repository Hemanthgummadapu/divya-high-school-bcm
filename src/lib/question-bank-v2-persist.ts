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
  isCanonicalSourceStoragePath,
  isUniqueViolation,
  sourceObjectKey,
  sourceStoragePath,
  toRpcQuestions,
} from "@/lib/question-bank-v2-extract.mjs";
import { sanitizeRpcErrorCategory } from "@/lib/question-bank-v2-diagnostics.mjs";
import {
  evaluateRetryEligibility,
  isStoredChecksumValid,
  isStoredPageCountValid,
} from "@/lib/question-bank-v2-retry.mjs";

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

export class PersistRpcError extends Error {
  sanitizedCategory: string;
  httpStatusClass: string | null;

  constructor(error: unknown) {
    super("persist_rpc_failed");
    this.name = "PersistRpcError";
    this.sanitizedCategory = sanitizeRpcErrorCategory(error);
    const status = Number((error as { status?: number } | null)?.status);
    this.httpStatusClass =
      Number.isSafeInteger(status) && status >= 100 && status <= 599
        ? `${Math.floor(status / 100)}xx`
        : null;
  }
}

export async function persistExtractedQuestions(input: {
  sourceId: string;
  plan: PersistencePlan;
}) {
  const { data, error } = await getSupabase().rpc("persist_extracted_questions", {
    p_source_id: input.sourceId,
    p_idempotency_key: createPersistIdempotencyKey(input.sourceId),
    p_processed_page_count: input.plan.processedPageCount,
    p_failed_page_numbers: Array.isArray(input.plan.failedPageNumbers)
      ? input.plan.failedPageNumbers
      : [],
    p_error_category: input.plan.errorCategory ?? null,
    p_error_message:
      input.plan.status === "completed"
        ? null
        : input.plan.status === "partial"
          ? "Some pages could not be extracted"
          : "No questions could be saved from this PDF",
    p_questions: toRpcQuestions(input.plan.questions),
  });
  if (error) throw new PersistRpcError(error);
  return data as {
    ok?: boolean;
    idempotent?: boolean;
    source_id?: string;
    extraction_status?: string;
    extracted_question_count?: number;
  };
}

export async function countQuestionsForSource(sourceId: string) {
  const { count, error } = await getSupabase()
    .from("question_bank_questions")
    .select("id", { count: "exact", head: true })
    .eq("source_id", sourceId);
  if (error) throw new Error("source_question_count_failed");
  return count ?? 0;
}

export async function getSourceForRetry(sourceId: string) {
  const { data, error } = await getSupabase()
    .from("question_sources")
    .select(
      "id, extraction_status, extracted_question_count, page_count, content_sha256, byte_size, grade, subject, academic_year, storage_path",
    )
    .eq("id", sourceId)
    .maybeSingle();
  if (error) throw new Error("source_lookup_failed");
  return data;
}

export async function sourcePdfObjectExists(sourceId: string) {
  const { data, error } = await getSupabase()
    .storage
    .from(SOURCE_PDF_BUCKET)
    .list(sourceId, { limit: 20, search: "original.pdf" });
  if (error || !Array.isArray(data)) return false;
  return data.some((item) => item?.name === "original.pdf");
}

export async function downloadSourcePdfBytes(sourceId: string) {
  const { data, error } = await getSupabase()
    .storage
    .from(SOURCE_PDF_BUCKET)
    .download(sourceObjectKey(sourceId));
  if (error || !data) throw new Error("source_download_failed");
  return Buffer.from(await data.arrayBuffer());
}

export async function inspectRetryEligibility(sourceId: string) {
  const source = await getSourceForRetry(sourceId);
  if (!source) {
    return { ok: false as const, status: 404, reason: "not_found" };
  }
  const linkedQuestionCount = await countQuestionsForSource(sourceId);
  const statusDecision = evaluateRetryEligibility({
    sourceStatus: source.extraction_status,
    extractedCount: source.extracted_question_count,
    linkedQuestionCount,
    extractionRunning: source.extraction_status === "processing",
  });
  if (!statusDecision.ok) {
    return {
      ok: false as const,
      status: statusDecision.status,
      reason: statusDecision.reason,
      source,
    };
  }
  const objectPresent =
    isCanonicalSourceStoragePath(sourceId, source.storage_path) &&
    (await sourcePdfObjectExists(sourceId));
  const storedChecksumValid = isStoredChecksumValid(source.content_sha256);
  const storedPageCountValid = isStoredPageCountValid(source.page_count);
  const eligibility = evaluateRetryEligibility({
    sourceStatus: source.extraction_status,
    extractedCount: source.extracted_question_count,
    linkedQuestionCount,
    objectPresent,
    storedChecksumValid,
    storedPageCountValid,
    extractionRunning: source.extraction_status === "processing",
  });
  if (!eligibility.ok) {
    return {
      ok: false as const,
      status: eligibility.status,
      reason: eligibility.reason,
      source,
    };
  }
  return {
    ok: true as const,
    source,
    linkedQuestionCount,
    objectPresent,
    storedChecksumValid,
    storedPageCountValid,
  };
}

export async function claimFailedSourceForRetry(sourceId: string) {
  const { data: claimed, error } = await getSupabase()
    .from("question_sources")
    .update({
      extraction_status: "processing",
      persist_idempotency_key: null,
      persist_payload: null,
      error_category: null,
      error_message: null,
      processed_page_count: 0,
      failed_page_numbers: [],
    })
    .eq("id", sourceId)
    .eq("extraction_status", "failed")
    .eq("extracted_question_count", 0)
    .select("id")
    .maybeSingle();
  if (error) throw new Error("retry_claim_failed");
  if (!claimed) {
    return { ok: false as const, status: 409, reason: "conflict" };
  }
  return { ok: true as const };
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
