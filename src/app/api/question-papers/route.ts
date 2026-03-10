import { NextRequest, NextResponse } from "next/server";
import {
  getStatistics,
  type QuestionPaper,
  type Question,
  type FilterOptions,
} from "@/lib/questionPapers";
import { isValidSubjectForGrade } from "@/lib/subjects";
import { getSupabase } from "@/lib/supabase";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, mkdir, readFile, unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { platform } from "os";

const execFileAsync = promisify(execFile);

function normalizeText(text: string): string {
  return (text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Dice coefficient (bigram similarity) in [0, 1]. */
function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const bigrams = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const A = bigrams(a);
  const B = bigrams(b);
  let intersect = 0;
  A.forEach((bg) => {
    if (B.has(bg)) intersect++;
  });
  return (2 * intersect) / (A.size + B.size) || 0;
}

function filterDuplicateQuestions(
  newQuestions: Question[],
  existingNormalizedTexts: string[],
  threshold = 0.85
): { kept: Question[]; skipped: number } {
  const kept: Question[] = [];
  let skipped = 0;
  for (const q of newQuestions) {
    const norm = normalizeText(q.text ?? "");
    if (!norm) {
      kept.push(q);
      continue;
    }
    let isDup = false;
    for (const existing of existingNormalizedTexts) {
      if (!existing) continue;
      if (norm === existing || similarity(norm, existing) >= threshold) {
        isDup = true;
        break;
      }
    }
    if (isDup) skipped++;
    else kept.push(q);
  }
  return { kept, skipped };
}

/**
 * GET /api/question-papers
 * Get all question papers with optional filters.
 * Always reads from Supabase; returns empty array if no data or Supabase unavailable.
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

    if (!hasSupabase) {
      return NextResponse.json({
        success: true,
        papers: [],
        statistics: { totalPapers: 0, totalQuestions: 0, bySubject: {}, byType: {} },
        count: 0,
      });
    }

    try {
      const { count } = await getSupabase()
        .from("questions")
        .select("*", { count: "exact", head: true });
      console.log("[GET /api/question-papers] Total questions in DB:", count);

      let query = getSupabase().from("questions").select("*");
      if (filters.subject) query = query.eq("subject", filters.subject);
      if (filters.grade) {
        const gradeNum = parseInt(filters.grade, 10);
        if (!Number.isNaN(gradeNum)) query = query.eq("grade", gradeNum);
      }
      if (filters.year) {
        const yearNum = parseInt(filters.year, 10);
        if (!Number.isNaN(yearNum)) query = query.eq("year", yearNum);
      }
      if (filters.type) query = query.eq("type", filters.type);
      if (filters.section) query = query.eq("section", filters.section);

      const { data: questionRows, error: questionsError } = await query;

      console.log("[GET /api/question-papers] Query filters:", JSON.stringify(filters));
      console.log("[GET /api/question-papers] Questions returned by select:", questionRows?.length ?? 0);
      if (questionsError) {
        console.log("[GET /api/question-papers] Supabase questions error:", questionsError.message);
      }

      if (questionsError || !questionRows || questionRows.length === 0) {
        return NextResponse.json({
          success: true,
          papers: [],
          statistics: { totalPapers: 0, totalQuestions: 0, bySubject: {}, byType: {} },
          count: 0,
        });
      }

      const paperIds = [...new Set(questionRows.map((r: { paper_id: string }) => r.paper_id))];
      const { data: paperRows, error: papersError } = await getSupabase()
        .from("question_papers")
        .select("*")
        .in("id", paperIds);

      if (papersError || !paperRows || paperRows.length === 0) {
        return NextResponse.json({
          success: true,
          papers: [],
          statistics: { totalPapers: 0, totalQuestions: 0, bySubject: {}, byType: {} },
          count: 0,
        });
      }

      const papers: QuestionPaper[] = paperRows.map(
        (p: {
          id: string;
          file_name: string;
          subject: string;
          grade: number | string;
          year: number | string;
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
                diagram: (q as { diagram?: string }).diagram ?? undefined,
                diagram_url: (q as { diagram_url?: string }).diagram_url ?? undefined,
              })
            );
          return {
            id: p.id,
            filename: p.file_name,
            subject: String(p.subject ?? ""),
            grade: String(p.grade ?? ""),
            year: String(p.year ?? ""),
            uploadedAt: new Date().toISOString(),
            totalPages: 0,
            questions: paperQuestions,
          };
        }
      );
      const stats = getStatistics(papers);
      const totalQuestionsFromPapers = papers.reduce((sum, p) => sum + p.questions.length, 0);
      console.log("[GET /api/question-papers] Using Supabase. Papers:", papers.length, "Total questions in response:", totalQuestionsFromPapers);
      return NextResponse.json({
        success: true,
        papers,
        statistics: stats,
        count: papers.length,
      });
    } catch (supabaseError) {
      console.error("Supabase fetch error:", supabaseError);
      return NextResponse.json({
        success: true,
        papers: [],
        statistics: { totalPapers: 0, totalQuestions: 0, bySubject: {}, byType: {} },
        count: 0,
      });
    }
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
    const gradeParam = formData.get("grade") as string;
    const year = formData.get("year") as string;

    if (!file || !subject || !gradeParam || !year) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const gradeNum = parseInt(gradeParam, 10);
    if (Number.isNaN(gradeNum) || gradeNum < 1 || gradeNum > 10) {
      return NextResponse.json(
        { success: false, error: "Invalid grade; must be 1–10" },
        { status: 400 }
      );
    }
    if (!isValidSubjectForGrade(subject, gradeNum)) {
      return NextResponse.json(
        { success: false, error: "Invalid subject for the selected grade" },
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

    // Run OCR extraction script; write to a temp JSON file (not question-papers.json)
    const scriptPath = join(process.cwd(), "scripts", "extract_pdf.py");
    const dataDir = join(process.cwd(), "data");
    if (!existsSync(dataDir)) await mkdir(dataDir, { recursive: true });
    const tempOutputPath = join(dataDir, `extract_${timestamp}.json`);

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
      "--grade", gradeParam,
      "--year", year,
      "--output", tempOutputPath,
    ];

    console.log("Executing OCR script:", pythonCmd, args.join(" "));

    const hasSupabase =
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      const { stdout, stderr } = await execFileAsync(pythonCmd, args, {
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024,
      });

      console.log("OCR Output (stdout):", stdout);
      if (stderr) console.error("OCR Warnings/Errors (stderr):", stderr);

      // Read extraction result from temp file (no readDatabase)
      const raw = await readFile(tempOutputPath, "utf-8");
      const db = JSON.parse(raw) as { papers: QuestionPaper[] };
      const newPaper = db.papers[db.papers.length - 1];
      if (!newPaper) {
        await unlink(tempOutputPath).catch(() => {});
        return NextResponse.json(
          { success: false, error: "No paper extracted from PDF" },
          { status: 500 }
        );
      }

      let questionsInserted = 0;
      let skippedDuplicatesSupabase = 0;

      if (hasSupabase && newPaper.questions.length > 0) {
        try {
          await getSupabase().from("question_papers").insert({
            id: newPaper.id,
            subject: newPaper.subject,
            grade: gradeNum,
            year: parseInt(year, 10) || new Date().getFullYear(),
            total_questions: newPaper.questions.length,
            file_name: newPaper.filename,
          });

          const { data: existingQuestions } = await getSupabase()
            .from("questions")
            .select("text")
            .eq("grade", gradeNum)
            .eq("subject", subject);
          const existingTexts = (existingQuestions ?? []).map((r) =>
            normalizeText((r as { text?: string }).text ?? "")
          );
          const { kept, skipped } = filterDuplicateQuestions(
            newPaper.questions,
            existingTexts,
            0.85
          );
          skippedDuplicatesSupabase = skipped;

          if (kept.length > 0) {
            const questionsToInsert = kept.map((q) => ({
              id: q.id,
              paper_id: newPaper.id,
              grade: gradeNum,
              subject,
              year: parseInt(year, 10) || new Date().getFullYear(),
              number: q.number,
              text: q.text,
              marks: q.marks,
              type: q.type,
              section: q.section ?? "",
              options: q.options ?? [],
              diagram: q.diagram ?? null,
            }));
            const { error: insertError } = await getSupabase()
              .from("questions")
              .insert(questionsToInsert);

            if (insertError) {
              console.error("[POST /api/question-papers] QUESTIONS INSERT ERROR:", JSON.stringify(insertError, null, 2));
              questionsInserted = 0;
            } else {
              questionsInserted = questionsToInsert.length;
              console.log(`[POST /api/question-papers] Successfully inserted ${questionsToInsert.length} questions`);
            }
          }
          console.log(
            `[POST /api/question-papers] inserted=${questionsInserted}, skipped_duplicates=${skippedDuplicatesSupabase}`
          );
        } catch (supabaseErr) {
          console.warn("Supabase insert failed:", supabaseErr);
        }
      }

      try {
        await unlink(tempOutputPath);
      } catch (e) {
        console.error("Error deleting temp extract file:", e);
      }
      try {
        await unlink(filepath);
      } catch (e) {
        console.error("Error deleting temp upload file:", e);
      }

      return NextResponse.json({
        success: true,
        paper: newPaper,
        message: `Successfully extracted ${newPaper.questions.length} questions`,
        duplicatesSkipped: skippedDuplicatesSupabase,
        questionsInserted: hasSupabase ? questionsInserted : undefined,
      });
    } catch (execError: any) {
      console.error("=== OCR Script Execution Failed ===");
      console.error("Python:", pythonCmd, "Args:", args);
      console.error("Error message:", execError.message);
      if (execError.stdout) console.error("Stdout:", execError.stdout);
      if (execError.stderr) console.error("Stderr:", execError.stderr);

      try {
        await unlink(filepath);
      } catch (e) {
        console.error("Error deleting temp file:", e);
      }

      const stderr = execError.stderr?.trim() || execError.stdout?.trim() || "";
      const hasPopplerHint =
        /poppler|pdftoppm|Unable to get page count/i.test(stderr) ||
        /PDFInfoNotFound|pdf2image/i.test(execError.message || "");
      const hasImportError = /ModuleNotFoundError|ImportError|No module named/i.test(stderr || execError.message || "");
      let userError = "OCR processing failed. Make sure Python dependencies are installed.";
      if (hasPopplerHint) {
        userError =
          "PDF conversion failed: Poppler is required. Install poppler-utils (Linux), brew install poppler (macOS), or add Poppler to PATH on Windows. See SETUP_QUESTION_BANK.md.";
      } else if (hasImportError) {
        userError =
          "Python dependencies missing. Run: pip install -r requirements.txt (and ensure venv is activated if you use one).";
      } else if (stderr) {
        userError = stderr.slice(0, 500);
      }

      return NextResponse.json(
        { success: false, error: userError, details: { message: execError.message } },
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
 * Delete questions by IDs or clear all (Supabase only).
 */
export async function DELETE(request: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { questionIds } = body;
    const hasSupabase =
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!hasSupabase) {
      return NextResponse.json(
        { success: false, error: "Supabase not configured" },
        { status: 503 }
      );
    }

    if (!questionIds || questionIds.length === 0) {
      const { data: allQuestions } = await getSupabase().from("questions").select("id");
      const ids = (allQuestions ?? []).map((r: { id: string }) => r.id);
      const deletedCount = ids.length;
      if (ids.length > 0) {
        await getSupabase().from("questions").delete().in("id", ids);
      }
      const { data: allPapers } = await getSupabase().from("question_papers").select("id");
      const paperIds = (allPapers ?? []).map((r: { id: string }) => r.id);
      if (paperIds.length > 0) {
        await getSupabase().from("question_papers").delete().in("id", paperIds);
      }
      return NextResponse.json({
        success: true,
        message: "All questions cleared",
        deletedCount,
      });
    }

    const { error } = await getSupabase().from("questions").delete().in("id", questionIds);
    if (error) {
      console.error("Delete questions error:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({
      success: true,
      message: `Deleted ${questionIds.length} question(s)`,
      deletedCount: questionIds.length,
    });
  } catch (error: any) {
    console.error("Error deleting questions:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

