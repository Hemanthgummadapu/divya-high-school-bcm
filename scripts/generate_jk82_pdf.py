#!/usr/bin/env python3
"""
JK-82 style Indian school exam paper PDF generator.
Reads JSON from stdin: { "header": {...}, "questions": [...], "logoPath": "/path/to/logo.png" }
Outputs PDF bytes to stdout (binary).
Layout: Page 1 PART-A (SECTION-I, II, III), then PART-B (Objective) at the end.
Logo: watermark on every page (8%), header logo 60x60 on page 1.
Helvetica only, A4 portrait, 1.8cm margins.
"""

import json
import sys
import re
import os
from io import BytesIO

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm, mm
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen import canvas
except ImportError:
    print("Error: Install reportlab: pip install reportlab", file=sys.stderr)
    sys.exit(1)

# Layout
MARGIN = 1.8 * cm
PAGE_WIDTH, PAGE_HEIGHT = A4
CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN
CONTENT_LEFT = MARGIN
CONTENT_RIGHT = PAGE_WIDTH - MARGIN
FOOTER_Y = 15 * mm
TURN_OVER_Y = 12 * mm

# Font sizes
FONT_TITLE = 14
FONT_SUB = 11
FONT_BODY = 10
FONT_SMALL = 9


def clean(s):
    if s is None:
        return ""
    return " ".join(str(s).split())


def wrap_text(c, text, width, font="Helvetica", size=FONT_BODY):
    """Return list of lines that fit in width."""
    c.setFont(font, size)
    words = re.split(r"\s+", clean(text))
    lines = []
    current = []
    current_width = 0
    for w in words:
        w_width = c.stringWidth(" " + w if current else w, font, size)
        if current_width + w_width <= width and (current or True):
            current.append(w)
            current_width += w_width
        else:
            if current:
                lines.append(" ".join(current))
            current = [w]
            current_width = c.stringWidth(w, font, size)
    if current:
        lines.append(" ".join(current))
    return lines


def is_mcq_section(name):
    u = (name or "").upper()
    return "PART-B" in u or "SECTION-A" in u or "OBJECTIVE" in u or "MCQ" in u


def group_questions(questions):
    by_section = {}
    for q in questions:
        sec = q.get("section", "SECTION-A")
        if sec not in by_section:
            by_section[sec] = []
        by_section[sec].append(q)
    part_b = []
    sec_i, sec_ii, sec_iii = [], [], []
    rest = []
    for name, qs in by_section.items():
        if is_mcq_section(name):
            part_b.extend(qs)
        elif "SECTION-I" in name.upper() or "SECTION I" in name.upper():
            sec_i = qs
        elif "SECTION-II" in name.upper() or "SECTION II" in name.upper():
            sec_ii = qs
        elif "SECTION-III" in name.upper() or "SECTION III" in name.upper():
            sec_iii = qs
        else:
            rest.append((name, qs))
    return part_b, sec_i, sec_ii, sec_iii, rest


def draw_line(c, y, left=None, right=None):
    left = left or CONTENT_LEFT
    right = right or CONTENT_RIGHT
    c.line(left, y, right, y)


def draw_footer(c, page_num, total_pages, school_name, date_str, is_last):
    c.setFont("Helvetica", FONT_SMALL)
    c.drawString(CONTENT_LEFT, FOOTER_Y, school_name or "")
    c.drawCentredString(PAGE_WIDTH / 2, FOOTER_Y, f"Page {page_num} of {total_pages}")
    c.drawRightString(CONTENT_RIGHT, FOOTER_Y, date_str or "")
    if is_last:
        c.drawCentredString(PAGE_WIDTH / 2, TURN_OVER_Y, "\u2726   \u2726   \u2726")
    else:
        c.drawRightString(CONTENT_RIGHT, TURN_OVER_Y, "[ Turn Over ]")


def draw_watermark(c, logo_path):
    if not logo_path or not os.path.isfile(logo_path):
        return
    try:
        from PIL import Image as PILImage
        img_pil = PILImage.open(logo_path).convert("RGBA")
        w, h = img_pil.size
        pixels = img_pil.load()
        for i in range(w):
            for j in range(h):
                r, g, b, a = pixels[i, j]
                pixels[i, j] = (r, g, b, int(a * 0.08))
        background = PILImage.new("RGBA", (w, h), (255, 255, 255, 255))
        img_pil = PILImage.alpha_composite(background, img_pil)
        buf = BytesIO()
        img_pil.save(buf, format="PNG")
        buf.seek(0)
        img = ImageReader(buf)
        size = 280
        x = (PAGE_WIDTH - size) / 2
        y = (PAGE_HEIGHT - size) / 2
        c.drawImage(img, x, y, width=size, height=size, preserveAspectRatio=True, mask="auto")
    except Exception:
        pass


