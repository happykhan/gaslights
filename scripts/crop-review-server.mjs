#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { URL } from "node:url";

const args = process.argv.slice(2);
const options = {
  manifest: "data/raw/nls-sheet-index/london-1895-six-inch.manifest.json",
  port: 4177,
  host: "127.0.0.1"
};

const SYNTHETIC_SHEET_LABELS = {
  "230275385": "London 1851 proof sheet VI.NE",
  "230275391": "London 1851 proof sheet VI.SE",
  "229949405": "London 1851 proof sheet VII.NE",
  "229949408": "London 1851 proof sheet VII.NE",
  "229949411": "London 1851 proof sheet VII.SW",
  "229949414": "London 1851 proof sheet VII.SE",
  "229949423": "London 1851 proof sheet VIII.SW",
  "229949438": "London 1851 proof sheet X.NE",
  "229949456": "London 1851 proof sheet XII.NW"
};

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--manifest") {
    options.manifest = args[++i];
  } else if (arg === "--port") {
    options.port = Number(args[++i]);
  } else if (arg === "--host") {
    options.host = args[++i];
  } else if (arg === "--help" || arg === "-h") {
    usage(0);
  } else {
    console.error(`Unknown option: ${arg}`);
    usage(1);
  }
}

if (!Number.isInteger(options.port) || options.port < 1) {
  throw new Error("--port must be a positive integer");
}

const repoRoot = process.cwd();
const server = http.createServer(handleRequest);

server.listen(options.port, options.host, () => {
  console.log(`Crop review server listening on http://${options.host}:${options.port}`);
});

async function handleRequest(req, res) {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = requestUrl.pathname;

    if (req.method === "GET" && pathname === "/api/sheets") {
      return sendJson(res, 200, buildSheetList(requestUrl.searchParams));
    }

    if (req.method === "GET" && pathname.startsWith("/api/preview/")) {
      const sheetId = pathname.split("/").pop();
      return servePreview(res, sheetId);
    }

    if (req.method === "GET" && pathname.startsWith("/api/detail/")) {
      const sheetId = pathname.split("/").pop();
      return serveDetailPreview(res, sheetId, requestUrl.searchParams);
    }

    if (req.method === "POST" && pathname.startsWith("/api/crop/")) {
      const sheetId = pathname.split("/").pop();
      const body = await readJsonBody(req);
      const updated = applyCropUpdate(sheetId, body);
      return sendJson(res, 200, updated);
    }

    if (req.method === "GET" && pathname === "/") {
      return serveFile(res, path.join(repoRoot, "public", "crop-review.html"));
    }

    if (req.method === "GET" && pathname === "/assets/crop-review.js") {
      return serveFile(res, path.join(repoRoot, "public", "assets", "crop-review.js"));
    }

    if (req.method === "GET" && pathname === "/assets/crop-review.css") {
      return serveFile(res, path.join(repoRoot, "public", "assets", "crop-review.css"));
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: error.message || "Server error" });
  }
}

function usage(exitCode) {
  console.error(`Usage:
  node scripts/crop-review-server.mjs [options]

Options:
  --manifest <path>      Manifest JSON. Default: ${options.manifest}
  --port <n>             Listen port. Default: ${options.port}
  --host <host>          Listen host. Default: ${options.host}
`);
  process.exit(exitCode);
}

function buildSheetList(searchParams) {
  const manifest = JSON.parse(fs.readFileSync(options.manifest, "utf8"));
  const manifestSheets = manifest.sheets || manifest;
  const sheets = collectReviewableSheets(manifestSheets);
  const onlyNeedsReview = searchParams.get("onlyNeedsReview") !== "false";
  const query = (searchParams.get("q") || "").trim().toLowerCase();

  return sheets
    .map((sheet) => buildSheetRecord(sheet))
    .filter(Boolean)
    .filter((sheet) => !onlyNeedsReview || sheet.status !== "reviewed")
    .filter((sheet) => {
      if (!query) return true;
      return [sheet.sheetId, sheet.sheet, sheet.status, sheet.reviewNotes].join(" ").toLowerCase().includes(query);
    });
}

function buildSheetRecord(sheet) {
  const sheetId = String(sheet.imageId);
  const crop = readCrop(sheetId);
  if (!crop) return null;
  const previewPath = findPreviewPath(sheetId);
  if (!previewPath) return null;
  const left = Number(crop.previewCrop?.x ?? 0);
  const top = Number(crop.previewCrop?.y ?? 0);
  const width = Number(crop.previewCrop?.width ?? 0);
  const height = Number(crop.previewCrop?.height ?? 0);
  return {
    sheetId,
    sheet: sheet.sheet || "",
    status: crop.status || "",
    reviewNotes: crop.reviewNotes || "",
    previewImage: crop.previewImage,
    sourceImage: crop.sourceImage,
    left,
    top,
    right: left + width,
    bottom: top + height,
    previewQuad: crop.previewQuad || rectToQuad(previewCropToRect(crop.previewCrop)),
    bounds: sheet.bounds || null,
    previewUrl: `/api/preview/${sheetId}`,
    detailUrlBase: `/api/detail/${sheetId}`
  };
}

