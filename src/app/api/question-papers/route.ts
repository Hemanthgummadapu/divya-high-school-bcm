import { NextRequest, NextResponse } from "next/server";
import {
  getStatistics,
  type QuestionPaper,
  type Question,
  type FilterOptions,
} from "@/lib/questionPapers";
import { isValidSubjectForGrade } from "@/lib/subjects";
import { getSupabase } from "@/lib/supabase-server";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, mkdir, readFile, unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { platform } from "os";
import { randomUUID } from "crypto";
import {
  questionPaperServerError,
  requireQuestionPaperApiAccess,
} from "@/lib/question-paper-auth";
import {
  getUploadLimits,
  validatePdfUpload,
  validateUploadContentLength,
} from "@/lib/question-paper-upload-policy.mjs";
import { isAnthropicConfigured } from "@/lib/question-paper-provider-policy.mjs";
import { createSignedQuestionDiagramUrls } from "@/lib/question-diagrams";

const execFileAsync = promisify(execFile);
export const dynamic = "force-dynamic";

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
  const authorization = await requireQuestionPaperApiAccess(request);
  if (!authorization.ok) return authorization.response;
  const { requestId } = authorization;

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
      return questionPaperServerError(requestId);
    }

    try {
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

      if (questionsError) {
        console.warn("[question-paper-api]", {
          requestId,
          operation: "list_questions",
          outcome: "database_error",
        });
        return questionPaperServerError(requestId);
      }

      if (!questionRows || questionRows.length === 0) {
        return NextResponse.json({
          success: true,
          papers: [],
          statistics: { totalPapers: 0, totalQuestions: 0, bySubject: {}, byType: {} },
          count: 0,
        });
      }

      const signedDiagramUrls = await createSignedQuestionDiagramUrls(
        questionRows as Array<{
          id: string;
          diagram_url?: string | null;
        }>,
      );
      const paperIds = [...new Set(questionRows.map((r: { paper_id: string }) => r.paper_id))];
      const { data: paperRows, error: papersError } = await getSupabase()
        .from("question_papers")
        .select("*")
        .in("id", paperIds);

      if (papersError) {
        console.warn("[question-paper-api]", {
          requestId,
          operation: "list_papers",
          outcome: "database_error",
        });
        return questionPaperServerError(requestId);
      }
      if (!paperRows || paperRows.length === 0) {
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
                diagram_url: signedDiagramUrls.get(q.id),
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
      return NextResponse.json({
        success: true,
        papers,
        statistics: stats,
        count: papers.length,
      });
    } catch {
      console.warn("[question-paper-api]", {
        requestId,
        operation: "list",
        outcome: "database_exception",
      });
      return questionPaperServerError(requestId);
    }
  } catch {
    console.warn("[question-paper-api]", {
      requestId,
      operation: "list",
      outcome: "request_error",
    });
    return questionPaperServerError(requestId);
  }
}

/**
 * POST /api/question-papers
 * Upload and process a PDF file
 */
