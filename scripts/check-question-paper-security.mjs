import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { QUESTION_PAPER_PARSER_MODEL } from "../src/lib/question-paper-provider-policy.mjs";

const repositoryRoot = join(fileURLToPath(new URL("..", import.meta.url)));
const sensitiveRoutes = [
  "src/app/api/question-papers/route.ts",
  "src/app/api/question-papers/[id]/route.ts",
  "src/app/api/question-papers/generate/route.ts",
  "src/app/api/question-papers/generate-pdf/route.ts",
  "src/app/api/questions/[id]/route.ts",
  "src/app/api/questions/generate/route.ts",
  "src/app/api/questions/route.ts",
  "src/app/api/question-papers/[id]/retry/route.ts",
  "src/app/api/question-papers/[id]/retry-failed-pages/route.ts",
];
const mutationMethods = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const protectedHandlerMarker =
  "const authorization = await requireQuestionPaperApiAccess";
const dangerousMarkers = [
  "request.formData(",
  "request.json(",
  "getSupabase()",
  "createSignedQuestionDiagramUrl(",
  "createSignedQuestionDiagramUrls(",
  "listV2Questions(",
  "listV2Sources(",
  "getV2SourceDetail(",
  "getV2Question(",
  "updateV2Question(",
  "createManualV2Question(",
  "listSavedPapers(",
  "getSavedPaperDetail(",
  "saveFinalPaper(",
  "generateAndStorePaperPdf(",
  "spawn(",
  "execFileAsync(",
  "runExtractAndPersist(",
  "runRetrySpendControl(",
  "claimFailedSourceForRetry(",
  "inspectRetryEligibility(",
  "downloadSourcePdfBytes(",
];

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectSourceFiles(path)));
    else if (/\.(?:ts|tsx|js|jsx|mjs)$/.test(entry.name)) files.push(path);
  }
  return files;
}

function handlerSegments(source) {
  const starts = Array.from(
    source.matchAll(/export\s+async\s+function\s+(GET|POST|PATCH|PUT|DELETE)\b/g),
  );
  return starts.map((match, index) => ({
    method: match[1],
    source: source.slice(
      match.index,
      starts[index + 1]?.index ?? source.length,
    ),
  }));
}

const discoveredSensitiveRoutes = (await collectSourceFiles(
  join(repositoryRoot, "src/app/api"),
))
  .map((file) => relative(repositoryRoot, file))
  .filter(
    (file) =>
      file.endsWith("/route.ts") &&
      (file.includes("/api/question-papers/") ||
        file.includes("/api/questions/")),
  )
  .sort();
assert.deepEqual(
  discoveredSensitiveRoutes,
  [...sensitiveRoutes].sort(),
  "Sensitive route inventory changed; classify and protect every new route",
);

