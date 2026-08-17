#!/usr/bin/env python3
"""
PDF Question Bank Extractor
Extracts questions from scanned PDF images using Anthropic Claude vision.
Optimized for large PDFs with batching and caching.
"""

import argparse
import json
import os
import re
import sys
import base64
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import List, Dict, Any
import uuid
import hashlib
from io import BytesIO

try:
    from pdf2image import convert_from_path
    from pypdf import PdfReader
    from PIL import Image
    from anthropic import Anthropic
    from dotenv import load_dotenv
except ImportError as e:
    print(
        "Error: Missing required package. Install with: pip install pdf2image pypdf pillow anthropic python-dotenv"
    )
    sys.exit(1)

# Disable PIL decompression bomb warnings for very large scanned PDFs
Image.MAX_IMAGE_PIXELS = None

# Load environment variables (project root = parent of scripts/). Optional in production.
load_dotenv(
    dotenv_path=Path(__file__).resolve().parent.parent / ".env.local",
    override=False,
)


def require_anthropic_api_key() -> str:
    """Return the server-side Anthropic key, or fail closed if it is missing."""
    api_key = (os.getenv("ANTHROPIC_API_KEY") or "").strip()
    if not api_key or api_key == "your_key_here":
        raise ValueError("ANTHROPIC_API_KEY environment variable is not set")
    return api_key


# Pinned to src/lib/question-paper-provider-policy.mjs. Not overridable.
QUESTION_PAPER_PARSER_MODEL = "claude-sonnet-4-6"
EXTRACT_DPI = 250  # PDF page render DPI (was 150; higher helps Telugu glyphs)


def bounded_max_pdf_pages() -> int:
    """Return a safe configured page cap; never permit an unlimited value."""
    try:
        configured = int(os.getenv("QUESTION_PAPER_MAX_PDF_PAGES", "20"))
    except (TypeError, ValueError):
        configured = 20
    return max(1, min(configured, 100))


MAX_PDF_PAGES = bounded_max_pdf_pages()


def validate_pdf_page_count(pdf_path: str) -> int:
    """Parse the PDF and enforce the page cap before conversion or AI setup."""
    try:
        total_pages = len(PdfReader(pdf_path).pages)
    except Exception:
        print("Error: PDF could not be parsed")
        sys.exit(1)
    if total_pages <= 0:
        print("Error: Could not determine PDF page count")
        sys.exit(1)
    if total_pages > MAX_PDF_PAGES:
        print(f"Error: PDF exceeds the {MAX_PDF_PAGES}-page processing limit")
        sys.exit(1)
    return total_pages


def check_poppler_available(pdf_path: str) -> None:
    """Verify pdf2image can use poppler (required for PDF -> images). Exits with clear error if not."""
    try:
        convert_from_path(pdf_path, dpi=1, first_page=1, last_page=1)
    except Exception as e:
        err = str(e).lower()
        if "poppler" in err or "pdftoppm" in err or "unable to get page count" in err or "not found" in err:
            print("Error: Poppler is required for PDF to image conversion but was not found.")
            print("  - macOS: brew install poppler")
            print("  - Linux: sudo apt-get install poppler-utils")
            print("  - Windows: Install from https://github.com/oschwartz10612/poppler-windows/releases and add to PATH")
            print("See SETUP_QUESTION_BANK.md for details.")
            sys.exit(1)
        raise

RESULT_SCHEMA_VERSION = 1
MAX_RESULT_BYTES = 2 * 1024 * 1024
MAX_QUESTIONS_PER_PAGE = 50
ALLOWED_QUESTION_TYPES = ("MCQ", "Short", "Medium", "Long")