export async function POST(request: NextRequest) {
  const authorization = await requireQuestionPaperApiAccess(request, {
    mutation: true,
  });
  if (!authorization.ok) return authorization.response;
  const { requestId } = authorization;
  const limits = getUploadLimits();
  const contentLengthError = validateUploadContentLength(
    request.headers.get("content-length"),
    limits.maxBytes,
  );
  if (contentLengthError) {
    return NextResponse.json(
      { success: false, error: contentLengthError.error, requestId },
      { status: contentLengthError.status },
    );
  }

  const temporaryPaths = new Set<string>();
  try {
    const formData = await request.formData();
    const files = formData.getAll("file");
    const allUploadedFiles = Array.from(formData.values()).filter(
      (value): value is File => value instanceof File,
    );
    if (
      files.length !== 1 ||
      !(files[0] instanceof File) ||
      allUploadedFiles.length !== 1 ||
      allUploadedFiles[0] !== files[0]
    ) {
      return NextResponse.json(
        { success: false, error: "Exactly one PDF document is required", requestId },
        { status: 422 },
      );
    }
    const file = files[0];
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

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const uploadValidation = validatePdfUpload({
      name: file.name,
      mimeType: file.type,
      bytes: buffer,
      maxBytes: limits.maxBytes,
      maxPages: limits.maxPages,
    });
    if (uploadValidation.status !== 200) {
      return NextResponse.json(
        { success: false, error: uploadValidation.error, requestId },
        { status: uploadValidation.status },
      );
    }

    const hasSupabase =
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!hasSupabase) {
      return questionPaperServerError(requestId);
    }

    // Save uploaded file temporarily
    const uploadsDir = join(process.cwd(), "uploads");
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    const uploadId = randomUUID();
    const filename = `paper_${uploadId}.pdf`;
    const filepath = join(uploadsDir, filename);

    await writeFile(filepath, buffer);
    temporaryPaths.add(filepath);

    const dataDir = join(process.cwd(), "data");
    if (!existsSync(dataDir)) await mkdir(dataDir, { recursive: true });
    const tempOutputPath = join(dataDir, `extract_${uploadId}.json`);
    temporaryPaths.add(tempOutputPath);

    const isWindows = platform() === "win32";
    const venvPython = isWindows
      ? join(process.cwd(), "venv", "Scripts", "python.exe")
      : join(process.cwd(), "venv", "bin", "python3");
    const systemPython = isWindows ? "python" : "python3";
    const pythonCmd = existsSync(venvPython) ? venvPython : systemPython;
    const validateScript = join(process.cwd(), "scripts", "validate_pdf_pages.py");
    if (!existsSync(validateScript)) {
      return questionPaperServerError(requestId);
    }
    try {
      await execFileAsync(
        pythonCmd,
        [
          validateScript,
          "--pdf",
          filepath,
          "--max-pages",
          String(limits.maxPages),
        ],
        {
          cwd: process.cwd(),
          maxBuffer: 64 * 1024,
          timeout: limits.pdfTimeoutMs,
          killSignal: "SIGKILL",
        },
      );
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "The PDF could not be validated",
          requestId,
        },
        { status: 422 },
      );
    }

    if (!isAnthropicConfigured(process.env.ANTHROPIC_API_KEY)) {
      console.warn("[question-paper-api]", {
        requestId,
        operation: "extract_pdf",
        outcome: "provider_not_configured",
      });
      return questionPaperServerError(requestId);
    }

    const scriptPath = join(process.cwd(), "scripts", "extract_pdf.py");
    const args = [
      scriptPath,
      "--pdf", filepath,
      "--subject", subject,
      "--grade", gradeParam,
      "--year", year,
      "--output", tempOutputPath,
    ];

    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      QUESTION_PAPER_MAX_PDF_PAGES: String(limits.maxPages),
    };
    delete childEnv.GEMINI_API_KEY;
    delete childEnv.GOOGLE_API_KEY;

    try {
      await execFileAsync(pythonCmd, args, {
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024,
        env: childEnv,
        timeout: limits.ocrTimeoutMs,
        killSignal: "SIGKILL",
      });

      // Read extraction result from temp file (no readDatabase)
      const raw = await readFile(tempOutputPath, "utf-8");
      const db = JSON.parse(raw) as { papers: QuestionPaper[] };
      const newPaper = db.papers[db.papers.length - 1];
      if (!newPaper) {
        return NextResponse.json(
          {
            success: false,
            error: "No questions could be extracted from the PDF",
            requestId,
          },
          { status: 422 },
        );
      }
      if (newPaper.questions.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "No questions could be extracted from the PDF",
            requestId,
          },
          { status: 422 },
        );
      }

      let questionsInserted = 0;
      let skippedDuplicatesSupabase = 0;

      if (newPaper.questions.length > 0) {
        let paperInserted = false;
        try {
          const { error: paperInsertError } = await getSupabase()
            .from("question_papers")
            .insert({
            id: newPaper.id,
            subject: newPaper.subject,
            grade: gradeNum,
            year: parseInt(year, 10) || new Date().getFullYear(),
            total_questions: newPaper.questions.length,
            file_name: newPaper.filename,
          });
          if (paperInsertError) {
            throw new Error("paper_insert_failed");
          }
          paperInserted = true;

          const { data: existingQuestions, error: existingQuestionsError } =
            await getSupabase()
            .from("questions")
            .select("text")
            .eq("grade", gradeNum)
            .eq("subject", subject);
          if (existingQuestionsError) {
            throw new Error("duplicate_check_failed");
          }
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
              throw new Error("question_insert_failed");
            } else {
              questionsInserted = questionsToInsert.length;
            }
          } else {
            const { error: emptyPaperCleanupError } = await getSupabase()
              .from("question_papers")
              .delete()
              .eq("id", newPaper.id);
            if (emptyPaperCleanupError) {
              throw new Error("empty_paper_cleanup_failed");
            }
            paperInserted = false;
            return NextResponse.json({
              success: true,
              partial: true,
              paper: newPaper,
              message: "No new questions were saved because all were duplicates",
              duplicatesSkipped: skippedDuplicatesSupabase,
              questionsInserted: 0,
            });
          }
        } catch {
          console.warn("[question-paper-api]", {
            requestId,
            operation: "persist_extraction",
            outcome: "database_error",
          });
          if (paperInserted) {
            await getSupabase()
              .from("questions")
              .delete()
              .eq("paper_id", newPaper.id);
            await getSupabase()
              .from("question_papers")
              .delete()
              .eq("id", newPaper.id);
          }
          return questionPaperServerError(requestId);
        }
      }

      return NextResponse.json({
        success: true,
        paper: newPaper,
        message: `Successfully extracted ${newPaper.questions.length} questions`,
        duplicatesSkipped: skippedDuplicatesSupabase,
        questionsInserted,
      });
    } catch {
      console.warn("[question-paper-api]", {
        requestId,
        operation: "extract_pdf",
        outcome: "processing_error",
      });

      return questionPaperServerError(requestId);
    }
  } catch {
    console.warn("[question-paper-api]", {
      requestId,
      operation: "upload",
      outcome: "request_error",
    });
    return questionPaperServerError(requestId);
  } finally {
    await Promise.all(
      [...temporaryPaths].map((path) => unlink(path).catch(() => {})),
    );
  }
}

