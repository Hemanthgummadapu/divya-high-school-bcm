#!/usr/bin/env python3
"""Generate and render Phase 2E JK-82 fixture PDFs without live services."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "scripts" / "fixtures" / "paper-pdf"
GENERATOR = ROOT / "scripts" / "generate_jk82_pdf.py"


def python_cmd() -> str:
    venv = ROOT / "venv" / "bin" / "python3"
    return str(venv) if venv.exists() else sys.executable


def generate(name: str, payload: dict) -> Path:
    work = Path(tempfile.mkdtemp(prefix=f"qb-fix-{name}-"))
    try:
        payload_path = work / "paper.json"
        payload_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        result = subprocess.run(
            [
                python_cmd(),
                str(GENERATOR),
                "--input",
                str(payload_path),
                "--output",
                str(work / "paper.pdf"),
                "--work-dir",
                str(work),
            ],
            cwd=ROOT,
            capture_output=True,
            timeout=60,
            check=False,
        )
        if result.returncode != 0:
            raise SystemExit(f"{name} failed: {result.stderr.decode('utf-8', 'replace')}")
        OUT.mkdir(parents=True, exist_ok=True)
        pdf_path = OUT / f"{name}.pdf"
        shutil.copyfile(work / "paper.pdf", pdf_path)
        return pdf_path
    finally:
        shutil.rmtree(work, ignore_errors=True)


def render(pdf_path: Path) -> list[Path]:
    from pdf2image import convert_from_path

    images = convert_from_path(str(pdf_path), dpi=110)
    written = []
    for index, image in enumerate(images, start=1):
        dest = pdf_path.with_name(f"{pdf_path.stem}-page-{index}.png")
        image.save(dest)
        written.append(dest)
    return written


def header(**extra):
    base = {
        "examCode": "JK-82",
        "examTitle": "PRE-FINAL EXAMINATIONS, FEBRUARY - 2026",
        "subject": "Mathematics",
        "class": "X",
        "maxMarks": "20",
        "time": "3.00 Hrs",
        "academicYear": "2026",
        "schoolName": "Divya High School",
        "location": "Bhadrachalam",
    }
    base.update(extra)
    return base


def main() -> int:
    fixtures = {
        "english-mcq": {
            "header": header(),
            "sections": [
                {
                    "title": "SECTION-I",
                    "instructions": "Answer all questions",
                    "questions": [
                        {
                            "number": "1",
                            "text": "The value of sin 90 is",
                            "options": [
                                {"label": "A", "text": "0"},
                                {"label": "B", "text": "1"},
                                {"label": "C", "text": "-1"},
                                {"label": "D", "text": "2"},
                            ],
                            "marks": 1,
                            "type": "MCQ",
                            "diagramStatus": "none",
                        }
                    ],
                }
            ],
        },
        "telugu-mixed": {
            "header": header(subject="Telugu"),
            "sections": [
                {
                    "title": "SECTION-I",
                    "instructions": "Answer all questions",
                    "questions": [
                        {
                            "number": "1",
                            "text": "Explain the area of a triangle. Telugu: triangle area.",
                            "options": [],
                            "marks": 4,
                            "type": "Medium",
                            "diagramStatus": "unavailable",
                        }
                    ],
                }
            ],
        },
        "long-multi-section": {
            "header": header(maxMarks="40"),
            "sections": [
                {
                    "title": "SECTION-I",
                    "instructions": "Answer all",
                    "questions": [
                        {
                            "number": str(index),
                            "text": "A long English question about coordinate geometry. " * 8,
                            "options": [],
                            "marks": 4,
                            "type": "Long",
                            "diagramStatus": "none",
                        }
                        for index in range(1, 6)
                    ],
                },
                {
                    "title": "SECTION-II",
                    "instructions": "Answer any two",
                    "questions": [
                        {
                            "number": "6",
                            "text": "Prove that root 2 is irrational.",
                            "options": [],
                            "marks": 6,
                            "type": "Long",
                            "diagramStatus": "none",
                        }
                    ],
                },
            ],
        },
    }

    # Keep Telugu in a separate assignment so this file stays valid ASCII-plus-unicode.
    fixtures["telugu-mixed"]["header"]["examTitle"] = "Telugu question paper"
    fixtures["telugu-mixed"]["sections"][0]["title"] = "\u0c35\u0c3f\u0c2d\u0c3e\u0c17\u0c02-I"
    fixtures["telugu-mixed"]["sections"][0]["instructions"] = (
        "\u0c05\u0c28\u0c4d\u0c28\u0c3f \u0c2a\u0c4d\u0c30\u0c36\u0c4d\u0c28\u0c32\u0c15\u0c41 \u0c38\u0c2e\u0c3e\u0c27\u0c3e\u0c28\u0c02 \u0c30\u0c3e\u0c2f\u0c02\u0c21\u0c3f"
    )
    fixtures["telugu-mixed"]["sections"][0]["questions"][0]["text"] = (
        "\u0c24\u0c4d\u0c30\u0c3f\u0c2d\u0c41\u0c1c\u0c02 \u0c2f\u0c4a\u0c15\u0c4d\u0c15 \u0c35\u0c48\u0c36\u0c3e\u0c32\u0c4d\u0c2f\u0c02 \u0c0e\u0c02\u0c24? "
        "Explain the area of a triangle."
    )

    rendered = []
    for name, payload in fixtures.items():
        pdf_path = generate(name, payload)
        assert pdf_path.read_bytes()[:5] == b"%PDF-"
        pages = render(pdf_path)
        assert pages, f"{name} produced no pages"
        rendered.extend(pages)
        print(f"{name}: {pdf_path.name} -> {len(pages)} page(s)")
    print(f"rendered {len(rendered)} page images in {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