# Claude API prompt
CLAUDE_PROMPT = """You are extracting questions from ONE scanned page of an Indian school exam paper.

ACCURACY — copy, never compose
- Copy every question EXACTLY as printed: same wording, spelling, numbers, punctuation and order. Do not rewrite, shorten, correct or improve anything.
- Preserve every mathematical symbol and expression exactly as printed (for example △, ∠, ∥, ⊥, ≤, ≥, ≠, ±, ×, ÷, √, π, θ, °, superscripts like x², subscripts like a₁, and fractions such as ½ or 3/4).
- Never invent questions, options, marks, answers, sections or diagrams that are not printed on the page. If something is not printed, omit it or use null.
- Ignore page headers, footers, page numbers, watermarks, school names and exam codes (like "JK-82" or "QP-01"). They are not questions and never section names.
- General instructions to students (such as "Answer all questions" or "Time: 3 Hours") are not questions. Do not output them as questions.

QUESTIONS — one printed question, one JSON question
- Keep each printed question as ONE question even when it spans several lines. Never merge two printed questions and never split one printed question into several.
- "type" must be exactly one of "MCQ", "Short", "Medium" or "Long". Prefer the paper's own printed evidence: section headings, printed marks and option lists. If the type is genuinely unclear, choose the closest supported type; do not invent evidence.
- "marks" must be the marks printed for that question. If marks are printed only on the section heading, use the section's marks. Never use 0 or negative marks.
- For MCQ questions, list every printed option in printed order in "options", either as ["A) ...", "B) ...", ...] or as [{"label": "A", "text": "..."}, ...]. Keep the option text exactly as printed and keep its label.
- "correctAnswer" must be null unless the answer is explicitly printed on this page. Never solve the question yourself and never guess.

SECTIONS — per question, from the paper's own headings
- Use the paper's printed section/part headings (for example "SECTION-I", "SECTION-II", "PART-A", "PART-B") as each question's "section" value.
- A single page can contain more than one section. When a new section heading appears part-way down the page, the questions after that heading belong to the new section. Set every question's own "section" field to the heading it sits under; a page-level heading must never overwrite a different heading printed closer to the question.
- If this page prints no section heading and the section is not clearly stated, omit the "section" field for those questions instead of guessing. Never use "UNKNOWN", "OTHER" or an exam code as a section.

TABLES — When you see a data table/grid in the question:
- Extract it as a proper markdown table with header row and separator row.
- The table must be stored with REAL newline characters between rows in the JSON (not a single flattened line).
- Example: A vehicle sales table should become exactly:
  \"| Type of Vehicle | Cars | Busses | Bikes |\\n|----------------|------|--------|-------|\\n| No. of vehicles sold | 14 | 15 | 16 |\"
- Each row must be on its own line separated by '\\n'. Never put the entire table on one line.
- Preserve ALL rows and columns exactly as they appear.
- Do NOT use pipe characters without proper table structure.
- The table must be part of the question text field.

DIAGRAMS — only when the figure is required
- If a question can only be answered by looking at a printed figure (a geometry figure, graph, number line, science diagram, circuit, map, or a table that cannot be reproduced reliably as text), add to that question:
  - "diagram": a short factual description of the printed figure, and
  - "diagramBox": {"x": <left>, "y": <top>, "w": <width>, "h": <height>} in pixels of THIS page image, drawn tightly around the figure only.
- Only include "diagramBox" when the figure is genuinely required to answer. Never draw a box around ordinary question text and never describe a figure that is not printed.

OUTPUT — JSON only
{
  "section": "SECTION-I",
  "questions": [
    {
      "number": "1",
      "section": "SECTION-I",
      "text": "Full question text exactly as printed",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "marks": 2,
      "type": "Short",
      "correctAnswer": null
    }
  ]
}
Include "options" only for MCQ questions. Include "diagram" and "diagramBox" only when a required printed figure exists. Return ONLY valid JSON, nothing else."""


def classify_provider_error(error: Exception) -> str:
    message = str(error).lower()
    if "timeout" in message or "timed out" in message:
        return "timeout"
    if "529" in message or "overloaded" in message or "rate" in message:
        return "provider"
    if "json" in message or "parse" in message:
        return "parse"
    return "provider"


def failed_page(page_num: int, error_category: str) -> Dict[str, Any]:
    return {
        "pageNumber": page_num,
        "status": "failed",
        "errorCategory": error_category,
        "questions": [],
    }


