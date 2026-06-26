#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const input = process.argv[2] || "data/raw/nls-sheet-index/london-1890s-sheets.geojson";
const output = process.argv[3] || "data/raw/nls-sheet-index/london-1895-detailed-sheets.manifest.json";

const geojson = JSON.parse(await fs.readFile(input, "utf8"));
const features = geojson.features || [];

const manifest = features
  .filter((feature) => {
    const props = feature.properties || {};
    const dates = props.DATES || "";
    const sheet = props.SHEET || "";
    return dates.includes("1:1056") &&
      (dates.includes("Revised: 1893 to 1895") || props.YEAR === "1896") &&
      sheet.startsWith("London - Sheet");
  })
  .map((feature) => {
    const props = feature.properties || {};
    const imageId = String(props.IMAGE);
    return {
      imageId,
      sheet: props.SHEET,
      year: props.YEAR,
      scale: "1:1056",
      imageUrl: props.IMAGEURL || `https://maps.nls.uk/view/${imageId}`,
      iiifInfoUrl: deriveIiifInfoUrl(imageId),
      footprint: feature.geometry,
      bounds: geometryBounds(feature.geometry)
    };
  })
  .sort((a, b) => a.sheet.localeCompare(b.sheet));

await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: input,
  filter: {
    datesContains: ["1:1056", "Revised: 1893 to 1895"],
    year: "1896",
    sheetPrefix: "London - Sheet"
  },
  sheets: manifest
}, null, 2));

console.log(`Wrote ${manifest.length} detailed sheets to ${output}`);

export function deriveIiifInfoUrl(imageId) {
  const id = String(imageId);
  return `https://map-view.nls.uk/iiif/2/${id.slice(0, 5)}%2F${id}/info.json`;
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
