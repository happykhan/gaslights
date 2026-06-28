const EDITOR_API_BASE = window.location.port === "4179" ? "" : "http://127.0.0.1:4179";
const HISTORICAL_TILE_MAX_ZOOM = 16;
const EDITOR_MAP_MAX_ZOOM = 17.5;
const LOCATION_MAP_BOUNDS = [
  [-0.55, 51.28],
  [0.30, 51.72]
];
const HISTORICAL_TILE_BOUNDS = [-0.2306249, 51.4645187, -0.0218126, 51.5513826];
const HISTORICAL_SOURCE_ID = "editor-historical";
const HISTORICAL_LAYER_ID = "editor-historical-layer";
const MODERN_SOURCE_ID = "editor-modern";
const MODERN_LAYER_ID = "editor-modern-layer";
const EDITOR_MODERN_BASE_OPACITY = 1;

const RULE_KINDS = ["lead", "repeat", "ambient", "fallback"];
const ARTICLE_TYPES = ["news", "court_report", "society", "letter", "advert", "notice", "notices", "shipping_notice", "transport_notice", "entertainment"];
const PERSON_KINDS = ["suspect", "victim", "witness", "resident", "official", "other"];
const CASE_ROLES = ["lead", "ambient", "red_herring", "hidden"];
const THEORY_SLOT_OPTIONS = ["who", "why", "how", "where", "when"];
const SIDEBAR_PAGE_SIZE = 12;
const LOCATION_MAP_SIZE_STORAGE_KEY = "gaslights.locationEditor.mapExpanded";
const LOCATION_SORT_STORAGE_KEY = "gaslights.locationEditor.locationSort";
const WORKSPACE_PANEL_IDS = {
  briefing: "briefingPanel",
  theory: "theoryPanel",
  caseLocations: "caseLocationsPanel",
  visitRules: "visitRulesPanel",
  newspaper: "newspaperPanel"
};

let bootstrap = { locations: [], people: [], cases: [], currentCaseId: null };
let workspaceCase = null;
let workspaceIssue = null;

let activeSidebarTab = "cases";
let activeWorkspaceTab = "briefing";
let selectedLocationId = null;
let selectedPersonId = null;
let selectedCaseLocationId = null;
let selectedRuleId = null;
let selectedArticleId = null;
let locationMap = null;
let locationMarker = null;
let locationPoiMarkers = new Map();
let caseLocationMap = null;
let caseLocationMarker = null;
const locationPickerMaps = new Map();
let historicalOpacity = 0.85;
let locationMapExpanded = readLocalStorageFlag(LOCATION_MAP_SIZE_STORAGE_KEY, false);
let locationSortMode = readLocalStorageValue(LOCATION_SORT_STORAGE_KEY, "name");
let pendingImportKind = null;
let pendingImportFormat = null;
const sidebarPages = {
  cases: 1,
  locations: 1,
  people: 1
};
const sidebarSelections = {
  cases: new Set(),
  locations: new Set(),
  people: new Set()
};
const visibleSidebarItems = {
  cases: [],
  locations: [],
  people: []
};

const els = {
  workspaceCaseTitle: document.querySelector("#workspaceCaseTitle"),
  workspaceStatus: document.querySelector("#workspaceStatus"),
  locationStatus: document.querySelector("#locationStatus"),
  personStatus: document.querySelector("#personStatus"),
  caseQuery: document.querySelector("#caseQuery"),
  locationQuery: document.querySelector("#locationQuery"),
  locationSort: document.querySelector("#locationSort"),
  personQuery: document.querySelector("#personQuery"),
  caseList: document.querySelector("#caseList"),
  locationList: document.querySelector("#locationList"),
  personList: document.querySelector("#personList"),
  caseSelectionSummary: document.querySelector("#caseSelectionSummary"),
  locationSelectionSummary: document.querySelector("#locationSelectionSummary"),
  personSelectionSummary: document.querySelector("#personSelectionSummary"),
  briefingForm: document.querySelector("#briefingForm"),
  theoryFormEditor: document.querySelector("#theoryFormEditor"),
  caseLocationPicker: document.querySelector("#caseLocationPicker"),
  caseLocationList: document.querySelector("#caseLocationList"),
  caseLocationRoleForm: document.querySelector("#caseLocationRoleForm"),
  ruleLocationFilter: document.querySelector("#ruleLocationFilter"),
  ruleList: document.querySelector("#ruleList"),
  ruleForm: document.querySelector("#ruleForm"),
  issueForm: document.querySelector("#issueForm"),
  articleList: document.querySelector("#articleList"),
  articleForm: document.querySelector("#articleForm"),
  articlePreview: document.querySelector("#articlePreview"),
  articleTitle: document.querySelector("#articleTitle"),
  locationForm: document.querySelector("#locationForm"),
  locationTitle: document.querySelector("#locationTitle"),
  locationSubtitle: document.querySelector("#locationSubtitle"),
  personForm: document.querySelector("#personForm"),
  personTitle: document.querySelector("#personTitle"),
  importFilePicker: document.querySelector("#importFilePicker"),
  exportLocationsCsv: document.querySelector("#exportLocationsCsv"),
  exportLocationsJson: document.querySelector("#exportLocationsJson"),
  importLocationsCsv: document.querySelector("#importLocationsCsv"),
  importLocationsJson: document.querySelector("#importLocationsJson"),
  exportPeopleCsv: document.querySelector("#exportPeopleCsv"),
  exportPeopleJson: document.querySelector("#exportPeopleJson"),
  importPeopleCsv: document.querySelector("#importPeopleCsv"),
  importPeopleJson: document.querySelector("#importPeopleJson"),
  exportCaseJson: document.querySelector("#exportCaseJson"),
  importCaseJson: document.querySelector("#importCaseJson"),
  exportNewspaperCsv: document.querySelector("#exportNewspaperCsv"),
  exportNewspaperJson: document.querySelector("#exportNewspaperJson"),
  importNewspaperCsv: document.querySelector("#importNewspaperCsv"),
  importNewspaperJson: document.querySelector("#importNewspaperJson"),
  centerCaseLocationMap: document.querySelector("#centerCaseLocationMap"),
  caseLocationMap: document.querySelector("#caseLocationMap"),
  centerLocationMap: document.querySelector("#centerLocationMap"),
  locationMap: document.querySelector("#locationMap"),
  locationNearbyList: document.querySelector("#locationNearbyList"),
  locationWorkspacePanel: document.querySelector("#locationWorkspacePanel"),
  toggleLocationMapSize: document.querySelector("#toggleLocationMapSize")
};

boot();

async function boot() {
  try {
    bindNavigation();
    bindGlobalActions();
    bindLocationImportExport();
    bindMapControls();
    enhanceEditorSelects(document.querySelector("#locationsTab"));
    syncLocationMapSizeUi();
    syncLocationSortControl();
    await loadBootstrap();
    await loadWorkspace(bootstrap.currentCaseId || bootstrap.cases[0]?.id || null);
    initLocationMap();
    initCaseLocationMap();
    renderAll();
  } catch (error) {
    console.error(error);
    renderEditorUnavailable(error);
  }
}

function bindNavigation() {
  document.querySelectorAll(".editor-tab").forEach((button) => {
    button.addEventListener("click", () => {
      activeSidebarTab = button.dataset.tab;
      document.querySelectorAll(".editor-tab").forEach((item) => item.classList.toggle("is-active", item === button));
      document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.toggle("is-active", panel.id === `${activeSidebarTab}Tab`));
      document.querySelectorAll(".editor-panel").forEach((panel) => panel.classList.remove("is-active"));
      if (activeSidebarTab === "cases") document.querySelector("#caseWorkspacePanel").classList.add("is-active");
      if (activeSidebarTab === "locations") document.querySelector("#locationWorkspacePanel").classList.add("is-active");
      if (activeSidebarTab === "people") document.querySelector("#peopleWorkspacePanel").classList.add("is-active");
      renderAll();
    });
  });

  document.querySelectorAll(".workspace-tab").forEach((button) => {
    button.addEventListener("click", () => {
      activeWorkspaceTab = button.dataset.workspaceTab;
      renderWorkspace();
    });
  });

  els.caseQuery.addEventListener("input", () => {
    sidebarPages.cases = 1;
    renderCaseList();
  });
  els.locationQuery.addEventListener("input", () => {
    sidebarPages.locations = 1;
    renderLocationList();
  });
  els.locationSort?.addEventListener("change", () => {
    locationSortMode = els.locationSort.value || "name";
    sidebarPages.locations = 1;
    try {
      window.localStorage?.setItem(LOCATION_SORT_STORAGE_KEY, locationSortMode);
    } catch {
      // Optional preference only.
    }
    renderLocationList();
  });
  els.personQuery.addEventListener("input", () => {
    sidebarPages.people = 1;
    renderPeopleList();
  });
}

function bindGlobalActions() {
  document.querySelector("#newCase").addEventListener("click", createCase);
  document.querySelector("#duplicateCase").addEventListener("click", duplicateCase);
  document.querySelector("#deleteCase").addEventListener("click", deleteCase);
  document.querySelector("#newLocation").addEventListener("click", createLocation);
  document.querySelector("#deleteLocation").addEventListener("click", deleteLocation);
  document.querySelector("#newPerson").addEventListener("click", createPerson);
  document.querySelector("#deletePerson").addEventListener("click", deletePerson);
  document.querySelector("#addCaseLocation").addEventListener("click", addCaseLocation);
  document.querySelector("#removeCaseLocation").addEventListener("click", removeCaseLocation);
  document.querySelector("#newRule").addEventListener("click", createRule);
  document.querySelector("#moveRuleUp").addEventListener("click", () => moveSelectedRule(-1));
  document.querySelector("#moveRuleDown").addEventListener("click", () => moveSelectedRule(1));
  document.querySelector("#duplicateRule").addEventListener("click", duplicateRule);
  document.querySelector("#deleteRule").addEventListener("click", deleteRule);
  document.querySelector("#newArticle").addEventListener("click", createArticle);
  document.querySelector("#deleteArticle").addEventListener("click", deleteArticle);
  bindBulkSelectionActions();
}

function bindBulkSelectionActions() {
  document.querySelector("#selectVisibleCases").addEventListener("click", () => selectVisibleSidebarItems("cases"));
  document.querySelector("#clearSelectedCases").addEventListener("click", () => clearSidebarSelection("cases"));
  document.querySelector("#deleteSelectedCases").addEventListener("click", deleteSelectedCases);
  document.querySelector("#selectVisibleLocations").addEventListener("click", () => selectVisibleSidebarItems("locations"));
  document.querySelector("#clearSelectedLocations").addEventListener("click", () => clearSidebarSelection("locations"));
  document.querySelector("#exportSelectedLocationsCsv").addEventListener("click", () => exportSelectedSidebarItems("locations", "csv"));
  document.querySelector("#deleteSelectedLocations").addEventListener("click", () => deleteSelectedRecords("locations"));
  document.querySelector("#selectVisiblePeople").addEventListener("click", () => selectVisibleSidebarItems("people"));
  document.querySelector("#clearSelectedPeople").addEventListener("click", () => clearSidebarSelection("people"));
  document.querySelector("#exportSelectedPeopleCsv").addEventListener("click", () => exportSelectedSidebarItems("people", "csv"));
  document.querySelector("#deleteSelectedPeople").addEventListener("click", () => deleteSelectedRecords("people"));
}

function bindLocationImportExport() {
  bindExportButton(els.exportLocationsCsv, "locations", "csv");
  bindExportButton(els.exportLocationsJson, "locations", "json");
  bindImportButton(els.importLocationsCsv, "locations", "csv");
  bindImportButton(els.importLocationsJson, "locations", "json");
  bindExportButton(els.exportPeopleCsv, "people", "csv");
  bindExportButton(els.exportPeopleJson, "people", "json");
  bindImportButton(els.importPeopleCsv, "people", "csv");
  bindImportButton(els.importPeopleJson, "people", "json");
  bindExportButton(els.exportCaseJson, "case", "json");
  bindImportButton(els.importCaseJson, "case", "json");
  bindExportButton(els.exportNewspaperCsv, "newspaper", "csv");
  bindExportButton(els.exportNewspaperJson, "newspaper", "json");
  bindImportButton(els.importNewspaperCsv, "newspaper", "csv");
  bindImportButton(els.importNewspaperJson, "newspaper", "json");
  els.importFilePicker.addEventListener("change", handleImportFileSelection);
}

function bindMapControls() {
  document.addEventListener("input", (event) => {
    const input = event.target.closest("[data-historical-opacity]");
    if (!input) return;
    setEditorHistoricalOpacity(Number(input.value));
  });
  els.centerCaseLocationMap?.addEventListener("click", () => {
    const location = findLocation(selectedCaseLocationId);
    if (location?.coordinates && caseLocationMap) {
      caseLocationMap.flyTo({ center: [location.coordinates.lng, location.coordinates.lat], zoom: Math.max(caseLocationMap.getZoom(), 15) });
    }
  });
  els.centerLocationMap?.addEventListener("click", () => {
    const location = getSelectedLocation();
    if (location?.coordinates && locationMap) {
      locationMap.flyTo({ center: [location.coordinates.lng, location.coordinates.lat], zoom: Math.max(locationMap.getZoom(), 15) });
    }
  });
  els.toggleLocationMapSize?.addEventListener("click", () => {
    setLocationMapExpanded(!locationMapExpanded);
  });
}

async function loadBootstrap() {
  const response = await fetch(`${EDITOR_API_BASE}/api/editor/bootstrap`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Editor bootstrap failed: HTTP ${response.status}`);
  bootstrap = await response.json();
  pruneSidebarSelections();
  if (!bootstrap.locations.some((item) => item.id === selectedLocationId)) selectedLocationId = bootstrap.locations[0]?.id || null;
  if (!bootstrap.people.some((item) => item.id === selectedPersonId)) selectedPersonId = bootstrap.people[0]?.id || null;
}

function pruneSidebarSelections() {
  const available = {
    cases: new Set(bootstrap.cases.map((item) => item.id)),
    locations: new Set(bootstrap.locations.map((item) => item.id)),
    people: new Set(bootstrap.people.map((item) => item.id))
  };
  for (const kind of Object.keys(sidebarSelections)) {
    for (const id of [...sidebarSelections[kind]]) {
      if (!available[kind].has(id)) sidebarSelections[kind].delete(id);
    }
  }
}

async function loadWorkspace(caseId) {
  if (!caseId) return;
  const response = await fetch(`${EDITOR_API_BASE}/api/cases/${encodeURIComponent(caseId)}/workspace`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Editor workspace failed: HTTP ${response.status}`);
  const payload = await response.json();
  workspaceCase = payload.caseData;
  workspaceIssue = payload.issue;
  bootstrap.currentCaseId = workspaceCase.id;
  selectedCaseLocationId = workspaceCase.caseLocationIds?.[0] || null;
  selectedRuleId = getRulesForSelectedLocation()[0]?.id || workspaceCase.visitRules?.[0]?.id || null;
  selectedArticleId = workspaceIssue?.items?.[0]?.id || null;
}

function renderEditorUnavailable(error) {
  const message = error?.message?.includes("Failed to fetch")
    ? "The authoring server is not running."
    : (error?.message || "The editor could not start.");
  document.body.innerHTML = `
    <div class="editor-shell">
      <main class="editor-main" style="padding:18px;">
        <section class="editor-panel is-active">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Authoring</p>
              <h2>Editor unavailable</h2>
            </div>
          </div>
          <div class="editor-form">
            <p class="muted">${escapeHtml(message)}</p>
            <p class="muted">Start it with <code>npm run editor</code>, then reload the editor.</p>
          </div>
        </section>
      </main>
    </div>
  `;
}

function renderAll() {
  renderCaseList();
  renderLocationList();
  renderPeopleList();
  renderLocationWorkspace();
  renderPeopleWorkspace();
  renderWorkspace();
  enhanceEditorSelects(document);
}

