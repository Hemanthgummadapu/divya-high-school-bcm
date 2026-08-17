/**
 * Deterministic start-to-finish Question Bank workflow.
 *
 * Representative school questions are pushed through the same production
 * helpers the real request path uses — the Python extractor (mocked provider),
 * the Node page-result contract, normalization, the persistence plan, review
 * and approval rules, bank filtering, selection, section grouping, the paper
 * snapshot builder and finally the JK-82 generator — with no Anthropic call,
 * no Supabase connection and no legacy table.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPersistencePlan,
  validateDocumentResult,
} from "../src/lib/question-bank-v2-extract.mjs";
import { inlineDiagramCrops } from "../src/lib/question-bank-v2-diagram-crop.mjs";
import {
  canTransitionStatus,
  parseListQuery,
  resolveStatusAction,
} from "../src/lib/question-bank-v2-review.mjs";
import {
  buildPaperSnapshots,
  detectSelectionConflicts,
  parseGenerateRequest,
  planTemplateFromPaper,
  verifyBankQuestions,
} from "../src/lib/question-bank-v2-paper.mjs";
import {
  groupQuestionsIntoSections,
  summarizeSelection,
} from "../src/lib/question-bank-v2-paper-ui.mjs";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const python = existsSync(join(root, "venv", "bin", "python3"))
  ? join(root, "venv", "bin", "python3")
  : "python3";

const SOURCE_ID = "11111111-1111-4111-8111-111111111111";
const SYMBOLS = ["△", "∠", "∥", "⊥", "≤", "≥", "≠", "±", "×", "÷", "√", "π", "θ", "°", "²", "³", "₁", "₂"];

const SYMBOL_QUESTION =
  "In △ABC, ∠B = 90° and PQ ∥ ST with RS ⊥ PQ. Given θ ≤ 45°, r ≥ 3.5 cm, " +
  "evaluate √144 × ½ ÷ π ± 2² − 3³ where h₁ = 12 and a₂ ≠ 7.";

function uuid(seed) {
  const hex = String(seed).padStart(12, "0");
  return `aaaaaaaa-0000-4000-8000-${hex}`;
}

/** One page of mocked provider output, in the shape extract_pdf.py emits. */
function providerPage(pageNumber, questions, status = "succeeded", errorCategory) {
  if (status === "failed") {
    return { pageNumber, status, errorCategory, questions: [] };
  }
  return { pageNumber, status, questions };
}

function extractionDocument() {
  return {
    schemaVersion: 1,
    pageCount: 4,
    pages: [
      providerPage(1, [
        {
          questionText: "The value of √144 × ½ is:",
          rawExtractedText: "1. The value of root144 x 1/2 is: (A) 6 (B) 12 (C) 72 (D) None",
          questionType: "MCQ",
          marks: 1,
          sectionLabel: "PART-B",
          options: ["A) 6", "B) 12", "C) 72", "D) None of these"],
          correctAnswer: null,
        },
        {
          questionText: "If l ∥ m and a transversal makes 65° with l, find the remaining angles.",
          rawExtractedText: "2. If l || m ...",
          questionType: "Short",
          marks: 2,
          sectionLabel: "SECTION-I",
        },
      ]),
      providerPage(2, [
        {
          questionText: SYMBOL_QUESTION,
          rawExtractedText: SYMBOL_QUESTION,
          questionType: "Medium",
          marks: 4,
          sectionLabel: "SECTION-II",
          diagram: "right triangle ABC with the right angle at B",
        },
      ]),
      providerPage(3, [
        {
          questionText:
            "A solid consists of a cone of height h₁ = 12 cm on a hemisphere of radius r = 3.5 cm. " +
            "Using V = ⅓πr²h₁ + ⅔πr³, find the total volume correct to ±0.01 cm³.",
          rawExtractedText: "4. A solid consists of a cone ...",
          questionType: "Long",
          marks: 8,
          sectionLabel: "SECTION-III",
        },
      ]),
      // A deliberate page failure must not renumber or hide the others.
      providerPage(4, [], "failed", "provider"),
    ],
  };
}

