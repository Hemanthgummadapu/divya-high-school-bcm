import { NextRequest, NextResponse } from "next/server";
import {
  questionPaperServerError,
  requireQuestionPaperApiAccess,
} from "@/lib/question-paper-auth";
import { validateUploadContentLength } from "@/lib/question-paper-upload-policy.mjs";
import {
  MAX_GENERATE_BODY_BYTES,
  buildPaperSnapshots,
  parseGenerateRequest,
  verifyBankQuestions,
} from "@/lib/question-bank-v2-paper.mjs";
import {
  generateAndStorePaperPdf,
  getSavedPaperDetail,
  loadBankQuestions,
  loadSavedPaper,
  loadSavedPaperItems,
  saveQuestionPaper,
} from "@/lib/question-bank-v2-paper-api";

export const dynamic = "force-dynamic";

function jsonError(
  requestId: string,
  error: string,
  status: number,
  extra: Record<string, unknown> = {},
) {
  return NextResponse.json(
    { success: false, error, requestId, ...extra },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * POST /api/question-papers/generate
 * Canonical V2 paper builder: finalize snapshots, generate JK-82 PDF, store privately.
 */
export async function POST(request: NextRequest) {
  const authorization = await requireQuestionPaperApiAccess(request, {
    mutation: true,
  });
  if (!authorization.ok) return authorization.response;
  const { requestId } = authorization;
  const contentLengthError = validateUploadContentLength(
    request.headers.get("content-length"),
    MAX_GENERATE_BODY_BYTES,
  );
  if (contentLengthError) {
    return jsonError(
      requestId,
      contentLengthError.error,
      contentLengthError.status,
    );
  }

  try {
    const body = await request.json();
    const parsed = parseGenerateRequest(body);
    if (!parsed.ok) {
      return jsonError(requestId, parsed.error || "Invalid request", 400);
    }

    if (parsed.action === "retry") {
      const paper = await loadSavedPaper(parsed.paperId);
      if (!paper) return jsonError(requestId, "Paper not found", 404);
      if (paper.status !== "final") {
        return jsonError(requestId, "Only a finalized paper can retry its PDF", 400);
      }
      if (paper.pdf_storage_path) {
        return jsonError(requestId, "This paper already has a PDF", 409);
      }
      const items = await loadSavedPaperItems(parsed.paperId);
      if (items.length === 0) {
        return jsonError(requestId, "This paper has no saved questions", 400);
      }
      try {
        const generated = await generateAndStorePaperPdf({
          paperId: parsed.paperId,
          paper,
          items,
        });
        const detail = await getSavedPaperDetail(parsed.paperId);
        return NextResponse.json(
          {
            success: true,
            stage: "ready",
            paper: detail?.paper,
            pdfUrl: generated.pdfUrl,
            retried: true,
            requestId,
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      } catch (error) {
        const code = error instanceof Error ? error.message : "";
        if (code === "generator_timeout") {
          return jsonError(requestId, "PDF generation timed out", 504, {
            paperSaved: true,
            paperId: parsed.paperId,
          });
        }
        return jsonError(requestId, "The paper was saved, but the PDF could not be created", 500, {
          paperSaved: true,
          paperId: parsed.paperId,
        });
      }
    }

    if (!parsed.items || !parsed.creationKey) {
      return jsonError(requestId, "Invalid request", 400);
    }
    // A draft save and a finalize follow the same authoritative path: only a
    // finalize generates a PDF.
    const finalize = parsed.action !== "draft";

    // Editing is only ever allowed while the paper is still a draft; a
    // finalized paper's snapshots must keep matching its generated PDF.
    if (parsed.paperId) {
      const existing = await loadSavedPaper(parsed.paperId);
      if (!existing) return jsonError(requestId, "Paper not found", 404);
      if (existing.status !== "draft") {
        return jsonError(
          requestId,
          "This paper is already final and cannot be edited",
          409,
        );
      }
    }

    const requestedIds = parsed.items.map((item) => item.questionId);
    const rows = await loadBankQuestions(requestedIds);
    const verified = verifyBankQuestions(requestedIds, rows);
    if (!verified.ok) {
      return jsonError(requestId, verified.error || "Invalid questions", 400);
    }
    const built = buildPaperSnapshots(parsed.items, rows);
    if (!built.ok || !built.snapshots) {
      return jsonError(requestId, built.error || "Invalid questions", 400);
    }

    let saved: {
      paper_id?: string;
      idempotent?: boolean;
      total_marks?: number;
      status?: string;
      lock_version?: number;
      item_count?: number;
    };
    try {
      saved = await saveQuestionPaper({
        creationKey: parsed.creationKey,
        paperId: parsed.paperId,
        expectedLockVersion: parsed.expectedLockVersion,
        title: parsed.title,
        grade: verified.grade,
        subject: verified.subject,
        academicYear: parsed.academicYear,
        durationMinutes: parsed.durationMinutes,
        items: built.snapshots,
        finalize,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "creation_key_conflict") {
        return jsonError(requestId, "This paper was already saved with different content", 409);
      }
      if (code === "stale_paper_lock_version") {
        return jsonError(
          requestId,
          "This draft was changed elsewhere. Reload it before saving again.",
          409,
          { staleLock: true },
        );
      }
      if (code === "paper_not_found") {
        return jsonError(requestId, "Paper not found", 404);
      }
      console.warn("[question-paper-api]", {
        requestId,
        operation: "save_question_paper",
        outcome: "database_error",
      });
      return questionPaperServerError(requestId);
    }

    const paperId = saved.paper_id;
    if (!paperId) return questionPaperServerError(requestId);

    if (!finalize) {
      return NextResponse.json(
        {
          success: true,
          stage: "draft",
          paperId,
          status: saved.status ?? "draft",
          lockVersion: saved.lock_version ?? null,
          totalMarks: saved.total_marks ?? 0,
          itemCount: saved.item_count ?? parsed.items.length,
          idempotent: Boolean(saved.idempotent),
          requestId,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const paper = await loadSavedPaper(paperId);
    const items = await loadSavedPaperItems(paperId);
    if (!paper || items.length === 0) {
      return questionPaperServerError(requestId);
    }

    if (paper.pdf_storage_path) {
      const detail = await getSavedPaperDetail(paperId);
      return NextResponse.json(
        {
          success: true,
          stage: "ready",
          paper: detail?.paper,
          pdfUrl: detail?.pdfUrl ?? null,
          idempotent: true,
          requestId,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    try {
      const generated = await generateAndStorePaperPdf({
        paperId,
        paper,
        items,
      });
      const detail = await getSavedPaperDetail(paperId);
      return NextResponse.json(
        {
          success: true,
          stage: "ready",
          paper: detail?.paper,
          pdfUrl: generated.pdfUrl,
          totalMarks: saved.total_marks,
          idempotent: Boolean(saved.idempotent),
          requestId,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      console.warn("[question-paper-api]", {
        requestId,
        operation: "generate_paper_pdf",
        outcome: code || "pdf_error",
      });
      return jsonError(
        requestId,
        "The paper was saved, but the PDF could not be created",
        code === "generator_timeout" ? 504 : 500,
        { paperSaved: true, paperId, stage: "pdf_pending" },
      );
    }
  } catch {
    console.warn("[question-paper-api]", {
      requestId,
      operation: "generate_paper",
      outcome: "request_error",
    });
    return questionPaperServerError(requestId);
  }
}
