#!/usr/bin/env python3
"""JK-82 style exam paper PDF generator, laid out as HTML and CSS.

Same contract as generate_jk82_pdf.py — JSON in, PDF bytes out — but the page
is laid out by WeasyPrint instead of drawn command by command.

Why: the drawing generator maps one codepoint to one glyph and never runs a
font's OpenType shaping tables. English and maths survive that; Telugu and
Hindi do not. Telugu conjuncts failed to stack, vowel signs detached, and "ప"
came out as "వ" — a different letter. Devanagari never reordered its i-matra,
so "कि" put the vowel on the wrong side of its consonant. WeasyPrint shapes
through Pango and HarfBuzz, which is what those scripts require.

The move also hands the layout engine three jobs the old renderer did by hand:
per-character font fallback (list the families and a missing glyph falls
through, so a symbol can never silently draw as nothing), keeping a question
with its options (break-inside: avoid, rather than estimating block heights),
and setting options two to a row (CSS grid).
"""

import argparse
import base64
import json
import os
import re
import sys
from datetime import date
from io import BytesIO

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# One source of truth for the LaTeX decoding: the same helpers the drawing
# generator uses, so the two renderers can never disagree about the text.
from generate_jk82_pdf import (  # noqa: E402
    clean,
    clean_for_pdf,
    clean_preserve_newlines,
    decode_latex_math,
    option_lines,
    parse_table_in_text,
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS_DIR = os.path.join(ROOT, "public", "fonts")
IMAGES_DIR = os.path.join(ROOT, "public", "images")

# An option longer than this takes both lanes instead of a half column, so a
# long formula is not squeezed into a narrow one.
WIDE_OPTION_CHARS = 46
WATERMARK_OPACITY = 0.08


def font_url(filename):
    return "file://" + os.path.join(FONTS_DIR, filename).replace(os.sep, "/")


def escape(text):
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


UNDERLINE_MARK = "\u0332"
_UNDERLINED_RUN = re.compile("(?:[^\\s]" + UNDERLINE_MARK + ")+")


def mark_underlines(escaped):
    """Turn combining-underline runs into a real underline.

    decode_latex_math renders \\underline{...} as a low line under each
    character, which is right for a drawn PDF but ragged in HTML. Runs are
    folded into one <u> so the rule is continuous. Applied after escaping, so
    the only tags in the output are the ones added here.
    """

    def fold(match):
        return "<u>" + match.group(0).replace(UNDERLINE_MARK, "") + "</u>"

    return _UNDERLINED_RUN.sub(fold, escaped)


def prepared_text(value):
    """Decode LaTeX, keep author line breaks, drop markdown table rules."""
    return clean_for_pdf(clean_preserve_newlines(decode_latex_math(value or "")))


def watermark_data_uri():
    """A faded copy of the school crest for the page background.

    Faded here rather than with a CSS opacity: a @page background cannot carry
    its own opacity without fading the text drawn over it too.
    """
    path = None
    for name in ("school-logo-exam.png", "school-logo.png"):
        candidate = os.path.join(IMAGES_DIR, name)
        if os.path.isfile(candidate):
            path = candidate
            break
    if not path:
        return None
    try:
        from PIL import Image

        img = Image.open(path).convert("RGBA")
        alpha = img.getchannel("A").point(lambda a: int(a * WATERMARK_OPACITY))
        img.putalpha(alpha)
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()
    except Exception:
        return None


def page_border_data_uri():
    """The double rule around the sheet, as an SVG background.

    @page accepts a background but not a border, so the frame is an image
    sized to the whole page. Millimetres keep it independent of resolution.
    """
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" '
        'viewBox="0 0 210 297">'
        '<rect x="8" y="8" width="194" height="281" fill="none" '
        'stroke="black" stroke-width="0.5"/>'
        '<rect x="11" y="11" width="188" height="275" fill="none" '
        'stroke="black" stroke-width="0.18"/>'
        "</svg>"
    )
    return "data:image/svg+xml;base64," + base64.b64encode(svg.encode()).decode()