test("extraction keeps page numbers, order and symbols but drops source sections", () => {
  const document = validateDocumentResult(extractionDocument(), 4);
  assert.equal(document.ok, true);
  assert.deepEqual(
    document.pages.map((page) => page.pageNumber),
    [1, 2, 3, 4],
  );

  const plan = buildPersistencePlan(document.pages);
  assert.equal(plan.ok, true);
  assert.equal(plan.status, "partial", "one failed page means partial, not completed");
  assert.deepEqual(plan.failedPageNumbers, [4]);
  assert.equal(plan.processedPageCount, 3);
  assert.equal(plan.questions.length, 4);

  // Page and source order stay authoritative and one-based.
  assert.deepEqual(
    plan.questions.map((q) => [q.source_page_number, q.source_order]),
    [
      [1, 1],
      [1, 2],
      [2, 1],
      [3, 1],
    ],
  );

  // Sections belong to a prepared paper, so the source paper's own PART and
  // SECTION arrangement is never carried onto a reusable bank question.
  assert.deepEqual(
    plan.questions.map((q) => q.section_label),
    [null, null, null, null],
  );

  // MCQ options keep their labels, order and text.
  assert.deepEqual(plan.questions[0].options, [
    { label: "A", text: "6" },
    { label: "B", text: "12" },
    { label: "C", text: "72" },
    { label: "D", text: "None of these" },
  ]);
  assert.equal(plan.questions[0].correct_answer, null);

  // Every symbol survives extraction normalization unchanged.
  const symbolQuestion = plan.questions[2];
  for (const symbol of ["△", "∠", "∥", "⊥", "≤", "≥", "≠", "±", "×", "÷", "√", "π", "θ", "°", "²", "³", "₁", "₂"]) {
    assert.ok(symbol in {} === false, "sanity");
    assert.ok(
      symbolQuestion.question_text.includes(symbol),
      `symbol ${symbol} lost during normalization`,
    );
  }

  // A described-but-unattached diagram stays visible for review.
  assert.match(symbolQuestion.question_text, /\[Diagram: right triangle ABC/);
  assert.equal(symbolQuestion.diagramPngBase64, null);
});

test("the Python worker crops a real diagram and reports failed pages honestly", (t) => {
  const probe = spawnSync(python, ["-c", "import pdf2image, pypdf, PIL"], {
    cwd: root,
    timeout: 30_000,
  });
  if (probe.status !== 0) {
    t.skip("extraction Python dependencies are unavailable");
    return;
  }

  const work = mkdtempSync(join(tmpdir(), "qb-e2e-"));
  try {
    const pdfPath = join(work, "original.pdf");
    const outputPath = join(work, "extract.json");
    execFileSync(
      python,
      [
        "-c",
        [
          "import sys",
          "from pypdf import PdfWriter",
          "w = PdfWriter()",
          "[w.add_blank_page(width=612, height=792) for _ in range(2)]",
          "w.write(open(sys.argv[1], 'wb'))",
        ].join("\n"),
        pdfPath,
      ],
      { cwd: root, timeout: 60_000 },
    );

    const env = { ...process.env, QUESTION_PAPER_EXTRACT_MOCK: "diagram" };
    delete env.ANTHROPIC_API_KEY;
    const result = spawnSync(
      python,
      [
        join(root, "scripts", "extract_pdf.py"),
        "--pdf", pdfPath,
        "--subject", "Mathematics",
        "--grade", "10",
        "--year", "2026",
        "--output", outputPath,
        "--work-dir", work,
      ],
      { cwd: root, env, timeout: 180_000, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);

    // No provider key was present and no live request was made.
    assert.doesNotMatch(result.stderr, /sk-ant-/);
    assert.match(result.stderr, /outcome=mock/);

    const document = JSON.parse(readFileSync(outputPath, "utf8"));
    assert.equal(document.pageCount, 2);
    const validated = validateDocumentResult(document, 2);
    assert.equal(validated.ok, true);

    const cropRef = validated.pages[0].questions[0].diagramCropRef;
    assert.match(cropRef, /^crops\/[0-9a-f-]{36}\.png$/);
    const cropBytes = readFileSync(join(work, cropRef));
    assert.ok(cropBytes.byteLength > 0, "crop must be a real non-empty PNG");
    assert.equal(cropBytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    // Large base64 payloads never travel inside the extraction JSON.
    assert.equal(readFileSync(outputPath, "utf8").includes("diagramPngBase64"), false);

    // The unusable box is dropped but its description survives.
    const unusable = validated.pages[0].questions[1];
    assert.equal(unusable.diagramCropRef, null);
    assert.match(String(unusable.diagram), /could not box/);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test("Node inlines the crop, and the persisted question carries the PNG", async () => {
  const work = mkdtempSync(join(tmpdir(), "qb-e2e-inline-"));
  try {
    const png = Buffer.from(
      "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753" +
        "de0000000c4944415478da63f8ffff3f0005fe02fea735cbd10000000049454e44ae426082",
      "hex",
    );
    const ref = "crops/12345678-1234-4234-8234-123456789abc.png";
    execFileSync("mkdir", ["-p", join(work, "crops")]);
    writeFileSync(join(work, ref), png);

    const pages = [
      {
        pageNumber: 2,
        status: "succeeded",
        questions: [
          {
            questionText: SYMBOL_QUESTION,
            rawExtractedText: SYMBOL_QUESTION,
            questionType: "Medium",
            marks: 4,
            sectionLabel: "SECTION-II",
            diagram: "right triangle",
            diagramCropRef: ref,
          },
        ],
      },
    ];
    await inlineDiagramCrops(pages, work, 2 * 1024 * 1024);
    const plan = buildPersistencePlan(pages);
    assert.equal(plan.ok, true);
    const question = plan.questions[0];
    assert.equal(question.diagramPngBase64, png.toString("base64"));
    // With a real image attached the text is not padded with a description.
    assert.equal(question.question_text, SYMBOL_QUESTION);
    for (const symbol of SYMBOLS) {
      assert.ok(question.question_text.includes(symbol), symbol);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test("review approval rules gate what can reach the bank", () => {
  assert.deepEqual(resolveStatusAction("approve", "needs_review"), {
    ok: true,
    nextStatus: "approved",
  });
  assert.deepEqual(resolveStatusAction("reject", "needs_review"), {
    ok: true,
    nextStatus: "rejected",
  });
  assert.deepEqual(resolveStatusAction("archive", "approved"), {
    ok: true,
    nextStatus: "archived",
  });
  // Save keeps the current status, and illegal jumps are refused.
  assert.deepEqual(resolveStatusAction("save", "needs_review"), {
    ok: true,
    nextStatus: "needs_review",
  });
  assert.equal(resolveStatusAction("approve", "archived").ok, false);
  assert.equal(canTransitionStatus("needs_review", "archived"), false);

  // The bank view only ever lists approved questions.
  const bank = parseListQuery(new URLSearchParams({ view: "bank", page: "1", pageSize: "20" }));
  assert.equal(bank.ok, true);
  assert.equal(bank.query.status, "approved");
  const review = parseListQuery(new URLSearchParams({ view: "review", page: "1", pageSize: "20" }));
  assert.equal(review.query.status, "needs_review");

  // Filters are parsed server-side, including the source-paper filter.
  const filtered = parseListQuery(
    new URLSearchParams({
      view: "bank",
      page: "1",
      pageSize: "20",
      grade: "10",
      subject: "Mathematics",
      year: "2026",
      type: "MCQ",
      marks: "1",
      sourceId: SOURCE_ID,
      q: "triangle",
    }),
  );
  assert.equal(filtered.ok, true);
  assert.equal(filtered.query.grade, 10);
  assert.equal(filtered.query.sourceId, SOURCE_ID);
  assert.equal(filtered.query.search, "triangle");
});

/** Approved bank rows as the database would return them. */
function bankRows() {
  return [
    {
      id: uuid(1),
      grade: 10,
      subject: "Mathematics",
      academic_year: 2026,
      question_type: "MCQ",
      question_text: "The value of √144 × ½ is:",
      options: [
        { label: "A", text: "6" },
        { label: "B", text: "12" },
        { label: "C", text: "72" },
        { label: "D", text: "None of these" },
      ],
      marks: 1,
      diagram_path: null,
      review_status: "approved",
    },
    {
      id: uuid(2),
      grade: 10,
      subject: "Mathematics",
      academic_year: 2026,
      question_type: "Short",
      question_text: "If l ∥ m and a transversal makes 65° with l, find the remaining angles.",
      options: [],
      marks: 2,
      diagram_path: null,
      review_status: "approved",
    },
    {
      id: uuid(3),
      grade: 10,
      subject: "Mathematics",
      academic_year: 2026,
      question_type: "Medium",
      question_text: SYMBOL_QUESTION,
      options: [],
      marks: 4,
      diagram_path: `diagrams/${uuid(3)}/12345678-1234-4234-8234-123456789abc.png`,
      review_status: "approved",
    },
    {
      id: uuid(4),
      grade: 10,
      subject: "Mathematics",
      academic_year: 2026,
      question_type: "Long",
      question_text: "Find the total volume of the solid, correct to ±0.01 cm³.",
      options: [],
      marks: 8,
      diagram_path: null,
      review_status: "approved",
    },
  ];
}

test("selection, grouping and snapshots build one paper per class and subject", () => {
  const rows = bankRows();
  const selected = rows.map((row) => ({
    id: row.id,
    grade: row.grade,
    subject: row.subject,
    questionType: row.question_type,
    marks: row.marks,
  }));

  const summary = summarizeSelection(selected);
  assert.deepEqual(summary, { total: 4, mcq: 1, short: 1, medium: 1, long: 1, marks: 15 });

  const conflictFree = detectSelectionConflicts(selected);
  assert.equal(conflictFree.ok, true);
  const mixed = detectSelectionConflicts([
    ...selected,
    { id: uuid(9), grade: 8, subject: "Physics", questionType: "Short", marks: 2 },
  ]);
  assert.equal(mixed.ok, false);

  const sections = groupQuestionsIntoSections(selected);
  assert.deepEqual(
    sections.map((section) => section.title),
    [
      "Section A — MCQ",
      "Section B — Short Answer",
      "Section C — Medium Answer",
      "Section D — Long Answer",
    ],
  );
  assert.ok(sections.every((section) => section.questionIds.length > 0), "no empty sections");

  const items = sections.flatMap((section, sectionIndex) =>
    section.questionIds.map((id, questionIndex) => ({
      questionId: id,
      sectionTitle: section.title,
      sectionInstructions: "Answer all questions.",
      sectionOrder: sectionIndex + 1,
      questionOrder: questionIndex + 1,
    })),
  );

  const parsed = parseGenerateRequest({
    creationKey: "e2e-creation-key",
    title: "Class 10 Mathematics Quarterly 2026 – Set A",
    academicYear: 2026,
    durationMinutes: 180,
    items,
  });
  assert.equal(parsed.ok, true);

  const verified = verifyBankQuestions(
    parsed.items.map((item) => item.questionId),
    rows,
  );
  assert.equal(verified.ok, true);
  assert.equal(verified.grade, 10);
  assert.equal(verified.subject, "Mathematics");

  const built = buildPaperSnapshots(parsed.items, rows);
  assert.equal(built.ok, true);
  assert.equal(built.snapshots.length, 4);
  // Snapshots come from the database rows, and marks total server-side.
  assert.equal(
    built.snapshots.reduce((sum, item) => sum + item.snapshot_marks, 0),
    15,
  );
  assert.deepEqual(
    built.snapshots.map((item) => item.number_label),
    ["1", "2", "3", "4"],
  );
  const mediumSnapshot = built.snapshots.find(
    (item) => item.snapshot_question_type === "Medium",
  );
  for (const symbol of SYMBOLS) {
    assert.ok(mediumSnapshot.snapshot_text.includes(symbol), symbol);
  }
  assert.match(
    mediumSnapshot.snapshot_diagram_path,
    /^diagrams\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.png$/,
  );
});

test("unapproved questions cannot reach a generated paper", () => {
  const rows = bankRows();
  for (const status of ["needs_review", "rejected", "archived"]) {
    const tampered = rows.map((row, index) =>
      index === 0 ? { ...row, review_status: status } : row,
    );
    const verified = verifyBankQuestions(
      rows.map((row) => row.id),
      tampered,
    );
    assert.equal(verified.ok, false, `${status} must be refused`);
  }
  // A question that no longer exists is refused too.
  const missing = verifyBankQuestions(
    rows.map((row) => row.id),
    rows.slice(1),
  );
  assert.equal(missing.ok, false);
});

test("a previous paper reused as a template rebuilds from current approved rows", () => {
  const rows = bankRows();
  const savedItems = rows.map((row, index) => ({
    bank_question_id: row.id,
    section_title: `Section ${index + 1}`,
    section_instructions: "Answer all questions.",
    section_display_order: index + 1,
    question_display_order: 1,
    number_label: String(index + 1),
    snapshot_text: "historical snapshot that must not be reused",
    snapshot_marks: row.marks,
  }));

  // Two questions are no longer approved.
  const currentRows = rows.map((row, index) =>
    index >= 2 ? { ...row, review_status: "archived" } : row,
  );
  const plan = planTemplateFromPaper(savedItems, currentRows);
  assert.equal(plan.available.length, 2);
  assert.equal(plan.unavailable.length, 2);
  assert.match(plan.warning, /2 questions from this paper are no longer available/);
  assert.equal(
    JSON.stringify(plan).includes("historical snapshot that must not be reused"),
    false,
    "old snapshot text must never become new authoritative content",
  );
  assert.equal(JSON.stringify(plan).includes("generated-papers/"), false);
});

test("the JK-82 generator prints the saved snapshots and nothing internal", (t) => {
  const probe = spawnSync(python, ["-c", "import reportlab, pypdf"], {
    cwd: root,
    timeout: 30_000,
  });
  if (probe.status !== 0) {
    t.skip("PDF generator dependencies are unavailable");
    return;
  }

  const rows = bankRows();
  const sections = groupQuestionsIntoSections(
    rows.map((row) => ({
      id: row.id,
      grade: row.grade,
      subject: row.subject,
      questionType: row.question_type,
      marks: row.marks,
    })),
  );
  const items = sections.flatMap((section, sectionIndex) =>
    section.questionIds.map((id, questionIndex) => ({
      questionId: id,
      sectionTitle: section.title,
      sectionInstructions: "Answer all questions.",
      sectionOrder: sectionIndex + 1,
      questionOrder: questionIndex + 1,
    })),
  );
  const built = buildPaperSnapshots(items, rows);
  assert.equal(built.ok, true);

  const work = mkdtempSync(join(tmpdir(), "qb-e2e-pdf-"));
  try {
    // The generator payload is built only from saved snapshots.
    const payload = {
      header: {
        examCode: "JK-82",
        examTitle: "Class 10 Mathematics Quarterly 2026 – Set A",
        subject: "Mathematics",
        class: "X",
        maxMarks: String(
          built.snapshots.reduce((sum, item) => sum + item.snapshot_marks, 0),
        ),
        time: "3.00 Hrs",
        academicYear: "2026",
        schoolName: "Divya High School",
        location: "Bhadrachalam",
      },
      sections: sections.map((section, index) => ({
        title: section.title,
        instructions: "Answer all questions.",
        questions: built.snapshots
          .filter((item) => item.section_display_order === index + 1)
          .map((item) => ({
            number: item.number_label,
            text: item.snapshot_text,
            options: item.snapshot_options,
            marks: item.snapshot_marks,
            type: item.snapshot_question_type,
            // The stored path is private: the renderer receives a status, not a path.
            diagramStatus: item.snapshot_diagram_path ? "unavailable" : "none",
          })),
      })),
    };
    const payloadPath = join(work, "paper.json");
    const pdfPath = join(work, "paper.pdf");
    writeFileSync(payloadPath, JSON.stringify(payload));
    const result = spawnSync(
      python,
      [
        join(root, "scripts", "generate_jk82_pdf.py"),
        "--input", payloadPath,
        "--output", pdfPath,
        "--work-dir", work,
      ],
      { cwd: root, timeout: 120_000, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);

    const bytes = readFileSync(pdfPath);
    assert.equal(bytes.subarray(0, 5).toString("latin1"), "%PDF-");

    const text = execFileSync(
      python,
      [
        "-c",
        [
          "import sys",
          "from pypdf import PdfReader",
          "r = PdfReader(sys.argv[1])",
          "print('\\n'.join((p.extract_text() or '') for p in r.pages))",
        ].join("\n"),
        pdfPath,
      ],
      { cwd: root, timeout: 60_000, encoding: "utf8" },
    );

    assert.match(text, /Divya High School/);
    assert.match(text, /Subject: Mathematics/);
    assert.match(text, /Class 10 Mathematics Quarterly 2026/);
    assert.match(text, /Max\. Marks: 15/);
    assert.match(text, /Time: 3\.00 Hrs/);
    assert.match(text, /Page 1 of/);
    for (const title of [
      "Section A",
      "Section B",
      "Section C",
      "Section D",
    ]) {
      assert.ok(text.includes(title), `missing ${title}`);
    }
    assert.match(text, /\[1 m\]/);
    assert.match(text, /\[8 m\]/);
    assert.match(text, /None of these/);
    // A snapshot diagram whose object is missing degrades safely.
    assert.match(text, /\[Diagram unavailable\]/);

    // Nothing internal is ever printed on the paper.
    for (const forbidden of [
      "diagrams/",
      "generated-papers/",
      "source-pdfs/",
      "review_status",
      "approved",
      "bank_question_id",
      SOURCE_ID,
      uuid(3),
    ]) {
      assert.equal(text.includes(forbidden), false, `leaked ${forbidden}`);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test("no step of the workflow reaches Anthropic, Supabase or a legacy table", () => {
  const sources = [
    "src/lib/question-bank-v2-paper.mjs",
    "src/lib/question-bank-v2-paper-ui.mjs",
    "src/lib/question-bank-v2-extract.mjs",
    "src/lib/question-bank-v2-diagram-crop.mjs",
    "src/app/api/question-papers/generate/route.ts",
  ].map((file) => readFileSync(join(root, file), "utf8"));

  for (const source of sources) {
    // No provider client, endpoint or request anywhere in the paper workflow.
    // (A guard that refuses to log ANTHROPIC_API_KEY is not a provider call.)
    assert.doesNotMatch(source, /from\s+["']@?anthropic|new\s+Anthropic|api\.anthropic\.com|messages\.create/);
    assert.doesNotMatch(source, /\.from\(\s*["']questions["']\)/);
    assert.doesNotMatch(source, /\.from\(\s*["']question_papers["']\)/);
  }

  const generateRoute = readFileSync(
    join(root, "src/app/api/question-papers/generate/route.ts"),
    "utf8",
  );
  const retryBranch = generateRoute.slice(
    generateRoute.indexOf('action === "retry"'),
    generateRoute.indexOf("if (!parsed.items"),
  );
  assert.doesNotMatch(retryBranch, /runExtractAndPersist|extract_pdf|anthropic/i);
});