function renderWorkspace() {
  if (!workspaceCase) return;
  els.workspaceCaseTitle.textContent = workspaceCase.title;
  renderBriefingForm();
  renderTheoryEditor();
  renderCaseLocationsPanel();
  renderVisitRulesPanel();
  renderNewspaperPanel();
  syncWorkspaceTabs();
  enhanceEditorSelects(document.querySelector("#caseWorkspacePanel"));
  scheduleVisibleMapSync();
}

function syncWorkspaceTabs() {
  const activePanelId = WORKSPACE_PANEL_IDS[activeWorkspaceTab] || WORKSPACE_PANEL_IDS.briefing;
  document.querySelectorAll(".workspace-tab").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.workspaceTab === activeWorkspaceTab);
  });
  document.querySelectorAll(".workspace-panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.id === activePanelId);
  });
}

function scheduleVisibleMapSync() {
  window.setTimeout(() => {
    if (document.querySelector("#caseLocationsPanel.is-active")) syncCaseLocationMap();
    if (document.querySelector("#locationWorkspacePanel.is-active")) syncLocationMap();
    document.querySelectorAll(".location-picker").forEach((picker) => syncLocationPickerMap(picker));
  }, 0);
}

function renderCaseList() {
  const query = els.caseQuery.value.trim().toLowerCase();
  const items = bootstrap.cases.filter((item) => !query || [item.title, item.summary, item.date].join(" ").toLowerCase().includes(query));
  const page = paginateSidebarItems("cases", items);
  visibleSidebarItems.cases = page.items.map((item) => item.id);
  els.caseList.innerHTML = page.items.map((item) => `
    ${buildSidebarRecordRow({
      kind: "cases",
      id: item.id,
      active: item.id === workspaceCase?.id,
      title: item.title,
      meta: item.status || "draft",
      detail: item.summary || "",
      dataAttribute: "data-case-id"
    })}
  `).join("") + buildSidebarPagination("cases", page);
  els.caseList.querySelectorAll("[data-case-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await loadWorkspace(button.dataset.caseId);
      renderAll();
    });
  });
  bindSidebarSelection("cases", els.caseList, renderCaseList);
  bindSidebarPagination("cases", renderCaseList);
  updateSidebarSelectionUi("cases");
}

function renderLocationList() {
  const query = els.locationQuery.value.trim().toLowerCase();
  const filtered = bootstrap.locations.filter((item) => !query || [item.name, item.type, item.address, item.searchPreviewText, item.defaultVisitText].join(" ").toLowerCase().includes(query));
  const items = sortLocationSidebarItems(filtered);
  const page = paginateSidebarItems("locations", items);
  visibleSidebarItems.locations = page.items.map((item) => item.id);
  els.locationList.innerHTML = page.items.map((item) => `
    ${buildSidebarRecordRow({
      kind: "locations",
      id: item.id,
      active: item.id === selectedLocationId,
      title: item.name,
      meta: formatLabel(item.type),
      detail: item.sourceKind || "seed",
      dataAttribute: "data-location-id"
    })}
  `).join("") + buildSidebarPagination("locations", page);
  els.locationList.querySelectorAll("[data-location-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedLocationId = button.dataset.locationId;
      renderLocationList();
      renderLocationWorkspace();
      syncLocationMap();
    });
  });
  bindSidebarSelection("locations", els.locationList, renderLocationList);
  bindSidebarPagination("locations", renderLocationList);
  updateSidebarSelectionUi("locations");
}

function sortLocationSidebarItems(items) {
  const indexed = new Map(bootstrap.locations.map((item, index) => [item.id, index]));
  const byName = (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  return [...items].sort((a, b) => {
    if (locationSortMode === "type") {
      return String(a.type || "").localeCompare(String(b.type || "")) || byName(a, b);
    }
    if (locationSortMode === "visibility") {
      return formatLocationVisibility(a).localeCompare(formatLocationVisibility(b)) || byName(a, b);
    }
    if (locationSortMode === "source") {
      return String(a.sourceKind || "").localeCompare(String(b.sourceKind || "")) || byName(a, b);
    }
    if (locationSortMode === "recent") {
      return (indexed.get(b.id) ?? 0) - (indexed.get(a.id) ?? 0) || byName(a, b);
    }
    return byName(a, b);
  });
}

function formatLocationVisibility(location) {
  return location.visibility === "public" ? "public" : "hidden";
}

function renderPeopleList() {
  const query = els.personQuery.value.trim().toLowerCase();
  const items = bootstrap.people.filter((item) => !query || [item.name, item.kind, item.notes].join(" ").toLowerCase().includes(query));
  const page = paginateSidebarItems("people", items);
  visibleSidebarItems.people = page.items.map((item) => item.id);
  els.personList.innerHTML = page.items.map((item) => `
    ${buildSidebarRecordRow({
      kind: "people",
      id: item.id,
      active: item.id === selectedPersonId,
      title: item.name,
      meta: formatLabel(item.kind),
      detail: item.notes || "",
      dataAttribute: "data-person-id"
    })}
  `).join("") + buildSidebarPagination("people", page);
  els.personList.querySelectorAll("[data-person-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedPersonId = button.dataset.personId;
      renderPeopleList();
      renderPeopleWorkspace();
    });
  });
  bindSidebarSelection("people", els.personList, renderPeopleList);
  bindSidebarPagination("people", renderPeopleList);
  updateSidebarSelectionUi("people");
}

function buildSidebarRecordRow({ kind, id, active, title, meta, detail, dataAttribute }) {
  const selected = sidebarSelections[kind].has(id);
  return `
    <div class="location-row${selected ? " is-selected" : ""}">
      <label class="record-select" title="Select for bulk actions">
        <input type="checkbox" data-select-kind="${escapeHtml(kind)}" data-select-id="${escapeHtml(id)}" ${selected ? "checked" : ""} />
        <span>Select</span>
      </label>
      <button class="location-item${active ? " is-active" : ""}" type="button" ${dataAttribute}="${escapeHtml(id)}">
        <strong>${escapeHtml(title || "Untitled")}</strong>
        <span>${escapeHtml(meta || "")}</span>
        <span>${escapeHtml(detail || "")}</span>
      </button>
    </div>
  `;
}

function paginateSidebarItems(kind, items) {
  const pageCount = Math.max(1, Math.ceil(items.length / SIDEBAR_PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, sidebarPages[kind] || 1), pageCount);
  sidebarPages[kind] = currentPage;
  const start = (currentPage - 1) * SIDEBAR_PAGE_SIZE;
  return {
    items: items.slice(start, start + SIDEBAR_PAGE_SIZE),
    total: items.length,
    currentPage,
    pageCount,
    start: items.length ? start + 1 : 0,
    end: Math.min(start + SIDEBAR_PAGE_SIZE, items.length)
  };
}

function buildSidebarPagination(kind, page) {
  return `
    <div class="list-pagination" data-pagination-kind="${escapeHtml(kind)}">
      <button class="secondary-button inline-button" type="button" data-page-action="prev" ${page.currentPage <= 1 ? "disabled" : ""}>Previous</button>
      <span>${escapeHtml(formatPaginationSummary(page))}</span>
      <button class="secondary-button inline-button" type="button" data-page-action="next" ${page.currentPage >= page.pageCount ? "disabled" : ""}>Next</button>
    </div>
  `;
}

function bindSidebarPagination(kind, renderFn) {
  const container = document.querySelector(`[data-pagination-kind="${kind}"]`);
  if (!container) return;
  container.querySelectorAll("[data-page-action]").forEach((button) => {
    button.addEventListener("click", () => {
      sidebarPages[kind] += button.dataset.pageAction === "next" ? 1 : -1;
      renderFn();
    });
  });
}

function bindSidebarSelection(kind, container, renderFn) {
  container.querySelectorAll(`[data-select-kind="${kind}"]`).forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) sidebarSelections[kind].add(input.dataset.selectId);
      else sidebarSelections[kind].delete(input.dataset.selectId);
      renderFn();
    });
  });
}

function selectVisibleSidebarItems(kind) {
  for (const id of visibleSidebarItems[kind] || []) sidebarSelections[kind].add(id);
  renderSidebarList(kind);
}

function clearSidebarSelection(kind) {
  sidebarSelections[kind].clear();
  renderSidebarList(kind);
}

function renderSidebarList(kind) {
  if (kind === "cases") renderCaseList();
  if (kind === "locations") renderLocationList();
  if (kind === "people") renderPeopleList();
}

function updateSidebarSelectionUi(kind) {
  const count = sidebarSelections[kind].size;
  const summary = {
    cases: els.caseSelectionSummary,
    locations: els.locationSelectionSummary,
    people: els.personSelectionSummary
  }[kind];
  if (summary) summary.textContent = `${count} selected`;
  document.querySelectorAll(`[data-selection-kind="${kind}"] button`).forEach((button) => {
    const isClear = button.id.startsWith("clearSelected");
    const isDelete = button.id.startsWith("deleteSelected");
    const isExport = button.id.startsWith("exportSelected");
    if (isClear || isDelete || isExport) button.disabled = count === 0;
  });
}

function formatPaginationSummary(page) {
  if (!page.total) return "0 items";
  return `${page.start}-${page.end} of ${page.total}`;
}

