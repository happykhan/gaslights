#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const sheetId = args[0];
const manifestPath = args[1] || "data/raw/nls-sheet-index/london-1895-detailed-sheets.manifest.json";

if (!sheetId) {
  console.error(`Usage:
  node scripts/georeference-nls-sheet.mjs <sheet-id> [manifest.json]

Requires:
  data/raw/nls-iiif-sheets/<sheet-id>/crop.json
  build/iiif-sheets/<sheet-id>_cropped.tif
`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const sheet = (manifest.sheets || manifest).find((item) => item.imageId === sheetId);
if (!sheet) throw new Error(`Sheet ${sheetId} not found in ${manifestPath}`);

const cropPath = `data/raw/nls-iiif-sheets/${sheetId}/crop.json`;
const croppedPath = `build/iiif-sheets/${sheetId}_cropped.tif`;
const gcpsPath = `build/iiif-sheets/${sheetId}_gcps.tif`;
const warpedPath = `build/historical-geotiffs/${sheetId}_3857.tif`;

const crop = JSON.parse(fs.readFileSync(cropPath, "utf8"));
const width = crop.sourceCrop.width;
const height = crop.sourceCrop.height;
const { west, south, east, north } = sheet.bounds;
const sourceQuad = normalizeQuad(crop.sourceQuad, crop.sourceCrop, width, height);

fs.mkdirSync(path.dirname(warpedPath), { recursive: true });

run("gdal_translate", [
  "-of", "GTiff",
  "-a_srs", "EPSG:4326",
  "-gcp", String(sourceQuad.topLeft.x), String(sourceQuad.topLeft.y), String(west), String(north),
  "-gcp", String(sourceQuad.topRight.x), String(sourceQuad.topRight.y), String(east), String(north),
  "-gcp", String(sourceQuad.bottomRight.x), String(sourceQuad.bottomRight.y), String(east), String(south),
  "-gcp", String(sourceQuad.bottomLeft.x), String(sourceQuad.bottomLeft.y), String(west), String(south),
  croppedPath,
  gcpsPath
]);

run("gdalwarp", [
  "-t_srs", "EPSG:3857",
  "-r", "lanczos",
  "-order", "1",
  "-dstalpha",
  gcpsPath,
  warpedPath
]);

console.log(`Wrote ${warpedPath}`);

function run(command, commandArgs) {
  console.log([command, ...commandArgs].join(" "));
  const result = spawnSync(command, commandArgs, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}

function normalizeQuad(sourceQuad, sourceCrop, cropWidth, cropHeight) {
  if (!sourceQuad) {
    return {
      topLeft: { x: 0, y: 0 },
      topRight: { x: cropWidth, y: 0 },
      bottomRight: { x: cropWidth, y: cropHeight },
      bottomLeft: { x: 0, y: cropHeight }
    };
  }

  return {
    topLeft: localize(sourceQuad.topLeft),
    topRight: localize(sourceQuad.topRight),
    bottomRight: localize(sourceQuad.bottomRight),
    bottomLeft: localize(sourceQuad.bottomLeft)
  };

  function localize(point) {
    return {
      x: Math.max(0, Math.min(cropWidth, Number(point.x) - sourceCrop.x)),
      y: Math.max(0, Math.min(cropHeight, Number(point.y) - sourceCrop.y))
    };
  }
}
