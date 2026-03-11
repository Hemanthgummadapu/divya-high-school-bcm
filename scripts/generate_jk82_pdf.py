#!/usr/bin/env python3
"""
JK-82 style Indian school exam paper PDF generator.
Reads JSON from stdin: { "header": {...}, "questions": [...], "logoPath": "/path/to/logo.png" }
Outputs PDF bytes to stdout (binary).
Layout: Page 1 PART-A (SECTION-I, II, III), then PART-B (Objective) at the end.
Logo: watermark on every page (8%), header logo 60x60 on page 1.
Helvetica only, A4 portrait, 1.8cm margins.
"""

import sys
import os

# Force venv site-packages — works whether called directly or spawned from Node.js
_site = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                     "..", "venv", "lib", "python3.14", "site-packages")
_site = os.path.normpath(_site)
if os.path.isdir(_site):
    sys.path.insert(0, _site)

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
pt = 1.0  # 1 point = 1 ReportLab unit
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.platypus import Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

import argparse
import base64
import json
import re
import tempfile
from io import BytesIO

# Layout
MARGIN = 1.8 * cm
PAGE_WIDTH, PAGE_HEIGHT = A4
CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN
CONTENT_LEFT = MARGIN
CONTENT_RIGHT = PAGE_WIDTH - MARGIN
FOOTER_Y = 15 * mm
TURN_OVER_Y = 12 * mm
# Diagram: inline right of question text; text uses 60% width when diagram present
DIAGRAM_MAX_W = 130
DIAGRAM_MAX_H = 110
TEXT_WIDTH_RATIO_WITH_DIAGRAM = 0.6

# Font sizes (increased by 2pt for better readability)
FONT_TITLE = 16
FONT_SUB = 13
FONT_BODY = 12
FONT_SMALL = 11

# Font family: set in main() based on available fonts
FONT_FAMILY = "Helvetica"
FONT_FAMILY_BOLD = "Helvetica-Bold"
NOTO_LOADED = False
SYMBOL_FONT_FAMILY = "NotoSansSymbols2"
SYMBOL_FONT_LOADED = False
MATH_FONT_FAMILY = "NotoSansMath"
MATH_FONT_LOADED = False


def clean(s):
    if s is None:
        return ""
    return " ".join(str(s).split())


def fix_special_chars(text):
    """Pass through; subscript letters mapped to _x for clarity."""
    if not text:
        return text
    text = text.replace("\u2099", "_n")   # ₙ
    text = text.replace("\u2090", "_a")   # ₐ
    text = text.replace("\u2091", "_e")   # ₑ
    text = text.replace("\u2092", "_o")   # ₒ
    text = text.replace("\u1d62", "_i")   # ᵢ
    text = text.replace("\u1d63", "_r")   # ᵣ
    return text


def clean_preserve_newlines(s):
    if s is None:
        return ""
    return "\n".join(" ".join(fix_special_chars(line).split()) for line in str(s).splitlines())


def clean_for_pdf(text):
    """Strip markdown table separator rows like |---|---| so they don't render as visible dashes."""
    if not text:
        return text
    import re as _re
    text = str(text)
    # Remove lone pipe lines that sometimes appear before markdown tables
    text = _re.sub(r"^\|\s*$", "", text, flags=_re.MULTILINE).strip()
    lines = text.split("\n")
    cleaned = []
    for line in lines:
        stripped = line.strip()
        # Skip markdown table separator rows composed only of pipes, dashes, colons, and spaces
        if stripped and all(c in "|-: " for c in stripped):
            continue
        cleaned.append(line)
    return "\n".join(cleaned)


def choose_font_for_char(ch: str) -> str:
    """Choose base font for a single character; math and symbol fonts as fallback when available."""
    code = ord(ch)
    # Mathematical Operators (√∑∫∞∠ etc.) — use NotoSansMath
    if MATH_FONT_LOADED and 0x2200 <= code <= 0x22FF:
        return MATH_FONT_FAMILY
    # Supplemental Math Operators
    if MATH_FONT_LOADED and 0x2A00 <= code <= 0x2AFF:
        return MATH_FONT_FAMILY
    # Geometric Shapes (△▲■□) — use NotoSansSymbols2
    if SYMBOL_FONT_LOADED and 0x25A0 <= code <= 0x25FF:
        return SYMBOL_FONT_FAMILY
    return FONT_FAMILY


