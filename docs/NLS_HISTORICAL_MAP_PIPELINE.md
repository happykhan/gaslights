# NLS historical map pipeline

Gaslights should self-host historical map tiles. Do not use MapTiler, paid runtime map APIs, paid individual JPG downloads, or hotlinked public viewer tiles.

## Current pilot

The detailed pilot sheet is:

```text
IMAGE: 101201646
SHEET: London - Sheet VII.83
Scale: 1:1056
Revised: 1893 to 1895
Published: 1896
IIIF info: https://map-view.nls.uk/iiif/2/10120%2F101201646/info.json
```

The checked-in pilot manifest is:

```text
data/raw/nls-sheet-index/london-1895-detailed-sheets.manifest.json
```

Replace it later by running `scripts/prepare-nls-sheet-index.mjs` against the full NLS sheet-index GeoJSON.

## Crop review workflow

Download only a low-resolution preview first:

```bash
node scripts/download-iiif-preview.mjs \
  "https://map-view.nls.uk/iiif/2/10120%2F101201646/info.json" \
  data/raw/nls-iiif-sheets/101201646
```

Detect a likely neatline crop and make an overlay. Use the preview filename created by the downloader; the `101201646` sheet currently advertises a `516w` preview.

```bash
python3 scripts/detect-iiif-crop.py \
  data/raw/nls-iiif-sheets/101201646/preview_516w.jpg \
  data/raw/nls-iiif-sheets/101201646/info.json \
  --out data/raw/nls-iiif-sheets/101201646/crop.json \
  --overlay build/iiif-sheets/101201646_crop_overlay.jpg
```

Open the overlay and check that the red rectangle follows the printed map neatline, not the scan edge. If it is good, edit `crop.json` and set:

```json
"status": "reviewed"
```

Only download high-resolution source tiles for reviewed sheets unless deliberately testing.

## High-resolution sheet processing

Download source-image tiles:

```bash
node scripts/download-iiif-sheet.mjs \
  "https://map-view.nls.uk/iiif/2/10120%2F101201646/info.json" \
  data/raw/nls-iiif-sheets/101201646 \
  --delay-ms 200
```

Stitch and crop:

```bash
CROP=$(node -e "const c=require('./data/raw/nls-iiif-sheets/101201646/crop.json').sourceCrop; console.log(c.x, c.y, c.width, c.height)")

python3 scripts/stitch-iiif-sheet.py \
  data/raw/nls-iiif-sheets/101201646 \
  build/iiif-sheets/101201646_cropped_preview_2000.jpg \
  --crop $CROP \
  --preview-width 2000

python3 scripts/stitch-iiif-sheet.py \
  data/raw/nls-iiif-sheets/101201646 \
  build/iiif-sheets/101201646_cropped.tif \
  --crop $CROP
```

Georeference from the manifest footprint:

```bash
node scripts/georeference-nls-sheet.mjs 101201646
```

Build local slippy tiles:

```bash
bash scripts/build-historical-mosaic.sh 14-20
```

The app reads map sources from:

```text
public/data/map-sources.json
```

The target historical layer is:

```text
/tiles/london-1895/{z}/{x}/{y}.png
```

Generated imagery and tiles are ignored by git. Commit scripts, manifests, crop metadata, and provenance only after review.

## Batch workflow

For day-to-day review, use the batch preparer instead of fetching one sheet at a time:

```bash
npm run nls:batch:prep
```

That command will, for every sheet in the manifest:

- download or reuse the listed whole-sheet preview
- run crop detection when the crop is not already marked `reviewed`
- write crop overlays to `build/iiif-sheets/crop-review/`

If you want full-resolution IIIF source tiles only for already reviewed sheets:

```bash
npm run nls:batch:prep -- --full reviewed
```

If you deliberately want full-resolution IIIF source tiles for every sheet in the manifest:

```bash
npm run nls:batch:prep -- --full all --delay-ms 200
```

To render one contact-sheet review board from the prepared previews/crops:

```bash
npm run nls:batch:board
```

That writes:

```text
build/iiif-sheets/crop-review/review-board.jpg
```

Each card shows:

- the crop overlay
- a top-left close-up
- a bottom-right close-up
- the current `L/T/R/B` crop values
- crop status and any short note

To move from one-by-one chat review to batch edits, export the current crop set to a flat table:

```bash
npm run nls:crop:export -- --only-needs-review
```

That writes:

```text
build/iiif-sheets/crop-review/review-table.tsv
```

Edit the `left`, `top`, `right`, `bottom`, `status`, and `reviewNotes` columns in that TSV. Then apply the changes back into every matching `crop.json` and regenerate overlays:

```bash
npm run nls:crop:apply -- --only-reviewed
```

That lets you review a board, bulk-edit the crop table, reapply, and render a fresh board without touching runtime code or re-downloading the previews.

## Interactive crop review

For precise boundary work, use the local review UI instead of editing the TSV directly:

```bash
npm run nls:crop:review -- --port 4177
```

Open:

```text
http://127.0.0.1:4177/
```

The review UI loads the current manifest and preview JPGs, lets you:

- search or step through sheets
- zoom and pan the preview
- drag the left, top, right, or bottom crop edge directly on the image
- inspect full-sheet, top-left, and bottom-right previews
- save updated boundaries straight back into each sheet's `crop.json`

Use the TSV export when you want bulk spreadsheet-style edits. Use the browser UI when you need precise visual crop adjustment.

## Build the reviewed layer into Gaslights

Once a batch of sheets is marked `reviewed`, build them all the way into the app with one command:

```bash
npm run nls:build:reviewed
```

That reviewed-layer build script will:

- download full IIIF source tiles only for sheets whose `crop.json` status is `reviewed`
- stitch each full source image
- apply the reviewed crop from `crop.json`
- georeference each cropped TIFF from the manifest footprint
- rebuild the combined historical mosaic and local `/tiles/london-1895/` tree
- update `public/data/map-sources.json` bounds and bump the tile cache version

Useful variants:

```bash
# Build only specific reviewed sheets
npm run nls:build:reviewed -- --sheet 101201646 --sheet 101201649

# Rebuild the mosaic from already-downloaded/georeferenced reviewed sheets
npm run nls:build:reviewed -- --skip-download --skip-stitch --skip-georeference
```

## Building the manifest from Map Finder exports

If you export outline features from the NLS Map Finder viewer as GeoJSON, you can build the manifest directly from those files without scraping the site:

```bash
npm run nls:manifest:mapfinder -- \
  '/Users/nfareed/Downloads/MapFinderWithOutlinesFeatures (1).geojson' \
  '/Users/nfareed/Downloads/MapFinderWithOutlinesFeatures (2).geojson' \
  '/Users/nfareed/Downloads/MapFinderWithOutlinesFeatures (3).geojson' \
  --bbox -0.25,51.42,0.06,51.56
```

That script:

- merges multiple Map Finder GeoJSON exports
- keeps `London - Sheet ...` features at `1:1056`
- filters to the 1894-1896 edition and excludes later Land Registry / 1930s duplicates
- derives IIIF info URLs
- writes a normal pipeline manifest

This is the cleanest way to build a larger central-London manifest when the exported outline data is available.
