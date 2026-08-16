#!/bin/sh
set -e
if [ -x venv/bin/python3 ]; then
  exec venv/bin/python3 scripts/test_extract_pdf_v2.py
fi
exec python3 scripts/test_extract_pdf_v2.py