def draw_text_with_fallback(c, text: str, x: float, y: float, size: float = FONT_BODY):
    """Draw text using per-character font fallback (e.g. NotoSans + NotoSansSymbols2)."""
    if not text:
        return
    run_font = None
    run = ""
    current_x = x
    for ch in text:
        font_name = choose_font_for_char(ch)
        if run_font is None:
            run_font = font_name
        if font_name != run_font and run:
            c.setFont(run_font, size)
            c.drawString(current_x, y, run)
            current_x += c.stringWidth(run, run_font, size)
            run = ch
            run_font = font_name
        else:
            run += ch
    if run:
        c.setFont(run_font or FONT_FAMILY, size)
        c.drawString(current_x, y, run)

def wrap_text(c, text, width, font=None, size=FONT_BODY):
    """Return list of lines that fit in width."""
    if font is None:
        font = FONT_FAMILY
    c.setFont(font, size)
    words = re.split(r"\s+", text.strip())
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
    """Partition by marks: 2→SECTION-I, 4→SECTION-II, 6→SECTION-III, 1→PART-B. Order: PART-A (I, II, III) then PART-B."""
    part_b = []
    sec_i, sec_ii, sec_iii = [], [], []
    rest = []
    for q in questions:
        m = int(q.get("marks", 0))
        if m == 1:
            part_b.append(q)
        elif m == 2:
            sec_i.append(q)
        elif m == 4:
            sec_ii.append(q)
        elif m == 6:
            sec_iii.append(q)
        else:
            rest.append(q)
    return part_b, sec_i, sec_ii, sec_iii, rest


def draw_line(c, y, left=None, right=None):
    left = left or CONTENT_LEFT
    right = right or CONTENT_RIGHT
    c.line(left, y, right, y)


def preprocess_question_text_for_tables(text):
    """Split single-line table data into proper lines: find segments with 3+ pipes, put each on its own line."""
    if not text or not text.strip():
        return text
    pattern = r'((?:[^|]+\|){3,}[^|]*)'
    parts = re.split(pattern, text)
    if len(parts) < 3:
        return text
    lines = []
    if parts[0].strip():
        lines.append(parts[0].strip())
    for i in range(1, len(parts), 2):
        if i < len(parts) and parts[i].strip():
            lines.append(parts[i].strip())
    if len(parts) % 2 == 0 and len(parts) > 1 and parts[-1].strip():
        lines.append(parts[-1].strip())
    return "\n".join(lines) if lines else text


def parse_table_in_text(text):
    """Parse text into (before_lines, list_of_table_blocks, after_lines). Table row = line with 3+ '|'. Cells stripped; empty cells filtered then rows padded to same length."""
    text = preprocess_question_text_for_tables(text or "")
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    before = []
    tables = []
    after = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.count("|") >= 3:
            table_rows = []
            while i < len(lines) and lines[i].count("|") >= 3:
                row = [cell.strip() for cell in lines[i].split("|")]
                row = [c for c in row if c]
                if row:
                    table_rows.append(row)
                i += 1
            if table_rows:
                max_cols = max(len(r) for r in table_rows)
                padded = [row + [""] * (max_cols - len(row)) for row in table_rows]
                tables.append(padded)
        else:
            if not tables:
                before.append(line)
            else:
                after.append(line)
            i += 1
    if not tables:
        return (lines, [], [])
    return (before, tables, after)


