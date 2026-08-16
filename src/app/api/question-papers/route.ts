import { NextRequest, NextResponse } from "next/server";
import { isValidSubjectForGrade } from "@/lib/subjects";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { tmpdir } from "os";
import {
  questionPaperServerError,
  requireQuestionPaperApiAccess,
} from "@/lib/question-paper-auth";
import {
  getUploadLimits,
  validatePdfUpload,
  validateUploadContentLength,
} from "@/lib/question-paper-upload-policy.mjs";
import { isAnthropicConfigured } from "@/lib/question-paper-provider-policy.mjs";
import {
  computePdfSha256,
  createSourceId,
  parseValidatePdfPagesStdout,
  sanitizeOriginalFilename,
  userSafeUploadError,
} from "@/lib/question-bank-v2-extract.mjs";
import { logExtractionStage } from "@/lib/question-bank-v2-diagnostics.mjs";
import {
  runExtractAndPersist,
  resolveExtractPython,
} from "@/lib/question-bank-v2-extract-run";
import {
  createProcessingSource,
  deleteCreatedStorageObjects,
  findSourceByChecksum,
  markSourceFailed,
  uploadSourcePdf,
  type CreatedStorageObject,
} from "@/lib/question-bank-v2-persist";
import { parseListQuery } from "@/lib/question-bank-v2-review.mjs";
import {
  listV2Questions,
  listV2Sources,
} from "@/lib/question-bank-v2-review-api";
import { listSavedPapers } from "@/lib/question-bank-v2-paper-api";

const execFileAsync = promisify(execFile);
export const dynamic = "force-dynamic";

/**
 * GET /api/question-papers
 * Paginated V2 Question Bank, Review, or Sources listing.
 */
