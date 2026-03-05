import { NextRequest, NextResponse } from "next/server";
import { readDatabase, writeDatabase, type QuestionPaper, type Question } from "@/lib/questionPapers";

/**
 * GET /api/question-papers/[id]
 * Get a single question paper by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = await readDatabase();
    const paper = db.papers.find((p) => p.id === params.id);
    
    if (!paper) {
      return NextResponse.json(
        { success: false, error: "Paper not found" },
        { status: 404 }
      );
    }
    
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
 * Add a new question to an existing paper
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { text, type, options, marks, correctAnswer } = body;

    if (!text || !type) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const db = await readDatabase();
    const paper = db.papers.find((p) => p.id === params.id);

    if (!paper) {
      return NextResponse.json(
        { success: false, error: "Paper not found" },
        { status: 404 }
      );
    }

    const nextNumber = (paper.questions.length + 1).toString();
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

    const question: Question = {
      id: newQuestionId,
      number: nextNumber,
      text: text,
      options: normalizedOptions,
      section: "SECTION-A",
      type: safeType,
      marks: typeof marks === "number" && marks > 0 ? marks : 1,
      correctAnswer:
        typeof correctAnswer === "string" && correctAnswer.trim().length > 0
          ? correctAnswer.trim()
          : undefined,
    };

    paper.questions.push(question);
    await writeDatabase(db);

    return NextResponse.json({
      success: true,
      question,
      paperId: paper.id,
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
 * Delete a question paper
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = await readDatabase();
    const index = db.papers.findIndex((p) => p.id === params.id);
    
    if (index === -1) {
      return NextResponse.json(
        { success: false, error: "Paper not found" },
        { status: 404 }
      );
    }
    
    db.papers.splice(index, 1);
    await writeDatabase(db);
    
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


