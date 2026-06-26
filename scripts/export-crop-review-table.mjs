#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const options = {
  manifest: "data/raw/nls-sheet-index/london-1895-detailed-sheets.manifest.json",
  out: "build/iiif-sheets/crop-review/review-table.tsv",
  onlyNeedsReview: false
};

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--manifest") {
    options.manifest = args[++i];
  } else if (arg === "--out") {
    options.out = args[++i];
  } else if (arg === "--only-needs-review") {
    options.onlyNeedsReview = true;
  } else if (arg === "--help" || arg === "-h") {
    usage(0);
  } else {
    console.error(`Unknown option: ${arg}`);
    usage(1);
  }
}

const manifest = JSON.parse(fs.readFileSync(options.manifest, "utf8"));
const sheets = manifest.sheets || manifest;
const rows = [];

for (const sheet of sheets) {
  const sheetId = sheet.imageId;
  const cropPath = path.join("data/raw/nls-iiif-sheets", sheetId, "crop.json");
  if (!fs.existsSync(cropPath)) continue;
  const crop = JSON.parse(fs.readFileSync(cropPath, "utf8"));
  if (options.onlyNeedsReview && crop.status === "reviewed") continue;

  const left = Number(crop.previewCrop?.x ?? 0);
  const top = Number(crop.previewCrop?.y ?? 0);
  const width = Number(crop.previewCrop?.width ?? 0);
  const height = Number(crop.previewCrop?.height ?? 0);
  const right = left + width;
  const bottom = top + height;

  rows.push({
    sheetId,
    sheet: sheet.sheet || "",
    status: crop.status || "",
    left,
    top,
    right,
    bottom,
    reviewNotes: crop.reviewNotes || sheet.notes || ""
  });
}

const outPath = path.resolve(options.out);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
const header = ["sheetId", "sheet", "status", "left", "top", "right", "bottom", "reviewNotes"];
const lines = [
  header.join("\t"),
  ...rows.map((row) =>
    header
      .map((key) => String(row[key] ?? "").replaceAll("\t", " ").replaceAll("\n", " "))
      .join("\t")
  )
];
fs.writeFileSync(outPath, `${lines.join("\n")}\n`);
console.log(`Wrote ${outPath}`);
console.log(JSON.stringify({ rows: rows.length, onlyNeedsReview: options.onlyNeedsReview }, null, 2));

function usage(exitCode) {
  console.error(`Usage:
  node scripts/export-crop-review-table.mjs [options]

Options:
  --manifest <path>          Manifest JSON. Default: ${options.manifest}
  --out <path>               Output TSV. Default: ${options.out}
  --only-needs-review        Export only crops not marked reviewed
`);
  process.exit(exitCode);
}