def draw_question_content(c, text, y, line_height, lead, indent=14, new_page_cb=None, is_mcq=False, same_line_y=None, reserve_diagram=False):
    """Draw question text; pipe-separated table blocks (3+ '|' per line) drawn with reportlab Table. Returns new y.
    When is_mcq=True, skip table parsing and render as plain text.
    When same_line_y is set, the first line of text is drawn at same_line_y (same line as question number).
    When reserve_diagram=True, text uses 60% of content width so diagram sits alongside on the right."""
    text = (text or "").replace("\\n", "\n")
    if reserve_diagram:
        base_avail = CONTENT_WIDTH * TEXT_WIDTH_RATIO_WITH_DIAGRAM - indent
    else:
        base_avail = CONTENT_WIDTH - 30
    avail_width = base_avail
    if is_mcq:
        # Plain text only: each line wrapped and drawn, no table parsing
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        first_done = False
        for line in lines:
            for ln in wrap_text(c, line, avail_width, size=FONT_BODY):
                if same_line_y is not None and not first_done:
                    c.drawString(CONTENT_LEFT + indent, same_line_y, ln)
                    first_done = True
                    y = same_line_y - line_height
                else:
                    c.drawString(CONTENT_LEFT + indent, y, ln)
                    y -= line_height
        return y
    before, tables, after = parse_table_in_text(text)
    avail_width = base_avail
    first_line_done = False
    if same_line_y is not None:
        y = same_line_y
    if before:
        for line in before:
            wrapped = wrap_text(c, line, avail_width, size=FONT_BODY)
            for idx, ln in enumerate(wrapped):
                if same_line_y is not None and not first_line_done:
                    draw_text_with_fallback(c, ln, CONTENT_LEFT + indent, same_line_y, FONT_BODY)
                    first_line_done = True
                    y = same_line_y - line_height
                else:
                    draw_text_with_fallback(c, ln, CONTENT_LEFT + indent, y, FONT_BODY)
                    y -= line_height
        # Add vertical spacing after non-table text only when there is trailing non-table content.
        # When a table follows immediately, avoid extra gap so the table sits closer to the text.
        if (after and not tables) and (first_line_done or same_line_y is None):
            y -= lead
        if same_line_y is not None and not first_line_done:
            y = same_line_y - line_height
    for table_rows in tables:
        if not table_rows:
            continue
        if same_line_y is not None and not first_line_done:
            y = same_line_y - line_height
            first_line_done = True
        col_count = max(len(r) for r in table_rows)
        col_width = avail_width / col_count
        col_widths = [col_width] * col_count
        data = [list(row) for row in table_rows]
        t = Table(data, colWidths=col_widths, repeatRows=0)
        t.setStyle(TableStyle([
            ("FONT", (0, 0), (-1, -1), FONT_FAMILY, 9),
            ("GRID", (0, 0), (-1, -1), 0.5, (0, 0, 0)),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        tw, th = t.wrap(avail_width, PAGE_HEIGHT)
        if y - th < 2 * MARGIN and new_page_cb:
            new_page_cb()
            y = PAGE_HEIGHT - MARGIN
        if y - th >= 2 * MARGIN:
            t.drawOn(c, CONTENT_LEFT + indent, y - th)
            y -= th + lead
    if after:
        for line in after:
            wrapped = wrap_text(c, line, avail_width, size=FONT_BODY)
            for idx, ln in enumerate(wrapped):
                if same_line_y is not None and not first_line_done:
                    draw_text_with_fallback(c, ln, CONTENT_LEFT + indent, same_line_y, FONT_BODY)
                    first_line_done = True
                    y = same_line_y - line_height
                else:
                    draw_text_with_fallback(c, ln, CONTENT_LEFT + indent, y, FONT_BODY)
                    y -= line_height
        y -= lead
    return y


def draw_question_diagram(c, diagram_base64, y_text_top, y_text_bottom, new_page_cb=None):
    """Draw question diagram on the right, vertically centered with the question text block.
    y_text_top: first line of question text; y_text_bottom: after last line.
    Max 130pt x 110pt, aspect ratio preserved. Returns y for next content (min of text bottom and diagram bottom)."""
    if not diagram_base64 or not isinstance(diagram_base64, str):
        return y_text_bottom
    try:
        raw = base64.b64decode(diagram_base64)
    except Exception:
        return y_text_bottom
    if not raw:
        return y_text_bottom
    tmp = None
    try:
        fd, tmp = tempfile.mkstemp(suffix=".png")
        os.write(fd, raw)
        os.close(fd)
        img = ImageReader(tmp)
        iw, ih = img.getSize()
    except Exception:
        return y_text_bottom
    finally:
        if tmp and os.path.isfile(tmp):
            try:
                os.unlink(tmp)
            except Exception:
                pass
    max_w = DIAGRAM_MAX_W
    max_h = DIAGRAM_MAX_H
    scale = min(max_w / iw, max_h / ih, 1.0)
    w = iw * scale
    h = ih * scale
    text_center_y = (y_text_top + y_text_bottom) / 2
    diagram_y_bottom = text_center_y - h / 2
    if new_page_cb and diagram_y_bottom < 2 * MARGIN:
        new_page_cb()
        diagram_y_bottom = PAGE_HEIGHT - MARGIN - h
    x = CONTENT_RIGHT - w
    c.drawImage(img, x, diagram_y_bottom, width=w, height=h, preserveAspectRatio=True, mask="auto")
    return min(y_text_bottom, diagram_y_bottom)


def draw_footer(c, page_num, total_pages, school_name, date_str, is_last):
    c.setFont(FONT_FAMILY, FONT_SMALL)
    c.drawString(CONTENT_LEFT, FOOTER_Y, school_name or "")
    c.drawCentredString(PAGE_WIDTH / 2, FOOTER_Y, f"Page {page_num} of {total_pages}")
    c.drawRightString(CONTENT_RIGHT, FOOTER_Y, date_str or "")
    if is_last:
        pass
    else:
        c.drawRightString(CONTENT_RIGHT, TURN_OVER_Y, "[ Turn Over ]")


def draw_page_border(c, width, height):
    # Outer border
    c.setStrokeColorRGB(0, 0, 0)
    c.setLineWidth(1.5)
    margin = 0.8 * cm
    c.rect(margin, margin, width - 2 * margin, height - 2 * margin)
    # Inner border
    c.setLineWidth(0.5)
    inner = margin + 0.3 * cm
    c.rect(inner, inner, width - 2 * inner, height - 2 * inner)
    c.setLineWidth(1)  # reset


def draw_watermark(c, logo_path):
    base = os.getcwd()
    exam_path = os.path.join(base, "public", "images", "school-logo-exam.png")
    logo_pub_path = os.path.join(base, "public", "images", "school-logo.png")
    if os.path.isfile(exam_path):
        watermark_path = exam_path
    elif os.path.isfile(logo_pub_path):
        watermark_path = logo_pub_path
    else:
        watermark_path = logo_path
    if not watermark_path or not os.path.isfile(watermark_path):
        return
    try:
        from PIL import Image as PILImage
        img_pil = PILImage.open(watermark_path).convert("RGBA")
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
        size = 220
        x = (PAGE_WIDTH - size) / 2
        y = (PAGE_HEIGHT - size) / 2
        c.drawImage(img, x, y, width=size, height=size, preserveAspectRatio=True, mask="auto")
    except Exception:
        pass


def draw_header_with_logo(c, logo_path, school_name, location, exam_title, subject, class_str, max_marks, time_str):
    """Draw logo 60x60 top-left and 4 header lines centered. Returns y position below header."""
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
    # 1. School name — largest, bold, centered
    c.setFont(FONT_FAMILY_BOLD, 20)
    c.drawCentredString(text_center_x, y, school_name or "Divya High School BCM")
    y -= lead
    # 2. Location — smaller, regular, centered
    c.setFont(FONT_FAMILY, 10)
    c.drawCentredString(text_center_x, y, location or "Bhadrachalam")
    y -= lead
    # 3. Exam title — medium, bold, centered
    c.setFont(FONT_FAMILY_BOLD, 12)
    c.drawCentredString(text_center_x, y, exam_title or "PRE-FINAL EXAMINATIONS")
    y -= lead
    # 4. Class | Max. Marks | Time — same line, regular, centered
    c.setFont(FONT_FAMILY, 10)
    c.drawCentredString(text_center_x, y, f"Class: {class_str}    Max. Marks: {max_marks}    Time: {time_str}")
    y -= lead
    draw_line(c, y)
    return y - lead


def main():
    global FONT_FAMILY, FONT_FAMILY_BOLD, NOTO_LOADED, SYMBOL_FONT_LOADED, MATH_FONT_LOADED
    parser = argparse.ArgumentParser(description="JK-82 style exam paper PDF generator.")
    parser.add_argument("--output", dest="output", default=None, metavar="filepath", help="Write PDF to file instead of stdout")
    args = parser.parse_args()

    # Prefer project-local NotoSans (public/fonts) if available for full Unicode (log₂, √, θ, etc.)
    try:
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        noto_path = os.path.join(base, "public", "fonts", "NotoSans-Regular.ttf")
        noto_bold_path = os.path.join(base, "public", "fonts", "NotoSans-Bold.ttf")
        symbols_path = os.path.join(base, "public", "fonts", "NotoSansSymbols2-Regular.ttf")
        if os.path.isfile(noto_path):
            try:
                pdfmetrics.registerFont(TTFont("NotoSans", noto_path))
                if os.path.isfile(noto_bold_path):
                    pdfmetrics.registerFont(TTFont("NotoSans-Bold", noto_bold_path))
                    FONT_FAMILY_BOLD = "NotoSans-Bold"
                else:
                    FONT_FAMILY_BOLD = "NotoSans"
                FONT_FAMILY = "NotoSans"
                NOTO_LOADED = True
            except Exception:
                NOTO_LOADED = False
        # Register symbols font (geometric shapes) if available
        if os.path.isfile(symbols_path):
            try:
                pdfmetrics.registerFont(TTFont(SYMBOL_FONT_FAMILY, symbols_path))
                SYMBOL_FONT_LOADED = True
            except Exception:
                SYMBOL_FONT_LOADED = False
        else:
            SYMBOL_FONT_LOADED = False
        # Register NotoSansMath (math operators) if available
        noto_math_path = os.path.join(base, "public", "fonts", "NotoSansMath-Regular.ttf")
        if os.path.isfile(noto_math_path):
            try:
                pdfmetrics.registerFont(TTFont("NotoSansMath", noto_math_path))
                MATH_FONT_LOADED = True
            except Exception:
                MATH_FONT_LOADED = False
        else:
            MATH_FONT_LOADED = False
    except Exception:
        NOTO_LOADED = False
        SYMBOL_FONT_LOADED = False
        MATH_FONT_LOADED = False

    # If NotoSans not available, fall back to system Unicode fonts on Windows (Segoe UI / Arial), else core Helvetica.
    if not NOTO_LOADED:
        segoe_path = "C:/Windows/Fonts/segoeui.ttf"
        segoe_bold_path = "C:/Windows/Fonts/segoeuib.ttf"
        arial_path = "C:/Windows/Fonts/arial.ttf"
        arial_bold_path = "C:/Windows/Fonts/arialbd.ttf"
        if os.path.isfile(segoe_path):
            try:
                pdfmetrics.registerFont(TTFont("SegoeUI", segoe_path))
                if os.path.isfile(segoe_bold_path):
                    pdfmetrics.registerFont(TTFont("SegoeUIBold", segoe_bold_path))
                FONT_FAMILY = "SegoeUI"
                FONT_FAMILY_BOLD = "SegoeUIBold"
            except Exception:
                pass
        if FONT_FAMILY == "Helvetica" and os.path.isfile(arial_path):
            try:
                pdfmetrics.registerFont(TTFont("Arial", arial_path))
                if os.path.isfile(arial_bold_path):
                    pdfmetrics.registerFont(TTFont("Arial-Bold", arial_bold_path))
                FONT_FAMILY = "Arial"
                FONT_FAMILY_BOLD = "Arial-Bold"
            except Exception:
                pass

    print(
        f"[JK82 PDF] FONT_FAMILY={FONT_FAMILY}, FONT_FAMILY_BOLD={FONT_FAMILY_BOLD}, NOTO_LOADED={NOTO_LOADED}, SYMBOL_FONT_LOADED={SYMBOL_FONT_LOADED}, MATH_FONT_LOADED={MATH_FONT_LOADED}",
        file=sys.stderr,
    )

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
    c.setFont(FONT_FAMILY, FONT_BODY)
    line_height = 5 * mm
    lead = 6 * mm
    y = PAGE_HEIGHT - MARGIN
    total_pages = 1

    def new_page():
        nonlocal y, total_pages
        c.showPage()
        total_pages += 1
        draw_page_border(c, PAGE_WIDTH, PAGE_HEIGHT)
        draw_watermark(c, logo_path)
        y = PAGE_HEIGHT - MARGIN

    # ---------- PAGE 1: Watermark, then header (logo+text or text-only), then PART-A then PART-B ----------
    draw_page_border(c, PAGE_WIDTH, PAGE_HEIGHT)
    draw_watermark(c, logo_path)
    location = clean(header.get("location", "Bhadrachalam"))
    if logo_path:
        y = draw_header_with_logo(c, logo_path, school_name, location, exam_title, subject, class_str, max_marks, time_str)
    else:
        # No logo: same 4-line header, centered on page
        lead = 5 * mm
        c.setFont(FONT_FAMILY_BOLD, 20)
        c.drawCentredString(PAGE_WIDTH / 2, y, school_name or "Divya High School BCM")
        y -= lead
        c.setFont(FONT_FAMILY, 10)
        c.drawCentredString(PAGE_WIDTH / 2, y, location or "Bhadrachalam")
        y -= lead
        c.setFont(FONT_FAMILY_BOLD, 12)
        c.drawCentredString(PAGE_WIDTH / 2, y, exam_title or "PRE-FINAL EXAMINATIONS")
        y -= lead
        c.setFont(FONT_FAMILY, 10)
        c.drawCentredString(PAGE_WIDTH / 2, y, f"Class: {class_str}    Max. Marks: {max_marks}    Time: {time_str}")
        y -= lead
        draw_line(c, y)
        y -= lead

    part_a_questions = sec_i + sec_ii + sec_iii + rest

    # PART-A first (SECTION-I, SECTION-II, SECTION-III, then rest)
    if part_a_questions:
        if y < PAGE_HEIGHT - 4 * MARGIN:
            new_page()
            y = PAGE_HEIGHT - MARGIN
        c.setFont(FONT_FAMILY, FONT_SUB)
        part_a_marks = sum(int(q.get("marks", 0)) for q in part_a_questions)
        c.drawString(CONTENT_LEFT, y, f"PART - A    Time: 2.30 Hrs    Marks: {part_a_marks}")
        y -= lead
        draw_line(c, y)
        y -= lead

        q_global = 0
        # SECTION - I (2 marks)
        if sec_i:
            c.setFont(FONT_FAMILY, FONT_SUB)
            sec_i_marks = sum(int(q.get("marks", 0)) for q in sec_i)
            n = len(sec_i)
            c.drawString(CONTENT_LEFT, y, f"SECTION - I  (2 marks)")
            y -= line_height
            c.setFont(FONT_FAMILY, FONT_SMALL)
            c.drawString(CONTENT_LEFT, y, "NOTE:  i) Answer all   ii) Each question carries 2 marks")
            y -= 14
            y -= lead
            for q in sec_i:
                q_global += 1
                if y < 2 * MARGIN + 25:
                    new_page()
                    y = PAGE_HEIGHT - MARGIN
                text = clean_for_pdf(clean_preserve_newlines(q.get("text", "")))
                marks = int(q.get("marks", 0)) or 2
                c.setFont(FONT_FAMILY, FONT_BODY)
                c.drawString(CONTENT_LEFT, y, f"{q_global}.")
                question_start_y = y
                y = draw_question_content(c, text, y, line_height, lead, 25, new_page, same_line_y=y, reserve_diagram=bool(q.get("diagram")))
                if q.get("diagram"):
                    y = draw_question_diagram(c, q.get("diagram"), question_start_y, y, new_page)
                y -= (2 * mm if q.get("diagram") else lead)
            y -= 2 * mm

        # SECTION - II (4 marks)
        if sec_ii:
            c.setFont(FONT_FAMILY, FONT_SUB)
            sec_ii_marks = sum(int(q.get("marks", 0)) for q in sec_ii)
            n = len(sec_ii)
            c.drawString(CONTENT_LEFT, y, f"SECTION - II  (4 marks)")
            y -= lead
            for q in sec_ii:
                q_global += 1
                if y < 2 * MARGIN + 25:
                    new_page()
                    y = PAGE_HEIGHT - MARGIN
                text = clean_for_pdf(clean_preserve_newlines(q.get("text", "")))
                marks = int(q.get("marks", 0)) or 4
                c.setFont(FONT_FAMILY, FONT_BODY)
                c.drawString(CONTENT_LEFT, y, f"{q_global}.")
                question_start_y = y
                y = draw_question_content(c, text, y, line_height, lead, 25, new_page, same_line_y=y, reserve_diagram=bool(q.get("diagram")))
                if q.get("diagram"):
                    y = draw_question_diagram(c, q.get("diagram"), question_start_y, y, new_page)
                y -= (2 * mm if q.get("diagram") else lead)
            y -= 2 * mm

        # SECTION - III (6 marks)
        if sec_iii:
            c.setFont(FONT_FAMILY, FONT_SUB)
            sec_iii_marks = sum(int(q.get("marks", 0)) for q in sec_iii)
            n = len(sec_iii)
            c.drawString(CONTENT_LEFT, y, f"SECTION - III  (6 marks)")
            y -= line_height
            c.setFont(FONT_FAMILY, FONT_SMALL)
            c.drawString(CONTENT_LEFT, y, "NOTE: Answer any 4 of the following")
            y -= 14
            y -= lead
            for q in sec_iii:
                q_global += 1
                if y < 2 * MARGIN + 25:
                    new_page()
                    y = PAGE_HEIGHT - MARGIN
                text = clean_for_pdf(clean_preserve_newlines(q.get("text", "")))
                marks = int(q.get("marks", 0)) or 6
                c.setFont(FONT_FAMILY, FONT_BODY)
                c.drawString(CONTENT_LEFT, y, f"{q_global}.")
                question_start_y = y
                y = draw_question_content(c, text, y, line_height, lead, 25, new_page, same_line_y=y, reserve_diagram=bool(q.get("diagram")))
                if q.get("diagram"):
                    y = draw_question_diagram(c, q.get("diagram"), question_start_y, y, new_page)
                y -= (2 * mm if q.get("diagram") else lead)

        if rest:
            for q in rest:
                q_global += 1
                if y < 2 * MARGIN + 25:
                    new_page()
                    y = PAGE_HEIGHT - MARGIN
                text = clean_for_pdf(clean_preserve_newlines(q.get("text", "")))
                marks = int(q.get("marks", 0)) or 1
                c.setFont(FONT_FAMILY, FONT_BODY)
                c.drawString(CONTENT_LEFT, y, f"{q_global}.")
                c.drawString(CONTENT_RIGHT - 25, y, f"[{marks} m]")
                question_start_y = y
                y = draw_question_content(c, text, y, line_height, lead, 25, new_page, is_mcq=True, same_line_y=y, reserve_diagram=bool(q.get("diagram")))
                if q.get("diagram"):
                    y = draw_question_diagram(c, q.get("diagram"), question_start_y, y, new_page)
                y -= (2 * mm if q.get("diagram") else lead)

    # PART-B at the end (new page if we had PART-A)
    if part_b:
        if part_a_questions:
            new_page()
            y = PAGE_HEIGHT - MARGIN
        # PART-B block
        c.setFont(FONT_FAMILY, FONT_SUB)
        c.drawString(CONTENT_LEFT, y, "PART - B    Objective Type    Marks: 20")
        y -= line_height
        c.setFont(FONT_FAMILY, FONT_BODY)
        c.drawString(CONTENT_LEFT, y, "Time: 30 Min")
        y -= line_height
        c.drawString(CONTENT_LEFT, y, "Instructions:  i) Answer all   ii) 1 mark each")
        y -= lead
        draw_line(c, y)
        y -= lead

        part_b_marks = sum(int(q.get("marks", 0)) for q in part_b)
        for i, q in enumerate(part_b):
            num = i + 1
            text = clean_for_pdf(clean_preserve_newlines(q.get("text", "")))
            opts = q.get("options") or []
            opts = (opts + ["", "", "", ""])[:4]
            if y < 2 * MARGIN + 40:
                new_page()
                y = PAGE_HEIGHT - MARGIN
            c.setFont(FONT_FAMILY, FONT_BODY)
            question_y = y
            c.drawString(CONTENT_LEFT, y, f"{num}.")
            c.drawString(CONTENT_RIGHT - 20, question_y, "(        )")
            question_start_y = question_y
            y = draw_question_content(c, text, y, line_height, lead, 20, new_page, same_line_y=question_y, reserve_diagram=bool(q.get("diagram")))
            if q.get("diagram"):
                y = draw_question_diagram(c, q.get("diagram"), question_start_y, y, new_page)
            y -= (2 * mm if q.get("diagram") else lead)
            c.setFont(FONT_FAMILY, FONT_SMALL)
            draw_text_with_fallback(c, f"A) {clean(opts[0])}", CONTENT_LEFT + 12, y, FONT_SMALL)
            draw_text_with_fallback(c, f"B) {clean(opts[1])}", CONTENT_LEFT + CONTENT_WIDTH / 2, y, FONT_SMALL)
            y -= line_height
            draw_text_with_fallback(c, f"C) {clean(opts[2])}", CONTENT_LEFT + 12, y, FONT_SMALL)
            draw_text_with_fallback(c, f"D) {clean(opts[3])}", CONTENT_LEFT + CONTENT_WIDTH / 2, y, FONT_SMALL)
            y -= line_height
            y -= lead

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
    if args.output is not None:
        with open(args.output, "wb") as f:
            f.write(out.getvalue())
    else:
        sys.stdout.buffer.write(out.getvalue())


if __name__ == "__main__":
    main()
