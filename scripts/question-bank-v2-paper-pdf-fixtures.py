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


SYMBOL_TEXT = (
    "In △ABC, ∠B = 90° and PQ ∥ ST with RS ⊥ PQ. "
    "Given θ ≤ 45° and r ≥ 3.5 cm, evaluate "
    "√144 × ½ ÷ π ± 2² − 3³, where h₁ = 12 and a₂ ≠ 7."
)

LONG_SOURCE_NAME = (
    "Class 10 Mathematics Pre-Final Examination Second Revision Paper 2026"
)


def make_diagram_png(path: Path) -> Path:
    """Write a small synthetic PNG used as a fixture question diagram."""
    from PIL import Image, ImageDraw

    image = Image.new("RGB", (420, 300), "white")
    draw = ImageDraw.Draw(image)
    draw.line((40, 260, 380, 260), fill=(30, 58, 138), width=3)
    draw.line((40, 260, 40, 40), fill=(30, 58, 138), width=3)
    draw.polygon([(80, 250), (300, 250), (300, 110)], outline=(200, 60, 60))
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG")
    return path


def question(number, text, marks, qtype, **extra):
    item = {
        "number": str(number),
        "text": text,
        "options": extra.pop("options", []),
        "marks": marks,
        "type": qtype,
        "diagramStatus": extra.pop("diagramStatus", "none"),
    }
    item.update(extra)
    return item


def mcq_options(values):
    return [
        {"label": label, "text": text}
        for label, text in zip(["A", "B", "C", "D"], values)
    ]


