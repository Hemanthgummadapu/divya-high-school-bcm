# Fonts for PDF generation

These SIL Open Font License files are tracked so Railway and Docker builds
do not download fonts at build or runtime.

Required JK-82 fonts:

- `NotoSans-Regular.ttf` — body text
- `NotoSansTelugu-Regular.ttf` — Telugu (U+0C00–U+0C7F)
- `NotoSansSymbols2-Regular.ttf` — geometric shapes
- `NotoSansMath-Regular.ttf` — mathematical operators
- `PlayfairDisplay-Bold.ttf` — school name header

`NotoSans-Bold.ttf` is optional. The generator falls back to Regular.

License: `OFL.txt` (SIL Open Font License 1.1).
Checksums: `SHA256SUMS`.

`npm postinstall` verifies these files and checksums. It does not download fonts.

Telugu: Noto Sans Telugu is registered for U+0C00–U+0C7F. The school English,
Telugu, and mixed fixtures render visible glyphs. ReportLab does not apply
full OpenType Indic shaping, so complex unused conjuncts may not render as a
professional typesetting engine would. This is a known limitation, not complete
Telugu typography coverage.