function renderLocationWorkspace() {
  const location = getSelectedLocation();
  els.locationTitle.textContent = location?.name || "Select a location";
  if (els.locationSubtitle) els.locationSubtitle.textContent = location ? formatLocationHeaderSubtitle(location) : "";
  if (!location) {
    els.locationForm.innerHTML = `<p class="muted">No location selected.</p>`;
    return;
  }

  const typeOptions = buildUniqueOptions([
    ...bootstrap.locations.map((item) => item.type),
    "private_residence",
    "laboratory",
    "railway_office",
    "police_station",
    "office",
    "warehouse",
    "hospital",
    "newspaper_office"
  ]);
  const tagOptions = buildUniqueOptions(bootstrap.locations.flatMap((item) => item.tags || []));
  const worldVisitRules = location.worldVisitRules || [];
  els.locationForm.innerHTML = `
    <label class="field">
      <span>${fieldLabel("ID", "Internal stable id used by cases and people. You usually do not need to edit this.")}</span>
      <input name="id" value="${escapeHtml(location.id)}" ${location.sourceKind !== "authored" ? "readonly" : ""} />
    </label>
    <label class="field">
      <span>${fieldLabel("Name", "Main display name for this place in the editor and player UI.")}</span>
      <input name="name" value="${escapeHtml(location.name || "")}" />
    </label>
    <div class="grid-2">
      <label class="field">
        <span>${fieldLabel("POI type", "The broad place category used for map labels, generic fallback text, and editor filtering.")}</span>
        <select name="type" data-editor-select>
          ${buildSelectOptions(typeOptions, location.type || "", false)}
        </select>
      </label>
      <label class="field">
        <span>${fieldLabel("Visibility", "Case-only places stay hidden until a case reveals them. Public places can appear as general world POIs.")}</span>
        <select name="visibility" data-editor-select>
          ${["", "public"].map((value) => `<option value="${value}" ${String(location.visibility || "") === value ? "selected" : ""}>${value || "hidden / case-only"}</option>`).join("")}
        </select>
      </label>
    </div>
    <label class="field">
      <span>${fieldLabel("Address", "The address or address-like label. For private residences, prefer address first.")}</span>
      <input name="address" value="${escapeHtml(location.address || "")}" />
    </label>
    <div class="grid-2">
      <label class="field">
        <span>${fieldLabel("Latitude", "Map coordinate. Drag the marker to update this more safely.")}</span>
        <input name="lat" value="${escapeHtml(String(location.coordinates?.lat ?? ""))}" />
      </label>
      <label class="field">
        <span>${fieldLabel("Longitude", "Map coordinate. Drag the marker to update this more safely.")}</span>
        <input name="lng" value="${escapeHtml(String(location.coordinates?.lng ?? ""))}" />
      </label>
    </div>
    <label class="field">
      <span>${fieldLabel("Aliases", "Alternative names or address-first labels that should help search find this place.")}</span>
      <textarea name="aliases" class="compact-textarea">${escapeHtml((location.aliases || []).join("\n"))}</textarea>
    </label>
    <label class="field">
      <span>${fieldLabel("Search preview text", "Short teaser shown before the player visits. Keep it factual and not too revealing.")}</span>
      <textarea name="searchPreviewText">${escapeHtml(location.searchPreviewText || "")}</textarea>
      <span class="field-help">Shown in search results and the place preview before the player visits.</span>
    </label>
    <label class="field">
      <span>${fieldLabel("Default visit text", "Fallback visit copy used when no case-specific or world visit text matches.")}</span>
      <textarea name="defaultVisitText">${escapeHtml(location.defaultVisitText || "")}</textarea>
      <span class="field-help">Shown when this place is visited and no case or world visit rule matches.</span>
    </label>
    ${buildWorldVisitRulesEditorHtml(location, worldVisitRules)}
    <label class="field">
      <span>${fieldLabel("Tags", "Minimal authoring tags for grouping and fallback behavior. One per line.")}</span>
      <textarea name="tags">${escapeHtml((location.tags || []).join("\n"))}</textarea>
      <span class="field-help">${escapeHtml(tagOptions.join(", "))}</span>
    </label>
  `;

  bindLocationIdAutofill(location);
  bindLocationCoordInputs();
  enhanceEditorSelects(els.locationForm);
  els.locationForm.onsubmit = async (event) => {
    event.preventDefault();
    try {
      setStatus(els.locationStatus, "Saving...");
      const form = new FormData(els.locationForm);
      const saveAndNewCoordinates = event.submitter?.dataset.locationSaveAction === "save-new"
        ? getLocationCoordinateSeed(form)
        : null;
      const body = {
        location: {
          id: form.get("id"),
          name: form.get("name"),
          aliases: form.get("aliases"),
          type: form.get("type"),
          visibility: form.get("visibility"),
          address: form.get("address"),
          searchPreviewText: form.get("searchPreviewText"),
          defaultVisitText: form.get("defaultVisitText"),
          lat: form.get("lat"),
          lng: form.get("lng"),
          tags: form.get("tags"),
          worldVisitRules: parseWorldVisitRulesFromForm(location.id)
        }
      };
      const response = await fetch(`${EDITOR_API_BASE}/api/locations/${encodeURIComponent(location.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `Save failed: ${response.status}`);
      await loadBootstrap();
      selectedLocationId = payload.id || payload.location?.id || form.get("id");
      await maybeReloadWorkspaceForReferences();
      setStatus(els.locationStatus, "Saved");
      if (event.submitter?.dataset.locationSaveAction === "save-new") {
        await createLocation({
          coordinates: saveAndNewCoordinates || payload.coordinates
        });
        setStatus(els.locationStatus, "Created next location");
        return;
      }
      renderAll();
    } catch (error) {
      setStatus(els.locationStatus, "Save failed");
      showEditorMessage({
        title: "Location save failed",
        message: error.message || "The location could not be saved."
      });
    }
  };
  bindWorldVisitRuleControls(location);
  syncLocationMap();
}

function buildWorldVisitRulesEditorHtml(location, rules) {
  return `
    <section class="world-visit-editor">
      <div class="world-visit-editor-header">
        <div>
          <p class="eyebrow">World Visit Texts</p>
          <p class="field-help">Use this only for reusable world behavior. Case-specific content belongs in Case Editor → Visit rules.</p>
        </div>
        <button id="newWorldVisitRule" class="secondary-button inline-button" type="button">New visit text</button>
      </div>
      <div class="world-visit-rule-list">
        ${rules.length ? rules.map((rule, index) => buildWorldVisitRuleCardHtml(location, rule, index, rules.length)).join("") : `<p class="muted">No reusable world visit text yet.</p>`}
      </div>
    </section>
  `;
}

function buildWorldVisitRuleCardHtml(location, rule, index, total) {
  const visitTiming = getWorldVisitTiming(rule, location.id);
  const visitCount = getWorldVisitCountCondition(rule, location.id);
  const globalCount = getConditionFromGroup(rule, "all", "globalVisitCount");
  return `
    <fieldset class="world-rule-card" data-world-rule-index="${index}">
      <div class="world-rule-card-header">
        <strong>${escapeHtml(rule.title || `Visit text ${index + 1}`)}</strong>
        <div class="world-rule-actions">
          <button class="secondary-button inline-button" type="button" data-world-rule-action="up" ${index === 0 ? "disabled" : ""}>Up</button>
          <button class="secondary-button inline-button" type="button" data-world-rule-action="down" ${index === total - 1 ? "disabled" : ""}>Down</button>
          <button class="secondary-button inline-button" type="button" data-world-rule-action="duplicate">Duplicate</button>
          <button class="secondary-button inline-button" type="button" data-world-rule-action="delete">Delete</button>
        </div>
      </div>
      <div class="grid-2">
        <label class="field">
          <span>ID</span>
          <input name="worldRule_id_${index}" value="${escapeHtml(rule.id || "")}" />
        </label>
        <label class="field">
          <span>Title</span>
          <input name="worldRule_title_${index}" value="${escapeHtml(rule.title || "")}" />
        </label>
      </div>
      <div class="grid-2">
        <label class="field">
          <span>Priority</span>
          <input name="worldRule_priority_${index}" value="${escapeHtml(String(rule.priority ?? 100))}" />
        </label>
        <label class="field checkbox-field">
          <span>Repeatable</span>
          <input name="worldRule_repeatable_${index}" type="checkbox" ${rule.repeatable ? "checked" : ""} />
        </label>
      </div>
      <div class="grid-2">
        <label class="field">
          <span>Valid from date</span>
          <input name="worldRule_validFrom_${index}" type="date" value="${escapeHtml(rule.validFrom || "")}" />
        </label>
        <label class="field">
          <span>Valid to date</span>
          <input name="worldRule_validTo_${index}" type="date" value="${escapeHtml(rule.validTo || "")}" />
        </label>
      </div>
      <label class="field">
        <span>Text shown on visit</span>
        <textarea name="worldRule_text_${index}" rows="5">${escapeHtml(rule.text || "")}</textarea>
      </label>
      <div class="grid-2">
        <label class="field">
          <span>${fieldLabel("Visit timing", "Controls whether this reusable world text appears on the first visit, later visits, or any visit.")}</span>
          <select name="worldRule_visitTiming_${index}" data-editor-select>
            ${[
              ["any", "Any visit"],
              ["first", "First visit only"],
              ["repeat", "Repeat visit only"],
              ["custom", "Custom visit count"]
            ].map(([value, label]) => `<option value="${value}" ${visitTiming === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        <label class="field">
          <span>${fieldLabel("Custom visit count range", "Optional minimum and maximum visit counts for this exact place.")}</span>
          <div class="grid-2">
            <input name="worldRule_visitMin_${index}" placeholder="min" value="${escapeHtml(String(visitCount?.min ?? ""))}" />
            <input name="worldRule_visitMax_${index}" placeholder="max" value="${escapeHtml(String(visitCount?.max ?? ""))}" />
          </div>
        </label>
      </div>
      ${buildConditionSelect(`worldRule_visitedLocationIds_${index}`, "Requires visited locations", bootstrap.locations, getWorldConditionValues(rule, "all", "visitedLocationIds"), "name", "Only show this world text after these places have been visited.")}
      <div class="grid-2">
        <label class="field">
          <span>Total visit min</span>
          <input name="worldRule_globalMin_${index}" value="${escapeHtml(String(globalCount?.min ?? ""))}" />
        </label>
        <label class="field">
          <span>Total visit max</span>
          <input name="worldRule_globalMax_${index}" value="${escapeHtml(String(globalCount?.max ?? ""))}" />
        </label>
      </div>
      <label class="field">
        <span>Optional notebook note</span>
        <textarea name="worldRule_addNotebook_${index}" rows="3">${escapeHtml(rule.effects?.addNotebook || "")}</textarea>
      </label>
    </fieldset>
  `;
}

function bindWorldVisitRuleControls(location) {
  els.locationForm.querySelector("#newWorldVisitRule")?.addEventListener("click", () => {
    location.worldVisitRules = [...(location.worldVisitRules || []), createBlankWorldVisitRule(location)];
    renderLocationWorkspace();
  });
  els.locationForm.querySelectorAll("[data-world-rule-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.closest("[data-world-rule-index]")?.dataset.worldRuleIndex);
      const action = button.dataset.worldRuleAction;
      const rules = [...(location.worldVisitRules || [])];
      if (!Number.isInteger(index) || !rules[index]) return;
      if (action === "delete") rules.splice(index, 1);
      if (action === "duplicate") {
        const copy = structuredClone(rules[index]);
        copy.id = uniqueId(`${copy.id || "world_visit"}_copy`, new Set(rules.map((rule) => rule.id).filter(Boolean)));
        copy.title = `${copy.title || "Visit text"} Copy`;
        rules.splice(index + 1, 0, copy);
      }
      if (action === "up" && index > 0) [rules[index - 1], rules[index]] = [rules[index], rules[index - 1]];
      if (action === "down" && index < rules.length - 1) [rules[index], rules[index + 1]] = [rules[index + 1], rules[index]];
      location.worldVisitRules = rules.map((rule, ruleIndex) => ({ ...rule, priority: 1000 - (ruleIndex * 10) }));
      renderLocationWorkspace();
    });
  });
}

function createBlankWorldVisitRule(location) {
  const existingIds = new Set((location.worldVisitRules || []).map((rule) => rule.id).filter(Boolean));
  return {
    id: uniqueId(`${location.id}_visit`, existingIds),
    title: "New visit text",
    kind: "world",
    priority: 100,
    repeatable: false,
    text: "",
    conditions: { all: [], any: [], none: [] },
    effects: {}
  };
}

function bindLocationIdAutofill(location) {
  const idInput = els.locationForm.querySelector('[name="id"]');
  const nameInput = els.locationForm.querySelector('[name="name"]');
  if (!idInput || !nameInput || idInput.readOnly) return;
  let autoManaged = shouldAutofillLocationId(location, idInput.value);
  idInput.addEventListener("input", () => {
    autoManaged = false;
  });
  nameInput.addEventListener("input", () => {
    if (!autoManaged) return;
    idInput.value = uniqueLocationIdForName(nameInput.value, location.id);
  });
}

function shouldAutofillLocationId(location, currentId) {
  const id = String(currentId || "").trim();
  if (!id) return true;
  if (id === "new_location" || /^new_location_\d+$/.test(id)) return true;
  const currentNameSlug = slugifyIdentifier(location.name || "", "location");
  return id === currentNameSlug;
}

function uniqueLocationIdForName(name, currentId) {
  const existingIds = new Set((bootstrap.locations || [])
    .map((item) => item.id)
    .filter((id) => id && id !== currentId));
  return uniqueId(slugifyIdentifier(name, "location"), existingIds);
}

function parseWorldVisitRulesFromForm(locationId) {
  return [...els.locationForm.querySelectorAll("[data-world-rule-index]")]
    .map((card) => {
      const index = card.dataset.worldRuleIndex;
      const id = getFormFieldValue(`worldRule_id_${index}`);
      const title = getFormFieldValue(`worldRule_title_${index}`);
      const text = getFormFieldValue(`worldRule_text_${index}`);
      if (!id && !title && !text) return null;
      const conditions = buildWorldVisitRuleConditions(locationId, index);
      const addNotebook = getFormFieldValue(`worldRule_addNotebook_${index}`);
      return {
        id: id || uniqueId("world_visit", new Set()),
        title: title || "Visit text",
        kind: "world",
        priority: Number(getFormFieldValue(`worldRule_priority_${index}`) || 100),
        countsAsLead: false,
        repeatable: Boolean(els.locationForm.querySelector(`[name="worldRule_repeatable_${index}"]`)?.checked),
        validFrom: getFormFieldValue(`worldRule_validFrom_${index}`),
        validTo: getFormFieldValue(`worldRule_validTo_${index}`),
        text,
        conditions,
        effects: addNotebook ? { addNotebook } : {}
      };
    })
    .filter(Boolean);
}

function buildWorldVisitRuleConditions(locationId, index) {
  const all = [];
  const timing = getFormFieldValue(`worldRule_visitTiming_${index}`) || "any";
  if (timing === "first") {
    all.push({ type: "visitCountAtLocation", values: [locationId], min: null, max: 0 });
  } else if (timing === "repeat") {
    all.push({ type: "visitCountAtLocation", values: [locationId], min: 1, max: null });
  } else if (timing === "custom") {
    const min = parseOptionalNumber(getFormFieldValue(`worldRule_visitMin_${index}`));
    const max = parseOptionalNumber(getFormFieldValue(`worldRule_visitMax_${index}`));
    if (min !== null || max !== null) all.push({ type: "visitCountAtLocation", values: [locationId], min, max });
  }
  pushCondition(all, "visitedLocationIds", getSelectedValues(els.locationForm.querySelector(`[name="worldRule_visitedLocationIds_${index}"]`)));
  const globalMin = parseOptionalNumber(getFormFieldValue(`worldRule_globalMin_${index}`));
  const globalMax = parseOptionalNumber(getFormFieldValue(`worldRule_globalMax_${index}`));
  if (globalMin !== null || globalMax !== null) all.push({ type: "globalVisitCount", values: [], min: globalMin, max: globalMax });
  return { all, any: [], none: [] };
}

function getFormFieldValue(name) {
  return String(els.locationForm.querySelector(`[name="${name}"]`)?.value || "").trim();
}

function getWorldConditionValues(rule, groupName, type) {
  return (rule.conditions?.[groupName] || []).find((condition) => condition.type === type)?.values || [];
}

function getConditionFromGroup(rule, groupName, type) {
  return (rule.conditions?.[groupName] || []).find((condition) => condition.type === type) || null;
}

function getWorldVisitCountCondition(rule, locationId) {
  return (rule.conditions?.all || []).find((condition) =>
    condition.type === "visitCountAtLocation" &&
    condition.values?.[0] === locationId
  ) || null;
}

function getWorldVisitTiming(rule, locationId) {
  const condition = getWorldVisitCountCondition(rule, locationId);
  if (!condition) return "any";
  if ((condition.min === null || condition.min === undefined) && condition.max === 0) return "first";
  if (condition.min === 1 && (condition.max === null || condition.max === undefined)) return "repeat";
  return "custom";
}

function renderPeopleWorkspace() {
  const person = getSelectedPerson();
  els.personTitle.textContent = person?.name || "Select a person";
  if (!person) {
    els.personForm.innerHTML = `<p class="muted">No person selected.</p>`;
    return;
  }
  els.personForm.innerHTML = `
    <div class="grid-2">
      <label class="field">
        <span>${fieldLabel("ID", "Internal stable id used by cases and references.")}</span>
        <input name="id" value="${escapeHtml(person.id)}" />
      </label>
      <label class="field">
        <span>${fieldLabel("Kind", "The person category used by the case editor and theory pool.")}</span>
        <select name="kind" data-editor-select>
          ${PERSON_KINDS.map((value) => `<option value="${value}" ${person.kind === value ? "selected" : ""}>${escapeHtml(formatLabel(value))}</option>`).join("")}
        </select>
      </label>
    </div>
    <label class="field">
      <span>${fieldLabel("Name", "Display name shown in the case and editor.")}</span>
      <input name="name" value="${escapeHtml(person.name || "")}" />
    </label>
    <label class="field">
      <span>${fieldLabel("Aliases", "Alternate names that should match search or authoring lookup.")}</span>
      <textarea name="aliases">${escapeHtml((person.aliases || []).join("\n"))}</textarea>
    </label>
    <section class="editor-subsection">
      <p class="eyebrow">Life and places</p>
      ${buildLocationPickerHtml({
        id: "personResidencePicker",
        label: "Residence",
        mode: "single",
        selectedIds: person.residenceLocationId ? [person.residenceLocationId] : [],
        placeholder: "Search by address, place name, or type",
        help: "Use an address-forward private residence where possible."
      })}
      ${buildLocationPickerHtml({
        id: "personWorkPicker",
        label: "Work locations",
        mode: "multi",
        selectedIds: person.workLocationIds || [],
        placeholder: "Search and add work places",
        help: "Add one or more places. Search results are ranked; the full city list is not shown by default."
      })}
    </section>
    <label class="field">
      <span>${fieldLabel("Notes", "Authoring notes shown in editor lists. This is not player-facing prose.")}</span>
      <textarea name="notes">${escapeHtml(person.notes || "")}</textarea>
    </label>
    <label class="field">
      <span>${fieldLabel("Tags", "Minimal grouping tags for authoring. One per line.")}</span>
      <textarea name="tags">${escapeHtml((person.tags || []).join("\n"))}</textarea>
    </label>
    <div class="save-row">
      <button class="save-button" type="submit">Save person</button>
    </div>
  `;
  enhanceEditorSelects(els.personForm);
  els.personForm.onsubmit = async (event) => {
    event.preventDefault();
    setStatus(els.personStatus, "Saving...");
    const form = new FormData(els.personForm);
    const response = await fetch(`${EDITOR_API_BASE}/api/people/${encodeURIComponent(person.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        person: {
          id: form.get("id"),
          name: form.get("name"),
          kind: form.get("kind"),
          aliases: form.get("aliases"),
          residenceLocationId: getLocationPickerValue("personResidencePicker"),
          workLocationIds: getLocationPickerValues("personWorkPicker"),
          notes: form.get("notes"),
          tags: form.get("tags")
        }
      })
      });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `Save failed: ${response.status}`);
    await loadBootstrap();
    selectedPersonId = payload.person?.id || form.get("id") || person.id;
    await maybeReloadWorkspaceForReferences();
    setStatus(els.personStatus, "Saved");
    renderAll();
  };
  bindLocationPickers(els.personForm);
}

function buildLocationPickerHtml({ id, label, mode, selectedIds, placeholder, help }) {
  const selected = normalizeLocationPickerIds(selectedIds);
  return `
    <div id="${escapeHtml(id)}" class="location-picker" data-picker-mode="${escapeHtml(mode)}" data-selected-ids="${escapeHtml(JSON.stringify(selected))}">
      <div class="location-picker-label">
        <span>${escapeHtml(label)}</span>
        ${help ? `<span class="field-help">${escapeHtml(help)}</span>` : ""}
      </div>
      <div class="location-picker-selected" data-picker-selected>
        ${buildLocationPickerTokens(selected, mode)}
      </div>
      <div class="location-picker-search-row">
        <input data-picker-query type="search" placeholder="${escapeHtml(placeholder || "Search places")}" autocomplete="off" />
        ${mode === "single" ? `<button class="secondary-button inline-button" type="button" data-picker-clear>Clear</button>` : ""}
      </div>
      <div class="location-picker-results" data-picker-results hidden></div>
      <div class="editor-map-component is-compact">
        ${buildEditorMapOpacityControlHtml()}
        <div class="location-picker-map" data-picker-map></div>
      </div>
    </div>
  `;
}

function buildEditorMapOpacityControlHtml() {
  return `
    <label class="editor-map-opacity">
      <span>Historical</span>
      <input data-historical-opacity type="range" min="0" max="1" step="0.05" value="${escapeHtml(String(historicalOpacity))}" />
      <output data-historical-opacity-output>${escapeHtml(formatOpacityPercent(historicalOpacity))}</output>
    </label>
  `;
}

function bindLocationPickers(container) {
  container.querySelectorAll(".location-picker").forEach((picker) => {
    initLocationPickerMap(picker);
    const input = picker.querySelector("[data-picker-query]");
    input?.addEventListener("input", () => renderLocationPickerResults(picker));
    input?.addEventListener("focus", () => renderLocationPickerResults(picker));
    input?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      const first = picker.querySelector("[data-picker-option]");
      if (!first) return;
      event.preventDefault();
      selectLocationPickerOption(picker, first.dataset.pickerOption);
    });
    picker.querySelector("[data-picker-clear]")?.addEventListener("click", () => {
      setLocationPickerValues(picker, []);
      input.value = "";
      renderLocationPickerResults(picker);
    });
    picker.addEventListener("click", (event) => {
      const remove = event.target.closest("[data-picker-remove]");
      if (remove) {
        const next = getLocationPickerValuesFromElement(picker).filter((id) => id !== remove.dataset.pickerRemove);
        setLocationPickerValues(picker, next);
        renderLocationPickerResults(picker);
        return;
      }
      const option = event.target.closest("[data-picker-option]");
      if (option) {
        selectLocationPickerOption(picker, option.dataset.pickerOption);
      }
    });
  });
}

function selectLocationPickerOption(picker, locationId) {
  const mode = picker.dataset.pickerMode || "single";
  const input = picker.querySelector("[data-picker-query]");
  const current = getLocationPickerValuesFromElement(picker);
  const next = mode === "single"
    ? [locationId]
    : [...new Set([...current, locationId])];
  setLocationPickerValues(picker, next);
  if (input) input.value = "";
  renderLocationPickerResults(picker);
  input?.focus();
}

function renderLocationPickerResults(picker) {
  const query = picker.querySelector("[data-picker-query]")?.value || "";
  const results = buildLocationPickerResults(query, getLocationPickerValuesFromElement(picker));
  const resultsEl = picker.querySelector("[data-picker-results]");
  if (!resultsEl) return;
  if (!query.trim()) {
    resultsEl.hidden = true;
    resultsEl.innerHTML = "";
    return;
  }
  resultsEl.hidden = false;
  resultsEl.innerHTML = results.length
    ? results.map((location) => `
      <button class="location-picker-option" type="button" data-picker-option="${escapeHtml(location.id)}">
        <strong>${escapeHtml(location.name || "Untitled place")}</strong>
        <span>${escapeHtml([formatLabel(location.type), location.address].filter(Boolean).join(" · "))}</span>
        <small>${escapeHtml(location.sourceKind || "world")}</small>
      </button>
    `).join("")
    : `<p class="muted location-picker-empty">No matching places.</p>`;
}

function buildLocationPickerResults(query, selectedIds) {
  const term = String(query || "").trim().toLowerCase();
  if (!term) return [];
  const selected = new Set(selectedIds || []);
  return bootstrap.locations
    .filter((location) => !selected.has(location.id))
    .map((location) => ({ location, score: scoreLocationPickerResult(location, term) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.location.name.localeCompare(b.location.name))
    .slice(0, 12)
    .map((entry) => entry.location);
}

function scoreLocationPickerResult(location, term) {
  const fields = [
    location.name,
    location.address,
    location.type,
    ...(location.aliases || []),
    ...(location.tags || [])
  ].filter(Boolean).map((value) => String(value).toLowerCase());
  if (!fields.some((field) => field.includes(term))) return 0;
  let score = 10;
  if (fields.some((field) => field === term)) score += 100;
  if (fields.some((field) => field.startsWith(term))) score += 45;
  if (workspaceCase?.caseLocationIds?.includes(location.id)) score += 35;
  if (location.sourceKind === "authored") score += 20;
  if (location.sourceKind === "seed") score += 12;
  if (["private_residence", "lodging_house"].includes(location.type)) score += 8;
  return score;
}

function buildLocationPickerTokens(selectedIds, mode) {
  const ids = normalizeLocationPickerIds(selectedIds);
  if (!ids.length) return `<p class="muted location-picker-empty">${mode === "single" ? "No residence selected." : "No work locations selected."}</p>`;
  return ids.map((id) => {
    const location = findLocation(id);
    return `
      <span class="location-token" data-location-token="${escapeHtml(id)}">
        <span>
          <strong>${escapeHtml(location?.name || id)}</strong>
          <small>${escapeHtml([location ? formatLabel(location.type) : "", location?.address || ""].filter(Boolean).join(" · "))}</small>
        </span>
        <button type="button" data-picker-remove="${escapeHtml(id)}" aria-label="Remove ${escapeHtml(location?.name || id)}">×</button>
      </span>
    `;
  }).join("");
}

function setLocationPickerValues(picker, ids) {
  const mode = picker.dataset.pickerMode || "single";
  const next = normalizeLocationPickerIds(ids);
  picker.dataset.selectedIds = JSON.stringify(mode === "single" ? next.slice(0, 1) : next);
  const selectedEl = picker.querySelector("[data-picker-selected]");
  if (selectedEl) selectedEl.innerHTML = buildLocationPickerTokens(getLocationPickerValuesFromElement(picker), mode);
  syncLocationPickerMap(picker);
}

function getLocationPickerValue(id) {
  return getLocationPickerValues(id)[0] || "";
}

function getLocationPickerValues(id) {
  const picker = document.querySelector(`#${CSS.escape(id)}`);
  return picker ? getLocationPickerValuesFromElement(picker) : [];
}

function getLocationPickerValuesFromElement(picker) {
  try {
    return normalizeLocationPickerIds(JSON.parse(picker.dataset.selectedIds || "[]"));
  } catch {
    return [];
  }
}

function normalizeLocationPickerIds(ids) {
  return [...new Set((ids || []).map((id) => String(id || "").trim()).filter(Boolean))];
}

function initLocationPickerMap(picker) {
  if (!window.maplibregl) return;
  const container = picker.querySelector("[data-picker-map]");
  if (!container) return;
  const id = picker.id;
  locationPickerMaps.get(id)?.map?.remove?.();
  const view = createEditorMapView(container, { draggable: false });
  locationPickerMaps.set(id, view);
  view.map.on("load", () => {
    syncEditorMapLayerVisibility();
    syncLocationPickerMap(picker);
  });
  window.setTimeout(() => {
    view.map.resize();
    syncLocationPickerMap(picker);
  }, 0);
}

function syncLocationPickerMap(picker) {
  const view = locationPickerMaps.get(picker.id);
  if (!view?.map) return;
  const selectedLocations = getLocationPickerValuesFromElement(picker)
    .map((id) => findLocation(id))
    .filter((location) => location?.coordinates);
  const location = selectedLocations[0] || null;
  const center = location?.coordinates ? [location.coordinates.lng, location.coordinates.lat] : [-0.1246, 51.5079];
  view.marker?.setLngLat(center);
  view.map.resize();
  view.map.flyTo({ center, zoom: location ? 15 : 12.6 });
}

function renderBriefingForm() {
  const preview = renderBriefingMarkup(workspaceCase.intro || "");
  els.briefingForm.innerHTML = `
    <div class="grid-2">
      <label class="field">
        <span>Case ID</span>
        <input name="id" value="${escapeHtml(workspaceCase.id)}" readonly />
      </label>
      <label class="field">
        <span>Status</span>
        <input name="status" value="${escapeHtml(workspaceCase.status || "draft")}" />
      </label>
    </div>
    <div class="grid-2">
      <label class="field">
        <span>Title</span>
        <input name="title" value="${escapeHtml(workspaceCase.title || "")}" />
      </label>
      <label class="field">
        <span>Date</span>
        <input name="date" value="${escapeHtml(workspaceCase.date || "")}" />
      </label>
    </div>
    <label class="field">
      <span>Summary</span>
      <textarea name="summary">${escapeHtml(workspaceCase.summary || "")}</textarea>
    </label>
    <div class="grid-2">
      <label class="field">
        <span>Insert location link</span>
        <select id="briefingLocationLink">
          ${buildSelectOptions(getCaseLocations(), "", true)}
        </select>
      </label>
      <label class="field">
        <span>Insert person link</span>
        <select id="briefingPersonLink">
          ${buildSelectOptions(getCasePeople(), "", true)}
        </select>
      </label>
    </div>
    <div class="tab-actions">
      <button id="insertLocationLink" class="secondary-button inline-button" type="button">Insert location link</button>
      <button id="insertPersonLink" class="secondary-button inline-button" type="button">Insert person link</button>
    </div>
    <label class="field">
      <span>Briefing</span>
      <textarea id="introField" name="intro" rows="12">${escapeHtml(workspaceCase.intro || "")}</textarea>
    </label>
    <div class="preview-card">
      <p class="eyebrow">Preview</p>
      <div class="prose">${preview}</div>
    </div>
    <div class="save-row">
      <button class="save-button" type="submit">Save briefing</button>
    </div>
  `;
  els.briefingForm.querySelector("#insertLocationLink").addEventListener("click", () => {
    const select = els.briefingForm.querySelector("#briefingLocationLink");
    const location = findLocation(select.value);
    if (location) insertIntoTextarea(els.briefingForm.querySelector("#introField"), `[${location.name}](place:${location.id})`);
  });
  els.briefingForm.querySelector("#insertPersonLink").addEventListener("click", () => {
    const select = els.briefingForm.querySelector("#briefingPersonLink");
    const person = findPerson(select.value);
    if (person) insertIntoTextarea(els.briefingForm.querySelector("#introField"), `[${person.name}](person:${person.id})`);
  });
  els.briefingForm.onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(els.briefingForm);
    workspaceCase = {
      ...workspaceCase,
      title: form.get("title"),
      date: form.get("date"),
      status: form.get("status"),
      summary: form.get("summary"),
      intro: form.get("intro")
    };
    await saveCase("Briefing saved");
  };
}

function renderTheoryEditor() {
  const slots = new Set(workspaceCase.theorySlots || []);
  const whyOptions = workspaceCase.theoryOptions?.why || [];
  const howOptions = workspaceCase.theoryOptions?.how || [];
  const solutionQuestions = workspaceCase.solutionQuestions || [];
  els.theoryFormEditor.innerHTML = `
    <label class="field">
      <span>Case people</span>
      <select name="casePeopleIds" multiple size="10">
        ${buildSelectOptions(bootstrap.people, workspaceCase.casePeopleIds || [], false, true)}
      </select>
    </label>
    <fieldset class="field">
      <span>Theory slots</span>
      <div class="checkbox-grid">
        ${THEORY_SLOT_OPTIONS.map((slot) => `
          <label class="field checkbox-field">
            <span>${escapeHtml(formatLabel(slot))}</span>
            <input type="checkbox" name="theorySlots" value="${slot}" ${slots.has(slot) ? "checked" : ""} />
          </label>
        `).join("")}
      </div>
    </fieldset>
    <div class="grid-2">
      <label class="field">
        <span>Why options</span>
        <textarea name="whyOptions">${escapeHtml(whyOptions.join("\n"))}</textarea>
      </label>
      <label class="field">
        <span>How options</span>
        <textarea name="howOptions">${escapeHtml(howOptions.join("\n"))}</textarea>
      </label>
    </div>
    <div class="grid-2">
      <label class="field">
        <span>Solution who</span>
        <select name="solutionWho">${buildSelectOptions(getCasePeople(), workspaceCase.solution?.who || "", true)}</select>
      </label>
      <label class="field">
        <span>Solution where</span>
        <select name="solutionWhere">${buildSelectOptions(getCaseLocations(), workspaceCase.solution?.where || "", true)}</select>
      </label>
    </div>
    <div class="grid-2">
      <label class="field">
        <span>Solution why</span>
        <select name="solutionWhy">
          <option value="">Select…</option>
          ${whyOptions.map((value) => `<option value="${escapeHtml(value)}" ${workspaceCase.solution?.why === value ? "selected" : ""}>${escapeHtml(formatLabel(value))}</option>`).join("")}
        </select>
      </label>
      <label class="field">
        <span>Solution how</span>
        <select name="solutionHow">
          <option value="">Select…</option>
          ${howOptions.map((value) => `<option value="${escapeHtml(value)}" ${workspaceCase.solution?.how === value ? "selected" : ""}>${escapeHtml(formatLabel(value))}</option>`).join("")}
        </select>
      </label>
    </div>
    <label class="field">
      <span>Solution explanation</span>
      <textarea name="solutionExplanation">${escapeHtml(workspaceCase.solution?.explanation || "")}</textarea>
    </label>
    <label class="field">
      <span>Solution questions</span>
      <textarea name="solutionQuestions" rows="10" placeholder="question_id | Prompt text | Model answer">${escapeHtml(solutionQuestions.map((item) => `${item.id} | ${item.prompt} | ${item.modelAnswer || ""}`).join("\n"))}</textarea>
    </label>
    <div class="save-row">
      <button class="save-button" type="submit">Save theory</button>
    </div>
  `;
  els.theoryFormEditor.onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(els.theoryFormEditor);
    workspaceCase = {
      ...workspaceCase,
      casePeopleIds: getSelectedValues(els.theoryFormEditor.querySelector('[name="casePeopleIds"]')),
      theorySlots: getCheckedValues(els.theoryFormEditor, 'input[name="theorySlots"]'),
      theoryOptions: {
        why: splitLines(form.get("whyOptions")),
        how: splitLines(form.get("howOptions"))
      },
      solution: {
        ...workspaceCase.solution,
        who: String(form.get("solutionWho") || ""),
        where: String(form.get("solutionWhere") || ""),
        why: String(form.get("solutionWhy") || ""),
        how: String(form.get("solutionHow") || ""),
        explanation: String(form.get("solutionExplanation") || "")
      },
      solutionQuestions: parseSolutionQuestions(form.get("solutionQuestions"))
    };
    await saveCase("Theory saved");
  };
}

function renderCaseLocationsPanel() {
  const caseLocations = getCaseLocations();
  const selected = findLocation(selectedCaseLocationId) || caseLocations[0] || null;
  selectedCaseLocationId = selected?.id || null;
  els.caseLocationPicker.innerHTML = buildSelectOptions(bootstrap.locations, "", true);
  els.caseLocationList.innerHTML = caseLocations.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === selectedCaseLocationId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
  els.caseLocationList.onchange = () => {
    selectedCaseLocationId = els.caseLocationList.value;
    selectedLocationId = selectedCaseLocationId;
    renderCaseLocationsPanel();
    renderLocationList();
    syncCaseLocationMap();
  };
  if (!selected) {
    els.caseLocationRoleForm.innerHTML = `<p class="muted">No case location selected.</p>`;
    return;
  }
  const roles = new Set(workspaceCase.caseLocationRoles?.[selected.id] || []);
  const starting = (workspaceCase.startingLocationIds || []).includes(selected.id);
  els.caseLocationRoleForm.innerHTML = `
    <fieldset class="field">
      <span>${escapeHtml(selected.name)}</span>
      <div class="checkbox-grid">
        ${CASE_ROLES.map((role) => `
          <label class="field checkbox-field">
            <span>${escapeHtml(formatLabel(role))}</span>
            <input type="checkbox" name="role" value="${role}" ${roles.has(role) ? "checked" : ""} />
          </label>
        `).join("")}
        <label class="field checkbox-field">
          <span>Starting location</span>
          <input type="checkbox" name="startingLocation" ${starting ? "checked" : ""} />
        </label>
      </div>
    </fieldset>
    <div class="save-row">
      <button class="save-button" type="submit">Save case location</button>
    </div>
  `;
  els.caseLocationRoleForm.onsubmit = async (event) => {
    event.preventDefault();
    const rolesNext = getCheckedValues(els.caseLocationRoleForm, 'input[name="role"]');
    workspaceCase.caseLocationRoles = {
      ...(workspaceCase.caseLocationRoles || {}),
      [selected.id]: rolesNext
    };
    workspaceCase.hiddenLocationIds = dedupeStrings(Object.entries(workspaceCase.caseLocationRoles)
      .filter(([, roleList]) => (roleList || []).includes("hidden"))
      .map(([locationId]) => locationId));
    workspaceCase.startingLocationIds = toggleInList(
      workspaceCase.startingLocationIds || [],
      selected.id,
      els.caseLocationRoleForm.querySelector('[name="startingLocation"]').checked
    );
    await saveCase("Case locations saved");
  };
  syncCaseLocationMap();
}

function renderVisitRulesPanel() {
  const caseLocations = getCaseLocations();
  const selectedFilter = selectedCaseLocationId || caseLocations[0]?.id || "";
  selectedCaseLocationId = selectedFilter;
  els.ruleLocationFilter.innerHTML = buildSelectOptions(caseLocations, selectedFilter, true);
  els.ruleLocationFilter.onchange = () => {
    selectedCaseLocationId = els.ruleLocationFilter.value;
    selectedRuleId = getRulesForSelectedLocation()[0]?.id || null;
    renderVisitRulesPanel();
  };
  const rules = getRulesForSelectedLocation();
  if (!selectedRuleId && rules[0]) selectedRuleId = rules[0].id;
  els.ruleList.innerHTML = rules.map((rule) => `<option value="${escapeHtml(rule.id)}" ${rule.id === selectedRuleId ? "selected" : ""}>${escapeHtml(formatRuleOptionLabel(rule))}</option>`).join("");
  els.ruleList.onchange = () => {
    selectedRuleId = els.ruleList.value;
    renderVisitRulesPanel();
  };
  const rule = rules.find((item) => item.id === selectedRuleId) || null;
  if (!rule) {
    els.ruleForm.innerHTML = `<p class="muted">No rule selected for this location.</p>`;
    return;
  }
  els.ruleForm.innerHTML = buildRuleFormHtml(rule);
  els.ruleForm.onsubmit = async (event) => {
    event.preventDefault();
    await saveRuleFromForm(rule.id);
  };
}

function renderNewspaperPanel() {
  if (!workspaceIssue) return;
  els.issueForm.innerHTML = `
    <div class="grid-2">
      <label class="field">
        <span>Issue title</span>
        <input name="title" value="${escapeHtml(workspaceIssue.title || "")}" />
      </label>
      <label class="field">
        <span>Issue date</span>
        <input name="date" value="${escapeHtml(workspaceIssue.date || "")}" />
      </label>
    </div>
    <div class="save-row">
      <button class="save-button" type="submit">Save issue</button>
    </div>
  `;
  els.issueForm.onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(els.issueForm);
    workspaceIssue.title = String(form.get("title") || "");
    workspaceIssue.date = String(form.get("date") || "");
    await saveIssue("Issue saved");
  };
  const items = workspaceIssue.items || [];
  if (!selectedArticleId && items[0]) selectedArticleId = items[0].id;
  els.articleList.innerHTML = items.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === selectedArticleId ? "selected" : ""}>${escapeHtml(item.headline || "Untitled")}</option>`).join("");
  els.articleList.onchange = () => {
    selectedArticleId = els.articleList.value;
    renderNewspaperPanel();
  };
  const item = items.find((entry) => entry.id === selectedArticleId) || null;
  els.articleTitle.textContent = item?.headline || "Articles";
  if (!item) {
    els.articleForm.innerHTML = `<p class="muted">No article selected.</p>`;
    els.articlePreview.innerHTML = `<p class="muted">Nothing to preview.</p>`;
    return;
  }
  els.articleForm.innerHTML = buildArticleFormHtml(item);
  bindArticleLivePreview();
  els.articleForm.onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(els.articleForm);
    Object.assign(item, {
      id: String(form.get("id") || item.id),
      type: String(form.get("type") || "news"),
      headline: String(form.get("headline") || ""),
      body: String(form.get("body") || ""),
      format: {
        headlineMode: String(form.get("headlineMode") || "standard"),
        underlineHeadline: form.get("underlineHeadline") === "on",
        dropCap: form.get("dropCap") === "on",
        indentFirstParagraph: form.get("indentFirstParagraph") === "on"
      },
      tags: splitLines(form.get("tags")),
      linkedLocationIds: getSelectedValues(els.articleForm.querySelector('[name="linkedLocationIds"]')),
      linkedPersonIds: getSelectedValues(els.articleForm.querySelector('[name="linkedPersonIds"]')),
      isDirectClue: form.get("isDirectClue") === "on"
    });
    await saveIssue("Article saved");
  };
}

function buildRuleFormHtml(rule) {
  const otherRules = getAllCaseRulesSorted().filter((item) => item.id !== rule.id);
  const caseLocations = getCaseLocations();
  const conditionSummary = summarizeRuleConditions(rule);
  return `
    <div class="grid-2">
      <label class="field">
        <span>Title</span>
        <input name="title" value="${escapeHtml(rule.title || "")}" />
      </label>
      <label class="field">
        <span>Kind</span>
        <select name="kind">${RULE_KINDS.map((kind) => `<option value="${kind}" ${rule.kind === kind ? "selected" : ""}>${escapeHtml(formatLabel(kind))}</option>`).join("")}</select>
      </label>
    </div>
    <div class="grid-2">
      <label class="field">
        <span>Priority</span>
        <input name="priority" value="${escapeHtml(String(rule.priority ?? 100))}" />
      </label>
      <label class="field checkbox-field">
        <span>Counts as lead</span>
        <input name="countsAsLead" type="checkbox" ${rule.countsAsLead ? "checked" : ""} />
      </label>
    </div>
    <label class="field checkbox-field">
      <span>Repeatable</span>
      <input name="repeatable" type="checkbox" ${rule.repeatable ? "checked" : ""} />
    </label>
    <label class="field">
      <span>Text</span>
      <textarea name="text" rows="8">${escapeHtml(rule.text || "")}</textarea>
    </label>
    <fieldset class="field condition-builder">
      <span>Condition summary</span>
      <p class="field-help">${escapeHtml(conditionSummary || "No prerequisites. This rule can fire whenever its location is visited.")}</p>
    </fieldset>
    <fieldset class="field">
      <span>Required conditions — all must match</span>
      <p class="field-help">Use this for normal prerequisite chains, such as “laboratory lead resolved before railway office responds”.</p>
      ${buildConditionSelect("allResolvedRuleIds", "Resolved rules", otherRules, getConditionValues(rule, "all", "resolvedRuleIds"), "ruleLabel")}
      ${buildConditionSelect("allVisitedLocationIds", "Visited locations", caseLocations, getConditionValues(rule, "all", "visitedLocationIds"), "name")}
    </fieldset>
    <fieldset class="field">
      <span>Optional conditions — any may match</span>
      <p class="field-help">Use this for alternate paths where several clues can unlock the same response.</p>
      ${buildConditionSelect("anyResolvedRuleIds", "Resolved rules", otherRules, getConditionValues(rule, "any", "resolvedRuleIds"), "ruleLabel")}
      ${buildConditionSelect("anyVisitedLocationIds", "Visited locations", caseLocations, getConditionValues(rule, "any", "visitedLocationIds"), "name")}
    </fieldset>
    <fieldset class="field">
      <span>Blocking conditions — none may match</span>
      <p class="field-help">Use this for first-visit variants or branches that should stop after another rule resolves.</p>
      ${buildConditionSelect("noneResolvedRuleIds", "Resolved rules", otherRules, getConditionValues(rule, "none", "resolvedRuleIds"), "ruleLabel")}
      ${buildConditionSelect("noneVisitedLocationIds", "Visited locations", caseLocations, getConditionValues(rule, "none", "visitedLocationIds"), "name")}
    </fieldset>
    <div class="grid-2">
      <label class="field">
        <span>Visit count location</span>
        <select name="visitCountLocationId">${buildSelectOptions(caseLocations, getCountCondition(rule, "visitCountAtLocation")?.values?.[0] || "", true)}</select>
      </label>
      <label class="field">
        <span>Visit count range</span>
        <div class="grid-2">
          <input name="visitCountMin" placeholder="min" value="${escapeHtml(String(getCountCondition(rule, "visitCountAtLocation")?.min ?? ""))}" />
          <input name="visitCountMax" placeholder="max" value="${escapeHtml(String(getCountCondition(rule, "visitCountAtLocation")?.max ?? ""))}" />
        </div>
      </label>
    </div>
    <div class="grid-2">
      <label class="field">
        <span>Global visit min</span>
        <input name="globalVisitCountMin" value="${escapeHtml(String(getCountCondition(rule, "globalVisitCount")?.min ?? ""))}" />
      </label>
      <label class="field">
        <span>Global visit max</span>
        <input name="globalVisitCountMax" value="${escapeHtml(String(getCountCondition(rule, "globalVisitCount")?.max ?? ""))}" />
      </label>
    </div>
    <fieldset class="field">
      <span>Effects</span>
      <p class="field-help">Effects reveal places and add notebook notes. They do not create inventory.</p>
      ${buildConditionSelect("revealLocationIds", "Reveal locations", caseLocations, rule.effects?.revealLocationIds || [], "name")}
      <label class="field">
        <span>Add notebook entry</span>
        <textarea name="addNotebook">${escapeHtml(rule.effects?.addNotebook || "")}</textarea>
      </label>
    </fieldset>
    <div class="save-row">
      <button class="save-button" type="submit">Save rule</button>
    </div>
  `;
}

function buildArticleFormHtml(item) {
  return `
    <div class="grid-2">
      <label class="field">
        <span>ID</span>
        <input name="id" value="${escapeHtml(item.id || "")}" />
      </label>
      <label class="field">
        <span>Type</span>
        <select name="type">${ARTICLE_TYPES.map((value) => `<option value="${value}" ${item.type === value ? "selected" : ""}>${escapeHtml(formatArticleType(value))}</option>`).join("")}</select>
      </label>
    </div>
    <label class="field">
      <span>Headline</span>
      <input name="headline" value="${escapeHtml(item.headline || "")}" />
    </label>
    <fieldset class="field">
      <span>Formatting</span>
      <div class="grid-2">
        <label class="field">
          <span>Headline style</span>
          <select name="headlineMode">
            ${["standard", "inline", "hidden"].map((value) => `<option value="${value}" ${getArticleHeadlineMode(item) === value ? "selected" : ""}>${escapeHtml(formatLabel(value))}</option>`).join("")}
          </select>
        </label>
        <label class="field checkbox-field">
          <span>Underline headline</span>
          <input name="underlineHeadline" type="checkbox" ${item.format?.underlineHeadline ? "checked" : ""} />
        </label>
      </div>
      <div class="grid-2">
        <label class="field checkbox-field">
          <span>Drop cap</span>
          <input name="dropCap" type="checkbox" ${usesDropCapPreview(item) ? "checked" : ""} />
        </label>
        <label class="field checkbox-field">
          <span>Indent first paragraph</span>
          <input name="indentFirstParagraph" type="checkbox" ${shouldIndentFirstParagraphPreview(item) ? "checked" : ""} />
        </label>
      </div>
    </fieldset>
    <label class="field">
      <span>Body</span>
      <textarea name="body" class="article-body-input">${escapeHtml(item.body || "")}</textarea>
    </label>
    <label class="field">
      <span>Tags</span>
      <textarea name="tags">${escapeHtml((item.tags || []).join("\n"))}</textarea>
    </label>
    ${buildConditionSelect("linkedLocationIds", "Linked locations", getCaseLocations(), item.linkedLocationIds || [], "name")}
    ${buildConditionSelect("linkedPersonIds", "Linked people", getCasePeople(), item.linkedPersonIds || [], "name")}
    <label class="field checkbox-field">
      <span>Direct clue</span>
      <input name="isDirectClue" type="checkbox" ${item.isDirectClue ? "checked" : ""} />
    </label>
    <div class="save-row">
      <button class="save-button" type="submit">Save article</button>
    </div>
  `;
}

function bindArticleLivePreview() {
  els.articleForm.addEventListener("input", updateArticlePreviewFromForm);
  updateArticlePreviewFromForm();
}

function updateArticlePreviewFromForm() {
  const form = new FormData(els.articleForm);
  const previewItem = {
    id: form.get("id"),
    type: form.get("type"),
    headline: form.get("headline"),
    body: form.get("body"),
    format: {
      headlineMode: form.get("headlineMode"),
      underlineHeadline: form.get("underlineHeadline") === "on",
      dropCap: form.get("dropCap") === "on",
      indentFirstParagraph: form.get("indentFirstParagraph") === "on"
    },
    isDirectClue: form.get("isDirectClue") === "on"
  };
  els.articlePreview.innerHTML = buildArticlePreviewHtml(previewItem);
}

async function saveCase(statusText) {
  setStatus(els.workspaceStatus, "Saving...");
  const response = await fetch(`${EDITOR_API_BASE}/api/cases/${encodeURIComponent(workspaceCase.id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caseData: workspaceCase })
  });
  const payload = await response.json();
  workspaceCase = payload.caseData;
  workspaceIssue = payload.issue;
  await loadBootstrap();
  setStatus(els.workspaceStatus, statusText);
  renderAll();
}

