import {
  applyResolution,
  compareTheory,
  createInitialState,
  isLocationKnown,
  resolveVisit
} from "./case-engine.js";

const ASSET_VERSION = "202606261840";

const DATA_PATHS = {
  locations: "./data/london1895/locations.seed.json",
  directory: "./data/london1895/directory.seed.json",
  genericRules: "./data/london1895/generic-lead-rules.seed.json",
  newspaper: "./data/newspapers/1894-05-17-london-evening-chronicle.json",
  caseData: "./data/cases/missing-chemist.case.json",
  mapSources: `./data/map-sources.json?v=${ASSET_VERSION}`
};

const MAP_CONFIG = {
  center: [-0.1246, 51.5079],
  zoom: 12.6
};
const MAP_MIN_ZOOM = 12.6;
const HISTORICAL_SOURCE_ID = "london-1895-six-inch-local";
const HISTORICAL_LAYER_MIN_ZOOM = 0;
const HISTORICAL_LAYER_MAX_ZOOM = 20;
const MODERN_BASE_OPACITY = 0.28;

const storeKey = "gaslights:missing_chemist:v1";
const mapLayerStoreKey = "gaslights:map-layers:v1";
const data = await loadData();
let state = loadState(data.caseData);
let mapLayerState = loadMapLayerState(data.mapSources);
let selectedLocationId = null;
let map;
let markers = [];

const els = {
  caseSummary: document.querySelector("#caseSummary"),
  caseTitle: document.querySelector("#caseTitle"),
  caseIntro: document.querySelector("#caseIntro"),
  leadCount: document.querySelector("#leadCount"),
  evidenceCount: document.querySelector("#evidenceCount"),
  factCount: document.querySelector("#factCount"),
  searchInput: document.querySelector("#searchInput"),
  searchResults: document.querySelector("#searchResults"),
  evidenceList: document.querySelector("#evidenceList"),
  factList: document.querySelector("#factList"),
  noteList: document.querySelector("#noteList"),
  theoryForm: document.querySelector("#theoryForm"),
  solutionResult: document.querySelector("#solutionResult"),
  leadPanel: document.querySelector("#leadPanel"),
  leadKicker: document.querySelector("#leadKicker"),
  leadTitle: document.querySelector("#leadTitle"),
  leadText: document.querySelector("#leadText"),
  leadDiscoveries: document.querySelector("#leadDiscoveries"),
  visitLocation: document.querySelector("#visitLocation"),
  closeLead: document.querySelector("#closeLead"),
  showKnown: document.querySelector("#showKnown"),
  showHidden: document.querySelector("#showHidden"),
  showDirectory: document.querySelector("#showDirectory"),
  historicalOpacity: document.querySelector("#historicalOpacity"),
  zoomLevel: document.querySelector("#zoomLevel")
};

boot();

