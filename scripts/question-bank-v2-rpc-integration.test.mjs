import assert from "node:assert/strict";
import test from "node:test";
// Regression: Phase 2B persist used unnest(...) AS page_number while also
// declaring a page_number variable, which PostgreSQL rejects with 42702.
import { createClient } from "@supabase/supabase-js";
import {
  createPersistIdempotencyKey,
  sourceStoragePath,
  toRpcQuestions,
} from "../src/lib/question-bank-v2-extract.mjs";

const postgrestUrl = process.env.RPC_TEST_POSTGREST_URL;
const serviceKey = process.env.RPC_TEST_SERVICE_KEY;
const anonKey = process.env.RPC_TEST_ANON_KEY;
const authKey = process.env.RPC_TEST_AUTH_KEY;

if (!postgrestUrl || !serviceKey || !anonKey || !authKey) {
  throw new Error("RPC integration environment is not configured");
}

function createRoleClient(key) {
  return createClient("http://rpc-integration.local", key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) => {
        const raw = typeof input === "string" ? input : input.url;
        const rewritten = raw.replace(
          "http://rpc-integration.local/rest/v1",
          postgrestUrl.replace(/\/$/, ""),
        );
        return fetch(rewritten, init);
      },
    },
  });
}

const service = createRoleClient(serviceKey);
const anon = createRoleClient(anonKey);
const authenticated = createRoleClient(authKey);

function applicationRpcArgs(sourceId, plan) {
  return {
    p_source_id: sourceId,
    p_idempotency_key: createPersistIdempotencyKey(sourceId),
    p_processed_page_count: plan.processedPageCount,
    p_failed_page_numbers: Array.isArray(plan.failedPageNumbers)
      ? plan.failedPageNumbers
      : [],
    p_error_category: plan.errorCategory ?? null,
    p_error_message:
      plan.status === "completed"
        ? null
        : plan.status === "partial"
          ? "Some pages could not be extracted"
          : "No questions could be saved from this PDF",
    p_questions: toRpcQuestions(plan.questions),
  };
}

function syntheticQuestion(page, order, extras = {}) {
  return {
    source_page_number: page,
    source_order: order,
    question_type: extras.question_type ?? "MCQ",
    language: extras.language ?? "en",
    raw_extracted_text: extras.raw_extracted_text ?? `Synthetic raw ${page}.${order}`,
    question_text: extras.question_text ?? `Synthetic question ${page}.${order}`,
    options: extras.options ?? [
      { label: "A", text: "Synthetic option A" },
      { label: "B", text: "Synthetic option B" },
    ],
    correct_answer: extras.correct_answer ?? "A",
    marks: extras.marks ?? 1,
    section_label: extras.section_label ?? "Part A",
  };
}

function completedPlan(questions) {
  return {
    status: "completed",
    processedPageCount: 2,
    failedPageNumbers: [],
    errorCategory: null,
    questions,
  };
}

async function insertProcessingSource(input) {
  const id = input.id;
  const { error } = await service.from("question_sources").insert({
    id,
    original_filename: input.originalFilename ?? "synthetic.pdf",
    display_name: input.displayName ?? "Synthetic paper",
    storage_path: sourceStoragePath(id),
    content_sha256: input.contentSha256,
    mime_type: "application/pdf",
    byte_size: input.byteSize ?? 1024,
    page_count: input.pageCount ?? 2,
    grade: input.grade ?? 10,
    subject: input.subject ?? "Mathematics",
    academic_year: input.academicYear ?? 2026,
    extraction_status: "processing",
  });
  if (error) throw new Error(`source_insert_failed:${error.code || error.message}`);
  return id;
}

function sha(label) {
  const hex = Buffer.from(label.padEnd(32, "0")).toString("hex").slice(0, 64);
  return hex;
}

async function persist(sourceId, plan) {
  return service.rpc("persist_extracted_questions", applicationRpcArgs(sourceId, plan));
}

