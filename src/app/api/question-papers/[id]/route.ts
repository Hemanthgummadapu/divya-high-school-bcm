import { NextRequest, NextResponse } from "next/server";
import { readDatabase, writeDatabase, type QuestionPaper } from "@/lib/questionPapers";

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


