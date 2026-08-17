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

    def test_selected_pages_keep_original_numbers_and_skip_others(self):
        pages = extract.build_selected_document_pages(
            [
                extract.succeeded_page(1, [{"questionText": "Q1"}]),
                extract.succeeded_page(2, [{"questionText": "should not appear"}]),
            ],
            [1],
            6,
        )
        self.assertEqual(len(pages), 1)
        self.assertEqual(pages[0]["pageNumber"], 1)
        self.assertEqual(pages[0]["status"], "succeeded")

        parsed = extract.parse_selected_pages("1", 6)
        self.assertEqual(parsed, [1])
        with self.assertRaises(ValueError):
            extract.parse_selected_pages("1,1", 6)
        with self.assertRaises(ValueError):
            extract.parse_selected_pages("2,7", 6)
        with self.assertRaises(ValueError):
            extract.parse_selected_pages("", 6)

    def test_mocked_selected_page_subprocess_does_not_scan_other_pages(self):
        with tempfile.TemporaryDirectory(prefix="qb-mock-page-") as tmp:
            work = Path(tmp)
            pdf = work / "original.pdf"
            output = work / "extract.json"
            self._write_blank_pdf(pdf, 6)
            env = os.environ.copy()
            env["QUESTION_PAPER_EXTRACT_MOCK"] = "completed"
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
                    "--pages",
                    "1",
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
            self.assertEqual(len(document["pages"]), 1)
            self.assertEqual(document["pages"][0]["pageNumber"], 1)
            self.assertEqual(
                result.stderr.count("stage=anthropic_request"),
                1,
            )
            self.assertNotIn("pages=2-2", result.stderr)
            self.assertNotIn("pages=2-6", result.stderr)
            self.assertNotIn("sk-ant-", result.stderr)

    def test_strict_json_parse_preserves_symbols_and_backslashes(self):
        payload = {
            "section": "SECTION-II",
            "questions": [
                {
                    "number": "1",
                    "section": "SECTION-II",
                    "text": "In △ABC, ∠B = 90°, prove a² + b² = c² using √ and the path C:\\maths",
                    "marks": 4,
                    "type": "Medium",
                }
            ],
        }
        raw = json.dumps(payload, ensure_ascii=False)
        parsed = extract.parse_model_json_response(raw, 1)
        self.assertTrue(parsed["ok"])
        text = parsed["questions"][0]["text"]
        self.assertEqual(text, payload["questions"][0]["text"])
        for symbol in ("△", "∠", "°", "²", "√"):
            self.assertIn(symbol, text)
        self.assertIn("C:\\maths", text)

        fenced = "```json\n" + raw + "\n```"
        fenced_parsed = extract.parse_model_json_response(fenced, 1)
        self.assertTrue(fenced_parsed["ok"])
        self.assertEqual(fenced_parsed["questions"][0]["text"], text)

    def test_invalid_escape_repair_fallback(self):
        raw = '{"section":"SECTION-I","questions":[{"text":"Simplify \\pi r^2","marks":2,"type":"Short"}]}'
        parsed = extract.parse_model_json_response(raw, 1)
        self.assertTrue(parsed["ok"])
        self.assertEqual(parsed["questions"][0]["text"], "Simplify \\pi r^2")

        truncated = raw[:-10]
        self.assertFalse(extract.parse_model_json_response(truncated, 1)["ok"])

    def test_single_provider_request_per_page(self):
        source = (ROOT / "scripts" / "extract_pdf.py").read_text(encoding="utf-8")
        self.assertNotIn("provider_retry", source)
        self.assertNotIn("time.sleep(5)", source)
        self.assertEqual(source.count("client.messages.create"), 1)

    def test_crop_diagram_box_validation(self):
        from PIL import Image

        image = Image.new("RGB", (800, 600), "white")
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp)
            ref = extract.crop_diagram_from_page(
                image, {"x": 100, "y": 100, "w": 200, "h": 150}, work
            )
            self.assertIsNotNone(ref)
            self.assertRegex(ref, r"^crops/[0-9a-f-]{36}\.png$")
            crop_file = work / ref
            self.assertTrue(crop_file.exists())
            header = crop_file.read_bytes()[:8]
            self.assertEqual(header, b"\x89PNG\r\n\x1a\n")
            with Image.open(crop_file) as crop:
                # 200x150 box plus 12px padding on each side
                self.assertEqual(crop.size, (224, 174))

            for bad in (
                None,
                "not-a-box",
                {"x": -1, "y": 0, "w": 100, "h": 100},
                {"x": 0, "y": 0, "w": 10, "h": 10},
                {"x": 700, "y": 0, "w": 200, "h": 100},
                {"x": 0, "y": 0, "w": 800, "h": 600},
                {"x": "a", "y": 0, "w": 100, "h": 100},
            ):
                self.assertIsNone(
                    extract.crop_diagram_from_page(image, bad, work), bad
                )

    def test_attach_diagram_crops_keeps_description_on_bad_box(self):
        from PIL import Image

        image = Image.new("RGB", (800, 600), "white")
        with tempfile.TemporaryDirectory() as tmp:
            questions = [
                {
                    "text": "Good figure",
                    "diagram": "right triangle",
                    "diagramBox": {"x": 50, "y": 50, "w": 100, "h": 100},
                },
                {
                    "text": "Bad box",
                    "diagram": "unboxable figure",
                    "diagramBox": {"x": -5, "y": 0, "w": 10, "h": 10},
                },
                {"text": "No figure"},
            ]
            extract.attach_diagram_crops(questions, image, Path(tmp))
            self.assertIn("diagramCropRef", questions[0])
            self.assertNotIn("diagramBox", questions[0])
            self.assertNotIn("diagramCropRef", questions[1])
            self.assertEqual(questions[1]["diagram"], "unboxable figure")
            self.assertNotIn("diagramCropRef", questions[2])

    def test_normalize_passes_diagram_fields_through(self):
        questions = extract.normalize_page_questions(
            [
                {
                    "text": "Figure question",
                    "type": "Medium",
                    "marks": 4,
                    "diagram": "printed graph of y = x²",
                    "diagramCropRef": "crops/12345678-1234-1234-1234-123456789012.png",
                },
                {"text": "Plain question", "type": "Short", "marks": 2},
            ],
            "SECTION-II",
            FakeExtractor(),
        )
        self.assertEqual(
            questions[0]["diagramCropRef"],
            "crops/12345678-1234-1234-1234-123456789012.png",
        )
        self.assertEqual(questions[0]["diagram"], "printed graph of y = x²")
        self.assertIsNone(questions[1]["diagram"])
        self.assertIsNone(questions[1]["diagramCropRef"])

    def test_source_sections_are_never_carried_into_bank_questions(self):
        """Sections belong to a prepared paper, not to a reusable question, so
        the source paper's own PART/SECTION arrangement is discarded."""
        questions = extract.normalize_page_questions(
            [
                {"text": "Q1", "type": "Short", "marks": 2, "section": "SECTION-I"},
                {"text": "Q2", "type": "Medium", "marks": 4, "section": "SECTION-II"},
                {"text": "Q3", "type": "Medium", "marks": 4},
            ],
            "PART-A",
            FakeExtractor(),
        )
        for question in questions:
            self.assertIsNone(question["sectionLabel"])
        # Question content, type, marks and order are still preserved.
        self.assertEqual([q["questionType"] for q in questions], ["Short", "Medium", "Medium"])
        self.assertEqual([q["marks"] for q in questions], [2, 4, 4])
        self.assertEqual([q["sourceOrder"] for q in questions], [1, 2, 3])

    def test_prompt_ignores_source_structure(self):
        prompt = extract.CLAUDE_PROMPT
        self.assertIn("IGNORE the source paper's own structure", prompt)
        self.assertIn('Do not include a "section" field', prompt)
        for banned in ("Turn Over", "marks-allocation headings", "answer-space formatting"):
            self.assertIn(banned, prompt)
        # The prompt must no longer instruct a page heading to label questions.
        self.assertNotIn("assign ALL questions on that page", prompt)

    def test_mocked_diagram_subprocess_writes_request_owned_crop(self):
        with tempfile.TemporaryDirectory(prefix="qb-mock-diagram-") as tmp:
            work = Path(tmp)
            pdf = work / "original.pdf"
            output = work / "extract.json"
            self._write_blank_pdf(pdf, 1)
            env = os.environ.copy()
            env["QUESTION_PAPER_EXTRACT_MOCK"] = "diagram"
            env.pop("ANTHROPIC_API_KEY", None)
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
            page = document["pages"][0]
            self.assertEqual(page["status"], "succeeded")
            boxed, unboxable = page["questions"][0], page["questions"][1]
            self.assertRegex(boxed["diagramCropRef"], r"^crops/[0-9a-f-]{36}\.png$")
            crop_file = work / boxed["diagramCropRef"]
            self.assertTrue(crop_file.exists())
            self.assertEqual(crop_file.read_bytes()[:8], b"\x89PNG\r\n\x1a\n")
            self.assertIsNone(unboxable["diagramCropRef"])
            self.assertEqual(
                unboxable["diagram"], "Fixture figure the provider could not box"
            )
            # No base64 PNG payloads inside the extraction JSON
            self.assertNotIn("diagramPngBase64", output.read_text(encoding="utf-8"))

    def test_parallel_notation_is_not_mistaken_for_a_table(self):
        """Real papers write 'is parallel to' as '||' (DE||BC). Two such pairs
        carry four pipes and were being rendered as a markdown table grid."""
        sys.path.insert(0, str(ROOT / "scripts"))
        import generate_jk82_pdf as gen

        for question in (
            "In a triangle ABC, the DE||BC, then AD/DB =",
            "If AB||CD and EF||GH then find the angle between them.",
            "Given AB||CD, EF||GH and IJ||KL, prove the lines are coplanar.",
        ):
            _, tables, _ = gen.parse_table_in_text(question)
            self.assertEqual(tables, [], question)

        # A genuine markdown table still parses into rows.
        _, tables, _ = gen.parse_table_in_text(
            "| C.I. | 0-20 | 20-40 | 40-60 |\n|---|---|---|---|\n| F | 2 | 5 | 12 |"
        )
        self.assertEqual(len(tables), 1)
        self.assertEqual(tables[0][0], ["C.I.", "0-20", "20-40", "40-60"])
        self.assertEqual(gen.table_pipe_count("AB||CD and EF||GH"), 0)
        self.assertEqual(gen.table_pipe_count("| a | b | c |"), 4)

    def test_mcq_keeps_its_options_on_one_page(self):
        """A four-option MCQ reserves its whole block, so the last option is
        never stranded alone on the following page."""
        sys.path.insert(0, str(ROOT / "scripts"))
        import generate_jk82_pdf as gen

        options = [{"label": chr(65 + i), "text": f"option {i}"} for i in range(4)]
        estimated = 36 + 14 * max(1, len(gen.option_lines(options)))
        self.assertGreater(estimated, 90, "four options exceed the old 90pt cap")
        self.assertLessEqual(
            min(estimated, gen.MAX_QUESTION_BLOCK_RESERVE),
            gen.MAX_QUESTION_BLOCK_RESERVE,
        )
        source = (ROOT / "scripts" / "generate_jk82_pdf.py").read_text(encoding="utf-8")
        self.assertNotIn("if estimated < 90 and y < 2 * MARGIN + estimated:", source)
        self.assertIn("required = min(estimated, MAX_QUESTION_BLOCK_RESERVE)", source)

    def test_generated_header_names_the_subject(self):
        source = (ROOT / "scripts" / "generate_jk82_pdf.py").read_text(encoding="utf-8")
        self.assertIn('f"Subject: {subject}"', source)

    def test_mock_skips_provider_and_live_path_still_requires_key(self):
        self.assertEqual(extract.apply_extract_mock("completed", 1)["ok"], True)
        with self.assertRaises(ValueError):
            os.environ.pop("ANTHROPIC_API_KEY", None)
            os.environ.pop("QUESTION_PAPER_EXTRACT_MOCK", None)
            extract.require_anthropic_api_key()


if __name__ == "__main__":
    unittest.main()