def succeeded_page(page_num: int, questions: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "pageNumber": page_num,
        "status": "succeeded",
        "questions": questions,
    }


def parse_model_json_response(response_text: str, page_num: int) -> Dict[str, Any]:
    """Parse JSON object from Anthropic model output. Never logs response text."""
    response_text = (response_text or "").strip()
    if len(response_text) > MAX_RESULT_BYTES:
        return {"ok": False, "error_category": "validation"}

    json_start = response_text.find("{")
    json_end = response_text.rfind("}") + 1

    if json_start < 0 or json_end <= json_start:
        return {"ok": False, "error_category": "parse"}

    json_str = response_text[json_start:json_end]
    try:
        # Strict parse first: valid provider JSON must never be rewritten,
        # otherwise escaped backslashes in math text would be duplicated.
        result = json.loads(json_str)
    except json.JSONDecodeError:
        repaired = re.sub(r'\\([^"\\/bfnrtu0-9])', r"\\\\\1", json_str)
        try:
            result = json.loads(repaired)
        except json.JSONDecodeError:
            return {"ok": False, "error_category": "parse"}

    if not isinstance(result, dict):
        return {"ok": False, "error_category": "parse"}

    if "sections" in result and isinstance(result["sections"], list):
        all_questions: List[Dict[str, Any]] = []
        first_section_name: str | None = None
        for sec_obj in result["sections"]:
            if not isinstance(sec_obj, dict):
                continue
            sec_name = sec_obj.get("section")
            if first_section_name is None and isinstance(sec_name, str):
                first_section_name = sec_name
            sec_questions = sec_obj.get("questions") or []
            if isinstance(sec_questions, list):
                for q in sec_questions:
                    if isinstance(q, dict) and sec_name and "section" not in q:
                        q["section"] = sec_name
                all_questions.extend([q for q in sec_questions if isinstance(q, dict)])
        return {
            "ok": True,
            "section": first_section_name or "SECTION-A",
            "questions": all_questions,
        }

    questions = result.get("questions")
    if not isinstance(questions, list):
        return {"ok": False, "error_category": "parse"}
    return {
        "ok": True,
        "section": result.get("section") or "SECTION-A",
        "questions": [q for q in questions if isinstance(q, dict)],
    }


def get_page_hash(pdf_path: str, page_num: int) -> str:
    """Generate hash for a specific page of a PDF"""
    stat = os.stat(pdf_path)
    content = f"{pdf_path}:{page_num}:{stat.st_mtime}:{EXTRACT_DPI}"
    return hashlib.md5(content.encode()).hexdigest()


