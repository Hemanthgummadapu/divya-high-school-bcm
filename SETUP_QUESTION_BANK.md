# PDF Question Bank Setup Guide

## Prerequisites

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 2. Install System Dependencies

#### macOS:
```bash
brew install poppler
```

#### Linux (Ubuntu/Debian):
```bash
sudo apt-get update
sudo apt-get install poppler-utils
```

#### Windows:
- Download Poppler from: https://github.com/oschwartz10612/poppler-windows/releases
- Add to your system PATH

### 3. Set Up Anthropic API Key

1. Get your API key from: https://console.anthropic.com/
2. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```
3. Edit `.env.local` and add your API key:
   ```
   ANTHROPIC_API_KEY=sk-ant-api03-...
   ```

### 4. Verify Installation

```bash
python3 --version
pdftoppm -h
```

## Usage

### Manual PDF Extraction

```bash
python3 scripts/extract_pdf.py \
  --pdf path/to/your/file.pdf \
  --subject "Mathematics" \
  --grade "10" \
  --year "2026" \
  --output data/question-papers.json
```

**Note:** The script uses Claude API Vision for high-quality extraction from scanned images. Processing happens in batches of 5 pages with 1-second delays to respect API rate limits.

### Via Web UI

1. Navigate to `/academics/question-papers`
2. Fill in Subject, Grade, and Year
3. Select a PDF file
4. Click "Upload & Extract Questions"
5. Wait for OCR processing (progress bar will show status)

## File Structure

```
divya-high-school-bcm/
├── scripts/
│   └── extract_pdf.py          # OCR extraction script
├── data/
│   └── question-papers.json   # JSON database
├── uploads/                    # Temporary PDF storage (auto-created)
└── src/
    ├── app/
    │   ├── api/
    │   │   └── question-papers/
    │   │       ├── route.ts           # GET/POST all papers
    │   │       ├── [id]/route.ts      # GET/DELETE single paper
    │   │       └── generate/route.ts  # Generate paper from selected questions
    │   └── academics/
    │       └── question-papers/
    │           └── page.tsx    # Main UI page
    └── lib/
        └── questionPapers.ts   # Database utilities
```

## API Endpoints

### GET `/api/question-papers`
Get all papers with optional filters:
- `?subject=Mathematics`
- `?grade=10`
- `?year=2026`
- `?type=MCQ`
- `?section=SECTION-A`

### POST `/api/question-papers`
Upload and process a PDF:
- Form data: `file`, `subject`, `grade`, `year`
- Returns: Paper object with extracted questions

### GET `/api/question-papers/[id]`
Get a single paper by ID

### DELETE `/api/question-papers/[id]`
Delete a paper

### POST `/api/question-papers/generate`
Generate a paper from selected questions:
- Body: `{ "questionIds": ["q1", "q2", ...] }`
- Returns: Generated paper with grouped questions

## Database Schema

```json
{
  "papers": [{
    "id": "paper_timestamp",
    "filename": "Maths_2026.pdf",
    "subject": "Mathematics",
    "grade": "10",
    "year": "2026",
    "uploadedAt": "2026-01-15T10:30:00",
    "totalPages": 295,
    "questions": [{
      "id": "q_unique_id",
      "number": "1",
      "text": "Which of the following is irrational?",
      "options": ["log₂10", "log₂2", "log₂0", "log₁0"],
      "section": "SECTION-A",
      "type": "MCQ",
      "marks": 1
    }]
  }]
}
```

## Features

- ✅ PDF upload with drag & drop
- ✅ **Claude API Vision**: High-quality extraction from scanned mobile camera photos
- ✅ **Batch processing**: Processes 5 pages at a time with API rate limiting
- ✅ **Smart caching**: Skips API calls on already-processed pages
- ✅ **Progress tracking**: Real-time pages/sec, ETA, and percentage
- ✅ **Accurate extraction**: Claude API provides better accuracy than traditional OCR
- ✅ Automatic question detection and parsing
- ✅ Filter by subject, grade, year, type, section
- ✅ Question selection with checkboxes
- ✅ Generate custom papers from selected questions
- ✅ Printable paper preview
- ✅ Statistics dashboard
- ✅ Delete papers
- ✅ Export to JSON and CSV

## Troubleshooting

### Claude API Not Working
- Ensure `ANTHROPIC_API_KEY` is set in `.env.local`
- Check API key is valid: https://console.anthropic.com/
- Verify Python packages: `pip list | grep -E "pdf2image|anthropic|python-dotenv"`
- Check API rate limits if processing many pages

### Poppler Not Found
- macOS: `brew install poppler`
- Linux: `sudo apt-get install poppler-utils`
- Windows: Add poppler bin directory to PATH

### Permission Errors
- Ensure `data/` and `uploads/` directories are writable
- Check file permissions: `chmod 755 scripts/extract_pdf.py`

### Large PDFs (295 pages)
- **Claude API Vision**: High-quality extraction from poor quality scanned images
- **Batch processing**: Processes 5 pages at a time with 1-second delays
- **Caching**: Re-uploading the same PDF skips API calls on cached pages
- **Progress tracking**: Shows pages/sec, ETA, and completion percentage
- Processing time: ~10-20 minutes for 295 pages (depends on API response time)
- API costs: Check Anthropic pricing at https://www.anthropic.com/pricing

## Notes

- OCR accuracy depends on PDF quality
- Scanned images work best with 300+ DPI
- Question patterns are detected automatically
- Manual review recommended for extracted questions

