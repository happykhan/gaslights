#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);

const options = {
  manifest: "data/raw/nls-sheet-index/london-1895-detailed-sheets.manifest.json",
  full: "none",
  delayMs: 200,
  refreshPreview: false,
  refreshDetect: false,
  sheetIds: new Set()
};

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--manifest") {
    options.manifest = args[++i];
  } else if (arg === "--full") {
    options.full = args[++i];
  } else if (arg === "--delay-ms") {
    options.delayMs = Number(args[++i]);
  } else if (arg === "--refresh-preview") {
    options.refreshPreview = true;
  } else if (arg === "--refresh-detect") {
    options.refreshDetect = true;
  } else if (arg === "--sheet") {
    options.sheetIds.add(args[++i]);
  } else if (arg === "--help" || arg === "-h") {
    usage(0);
  } else {
    console.error(`Unknown option: ${arg}`);
    usage(1);
  }
}

if (!["none", "reviewed", "all"].includes(options.full)) {
  throw new Error("--full must be one of: none, reviewed, all");
}
if (!Number.isFinite(options.delayMs) || options.delayMs < 0) {
  throw new Error("--delay-ms must be a non-negative number");
}

const manifest = JSON.parse(fs.readFileSync(options.manifest, "utf8"));
const sheets = (manifest.sheets || manifest)
  .filter((sheet) => !options.sheetIds.size || options.sheetIds.has(sheet.imageId));

if (!sheets.length) {
  console.log("No sheets matched the requested filters.");
  process.exit(0);
}

fs.mkdirSync("build/iiif-sheets/crop-review", { recursive: true });

const summary = {
  totalSheets: sheets.length,
  previewPrepared: 0,
  cropDetected: 0,
  fullDownloaded: 0,
  skippedFull: 0
};

for (const sheet of sheets) {
  const sheetId = sheet.imageId;
  const outDir = path.join("data/raw/nls-iiif-sheets", sheetId);

  console.log(`\n=== ${sheetId} ${sheet.sheet || ""}`.trim());

  if (options.refreshPreview || !findPreview(outDir)) {
    run("node", ["scripts/download-iiif-preview.mjs", sheet.iiifInfoUrl, outDir]);
  } else {
    console.log(`Reusing existing preview in ${outDir}`);
  }
  summary.previewPrepared += 1;

  const previewPath = findPreview(outDir);
  if (!previewPath) {
    throw new Error(`No preview image found for ${sheetId} in ${outDir}`);
  }

  const cropPath = path.join(outDir, "crop.json");
  const existingCrop = readJsonIfExists(cropPath);
  const shouldDetect = options.refreshDetect || existingCrop?.status !== "reviewed";
  if (shouldDetect) {
    run("python3", [
      "scripts/detect-iiif-crop.py",
      previewPath,
      path.join(outDir, "info.json"),
      "--out", cropPath,
      "--overlay", path.join("build/iiif-sheets/crop-review", `${sheetId}-crop-overlay.jpg`)
    ]);
    summary.cropDetected += 1;
  } else {
    console.log(`Keeping reviewed crop for ${sheetId}`);
    ensureOverlayFromReviewedPreview(previewPath, cropPath, path.join("build/iiif-sheets/crop-review", `${sheetId}-crop-overlay.jpg`));
  }

  const crop = readJsonIfExists(cropPath);
  const shouldDownloadFull = options.full === "all" || (options.full === "reviewed" && crop?.status === "reviewed");
  if (!shouldDownloadFull) {
    summary.skippedFull += 1;
    continue;
  }

  run("node", [
    "scripts/download-iiif-sheet.mjs",
    sheet.iiifInfoUrl,
    outDir,
    "--delay-ms", String(options.delayMs)
  ]);
  summary.fullDownloaded += 1;
}

console.log("\nBatch prepare complete.");
console.log(JSON.stringify(summary, null, 2));

function usage(exitCode) {
  console.error(`Usage:
  node scripts/batch-prepare-nls-sheets.mjs [options]

Options:
  --manifest <path>        Manifest JSON. Default: ${options.manifest}
  --full <mode>            Full-resolution download mode: none | reviewed | all
  --delay-ms <n>           Delay between high-resolution tile requests. Default: 200
  --refresh-preview        Re-download listed preview image even if present
  --refresh-detect         Re-run crop detection even if crop.json exists
  --sheet <imageId>        Limit to one sheet; repeatable

Examples:
  node scripts/batch-prepare-nls-sheets.mjs
  node scripts/batch-prepare-nls-sheets.mjs --full reviewed
  node scripts/batch-prepare-nls-sheets.mjs --sheet 101201646 --sheet 101201649
`);
  process.exit(exitCode);
}

function run(command, commandArgs) {
  console.log([command, ...commandArgs].join(" "));
  const result = spawnSync(command, commandArgs, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}

function findPreview(outDir) {
  if (!fs.existsSync(outDir)) return null;
  const filename = fs.readdirSync(outDir)
    .filter((name) => /^preview_\d+w\.(jpg|jpeg|png)$/i.test(name))
    .sort((a, b) => extractPreviewWidth(b) - extractPreviewWidth(a))[0];
  return filename ? path.join(outDir, filename) : null;
}

function extractPreviewWidth(filename) {
  const match = filename.match(/preview_(\d+)w/i);
  return Number(match?.[1] || 0);
}

function readJsonIfExists(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function ensureOverlayFromReviewedPreview(previewPath, cropPath, overlayPath) {
  if (fs.existsSync(overlayPath)) return;
  run("python3", [
    "scripts/render-crop-overlay.py",
    previewPath,
    cropPath,
    "--overlay", overlayPath
  ]);
}
