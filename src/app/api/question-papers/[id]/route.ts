import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-server";
import type { QuestionPaper, Question } from "@/lib/questionPapers";
import {
  questionPaperServerError,
  requireQuestionPaperApiAccess,
} from "@/lib/question-paper-auth";
import {
  createSignedQuestionDiagramUrl,
  createSignedQuestionDiagramUrls,
  QUESTION_DIAGRAM_BUCKET,
} from "@/lib/question-diagrams";
import {
  getUploadLimits,
  validatePngDiagram,
  validateUploadContentLength,
} from "@/lib/question-paper-upload-policy.mjs";
import { isSafeQuestionPaperResourceId } from "@/lib/question-paper-security-policy.mjs";

export const dynamic = "force-dynamic";

/**
 * GET /api/question-papers/[id]
 * Get a single question paper by ID from Supabase
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authorization = await requireQuestionPaperApiAccess(request);
  if (!authorization.ok) return authorization.response;
  const { requestId } = authorization;
  if (!isSafeQuestionPaperResourceId(params.id)) {
    return NextResponse.json(
      { success: false, error: "Invalid resource identifier", requestId },
      { status: 422 },
    );
  }

  try {
    const hasSupabase =
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!hasSupabase) {
      return questionPaperServerError(requestId);
    }

    const { data: paperRow, error: paperError } = await getSupabase()
      .from("question_papers")
      .select("*")
      .eq("id", params.id)
      .single();

    if (paperError || !paperRow) {
      return NextResponse.json(
        { success: false, error: "Paper not found" },
        { status: 404 }
      );
    }

    const { data: questionRows, error: questionsError } = await getSupabase()
      .from("questions")
      .select("*")
      .eq("paper_id", params.id);

    if (questionsError) {
      return questionPaperServerError(requestId);
    }
    const signedDiagramUrls = await createSignedQuestionDiagramUrls(
      (questionRows ?? []) as Array<{
        id: string;
        diagram_url?: string | null;
      }>,
    );

    const p = paperRow as {
      id: string;
      file_name: string;
      subject: string;
      grade: number | string;
      year: number | string;
      total_questions?: number;
    };
    const paper: QuestionPaper = {
      id: p.id,
      filename: p.file_name,
      subject: String(p.subject ?? ""),
      grade: String(p.grade ?? ""),
      year: String(p.year ?? ""),
      uploadedAt: new Date().toISOString(),
      totalPages: 0,
      questions: (questionRows ?? []).map(
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
          diagram: q.diagram ?? undefined,
          diagram_url: signedDiagramUrls.get(q.id),
        })
      ),
    };

    return NextResponse.json({
      success: true,
      paper,
    });
  } catch {
    console.warn("[question-paper-api]", {
      requestId,
      operation: "get_paper",
      outcome: "request_error",
    });
    return questionPaperServerError(requestId);
  }
}

/**
 * POST /api/question-papers/[id]
 * Add a new question to an existing paper (Supabase)
 */
export async function POST(
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
    const { text, type, options, marks, correctAnswer, diagram } = body;
    let validatedDiagramBytes: Buffer | undefined;

    if (!text || !type) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }
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

    const { data: paperRow, error: paperError } = await getSupabase()
      .from("question_papers")
      .select("id, grade, subject, year")
      .eq("id", params.id)
      .single();

    if (paperError || !paperRow) {
      return NextResponse.json(
        { success: false, error: "Paper not found" },
        { status: 404 }
      );
    }

    const { count, error: countError } = await getSupabase()
      .from("questions")
      .select("*", { count: "exact", head: true })
      .eq("paper_id", params.id);
    if (countError) return questionPaperServerError(requestId);
    const nextNumber = String((count ?? 0) + 1);
    const newQuestionId = `q_manual_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const safeType: Question["type"] =
      type === "MCQ" || type === "Short" || type === "Medium" || type === "Long"
        ? type
        : "Short";

    const normalizedOptions =
      safeType === "MCQ" && Array.isArray(options)
        ? (options as any[])
            .map((o) => (typeof o === "string" ? o.trim() : ""))
            .filter((o) => o.length > 0)
        : [];

    const row = paperRow as { id: string; grade: number; subject: string; year: number };
    const { error: insertError } = await getSupabase().from("questions").insert({
      id: newQuestionId,
      paper_id: params.id,
      grade: row.grade,
      subject: row.subject,
      year: row.year,
      number: nextNumber,
      text,
      marks: typeof marks === "number" && marks > 0 ? marks : 1,
      type: safeType,
      section: "SECTION-A",
      options: normalizedOptions,
    });

    if (insertError) {
      return questionPaperServerError(requestId);
    }

    let diagramUrl: string | undefined;
    if (validatedDiagramBytes) {
      const bucket = QUESTION_DIAGRAM_BUCKET;
      const path = `${newQuestionId}.png`;
      try {
        const supabase = getSupabase();
        const { error: bucketError } = await supabase.storage.from(bucket).upload(path, validatedDiagramBytes, {
          contentType: "image/png",
          upsert: true,
        });
        if (bucketError) {
          await getSupabase().from("questions").delete().eq("id", newQuestionId);
          return questionPaperServerError(requestId);
        }
        const { error: diagramUpdateError } = await getSupabase()
          .from("questions")
          .update({ diagram_url: path })
          .eq("id", newQuestionId);
        if (diagramUpdateError) {
          await getSupabase().from("questions").delete().eq("id", newQuestionId);
          await supabase.storage.from(bucket).remove([path]);
          return questionPaperServerError(requestId);
        }
      } catch {
        await getSupabase().from("questions").delete().eq("id", newQuestionId);
        await getSupabase().storage.from(bucket).remove([path]);
        return questionPaperServerError(requestId);
      }
      try {
        diagramUrl = await createSignedQuestionDiagramUrl(
          newQuestionId,
          path,
        );
      } catch {
        diagramUrl = undefined;
      }
    }

    const question: Question = {
      id: newQuestionId,
      number: nextNumber,
      text,
      options: normalizedOptions,
      section: "SECTION-A",
      type: safeType,
      marks: typeof marks === "number" && marks > 0 ? marks : 1,
      correctAnswer:
        typeof correctAnswer === "string" && correctAnswer.trim().length > 0
          ? correctAnswer.trim()
          : undefined,
      diagram_url: diagramUrl,
    };

    return NextResponse.json({
      success: true,
      question,
      paperId: params.id,
      diagram_url: diagramUrl,
    });
  } catch {
    console.warn("[question-paper-api]", {
      requestId,
      operation: "add_question",
      outcome: "request_error",
    });
    return questionPaperServerError(requestId);
  }
}

/**
 * DELETE /api/question-papers/[id]
 * Delete a question paper and its questions from Supabase
 */
export async function DELETE(
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

  try {
    const hasSupabase =
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!hasSupabase) {
      return questionPaperServerError(requestId);
    }

    const { error: questionsDeleteError } = await getSupabase()
      .from("questions")
      .delete()
      .eq("paper_id", params.id);
    if (questionsDeleteError) return questionPaperServerError(requestId);
    const { error } = await getSupabase()
      .from("question_papers")
      .delete()
      .eq("id", params.id);

    if (error) {
      return questionPaperServerError(requestId);
    }

    return NextResponse.json({
      success: true,
      message: "Paper deleted successfully",
    });
  } catch {
    console.warn("[question-paper-api]", {
      requestId,
      operation: "delete_paper",
      outcome: "request_error",
    });
    return questionPaperServerError(requestId);
  }
}
