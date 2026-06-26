#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const options = {
  manifest: "data/raw/nls-sheet-index/london-1895-six-inch.manifest.json",
  delayMs: 200,
  zooms: "12-20",
  forceDownload: false,
  forceStitch: false,
  forceGeoreference: false,
  skipDownload: false,
  skipStitch: false,
  skipGeoreference: false,
  skipMosaic: false,
  updateMapSources: true,
  sheetIds: new Set()
};

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--manifest") {
    options.manifest = args[++i];
  } else if (arg === "--delay-ms") {
    options.delayMs = Number(args[++i]);
  } else if (arg === "--zooms") {
    options.zooms = args[++i];
  } else if (arg === "--force-download") {
    options.forceDownload = true;
  } else if (arg === "--force-stitch") {
    options.forceStitch = true;
  } else if (arg === "--force-georeference") {
    options.forceGeoreference = true;
  } else if (arg === "--skip-download") {
    options.skipDownload = true;
  } else if (arg === "--skip-stitch") {
    options.skipStitch = true;
  } else if (arg === "--skip-georeference") {
    options.skipGeoreference = true;
  } else if (arg === "--skip-mosaic") {
    options.skipMosaic = true;
  } else if (arg === "--no-update-map-sources") {
    options.updateMapSources = false;
  } else if (arg === "--sheet") {
    options.sheetIds.add(args[++i]);
  } else if (arg === "--help" || arg === "-h") {
    usage(0);
  } else {
    console.error(`Unknown option: ${arg}`);
    usage(1);
  }
}

if (!Number.isFinite(options.delayMs) || options.delayMs < 0) {
  throw new Error("--delay-ms must be a non-negative number");
}

const manifest = JSON.parse(fs.readFileSync(options.manifest, "utf8"));
const allSheets = manifest.sheets || manifest;
const targetConfig = resolveTargetConfig(manifest, options.manifest);
const reviewedSheets = allSheets
  .filter((sheet) => !options.sheetIds.size || options.sheetIds.has(sheet.imageId))
  .filter((sheet) => {
    const crop = readJsonIfExists(path.join("data/raw/nls-iiif-sheets", sheet.imageId, "crop.json"));
    return crop?.status === "reviewed";
  });

if (!reviewedSheets.length) {
  console.log("No reviewed sheets matched the requested filters.");
  process.exit(0);
}

const summary = {
  reviewedSheets: reviewedSheets.length,
  usableReviewedSheets: 0,
  downloaded: 0,
  stitched: 0,
  georeferenced: 0,
  skippedDownload: 0,
  skippedStitch: 0,
  skippedGeoreference: 0,
  skippedIncomplete: 0,
  mosaicRebuilt: false,
  mapSourcesUpdated: false,
  skippedSheets: []
};

const builtSheets = [];

for (const sheet of reviewedSheets) {
  const sheetId = sheet.imageId;
  const sheetDir = path.join("data/raw/nls-iiif-sheets", sheetId);
  const tileIndexPath = path.join(sheetDir, "tile-index.json");
  const cropPath = path.join(sheetDir, "crop.json");
  const crop = readJsonIfExists(cropPath);
  const croppedPath = path.join("build/iiif-sheets", `${sheetId}_cropped.tif`);
  const warpedPath = path.join("build/historical-geotiffs", `${sheetId}_3857.tif`);

  console.log(`\n=== ${sheetId} ${sheet.sheet || ""}`.trim());

  let downloadState = getDownloadState(tileIndexPath);

  if (!options.skipDownload) {
    if (options.forceDownload || downloadState !== "complete") {
      run("node", [
        "scripts/download-iiif-sheet.mjs",
        sheet.iiifInfoUrl,
        sheetDir,
        "--delay-ms", String(options.delayMs),
        ...(options.forceDownload ? ["--force"] : [])
      ]);
      summary.downloaded += 1;
      downloadState = getDownloadState(tileIndexPath);
    } else {
      console.log(`Skipping full download for ${sheetId}; full tile set already exists`);
      summary.skippedDownload += 1;
    }
  }

  if (downloadState !== "complete") {
    console.log(`Skipping ${sheetId}; tile download is ${downloadState}`);
    summary.skippedIncomplete += 1;
    summary.skippedSheets.push({ sheetId, sheet: sheet.sheet || "", reason: `download_${downloadState}` });
    continue;
  }

  summary.usableReviewedSheets += 1;

  if (!options.skipStitch) {
    if (options.forceStitch || !fs.existsSync(croppedPath)) {
      ensureFile(tileIndexPath, `Missing ${tileIndexPath}; download stage must run first`);
      run("python3", [
        "scripts/stitch-iiif-sheet.py",
        sheetDir,
        croppedPath,
        "--crop",
        String(crop.sourceCrop.x),
        String(crop.sourceCrop.y),
        String(crop.sourceCrop.width),
        String(crop.sourceCrop.height),
        "--crop-json",
        cropPath
      ]);
      summary.stitched += 1;
    } else {
      console.log(`Skipping stitch for ${sheetId}; cropped TIFF already exists`);
      summary.skippedStitch += 1;
    }
  }

  if (!options.skipGeoreference) {
    if (options.forceGeoreference || !fs.existsSync(warpedPath)) {
      ensureFile(croppedPath, `Missing ${croppedPath}; stitch stage must run first`);
      run("node", [
        "scripts/georeference-nls-sheet.mjs",
        sheetId,
        options.manifest
      ]);
      summary.georeferenced += 1;
    } else {
      console.log(`Skipping georeference for ${sheetId}; warped GeoTIFF already exists`);
      summary.skippedGeoreference += 1;
    }
  }

  builtSheets.push(sheet);
}

