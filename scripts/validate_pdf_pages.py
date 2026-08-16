#!/usr/bin/env python3
"""Parse a PDF with pypdf and enforce the page cap before OCR starts."""

import argparse
import os
import sys

try:
    from pypdf import PdfReader
except ImportError:
    print("Error: pypdf is required", file=sys.stderr)
    sys.exit(1)


def bounded_max_pages(value: str) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = 20
    return max(1, min(parsed, 100))


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate PDF page count")
    parser.add_argument("--pdf", required=True)
    parser.add_argument("--max-pages", default=os.getenv("QUESTION_PAPER_MAX_PDF_PAGES", "20"))
    args = parser.parse_args()

    max_pages = bounded_max_pages(args.max_pages)
    try:
        page_count = len(PdfReader(args.pdf).pages)
    except Exception:
        print("Error: PDF could not be parsed", file=sys.stderr)
        return 1

    if page_count <= 0:
        print("Error: Could not determine PDF page count", file=sys.stderr)
        return 1
    if page_count > max_pages:
        print(f"Error: PDF exceeds the {max_pages}-page processing limit", file=sys.stderr)
        return 1

    print(page_count)
    return 0


if __name__ == "__main__":
    sys.exit(main())