function servePreview(res, sheetId) {
  const previewPath = findPreviewPath(sheetId);
  if (!previewPath) return sendJson(res, 404, { error: `Preview not found for ${sheetId}` });
  serveFile(res, previewPath);
}

async function serveDetailPreview(res, sheetId, searchParams) {
  const crop = readCrop(sheetId);
  if (!crop) return sendJson(res, 404, { error: `Crop metadata not found for ${sheetId}` });
  const baseUrl = getIiifBaseUrl(sheetId);
  if (!baseUrl) return sendJson(res, 404, { error: `IIIF base URL not found for ${sheetId}` });

  const left = clamp(parseInteger(searchParams.get("left"), "left"), 0, crop.sourceImage.width - 1);
  const top = clamp(parseInteger(searchParams.get("top"), "top"), 0, crop.sourceImage.height - 1);
  const size = clamp(parseInteger(searchParams.get("size"), "size"), 32, Math.max(crop.sourceImage.width, crop.sourceImage.height));
  const outWidth = clamp(parseInteger(searchParams.get("width"), "width"), 128, 1600);
  const region = clampRegion(left, top, size, crop.sourceImage.width, crop.sourceImage.height);
  const detailUrl = `${baseUrl}/${region.left},${region.top},${region.size},${region.size}/${outWidth},/0/default.jpg`;
  const response = await fetch(detailUrl, {
    headers: { "User-Agent": "Gaslights-crop-review/0.1" }
  });

  if (!response.ok) {
    const errorText = await response.text();
    return sendJson(res, response.status, { error: `Detail preview failed: ${errorText.slice(0, 300)}` });
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  res.writeHead(200, {
    "Content-Type": "image/jpeg",
    "Cache-Control": "no-store"
  });
  res.end(buffer);
}

function serveFile(res, filePath) {
  if (!fs.existsSync(filePath)) {
    return sendJson(res, 404, { error: `Missing file: ${path.relative(repoRoot, filePath)}` });
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = ({
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png"
  })[ext] || "application/octet-stream";

  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  fs.createReadStream(filePath).pipe(res);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(`${JSON.stringify(payload)}\n`);
}

function readCrop(sheetId) {
  const cropPath = path.join(repoRoot, "data/raw/nls-iiif-sheets", sheetId, "crop.json");
  if (!fs.existsSync(cropPath)) return null;
  return JSON.parse(fs.readFileSync(cropPath, "utf8"));
}

function readJsonIfExists(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function findPreviewPath(sheetId) {
  const dir = path.join(repoRoot, "data/raw/nls-iiif-sheets", sheetId);
  if (!fs.existsSync(dir)) return null;
  const filename = fs.readdirSync(dir)
    .filter((name) => /^preview_\d+w\.(jpg|jpeg|png)$/i.test(name))
    .sort((a, b) => extractPreviewWidth(b) - extractPreviewWidth(a))[0];
  return filename ? path.join(dir, filename) : null;
}

function applyCropUpdate(sheetId, body) {
  const cropPath = path.join(repoRoot, "data/raw/nls-iiif-sheets", sheetId, "crop.json");
  if (!fs.existsSync(cropPath)) {
    throw new Error(`Missing crop.json for ${sheetId}`);
  }

  const crop = JSON.parse(fs.readFileSync(cropPath, "utf8"));
  const left = parseInteger(body.left, "left");
  const top = parseInteger(body.top, "top");
  const right = parseInteger(body.right, "right");
  const bottom = parseInteger(body.bottom, "bottom");

  if (right <= left) throw new Error("right must be greater than left");
  if (bottom <= top) throw new Error("bottom must be greater than top");
  if (left < 0 || top < 0 || right > crop.previewImage.width || bottom > crop.previewImage.height) {
    throw new Error(`Crop exceeds preview bounds ${crop.previewImage.width}x${crop.previewImage.height}`);
  }

  const previewCrop = { x: left, y: top, width: right - left, height: bottom - top };
  const scaleX = crop.sourceImage.width / crop.previewImage.width;
  const scaleY = crop.sourceImage.height / crop.previewImage.height;
  const previewQuad = normalizePreviewQuad(body.quad, previewCrop, crop.previewImage);
  crop.previewCrop = previewCrop;
  crop.sourceCrop = {
    x: Math.round(previewCrop.x * scaleX),
    y: Math.round(previewCrop.y * scaleY),
    width: Math.round(previewCrop.width * scaleX),
    height: Math.round(previewCrop.height * scaleY)
  };
  crop.previewQuad = previewQuad;
  crop.sourceQuad = scaleQuad(previewQuad, scaleX, scaleY);
  crop.status = body.status || "reviewed";
  crop.reviewNotes = body.reviewNotes || `Interactive review: left=${left}, top=${top}, right=${right}, bottom=${bottom}.`;

  fs.writeFileSync(cropPath, `${JSON.stringify(crop, null, 2)}\n`);

  return {
    ok: true,
    sheetId,
    status: crop.status,
    reviewNotes: crop.reviewNotes,
    previewCrop: crop.previewCrop,
    sourceCrop: crop.sourceCrop,
    previewQuad: crop.previewQuad,
    sourceQuad: crop.sourceQuad
  };
}

function parseInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`${label} must be an integer`);
  return parsed;
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function collectReviewableSheets(manifestSheets) {
  const byId = new Map(manifestSheets.map((sheet) => [String(sheet.imageId), { ...sheet, imageId: String(sheet.imageId) }]));
  const baseDir = path.join(repoRoot, "data/raw/nls-iiif-sheets");
  if (!fs.existsSync(baseDir)) return [...byId.values()];

  for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sheetId = entry.name;
    if (byId.has(sheetId)) continue;
    const cropPath = path.join(baseDir, sheetId, "crop.json");
    const previewPath = findPreviewPath(sheetId);
    if (!fs.existsSync(cropPath) || !previewPath) continue;
    byId.set(sheetId, buildSyntheticSheetEntry(sheetId));
  }

  return [...byId.values()].sort((a, b) => String(a.sheet || a.imageId).localeCompare(String(b.sheet || b.imageId)));
}

function buildSyntheticSheetEntry(sheetId) {
  const crop = readCrop(sheetId);
  const sourceMd = readTextIfExists(path.join(repoRoot, "data/raw/nls-iiif-sheets", sheetId, "source.md"));
  const info = readJsonIfExists(path.join(repoRoot, "data/raw/nls-iiif-sheets", sheetId, "info.json"));

  let sheetLabel = `Sheet ${sheetId}`;
  if (SYNTHETIC_SHEET_LABELS[sheetId]) {
    sheetLabel = SYNTHETIC_SHEET_LABELS[sheetId];
  } else if (sourceMd) {
    const iiifLine = sourceMd.match(/IIIF info URL:\s*\n([^\n]+)/i);
    if (iiifLine) sheetLabel = `IIIF sheet ${sheetId}`;
  }

  return {
    imageId: sheetId,
    sheet: sheetLabel,
    iiifInfoUrl: info?.id || info?.["@id"] || null,
    bounds: readSyntheticBounds(sheetId)
  };
}

function readSyntheticBounds(sheetId) {
  const stactaPath = path.join(repoRoot, "public", "tiles", `london-1851-${sheetId}`, "stacta.json");
  const stacta = readJsonIfExists(stactaPath);
  if (Array.isArray(stacta?.bbox) && stacta.bbox.length === 4) {
    const [west, south, east, north] = stacta.bbox;
    return { west, south, east, north };
  }
  return null;
}

function readTextIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function rectToQuad(rect) {
  return {
    topLeft: { x: rect.left, y: rect.top },
    topRight: { x: rect.right, y: rect.top },
    bottomRight: { x: rect.right, y: rect.bottom },
    bottomLeft: { x: rect.left, y: rect.bottom }
  };
}

function previewCropToRect(previewCrop) {
  return {
    left: Number(previewCrop.x),
    top: Number(previewCrop.y),
    right: Number(previewCrop.x) + Number(previewCrop.width),
    bottom: Number(previewCrop.y) + Number(previewCrop.height)
  };
}

function normalizePreviewQuad(quad, previewCrop, previewImage) {
  if (!quad) return rectToQuad(previewCropToRect(previewCrop));
  const normalized = {};
  for (const key of ["topLeft", "topRight", "bottomRight", "bottomLeft"]) {
    const point = quad[key];
    if (!point) throw new Error(`quad.${key} is required`);
    normalized[key] = {
      x: clamp(parseInteger(point.x, `quad.${key}.x`), 0, previewImage.width),
      y: clamp(parseInteger(point.y, `quad.${key}.y`), 0, previewImage.height)
    };
  }
  return normalized;
}

function scaleQuad(quad, scaleX, scaleY) {
  return Object.fromEntries(
    Object.entries(quad).map(([key, point]) => [key, {
      x: Math.round(point.x * scaleX),
      y: Math.round(point.y * scaleY)
    }])
  );
}

function getIiifBaseUrl(sheetId) {
  const source = readJsonIfExists(path.join(repoRoot, "data/raw/nls-iiif-sheets", sheetId, "source.json"));
  if (source?.iiifBaseUrl) return source.iiifBaseUrl;
  const info = readJsonIfExists(path.join(repoRoot, "data/raw/nls-iiif-sheets", sheetId, "info.json"));
  return info?.id || info?.["@id"] || null;
}

function clampRegion(left, top, size, width, height) {
  const boundedSize = Math.min(size, width, height);
  return {
    size: boundedSize,
    left: clamp(left, 0, width - boundedSize),
    top: clamp(top, 0, height - boundedSize)
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function extractPreviewWidth(filename) {
  const match = filename.match(/preview_(\d+)w/i);
  return Number(match?.[1] || 0);
}
