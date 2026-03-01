import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { join } from "path";
import { existsSync } from "fs";
import { readFile, unlink } from "fs/promises";
import { tmpdir } from "os";

/**
 * POST /api/question-papers/generate-pdf
 * Generate a question paper PDF via Python reportlab script.
 * Body: { questions: Question[], header: Record<string, string> }
 */
export async function POST(request: NextRequest) {
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
      return NextResponse.json(
        { success: false, error: "PDF generator script not found" },
        { status: 500 }
      );
    }

    const venvPython = join(process.cwd(), "venv", "bin", "python3");
    const pythonCmd = existsSync(venvPython) ? venvPython : "python3";
    tmpPdfPath = join(tmpdir(), `question-paper-${Date.now()}.pdf`);

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
        const proc = spawn(pythonCmd, [scriptPath, tmpPdfPath], {
          stdio: ["pipe", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        proc.stdout?.on("data", (d) => { stdout += d.toString(); });
        proc.stderr?.on("data", (d) => { stderr += d.toString(); });
        proc.on("close", (code) => {
          resolve({
            success: code === 0,
            out: stdout.trim(),
            err: stderr || undefined,
          });
        });
        proc.on("error", () => {
          resolve({ success: false, err: "Failed to start Python" });
        });
        proc.stdin.write(payload, "utf-8", () => {
          proc.stdin.end();
        });
      }
    );

    if (!result.success) {
      console.error("PDF generation failed:", result.err, result.out);
      return NextResponse.json(
        { success: false, error: result.err || result.out || "PDF generation failed" },
        { status: 500 }
      );
    }

    if (!existsSync(tmpPdfPath)) {
      return NextResponse.json(
        { success: false, error: "PDF file was not created" },
        { status: 500 }
      );
    }

    const pdfBuffer = await readFile(tmpPdfPath);
    await unlink(tmpPdfPath).catch(() => {});

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Question_Paper_${new Date().toISOString().split("T")[0]}.pdf"`,
      },
    });
  } catch (error: any) {
    if (tmpPdfPath) {
      await unlink(tmpPdfPath).catch(() => {});
    }
    console.error("Generate PDF error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