def get_cached_result(work_dir: Path, page_hash: str) -> Dict[str, Any] | None:
    cache_file = work_dir / f"{page_hash}.json"
    if cache_file.exists():
        try:
            return json.loads(cache_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
    return None


def save_cached_result(work_dir: Path, page_hash: str, result: Dict[str, Any]) -> None:
    cache_file = work_dir / f"{page_hash}.json"
    try:
        cache_file.write_text(json.dumps(result), encoding="utf-8")
    except OSError:
        pass


def image_to_base64(image: Image.Image) -> str:
    """Convert PIL Image to base64 string"""
    buffered = BytesIO()
    image.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    return img_str


MIN_DIAGRAM_CROP_PX = 40
DIAGRAM_CROP_PADDING_PX = 12
MAX_DIAGRAM_PAGE_AREA_RATIO = 0.9


def crop_diagram_from_page(
    image: Image.Image,
    box: Any,
    work_dir: Path,
) -> str | None:
    """Crop a provider-identified diagram from the already rendered page image.

    Writes a request-owned PNG under <work_dir>/crops and returns the safe
    work-dir-relative reference ("crops/<uuid>.png"), or None when the box is
    missing, malformed, out of page bounds, too small or covers almost the
    whole page. The source page image is never modified.
    """
    if not isinstance(box, dict):
        return None
    try:
        x = int(box.get("x"))
        y = int(box.get("y"))
        w = int(box.get("w", box.get("width", 0)))
        h = int(box.get("h", box.get("height", 0)))
    except (TypeError, ValueError):
        return None
    page_w, page_h = image.size
    if w < MIN_DIAGRAM_CROP_PX or h < MIN_DIAGRAM_CROP_PX:
        return None
    if x < 0 or y < 0 or x + w > page_w or y + h > page_h:
        return None
    if (w * h) > MAX_DIAGRAM_PAGE_AREA_RATIO * page_w * page_h:
        return None
    left = max(0, x - DIAGRAM_CROP_PADDING_PX)
    top = max(0, y - DIAGRAM_CROP_PADDING_PX)
    right = min(page_w, x + w + DIAGRAM_CROP_PADDING_PX)
    bottom = min(page_h, y + h + DIAGRAM_CROP_PADDING_PX)
    try:
        crops_dir = Path(work_dir) / "crops"
        crops_dir.mkdir(parents=True, exist_ok=True)
        crop = image.crop((left, top, right, bottom))
        name = f"{uuid.uuid4()}.png"
        crop.save(crops_dir / name, format="PNG")
    except Exception:
        return None
    return f"crops/{name}"


def attach_diagram_crops(
    questions: List[Dict[str, Any]],
    image: Image.Image,
    work_dir: Path,
) -> None:
    """Resolve provider diagram boxes into request-owned crop references.

    An unusable box is dropped while the textual description is kept, so the
    question still visibly requires review instead of gaining a fabricated
    diagram.
    """
    for raw in questions:
        if not isinstance(raw, dict):
            continue
        box = raw.pop("diagramBox", None)
        description = raw.get("diagram")
        if box is None and description is None:
            continue
        ref = crop_diagram_from_page(image, box, work_dir) if box is not None else None
        if ref:
            raw["diagramCropRef"] = ref


def apply_extract_mock(mock: str, page_num: int) -> Dict[str, Any]:
    """Deterministic fixture used only by offline tests. Never contains real paper text."""
    if mock == "all_failed":
        return {"ok": False, "error_category": "provider"}
    if mock == "partial" and page_num == 1:
        return {"ok": False, "error_category": "timeout"}
    if mock in ("completed", "partial"):
        return {
            "ok": True,
            "section": "SECTION-A",
            "questions": [
                {
                    "text": f"Fixture question {page_num}",
                    "type": "Short",
                    "marks": 2,
                }
            ],
        }
    if mock == "diagram":
        return {
            "ok": True,
            "section": "SECTION-II",
            "questions": [
                {
                    "text": f"Fixture geometry question {page_num} with figure",
                    "type": "Medium",
                    "marks": 4,
                    "diagram": "Fixture right triangle with squares on each side",
                    "diagramBox": {"x": 60, "y": 80, "w": 220, "h": 180},
                },
                {
                    "text": f"Fixture question {page_num} with unusable box",
                    "type": "Short",
                    "marks": 2,
                    "diagram": "Fixture figure the provider could not box",
                    "diagramBox": {"x": -5, "y": 0, "w": 10, "h": 10},
                },
            ],
        }
    return {"ok": False, "error_category": "internal"}


def extract_with_claude(client: Anthropic, image_base64: str, page_num: int) -> Dict[str, Any]:
    """Extract questions from a page image using Claude API, with basic retry on overload."""
    mock = (os.getenv("QUESTION_PAPER_EXTRACT_MOCK") or "").strip()
    if mock:
        print(
            f"request stage=anthropic_request page={page_num} outcome=mock elapsed_ms=0",
            file=sys.stderr,
        )
        return apply_extract_mock(mock, page_num)
    # Exactly one provider request per page. Transient provider failures make
    # the page fail honestly; retrying is a deliberate, spend-controlled user
    # action through the failed-page retry route.
    started = time.monotonic()
    try:
        message = client.messages.create(
            model=QUESTION_PAPER_PARSER_MODEL,
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": image_base64,
                            },
                        },
                        {
                            "type": "text",
                            "text": CLAUDE_PROMPT,
                        },
                    ],
                }
            ],
        )
        response_text = message.content[0].text.strip()
        elapsed_ms = int((time.monotonic() - started) * 1000)
        print(
            f"request stage=provider_response page={page_num} outcome=ok elapsed_ms={elapsed_ms}",
            file=sys.stderr,
        )
        return parse_model_json_response(response_text, page_num)
    except Exception as e:
        elapsed_ms = int((time.monotonic() - started) * 1000)
        category = classify_provider_error(e)
        status_class = "5xx" if "529" in str(e) else None
        extra = f" provider_http_status_class={status_class}" if status_class else ""
        print(
            f"request stage=provider_response page={page_num} outcome={category} elapsed_ms={elapsed_ms}{extra}",
            file=sys.stderr,
        )
        return {"ok": False, "error_category": category}