async function loadSource(sourceId) {
  const { data, error } = await service
    .from("question_sources")
    .select(
      "id, extraction_status, processed_page_count, failed_page_numbers, extracted_question_count, persist_idempotency_key, grade, subject, academic_year",
    )
    .eq("id", sourceId)
    .maybeSingle();
  if (error) throw new Error(`source_read_failed:${error.message}`);
  return data;
}

async function loadQuestions(sourceId) {
  const { data, error } = await service
    .from("question_bank_questions")
    .select(
      "id, source_id, source_page_number, source_order, grade, subject, academic_year, review_status, question_type",
    )
    .eq("source_id", sourceId)
    .order("source_page_number")
    .order("source_order");
  if (error) throw new Error(`question_read_failed:${error.message}`);
  return data ?? [];
}

function assertDenied(error) {
  assert.ok(error, "expected RPC denial");
  const status = Number(error.status || error.code);
  assert.ok(
    status === 401 || status === 403 || error.code === "42501" || error.message,
    `unexpected denial shape: ${error.code || error.status}`,
  );
}

test("completed extraction persists two reviewable questions", async () => {
  const sourceId = "11111111-1111-4111-8111-111111111111";
  await insertProcessingSource({
    id: sourceId,
    contentSha256: sha("completed-source"),
  });
  const plan = completedPlan([
    syntheticQuestion(1, 1),
    syntheticQuestion(2, 1, { question_type: "Short", options: [], correct_answer: null, marks: 2 }),
  ]);
  const { data, error } = await persist(sourceId, plan);
  assert.equal(error, null, error?.message);
  assert.equal(data.ok, true);
  assert.equal(data.idempotent, false);
  assert.equal(data.source_id, sourceId);
  assert.equal(data.extraction_status, "completed");
  assert.equal(data.extracted_question_count, 2);

  const source = await loadSource(sourceId);
  assert.equal(source.extraction_status, "completed");
  assert.equal(source.processed_page_count, 2);
  assert.deepEqual(source.failed_page_numbers, []);
  assert.equal(source.extracted_question_count, 2);
  assert.equal(source.persist_idempotency_key, createPersistIdempotencyKey(sourceId));
  assert.equal(source.grade, 10);
  assert.equal(source.subject, "Mathematics");
  assert.equal(source.academic_year, 2026);

  const questions = await loadQuestions(sourceId);
  assert.equal(questions.length, 2);
  assert.equal(questions[0].source_id, sourceId);
  assert.equal(questions[0].source_page_number, 1);
  assert.equal(questions[0].source_order, 1);
  assert.equal(questions[0].grade, 10);
  assert.equal(questions[0].subject, "Mathematics");
  assert.equal(questions[0].academic_year, 2026);
  assert.equal(questions[0].review_status, "needs_review");
  assert.equal(questions[1].source_page_number, 2);
  assert.equal(questions[1].source_order, 1);
  assert.equal(questions[1].review_status, "needs_review");
});

test("partial extraction records failed pages and saved questions", async () => {
  const sourceId = "22222222-2222-4222-8222-222222222222";
  await insertProcessingSource({
    id: sourceId,
    contentSha256: sha("partial-source"),
  });
  const plan = {
    status: "partial",
    processedPageCount: 1,
    failedPageNumbers: [2],
    errorCategory: "parse",
    questions: [syntheticQuestion(1, 1)],
  };
  const { data, error } = await persist(sourceId, plan);
  assert.equal(error, null, error?.message);
  assert.equal(data.extraction_status, "partial");
  assert.equal(data.extracted_question_count, 1);
  const source = await loadSource(sourceId);
  assert.equal(source.extraction_status, "partial");
  assert.deepEqual(source.failed_page_numbers, [2]);
  assert.equal((await loadQuestions(sourceId)).length, 1);
});

