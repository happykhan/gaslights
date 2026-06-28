#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const args = process.argv.slice(2);

const options = {
  manifest: "data/raw/nls-sheet-index/london-1895-six-inch.manifest.json",
  out: "public/data/london1895/locations.osm.json",
  summaryOut: "data/raw/osm-london-1895.summary.json",
  overpassUrl: "https://overpass-api.de/api/interpreter",
  timeoutSeconds: 180,
  publicSet: "notable"
};

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--manifest") options.manifest = args[++index];
  else if (arg === "--out") options.out = args[++index];
  else if (arg === "--summary-out") options.summaryOut = args[++index];
  else if (arg === "--overpass-url") options.overpassUrl = args[++index];
  else if (arg === "--timeout") options.timeoutSeconds = Number(args[++index]);
  else if (arg === "--public-set") options.publicSet = args[++index];
  else if (arg === "--help" || arg === "-h") usage(0);
  else usage(`Unknown option: ${arg}`);
}

const manifest = readJson(options.manifest);
const bounds = manifestBounds(manifest);
const query = buildOverpassQuery(bounds, options.timeoutSeconds);

console.log(`Fetching OSM POIs within ${bounds.south},${bounds.west},${bounds.north},${bounds.east}`);
const response = await fetch(options.overpassUrl, {
  method: "POST",
  headers: {
    "Content-Type": "text/plain; charset=utf-8",
    "User-Agent": "Gaslights-OSM-POI-Import/0.1"
  },
  body: query
});

if (!response.ok) {
  const body = await response.text();
  throw new Error(`Overpass request failed: HTTP ${response.status} ${response.statusText}\n${body.slice(0, 400)}`);
}

const payload = await response.json();
const fetchedAt = new Date().toISOString();
const locations = normalizeElements(payload.elements || [], fetchedAt, options.publicSet);
const summary = buildSummary(locations, bounds, fetchedAt, payload.elements?.length || 0);

writeJson(options.out, locations);
writeJson(options.summaryOut, summary);

console.log(`Imported ${locations.length} OSM POIs to ${options.out}`);
console.log(`Summary written to ${options.summaryOut}`);

function usage(messageOrExitCode) {
  if (typeof messageOrExitCode === "string") console.error(messageOrExitCode);
  console.error(`Usage:
  node scripts/import-osm-pois.mjs [options]

Options:
  --manifest <path>       Sheet manifest with bounds. Default: ${options.manifest}
  --out <path>            Output JSON path. Default: ${options.out}
  --summary-out <path>    Summary JSON path. Default: ${options.summaryOut}
  --overpass-url <url>    Overpass interpreter URL. Default: ${options.overpassUrl}
  --timeout <seconds>     Overpass timeout. Default: ${options.timeoutSeconds}
  --public-set <name>     Filter profile. Default: ${options.publicSet}
`);
  process.exit(typeof messageOrExitCode === "number" ? messageOrExitCode : 1);
}

function manifestBounds(input) {
  if (!Array.isArray(input?.sheets) || !input.sheets.length) {
    throw new Error("Manifest has no sheets");
  }
  return input.sheets.reduce((acc, sheet) => ({
    west: Math.min(acc.west, sheet.bounds.west),
    south: Math.min(acc.south, sheet.bounds.south),
    east: Math.max(acc.east, sheet.bounds.east),
    north: Math.max(acc.north, sheet.bounds.north)
  }), {
    west: Infinity,
    south: Infinity,
    east: -Infinity,
    north: -Infinity
  });
}

