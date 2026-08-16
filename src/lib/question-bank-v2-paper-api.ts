import { randomUUID } from "crypto";
import { spawn } from "child_process";
import { existsSync } from "fs";
import { mkdtemp, rm, writeFile, readFile } from "fs/promises";
import { tmpdir, platform } from "os";
import { join } from "path";
import { assertServerOnly } from "@/lib/assert-server-only";
import { getSupabase } from "@/lib/supabase-server";
import { getUploadLimits, validatePngDiagram } from "@/lib/question-paper-upload-policy.mjs";
import {
  DIAGRAM_BUCKET,
  computePdfSha256,
  diagramSignedObjectKey,
  isCanonicalDiagramStoragePath,
} from "@/lib/question-bank-v2-extract.mjs";
import { SIGNED_URL_TTL_SECONDS } from "@/lib/question-bank-v2-review.mjs";
import {
  GENERATED_PAPERS_BUCKET,
  MAX_GENERATED_PDF_BYTES,
  canSignGeneratedPaper,
  formatDuration,
  generatedPaperObjectKey,
  generatedPaperStoragePath,
  isValidGeneratedPdf,
  publicSavedPaper,
  romanClass,
} from "@/lib/question-bank-v2-paper.mjs";

assertServerOnly("Question-bank V2 paper builder");

const PAPER_COLUMNS =
  "id, title, grade, subject, academic_year, duration_minutes, total_marks, status, pdf_storage_path, pdf_sha256, pdf_byte_size, creation_key, lock_version, created_at, updated_at, finalized_at";

const ITEM_COLUMNS =
  "id, paper_id, bank_question_id, section_title, section_instructions, section_display_order, question_display_order, number_label, snapshot_text, snapshot_options, snapshot_marks, snapshot_question_type, snapshot_diagram_path";

const BANK_COLUMNS =
  "id, grade, subject, academic_year, question_type, question_text, options, marks, diagram_path, review_status";

function requireSupabaseConfig() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error("supabase_unconfigured");
  }
}

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
      ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return isWindows ? "python" : "python3";
}

export async function loadBankQuestions(ids: string[]) {
  requireSupabaseConfig();
  if (ids.length === 0) return [];
  const { data, error } = await getSupabase()
    .from("question_bank_questions")
    .select(BANK_COLUMNS)
    .in("id", ids);
  if (error) throw new Error("question_lookup_failed");
  return data ?? [];
}

export async function saveFinalPaper(input: {
  creationKey: string;
  title: string;
  grade: number;
  subject: string;
  academicYear: number;
  durationMinutes: number;
  items: Array<Record<string, unknown>>;
}) {
  requireSupabaseConfig();
  const { data, error } = await getSupabase().rpc("save_question_paper", {
    p_paper_id: null,
    p_creation_key: input.creationKey,
    p_expected_lock_version: null,
    p_title: input.title,
    p_grade: input.grade,
    p_subject: input.subject,
    p_academic_year: input.academicYear,
    p_duration_minutes: input.durationMinutes,
    p_items: input.items,
    p_finalize: true,
  });
  if (error) {
    const message = String(error.message || "");
    if (message.includes("final papers are immutable")) {
      throw Object.assign(new Error("creation_key_conflict"), { status: 409 });
    }
    throw new Error("save_paper_failed");
  }
  return data as {
    ok?: boolean;
    idempotent?: boolean;
    paper_id?: string;
    status?: string;
    total_marks?: number;
    item_count?: number;
    lock_version?: number;
  };
}

export async function loadSavedPaper(paperId: string) {
  requireSupabaseConfig();
  const { data, error } = await getSupabase()
    .from("saved_question_papers")
    .select(PAPER_COLUMNS)
    .eq("id", paperId)
    .maybeSingle();
  if (error) throw new Error("paper_lookup_failed");
  return data;
}

export async function loadSavedPaperItems(paperId: string) {
  requireSupabaseConfig();
  const { data, error } = await getSupabase()
    .from("saved_question_paper_items")
    .select(ITEM_COLUMNS)
    .eq("paper_id", paperId)
    .order("section_display_order", { ascending: true })
    .order("question_display_order", { ascending: true })
    .order("number_label", { ascending: true });
  if (error) throw new Error("paper_items_failed");
  return data ?? [];
}

