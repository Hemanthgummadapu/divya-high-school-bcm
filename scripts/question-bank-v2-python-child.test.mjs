import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import {
  classifyPythonChildError,
  spawnExtractChild,
  sanitizePythonClassification,
} from "../src/lib/question-bank-v2-python-child.mjs";
import { resolveExtractPython } from "../src/lib/question-bank-v2-python-child.mjs";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const extractRun = readFileSync(
  join(root, "src/lib/question-bank-v2-extract-run.ts"),
  "utf8",
);
const retryRoute = readFileSync(
  join(root, "src/app/api/question-papers/[id]/retry/route.ts"),
  "utf8",
);
const uploadRoute = readFileSync(
  join(root, "src/app/api/question-papers/route.ts"),
  "utf8",
);

test("child errors map to bounded classifications", () => {
  assert.equal(
    classifyPythonChildError({ code: "ENOENT" }).classification,
    "python_executable_missing",
  );
  assert.equal(
    classifyPythonChildError({ code: "EACCES" }).classification,
    "python_permission_denied",
  );
  assert.deepEqual(classifyPythonChildError({ killed: true, signal: "SIGKILL", status: null }), {
    classification: "python_timeout",
    exitCode: null,
    signal: "SIGKILL",
    timeout: true,
  });
  assert.equal(
    classifyPythonChildError({ signal: "SIGTERM", status: null }).classification,
    "python_terminated",
  );
  assert.deepEqual(classifyPythonChildError({ status: 1, code: 1 }), {
    classification: "python_exit_nonzero",
    exitCode: 1,
    signal: null,
    timeout: false,
  });
  assert.equal(sanitizePythonClassification("stderr dump"), null);
  assert.equal(sanitizePythonClassification("python_output_missing"), "python_output_missing");
});

test("upload and retry await extraction before deleting the work directory", () => {
  assert.match(retryRoute, /await runExtractAndPersist/);
  assert.match(uploadRoute, /await runExtractAndPersist/);
  assert.doesNotMatch(retryRoute, /return runExtractAndPersist\(/);
  assert.doesNotMatch(uploadRoute, /return runExtractAndPersist\(/);
  assert.ok(
    retryRoute.indexOf("await runExtractAndPersist") <
      retryRoute.lastIndexOf("rm(workDir"),
  );
  assert.ok(
    uploadRoute.indexOf("await runExtractAndPersist") <
      uploadRoute.lastIndexOf("rm(workDir"),
  );
  assert.match(extractRun, /spawnExtractChild/);
});

test("spawnExtractChild classifies missing script, missing python, and nonzero exit", async () => {
  const work = await mkdtemp(join(tmpdir(), "qb-child-"));
  try {
    const missingScript = await spawnExtractChild({
      pythonCmd: "python3",
      scriptPath: join(work, "missing.py"),
      args: [join(work, "missing.py")],
      cwd: work,
      env: process.env,
      timeoutMs: 5000,
      maxBuffer: 64 * 1024,
    });
    assert.equal(missingScript.ok, false);
    assert.equal(missingScript.classification, "python_script_missing");

    const script = join(work, "exit-one.py");
    await writeFile(script, "import sys\nsys.exit(1)\n");
    const nonzero = await spawnExtractChild({
      pythonCmd: resolveExtractPython(root),
      scriptPath: script,
      args: [script],
      cwd: work,
      env: process.env,
      timeoutMs: 5000,
      maxBuffer: 64 * 1024,
    });
    assert.equal(nonzero.ok, false);
    assert.equal(nonzero.classification, "python_exit_nonzero");
    assert.equal(nonzero.exitCode, 1);

    const missingPy = await spawnExtractChild({
      pythonCmd: join(work, "no-such-python"),
      scriptPath: script,
      args: [script],
      cwd: work,
      env: process.env,
      timeoutMs: 5000,
      maxBuffer: 64 * 1024,
    });
    assert.equal(missingPy.ok, false);
    assert.equal(missingPy.classification, "python_executable_missing");
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});

test("unwritable work directory and invalid CLI arguments fail closed", async () => {
  const work = await mkdtemp(join(tmpdir(), "qb-child-args-"));
  try {
    const script = join(root, "scripts", "extract_pdf.py");
    const invalid = await spawnExtractChild({
      pythonCmd: resolveExtractPython(root),
      scriptPath: script,
      args: [script],
      cwd: work,
      env: { ...process.env, QUESTION_PAPER_EXTRACT_MOCK: "completed" },
      timeoutMs: 5000,
      maxBuffer: 64 * 1024,
    });
    assert.equal(invalid.ok, false);
    assert.equal(invalid.classification, "python_exit_nonzero");

    await chmod(work, 0o500);
    const blocked = await spawnExtractChild({
      pythonCmd: resolveExtractPython(root),
      scriptPath: script,
      args: [
        script,
        "--pdf",
        join(work, "missing.pdf"),
        "--subject",
        "Mathematics",
        "--grade",
        "10",
        "--year",
        "2026",
        "--output",
        join(work, "out.json"),
        "--work-dir",
        work,
      ],
      cwd: root,
      env: { ...process.env, QUESTION_PAPER_EXTRACT_MOCK: "completed" },
      timeoutMs: 5000,
      maxBuffer: 64 * 1024,
    });
    assert.equal(blocked.ok, false);
    assert.ok(
      blocked.classification === "python_exit_nonzero" ||
        blocked.classification === "python_permission_denied",
    );
  } finally {
    await chmod(work, 0o700).catch(() => {});
    await rm(work, { recursive: true, force: true });
  }
});
