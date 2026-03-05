import { NextRequest, NextResponse } from "next/server";
import {
  readDatabase,
  writeDatabase,
  filterPapers,
  filterQuestions,
  getStatistics,
  type QuestionPaper,
  type Question,
  type FilterOptions,
} from "@/lib/questionPapers";
import { supabase } from "@/lib/supabase";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { platform } from "os";

const execFileAsync = promisify(execFile);

/**
 * GET /api/question-papers
 * Get all question papers with optional filters.
 * Fetches from Supabase (questions + question_papers), falls back to local JSON on failure.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const filters: FilterOptions = {
      subject: searchParams.get("subject") || undefined,
      grade: searchParams.get("grade") || undefined,
      year: searchParams.get("year") || undefined,
      type: (searchParams.get("type") as Question["type"]) || undefined,
      section: searchParams.get("section") || undefined,
    };

    const hasSupabase =
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (hasSupabase) {
      try {
        let query = supabase.from("questions").select("*");
        if (filters.subject) query = query.eq("subject", filters.subject);
        if (filters.grade) query = query.eq("grade", filters.grade);
        if (filters.year) query = query.eq("year", filters.year);
        if (filters.type) query = query.eq("type", filters.type);
        if (filters.section) query = query.eq("section", filters.section);

        const { data: questionRows, error: questionsError } = await query;

        if (!questionsError && questionRows && questionRows.length > 0) {
          const paperIds = [...new Set(questionRows.map((r: { paper_id: string }) => r.paper_id))];
          const { data: paperRows, error: papersError } = await supabase
            .from("question_papers")
            .select("*")
            .in("id", paperIds);

          if (!papersError && paperRows && paperRows.length > 0) {
            const papers: QuestionPaper[] = paperRows.map(
              (p: {
                id: string;
                file_name: string;
                subject: string;
                grade: string;
                year: string;
                total_questions?: number;
              }) => {
                const paperQuestions = questionRows
                  .filter((q: { paper_id: string }) => q.paper_id === p.id)
                  .map(
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
                    })
                  );
                return {
                  id: p.id,
                  filename: p.file_name,
                  subject: p.subject,
                  grade: p.grade,
                  year: p.year,
                  uploadedAt: new Date().toISOString(),
                  totalPages: 0,
                  questions: paperQuestions,
                };
              }
            );
            const stats = getStatistics(papers);
            return NextResponse.json({
              success: true,
              papers,
              statistics: stats,
              count: papers.length,
            });
          }
        }
      } catch (supabaseError) {
        console.warn("Supabase fetch failed, falling back to local JSON:", supabaseError);
      }
    }

    // Fallback: local JSON
    const db = await readDatabase();
    let papers = db.papers;

    papers = filterPapers(papers, filters);

    if (filters.type || filters.section) {
      papers = papers.map((paper) => ({
        ...paper,
        questions: filterQuestions(paper.questions, filters),
      }));
    }

    const stats = getStatistics(db.papers);

    return NextResponse.json({
      success: true,
      papers,
      statistics: stats,
      count: papers.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching question papers:", error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/question-papers
 * Upload and process a PDF file
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const subject = formData.get("subject") as string;
    const grade = formData.get("grade") as string;
    const year = formData.get("year") as string;
    
    if (!file || !subject || !grade || !year) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    // Validate file type
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { success: false, error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }
    
    // Save uploaded file temporarily
    const uploadsDir = join(process.cwd(), "uploads");
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }
    
    const timestamp = Date.now();
    const filename = `paper_${timestamp}.pdf`;
    const filepath = join(uploadsDir, filename);
    
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);
    
    // Run OCR extraction script
    const scriptPath = join(process.cwd(), "scripts", "extract_pdf.py");
    const dbPath = join(process.cwd(), "data", "question-papers.json");

    // Use venv Python if it exists (Windows: venv\Scripts\python.exe, Unix: venv/bin/python3)
    const isWindows = platform() === "win32";
    const venvPython = isWindows
      ? join(process.cwd(), "venv", "Scripts", "python.exe")
      : join(process.cwd(), "venv", "bin", "python3");
    const systemPython = isWindows ? "python" : "python3";
    const pythonCmd = existsSync(venvPython) ? venvPython : systemPython;

    const args = [
      scriptPath,
      "--pdf", filepath,
      "--subject", subject,
      "--grade", grade,
      "--year", year,
      "--output", dbPath,
    ];

    console.log("Executing OCR script:", pythonCmd, args.join(" "));

    try {
      const { stdout, stderr } = await execFileAsync(pythonCmd, args, {
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024, // 10MB for long extraction output
      });
      
      console.log("OCR Output (stdout):", stdout);
      if (stderr) {
        console.error("OCR Warnings/Errors (stderr):", stderr);
      }
      
      // Parse duplicates skipped from script stdout (e.g. "DUPLICATES_SKIPPED: 3")
      let duplicatesSkipped = 0;
      const dupMatch = (stdout || "").match(/DUPLICATES_SKIPPED:\s*(\d+)/);
      if (dupMatch) {
        duplicatesSkipped = parseInt(dupMatch[1], 10);
      }
      
      // Read the updated database to get the new paper ID
      const db = await readDatabase();
      const newPaper = db.papers[db.papers.length - 1];

      // Insert into Supabase (local JSON is fallback; do not fail request on Supabase errors)
      const hasSupabase =
        process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (hasSupabase && newPaper) {
        try {
          await supabase.from("question_papers").insert({
            id: newPaper.id,
            subject: newPaper.subject,
            grade: newPaper.grade,
            year: newPaper.year,
            total_questions: newPaper.questions.length,
            file_name: newPaper.filename,
          });
          if (newPaper.questions.length > 0) {
            const rows = newPaper.questions.map((q) => ({
              id: q.id,
              paper_id: newPaper.id,
              subject: newPaper.subject,
              grade: newPaper.grade,
              year: newPaper.year,
              number: q.number,
              text: q.text,
              marks: q.marks,
              type: q.type,
              section: q.section ?? "",
              options: q.options ?? [],
            }));
            await supabase.from("questions").insert(rows);
          }
        } catch (supabaseErr) {
          console.warn("Supabase insert failed (local JSON saved):", supabaseErr);
        }
      }

      // Clean up uploaded file
      try {
        const { unlink } = await import("fs/promises");
        await unlink(filepath);
      } catch (e) {
        console.error("Error deleting temp file:", e);
      }

      return NextResponse.json({
        success: true,
        paper: newPaper,
        message: `Successfully extracted ${newPaper.questions.length} questions`,
        duplicatesSkipped,
      });
    } catch (execError: any) {
      // Enhanced error logging
      console.error("=== OCR Script Execution Failed ===");
      console.error("Python:", pythonCmd, "Args:", args);
      console.error("Error message:", execError.message);
      console.error("Error code:", execError.code);
      if (execError.stdout) {
        console.error("Stdout:", execError.stdout);
      }
      if (execError.stderr) {
        console.error("Stderr (full output):", execError.stderr);
      }
      console.error("Full error object:", JSON.stringify(execError, null, 2));
      console.error("===================================");

      // Clean up uploaded file
      try {
        const { unlink } = await import("fs/promises");
        await unlink(filepath);
      } catch (e) {
        console.error("Error deleting temp file:", e);
      }

      // Build user-facing error: prefer Python/poppler stderr over generic message
      const stderr = execError.stderr?.trim() || execError.stdout?.trim() || "";
      const hasPopplerHint =
        /poppler|pdftoppm|Unable to get page count/i.test(stderr) ||
        /PDFInfoNotFound|pdf2image/i.test(execError.message || "");
      const hasImportError = /ModuleNotFoundError|ImportError|No module named/i.test(stderr || execError.message || "");
      let userError =
        "OCR processing failed. Make sure Python dependencies are installed.";
      if (hasPopplerHint) {
        userError =
          "PDF conversion failed: Poppler is required. Install poppler-utils (Linux), brew install poppler (macOS), or add Poppler to PATH on Windows. See SETUP_QUESTION_BANK.md.";
      } else if (hasImportError) {
        userError =
          "Python dependencies missing. Run: pip install -r requirements.txt (and ensure venv is activated if you use one).";
      } else if (stderr) {
        userError = stderr.slice(0, 500);
      }

      const errorDetails = {
        message: execError.message,
        code: execError.code,
        stdout: execError.stdout || null,
        stderr: execError.stderr || null,
        command: `${pythonCmd} ${args.join(" ")}`,
      };

      return NextResponse.json(
        {
          success: false,
          error: userError,
          details: errorDetails,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error uploading question paper:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/question-papers
 * Delete questions or clear all
 */