async function saveIssue(statusText) {
  setStatus(els.workspaceStatus, "Saving...");
  const response = await fetch(`${EDITOR_API_BASE}/api/cases/${encodeURIComponent(workspaceCase.id)}/newspaper`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ issue: workspaceIssue })
  });
  const payload = await response.json();
  workspaceCase = payload.caseData;
  workspaceIssue = payload.issue;
  await loadBootstrap();
  setStatus(els.workspaceStatus, statusText);
  renderAll();
}

async function createCase() {
  const title = window.prompt("Case title", "New Case");
  if (!title) return;
  const response = await fetch(`${EDITOR_API_BASE}/api/cases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title })
  });
  const payload = await response.json();
  await loadBootstrap();
  workspaceCase = payload.caseData;
  workspaceIssue = payload.issue;
  bootstrap.currentCaseId = workspaceCase.id;
  activeSidebarTab = "cases";
  renderAll();
}

async function duplicateCase() {
  if (!workspaceCase) return;
  const response = await fetch(`${EDITOR_API_BASE}/api/cases/${encodeURIComponent(workspaceCase.id)}/duplicate`, { method: "POST" });
  const payload = await response.json();
  await loadBootstrap();
  workspaceCase = payload.caseData;
  workspaceIssue = payload.issue;
  bootstrap.currentCaseId = workspaceCase.id;
  renderAll();
}

async function deleteCase() {
  if (!workspaceCase) return;
  const confirmed = await confirmInEditor({
    title: "Delete case",
    message: `Delete "${workspaceCase.title}"? This removes the case file and cannot be undone from the editor.`,
    confirmLabel: "Delete"
  });
  if (!confirmed) return;
  await fetch(`${EDITOR_API_BASE}/api/cases/${encodeURIComponent(workspaceCase.id)}`, { method: "DELETE" });
  await loadBootstrap();
  await loadWorkspace(bootstrap.cases[0]?.id || null);
  renderAll();
}

async function createLocation(seed = {}) {
  const response = await fetch(`${EDITOR_API_BASE}/api/locations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: {
        name: "New Location",
        type: "other",
        visibility: "public",
        searchPreviewText: "",
        defaultVisitText: "",
        ...seed
      }
    })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Create failed: ${response.status}`);
  await loadBootstrap();
  selectedLocationId = payload.id;
  activeSidebarTab = "locations";
  renderAll();
}

async function deleteLocation() {
  const location = getSelectedLocation();
  if (!location) return;
  const confirmed = await confirmInEditor({
    title: "Delete location",
    message: `Delete "${location.name}"? If it is referenced by a case or person, the editor will block the delete and show the references.`,
    confirmLabel: "Delete"
  });
  if (!confirmed) return;
  const response = await fetch(`${EDITOR_API_BASE}/api/locations/${encodeURIComponent(location.id)}`, { method: "DELETE" });
  const payload = await response.json();
  if (!response.ok) return handleReferenceError(payload, els.locationStatus);
  await loadBootstrap();
  await maybeReloadWorkspaceForReferences();
  selectedLocationId = bootstrap.locations[0]?.id || null;
  setStatus(els.locationStatus, payload.mode === "retired" ? "Retired" : "Deleted");
  renderAll();
}

async function createPerson() {
  const response = await fetch(`${EDITOR_API_BASE}/api/people`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ person: { name: "New Person", kind: "resident" } })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Create failed: ${response.status}`);
  await loadBootstrap();
  selectedPersonId = payload.person.id;
  activeSidebarTab = "people";
  renderAll();
}

