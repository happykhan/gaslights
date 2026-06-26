#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const [infoUrl, outDir] = process.argv.slice(2);

if (!infoUrl || !outDir) {
  console.error(`Usage:
  node scripts/download-iiif-preview.mjs <info.json-url> <out-dir>

Example:
  node scripts/download-iiif-preview.mjs \\
    "https://map-view.nls.uk/iiif/2/10120%2F101201646/info.json" \\
    data/raw/nls-iiif-sheets/101201646
`);
  process.exit(1);
}

await fs.mkdir(outDir, { recursive: true });

const info = await fetchJson(infoUrl);
const baseUrl = info.id || info["@id"] || infoUrl.replace(/\/info\.json$/, "");
const preferredWidth = pickPreferredPreviewWidth(info);
const fallbackSize = pickLargestListedSize(info);
const imageId = deriveImageId(infoUrl, baseUrl);

await fs.writeFile(path.join(outDir, "info.json"), JSON.stringify(info, null, 2));
await fs.writeFile(path.join(outDir, "source.json"), JSON.stringify({
  imageId,
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

const preview = await downloadPreviewBuffer(baseUrl, preferredWidth, fallbackSize);
await removeExistingPreviews(outDir);
const previewPath = path.join(outDir, `preview_${preview.width}w.jpg`);
await fs.writeFile(previewPath, preview.buffer);
console.log(`Wrote ${previewPath}`);

async function fetchJson(url) {
  const response = await fetchWithRetry(url);
  return response.json();
}

async function fetchWithRetry(url, retries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Gaslights-IIIF-preview-downloader/0.1" }
      });
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status} ${response.statusText}: ${(await response.text()).slice(0, 300)}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
  }
  throw lastError;
}

async function downloadPreviewBuffer(baseUrl, preferredWidth, fallbackSize) {
  const candidates = buildCandidateWidths(preferredWidth, fallbackSize);

  let lastError = null;
  for (const candidate of candidates) {
    try {
      console.log(`Downloading ${candidate.label} preview`);
      const response = await fetchWithRetry(`${baseUrl}/full/${candidate.width},/0/default.jpg`);
      return {
        width: candidate.width,
        buffer: Buffer.from(await response.arrayBuffer())
      };
    } catch (error) {
      lastError = error;
      console.warn(`Preview request failed for ${candidate.label}: ${error.message}`);
    }
  }

  throw lastError || new Error("Unable to download preview image");
}

function pickPreferredPreviewWidth(info) {
  const sourceWidth = Number(info.width || 0);
  if (!Number.isFinite(sourceWidth) || sourceWidth <= 0) {
    const fallbackSize = pickLargestListedSize(info);
    return fallbackSize?.width || 1200;
  }
  return Math.min(sourceWidth, 1400);
}

function pickLargestListedSize(info) {
  if (!Array.isArray(info.sizes) || !info.sizes.length) return null;
  return [...info.sizes].sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
}

function buildCandidateWidths(preferredWidth, fallbackSize) {
  const steppedWidths = [preferredWidth, 1200, 1000, 900, 800, 700, 640]
    .filter((width) => Number.isFinite(width) && width > 0 && width <= preferredWidth);
  const listedWidth = fallbackSize?.width;
  if (listedWidth && !steppedWidths.includes(listedWidth)) steppedWidths.push(listedWidth);
  return [...new Set(steppedWidths)].map((width, index) => ({
    width,
    label: index === 0 ? `${width}w preferred` : `${width}w fallback`
  }));
}

async function removeExistingPreviews(dir) {
  const entries = await fs.readdir(dir);
  await Promise.all(entries
    .filter((name) => /^preview_\d+w\.(jpg|jpeg|png)$/i.test(name))
    .map((name) => fs.rm(path.join(dir, name), { force: true })));
}

function deriveImageId(infoUrlValue, baseUrl) {
  const match = decodeURIComponent(infoUrlValue).match(/\/(\d+)\/info\.json$/) ||
    decodeURIComponent(baseUrl).match(/\/(\d+)$/);
  return match?.[1] || null;
}