export async function listSavedPapers(filters: {
  page: number;
  pageSize: number;
  grade: number | null;
  year: number | null;
  subject: string;
  status: string;
}) {
  requireSupabaseConfig();
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  let query = getSupabase()
    .from("saved_question_papers")
    .select(PAPER_COLUMNS, { count: "exact" });
  if (filters.grade != null) query = query.eq("grade", filters.grade);
  if (filters.subject) query = query.eq("subject", filters.subject);
  if (filters.year != null) query = query.eq("academic_year", filters.year);
  if (filters.status) {
    query = query.eq("status", filters.status);
  } else {
    query = query.in("status", ["final", "archived"]);
  }
  const { data, error, count } = await query
    .order("finalized_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, to);
  if (error) throw new Error("saved_paper_list_failed");
  const rows = data ?? [];
  const ids = rows.map((row) => row.id as string);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: items, error: itemError } = await getSupabase()
      .from("saved_question_paper_items")
      .select("paper_id")
      .in("paper_id", ids);
    if (itemError) throw new Error("saved_paper_count_failed");
    for (const item of items ?? []) {
      const paperId = item.paper_id as string;
      counts.set(paperId, (counts.get(paperId) ?? 0) + 1);
    }
  }
  return {
    papers: rows.map((row) =>
      publicSavedPaper(row, { itemCount: counts.get(row.id as string) ?? 0 }),
    ),
    page: filters.page,
    pageSize: filters.pageSize,
    total: count ?? 0,
  };
}

