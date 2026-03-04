#!/usr/bin/env python3
"""
Generate a question paper PDF using reportlab.
Reads JSON from stdin: { "header": {...}, "questions": [...] }
Writes PDF to path given as first argument.
"""

import json
import sys
import os
from pathlib import Path

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
    from reportlab.lib import colors
    from reportlab.pdfgen import canvas
except ImportError:
    print("Error: Install reportlab: pip install reportlab", file=sys.stderr)
    sys.exit(1)

PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN = 15 * mm
CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN


def clean_text(s):
    if not s:
        return ""
    return " ".join(str(s).split())


def is_mcq_section(section_name):
    u = (section_name or "").upper()
    return "PART-B" in u or "SECTION-A" in u or "OBJECTIVE" in u or "MCQ" in u


def order_sections(questions_by_section):
    """PART-B (MCQ) first, then SECTION-I, SECTION-II, SECTION-III, then rest."""
    part_b = []
    section_ordered = []
    rest = []
    for name in questions_by_section.keys():
        if is_mcq_section(name):
            part_b.append(name)
        elif any(x in name.upper() for x in ("SECTION-I", "SECTION I")):
            section_ordered.append((1, name))
        elif any(x in name.upper() for x in ("SECTION-II", "SECTION II")):
            section_ordered.append((2, name))
        elif any(x in name.upper() for x in ("SECTION-III", "SECTION III")):
            section_ordered.append((3, name))
        else:
            rest.append(name)
    section_ordered.sort(key=lambda t: t[0])
    order = part_b + [n for _, n in section_ordered] + rest
    return [s for s in order if s in questions_by_section and questions_by_section[s]]


def add_footer(canvas, doc):
    canvas.saveState()
    page_num = canvas.getPageNumber()
    school = getattr(doc, "_school_name", "")
    canvas.setFont("Helvetica", 9)
    canvas.drawCentredString(PAGE_WIDTH / 2, 12 * mm, f"Page {page_num}")
    if school:
        canvas.drawCentredString(PAGE_WIDTH / 2, 8 * mm, school)
    canvas.restoreState()


