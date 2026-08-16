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
import difflib
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Tuple
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
CLAUDE_PROMPT = """You are extracting questions from an Indian school exam paper image.
Extract ALL content EXACTLY as it appears - every word, every option, every mark.

Your most important task is to accurately capture the REAL section/part structure used in the paper.

1) On each page, FIRST look for explicit section/part headers (like "PART-A", "PART-B", "SECTION-I", "SECTION-II", etc.).
   - If you see a section header on the page, assign ALL questions on that page to that section/part name.
   - If no new section header appears on the current page, CONTINUE using the most recent section/part name from previous pages.

2) For each question, identify the exact section or part name it belongs to, using the paper's own labels.
   Examples of valid section/part names:
   - "PART-A", "PART-B", "PART-C"
   - "SECTION-I", "SECTION-II", "SECTION-III"
   - "SECTION-A", "SECTION-B", "SECTION-C"
   Use the section or part headings printed in the paper (do NOT invent new names).

3) Group all questions that belong to the same section together under that exact section name.
   - If a section continues on the next page, keep using the SAME section name for those questions.
   - Do NOT create a new section just because the page changed.

4) Never use paper codes or exam codes (like "JK-82", "QP-01", etc.) as section names.
   Those are NOT sections. Only use headings that clearly indicate a question section or part.
   Never use generic names like "UNKNOWN" or "OTHER" for the section field.
   If you are unsure, always use the last known valid section/part name instead of "UNKNOWN".

5) Extract ALL questions from the page, from EVERY section. Do NOT skip any questions, even if the formatting looks unusual.
   - For SECTION-I (short-answer, 2-mark questions), make sure you extract ALL questions in that section (e.g., 1–6).
   - For SECTION-II (4-mark questions), extract ALL questions in that section (e.g., 7–12).
   - For SECTION-III (6-mark questions), extract ALL questions in that section (e.g., 13–17).
   - For PART-B (1-mark MCQ questions), there are 20 questions numbered 1–20 across the paper. Extract ALL 20 MCQs.
   Do NOT focus only on PART-B; you must extract questions from SECTION-I, SECTION-II, SECTION-III, and PART-B.

6) TABLES — When you see a data table/grid in the question:
   - Extract it as a proper markdown table with header row and separator row.
   - The table must be stored with REAL newline characters between rows in the JSON (not a single flattened line).
   - Example: A vehicle sales table should become exactly:
     \"| Type of Vehicle | Cars | Busses | Bikes |\\n|----------------|------|--------|-------|\\n| No. of vehicles sold | 14 | 15 | 16 |\"
   - Each row must be on its own line separated by '\\n'. Never put the entire table on one line.
   - Preserve ALL rows and columns exactly as they appear.
   - Do NOT use pipe characters without proper table structure.
   - The table must be part of the question text field.

Format output as JSON:
{
  "section": "SECTION-A",
  "questions": [
    {
      "number": "1",
      "text": "Full question text exactly as written",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "marks": 1,
      "type": "MCQ"
    }
  ]
}

Rules:
- Preserve the EXACT wording and order of questions and options.
- Use the EXACT section/part names from the paper for the "section" field.
- Return ONLY valid JSON, nothing else."""


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
    json_str = json_str.replace("\\ ", "\\\\ ")
    json_str = json_str.replace("\\+", "\\\\+")
    json_str = json_str.replace("\\=", "\\\\=")
    json_str = re.sub(r'\\([^"\\/bfnrtu0-9])', r"\\\\\1", json_str)
    try:
        result = json.loads(json_str)
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


