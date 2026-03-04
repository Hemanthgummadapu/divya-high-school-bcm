#!/usr/bin/env python3
"""
Create exam version of school logo: replace bottom arc "BEST CHOICE" with "BEST OF LUCK".
Reads: public/images/school-logo.png (or path as first arg)
Writes: public/images/school-logo-exam.png (or path as second arg)
Uses Pillow to overlay new text on the bottom arc area.
"""

import os
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Error: Install Pillow: pip install Pillow", file=sys.stderr)
    sys.exit(1)

# Default paths (relative to project root / cwd when run from Node)
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
DEFAULT_INPUT = PROJECT_ROOT / "public" / "images" / "school-logo.png"
DEFAULT_OUTPUT = PROJECT_ROOT / "public" / "images" / "school-logo-exam.png"

# Dark blue for seal text (approximate)
DARK_BLUE = (20, 50, 100)
WHITE = (255, 255, 255)


def main():
    input_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_INPUT
    output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUTPUT

    if not input_path.exists():
        print(f"Error: Logo not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    img = Image.open(input_path).convert("RGBA")
    w, h = img.size

    # Bottom arc region: lower portion of the circular seal (roughly lower 22% of image)
    draw = ImageDraw.Draw(img)
    cover_y1 = int(h * 0.70)
    cover_y2 = int(h * 0.98)
    cover_x1 = int(w * 0.15)
    cover_x2 = int(w * 0.85)
    try:
        bg_pixel = img.getpixel((w // 2, int(h * 0.85)))
        if isinstance(bg_pixel, tuple) and len(bg_pixel) >= 3:
            fill_color = bg_pixel[:3]
        else:
            fill_color = WHITE
    except Exception:
        fill_color = WHITE
    draw.ellipse([cover_x1, cover_y1, cover_x2, cover_y2], fill=fill_color, outline=None)

    font_size = max(14, int(h * 0.065))
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
    except Exception:
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
        except Exception:
            font = ImageFont.load_default()

    text = "BEST OF LUCK"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (w - tw) / 2
    ty = cover_y1 + (cover_y2 - cover_y1 - th) / 2 - 2
    draw.text((tx, ty), text, font=font, fill=DARK_BLUE)

    img.convert("RGB").save(output_path, "PNG")
    if os.environ.get("DEBUG"):
        print(f"Saved: {output_path}")


if __name__ == "__main__":
    main()
