export const PYTHON_CHILD_CLASSIFICATIONS: readonly string[];
export function resolveExtractPython(cwd?: string): string;

export function sanitizePythonClassification(value: unknown): string | null;
export function sanitizeExitCode(value: unknown): number | null;
export function sanitizeSignalName(value: unknown): string | null;
export function classifyPythonChildError(error: unknown): {
  classification: string;
  exitCode: number | null;
  signal: string | null;
  timeout: boolean;
};
export function spawnExtractChild(input: {
  pythonCmd: string;
  scriptPath: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  maxBuffer: number;
}): Promise<{
  ok: boolean;
  classification: string | null;
  exitCode: number | null;
  signal: string | null;
  timeout: boolean;
}>;
