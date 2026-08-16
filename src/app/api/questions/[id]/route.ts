import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-server";
import type { Question } from "@/lib/questionPapers";
import {
  questionPaperServerError,
  requireQuestionPaperApiAccess,
} from "@/lib/question-paper-auth";
import {
  createSignedQuestionDiagramUrl,
  QUESTION_DIAGRAM_BUCKET,
} from "@/lib/question-diagrams";
import {
  getUploadLimits,
  validatePngDiagram,
  validateUploadContentLength,
} from "@/lib/question-paper-upload-policy.mjs";
import { isSafeQuestionPaperResourceId } from "@/lib/question-paper-security-policy.mjs";

/**
 * PATCH /api/questions/[id]
 * Update a question (e.g. diagram). If diagram base64 is provided, upload to Storage and set diagram_url.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authorization = await requireQuestionPaperApiAccess(request, {
    mutation: true,
  });
  if (!authorization.ok) return authorization.response;
  const { requestId } = authorization;
  if (!isSafeQuestionPaperResourceId(params.id)) {
    return NextResponse.json(
      { success: false, error: "Invalid resource identifier", requestId },
      { status: 422 },
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
      { status: contentLengthError.status },
    );
  }

  try {
    const body = await request.json();
    const { text, options, marks, diagram } = body;
    let validatedDiagramBytes: Buffer | undefined;
    if (typeof diagram === "string" && diagram.trim().length > 0) {
      const diagramValidation = validatePngDiagram(
        diagram,
        uploadLimits.maxDiagramBytes,
      );
      if (diagramValidation.status !== 200) {
        return NextResponse.json(
          {
            success: false,
            error: diagramValidation.error,
            requestId,
          },
          { status: diagramValidation.status },
        );
      }
      if (!diagramValidation.bytes) return questionPaperServerError(requestId);
      validatedDiagramBytes = diagramValidation.bytes;
    }

    const hasSupabase =
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!hasSupabase) {
      return questionPaperServerError(requestId);
    }

    const { data: existing, error: fetchError } = await getSupabase()
      .from("questions")
      .select("id, text, options, marks, diagram_url")
      .eq("id", params.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: "Question not found" },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (typeof text === "string") updates.text = text;
    if (Array.isArray(options)) updates.options = options;
    if (typeof marks === "number" && marks >= 0) updates.marks = marks;

    const canonicalPath = `${params.id}.png`;
    if (validatedDiagramBytes) {
      updates.diagram_url = canonicalPath;
    }

    if (Object.keys(updates).length === 0) {
      const existingDiagramUrl = await createSignedQuestionDiagramUrl(
        params.id,
        (existing as { diagram_url?: string }).diagram_url,
      );
      return NextResponse.json({
        success: true,
        question: { ...existing, diagram_url: existingDiagramUrl },
        diagram_url: existingDiagramUrl,
      });
    }

    const { data: updated, error: updateError } = await getSupabase()
      .from("questions")
      .update(updates)
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) {
      return questionPaperServerError(requestId);
    }

    if (validatedDiagramBytes) {
      const { error: bucketError } = await getSupabase()
        .storage.from(QUESTION_DIAGRAM_BUCKET)
        .upload(canonicalPath, validatedDiagramBytes, {
          contentType: "image/png",
          upsert: true,
        });
      if (bucketError) {
        const previousPath = (existing as { diagram_url?: string }).diagram_url;
        if (previousPath !== canonicalPath) {
          await getSupabase()
            .from("questions")
            .update({ diagram_url: previousPath ?? null })
            .eq("id", params.id);
        }
        return questionPaperServerError(requestId);
      }
    }

    const q = updated as {
      id: string;
      number: string;
      text: string;
      options: string[];
      section: string;
      type: string;
      marks: number;
      diagram_url?: string;
    };

    const question: Question = {
      id: q.id,
      number: String(q.number ?? ""),
      text: q.text ?? "",
      options: Array.isArray(q.options) ? q.options : [],
      section: q.section ?? "",
      type: (q.type as Question["type"]) || "Short",
      marks: Number(q.marks) ?? 0,
      diagram_url: await createSignedQuestionDiagramUrl(
        q.id,
        q.diagram_url,
      ).catch(() => undefined),
    };

    return NextResponse.json({
      success: true,
      question,
      diagram_url: question.diagram_url,
    });
  } catch {
    console.warn("[question-paper-api]", {
      requestId,
      operation: "update_question",
      outcome: "request_error",
    });
    return questionPaperServerError(requestId);
  }
}