def draw_header_with_logo(c, logo_path, school_name, location, exam_title, subject, class_str, max_marks, time_str):
    """Draw logo 60x60 top-left and 4 lines centered to the right. Returns y position below header."""
    logo_size = 60
    y_top = PAGE_HEIGHT - MARGIN
    if logo_path and os.path.isfile(logo_path):
        try:
            img = ImageReader(logo_path)
            c.drawImage(img, CONTENT_LEFT, y_top - logo_size, width=logo_size, height=logo_size, preserveAspectRatio=True, mask="auto")
        except Exception:
            pass
    text_center_x = (CONTENT_LEFT + logo_size + CONTENT_RIGHT) / 2
    lead = 5 * mm
    y = y_top - 4
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(text_center_x, y, school_name or "DIVYA HIGH SCHOOL BCM")
    y -= lead
    c.setFont("Helvetica", 10)
    c.drawCentredString(text_center_x, y, location or "Bhadrachalam")
    y -= lead
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(text_center_x, y, exam_title or "PRE-FINAL EXAMINATIONS")
    y -= lead
    c.setFont("Helvetica", 10)
    c.drawCentredString(text_center_x, y, subject or "MATHEMATICS (English Version)")
    y -= 3 * mm
    c.drawCentredString(text_center_x, y, f"Class: {class_str}    Max.Marks: {max_marks}    Time: {time_str}")
    y -= lead
    draw_line(c, y)
    return y - lead


