import { NextRequest, NextResponse } from "next/server";
import {
  questionPaperServerError,
  requireQuestionPaperApiAccess,
} from "@/lib/question-paper-auth";
import {
  getUploadLimits,
  validatePngDiagram,
  validateUploadContentLength,
} from "@/lib/question-paper-upload-policy.mjs";
import { isSafeQuestionPaperResourceId } from "@/lib/question-paper-security-policy.mjs";
import {
  findForbiddenPatchKeys,
  isUuid,
  parseRequiredLockVersion,
  resolveStatusAction,
  validateQuestionFields,
} from "@/lib/question-bank-v2-review.mjs";
import {
  getV2Question,
  updateV2Question,
} from "@/lib/question-bank-v2-review-api";

/**
 * PATCH /api/questions/[id]
 * Edit a V2 question, replace its diagram, or change review status.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const authorization = await requireQuestionPaperApiAccess(request, {
    mutation: true,
  });
  if (!authorization.ok) return authorization.response;
  const { requestId } = authorization;
  if (!isSafeQuestionPaperResourceId(params.id) || !isUuid(params.id)) {
    return NextResponse.json(
      { success: false, error: "Invalid resource identifier", requestId },
      { status: 422, headers: { "Cache-Control": "no-store" } },
    );
  }
  const uploadLimits = getUploadLimits();
  const contentLengthError = validateUploadContentLength(
    request.headers.get("content-length"),
    Math.ceil((uploadLimits.maxDiagramBytes * 4) / 3),
  );
  if (contentLengthError) {
    return NextResponse.json(
      { success: false, error: contentLengthError.error, requestId },
      { status: contentLengthError.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const body = await request.json();
    const forbidden = findForbiddenPatchKeys(body);
    if (forbidden.length > 0) {
      return NextResponse.json(
        { success: false, error: "These fields cannot be changed", requestId },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const lock = parseRequiredLockVersion(body.lockVersion);
    if (!lock.ok || lock.lockVersion == null) {
      return NextResponse.json(
        { success: false, error: lock.error || "lockVersion is required", requestId },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    let validatedDiagramBytes: Buffer | undefined;
    if (typeof body.diagram === "string" && body.diagram.trim().length > 0) {
      const diagramValidation = validatePngDiagram(
        body.diagram,
        uploadLimits.maxDiagramBytes,
      );
      if (diagramValidation.status !== 200) {
        return NextResponse.json(
          { success: false, error: diagramValidation.error, requestId },
          {
            status: diagramValidation.status,
            headers: { "Cache-Control": "no-store" },
          },
        );
      }
      if (!diagramValidation.bytes) return questionPaperServerError(requestId);
      validatedDiagramBytes = diagramValidation.bytes;
    }

    const existing = await getV2Question(params.id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Question not found", requestId },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    const transition = resolveStatusAction(
      body.action,
      existing.row.review_status,
    );
    if (!transition.ok) {
      return NextResponse.json(
        { success: false, error: transition.error, requestId },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const appliesEdits =
      !body.action || body.action === "save" || body.action === "approve";
    let fields: Record<string, unknown> = {};
    if (appliesEdits) {
      const merged = {
        questionText: body.questionText ?? existing.row.question_text,
        questionType: body.questionType ?? existing.row.question_type,
        marks: body.marks ?? existing.row.marks,
        sectionLabel: body.sectionLabel ?? existing.row.section_label,
        options: body.options ?? existing.row.options,
        correctAnswer: body.correctAnswer ?? existing.row.correct_answer,
        language: body.language ?? existing.row.language,
        chapter: body.chapter ?? existing.row.chapter,
        topic: body.topic ?? existing.row.topic,
      };
      const validated = validateQuestionFields(merged);
      if (!validated.ok || !validated.fields) {
        return NextResponse.json(
          { success: false, error: validated.error || "Invalid question", requestId },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
      fields = validated.fields;
    }

    const updated = await updateV2Question({
      questionId: params.id,
      lockVersion: lock.lockVersion,
      fields,
      nextStatus: transition.nextStatus,
      diagramBytes: validatedDiagramBytes,
    });
    if (updated.stale) {
      return NextResponse.json(
        { success: false, error: "This question was changed by another save", requestId },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      {
        success: true,
        question: updated.question,
        lockVersion: updated.question?.lockVersion,
        requestId,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.warn("[question-paper-api]", {
      requestId,
      operation: "update_question",
      outcome: "request_error",
    });
    return questionPaperServerError(requestId);
  }
}