export async function DELETE(request: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // If no body or invalid JSON, treat as clear all
      body = {};
    }
    
    const { questionIds } = body;
    const db = await readDatabase();
    
    // Calculate total questions before deletion
    const totalQuestionsBefore = db.papers.reduce(
      (sum, paper) => sum + paper.questions.length,
      0
    );
    
    // If no questionIds or empty array, clear everything
    if (!questionIds || questionIds.length === 0) {
      db.papers = [];
      await writeDatabase(db);
      
      return NextResponse.json({
        success: true,
        message: "All questions cleared",
        deletedCount: totalQuestionsBefore,
      });
    }
    
    // Delete specific questions by ID
    let deletedCount = 0;
    const updatedPapers = db.papers.map((paper) => {
      const originalCount = paper.questions.length;
      paper.questions = paper.questions.filter(
        (q) => !questionIds.includes(q.id)
      );
      deletedCount += originalCount - paper.questions.length;
      return paper;
    });
    
    // Remove papers that have no questions left
    db.papers = updatedPapers.filter((paper) => paper.questions.length > 0);
    
    await writeDatabase(db);
    
    return NextResponse.json({
      success: true,
      message: `Deleted ${deletedCount} question(s)`,
      deletedCount,
    });
  } catch (error: any) {
    console.error("Error deleting questions:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

