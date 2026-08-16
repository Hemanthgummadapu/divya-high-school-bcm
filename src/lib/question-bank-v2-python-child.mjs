import { execFile } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { platform } from "os";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export function resolveExtractPython(cwd = process.cwd()) {
  const isWindows = platform() === "win32";
  const venvPython = isWindows
    ? join(cwd, "venv", "Scripts", "python.exe")
    : join(cwd, "venv", "bin", "python3");
  const systemPython = isWindows ? "python" : "python3";
  return existsSync(venvPython) ? venvPython : systemPython;
}

export const PYTHON_CHILD_CLASSIFICATIONS = Object.freeze([
  "python_executable_missing",
  "python_script_missing",
  "python_permission_denied",
  "python_exit_nonzero",
  "python_terminated",
  "python_timeout",
  "python_output_missing",
  "python_output_invalid",
  "provider_all_pages_failed",
]);

const SAFE_SIGNALS = new Set([
  "SIGKILL",
  "SIGTERM",
  "SIGINT",
  "SIGHUP",
  "SIGABRT",
]);

export function sanitizePythonClassification(value) {
  return PYTHON_CHILD_CLASSIFICATIONS.includes(value) ? value : null;
}

export function sanitizeExitCode(value) {
  const code = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isSafeInteger(code) || code < -128 || code > 255) return null;
  return code;
}

export function sanitizeSignalName(value) {
  const name = String(value ?? "").trim().toUpperCase();
  return SAFE_SIGNALS.has(name) ? name : null;
}

export function classifyPythonChildError(error) {
  const code = error?.code;
  const signal = sanitizeSignalName(error?.signal);
  const killed = Boolean(error?.killed);
  const status = sanitizeExitCode(
    error?.status ?? (typeof code === "number" ? code : null),
  );

  if (code === "ENOENT") {
    return {
      classification: "python_executable_missing",
      exitCode: null,
      signal: null,
      timeout: false,
    };
  }
  if (code === "EACCES") {
    return {
      classification: "python_permission_denied",
      exitCode: null,
      signal: null,
      timeout: false,
    };
  }
  if (killed && (signal === "SIGKILL" || signal === "SIGTERM")) {
    return {
      classification: "python_timeout",
      exitCode: status,
      signal,
      timeout: true,
    };
  }
  if (signal) {
    return {
      classification: "python_terminated",
      exitCode: status,
      signal,
      timeout: false,
    };
  }
  return {
    classification: "python_exit_nonzero",
    exitCode: status,
    signal: null,
    timeout: false,
  };
}

export async function spawnExtractChild(input) {
  const pythonCmd = input.pythonCmd;
  const scriptPath = input.scriptPath;
  if (!scriptPath || !existsSync(scriptPath)) {
    return {
      ok: false,
      classification: "python_script_missing",
      exitCode: null,
      signal: null,
      timeout: false,
    };
  }
  if (!pythonCmd) {
    return {
      ok: false,
      classification: "python_executable_missing",
      exitCode: null,
      signal: null,
      timeout: false,
    };
  }

  try {
    await execFileAsync(pythonCmd, input.args, {
      cwd: input.cwd,
      env: input.env,
      timeout: input.timeoutMs,
      maxBuffer: input.maxBuffer,
      killSignal: "SIGKILL",
    });
    return {
      ok: true,
      classification: null,
      exitCode: 0,
      signal: null,
      timeout: false,
    };
  } catch (error) {
    return {
      ok: false,
      ...classifyPythonChildError(error),
    };
  }
}
