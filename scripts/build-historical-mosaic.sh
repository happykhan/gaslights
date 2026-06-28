#!/usr/bin/env bash
set -euo pipefail

ZOOMS="${1:-12-14}"
OUT_DIR="${2:-public/tiles/london-1895}"
VRT_PATH="${3:-build/historical-mosaic/london-1895.vrt}"

mkdir -p build/historical-mosaic
TMP_OUT_DIR="$(mktemp -d build/historical-mosaic/tiles-tmp.XXXXXX)"

cleanup() {
  rm -rf "$TMP_OUT_DIR"
}

trap cleanup EXIT

if [[ "$#" -ge 4 ]]; then
  shift 3
  INPUTS=("$@")
else
  INPUTS=(build/historical-geotiffs/*_3857.tif)
fi

gdalbuildvrt \
  -overwrite \
  "$VRT_PATH" \
  "${INPUTS[@]}"

gdal2tiles.py \
  --xyz \
  -z "$ZOOMS" \
  -r lanczos \
  "$VRT_PATH" \
  "$TMP_OUT_DIR"

mkdir -p "$OUT_DIR"

if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete "$TMP_OUT_DIR"/ "$OUT_DIR"/
else
  rm -rf "$OUT_DIR"
  mkdir -p "$OUT_DIR"
  cp -R "$TMP_OUT_DIR"/. "$OUT_DIR"/
fi
