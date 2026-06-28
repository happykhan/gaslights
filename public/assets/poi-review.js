const state = {
  pois: [],
  filteredPois: [],
  currentPoiId: null,
  currentPoi: null,
  originalPoi: null,
  autosaveTimer: null,
  dirty: false,
  map: null,
  marker: null,
};

const els = {
  poiSearch: document.querySelector("#poiSearch"),
  onlyNeedsReview: document.querySelector("#onlyNeedsReview"),
  prevPoi: document.querySelector("#prevPoi"),
  nextPoi: document.querySelector("#nextPoi"),
  poiList: document.querySelector("#poiList"),
  poiStatus: document.querySelector("#poiStatus"),
  poiTitle: document.querySelector("#poiTitle"),
  poiMeta: document.querySelector("#poiMeta"),
  autosaveToggle: document.querySelector("#autosaveToggle"),
  saveState: document.querySelector("#saveState"),
  resetPoi: document.querySelector("#resetPoi"),
  savePoi: document.querySelector("#savePoi"),
  reviewStatusInput: document.querySelector("#reviewStatusInput"),
  typeGuessInput: document.querySelector("#typeGuessInput"),
  canonicalNameInput: document.querySelector("#canonicalNameInput"),
  confirmedTypeInput: document.querySelector("#confirmedTypeInput"),
  tagsInput: document.querySelector("#tagsInput"),
  defaultVisitTextInput: document.querySelector("#defaultVisitTextInput"),
  notesInput: document.querySelector("#notesInput"),
  osmHint: document.querySelector("#osmHint"),
  sourceRefs: document.querySelector("#sourceRefs"),
};

boot();

async function boot() {
  bindEvents();
  initMap();
  await loadPois();
}

function bindEvents() {
  els.poiSearch.addEventListener("input", filterPois);
  els.onlyNeedsReview.addEventListener("change", loadPois);
  els.prevPoi.addEventListener("click", () => stepPoi(-1));
  els.nextPoi.addEventListener("click", () => stepPoi(1));
  els.resetPoi.addEventListener("click", resetPoi);
  els.savePoi.addEventListener("click", savePoi);
  els.autosaveToggle.addEventListener("change", () => {
    if (els.autosaveToggle.checked && state.dirty) scheduleAutosave();
  });

  for (const input of [
    els.reviewStatusInput,
    els.canonicalNameInput,
    els.confirmedTypeInput,
    els.tagsInput,
    els.defaultVisitTextInput,
    els.notesInput
  ]) {
    input.addEventListener("input", markDirtyAndMaybeAutosave);
    input.addEventListener("change", markDirtyAndMaybeAutosave);
  }
}

async function loadPois() {
  const params = new URLSearchParams({
    onlyNeedsReview: String(els.onlyNeedsReview.checked)
  });
  const response = await fetch(`/api/pois?${params.toString()}`, { cache: "no-store" });
  state.pois = await response.json();
  filterPois();
}

function filterPois() {
  const query = els.poiSearch.value.trim().toLowerCase();
  state.filteredPois = state.pois.filter((poi) => {
    if (!query) return true;
    return [
      poi.name,
      poi.canonicalName,
      poi.typeGuess,
      poi.confirmedType,
      poi.reviewStatus,
      poi.notes,
      poi.osmHint?.displayName
    ].filter(Boolean).join(" ").toLowerCase().includes(query);
  });
  renderPoiList();
  if (!state.filteredPois.length) {
    state.currentPoiId = null;
    state.currentPoi = null;
    state.originalPoi = null;
    clearDetails();
    return;
  }
  if (!state.currentPoiId || !state.filteredPois.some((poi) => poi.id === state.currentPoiId)) {
    openPoi(state.filteredPois[0].id);
  }
}

function renderPoiList() {
  els.poiList.innerHTML = state.filteredPois.map((poi) => `
    <button class="poi-item${poi.id === state.currentPoiId ? " is-active" : ""}" type="button" data-poi-id="${escapeHtml(poi.id)}">
      <span>${escapeHtml(poi.reviewStatus)}</span>
      <strong>${escapeHtml(poi.canonicalName || poi.name)}</strong>
      <span>${escapeHtml(poi.confirmedType || poi.typeGuess)}</span>
    </button>
  `).join("");
  els.poiList.querySelectorAll(".poi-item").forEach((button) => {
    button.addEventListener("click", () => openPoi(button.dataset.poiId));
  });
}

function stepPoi(direction) {
  const index = state.filteredPois.findIndex((poi) => poi.id === state.currentPoiId);
  if (index === -1) return;
  const next = state.filteredPois[index + direction];
  if (next) openPoi(next.id);
}

function openPoi(poiId) {
  const poi = state.filteredPois.find((item) => item.id === poiId);
  if (!poi) return;
  state.currentPoiId = poiId;
  state.currentPoi = structuredClone(poi);
  state.originalPoi = structuredClone(poi);
  state.dirty = false;

  els.poiStatus.textContent = poi.reviewStatus || "candidate";
  els.poiTitle.textContent = poi.canonicalName || poi.name;
  els.poiMeta.textContent = `${poi.typeGuess} · score ${poi.priorityScore} · classifications ${poi.classificationCount}`;
  els.reviewStatusInput.value = poi.reviewStatus || "candidate";
  els.typeGuessInput.value = poi.typeGuess || "";
  els.canonicalNameInput.value = poi.canonicalName || "";
  els.confirmedTypeInput.value = poi.confirmedType || "";
  els.tagsInput.value = (poi.tags || []).join(", ");
  els.defaultVisitTextInput.value = poi.defaultVisitText || "";
  els.notesInput.value = poi.notes || "";
  renderOsmHint(poi.osmHint);
  renderSourceRefs(poi.sourceRefs || []);
  updateMapForPoi(poi);
  setSaveState("Idle");
  renderPoiList();
}