test("total failure persists empty questions and failed status", async () => {
  const sourceId = "33333333-3333-4333-8333-333333333333";
  await insertProcessingSource({
    id: sourceId,
    contentSha256: sha("failed-source"),
  });
  const plan = {
    status: "failed",
    processedPageCount: 0,
    failedPageNumbers: [],
    errorCategory: "provider",
    questions: [],
  };
  const { data, error } = await persist(sourceId, plan);
  assert.equal(error, null, error?.message);
  assert.equal(data.extraction_status, "failed");
  assert.equal(data.extracted_question_count, 0);
  assert.equal((await loadQuestions(sourceId)).length, 0);
});

test("identical retry is idempotent", async () => {
  const sourceId = "44444444-4444-4444-8444-444444444444";
  await insertProcessingSource({
    id: sourceId,
    contentSha256: sha("idempotent-source"),
  });
  const plan = completedPlan([syntheticQuestion(1, 1), syntheticQuestion(2, 1)]);
  const first = await persist(sourceId, plan);
  assert.equal(first.error, null, first.error?.message);
  const second = await persist(sourceId, plan);
  assert.equal(second.error, null, second.error?.message);
  assert.equal(second.data.ok, true);
  assert.equal(second.data.idempotent, true);
  assert.equal(second.data.extracted_question_count, 2);
  assert.equal((await loadQuestions(sourceId)).length, 2);
});

test("same key with a different payload is rejected", async () => {
  const sourceId = "55555555-5555-4555-8555-555555555555";
  await insertProcessingSource({
    id: sourceId,
    contentSha256: sha("mismatch-source"),
  });
  const firstPlan = completedPlan([syntheticQuestion(1, 1), syntheticQuestion(2, 1)]);
  const first = await persist(sourceId, firstPlan);
  assert.equal(first.error, null, first.error?.message);
  const changed = completedPlan([
    syntheticQuestion(1, 1, { question_text: "Synthetic changed text" }),
    syntheticQuestion(2, 1),
  ]);
  const second = await persist(sourceId, changed);
  assert.ok(second.error);
  assert.match(String(second.error.message), /idempotency_key_payload_mismatch/);
  assert.equal((await loadQuestions(sourceId)).length, 2);
});

test("invalid page number is rejected", async () => {
  const sourceId = "66666666-6666-4666-8666-666666666666";
  await insertProcessingSource({
    id: sourceId,
    contentSha256: sha("invalid-page-source"),
  });
  const plan = completedPlan([
    syntheticQuestion(3, 1),
    syntheticQuestion(2, 1),
  ]);
  const { error } = await persist(sourceId, plan);
  assert.ok(error);
  assert.match(String(error.message), /invalid_source_page_number/);
  assert.equal((await loadSource(sourceId)).extraction_status, "processing");
  assert.equal((await loadQuestions(sourceId)).length, 0);
});

test("duplicate position is rejected", async () => {
  const sourceId = "77777777-7777-4777-8777-777777777777";
  await insertProcessingSource({
    id: sourceId,
    contentSha256: sha("duplicate-source"),
  });
  const plan = completedPlan([
    syntheticQuestion(1, 1),
    syntheticQuestion(1, 1, { question_text: "Synthetic duplicate" }),
  ]);
  const { error } = await persist(sourceId, plan);
  assert.ok(error);
  assert.match(String(error.message), /duplicate_question_position/);
  assert.equal((await loadQuestions(sourceId)).length, 0);
});

test("invalid MCQ options are rejected", async () => {
  const sourceId = "88888888-8888-4888-8888-888888888888";
  await insertProcessingSource({
    id: sourceId,
    contentSha256: sha("invalid-mcq-source"),
  });
  const plan = completedPlan([
    syntheticQuestion(1, 1, { options: [{ label: "A", text: "Only one" }] }),
    syntheticQuestion(2, 1),
  ]);
  const { error } = await persist(sourceId, plan);
  assert.ok(error);
  assert.match(String(error.message), /invalid_mcq_options/);
  assert.equal((await loadQuestions(sourceId)).length, 0);
});

