import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateQuestionPaperIdentity,
  isVerifiedGoogleIdentity,
  isTrustedMutationOrigin,
  isSafeQuestionPaperResourceId,
  normalizeEmail,
  parseAllowedEmails,
} from "../src/lib/question-paper-security-policy.mjs";
import {
  DEFAULT_MAX_PDF_PAGES,
  DEFAULT_MAX_UPLOAD_BYTES,
  DEFAULT_MAX_DIAGRAM_BYTES,
  DEFAULT_OCR_TIMEOUT_MS,
  DEFAULT_PDF_TIMEOUT_MS,
  MAX_CONFIGURED_DIAGRAM_BYTES,
  MAX_CONFIGURED_OCR_TIMEOUT_MS,
  MAX_CONFIGURED_PDF_PAGES,
  MAX_CONFIGURED_PDF_TIMEOUT_MS,
  MAX_CONFIGURED_UPLOAD_BYTES,
  getUploadLimits,
  validatePdfUpload,
  validatePngDiagram,
  validateUploadContentLength,
} from "../src/lib/question-paper-upload-policy.mjs";
import {
  getQuestionDiagramPath,
  renewQuestionDiagramUrl,
} from "../src/lib/question-diagram-policy.mjs";

test("anonymous identities receive 401", () => {
  const result = evaluateQuestionPaperIdentity({
    sessionPresent: false,
    allowedEmailsValue: "teacher@example.com",
  });
  assert.equal(result.allowed, false);
  assert.equal(result.status, 401);
});

test("non-allowlisted authenticated identities receive 403", () => {
  const result = evaluateQuestionPaperIdentity({
    sessionPresent: true,
    email: "other@example.com",
    emailVerified: true,
    allowedEmailsValue: "teacher@example.com",
  });
  assert.equal(result.allowed, false);
  assert.equal(result.status, 403);
});

test("allowlisted verified identities are authorized after normalization", () => {
  const result = evaluateQuestionPaperIdentity({
    sessionPresent: true,
    email: " Teacher@Example.com ",
    emailVerified: true,
    allowedEmailsValue: "teacher@example.com",
  });
  assert.equal(result.allowed, true);
  assert.equal(result.status, 200);
  assert.equal(
    evaluateQuestionPaperIdentity({
      sessionPresent: true,
      email: "teacher@example.com",
      emailVerified: true,
      allowedEmailsValue: "teacher@example.com,teacher@example.com",
    }).allowed,
    true,
  );
});

test("unverified allowlisted identities receive 403", () => {
  const result = evaluateQuestionPaperIdentity({
    sessionPresent: true,
    email: "teacher@example.com",
    emailVerified: false,
    allowedEmailsValue: "teacher@example.com",
  });
  assert.equal(result.allowed, false);
  assert.equal(result.status, 403);
});

test("verified-email status is exact, Google-bound, and email-bound", () => {
  const profile = {
    email: "Teacher@Example.com",
    email_verified: true,
  };
  assert.equal(
    isVerifiedGoogleIdentity({
      provider: "google",
      profile,
      email: "teacher@example.com",
    }),
    true,
  );
  assert.equal(
    isVerifiedGoogleIdentity({
      provider: "credentials",
      profile,
      email: "teacher@example.com",
    }),
    false,
  );
  assert.equal(
    isVerifiedGoogleIdentity({
      provider: "google",
      profile: { ...profile, email_verified: "true" },
      email: "teacher@example.com",
    }),
    false,
  );
  assert.equal(
    isVerifiedGoogleIdentity({
      provider: "google",
      profile,
      email: "other@example.com",
    }),
    false,
  );
});

