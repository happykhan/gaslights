#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);

if (!args.length || args.includes("--help") || args.includes("-h")) {
  usage(0);
}

const options = {
  out: "data/raw/nls-sheet-index/london-1895-detailed-sheets.manifest.json",
  bbox: null,
  series: "1895"
};
const inputs = [];

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--out") {
    options.out = args[++i];
  } else if (arg === "--bbox") {
    options.bbox = args[++i].split(",").map(Number);
  } else if (arg === "--series") {
    options.series = args[++i];
  } else if (arg.startsWith("--")) {
    console.error(`Unknown option: ${arg}`);
    usage(1);
  } else {
    inputs.push(arg);
  }
}

if (!inputs.length) usage(1);
if (options.bbox && (options.bbox.length !== 4 || options.bbox.some((n) => !Number.isFinite(n)))) {
  throw new Error("--bbox must be west,south,east,north");
}
if (!["1895", "1851", "6inch1890s"].includes(options.series)) {
  throw new Error("--series must be one of: 1895, 1851, 6inch1890s");
}

const features = [];
for (const input of inputs) {
  const geojson = JSON.parse(await fs.readFile(input, "utf8"));
  features.push(...(geojson.features || []));
}

const chosen = new Map();

for (const feature of features) {
  const props = feature.properties || {};
  const sheet = props.SHEET || "";
  const dates = props.DATES || "";
  const imageId = String(props.IMAGE || "");
  if (!imageId) continue;
  if (!matchesSeries(options.series, sheet, dates, props.YEAR)) continue;

  const bounds = geometryBounds(feature.geometry);
  if (options.bbox && !intersects(bounds, options.bbox)) continue;

  const item = {
    imageId,
    sheet,
    year: String(props.YEAR || ""),
    scale: inferScale(options.series),
    imageUrl: props.IMAGEURL || `https://maps.nls.uk/view/${imageId}`,
    iiifInfoUrl: deriveIiifInfoUrl(imageId),
    footprint: feature.geometry,
    bounds,
    sourceNote: "Imported from NLS Map Finder outline export"
  };

  const existing = chosen.get(imageId);
  if (!existing || scoreFeature(props, dates) > scoreFeature(existing._props, existing._dates)) {
    chosen.set(imageId, { ...item, _props: props, _dates: dates });
  }
}

const sheets = [...chosen.values()]
  .map(({ _props, _dates, ...item }) => item)
  .sort((a, b) => a.sheet.localeCompare(b.sheet));

await fs.mkdir(path.dirname(options.out), { recursive: true });
await fs.writeFile(options.out, JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: inputs,
  filter: {
    sourceType: "NLS Map Finder outline export",
    series: options.series,
    bbox: options.bbox ? {
      west: options.bbox[0],
      south: options.bbox[1],
      east: options.bbox[2],
      north: options.bbox[3]
    } : null,
    sheetPrefix: getSheetPrefix(options.series),
    scale: inferScale(options.series),
    targetYears: getTargetYears(options.series)
  },
  sheets
}, null, 2));

console.log(`Wrote ${sheets.length} sheets to ${options.out}`);

function usage(code) {
  console.error(`Usage:
  node scripts/build-manifest-from-mapfinder.mjs <geojson...> [options]

Options:
  --out <path>             Output manifest path
  --series <1895|1851|6inch1890s>
                           Sheet family to select. Default: ${options.series}
  --bbox west,south,east,north
                           Optional spatial filter

Example:
  node scripts/build-manifest-from-mapfinder.mjs \\
    '/Users/nfareed/Downloads/MapFinderWithOutlinesFeatures (1).geojson' \\
    '/Users/nfareed/Downloads/MapFinderWithOutlinesFeatures (2).geojson' \\
    --bbox -0.25,51.42,0.06,51.56
`);
  process.exit(code);
}

function deriveIiifInfoUrl(imageId) {
  const id = String(imageId);
  const prefixLength = id.length === 8 ? 4 : 5;
  return `https://map-view.nls.uk/iiif/2/${id.slice(0, prefixLength)}%2F${id}/info.json`;
}