test("one invalid question rolls back the whole persist", async () => {
  const sourceId = "99999999-9999-4999-8999-999999999999";
  await insertProcessingSource({
    id: sourceId,
    contentSha256: sha("rollback-source"),
  });
  const plan = completedPlan([
    syntheticQuestion(1, 1),
    syntheticQuestion(2, 1, { question_type: "Essay" }),
  ]);
  const { error } = await persist(sourceId, plan);
  assert.ok(error);
  assert.match(String(error.message), /invalid_question_type/);
  const source = await loadSource(sourceId);
  assert.equal(source.extraction_status, "processing");
  assert.equal(source.extracted_question_count, 0);
  assert.equal((await loadQuestions(sourceId)).length, 0);
});

test("anonymous and authenticated roles cannot execute the RPC", async () => {
  const sourceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  await insertProcessingSource({
    id: sourceId,
    contentSha256: sha("denied-source"),
  });
  const plan = completedPlan([syntheticQuestion(1, 1), syntheticQuestion(2, 1)]);
  const args = applicationRpcArgs(sourceId, plan);
  const anonResult = await anon.rpc("persist_extracted_questions", args);
  assertDenied(anonResult.error);
  const authResult = await authenticated.rpc("persist_extracted_questions", args);
  assertDenied(authResult.error);
  assert.equal((await loadQuestions(sourceId)).length, 0);
});

async function recover(sourceId, expectedFailedPages, questions, extras = {}) {
  return service.rpc("persist_recovered_failed_pages", {
    p_source_id: sourceId,
    p_expected_failed_pages: expectedFailedPages,
    p_error_category: extras.errorCategory ?? "provider",
    p_error_message: extras.errorMessage ?? "Failed pages could not be recovered",
    p_questions: toRpcQuestions(questions),
  });
}

async function seedPartialSource(sourceId, label) {
  await insertProcessingSource({
    id: sourceId,
    contentSha256: sha(label),
    pageCount: 6,
  });
  const plan = {
    status: "partial",
    processedPageCount: 5,
    failedPageNumbers: [1],
    errorCategory: "timeout",
    questions: [
      syntheticQuestion(2, 1),
      syntheticQuestion(3, 1, { question_type: "Short", options: [], correct_answer: null, marks: 2 }),
    ],
  };
  const first = await persist(sourceId, plan);
  assert.equal(first.error, null, first.error?.message);
  const { error: approveError } = await service
    .from("question_bank_questions")
    .update({ review_status: "approved", approved_at: new Date().toISOString() })
    .eq("source_id", sourceId)
    .eq("source_page_number", 2);
  assert.equal(approveError, null, approveError?.message);
  const { error: claimError } = await service
    .from("question_sources")
    .update({ extraction_status: "processing" })
    .eq("id", sourceId)
    .eq("extraction_status", "partial");
  assert.equal(claimError, null, claimError?.message);
  return sourceId;
}

test("recovered page 1 completes a partial source and keeps existing approvals", async () => {
  const sourceId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  await seedPartialSource(sourceId, "recover-complete");
  const before = await loadQuestions(sourceId);
  assert.equal(before.length, 2);
  assert.equal(before[0].review_status, "approved");
  const recovered = await recover(sourceId, [1], [syntheticQuestion(1, 1)]);
  assert.equal(recovered.error, null, recovered.error?.message);
  assert.equal(recovered.data.extraction_status, "completed");
  assert.equal(recovered.data.extracted_question_count, 3);
  assert.deepEqual(recovered.data.failed_page_numbers, []);
  const source = await loadSource(sourceId);
  assert.equal(source.extraction_status, "completed");
  assert.equal(source.processed_page_count, 6);
  assert.deepEqual(source.failed_page_numbers, []);
  assert.equal(source.extracted_question_count, 3);
  const questions = await loadQuestions(sourceId);
  assert.equal(questions.length, 3);
  const approved = questions.find((row) => row.source_page_number === 2);
  assert.equal(approved.review_status, "approved");
  assert.equal(approved.id, before[0].id);
  assert.equal(questions.find((row) => row.source_page_number === 1).review_status, "needs_review");
});