def normalize_page_questions(
    questions: List[Dict[str, Any]],
    section: str,
    extractor: "QuestionExtractor",
) -> List[Dict[str, Any]] | None:
    if len(questions) > MAX_QUESTIONS_PER_PAGE:
        return None
    normalized: List[Dict[str, Any]] = []
    effective_section = section
    if isinstance(effective_section, str) and re.match(
        r"^JK-\d+$", effective_section.strip(), re.IGNORECASE
    ):
        effective_section = "SECTION-A"
    for index, raw in enumerate(questions, start=1):
        if not isinstance(raw, dict):
            return None
        text = raw.get("text") or raw.get("questionText")
        if not isinstance(text, str) or not text.strip():
            return None
        question_type = raw.get("type") or raw.get("questionType")
        if question_type not in ALLOWED_QUESTION_TYPES:
            question_type = extractor.detect_question_type(text)
        if question_type not in ALLOWED_QUESTION_TYPES:
            return None
        marks = raw.get("marks")
        if marks is None:
            marks = extractor.extract_marks(text, effective_section)
        try:
            marks = int(marks)
        except (TypeError, ValueError):
            return None
        if marks < 1 or marks > 100:
            return None
        options = raw.get("options") or []
        if not isinstance(options, list):
            return None
        cleaned_options: List[str] = []
        for opt in options:
            if isinstance(opt, str):
                cleaned_options.append(re.sub(r"^[A-Da-d]\)\s*", "", opt))
            elif isinstance(opt, dict) and opt.get("text"):
                cleaned_options.append(str(opt.get("text")))
            else:
                return None
        if question_type == "MCQ" and not (2 <= len(cleaned_options) <= 6):
            return None
        diagram_description = raw.get("diagram")
        if not isinstance(diagram_description, str) or not diagram_description.strip():
            diagram_description = None
        else:
            diagram_description = diagram_description.strip()[:2000]
        diagram_crop_ref = raw.get("diagramCropRef")
        if not isinstance(diagram_crop_ref, str):
            diagram_crop_ref = None
        normalized.append(
            {
                "sourceOrder": index,
                "questionType": question_type,
                "questionText": text,
                "rawExtractedText": text,
                "marks": marks,
                "sectionLabel": raw.get("section") or effective_section,
                "options": cleaned_options if question_type == "MCQ" else [],
                "correctAnswer": raw.get("correct_answer") or raw.get("correctAnswer"),
                "diagram": diagram_description,
                "diagramCropRef": diagram_crop_ref,
            }
        )
    return normalized


def process_one_page(
    pdf_path: str,
    client: Anthropic,
    image: Image.Image,
    page_num: int,
    work_dir: Path,
    extractor: "QuestionExtractor",
) -> Dict[str, Any]:
    page_hash = get_page_hash(pdf_path, page_num)
    cached = get_cached_result(work_dir, page_hash)
    if cached and cached.get("status") in ("succeeded", "failed"):
        return cached
    try:
        image_base64 = image_to_base64(image)
    except Exception:
        return failed_page(page_num, "internal")
    result = extract_with_claude(client, image_base64, page_num)
    if not result.get("ok"):
        page = failed_page(page_num, result.get("error_category") or "provider")
        save_cached_result(work_dir, page_hash, page)
        return page
    raw_questions = [
        question
        for question in (result.get("questions") or [])
        if isinstance(question, dict)
    ]
    attach_diagram_crops(raw_questions, image, work_dir)
    questions = normalize_page_questions(
        raw_questions,
        str(result.get("section") or "SECTION-A"),
        extractor,
    )
    if questions is None:
        page = failed_page(page_num, "validation")
        save_cached_result(work_dir, page_hash, page)
        return page
    page = succeeded_page(page_num, questions)
    save_cached_result(work_dir, page_hash, page)
    return page


