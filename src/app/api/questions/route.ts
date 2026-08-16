import { NextRequest, NextResponse } from "next/server";
import { isValidSubjectForGrade } from "@/lib/subjects";
import {
  questionPaperServerError,
  requireQuestionPaperApiAccess,
} from "@/lib/question-paper-auth";
import { validateQuestionFields } from "@/lib/question-bank-v2-review.mjs";
import { createManualV2Question } from "@/lib/question-bank-v2-review-api";

/**
 * POST /api/questions
 * Create a manual V2 question with no source document.
 */
export async function POST(request: NextRequest) {
  const authorization = await requireQuestionPaperApiAccess(request, {
    mutation: true,
  });
  if (!authorization.ok) return authorization.response;
  const { requestId } = authorization;

  try {
    const body = await request.json();
    if (body.sourceId || body.source_id) {
      return NextResponse.json(
        { success: false, error: "Manual questions cannot be attached to a source", requestId },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const action = String(body.action || "save");
    if (action !== "save" && action !== "approve") {
      return NextResponse.json(
        { success: false, error: "Invalid action", requestId },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const validated = validateQuestionFields(body, {
      requireClassification: true,
    });
    if (!validated.ok || !validated.fields) {
      return NextResponse.json(
        { success: false, error: validated.error || "Invalid question", requestId },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const grade = Number(validated.fields.grade);
    const subject = String(validated.fields.subject);
    if (!isValidSubjectForGrade(subject, grade)) {
      return NextResponse.json(
        { success: false, error: "Invalid subject for the selected grade", requestId },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const questionText = String(validated.fields.question_text);
    const question = await createManualV2Question({
      fields: validated.fields,
      reviewStatus: action === "approve" ? "approved" : "needs_review",
      rawExtractedText: questionText,
    });

    return NextResponse.json(
      { success: true, question, requestId },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.warn("[question-paper-api]", {
      requestId,
      operation: "create_question",
      outcome: "request_error",
    });
    return questionPaperServerError(requestId);
  }
}