export async function signSavedPaperPdf(
  paperId: string,
  storedPath: string | null,
) {
  if (!storedPath || !canSignGeneratedPaper(paperId, storedPath)) return null;
  const objectKey = storedPath.slice(`${GENERATED_PAPERS_BUCKET}/`.length);
  const { data, error } = await getSupabase()
    .storage.from(GENERATED_PAPERS_BUCKET)
    .createSignedUrl(objectKey, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

async function downloadSnapshotDiagram(
  item: {
    bank_question_id?: string | null;
    snapshot_diagram_path?: string | null;
  },
  workDir: string,
): Promise<{ status: "ok" | "unavailable" | "none"; path?: string }> {
  const storedPath = item.snapshot_diagram_path;
  const questionId = item.bank_question_id;
  if (!storedPath) return { status: "none" };
  if (!questionId || !isCanonicalDiagramStoragePath(questionId, storedPath)) {
    return { status: "unavailable" };
  }
  const objectKey = diagramSignedObjectKey(storedPath);
  if (!objectKey) return { status: "unavailable" };
  const { data, error } = await getSupabase()
    .storage.from(DIAGRAM_BUCKET)
    .download(objectKey);
  if (error || !data) return { status: "unavailable" };
  const bytes = Buffer.from(await data.arrayBuffer());
  const validated = validatePngDiagram(
    bytes.toString("base64"),
    getUploadLimits().maxDiagramBytes,
  );
  if (validated.status !== 200 || !("bytes" in validated) || !validated.bytes) {
    return { status: "unavailable" };
  }
  const filePath = join(workDir, `${questionId}-${randomUUID()}.png`);
  await writeFile(filePath, validated.bytes);
  return { status: "ok", path: filePath };
}

function runPython(args: string[], options: { timeoutMs: number; cwd?: string }) {
  return new Promise<{ stdout: Buffer; stderr: string }>((resolve, reject) => {
    const proc = spawn(resolvePythonCmd(), args, {
      cwd: options.cwd || process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error("generator_timeout"));
    }, options.timeoutMs);
    proc.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    proc.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    proc.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error("generator_failed"));
        return;
      }
      resolve({
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}

async function validateGeneratedPdfFile(filePath: string) {
  const bytes = await readFile(filePath);
  const validateScript = join(process.cwd(), "scripts", "validate_pdf_pages.py");
  const { stdout } = await runPython(
    [validateScript, "--pdf", filePath, "--max-pages", "200"],
    { timeoutMs: getUploadLimits().pdfTimeoutMs },
  );
  const pageCount = Number.parseInt(stdout.toString("utf8").trim(), 10);
  if (!isValidGeneratedPdf(bytes, pageCount)) {
    throw new Error("invalid_generated_pdf");
  }
  return { bytes, pageCount };
}

export async function generateAndStorePaperPdf(input: {
  paperId: string;
  paper: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
}) {
  requireSupabaseConfig();
  if (input.paper.pdf_storage_path) {
    throw Object.assign(new Error("pdf_already_recorded"), { status: 409 });
  }
  if (input.paper.status !== "final") {
    throw Object.assign(new Error("paper_not_final"), { status: 400 });
  }

  const workDir = await mkdtemp(join(tmpdir(), `qb-paper-${input.paperId}-`));
  const createdObjects: Array<{ bucket: string; path: string }> = [];
  try {
    const sections = new Map<
      number,
      {
        title: string;
        instructions: string | null;
        questions: Array<Record<string, unknown>>;
      }
    >();
    for (const item of input.items) {
      const order = Number(item.section_display_order);
      if (!sections.has(order)) {
        sections.set(order, {
          title: String(item.section_title),
          instructions: (item.section_instructions as string | null) ?? null,
          questions: [],
        });
      }
      const diagram = await downloadSnapshotDiagram(
        {
          bank_question_id: item.bank_question_id as string | null,
          snapshot_diagram_path: item.snapshot_diagram_path as string | null,
        },
        workDir,
      );
      sections.get(order)?.questions.push({
        number: item.number_label,
        text: item.snapshot_text,
        options: item.snapshot_options,
        marks: item.snapshot_marks,
        type: item.snapshot_question_type,
        diagramPath: diagram.path ?? null,
        diagramStatus: diagram.status,
      });
    }

    const payloadPath = join(workDir, "paper.json");
    const outputPath = join(workDir, "paper.pdf");
    await writeFile(
      payloadPath,
      JSON.stringify({
        header: {
          examCode: "JK-82",
          examTitle: String(input.paper.title),
          subject: String(input.paper.subject),
          class: romanClass(Number(input.paper.grade)),
          maxMarks: String(input.paper.total_marks ?? 0),
          time: formatDuration(Number(input.paper.duration_minutes)),
          academicYear: String(input.paper.academic_year),
          schoolName: "Divya High School",
          location: "Bhadrachalam",
        },
        sections: [...sections.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([, section]) => section),
        logoPath: existsSync(
          join(process.cwd(), "public", "images", "school-logo-exam.png"),
        )
          ? join(process.cwd(), "public", "images", "school-logo-exam.png")
          : null,
      }),
    );

    const scriptPath = join(process.cwd(), "scripts", "generate_jk82_pdf.py");
    await runPython(
      [
        scriptPath,
        "--input",
        payloadPath,
        "--output",
        outputPath,
        "--work-dir",
        workDir,
      ],
      { timeoutMs: getUploadLimits().pdfTimeoutMs },
    );

    const { bytes } = await validateGeneratedPdfFile(outputPath);
    const exportId = randomUUID();
    const objectKey = generatedPaperObjectKey(input.paperId, exportId);
    const storagePath = generatedPaperStoragePath(input.paperId, exportId);
    const { error: uploadError } = await getSupabase()
      .storage.from(GENERATED_PAPERS_BUCKET)
      .upload(objectKey, bytes, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (uploadError) throw new Error("pdf_upload_failed");
    createdObjects.push({ bucket: GENERATED_PAPERS_BUCKET, path: objectKey });

    let recorded: unknown = null;
    try {
      const { data, error: recordError } = await getSupabase().rpc(
        "record_final_paper_pdf",
        {
          p_paper_id: input.paperId,
          p_pdf_storage_path: storagePath,
          p_pdf_sha256: computePdfSha256(bytes),
          p_pdf_byte_size: bytes.byteLength,
        },
      );
      if (recordError) {
        throw new Error("pdf_metadata_failed");
      }
      recorded = data;
    } catch (error) {
      await getSupabase()
        .storage.from(GENERATED_PAPERS_BUCKET)
        .remove(createdObjects.map((object) => object.path));
      throw error instanceof Error ? error : new Error("pdf_metadata_failed");
    }

    const pdfUrl = await signSavedPaperPdf(input.paperId, storagePath);
    return {
      recorded,
      storagePath,
      pdfUrl,
      byteSize: bytes.byteLength,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function getSavedPaperDetail(paperId: string) {
  const paper = await loadSavedPaper(paperId);
  if (!paper) return null;
  const pdfUrl = await signSavedPaperPdf(
    paper.id as string,
    (paper.pdf_storage_path as string | null) ?? null,
  );
  const items = await loadSavedPaperItems(paperId);
  return {
    paper: publicSavedPaper(paper, {
      itemCount: items.length,
      pdfUrl,
    }),
    pdfUrl,
  };
}
