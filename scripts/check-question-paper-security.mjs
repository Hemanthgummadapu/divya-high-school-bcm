import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(fileURLToPath(new URL("..", import.meta.url)));
const sensitiveRoutes = [
  "src/app/api/question-papers/route.ts",
  "src/app/api/question-papers/[id]/route.ts",
  "src/app/api/question-papers/generate/route.ts",
  "src/app/api/question-papers/generate-pdf/route.ts",
  "src/app/api/questions/[id]/route.ts",
  "src/app/api/questions/generate/route.ts",
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
  "spawn(",
  "execFileAsync(",
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
const uploadHandler = handlerSegments(uploadRoute).find(
  ({ method }) => method === "POST",
);
assert.ok(uploadHandler, "PDF upload handler is missing");
assert.match(
  uploadHandler.source,
  /QUESTION_PAPER_MAX_PDF_PAGES:\s*String\(limits\.maxPages\)/,
  "OCR worker does not receive the bounded PDF page limit",
);
assert.match(
  uploadHandler.source,
  /timeout:\s*limits\.ocrTimeoutMs/,
  "OCR subprocess does not have a bounded timeout",
);
assert.match(
  uploadHandler.source,
  /validate_pdf_pages\.py/,
  "Upload handler does not run authoritative pypdf validation before OCR",
);
assert.ok(
  uploadHandler.source.indexOf("validate_pdf_pages.py") <
    uploadHandler.source.indexOf("extract_pdf.py"),
  "Authoritative PDF validation does not run before OCR",
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
const uploadOrder = [
  "requireQuestionPaperApiAccess",
  "validateUploadContentLength",
  "request.formData(",
  "validatePdfUpload",
  "writeFile(",
  "execFileAsync(",
  "getSupabase()",
];
let previousIndex = -1;
for (const marker of uploadOrder) {
  const markerIndex = uploadHandler.source.indexOf(marker);
  assert.ok(markerIndex >= 0, `Upload handler is missing ${marker}`);
  assert.ok(
    markerIndex > previousIndex,
    `Upload handler executes ${marker} in an unsafe order`,
  );
  previousIndex = markerIndex;
}

for (const [route, method] of [
  ["src/app/api/question-papers/[id]/route.ts", "POST"],
  ["src/app/api/questions/[id]/route.ts", "PATCH"],
]) {
  const source = await readFile(join(repositoryRoot, route), "utf8");
  const handler = handlerSegments(source).find(
    (candidate) => candidate.method === method,
  );
  assert.ok(handler, `${route} ${method} is missing`);
  assert.ok(
    handler.source.indexOf("validatePngDiagram") <
      handler.source.indexOf("getSupabase()"),
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

const generatedPdfRoute = await readFile(
  join(repositoryRoot, "src/app/api/questions/generate/route.ts"),
  "utf8",
);
const generatedPdfHandler = handlerSegments(generatedPdfRoute).find(
  ({ method }) => method === "POST",
);
assert.ok(generatedPdfHandler, "Primary PDF generation handler is missing");
assert.ok(
  generatedPdfHandler.source.indexOf("const path = getQuestionDiagramPath") <
    generatedPdfHandler.source.indexOf("spawn(pythonCmd, [scriptPath]"),
  "Stored diagrams are not resolved before PDF generation",
);
assert.match(
  generatedPdfRoute,
  /storage\.from\(QUESTION_DIAGRAM_BUCKET\)\s*\.download\(path\)/s,
  "PDF generation does not load private diagrams by stable object path",
);

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
  if (
    source.includes('"use client"') ||
    source.includes("'use client'")
  ) {
    assert.doesNotMatch(
      source,
      /supabase-server|SUPABASE_SERVICE_ROLE_KEY/,
      `${relative(repositoryRoot, file)} imports server database access`,
    );
  }
}

console.log(
  `Security inventory verified ${sensitiveRoutes.length} sensitive route files.`,
);
