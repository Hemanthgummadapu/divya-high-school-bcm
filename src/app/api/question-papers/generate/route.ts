import { NextRequest, NextResponse } from "next/server";
import { readDatabase, type Question } from "@/lib/questionPapers";

/**
 * POST /api/question-papers/generate
 * Generate a question paper from selected question IDs
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
    
    const db = await readDatabase();
    
    // Find all questions by their IDs
    const selectedQuestions: Question[] = [];
    for (const paper of db.papers) {
      for (const question of paper.questions) {
        if (questionIds.includes(question.id)) {
          selectedQuestions.push(question);
        }
      }
    }
    
    if (selectedQuestions.length === 0) {
      return NextResponse.json(
        { success: false, error: "No questions found with provided IDs" },
        { status: 404 }
      );
    }
    
    // Sort questions by section and number
    selectedQuestions.sort((a, b) => {
      if (a.section !== b.section) {
        return a.section.localeCompare(b.section);
      }
      return parseInt(a.number) - parseInt(b.number);
    });
    
    // Calculate total marks
    const totalMarks = selectedQuestions.reduce((sum, q) => sum + q.marks, 0);
    
    // Group by section
    const bySection = selectedQuestions.reduce((acc, q) => {
      if (!acc[q.section]) {
        acc[q.section] = [];
      }
      acc[q.section].push(q);
      return acc;
    }, {} as Record<string, Question[]>);
    
    // Generate paper
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

