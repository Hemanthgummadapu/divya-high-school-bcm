import { execFile } from "child_process";
import { promisify } from "util";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { platform } from "os";
import { NextResponse } from "next/server";
import { questionPaperServerError } from "@/lib/question-paper-auth";
import {
  MAX_EXTRACT_RESULT_BYTES,
  buildPersistencePlan,
  userSafeUploadError,
  validateDocumentResult,
} from "@/lib/question-bank-v2-extract.mjs";
import { logExtractionStage } from "@/lib/question-bank-v2-diagnostics.mjs";
import {
  PersistRpcError,
  attachQuestionDiagrams,
  deleteCreatedStorageObjects,
  markSourceFailed,
  persistExtractedQuestions,
  type CreatedStorageObject,
} from "@/lib/question-bank-v2-persist";

const execFileAsync = promisify(execFile);

export function resolveExtractPython(cwd = process.cwd()) {
  const isWindows = platform() === "win32";
  const venvPython = isWindows
    ? join(cwd, "venv", "Scripts", "python.exe")
    : join(cwd, "venv", "bin", "python3");
  const systemPython = isWindows ? "python" : "python3";
  return existsSync(venvPython) ? venvPython : systemPython;
}

export async function runExtractAndPersist(input: {
  sourceId: string;
  pdfPath: string;
  workDir: string;
  outputPath: string;
  subject: string;
  grade: string;
  year: string;
  pageCount: number;
  requestId: string;
  limits: {
    ocrTimeoutMs: number;
    maxPages: number;
    maxDiagramBytes: number;
  };
  startedAt: number;
}) {
  const pythonCmd = resolveExtractPython();
  const scriptPath = join(process.cwd(), "scripts", "extract_pdf.py");
  const args = [
    scriptPath,
    "--pdf",
    input.pdfPath,
    "--subject",
    input.subject,
    "--grade",
    input.grade,
    "--year",
    input.year,
    "--output",
    input.outputPath,
    "--work-dir",
    input.workDir,
  ];

  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    QUESTION_PAPER_MAX_PDF_PAGES: String(input.limits.maxPages),
  };
  delete childEnv.GEMINI_API_KEY;
  delete childEnv.GOOGLE_API_KEY;

  logExtractionStage({
    requestId: input.requestId,
    sourceId: input.sourceId,
    stage: "python_spawn",
    elapsedMs: Date.now() - input.startedAt,
  });

  try {
    await execFileAsync(pythonCmd, args, {
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024,
      env: childEnv,
      timeout: input.limits.ocrTimeoutMs,
      killSignal: "SIGKILL",
    });
  } catch {
    logExtractionStage({
      requestId: input.requestId,
      sourceId: input.sourceId,
      stage: "python_spawn",
      errorCategory: "internal",
      elapsedMs: Date.now() - input.startedAt,
    });
    await markSourceFailed(input.sourceId, "internal");
    logExtractionStage({
      requestId: input.requestId,
      sourceId: input.sourceId,
      stage: "failed_source_update",
      errorCategory: "internal",
      elapsedMs: Date.now() - input.startedAt,
    });
    return NextResponse.json(
      {
        success: false,
        sourceId: input.sourceId,
        status: "failed",
        error: userSafeUploadError("failed"),
        requestId: input.requestId,
      },
      { status: 422 },
    );
  }

  const resultStat = await readFile(input.outputPath).catch(() => null);
  if (
    !resultStat ||
    resultStat.byteLength === 0 ||
    resultStat.byteLength > MAX_EXTRACT_RESULT_BYTES
  ) {
    logExtractionStage({
      requestId: input.requestId,
      sourceId: input.sourceId,
      stage: "json_parsing",
      errorCategory: "validation",
      elapsedMs: Date.now() - input.startedAt,
    });
    await markSourceFailed(input.sourceId, "validation");
    return NextResponse.json(
      {
        success: false,
        sourceId: input.sourceId,
        status: "failed",
        error: userSafeUploadError("failed"),
        requestId: input.requestId,
      },
      { status: 422 },
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(resultStat.toString("utf8"));
  } catch {
    logExtractionStage({
      requestId: input.requestId,
      sourceId: input.sourceId,
      stage: "json_parsing",
      errorCategory: "parse",
      elapsedMs: Date.now() - input.startedAt,
    });
    await markSourceFailed(input.sourceId, "parse");
    return NextResponse.json(
      {
        success: false,
        sourceId: input.sourceId,
        status: "failed",
        error: userSafeUploadError("failed"),
        requestId: input.requestId,
      },
      { status: 422 },
    );
  }

  const document = validateDocumentResult(parsed, input.pageCount);
  if (!document.ok) {
    logExtractionStage({
      requestId: input.requestId,
      sourceId: input.sourceId,
      stage: "node_normalization",
      errorCategory: "validation",
      elapsedMs: Date.now() - input.startedAt,
    });
    await markSourceFailed(input.sourceId, "validation");
    return NextResponse.json(
      {
        success: false,
        sourceId: input.sourceId,
        status: "failed",
        error: userSafeUploadError("failed"),
        requestId: input.requestId,
      },
      { status: 422 },
    );
  }

  const plan = buildPersistencePlan(document.pages);
  if (!plan.ok || !Array.isArray(plan.questions)) {
    logExtractionStage({
      requestId: input.requestId,
      sourceId: input.sourceId,
      stage: "node_normalization",
      errorCategory: "validation",
      elapsedMs: Date.now() - input.startedAt,
    });
    await markSourceFailed(input.sourceId, "validation");
    return NextResponse.json(
      {
        success: false,
        sourceId: input.sourceId,
        status: "failed",
        error: userSafeUploadError("failed"),
        requestId: input.requestId,
      },
      { status: 422 },
    );
  }

  logExtractionStage({
    requestId: input.requestId,
    sourceId: input.sourceId,
    stage: "node_normalization",
    elapsedMs: Date.now() - input.startedAt,
  });

  const persistableQuestions = plan.questions.filter(
    (question): question is NonNullable<typeof question> => Boolean(question),
  );
  const persistInput = {
    sourceId: input.sourceId,
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
    } catch (error) {
      const persistError =
        error instanceof PersistRpcError ? error : new PersistRpcError(error);
      logExtractionStage({
        requestId: input.requestId,
        sourceId: input.sourceId,
        stage: "persistence_rpc",
        errorCategory: plan.errorCategory || "internal",
        providerHttpStatusClass: persistError.httpStatusClass ?? undefined,
        elapsedMs: Date.now() - input.startedAt,
      });
      await markSourceFailed(input.sourceId, plan.errorCategory || "internal");
    }
    return NextResponse.json(
      {
        success: false,
        sourceId: input.sourceId,
        status: "failed",
        error: userSafeUploadError("failed"),
        requestId: input.requestId,
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
  } catch (error) {
    const persistError =
      error instanceof PersistRpcError ? error : new PersistRpcError(error);
    logExtractionStage({
      requestId: input.requestId,
      sourceId: input.sourceId,
      stage: "persistence_rpc",
      errorCategory: "internal",
      providerHttpStatusClass: persistError.httpStatusClass ?? undefined,
      elapsedMs: Date.now() - input.startedAt,
    });
    console.warn("[question-paper-api]", {
      requestId: input.requestId,
      sourceId: input.sourceId,
      operation: "persist_extracted_questions",
      outcome: "database_error",
      errorCategory: persistError.sanitizedCategory,
    });
    await markSourceFailed(input.sourceId, "internal");
    logExtractionStage({
      requestId: input.requestId,
      sourceId: input.sourceId,
      stage: "failed_source_update",
      errorCategory: "internal",
      elapsedMs: Date.now() - input.startedAt,
    });
    return questionPaperServerError(input.requestId);
  }

  logExtractionStage({
    requestId: input.requestId,
    sourceId: input.sourceId,
    stage: "persistence_rpc",
    elapsedMs: Date.now() - input.startedAt,
  });

  const diagramObjects: CreatedStorageObject[] = [];
  try {
    diagramObjects.push(
      ...(await attachQuestionDiagrams({
        sourceId: input.sourceId,
        questions: persistableQuestions,
        maxDiagramBytes: input.limits.maxDiagramBytes,
      })),
    );
  } catch {
    await deleteCreatedStorageObjects(diagramObjects);
    console.warn("[question-paper-api]", {
      requestId: input.requestId,
      operation: "attach_diagrams",
      outcome: "storage_error",
    });
  }

  const savedCount = Number(
    persisted.extracted_question_count ?? plan.questions.length,
  );
  const status =
    persisted.extraction_status === "completed" ||
    persisted.extraction_status === "partial"
      ? persisted.extraction_status
      : plan.status;

  if (status === "partial") {
    return NextResponse.json({
      success: true,
      sourceId: input.sourceId,
      status: "partial",
      totalPages: input.pageCount,
      processedPages: plan.processedPageCount,
      failedPages: plan.failedPageNumbers,
      savedQuestionCount: savedCount,
      warning: userSafeUploadError("partial"),
      requestId: input.requestId,
    });
  }

  return NextResponse.json({
    success: true,
    sourceId: input.sourceId,
    status: "completed",
    totalPages: input.pageCount,
    processedPages: plan.processedPageCount,
    failedPages: [],
    savedQuestionCount: savedCount,
    requestId: input.requestId,
  });
}
