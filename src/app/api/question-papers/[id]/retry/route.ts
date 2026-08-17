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
import {
  logExtractionStage,
  logRetryRejection,
} from "@/lib/question-bank-v2-diagnostics.mjs";
import { runRetrySpendControl } from "@/lib/question-bank-v2-retry-run.mjs";
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
    const result = await runRetrySpendControl(
      {
        sourceId,
        requestId,
        elapsedMs: Date.now() - startedAt,
      },
      {
        inspectRetryEligibility,
        claimFailedSourceForRetry,
        isAnthropicConfigured: () =>
          isAnthropicConfigured(process.env.ANTHROPIC_API_KEY),
        downloadSourcePdfBytes,
        computePdfSha256,
        createTempDir: async () => {
          workDir = await mkdtemp(join(tmpdir(), `qb-retry-${requestId}-`));
          return workDir;
        },
        writeSourcePdf: async (dir: string, bytes: Buffer) => {
          await writeFile(join(dir, "original.pdf"), bytes);
        },
        validatePdfPages: async (dir: string) => {
          const limits = getUploadLimits();
          const validation = await execFileAsync(
            resolveExtractPython(),
            [
              join(process.cwd(), "scripts", "validate_pdf_pages.py"),
              "--pdf",
              join(dir, "original.pdf"),
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
          return parseValidatePdfPagesStdout(validation.stdout);
        },
        runExtractAndPersist: async ({
          source,
          pageCount,
          workDir: dir,
        }: {
          source: Record<string, unknown>;
          pageCount: number;
          workDir: string;
        }) => {
          const limits = getUploadLimits();
          return await runExtractAndPersist({
            sourceId,
            pdfPath: join(dir, "original.pdf"),
            workDir: dir,
            outputPath: join(dir, "extract.json"),
            subject: String(source.subject),
            grade: String(source.grade),
            year: String(source.academic_year),
            pageCount,
            requestId,
            limits,
            startedAt,
          });
        },
        markSourceFailed,
        logRetryRejection,
      },
    );
    claimed = result.claimed;
    if (result.workDir) workDir = result.workDir;

    if (!result.ok) {
      if (result.status === 500) {
        logExtractionStage({
          requestId,
          sourceId,
          stage: "anthropic_request",
          errorCategory: "provider",
          elapsedMs: Date.now() - startedAt,
        });
        return questionPaperServerError(requestId);
      }
      return NextResponse.json(
        {
          success: false,
          error:
            result.reason === "not_found"
              ? "Source not found"
              : result.reason === "conflict"
                ? "This source is already being retried"
                : result.reason === "download_failed"
                  ? "The retained PDF could not be read"
                  : result.reason === "checksum_mismatch" ||
                      result.reason === "page_count_mismatch"
                    ? "The retained PDF no longer matches the stored source"
                    : "This source cannot be retried",
          requestId,
        },
        { status: result.status, headers: { "Cache-Control": "no-store" } },
      );
    }

    return result.response as NextResponse;
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
