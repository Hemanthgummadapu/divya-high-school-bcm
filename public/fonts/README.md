# Fonts for PDF generation

Place **NotoSans** here for correct rendering of symbols (e.g. log subscripts) in generated question paper PDFs:

- `NotoSans-Regular.ttf` — required for body text
- `NotoSans-Bold.ttf` — optional; used for headers (falls back to Regular if missing)
- `NotoSansTelugu-Regular.ttf` — required for Telugu question text
- `NotoSansSymbols2-Regular.ttf` and `NotoSansMath-Regular.ttf` — symbols and operators
- `PlayfairDisplay-Bold.ttf` — school name

All of these fonts are licensed under the [SIL Open Font License](https://scripts.sil.org/OFL). `npm postinstall` and the Docker image download them into this folder. The JK-82 generator registers Noto Sans Telugu for U+0C00–U+0C7F so Telugu is not replaced with boxes.