def extract_with_claude(client: Anthropic, image_base64: str, page_num: int) -> Dict[str, Any]:
    """Extract questions from a page image using Claude API, with basic retry on overload."""
    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
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
            return parse_model_json_response(response_text, page_num)
        except Exception as e:
            msg = str(e)
            if ("529" in msg or "overloaded" in msg.lower()) and attempt < max_attempts:
                print(
                    f"request page={page_num} outcome=provider_retry attempt={attempt}",
                    file=sys.stderr,
                )
                time.sleep(5)
                continue
            return {"ok": False, "error_category": classify_provider_error(e)}
    return {"ok": False, "error_category": "provider"}


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
    questions = normalize_page_questions(
        result.get("questions") or [],
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

        self.claude_client = Anthropic(api_key=require_anthropic_api_key())
        
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
                    batch_images = convert_from_path(
                        self.pdf_path,
                        dpi=EXTRACT_DPI,
                        first_page=batch_start,
                        last_page=batch_end,
                    )
                except Exception:
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
    
    def _post_process_sections(self, questions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Fix section labels after parallel extraction."""
        if not questions:
            return questions
        
        # Normalize section strings
        for q in questions:
            sec = q.get("section")
            if isinstance(sec, str):
                q["section"] = sec.strip()
        
        # 1) For UNKNOWN / empty sections, infer from nearby known sections
        n = len(questions)
        # Forward pass: propagate last known section
        last_known: str | None = None
        for i in range(n):
            sec = str(questions[i].get("section") or "").strip()
            if sec and sec.upper() != "UNKNOWN":
                last_known = sec
            elif last_known is not None:
                questions[i]["section"] = last_known
        
        # Backward pass: fill leading UNKNOWNs from next known section
        next_known: str | None = None
        for i in range(n - 1, -1, -1):
            sec = str(questions[i].get("section") or "").strip()
            if sec and sec.upper() != "UNKNOWN":
                next_known = sec
            elif next_known is not None:
                questions[i]["section"] = next_known
        
        # 2) Rename remaining UNKNOWN-like sections to SECTION-I when they look like Part-I
        # Find first SECTION-II question index, if any
        first_section2_idx: int | None = None
        for idx, q in enumerate(questions):
            sec = str(q.get("section") or "").strip().upper()
            if sec.startswith("SECTION-II"):
                first_section2_idx = idx
                break
        
        for idx, q in enumerate(questions):
            sec_raw = str(q.get("section") or "").strip()
            sec_up = sec_raw.upper()
            if not sec_raw or sec_up == "UNKNOWN":
                no_options = not q.get("options")
                if no_options and (first_section2_idx is None or idx < first_section2_idx):
                    q["section"] = "SECTION-I"
        
        # 3) Group MCQ 1-mark questions into PART-B ONLY if section is already PART-B
        # Do NOT reassign questions from SECTION-I/II/III to PART-B based on marks alone
        # Trust Claude's section assignment
        for q in questions:
            sec = str(q.get("section") or "").strip().upper()
            marks = q.get("marks")
            options = q.get("options") or []
            qtype = q.get("type")
            # Only force PART-B if it's already labeled as such, or truly unknown with MCQ characteristics
            if sec == "PART-B":
                q["section"] = "PART-B"
            # Don't touch SECTION-I, SECTION-II, SECTION-III

        # 4) Normalize question type labels (marks-based)
        for q in questions:
            qtype = (q.get("type") or "").strip()
            options = q.get("options") or []
            marks = q.get("marks") or 0
            # Map verbose types to canonical ones
            if qtype in ["Short Answer", "Subjective"]:
                qtype = "Short"
            # MCQ without options should be treated as Short
            if qtype == "MCQ" and not options:
                qtype = "Short"
            # Apply marks-based rule
            if marks == 1:
                qtype = "MCQ" if options else "Short"
            elif marks == 2:
                qtype = "Short"
            elif marks == 4:
                qtype = "Medium"
            elif marks >= 5:
                qtype = "Long"
            # Only keep allowed canonical types, default to Short
            if qtype not in ["MCQ", "Short", "Medium", "Long"]:
                qtype = "Short"
            q["type"] = qtype
        
        return questions
    
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


def normalize_text_for_similarity(text: str) -> str:
    """Normalize question text for similarity comparison."""
    if not text:
        return ""
    import re
    t = text.lower().strip()
    t = re.sub(r"\s+", " ", t)
    return t


def count_duplicates(new_questions: List[Dict], existing_texts: List[str], threshold: float = 0.85) -> Tuple[List[Dict], int]:
    """Filter out questions that are >threshold similar to any existing text. Returns (non_duplicates, skipped_count)."""
    kept = []
    skipped = 0
    for q in new_questions:
        new_text = normalize_text_for_similarity(q.get("text", ""))
        if not new_text:
            kept.append(q)
            continue
        is_dup = False
        for existing in existing_texts:
            if not existing:
                continue
            ratio = difflib.SequenceMatcher(None, new_text, existing).ratio()
            if ratio >= threshold:
                is_dup = True
                break
        if is_dup:
            skipped += 1
        else:
            kept.append(q)
    return kept, skipped


def main():
    parser = argparse.ArgumentParser(description='Extract questions from PDF using Anthropic Claude vision')
    parser.add_argument('--pdf', required=True, help='Path to PDF file')
    parser.add_argument('--subject', required=True, help='Subject name')
    parser.add_argument('--grade', required=True, help='Grade/Class')
    parser.add_argument('--year', required=True, help='Year')
    parser.add_argument('--output', default='data/question-papers.json', help='Output JSON file')
    parser.add_argument('--work-dir', required=True, help='Request-scoped working directory')
    
    args = parser.parse_args()

    if not os.path.exists(args.pdf):
        print("Error: PDF file not found", file=sys.stderr)
        sys.exit(1)

    work_dir = Path(args.work_dir)
    if not work_dir.is_dir():
        print("Error: work directory is not available", file=sys.stderr)
        sys.exit(1)

    validated_page_count = validate_pdf_page_count(args.pdf)
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
    except ValueError:
        print("Error: extraction is not configured", file=sys.stderr)
        sys.exit(1)
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