def build_pdf(output_path, header, questions):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        name="CustomTitle",
        parent=styles["Heading1"],
        fontSize=16,
        alignment=1,
        spaceAfter=4,
    )
    normal_style = styles["Normal"]
    normal_style.fontSize = 10
    normal_style.spaceAfter = 6

    story = []

    # Header
    h = header or {}
    school_name = h.get("schoolName", "Divya High School")
    doc._school_name = school_name
    story.append(Paragraph(clean_text(school_name), title_style))
    story.append(Spacer(1, 3 * mm))
    if h.get("location"):
        story.append(Paragraph(clean_text(h["location"]), ParagraphStyle(name="Loc", parent=normal_style, fontSize=11, alignment=1)))
        story.append(Spacer(1, 2 * mm))
    exam_title = h.get("examTitle", "")
    if exam_title:
        story.append(Paragraph(clean_text(exam_title), ParagraphStyle(name="Exam", parent=normal_style, fontSize=12, alignment=1)))
        story.append(Spacer(1, 4 * mm))
    subject = h.get("subject", "")
    cls = h.get("class", "")
    max_marks = h.get("maxMarks", "")
    time_str = h.get("time", "")
    line2 = f"Subject: {subject}  |  Class: {cls}  |  Max. Marks: {max_marks}  |  Time: {time_str}"
    story.append(Paragraph(clean_text(line2), ParagraphStyle(name="Meta", parent=normal_style, fontSize=10, alignment=1)))
    if h.get("date"):
        story.append(Paragraph(f"Date: {h['date']}", ParagraphStyle(name="Date", parent=normal_style, fontSize=10, alignment=1)))
    story.append(Spacer(1, 6 * mm))

    # Group questions by section
    by_section = {}
    for q in questions:
        sec = q.get("section", "SECTION-A")
        if sec not in by_section:
            by_section[sec] = []
        by_section[sec].append(q)

    section_order = order_sections(by_section)

    # PART-B note at top if present
    if section_order and is_mcq_section(section_order[0]):
        story.append(Paragraph(
            "<b>PART-B (Multiple Choice) - 30 minutes - 20 marks</b>",
            ParagraphStyle(name="PartB", parent=normal_style, fontSize=11, alignment=0),
        ))
        story.append(Spacer(1, 4 * mm))

    for section_name in section_order:
        sec_questions = by_section[section_name]
        sec_marks = sum(int(q.get("marks", 1)) for q in sec_questions)

        story.append(Paragraph(
            f"<b>{section_name}</b> ({len(sec_questions)} questions, {sec_marks} marks)",
            ParagraphStyle(name="SecHead", parent=normal_style, fontSize=12),
        ))
        story.append(Spacer(1, 3 * mm))

        for i, q in enumerate(sec_questions):
            num = q.get("number", str(i + 1))
            text = clean_text(q.get("text", ""))
            marks = int(q.get("marks", 1))
            options = q.get("options") or []

            q_line = f"<b>Q{num}.</b> [{marks} mark(s)]"
            story.append(Paragraph(q_line, normal_style))
            story.append(Paragraph(text, normal_style))

            if options:
                opts_text = "  ".join(f"{chr(65+j)}) {clean_text(opt)}" for j, opt in enumerate(options))
                story.append(Paragraph(opts_text, ParagraphStyle(name="Opt", parent=normal_style, fontSize=9, leftIndent=10)))
                bubbles = "  ".join("(  )" for _ in options)
                story.append(Paragraph(f"Answer: {bubbles}", ParagraphStyle(name="Bubbles", parent=normal_style, fontSize=9, leftIndent=10)))

            story.append(Spacer(1, 4 * mm))

        story.append(Spacer(1, 4 * mm))

    doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
    with open(output_path, "rb") as f:
        total_pages = f.read().count(b"/Type /Page")
    return output_path, total_pages


def add_page_numbers_with_total(pdf_path, total_pages):
    """Overlay 'Page X of Y' and school name on each page."""
    try:
        from pypdf import PdfReader, PdfWriter
        from reportlab.pdfgen import canvas
        from io import BytesIO
        reader = PdfReader(pdf_path)
        school = getattr(build_pdf, "_school_name", "")
        writer = PdfWriter()
        for i, page in enumerate(reader.pages):
            packet = BytesIO()
            c = canvas.Canvas(packet, pagesize=A4)
            c.setFont("Helvetica", 9)
            c.drawCentredString(PAGE_WIDTH / 2, 12 * mm, f"Page {i + 1} of {total_pages}")
            if school:
                c.drawCentredString(PAGE_WIDTH / 2, 8 * mm, school)
            c.save()
            packet.seek(0)
            from pypdf import PdfReader as PR
            overlay = PR(packet)
            page.merge_page(overlay.pages[0])
            writer.add_page(page)
        with open(pdf_path, "wb") as f:
            writer.write(f)
    except Exception as e:
        print(f"Warning: Could not add page total to footer: {e}", file=sys.stderr)


def main():
    if len(sys.argv) < 2:
        print("Usage: generate_paper_pdf.py <output_path>", file=sys.stderr)
        sys.exit(1)
    output_path = sys.argv[1]
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Invalid JSON: {e}", file=sys.stderr)
        sys.exit(1)
    header = payload.get("header", {})
    questions = payload.get("questions", [])
    if not questions:
        print("No questions provided", file=sys.stderr)
        sys.exit(1)
    build_pdf._school_name = header.get("schoolName", "Divya High School")
    out_path, total_pages = build_pdf(output_path, header, questions)
    add_page_numbers_with_total(out_path, total_pages)
    print(out_path)


if __name__ == "__main__":
    main()
