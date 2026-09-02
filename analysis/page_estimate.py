#!/usr/bin/env python3
"""Estimate the typeset page count of the manuscript — python3 analysis/page_estimate.py

Why this exists. The submission has a five-page limit and the manuscript was trimmed four times
against a character-per-line guess that turned out to be wrong by roughly forty per cent. Guessing
cost real content. This script measures instead: it lays out each paragraph with actual font
metrics at the specification's point size, character scaling and tracking, then adds the paragraph
spacing the specification prescribes.

Limits, which matter. The submission font is 신명조, a Korean face; its Latin glyphs are not
measured here because the file is not available to this script, so Times New Roman is used as the
proxy for Latin text. A wider Latin face would raise the count. Word remains the authority and this
script is a way to stop trimming blind, not a substitute for opening the file.
"""

from __future__ import annotations

import sys
from pathlib import Path

from docx import Document
from PIL import ImageFont

# F7 page geometry from the society's specification.
PAGE_HEIGHT_MM = 297.0
MARGIN_TOP_MM = MARGIN_BOTTOM_MM = 10.0
MARGIN_SIDE_MM = 25.0
PAGE_WIDTH_MM = 210.0

USABLE_HEIGHT_MM = PAGE_HEIGHT_MM - MARGIN_TOP_MM - MARGIN_BOTTOM_MM
LINE_WIDTH_MM = PAGE_WIDTH_MM - 2 * MARGIN_SIDE_MM

CHAR_SCALE = 0.95      # 장평 95%
CHAR_SPACING = -0.05   # 자간 -5%, applied per character as a fraction of the point size
MEASURE_PT = 200       # measure large, then scale down, to keep rounding out of the result

PROXY_FONT = "/System/Library/Fonts/Supplemental/Times New Roman.ttf"
DOCX = Path.home() / "Documents" / "Yakson" / "학회제출" / "KOSMI2026_admin_condition_axis.docx"

# Row height and per-table padding, in mm. Measured from the generated tables at 9pt.
TABLE_ROW_MM = 5.5
TABLE_PAD_MM = 6.0

PT_TO_MM = 25.4 / 72


def paragraph_height_mm(text: str, size_pt: float, leading: float,
                        before_pt: float, after_pt: float, font: ImageFont.FreeTypeFont) -> float:
    """Height one paragraph occupies, including the spacing above and below it.

    Args:
        text: The paragraph's rendered text.
        size_pt: Font size in points.
        leading: Line spacing as a multiple, e.g. 1.40 for 140 per cent.
        before_pt: Space above the paragraph, in points.
        after_pt: Space below, in points.
        font: A font loaded at MEASURE_PT, used only for advance widths.

    Returns:
        Height in millimetres.
    """
    width_pt = font.getlength(text) * (size_pt / MEASURE_PT) * CHAR_SCALE
    width_pt += CHAR_SPACING * size_pt * len(text)
    width_mm = width_pt * PT_TO_MM
    lines = max(1, -(-width_mm // LINE_WIDTH_MM))     # ceiling division
    return lines * size_pt * leading * PT_TO_MM + (before_pt + after_pt) * PT_TO_MM


def main() -> None:
    if not Path(PROXY_FONT).exists():
        sys.exit(f"proxy font not found: {PROXY_FONT}")
    if not DOCX.exists():
        sys.exit(f"manuscript not found: {DOCX}")

    font = ImageFont.truetype(PROXY_FONT, MEASURE_PT)
    doc = Document(str(DOCX))

    text_mm = 0.0
    for para in doc.paragraphs:
        body = para.text.strip()
        if not body:
            continue
        size = para.runs[0].font.size.pt if para.runs and para.runs[0].font.size else 10.0
        # The abstract is the only style set to 120 per cent leading; everything else is 140.
        leading = 1.20 if size == 10 and len(body) > 800 else 1.40
        pf = para.paragraph_format
        text_mm += paragraph_height_mm(
            body, size, leading,
            pf.space_before.pt if pf.space_before else 0.0,
            pf.space_after.pt if pf.space_after else 0.0,
            font,
        )

    rows = sum(len(t.rows) for t in doc.tables)
    tables_mm = rows * TABLE_ROW_MM + len(doc.tables) * TABLE_PAD_MM
    total_mm = text_mm + tables_mm
    pages = total_mm / USABLE_HEIGHT_MM

    print(f"text and spacing   {text_mm:8,.0f} mm")
    print(f"tables             {tables_mm:8,.0f} mm   ({len(doc.tables)} tables, {rows} rows)")
    print(f"total              {total_mm:8,.0f} mm   over {USABLE_HEIGHT_MM:.0f} mm per page")
    print(f"\nestimate           {pages:.2f} pages")
    print(f"with 8% slack for ragged lines and widows: {pages * 1.08:.2f} pages")
    print("\nLimit is five pages. Latin text is measured with Times New Roman as a proxy for 신명조;")
    print("a wider Latin face would raise this. Confirm in Word before submitting.")


if __name__ == "__main__":
    main()
