import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("static app files exist and load the runtime", () => {
  const html = fs.readFileSync("public/index.html", "utf8");
  assert.match(html, /<div id="map"/);
  assert.match(html, /assets\/app\.js/);
  assert.match(html, /maplibre-gl/);
  assert.match(html, /data-view="cases"/);
  assert.match(html, /data-view="briefing"/);
  assert.match(html, /data-view="notebook"/);
  assert.match(html, /data-view="theory"/);
  assert.match(html, /id="openNewspaper"/);
  assert.match(html, /id="searchPanel"/);
  assert.doesNotMatch(html, /evidenceCount|factCount|evidenceList/);
});

test("public pages declare the Gaslights favicon", () => {
  const favicon = fs.readFileSync("public/favicon.svg", "utf8");
  assert.match(favicon, /<svg[^>]+viewBox="0 0 64 64"/);
  assert.match(favicon, /Gaslights/);
  for (const file of [
    "public/index.html",
    "public/editor.html",
    "public/editor/index.html",
    "public/poi-review.html",
    "public/location-editor.html",
    "public/crop-review.html"
  ]) {
    const html = fs.readFileSync(file, "utf8");
    assert.match(html, /<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml" \/>/, `${file} should link favicon.svg`);
  }
});

test("public data files are present for static serving", () => {
  for (const file of [
    "public/data/map-sources.json",
    "public/data/london1895/locations.seed.json",
    "public/data/london1895/locations.osm.json",
    "public/data/london1895/location-overrides.json",
    "public/data/london1895/generic-lead-rules.seed.json",
    "public/data/cases/index.json",
    "public/data/cases/missing-chemist.case.json",
    "public/data/newspapers/1894-05-17-london-evening-chronicle.json"
  ]) {
    assert.equal(fs.existsSync(file), true, `${file} should exist`);
    JSON.parse(fs.readFileSync(file, "utf8"));
  }
});

test("missing chemist uses canonical case authoring fields", () => {
  const caseData = JSON.parse(fs.readFileSync("public/data/cases/missing-chemist.case.json", "utf8"));
  assert.equal(Array.isArray(caseData.casePeopleIds), true);
  assert.equal(Array.isArray(caseData.caseLocationIds), true);
  assert.equal(typeof caseData.caseLocationRoles, "object");
  assert.equal(typeof caseData.newspaperIssueId, "string");
  assert.equal(Array.isArray(caseData.visitRules), true);
  assert.ok(caseData.visitRules.length > 0);
  assert.equal("people" in caseData, false);
  assert.equal("activeLocationIds" in caseData, false);
  assert.equal("newspaperIssueIds" in caseData, false);
  assert.equal("leads" in caseData, false);
  assert.equal("hubResponses" in caseData, false);
  assert.equal("evidence" in caseData, false);
  assert.equal("facts" in caseData, false);
  assert.equal(Array.isArray(caseData.solutionQuestions), true);
  assert.ok(caseData.solutionQuestions.length > 0);
});

test("editor is split into case and world authoring without evidence panels", () => {
  const html = fs.readFileSync("public/editor/index.html", "utf8");
  assert.match(html, /Case Editor/);
  assert.match(html, /World Places/);
  assert.match(html, /World People/);
  assert.match(html, /id="moveRuleUp"/);
  assert.match(html, /id="moveRuleDown"/);
  assert.doesNotMatch(html, /data-workspace-tab="evidence"/);
  assert.doesNotMatch(html, /data-workspace-tab="facts"/);
  assert.doesNotMatch(html, /id="evidencePanel"/);
  assert.doesNotMatch(html, /id="factsPanel"/);
});

test("rule editor exposes reorder controls and condition builder copy", () => {
  const editor = fs.readFileSync("public/assets/location-editor.js", "utf8");
  assert.match(editor, /function moveSelectedRule/);
  assert.match(editor, /function applyRuleOrder/);
  assert.match(editor, /Condition summary/);
  assert.match(editor, /Required conditions/);
  assert.match(editor, /Optional conditions/);
  assert.match(editor, /Blocking conditions/);
});

test("editor uses in-page dialogs instead of native browser popups", () => {
  const editor = fs.readFileSync("public/assets/location-editor.js", "utf8");
  const css = fs.readFileSync("public/assets/location-editor.css", "utf8");
  assert.doesNotMatch(editor, /window\.confirm|alert\(/);
  assert.match(editor, /function confirmInEditor/);
  assert.match(editor, /function showEditorMessage/);
  assert.match(css, /\.editor-modal-backdrop/);
});

test("editor sidebar lists are paginated", () => {
  const editor = fs.readFileSync("public/assets/location-editor.js", "utf8");
  const css = fs.readFileSync("public/assets/location-editor.css", "utf8");
  assert.match(editor, /SIDEBAR_PAGE_SIZE/);
  assert.match(editor, /function paginateSidebarItems/);
  assert.match(editor, /function buildSidebarPagination/);
  assert.match(editor, /data-page-action="next"/);
  assert.match(css, /\.list-pagination/);
});

test("world places sidebar supports configurable sorting", () => {
  const html = `${fs.readFileSync("public/editor.html", "utf8")}\n${fs.readFileSync("public/editor/index.html", "utf8")}`;
  const editor = fs.readFileSync("public/assets/location-editor.js", "utf8");
  assert.match(html, /id="locationSort" data-editor-select/);
  assert.match(html, /<option value="name">Alphabetical<\/option>/);
  assert.match(html, /<option value="type">POI type<\/option>/);
  assert.match(html, /<option value="visibility">Visibility<\/option>/);
  assert.match(html, /<option value="source">Source<\/option>/);
  assert.match(html, /<option value="recent">Recently added<\/option>/);
  assert.match(editor, /LOCATION_SORT_STORAGE_KEY/);
  assert.match(editor, /let locationSortMode = readLocalStorageValue/);
  assert.match(editor, /function sortLocationSidebarItems/);
  assert.match(editor, /locationSortMode === "type"/);
  assert.match(editor, /locationSortMode === "visibility"/);
  assert.match(editor, /locationSortMode === "source"/);
  assert.match(editor, /locationSortMode === "recent"/);
});

test("editor sidebar action buttons cannot overflow the column", () => {
  const css = fs.readFileSync("public/assets/location-editor.css", "utf8");
  assert.match(css, /\.tab-actions\s*\{[^}]*display: grid;/s);
  assert.match(css, /\.tab-actions\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/s);
  assert.match(css, /button\s*\{[^}]*min-width: 0;/s);
  assert.match(css, /button\s*\{[^}]*overflow-wrap: anywhere;/s);
  assert.match(css, /\.tab-actions \.secondary-button:last-child:nth-child\(odd\)/);
});

test("editor work areas are constrained on wide monitors", () => {
  const css = fs.readFileSync("public/assets/location-editor.css", "utf8");
  assert.match(css, /--editor-content-max:\s*1320px;/);
  assert.match(css, /--editor-form-max:\s*980px;/);
  assert.match(css, /\.editor-main > \.editor-panel\s*\{[^}]*width: min\(100%, var\(--editor-content-max\)\);/s);
  assert.match(css, /\.editor-main > \.editor-panel\s*\{[^}]*margin-inline: auto;/s);
  assert.match(css, /\.editor-panel > \.panel-header,\s*\.editor-panel > \.editor-workspace,\s*\.workspace-panel > \.editor-form\s*\{[^}]*width: min\(100%, var\(--editor-form-max\)\);/s);
  assert.match(css, /#caseWorkspacePanel > \.panel-header\s*\{[^}]*width: 100%;/s);
  assert.match(css, /\.editor-panel > \.editor-workspace\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\);/s);
});

test("bulk import export controls are grouped away from selected record headers", () => {
  const html = fs.readFileSync("public/editor/index.html", "utf8");
  const css = fs.readFileSync("public/assets/location-editor.css", "utf8");
  assert.match(html, /Bulk case data/);
  assert.match(html, /Bulk place data/);
  assert.match(html, /Bulk people data/);
  assert.match(html, /Bulk newspaper data/);
  const locationPanel = html.match(/<section id="locationWorkspacePanel"[\s\S]*?<section id="peopleWorkspacePanel"/)?.[0] || "";
  assert.doesNotMatch(locationPanel, /exportLocations|importLocations/);
  const newspaperHeader = html.match(/<p class="eyebrow">Newspaper<\/p>[\s\S]*?<div class="bulk-actions inline-bulk-actions">/)?.[0] || "";
  assert.doesNotMatch(newspaperHeader, /exportNewspaper|importNewspaper/);
  assert.match(css, /\.bulk-actions\s*\{[^}]*display: grid;/s);
});

test("editor sidebar supports bulk selection actions", () => {
  const html = `${fs.readFileSync("public/editor/index.html", "utf8")}\n${fs.readFileSync("public/editor.html", "utf8")}`;
  const editor = fs.readFileSync("public/assets/location-editor.js", "utf8");
  const css = fs.readFileSync("public/assets/location-editor.css", "utf8");
  assert.match(html, /selectVisibleLocations/);
  assert.match(html, /deleteSelectedLocations/);
  assert.match(html, /exportSelectedLocationsCsv/);
  assert.match(html, /selectVisiblePeople/);
  assert.match(html, /deleteSelectedPeople/);
  assert.match(html, /deleteSelectedCases/);
  assert.match(editor, /const sidebarSelections/);
  assert.match(editor, /function bindBulkSelectionActions/);
  assert.match(editor, /function deleteSelectedRecords/);
  assert.match(editor, /function exportSelectedSidebarItems/);
  assert.match(css, /\.selection-actions/);
  assert.match(css, /\.location-row/);
  assert.match(css, /\.record-select/);
});

test("world people editor uses searchable location pickers", () => {
  const editor = fs.readFileSync("public/assets/location-editor.js", "utf8");
  const css = fs.readFileSync("public/assets/location-editor.css", "utf8");
  assert.match(editor, /function buildLocationPickerHtml/);
  assert.match(editor, /function bindLocationPickers/);
  assert.match(editor, /function initLocationPickerMap/);
  assert.match(editor, /function syncLocationPickerMap/);
  assert.match(editor, /personResidencePicker/);
  assert.match(editor, /personWorkPicker/);
  assert.match(editor, /getLocationPickerValue\("personResidencePicker"\)/);
  assert.match(editor, /getLocationPickerValues\("personWorkPicker"\)/);
  assert.doesNotMatch(editor, /name="residenceLocationId"[\\s\\S]{0,120}<select/);
  assert.doesNotMatch(editor, /name="workLocationIds"[\\s\\S]{0,120}<select/);
  assert.match(css, /\.location-picker/);
  assert.match(css, /\.location-token/);
  assert.match(css, /\.location-picker-results/);
  assert.match(css, /\.location-picker-map/);
});

test("editor map previews exist for case, world place, and people pickers", () => {
  const html = fs.readFileSync("public/editor/index.html", "utf8");
  const editor = fs.readFileSync("public/assets/location-editor.js", "utf8");
  const css = fs.readFileSync("public/assets/location-editor.css", "utf8");
  const server = fs.readFileSync("scripts/location-editor-server.mjs", "utf8");
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, new Set(ids).size, "editor ids should be unique");
  assert.match(html, /id="caseLocationMap"/);
  assert.match(html, /id="locationMap"/);
  assert.match(html, /id="centerCaseLocationMap"/);
  assert.match(html, /id="centerLocationMap"/);
  assert.match(editor, /function initCaseLocationMap/);
  assert.match(editor, /function createEditorMapView/);
  assert.match(editor, /function syncCaseLocationMap/);
  assert.match(editor, /EDITOR_API_BASE\}\/tiles\/london-1895-six-inch/);
  assert.doesNotMatch(editor, /EDITOR_APP_BASE/);
  assert.match(editor, /function setEditorHistoricalOpacity/);
  assert.match(editor, /function buildEditorMapOpacityControlHtml/);
  assert.match(editor, /const EDITOR_MODERN_BASE_OPACITY = 1;/);
  assert.match(editor, /"raster-opacity": historicalOpacity/);
  assert.match(html, /data-historical-opacity/);
  assert.doesNotMatch(html, /mapModeHistorical|mapModeModern|Modern<\/span>/);
  assert.doesNotMatch(editor, /mapMode/);
  assert.match(css, /#locationWorkspacePanel > \.editor-workspace\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\) 360px;/s);
  assert.match(css, /\.editor-map-opacity/);
  assert.match(css, /\.editor-map-component/);
  assert.match(server, /pathname\.startsWith\("\/tiles\/"\)/);
  assert.match(server, /\.png": "image\/png"/);
});

test("world places editor supports fast map-based location entry", () => {
  const html = `${fs.readFileSync("public/editor.html", "utf8")}\n${fs.readFileSync("public/editor/index.html", "utf8")}`;
  const editor = fs.readFileSync("public/assets/location-editor.js", "utf8");
  const css = fs.readFileSync("public/assets/location-editor.css", "utf8");
  const server = fs.readFileSync("scripts/location-editor-server.mjs", "utf8");
  assert.match(html, /form="locationForm" data-location-save-action="save"/);
  assert.match(html, /form="locationForm" data-location-save-action="save-new"/);
  assert.match(html, /id="toggleLocationMapSize"/);
  assert.match(editor, /LOCATION_MAP_SIZE_STORAGE_KEY/);
  assert.match(editor, /function setLocationMapExpanded/);
  assert.match(editor, /function syncLocationMapSizeUi/);
  assert.match(editor, /dataset\.locationSaveAction === "save-new"/);
  assert.match(editor, /const saveAndNewCoordinates = event\.submitter\?\.dataset\.locationSaveAction === "save-new"/);
  assert.match(editor, /function getLocationCoordinateSeed/);
  assert.match(editor, /coordinates: saveAndNewCoordinates \|\| payload\.coordinates/);
  assert.match(editor, /locationMarker\?\.getLngLat/);
  assert.match(editor, /async function createLocation\(seed = \{\}\)/);
  assert.match(editor, /visibility: "public"/);
  assert.match(server, /visibility: input\.visibility \?\? "public"/);
  assert.ok(editor.indexOf('name="lat"') < editor.indexOf('name="searchPreviewText"'), "lat/lng fields should be above search preview text");
  assert.match(css, /#locationWorkspacePanel > \.panel-header\s*\{[^}]*position: sticky;/s);
  assert.match(css, /#locationWorkspacePanel\.is-map-expanded > \.editor-workspace\s*\{[^}]*minmax\(560px, 1\.25fr\)/s);
  assert.match(css, /#locationWorkspacePanel\.is-map-expanded \.editor-map\s*\{[^}]*min-height: min\(72vh, 760px\);/s);
});

test("world places editor map shows existing POIs and nearby duplicate context", () => {
  const html = `${fs.readFileSync("public/editor.html", "utf8")}\n${fs.readFileSync("public/editor/index.html", "utf8")}`;
  const editor = fs.readFileSync("public/assets/location-editor.js", "utf8");
  const css = fs.readFileSync("public/assets/location-editor.css", "utf8");
  assert.match(html, /id="locationNearbyList"/);
  assert.match(editor, /let locationPoiMarkers = new Map\(\)/);
  assert.match(editor, /function syncLocationPoiMarkers/);
  assert.match(editor, /function ensureLocationPoiMarker/);
  assert.match(editor, /function locationPoiMarkerClass/);
  assert.match(editor, /function renderNearbyLocations/);
  assert.match(editor, /function distanceMeters/);
  assert.match(editor, /data-nearby-location-id/);
  assert.match(editor, /selectedLocationId = location\.id/);
  assert.match(editor, /event\.stopPropagation\(\)/);
  assert.match(css, /\.editor-poi-marker/);
  assert.match(css, /\.editor-poi-marker\.is-selected/);
  assert.match(css, /\.nearby-list/);
  assert.match(css, /\.nearby-item/);
});

test("editor uses author-facing metadata and styled dropdown controls", () => {
  const html = `${fs.readFileSync("public/editor/index.html", "utf8")}\n${fs.readFileSync("public/editor.html", "utf8")}`;
  const editor = fs.readFileSync("public/assets/location-editor.js", "utf8");
  const css = fs.readFileSync("public/assets/location-editor.css", "utf8");
  assert.doesNotMatch(html, />Idle</);
  assert.match(html, /id="locationSubtitle"/);
  assert.match(html, /status-pill" title="Shows whether/);
  assert.match(editor, /function formatLocationHeaderSubtitle/);
  assert.match(editor, /Search preview text/);
  assert.match(editor, /POI type/);
  assert.match(editor, /data-editor-select/);
  assert.match(editor, /function enhanceEditorSelects/);
  assert.match(editor, /function fieldLabel/);
  assert.match(editor, /data-tooltip/);
  assert.doesNotMatch(editor, /class="help-dot"[^`]*title=/);
  assert.match(editor, /name="type" data-editor-select/);
  assert.match(editor, /name="visibility" data-editor-select/);
  assert.match(editor, /name="kind" data-editor-select/);
  assert.doesNotMatch(editor, /<span>Source<\/span>/);
  assert.doesNotMatch(editor, /list="location-type-options"/);
  assert.match(css, /\.editor-select-button/);
  assert.match(css, /\.editor-select-menu/);
  assert.match(css, /\.help-dot/);
  assert.match(css, /\.help-dot::after/);
  assert.match(css, /\.help-dot::after\s*\{[^}]*top: calc\(100% \+ 8px\);/s);
  assert.doesNotMatch(css, /\.help-dot::after\s*\{[^}]*bottom: calc\(100% \+ 8px\);/s);
  assert.match(css, /\.help-dot:hover::after/);
  assert.match(css, /\.panel-subtitle/);
});

test("world place text editor uses structured world visit text fields", () => {
  const editor = fs.readFileSync("public/assets/location-editor.js", "utf8");
  const css = fs.readFileSync("public/assets/location-editor.css", "utf8");
  assert.doesNotMatch(editor, /World visit rules JSON/);
  assert.doesNotMatch(editor, /Advanced: world-level visit text/);
  assert.doesNotMatch(editor, /Raw world visit rules/);
  assert.match(editor, /Search preview text/);
  assert.match(editor, /Default visit text/);
  assert.match(editor, /World Visit Texts/);
  assert.match(editor, /Use this only for reusable world behavior/);
  assert.match(editor, /function buildWorldVisitRulesEditorHtml/);
  assert.match(editor, /function parseWorldVisitRulesFromForm/);
  assert.match(css, /\.world-visit-editor/);
  assert.match(css, /\.world-rule-card/);
});

test("location data and import export use the new world text field names", () => {
  const editor = fs.readFileSync("public/assets/location-editor.js", "utf8");
  assert.match(editor, /searchPreviewText/);
  assert.match(editor, /defaultVisitText/);
  assert.match(editor, /worldVisitRules/);
  assert.doesNotMatch(editor, /searchDescription|globalDescription|row\.description/);

  for (const file of [
    "public/data/london1895/locations.seed.json",
    "public/data/london1895/locations.osm.json",
    "public/data/london1895/location-overrides.json"
  ]) {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const locations = Array.isArray(data)
      ? data
      : [...Object.values(data.patches || {}), ...(data.additions || [])];
    for (const location of locations) {
      assert.equal("searchDescription" in location, false, `${file}:${location.id} uses searchDescription`);
      assert.equal("globalDescription" in location, false, `${file}:${location.id} uses globalDescription`);
      assert.equal("visitRules" in location, false, `${file}:${location.id} uses location visitRules`);
    }
  }
});

test("bulk location import upserts by id instead of appending duplicates", () => {
  const server = fs.readFileSync("scripts/location-editor-server.mjs", "utf8");
  const editor = fs.readFileSync("public/assets/location-editor.js", "utf8");
  assert.match(server, /function importLocations\(body\)/);
  assert.match(server, /const seedIds = new Set/);
  assert.match(server, /const authoredById = new Map/);
  assert.match(server, /authoredById\.set\(locationId, stripLocationMeta\(normalized\)\)/);
  assert.match(server, /patches\[locationId\] = pruneEmptyPatch/);
  assert.match(server, /retiredLocationIds\.delete\(locationId\)/);
  assert.match(server, /importSummary: \{ created, updated, skipped \}/);
  assert.doesNotMatch(server, /if \(mergeLocations\(\)\.some\(\(location\) => location\.id === item\.id\)\) updateLocation/);
  assert.doesNotMatch(server, /else createLocation\(item\)/);
  assert.match(editor, /function formatImportStatus/);
  assert.match(editor, /Imported: \$\{created\} new, \$\{updated\} updated/);
});

test("world place editor can rename authored location ids", () => {
  const server = fs.readFileSync("scripts/location-editor-server.mjs", "utf8");
  const editor = fs.readFileSync("public/assets/location-editor.js", "utf8");
  assert.match(server, /\.\.\.authored\.map\(\(location\) => normalizeLocationRecord\(location, \{ sourceKind: "authored" \}\)\)/);
  assert.match(server, /const nextId = String\(input\.id \|\| locationId\)\.trim\(\);/);
  assert.match(server, /if \(nextId !== locationId\)/);
  assert.match(server, /id: String\(location\.id \|\| uniqueId\(slugify\(location\.name \|\| "location"\)/);
  assert.match(server, /lat: numberOr\(location\.lat \?\? location\.coordinates\?\.lat/);
  assert.match(server, /lng: numberOr\(location\.lng \?\? location\.coordinates\?\.lng/);
  assert.match(editor, /id: form\.get\("id"\)/);
  assert.match(editor, /fetch\(`\$\{EDITOR_API_BASE\}\/api\/locations\/\$\{encodeURIComponent\(location\.id\)\}`,\s*\{\s*method: "PATCH"/s);
  assert.match(editor, /catch \(error\) \{\s*setStatus\(els\.locationStatus, "Save failed"\);/s);
  assert.match(editor, /title: "Location save failed"/);
  assert.doesNotMatch(editor, /form\.get\("id"\) !== location\.id[\s\S]{0,240}method: "POST"/);
});

test("world place id auto-fills safely from name until manually edited", () => {
  const editor = fs.readFileSync("public/assets/location-editor.js", "utf8");
  assert.match(editor, /function bindLocationIdAutofill/);
  assert.match(editor, /function shouldAutofillLocationId/);
  assert.match(editor, /function uniqueLocationIdForName/);
  assert.match(editor, /function slugifyIdentifier/);
  assert.match(editor, /idInput\.readOnly/);
  assert.match(editor, /autoManaged = false/);
  assert.match(editor, /idInput\.value = uniqueLocationIdForName\(nameInput\.value, location\.id\)/);
  assert.match(editor, /\.filter\(\(id\) => id && id !== currentId\)/);
  assert.match(editor, /replace\(\/\[\^a-z0-9\]\+\/g, "_"\)/);
  assert.match(editor, /id === "new_location"/);
});

test("pilot location data excludes accidental OSM import noise", () => {
  const caseData = JSON.parse(fs.readFileSync("public/data/cases/missing-chemist.case.json", "utf8"));
  const seedLocations = JSON.parse(fs.readFileSync("public/data/london1895/locations.seed.json", "utf8"));
  const osmLocations = JSON.parse(fs.readFileSync("public/data/london1895/locations.osm.json", "utf8"));
  const directory = JSON.parse(fs.readFileSync("public/data/london1895/directory.seed.json", "utf8"));
  const caseLocationIds = new Set(caseData.caseLocationIds);

  assert.deepEqual(osmLocations, []);
  assert.deepEqual(directory, []);
  assert.deepEqual(
    seedLocations.map((location) => location.id).sort(),
    [...caseLocationIds].sort()
  );
});

test("workspace tabs map to visible panels", () => {
  const html = fs.readFileSync("public/editor/index.html", "utf8");
  const editor = fs.readFileSync("public/assets/location-editor.js", "utf8");
  const css = fs.readFileSync("public/assets/location-editor.css", "utf8");
  const tabs = [...html.matchAll(/data-workspace-tab="([^"]+)"/g)].map((match) => match[1]);
  const panels = new Set([...html.matchAll(/id="([^"]+Panel)"/g)].map((match) => match[1]));
  const mapping = Object.fromEntries([...editor.matchAll(/(\w+): "([^"]+Panel)"/g)].map((match) => [match[1], match[2]]));
  assert.deepEqual(tabs.sort(), Object.keys(mapping).sort());
  for (const tab of tabs) assert.equal(panels.has(mapping[tab]), true, `${tab} should map to an existing panel`);
  assert.match(css, /\.workspace-panel\s*\{\s*display: none;/s);
  assert.match(css, /\.workspace-panel\.is-active\s*\{\s*display: block;/s);
});

test("visit rendering refreshes state before showing narration", () => {
  const app = fs.readFileSync("public/assets/app.js", "utf8");
  assert.match(app, /function renderInvestigationState\(\)/);
  assert.match(app, /renderInvestigationState\(\);\n\s*renderResolution\(resolution\);/);
});

test("map search highlights result markers and keeps result cards focused", () => {
  const app = fs.readFileSync("public/assets/app.js", "utf8");
  const css = fs.readFileSync("public/assets/styles.css", "utf8");
  assert.match(app, /activeSearchResultLocationIds/);
  assert.match(app, /function syncSearchMarkerHighlight/);
  assert.match(app, /is-search-match/);
  assert.match(app, /is-search-muted/);
  assert.match(app, /kind: formatLocationType\(location\.type\)/);
  assert.doesNotMatch(app, /kind: "Location"/);
  assert.doesNotMatch(app, /\.\.\.\(location\.tags \|\| \[\]\)\.slice\(0, 1\)/);
  assert.match(css, /\.poi-marker\.is-search-muted/);
  assert.match(css, /\.poi-marker\.is-search-match/);
});

test("map POI markers do not animate transform during zoom", () => {
  const app = fs.readFileSync("public/assets/app.js", "utf8");
  const css = fs.readFileSync("public/assets/styles.css", "utf8");
  const markerRule = css.match(/\.poi-marker\s*\{[^}]*\}/s)?.[0] || "";
  const maplibreMarkerRule = css.match(/\.maplibregl-marker\s*\{[^}]*\}/s)?.[0] || "";
  const searchMatchRule = css.match(/\.poi-marker\.is-search-match\s*\{[^}]*\}/s)?.[0] || "";
  const selectedRules = [...css.matchAll(/\.poi-marker\.is-selected\s*\{[^}]*\}/gs)].map((match) => match[0]).join("\n");
  assert.match(app, /let markers = new Map\(\)/);
  assert.match(app, /function ensureMarker\(location\)/);
  assert.match(app, /const classes = \["maplibregl-marker", "maplibregl-marker-anchor-center", "poi-marker"\]/);
  assert.doesNotMatch(app, /markers\.forEach\(\(\{ marker \}\) => marker\.remove\(\)\)/);
  assert.match(app, /function updatePoiProjectionDiagnostics\(\)/);
  assert.doesNotMatch(markerRule, /transition:[^;]*transform/);
  assert.match(markerRule, /position: absolute/);
  assert.match(maplibreMarkerRule, /transition: none !important/);
  assert.doesNotMatch(searchMatchRule, /transform:/);
  assert.match(searchMatchRule, /outline: 3px solid/);
  assert.match(searchMatchRule, /0 0 0 11px/);
  assert.match(selectedRules, /outline: 5px solid/);
  assert.match(selectedRules, /0 0 0 15px/);
});

test("map overlays stay above POI markers", () => {
  const css = fs.readFileSync("public/assets/styles.css", "utf8");
  const mapRule = css.match(/\.map\s*\{[^}]*\}/s)?.[0] || "";
  const sidebarRule = css.match(/\.sidebar\s*\{[^}]*\}/s)?.[0] || "";
  const backdropRule = css.match(/\.mobile-sidebar-backdrop\s*\{[^}]*position: fixed;[^}]*\}/s)?.[0] || "";
  const toolsRule = css.match(/\.map-tools\s*\{[^}]*\}/s)?.[0] || "";
  const overlayRule = css.match(/\.layer-panel,\s*\.search-panel,\s*\.newspaper-panel,\s*\.editor-overlay-shell\s*\{[^}]*\}/s)?.[0] || "";
  const leadRule = css.match(/\.lead-panel\s*\{[^}]*\}/s)?.[0] || "";
  const articleRule = css.match(/\.newspaper-article-panel\s*\{[^}]*\}/s)?.[0] || "";
  assert.match(mapRule, /z-index: 0/);
  assert.match(sidebarRule, /z-index: 70/);
  assert.match(backdropRule, /background: transparent/);
  assert.match(backdropRule, /z-index: 50/);
  assert.match(toolsRule, /z-index: 30/);
  assert.match(overlayRule, /z-index: 20/);
  assert.match(leadRule, /z-index: 20/);
  assert.match(articleRule, /z-index: 25/);
});

test("newspaper panel opens below the top map controls", () => {
  const app = fs.readFileSync("public/assets/app.js", "utf8");
  const css = fs.readFileSync("public/assets/styles.css", "utf8");
  const newspaperRule = css.match(/\.newspaper-panel\s*\{[^}]*\}/s)?.[0] || "";
  assert.match(app, /const NEWSPAPER_DESKTOP_TOP_CLEARANCE = 104/);
  assert.match(app, /els\.newspaperPanel\.style\.top = `\$\{NEWSPAPER_DESKTOP_TOP_CLEARANCE\}px`/);
  assert.match(app, /clamp\(rect\.top, NEWSPAPER_DESKTOP_TOP_CLEARANCE/);
  assert.match(app, /clamp\(event\.clientY - newspaperDrag\.offsetY, NEWSPAPER_DESKTOP_TOP_CLEARANCE/);
  assert.match(newspaperRule, /top: 104px/);
  assert.match(newspaperRule, /max-height: calc\(100vh - 120px\)/);
});

test("newspaper article detail opens in the visible newspaper area", () => {
  const app = fs.readFileSync("public/assets/app.js", "utf8");
  assert.match(app, /function positionNewspaperArticlePanel\(\)/);
  assert.match(app, /els\.newspaperPanel\.scrollTop \+ visibleInset/);
  assert.match(app, /els\.newspaperPanel\.clientHeight - \(visibleInset \* 2\)/);
  assert.match(app, /els\.newspaperPanel\.addEventListener\("scroll"/);
  assert.match(app, /positionNewspaperArticlePanel\(\);\n\s*els\.newspaperArticleMap\.hidden/);
});

test("app exposes the newspaper renderer and no standalone directory surface", () => {
  const app = fs.readFileSync("public/assets/app.js", "utf8");
  assert.match(app, /function renderNewspaper\(\)/);
  assert.match(app, /function showNewspaperItem\(item\)/);
  assert.doesNotMatch(app, /function renderDirectory\(\)/);
  assert.doesNotMatch(app, /function showDirectoryEntry\(entry\)/);
  const html = fs.readFileSync("public/index.html", "utf8");
  assert.doesNotMatch(html, /id="directoryView"/);
});

test("map sources are data-driven", () => {
  const app = fs.readFileSync("public/assets/app.js", "utf8");
  const sources = JSON.parse(fs.readFileSync("public/data/map-sources.json", "utf8"));
  assert.match(app, /mapSources:\s*(?:`\.\/data\/map-sources\.json\?v=\$\{ASSET_VERSION\}`|"\.\/data\/map-sources\.json")/);
  assert.doesNotMatch(app, /historicalTiles:/);
  assert.ok(sources.some((source) => source.id === "london-1895-six-inch-local"));
});