def main() -> int:
    diagram_png = make_diagram_png(OUT / "_fixture-diagram.png")
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

    # Mathematics MCQ carrying triangle, parallel, fraction and root symbols.
    fixtures["math-symbols-mcq"] = {
        "header": header(maxMarks="10"),
        "sections": [
            {
                "title": "SECTION-A",
                "instructions": "Answer all questions. Each question carries 1 mark.",
                "questions": [
                    question(
                        1,
                        "In △ABC, if AB ∥ CD and ∠B = 90°, the value of √144 × ½ is:",
                        1,
                        "MCQ",
                        options=mcq_options(["6", "12", "θ = 45°", "None of these"]),
                    ),
                    question(
                        2,
                        "Which expression equals ¾ ± ⅓ × π when θ ≥ 30° and r ≤ 7?",
                        1,
                        "MCQ",
                        options=mcq_options(["2² ÷ 4", "3³ − 27", "a₁ + a₂", "√49 ≠ 7"]),
                    ),
                ],
            }
        ],
    }

    # Geometry question with a real extracted diagram crop.
    fixtures["geometry-extracted-diagram"] = {
        "header": header(maxMarks="8"),
        "sections": [
            {
                "title": "SECTION-B",
                "instructions": "Answer the following. The figure is part of the question.",
                "questions": [
                    question(
                        1,
                        "From the figure, prove that △PQR is right-angled at Q and find PR when PQ = 6 cm and QR = 8 cm.",
                        4,
                        "Medium",
                        diagramStatus="ok",
                        diagramPath=str(diagram_png),
                    ),
                    question(
                        2,
                        "State the Pythagorean relation a² + b² = c² for the figure above.",
                        4,
                        "Medium",
                    ),
                ],
            }
        ],
    }

    # Manually attached PNG behaves the same as an extracted crop.
    fixtures["manual-diagram"] = {
        "header": header(maxMarks="4"),
        "sections": [
            {
                "title": "SECTION-B",
                "instructions": "Study the diagram and answer.",
                "questions": [
                    question(
                        1,
                        "The diagram was drawn during review. Identify the vertex of the graph y = x² − 4.",
                        4,
                        "Medium",
                        diagramStatus="ok",
                        diagramPath=str(diagram_png),
                    )
                ],
            }
        ],
    }

    # A missing or corrupt diagram must degrade safely, not break the paper.
    fixtures["missing-diagram-fallback"] = {
        "header": header(maxMarks="8"),
        "sections": [
            {
                "title": "SECTION-B",
                "instructions": "Answer all questions.",
                "questions": [
                    question(
                        1,
                        "Interpret the printed figure and state the value of ∠XYZ.",
                        4,
                        "Medium",
                        diagramStatus="unavailable",
                    ),
                    question(
                        2,
                        "This question has no figure and must still render normally: evaluate 7 ÷ 2 ≠ 3.",
                        4,
                        "Medium",
                    ),
                ],
            }
        ],
    }

    # All four sections, non-empty, with symbols in every question type.
    fixtures["sections-a-to-d"] = {
        "header": header(maxMarks="35"),
        "sections": [
            {
                "title": "Section A — MCQ",
                "instructions": "Choose the correct answer. 1 mark each.",
                "questions": [
                    question(
                        1,
                        "The value of √49 ± 2 is:",
                        1,
                        "MCQ",
                        options=mcq_options(["5 or 9", "7 only", "±7", "None"]),
                    )
                ],
            },
            {
                "title": "Section B — Short Answer",
                "instructions": "Answer any two questions. 2 marks each.",
                "questions": [
                    question(
                        2,
                        "Solve for x: 3x + ½ = 12¼ and verify that x ≠ 4.",
                        2,
                        "Short",
                    )
                ],
            },
            {
                "title": "Section C — Medium Answer",
                "instructions": "Answer in about 100 words. 4 marks each.",
                "questions": [
                    question(3, SYMBOL_TEXT, 4, "Medium"),
                ],
            },
            {
                "title": "Section D — Long Answer",
                "instructions": "Answer in detail. 8 marks each.",
                "questions": [
                    question(
                        4,
                        "A solid consists of a cone of height h₁ = 12 cm on a hemisphere of radius r = 3.5 cm. "
                        "Using V = ⅓πr²h₁ + ⅔πr³, find the total volume correct to ±0.01 cm³. "
                        "Show every step of the working and state the units clearly at each stage. " * 2,
                        8,
                        "Long",
                    )
                ],
            },
        ],
    }

    # Long content that pushes a section heading toward a page boundary.
    fixtures["page-break-section-heading"] = {
        "header": header(maxMarks="60"),
        "sections": [
            {
                "title": "SECTION-I",
                "instructions": "Answer all questions.",
                "questions": [
                    question(
                        index,
                        f"Question {index}: " + SYMBOL_TEXT + " Explain each step fully. " * 3,
                        6,
                        "Long",
                    )
                    for index in range(1, 7)
                ],
            },
            {
                "title": "SECTION-II",
                "instructions": "This heading must not be orphaned at the foot of a page.",
                "questions": [
                    question(
                        7,
                        "Prove that √2 is irrational and hence show that 3 + √2 is irrational.",
                        6,
                        "Long",
                    ),
                    question(
                        8,
                        "Construct a triangle △ABC with ∠A = 60°, AB = 6 cm and AC ≥ 5 cm.",
                        6,
                        "Long",
                    ),
                ],
            },
        ],
    }

    rendered = []
    for name, payload in fixtures.items():
        pdf_path = generate(name, payload)
        assert pdf_path.read_bytes()[:5] == b"%PDF-"
        pages = render(pdf_path)
        assert pages, f"{name} produced no pages"
        text = extract_pdf_text(pdf_path)
        check_paper_text(name, payload, text, embedded_font_names(pdf_path))
        rendered.extend(pages)
        print(f"{name}: {pdf_path.name} -> {len(pages)} page(s)")
    print(f"rendered {len(rendered)} page images in {OUT}")
    return 0


def extract_pdf_text(pdf_path: Path) -> str:
    from pypdf import PdfReader

    return "\n".join(page.extract_text() or "" for page in PdfReader(str(pdf_path)).pages)


def is_fallback_char(char: str) -> bool:
    """True for characters drawn from the math, symbol or Telugu fallback
    fonts. ReportLab's subset fonts carry no usable ToUnicode map for these,
    so they render correctly but extract as NUL. Their presence is proven by
    font embedding and by the rendered page images instead."""
    code = ord(char)
    return (
        0x2200 <= code <= 0x22FF
        or 0x2A00 <= code <= 0x2AFF
        or 0x25A0 <= code <= 0x25FF
        or 0x0C00 <= code <= 0x0C7F
    )


