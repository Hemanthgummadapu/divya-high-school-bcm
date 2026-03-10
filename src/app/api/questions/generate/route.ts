import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { platform } from "os";
import { supabase } from "@/lib/supabase";

/**
 * POST /api/questions/generate
 * Generate JK-82 style exam paper PDF via Python reportlab script.
 * Body: { questions: Question[], header: Record<string, string> }
 * Uses school-logo-exam.png in public/images for watermark and header (created from school-logo.png if needed).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { questions, header } = body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { success: false, error: "No questions provided" },
        { status: 400 }
      );
    }

    const scriptPath = join(process.cwd(), "scripts", "generate_jk82_pdf.py");
    if (!existsSync(scriptPath)) {
      return NextResponse.json(
        { success: false, error: "PDF generator script not found" },
        { status: 500 }
      );
    }

    const isWindows = platform() === "win32";
    const venvPython = isWindows
      ? join(process.cwd(), "venv", "Scripts", "python.exe")
      : join(process.cwd(), "venv", "bin", "python3");
    const systemPython = isWindows ? "python" : "python3";
    const pythonCmd = existsSync(venvPython) ? venvPython : systemPython;
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
            const proc = spawn(pythonCmd, [updateLogoPath], { stdio: "pipe" });
            proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`Exit ${code}`))));
            proc.on("error", reject);
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
      questions: questions.map((q: { id?: string; number?: string; text?: string; options?: string[]; section?: string; type?: string; marks?: number }) => ({
        id: q.id,
        number: q.number,
        text: q.text,
        options: q.options || [],
        section: q.section,
        type: q.type,
        marks: q.marks,
      })),
      logoPath: logoPathToUse,
    });

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const proc = spawn(pythonCmd, [scriptPath], {
        stdio: ["pipe", "pipe", "pipe"],
      });
      const chunks: Buffer[] = [];
      proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
      proc.stderr.on("data", (chunk: Buffer) => {
        console.error("JK82 PDF stderr:", chunk.toString());
      });
      proc.on("error", (err) => reject(err));
      proc.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Script exited with code ${code}`));
          return;
        }
        resolve(Buffer.concat(chunks));
      });
      proc.stdin.write(payload, "utf-8", () => {
        proc.stdin.end();
      });
    });

    if (!pdfBuffer.length) {
      return NextResponse.json(
        { success: false, error: "PDF was not generated" },
        { status: 500 }
      );
    }

    // Insert into Supabase generated_pdfs (non-blocking; do not fail response on error)
    const hasSupabase =
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (hasSupabase && header && typeof header === "object") {
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
      const question_ids = (questions as { id?: string }[])
        .map((q) => q.id)
        .filter(Boolean) as string[];
      try {
        await supabase.from("generated_pdfs").insert({
          subject,
          grade,
          year,
          total_questions,
          total_marks,
          question_ids,
        });
      } catch (err) {
        console.warn("Supabase generated_pdfs insert failed:", err);
      }
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Question_Paper_${new Date().toISOString().split("T")[0]}.pdf"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "PDF generation failed";
    console.error("Generate PDF error:", error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
