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
