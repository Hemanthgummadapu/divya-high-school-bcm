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
from typing import List, Dict, Any, Optional
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
- When words are UNDERLINED on the page, wrap them as \\underline{like this}.
  Some questions are about the underlined parts ("focussing on the parts
  that are underlined"), and without the marks the question cannot be
  answered at all. Mark only what is actually underlined.
- Preserve every mathematical symbol and expression exactly as printed (for example △, ∠, ∥, ⊥, ≤, ≥, ≠, ±, ×, ÷, √, π, θ, °, superscripts like x², subscripts like a₁, and fractions such as ½ or 3/4).
- Never invent questions, options, marks, answers, sections or diagrams that are not printed on the page. If something is not printed, omit it or use null.
- Ignore page headers, footers, page numbers, watermarks, school names and exam codes (like "JK-82" or "QP-01"). They are not questions and never section names.
- General instructions to students (such as "Answer all questions" or "Time: 3 Hours") are not questions. Do not output them as questions.

QUESTIONS — one printed question, one JSON question
- Keep each printed question as ONE question even when it spans several lines. Never merge two printed questions and never split one printed question into several.
- "type" must be exactly one of "MCQ", "Short", "Medium" or "Long". Prefer the paper's own printed evidence: section headings, printed marks and option lists. If the type is genuinely unclear, choose the closest supported type; do not invent evidence.
- "marks" must be the marks printed for that question. If marks are printed only on the section heading, use the section's marks. Never use 0 or negative marks.
- A figure printed to the right of a question's own heading, like "4 x 2 = 8"
  beside "Q.No. (13)", is that question's total: its marks are 8. Read the
  total after the "=", not the "4" or the "2".
- For MCQ questions, list every printed option in printed order in "options", either as ["A) ...", "B) ...", ...] or as [{"label": "A", "text": "..."}, ...]. Keep the option text exactly as printed and keep its label.
- "correctAnswer" must be null unless the answer is explicitly printed on this page. Never solve the question yourself and never guess.

READING PASSAGES AND OTHER SHARED STIMULUS
- A language paper often prints one passage, table or picture that several
  numbered questions depend on, introduced like "Q.No. (1 - 4) Read the
  following passage." Those questions are unanswerable on their own, so the
  passage must be captured.
- When this page prints such a stimulus, add it to a top-level "passages"
  list: {"from": 1, "to": 4, "text": "the passage exactly as printed"}.
  "from" and "to" are the first and last printed question numbers it governs.
- A passage often runs over a page break. If this page BEGINS with prose that
  continues a passage started on an earlier page — no heading, no question
  number, it just carries on — add it as
  {"continuation": true, "text": "..."} instead, with no "from"/"to". The
  fragments are joined back together afterwards in page order.
- Copy passage text exactly as printed, the same as question text. Never
  summarise it and never write a passage that is not printed.
- A passage is NOT a question: never also emit it as one.
- When a question carries its own instruction ("Read the passage below and
  answer any 4 ..."), that instruction comes FIRST, before the passage it
  introduces, exactly as it is printed. Do not move it after the passage.
- A page may be nothing but passage, with no questions printed on it at all.
  That is normal in a language paper and is NOT an empty page: return
  "questions": [] together with the "passages" entry for what is printed.
  Returning nothing for such a page loses the passage for every question that
  depends on it.
- The heading that introduces a passage ("Q.No. (1 - 4) Read the following
  passage.") is the evidence for "from" and "to". It is an instruction, so do
  not emit it as a question, but do use its numbers. If a passage is printed
  with no such heading, use the numbers of the questions that follow it.

IGNORE the source paper's own structure
- This paper is only a source of reusable questions. Its arrangement belongs to the old paper, not to the questions.
- Do NOT output section or part headings ("PART-A", "PART-B", "SECTION-I", "SECTION-II" and similar), section instructions ("Answer all questions", "Answer any four"), time allocations, or marks-allocation headings ("Marks 6x2=12").
- Do NOT output page headers, footers, page numbers, exam codes, continuation text ("Turn Over", "Contd., on 3rd page") or answer-space formatting such as blank boxes or answer brackets.
- Use those headings only as evidence when deciding a question's own "type" and printed "marks". Never copy them into the output.

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
  "passages": [
    { "from": 1, "to": 4, "text": "Full passage exactly as printed" }
  ],
  "questions": [
    {
      "number": "1",
      "text": "Full question text exactly as printed",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "marks": 2,
      "type": "Short",
      "correctAnswer": null
    }
  ]
}
Include "passages" only when this page prints a shared stimulus. Include "options" only for MCQ questions. Include "diagram" and "diagramBox" only when a required printed figure exists. Do not include a "section" field. Return ONLY valid JSON, nothing else."""


# What a paper in this subject is shaped like. The subject is chosen on the
# upload form, so the page can be read knowing what to expect instead of
# guessing: a language paper is mostly prose and shared passages, a maths
# paper is symbols and figures and has no passages at all. Telling the model
# what NOT to expect matters as much as what to expect — it is what stops a
# heading being read as a question, or a passage being invented.

_LANGUAGE_GUIDANCE = """
THIS IS A LANGUAGE PAPER (prose, not mathematics)
- Expect reading passages shared by a numbered range of questions. Capture
  them in "passages" as described above. This is the most important thing on
  this paper: without the passage its questions mean nothing.
- A shared stimulus is not always prose. A table, a tree diagram, a picture
  or a set of notes can serve the same purpose, introduced the same way
  ("The tree diagram given below ... "). Capture the introduction and
  anything reproducible as text in "passages", with the range it governs.
- If that shared stimulus is a FIGURE rather than text — a tree diagram, a
  picture, a chart, a map — the questions cannot be answered without seeing
  it. Put "diagram" and "diagramBox" on the FIRST question of the range, so
  the figure travels with the set. A set that says "study the diagram" and
  carries no figure is useless to a student.
- Writing tasks (letter, essay, diary entry, poster, interview, biographical
  sketch) are ONE question each. Keep the whole task together, including any
  "Hints :" line and any details printed under it.
- When two tasks are printed as alternatives for the same question number,
  separated by "(OR)", they are still ONE question. Return one question
  containing both, with "(OR)" between them. Never return the same number
  twice.
- Grammar exercises printed as sub-items (i), (ii), (iii) under one number
  are ONE question. Keep the sub-items in the question text.
- Do not expect mathematical symbols, equations or geometry figures on this
  paper, and never add them.
"""

_MATHEMATICS_GUIDANCE = """
THIS IS A MATHEMATICS PAPER
- Expect symbols and expressions throughout, and copy them exactly: △ ∠ ∥ ⊥
  ≤ ≥ ≠ ± × ÷ √ π θ °, powers like x², subscripts like a₁, and fractions.
- Expect geometry figures, graphs and number lines. A question that cannot
  be answered without its figure needs "diagram" and "diagramBox".
- There are NO reading passages on this paper. Never return "passages".
- Questions are usually grouped by marks rather than by topic. Use the
  printed marks for each question.
"""

_SCIENCE_GUIDANCE = """
THIS IS A SCIENCE PAPER
- Expect chemical equations with arrows (→), formulas with subscripts like
  H₂O and CaCO₃, and units. Copy them exactly as printed.
- Expect figures: ray diagrams, circuits, apparatus, labelled biology
  diagrams. A question that cannot be answered without its figure needs
  "diagram" and "diagramBox".
- Expect data tables; reproduce them as markdown as described above.
- There are NO reading passages on this paper. Never return "passages".
"""

_SOCIAL_GUIDANCE = """
THIS IS A SOCIAL STUDIES PAPER
- Expect data tables, extracts and map-based questions. A table or extract
  may be shared by a numbered range of questions: capture it in "passages"
  with the range it governs.
- Expect map work. A question that depends on a printed map needs "diagram"
  and "diagramBox".
"""

SUBJECT_GUIDANCE = {
    "telugu": _LANGUAGE_GUIDANCE,
    "hindi": _LANGUAGE_GUIDANCE,
    "english": _LANGUAGE_GUIDANCE,
    "mathematics": _MATHEMATICS_GUIDANCE,
    "physics": _SCIENCE_GUIDANCE,
    "biology": _SCIENCE_GUIDANCE,
    "science": _SCIENCE_GUIDANCE,
    "social studies": _SOCIAL_GUIDANCE,
}


def build_page_prompt(subject: Optional[str]) -> str:
    """The shared rules, plus what this subject's papers actually look like."""
    guidance = SUBJECT_GUIDANCE.get(str(subject or "").strip().lower())
    return CLAUDE_PROMPT if not guidance else CLAUDE_PROMPT + "\n" + guidance


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


def succeeded_page(
    page_num: int,
    questions: List[Dict[str, Any]],
    passages: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    page = {
        "pageNumber": page_num,
        "status": "succeeded",
        "questions": questions,
    }
    if passages:
        page["passages"] = passages
    return page


MAX_PASSAGES_PER_PAGE = 8
MAX_PASSAGE_CHARS = 12000


def normalize_passages(raw_passages: Any) -> List[Dict[str, Any]]:
    """Keep only well-formed passage blocks; drop anything else silently.

    A malformed block is dropped rather than failing the page: losing a
    passage costs context, failing the page costs every question on it.
    """
    if not isinstance(raw_passages, list):
        return []
    cleaned: List[Dict[str, Any]] = []
    for raw in raw_passages[:MAX_PASSAGES_PER_PAGE]:
        if not isinstance(raw, dict):
            continue
        text = raw.get("text")
        if not isinstance(text, str) or not text.strip():
            continue
        text = text.strip()[:MAX_PASSAGE_CHARS]
        if raw.get("continuation") is True:
            cleaned.append({"continuation": True, "text": text})
            continue
        try:
            first = int(raw.get("from"))
            last = int(raw.get("to"))
        except (TypeError, ValueError):
            continue
        if first < 1 or last < first or last - first > MAX_QUESTIONS_PER_PAGE:
            continue
        cleaned.append({"from": first, "to": last, "text": text})
    return cleaned


def _question_number(question: Dict[str, Any]) -> Optional[int]:
    """The question's printed number, in either shape.

    Pages carry the provider's raw shape before normalization and the bank's
    shape afterwards; joining passages runs after, so "printedNumber" is the
    one that matters and "number" is accepted for the raw shape.
    """
    for key in ("printedNumber", "number"):
        raw = question.get(key)
        if isinstance(raw, int):
            return raw
        if isinstance(raw, str):
            match = re.match(r"\s*(\d+)", raw)
            if match:
                return int(match.group(1))
    return None


def _normalized_for_match(text: str) -> str:
    """Collapse whitespace so a repeated line can be recognised as the same."""
    return " ".join(str(text or "").split()).casefold()


def _restates_the_stimulus(body: str, passage_body: str) -> bool:
    """True when a "question" is really the stimulus instruction again.

    "Study the tree diagram and answer the following questions" comes back
    both as the passage and as the first question of its own range, which
    added a part that nobody can answer and counted its marks a second time.
    It is rarely word-for-word — the wording gets rephrased — so an exact
    match is not enough: an instruction asks nothing and reuses the
    stimulus's own words, where a real question asks something new.
    """
    if not body:
        return False
    if body in passage_body:
        return True
    if "?" in body:
        return False
    words = [w for w in re.findall(r"\w+", body) if len(w) > 2]
    if len(words) < 4:
        return False
    passage_words = set(re.findall(r"\w+", passage_body))
    shared = sum(1 for w in words if w in passage_words)
    return shared / len(words) >= 0.7


_ROMAN = ("i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii")


def _roman(position: int) -> str:
    return _ROMAN[position - 1] if 1 <= position <= len(_ROMAN) else str(position)


def _question_text_key(question: Dict[str, Any]) -> str:
    return "questionText" if "questionText" in question else "text"


def attach_passages(pages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Give every question the passage it depends on, across page breaks.

    Pages are extracted independently and in parallel, so the page holding
    "Q.No. (1 - 4) Read the following passage." is never the page holding
    questions 1 to 4. Without this, a comprehension question reached the bank
    as a bare stem — "Why does the narrator smile?" — which cannot be answered
    and cannot be put on a paper.

    Walked in page order: a block with from/to opens a passage, and a
    continuation block extends the one it follows. Each question then takes
    the passage whose printed range covers its number.
    """
    ranges: List[Dict[str, Any]] = []
    open_passage: Optional[Dict[str, Any]] = None
    for page in sorted(pages, key=lambda item: item.get("pageNumber") or 0):
        for block in normalize_passages(page.get("passages")):
            if block.get("continuation"):
                if open_passage is not None:
                    open_passage["text"] = (
                        open_passage["text"].rstrip() + "\n" + block["text"]
                    )
                continue
            open_passage = {
                "from": block["from"],
                "to": block["to"],
                "text": block["text"],
            }
            ranges.append(open_passage)

    if not ranges:
        return pages

    # Collect the questions each passage governs, in printed order, wherever
    # on the paper they were found.
    members = {id(block): [] for block in ranges}
    for page in pages:
        for question in page.get("questions") or []:
            if not isinstance(question, dict):
                continue
            number = _question_number(question)
            if number is None:
                continue
            for block in ranges:
                if block["from"] <= number <= block["to"]:
                    members[id(block)].append((page, number, question))
                    break

    for block in ranges:
        found = sorted(members[id(block)], key=lambda item: item[1])

        # The line that introduces a stimulus ("Study the tree diagram and
        # answer the following questions") sometimes comes back as a passage
        # AND as the first question of its own range. Left in, the set gained
        # a part that is not a question and its marks were counted twice.
        passage_body = _normalized_for_match(block["text"])
        kept = []
        for page, number, question in found:
            body = _normalized_for_match(question.get(_question_text_key(question)) or "")
            if _restates_the_stimulus(body, passage_body):
                continue
            kept.append((page, number, question))
        if kept:
            kept_ids = {id(k) for _, _, k in kept}
            dropped = {id(q) for _, _, q in found if id(q) not in kept_ids}
            # The figure is asked for on the first question of the range,
            # which is exactly the member being dropped here. Hand it to the
            # question that now leads the set, or the set loses the diagram
            # it tells the student to study.
            if dropped:
                host_question = kept[0][2]
                for _, _, question in found:
                    if id(question) in dropped and question.get("diagram"):
                        for field in ("diagram", "diagramCropRef", "diagramBox"):
                            if question.get(field) and not host_question.get(field):
                                host_question[field] = question[field]
                        break
            if dropped:
                for page in pages:
                    existing = page.get("questions") or []
                    if existing:
                        page["questions"] = [q for q in existing if id(q) not in dropped]
            found = kept

        if not found:
            continue
        key = _question_text_key(found[0][2])

        # One passage and its questions are a single thing on the paper —
        # "Q.No. (1 - 4) ... 4 x 3 = 12" — and belong in the bank as one
        # entry. Keeping them apart stored the whole passage again against
        # every question and offered four fragments that only make sense
        # together.
        if len(found) > 1:
            # Lettered (i), (ii), (iii) rather than kept as 1., 2., 3.: the
            # paper numbers the set itself, so printed numbers inside it made
            # question "1." open with another "1.".
            lines = []
            for position, (_, _number, question) in enumerate(found):
                body = (question.get(key) or "").strip()
                if body.startswith(block["text"]):
                    body = body[len(block["text"]):].strip()
                lines.append(f"({_roman(position + 1)}) {body}" if body else "")
            host_page, _, host = found[0]
            host[key] = block["text"] + "\n\n" + "\n".join(line for line in lines if line)
            if key == "questionText" and "rawExtractedText" in host:
                host["rawExtractedText"] = host[key]
            host["marks"] = sum(
                int(question.get("marks") or 0) for _, _, question in found
            ) or host.get("marks")
            # The set is answered as a whole, so it is the longest kind of
            # answer any of its parts asked for.
            for _, _, question in found:
                if question.get("questionType") == "Long" or question.get("type") == "Long":
                    host["questionType"] = "Long"
                    break
            else:
                host["questionType"] = host.get("questionType") or "Medium"
            drop = {id(question) for _, _, question in found[1:]}
            for page in pages:
                existing = page.get("questions") or []
                if existing:
                    page["questions"] = [q for q in existing if id(q) not in drop]
            continue

        # A single question keeps its passage inline so it still stands alone.
        _, _, only = found[0]
        text = only.get(key) or ""
        if not text.startswith(block["text"]):
            only[key] = block["text"] + "\n\n" + text
            if key == "questionText" and "rawExtractedText" in only:
                only["rawExtractedText"] = only[key]
    return pages


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
            # Carried through: a passage is the only record of what several
            # questions on a later page are actually asking about.
            "passages": result.get("passages"),
        }

    questions = result.get("questions")
    if not isinstance(questions, list):
        return {"ok": False, "error_category": "parse"}
    return {
        "ok": True,
        "section": result.get("section") or "SECTION-A",
        "questions": [q for q in questions if isinstance(q, dict)],
        "passages": result.get("passages"),
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


def extract_with_claude(
    client: Anthropic,
    image_base64: str,
    page_num: int,
    subject: Optional[str] = None,
) -> Dict[str, Any]:
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
                            "text": build_page_prompt(subject),
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
    """Normalize one page of provider questions into bank-question rows.

    Sections belong to a prepared paper, not to a reusable bank question, so
    the source paper's own PART/SECTION arrangement is never carried through:
    `section` is accepted only as legacy provider evidence for inferring
    printed marks, and no section label is emitted.
    """
    if len(questions) > MAX_QUESTIONS_PER_PAGE:
        return None
    normalized: List[Dict[str, Any]] = []
    marks_hint = section if isinstance(section, str) else ""
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
            marks = extractor.extract_marks(text, marks_hint)
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
        printed_number = raw.get("number")
        if isinstance(printed_number, str):
            match = re.match(r"\s*(\d+)", printed_number)
            printed_number = int(match.group(1)) if match else None
        elif not isinstance(printed_number, int):
            printed_number = None
        normalized.append(
            {
                "sourceOrder": index,
                # The number as printed on the paper. sourceOrder is only this
                # question's position on its page, so it cannot be used to
                # match a passage's printed range like "Q.No. (1 - 4)".
                "printedNumber": printed_number,
                "questionType": question_type,
                "questionText": text,
                "rawExtractedText": text,
                "marks": marks,
                # Sections are defined on the prepared paper, never on the
                # reusable bank question.
                "sectionLabel": None,
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
    result = extract_with_claude(
        client, image_base64, page_num, getattr(extractor, "subject", None)
    )
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
    page = succeeded_page(page_num, questions, normalize_passages(result.get("passages")))
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
    # Only now are all the pages in hand and in order, which is what joining a
    # passage to the questions printed pages later requires.
    return attach_passages(pages)


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