function matchesSeries(series, sheet, dates, year) {
  if (series === "1851") {
    return is1851ProofSheet(sheet, dates, year);
  }
  if (series === "6inch1890s") {
    return isSixInch1890s(sheet, dates, year);
  }
  return is1895TownPlan(sheet, dates, year);
}

function is1895TownPlan(sheet, dates, year) {
  if (!sheet.startsWith("London - Sheet ")) return false;
  if (!dates.includes("(1:1056)")) return false;
  return isTargetEdition1895(dates, year);
}

function is1851ProofSheet(sheet, dates, year) {
  if (!sheet.startsWith("London and its environs (reduced from the Skeleton Plans) - Sheet ")) return false;
  if (!dates.includes("(1:5280)")) return false;
  return String(year || "") === "1851";
}

function isSixInch1890s(sheet, dates, year) {
  if (!/Six-inch to the mile/i.test(dates)) return false;
  if (!/^(London|Middlesex|Surrey|Kent)\b/i.test(sheet)) return false;
  if (!/Revised:\s*1893(?:\s*to\s*1895)?|Revised:\s*1894(?:\s*to\s*1895)?/i.test(dates)) {
    return false;
  }
  const y = String(year || "");
  return ["1894", "1895", "1896", "1897", "1898"].includes(y);
}

function isTargetEdition1895(dates, year) {
  const y = String(year || "");
  if (!["1894", "1895", "1896"].includes(y)) return false;
  if (/Land Registry Series/i.test(dates)) return false;
  if (/Revised:\s*193/i.test(dates)) return false;
  if (/Published:\s*193/i.test(dates)) return false;
  return true;
}

function scoreFeature(props, dates) {
  let score = 0;
  const sheet = props.SHEET || "";
  if (sheet.startsWith("London - Sheet ")) score += 10;
  if (sheet.startsWith("London and its environs (reduced from the Skeleton Plans) - Sheet ")) score += 10;
  if (/^(London|Middlesex|Surrey|Kent)\b/i.test(sheet) && /Six-inch to the mile/i.test(dates)) score += 10;
  if (/Revised:\s*1893|Revised:\s*1894|Revised:\s*1895/i.test(dates)) score += 5;
  if (/Published:\s*1894|Published:\s*1895|Published:\s*1896/i.test(dates)) score += 5;
  if (/Published:\s*1897|Published:\s*1898/i.test(dates)) score += 4;
  if (/Surveyed:\s*1848 to 1851|Surveyed:\s*1848 to 1850/i.test(dates)) score += 5;
  if (/Published:\s*ca\.\s*1851/i.test(dates)) score += 5;
  if (/Land Registry Series/i.test(dates)) score -= 100;
  if (/193[0-9]/.test(dates)) score -= 100;
  return score;
}

function inferScale(series) {
  if (series === "1851") return "1:5280";
  if (series === "6inch1890s") return "6in_to_1mile";
  return "1:1056";
}

function getSheetPrefix(series) {
  return series === "1851"
    ? "London and its environs (reduced from the Skeleton Plans) - Sheet"
    : (series === "6inch1890s"
      ? "London/Middlesex/Surrey/Kent six-inch series"
      : "London - Sheet");
}

function getTargetYears(series) {
  if (series === "1851") return ["1851"];
  if (series === "6inch1890s") return ["1894", "1895", "1896", "1897", "1898"];
  return ["1894", "1895", "1896"];
}

function geometryBounds(geometry) {
  const coords = [];
  collectCoordinates(geometry.coordinates, coords);
  const lngs = coords.map((coord) => coord[0]);
  const lats = coords.map((coord) => coord[1]);
  return {
    west: Math.min(...lngs),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    north: Math.max(...lats)
  };
}

function collectCoordinates(value, out) {
  if (Array.isArray(value?.[0]) && typeof value[0][0] === "number") {
    out.push(...value);
    return;
  }
  for (const item of value || []) collectCoordinates(item, out);
}

function intersects(bounds, bbox) {
  const [west, south, east, north] = bbox;
  return !(bounds.east < west || bounds.west > east || bounds.north < south || bounds.south > north);
}
