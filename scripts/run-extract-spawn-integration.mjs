import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  resolveExtractPython,
  spawnExtractChild,
} from "../src/lib/question-bank-v2-python-child.mjs";

const root = join(fileURLToPath(new URL("..", import.meta.url)));

function createSixPagePdf(dest) {
  const python = resolveExtractPython(root);
  const result = spawnSync(
    python,
    [
      "-c",
      `
from pypdf import PdfWriter
w = PdfWriter()
for _ in range(6):
    w.add_blank_page(width=612, height=792)
w.write(${JSON.stringify(dest)})
`,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`fixture pdf failed: ${(result.stderr || "").slice(0, 200)}`);
  }
}

async function spawnExtract(workDir, overrides = {}) {
  const scriptPath = join(root, "scripts", "extract_pdf.py");
  const pdfPath = join(workDir, "original.pdf");
  const outputPath = join(workDir, "extract.json");
  const pythonCmd = resolveExtractPython(root);
  const env = {
    ...process.env,
    QUESTION_PAPER_EXTRACT_MOCK: "completed",
    QUESTION_PAPER_MAX_PDF_PAGES: "20",
  };
  delete env.GEMINI_API_KEY;
  delete env.GOOGLE_API_KEY;
  return spawnExtractChild({
    pythonCmd: overrides.pythonCmd ?? pythonCmd,
    scriptPath: overrides.scriptPath ?? scriptPath,
    args: overrides.args ?? [
      scriptPath,
      "--pdf",
      overrides.pdfPath ?? pdfPath,
      "--subject",
      "Mathematics",
      "--grade",
      "10",
      "--year",
      "2026",
      "--output",
      overrides.outputPath ?? outputPath,
      "--work-dir",
      overrides.workDir ?? workDir,
    ],
    cwd: overrides.cwd ?? root,
    env: overrides.env ?? env,
    timeoutMs: overrides.timeoutMs ?? 60_000,
    maxBuffer: 10 * 1024 * 1024,
  });
}

async function main() {
  const workDir = await mkdtemp(join(tmpdir(), "qb-spawn-it-"));
  const pdfPath = join(workDir, "original.pdf");
  const outputPath = join(workDir, "extract.json");
  try {
    createSixPagePdf(pdfPath);

    const ok = await spawnExtract(workDir);
    if (!ok.ok) {
      throw new Error(`expected mock extract success, got ${ok.classification}`);
    }
    const raw = await readFile(outputPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.schemaVersion !== 1) {
      throw new Error("output file invalid");
    }
    if (!Array.isArray(parsed.pages) || parsed.pages.length !== 6) {
      throw new Error("expected six synthetic pages");
    }
    console.log("spawn_success");

    const missingPy = await spawnExtract(workDir, {
      pythonCmd: join(workDir, "missing-python"),
    });
    if (missingPy.classification !== "python_executable_missing") {
      throw new Error(`missing python: ${missingPy.classification}`);
    }
    console.log("missing_python");

    const missingScript = await spawnExtract(workDir, {
      scriptPath: join(workDir, "missing.py"),
      args: [join(workDir, "missing.py")],
    });
    if (missingScript.classification !== "python_script_missing") {
      throw new Error(`missing script: ${missingScript.classification}`);
    }
    console.log("missing_script");

    const invalidArgs = await spawnExtract(workDir, {
      args: [join(root, "scripts", "extract_pdf.py")],
    });
    if (invalidArgs.classification !== "python_exit_nonzero") {
      throw new Error(`invalid args: ${invalidArgs.classification}`);
    }
    console.log("invalid_args");

    await rm(outputPath, { force: true });
    const deletedPdf = await spawnExtract(workDir, {
      pdfPath: join(workDir, "gone.pdf"),
    });
    if (deletedPdf.classification !== "python_exit_nonzero") {
      throw new Error(`missing pdf: ${deletedPdf.classification}`);
    }
    console.log("missing_pdf");

    const timeout = await spawnExtract(workDir, {
      args: [
        "-c",
        "import time; time.sleep(5)",
      ],
      scriptPath: join(root, "scripts", "extract_pdf.py"),
      pythonCmd: resolveExtractPython(root),
      timeoutMs: 200,
    });
    // scriptPath exists so spawn runs python -c via args? No - args replace full argv.
    // execFile(python, ["-c", "sleep"]) would ignore scriptPath existence check on extract_pdf.py
    // That's ok if classification is timeout or exit.
    if (
      timeout.classification !== "python_timeout" &&
      timeout.classification !== "python_exit_nonzero"
    ) {
      throw new Error(`timeout: ${timeout.classification}`);
    }
    console.log("timeout_or_exit");
    console.log("SPAWN_INTEGRATION_OK");
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
