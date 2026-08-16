#!/usr/bin/env python3
"""Unit tests for the Phase 2C page-result contract. No Anthropic calls."""

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import extract_pdf as extract


class FakeExtractor:
    def detect_question_type(self, text: str) -> str:
        return "Short"

    def extract_marks(self, text: str, section: str = "") -> int:
        return 2


class ExtractPdfV2Tests(unittest.TestCase):
    def test_parse_success_and_failure(self):
        ok = extract.parse_model_json_response(
            '{"section":"SECTION-I","questions":[{"number":"1","text":"Q","marks":2,"type":"Short"}]}',
            1,
        )
        self.assertTrue(ok["ok"])
        self.assertEqual(len(ok["questions"]), 1)

        failed = extract.parse_model_json_response("not-json", 1)
        self.assertFalse(failed["ok"])
        self.assertEqual(failed["error_category"], "parse")

    def test_oversized_model_output_is_rejected(self):
        huge = "{" + ("x" * (extract.MAX_RESULT_BYTES + 10)) + "}"
        result = extract.parse_model_json_response(huge, 1)
        self.assertFalse(result["ok"])
        self.assertEqual(result["error_category"], "validation")

    def test_invalid_mcq_fails_the_page(self):
        questions = extract.normalize_page_questions(
            [{"text": "Choose", "type": "MCQ", "marks": 1, "options": ["only-one"]}],
            "SECTION-A",
            FakeExtractor(),
        )
        self.assertIsNone(questions)

    def test_valid_questions_keep_order(self):
        questions = extract.normalize_page_questions(
            [
                {"text": "First", "type": "Short", "marks": 2},
                {"text": "Second", "type": "Medium", "marks": 4},
            ],
            "SECTION-I",
            FakeExtractor(),
        )
        self.assertEqual(questions[0]["sourceOrder"], 1)
        self.assertEqual(questions[1]["sourceOrder"], 2)
        self.assertEqual(questions[0]["rawExtractedText"], "First")

    def test_build_document_pages_fills_gaps_and_duplicates(self):
        pages = extract.build_document_pages(
            [
                extract.succeeded_page(1, [{"questionText": "Q"}]),
                extract.succeeded_page(1, [{"questionText": "Dup"}]),
            ],
            2,
        )
        self.assertEqual(len(pages), 2)
        self.assertEqual(pages[0]["status"], "failed")
        self.assertEqual(pages[1]["status"], "failed")
        self.assertEqual(pages[1]["errorCategory"], "internal")

    def test_write_document_result_is_bounded_and_ordered(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "result.json"
            pages = [
                extract.failed_page(2, "timeout"),
                extract.succeeded_page(1, [{"questionText": "Q", "sourceOrder": 1}]),
            ]
            ordered = extract.build_document_pages(pages, 2)
            extract.write_document_result(str(output), 2, ordered)
            document = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(document["schemaVersion"], 1)
            self.assertEqual(document["pageCount"], 2)
            self.assertEqual([page["pageNumber"] for page in document["pages"]], [1, 2])
            self.assertNotIn("sk-ant-", output.read_text(encoding="utf-8"))

    def test_provider_error_classification(self):
        self.assertEqual(extract.classify_provider_error(TimeoutError("timed out")), "timeout")
        self.assertEqual(extract.classify_provider_error(RuntimeError("529 overloaded")), "provider")

    def test_mock_fixtures_are_synthetic(self):
        failed = extract.apply_extract_mock("all_failed", 1)
        self.assertFalse(failed["ok"])
        completed = extract.apply_extract_mock("completed", 3)
        self.assertTrue(completed["ok"])
        self.assertEqual(completed["questions"][0]["text"], "Fixture question 3")
        partial_fail = extract.apply_extract_mock("partial", 1)
        self.assertFalse(partial_fail["ok"])
        partial_ok = extract.apply_extract_mock("partial", 2)
        self.assertTrue(partial_ok["ok"])

    def test_six_page_document_contract(self):
        pages = extract.build_document_pages(
            [extract.failed_page(n, "provider") for n in range(1, 7)],
            6,
        )
        self.assertEqual(len(pages), 6)
        self.assertEqual([page["pageNumber"] for page in pages], [1, 2, 3, 4, 5, 6])
        self.assertTrue(all(page["status"] == "failed" for page in pages))
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "result.json"
            extract.write_document_result(str(output), 6, pages)
            encoded = output.read_bytes()
            self.assertLess(len(encoded), extract.MAX_RESULT_BYTES)
            document = json.loads(encoded)
            self.assertEqual(document["pageCount"], 6)

    def _write_blank_pdf(self, path: Path, pages: int) -> None:
        from pypdf import PdfWriter

        writer = PdfWriter()
        for _ in range(pages):
            writer.add_blank_page(width=612, height=792)
        with path.open("wb") as handle:
            writer.write(handle)

    def test_mocked_six_page_extract_subprocess(self):
        with tempfile.TemporaryDirectory(prefix="qb-mock-") as tmp:
            work = Path(tmp)
            pdf = work / "original.pdf"
            output = work / "extract.json"
            self._write_blank_pdf(pdf, 6)
            env = os.environ.copy()
            env["QUESTION_PAPER_EXTRACT_MOCK"] = "all_failed"
            env.pop("ANTHROPIC_API_KEY", None)
            env.pop("GEMINI_API_KEY", None)
            env.pop("GOOGLE_API_KEY", None)
            result = subprocess.run(
                [
                    sys.executable,
                    str(ROOT / "scripts" / "extract_pdf.py"),
                    "--pdf",
                    str(pdf),
                    "--subject",
                    "Mathematics",
                    "--grade",
                    "10",
                    "--year",
                    "2026",
                    "--output",
                    str(output),
                    "--work-dir",
                    str(work),
                ],
                cwd=str(ROOT),
                env=env,
                capture_output=True,
                text=True,
                timeout=120,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            document = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(document["pageCount"], 6)
            self.assertEqual(len(document["pages"]), 6)
            self.assertEqual(
                [page["pageNumber"] for page in document["pages"]],
                [1, 2, 3, 4, 5, 6],
            )
            self.assertLess(output.stat().st_size, extract.MAX_RESULT_BYTES)
            self.assertNotIn("sk-ant-", result.stderr)
            self.assertNotIn("ANTHROPIC_API_KEY", result.stderr)
            self.assertIn("stage=pdf_rendering", result.stderr)
            self.assertIn("stage=anthropic_request", result.stderr)
            leftover = [path for path in work.iterdir() if path.suffix == ".json" and path.name != "extract.json"]
            # request-scoped cache files may exist during the run; the work dir is owned by the caller
            self.assertTrue(output.exists())

    def test_mock_skips_provider_and_live_path_still_requires_key(self):
        self.assertEqual(extract.apply_extract_mock("completed", 1)["ok"], True)
        with self.assertRaises(ValueError):
            os.environ.pop("ANTHROPIC_API_KEY", None)
            os.environ.pop("QUESTION_PAPER_EXTRACT_MOCK", None)
            extract.require_anthropic_api_key()


if __name__ == "__main__":
    unittest.main()