def build_styles(school_name, date_str):
    backgrounds = ["url('%s')" % page_border_data_uri()]
    sizes = ["210mm 297mm"]
    positions = ["-18mm -18mm"]
    watermark = watermark_data_uri()
    if watermark:
        backgrounds.append("url('%s')" % watermark)
        sizes.append("52% auto")
        positions.append("center center")
    return """
@font-face {{ font-family: "NotoSans-Regular"; src: url('{sans}'); }}
@font-face {{ font-family: "PlayfairDisplay-Bold"; src: url('{display}'); }}
/* The symbol faces are pinned to the blocks they own and listed first, so a
   symbol is taken from the font that really has it. Left to ordinary
   fallback, NotoSans has no "not equal" but does have the combining solidus,
   so the text was composed as "=" plus an overlay: it looked right on the
   page and came out of the PDF as "=", which breaks search and copy. */
@font-face {{
  font-family: "NotoSansMath-Regular";
  src: url('{math}');
  unicode-range: U+2190-21FF, U+2200-22FF, U+2A00-2AFF, U+20D0-20FF;
}}
@font-face {{
  font-family: "NotoSansSymbols2-Regular";
  src: url('{symbols}');
  unicode-range: U+25A0-25FF;
}}
@font-face {{
  font-family: "NotoSansTelugu-Regular";
  src: url('{telugu}');
  unicode-range: U+0C00-0C7F;
}}

/* Listing the families in order gives per-character fallback for free: a
   glyph missing from one is taken from the next, so a symbol can never be
   drawn as nothing the way it could when the font was picked by hand. */
@page {{
  size: A4;
  margin: 18mm 18mm 20mm 18mm;
  background-image: {backgrounds};
  /* A @page background is positioned against the area inside the margins, so
     the frame is given the sheet's own size and pulled back out by the margin
     to land on the paper edge. Sized in millimetres rather than percentages
     for exactly that reason. */
  background-position: {positions};
  background-size: {sizes};
  background-repeat: no-repeat;

  @bottom-left {{
    content: "{school}";
    font-family: "NotoSans-Regular", "NotoSansTelugu-Regular";
    font-size: 9pt;
    vertical-align: top;
  }}
  @bottom-center {{
    content: "Page " counter(page) " of " counter(pages);
    font-family: "NotoSans-Regular";
    font-size: 9pt;
    vertical-align: top;
  }}
  @bottom-right {{
    content: "{date}";
    font-family: "NotoSans-Regular";
    font-size: 9pt;
    vertical-align: top;
  }}
}}

body {{
  font-family: "NotoSansMath-Regular", "NotoSansSymbols2-Regular",
               "NotoSansTelugu-Regular", "NotoSans-Regular";
  font-size: 11.5pt;
  line-height: 1.5;
  margin: 0;
  color: #000;
}}

.masthead {{ text-align: center; }}
.school {{ font-family: "PlayfairDisplay-Bold", "NotoSans-Regular"; font-size: 25pt; line-height: 1.15; }}
.location {{ font-size: 9pt; font-weight: bold; }}
.exam {{ font-size: 11pt; font-weight: bold; margin-top: 2pt; }}
.subject {{ font-size: 10.5pt; font-weight: bold; }}
.meta {{ font-size: 9.5pt; font-weight: bold; }}
.rule {{ border-bottom: 1px solid #000; margin: 6pt 0 10pt 0; }}

/* A heading printed at the foot of a page with its first question
   overleaf reads as an empty section, so it travels with what follows. */
.section-title {{
  font-size: 12.5pt;
  font-weight: bold;
  margin-top: 10pt;
  break-after: avoid;
}}
.section-instructions {{ break-after: avoid; }}
.section-instructions {{ font-size: 10pt; margin-bottom: 6pt; }}

/* A reading passage shared by the questions printed under it. */
.passage {{
  margin: 6pt 0 8pt 0;
  text-align: justify;
  white-space: pre-wrap;
  line-height: 1.6;
}}

/* Keeping a question with its options is the layout engine's job now; the
   drawing renderer estimated the block height and could still strand one. */
.q {{ break-inside: avoid; margin-bottom: 9pt; }}
.q-head {{ display: flex; align-items: flex-start; gap: 6pt; }}
.q-num {{ flex: 0 0 auto; min-width: 16pt; }}
.q-text {{ flex: 1 1 auto; white-space: pre-wrap; }}
.q-marks {{ flex: 0 0 auto; padding-left: 8pt; white-space: nowrap; }}

/* The figure sits in the question's own row rather than floating beside it:
   .q-head is a flex container and flex items do not flow around a float, so
   a floated figure was drawn over the question text and cut it off. */
.q-figure {{ flex: 0 0 auto; margin-left: 10pt; }}
.q-figure img {{ max-width: 56mm; max-height: 46mm; }}
.figure-missing {{ margin-left: 22pt; font-size: 10pt; }}

/* Two options to a row — A and B, then C and D — the way the papers set
   them. A long option spans both lanes rather than being squeezed. */
.options {{
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1pt 14pt;
  margin: 3pt 0 0 22pt;
  font-size: 10.5pt;
}}
.options .wide {{ grid-column: 1 / -1; }}

table.q-table {{ border-collapse: collapse; margin: 5pt 0 5pt 22pt; font-size: 10pt; }}
table.q-table td {{ border: 0.5pt solid #000; padding: 2pt 5pt; }}
""".format(
        sans=font_url("NotoSans-Regular.ttf"),
        telugu=font_url("NotoSansTelugu-Regular.ttf"),
        math=font_url("NotoSansMath-Regular.ttf"),
        symbols=font_url("NotoSansSymbols2-Regular.ttf"),
        display=font_url("PlayfairDisplay-Bold.ttf"),
        backgrounds=", ".join(backgrounds),
        sizes=", ".join(sizes),
        positions=", ".join(positions),
        school=escape(school_name),
        date=escape(date_str),
    )


def render_options(options):
    lines = option_lines(options)
    if not lines:
        return ""
    cells = [
        '<div class="%s">%s</div>'
        % ("wide" if len(line) > WIDE_OPTION_CHARS else "", escape(line))
        for line in lines
    ]
    return '<div class="options">%s</div>' % "".join(cells)


