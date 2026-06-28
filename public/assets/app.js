import {
  applyResolution,
  compareTheory,
  createInitialState,
  getTheorySlots,
  isLocationKnown,
  resolveVisit
} from "./case-engine.js?v=202606281510";
const ASSET_VERSION = "202606281510";

const DATA_PATHS = {
  locationsSeed: "./data/london1895/locations.seed.json",
  locationsOsm: "./data/london1895/locations.osm.json",
  locationsAuthored: "./data/london1895/locations.authored.json",
  people: "./data/london1895/people.seed.json",
  locationOverrides: "./data/london1895/location-overrides.json",
  genericRules: "./data/london1895/generic-lead-rules.seed.json",
  newspaperIndex: "./data/newspapers/index.json",
  caseIndex: "./data/cases/index.json",
  mapSources: `./data/map-sources.json?v=${ASSET_VERSION}`
};

const MAP_CONFIG = {
  center: [-0.1246, 51.5079],
  zoom: 12.6
};
const MAP_MAX_BOUNDS = [
  [-0.55, 51.28],
  [0.30, 51.72]
];
const MAP_MIN_ZOOM = 12.6;
const MAP_MAX_USER_ZOOM = 17.5;
const PUBLIC_POI_MARKER_MIN_ZOOM = 12;
const HISTORICAL_SOURCE_ID = "london-1895-six-inch-local";
const HISTORICAL_LAYER_MIN_ZOOM = 11;
const HISTORICAL_OVERZOOM_STEPS = 2;
const MODERN_BASE_OPACITY = 0.28;

const storeKey = "gaslights:missing_chemist:v1";
const selectedCaseKey = "gaslights:selected-case:v1";
const mapLayerStoreKey = "gaslights:map-layers:v1";
const poiLayerStoreKey = "gaslights:poi-layers:v1";
const data = await loadData();
let state = loadState(data.caseData);
let mapLayerState = loadMapLayerState(data.mapSources);
let poiLayerState = loadPoiLayerState(data.locations);
let selectedLocationId = null;
let map;
let markers = new Map();
let activeSearchResultLocationIds = new Set();
let newspaperDrag = null;
let newspaperResize = null;

const NEWSPAPER_MIN_WIDTH = 520;
const NEWSPAPER_MIN_HEIGHT = 420;
const NEWSPAPER_MAX_COLUMNS = 6;
const NEWSPAPER_FIXED_WIDTH = 800;
const NEWSPAPER_DESKTOP_TOP_CLEARANCE = 104;

const els = {
  caseSummary: document.querySelector("#caseSummary"),
  caseTitle: document.querySelector("#caseTitle"),
  caseIntro: document.querySelector("#caseIntro"),
  caseDate: document.querySelector("#caseDate"),
  leadCount: document.querySelector("#leadCount"),
  visitCount: document.querySelector("#visitCount"),
  caseCount: document.querySelector("#caseCount"),
  caseList: document.querySelector("#caseList"),
  searchInput: document.querySelector("#searchInput"),
  runSearch: document.querySelector("#runSearch"),
  togglePoiLayers: document.querySelector("#togglePoiLayers"),
  searchResults: document.querySelector("#searchResults"),
  searchPanel: document.querySelector("#searchPanel"),
  closeSearchPanel: document.querySelector("#closeSearchPanel"),
  newspaperResults: document.querySelector("#newspaperResults"),
  newspaperTitle: document.querySelector("#newspaperTitle"),
  newspaperDate: document.querySelector("#newspaperDate"),
  newspaperIssueLine: document.querySelector("#newspaperIssueLine"),
  newspaperPanel: document.querySelector("#newspaperPanel"),
  newspaperMasthead: document.querySelector(".newspaper-masthead"),
  newspaperResizeHandles: document.querySelectorAll("[data-resize-direction]"),
  openNewspaper: document.querySelector("#openNewspaper"),
  closeNewspaper: document.querySelector("#closeNewspaper"),
  newspaperArticlePanel: document.querySelector("#newspaperArticlePanel"),
  closeNewspaperArticle: document.querySelector("#closeNewspaperArticle"),
  newspaperArticleType: document.querySelector("#newspaperArticleType"),
  newspaperArticleHeadline: document.querySelector("#newspaperArticleHeadline"),
  newspaperArticleBody: document.querySelector("#newspaperArticleBody"),
  newspaperArticleMap: document.querySelector("#newspaperArticleMap"),
  layerPanel: document.querySelector("#layerPanel"),
  enableAllPoiLayers: document.querySelector("#enableAllPoiLayers"),
  disableAllPoiLayers: document.querySelector("#disableAllPoiLayers"),
  poiLayerFilters: document.querySelector("#poiLayerFilters"),
  poiLayerSummary: document.querySelector("#poiLayerSummary"),
  factList: document.querySelector("#factList"),
  noteList: document.querySelector("#noteList"),
  theoryForm: document.querySelector("#theoryForm"),
  solutionResult: document.querySelector("#solutionResult"),
  leadPanel: document.querySelector("#leadPanel"),
  leadKicker: document.querySelector("#leadKicker"),
  leadTitle: document.querySelector("#leadTitle"),
  leadText: document.querySelector("#leadText"),
  leadDiscoveries: document.querySelector("#leadDiscoveries"),
  showOnMap: document.querySelector("#showOnMap"),
  visitLocation: document.querySelector("#visitLocation"),
  closeLead: document.querySelector("#closeLead"),
  historicalOpacity: document.querySelector("#historicalOpacity"),
  zoomLevel: document.querySelector("#zoomLevel"),
  openSidebarDrawer: document.querySelector("#openSidebarDrawer"),
  closeSidebarDrawer: document.querySelector("#closeSidebarDrawer"),
  mobileSidebarBackdrop: document.querySelector("#mobileSidebarBackdrop"),
  openEditor: document.querySelector("#openEditor"),
  openEditorBrand: document.querySelector("#openEditorBrand"),
  editorOverlay: document.querySelector("#editorOverlay"),
  closeEditorOverlay: document.querySelector("#closeEditorOverlay"),
  editorFrame: document.querySelector("#editorFrame")
};

boot();

