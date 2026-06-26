#!/usr/bin/env python3
"""Render a batch crop review board from prepared NLS preview/crop files."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

Image.MAX_IMAGE_PIXELS = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render a crop review contact sheet.")
    parser.add_argument(
        "--manifest",
        default="data/raw/nls-sheet-index/london-1895-detailed-sheets.manifest.json",
        help="Manifest JSON path",
    )
    parser.add_argument(
        "--out",
        default="build/iiif-sheets/crop-review/review-board.jpg",
        help="Output image path",
    )
    parser.add_argument(
        "--columns",
        type=int,
        default=3,
        help="Number of grid columns",
    )
    parser.add_argument(
        "--sheet",
        action="append",
        default=[],
        help="Limit to one sheet imageId; repeatable",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    sheets = manifest.get("sheets", manifest)
    if args.sheet:
        wanted = set(args.sheet)
        sheets = [sheet for sheet in sheets if sheet["imageId"] in wanted]

    cards = []
    for sheet in sheets:
        card = build_card(sheet)
        if card:
            cards.append(card)

    if not cards:
        raise SystemExit("No reviewable sheets found.")

    board = render_board(cards, columns=max(1, args.columns))
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    board.save(out_path, quality=92)
    print(f"Wrote {out_path}")
    return 0


def build_card(sheet: dict) -> Image.Image | None:
    sheet_id = sheet["imageId"]
    sheet_dir = Path("data/raw/nls-iiif-sheets") / sheet_id
    crop_path = sheet_dir / "crop.json"
    preview_path = next(sheet_dir.glob("preview_*w.*"), None)
    if not preview_path or not crop_path.exists():
      return None

    crop = json.loads(crop_path.read_text(encoding="utf-8"))
    preview = Image.open(preview_path).convert("RGB")
    overlay_path = Path("build/iiif-sheets/crop-review") / f"{sheet_id}-crop-overlay.jpg"
    overlay = Image.open(overlay_path).convert("RGB") if overlay_path.exists() else preview

    left = int(crop["previewCrop"]["x"])
    top = int(crop["previewCrop"]["y"])
    width = int(crop["previewCrop"]["width"])
    height = int(crop["previewCrop"]["height"])
    right = left + width
    bottom = top + height

    card_w = 560
    card_h = 390
    card = Image.new("RGB", (card_w, card_h), "#f3eee2")
    draw = ImageDraw.Draw(card)
    title_font, body_font, mono_font = load_fonts()

    draw.rounded_rectangle((0, 0, card_w - 1, card_h - 1), radius=10, outline="#8d7d65", width=2, fill="#f3eee2")
    draw.text((18, 14), f"{sheet_id}  {sheet.get('sheet', '')}", fill="#2e2418", font=title_font)
    draw.text((18, 42), crop.get("status", "unknown"), fill="#7a3d1f", font=body_font)

    overlay_box = fit_image(overlay, 330, 220)
    card.paste(overlay_box, (18, 78))

    top_left = zoom_region(preview, left, top, 90, 90, 180, 120)
    bottom_right = zoom_region(preview, right, bottom, 90, 90, 180, 120)
    card.paste(top_left, (362, 78))
    card.paste(bottom_right, (362, 178))
    draw.rectangle((362, 78, 542, 198), outline="#8d7d65", width=1)
    draw.rectangle((362, 178, 542, 298), outline="#8d7d65", width=1)
    draw.text((368, 82), "top-left", fill="#2e2418", font=body_font)
    draw.text((368, 182), "bottom-right", fill="#2e2418", font=body_font)

    crop_line = f"L{left} T{top} R{right} B{bottom}"
    draw.text((18, 315), crop_line, fill="#2e2418", font=mono_font)
    note = sheet.get("notes") or crop.get("reviewNotes") or ""
    draw.multiline_text((18, 340), trim(note, 95), fill="#514338", font=body_font, spacing=4)
    return card


def render_board(cards: list[Image.Image], columns: int) -> Image.Image:
    margin = 20
    gutter = 16
    card_w, card_h = cards[0].size
    rows = math.ceil(len(cards) / columns)
    board_w = margin * 2 + columns * card_w + (columns - 1) * gutter
    board_h = margin * 2 + rows * card_h + (rows - 1) * gutter
    board = Image.new("RGB", (board_w, board_h), "#e6dcc9")
    for idx, card in enumerate(cards):
        row = idx // columns
        col = idx % columns
        x = margin + col * (card_w + gutter)
        y = margin + row * (card_h + gutter)
        board.paste(card, (x, y))
    return board


def fit_image(image: Image.Image, width: int, height: int) -> Image.Image:
    copy = image.copy()
    copy.thumbnail((width, height))
    canvas = Image.new("RGB", (width, height), "white")
    x = (width - copy.width) // 2
    y = (height - copy.height) // 2
    canvas.paste(copy, (x, y))
    return canvas


def zoom_region(image: Image.Image, center_x: int, center_y: int, src_w: int, src_h: int, out_w: int, out_h: int) -> Image.Image:
    left = max(0, center_x - src_w // 2)
    top = max(0, center_y - src_h // 2)
    right = min(image.width, left + src_w)
    bottom = min(image.height, top + src_h)
    region = image.crop((left, top, right, bottom))
    return region.resize((out_w, out_h), Image.Resampling.LANCZOS)


def load_fonts() -> tuple[ImageFont.FreeTypeFont | ImageFont.ImageFont, ...]:
    for path in [
        "/System/Library/Fonts/Supplemental/Georgia.ttf",
        "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
    ]:
        if Path(path).exists():
            return (
                ImageFont.truetype(path, 20),
                ImageFont.truetype(path, 14),
                ImageFont.truetype("/System/Library/Fonts/Supplemental/Courier New.ttf", 14)
                if Path("/System/Library/Fonts/Supplemental/Courier New.ttf").exists()
                else ImageFont.truetype(path, 14),
            )
    default = ImageFont.load_default()
    return default, default, default


def trim(text: str, limit: int) -> str:
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


if __name__ == "__main__":
    raise SystemExit(main())