function buildOverpassQuery(bounds, timeoutSeconds) {
  const bbox = `(${bounds.south},${bounds.west},${bounds.north},${bounds.east})`;
  const clauses = [
    `nwr["name"]["railway"~"^(station|halt)$"]${bbox};`,
    `nwr["name"]["amenity"~"^(place_of_worship|hospital|school|college|university|theatre|library|police|post_office|courthouse|townhall|bank|marketplace)$"]${bbox};`,
    `nwr["name"]["tourism"~"^(museum|gallery|attraction)$"]${bbox};`,
    `nwr["name"]["leisure"~"^(park|garden)$"]${bbox};`,
    `nwr["name"]["historic"~"^(memorial|monument)$"]${bbox};`,
    `nwr["name"]["waterway"~"^(dock)$"]${bbox};`,
    `nwr["name"]["man_made"="bridge"]${bbox};`
  ];

  return `[out:json][timeout:${timeoutSeconds}];
(
${clauses.join("\n")}
);
out center tags;`;
}

function normalizeElements(elements, fetchedAt, publicSet) {
  const seen = new Set();
  return elements
    .map((element) => normalizeElement(element, fetchedAt))
    .filter(Boolean)
    .filter((location) => shouldKeepLocation(location, publicSet))
    .filter((location) => {
      if (seen.has(location.id)) return false;
      seen.add(location.id);
      return true;
    })
    .sort((a, b) => {
      const scoreDelta = (b.importMeta.priorityScore || 0) - (a.importMeta.priorityScore || 0);
      if (scoreDelta !== 0) return scoreDelta;
      return a.name.localeCompare(b.name);
    });
}

function shouldKeepLocation(location, publicSet) {
  if (publicSet !== "notable") return true;
  const alwaysKeep = new Set([
    "railway_station",
    "hospital",
    "museum",
    "theatre",
    "courthouse",
    "dock",
    "town_hall",
    "police_station"
  ]);
  if (alwaysKeep.has(location.type)) return true;

  const needsWiki = new Set(["bridge", "university", "college", "library", "market"]);
  if (needsWiki.has(location.type)) {
    return Boolean(location.importMeta?.sourceTags?.wikidata || location.importMeta?.sourceTags?.wikipedia);
  }

  return false;
}

function normalizeElement(element, fetchedAt) {
  const tags = element.tags || {};
  const name = cleanName(tags.name);
  if (!name) return null;

  const coordinates = getCoordinates(element);
  if (!coordinates) return null;

  const classification = classify(tags);
  if (!classification) return null;

  return {
    id: buildLocationId(element, name),
    name,
    aliases: collectAliases(tags),
    type: classification.type,
    address: buildAddress(tags),
    district: deriveDistrict(tags),
    coordinates,
    tags: unique([
      "osm_import",
      "modern_reference",
      classification.type,
      ...classification.extraTags
    ]),
    defaultVisitText: buildDescription(name, classification),
    sourceRefs: [
      {
        label: `Imported from OpenStreetMap ${element.type}/${element.id}`,
        url: `https://www.openstreetmap.org/${element.type}/${element.id}`,
        license: "ODbL-1.0"
      }
    ],
    status: "imported",
    visibility: "public",
    reviewStatus: "candidate",
    historicalStatus: "unknown",
    importMeta: {
      provider: "openstreetmap",
      fetchedAt,
      osmType: element.type,
      osmId: element.id,
      sourceTags: pickSourceTags(tags),
      priorityScore: classification.priorityScore
    }
  };
}

