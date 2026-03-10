# Fonts for PDF generation

Place **NotoSans** here for correct rendering of symbols (e.g. log subscripts) in generated question paper PDFs:

- `NotoSans-Regular.ttf` — required for body text
- `NotoSans-Bold.ttf` — optional; used for headers (falls back to Regular if missing)

Download from [Google Fonts](https://fonts.google.com/noto/specimen/Noto+Sans) or the [Noto releases](https://github.com/google/fonts/tree/main/ofl/notosans). The JK-82 PDF generator will use these when present; otherwise it uses system fonts (Segoe UI / Arial on Windows) or Helvetica, and normalizes subscript digits to `_0`–`_9` so "log₁₀" appears as "log_10".