/**
 * DELETE /api/question-papers
 * Delete questions by IDs or clear all (Supabase only).
 */
export async function DELETE(request: NextRequest) {
  const authorization = await requireQuestionPaperApiAccess(request, {
    mutation: true,
  });
  if (!authorization.ok) return authorization.response;
  const { requestId } = authorization;

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
      return questionPaperServerError(requestId);
    }

    if (!questionIds || questionIds.length === 0) {
      const { data: allQuestions, error: listQuestionsError } =
        await getSupabase().from("questions").select("id");
      if (listQuestionsError) return questionPaperServerError(requestId);
      const ids = (allQuestions ?? []).map((r: { id: string }) => r.id);
      const deletedCount = ids.length;
      if (ids.length > 0) {
        const { error: deleteQuestionsError } = await getSupabase()
          .from("questions")
          .delete()
          .in("id", ids);
        if (deleteQuestionsError) return questionPaperServerError(requestId);
      }
      const { data: allPapers, error: listPapersError } = await getSupabase()
        .from("question_papers")
        .select("id");
      if (listPapersError) return questionPaperServerError(requestId);
      const paperIds = (allPapers ?? []).map((r: { id: string }) => r.id);
      if (paperIds.length > 0) {
        const { error: deletePapersError } = await getSupabase()
          .from("question_papers")
          .delete()
          .in("id", paperIds);
        if (deletePapersError) return questionPaperServerError(requestId);
      }
      return NextResponse.json({
        success: true,
        message: "All questions cleared",
        deletedCount,
      });
    }

    const { error } = await getSupabase().from("questions").delete().in("id", questionIds);
    if (error) {
      console.warn("[question-paper-api]", {
        requestId,
        operation: "delete_questions",
        outcome: "database_error",
      });
      return questionPaperServerError(requestId);
    }
    return NextResponse.json({
      success: true,
      message: `Deleted ${questionIds.length} question(s)`,
      deletedCount: questionIds.length,
    });
  } catch {
    console.warn("[question-paper-api]", {
      requestId,
      operation: "delete_questions",
      outcome: "request_error",
    });
    return questionPaperServerError(requestId);
  }
}

