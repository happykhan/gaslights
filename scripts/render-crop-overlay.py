#!/usr/bin/env python3
"""Render a crop overlay from an existing reviewed crop.json without modifying it."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw

Image.MAX_IMAGE_PIXELS = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render crop overlay from existing crop.json")
    parser.add_argument("preview_image", help="Preview image path")
    parser.add_argument("crop_json", help="crop.json path")
    parser.add_argument("--overlay", required=True, help="Output overlay JPG/PNG")
    return parser.parse_args()


def rect_to_quad(rect: dict[str, int]) -> dict[str, dict[str, int]]:
    x0 = int(rect["x"])
    y0 = int(rect["y"])
    x1 = x0 + int(rect["width"])
    y1 = y0 + int(rect["height"])
    return {
        "topLeft": {"x": x0, "y": y0},
        "topRight": {"x": x1, "y": y0},
        "bottomRight": {"x": x1, "y": y1},
        "bottomLeft": {"x": x0, "y": y1},
    }


def draw_quad(draw: ImageDraw.ImageDraw, quad: dict[str, dict[str, int]]) -> None:
    points = [
        (int(quad["topLeft"]["x"]), int(quad["topLeft"]["y"])),
        (int(quad["topRight"]["x"]), int(quad["topRight"]["y"])),
        (int(quad["bottomRight"]["x"]), int(quad["bottomRight"]["y"])),
        (int(quad["bottomLeft"]["x"]), int(quad["bottomLeft"]["y"])),
        (int(quad["topLeft"]["x"]), int(quad["topLeft"]["y"])),
    ]
    draw.line(points, fill=(255, 205, 64), width=2)


def main() -> int:
    args = parse_args()
    preview = Image.open(args.preview_image).convert("RGB")
    crop = json.loads(Path(args.crop_json).read_text(encoding="utf-8"))
    preview_crop = crop["previewCrop"]
    preview_quad = crop.get("previewQuad") or rect_to_quad(preview_crop)

    x0 = int(preview_crop["x"])
    y0 = int(preview_crop["y"])
    x1 = x0 + int(preview_crop["width"]) - 1
    y1 = y0 + int(preview_crop["height"]) - 1

    overlay = preview.copy()
    draw = ImageDraw.Draw(overlay)
    draw.rectangle((x0, y0, x1, y1), outline=(210, 50, 40), width=3)
    draw_quad(draw, preview_quad)

    out_path = Path(args.overlay)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    overlay.save(out_path, quality=94)
    print(f"Wrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