def main():
    part_a_questions = []
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Invalid JSON: {e}", file=sys.stderr)
        sys.exit(1)
    header = payload.get("header", {}) or {}
    questions = payload.get("questions", [])
    logo_path = payload.get("logoPath") or None
    if logo_path and not os.path.isfile(logo_path):
        logo_path = None
    if not questions:
        print("No questions provided", file=sys.stderr)
        sys.exit(1)

    part_b, sec_i, sec_ii, sec_iii, rest = group_questions(questions)
    exam_code = header.get("examCode", "JK-82")
    exam_title = clean(header.get("examTitle", "PRE-FINAL EXAMINATIONS, FEBRUARY - 2026"))
    subject = clean(header.get("subject", "MATHEMATICS (English Version)"))
    class_str = clean(header.get("class", "X"))
    max_marks = clean(header.get("maxMarks", "80"))
    time_str = clean(header.get("time", "3.00 Hrs"))
    date_str = clean(header.get("date", ""))
    school_name = clean(header.get("schoolName", "Divya High School"))

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    c.setFont("Helvetica", FONT_BODY)
    line_height = 5 * mm
    lead = 6 * mm
    y = PAGE_HEIGHT - MARGIN
    total_pages = 1

    def new_page():
        nonlocal y, total_pages
        c.showPage()
        total_pages += 1
        draw_watermark(c, logo_path)
        y = PAGE_HEIGHT - MARGIN

    # ---------- PAGE 1: Watermark, then header (logo+text or text-only), then PART-A then PART-B ----------
    draw_watermark(c, logo_path)
    if logo_path:
        location = clean(header.get("location", "Bhadrachalam"))
        y = draw_header_with_logo(c, logo_path, school_name, location, exam_title, subject, class_str, max_marks, time_str)
    else:
        c.setFont("Helvetica", FONT_SMALL)
        c.drawCentredString(PAGE_WIDTH / 2, y, exam_code)
        y -= lead
        c.setFont("Helvetica", FONT_SUB)
        c.drawCentredString(PAGE_WIDTH / 2, y, exam_title)
        y -= lead
        c.drawCentredString(PAGE_WIDTH / 2, y, subject)
        y -= lead
        c.setFont("Helvetica", FONT_BODY)
        c.drawCentredString(PAGE_WIDTH / 2, y, f"Class: {class_str}    Max.Marks: {max_marks}    Time: {time_str}")
        y -= lead
        draw_line(c, y)
        y -= lead

    part_a_questions = sec_i + sec_ii + sec_iii
    for name, qs in rest:
        part_a_questions.extend(qs)

    # PART-A first (SECTION-I, SECTION-II, SECTION-III, then rest)
    if part_a_questions:
        if y < PAGE_HEIGHT - 4 * MARGIN:
            new_page()
            y = PAGE_HEIGHT - MARGIN
        c.setFont("Helvetica", FONT_SUB)
        part_a_marks = sum(int(q.get("marks", 1)) for q in part_a_questions)
        c.drawString(CONTENT_LEFT, y, f"PART - A    Time: 2.30 Hrs    Marks: {part_a_marks}")
        y -= lead
        draw_line(c, y)
        y -= lead

        q_global = 0
        # SECTION - I
        if sec_i:
            c.setFont("Helvetica", FONT_SUB)
            sec_i_marks = sum(int(q.get("marks", 1)) for q in sec_i)
            n, m = len(sec_i), (sec_i[0].get("marks", 2) if sec_i else 2)
            c.drawString(CONTENT_LEFT, y, f"SECTION - I  (Marks {n}x{m}={sec_i_marks})")
            y -= line_height
            c.setFont("Helvetica", FONT_SMALL)
            c.drawString(CONTENT_LEFT, y, "NOTE:  i) Answer all   ii) Each question carries 2 marks")
            y -= lead
            for q in sec_i:
                q_global += 1
                if y < 2 * MARGIN + 25:
                    new_page()
                    y = PAGE_HEIGHT - MARGIN
                text = clean(q.get("text", ""))
                marks = int(q.get("marks", 2))
                c.setFont("Helvetica", FONT_BODY)
                c.drawString(CONTENT_LEFT, y, f"{q_global}.")
                c.drawString(CONTENT_RIGHT - 25, y, f"[{marks} m]")
                y -= line_height
                for line in wrap_text(c, text, CONTENT_WIDTH - 30, size=FONT_BODY):
                    c.drawString(CONTENT_LEFT + 14, y, line)
                    y -= line_height
                y -= lead
            y -= 2 * mm

        # SECTION - II
        if sec_ii:
            c.setFont("Helvetica", FONT_SUB)
            sec_ii_marks = sum(int(q.get("marks", 1)) for q in sec_ii)
            n, m = len(sec_ii), (sec_ii[0].get("marks", 4) if sec_ii else 4)
            c.drawString(CONTENT_LEFT, y, f"SECTION - II  ({n}x{m}={sec_ii_marks})")
            y -= lead
            for q in sec_ii:
                q_global += 1
                if y < 2 * MARGIN + 25:
                    new_page()
                    y = PAGE_HEIGHT - MARGIN
                text = clean(q.get("text", ""))
                marks = int(q.get("marks", 4))
                c.setFont("Helvetica", FONT_BODY)
                c.drawString(CONTENT_LEFT, y, f"{q_global}.")
                c.drawString(CONTENT_RIGHT - 25, y, f"[{marks} m]")
                y -= line_height
                for line in wrap_text(c, text, CONTENT_WIDTH - 30, size=FONT_BODY):
                    c.drawString(CONTENT_LEFT + 14, y, line)
                    y -= line_height
                y -= lead
            y -= 2 * mm

        # SECTION - III
        if sec_iii:
            c.setFont("Helvetica", FONT_SUB)
            sec_iii_marks = sum(int(q.get("marks", 1)) for q in sec_iii)
            n, m = len(sec_iii), (sec_iii[0].get("marks", 6) if sec_iii else 6)
            c.drawString(CONTENT_LEFT, y, f"SECTION - III  (4x{m}={4*m})")
            y -= line_height
            c.setFont("Helvetica", FONT_SMALL)
            c.drawString(CONTENT_LEFT, y, "NOTE: Answer any 4 of the following")
            y -= lead
            for q in sec_iii:
                q_global += 1
                if y < 2 * MARGIN + 25:
                    new_page()
                    y = PAGE_HEIGHT - MARGIN
                text = clean(q.get("text", ""))
                marks = int(q.get("marks", 6))
                c.setFont("Helvetica", FONT_BODY)
                c.drawString(CONTENT_LEFT, y, f"{q_global}.")
                c.drawString(CONTENT_RIGHT - 25, y, f"[{marks} m]")
                y -= line_height
                for line in wrap_text(c, text, CONTENT_WIDTH - 30, size=FONT_BODY):
                    c.drawString(CONTENT_LEFT + 14, y, line)
                    y -= line_height
                y -= lead

        for name, qs in rest:
            c.setFont("Helvetica", FONT_SUB)
            c.drawString(CONTENT_LEFT, y, name)
            y -= lead
            for q in qs:
                q_global += 1
                if y < 2 * MARGIN + 25:
                    new_page()
                    y = PAGE_HEIGHT - MARGIN
                text = clean(q.get("text", ""))
                marks = int(q.get("marks", 1))
                c.setFont("Helvetica", FONT_BODY)
                c.drawString(CONTENT_LEFT, y, f"{q_global}.")
                c.drawString(CONTENT_RIGHT - 25, y, f"[{marks} m]")
                y -= line_height
                for line in wrap_text(c, text, CONTENT_WIDTH - 30, size=FONT_BODY):
                    c.drawString(CONTENT_LEFT + 14, y, line)
                    y -= line_height
                y -= lead

    # PART-B at the end (new page if we had PART-A)
    if part_b:
        if part_a_questions:
            new_page()
            y = PAGE_HEIGHT - MARGIN
        # PART-B block
        c.setFont("Helvetica", FONT_SUB)
        c.drawString(CONTENT_LEFT, y, "PART - B    Objective Type    Marks: 20")
        y -= line_height
        c.setFont("Helvetica", FONT_BODY)
        c.drawString(CONTENT_LEFT, y, "Time: 30 Min")
        y -= line_height
        c.drawString(CONTENT_LEFT, y, "Instructions:  i) Answer all   ii) 1 mark each")
        y -= lead
        draw_line(c, y)
        y -= lead

        part_b_marks = sum(int(q.get("marks", 1)) for q in part_b)
        for i, q in enumerate(part_b):
            num = i + 1
            text = clean(q.get("text", ""))
            opts = q.get("options") or []
            opts = (opts + ["", "", "", ""])[:4]
            if y < 2 * MARGIN + 40:
                new_page()
                y = PAGE_HEIGHT - MARGIN
            c.setFont("Helvetica", FONT_BODY)
            bubble_x = CONTENT_RIGHT - 15
            c.drawString(CONTENT_LEFT, y, f"{num}.")
            text_lines = wrap_text(c, text, CONTENT_WIDTH - 60, size=FONT_BODY)
            if text_lines:
                for line in text_lines[:-1]:
                    c.drawString(CONTENT_LEFT + 12, y, line)
                    y -= line_height
                last_line = text_lines[-1]
                c.drawString(CONTENT_LEFT + 12, y, last_line)
                c.rect(bubble_x - 4, y - 1, 12, 5)
            else:
                c.rect(bubble_x - 4, y - 1, 12, 5)
            y -= line_height
            row1 = f"A) {clean(opts[0])}    B) {clean(opts[1])}"
            row2 = f"C) {clean(opts[2])}    D) {clean(opts[3])}"
            for line in wrap_text(c, row1, CONTENT_WIDTH - 20, size=FONT_SMALL):
                c.drawString(CONTENT_LEFT + 12, y, line)
                y -= line_height
            for line in wrap_text(c, row2, CONTENT_WIDTH - 20, size=FONT_SMALL):
                c.drawString(CONTENT_LEFT + 12, y, line)
                y -= line_height
            y -= line_height

        y -= 3 * mm

    c.save()
    pdf_bytes = buffer.getvalue()

    # Re-open PDF and add footers (we need total_pages and to draw on each page)
    from pypdf import PdfReader, PdfWriter
    from reportlab.pdfgen import canvas as canvas2
    reader = PdfReader(BytesIO(pdf_bytes))
    writer = PdfWriter()
    for i in range(len(reader.pages)):
        page = reader.pages[i]
        packet = BytesIO()
        cc = canvas2.Canvas(packet, pagesize=A4)
        draw_footer(cc, i + 1, len(reader.pages), school_name, date_str, i == len(reader.pages) - 1)
        cc.save()
        packet.seek(0)
        overlay = PdfReader(packet)
        page.merge_page(overlay.pages[0])
        writer.add_page(page)
    out = BytesIO()
    writer.write(out)
    sys.stdout.buffer.write(out.getvalue())


if __name__ == "__main__":
    main()