class QuestionExtractor:
    def __init__(
        self,
        pdf_path: str,
        subject: str,
        grade: str,
        year: str,
        validated_page_count: int,
        work_dir: Path,
    ):
        self.pdf_path = pdf_path
        self.subject = subject
        self.grade = grade
        self.year = year
        self.work_dir = work_dir
        self.page_results: List[Dict[str, Any]] = []
        self._validated_page_count = validated_page_count
        self._selected_pages = None
        self._extract_mock = (os.getenv("QUESTION_PAPER_EXTRACT_MOCK") or "").strip()
        self.claude_client = (
            None if self._extract_mock else Anthropic(api_key=require_anthropic_api_key())
        )
        
    def _get_total_pages(self) -> int:
        """Return the page count validated before provider initialization."""
        return self._validated_page_count
    
    def extract_page_results(self) -> List[Dict[str, Any]]:
        """Convert PDF pages to images and extract one result per page."""
        try:
            total_pages = self._get_total_pages()
            if total_pages == 0:
                print("Error: Could not determine PDF page count", file=sys.stderr)
                sys.exit(1)

            self._page_count = total_pages
            selected_pages = self._selected_pages
            if selected_pages is not None:
                return self._extract_selected_pages(selected_pages, total_pages)

            page_results: List[Dict[str, Any]] = []
            batch_size = 8
            max_workers = 3
            batch_delay = 1.0

            for batch_start in range(1, total_pages + 1, batch_size):
                batch_end = min(batch_start + batch_size - 1, total_pages)
                print(
                    f"request pages={batch_start}-{batch_end}/{total_pages} outcome=batch_start",
                    file=sys.stderr,
                )
                try:
                    render_started = time.monotonic()
                    batch_images = convert_from_path(
                        self.pdf_path,
                        dpi=EXTRACT_DPI,
                        first_page=batch_start,
                        last_page=batch_end,
                    )
                    render_ms = int((time.monotonic() - render_started) * 1000)
                    print(
                        f"request stage=pdf_rendering pages={batch_start}-{batch_end} outcome=ok elapsed_ms={render_ms}",
                        file=sys.stderr,
                    )
                except Exception:
                    print(
                        f"request stage=pdf_rendering pages={batch_start}-{batch_end} outcome=internal",
                        file=sys.stderr,
                    )
                    for page_num in range(batch_start, batch_end + 1):
                        page_results.append(failed_page(page_num, "internal"))
                    continue

                batch_results: List[Dict[str, Any]] = []
                with ThreadPoolExecutor(max_workers=max_workers) as executor:
                    futures = {
                        executor.submit(
                            process_one_page,
                            self.pdf_path,
                            self.claude_client,
                            batch_images[i],
                            batch_start + i,
                            self.work_dir,
                            self,
                        ): batch_start + i
                        for i in range(len(batch_images))
                    }
                    for future in as_completed(futures):
                        page_num = futures[future]
                        try:
                            batch_results.append(future.result())
                        except Exception:
                            batch_results.append(failed_page(page_num, "internal"))

                expected = set(range(batch_start, batch_end + 1))
                seen = {page.get("pageNumber") for page in batch_results}
                for missing in sorted(expected - seen):
                    batch_results.append(failed_page(missing, "internal"))
                batch_results.sort(key=lambda item: item["pageNumber"])
                page_results.extend(batch_results)
                if batch_end < total_pages:
                    time.sleep(batch_delay)

            return build_document_pages(page_results, total_pages)
        except Exception:
            print("Error during PDF processing", file=sys.stderr)
            sys.exit(1)

    def _extract_selected_pages(
        self,
        selected_pages: List[int],
        total_pages: int,
    ) -> List[Dict[str, Any]]:
        page_results: List[Dict[str, Any]] = []
        for page_num in selected_pages:
            print(
                f"request pages={page_num}-{page_num}/{total_pages} outcome=batch_start",
                file=sys.stderr,
            )
            try:
                render_started = time.monotonic()
                images = convert_from_path(
                    self.pdf_path,
                    dpi=EXTRACT_DPI,
                    first_page=page_num,
                    last_page=page_num,
                )
                render_ms = int((time.monotonic() - render_started) * 1000)
                print(
                    f"request stage=pdf_rendering pages={page_num}-{page_num} outcome=ok elapsed_ms={render_ms}",
                    file=sys.stderr,
                )
            except Exception:
                print(
                    f"request stage=pdf_rendering pages={page_num}-{page_num} outcome=internal",
                    file=sys.stderr,
                )
                page_results.append(failed_page(page_num, "internal"))
                continue
            if not images:
                page_results.append(failed_page(page_num, "internal"))
                continue
            try:
                page_results.append(
                    process_one_page(
                        self.pdf_path,
                        self.claude_client,
                        images[0],
                        page_num,
                        self.work_dir,
                        self,
                    )
                )
            except Exception:
                page_results.append(failed_page(page_num, "internal"))
        return build_selected_document_pages(page_results, selected_pages, total_pages)
    
    def detect_question_type(self, text: str) -> str:
        """Detect question type based on text patterns"""
        if not text:
            return "Short"
        
        text_lower = text.lower()
        
        if any(keyword in text_lower for keyword in ['choose', 'select', 'which of the following', 'option']):
            return "MCQ"
        elif any(keyword in text_lower for keyword in ['explain', 'describe', 'discuss', 'elaborate']):
            return "Long"
        else:
            return "Short"
    
    def extract_marks(self, text: str, section: str = "") -> int:
        """Extract marks from question text or infer from section"""
        sec = section.strip().upper()
        if not text and not sec:
            return 1
        import re
        marks_patterns = [
            r'\((\d+)\s*marks?\)',
            r'\[(\d+)\s*marks?\]',
            r'(\d+)\s*marks?',
        ]
        if text:
            for pattern in marks_patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    return int(match.group(1))
        # Infer from section name
        if "SECTION-I" in sec and "SECTION-II" not in sec and "SECTION-III" not in sec:
            return 2
        if "SECTION-II" in sec and "SECTION-III" not in sec:
            return 4
        if "SECTION-III" in sec:
            return 6
        if "PART-B" in sec:
            return 1
        return 1
    
    def save_document_result(self, output_path: str, pages: List[Dict[str, Any]]) -> None:
        write_document_result(output_path, getattr(self, "_page_count", len(pages)), pages)


