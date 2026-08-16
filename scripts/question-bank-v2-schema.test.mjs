import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const migrationPath = join(
  root,
  "supabase/migrations/20260816010000_question_bank_v2.sql",
);
const verifyPath = join(root, "scripts/question-bank-v2-verify.sql");
const rollbackPath = join(root, "scripts/question-bank-v2-rollback.sql");
const setupPath = join(root, "SETUP_QUESTION_BANK.md");

const migration = readFileSync(migrationPath, "utf8");
const verify = readFileSync(verifyPath, "utf8");
const rollback = readFileSync(rollbackPath, "utf8");
const setup = readFileSync(setupPath, "utf8");

function stripSql(text) {
  return text
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\$\$[\s\S]*?\$\$/g, "''")
    .replace(/\$[A-Za-z_]*\$[\s\S]*?\$[A-Za-z_]*\$/g, "''")
    .replace(/'(?:[^']|'')*'/g, "''");
}

test("Phase 2B migration is additive and does not touch legacy tables", () => {
  const stripped = stripSql(migration);
  assert.match(migration, /CREATE TABLE public\.question_sources/);
  assert.match(migration, /CREATE TABLE public\.question_bank_questions/);
  assert.match(migration, /CREATE TABLE public\.saved_question_papers/);
  assert.match(migration, /CREATE TABLE public\.saved_question_paper_items/);
  assert.doesNotMatch(stripped, /\bDROP TABLE\b/);
  assert.doesNotMatch(stripped, /\bTRUNCATE\b/);
  assert.doesNotMatch(
    stripped,
    /\b(UPDATE|DELETE|ALTER TABLE|DROP TABLE)\s+(public\.)?(questions|question_papers|generated_pdfs)\b/i,
  );
  assert.doesNotMatch(migration, /staff_users|exam_paper_versions|audit_events/);
  assert.doesNotMatch(migration, /SECURITY DEFINER/);
  assert.doesNotMatch(stripped, /\bSECURITY DEFINER\b/);
  assert.doesNotMatch(stripped, /\bCREATE POLICY\b/);
  assert.match(migration, /SECURITY INVOKER/);
});

test("Phase 2B migration contains required constraints, indexes, RLS, and RPCs", () => {
  assert.match(migration, /question_sources_content_sha256_key/);
  assert.match(migration, /question_sources_completed_has_no_failed_pages/);
  assert.match(migration, /question_bank_page_numbers_are_valid/);
  assert.match(migration, /question_bank_questions_source_page_required/);
  assert.match(migration, /question_bank_questions_mcq_options/);
  assert.match(migration, /saved_question_paper_items_order_key/);
  assert.match(migration, /question_sources_class_subject_year_idx/);
  assert.match(migration, /question_bank_questions_class_subject_year_idx/);
  assert.match(migration, /saved_question_papers_class_subject_year_idx/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL PRIVILEGES ON TABLE/);
  assert.match(migration, /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %s TO service_role/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.persist_extracted_questions/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.save_question_paper/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.record_final_paper_pdf/);
  assert.match(migration, /raw_extracted_text is immutable/);
  assert.match(migration, /final papers are immutable/);
  assert.match(migration, /persist_idempotency_key/);
  assert.match(migration, /persist_payload/);
  assert.match(migration, /creation_key/);
  assert.match(migration, /stale_paper_lock_version/);
  assert.match(migration, /idempotency_key_payload_mismatch/);
  assert.match(migration, /pdf_fill_in/);
});

test("Phase 2B storage changes are limited to two new private buckets", () => {
  assert.match(migration, /'source-pdfs'/);
  assert.match(migration, /'generated-papers'/);
  assert.match(migration, /public = false/);
  assert.doesNotMatch(stripSql(migration), /\bCREATE POLICY\b/);
  assert.doesNotMatch(migration, /UPDATE storage\.buckets[\s\S]*diagrams/);
  assert.doesNotMatch(migration, /DELETE FROM storage\.objects/);
  assert.match(migration, /ON CONFLICT \(id\) DO UPDATE\nSET public = false;/);
});

test("verification script is read-only and rollback is limited to empty V2 objects", () => {
  const verifyStripped = stripSql(verify);
  const rollbackStripped = stripSql(rollback);
  assert.match(verify, /BEGIN TRANSACTION READ ONLY/);
  assert.match(verify, /AS verify_json/);
  assert.doesNotMatch(verifyStripped, /\b(INSERT|UPDATE|DELETE|GRANT|REVOKE|ALTER|DROP|CREATE)\b/);
  assert.match(rollback, /Phase 2B tables are not empty/);
  assert.match(rollback, /DROP TABLE IF EXISTS public\.question_sources/);
  assert.match(rollback, /record_final_paper_pdf/);
  assert.match(verify, /phase_2b_passed/);
  assert.match(verify, /v2_tables_empty/);
  assert.doesNotMatch(
    rollbackStripped,
    /\b(UPDATE|DELETE|ALTER TABLE|DROP TABLE)\s+(public\.)?(questions|question_papers|generated_pdfs)\b/i,
  );
  assert.doesNotMatch(
    rollbackStripped,
    /\b(UPDATE|DELETE)\s+storage\.(buckets|objects)\b[\s\S]{0,80}diagrams/i,
  );
});

test("setup documentation describes the unapplied Phase 2B foundation", () => {
  assert.match(setup, /20260816010000_question_bank_v2\.sql/);
  assert.match(setup, /question_sources/);
  assert.match(setup, /question_bank_questions/);
  assert.match(setup, /saved_question_papers/);
  assert.match(setup, /saved_question_paper_items/);
  assert.match(setup, /Do not apply it automatically/);
});
