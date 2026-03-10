#!/usr/bin/env python3
"""
PDF Question Bank Extractor
Extracts questions from scanned PDF images using Claude API Vision
Optimized for large PDFs with batching and caching
"""

import argparse
import json
import os
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

# In production (Railway), env vars are set directly in the environment
# In development, they come from .env.local
print(
    f"DEBUG: ANTHROPIC_API_KEY present: {bool(os.getenv('ANTHROPIC_API_KEY'))}",
    file=sys.stderr,
)

# Load environment variables (project root = parent of scripts/). Optional in production.
load_dotenv(
    dotenv_path=Path(__file__).resolve().parent.parent / ".env.local",
    override=False,
)


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

# Cache directory for processed pages
CACHE_DIR = Path("data/ocr_cache")
CACHE_DIR.mkdir(parents=True, exist_ok=True)

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


def get_page_hash(pdf_path: str, page_num: int) -> str:
    """Generate hash for a specific page of a PDF"""
    stat = os.stat(pdf_path)
    content = f"{pdf_path}:{page_num}:{stat.st_mtime}"
    return hashlib.md5(content.encode()).hexdigest()


def get_cached_result(page_hash: str) -> Dict[str, Any] | None:
    """Get cached extraction result for a page"""
    cache_file = CACHE_DIR / f"{page_hash}.json"
    if cache_file.exists():
        try:
            return json.loads(cache_file.read_text(encoding='utf-8'))
        except:
            return None
    return None


def save_cached_result(page_hash: str, result: Dict[str, Any]):
    """Save extraction result to cache"""
    cache_file = CACHE_DIR / f"{page_hash}.json"
    try:
        cache_file.write_text(json.dumps(result, indent=2), encoding='utf-8')
    except:
        pass  # Ignore cache write errors


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
                model="claude-haiku-4-5-20251001",
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
            
            # Extract JSON from response
            response_text = message.content[0].text.strip()
            print(f"=== PAGE {page_num} RAW RESPONSE ===")
            print(response_text)
            
            # Try to find JSON in the response (in case there's extra text)
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = response_text[json_start:json_end]
                # Sanitize invalid backslash escapes before JSON parsing
                import re
                json_str = re.sub(r'\\(?![\"\\/bfnrtu])', r'\\\\', json_str)
                result = json.loads(json_str)

                # Handle both single-section and multi-section formats
                # Format 1: { "section": "...", "questions": [...] }
                # Format 2: { "sections": [ { "section": "...", "questions": [...] }, ... ] }
                if isinstance(result, dict) and "sections" in result and isinstance(result["sections"], list):
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
                            all_questions.extend(
                                [q for q in sec_questions if isinstance(q, dict)]
                            )
                    return {
                        "section": first_section_name or "SECTION-A",
                        "questions": all_questions,
                    }

                return result
            else:
                print(f"Warning: No valid JSON found in Claude response for page {page_num}")
                return {"section": "SECTION-A", "questions": []}
                
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON from Claude for page {page_num}: {e}")
            print(f"Response was: {response_text[:200]}...")
            return {"section": "SECTION-A", "questions": []}
        except Exception as e:
            msg = str(e)
            # Retry on 529 / overloaded responses
            if ("529" in msg or "overloaded" in msg.lower()) and attempt < max_attempts:
                print(f"Claude API overloaded for page {page_num}, retrying in 5 seconds (attempt {attempt}/{max_attempts})...")
                time.sleep(5)
                continue
            print(f"Error calling Claude API for page {page_num}: {e}")
            return {"section": "SECTION-A", "questions": []}


def process_one_page(
    pdf_path: str,
    client: Anthropic,
    image: Image.Image,
    page_num: int,
) -> Tuple[int, List[Dict[str, Any]], str, bool]:
    """Process a single page: cache lookup or Claude extraction. Returns (page_num, questions, section, was_cached)."""
    page_hash = get_page_hash(pdf_path, page_num)
    cached = get_cached_result(page_hash)
    if cached:
        return (page_num, cached.get("questions", []), cached.get("section", "SECTION-A"), True)
    image_base64 = image_to_base64(image)
    result = extract_with_claude(client, image_base64, page_num)
    save_cached_result(page_hash, result)
    return (page_num, result.get("questions", []), result.get("section", "SECTION-A"), False)