def parse_selected_pages(raw: str, total_pages: int) -> List[int]:
    """Parse a server-controlled comma-separated page list. Rejects duplicates."""
    if not raw or not str(raw).strip():
        raise ValueError("empty_selected_pages")
    pages: List[int] = []
    seen = set()
    for part in str(raw).split(","):
        token = part.strip()
        if not token:
            raise ValueError("invalid_selected_page")
        try:
            page_num = int(token, 10)
        except ValueError as exc:
            raise ValueError("invalid_selected_page") from exc
        if page_num < 1 or page_num > total_pages:
            raise ValueError("selected_page_out_of_range")
        if page_num in seen:
            raise ValueError("duplicate_selected_page")
        seen.add(page_num)
        pages.append(page_num)
    if not pages:
        raise ValueError("empty_selected_pages")
    return pages


def build_selected_document_pages(
    page_results: List[Dict[str, Any]],
    selected_pages: List[int],
    total_pages: int,
) -> List[Dict[str, Any]]:
    """Keep original page numbers and exactly one result per requested page."""
    by_number: Dict[int, Dict[str, Any]] = {}
    selected = set(selected_pages)
    for page in page_results:
        page_num = page.get("pageNumber")
        if not isinstance(page_num, int) or page_num not in selected:
            continue
        if page_num < 1 or page_num > total_pages:
            continue
        if page_num in by_number:
            by_number[page_num] = failed_page(page_num, "internal")
            continue
        if page.get("status") not in ("succeeded", "failed"):
            by_number[page_num] = failed_page(page_num, "internal")
            continue
        by_number[page_num] = page
    pages = []
    for page_num in selected_pages:
        pages.append(by_number.get(page_num) or failed_page(page_num, "internal"))
    return pages


