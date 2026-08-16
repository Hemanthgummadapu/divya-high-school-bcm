#!/usr/bin/env python3
"""Unit tests for the Phase 2C page-result contract. No Anthropic calls."""

import json
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


if __name__ == "__main__":
    unittest.main()
