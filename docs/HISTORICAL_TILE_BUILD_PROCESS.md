# Historical Tile Build Process

This document explains how Gaslights turns reviewed NLS map sheets into the local historical map overlay used by the app.

It is the operational guide for:

- fetching source imagery
- reviewing and storing crop metadata
- stitching and georeferencing sheets
- building the `public/tiles/` map pyramid
- wiring the result into the app

For lower-level command details, also see:

- [`docs/NLS_HISTORICAL_MAP_PIPELINE.md`](./NLS_HISTORICAL_MAP_PIPELINE.md)
- [`docs/IIIF_TILE_DOWNLOAD_WORKFLOW.md`](./IIIF_TILE_DOWNLOAD_WORKFLOW.md)

## What we are building

Gaslights does not hotlink historical map tiles from the public NLS viewer at runtime.

Instead, the runtime historical layer is built locally:

```text
NLS IIIF sheet
  -> low-resolution preview
  -> reviewed crop metadata
  -> full-resolution source tile download
  -> stitched cropped TIFF
  -> georeferenced EPSG:3857 TIFF
  -> combined VRT mosaic
  -> local XYZ tiles in public/tiles/london-1895/
  -> map source entry in public/data/map-sources.json
```

That gives us:

- local historical tiles
- predictable zoom behavior
- no paid runtime dependency
- a data trail for every reviewed sheet

## Core directories

Reviewed and downloaded sheets live here:

```text
data/raw/nls-iiif-sheets/<sheet-id>/
```

Important files per sheet:

- `info.json` — NLS IIIF metadata
- `preview_*w.jpg` — whole-sheet preview for crop review
- `crop.json` — reviewed crop metadata
- `tile-index.json` — downloaded full-resolution IIIF source tile index
- `tiles/` — raw downloaded full-resolution IIIF source tiles

Generated build outputs live here:

```text
build/iiif-sheets/
build/historical-geotiffs/
build/historical-mosaic/
public/tiles/london-1895/
```

Runtime configuration lives here:

```text
public/data/map-sources.json
```

## The pipeline stages

### 1. Build or update the manifest

The manifest defines which map sheets we care about and their footprints.

Current main manifest:

```text
data/raw/nls-sheet-index/london-1895-detailed-sheets.manifest.json
```

If you have NLS Map Finder GeoJSON exports, build or refresh the manifest with:

```bash
npm run nls:manifest:mapfinder -- map_jsons/*.geojson
```

This is what connects sheet IDs to spatial footprints.

### 2. Prepare previews and first-pass crop detection

Download previews and detect initial crops:

```bash
npm run nls:batch:prep
```

This stage:

- downloads/reuses low-resolution whole-sheet previews
- runs initial crop detection
- writes `crop.json`
- renders crop overlays for review

### 3. Review crops

Use the interactive review UI:

```bash
npm run nls:crop:review
```

Then open:

```text
http://127.0.0.1:4177/
```

Reviewers move crop edges/corners until the neatline is correct. The app auto-saves back into:

```text
data/raw/nls-iiif-sheets/<sheet-id>/crop.json
```

Only sheets marked:

```json
"status": "reviewed"
```

should move into the production build flow.

### 4. Download full-resolution source imagery

Once a sheet is reviewed, the build process downloads its full IIIF source tiles.

This is done automatically by:

```bash
npm run nls:build:reviewed
```

or manually per sheet with:

```bash
node scripts/download-iiif-sheet.mjs <iiif-info-url> <out-dir> --delay-ms 200
```

The downloader is resumable. Interrupted downloads can be retried.

### 5. Stitch and crop

The downloaded full-resolution IIIF tiles are stitched into one full image and cropped using the reviewed `sourceCrop` rectangle from `crop.json`.

This is automated by:

```bash
npm run nls:build:reviewed
```

Per-sheet manual equivalent:

