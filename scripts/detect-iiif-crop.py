#!/usr/bin/env python3
"""Detect a probable printed-map neatline crop from an IIIF preview."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

Image.MAX_IMAGE_PIXELS = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Detect IIIF preview crop and write source-image crop metadata.")
    parser.add_argument("preview_image", help="Low-resolution IIIF preview image")
    parser.add_argument("info_json", help="IIIF info.json for source dimensions")
    parser.add_argument("--out", required=True, help="Output crop.json path")
    parser.add_argument("--overlay", required=True, help="Output overlay JPG/PNG for human review")
    parser.add_argument("--padding", type=int, default=2, help="Preview-pixel padding around detected crop")
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
    preview_path = Path(args.preview_image)
    info_path = Path(args.info_json)
    out_path = Path(args.out)
    overlay_path = Path(args.overlay)

    info = json.loads(info_path.read_text(encoding="utf-8"))
    source_width = int(info["width"])
    source_height = int(info["height"])

    image = Image.open(preview_path).convert("RGB")
    gray = ImageOps.grayscale(image)
    pixels = gray.load()

    width, height = gray.size
    border_x = max(3, round(width * 0.015))
    border_y = max(3, round(height * 0.015))
    column_counts = [0] * width
    row_counts = [0] * height

    for y in range(border_y, height - border_y):
      for x in range(border_x, width - border_x):
          value = pixels[x, y]
          r, g, b = image.getpixel((x, y))
          # The scan margins are usually pale. Keep dark printed content and neatline marks.
          if value < 225 and max(r, g, b) - min(r, g, b) < 80:
              column_counts[x] += 1
              row_counts[y] += 1

    column_threshold = max(2, round(height * 0.012))
    row_threshold = max(2, round(width * 0.012))
    xs = [x for x, count in enumerate(column_counts) if count >= column_threshold]
    ys = [y for y, count in enumerate(row_counts) if count >= row_threshold]

    if not xs or not ys:
        preview_crop = {"x": 0, "y": 0, "width": width, "height": height}
        status = "manual_fix_needed"
    else:
        left = max(0, min(xs) - args.padding)
        top = max(0, min(ys) - args.padding)
        right = min(width, max(xs) + args.padding + 1)
        bottom = min(height, max(ys) + args.padding + 1)
        preview_crop = {"x": left, "y": top, "width": right - left, "height": bottom - top}
        status = "auto_detected_needs_review"

    scale_x = source_width / width
    scale_y = source_height / height
    source_crop = {
        "x": round(preview_crop["x"] * scale_x),
        "y": round(preview_crop["y"] * scale_y),
        "width": round(preview_crop["width"] * scale_x),
        "height": round(preview_crop["height"] * scale_y),
    }

    crop = {
        "sourceImage": {"width": source_width, "height": source_height},
        "previewImage": {"width": width, "height": height},
        "previewCrop": preview_crop,
        "sourceCrop": source_crop,
        "previewQuad": rect_to_quad(preview_crop),
        "sourceQuad": rect_to_quad(source_crop),
        "status": status,
    }

    overlay = image.copy()
    draw = ImageDraw.Draw(overlay)
    x0 = preview_crop["x"]
    y0 = preview_crop["y"]
    x1 = x0 + preview_crop["width"] - 1
    y1 = y0 + preview_crop["height"] - 1
    draw.rectangle((x0, y0, x1, y1), outline=(210, 50, 40), width=3)
    draw_quad(draw, crop["previewQuad"])

    out_path.parent.mkdir(parents=True, exist_ok=True)
    overlay_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(crop, indent=2), encoding="utf-8")
    overlay.save(overlay_path, quality=94)
    print(f"Wrote {out_path}")
    print(f"Wrote {overlay_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