function renderOsmHint(hint) {
  if (!hint) {
    els.osmHint.innerHTML = `<p>No OSM hint cached yet for this candidate.</p>`;
    return;
  }
  const parts = [
    `<p><strong>${escapeHtml(hint.displayName || "Unnamed OSM result")}</strong></p>`,
    `<p>Source: <code>${escapeHtml(hint.source || "unknown")}</code></p>`,
    `<p>Category: <code>${escapeHtml(hint.osmCategory || "n/a")}</code> · Type: <code>${escapeHtml(hint.osmType || "n/a")}</code></p>`
  ];
  if (hint.distanceMeters !== undefined) {
    parts.push(`<p>Distance: ${escapeHtml(String(hint.distanceMeters))} m · Confidence: <code>${escapeHtml(hint.confidence || "n/a")}</code></p>`);
  } else {
    parts.push(`<p>Confidence: <code>${escapeHtml(hint.confidence || "n/a")}</code></p>`);
  }
  els.osmHint.innerHTML = parts.join("");
}

function renderSourceRefs(refs) {
  if (!refs.length) {
    els.sourceRefs.innerHTML = `<p>No source refs attached.</p>`;
    return;
  }
  els.sourceRefs.innerHTML = refs.map((ref) => `
    <div>
      <strong>${escapeHtml(ref.label || ref.kind || "source")}</strong>
      <p>Kind: <code>${escapeHtml(ref.kind || "n/a")}</code>${ref.pinId ? ` · Pin: <code>${escapeHtml(ref.pinId)}</code>` : ""}${ref.license ? ` · License: <code>${escapeHtml(ref.license)}</code>` : ""}</p>
    </div>
  `).join("");
}

function initMap() {
  state.map = new maplibregl.Map({
    container: "map",
    center: [-0.1246, 51.5079],
    zoom: 12.8,
    minZoom: 11,
    maxZoom: 20,
    style: {
      version: 8,
      sources: {
        modern: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256
        },
        historical: {
          type: "raster",
          tiles: ["/tiles/london-1895-six-inch/{z}/{x}/{y}.png?v=202606261801"],
          tileSize: 256,
          minzoom: 11,
          maxzoom: 18
        }
      },
      layers: [
        {
          id: "modern",
          type: "raster",
          source: "modern",
          paint: { "raster-opacity": 0.22 }
        },
        {
          id: "historical",
          type: "raster",
          source: "historical",
          paint: { "raster-opacity": 1 }
        }
      ]
    }
  });
  state.map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
}

function updateMapForPoi(poi) {
  if (!state.map) return;
  const lngLat = [poi.coordinates.lng, poi.coordinates.lat];
  if (!state.marker) {
    const el = document.createElement("div");
    el.className = "poi-marker";
    state.marker = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(lngLat).addTo(state.map);
  } else {
    state.marker.setLngLat(lngLat);
  }
  state.map.flyTo({ center: lngLat, zoom: Math.max(state.map.getZoom(), 15), essential: true });
}

function buildPayload() {
  return {
    reviewStatus: els.reviewStatusInput.value,
    canonicalName: els.canonicalNameInput.value.trim(),
    confirmedType: els.confirmedTypeInput.value.trim(),
    tags: splitCsv(els.tagsInput.value),
    defaultVisitText: els.defaultVisitTextInput.value.trim(),
    notes: els.notesInput.value.trim()
  };
}

async function savePoi() {
  if (!state.currentPoiId) return;
  clearTimeout(state.autosaveTimer);
  setSaveState("Saving...");
  const payload = buildPayload();
  const response = await fetch(`/api/pois/${encodeURIComponent(state.currentPoiId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Save failed" }));
    setSaveState("Save failed");
    window.alert(error.error || "Save failed");
    return;
  }
  const updated = await response.json();
  const listItem = state.pois.find((item) => item.id === state.currentPoiId);
  if (listItem) Object.assign(listItem, updated);
  state.currentPoi = structuredClone(updated);
  state.originalPoi = structuredClone(updated);
  state.dirty = false;
  els.poiStatus.textContent = updated.reviewStatus;
  els.poiTitle.textContent = updated.canonicalName || updated.name;
  setSaveState("Saved");
  renderPoiList();
}

function resetPoi() {
  if (!state.originalPoi) return;
  openPoi(state.originalPoi.id);
}

function clearDetails() {
  els.poiStatus.textContent = "No match";
  els.poiTitle.textContent = "No POIs";
  els.poiMeta.textContent = "";
  els.osmHint.innerHTML = "";
  els.sourceRefs.innerHTML = "";
  setSaveState("Idle");
}

function markDirtyAndMaybeAutosave() {
  state.dirty = true;
  setSaveState(els.autosaveToggle.checked ? "Unsaved changes" : "Auto-save off");
  if (els.autosaveToggle.checked) scheduleAutosave();
}

function scheduleAutosave() {
  clearTimeout(state.autosaveTimer);
  state.autosaveTimer = setTimeout(() => {
    savePoi();
  }, 500);
}

function setSaveState(message) {
  els.saveState.textContent = message;
}

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
