import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import type { Question } from "@/lib/questionPapers";

/**
 * POST /api/question-papers/generate
 * Generate a question paper from selected question IDs (Supabase)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { questionIds } = body;

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid question IDs" },
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

    const { data: questionRows, error } = await getSupabase()
      .from("questions")
      .select("*")
      .in("id", questionIds);

    if (error || !questionRows || questionRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "No questions found with provided IDs" },
        { status: 404 }
      );
    }

    const selectedQuestions: Question[] = questionRows.map(
        (q: {
          id: string;
          number: string;
          text: string;
          options?: string[];
          section: string;
          type: string;
          marks: number;
        }): Question => ({
          id: q.id,
          number: String(q.number ?? ""),
          text: q.text ?? "",
          options: Array.isArray(q.options) ? q.options : [],
          section: q.section ?? "",
          type: (q.type as Question["type"]) || "Short",
          marks: Number(q.marks) ?? 0,
          diagram: (q as { diagram?: string }).diagram ?? undefined,
        })
    );

    selectedQuestions.sort((a, b) => {
      if (a.section !== b.section) {
        return a.section.localeCompare(b.section);
      }
      return parseInt(a.number) - parseInt(b.number);
    });

    const totalMarks = selectedQuestions.reduce((sum, q) => sum + q.marks, 0);

    const bySection = selectedQuestions.reduce((acc, q) => {
      if (!acc[q.section]) {
        acc[q.section] = [];
      }
      acc[q.section].push(q);
      return acc;
    }, {} as Record<string, Question[]>);

    const generatedPaper = {
      id: `generated_${Date.now()}`,
      title: "Generated Question Paper",
      createdAt: new Date().toISOString(),
      totalQuestions: selectedQuestions.length,
      totalMarks,
      questions: selectedQuestions,
      bySection,
    };

    return NextResponse.json({
      success: true,
      paper: generatedPaper,
    });
  } catch (error: any) {
    console.error("Error generating question paper:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