test("missing or malformed allowlist configuration fails closed", () => {
  for (const value of [
    undefined,
    "",
    "   ",
    "not-an-email",
    "teacher@example..com",
    "teacher@-example.com",
    ".teacher@example.com",
    "teacher@example.com,",
    ",teacher@example.com",
  ]) {
    const result = evaluateQuestionPaperIdentity({
      sessionPresent: true,
      email: "teacher@example.com",
      emailVerified: true,
      allowedEmailsValue: value,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.status, 403);
  }
  assert.equal(parseAllowedEmails("not-an-email").configured, false);
  assert.equal(normalizeEmail(" Teacher@Example.com "), "teacher@example.com");
  for (const email of [
    "teacher@example.com.evil.test",
    "prefixteacher@example.com",
    "teacher+suffix@example.com",
  ]) {
    assert.equal(
      evaluateQuestionPaperIdentity({
        sessionPresent: true,
        email,
        emailVerified: true,
        allowedEmailsValue: "teacher@example.com",
      }).allowed,
      false,
    );
  }
  assert.equal(
    evaluateQuestionPaperIdentity({
      sessionPresent: true,
      email: "teacher@example.com",
      emailVerified: "true",
      allowedEmailsValue: "teacher@example.com",
    }).allowed,
    false,
  );
});

test("cookie-authenticated mutations require an exact trusted origin", () => {
  assert.equal(
    isTrustedMutationOrigin({
      origin: "https://school.example",
      requestOrigin: "https://school.example",
    }),
    true,
  );
  assert.equal(
    isTrustedMutationOrigin({
      origin: "http://localhost:3000",
      requestOrigin: "http://localhost:3000",
    }),
    true,
  );
  assert.equal(
    isTrustedMutationOrigin({
      origin: "http://localhost:3001",
      requestOrigin: "http://localhost:3000",
    }),
    false,
  );
  assert.equal(
    isTrustedMutationOrigin({
      origin: "https://evil.example",
      requestOrigin: "https://school.example",
    }),
    false,
  );
  assert.equal(
    isTrustedMutationOrigin({
      origin: null,
      requestOrigin: "https://school.example",
      secFetchSite: "same-origin",
    }),
    true,
  );
  for (const origin of [
    "https://school.example.evil.test",
    "https://evil-school.example",
    "https://user@school.example",
    "https://school.example/path",
    "https://school.example?query=1",
    "https://school.example:444",
  ]) {
    assert.equal(
      isTrustedMutationOrigin({
        origin,
        requestOrigin: "https://school.example",
      }),
      false,
    );
  }
  assert.equal(
    isTrustedMutationOrigin({
      origin: "HTTPS://SCHOOL.EXAMPLE",
      requestOrigin: "https://school.example",
    }),
    true,
  );
  assert.equal(
    isTrustedMutationOrigin({
      origin: "https://school.example",
      requestOrigin: "http://internal:3000",
      trustedOriginsValue:
        "https://school.example,http://localhost:3000",
    }),
    true,
  );
  assert.equal(
    isTrustedMutationOrigin({
      origin: null,
      requestOrigin: "https://school.example",
      secFetchSite: "cross-site",
    }),
    false,
  );
});

test("upload limits have conservative defaults and bounded configuration", () => {
  assert.deepEqual(getUploadLimits({}), {
    maxBytes: DEFAULT_MAX_UPLOAD_BYTES,
    maxPages: DEFAULT_MAX_PDF_PAGES,
    maxDiagramBytes: DEFAULT_MAX_DIAGRAM_BYTES,
    ocrTimeoutMs: DEFAULT_OCR_TIMEOUT_MS,
    pdfTimeoutMs: DEFAULT_PDF_TIMEOUT_MS,
  });
  assert.deepEqual(
    getUploadLimits({
      QUESTION_PAPER_MAX_UPLOAD_BYTES: "0",
      QUESTION_PAPER_MAX_PDF_PAGES: "unlimited",
    }),
    {
      maxBytes: DEFAULT_MAX_UPLOAD_BYTES,
      maxPages: DEFAULT_MAX_PDF_PAGES,
      maxDiagramBytes: DEFAULT_MAX_DIAGRAM_BYTES,
      ocrTimeoutMs: DEFAULT_OCR_TIMEOUT_MS,
      pdfTimeoutMs: DEFAULT_PDF_TIMEOUT_MS,
    },
  );
  assert.deepEqual(
    getUploadLimits({
      QUESTION_PAPER_MAX_UPLOAD_BYTES: "999999999",
      QUESTION_PAPER_MAX_PDF_PAGES: "999999999",
      QUESTION_PAPER_MAX_DIAGRAM_BYTES: "999999999",
      QUESTION_PAPER_OCR_TIMEOUT_MS: "999999999",
      QUESTION_PAPER_PDF_TIMEOUT_MS: "999999999",
    }),
    {
      maxBytes: MAX_CONFIGURED_UPLOAD_BYTES,
      maxPages: MAX_CONFIGURED_PDF_PAGES,
      maxDiagramBytes: MAX_CONFIGURED_DIAGRAM_BYTES,
      ocrTimeoutMs: MAX_CONFIGURED_OCR_TIMEOUT_MS,
      pdfTimeoutMs: MAX_CONFIGURED_PDF_TIMEOUT_MS,
    },
  );
});

test("invalid uploads are rejected before processing", () => {
  const invalidSignature = validatePdfUpload({
    name: "paper.pdf",
    mimeType: "application/pdf",
    bytes: Buffer.from("not a pdf"),
    maxBytes: DEFAULT_MAX_UPLOAD_BYTES,
    maxPages: DEFAULT_MAX_PDF_PAGES,
  });
  assert.equal(invalidSignature.status, 415);

  const wrongExtension = validatePdfUpload({
    name: "paper.txt",
    mimeType: "application/pdf",
    bytes: Buffer.from("%PDF-1.4\n1 0 obj << /Type /Pages /Count 1 >>"),
    maxBytes: DEFAULT_MAX_UPLOAD_BYTES,
    maxPages: DEFAULT_MAX_PDF_PAGES,
  });
  assert.equal(wrongExtension.status, 415);

  const tooManyPages = validatePdfUpload({
    name: "paper.pdf",
    mimeType: "application/pdf",
    bytes: Buffer.from("%PDF-1.4\n1 0 obj << /Type /Pages /Count 21 >>"),
    maxBytes: DEFAULT_MAX_UPLOAD_BYTES,
    maxPages: DEFAULT_MAX_PDF_PAGES,
  });
  assert.equal(tooManyPages.status, 422);
});

test("malformed percent-PDF content fails authoritative pypdf parsing", () => {
  const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
  const venvPython = join(repositoryRoot, "venv", "bin", "python3");
  const python = existsSync(venvPython) ? venvPython : "python3";
  const malformedPdf = Buffer.from(
    "%PDF-1.4\n1 0 obj << /Type /Pages /Count 1 >>\n%%EOF",
  );
  const result = spawnSync(
    python,
    [
      "-c",
      "import io,sys; from pypdf import PdfReader; len(PdfReader(io.BytesIO(sys.stdin.buffer.read())).pages)",
    ],
    {
      input: malformedPdf,
      timeout: 5_000,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    },
  );
  assert.notEqual(result.status, 0);
});

test("Content-Length rejects oversized requests before multipart parsing", () => {
  const result = validateUploadContentLength(
    String(DEFAULT_MAX_UPLOAD_BYTES + 2 * 1024 * 1024),
    DEFAULT_MAX_UPLOAD_BYTES,
  );
  assert.equal(result?.status, 413);
  assert.equal(validateUploadContentLength(null, DEFAULT_MAX_UPLOAD_BYTES), null);
  assert.equal(
    validateUploadContentLength(
      String(DEFAULT_MAX_UPLOAD_BYTES),
      DEFAULT_MAX_UPLOAD_BYTES,
    ),
    null,
  );
  const forgedSmallHeader = validateUploadContentLength(
    "100",
    DEFAULT_MAX_UPLOAD_BYTES,
  );
  assert.equal(forgedSmallHeader, null);
  const oversizedActualFile = validatePdfUpload({
    name: "paper.pdf",
    mimeType: "application/pdf",
    bytes: Buffer.alloc(DEFAULT_MAX_UPLOAD_BYTES + 1, 0),
    maxBytes: DEFAULT_MAX_UPLOAD_BYTES,
    maxPages: DEFAULT_MAX_PDF_PAGES,
  });
  assert.equal(oversizedActualFile.status, 413);
});

test("diagram uploads require bounded PNG content", () => {
  const invalidDiagram = validatePngDiagram(
    Buffer.from("not a png").toString("base64"),
    DEFAULT_MAX_DIAGRAM_BYTES,
  );
  assert.equal(invalidDiagram.status, 415);

  const pngHeader = Buffer.from("89504e470d0a1a0a", "hex");
  assert.equal(
    validatePngDiagram(pngHeader.toString("base64"), DEFAULT_MAX_DIAGRAM_BYTES)
      .status,
    415,
  );
  const validPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const validDiagram = validatePngDiagram(
    validPng.toString("base64"),
    DEFAULT_MAX_DIAGRAM_BYTES,
  );
  assert.equal(validDiagram.status, 200);
  assert.equal(
    validatePngDiagram(
      `data:image/png;base64,${validPng.toString("base64")}`,
      DEFAULT_MAX_DIAGRAM_BYTES,
    ).status,
    422,
  );
  assert.equal(
    validatePngDiagram("AB==", DEFAULT_MAX_DIAGRAM_BYTES).status,
    422,
  );
  assert.equal(
    validatePngDiagram(
      Buffer.concat([
        pngHeader,
        Buffer.alloc(DEFAULT_MAX_DIAGRAM_BYTES),
      ]).toString("base64"),
      DEFAULT_MAX_DIAGRAM_BYTES,
    ).status,
    413,
  );
});

test("rejected policy decisions leave protected side-effect mocks untouched", () => {
  for (const decision of [
    evaluateQuestionPaperIdentity({
      sessionPresent: false,
      allowedEmailsValue: "teacher@example.com",
    }),
    evaluateQuestionPaperIdentity({
      sessionPresent: true,
      email: "other@example.com",
      emailVerified: true,
      allowedEmailsValue: "teacher@example.com",
    }),
    evaluateQuestionPaperIdentity({
      sessionPresent: true,
      email: "teacher@example.com",
      emailVerified: false,
      allowedEmailsValue: "teacher@example.com",
    }),
  ]) {
    const calls = { database: 0, python: 0, provider: 0 };
    if (decision.allowed) {
      calls.database++;
      calls.python++;
      calls.provider++;
    }
    assert.deepEqual(calls, { database: 0, python: 0, provider: 0 });
  }
});

test("diagram URLs are renewed from stable ID-bound paths", async () => {
  assert.equal(isSafeQuestionPaperResourceId("q_123-abc"), true);
  for (const unsafeId of ["", "../secret", "q/other", "q.png", "a".repeat(129)]) {
    assert.equal(isSafeQuestionPaperResourceId(unsafeId), false);
  }
  assert.equal(
    getQuestionDiagramPath("q_123", "q_123.png"),
    "q_123.png",
  );
  assert.equal(
    getQuestionDiagramPath(
      "q_123",
      "https://project.supabase.co/storage/v1/object/public/diagrams/q_123.png",
    ),
    "q_123.png",
  );
  assert.equal(
    getQuestionDiagramPath("q_123", "another-question.png"),
    null,
  );

  let signatures = 0;
  const sign = async (path) => `signed:${path}:${++signatures}`;
  const first = await renewQuestionDiagramUrl({
    questionId: "q_123",
    storedValue: "q_123.png",
    sign,
  });
  const renewed = await renewQuestionDiagramUrl({
    questionId: "q_123",
    storedValue: "q_123.png",
    sign,
  });
  assert.notEqual(first, renewed);
  assert.equal(signatures, 2);
});