class QuestionExtractor:
    def __init__(self, pdf_path: str, subject: str, grade: str, year: str):
        self.pdf_path = pdf_path
        self.subject = subject
        self.grade = grade
        self.year = year
        self.questions = []
        
        # Initialize Claude client
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            # In production this should be set via environment variables.
            # Raise a clear exception instead of exiting the interpreter so callers can handle it.
            raise ValueError("ANTHROPIC_API_KEY environment variable is not set")

        self.claude_client = Anthropic(api_key=api_key)
        
    def _get_total_pages(self) -> int:
        """Get total number of pages in PDF using pypdf (reliable, no image conversion)."""
        try:
            reader = PdfReader(self.pdf_path)
            return len(reader.pages)
        except Exception as e:
            print(f"Error counting pages: {e}")
            return 0
    
    def extract_questions_from_pdf(self) -> List[Dict[str, Any]]:
        """Convert PDF pages to images and extract questions using Claude API"""
        print(f"Converting PDF to images: {self.pdf_path}")
        
        try:
            total_pages = self._get_total_pages()
            if total_pages == 0:
                print("Error: Could not determine PDF page count")
                sys.exit(1)
            
            self._page_count = total_pages
            print(f"Total pages: {total_pages}")
            print("Using Claude API Vision for extraction...")
            
            all_questions = []
            processed_count = 0
            cached_count = 0
            start_time = time.time()

            # Process pages in parallel within each batch
            batch_size = 8
            max_workers = 3  # Parallel API calls per batch (limited to avoid overloading API)
            batch_delay = 1.0  # 1 second delay between batches

            for batch_start in range(1, total_pages + 1, batch_size):
                batch_end = min(batch_start + batch_size - 1, total_pages)
                print(f"\nProcessing batch: pages {batch_start}-{batch_end} of {total_pages} (parallel)")

                # Convert batch to images (one convert_from_path per batch)
                batch_images = convert_from_path(
                    self.pdf_path,
                    dpi=300,
                    first_page=batch_start,
                    last_page=batch_end
                )

                # Process all pages in this batch in parallel
                batch_results = []
                with ThreadPoolExecutor(max_workers=max_workers) as executor:
                    futures = {
                        executor.submit(
                            process_one_page,
                            self.pdf_path,
                            self.claude_client,
                            batch_images[i],
                            batch_start + i,
                        ): batch_start + i
                        for i in range(len(batch_images))
                    }
                    for future in as_completed(futures):
                        page_num = futures[future]
                        try:
                            batch_results.append(future.result())
                        except Exception as e:
                            print(f"Error processing page {page_num}: {e}")
                            batch_results.append((page_num, [], "SECTION-A", False))

                # Sort by page number to preserve order
                batch_results.sort(key=lambda x: x[0])

                for page_num, questions, section, was_cached in batch_results:
                    if was_cached:
                        cached_count += 1
                    # Normalize section: ignore paper codes like "JK-82"
                    import re
                    effective_section = section
                    if isinstance(effective_section, str) and re.match(r"^JK-\d+$", effective_section.strip(), re.IGNORECASE):
                        effective_section = "SECTION-A"
                    for q in questions:
                        q["section"] = effective_section
                        q["id"] = f"q_{uuid.uuid4().hex[:12]}"
                        # Ensure type is one of the expected values
                        if "type" not in q or q["type"] not in ["MCQ", "Short", "Long", "Medium"]:
                            # Auto-detect type
                            q["type"] = self.detect_question_type(q.get("text", ""))
                        if "marks" not in q:
                            q["marks"] = self.extract_marks(q.get("text", ""))
                        if "options" not in q:
                            q["options"] = []
                        # Clean MCQ option prefixes like "A)", "B)", "C)", "D)"
                        if q.get("options"):
                            import re
                            cleaned_options: List[str] = []
                            for opt in q["options"]:
                                if isinstance(opt, str):
                                    cleaned_options.append(re.sub(r'^[A-Da-d]\)\s*', '', opt))
                                else:
                                    cleaned_options.append(opt)
                            q["options"] = cleaned_options
                    all_questions.extend(questions)
                    processed_count += 1
                
                # Calculate progress
                elapsed = time.time() - start_time
                pages_per_sec = processed_count / elapsed if elapsed > 0 else 0
                remaining_pages = total_pages - processed_count
                eta_seconds = remaining_pages / pages_per_sec if pages_per_sec > 0 else 0
                eta_minutes = int(eta_seconds // 60)
                eta_secs = int(eta_seconds % 60)
                
                print(f"\nProgress: {processed_count}/{total_pages} pages "
                      f"({processed_count*100//total_pages}%) | "
                      f"Speed: {pages_per_sec:.2f} pages/sec | "
                      f"ETA: {eta_minutes}m {eta_secs}s | "
                      f"Cached: {cached_count} | "
                      f"Questions found: {len(all_questions)}")
                
                # Delay between batches (except for the last batch)
                if batch_end < total_pages:
                    time.sleep(batch_delay)
            
            total_time = time.time() - start_time
            print(f"\nCompleted extraction on {processed_count} pages in {int(total_time//60)}m {int(total_time%60)}s")
            print(f"   Average speed: {total_pages/total_time:.2f} pages/sec")
            print(f"   Cached pages: {cached_count} (skipped API calls)")
            print(f"   Total questions extracted: {len(all_questions)}")
            
            # Post-process sections to fix UNKNOWN and mis-grouped sections
            all_questions = self._post_process_sections(all_questions)
            
            return all_questions
            
        except Exception as e:
            print(f"Error during PDF processing: {e}")
            import traceback
            traceback.print_exc()
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
        
        # 3) Group MCQ 1-mark questions into PART-B
        # Any question that is MCQ type OR has options AND has marks=1
        # should always be assigned to PART-B, regardless of previous section.
        for q in questions:
            marks = q.get("marks")
            options = q.get("options") or []
            qtype = q.get("type")
            if (qtype == "MCQ" or options) and marks == 1:
                q["section"] = "PART-B"

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
    
    def extract_marks(self, text: str) -> int:
        """Extract marks from question text"""
        if not text:
            return 1
        
        import re
        marks_patterns = [
            r'\((\d+)\s*marks?\)',
            r'\[(\d+)\s*marks?\]',
            r'(\d+)\s*marks?',
        ]
        
        for pattern in marks_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return int(match.group(1))
        
        return 1  # Default marks
    
    def save_to_json(self, output_path: str):
        """Save extracted questions to JSON database"""
        # Load existing database
        db_path = Path(output_path)
        if db_path.exists():
            try:
                with open(db_path, 'r') as f:
                    db = json.load(f)
            except json.JSONDecodeError:
                db = {"papers": []}
        else:
            db = {"papers": []}
        
        # Create paper entry
        paper_id = f"paper_{int(datetime.now().timestamp())}"
        filename = os.path.basename(self.pdf_path)
        
        # Count pages (stored during extraction)
        total_pages = getattr(self, '_page_count', 0)
        
        paper = {
            "id": paper_id,
            "filename": filename,
            "subject": self.subject,
            "grade": self.grade,
            "year": self.year,
            "uploadedAt": datetime.now().isoformat(),
            "totalPages": total_pages,
            "questions": self.questions
        }
        
        db["papers"].append(paper)
        
        # Save database
        with open(db_path, 'w') as f:
            json.dump(db, f, indent=2)
        
        print(f"\nSaved {len(self.questions)} questions to {output_path}")
        print(f"Paper ID: {paper_id}")
        return paper_id


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
    parser = argparse.ArgumentParser(description='Extract questions from PDF using Claude API Vision')
    parser.add_argument('--pdf', required=True, help='Path to PDF file')
    parser.add_argument('--subject', required=True, help='Subject name')
    parser.add_argument('--grade', required=True, help='Grade/Class')
    parser.add_argument('--year', required=True, help='Year')
    parser.add_argument('--output', default='data/question-papers.json', help='Output JSON file')
    
    args = parser.parse_args()

    if not os.path.exists(args.pdf):
        print(f"Error: PDF file not found: {args.pdf}")
        sys.exit(1)

    # Fail fast if poppler/pdf2image cannot run (clear error for API caller)
    check_poppler_available(args.pdf)

    # Create output directory if it doesn't exist
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    
    # Extract questions
    extractor = QuestionExtractor(args.pdf, args.subject, args.grade, args.year)
    extractor.questions = extractor.extract_questions_from_pdf()
    
    # Duplicate detection: skip questions >85% similar to existing for same subject+grade
    existing_texts = []
    db_path = Path(args.output)
    if db_path.exists():
        try:
            with open(db_path, "r") as f:
                db = json.load(f)
            for paper in db.get("papers", []):
                if paper.get("subject") == args.subject and paper.get("grade") == args.grade:
                    for q in paper.get("questions", []):
                        existing_texts.append(normalize_text_for_similarity(q.get("text", "")))
        except (json.JSONDecodeError, IOError):
            pass
    non_duplicates, duplicates_skipped = count_duplicates(extractor.questions, existing_texts, threshold=0.85)
    extractor.questions = non_duplicates
    if duplicates_skipped > 0:
        print(f"DUPLICATES_SKIPPED: {duplicates_skipped}")
    
    paper_id = extractor.save_to_json(args.output)
    
    print(f"\n✅ Extraction complete!")
    print(f"Paper ID: {paper_id}")
    print(f"Questions extracted: {len(extractor.questions)}")


if __name__ == "__main__":
    main()