test("a recovered page with zero questions stays failed and partial", async () => {
  const sourceId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  await seedPartialSource(sourceId, "recover-empty");
  const recovered = await recover(sourceId, [1], []);
  assert.equal(recovered.error, null, recovered.error?.message);
  assert.equal(recovered.data.extraction_status, "partial");
  assert.deepEqual(recovered.data.failed_page_numbers, [1]);
  assert.equal(recovered.data.extracted_question_count, 2);
  const source = await loadSource(sourceId);
  assert.equal(source.extraction_status, "partial");
  assert.deepEqual(source.failed_page_numbers, [1]);
  assert.equal(source.processed_page_count, 5);
  assert.equal((await loadQuestions(sourceId)).length, 2);
});

test("recovered persist rejects pages outside the failed set and duplicate positions", async () => {
  const outsideId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  await seedPartialSource(outsideId, "recover-outside");
  const outside = await recover(outsideId, [1], [syntheticQuestion(2, 2)]);
  assert.ok(outside.error);
  assert.match(String(outside.error.message), /page_outside_failed_set/);
  assert.equal((await loadSource(outsideId)).extraction_status, "processing");
  assert.equal((await loadQuestions(outsideId)).length, 2);

  const duplicateId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
  await seedPartialSource(duplicateId, "recover-duplicate");
  const duplicate = await recover(duplicateId, [1], [
    syntheticQuestion(1, 1),
    syntheticQuestion(1, 1, { question_text: "Synthetic duplicate recovered" }),
  ]);
  assert.ok(duplicate.error);
  assert.match(String(duplicate.error.message), /duplicate_question_position/);
  assert.equal((await loadQuestions(duplicateId)).length, 2);
});

test("recovered persist rejects completed sources and failed-page mismatches", async () => {
  const completedId = "abababab-abab-4aba-8aba-abababababab";
  await insertProcessingSource({
    id: completedId,
    contentSha256: sha("recover-completed"),
    pageCount: 2,
  });
  const completed = await persist(
    completedId,
    completedPlan([syntheticQuestion(1, 1), syntheticQuestion(2, 1)]),
  );
  assert.equal(completed.error, null, completed.error?.message);
  const rejected = await recover(completedId, [1], [syntheticQuestion(1, 2)]);
  assert.ok(rejected.error);
  assert.match(String(rejected.error.message), /source_not_processing/);

  const mismatchId = "acacacac-acac-4aca-8aca-acacacacacac";
  await seedPartialSource(mismatchId, "recover-mismatch");
  const mismatch = await recover(mismatchId, [1, 2], [syntheticQuestion(1, 1)]);
  assert.ok(mismatch.error);
  assert.match(String(mismatch.error.message), /failed_pages_mismatch/);
});

test("anonymous and authenticated roles cannot execute recovered persist", async () => {
  const sourceId = "adadadad-adad-4ada-8ada-adadadadadad";
  await seedPartialSource(sourceId, "recover-denied");
  const args = {
    p_source_id: sourceId,
    p_expected_failed_pages: [1],
    p_error_category: null,
    p_error_message: null,
    p_questions: toRpcQuestions([syntheticQuestion(1, 1)]),
  };
  const anonResult = await anon.rpc("persist_recovered_failed_pages", args);
  assertDenied(anonResult.error);
  const authResult = await authenticated.rpc("persist_recovered_failed_pages", args);
  assertDenied(authResult.error);
  assert.equal((await loadQuestions(sourceId)).length, 2);
});

test("service role is allowed", async () => {
  const sourceId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  await insertProcessingSource({
    id: sourceId,
    contentSha256: sha("service-source"),
  });
  const { data, error } = await persist(
    sourceId,
    completedPlan([syntheticQuestion(1, 1), syntheticQuestion(2, 1)]),
  );
  assert.equal(error, null, error?.message);
  assert.equal(data.ok, true);
  assert.equal(data.extracted_question_count, 2);
});