def comparable(value: str) -> str:
    """Normalize text for containment checks across the extraction gap."""
    without_fallback = "".join(
        "" if char == "\x00" or is_fallback_char(char) else char for char in value
    )
    return " ".join(without_fallback.split())


def embedded_font_names(pdf_path: Path) -> set[str]:
    from pypdf import PdfReader

    names = set()
    for page in PdfReader(str(pdf_path)).pages:
        fonts = (page.get("/Resources") or {}).get("/Font") or {}
        for value in fonts.values():
            base = value.get_object().get("/BaseFont")
            if base:
                names.add(str(base).split("+")[-1])
    return names


def check_paper_text(name: str, payload: dict, text: str, fonts: set[str]) -> None:
    """Assert the generated paper prints what it must and nothing it must not."""
    normalized = comparable(text)
    header_values = payload["header"]
    for required in (
        header_values["schoolName"],
        header_values["subject"],
        header_values["time"],
    ):
        assert required in normalized, f"{name}: missing header value {required!r}"

    total_marks = 0
    for section in payload["sections"]:
        title = comparable(section["title"])
        if title:
            assert title in normalized, f"{name}: missing section {section['title']!r}"
        instructions = comparable(section.get("instructions") or "")[:24]
        if instructions:
            assert instructions in normalized, (
                f"{name}: missing instructions for {section['title']!r}"
            )
        for item in section["questions"]:
            total_marks += int(item["marks"])
            opening = comparable(item["text"])[:28]
            if opening:
                assert opening in normalized, f"{name}: missing question text {opening!r}"
            for option in item.get("options", []):
                option_text = comparable(option["text"])
                if option_text:
                    assert option_text in normalized, (
                        f"{name}: missing MCQ option {option['text']!r}"
                    )
            if item.get("diagramStatus") == "unavailable":
                assert "[Diagram unavailable]" in normalized, (
                    f"{name}: expected the safe diagram fallback"
                )
            if item.get("diagramStatus") == "ok":
                assert "[Diagram unavailable]" not in normalized, (
                    f"{name}: a valid diagram must not print the fallback"
                )

    assert total_marks > 0, f"{name}: fixture has no marks"

    # Symbols that live in NotoSans extract normally and must be present.
    payload_text = json.dumps(payload, ensure_ascii=False)
    for symbol in ("°", "±", "×", "÷", "θ", "π", "²", "½"):
        if symbol in payload_text:
            assert symbol in text, f"{name}: symbol {symbol} was lost in the PDF"

    # Symbols outside NotoSans are proven by the fallback font being embedded:
    # without it they would silently render as blanks.
    needs_math = any(
        0x2200 <= ord(char) <= 0x22FF or 0x2A00 <= ord(char) <= 0x2AFF
        for char in payload_text
    )
    needs_symbols = any(0x25A0 <= ord(char) <= 0x25FF for char in payload_text)
    needs_telugu = any(0x0C00 <= ord(char) <= 0x0C7F for char in payload_text)
    if needs_math:
        assert "NotoSansMath-Regular" in fonts, (
            f"{name}: math symbols present but NotoSansMath was not embedded"
        )
    if needs_symbols:
        assert "NotoSansSymbols2-Regular" in fonts, (
            f"{name}: geometric shapes present but NotoSansSymbols2 was not embedded"
        )
    if needs_telugu:
        assert "NotoSansTelugu-Regular" in fonts, (
            f"{name}: Telugu present but NotoSansTelugu was not embedded"
        )

    # Internal identifiers and source-paper names never belong on the paper.
    forbidden = [
        LONG_SOURCE_NAME,
        "source-pdfs/",
        "diagrams/",
        "generated-papers/",
        "review_status",
        "approved",
        "rawExtractedText",
        "bank_question_id",
    ]
    for value in forbidden:
        assert value not in normalized, f"{name}: leaked {value!r} into the paper"


if __name__ == "__main__":
    raise SystemExit(main())