async function deletePerson() {
  const person = getSelectedPerson();
  if (!person) return;
  const confirmed = await confirmInEditor({
    title: "Delete person",
    message: `Delete "${person.name}"? If they are referenced by a case, the editor will block the delete and show the references.`,
    confirmLabel: "Delete"
  });
  if (!confirmed) return;
  const response = await fetch(`${EDITOR_API_BASE}/api/people/${encodeURIComponent(person.id)}`, { method: "DELETE" });
  const payload = await response.json();
  if (!response.ok) return handleReferenceError(payload, els.personStatus);
  await loadBootstrap();
  await maybeReloadWorkspaceForReferences();
  selectedPersonId = bootstrap.people[0]?.id || null;
  setStatus(els.personStatus, "Deleted");
  renderAll();
}

async function deleteSelectedCases() {
  const ids = [...sidebarSelections.cases];
  if (!ids.length) return;
  const confirmed = await confirmInEditor({
    title: "Delete selected cases",
    message: `Delete ${ids.length} selected case${ids.length === 1 ? "" : "s"}? This removes case files and cannot be undone from the editor.`,
    confirmLabel: "Delete selected"
  });
  if (!confirmed) return;
  const failures = [];
  for (const id of ids) {
    const response = await fetch(`${EDITOR_API_BASE}/api/cases/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) failures.push(id);
  }
  sidebarSelections.cases.clear();
  await loadBootstrap();
  await loadWorkspace(bootstrap.cases[0]?.id || null);
  setStatus(els.workspaceStatus, failures.length ? `Deleted ${ids.length - failures.length}; ${failures.length} failed` : `Deleted ${ids.length}`);
  renderAll();
}

async function deleteSelectedRecords(kind) {
  const ids = [...sidebarSelections[kind]];
  if (!ids.length) return;
  const label = kind === "people" ? "people" : "locations";
  const confirmed = await confirmInEditor({
    title: `Delete selected ${label}`,
    message: `Delete ${ids.length} selected ${label}? Referenced records will be blocked and reported.`,
    confirmLabel: "Delete selected"
  });
  if (!confirmed) return;

  const failures = [];
  for (const id of ids) {
    const response = await fetch(`${EDITOR_API_BASE}/api/${kind}/${encodeURIComponent(id)}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) failures.push({ id, payload });
  }

  sidebarSelections[kind].clear();
  await loadBootstrap();
  await maybeReloadWorkspaceForReferences();
  if (kind === "locations") selectedLocationId = bootstrap.locations.find((item) => item.id === selectedLocationId)?.id || bootstrap.locations[0]?.id || null;
  if (kind === "people") selectedPersonId = bootstrap.people.find((item) => item.id === selectedPersonId)?.id || bootstrap.people[0]?.id || null;
  const statusElement = kind === "people" ? els.personStatus : els.locationStatus;
  setStatus(statusElement, failures.length ? `Deleted ${ids.length - failures.length}; ${failures.length} blocked` : `Deleted ${ids.length}`);
  if (failures.length) showEditorMessage({
    title: "Some records were blocked",
    message: failures.map(({ id, payload }) => `${id}: ${formatReferenceSummary(payload)}`).join("\n")
  });
  renderAll();
}

