import { NextRequest, NextResponse } from "next/server";
import {
  getStatistics,
  type QuestionPaper,
  type Question,
  type FilterOptions,
} from "@/lib/questionPapers";
import { isValidSubjectForGrade } from "@/lib/subjects";
import { getSupabase } from "@/lib/supabase-server";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { platform, tmpdir } from "os";
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
import { createSignedQuestionDiagramUrls } from "@/lib/question-diagrams";
import {
  MAX_EXTRACT_RESULT_BYTES,
  buildPersistencePlan,
  computePdfSha256,
  createSourceId,
  parseValidatePdfPagesStdout,
  sanitizeOriginalFilename,
  userSafeUploadError,
  validateDocumentResult,
} from "@/lib/question-bank-v2-extract.mjs";
import {
  attachQuestionDiagrams,
  createProcessingSource,
  deleteCreatedStorageObjects,
  findSourceByChecksum,
  markSourceFailed,
  persistExtractedQuestions,
  uploadSourcePdf,
  type CreatedStorageObject,
} from "@/lib/question-bank-v2-persist";

const execFileAsync = promisify(execFile);
export const dynamic = "force-dynamic";

/**
 * GET /api/question-papers
 * Get all question papers with optional filters.
 * Always reads from Supabase; returns empty array if no data or Supabase unavailable.
 */