for (const route of sensitiveRoutes) {
  const source = await readFile(join(repositoryRoot, route), "utf8");
  const handlers = handlerSegments(source);
  assert.ok(handlers.length > 0, `${route} has no HTTP handlers`);

  for (const handler of handlers) {
    const authIndex = handler.source.indexOf(protectedHandlerMarker);
    assert.ok(
      authIndex >= 0,
      `${route} ${handler.method} does not use canonical authorization`,
    );

    for (const marker of dangerousMarkers) {
      const markerIndex = handler.source.indexOf(marker);
      assert.ok(
        markerIndex < 0 || authIndex < markerIndex,
        `${route} ${handler.method} uses ${marker} before authorization`,
      );
    }

    if (mutationMethods.has(handler.method)) {
      assert.match(
        handler.source,
        /requireQuestionPaperApiAccess\(request,\s*\{\s*mutation:\s*true/,
        `${route} ${handler.method} does not enforce mutation-origin checks`,
      );
    }
  }
}

const uploadRoute = await readFile(
  join(repositoryRoot, "src/app/api/question-papers/route.ts"),
  "utf8",
);
const extractRunSource = await readFile(
  join(repositoryRoot, "src/lib/question-bank-v2-extract-run.ts"),
  "utf8",
);
const uploadHandler = handlerSegments(uploadRoute).find(
  ({ method }) => method === "POST",
);
assert.ok(uploadHandler, "PDF upload handler is missing");
const uploadAndExtract = `${uploadHandler.source}\n${extractRunSource}`;
assert.match(
  uploadAndExtract,
  /QUESTION_PAPER_MAX_PDF_PAGES:\s*String\(.*maxPages\)/,
  "OCR worker does not receive the bounded PDF page limit",
);
assert.match(
  uploadAndExtract,
  /timeoutMs:\s*.*ocrTimeoutMs/,
  "OCR subprocess does not have a bounded timeout",
);
assert.match(
  uploadHandler.source,
  /validate_pdf_pages\.py/,
  "Upload handler does not run authoritative pypdf validation before OCR",
);
assert.ok(
  uploadAndExtract.indexOf("validate_pdf_pages.py") <
    uploadAndExtract.indexOf("extract_pdf.py"),
  "Authoritative PDF validation does not run before OCR",
);
assert.match(
  uploadHandler.source,
  /isAnthropicConfigured\(process\.env\.ANTHROPIC_API_KEY\)/,
  "Upload handler does not fail closed when Anthropic is unconfigured",
);
assert.ok(
  uploadAndExtract.indexOf("isAnthropicConfigured") >
    uploadAndExtract.indexOf("validate_pdf_pages.py") &&
    uploadAndExtract.indexOf("isAnthropicConfigured") <
      uploadAndExtract.indexOf("extract_pdf.py"),
  "Anthropic configuration is not checked after PDF validation and before OCR",
);
assert.ok(
  uploadHandler.source.indexOf("findSourceByChecksum") <
    uploadHandler.source.indexOf("uploadSourcePdf"),
  "Duplicate checksum lookup does not run before source storage",
);
assert.ok(
  uploadAndExtract.indexOf("isAnthropicConfigured") <
    uploadAndExtract.indexOf("extract_pdf.py"),
  "Anthropic configuration is not checked before parser spawn",
);
assert.doesNotMatch(
  uploadAndExtract,
  /\.from\(\s*["']questions["']\)/,
  "Upload handler still writes legacy questions",
);
assert.doesNotMatch(
  uploadAndExtract,
  /\.from\(\s*["']question_papers["']\)/,
  "Upload handler still writes legacy question_papers",
);
assert.doesNotMatch(
  uploadAndExtract,
  /\.from\(\s*["']generated_pdfs["']\)/,
  "Upload handler still writes legacy generated_pdfs",
);
assert.match(
  uploadAndExtract,
  /delete childEnv\.GEMINI_API_KEY/,
  "OCR worker environment still forwards GEMINI_API_KEY",
);
assert.match(
  uploadAndExtract,
  /delete childEnv\.GOOGLE_API_KEY/,
  "OCR worker environment still forwards GOOGLE_API_KEY",
);
assert.doesNotMatch(
  uploadHandler.source,
  /formData\.get\(\s*["']provider["']/,
  "Upload handler reads an untrusted provider field",
);
assert.doesNotMatch(
  uploadAndExtract,
  /GEMINI_API_KEY:\s/,
  "Upload handler still assigns a Gemini API key for OCR",
);
const extractionScript = await readFile(
  join(repositoryRoot, "scripts/extract_pdf.py"),
  "utf8",
);
assert.match(
  extractionScript,
  /validated_page_count = validate_pdf_page_count\(args\.pdf\)/,
  "OCR worker does not enforce the authoritative page limit",
);
assert.equal(
  QUESTION_PAPER_PARSER_MODEL,
  "claude-sonnet-4-6",
  "Canonical parser model is not pinned to Sonnet 4.6",
);
assert.match(
  extractionScript,
  new RegExp(`QUESTION_PAPER_PARSER_MODEL = "${QUESTION_PAPER_PARSER_MODEL}"`),
  "OCR worker is not pinned to the canonical Sonnet model",
);
assert.match(
  extractionScript,
  /model=QUESTION_PAPER_PARSER_MODEL/,
  "OCR worker does not use the canonical Anthropic model constant",
);
assert.doesNotMatch(
  extractionScript,
  /haiku|claude-haiku/i,
  "OCR worker still references Haiku",
);
assert.match(
  extractionScript,
  /def require_anthropic_api_key/,
  "OCR worker does not fail closed without ANTHROPIC_API_KEY",
);
assert.doesNotMatch(
  extractionScript,
  /USE_GEMINI|google\.generativeai|GEMINI_API_KEY|gemini-2\.5/,
  "OCR worker still contains a Gemini execution path",
);
const requirements = await readFile(
  join(repositoryRoot, "requirements.txt"),
  "utf8",
);
assert.match(requirements, /^anthropic>=/m, "requirements.txt omits anthropic");
assert.match(requirements, /^pypdf>=/m, "requirements.txt omits pypdf");
assert.doesNotMatch(
  requirements,
  /google-generativeai|google-genai/,
  "requirements.txt still declares a Gemini client",
);
const uploadOrder = [
  "requireQuestionPaperApiAccess",
  "validateUploadContentLength",
  "request.formData(",
  "validatePdfUpload",
  "writeFile(",
  "execFileAsync(",
  "findSourceByChecksum",
  "isAnthropicConfigured",
  "uploadSourcePdf",
  "createProcessingSource",
  "extract_pdf.py",
  "persistExtractedQuestions",
];
let previousIndex = -1;
for (const marker of uploadOrder) {
  const markerIndex =
    marker === "extract_pdf.py" || marker === "persistExtractedQuestions"
      ? uploadAndExtract.lastIndexOf(marker)
      : uploadAndExtract.indexOf(marker);
  assert.ok(markerIndex >= 0, `Upload handler is missing ${marker}`);
  assert.ok(
    markerIndex > previousIndex,
    `Upload handler executes ${marker} in an unsafe order`,
  );
  previousIndex = markerIndex;
}

for (const [route, method] of [
  ["src/app/api/questions/[id]/route.ts", "PATCH"],
]) {
  const source = await readFile(join(repositoryRoot, route), "utf8");
  const handler = handlerSegments(source).find(
    (candidate) => candidate.method === method,
  );
  assert.ok(handler, `${route} ${method} is missing`);
  const dbAccess = ["getSupabase()", "getV2Question(", "updateV2Question("]
    .map((marker) => handler.source.indexOf(marker))
    .filter((index) => index >= 0);
  assert.ok(dbAccess.length > 0, `${route} ${method} has no database access`);
  assert.ok(
    handler.source.indexOf("validatePngDiagram") < Math.min(...dbAccess),
    `${route} ${method} accesses the database before diagram validation`,
  );
}

const middleware = await readFile(
  join(repositoryRoot, "src/middleware.ts"),
  "utf8",
);
assert.match(middleware, /\/academics\/question-papers/);
assert.match(middleware, /evaluateQuestionPaperIdentity/);
assert.match(middleware, /emailVerified/);

const authConfiguration = await readFile(
  join(repositoryRoot, "src/lib/auth.ts"),
  "utf8",
);
assert.match(authConfiguration, /isVerifiedGoogleIdentity\(\{/);
assert.match(
  authConfiguration,
  /email:\s*token\.email/,
);
assert.match(authConfiguration, /QUESTION_PAPER_ALLOWED_EMAILS/);

const securityPolicy = await readFile(
  join(repositoryRoot, "src/lib/question-paper-security-policy.mjs"),
  "utf8",
);
assert.match(
  securityPolicy,
  /QUESTION_PAPER_AUTHORIZED_EMAIL = "info@divyahighschool\.co\.in"/,
);
assert.match(securityPolicy, /normalizedEmail !== QUESTION_PAPER_AUTHORIZED_EMAIL/);

const retiredGenerateRoutes = [
  "src/app/api/questions/generate/route.ts",
  "src/app/api/question-papers/generate-pdf/route.ts",
];
for (const route of retiredGenerateRoutes) {
  const source = await readFile(join(repositoryRoot, route), "utf8");
  const handler = handlerSegments(source).find(({ method }) => method === "POST");
  assert.ok(handler, `${route} POST is missing`);
  assert.match(handler.source, /status: 410/);
  assert.doesNotMatch(handler.source, /getSupabase\(\)/);
  assert.doesNotMatch(handler.source, /spawn\(/);
  assert.doesNotMatch(handler.source, /generated_pdfs/);
}

const canonicalGenerate = await readFile(
  join(repositoryRoot, "src/app/api/question-papers/generate/route.ts"),
  "utf8",
);
const canonicalHandler = handlerSegments(canonicalGenerate).find(
  ({ method }) => method === "POST",
);
assert.ok(canonicalHandler, "Canonical V2 generate handler is missing");
assert.ok(
  canonicalHandler.source.indexOf("requireQuestionPaperApiAccess") <
    canonicalHandler.source.indexOf("request.json("),
);
assert.match(canonicalGenerate, /saveFinalPaper/);
assert.match(canonicalGenerate, /generateAndStorePaperPdf/);
assert.match(canonicalGenerate, /loadSavedPaperItems/);
assert.doesNotMatch(canonicalGenerate, /generated_pdfs/);
assert.doesNotMatch(canonicalGenerate, /\.from\(\s*["']questions["']\)/);

const serverOnlyGuard = await readFile(
  join(repositoryRoot, "src/lib/assert-server-only.ts"),
  "utf8",
);
assert.match(
  serverOnlyGuard,
  /from "next\/headers"/,
  "Server-only modules lack a Next.js compile-time client boundary",
);

for (const file of await collectSourceFiles(join(repositoryRoot, "src"))) {
  const source = await readFile(file, "utf8");
  assert.doesNotMatch(
    source,
    /getPublicUrl\(/,
    `${relative(repositoryRoot, file)} still creates public storage URLs`,
  );
  assert.doesNotMatch(
    source,
    /NEXT_PUBLIC_ANTHROPIC|NEXT_PUBLIC_GEMINI|NEXT_PUBLIC_GOOGLE_API_KEY/,
    `${relative(repositoryRoot, file)} exposes an AI provider key to the browser`,
  );
  if (
    source.includes('"use client"') ||
    source.includes("'use client'")
  ) {
    assert.doesNotMatch(
      source,
      /supabase-server|SUPABASE_SERVICE_ROLE_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY/,
      `${relative(repositoryRoot, file)} imports server database access`,
    );
  }
}

const dockerfile = await readFile(join(repositoryRoot, "Dockerfile"), "utf8");
assert.match(
  dockerfile,
  /python3 -m pip install --no-cache-dir --break-system-packages -r requirements\.txt/,
  "Dockerfile does not install the declared Python requirements",
);
assert.doesNotMatch(
  dockerfile,
  /google-generativeai|GEMINI_API_KEY/,
  "Dockerfile still installs or configures Gemini",
);

console.log(
  `Security inventory verified ${sensitiveRoutes.length} sensitive route files.`,
);
