#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const options = {
  input: "build/iiif-sheets/crop-review/review-table.tsv",
  onlyReviewed: false
};

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--input") {
    options.input = args[++i];
  } else if (arg === "--only-reviewed") {
    options.onlyReviewed = true;
  } else if (arg === "--help" || arg === "-h") {
    usage(0);
  } else {
    console.error(`Unknown option: ${arg}`);
    usage(1);
  }
}

const table = fs.readFileSync(options.input, "utf8").trim();
if (!table) {
  throw new Error(`Input table is empty: ${options.input}`);
}

const lines = table.split(/\r?\n/).filter(Boolean);
const delimiter = lines[0].includes("\t") ? "\t" : ",";
const headers = splitLine(lines[0], delimiter);
const rows = lines.slice(1).map((line) => Object.fromEntries(splitLine(line, delimiter).map((value, index) => [headers[index], value])));

let updated = 0;
for (const row of rows) {
  if (!row.sheetId) continue;
  if (options.onlyReviewed && row.status !== "reviewed") continue;
  if (!hasCropValues(row)) continue;

  const cropPath = path.join("data/raw/nls-iiif-sheets", row.sheetId, "crop.json");
  const previewPath = findPreview(path.join("data/raw/nls-iiif-sheets", row.sheetId));
  if (!fs.existsSync(cropPath)) {
    console.warn(`Skipping ${row.sheetId}: missing crop.json`);
    continue;
  }
  if (!previewPath) {
    console.warn(`Skipping ${row.sheetId}: missing preview image`);
    continue;
  }

  const crop = JSON.parse(fs.readFileSync(cropPath, "utf8"));
  const left = parseInteger(row.left, "left", row.sheetId);
  const top = parseInteger(row.top, "top", row.sheetId);
  const right = parseInteger(row.right, "right", row.sheetId);
  const bottom = parseInteger(row.bottom, "bottom", row.sheetId);

  if (right <= left) throw new Error(`${row.sheetId}: right must be greater than left`);
  if (bottom <= top) throw new Error(`${row.sheetId}: bottom must be greater than top`);
  if (left < 0 || top < 0 || right > crop.previewImage.width || bottom > crop.previewImage.height) {
    throw new Error(`${row.sheetId}: crop is outside preview bounds ${crop.previewImage.width}x${crop.previewImage.height}`);
  }

  const previewCrop = { x: left, y: top, width: right - left, height: bottom - top };
  const scaleX = crop.sourceImage.width / crop.previewImage.width;
  const scaleY = crop.sourceImage.height / crop.previewImage.height;
  const sourceCrop = {
    x: round(previewCrop.x * scaleX),
    y: round(previewCrop.y * scaleY),
    width: round(previewCrop.width * scaleX),
    height: round(previewCrop.height * scaleY)
  };

  crop.previewCrop = previewCrop;
  crop.sourceCrop = sourceCrop;
  crop.status = row.status || "reviewed";
  crop.reviewNotes = row.reviewNotes || `Batch-reviewed crop: left=${left}, top=${top}, right=${right}, bottom=${bottom}.`;

  fs.writeFileSync(cropPath, `${JSON.stringify(crop, null, 2)}\n`);
  renderOverlay(row.sheetId, previewPath, cropPath);
  updated += 1;
}

console.log(JSON.stringify({ updated, input: path.resolve(options.input) }, null, 2));

function usage(exitCode) {
  console.error(`Usage:
  node scripts/apply-crop-overrides.mjs [options]

Options:
  --input <path>         TSV/CSV table. Default: ${options.input}
  --only-reviewed        Apply only rows whose status column is exactly "reviewed"
`);
  process.exit(exitCode);
}

function splitLine(line, delimiter) {
  return line.split(delimiter).map((value) => value.trim());
}

function hasCropValues(row) {
  return row.left !== undefined && row.top !== undefined && row.right !== undefined && row.bottom !== undefined;
}

function parseInteger(value, label, sheetId) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`${sheetId}: ${label} is not an integer`);
  return parsed;
}

function round(value) {
  return Math.round(value);
}

function findPreview(sheetDir) {
  if (!fs.existsSync(sheetDir)) return null;
  const filename = fs.readdirSync(sheetDir)
    .filter((name) => /^preview_\d+w\.(jpg|jpeg|png)$/i.test(name))
    .sort((a, b) => extractPreviewWidth(b) - extractPreviewWidth(a))[0];
  return filename ? path.join(sheetDir, filename) : null;
}

function extractPreviewWidth(filename) {
  const match = filename.match(/preview_(\d+)w/i);
  return Number(match?.[1] || 0);
}

function renderOverlay(sheetId, previewPath, cropPath) {
  const overlayPath = path.join("build/iiif-sheets/crop-review", `${sheetId}-crop-overlay.jpg`);
  const result = spawnSync("python3", [
    "scripts/render-crop-overlay.py",
    previewPath,
    cropPath,
    "--overlay",
    overlayPath
  ], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