def build_document_pages(
    page_results: List[Dict[str, Any]],
    total_pages: int,
) -> List[Dict[str, Any]]:
    by_number: Dict[int, Dict[str, Any]] = {}
    for page in page_results:
        page_num = page.get("pageNumber")
        if not isinstance(page_num, int) or page_num < 1 or page_num > total_pages:
            continue
        if page_num in by_number:
            by_number[page_num] = failed_page(page_num, "internal")
            continue
        if page.get("status") not in ("succeeded", "failed"):
            by_number[page_num] = failed_page(page_num, "internal")
            continue
        by_number[page_num] = page
    pages = []
    for page_num in range(1, total_pages + 1):
        pages.append(by_number.get(page_num) or failed_page(page_num, "internal"))
    return pages


def write_document_result(
    output_path: str,
    page_count: int,
    pages: List[Dict[str, Any]],
) -> None:
    document = {
        "schemaVersion": RESULT_SCHEMA_VERSION,
        "pageCount": page_count,
        "pages": pages,
    }
    encoded = json.dumps(document, ensure_ascii=False).encode("utf-8")
    if len(encoded) > MAX_RESULT_BYTES:
        raise ValueError("extract_result_too_large")
    Path(output_path).write_bytes(encoded)


def main():
    parser = argparse.ArgumentParser(description='Extract questions from PDF using Anthropic Claude vision')
    parser.add_argument('--pdf', required=True, help='Path to PDF file')
    parser.add_argument('--subject', required=True, help='Subject name')
    parser.add_argument('--grade', required=True, help='Grade/Class')
    parser.add_argument('--year', required=True, help='Year')
    parser.add_argument('--output', default='data/question-papers.json', help='Output JSON file')
    parser.add_argument('--work-dir', required=True, help='Request-scoped working directory')
    parser.add_argument(
        '--pages',
        default=None,
        help='Optional comma-separated 1-based page numbers selected by the server',
    )
    
    args = parser.parse_args()

    if not os.path.exists(args.pdf):
        print("Error: PDF file not found", file=sys.stderr)
        sys.exit(1)

    work_dir = Path(args.work_dir)
    if not work_dir.is_dir():
        print("Error: work directory is not available", file=sys.stderr)
        sys.exit(1)

    validated_page_count = validate_pdf_page_count(args.pdf)
    selected_pages = None
    if args.pages is not None:
        try:
            selected_pages = parse_selected_pages(args.pages, validated_page_count)
        except ValueError:
            print("Error: selected pages are invalid", file=sys.stderr)
            sys.exit(1)
    check_poppler_available(args.pdf)
    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    
    try:
        extractor = QuestionExtractor(
            args.pdf,
            args.subject,
            args.grade,
            args.year,
            validated_page_count,
            work_dir,
        )
        extractor._selected_pages = selected_pages
    except ValueError:
        if not (os.getenv("QUESTION_PAPER_EXTRACT_MOCK") or "").strip():
            print("Error: extraction is not configured", file=sys.stderr)
            sys.exit(1)
        raise
    pages = extractor.extract_page_results()
    try:
        extractor.save_document_result(args.output, pages)
    except ValueError:
        print("Error: extraction result exceeded the size limit", file=sys.stderr)
        sys.exit(1)
    print(
        f"request pages={len(pages)} outcome=extract_complete",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