function getCoordinates(element) {
  const lat = Number(element.lat ?? element.center?.lat);
  const lng = Number(element.lon ?? element.center?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function classify(tags) {
  if (tags.railway === "station" || tags.railway === "halt") {
    return { type: "railway_station", extraTags: ["transport", "station"], priorityScore: 100 };
  }
  if (tags.amenity === "place_of_worship") {
    return { type: "church", extraTags: ["religion"], priorityScore: 92 };
  }
  if (tags.amenity === "hospital") {
    return { type: "hospital", extraTags: ["medical"], priorityScore: 95 };
  }
  if (["school", "college", "university"].includes(tags.amenity)) {
    return { type: tags.amenity, extraTags: ["education"], priorityScore: 80 };
  }
  if (tags.amenity === "theatre") {
    return { type: "theatre", extraTags: ["entertainment"], priorityScore: 82 };
  }
  if (tags.amenity === "library") {
    return { type: "library", extraTags: ["reading"], priorityScore: 76 };
  }
  if (tags.amenity === "police") {
    return { type: "police_station", extraTags: ["police"], priorityScore: 85 };
  }
  if (tags.amenity === "post_office") {
    return { type: "post_office", extraTags: ["communications"], priorityScore: 78 };
  }
  if (tags.amenity === "courthouse") {
    return { type: "courthouse", extraTags: ["law"], priorityScore: 84 };
  }
  if (tags.amenity === "townhall") {
    return { type: "town_hall", extraTags: ["government"], priorityScore: 82 };
  }
  if (tags.amenity === "bank") {
    return { type: "bank", extraTags: ["finance"], priorityScore: 78 };
  }
  if (tags.amenity === "marketplace") {
    return { type: "market", extraTags: ["commerce"], priorityScore: 72 };
  }
  if (tags.tourism === "museum") {
    return { type: "museum", extraTags: ["culture"], priorityScore: 88 };
  }
  if (tags.tourism === "gallery") {
    return { type: "gallery", extraTags: ["culture"], priorityScore: 82 };
  }
  if (tags.tourism === "attraction") {
    return { type: "landmark", extraTags: ["landmark"], priorityScore: 60 };
  }
  if (tags.leisure === "park") {
    return { type: "park", extraTags: ["green_space"], priorityScore: 72 };
  }
  if (tags.leisure === "garden") {
    return { type: "garden", extraTags: ["green_space"], priorityScore: 70 };
  }
  if (tags.historic === "memorial") {
    return { type: "memorial", extraTags: ["historic"], priorityScore: 66 };
  }
  if (tags.historic === "monument") {
    return { type: "monument", extraTags: ["historic"], priorityScore: 74 };
  }
  if (tags.waterway === "dock") {
    return { type: "dock", extraTags: ["shipping"], priorityScore: 84 };
  }
  if (tags.man_made === "bridge") {
    return { type: "bridge", extraTags: ["transport"], priorityScore: 90 };
  }
  return null;
}

function buildLocationId(element, name) {
  return `osm_${element.type}_${element.id}_${slugify(name)}`;
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function collectAliases(tags) {
  return unique([
    tags["official_name"],
    tags["short_name"],
    tags["old_name"],
    ...(tags["alt_name"] ? tags["alt_name"].split(";") : [])
  ].map((item) => cleanName(item)).filter(Boolean));
}

function buildAddress(tags) {
  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ").trim();
  const locality = [tags["addr:suburb"], tags["addr:city"], tags["addr:postcode"]].filter(Boolean).join(", ").trim();
  const assembled = [street, locality].filter(Boolean).join(", ");
  return assembled || tags.address || "";
}

function deriveDistrict(tags) {
  return tags["addr:postcode"] || tags["addr:suburb"] || tags["addr:city_district"] || "";
}

function buildDescription(name, classification) {
  return `${name} imported from modern OpenStreetMap as a ${classification.type.replaceAll("_", " ")} reference point. Historical fit should be reviewed before case authoring.`;
}

function cleanName(value) {
  const text = String(value || "").trim();
  return text || null;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function pickSourceTags(tags) {
  const keys = [
    "name",
    "amenity",
    "railway",
    "tourism",
    "historic",
    "leisure",
    "waterway",
    "man_made",
    "addr:housenumber",
    "addr:street",
    "addr:postcode",
    "wikidata",
    "wikipedia"
  ];
  return Object.fromEntries(keys.filter((key) => tags[key]).map((key) => [key, tags[key]]));
}

function buildSummary(locations, bounds, fetchedAt, rawCount) {
  const typeCounts = {};
  for (const location of locations) {
    typeCounts[location.type] = (typeCounts[location.type] || 0) + 1;
  }
  return {
    fetchedAt,
    bounds,
    rawElementCount: rawCount,
    locationCount: locations.length,
    typeCounts
  };
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function writeJson(relativePath, value) {
  const absolutePath = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`);
}
