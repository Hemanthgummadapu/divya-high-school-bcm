import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { platform } from "os";
import { getSupabase } from "@/lib/supabase-server";
import {
  questionPaperServerError,
  requireQuestionPaperApiAccess,
} from "@/lib/question-paper-auth";
import {
  getUploadLimits,
  validatePngDiagram,
} from "@/lib/question-paper-upload-policy.mjs";
import {
  getQuestionDiagramPath,
  QUESTION_DIAGRAM_BUCKET,
} from "@/lib/question-diagram-policy.mjs";
const MAX_GENERATED_PDF_BYTES = 50 * 1024 * 1024;
const MAX_GENERATION_QUESTIONS = 200;
const MAX_TOTAL_DIAGRAM_BYTES = 10 * 1024 * 1024;
function resolvePythonCmd() {
  const isWindows = platform() === "win32";
  const candidates = isWindows
    ? [
        join(process.cwd(), "venv", "Scripts", "python.exe"),
        join(process.cwd(), "venv", "Scripts", "python3.exe"),
      ]
    : [
        join(process.cwd(), "venv", "bin", "python3"),
        join(process.cwd(), "venv", "bin", "python"),
        "/Users/hemanthgummadapu/divya-high-school-bcm/venv/bin/python3",
      ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return isWindows ? "python" : "python3";
}

/**
 * POST /api/questions/generate
 * Generate JK-82 style exam paper PDF via Python reportlab script.
 * Body: { questions: Question[], header: Record<string, string> }
 * Uses school-logo-exam.png in public/images for watermark and header (created from school-logo.png if needed).
 */
export async function POST(request: NextRequest) {
  const authorization = await requireQuestionPaperApiAccess(request, {
    mutation: true,
  });
  if (!authorization.ok) return authorization.response;
  const { requestId } = authorization;
  const { maxDiagramBytes, pdfTimeoutMs } = getUploadLimits();

  try {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return questionPaperServerError(requestId);
    }

    const body = await request.json();
    const { questions, header } = body;

    if (
      !Array.isArray(questions) ||
      questions.length === 0 ||
      questions.length > MAX_GENERATION_QUESTIONS ||
      !header ||
      typeof header !== "object"
    ) {
      return NextResponse.json(
        { success: false, error: "Questions and paper details are required" },
        { status: 422 }
      );
    }

    const inlineDiagrams = new Map<string, string>();
    let totalDiagramBytes = 0;
    for (const question of questions as Array<{
      id?: unknown;
      diagram?: unknown;
    }>) {
      if (typeof question.diagram !== "string" || !question.diagram.trim()) {
        continue;
      }
      const validation = validatePngDiagram(
        question.diagram,
        maxDiagramBytes,
      );
      if (validation.status !== 200 || !validation.bytes) {
        return NextResponse.json(
          {
            success: false,
            error:
              validation.status === 200
                ? "Invalid diagram image"
                : validation.error,
            requestId,
          },
          { status: validation.status === 200 ? 422 : validation.status },
        );
      }
      totalDiagramBytes += validation.bytes.length;
      if (totalDiagramBytes > MAX_TOTAL_DIAGRAM_BYTES) {
        return NextResponse.json(
          {
            success: false,
            error: "Combined diagram images are too large",
            requestId,
          },
          { status: 413 },
        );
      }
      if (typeof question.id === "string") {
        inlineDiagrams.set(question.id, validation.bytes.toString("base64"));
      }
    }

    const questionIds = [
      ...new Set(
        (questions as Array<{ id?: unknown }>)
          .map((question) => question.id)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    ];
    const storedDiagrams = new Map<string, string>();
    if (questionIds.length > 0) {
      const { data: diagramRows, error: diagramRowsError } = await getSupabase()
        .from("questions")
        .select("id, diagram_url")
        .in("id", questionIds);
      if (diagramRowsError) return questionPaperServerError(requestId);

      for (const row of diagramRows ?? []) {
        if (inlineDiagrams.has(row.id)) continue;
        const path = getQuestionDiagramPath(row.id, row.diagram_url);
        if (!path) continue;
        const { data: diagramFile, error: diagramDownloadError } =
          await getSupabase()
            .storage.from(QUESTION_DIAGRAM_BUCKET)
            .download(path);
        if (diagramDownloadError || !diagramFile) {
          return questionPaperServerError(requestId);
        }
        const bytes = Buffer.from(await diagramFile.arrayBuffer());
        const validation = validatePngDiagram(
          bytes.toString("base64"),
          maxDiagramBytes,
        );
        if (validation.status !== 200 || !validation.bytes) {
          return questionPaperServerError(requestId);
        }
        totalDiagramBytes += validation.bytes.length;
        if (totalDiagramBytes > MAX_TOTAL_DIAGRAM_BYTES) {
          return NextResponse.json(
            {
              success: false,
              error: "Combined diagram images are too large",
              requestId,
            },
            { status: 413 },
          );
        }
        storedDiagrams.set(row.id, validation.bytes.toString("base64"));
      }
    }

    const scriptPath = join(process.cwd(), "scripts", "generate_jk82_pdf.py");
    if (!existsSync(scriptPath)) {
      return questionPaperServerError(requestId);
    }

    const pythonCmd = resolvePythonCmd();
    const publicImages = join(process.cwd(), "public", "images");
    const logoPath = join(publicImages, "school-logo.png");
    const examLogoPath = join(publicImages, "school-logo-exam.png");

    let logoPathToUse: string | null = null;
    if (existsSync(examLogoPath)) {
      logoPathToUse = examLogoPath;
    } else if (existsSync(logoPath)) {
      try {
        const updateLogoPath = join(process.cwd(), "scripts", "update_exam_logo.py");
        if (existsSync(updateLogoPath)) {
          mkdirSync(publicImages, { recursive: true });
          await new Promise<void>((resolve, reject) => {
            const proc = spawn(pythonCmd, [updateLogoPath], {
              stdio: "pipe",
              env: {
                ...process.env,
                PYTHONPATH: join(process.cwd(), "venv", "lib", "python3.14", "site-packages"),
                VIRTUAL_ENV: join(process.cwd(), "venv"),
              },
            });
            let settled = false;
            const finish = (error?: Error) => {
              if (settled) return;
              settled = true;
              clearTimeout(timeout);
              if (error) reject(error);
              else resolve();
            };
            const timeout = setTimeout(() => {
              proc.kill("SIGKILL");
              finish(new Error("Logo generation timed out"));
            }, pdfTimeoutMs);
            proc.on("close", (code) =>
              code === 0
                ? finish()
                : finish(new Error("Logo generation failed")),
            );
            proc.on("error", () => finish(new Error("Logo generation failed")));
          });
        }
        if (existsSync(examLogoPath)) logoPathToUse = examLogoPath;
      } catch {
        // fallback to original logo if exam version could not be created
      }
      if (!logoPathToUse && existsSync(logoPath)) logoPathToUse = logoPath;
    }

    const payload = JSON.stringify({
      header: header || {},
      questions: questions.map((q: { id?: string; number?: string; text?: string; options?: string[]; section?: string; type?: string; marks?: number; diagram?: string }) => ({
        id: q.id,
        number: q.number,
        text: q.text,
        options: q.options || [],
        section: q.section,
        type: q.type,
        marks: q.marks,
        diagram:
          (q.id ? inlineDiagrams.get(q.id) ?? storedDiagrams.get(q.id) : undefined) ??
          undefined,
      })),
      logoPath: logoPathToUse,
    });

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const proc = spawn(pythonCmd, [scriptPath], {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          PYTHONPATH: join(process.cwd(), "venv", "lib", "python3.14", "site-packages"),
          VIRTUAL_ENV: join(process.cwd(), "venv"),
        },
      });
      const chunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let outputBytes = 0;
      let settled = false;
      const finish = (error?: Error, output?: Buffer) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (error) reject(error);
        else resolve(output ?? Buffer.alloc(0));
      };
      const timeout = setTimeout(() => {
        proc.kill("SIGKILL");
        finish(new Error("PDF generation timed out"));
      }, pdfTimeoutMs);
      proc.stdout.on("data", (chunk: Buffer) => {
        outputBytes += chunk.length;
        if (outputBytes > MAX_GENERATED_PDF_BYTES) {
          proc.kill("SIGKILL");
          finish(new Error("Generated PDF is too large"));
          return;
        }
        chunks.push(chunk);
      });
      proc.stderr.on("data", (chunk: Buffer) => {
        if (Buffer.concat(stderrChunks).length < 65_536) stderrChunks.push(chunk);
      });
      proc.on("error", () => finish(new Error("PDF generation failed")));
      proc.on("close", (code) => {
        if (code !== 0) {
          finish(new Error("PDF generation failed"));
          return;
        }
        finish(undefined, Buffer.concat(chunks));
      });
      // If the python process exits early (e.g. missing deps), writing to stdin can throw EPIPE.
      proc.stdin.on("error", (err: any) => {
        if (err && (err.code === "EPIPE" || String(err.message || "").includes("EPIPE"))) return;
        console.warn("[question-paper-api]", {
          requestId,
          operation: "generate_pdf",
          outcome: "stdin_error",
        });
      });
      try {
        proc.stdin.write(payload, "utf-8", () => {
          proc.stdin.end();
        });
      } catch (err: any) {
        if (err && (err.code === "EPIPE" || String(err.message || "").includes("EPIPE"))) {
          // allow close handler to surface stderr/exit code
          return;
        }
        finish(new Error("PDF generation failed"));
      }
    });

    if (!pdfBuffer.length) {
      return questionPaperServerError(requestId);
    }

    // Persist required generation metadata before returning the PDF response.
    {
      const subject = (header as { subject?: string }).subject ?? "";
      const grade =
        (header as { class?: string; grade?: string }).class ??
        (header as { grade?: string }).grade ??
        "";
      const year =
        (header as { year?: string | number }).year != null
          ? String((header as { year?: string | number }).year)
          : String(new Date().getFullYear());
      const total_questions = questions.length;
      const total_marks = (questions as { marks?: number }[]).reduce(
        (sum, q) => sum + (Number(q.marks) || 0),
        0
      );
      const question_ids = questionIds;
      try {
        const { error: insertError } = await getSupabase()
          .from("generated_pdfs")
          .insert({
          subject,
          grade,
          year,
          total_questions,
          total_marks,
          question_ids,
        });
        if (insertError) return questionPaperServerError(requestId);
      } catch {
        console.warn("[question-paper-api]", {
          requestId,
          operation: "persist_generated_pdf",
          outcome: "database_error",
        });
        return questionPaperServerError(requestId);
      }
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Question_Paper_${new Date().toISOString().split("T")[0]}.pdf"`,
      },
    });
  } catch {
    console.warn("[question-paper-api]", {
      requestId,
      operation: "generate_pdf",
      outcome: "processing_error",
    });
    return questionPaperServerError(requestId);
  }
}