async function loadData() {
  const entries = await Promise.all(Object.entries(DATA_PATHS).map(async ([key, path]) => {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed to load ${path}`);
    return [key, await response.json()];
  }));
  return Object.fromEntries(entries);
}

function boot() {
  renderStaticCase();
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

  for (const source of data.mapSources.filter((item) => item.kind === "raster_xyz")) {
    const sourceMinZoom = getRenderableSourceMinZoom(source);
    const sourceMaxZoom = getRenderableSourceMaxZoom(source);
    style.sources[source.id] = {
      type: "raster",
      tiles: source.tiles,
      tileSize: source.tileSize || 256,
      attribution: source.attribution,
      minzoom: sourceMinZoom,
      maxzoom: sourceMaxZoom
    };
    style.layers.push({
      id: source.id,
      type: "raster",
      source: source.id,
      minzoom: sourceMinZoom,
      maxzoom: sourceMaxZoom,
      paint: { "raster-opacity": getInitialMapSourceOpacity(source) },
      layout: { visibility: isMapSourceVisible(source.id) ? "visible" : "none" }
    });
  }

  map = new maplibregl.Map({
    container: "map",
    center: MAP_CONFIG.center,
    zoom: MAP_CONFIG.zoom,
    minZoom: MAP_MIN_ZOOM,
    maxZoom: HISTORICAL_LAYER_MAX_ZOOM,
    style
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  map.on("load", () => {
    syncHistoricalControls();
    syncZoomIndicator();
    renderMarkers();
  });
  map.on("zoom", syncZoomIndicator);
  map.on("move", syncZoomIndicator);
}

function getRenderableSourceMinZoom(source) {
  return isHistoricalLocalSource(source)
    ? HISTORICAL_LAYER_MIN_ZOOM
    : (source.minzoom ?? 0);
}

function getRenderableSourceMaxZoom(source) {
  return isHistoricalLocalSource(source)
    ? HISTORICAL_LAYER_MAX_ZOOM
    : (source.maxzoom ?? HISTORICAL_LAYER_MAX_ZOOM);
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
  els.searchInput.addEventListener("input", renderSearch);
  els.showKnown.addEventListener("change", renderMarkers);
  els.showHidden.addEventListener("change", renderMarkers);
  els.showDirectory.addEventListener("change", renderMarkers);
  els.visitLocation.addEventListener("click", () => visitSelectedLocation());
  els.closeLead.addEventListener("click", () => {
    selectedLocationId = null;
    hideLeadPanel();
  });
  document.querySelector("#resetInvestigation").addEventListener("click", () => {
    state = createInitialState(data.caseData);
    saveState();
    selectedLocationId = null;
    renderAll();
  });
  document.querySelector("#submitTheory").addEventListener("click", submitTheory);
  els.theoryForm.addEventListener("change", () => {
    const form = new FormData(els.theoryForm);
    for (const slot of ["who", "why", "how", "where", "when"]) state.theory[slot] = form.get(slot) || null;
    saveState();
  });
  els.historicalOpacity.addEventListener("input", () => {
    setHistoricalOpacity(Number(els.historicalOpacity.value));
  });
}

function renderStaticCase() {
  els.caseSummary.textContent = data.caseData.summary;
  els.caseTitle.textContent = data.caseData.title;
  els.caseIntro.innerHTML = paragraphs(data.caseData.intro);
  renderTheoryForm();
}

function renderAll() {
  renderInvestigationState();
  if (selectedLocationId) renderLocationPreview(selectedLocationId);
}

function renderInvestigationState() {
  renderStats();
  renderMarkers();
  renderSearch();
  renderNotebook();
  renderTheoryForm();
}

function renderStats() {
  els.leadCount.textContent = state.leadCount;
  els.evidenceCount.textContent = state.discoveredEvidenceIds.length;
  els.factCount.textContent = state.discoveredFactIds.length;
}

function renderMarkers() {
  if (!map) return;
  markers.forEach((marker) => marker.remove());
  markers = [];

  const shownIds = new Set();
  for (const location of data.locations) {
    if (!location.coordinates) continue;
    const known = isLocationKnown(data.caseData, state, location.id);
    const hiddenButRevealed = data.caseData.hiddenLocationIds.includes(location.id) && state.revealedLocationIds.includes(location.id);
    const directoryLinked = data.directory.some((entry) => entry.locationId === location.id);
    const shouldShow = (known && els.showKnown.checked) ||
      (hiddenButRevealed && els.showHidden.checked) ||
      (directoryLinked && els.showDirectory.checked && known);
    if (!shouldShow || shownIds.has(location.id)) continue;
    shownIds.add(location.id);

    const el = document.createElement("button");
    el.className = markerClass(location);
    el.type = "button";
    el.title = location.name;
    el.addEventListener("click", () => openLocation(location.id, true));

    const marker = new maplibregl.Marker({ element: el, anchor: "center" })
      .setLngLat([location.coordinates.lng, location.coordinates.lat])
      .addTo(map);
    markers.push(marker);
  }
}

function markerClass(location) {
  const classes = ["poi-marker"];
  if (state.visitedLocationIds.includes(location.id)) classes.push("is-visited");
  if (location.tags?.includes("specialist_hub")) classes.push("is-hub");
  if (data.caseData.startingLocationIds.includes(location.id)) classes.push("is-start");
  if (data.caseData.hiddenLocationIds.includes(location.id)) classes.push("is-hidden");
  return classes.join(" ");
}

function renderSearch() {
  const query = els.searchInput.value.trim().toLowerCase();
  const results = buildSearchResults(query).slice(0, 40);
  if (!results.length) {
    els.searchResults.innerHTML = `<p class="muted">No matching public information.</p>`;
    return;
  }
  els.searchResults.innerHTML = results.map((result) => `
    <button class="result-item" type="button" data-kind="${result.kind}" data-location-id="${result.locationId || ""}">
      <span class="result-kind">${escapeHtml(result.kind)}</span>
      <strong>${escapeHtml(result.title)}</strong>
      <span>${escapeHtml(result.detail || "")}</span>
    </button>
  `).join("");
  els.searchResults.querySelectorAll(".result-item").forEach((item, index) => {
    item.addEventListener("click", () => {
      const result = results[index];
      if (result.locationId) openLocation(result.locationId, true);
      else showReference(result);
    });
  });
}

function buildSearchResults(query) {
  const knownLocationIds = new Set(data.locations.filter((location) => isLocationKnown(data.caseData, state, location.id)).map((item) => item.id));
  const haystackIncludes = (parts) => !query || parts.filter(Boolean).join(" ").toLowerCase().includes(query);

  const locations = data.locations
    .filter((location) => knownLocationIds.has(location.id))
    .filter((location) => haystackIncludes([location.name, location.aliases?.join(" "), location.type, location.address, location.globalDescription]))
    .map((location) => ({
      kind: "Place",
      title: location.name,
      detail: `${location.address || location.type} · ${location.globalDescription || ""}`,
      locationId: location.id
    }));

  const directory = data.directory
    .filter((entry) => !entry.locationId || knownLocationIds.has(entry.locationId))
    .filter((entry) => haystackIncludes([entry.displayName, entry.category, entry.occupation, entry.addressText, entry.notes]))
    .map((entry) => ({
      kind: "Directory",
      title: entry.displayName,
      detail: `${entry.occupation || entry.category || ""} · ${entry.addressText || ""}`,
      locationId: entry.locationId
    }));

  const newspaper = data.newspaper.items
    .filter((item) => haystackIncludes([item.headline, item.body, item.type, item.tags?.join(" ")]))
    .map((item) => ({
      kind: "Newspaper",
      title: item.headline,
      detail: item.body,
      locationId: item.linkedLocationIds?.find((id) => knownLocationIds.has(id)),
      body: item.body
    }));

  return [...locations, ...directory, ...newspaper];
}

function openLocation(locationId, fly) {
  showLeadPanel();
  selectedLocationId = locationId;
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
  els.leadText.textContent = location.globalDescription || location.address || "A place in the London directory.";
  els.leadDiscoveries.innerHTML = location.address ? `<span>${escapeHtml(location.address)}</span>` : "";
  els.visitLocation.hidden = false;
  els.visitLocation.textContent = alreadyVisited ? "Revisit location" : "Visit location";
}

function renderLeadPrompt() {
  showLeadPanel();
  els.leadKicker.textContent = "Choose a location";
  els.leadTitle.textContent = "The city is the interface";
  els.leadText.textContent = "Search the directory, inspect the newspaper, or click a known place on the map to begin.";
  els.leadDiscoveries.innerHTML = "";
  els.visitLocation.hidden = true;
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
  els.visitLocation.textContent = "Visit again";
  const discoveries = [];
  for (const id of resolution.effects.discoverEvidenceIds || []) discoveries.push(`Evidence: ${findEvidence(id)?.name || id}`);
  for (const id of resolution.effects.discoverFactIds || []) discoveries.push(`Fact: ${findFact(id)?.summary || id}`);
  for (const id of resolution.effects.revealLocationIds || []) discoveries.push(`Place revealed: ${findLocation(id)?.name || id}`);
  els.leadDiscoveries.innerHTML = discoveries.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
}

function showReference(result) {
  showLeadPanel();
  els.leadKicker.textContent = result.kind;
  els.leadTitle.textContent = result.title;
  els.leadText.textContent = result.body || result.detail;
  els.leadDiscoveries.innerHTML = "";
  els.visitLocation.hidden = true;
}

function showLeadPanel() {
  els.leadPanel.hidden = false;
}

function hideLeadPanel() {
  els.leadPanel.hidden = true;
}

function renderNotebook() {
  renderCompactList(els.evidenceList, state.discoveredEvidenceIds.map((id) => {
    const item = findEvidence(id);
    return item ? `<strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.summary)}</span>` : escapeHtml(id);
  }), "No evidence discovered yet.");
  renderCompactList(els.factList, state.discoveredFactIds.map((id) => {
    const item = findFact(id);
    return item ? `<span>${escapeHtml(item.summary)}</span>` : escapeHtml(id);
  }), "No interpreted facts yet.");
  renderCompactList(els.noteList, state.notebookEntries.map((item) => `<span>${escapeHtml(item.text)}</span>`), "No notes yet.");
}

function renderCompactList(container, items, emptyText) {
  container.innerHTML = items.length ? items.map((item) => `<div class="compact-item">${item}</div>`).join("") : `<p class="muted">${emptyText}</p>`;
}

function renderTheoryForm() {
  els.theoryForm.innerHTML = ["who", "why", "how", "where", "when"].map((slot) => `
    <label class="field">
      <span>${slot[0].toUpperCase()}${slot.slice(1)}</span>
      <select name="${slot}">
        <option value="">Undecided</option>
        ${(data.caseData.theoryOptions[slot] || []).map((option) => `
          <option value="${escapeHtml(option)}" ${state.theory[slot] === option ? "selected" : ""}>${escapeHtml(formatOption(option))}</option>
        `).join("")}
      </select>
    </label>
  `).join("");
}

function submitTheory() {
  const result = compareTheory(data.caseData, state);
  els.solutionResult.hidden = false;
  els.solutionResult.innerHTML = `
    <h3>Solution comparison</h3>
    <div class="score-grid">
      ${Object.entries(result.result).map(([slot, status]) => `<span>${slot}</span><strong class="${status}">${status}</strong>`).join("")}
    </div>
    <p>${escapeHtml(data.caseData.solution.explanation)}</p>
    <p><strong>Missed critical evidence:</strong> ${result.missedCriticalEvidenceIds.length ? result.missedCriticalEvidenceIds.map((id) => findEvidence(id)?.name || id).join(", ") : "None"}</p>
    <p><strong>Lead count:</strong> ${result.leadCount}${result.holmesLeadCount ? ` · benchmark ${result.holmesLeadCount}` : ""}</p>
  `;
}

function switchView(view) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === view));
  document.querySelectorAll(".view").forEach((panel) => panel.classList.toggle("is-active", panel.id === `${view}View`));
}

function loadState(caseData) {
  try {
    const stored = JSON.parse(localStorage.getItem(storeKey));
    if (stored?.caseId === caseData.id) return stored;
  } catch {
    localStorage.removeItem(storeKey);
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
  localStorage.setItem(storeKey, JSON.stringify(state));
}

function findLocation(id) {
  return data.locations.find((item) => item.id === id);
}

function findEvidence(id) {
  return data.caseData.evidence.find((item) => item.id === id);
}

function findFact(id) {
  return data.caseData.facts.find((item) => item.id === id);
}

function paragraphs(text) {
  return text.trim().split(/\n\s*\n/).map((line) => `<p>${escapeHtml(line)}</p>`).join("");
}

function formatOption(value) {
  return value.replaceAll("_", " ").replace("T", " ");
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
