import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import type { QuestionPaper, Question } from "@/lib/questionPapers";

/**
 * GET /api/question-papers/[id]
 * Get a single question paper by ID from Supabase
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const hasSupabase =
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!hasSupabase) {
      return NextResponse.json(
        { success: false, error: "Supabase not configured" },
        { status: 503 }
      );
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
      return NextResponse.json(
        { success: false, error: questionsError.message },
        { status: 500 }
      );
    }

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
          diagram_url: q.diagram_url ?? undefined,
        })
      ),
    };

    return NextResponse.json({
      success: true,
      paper,
    });
  } catch (error: any) {
    console.error("Error fetching question paper:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
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
  try {
    const body = await request.json();
    const { text, type, options, marks, correctAnswer, diagram } = body;

    if (!text || !type) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const hasSupabase =
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!hasSupabase) {
      return NextResponse.json(
        { success: false, error: "Supabase not configured" },
        { status: 503 }
      );
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

    const { count } = await getSupabase()
      .from("questions")
      .select("*", { count: "exact", head: true })
      .eq("paper_id", params.id);
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
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    let diagramUrl: string | undefined;
    if (typeof diagram === "string" && diagram.trim().length > 0) {
      try {
        const buffer = Buffer.from(diagram, "base64");
        const supabase = getSupabase();
        const bucket = "diagrams";
        const path = `${newQuestionId}.png`;
        const { error: bucketError } = await supabase.storage.from(bucket).upload(path, buffer, {
          contentType: "image/png",
          upsert: true,
        });
        if (!bucketError) {
          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
          diagramUrl = urlData?.publicUrl;
          if (diagramUrl) {
            await getSupabase()
              .from("questions")
              .update({ diagram_url: diagramUrl })
              .eq("id", newQuestionId);
          }
        }
      } catch (uploadErr) {
        console.warn("Diagram upload failed:", uploadErr);
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
  } catch (error: any) {
    console.error("Error adding question:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
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
  try {
    const hasSupabase =
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!hasSupabase) {
      return NextResponse.json(
        { success: false, error: "Supabase not configured" },
        { status: 503 }
      );
    }

    await getSupabase().from("questions").delete().eq("paper_id", params.id);
    const { error } = await getSupabase()
      .from("question_papers")
      .delete()
      .eq("id", params.id);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Paper deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting question paper:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
