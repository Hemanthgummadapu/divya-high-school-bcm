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
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any
import uuid
import hashlib
from io import BytesIO

try:
    from pdf2image import convert_from_path
    from PIL import Image
    from anthropic import Anthropic
    from dotenv import load_dotenv
except ImportError as e:
    print(f"Error: Missing required package. Install with: pip install pdf2image pillow anthropic python-dotenv")
    sys.exit(1)

# Load environment variables
load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env.local")

# Cache directory for processed pages
CACHE_DIR = Path("data/ocr_cache")
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Claude API prompt
CLAUDE_PROMPT = """You are extracting questions from an Indian school exam paper image.
Extract ALL content EXACTLY as it appears - every word, every option, every mark.
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
Return ONLY valid JSON, nothing else."""


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
    """Extract questions from a page image using Claude API"""
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
        
        # Try to find JSON in the response (in case there's extra text)
        json_start = response_text.find('{')
        json_end = response_text.rfind('}') + 1
        
        if json_start >= 0 and json_end > json_start:
            json_str = response_text[json_start:json_end]
            result = json.loads(json_str)
            return result
        else:
            print(f"Warning: No valid JSON found in Claude response for page {page_num}")
            return {"section": "SECTION-A", "questions": []}
            
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON from Claude for page {page_num}: {e}")
        print(f"Response was: {response_text[:200]}...")
        return {"section": "SECTION-A", "questions": []}
    except Exception as e:
        print(f"Error calling Claude API for page {page_num}: {e}")
        return {"section": "SECTION-A", "questions": []}


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
            print("Error: ANTHROPIC_API_KEY not found in .env.local")
            print("Please add ANTHROPIC_API_KEY=your_key_here to .env.local")
            sys.exit(1)
        
        self.claude_client = Anthropic(api_key=api_key)
        
    def _get_total_pages(self) -> int:
        """Get total number of pages in PDF"""
        try:
            # Convert all pages with low DPI to count
            all_images = convert_from_path(self.pdf_path, dpi=100)
            return len(all_images)
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
            
            # Process in batches of 5 pages
            batch_size = 5
            batch_delay = 1.0  # 1 second delay between batches
            
            for batch_start in range(1, total_pages + 1, batch_size):
                batch_end = min(batch_start + batch_size - 1, total_pages)
                print(f"\nProcessing batch: pages {batch_start}-{batch_end} of {total_pages}")
                
                # Convert batch to images
                batch_images = convert_from_path(
                    self.pdf_path,
                    dpi=300,
                    first_page=batch_start,
                    last_page=batch_end
                )
                
                # Process each page in the batch
                for i, image in enumerate(batch_images):
                    page_num = batch_start + i
                    page_hash = get_page_hash(self.pdf_path, page_num)
                    
                    print(f"Processing page {page_num} of {total_pages}...", end="\r")
                    
                    # Check cache
                    cached_result = get_cached_result(page_hash)
                    if cached_result:
                        cached_count += 1
                        questions = cached_result.get("questions", [])
                        section = cached_result.get("section", "SECTION-A")
                    else:
                        # Convert image to base64
                        image_base64 = image_to_base64(image)
                        
                        # Extract with Claude
                        result = extract_with_claude(self.claude_client, image_base64, page_num)
                        
                        # Save to cache
                        save_cached_result(page_hash, result)
                        
                        questions = result.get("questions", [])
                        section = result.get("section", "SECTION-A")
                    
                    # Add questions with section info
                    for q in questions:
                        q["section"] = section
                        q["id"] = f"q_{uuid.uuid4().hex[:12]}"
                        # Ensure type is one of the expected values
                        if "type" not in q or q["type"] not in ["MCQ", "Short", "Long"]:
                            # Auto-detect type
                            q["type"] = self.detect_question_type(q.get("text", ""))
                        # Ensure marks is a number
                        if "marks" not in q:
                            q["marks"] = self.extract_marks(q.get("text", ""))
                        # Ensure options is a list
                        if "options" not in q:
                            q["options"] = []
                    
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
            print(f"\n✅ Completed extraction on {processed_count} pages in {int(total_time//60)}m {int(total_time%60)}s")
            print(f"   Average speed: {total_pages/total_time:.2f} pages/sec")
            print(f"   Cached pages: {cached_count} (skipped API calls)")
            print(f"   Total questions extracted: {len(all_questions)}")
            
            return all_questions
            
        except Exception as e:
            print(f"Error during PDF processing: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)
    
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
    
    # Create output directory if it doesn't exist
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    
    # Extract questions
    extractor = QuestionExtractor(args.pdf, args.subject, args.grade, args.year)
    extractor.questions = extractor.extract_questions_from_pdf()
    paper_id = extractor.save_to_json(args.output)
    
    print(f"\n✅ Extraction complete!")
    print(f"Paper ID: {paper_id}")
    print(f"Questions extracted: {len(extractor.questions)}")


if __name__ == "__main__":
    main()