def render_table_block(rows):
    body = []
    for row in rows:
        cells = "".join("<td>%s</td>" % escape(prepared_text(cell)) for cell in row)
        body.append("<tr>%s</tr>" % cells)
    return '<table class="q-table">%s</table>' % "".join(body)


def render_question(question):
    number = clean(str(question.get("number") or ""))
    marks = int(question.get("marks") or 0)
    before, tables, after = parse_table_in_text(prepared_text(question.get("text", "")))

    figure = ""
    if question.get("diagramStatus") == "ok" and question.get("diagramPath"):
        path = str(question["diagramPath"])
        if os.path.isfile(path):
            src = "file://" + os.path.abspath(path).replace(os.sep, "/")
            figure = '<div class="q-figure"><img src="%s"></div>' % escape(src)
    missing = (
        '<div class="figure-missing">[Diagram unavailable]</div>'
        if question.get("diagramStatus") == "unavailable"
        else ""
    )

    parts = [
        '<div class="q">',
        '<div class="q-head">',
        '<span class="q-num">%s.</span>' % escape(number),
        '<div class="q-text">%s</div>' % mark_underlines(escape("\n".join(before).strip())),
        figure,
        ('<span class="q-marks">[%d m]</span>' % marks) if marks else "",
        "</div>",
    ]
    for rows in tables:
        parts.append(render_table_block(rows))
    tail = mark_underlines(escape("\n".join(after).strip())) if after else ""
    if tail:
        parts.append('<div class="q-text" style="margin-left:22pt">%s</div>' % tail)
    parts.append(missing)
    parts.append(render_options(question.get("options") or []))
    parts.append("</div>")
    return "".join(parts)


def render_sections(sections):
    out = []
    for section in sections:
        title = clean(decode_latex_math(section.get("title") or "SECTION"))
        instructions = clean(decode_latex_math(section.get("instructions") or ""))
        out.append('<div class="section-title">%s</div>' % escape(title))
        if instructions:
            out.append('<div class="section-instructions">%s</div>' % escape(instructions))
        for question in section.get("questions") or []:
            out.append(render_question(question))
    return "".join(out)


def build_html(payload):
    header = payload.get("header", {}) or {}
    school_name = clean(header.get("schoolName") or "Divya High School")
    date_str = date.today().strftime("%d-%m-%Y")

    masthead = [
        '<div class="masthead">',
        '<div class="school">%s</div>' % escape(school_name),
        '<div class="location">%s</div>'
        % escape(clean(header.get("location") or "Bhadrachalam")),
        '<div class="exam">%s</div>'
        % escape(clean(header.get("examTitle") or "PRE-FINAL EXAMINATIONS")),
    ]
    subject = clean(header.get("subject") or "")
    if subject:
        masthead.append('<div class="subject">Subject: %s</div>' % escape(subject))
    meta_bits = [
        "Class: %s" % clean(header.get("class") or ""),
        "Max. Marks: %s" % clean(header.get("maxMarks") or ""),
        "Time: %s" % clean(header.get("time") or ""),
    ]
    if header.get("academicYear"):
        meta_bits.append("Year: %s" % clean(header.get("academicYear")))
    masthead.append('<div class="meta">%s</div>' % escape("    ".join(meta_bits)))
    masthead.append('</div><div class="rule"></div>')

    sections = payload.get("sections") or []
    body = (
        render_sections(sections)
        if sections
        else "".join(render_question(q) for q in payload.get("questions") or [])
    )
    return (
        "<html><head><meta charset='utf-8'><style>%s</style></head><body>%s%s</body></html>"
        % (build_styles(school_name, date_str), "".join(masthead), body)
    )


def assert_path_in_work_dir(path, work_dir):
    if not work_dir:
        return
    real_work = os.path.realpath(work_dir)
    real_path = os.path.realpath(path)
    if real_path != real_work and not real_path.startswith(real_work + os.sep):
        raise SystemExit("output path is outside the request work directory")


def main():
    parser = argparse.ArgumentParser(description="JK-82 exam paper PDF generator.")
    parser.add_argument("--output", dest="output", default=None)
    parser.add_argument("--input", dest="input_path", default=None)
    parser.add_argument("--work-dir", dest="work_dir", default=None)
    args = parser.parse_args()

    try:
        if args.input_path:
            with open(args.input_path, "r", encoding="utf-8") as handle:
                payload = json.load(handle)
        else:
            payload = json.load(sys.stdin)
    except json.JSONDecodeError as error:
        print("Invalid JSON: %s" % error, file=sys.stderr)
        sys.exit(1)

    if not payload.get("questions") and not payload.get("sections"):
        print("No questions provided", file=sys.stderr)
        sys.exit(1)
    if args.output and args.work_dir:
        assert_path_in_work_dir(args.output, args.work_dir)

    from weasyprint import HTML

    pdf_bytes = HTML(string=build_html(payload), base_url=ROOT).write_pdf()
    if args.output:
        with open(args.output, "wb") as handle:
            handle.write(pdf_bytes)
    else:
        sys.stdout.buffer.write(pdf_bytes)


if __name__ == "__main__":
    main()