function exportSelectedSidebarItems(kind, format) {
  const ids = sidebarSelections[kind];
  if (!ids.size) return;
  const payload = buildExportPayload(kind, format, ids);
  triggerDownload(buildExportFilename(`${kind}-selected`, format), payload, format === "json" ? "application/json" : "text/csv;charset=utf-8");
  setStatus(getStatusElementForKind(kind), `Exported ${ids.size} selected`);
}

async function addCaseLocation() {
  const locationId = els.caseLocationPicker.value;
  if (!locationId) return;
  if (!workspaceCase.caseLocationIds.includes(locationId)) workspaceCase.caseLocationIds.push(locationId);
  workspaceCase.caseLocationRoles[locationId] = workspaceCase.caseLocationRoles[locationId] || ["ambient"];
  selectedCaseLocationId = locationId;
  await saveCase("Case location added");
}

async function removeCaseLocation() {
  if (!selectedCaseLocationId) return;
  workspaceCase.caseLocationIds = workspaceCase.caseLocationIds.filter((id) => id !== selectedCaseLocationId);
  delete workspaceCase.caseLocationRoles[selectedCaseLocationId];
  workspaceCase.startingLocationIds = (workspaceCase.startingLocationIds || []).filter((id) => id !== selectedCaseLocationId);
  workspaceCase.hiddenLocationIds = (workspaceCase.hiddenLocationIds || []).filter((id) => id !== selectedCaseLocationId);
  workspaceCase.visitRules = (workspaceCase.visitRules || []).filter((rule) => rule.locationId !== selectedCaseLocationId);
  selectedCaseLocationId = workspaceCase.caseLocationIds[0] || null;
  await saveCase("Case location removed");
}

async function createRule() {
  if (!selectedCaseLocationId) return;
  workspaceCase.visitRules.push({
    id: uniqueId("rule", new Set(workspaceCase.visitRules.map((item) => item.id))),
    locationId: selectedCaseLocationId,
    title: "New rule",
    kind: "lead",
    priority: 100,
    countsAsLead: false,
    repeatable: false,
    text: "",
    conditions: { all: [], any: [], none: [] },
    effects: { revealLocationIds: [], addNotebook: "" }
  });
  selectedRuleId = workspaceCase.visitRules.at(-1).id;
  await saveCase("Rule created");
}

async function duplicateRule() {
  const rule = getSelectedRule();
  if (!rule) return;
  const copy = structuredClone(rule);
  copy.id = uniqueId(`${rule.id}_copy`, new Set(workspaceCase.visitRules.map((item) => item.id)));
  copy.title = `${rule.title} Copy`;
  workspaceCase.visitRules.push(copy);
  selectedRuleId = copy.id;
  await saveCase("Rule duplicated");
}

async function deleteRule() {
  const rule = getSelectedRule();
  if (!rule) return;
  workspaceCase.visitRules = workspaceCase.visitRules.filter((item) => item.id !== rule.id);
  selectedRuleId = getRulesForSelectedLocation()[0]?.id || null;
  await saveCase("Rule deleted");
}

async function moveSelectedRule(direction) {
  const selected = getSelectedRule();
  if (!selected) return;
  const rules = getRulesForSelectedLocation();
  const index = rules.findIndex((rule) => rule.id === selected.id);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= rules.length) return;

  const reordered = [...rules];
  [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
  applyRuleOrder(reordered);
  await saveCase(direction < 0 ? "Rule moved up" : "Rule moved down");
}

function applyRuleOrder(orderedRules) {
  const priorityBase = 1000;
  const priorityStep = 10;
  orderedRules.forEach((rule, index) => {
    rule.priority = priorityBase - (index * priorityStep);
  });
  const orderedIds = new Map(orderedRules.map((rule, index) => [rule.id, index]));
  workspaceCase.visitRules = [...(workspaceCase.visitRules || [])].sort((a, b) => {
    const aIndex = orderedIds.has(a.id) ? orderedIds.get(a.id) : Number.POSITIVE_INFINITY;
    const bIndex = orderedIds.has(b.id) ? orderedIds.get(b.id) : Number.POSITIVE_INFINITY;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return compareRulesForEditor(a, b);
  });
}

async function createArticle() {
  workspaceIssue.items.push({
    id: uniqueId("article", new Set(workspaceIssue.items.map((item) => item.id))),
    type: "news",
    headline: "New article",
    body: "",
    format: {
      headlineMode: "standard",
      underlineHeadline: false,
      dropCap: false,
      indentFirstParagraph: true
    },
    tags: [],
    linkedLocationIds: [],
    linkedPersonIds: [],
    isDirectClue: false
  });
  selectedArticleId = workspaceIssue.items.at(-1).id;
  await saveIssue("Article created");
}

async function deleteArticle() {
  workspaceIssue.items = workspaceIssue.items.filter((item) => item.id !== selectedArticleId);
  selectedArticleId = workspaceIssue.items[0]?.id || null;
  await saveIssue("Article deleted");
}

async function maybeReloadWorkspaceForReferences() {
  if (!workspaceCase?.id) return;
  await loadWorkspace(workspaceCase.id);
}

async function saveRuleFromForm(ruleId) {
  const rule = workspaceCase.visitRules.find((item) => item.id === ruleId);
  const form = new FormData(els.ruleForm);
  Object.assign(rule, {
    title: String(form.get("title") || ""),
    kind: String(form.get("kind") || "lead"),
    priority: Number(form.get("priority") || 100),
    countsAsLead: form.get("countsAsLead") === "on",
    repeatable: form.get("repeatable") === "on",
    text: String(form.get("text") || ""),
    conditions: buildConditionsFromRuleForm(),
    effects: {
      revealLocationIds: getSelectedValues(els.ruleForm.querySelector('[name="revealLocationIds"]')),
      addNotebook: String(form.get("addNotebook") || "")
    }
  });
  await saveCase("Rule saved");
}

function buildConditionsFromRuleForm() {
  const all = [];
  const any = [];
  const none = [];

  pushCondition(all, "resolvedRuleIds", getSelectedValues(els.ruleForm.querySelector('[name="allResolvedRuleIds"]')));
  pushCondition(all, "visitedLocationIds", getSelectedValues(els.ruleForm.querySelector('[name="allVisitedLocationIds"]')));
  pushCondition(any, "resolvedRuleIds", getSelectedValues(els.ruleForm.querySelector('[name="anyResolvedRuleIds"]')));
  pushCondition(any, "visitedLocationIds", getSelectedValues(els.ruleForm.querySelector('[name="anyVisitedLocationIds"]')));
  pushCondition(none, "resolvedRuleIds", getSelectedValues(els.ruleForm.querySelector('[name="noneResolvedRuleIds"]')));
  pushCondition(none, "visitedLocationIds", getSelectedValues(els.ruleForm.querySelector('[name="noneVisitedLocationIds"]')));

  const visitCountLocationId = els.ruleForm.querySelector('[name="visitCountLocationId"]').value;
  const visitCountMin = parseOptionalNumber(els.ruleForm.querySelector('[name="visitCountMin"]').value);
  const visitCountMax = parseOptionalNumber(els.ruleForm.querySelector('[name="visitCountMax"]').value);
  if (visitCountLocationId && (visitCountMin !== null || visitCountMax !== null)) {
    all.push({ type: "visitCountAtLocation", values: [visitCountLocationId], min: visitCountMin, max: visitCountMax });
  }

  const globalVisitCountMin = parseOptionalNumber(els.ruleForm.querySelector('[name="globalVisitCountMin"]').value);
  const globalVisitCountMax = parseOptionalNumber(els.ruleForm.querySelector('[name="globalVisitCountMax"]').value);
  if (globalVisitCountMin !== null || globalVisitCountMax !== null) {
    all.push({ type: "globalVisitCount", values: [], min: globalVisitCountMin, max: globalVisitCountMax });
  }

  return { all, any, none };
}

function pushCondition(group, type, values) {
  if (values.length) group.push({ type, values });
}

function buildConditionSelect(name, label, items, selectedIds, labelField, help = "") {
  return `
    <label class="field">
      <span>${help ? fieldLabel(label, help) : escapeHtml(label)}</span>
      <select name="${name}" multiple size="6">
        ${buildSelectOptions(items, selectedIds || [], false, true, labelField)}
      </select>
      ${help ? `<span class="field-help">${escapeHtml(help)}</span>` : ""}
    </label>
  `;
}

function buildSimpleMultiSelect(name, label, values, selectedIds) {
  return `
    <label class="field">
      <span>${escapeHtml(label)}</span>
      <select name="${name}" multiple size="5">
        ${values.map((value) => `<option value="${value}" ${(selectedIds || []).includes(value) ? "selected" : ""}>${escapeHtml(formatLabel(value))}</option>`).join("")}
      </select>
    </label>
  `;
}

