import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { join } from "path";
import { existsSync } from "fs";
import { readFile, stat, unlink } from "fs/promises";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import {
  questionPaperServerError,
  requireQuestionPaperApiAccess,
} from "@/lib/question-paper-auth";
import { getUploadLimits } from "@/lib/question-paper-upload-policy.mjs";
const MAX_GENERATED_PDF_BYTES = 50 * 1024 * 1024;

/**
 * POST /api/question-papers/generate-pdf
 * Generate a question paper PDF via Python reportlab script.
 * Body: { questions: Question[], header: Record<string, string> }
 */
export async function POST(request: NextRequest) {
  const authorization = await requireQuestionPaperApiAccess(request, {
    mutation: true,
  });
  if (!authorization.ok) return authorization.response;
  const { requestId } = authorization;
  const { pdfTimeoutMs } = getUploadLimits();
  let tmpPdfPath: string | null = null;
  try {
    const body = await request.json();
    const { questions, header } = body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { success: false, error: "No questions provided" },
        { status: 400 }
      );
    }

    const scriptPath = join(process.cwd(), "scripts", "generate_paper_pdf.py");
    if (!existsSync(scriptPath)) {
      return questionPaperServerError(requestId);
    }

    const venvPython = join(process.cwd(), "venv", "bin", "python3");
    const pythonCmd = existsSync(venvPython) ? venvPython : "python3";
    tmpPdfPath = join(tmpdir(), `question-paper-${randomUUID()}.pdf`);

    const payload = JSON.stringify({
      header: header || {},
      questions: questions.map((q: any) => ({
        id: q.id,
        number: q.number,
        text: q.text,
        options: q.options || [],
        section: q.section,
        type: q.type,
        marks: q.marks,
      })),
    });

    const result = await new Promise<{ success: boolean; out?: string; err?: string }>(
      (resolve) => {
        const pdfPath = tmpPdfPath as string;
        const proc = spawn(pythonCmd, [scriptPath, pdfPath], {
          stdio: ["pipe", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        let settled = false;
        const finish = (value: { success: boolean; out?: string; err?: string }) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          resolve(value);
        };
        const timeout = setTimeout(() => {
          proc.kill("SIGKILL");
          finish({ success: false });
        }, pdfTimeoutMs);
        proc.stdout?.on("data", (d) => {
          stdout = `${stdout}${d.toString()}`.slice(-65_536);
        });
        proc.stderr?.on("data", (d) => {
          stderr = `${stderr}${d.toString()}`.slice(-65_536);
        });
        proc.on("close", (code) => {
          finish({
            success: code === 0,
            out: stdout.trim(),
            err: stderr || undefined,
          });
        });
        proc.on("error", () => {
          finish({ success: false });
        });
        proc.stdin.write(payload, "utf-8", () => {
          proc.stdin.end();
        });
      }
    );

    if (!result.success) {
      console.warn("[question-paper-api]", {
        requestId,
        operation: "legacy_generate_pdf",
        outcome: "processing_error",
      });
      return questionPaperServerError(requestId);
    }

    if (!existsSync(tmpPdfPath)) {
      return questionPaperServerError(requestId);
    }

    const pdfStats = await stat(tmpPdfPath);
    if (pdfStats.size <= 0 || pdfStats.size > MAX_GENERATED_PDF_BYTES) {
      return questionPaperServerError(requestId);
    }
    const pdfBuffer = await readFile(tmpPdfPath);
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
      operation: "legacy_generate_pdf",
      outcome: "request_error",
    });
    return questionPaperServerError(requestId);
  } finally {
    if (tmpPdfPath) await unlink(tmpPdfPath).catch(() => {});
  }
}
