#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);

function usage() {
  console.error(`Usage:
  node scripts/download-iiif-sheet.mjs <info.json-url> <out-dir> [options]

Options:
  --delay-ms <n>     Delay between tile requests. Default: 200
  --format <fmt>     Image format. Default: jpg
  --force            Re-download existing tiles
  --limit <n>        Download only first n tiles, useful for testing
  --dry-run          Print what would be downloaded without fetching tiles

Example:
  node scripts/download-iiif-sheet.mjs \\
    "https://map-view.nls.uk/iiif/2/22994%2F229949411/info.json" \\
    data/raw/nls-iiif-sheets/229949411
`);
  process.exit(1);
}

const infoUrl = args[0];
const outDir = args[1];
if (!infoUrl || !outDir) usage();

const options = {
  delayMs: 200,
  format: "jpg",
  force: false,
  limit: null,
  dryRun: false
};

for (let i = 2; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--delay-ms") {
    options.delayMs = Number(args[++i]);
  } else if (arg === "--format") {
    options.format = args[++i];
  } else if (arg === "--force") {
    options.force = true;
  } else if (arg === "--limit") {
    options.limit = Number(args[++i]);
  } else if (arg === "--dry-run") {
    options.dryRun = true;
  } else {
    console.error(`Unknown option: ${arg}`);
    usage();
  }
}

if (!Number.isFinite(options.delayMs) || options.delayMs < 0) {
  throw new Error("--delay-ms must be a non-negative number");
}
if (options.limit !== null && (!Number.isFinite(options.limit) || options.limit < 1)) {
  throw new Error("--limit must be a positive number");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url, retries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Gaslights-IIIF-test-downloader/0.1"
        }
      });
      if (response.ok) return response;
      const body = await response.text().catch(() => "");
      lastError = new Error(`HTTP ${response.status} ${response.statusText}: ${body.slice(0, 300)}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < retries) await sleep(500 * attempt);
  }
  throw lastError;
}

async function existsNonEmpty(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.size > 0;
  } catch {
    return false;
  }
}

function getProfileObject(info) {
  if (!Array.isArray(info.profile)) return {};
  return info.profile.find((entry) => entry && typeof entry === "object" && !Array.isArray(entry)) || {};
}

function pickPreviewSize(info) {
  if (!Array.isArray(info.sizes) || !info.sizes.length) return null;
  return [...info.sizes].sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
}

function buildTilePlan(info, tileWidth, tileHeight) {
  const tiles = [];
  for (let y = 0; y < info.height; y += tileHeight) {
    for (let x = 0; x < info.width; x += tileWidth) {
      const w = Math.min(tileWidth, info.width - x);
      const h = Math.min(tileHeight, info.height - y);
      tiles.push({ x, y, w, h });
    }
  }
  return tiles;
}

await fs.mkdir(outDir, { recursive: true });
await fs.mkdir(path.join(outDir, "tiles"), { recursive: true });

console.log(`Fetching ${infoUrl}`);
const infoResponse = await fetchWithRetry(infoUrl);
const info = await infoResponse.json();

const baseUrl = info.id || info["@id"] || infoUrl.replace(/\/info\.json$/, "");
if (!baseUrl) throw new Error("Could not determine IIIF base URL from info.json");
if (!info.width || !info.height) throw new Error("info.json is missing width/height");

const profile = getProfileObject(info);
const maxArea = profile.maxArea || null;
const tileSpec = info.tiles?.[0] || {};
const tileWidth = tileSpec.width || 512;
const tileHeight = tileSpec.height || tileWidth;
const tileArea = tileWidth * tileHeight;

if (maxArea && tileArea > maxArea) {
  throw new Error(`Advertised tile size ${tileWidth}x${tileHeight} (${tileArea}) exceeds maxArea ${maxArea}`);
}

const previewSize = pickPreviewSize(info);
const tiles = buildTilePlan(info, tileWidth, tileHeight);
const plannedTiles = options.limit ? tiles.slice(0, options.limit) : tiles;

const metadata = {
  infoUrl,
  baseUrl,
  width: info.width,
  height: info.height,
  tileWidth,
  tileHeight,
  tileArea,
  maxArea,
  totalColumns: Math.ceil(info.width / tileWidth),
  totalRows: Math.ceil(info.height / tileHeight),
  totalTiles: tiles.length,
  plannedTiles: plannedTiles.length,
  format: options.format,
  downloadedAt: new Date().toISOString(),
  sourceNote: "IIIF source-image tiles. These are not slippy map z/x/y tiles yet."
};

await fs.writeFile(path.join(outDir, "info.json"), JSON.stringify(info, null, 2));
await fs.writeFile(path.join(outDir, "download-metadata.json"), JSON.stringify(metadata, null, 2));
await fs.writeFile(path.join(outDir, "source.json"), JSON.stringify({
  imageId: deriveImageId(infoUrl, baseUrl),
  iiifInfoUrl: infoUrl,
  iiifBaseUrl: baseUrl,
  source: "National Library of Scotland IIIF",
  rights: {
    status: "needs_verification_before_production",
    notes: "Use for local development. Verify commercial redistribution terms before shipping paid product."
  },
  crop: {
    status: "not_started"
  },
  georeference: {
    status: "not_started"
  }
}, null, 2));

const sourceMdPath = path.join(outDir, "source.md");
if (!(await existsNonEmpty(sourceMdPath))) {
  await fs.writeFile(sourceMdPath, `# NLS IIIF sheet source\n\nIIIF info URL:\n${infoUrl}\n\nIIIF base URL:\n${baseUrl}\n\nImage size:\n${info.width} × ${info.height}\n\nTile size:\n${tileWidth} × ${tileHeight}\n\nRights / reuse:\nVerify before production redistribution. Do not assume that technical access via IIIF is enough for commercial redistribution.\n`);
}