function buildSelectOptions(items, selectedValue, includeBlank = false, multiple = false, labelField = "name") {
  const selectedValues = new Set(Array.isArray(selectedValue) ? selectedValue : [selectedValue].filter(Boolean));
  const rows = includeBlank ? [`<option value="">Select…</option>`] : [];
  rows.push(...(items || []).map((item) => {
    const value = item.id || item.value || item;
    const label = typeof item === "string" ? item : (item[labelField] || item.name || item.title || item.summary || item.value || item.id);
    return `<option value="${escapeHtml(value)}" ${selectedValues.has(value) ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }));
  return rows.join("");
}

function buildDatalist(id, values) {
  return `<datalist id="${id}">${values.map((value) => `<option value="${escapeHtml(value)}"></option>`).join("")}</datalist>`;
}

function buildUniqueOptions(values) {
  return [...new Set((values || []).filter(Boolean).map((value) => String(value).trim()))].sort();
}

function fieldLabel(label, help) {
  return `${escapeHtml(label)} <span class="help-dot" tabindex="0" aria-label="${escapeHtml(help)}" data-tooltip="${escapeHtml(help)}">?</span>`;
}

function formatLocationHeaderSubtitle(location) {
  const preview = location.searchPreviewText || location.address || "";
  const meta = [formatLabel(location.type), location.address].filter(Boolean).join(" · ");
  return [preview, meta].filter(Boolean).join(" — ");
}

function enhanceEditorSelects(container = document) {
  container.querySelectorAll("select[data-editor-select], .editor-form select:not([multiple]):not([size]), .panel-header select:not([multiple]):not([size])").forEach((select) => {
    if (select.multiple || Number(select.getAttribute("size") || 0) > 1) return;
    if (select.dataset.selectEnhanced === "true") {
      select._editorSelectSync?.();
      return;
    }
    select.dataset.selectEnhanced = "true";
    select.classList.add("native-select-hidden");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");
    const wrapper = document.createElement("div");
    wrapper.className = "editor-select";
    const button = document.createElement("button");
    button.className = "editor-select-button";
    button.type = "button";
    const menu = document.createElement("div");
    menu.className = "editor-select-menu";
    menu.hidden = true;
    wrapper.append(button, menu);
    select.insertAdjacentElement("afterend", wrapper);

    const sync = () => {
      const selected = select.selectedOptions[0] || select.options[0];
      button.textContent = selected?.textContent?.trim() || "Select...";
      menu.innerHTML = "";
      [...select.options].forEach((option) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "editor-select-option";
        item.dataset.value = option.value;
        item.textContent = option.textContent || option.value || "Select...";
        item.setAttribute("aria-selected", String(option.selected));
        item.addEventListener("click", () => {
          select.value = option.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          menu.hidden = true;
          wrapper.classList.remove("is-open");
          sync();
        });
        menu.append(item);
      });
    };

    button.addEventListener("click", () => {
      document.querySelectorAll(".editor-select.is-open").forEach((openWrapper) => {
        if (openWrapper === wrapper) return;
        openWrapper.classList.remove("is-open");
        const openMenu = openWrapper.querySelector(".editor-select-menu");
        if (openMenu) openMenu.hidden = true;
      });
      const nextOpen = menu.hidden;
      menu.hidden = !nextOpen;
      wrapper.classList.toggle("is-open", nextOpen);
    });
    select.addEventListener("change", sync);
    select._editorSelectSync = sync;
    sync();
  });
}

document.addEventListener("click", (event) => {
  if (event.target.closest(".editor-select")) return;
  document.querySelectorAll(".editor-select.is-open").forEach((wrapper) => {
    wrapper.classList.remove("is-open");
    const menu = wrapper.querySelector(".editor-select-menu");
    if (menu) menu.hidden = true;
  });
});

function getSelectedValues(select) {
  if (!select) return [];
  return [...select.selectedOptions].map((option) => option.value).filter(Boolean);
}

function getCheckedValues(container, selector) {
  return [...container.querySelectorAll(selector)].filter((input) => input.checked).map((input) => input.value);
}

function splitLines(value) {
  return String(value || "").split(/\n|,/).map((item) => item.trim()).filter(Boolean);
}

function parseSolutionQuestions(value) {
  return String(value || "")
    .split("\n")
    .map((line, index) => {
      const [rawId, rawPrompt, ...answerParts] = line.split("|").map((part) => part.trim());
      const prompt = rawPrompt || rawId;
      if (!prompt) return null;
      return {
        id: rawPrompt ? (rawId || `question_${index + 1}`) : `question_${index + 1}`,
        prompt,
        modelAnswer: answerParts.join(" | ")
      };
    })
    .filter(Boolean);
}

function parseJsonArray(value) {
  const text = String(value || "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toggleInList(list, value, enabled) {
  const next = new Set(list || []);
  if (enabled) next.add(value);
  else next.delete(value);
  return [...next];
}

function parseOptionalNumber(value) {
  if (String(value ?? "").trim() === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function getCaseLocations() {
  return bootstrap.locations.filter((location) => workspaceCase?.caseLocationIds?.includes(location.id));
}

function getCasePeople() {
  return bootstrap.people.filter((person) => workspaceCase?.casePeopleIds?.includes(person.id));
}

function getRulesForSelectedLocation() {
  return (workspaceCase?.visitRules || [])
    .filter((rule) => !selectedCaseLocationId || rule.locationId === selectedCaseLocationId)
    .sort(compareRulesForEditor);
}

function getAllCaseRulesSorted() {
  return (workspaceCase?.visitRules || [])
    .map((rule) => ({
      ...rule,
      ruleLabel: formatRuleReferenceLabel(rule)
    }))
    .sort(compareRulesForEditor);
}

function compareRulesForEditor(a, b) {
  const priorityDiff = Number(b.priority || 0) - Number(a.priority || 0);
  if (priorityDiff) return priorityDiff;
  const locationDiff = String(a.locationId || "").localeCompare(String(b.locationId || ""));
  if (locationDiff) return locationDiff;
  return String(a.title || a.id || "").localeCompare(String(b.title || b.id || ""));
}

function formatRuleOptionLabel(rule) {
  const priority = Number.isFinite(Number(rule.priority)) ? `p${Number(rule.priority)}` : "p?";
  return `${priority} · ${rule.title || rule.id} [${rule.kind || "lead"}]`;
}

function formatRuleReferenceLabel(rule) {
  const location = findLocation(rule.locationId);
  const locationName = location?.name || rule.locationId || "Unknown location";
  return `${locationName} — ${rule.title || rule.id}`;
}

function summarizeRuleConditions(rule) {
  const parts = [];
  for (const groupName of ["all", "any", "none"]) {
    const group = rule.conditions?.[groupName] || [];
    if (!group.length) continue;
    const label = groupName === "all" ? "Requires" : groupName === "any" ? "Allows any" : "Blocks when";
    parts.push(`${label}: ${group.map(formatConditionSummary).join("; ")}`);
  }
  return parts.join(" | ");
}

function formatConditionSummary(condition) {
  const values = condition.values || [];
  if (condition.type === "resolvedRuleIds") {
    return `resolved rules ${values.map((id) => getRuleTitle(id)).join(", ")}`;
  }
  if (condition.type === "visitedLocationIds") {
    return `visited locations ${values.map((id) => findLocation(id)?.name || id).join(", ")}`;
  }
  if (condition.type === "visitCountAtLocation") {
    return `${findLocation(values[0])?.name || values[0] || "location"} visits ${formatNumberRange(condition.min, condition.max)}`;
  }
  if (condition.type === "globalVisitCount") {
    return `total visits ${formatNumberRange(condition.min, condition.max)}`;
  }
  return `${condition.type}: ${values.join(", ")}`;
}

function getRuleTitle(id) {
  const rule = (workspaceCase?.visitRules || []).find((item) => item.id === id);
  return rule ? `${rule.title || rule.id}` : id;
}

function formatNumberRange(min, max) {
  if (Number.isFinite(min) && Number.isFinite(max)) return `${min}-${max}`;
  if (Number.isFinite(min)) return `>= ${min}`;
  if (Number.isFinite(max)) return `<= ${max}`;
  return "any count";
}

function getSelectedRule() {
  return (workspaceCase?.visitRules || []).find((item) => item.id === selectedRuleId) || null;
}

function getSelectedLocation() {
  return bootstrap.locations.find((item) => item.id === selectedLocationId) || null;
}

function getSelectedPerson() {
  return bootstrap.people.find((item) => item.id === selectedPersonId) || null;
}

function findLocation(id) {
  return bootstrap.locations.find((item) => item.id === id) || null;
}

function findPerson(id) {
  return bootstrap.people.find((item) => item.id === id) || null;
}

function getConditionValues(rule, groupName, type) {
  return (rule.conditions?.[groupName] || []).find((condition) => condition.type === type)?.values || [];
}

function getCountCondition(rule, type) {
  return (rule.conditions?.all || []).find((condition) => condition.type === type) || null;
}

function setStatus(element, text) {
  if (!element) return;
  element.textContent = text;
  element.title = {
    Ready: "This editor section is loaded and ready.",
    "Saving...": "Changes are being written to the local data files.",
    Saved: "The latest save completed."
  }[text] || "Editor status.";
}

function getStatusElementForKind(kind) {
  if (kind === "people") return els.personStatus;
  if (kind === "case" || kind === "newspaper") return els.workspaceStatus;
  return els.locationStatus;
}

function bindImportButton(button, kind, format) {
  button.addEventListener("click", () => {
    pendingImportKind = kind;
    pendingImportFormat = format;
    els.importFilePicker.value = "";
    els.importFilePicker.accept = format === "csv" ? ".csv,text/csv" : ".json,application/json";
    els.importFilePicker.click();
  });
}

function bindExportButton(button, kind, format) {
  button.addEventListener("click", () => {
    const payload = buildExportPayload(kind, format);
    triggerDownload(buildExportFilename(kind, format), payload, format === "json" ? "application/json" : "text/csv;charset=utf-8");
    setStatus(getStatusElementForKind(kind), "Exported");
  });
}

async function handleImportFileSelection(event) {
  const [file] = event.target.files || [];
  if (!file || !pendingImportKind) return;
  const kind = pendingImportKind;
  const format = pendingImportFormat;
  pendingImportKind = null;
  pendingImportFormat = null;
  const text = await file.text();
  if (kind === "locations") {
    setStatus(els.locationStatus, "Importing...");
    const payload = buildImportPayload("locations", format, text);
    const response = await fetch(`${EDITOR_API_BASE}/api/import/locations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`Import failed: ${response.status}`);
    const result = await response.json();
    await loadBootstrap();
    await maybeReloadWorkspaceForReferences();
    setStatus(els.locationStatus, formatImportStatus(result.importSummary));
    renderAll();
    return;
  }
  if (kind === "people") {
    setStatus(els.personStatus, "Importing...");
    const payload = buildImportPayload("people", format, text);
    await fetch(`${EDITOR_API_BASE}/api/import/people`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    await loadBootstrap();
    await maybeReloadWorkspaceForReferences();
    setStatus(els.personStatus, "Imported");
    renderAll();
    return;
  }
  if (kind === "case") {
    const payload = buildImportPayload("case", format, text);
    workspaceCase = {
      ...workspaceCase,
      ...payload.caseData,
      id: workspaceCase.id
    };
    await saveCase("Imported");
    return;
  }
  if (kind === "newspaper") {
    const payload = buildImportPayload("newspaper", format, text);
    workspaceIssue = {
      ...workspaceIssue,
      ...payload.issue,
      id: workspaceIssue.id
    };
    await saveIssue("Imported");
  }
}

function buildExportPayload(kind, format, selectedIds = null) {
  if (kind === "locations") {
    const rows = bootstrap.locations
      .filter((location) => !selectedIds || selectedIds.has(location.id))
      .map((location) => ({
      id: location.id,
      name: location.name,
      type: location.type,
      aliases: (location.aliases || []).join("|"),
      lat: location.coordinates?.lat ?? "",
      lng: location.coordinates?.lng ?? "",
      visibility: location.visibility || "",
      address: location.address || "",
      searchPreviewText: location.searchPreviewText || "",
      defaultVisitText: location.defaultVisitText || "",
      tags: (location.tags || []).join("|"),
      worldVisitRules: format === "json" ? (location.worldVisitRules || []) : JSON.stringify(location.worldVisitRules || [])
    }));
    if (format === "json") return JSON.stringify({ items: rows }, null, 2);
    return stringifyCsv(rows, Object.keys(rows[0] || { id: "", name: "" }));
  }
  if (kind === "people") {
    const rows = bootstrap.people
      .filter((person) => !selectedIds || selectedIds.has(person.id))
      .map((person) => ({
      id: person.id,
      name: person.name,
      kind: person.kind,
      aliases: (person.aliases || []).join("|"),
      residenceLocationId: person.residenceLocationId || "",
      workLocationIds: (person.workLocationIds || []).join("|"),
      notes: person.notes || "",
      tags: (person.tags || []).join("|")
    }));
    if (format === "json") return JSON.stringify({ items: rows }, null, 2);
    return stringifyCsv(rows, Object.keys(rows[0] || { id: "", name: "" }));
  }
  if (kind === "case") {
    return JSON.stringify({ caseData: workspaceCase }, null, 2);
  }
  if (kind === "newspaper") {
    if (format === "json") return JSON.stringify({ issue: workspaceIssue }, null, 2);
    const rows = (workspaceIssue?.items || []).map((item) => ({
      id: item.id,
      type: item.type,
      headline: item.headline,
      body: item.body,
      headlineMode: getArticleHeadlineMode(item),
      underlineHeadline: item.format?.underlineHeadline ? "true" : "false",
      dropCap: usesDropCapPreview(item) ? "true" : "false",
      indentFirstParagraph: shouldIndentFirstParagraphPreview(item) ? "true" : "false",
      tags: (item.tags || []).join("|"),
      linkedLocationIds: (item.linkedLocationIds || []).join("|"),
      linkedPersonIds: (item.linkedPersonIds || []).join("|"),
      isDirectClue: item.isDirectClue ? "true" : "false"
    }));
    return stringifyCsv(rows, Object.keys(rows[0] || { id: "", type: "", headline: "" }));
  }
  throw new Error(`Unsupported export kind: ${kind}`);
}

function buildExportFilename(kind, format) {
  return `gaslights-${kind}-${new Date().toISOString().slice(0, 10)}.${format}`;
}

function buildImportPayload(kind, format, text) {
  if (kind === "case") {
    const parsed = JSON.parse(text);
    return { caseData: parsed.caseData || parsed };
  }
  if (kind === "newspaper") {
    if (format === "json") {
      const parsed = JSON.parse(text);
      return { issue: parsed.issue || parsed };
    }
    const rows = parseCsvText(text);
    return {
      issue: {
        ...workspaceIssue,
        items: rows.map((row) => ({
          id: row.id,
          type: row.type || "news",
          headline: row.headline || "",
          body: row.body || "",
          format: {
            headlineMode: row.headlineMode || "standard",
            underlineHeadline: row.underlineHeadline === "true",
            dropCap: row.dropCap === "true",
            indentFirstParagraph: row.indentFirstParagraph !== "false"
          },
          tags: splitDelimitedValue(row.tags),
          linkedLocationIds: splitDelimitedValue(row.linkedLocationIds),
          linkedPersonIds: splitDelimitedValue(row.linkedPersonIds),
          isDirectClue: row.isDirectClue === "true"
        }))
      }
    };
  }
  if (format === "json") {
    const parsed = JSON.parse(text);
    return { items: Array.isArray(parsed) ? parsed : (parsed.items || []) };
  }
  const rows = parseCsvText(text);
  if (kind === "people") {
    return {
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        kind: row.kind,
        aliases: row.aliases,
        residenceLocationId: row.residenceLocationId || "",
        workLocationIds: row.workLocationIds || "",
        notes: row.notes || "",
        tags: row.tags || ""
      }))
    };
  }
  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      aliases: row.aliases,
      lat: row.lat,
      lng: row.lng,
      visibility: row.visibility,
      address: row.address,
      searchPreviewText: row.searchPreviewText || "",
      defaultVisitText: row.defaultVisitText || "",
      tags: row.tags,
      worldVisitRules: parseJsonArray(row.worldVisitRules)
    }))
  };
}

function formatImportStatus(summary = {}) {
  const created = Number(summary.created || 0);
  const updated = Number(summary.updated || 0);
  const skipped = Number(summary.skipped || 0);
  return `Imported: ${created} new, ${updated} updated${skipped ? `, ${skipped} skipped` : ""}`;
}

function triggerDownload(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function splitDelimitedValue(value) {
  return String(value || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function stringifyCsv(rows, headers) {
  return [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvCell(row[header])).join(","))
  ].join("\n");
}

function parseCsvText(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }
  row.push(current);
  if (row.some((cell) => cell !== "")) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map((cell) => cell.trim());
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, (cells[index] || "").trim()])));
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll("\"", "\"\"")}"`;
  return text;
}

function initLocationMap() {
  if (!window.maplibregl || !els.locationMap || locationMap) return;
  const view = createEditorMapView(els.locationMap, {
    draggable: true,
    onClick: (lngLat) => setLocationCoordinates(lngLat.lat, lngLat.lng),
    onMarkerDrag: (lngLat) => setLocationCoordinates(lngLat.lat, lngLat.lng)
  });
  locationMap = view.map;
  locationMarker = view.marker;
  locationMap.on("load", () => {
    syncEditorMapLayerVisibility();
    syncLocationPoiMarkers();
  });
  syncLocationMap();
}

function initCaseLocationMap() {
  if (!window.maplibregl || !els.caseLocationMap || caseLocationMap) return;
  const view = createEditorMapView(els.caseLocationMap, { draggable: false });
  caseLocationMap = view.map;
  caseLocationMarker = view.marker;
  caseLocationMap.on("load", syncEditorMapLayerVisibility);
  syncCaseLocationMap();
}

