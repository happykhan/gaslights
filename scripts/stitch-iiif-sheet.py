#!/usr/bin/env python3
"""Stitch downloaded IIIF source-image tiles into one image.

Usage examples:

  # Create a 2000px-wide preview for crop inspection
  python3 scripts/stitch-iiif-sheet.py \
    data/raw/nls-iiif-sheets/229949411 \
    build/iiif-sheets/229949411_preview_2000.jpg \
    --preview-width 2000

  # Create a cropped full-resolution image after deciding crop coordinates
  python3 scripts/stitch-iiif-sheet.py \
    data/raw/nls-iiif-sheets/229949411 \
    build/iiif-sheets/229949411_cropped.tif \
    --crop X Y WIDTH HEIGHT
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFile

Image.MAX_IMAGE_PIXELS = None
ImageFile.LOAD_TRUNCATED_IMAGES = True


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Stitch IIIF source tiles into one image, optionally cropping/downsampling."
    )
    parser.add_argument("sheet_dir", help="Directory containing tile-index.json and tiles/")
    parser.add_argument("output_image", help="Output image path")
    parser.add_argument(
        "--crop",
        nargs=4,
        type=int,
        metavar=("X", "Y", "WIDTH", "HEIGHT"),
        help="Crop rectangle in full source-image pixels",
    )
    parser.add_argument(
        "--preview-width",
        type=int,
        default=None,
        help="Downsample final stitched/cropped image to this width",
    )
    parser.add_argument(
        "--crop-json",
        default=None,
        help="Optional crop.json path. If sourceQuad exists, apply it as an alpha mask after cropping.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    sheet_dir = Path(args.sheet_dir)
    output_image = Path(args.output_image)
    index_path = sheet_dir / "tile-index.json"
    tiles_dir = sheet_dir / "tiles"

    if not index_path.exists():
        raise FileNotFoundError(f"Missing {index_path}")
    if not tiles_dir.exists():
        raise FileNotFoundError(f"Missing {tiles_dir}")

    index = json.loads(index_path.read_text(encoding="utf-8"))
    width = int(index["width"])
    height = int(index["height"])
    tiles = index["tiles"]

    print(f"Creating {width} x {height} canvas")
    canvas = Image.new("RGB", (width, height), "white")

    for n, tile in enumerate(tiles, start=1):
        tile_path = tiles_dir / tile["filename"]
        if not tile_path.exists():
            raise FileNotFoundError(f"Missing tile: {tile_path}")

        with Image.open(tile_path) as image:
            canvas.paste(image.convert("RGB"), (int(tile["x"]), int(tile["y"])))

        if n % 50 == 0 or n == len(tiles):
            print(f"Pasted {n}/{len(tiles)}")

    if args.crop:
        x, y, w, h = args.crop
        print(f"Cropping to x={x}, y={y}, width={w}, height={h}")
        canvas = canvas.crop((x, y, x + w, y + h))
        if args.crop_json:
            quad = load_localized_quad(Path(args.crop_json), x, y, w, h)
            if quad:
                print("Applying polygon alpha mask from sourceQuad")
                canvas = apply_polygon_mask(canvas, quad)

    if args.preview_width:
        ratio = args.preview_width / canvas.width
        preview_height = round(canvas.height * ratio)
        print(f"Downsampling to {args.preview_width} x {preview_height}")
        canvas = canvas.resize((args.preview_width, preview_height), Image.Resampling.LANCZOS)

    output_image.parent.mkdir(parents=True, exist_ok=True)

    suffix = output_image.suffix.lower()
    if suffix in {".jpg", ".jpeg"}:
        if canvas.mode == "RGBA":
            background = Image.new("RGB", canvas.size, "white")
            background.paste(canvas, mask=canvas.getchannel("A"))
            canvas = background
        canvas.save(output_image, quality=92, optimize=True)
    else:
        canvas.save(output_image)

    print(f"Wrote {output_image}")
    return 0

def load_localized_quad(crop_json_path: Path, crop_x: int, crop_y: int, crop_width: int, crop_height: int):
    crop = json.loads(crop_json_path.read_text(encoding="utf-8"))
    source_quad = crop.get("sourceQuad")
    if not source_quad:
        return None

    def localize(point: dict[str, int]) -> tuple[int, int]:
        return (
            max(0, min(crop_width, int(point["x"]) - crop_x)),
            max(0, min(crop_height, int(point["y"]) - crop_y)),
        )

    return [
        localize(source_quad["topLeft"]),
        localize(source_quad["topRight"]),
        localize(source_quad["bottomRight"]),
        localize(source_quad["bottomLeft"]),
    ]


def apply_polygon_mask(image: Image.Image, quad_points: list[tuple[int, int]]) -> Image.Image:
    rgba = image.convert("RGBA")
    mask = Image.new("L", rgba.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.polygon(quad_points, fill=255)
    rgba.putalpha(mask)
    return rgba


if __name__ == "__main__":
    raise SystemExit(main())
