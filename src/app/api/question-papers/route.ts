import { NextRequest, NextResponse } from "next/server";
import {
  readDatabase,
  writeDatabase,
  filterPapers,
  filterQuestions,
  getStatistics,
  type QuestionPaper,
  type FilterOptions,
} from "@/lib/questionPapers";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { platform } from "os";

const execFileAsync = promisify(execFile);

/**
 * GET /api/question-papers
 * Get all question papers with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const filters: FilterOptions = {
      subject: searchParams.get("subject") || undefined,
      grade: searchParams.get("grade") || undefined,
      year: searchParams.get("year") || undefined,
      type: (searchParams.get("type") as any) || undefined,
      section: searchParams.get("section") || undefined,
    };
    
    const db = await readDatabase();
    let papers = db.papers;
    
    // Filter papers
    papers = filterPapers(papers, filters);
    
    // If question type filter is applied, filter questions within papers
    if (filters.type || filters.section) {
      papers = papers.map((paper) => ({
        ...paper,
        questions: filterQuestions(paper.questions, filters),
      }));
    }
    
    // Get statistics
    const stats = getStatistics(db.papers);
    
    return NextResponse.json({
      success: true,
      papers,
      statistics: stats,
      count: papers.length,
    });
  } catch (error: any) {
    console.error("Error fetching question papers:", error);
    return NextResponse.json(
      { success: false, error: error.message },
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