export async function GET(request: NextRequest) {
  const authorization = await requireQuestionPaperApiAccess(request);
  if (!authorization.ok) return authorization.response;
  const { requestId } = authorization;

  try {
    const parsed = parseListQuery(request.nextUrl.searchParams);
    if (!parsed.ok) {
      return NextResponse.json(
        { success: false, error: parsed.error, requestId },
        { status: parsed.status, headers: { "Cache-Control": "no-store" } },
      );
    }

    const query = parsed.query;
    if (!query) {
      return NextResponse.json(
        { success: false, error: "Invalid filters", requestId },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (query.view === "saved") {
      const result = await listSavedPapers(query as Parameters<typeof listSavedPapers>[0]);
      return NextResponse.json(
        {
          success: true,
          view: "saved",
          papers: result.papers,
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          requestId,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (query.view === "sources") {
      const result = await listV2Sources(query as Parameters<typeof listV2Sources>[0]);
      return NextResponse.json(
        {
          success: true,
          view: "sources",
          sources: result.sources,
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          requestId,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const result = await listV2Questions(query as Parameters<typeof listV2Questions>[0]);
    return NextResponse.json(
      {
        success: true,
        view: query.view,
        questions: result.questions,
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        requestId,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.warn("[question-paper-api]", {
      requestId,
      operation: "list_v2",
      outcome: "request_error",
    });
    return questionPaperServerError(requestId);
  }
}

function duplicateResponse(
  requestId: string,
  existing: {
    id: string;
    extraction_status: string;
    extracted_question_count?: number | null;
    page_count?: number | null;
  },
) {
  return NextResponse.json(
    {
      success: false,
      duplicate: true,
      sourceId: existing.id,
      status: existing.extraction_status,
      requestId,
    },
    { status: 409 },
  );
}

/**
 * POST /api/question-papers
 * Upload a PDF, extract with Sonnet 4.6, and persist to V2 tables.
 */
export async function POST(request: NextRequest) {
  const authorization = await requireQuestionPaperApiAccess(request, {
    mutation: true,
  });
  if (!authorization.ok) return authorization.response;
  const { requestId } = authorization;
  const limits = getUploadLimits();
  const contentLengthError = validateUploadContentLength(
    request.headers.get("content-length"),
    limits.maxBytes,
    { required: true },
  );
  if (contentLengthError) {
    return NextResponse.json(
      { success: false, error: contentLengthError.error, requestId },
      { status: contentLengthError.status },
    );
  }

  const createdObjects: CreatedStorageObject[] = [];
  let workDir: string | null = null;
  let sourceId: string | null = null;
  let sourceRowCreated = false;

  try {
    const formData = await request.formData();
    const files = formData.getAll("file");
    const allUploadedFiles = Array.from(formData.values()).filter(
      (value): value is File => value instanceof File,
    );
    if (
      files.length !== 1 ||
      !(files[0] instanceof File) ||
      allUploadedFiles.length !== 1 ||
      allUploadedFiles[0] !== files[0]
    ) {
      return NextResponse.json(
        { success: false, error: "Exactly one PDF document is required", requestId },
        { status: 422 },
      );
    }
    const file = files[0];
    const subject = formData.get("subject") as string;
    const gradeParam = formData.get("grade") as string;
    const year = formData.get("year") as string;

    if (!file || !subject || !gradeParam || !year) {
      return NextResponse.json(
        { success: false, error: "Missing required fields", requestId },
        { status: 400 },
      );
    }

    const gradeNum = parseInt(gradeParam, 10);
    if (Number.isNaN(gradeNum) || gradeNum < 1 || gradeNum > 10) {
      return NextResponse.json(
        { success: false, error: "Invalid grade; must be 1–10", requestId },
        { status: 400 },
      );
    }
    if (!isValidSubjectForGrade(subject, gradeNum)) {
      logExtractionStage({
        requestId,
        stage: "request_validation",
        errorCategory: "validation",
      });
      return NextResponse.json(
        { success: false, error: "Invalid subject for the selected grade", requestId },
        { status: 400 },
      );
    }
    const academicYear = parseInt(year, 10);
    if (
      Number.isNaN(academicYear) ||
      academicYear < 2000 ||
      academicYear > 2100
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid academic year", requestId },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const uploadValidation = validatePdfUpload({
      name: file.name,
      mimeType: file.type,
      bytes: buffer,
      maxBytes: limits.maxBytes,
      maxPages: limits.maxPages,
    });
    if (uploadValidation.status !== 200) {
      return NextResponse.json(
        { success: false, error: uploadValidation.error, requestId },
        { status: uploadValidation.status },
      );
    }

    const hasSupabase =
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!hasSupabase) {
      return questionPaperServerError(requestId);
    }

    workDir = await mkdtemp(join(tmpdir(), `qb-extract-${requestId}-`));
    const filepath = join(workDir, "original.pdf");
    const tempOutputPath = join(workDir, "extract.json");
    await writeFile(filepath, buffer);

    const pythonCmd = resolveExtractPython();
    const validateScript = join(process.cwd(), "scripts", "validate_pdf_pages.py");
    if (!existsSync(validateScript)) {
      return questionPaperServerError(requestId);
    }

    let pageCount: number | null = null;
    try {
      const validation = await execFileAsync(
        pythonCmd,
        [
          validateScript,
          "--pdf",
          filepath,
          "--max-pages",
          String(limits.maxPages),
        ],
        {
          cwd: process.cwd(),
          maxBuffer: 64 * 1024,
          timeout: limits.pdfTimeoutMs,
          killSignal: "SIGKILL",
        },
      );
      pageCount = parseValidatePdfPagesStdout(validation.stdout);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "The PDF could not be validated",
          requestId,
        },
        { status: 422 },
      );
    }
    if (!pageCount) {
      return NextResponse.json(
        {
          success: false,
          error: "The PDF could not be validated",
          requestId,
        },
        { status: 422 },
      );
    }

    const contentSha256 = computePdfSha256(buffer);
    const existing = await findSourceByChecksum(contentSha256);
    if (existing) {
      return duplicateResponse(requestId, existing);
    }

    if (!isAnthropicConfigured(process.env.ANTHROPIC_API_KEY)) {
      logExtractionStage({
        requestId,
        stage: "anthropic_request",
        errorCategory: "provider",
      });
      console.warn("[question-paper-api]", {
        requestId,
        operation: "extract_pdf",
        outcome: "provider_not_configured",
      });
      return questionPaperServerError(requestId);
    }

    sourceId = createSourceId();
    try {
      createdObjects.push(await uploadSourcePdf(sourceId, buffer));
    } catch {
      console.warn("[question-paper-api]", {
        requestId,
        operation: "source_upload",
        outcome: "storage_error",
      });
      return questionPaperServerError(requestId);
    }

    try {
      const created = await createProcessingSource({
        id: sourceId,
        originalFilename: sanitizeOriginalFilename(file.name),
        contentSha256,
        byteSize: buffer.byteLength,
        pageCount,
        grade: gradeNum,
        subject,
        academicYear,
      });
      if (created.duplicate) {
        await deleteCreatedStorageObjects(createdObjects);
        createdObjects.length = 0;
        if (created.existing) {
          return duplicateResponse(requestId, created.existing);
        }
        return NextResponse.json(
          {
            success: false,
            duplicate: true,
            error: userSafeUploadError("duplicate"),
            requestId,
          },
          { status: 409 },
        );
      }
      sourceRowCreated = true;
      logExtractionStage({
        requestId,
        sourceId,
        stage: "source_row_creation",
      });
    } catch {
      await deleteCreatedStorageObjects(createdObjects);
      createdObjects.length = 0;
      console.warn("[question-paper-api]", {
        requestId,
        operation: "source_insert",
        outcome: "database_error",
      });
      return questionPaperServerError(requestId);
    }

    return await runExtractAndPersist({
      sourceId,
      pdfPath: filepath,
      workDir,
      outputPath: tempOutputPath,
      subject,
      grade: gradeParam,
      year,
      pageCount,
      requestId,
      limits,
      startedAt: Date.now(),
    });
  } catch {
    console.warn("[question-paper-api]", {
      requestId,
      operation: "upload",
      outcome: "request_error",
    });
    if (sourceId && sourceRowCreated) {
      await markSourceFailed(sourceId, "internal").catch(() => {});
    } else if (createdObjects.length > 0) {
      await deleteCreatedStorageObjects(createdObjects).catch(() => {});
    }
    return questionPaperServerError(requestId);
  } finally {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

/**
 * DELETE /api/question-papers
 * Hard-delete is not part of the V2 Question Bank.
 */
export async function DELETE(request: NextRequest) {
  const authorization = await requireQuestionPaperApiAccess(request, {
    mutation: true,
  });
  if (!authorization.ok) return authorization.response;
  return NextResponse.json(
    {
      success: false,
      error: "Questions cannot be bulk-deleted",
      requestId: authorization.requestId,
    },
    { status: 405, headers: { "Cache-Control": "no-store" } },
  );
}