function createEditorMapView(container, options = {}) {
  const map = new maplibregl.Map({
    container,
    center: [-0.1246, 51.5079],
    zoom: 13,
    minZoom: 11,
    maxZoom: EDITOR_MAP_MAX_ZOOM,
    maxBounds: LOCATION_MAP_BOUNDS,
    style: {
      version: 8,
      sources: {
        [MODERN_SOURCE_ID]: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors",
          minzoom: 0,
          maxzoom: 19
        },
        [HISTORICAL_SOURCE_ID]: {
          type: "raster",
          tiles: [`${EDITOR_API_BASE}/tiles/london-1895-six-inch/{z}/{x}/{y}.png?v=202606270945`],
          tileSize: 256,
          bounds: HISTORICAL_TILE_BOUNDS,
          minzoom: 11,
          maxzoom: HISTORICAL_TILE_MAX_ZOOM,
          attribution: "Historical mapping derived from out-of-copyright Ordnance Survey/NLS six-inch source material"
        }
      },
      layers: [
        {
          id: MODERN_LAYER_ID,
          type: "raster",
          source: MODERN_SOURCE_ID,
          minzoom: 0,
          maxzoom: 19,
          layout: { visibility: "visible" },
          paint: { "raster-opacity": EDITOR_MODERN_BASE_OPACITY }
        },
        {
          id: HISTORICAL_LAYER_ID,
          type: "raster",
          source: HISTORICAL_SOURCE_ID,
          minzoom: 11,
          maxzoom: EDITOR_MAP_MAX_ZOOM,
          layout: { visibility: "visible" },
          paint: { "raster-opacity": historicalOpacity }
        }
      ]
    }
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  if (options.onClick) map.on("click", (event) => options.onClick(event.lngLat));
  const marker = new maplibregl.Marker({ draggable: Boolean(options.draggable) }).setLngLat([-0.1246, 51.5079]).addTo(map);
  if (options.draggable && options.onMarkerDrag) marker.on("dragend", () => options.onMarkerDrag(marker.getLngLat()));
  return { map, marker };
}

function syncEditorMapLayerVisibility() {
  for (const map of getEditorMaps()) {
    if (!map) continue;
    if (map.getLayer(HISTORICAL_LAYER_ID)) {
      map.setLayoutProperty(HISTORICAL_LAYER_ID, "visibility", "visible");
      map.setPaintProperty(HISTORICAL_LAYER_ID, "raster-opacity", historicalOpacity);
    }
    if (map.getLayer(MODERN_LAYER_ID)) {
      map.setLayoutProperty(MODERN_LAYER_ID, "visibility", "visible");
      map.setPaintProperty(MODERN_LAYER_ID, "raster-opacity", EDITOR_MODERN_BASE_OPACITY);
    }
  }
  syncHistoricalOpacityControls();
}

function getEditorMaps() {
  return [
    locationMap,
    caseLocationMap,
    ...[...locationPickerMaps.values()].map((view) => view.map)
  ];
}

function setEditorHistoricalOpacity(opacity) {
  historicalOpacity = Math.min(1, Math.max(0, Number.isFinite(opacity) ? opacity : 0.85));
  syncEditorMapLayerVisibility();
}

function setLocationMapExpanded(expanded) {
  locationMapExpanded = Boolean(expanded);
  try {
    window.localStorage?.setItem(LOCATION_MAP_SIZE_STORAGE_KEY, locationMapExpanded ? "true" : "false");
  } catch {
    // Local persistence is optional; the editor should still work if storage is unavailable.
  }
  syncLocationMapSizeUi();
  window.setTimeout(() => {
    locationMap?.resize();
    syncLocationMap();
  }, 0);
}

function syncLocationMapSizeUi() {
  els.locationWorkspacePanel?.classList.toggle("is-map-expanded", locationMapExpanded);
  if (els.toggleLocationMapSize) {
    els.toggleLocationMapSize.textContent = locationMapExpanded ? "Compact map" : "Large map";
    els.toggleLocationMapSize.setAttribute("aria-pressed", locationMapExpanded ? "true" : "false");
  }
}

function syncLocationSortControl() {
  if (!els.locationSort) return;
  const validModes = new Set([...els.locationSort.options].map((option) => option.value));
  if (!validModes.has(locationSortMode)) locationSortMode = "name";
  els.locationSort.value = locationSortMode;
  els.locationSort._editorSelectSync?.();
}

function readLocalStorageFlag(key, fallback) {
  try {
    const value = window.localStorage?.getItem(key);
    if (value === "true") return true;
    if (value === "false") return false;
  } catch {
    return fallback;
  }
  return fallback;
}

function readLocalStorageValue(key, fallback) {
  try {
    return window.localStorage?.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function syncHistoricalOpacityControls() {
  document.querySelectorAll("[data-historical-opacity]").forEach((input) => {
    input.value = String(historicalOpacity);
  });
  document.querySelectorAll("[data-historical-opacity-output]").forEach((output) => {
    output.textContent = formatOpacityPercent(historicalOpacity);
  });
}

function formatOpacityPercent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function bindLocationCoordInputs() {
  const latInput = els.locationForm.querySelector('[name="lat"]');
  const lngInput = els.locationForm.querySelector('[name="lng"]');
  [latInput, lngInput].forEach((input) => input?.addEventListener("change", syncLocationMapFromInputs));
}

function getLocationCoordinateSeed(formData) {
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  const markerLngLat = locationMarker?.getLngLat?.();
  if (Number.isFinite(markerLngLat?.lat) && Number.isFinite(markerLngLat?.lng)) {
    return { lat: markerLngLat.lat, lng: markerLngLat.lng };
  }
  return null;
}

function syncLocationMapFromInputs() {
  const lat = Number(els.locationForm.querySelector('[name="lat"]')?.value);
  const lng = Number(els.locationForm.querySelector('[name="lng"]')?.value);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !locationMap) return;
  const center = [lng, lat];
  if (!locationMarker) {
    locationMarker = new maplibregl.Marker({ draggable: true }).setLngLat(center).addTo(locationMap);
    locationMarker.on("dragend", onLocationMarkerDragEnd);
  } else {
    locationMarker.setLngLat(center);
  }
  locationMap.flyTo({ center, zoom: Math.max(locationMap.getZoom(), 15) });
}

function syncLocationMap() {
  if (!locationMap) return;
  const location = getSelectedLocation();
  const center = location?.coordinates ? [location.coordinates.lng, location.coordinates.lat] : [-0.1246, 51.5079];
  locationMarker?.setLngLat(center);
  locationMap.resize();
  locationMap.flyTo({ center, zoom: location?.coordinates ? 15 : 13 });
  syncLocationPoiMarkers();
  renderNearbyLocations();
}

function syncLocationPoiMarkers() {
  if (!locationMap) return;
  const seen = new Set();
  for (const location of bootstrap.locations || []) {
    const lat = Number(location.coordinates?.lat);
    const lng = Number(location.coordinates?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    seen.add(location.id);
    const record = ensureLocationPoiMarker(location);
    record.marker.setLngLat([lng, lat]);
    record.element.className = locationPoiMarkerClass(location);
    record.element.title = location.name;
    record.element.textContent = markerInitial(location);
  }
  for (const [locationId, record] of locationPoiMarkers) {
    if (seen.has(locationId)) continue;
    record.marker.remove();
    locationPoiMarkers.delete(locationId);
  }
}

function ensureLocationPoiMarker(location) {
  const existing = locationPoiMarkers.get(location.id);
  if (existing) return existing;
  const element = document.createElement("button");
  element.type = "button";
  element.className = locationPoiMarkerClass(location);
  element.title = location.name;
  element.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    selectedLocationId = location.id;
    renderLocationList();
    renderLocationWorkspace();
    syncLocationMap();
  });
  const marker = new maplibregl.Marker({ element, anchor: "center" })
    .setLngLat([location.coordinates.lng, location.coordinates.lat])
    .addTo(locationMap);
  const record = { marker, element };
  locationPoiMarkers.set(location.id, record);
  return record;
}

function locationPoiMarkerClass(location) {
  return [
    "maplibregl-marker",
    "maplibregl-marker-anchor-center",
    "editor-poi-marker",
    `is-${categorizeEditorLocation(location)}`,
    location.id === selectedLocationId ? "is-selected" : "",
    location.visibility === "public" ? "is-public" : "is-hidden"
  ].filter(Boolean).join(" ");
}

function categorizeEditorLocation(location) {
  if (["railway_office", "railway_station", "cab_registry", "port_authority", "telegraph_office"].includes(location.type) || location.tags?.includes("transport")) return "transport";
  if (["police_station", "solicitor", "registry_office", "bank", "insurance_office"].includes(location.type)) return "civic_records";
  if (["hospital", "chemist_analyst", "laboratory", "scientific_institution"].includes(location.type)) return "science_medicine";
  if (["commercial_office", "warehouse", "pawnbroker", "bookmaker"].includes(location.type)) return "commerce";
  if (["private_residence", "lodging_house"].includes(location.type)) return "residences";
  if (["pub", "newspaper_office", "library", "theatre"].includes(location.type)) return "public_life";
  return "other";
}

function markerInitial(location) {
  const label = formatLabel(location.type || "place").trim();
  return label[0] || "P";
}

function syncCaseLocationMap() {
  if (!caseLocationMap) return;
  const location = findLocation(selectedCaseLocationId);
  const center = location?.coordinates ? [location.coordinates.lng, location.coordinates.lat] : [-0.1246, 51.5079];
  caseLocationMarker?.setLngLat(center);
  caseLocationMap.resize();
  caseLocationMap.flyTo({ center, zoom: location?.coordinates ? 15 : 13 });
}

function setLocationCoordinates(lat, lng) {
  const latInput = els.locationForm.querySelector('[name="lat"]');
  const lngInput = els.locationForm.querySelector('[name="lng"]');
  if (!latInput || !lngInput) return;
  latInput.value = lat.toFixed(6);
  lngInput.value = lng.toFixed(6);
  if (locationMarker) locationMarker.setLngLat([lng, lat]);
  renderNearbyLocations();
}

function renderNearbyLocations() {
  if (!els.locationNearbyList) return;
  const point = getCurrentLocationFormPoint();
  if (!point) {
    els.locationNearbyList.innerHTML = `<p class="muted">No coordinates selected.</p>`;
    return;
  }
  const nearby = (bootstrap.locations || [])
    .filter((location) => location.id !== selectedLocationId && Number.isFinite(Number(location.coordinates?.lat)) && Number.isFinite(Number(location.coordinates?.lng)))
    .map((location) => ({
      location,
      distance: distanceMeters(point.lat, point.lng, Number(location.coordinates.lat), Number(location.coordinates.lng))
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 8);
  els.locationNearbyList.innerHTML = `
    <div class="nearby-list-header">
      <p class="eyebrow">Nearby POIs</p>
      <span>${nearby.length ? "closest first" : "none"}</span>
    </div>
    ${nearby.length ? nearby.map(({ location, distance }) => `
      <button class="nearby-item" type="button" data-nearby-location-id="${escapeHtml(location.id)}">
        <span>
          <strong>${escapeHtml(location.name)}</strong>
          <small>${escapeHtml(formatLabel(location.type))} · ${escapeHtml(formatDistance(distance))}</small>
        </span>
      </button>
    `).join("") : `<p class="muted">No nearby POIs found.</p>`}
  `;
  els.locationNearbyList.querySelectorAll("[data-nearby-location-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedLocationId = button.dataset.nearbyLocationId;
      renderLocationList();
      renderLocationWorkspace();
      syncLocationMap();
    });
  });
}

function getCurrentLocationFormPoint() {
  const lat = Number(els.locationForm.querySelector('[name="lat"]')?.value);
  const lng = Number(els.locationForm.querySelector('[name="lng"]')?.value);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  const location = getSelectedLocation();
  const fallbackLat = Number(location?.coordinates?.lat);
  const fallbackLng = Number(location?.coordinates?.lng);
  if (Number.isFinite(fallbackLat) && Number.isFinite(fallbackLng)) return { lat: fallbackLat, lng: fallbackLng };
  return null;
}

function distanceMeters(latA, lngA, latB, lngB) {
  const earthRadius = 6371000;
  const toRadians = (value) => value * Math.PI / 180;
  const deltaLat = toRadians(latB - latA);
  const deltaLng = toRadians(lngB - lngA);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(deltaLng / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function renderBriefingMarkup(text) {
  return String(text || "")
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\[([^\]]+)\]\((place|person):([^)]+)\)/g, "<span class=\"inline-link\">$1</span>")}</p>`)
    .join("");
}

function buildArticlePreviewHtml(item) {
  const typeLabel = formatArticleType(item.type);
  const headline = escapeHtml(item.headline || "Untitled article");
  const body = buildPreviewParagraphs(item.body || "", {
    indentFirstParagraph: shouldIndentFirstParagraphPreview(item)
  });
  if (usesDropCapPreview(item)) {
    return `<div class="preview-paper ${item.format?.underlineHeadline ? "preview-underlined-head" : ""}"><p class="preview-eyebrow">${escapeHtml(typeLabel)}</p><div class="preview-dropcap">${body}</div></div>`;
  }
  if (getArticleHeadlineMode(item) === "inline") {
    return `<div class="preview-paper ${item.format?.underlineHeadline ? "preview-underlined-head" : ""}"><p class="preview-eyebrow">${escapeHtml(typeLabel)}</p><p class="preview-inline"><strong>${headline}</strong> — ${escapeHtml(String(item.body || "").replace(/\s+/g, " ").trim())}</p></div>`;
  }
  return `<div class="preview-paper ${item.format?.underlineHeadline ? "preview-underlined-head" : ""}"><p class="preview-eyebrow">${escapeHtml(typeLabel)}</p>${getArticleHeadlineMode(item) === "hidden" ? "" : `<h4>${headline}</h4>`}<div class="preview-body">${body}</div></div>`;
}

function buildPreviewParagraphs(text, options = {}) {
  return String(text || "").trim().split(/\n\s*\n/).filter(Boolean).map((part, index) => {
    const classes = [];
    if (index === 0 && options.indentFirstParagraph === false) classes.push("is-no-indent");
    return `<p${classes.length ? ` class="${classes.join(" ")}"` : ""}>${escapeHtml(part.replace(/\s+/g, " ").trim())}</p>`;
  }).join("");
}

function getArticleHeadlineMode(item) {
  if (item?.format?.headlineMode) return item.format.headlineMode;
  if (["notice", "shipping_notice", "transport_notice", "entertainment"].includes(item?.type)) return "inline";
  if (item?.type === "notices") return "hidden";
  return "standard";
}

function usesDropCapPreview(item) {
  if (typeof item?.format?.dropCap === "boolean") return item.format.dropCap;
  return item?.type === "notices";
}

function shouldIndentFirstParagraphPreview(item) {
  if (typeof item?.format?.indentFirstParagraph === "boolean") return item.format.indentFirstParagraph;
  return item?.type !== "notices";
}

function insertIntoTextarea(textarea, insertedText) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const next = `${textarea.value.slice(0, start)}${insertedText}${textarea.value.slice(end)}`;
  textarea.value = next;
  const cursor = start + insertedText.length;
  textarea.focus();
  textarea.setSelectionRange(cursor, cursor);
}

function handleReferenceError(payload, statusEl) {
  setStatus(statusEl, "Blocked");
  showEditorMessage({
    title: "Delete blocked",
    message: `${payload.error || "Blocked by references"}${payload.references?.length ? `\n\n${formatReferenceList(payload.references)}` : ""}`
  });
}

function formatReferenceSummary(payload) {
  if (payload.references?.length) return formatReferenceList(payload.references).replaceAll("\n", "; ");
  return payload.error || "blocked";
}

function formatReferenceList(references) {
  return (references || []).map((item) => `${item.kind}: ${item.label}`).join("\n");
}

function confirmInEditor({ title, message, confirmLabel = "Confirm", cancelLabel = "Cancel" }) {
  return new Promise((resolve) => {
    const modal = buildEditorModal({
      title,
      message,
      actions: [
        { label: cancelLabel, value: false, variant: "secondary" },
        { label: confirmLabel, value: true, variant: "danger" }
      ],
      resolve
    });
    document.body.append(modal);
    modal.querySelector("[data-modal-cancel]")?.focus();
  });
}

function showEditorMessage({ title, message, buttonLabel = "OK" }) {
  return new Promise((resolve) => {
    const modal = buildEditorModal({
      title,
      message,
      actions: [
        { label: buttonLabel, value: true, variant: "primary" }
      ],
      resolve
    });
    document.body.append(modal);
    modal.querySelector("button")?.focus();
  });
}

function buildEditorModal({ title, message, actions, resolve }) {
  const modal = document.createElement("div");
  modal.className = "editor-modal-backdrop";
  modal.setAttribute("role", "presentation");
  modal.innerHTML = `
    <section class="editor-modal" role="dialog" aria-modal="true" aria-labelledby="editorModalTitle">
      <h3 id="editorModalTitle">${escapeHtml(title)}</h3>
      <div class="editor-modal-message">${renderModalMessage(message)}</div>
      <div class="editor-modal-actions">
        ${actions.map((action) => `
          <button class="editor-modal-button is-${escapeHtml(action.variant)}" type="button" ${action.value === false ? "data-modal-cancel" : ""} data-modal-value="${escapeHtml(String(action.value))}">
            ${escapeHtml(action.label)}
          </button>
        `).join("")}
      </div>
    </section>
  `;
  const close = (value) => {
    modal.remove();
    resolve(value);
  };
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close(false);
    const button = event.target.closest("[data-modal-value]");
    if (button) close(button.dataset.modalValue === "true");
  });
  modal.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close(false);
  });
  return modal;
}

function renderModalMessage(message) {
  return String(message || "")
    .split("\n")
    .map((line) => line.trim() ? `<p>${escapeHtml(line)}</p>` : "")
    .join("");
}

function uniqueId(base, existingIds) {
  let candidate = slugifyIdentifier(base, `item_${Date.now()}`);
  let next = candidate;
  let suffix = 2;
  while (existingIds.has(next)) {
    next = `${candidate}_${suffix}`;
    suffix += 1;
  }
  return next;
}

function slugifyIdentifier(value, fallback = "item") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || fallback;
}

function formatArticleType(value) {
  return ({
    advert: "Advertisement",
    advertisement: "Advertisement",
    notice: "Notice",
    notices: "Births, Deaths, and Marriages",
    shipping_notice: "Shipping Notice",
    transport_notice: "Railway Notice",
    court_report: "Court Report",
    society: "Society",
    entertainment: "Amusement",
    letter: "Letter",
    news: "News"
  })[value] || formatLabel(value);
}

function formatLabel(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
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
