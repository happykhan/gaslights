import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("static app files exist and load the runtime", () => {
  const html = fs.readFileSync("public/index.html", "utf8");
  assert.match(html, /<div id="map"/);
  assert.match(html, /assets\/app\.js/);
  assert.match(html, /maplibre-gl/);
});

test("public data files are present for static serving", () => {
  for (const file of [
    "public/data/map-sources.json",
    "public/data/london1895/locations.seed.json",
    "public/data/london1895/directory.seed.json",
    "public/data/london1895/generic-lead-rules.seed.json",
    "public/data/cases/missing-chemist.case.json",
    "public/data/newspapers/1894-05-17-london-evening-chronicle.json"
  ]) {
    assert.equal(fs.existsSync(file), true, `${file} should exist`);
    JSON.parse(fs.readFileSync(file, "utf8"));
  }
});

test("visit rendering refreshes state before showing narration", () => {
  const app = fs.readFileSync("public/assets/app.js", "utf8");
  assert.match(app, /function renderInvestigationState\(\)/);
  assert.match(app, /renderInvestigationState\(\);\n\s*renderResolution\(resolution\);/);
});

test("map sources are data-driven", () => {
  const app = fs.readFileSync("public/assets/app.js", "utf8");
  const sources = JSON.parse(fs.readFileSync("public/data/map-sources.json", "utf8"));
  assert.match(app, /mapSources:\s*(?:`\.\/data\/map-sources\.json\?v=\$\{ASSET_VERSION\}`|"\.\/data\/map-sources\.json")/);
  assert.doesNotMatch(app, /historicalTiles:/);
  assert.ok(sources.some((source) => source.id === "london-1895-six-inch-local"));
});