if (!builtSheets.length) {
  console.log("\nNo reviewed sheets with complete downloads were available to build.");
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

if (!options.skipMosaic) {
  const mosaicSheets = allSheets.filter((sheet) => {
    const crop = readJsonIfExists(path.join("data/raw/nls-iiif-sheets", sheet.imageId, "crop.json"));
    const warpedPath = path.join("build/historical-geotiffs", `${sheet.imageId}_3857.tif`);
    return crop?.status === "reviewed" && fs.existsSync(warpedPath);
  });
  const mosaicInputs = mosaicSheets.map((sheet) => path.join("build/historical-geotiffs", `${sheet.imageId}_3857.tif`));
  if (!mosaicInputs.length) {
    throw new Error(`No georeferenced reviewed sheets available for mosaic target ${targetConfig.sourceId}`);
  }
  run("bash", [
    "scripts/build-historical-mosaic.sh",
    options.zooms,
    targetConfig.tileDir,
    targetConfig.vrtPath,
    ...mosaicInputs
  ]);
  summary.mosaicRebuilt = true;
}

if (options.updateMapSources) {
  const availableSheets = allSheets.filter((sheet) => {
    const crop = readJsonIfExists(path.join("data/raw/nls-iiif-sheets", sheet.imageId, "crop.json"));
    const warpedPath = path.join("build/historical-geotiffs", `${sheet.imageId}_3857.tif`);
    return crop?.status === "reviewed" && fs.existsSync(warpedPath);
  });
  updateHistoricalMapSource(availableSheets, targetConfig);
  summary.mapSourcesUpdated = true;
}

console.log("\nReviewed historical build complete.");
console.log(JSON.stringify(summary, null, 2));

function usage(exitCode) {
  console.error(`Usage:
  node scripts/build-reviewed-historical-layer.mjs [options]

Options:
  --manifest <path>          Manifest JSON. Default: ${options.manifest}
  --delay-ms <n>             Delay between IIIF tile requests. Default: ${options.delayMs}
  --zooms <range>            gdal2tiles zoom range. Default: ${options.zooms}
  --sheet <imageId>          Limit to one reviewed sheet; repeatable
  --force-download           Re-download IIIF source tiles
  --force-stitch             Re-stitch cropped TIFF
  --force-georeference       Re-run georeference
  --skip-download            Skip IIIF source download stage
  --skip-stitch              Skip stitch/crop stage
  --skip-georeference        Skip georeference stage
  --skip-mosaic              Skip final mosaic/tile rebuild
  --no-update-map-sources    Leave public/data/map-sources.json unchanged

Examples:
  node scripts/build-reviewed-historical-layer.mjs
  node scripts/build-reviewed-historical-layer.mjs --sheet 101201646 --sheet 101201649
  node scripts/build-reviewed-historical-layer.mjs --skip-download --skip-mosaic
`);
  process.exit(exitCode);
}

function run(command, commandArgs) {
  console.log([command, ...commandArgs].join(" "));
  const result = spawnSync(command, commandArgs, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}

function readJsonIfExists(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function ensureFile(filePath, message) {
  if (!fs.existsSync(filePath)) {
    throw new Error(message);
  }
}

function getDownloadState(tileIndexPath) {
  const index = readJsonIfExists(tileIndexPath);
  if (!index) return "missing";
  const planned = Number(index.plannedTiles || index.totalTiles || 0);
  const actual = Array.isArray(index.tiles) ? index.tiles.length : 0;
  if (!planned) return actual > 0 ? "partial" : "missing";
  return actual >= planned ? "complete" : "partial";
}

function updateHistoricalMapSource(reviewed, targetConfig) {
  const mapSourcesPath = "public/data/map-sources.json";
  const sources = JSON.parse(fs.readFileSync(mapSourcesPath, "utf8"));
  const historical = sources.find((source) => source.id === targetConfig.sourceId);
  if (!historical) throw new Error(`Missing ${targetConfig.sourceId} source in ${mapSourcesPath}`);

  const bounds = combineBounds(reviewed.map((sheet) => sheet.bounds));
  const version = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 12);
  historical.label = targetConfig.label;
  historical.bounds = [bounds.west, bounds.south, bounds.east, bounds.north];
  historical.minzoom = targetConfig.minzoom;
  historical.maxzoom = targetConfig.maxzoom;
  historical.tiles = [`/tiles/${targetConfig.tileSlug}/{z}/{x}/{y}.png?v=${version}`];
  historical.attribution = targetConfig.attribution;
  historical.notes = `Generated from ${reviewed.length} reviewed sheets for ${targetConfig.label}; updated ${new Date().toISOString()}.`;
  delete historical.devOnly;

  fs.writeFileSync(mapSourcesPath, `${JSON.stringify(sources, null, 2)}\n`);
  console.log(`Updated ${mapSourcesPath}`);
}

function combineBounds(boundsList) {
  return boundsList.reduce((acc, bounds) => ({
    west: Math.min(acc.west, bounds.west),
    south: Math.min(acc.south, bounds.south),
    east: Math.max(acc.east, bounds.east),
    north: Math.max(acc.north, bounds.north)
  }), {
    west: Infinity,
    south: Infinity,
    east: -Infinity,
    north: -Infinity
  });
}

function setTileVersion(tileUrl, version) {
  const url = new URL(tileUrl, "http://local.invalid");
  url.searchParams.set("v", version);
  const pathname = decodeURIComponent(url.pathname);
  return tileUrl.startsWith("http://") || tileUrl.startsWith("https://")
    ? `${url.origin}${pathname}${url.search}`
    : `${pathname}${url.search}`;
}

function resolveTargetConfig(manifest, manifestPath) {
  const series = manifest?.filter?.series || inferSeriesFromPath(manifestPath);
  if (series === "6inch1890s") {
    return {
      series,
      sourceId: "london-1895-six-inch-local",
      label: "London 1895 six-inch",
      tileSlug: "london-1895-six-inch",
      tileDir: "public/tiles/london-1895-six-inch",
      vrtPath: "build/historical-mosaic/london-1895-six-inch.vrt",
      minzoom: 11,
      maxzoom: 20,
      attribution: "Historical mapping derived from out-of-copyright Ordnance Survey/NLS six-inch source material; provenance recorded per sheet."
    };
  }
  if (series === "1851") {
    return {
      series,
      sourceId: "london-1851-proof-local",
      label: "London 1851",
      tileSlug: "london-1851",
      tileDir: "public/tiles/london-1851",
      vrtPath: "build/historical-mosaic/london-1851.vrt",
      minzoom: 12,
      maxzoom: 20,
      attribution: "Historical mapping derived from out-of-copyright Ordnance Survey/NLS source material; provenance recorded per sheet."
    };
  }
  return {
    series: "1895",
    sourceId: "london-1895-local",
    label: "London 1895",
    tileSlug: "london-1895",
    tileDir: "public/tiles/london-1895",
    vrtPath: "build/historical-mosaic/london-1895.vrt",
    minzoom: 12,
    maxzoom: 20,
    attribution: "Historical mapping derived from out-of-copyright Ordnance Survey/NLS source material; provenance recorded per sheet."
  };
}

function inferSeriesFromPath(manifestPath) {
  if (/6-?inch|six-?inch/i.test(manifestPath)) return "6inch1890s";
  return /1851/i.test(manifestPath) ? "1851" : "1895";
}