console.log(JSON.stringify(metadata, null, 2));

if (options.dryRun) {
  console.log("Dry run only. No image tiles downloaded.");
  process.exit(0);
}

if (previewSize) {
  const previewFile = path.join(outDir, `preview_${previewSize.width}w.${options.format}`);
  const previewUrl = `${baseUrl}/full/${previewSize.width},/0/default.${options.format}`;
  if (options.force || !(await existsNonEmpty(previewFile))) {
    console.log(`Downloading preview ${previewSize.width}w`);
    const previewResponse = await fetchWithRetry(previewUrl);
    const buffer = Buffer.from(await previewResponse.arrayBuffer());
    await fs.writeFile(previewFile, buffer);
  } else {
    console.log(`Skipping existing preview ${previewFile}`);
  }
}

const indexPath = path.join(outDir, "tile-index.json");
const index = {
  ...metadata,
  tiles: []
};

let count = 0;
for (const tile of plannedTiles) {
  count += 1;
  const filename = `${tile.x}_${tile.y}_${tile.w}_${tile.h}.${options.format}`;
  const filePath = path.join(outDir, "tiles", filename);
  const url = `${baseUrl}/${tile.x},${tile.y},${tile.w},${tile.h}/full/0/default.${options.format}`;

  if (!options.force && await existsNonEmpty(filePath)) {
    console.log(`[${count}/${plannedTiles.length}] skip ${filename}`);
    index.tiles.push({ ...tile, filename, url, skippedExisting: true });
    continue;
  }

  console.log(`[${count}/${plannedTiles.length}] download ${filename}`);
  const response = await fetchWithRetry(url);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("image")) {
    throw new Error(`Unexpected content-type for ${url}: ${contentType}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(filePath, buffer);
  index.tiles.push({ ...tile, filename, url, contentType, bytes: buffer.length });

  // Save progress after every tile so interrupted downloads can be inspected/resumed.
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
  if (options.delayMs) await sleep(options.delayMs);
}

await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
console.log(`Done. Indexed ${index.tiles.length} tiles at ${indexPath}`);

function deriveImageId(infoUrlValue, baseUrlValue) {
  const match = decodeURIComponent(infoUrlValue).match(/\/(\d+)\/info\.json$/) ||
    decodeURIComponent(baseUrlValue).match(/\/(\d+)$/);
  return match?.[1] || null;
}
