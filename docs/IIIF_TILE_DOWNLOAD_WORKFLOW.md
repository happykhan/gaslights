# Gaslights IIIF sheet download workflow

This workflow downloads a single high-resolution NLS IIIF map sheet as source-image tiles. These are **not** slippy map tiles yet.

The current tested sheet is:

```text
https://map-view.nls.uk/iiif/2/22994%2F229949411/info.json
```

The `info.json` reports:

```text
width: 16244
height: 10988
tile size: 512 x 512
maxArea: 270000
listed full-image preview: 508 x 343
```

Because `512 × 512 = 262,144`, 512px source tiles fit below `maxArea`. Requests larger than that may fail.

## 0. Important rules

Do not bulk download hundreds of sheets yet. Test one sheet first.

Do not commit downloaded imagery to git.

Do not assume IIIF technical access is the same thing as production commercial reuse permission. Keep provenance for every sheet.

## 1. Add gitignore rules

Add this to `.gitignore`:

```gitignore
# Raw IIIF/NLS downloaded imagery should not be committed
data/raw/nls-iiif-sheets/**/tiles/
data/raw/nls-iiif-sheets/**/*.jpg
data/raw/nls-iiif-sheets/**/*.jpeg
data/raw/nls-iiif-sheets/**/*.png
data/raw/nls-iiif-sheets/**/*.tif
data/raw/nls-iiif-sheets/**/*.tiff

# Optional stitched outputs are large and local only
build/iiif-sheets/
```

Keep small provenance/metadata files such as `info.json`, `download-metadata.json`, `tile-index.json`, and `source.md` if they are useful.

## 2. Create folders

```bash
mkdir -p scripts
mkdir -p data/raw/nls-iiif-sheets/229949411
mkdir -p build/iiif-sheets
```

## 3. Install the downloader script

Copy `scripts/download-iiif-sheet.mjs` into the repo.

It uses Node's built-in `fetch`, so no npm dependency is needed on current Node versions.

## 4. Dry run

```bash
node scripts/download-iiif-sheet.mjs \
  "https://map-view.nls.uk/iiif/2/22994%2F229949411/info.json" \
  data/raw/nls-iiif-sheets/229949411 \
  --dry-run
```

Expected metadata:

```text
width: 16244
height: 10988
tileWidth: 512
tileHeight: 512
totalColumns: 32
totalRows: 22
totalTiles: 704
```

## 5. Test only a few tiles

```bash
node scripts/download-iiif-sheet.mjs \
  "https://map-view.nls.uk/iiif/2/22994%2F229949411/info.json" \
  data/raw/nls-iiif-sheets/229949411 \
  --limit 4
```

Check the files:

```bash
file data/raw/nls-iiif-sheets/229949411/preview_508w.jpg
file data/raw/nls-iiif-sheets/229949411/tiles/*.jpg
```

You should see valid JPEG files. The preview is low-resolution but whole-sheet. The tiles are high-resolution source crops.

## 6. Download the full sheet

```bash
node scripts/download-iiif-sheet.mjs \
  "https://map-view.nls.uk/iiif/2/22994%2F229949411/info.json" \
  data/raw/nls-iiif-sheets/229949411 \
  --delay-ms 200
```

Expected output:

```text
704 tiles
```

The script is resumable. If interrupted, run the same command again and it will skip existing non-empty files unless `--force` is used.

## 7. Inspect output

```bash
ls data/raw/nls-iiif-sheets/229949411
ls data/raw/nls-iiif-sheets/229949411/tiles | wc -l
cat data/raw/nls-iiif-sheets/229949411/download-metadata.json
```

Expected structure:

```text
data/raw/nls-iiif-sheets/229949411/
  info.json
  source.md
  download-metadata.json
  preview_508w.jpg
  tile-index.json
  tiles/
    0_0_512_512.jpg
    512_0_512_512.jpg
    ...
```

## 8. Optional: stitch for local inspection

Copy `scripts/stitch-iiif-sheet.py` into the repo.

Install Pillow:

```bash
python3 -m pip install pillow
```

Run:

```bash
python3 scripts/stitch-iiif-sheet.py \
  data/raw/nls-iiif-sheets/229949411 \
  build/iiif-sheets/229949411_stitched.jpg
```

This produces a single large image. It is still **not georeferenced**.

## 9. What this does and does not solve

This workflow solves:

```text
NLS IIIF source image → clean high-resolution local source tiles
```

It does not yet solve:

```text
source tiles → georeferenced map layer → MapLibre slippy tiles
```

The next pipeline stage is:

```text
IIIF source tiles
  ↓
stitch/VRT
  ↓
georeference sheet or use sheet footprint/control points
  ↓
warp to EPSG:3857
  ↓
generate /public/tiles/london-1895/{z}/{x}/{y}.webp
  ↓
wire into Gaslights map source registry
```

## 10. Why not request the whole image?

The server advertises `maxArea: 270000`. A 512×512 tile is 262,144 pixels, which is under that limit. A full-image preview at 1000px wide is around 676,000 pixels, which exceeds the limit and is rejected.

Use the listed preview size of 508px wide for a whole-sheet preview and use 512×512 region requests for high-resolution source data.