```bash
python3 scripts/stitch-iiif-sheet.py \
  data/raw/nls-iiif-sheets/<sheet-id> \
  build/iiif-sheets/<sheet-id>_cropped.tif \
  --crop X Y WIDTH HEIGHT
```

### 6. Georeference

The cropped TIFF is georeferenced from the manifest footprint and warped to EPSG:3857.

Automated by:

```bash
npm run nls:build:reviewed
```

Per-sheet manual equivalent:

```bash
node scripts/georeference-nls-sheet.mjs <sheet-id>
```

Outputs land here:

```text
build/historical-geotiffs/<sheet-id>_3857.tif
```

### 7. Build the combined tile pyramid

All georeferenced sheets are combined into a VRT and then tiled into:

```text
public/tiles/london-1895/
```

Current command:

```bash
bash scripts/build-historical-mosaic.sh 12-20
```

Important note:

- we tile directly from the VRT
- we do **not** build a giant intermediate merged TIFF anymore
- this avoids the large disk-space blow-up we hit earlier

### 8. Wire the overlay into the app

The app reads historical sources from:

```text
public/data/map-sources.json
```

The reviewed-layer build updates:

- tile URL cache version
- historical bounds
- layer notes

The app then loads the local historical overlay from:

```text
/tiles/london-1895/{z}/{x}/{y}.png
```

## Main commands

### Build reviewed sheets end to end

```bash
npm run nls:build:reviewed
```

This is the main command.

It will:

- download missing full-resolution IIIF tiles for reviewed sheets
- stitch and crop them
- georeference them
- rebuild the `london-1895` tile pyramid
- update `public/data/map-sources.json`

### Build only from already-downloaded reviewed sheets

```bash
npm run nls:build:reviewed -- --skip-download
```

Use this when:

- the reviewed sheets are already fully downloaded
- you do not want to hit NLS again
- you just want to rebuild the map overlay

### Rebuild only the tile pyramid

```bash
bash scripts/build-historical-mosaic.sh 12-20
```

Use this when:

- georeferenced TIFFs already exist
- only the pyramid needs rebuilding

### Build specific reviewed sheets only

```bash
npm run nls:build:reviewed -- --sheet 229949411 --sheet 229949414
```

## Current behavior and constraints

### Reviewed-sheet rule

Only sheets with:

```json
"status": "reviewed"
```

should be treated as production-ready.

### Partial download rule

The reviewed build now distinguishes:

- complete downloads
- partial downloads
- missing downloads

If a reviewed sheet is partially downloaded, the build skips it instead of poisoning the whole map build.

### Zoom rule

The current historical build is generated for:

```text
12-20
```

That means the tile pyramid is intentionally available from zoom `12.0` upward.

### Multiple historical eras

The crop review app can now include local sheets that are outside the 1895 manifest, including the 1851 proof-sheet set, as long as their local review files exist.

## Recommended day-to-day workflow

For practical production work:

1. Update or extend the manifest.
2. Run:

```bash
npm run nls:batch:prep
```

3. Review crops in:

```text
http://127.0.0.1:4177/
```

4. Mark acceptable sheets as reviewed.
5. Build the reviewed set:

```bash
npm run nls:build:reviewed -- --skip-download
```

or, if downloads are missing:

```bash
npm run nls:build:reviewed
```

6. Hard reload the app and inspect the historical overlay in the browser.

## What to do when something looks wrong

### Historical layer only appears at higher zooms

Check both:

- app map minimum zoom
- actual generated tile pyramid range in `public/tiles/london-1895/`

If the code says `12` but the tiles only start at `14`, the pyramid must be rebuilt.

### A reviewed sheet does not show up

Check:

- is it in the manifest used for the build?
- does it have `crop.json` with `status: reviewed`?
- does it have a complete `tile-index.json`?
- does its georeferenced TIFF exist?

### Download dies with 503

That is an NLS-side availability problem, not a crop or georeference problem.

Use:

```bash
npm run nls:build:reviewed -- --skip-download
```

to build from already completed reviewed downloads while the failed sheet is retried later.
