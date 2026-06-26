#!/usr/bin/env node
import fs from "node:fs";

const sources = JSON.parse(fs.readFileSync("public/data/map-sources.json", "utf8"));
const forbidden = ["maptiler", "api.maptiler.com"];
const paidRuntimeHints = ["api_key", "apikey=", "key=", "access_token", "token="];
const errors = [];
const warnings = [];

for (const source of sources) {
  if (!source.id || !source.label || !source.kind) errors.push(`Map source missing id/label/kind: ${JSON.stringify(source)}`);
  if (source.kind !== "raster_xyz") errors.push(`Unsupported map source kind for ${source.id}: ${source.kind}`);
  if (!Array.isArray(source.tiles) || !source.tiles.length) errors.push(`Map source has no tiles: ${source.id}`);

  for (const tileUrl of source.tiles || []) {
    const lower = tileUrl.toLowerCase();
    for (const value of forbidden) {
      if (lower.includes(value)) errors.push(`Forbidden paid provider in ${source.id}: ${tileUrl}`);
    }
    if (!source.devOnly && /^https?:\/\//.test(lower) && !lower.includes("localhost")) {
      warnings.push(`Production map source uses an external runtime URL and needs review: ${source.id} ${tileUrl}`);
    }
    if (!source.devOnly && paidRuntimeHints.some((hint) => lower.includes(hint))) {
      errors.push(`Production map source looks like a paid/API-key runtime source: ${source.id} ${tileUrl}`);
    }
  }
}

if (warnings.length) console.warn(warnings.map((warning) => `Warning: ${warning}`).join("\n"));
if (errors.length) {
  console.error(errors.map((error) => `Error: ${error}`).join("\n"));
  process.exit(1);
}

console.log(`Validated ${sources.length} map sources.`);