async function loadData() {
  const entries = await Promise.all(Object.entries(DATA_PATHS).map(async ([key, path]) => {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed to load ${path}`);
    return [key, await response.json()];
  }));
  const loaded = Object.fromEntries(entries);
  const selectedCase = chooseCaseMeta(loaded.caseIndex || []);
  const caseResponse = await fetch(`${selectedCase.path}?v=${ASSET_VERSION}`, { cache: "no-store" });
  if (!caseResponse.ok) throw new Error(`Failed to load ${selectedCase.path}`);
  const caseData = normalizeCaseData(await caseResponse.json());
  const issueId = caseData.newspaperIssueId || caseData.newspaperIssueIds?.[0];
  const issueMeta = (loaded.newspaperIndex || []).find((item) => item.id === issueId);
  const newspaperPath = issueMeta?.path || "./data/newspapers/1894-05-17-london-evening-chronicle.json";
  const newspaperResponse = await fetch(`${newspaperPath}?v=${ASSET_VERSION}`, { cache: "no-store" });
  if (!newspaperResponse.ok) throw new Error(`Failed to load ${newspaperPath}`);
  const newspaper = await newspaperResponse.json();
  return {
    ...loaded,
    selectedCase,
    caseData,
    newspaper,
    locations: applyLocationOverrides([
      ...(loaded.locationsSeed || []),
      ...(loaded.locationsOsm || []),
      ...(loaded.locationsAuthored || [])
    ], loaded.locationOverrides || {})
  };
}

function boot() {
  closeSidebarDrawer();
  resetNewspaperPositionForViewport();
  renderStaticCase();
  renderPoiLayerFilters();
  initMap();
  bindEvents();
  renderAll();
}

function initMap() {
  const style = {
    version: 8,
    sources: {},
    layers: []
  };
  const mapMaxZoom = getAppMaxZoom();

  for (const source of data.mapSources.filter((item) => item.kind === "raster_xyz")) {
    const sourceMinZoom = getRenderableSourceMinZoom(source);
    const sourceMaxZoom = getRenderableSourceMaxZoom(source);
    const layerMaxZoom = getRenderableLayerMaxZoom(source);
    style.sources[source.id] = {
      type: "raster",
      tiles: source.tiles,
      tileSize: source.tileSize || 256,
      attribution: source.attribution,
      ...(Array.isArray(source.bounds) && source.bounds.length === 4 ? { bounds: source.bounds } : {}),
      minzoom: sourceMinZoom,
      maxzoom: sourceMaxZoom
    };
    style.layers.push({
      id: source.id,
      type: "raster",
      source: source.id,
      minzoom: sourceMinZoom,
      maxzoom: layerMaxZoom,
      paint: { "raster-opacity": getInitialMapSourceOpacity(source) },
      layout: { visibility: isMapSourceVisible(source.id) ? "visible" : "none" }
    });
  }

  map = new maplibregl.Map({
    container: "map",
    center: MAP_CONFIG.center,
    zoom: MAP_CONFIG.zoom,
    maxBounds: MAP_MAX_BOUNDS,
    minZoom: MAP_MIN_ZOOM,
    maxZoom: mapMaxZoom,
    style
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  map.on("load", () => {
    syncHistoricalControls();
    syncZoomIndicator();
    renderMarkers();
  });
  map.on("zoom", syncZoomIndicator);
  map.on("zoomend", renderMarkers);
  map.on("move", () => {
    syncZoomIndicator();
    updatePoiProjectionDiagnostics();
  });
  map.on("zoom", updatePoiProjectionDiagnostics);
  installDebugHooks();
}

function getRenderableSourceMinZoom(source) {
  return isHistoricalLocalSource(source)
    ? (source.minzoom ?? HISTORICAL_LAYER_MIN_ZOOM)
    : (source.minzoom ?? 0);
}

function getRenderableSourceMaxZoom(source) {
  return source.maxzoom ?? getAppMaxZoom();
}

function getRenderableLayerMaxZoom(source) {
  return isHistoricalLocalSource(source)
    ? getHistoricalLayerMaxZoom(source)
    : getRenderableSourceMaxZoom(source);
}

function getHistoricalLayerMaxZoom(source = data.mapSources.find((item) => item.id === HISTORICAL_SOURCE_ID)) {
  const sourceMax = Number(source?.maxzoom ?? 16);
  return sourceMax + HISTORICAL_OVERZOOM_STEPS;
}

function getAppMaxZoom() {
  return MAP_MAX_USER_ZOOM;
}

function isHistoricalLocalSource(source) {
  return source?.id === HISTORICAL_SOURCE_ID;
}

function isModernBaseSource(source) {
  return Boolean(source?.defaultVisible);
}

function getInitialMapSourceOpacity(source) {
  const storedOpacity = getMapSourceOpacity(source.id);
  if (mapLayerState[source.id]?.opacity !== undefined) return storedOpacity;
  return isModernBaseSource(source) ? MODERN_BASE_OPACITY : storedOpacity;
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });
  els.openSidebarDrawer.addEventListener("click", openSidebarDrawer);
  els.closeSidebarDrawer.addEventListener("click", closeSidebarDrawer);
  els.mobileSidebarBackdrop.addEventListener("click", closeSidebarDrawer);
  [els.openEditor, els.openEditorBrand].filter(Boolean).forEach((button) => {
    button.addEventListener("click", openEditorOverlay);
  });
  els.closeEditorOverlay.addEventListener("click", closeEditorOverlay);
  els.editorOverlay.addEventListener("click", (event) => {
    if (event.target === els.editorOverlay) closeEditorOverlay();
  });
  els.searchInput.addEventListener("input", renderSearch);
  els.runSearch.addEventListener("click", renderSearch);
  els.togglePoiLayers.addEventListener("click", () => {
    els.layerPanel.hidden = !els.layerPanel.hidden;
  });
  els.enableAllPoiLayers.addEventListener("click", () => setAllPoiLayers(true));
  els.disableAllPoiLayers.addEventListener("click", () => setAllPoiLayers(false));
  els.closeSearchPanel.addEventListener("click", () => {
    els.searchPanel.hidden = true;
    els.searchInput.value = "";
    renderSearch();
  });
  els.visitLocation.addEventListener("click", () => visitSelectedLocation());
  els.showOnMap.addEventListener("click", () => {
    if (selectedLocationId) openLocation(selectedLocationId, true);
  });
  els.openNewspaper.addEventListener("click", () => {
    els.newspaperPanel.hidden = false;
    resetNewspaperPositionForViewport();
  });
  els.closeNewspaper.addEventListener("click", () => {
    els.newspaperPanel.hidden = true;
    els.newspaperArticlePanel.hidden = true;
  });
  els.closeNewspaperArticle.addEventListener("click", () => {
    els.newspaperArticlePanel.hidden = true;
  });
  els.newspaperMasthead.addEventListener("pointerdown", startNewspaperDrag);
  els.newspaperResizeHandles.forEach((handle) => {
    handle.addEventListener("pointerdown", startNewspaperResize);
  });
  els.newspaperPanel.addEventListener("scroll", () => {
    if (!els.newspaperArticlePanel.hidden) positionNewspaperArticlePanel();
  });
  els.closeLead.addEventListener("click", () => {
    selectedLocationId = null;
    renderMarkers();
    hideLeadPanel();
  });
  document.querySelector("#resetInvestigation").addEventListener("click", () => {
    state = createInitialState(data.caseData);
    saveState();
    selectedLocationId = null;
    renderAll();
  });
  document.querySelector("#submitTheory").addEventListener("click", submitTheory);
  els.theoryForm.addEventListener("input", handleTheoryInputChange);
  els.theoryForm.addEventListener("change", handleTheoryInputChange);
  els.historicalOpacity.addEventListener("input", () => {
    setHistoricalOpacity(Number(els.historicalOpacity.value));
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!els.editorOverlay.hidden) {
        closeEditorOverlay();
        return;
      }
      closeSidebarDrawer();
      els.layerPanel.hidden = true;
      els.searchPanel.hidden = true;
      els.newspaperArticlePanel.hidden = true;
    }
  });
  window.addEventListener("resize", resetNewspaperPositionForViewport);
}

function renderStaticCase() {
  els.caseSummary.textContent = data.caseData.summary;
  els.caseTitle.textContent = data.caseData.title;
  els.caseIntro.innerHTML = renderRichText(data.caseData.intro);
  els.caseDate.textContent = formatIssueDate(data.caseData.date);
  els.newspaperTitle.textContent = data.newspaper.title;
  els.newspaperDate.textContent = `London, ${formatIssueDate(data.newspaper.date)}.`;
  renderTheoryForm();
  bindInlineLinks(els.caseIntro);
}

function renderAll() {
  renderInvestigationState();
  if (selectedLocationId) renderLocationPreview(selectedLocationId);
  else hideLeadPanel();
}

function renderInvestigationState() {
  renderStats();
  renderCaseList();
  renderMarkers();
  renderSearch();
  renderNewspaper();
  renderNotebook();
  renderTheoryForm();
}

function renderStats() {
  els.leadCount.textContent = state.leadCount;
  els.visitCount.textContent = state.visitedLocationIds.length;
}

function renderCaseList() {
  const cases = data.caseIndex || [];
  els.caseCount.textContent = `${cases.length} ${cases.length === 1 ? "case" : "cases"}`;
  els.caseList.innerHTML = cases.map((caseMeta) => `
    <button class="result-item" type="button" data-case-id="${caseMeta.id}">
      <span class="result-kind">${escapeHtml(caseMeta.status || "available")}</span>
      <strong>${escapeHtml(caseMeta.title)}</strong>
      <span class="result-summary">${escapeHtml(caseMeta.summary || "")}</span>
      <span class="result-meta"><span>${escapeHtml(formatIssueDate(caseMeta.date || ""))}</span>${caseMeta.id === data.caseData.id ? "<span>Current</span>" : ""}</span>
    </button>
  `).join("");
  els.caseList.querySelectorAll("[data-case-id]").forEach((button) => {
    button.addEventListener("click", () => switchCase(button.dataset.caseId));
  });
}

function renderMarkers() {
  if (!map) return;
  const shownIds = new Set();
  const currentLocationIds = new Set(data.locations.map((location) => location.id));
  for (const location of data.locations) {
    const record = markers.get(location.id);
    if (!location.coordinates) {
      if (record) record.element.hidden = true;
      continue;
    }
    const known = isPublicLocation(location) || isLocationKnown(data.caseData, state, location.id);
    const hiddenButRevealed = getCaseHiddenLocationIds().includes(location.id) && state.revealedLocationIds.includes(location.id);
    const shouldShow = (known || hiddenButRevealed)
      && isPoiCategoryVisible(location)
      && (!isPublicLocation(location) || map.getZoom() >= PUBLIC_POI_MARKER_MIN_ZOOM)
      && !shownIds.has(location.id);
    if (!shouldShow) {
      if (record) record.element.hidden = true;
      continue;
    }
    shownIds.add(location.id);

    const markerRecord = ensureMarker(location);
    markerRecord.marker.setLngLat([location.coordinates.lng, location.coordinates.lat]);
    markerRecord.element.className = markerClass(location);
    markerRecord.element.title = location.name;
    markerRecord.element.hidden = false;
  }
  for (const [locationId, record] of markers) {
    if (!currentLocationIds.has(locationId)) {
      record.marker.remove();
      markers.delete(locationId);
    }
  }
  syncSearchMarkerHighlight();
  updatePoiProjectionDiagnostics();
}

function ensureMarker(location) {
  const existing = markers.get(location.id);
  if (existing) return existing;

  const element = document.createElement("button");
  element.className = markerClass(location);
  element.type = "button";
  element.title = location.name;
  element.addEventListener("click", () => openLocation(location.id, true));

  const marker = new maplibregl.Marker({ element, anchor: "center" })
    .setLngLat([location.coordinates.lng, location.coordinates.lat])
    .addTo(map);
  const record = { marker, element, locationId: location.id };
  markers.set(location.id, record);
  return record;
}

function markerClass(location) {
  const classes = ["maplibregl-marker", "maplibregl-marker-anchor-center", "poi-marker"];
  classes.push(`is-${categorizeLocation(location)}`);
  if (selectedLocationId === location.id) classes.push("is-selected");
  if (state.visitedLocationIds.includes(location.id)) classes.push("is-visited");
  if (data.caseData.startingLocationIds.includes(location.id)) classes.push("is-start");
  if (getCaseHiddenLocationIds().includes(location.id)) classes.push("is-hidden");
  return classes.join(" ");
}

function renderSearch() {
  const query = els.searchInput.value.trim().toLowerCase();
  if (!query) {
    activeSearchResultLocationIds = new Set();
    els.searchPanel.hidden = true;
    els.searchResults.innerHTML = `<p class="muted">Search the city to jump to a place.</p>`;
    syncSearchMarkerHighlight();
    return;
  }
  const results = buildPlaceResults(query).slice(0, 40);
  activeSearchResultLocationIds = new Set(results.map((result) => result.locationId).filter(Boolean));
  syncSearchMarkerHighlight();
  els.searchPanel.hidden = false;
  if (!results.length) {
    els.searchResults.innerHTML = `<p class="muted">No matching places.</p>`;
    return;
  }
  els.searchResults.innerHTML = results.map((result) => `
    <button class="result-item" type="button" data-location-id="${result.locationId || ""}">
      <span class="result-kind">${escapeHtml(result.kind)}</span>
      <strong>${escapeHtml(result.title)}</strong>
      <span class="result-summary">${escapeHtml(result.detail || "")}</span>
    </button>
  `).join("");
  els.searchResults.querySelectorAll(".result-item").forEach((item, index) => {
    item.addEventListener("click", () => {
      const result = results[index];
      if (result.locationId) openLocation(result.locationId, true);
    });
  });
}

function buildPlaceResults(query) {
  const knownLocationIds = new Set(data.locations
    .filter((location) => isLocationDiscoverable(location, query))
    .map((item) => item.id));
  const haystackIncludes = (parts) => !query || parts.filter(Boolean).join(" ").toLowerCase().includes(query);

  return data.locations
    .filter((location) => knownLocationIds.has(location.id))
    .filter((location) => isPoiCategoryVisible(location))
    .map((location) => {
      return {
        kind: formatLocationType(location.type),
        title: location.name,
        detail: [
          location.address || "",
          location.searchPreviewText || location.defaultVisitText || ""
        ].filter(Boolean).join(" · "),
        locationId: location.id,
        meta: []
      };
    })
    .filter((result) => haystackIncludes([result.kind, result.title, result.detail, result.meta?.join(" ")]))
    .sort((a, b) => a.title.localeCompare(b.title));
}

function syncSearchMarkerHighlight() {
  const hasSearch = Boolean(els.searchInput.value.trim());
  for (const { element, locationId } of markers.values()) {
    const isMatch = hasSearch && activeSearchResultLocationIds.has(locationId);
    const isSelected = locationId === selectedLocationId;
    element.classList.toggle("is-search-match", isMatch);
    element.classList.toggle("is-search-muted", hasSearch && !isMatch && !isSelected);
  }
}

function installDebugHooks() {
  window.__gaslightsDebug = {
    samplePoiProjectionErrors() {
      if (!map) return [];
      return [...markers.values()]
        .filter(({ element }) => !element.hidden && getComputedStyle(element).display !== "none")
        .map(({ element, locationId }) => {
          const location = findLocation(locationId);
          const rect = element.getBoundingClientRect();
          const center = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
          };
          const projected = map.project([location.coordinates.lng, location.coordinates.lat]);
          return {
            id: locationId,
            name: location.name,
            zoom: map.getZoom(),
            center,
            projected: { x: projected.x, y: projected.y },
            dx: center.x - projected.x,
            dy: center.y - projected.y,
            distance: Math.hypot(center.x - projected.x, center.y - projected.y)
          };
        });
    }
  };
}

function updatePoiProjectionDiagnostics() {
  if (!map) return;
  const mapElement = document.querySelector("#map");
  if (!mapElement) return;
  const mapRect = mapElement.getBoundingClientRect();
  const rows = [...markers.values()]
    .filter(({ element }) => !element.hidden && getComputedStyle(element).display !== "none")
    .map(({ element, locationId }) => {
      const location = findLocation(locationId);
      const rect = element.getBoundingClientRect();
      const center = {
        x: rect.left + rect.width / 2 - mapRect.left,
        y: rect.top + rect.height / 2 - mapRect.top
      };
      const projected = map.project([location.coordinates.lng, location.coordinates.lat]);
      return {
        id: locationId,
        name: location.name,
        zoom: Number(map.getZoom().toFixed(3)),
        dx: Number((center.x - projected.x).toFixed(2)),
        dy: Number((center.y - projected.y).toFixed(2)),
        distance: Number(Math.hypot(center.x - projected.x, center.y - projected.y).toFixed(2))
      };
    });
  const worst = rows.reduce((acc, row) => row.distance > acc.distance ? row : acc, { distance: -1 });
  const charing = rows.find((row) => row.id === "charing_cross_railway_office") || null;
  mapElement.dataset.poiProjectionDiagnostics = JSON.stringify({
    zoom: Number(map.getZoom().toFixed(3)),
    count: rows.length,
    worst,
    charing
  });
}

function renderNewspaper() {
  const items = buildNewspaperResults();
  els.newspaperIssueLine.textContent = `No. 11,081 (${items.length})`;
  if (!items.length) {
    els.newspaperResults.innerHTML = `<p class="muted">No newspaper items available.</p>`;
    return;
  }
  const stream = buildNewspaperStream(items);
  const columnCount = getNewspaperColumnCount();
  const columns = splitNewspaperStream(stream, columnCount);
  els.newspaperResults.innerHTML = `
    <div class="newspaper-columns columns-${columnCount}">
      ${columns.map((entries) => `
        <div class="newspaper-column">
          ${entries.map((entry) => {
            if (entry.kind === "heading") {
              return `<h3 class="newspaper-stream-heading">${escapeHtml(entry.title)}</h3>`;
            }
            return renderNewspaperEntryHtml(entry.item);
          }).join("")}
        </div>
      `).join("")}
    </div>
  `;
  els.newspaperResults.querySelectorAll("[data-article-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = items.find((candidate) => candidate.id === button.dataset.articleId);
      if (item) showNewspaperItem(item);
    });
  });
}

function getNewspaperColumnCount() {
  if (isMobileViewport()) return 1;
  const panelWidth = els.newspaperPanel?.clientWidth || window.innerWidth;
  return clamp(Math.floor((panelWidth - 80) / 190), 2, NEWSPAPER_MAX_COLUMNS);
}

function splitNewspaperStream(stream, columnCount) {
  if (columnCount <= 1 || stream.length <= 1) return [stream];
  const weighted = stream.map((entry) => ({
    entry,
    weight: estimateNewspaperEntryWeight(entry)
  }));
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  const targetWeight = totalWeight / columnCount;
  const columns = [];
  let current = [];
  let currentWeight = 0;

  for (let index = 0; index < weighted.length; index += 1) {
    const item = weighted[index];
    const remainingColumns = columnCount - columns.length;
    const remainingItems = weighted.length - index;
    if (
      current.length &&
      columns.length < columnCount - 1 &&
      currentWeight >= targetWeight &&
      remainingItems >= remainingColumns
    ) {
      columns.push(current);
      current = [];
      currentWeight = 0;
    }
    current.push(item.entry);
    currentWeight += item.weight;
  }
  if (current.length) columns.push(current);
  while (columns.length < columnCount) columns.push([]);
  return columns;
}

function estimateNewspaperEntryWeight(entry) {
  if (entry.kind === "heading") return 30;
  const body = entry.item?.body || "";
  const headline = entry.item?.headline || "";
  return headline.length + body.length;
}

function buildNewspaperResults() {
  return [...data.newspaper.items];
}

function showNewspaperItem(item) {
  const linkedLocationId = item.linkedLocationIds?.find((id) => findLocation(id));
  els.newspaperArticleType.textContent = formatItemType(item.type);
  els.newspaperArticleHeadline.textContent = item.headline;
  els.newspaperArticlePanel.dataset.articleType = item.type || "item";
  els.newspaperArticlePanel.classList.toggle("is-inline-head", isInlineHeadlineArticle(item));
  els.newspaperArticlePanel.classList.toggle("is-dropcap", usesDropCapArticle(item));
  els.newspaperArticlePanel.classList.toggle("is-headline-hidden", isHeadlineHiddenArticle(item));
  els.newspaperArticlePanel.classList.toggle("is-underlined-head", isHeadlineUnderlinedArticle(item));
  els.newspaperArticleBody.innerHTML = buildArticleParagraphs(item.body, {
    indentFirstParagraph: shouldIndentFirstParagraph(item)
  });
  els.newspaperArticlePanel.hidden = false;
  els.newspaperArticlePanel.scrollTop = 0;
  positionNewspaperArticlePanel();
  els.newspaperArticleMap.hidden = !linkedLocationId;
  els.newspaperArticleMap.onclick = () => {
    if (!linkedLocationId) return;
    els.newspaperArticlePanel.hidden = true;
    els.newspaperPanel.hidden = true;
    openLocation(linkedLocationId, true);
  };
}

function positionNewspaperArticlePanel() {
  if (isMobileViewport()) {
    els.newspaperArticlePanel.style.top = "";
    els.newspaperArticlePanel.style.maxHeight = "";
    return;
  }
  const visibleInset = 18;
  const maxVisibleHeight = Math.max(240, els.newspaperPanel.clientHeight - (visibleInset * 2));
  els.newspaperArticlePanel.style.top = `${els.newspaperPanel.scrollTop + visibleInset}px`;
  els.newspaperArticlePanel.style.maxHeight = `${maxVisibleHeight}px`;
}

function openLocation(locationId, fly) {
  showLeadPanel();
  selectedLocationId = locationId;
  renderMarkers();
  const location = findLocation(locationId);
  if (fly && location?.coordinates) {
    map.flyTo({ center: [location.coordinates.lng, location.coordinates.lat], zoom: Math.max(map.getZoom(), 14) });
  }
  renderLocationPreview(locationId);
}

function renderLocationPreview(locationId) {
  showLeadPanel();
  const location = findLocation(locationId);
  const alreadyVisited = state.visitedLocationIds.includes(locationId);
  els.leadKicker.textContent = alreadyVisited ? "Visited location" : location.type.replaceAll("_", " ");
  els.leadTitle.textContent = location.name;
  els.leadText.textContent = location.searchPreviewText || location.defaultVisitText || location.address || "A place in the London directory.";
  els.leadDiscoveries.innerHTML = location.address ? `<span>${escapeHtml(location.address)}</span>` : "";
  els.showOnMap.hidden = true;
  els.visitLocation.hidden = false;
  els.visitLocation.textContent = alreadyVisited ? "Revisit location" : "Visit location";
}

function renderLeadPrompt() {
  hideLeadPanel();
}

function visitSelectedLocation() {
  if (!selectedLocationId) return;
  const resolution = resolveVisit(data.caseData, data.locations, [...data.caseData.genericLeadRules, ...data.genericRules], state, selectedLocationId);
  state = applyResolution(data.caseData, state, selectedLocationId, resolution);
  saveState();
  renderInvestigationState();
  renderResolution(resolution);
}

function renderResolution(resolution) {
  showLeadPanel();
  els.leadKicker.textContent = resolution.kind.replaceAll("_", " ");
  els.leadTitle.textContent = resolution.title;
  els.leadText.textContent = resolution.text;
  els.showOnMap.hidden = true;
  els.visitLocation.textContent = "Visit again";
  const discoveries = [];
  for (const id of resolution.effects.revealLocationIds || []) discoveries.push(`Place revealed: ${findLocation(id)?.name || id}`);
  els.leadDiscoveries.innerHTML = discoveries.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
}

function showReference(result) {
  showLeadPanel();
  els.leadKicker.textContent = result.kind;
  els.leadTitle.textContent = result.title;
  els.leadText.textContent = result.body || result.detail;
  els.leadDiscoveries.innerHTML = "";
  els.showOnMap.hidden = !result.locationId;
  els.visitLocation.hidden = true;
}

function showLeadPanel() {
  els.leadPanel.hidden = false;
}

function hideLeadPanel() {
  els.leadPanel.hidden = true;
}

function renderNotebook() {
  renderCompactList(els.factList, state.visitedLocationIds.map((id) => {
    const item = findLocation(id);
    return item ? `<strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.address || item.type || "")}</span>` : escapeHtml(id);
  }), "No places visited yet.");
  renderCompactList(els.noteList, state.notebookEntries.map((item) => `<span>${escapeHtml(item.text)}</span>`), "No notes yet.");
}

function renderCompactList(container, items, emptyText) {
  container.innerHTML = items.length ? items.map((item) => `<div class="compact-item">${item}</div>`).join("") : `<p class="muted">${emptyText}</p>`;
}

function renderTheoryForm() {
  const theoryChoices = buildTheoryChoices();
  const slots = getTheorySlots(data.caseData);
  els.theoryForm.innerHTML = `
    <p class="theory-help">Type a theory and choose from the suggested list. Only listed answers count.</p>
    ${slots.map((slot) => {
      const choices = theoryChoices[slot] || [];
      const currentChoice = choices.find((choice) => choice.value === state.theory[slot]);
      return `
        <label class="field" data-theory-slot="${slot}">
          <span>${slot[0].toUpperCase()}${slot.slice(1)}</span>
          <input
            type="text"
            name="${slot}"
            list="theory-list-${slot}"
            value="${escapeHtml(currentChoice?.label || getTheoryDisplayValue(slot) || "")}"
            placeholder="Choose from list"
            autocomplete="off"
          />
          <datalist id="theory-list-${slot}">
            ${choices.map((choice) => `<option value="${escapeHtml(choice.label)}"></option>`).join("")}
          </datalist>
        </label>
      `;
    }).join("")}
  `;
  handleTheoryInputChange();
}

function handleTheoryInputChange() {
  const theoryChoices = buildTheoryChoices();
  for (const [slot, choices] of Object.entries(theoryChoices)) {
    const input = els.theoryForm.querySelector(`[name="${slot}"]`);
    const normalized = String(input?.value || "").trim().toLowerCase();
    const match = choices.find((choice) => choice.label.toLowerCase() === normalized);
    state.theory[slot] = match?.value || null;
    input?.closest(".field")?.classList.toggle("is-invalid", Boolean(normalized) && !match);
  }
  saveState();
}

function submitTheory() {
  handleTheoryInputChange();
  els.solutionResult.hidden = false;
  const questions = data.caseData.solutionQuestions || [];
  els.solutionResult.innerHTML = `
    <h3>Case questions</h3>
    ${questions.length ? `
      <p>Answer these in your own words before revealing the solution.</p>
      <div class="question-list">
        ${questions.map((question) => `
          <label class="field">
            <span>${escapeHtml(question.prompt)}</span>
            <textarea name="solutionQuestion_${escapeHtml(question.id)}" rows="4"></textarea>
          </label>
        `).join("")}
      </div>
    ` : "<p>No additional case questions are configured.</p>"}
    <button id="revealSolution" class="primary-button" type="button">Reveal solution</button>
  `;
  document.querySelector("#revealSolution")?.addEventListener("click", renderSolutionReveal);
}

function renderSolutionReveal() {
  const result = compareTheory(data.caseData, state);
  const questions = data.caseData.solutionQuestions || [];
  els.solutionResult.innerHTML = `
    <h3>Solution comparison</h3>
    <div class="score-grid">
      ${Object.entries(result.result).map(([slot, status]) => `<span>${slot}</span><strong class="${status}">${status}</strong>`).join("")}
    </div>
    ${questions.length ? `
      <h3>Case question notes</h3>
      <div class="compact-list">
        ${questions.map((question) => `
          <div class="compact-item">
            <strong>${escapeHtml(question.prompt)}</strong>
            <span>${escapeHtml(question.modelAnswer || "")}</span>
          </div>
        `).join("")}
      </div>
    ` : ""}
    <p>${escapeHtml(data.caseData.solution.explanation)}</p>
    <p><strong>Lead count:</strong> ${result.leadCount}${result.holmesLeadCount ? ` · benchmark ${result.holmesLeadCount}` : ""}</p>
  `;
}

function switchView(view) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === view));
  document.querySelectorAll(".view").forEach((panel) => panel.classList.toggle("is-active", panel.id === `${view}View`));
}

function openEditorOverlay() {
  closeSidebarDrawer();
  els.layerPanel.hidden = true;
  els.searchPanel.hidden = true;
  els.newspaperPanel.hidden = true;
  els.newspaperArticlePanel.hidden = true;
  if (els.editorFrame && !els.editorFrame.getAttribute("src")) {
    const editorSrc = els.editorFrame.dataset.src;
    if (editorSrc) els.editorFrame.setAttribute("src", editorSrc);
  }
  els.editorOverlay.hidden = false;
  document.body.classList.add("is-editor-open");
  els.editorFrame?.focus();
}

function closeEditorOverlay() {
  els.editorOverlay.hidden = true;
  document.body.classList.remove("is-editor-open");
}

function openSidebarDrawer() {
  document.body.classList.add("is-sidebar-drawer-open");
}

function closeSidebarDrawer() {
  document.body.classList.remove("is-sidebar-drawer-open");
}

function isMobileViewport() {
  return window.innerWidth <= 860;
}

function resetNewspaperPositionForViewport() {
  if (!els.newspaperPanel) return;
  if (isMobileViewport()) {
    els.newspaperPanel.style.left = "";
    els.newspaperPanel.style.top = "";
    els.newspaperPanel.style.right = "";
    els.newspaperPanel.style.bottom = "";
    els.newspaperPanel.style.width = "";
    els.newspaperPanel.style.height = "";
    renderNewspaper();
    return;
  }
  applyNewspaperDesktopWidth();
  if (!els.newspaperPanel.hidden && !newspaperDrag && !els.newspaperPanel.style.left) {
    els.newspaperPanel.style.right = "16px";
    els.newspaperPanel.style.top = `${NEWSPAPER_DESKTOP_TOP_CLEARANCE}px`;
  }
  clampNewspaperPanelToViewport();
  renderNewspaper();
}

function startNewspaperDrag(event) {
  if (isMobileViewport()) return;
  if (event.target.closest("button, a, input")) return;
  const rect = els.newspaperPanel.getBoundingClientRect();
  newspaperDrag = {
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top
  };
  els.newspaperPanel.style.left = `${rect.left}px`;
  els.newspaperPanel.style.top = `${rect.top}px`;
  els.newspaperPanel.style.right = "auto";
  els.newspaperPanel.style.bottom = "auto";
  document.addEventListener("pointermove", onNewspaperDrag);
  document.addEventListener("pointerup", stopNewspaperDrag);
}

function onNewspaperDrag(event) {
  if (!newspaperDrag) return;
  const rect = els.newspaperPanel.getBoundingClientRect();
  const left = clamp(event.clientX - newspaperDrag.offsetX, 0, Math.max(0, window.innerWidth - rect.width));
  const top = clamp(event.clientY - newspaperDrag.offsetY, NEWSPAPER_DESKTOP_TOP_CLEARANCE, Math.max(NEWSPAPER_DESKTOP_TOP_CLEARANCE, window.innerHeight - rect.height));
  els.newspaperPanel.style.left = `${left}px`;
  els.newspaperPanel.style.top = `${top}px`;
}

function stopNewspaperDrag() {
  newspaperDrag = null;
  document.removeEventListener("pointermove", onNewspaperDrag);
  document.removeEventListener("pointerup", stopNewspaperDrag);
}

function startNewspaperResize(event) {
  if (isMobileViewport()) return;
  if (event.currentTarget.dataset.resizeDirection !== "south") return;
  event.preventDefault();
  event.stopPropagation();
  const rect = els.newspaperPanel.getBoundingClientRect();
  newspaperResize = {
    startX: event.clientX,
    startY: event.clientY,
    startHeight: rect.height
  };
  applyNewspaperDesktopWidth();
  els.newspaperPanel.style.height = `${rect.height}px`;
  els.newspaperPanel.style.left = `${rect.left}px`;
  els.newspaperPanel.style.top = `${rect.top}px`;
  els.newspaperPanel.style.right = "auto";
  els.newspaperPanel.style.bottom = "auto";
  document.addEventListener("pointermove", onNewspaperResize);
  document.addEventListener("pointerup", stopNewspaperResize);
}

function onNewspaperResize(event) {
  if (!newspaperResize) return;
  const panelRect = els.newspaperPanel.getBoundingClientRect();
  const maxHeight = Math.max(NEWSPAPER_MIN_HEIGHT, window.innerHeight - panelRect.top - 12);
  const nextHeight = clamp(
    newspaperResize.startHeight + (event.clientY - newspaperResize.startY),
    NEWSPAPER_MIN_HEIGHT,
    maxHeight
  );
  applyNewspaperDesktopWidth();
  els.newspaperPanel.style.height = `${nextHeight}px`;
  renderNewspaper();
}

function stopNewspaperResize() {
  newspaperResize = null;
  clampNewspaperPanelToViewport();
  renderNewspaper();
  document.removeEventListener("pointermove", onNewspaperResize);
  document.removeEventListener("pointerup", stopNewspaperResize);
}

function clampNewspaperPanelToViewport() {
  if (isMobileViewport()) return;
  applyNewspaperDesktopWidth();
  const rect = els.newspaperPanel.getBoundingClientRect();
  const left = clamp(rect.left, 0, Math.max(0, window.innerWidth - rect.width));
  const top = clamp(rect.top, NEWSPAPER_DESKTOP_TOP_CLEARANCE, Math.max(NEWSPAPER_DESKTOP_TOP_CLEARANCE, window.innerHeight - rect.height));
  els.newspaperPanel.style.left = `${left}px`;
  els.newspaperPanel.style.top = `${top}px`;
  els.newspaperPanel.style.right = "auto";
  els.newspaperPanel.style.bottom = "auto";
}

function applyNewspaperDesktopWidth() {
  if (isMobileViewport() || !els.newspaperPanel) return;
  const width = Math.min(NEWSPAPER_FIXED_WIDTH, window.innerWidth - 48);
  els.newspaperPanel.style.width = `${Math.max(NEWSPAPER_MIN_WIDTH, width)}px`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function loadState(caseData) {
  try {
    const stored = JSON.parse(localStorage.getItem(getCaseStoreKey(caseData.id)));
    if (stored?.caseId === caseData.id) return stored;
  } catch {
    localStorage.removeItem(getCaseStoreKey(caseData.id));
  }
  return createInitialState(caseData);
}

function loadMapLayerState(mapSources) {
  const defaults = Object.fromEntries(mapSources.map((source) => [
    source.id,
    {
      visible: source.id === HISTORICAL_SOURCE_ID ? true : Boolean(source.defaultVisible),
      opacity: Number.isFinite(source.opacity) ? source.opacity : 1
    }
  ]));
  try {
    const stored = JSON.parse(localStorage.getItem(mapLayerStoreKey));
    if (!stored || typeof stored !== "object") return defaults;
    const merged = { ...defaults, ...stored };
    merged[HISTORICAL_SOURCE_ID] = {
      ...merged[HISTORICAL_SOURCE_ID],
      visible: true
    };
    return merged;
  } catch {
    localStorage.removeItem(mapLayerStoreKey);
    return defaults;
  }
}

function saveMapLayerState() {
  localStorage.setItem(mapLayerStoreKey, JSON.stringify(mapLayerState));
}

function isMapSourceVisible(sourceId) {
  return Boolean(mapLayerState[sourceId]?.visible);
}

function getMapSourceOpacity(sourceId) {
  return mapLayerState[sourceId]?.opacity ?? 1;
}

function setMapSourceVisibility(sourceId, visible) {
  const source = data.mapSources.find((item) => item.id === sourceId);
  mapLayerState[sourceId] = {
    ...mapLayerState[sourceId],
    visible
  };
  if (map.getLayer(sourceId)) map.setLayoutProperty(sourceId, "visibility", visible ? "visible" : "none");
  if (visible && source?.bounds) {
    map.fitBounds(source.bounds, { padding: 80, maxZoom: Math.max(map.getZoom(), source.minzoom || 14) });
  }
  saveMapLayerState();
  syncHistoricalControls();
}

function setMapSourceOpacity(sourceId, opacity) {
  mapLayerState[sourceId] = {
    ...mapLayerState[sourceId],
    opacity
  };
  if (map.getLayer(sourceId)) map.setPaintProperty(sourceId, "raster-opacity", opacity);
  saveMapLayerState();
  syncHistoricalControls();
}

function getHistoricalSource() {
  return data.mapSources.find((source) => source.id === HISTORICAL_SOURCE_ID) || null;
}

function setHistoricalOpacity(opacity) {
  const source = getHistoricalSource();
  if (!source) return;
  setMapSourceOpacity(source.id, opacity);
}

function syncHistoricalControls() {
  const source = getHistoricalSource();
  if (!source) return;
  els.historicalOpacity.value = String(getMapSourceOpacity(source.id));
}

function syncZoomIndicator() {
  if (!map || !els.zoomLevel) return;
  els.zoomLevel.textContent = map.getZoom().toFixed(1);
}

function combineBounds(boundsList) {
  if (!boundsList.length) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const bounds of boundsList) {
    west = Math.min(west, bounds[0]);
    south = Math.min(south, bounds[1]);
    east = Math.max(east, bounds[2]);
    north = Math.max(north, bounds[3]);
  }
  return [
    [west, south],
    [east, north]
  ];
}

function saveState() {
  localStorage.setItem(getCaseStoreKey(data.caseData.id), JSON.stringify(state));
}

function getCaseStoreKey(caseId) {
  return `${storeKey}:${caseId}`;
}

function chooseCaseMeta(caseIndex) {
  const storedId = localStorage.getItem(selectedCaseKey);
  return caseIndex.find((item) => item.id === storedId) || caseIndex[0];
}

function switchCase(caseId) {
  if (!caseId || caseId === data.caseData.id) return;
  localStorage.setItem(selectedCaseKey, caseId);
  window.location.reload();
}

function findLocation(id) {
  return data.locations.find((item) => item.id === id);
}

function buildTheoryChoices() {
  const locationChoices = data.locations
    .filter((location) => getCaseLocationIds().includes(location.id))
    .map((location) => ({ value: location.id, label: location.name }))
    .filter((choice, index, list) => list.findIndex((item) => item.value === choice.value) === index)
    .sort((a, b) => a.label.localeCompare(b.label));
  const peopleChoices = getCasePeople()
    .map((person) => ({ value: person.id, label: person.name }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    who: peopleChoices,
    why: (data.caseData.theoryOptions.why || []).map((value) => ({ value, label: formatOption(value) })),
    how: (data.caseData.theoryOptions.how || []).map((value) => ({ value, label: formatOption(value) })),
    where: locationChoices
  };
}

function getTheoryDisplayValue(slot) {
  const choices = buildTheoryChoices()[slot] || [];
  return choices.find((choice) => choice.value === state.theory[slot])?.label || "";
}

function isPublicLocation(location) {
  return location?.visibility === "public";
}

function formatLocationType(type) {
  return String(type || "").replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildPoiCategories(locations) {
  const counts = {};
  for (const location of locations) {
    const key = categorizeLocation(location);
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts).map(([id, count]) => ({
    id,
    label: formatCategoryLabel(id),
    count
  })).sort((a, b) => a.label.localeCompare(b.label));
}

function loadPoiLayerState(locations) {
  const categories = buildPoiCategories(locations);
  const defaults = Object.fromEntries(categories.map((category) => [category.id, true]));
  try {
    const stored = JSON.parse(localStorage.getItem(poiLayerStoreKey));
    return stored && typeof stored === "object" ? { ...defaults, ...stored } : defaults;
  } catch {
    localStorage.removeItem(poiLayerStoreKey);
    return defaults;
  }
}

function savePoiLayerState() {
  localStorage.setItem(poiLayerStoreKey, JSON.stringify(poiLayerState));
}

function renderPoiLayerFilters() {
  const categories = buildPoiCategories(data.locations);
  const activeCount = categories.filter((category) => poiLayerState[category.id] !== false).length;
  els.poiLayerSummary.textContent = `${activeCount} of ${categories.length} categories visible`;
  els.poiLayerFilters.innerHTML = categories.map((category) => `
    <label class="layer-filter-item">
      <input type="checkbox" data-poi-layer="${category.id}" ${poiLayerState[category.id] ? "checked" : ""} />
      <span class="layer-filter-swatch is-${category.id}">${escapeHtml(getCategorySymbol(category.id))}</span>
      <span class="layer-filter-label">${escapeHtml(category.label)} (${category.count})</span>
    </label>
  `).join("");
  els.poiLayerFilters.querySelectorAll("[data-poi-layer]").forEach((input) => {
    input.addEventListener("change", () => {
      poiLayerState[input.dataset.poiLayer] = input.checked;
      savePoiLayerState();
      renderMarkers();
      renderSearch();
    });
  });
}

function setAllPoiLayers(nextValue) {
  for (const key of Object.keys(poiLayerState)) {
    poiLayerState[key] = nextValue;
  }
  savePoiLayerState();
  renderPoiLayerFilters();
  renderMarkers();
  renderSearch();
}

function isPoiCategoryVisible(location) {
  return poiLayerState[categorizeLocation(location)] !== false;
}

function categorizeLocation(location) {
  const type = location.type;
  if (["railway_office", "cab_registry", "port_authority", "telegraph_office"].includes(type) || location.tags?.includes("transport")) return "transport";
  if (["police_station", "solicitor", "registry_office", "bank", "insurance_office"].includes(type)) return "civic_records";
  if (["hospital", "chemist_analyst", "laboratory", "scientific_institution"].includes(type)) return "science_medicine";
  if (["commercial_office", "warehouse", "pawnbroker", "bookmaker"].includes(type)) return "commerce";
  if (["private_residence", "lodging_house"].includes(type)) return "residences";
  if (["pub", "newspaper_office", "library"].includes(type)) return "public_life";
  return "other";
}

function formatCategoryLabel(id) {
  return id.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function getCategorySymbol(id) {
  return ({
    transport: "T",
    civic_records: "C",
    science_medicine: "M",
    commerce: "£",
    residences: "H",
    public_life: "P",
    other: "•"
  })[id] || "•";
}

function isLocationDiscoverable(location, query = "") {
  if (isLocationKnown(data.caseData, state, location.id)) return true;
  if (!query) return false;
  return isPublicLocation(location);
}

function applyLocationOverrides(locations, overrides) {
  const hiddenIds = new Set([...(overrides?.hiddenLocationIds || []), ...(overrides?.retiredLocationIds || [])]);
  const patches = overrides?.patches || {};

  return locations
    .filter((location) => !hiddenIds.has(location.id))
    .map((location) => {
      const patch = patches[location.id];
      return patch ? {
        ...location,
        ...patch,
        coordinates: patch.coordinates ? { ...location.coordinates, ...patch.coordinates } : location.coordinates
      } : location;
    });
}

function renderRichText(text) {
  return String(text || "")
    .trim()
    .split(/\n\s*\n/)
    .map((line) => `<p>${renderMarkupInline(line)}</p>`)
    .join("");
}

function renderMarkupInline(text) {
  return escapeHtml(text || "")
    .replace(/\[([^\]]+)\]\((place|person):([^)]+)\)/g, (_match, label, kind, id) => {
      return `<button class="inline-link" type="button" data-link-kind="${kind}" data-link-id="${escapeHtml(id)}">${escapeHtml(label)}</button>`;
    });
}

function bindInlineLinks(container) {
  container.querySelectorAll("[data-link-kind]").forEach((button) => {
    button.addEventListener("click", () => {
      const kind = button.dataset.linkKind;
      const id = button.dataset.linkId;
      if (kind === "place") openLocation(id, true);
    });
  });
}

function formatOption(value) {
  return value.replaceAll("_", " ").replace("T", " ");
}

function normalizeCaseData(caseData) {
  return {
    ...caseData,
    caseLocationIds: caseData.caseLocationIds || caseData.activeLocationIds || [],
    hiddenLocationIds: caseData.hiddenLocationIds || [],
    casePeopleIds: caseData.casePeopleIds || (caseData.people || []).map((person) => person.id),
    people: caseData.people || []
  };
}

function getCaseLocationIds() {
  return data.caseData.caseLocationIds || data.caseData.activeLocationIds || [];
}

function getCaseHiddenLocationIds() {
  if (Array.isArray(data.caseData.hiddenLocationIds)) return data.caseData.hiddenLocationIds;
  if (data.caseData.caseLocationRoles) {
    return Object.entries(data.caseData.caseLocationRoles)
      .filter(([, roles]) => (roles || []).includes("hidden"))
      .map(([locationId]) => locationId);
  }
  return [];
}

function getCasePeople() {
  const casePeopleIds = data.caseData.casePeopleIds || [];
  const fromGlobal = (data.people || []).filter((person) => casePeopleIds.includes(person.id));
  if (fromGlobal.length) return fromGlobal;
  return data.caseData.people || [];
}

function formatItemType(value) {
  const labels = {
    advert: "Advertisement",
    notice: "Notice",
    notices: "Births, Deaths, and Marriages",
    shipping_notice: "Shipping Notice",
    transport_notice: "Railway Notice",
    court_report: "Court Report",
    society: "Society",
    entertainment: "Amusement",
    letter: "Letter",
    news: "News"
  };
  return labels[value] || String(value || "item").replaceAll("_", " ");
}

function buildNewspaperDeck(item) {
  const body = String(item.body || "");
  return body.length > 130 ? `${body.slice(0, 127).trim()}...` : body;
}

function buildArticleParagraphs(body, options = {}) {
  const text = String(body || "").trim();
  if (!text) return "";
  const chunks = text
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const paragraphs = chunks.length ? chunks : [text.replace(/\s+/g, " ").trim()];
  return paragraphs.map((paragraph, index) => {
    const classes = [];
    if (index === 0 && options.indentFirstParagraph === false) classes.push("is-no-indent");
    return `<p${classes.length ? ` class="${classes.join(" ")}"` : ""}>${escapeHtml(paragraph)}</p>`;
  }).join("");
}

function isInlineHeadlineArticle(item) {
  if (item?.format?.headlineMode) return item.format.headlineMode === "inline";
  return ["advert", "notice", "shipping_notice", "transport_notice", "entertainment"].includes(item?.type);
}

function usesDropCapArticle(item) {
  if (typeof item?.format?.dropCap === "boolean") return item.format.dropCap;
  return item?.type === "notices";
}

function isHeadlineHiddenArticle(item) {
  return item?.format?.headlineMode === "hidden";
}

function isHeadlineUnderlinedArticle(item) {
  return Boolean(item?.format?.underlineHeadline);
}

function shouldIndentFirstParagraph(item) {
  if (typeof item?.format?.indentFirstParagraph === "boolean") return item.format.indentFirstParagraph;
  return item?.type !== "notices";
}

function buildNewspaperStream(items) {
  const groups = [
    {
      title: null,
      types: ["news", "court_report", "society", "letter"]
    },
    {
      title: "Shipping and Railway Intelligence",
      types: ["shipping_notice", "transport_notice"]
    },
    {
      title: "Advertising and Notices",
      types: ["advert", "notice"]
    },
    {
      title: "Amusements",
      types: ["entertainment"]
    },
    {
      title: "Births, Marriages, and Deaths",
      types: ["notices"]
    }
  ];

  const stream = [];
  for (const group of groups) {
    const matching = items.filter((item) => group.types.includes(item.type));
    if (!matching.length) continue;
    if (group.title) {
      stream.push({ kind: "heading", title: group.title });
    }
    for (const item of matching) {
      stream.push({ kind: "article", item });
    }
  }
  return stream;
}

function renderNewspaperEntryHtml(item) {
  const paragraphHtml = buildArticleParagraphs(item.body, {
    indentFirstParagraph: shouldIndentFirstParagraph(item)
  });
  if (item.type === "notices") {
    return `
      <button class="newspaper-entry newspaper-entry--${escapeHtml(item.type)} is-dropcap-entry ${isHeadlineUnderlinedArticle(item) ? "is-underlined-head-entry" : ""}" type="button" data-article-id="${item.id}">
        ${paragraphHtml}
      </button>
    `;
  }
  const isClassified = ["advert", "notice", "notices", "shipping_notice", "transport_notice", "entertainment"].includes(item.type);
  if (isClassified) {
    return `
      <button class="newspaper-entry newspaper-entry--${escapeHtml(item.type)} is-classified ${isInlineHeadlineArticle(item) ? "is-inline-head-entry" : ""} ${isHeadlineUnderlinedArticle(item) ? "is-underlined-head-entry" : ""}" type="button" data-article-id="${item.id}">
        ${isHeadlineHiddenArticle(item) ? "" : (isInlineHeadlineArticle(item)
          ? `<span class="newspaper-inline-head">${escapeHtml(item.headline)} — </span>`
          : `<h3>${escapeHtml(item.headline)}</h3>`)}
        <div class="newspaper-entry-lines">
          ${buildNewspaperLines(item.body).map((line, index) => {
            const classes = [];
            if (index === 0 && isInlineHeadlineArticle(item)) classes.push("is-inline-first");
            if (index === 0 && shouldIndentFirstParagraph(item) === false) classes.push("is-no-indent");
            return `<p${classes.length ? ` class="${classes.join(" ")}"` : ""}>${escapeHtml(line)}</p>`;
          }).join("")}
        </div>
      </button>
    `;
  }
  return `
    <button class="newspaper-entry newspaper-entry--${escapeHtml(item.type)} ${isHeadlineUnderlinedArticle(item) ? "is-underlined-head-entry" : ""}" type="button" data-article-id="${item.id}">
      ${isHeadlineHiddenArticle(item) ? "" : `<h3>${escapeHtml(item.headline)}</h3>`}
      ${paragraphHtml}
    </button>
  `;
}

function buildNewspaperLines(body) {
  const text = String(body || "").replace(/\s+/g, " ").trim();
  const clauses = text
    .split(/(?<=[.;:])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (clauses.length > 1) return clauses;
  const words = text.split(" ");
  const lines = [];
  for (let index = 0; index < words.length; index += 6) {
    lines.push(words.slice(index, index + 6).join(" "));
  }
  return lines;
}

function formatIssueDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[char]);
}
