import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  questionPaperServerError,
  requireQuestionPaperApiAccess,
} from "@/lib/question-paper-auth";
import { isSafeQuestionPaperResourceId } from "@/lib/question-paper-security-policy.mjs";
import { isAnthropicConfigured } from "@/lib/question-paper-provider-policy.mjs";
import { getUploadLimits } from "@/lib/question-paper-upload-policy.mjs";
import { isUuid } from "@/lib/question-bank-v2-review.mjs";
import { computePdfSha256, parseValidatePdfPagesStdout } from "@/lib/question-bank-v2-extract.mjs";
import { logExtractionStage } from "@/lib/question-bank-v2-diagnostics.mjs";
import {
  runExtractAndPersist,
  resolveExtractPython,
} from "@/lib/question-bank-v2-extract-run";
import {
  claimFailedSourceForRetry,
  downloadSourcePdfBytes,
  inspectRetryEligibility,
  markSourceFailed,
} from "@/lib/question-bank-v2-persist";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
export const dynamic = "force-dynamic";

/**
 * POST /api/question-papers/[id]/retry
 * Retry extraction for an eligible failed source. Reuses the retained PDF.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const authorization = await requireQuestionPaperApiAccess(request, {
    mutation: true,
  });
  if (!authorization.ok) return authorization.response;
  const { requestId } = authorization;
  const startedAt = Date.now();

  if (!isSafeQuestionPaperResourceId(params.id) || !isUuid(params.id)) {
    return NextResponse.json(
      { success: false, error: "Invalid resource identifier", requestId },
      { status: 422, headers: { "Cache-Control": "no-store" } },
    );
  }

  const sourceId = params.id;
  let workDir: string | null = null;
  let claimed = false;

  try {
    if (!isAnthropicConfigured(process.env.ANTHROPIC_API_KEY)) {
      logExtractionStage({
        requestId,
        sourceId,
        stage: "anthropic_request",
        errorCategory: "provider",
        elapsedMs: Date.now() - startedAt,
      });
      return questionPaperServerError(requestId);
    }

    const inspected = await inspectRetryEligibility(sourceId);
    if (!inspected.ok) {
      logExtractionStage({
        requestId,
        sourceId,
        stage: "retry_claim",
        errorCategory: "validation",
        elapsedMs: Date.now() - startedAt,
      });
      return NextResponse.json(
        {
          success: false,
          error:
            inspected.reason === "not_found"
              ? "Source not found"
              : "This source cannot be retried",
          requestId,
        },
        { status: inspected.status, headers: { "Cache-Control": "no-store" } },
      );
    }

    const claimedRow = await claimFailedSourceForRetry(sourceId);
    if (!claimedRow.ok) {
      logExtractionStage({
        requestId,
        sourceId,
        stage: "retry_claim",
        errorCategory: "validation",
        elapsedMs: Date.now() - startedAt,
      });
      return NextResponse.json(
        {
          success: false,
          error: "This source is already being retried",
          requestId,
        },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    claimed = true;
    logExtractionStage({
      requestId,
      sourceId,
      stage: "retry_claim",
      elapsedMs: Date.now() - startedAt,
    });

    let downloaded: Buffer;
    try {
      downloaded = await downloadSourcePdfBytes(sourceId);
    } catch {
      await markSourceFailed(sourceId, "internal");
      logExtractionStage({
        requestId,
        sourceId,
        stage: "source_download",
        errorCategory: "internal",
        elapsedMs: Date.now() - startedAt,
      });
      return NextResponse.json(
        {
          success: false,
          error: "The retained PDF could not be read",
          requestId,
        },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    const checksum = computePdfSha256(downloaded);
    if (
      checksum !== inspected.source.content_sha256 ||
      downloaded.byteLength !== inspected.source.byte_size
    ) {
      await markSourceFailed(sourceId, "validation");
      logExtractionStage({
        requestId,
        sourceId,
        stage: "source_download",
        errorCategory: "validation",
        elapsedMs: Date.now() - startedAt,
      });
      return NextResponse.json(
        {
          success: false,
          error: "The retained PDF no longer matches the stored source",
          requestId,
        },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    workDir = await mkdtemp(join(tmpdir(), `qb-retry-${requestId}-`));
    const filepath = join(workDir, "original.pdf");
    const tempOutputPath = join(workDir, "extract.json");
    await writeFile(filepath, downloaded);

    const limits = getUploadLimits();
    const pythonCmd = resolveExtractPython();
    const validateScript = join(process.cwd(), "scripts", "validate_pdf_pages.py");
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
      await markSourceFailed(sourceId, "validation");
      return NextResponse.json(
        {
          success: false,
          error: "The retained PDF could not be validated",
          requestId,
        },
        { status: 422, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (!pageCount || pageCount !== inspected.source.page_count) {
      await markSourceFailed(sourceId, "validation");
      logExtractionStage({
        requestId,
        sourceId,
        stage: "pdf_validation",
        errorCategory: "validation",
        elapsedMs: Date.now() - startedAt,
      });
      return NextResponse.json(
        {
          success: false,
          error: "The retained PDF no longer matches the stored source",
          requestId,
        },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    return await runExtractAndPersist({
      sourceId,
      pdfPath: filepath,
      workDir,
      outputPath: tempOutputPath,
      subject: String(inspected.source.subject),
      grade: String(inspected.source.grade),
      year: String(inspected.source.academic_year),
      pageCount,
      requestId,
      limits,
      startedAt,
    });
  } catch {
    logExtractionStage({
      requestId,
      sourceId,
      stage: "failed_source_update",
      errorCategory: "internal",
      elapsedMs: Date.now() - startedAt,
    });
    if (claimed) {
      await markSourceFailed(sourceId, "internal").catch(() => {});
    }
    return questionPaperServerError(requestId);
  } finally {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