export async function GET(request: NextRequest) {
  const authorization = await requireQuestionPaperApiAccess(request);
  if (!authorization.ok) return authorization.response;
  const { requestId } = authorization;

  try {
    const { searchParams } = new URL(request.url);

    const filters: FilterOptions = {
      subject: searchParams.get("subject") || undefined,
      grade: searchParams.get("grade") || undefined,
      year: searchParams.get("year") || undefined,
      type: (searchParams.get("type") as Question["type"]) || undefined,
      section: searchParams.get("section") || undefined,
    };

    const hasSupabase =
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!hasSupabase) {
      return questionPaperServerError(requestId);
    }

    try {
      let query = getSupabase().from("questions").select("*");
      if (filters.subject) query = query.eq("subject", filters.subject);
      if (filters.grade) {
        const gradeNum = parseInt(filters.grade, 10);
        if (!Number.isNaN(gradeNum)) query = query.eq("grade", gradeNum);
      }
      if (filters.year) {
        const yearNum = parseInt(filters.year, 10);
        if (!Number.isNaN(yearNum)) query = query.eq("year", yearNum);
      }
      if (filters.type) query = query.eq("type", filters.type);
      if (filters.section) query = query.eq("section", filters.section);

      const { data: questionRows, error: questionsError } = await query;

      if (questionsError) {
        console.warn("[question-paper-api]", {
          requestId,
          operation: "list_questions",
          outcome: "database_error",
        });
        return questionPaperServerError(requestId);
      }

      if (!questionRows || questionRows.length === 0) {
        return NextResponse.json({
          success: true,
          papers: [],
          statistics: { totalPapers: 0, totalQuestions: 0, bySubject: {}, byType: {} },
          count: 0,
        });
      }

      const signedDiagramUrls = await createSignedQuestionDiagramUrls(
        questionRows as Array<{
          id: string;
          diagram_url?: string | null;
        }>,
      );
      const paperIds = [...new Set(questionRows.map((r: { paper_id: string }) => r.paper_id))];
      const { data: paperRows, error: papersError } = await getSupabase()
        .from("question_papers")
        .select("*")
        .in("id", paperIds);

      if (papersError) {
        console.warn("[question-paper-api]", {
          requestId,
          operation: "list_papers",
          outcome: "database_error",
        });
        return questionPaperServerError(requestId);
      }
      if (!paperRows || paperRows.length === 0) {
        return NextResponse.json({
          success: true,
          papers: [],
          statistics: { totalPapers: 0, totalQuestions: 0, bySubject: {}, byType: {} },
          count: 0,
        });
      }

      const papers: QuestionPaper[] = paperRows.map(
        (p: {
          id: string;
          file_name: string;
          subject: string;
          grade: number | string;
          year: number | string;
          total_questions?: number;
        }) => {
          const paperQuestions = questionRows
            .filter((q: { paper_id: string }) => q.paper_id === p.id)
            .map(
              (q: {
                id: string;
                number: string;
                text: string;
                options?: string[];
                section: string;
                type: string;
                marks: number;
                diagram?: string;
                diagram_url?: string;
              }): Question => ({
                id: q.id,
                number: String(q.number ?? ""),
                text: q.text ?? "",
                options: Array.isArray(q.options) ? q.options : [],
                section: q.section ?? "",
                type: (q.type as Question["type"]) || "Short",
                marks: Number(q.marks) ?? 0,
                diagram: (q as { diagram?: string }).diagram ?? undefined,
                diagram_url: signedDiagramUrls.get(q.id),
              })
            );
          return {
            id: p.id,
            filename: p.file_name,
            subject: String(p.subject ?? ""),
            grade: String(p.grade ?? ""),
            year: String(p.year ?? ""),
            uploadedAt: new Date().toISOString(),
            totalPages: 0,
            questions: paperQuestions,
          };
        }
      );
      const stats = getStatistics(papers);
      return NextResponse.json({
        success: true,
        papers,
        statistics: stats,
        count: papers.length,
      });
    } catch {
      console.warn("[question-paper-api]", {
        requestId,
        operation: "list",
        outcome: "database_exception",
      });
      return questionPaperServerError(requestId);
    }
  } catch {
    console.warn("[question-paper-api]", {
      requestId,
      operation: "list",
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

    const isWindows = platform() === "win32";
    const venvPython = isWindows
      ? join(process.cwd(), "venv", "Scripts", "python.exe")
      : join(process.cwd(), "venv", "bin", "python3");
    const systemPython = isWindows ? "python" : "python3";
    const pythonCmd = existsSync(venvPython) ? venvPython : systemPython;
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

    const scriptPath = join(process.cwd(), "scripts", "extract_pdf.py");
    const args = [
      scriptPath,
      "--pdf", filepath,
      "--subject", subject,
      "--grade", gradeParam,
      "--year", year,
      "--output", tempOutputPath,
      "--work-dir", workDir,
    ];

    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      QUESTION_PAPER_MAX_PDF_PAGES: String(limits.maxPages),
    };
    delete childEnv.GEMINI_API_KEY;
    delete childEnv.GOOGLE_API_KEY;

    try {
      await execFileAsync(pythonCmd, args, {
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024,
        env: childEnv,
        timeout: limits.ocrTimeoutMs,
        killSignal: "SIGKILL",
      });
    } catch {
      console.warn("[question-paper-api]", {
        requestId,
        operation: "extract_pdf",
        outcome: "processing_error",
      });
      await markSourceFailed(sourceId, "internal");
      return NextResponse.json(
        {
          success: false,
          sourceId,
          status: "failed",
          error: userSafeUploadError("failed"),
          requestId,
        },
        { status: 422 },
      );
    }

    const resultStat = await readFile(tempOutputPath).catch(() => null);
    if (!resultStat || resultStat.byteLength === 0 || resultStat.byteLength > MAX_EXTRACT_RESULT_BYTES) {
      await markSourceFailed(sourceId, "validation");
      return NextResponse.json(
        {
          success: false,
          sourceId,
          status: "failed",
          error: userSafeUploadError("failed"),
          requestId,
        },
        { status: 422 },
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(resultStat.toString("utf8"));
    } catch {
      await markSourceFailed(sourceId, "parse");
      return NextResponse.json(
        {
          success: false,
          sourceId,
          status: "failed",
          error: userSafeUploadError("failed"),
          requestId,
        },
        { status: 422 },
      );
    }

    const document = validateDocumentResult(parsed, pageCount);
    if (!document.ok) {
      await markSourceFailed(sourceId, "validation");
      return NextResponse.json(
        {
          success: false,
          sourceId,
          status: "failed",
          error: userSafeUploadError("failed"),
          requestId,
        },
        { status: 422 },
      );
    }

    const plan = buildPersistencePlan(document.pages);
    if (!plan.ok || !Array.isArray(plan.questions)) {
      await markSourceFailed(sourceId, "validation");
      return NextResponse.json(
        {
          success: false,
          sourceId,
          status: "failed",
          error: userSafeUploadError("failed"),
          requestId,
        },
        { status: 422 },
      );
    }

    const persistableQuestions = plan.questions.filter(
      (question): question is NonNullable<typeof question> => Boolean(question),
    );
    const persistInput = {
      sourceId,
      plan: {
        status: plan.status ?? "failed",
        processedPageCount: plan.processedPageCount ?? 0,
        failedPageNumbers: plan.failedPageNumbers ?? [],
        questions: persistableQuestions,
        errorCategory: plan.errorCategory ?? null,
      },
    };

    if (plan.status === "failed") {
      try {
        await persistExtractedQuestions(persistInput);
      } catch {
        await markSourceFailed(sourceId, plan.errorCategory || "internal");
      }
      return NextResponse.json(
        {
          success: false,
          sourceId,
          status: "failed",
          error: userSafeUploadError("failed"),
          requestId,
        },
        { status: 422 },
      );
    }

    let persisted: {
      extracted_question_count?: number;
      extraction_status?: string;
    };
    try {
      persisted = await persistExtractedQuestions(persistInput);
    } catch {
      console.warn("[question-paper-api]", {
        requestId,
        operation: "persist_extracted_questions",
        outcome: "database_error",
      });
      await markSourceFailed(sourceId, "internal");
      return questionPaperServerError(requestId);
    }

    const diagramObjects: CreatedStorageObject[] = [];
    try {
      diagramObjects.push(
        ...(await attachQuestionDiagrams({
          sourceId,
          questions: persistableQuestions,
          maxDiagramBytes: limits.maxDiagramBytes,
        })),
      );
    } catch {
      await deleteCreatedStorageObjects(diagramObjects);
      console.warn("[question-paper-api]", {
        requestId,
        operation: "attach_diagrams",
        outcome: "storage_error",
      });
    }

    const savedCount = Number(persisted.extracted_question_count ?? plan.questions.length);
    const status = persisted.extraction_status === "completed" || persisted.extraction_status === "partial"
      ? persisted.extraction_status
      : plan.status;

    if (status === "partial") {
      return NextResponse.json({
        success: true,
        sourceId,
        status: "partial",
        totalPages: pageCount,
        processedPages: plan.processedPageCount,
        failedPages: plan.failedPageNumbers,
        savedQuestionCount: savedCount,
        warning: userSafeUploadError("partial"),
        requestId,
      });
    }

    return NextResponse.json({
      success: true,
      sourceId,
      status: "completed",
      totalPages: pageCount,
      processedPages: plan.processedPageCount,
      failedPages: [],
      savedQuestionCount: savedCount,
      requestId,
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
 * Delete questions by IDs or clear all (Supabase only).
 */
export async function DELETE(request: NextRequest) {
  const authorization = await requireQuestionPaperApiAccess(request, {
    mutation: true,
  });
  if (!authorization.ok) return authorization.response;
  const { requestId } = authorization;

  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { questionIds } = body;
    const hasSupabase =
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!hasSupabase) {
      return questionPaperServerError(requestId);
    }

    if (!questionIds || questionIds.length === 0) {
      const { data: allQuestions, error: listQuestionsError } =
        await getSupabase().from("questions").select("id");
      if (listQuestionsError) return questionPaperServerError(requestId);
      const ids = (allQuestions ?? []).map((r: { id: string }) => r.id);
      const deletedCount = ids.length;
      if (ids.length > 0) {
        const { error: deleteQuestionsError } = await getSupabase()
          .from("questions")
          .delete()
          .in("id", ids);
        if (deleteQuestionsError) return questionPaperServerError(requestId);
      }
      const { data: allPapers, error: listPapersError } = await getSupabase()
        .from("question_papers")
        .select("id");
      if (listPapersError) return questionPaperServerError(requestId);
      const paperIds = (allPapers ?? []).map((r: { id: string }) => r.id);
      if (paperIds.length > 0) {
        const { error: deletePapersError } = await getSupabase()
          .from("question_papers")
          .delete()
          .in("id", paperIds);
        if (deletePapersError) return questionPaperServerError(requestId);
      }
      return NextResponse.json({
        success: true,
        message: "All questions cleared",
        deletedCount,
      });
    }

    const { error } = await getSupabase().from("questions").delete().in("id", questionIds);
    if (error) {
      console.warn("[question-paper-api]", {
        requestId,
        operation: "delete_questions",
        outcome: "database_error",
      });
      return questionPaperServerError(requestId);
    }
    return NextResponse.json({
      success: true,
      message: `Deleted ${questionIds.length} question(s)`,
      deletedCount: questionIds.length,
    });
  } catch {
    console.warn("[question-paper-api]", {
      requestId,
      operation: "delete_questions",
      outcome: "request_error",
    });
    return questionPaperServerError(requestId);
  }
}

