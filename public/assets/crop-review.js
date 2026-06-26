const QUAD_KEYS = ["topLeft", "topRight", "bottomRight", "bottomLeft"];
const DETAIL_REGION_SIZE = 512;
const DETAIL_OUTPUT_WIDTH = 512;

const state = {
  sheets: [],
  filteredSheets: [],
  currentSheetId: null,
  currentSheet: null,
  image: null,
  crop: null,
  originalCrop: null,
  quad: null,
  originalQuad: null,
  dragMode: null,
  dragStart: null,
  view: {
    zoom: 1,
    offsetX: 0,
    offsetY: 0
  },
  detailImages: {},
  detailRequestKeys: {},
  detailRefreshTimer: null,
  autosaveTimer: null,
  dirty: false
};

const els = {
  sheetSearch: document.querySelector("#sheetSearch"),
  onlyNeedsReview: document.querySelector("#onlyNeedsReview"),
  prevSheet: document.querySelector("#prevSheet"),
  nextSheet: document.querySelector("#nextSheet"),
  fitView: document.querySelector("#fitView"),
  saveCrop: document.querySelector("#saveCrop"),
  resetCrop: document.querySelector("#resetCrop"),
  autosaveToggle: document.querySelector("#autosaveToggle"),
  saveState: document.querySelector("#saveState"),
  sheetList: document.querySelector("#sheetList"),
  sheetStatus: document.querySelector("#sheetStatus"),
  sheetTitle: document.querySelector("#sheetTitle"),
  sheetMeta: document.querySelector("#sheetMeta"),
  leftInput: document.querySelector("#leftInput"),
  topInput: document.querySelector("#topInput"),
  rightInput: document.querySelector("#rightInput"),
  bottomInput: document.querySelector("#bottomInput"),
  statusInput: document.querySelector("#statusInput"),
  notesInput: document.querySelector("#notesInput"),
  mainCanvas: document.querySelector("#mainCanvas"),
  overviewCanvas: document.querySelector("#overviewCanvas"),
  topLeftCanvas: document.querySelector("#topLeftCanvas"),
  topRightCanvas: document.querySelector("#topRightCanvas"),
  bottomRightCanvas: document.querySelector("#bottomRightCanvas"),
  bottomLeftCanvas: document.querySelector("#bottomLeftCanvas")
};

const mainCtx = els.mainCanvas.getContext("2d");
const overviewCtx = els.overviewCanvas.getContext("2d");
const topLeftCtx = els.topLeftCanvas.getContext("2d");
const topRightCtx = els.topRightCanvas.getContext("2d");
const bottomRightCtx = els.bottomRightCanvas.getContext("2d");
const bottomLeftCtx = els.bottomLeftCanvas.getContext("2d");

boot();

async function boot() {
  bindEvents();
  await loadSheets();
  resizeCanvases();
  window.addEventListener("resize", () => {
    resizeCanvases();
    drawAll();
  });
}

function bindEvents() {
  els.sheetSearch.addEventListener("input", filterSheets);
  els.onlyNeedsReview.addEventListener("change", loadSheets);
  els.prevSheet.addEventListener("click", () => stepSheet(-1));
  els.nextSheet.addEventListener("click", () => stepSheet(1));
  els.fitView.addEventListener("click", () => {
    fitImageToCanvas();
    drawAll();
  });
  els.resetCrop.addEventListener("click", () => {
    if (!state.originalCrop || !state.originalQuad) return;
    state.crop = { ...state.originalCrop };
    state.quad = cloneQuad(state.originalQuad);
    syncInputsFromCrop();
    drawAll();
  });
  els.saveCrop.addEventListener("click", saveCrop);
  els.autosaveToggle.addEventListener("change", () => {
    if (els.autosaveToggle.checked && state.dirty) scheduleAutosave();
  });

  for (const input of [els.leftInput, els.topInput, els.rightInput, els.bottomInput]) {
    input.addEventListener("change", onInputCropChange);
  }
  els.statusInput.addEventListener("change", markDirtyAndMaybeAutosave);
  els.notesInput.addEventListener("input", markDirtyAndMaybeAutosave);

  els.mainCanvas.addEventListener("pointerdown", onPointerDown);
  els.mainCanvas.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  els.mainCanvas.addEventListener("wheel", onWheel, { passive: false });
}

async function loadSheets() {
  const params = new URLSearchParams({
    onlyNeedsReview: String(els.onlyNeedsReview.checked)
  });
  const response = await fetch(`/api/sheets?${params.toString()}`, { cache: "no-store" });
  state.sheets = await response.json();
  filterSheets();
}

function filterSheets() {
  const query = els.sheetSearch.value.trim().toLowerCase();
  state.filteredSheets = state.sheets.filter((sheet) => {
    if (!query) return true;
    return [sheet.sheetId, sheet.sheet, sheet.status, sheet.reviewNotes].join(" ").toLowerCase().includes(query);
  });
  renderSheetList();
  if (!state.filteredSheets.length) {
    state.currentSheetId = null;
    state.currentSheet = null;
    state.image = null;
    clearCanvases();
    return;
  }
  if (!state.currentSheetId || !state.filteredSheets.some((sheet) => sheet.sheetId === state.currentSheetId)) {
    openSheet(state.filteredSheets[0].sheetId);
  }
}

function renderSheetList() {
  els.sheetList.innerHTML = state.filteredSheets.map((sheet) => `
    <button class="sheet-item${sheet.sheetId === state.currentSheetId ? " is-active" : ""}" type="button" data-sheet-id="${sheet.sheetId}">
      <span>${escapeHtml(sheet.status)}</span>
      <strong>${escapeHtml(sheet.sheet)}</strong>
      <span>${escapeHtml(sheet.sheetId)}</span>
    </button>
  `).join("");
  els.sheetList.querySelectorAll(".sheet-item").forEach((button) => {
    button.addEventListener("click", () => openSheet(button.dataset.sheetId));
  });
}

async function openSheet(sheetId) {
  const sheet = state.filteredSheets.find((item) => item.sheetId === sheetId);
  if (!sheet) return;
  state.currentSheetId = sheetId;
  state.currentSheet = sheet;
  state.crop = { left: sheet.left, top: sheet.top, right: sheet.right, bottom: sheet.bottom };
  state.originalCrop = { ...state.crop };
  state.quad = cloneQuad(sheet.previewQuad || rectToQuad(state.crop));
  state.originalQuad = cloneQuad(state.quad);
  state.detailImages = {};
  state.detailRequestKeys = {};

  const image = new Image();
  image.src = `${sheet.previewUrl}?t=${Date.now()}`;
  await image.decode();
  state.image = image;
  fitImageToCanvas();

  els.sheetStatus.textContent = sheet.status || "unknown";
  els.sheetTitle.textContent = `${sheet.sheet} (${sheet.sheetId})`;
  els.sheetMeta.textContent = `Preview ${sheet.previewImage.width}x${sheet.previewImage.height} | Source ${sheet.sourceImage.width}x${sheet.sourceImage.height}`;
  els.statusInput.value = sheet.status || "reviewed";
  els.notesInput.value = sheet.reviewNotes || "";
  syncInputsFromCrop();
  state.dirty = false;
  setSaveState("Idle");
  renderSheetList();
  drawAll();
}

function stepSheet(direction) {
  const index = state.filteredSheets.findIndex((sheet) => sheet.sheetId === state.currentSheetId);
  if (index === -1) return;
  const next = state.filteredSheets[index + direction];
  if (next) openSheet(next.sheetId);
}

function syncInputsFromCrop() {
  els.leftInput.value = state.crop.left;
  els.topInput.value = state.crop.top;
  els.rightInput.value = state.crop.right;
  els.bottomInput.value = state.crop.bottom;
}

function onInputCropChange() {
  const crop = {
    left: Number(els.leftInput.value),
    top: Number(els.topInput.value),
    right: Number(els.rightInput.value),
    bottom: Number(els.bottomInput.value)
  };
  if (!isValidCrop(crop)) return;
  const nextCrop = clampCrop(crop);
  state.quad = constrainQuadToCrop(state.quad, nextCrop);
  state.crop = nextCrop;
  markDirtyAndMaybeAutosave();
  drawAll();
}

function resizeCanvases() {
  const rect = els.mainCanvas.parentElement.getBoundingClientRect();
  els.mainCanvas.width = Math.max(400, Math.floor(rect.width));
  els.mainCanvas.height = Math.max(400, Math.floor(rect.height));
  for (const canvas of [els.overviewCanvas, els.topLeftCanvas, els.topRightCanvas, els.bottomRightCanvas, els.bottomLeftCanvas]) {
    const width = canvas.parentElement.clientWidth - 24;
    canvas.width = Math.max(220, width);
    canvas.height = 180;
  }
}

function fitImageToCanvas() {
  if (!state.image) return;
  const scale = Math.min(
    els.mainCanvas.width / state.image.width,
    els.mainCanvas.height / state.image.height
  ) * 0.94;
  state.view.zoom = scale;
  state.view.offsetX = (els.mainCanvas.width - state.image.width * scale) / 2;
  state.view.offsetY = (els.mainCanvas.height - state.image.height * scale) / 2;
}

function drawAll() {
  drawAllWithoutRefresh();
  scheduleDetailRefresh();
}

function drawAllWithoutRefresh() {
  drawMainCanvas();
  drawOverview();
  drawDetailCanvas(topLeftCtx, "topLeft");
  drawDetailCanvas(topRightCtx, "topRight");
  drawDetailCanvas(bottomRightCtx, "bottomRight");
  drawDetailCanvas(bottomLeftCtx, "bottomLeft");
}

function clearCanvases() {
  for (const ctx of [mainCtx, overviewCtx, topLeftCtx, topRightCtx, bottomRightCtx, bottomLeftCtx]) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
}

function drawMainCanvas() {
  mainCtx.fillStyle = "#0f100d";
  mainCtx.fillRect(0, 0, els.mainCanvas.width, els.mainCanvas.height);
  if (!state.image) return;

  mainCtx.save();
  mainCtx.translate(state.view.offsetX, state.view.offsetY);
  mainCtx.scale(state.view.zoom, state.view.zoom);
  mainCtx.drawImage(state.image, 0, 0);
  mainCtx.restore();

  const rect = imageCropToScreenRect(state.crop);
  mainCtx.strokeStyle = "#d23224";
  mainCtx.lineWidth = 2;
  mainCtx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  drawQuadOverlay();
  drawCropHandles(rect);
}

function drawCropHandles(rect) {
  const handles = [
    { x: rect.x, y: rect.y + rect.height / 2, radius: 5 },
    { x: rect.x + rect.width, y: rect.y + rect.height / 2, radius: 5 },
    { x: rect.x + rect.width / 2, y: rect.y, radius: 5 },
    { x: rect.x + rect.width / 2, y: rect.y + rect.height, radius: 5 }
  ];
  mainCtx.fillStyle = "#f5efd9";
  for (const handle of handles) {
    mainCtx.beginPath();
    mainCtx.arc(handle.x, handle.y, handle.radius, 0, Math.PI * 2);
    mainCtx.fill();
  }
}

function drawQuadOverlay() {
  if (!state.quad) return;
  const points = QUAD_KEYS.map((key) => imagePointToScreen(state.quad[key]));
  mainCtx.strokeStyle = "#ffcd40";
  mainCtx.lineWidth = 2;
  mainCtx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) mainCtx.moveTo(point.x, point.y);
    else mainCtx.lineTo(point.x, point.y);
  });
  mainCtx.closePath();
  mainCtx.stroke();

  mainCtx.fillStyle = "#ffcd40";
  for (const point of points) {
    mainCtx.beginPath();
    mainCtx.arc(point.x, point.y, 7, 0, Math.PI * 2);
    mainCtx.fill();
  }
}

function drawOverview() {
  drawFittedCanvas(overviewCtx, (ctx, fit) => {
    ctx.drawImage(state.image, fit.x, fit.y, fit.width, fit.height);
    const scaleX = fit.width / state.image.width;
    const scaleY = fit.height / state.image.height;

    ctx.strokeStyle = "#d23224";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      fit.x + state.crop.left * scaleX,
      fit.y + state.crop.top * scaleY,
      (state.crop.right - state.crop.left) * scaleX,
      (state.crop.bottom - state.crop.top) * scaleY
    );

    const quadPoints = QUAD_KEYS.map((key) => ({
      x: fit.x + state.quad[key].x * scaleX,
      y: fit.y + state.quad[key].y * scaleY
    }));
    ctx.strokeStyle = "#ffcd40";
    ctx.beginPath();
    quadPoints.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.stroke();
  });
}

function drawDetailCanvas(ctx, cornerKey) {
  drawFittedCanvas(ctx, null, "#efe8d5");
  if (!state.image || !state.currentSheet || !state.quad) return;

  const detail = state.detailImages[cornerKey];
  if (detail?.image) {
    ctx.drawImage(detail.image, 0, 0, ctx.canvas.width, ctx.canvas.height);
    drawDetailGuides(ctx, cornerKey, detail.region);
  } else {
    const point = state.quad[cornerKey];
    const srcSize = 120;
    const left = clamp(Math.round(point.x - srcSize / 2), 0, state.image.width - srcSize);
    const top = clamp(Math.round(point.y - srcSize / 2), 0, state.image.height - srcSize);
    ctx.drawImage(state.image, left, top, srcSize, srcSize, 0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  ctx.strokeStyle = "#a09a8f";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, ctx.canvas.width - 1, ctx.canvas.height - 1);
}

function drawFittedCanvas(ctx, painter, bg = "#ffffff") {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (!state.image) return;
  const scale = Math.min(ctx.canvas.width / state.image.width, ctx.canvas.height / state.image.height);
  const fit = {
    width: state.image.width * scale,
    height: state.image.height * scale,
    x: (ctx.canvas.width - state.image.width * scale) / 2,
    y: (ctx.canvas.height - state.image.height * scale) / 2
  };
  if (painter) painter(ctx, fit);
}

function onPointerDown(event) {
  if (!state.image || !state.quad) return;
  const rect = imageCropToScreenRect(state.crop);
  state.dragMode = detectHandle(event.offsetX, event.offsetY, rect) || "pan";
  state.dragStart = {
    x: event.offsetX,
    y: event.offsetY,
    crop: { ...state.crop },
    quad: cloneQuad(state.quad),
    view: { ...state.view }
  };
  els.mainCanvas.setPointerCapture(event.pointerId);
  els.mainCanvas.classList.add("is-dragging");
}

function onPointerMove(event) {
  if (!state.dragMode || !state.dragStart) return;
  const dx = event.offsetX - state.dragStart.x;
  const dy = event.offsetY - state.dragStart.y;

  if (state.dragMode === "pan") {
    state.view.offsetX = state.dragStart.view.offsetX + dx;
    state.view.offsetY = state.dragStart.view.offsetY + dy;
    drawAll();
    return;
  }

  const imageDx = dx / state.view.zoom;
  const imageDy = dy / state.view.zoom;

  if (state.dragMode.startsWith("quad:")) {
    const cornerKey = state.dragMode.split(":")[1];
    const nextQuad = cloneQuad(state.dragStart.quad);
    nextQuad[cornerKey] = clampPoint({
      x: Math.round(state.dragStart.quad[cornerKey].x + imageDx),
      y: Math.round(state.dragStart.quad[cornerKey].y + imageDy)
    });
    state.quad = nextQuad;
    markDirtyAndMaybeAutosave();
    drawAll();
    return;
  }

  const next = { ...state.dragStart.crop };
  if (state.dragMode === "left") next.left = Math.round(state.dragStart.crop.left + imageDx);
  if (state.dragMode === "right") next.right = Math.round(state.dragStart.crop.right + imageDx);
  if (state.dragMode === "top") next.top = Math.round(state.dragStart.crop.top + imageDy);
  if (state.dragMode === "bottom") next.bottom = Math.round(state.dragStart.crop.bottom + imageDy);

  if (!isValidCrop(next, 10)) return;
  const nextCrop = clampCrop(next);
  state.quad = constrainQuadToCrop(state.dragStart.quad, nextCrop);
  state.crop = nextCrop;
  syncInputsFromCrop();
  markDirtyAndMaybeAutosave();
  drawAll();
}

function onPointerUp() {
  state.dragMode = null;
  state.dragStart = null;
  els.mainCanvas.classList.remove("is-dragging");
}

function onWheel(event) {
  if (!state.image) return;
  event.preventDefault();
  const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
  const nextZoom = clamp(state.view.zoom * zoomFactor, 0.25, 12);
  const imageX = (event.offsetX - state.view.offsetX) / state.view.zoom;
  const imageY = (event.offsetY - state.view.offsetY) / state.view.zoom;
  state.view.offsetX = event.offsetX - imageX * nextZoom;
  state.view.offsetY = event.offsetY - imageY * nextZoom;
  state.view.zoom = nextZoom;
  drawAll();
}

function detectHandle(x, y, rect) {
  for (const key of QUAD_KEYS) {
    const point = imagePointToScreen(state.quad[key]);
    if (Math.hypot(x - point.x, y - point.y) <= 12) return `quad:${key}`;
  }

  const threshold = 12;
  if (Math.abs(x - rect.x) <= threshold && y >= rect.y && y <= rect.y + rect.height) return "left";
  if (Math.abs(x - (rect.x + rect.width)) <= threshold && y >= rect.y && y <= rect.y + rect.height) return "right";
  if (Math.abs(y - rect.y) <= threshold && x >= rect.x && x <= rect.x + rect.width) return "top";
  if (Math.abs(y - (rect.y + rect.height)) <= threshold && x >= rect.x && x <= rect.x + rect.width) return "bottom";
  return null;
}

function imageCropToScreenRect(crop) {
  return {
    x: state.view.offsetX + crop.left * state.view.zoom,
    y: state.view.offsetY + crop.top * state.view.zoom,
    width: (crop.right - crop.left) * state.view.zoom,
    height: (crop.bottom - crop.top) * state.view.zoom
  };
}

function imagePointToScreen(point) {
  return {
    x: state.view.offsetX + point.x * state.view.zoom,
    y: state.view.offsetY + point.y * state.view.zoom
  };
}

async function saveCrop() {
  if (!state.currentSheetId || !isValidCrop(state.crop) || !state.quad) return;
  clearTimeout(state.autosaveTimer);
  state.crop = expandCropToIncludeQuad(state.crop, state.quad);
  syncInputsFromCrop();
  const payload = {
    ...state.crop,
    quad: state.quad,
    status: els.statusInput.value,
    reviewNotes: els.notesInput.value.trim()
  };
  setSaveState("Saving...");
  const response = await fetch(`/api/crop/${state.currentSheetId}`, {
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

  const sheet = state.sheets.find((item) => item.sheetId === state.currentSheetId);
  if (sheet) {
    sheet.left = state.crop.left;
    sheet.top = state.crop.top;
    sheet.right = state.crop.right;
    sheet.bottom = state.crop.bottom;
    sheet.previewQuad = cloneQuad(state.quad);
    sheet.status = payload.status;
    sheet.reviewNotes = payload.reviewNotes;
  }

  state.originalCrop = { ...state.crop };
  state.originalQuad = cloneQuad(state.quad);
  state.dirty = false;
  els.sheetStatus.textContent = payload.status;
  setSaveState("Saved");
  renderSheetList();
}

function markDirtyAndMaybeAutosave() {
  state.dirty = true;
  setSaveState(els.autosaveToggle.checked ? "Unsaved changes" : "Auto-save off");
  if (els.autosaveToggle.checked) scheduleAutosave();
}

function scheduleAutosave() {
  clearTimeout(state.autosaveTimer);
  state.autosaveTimer = setTimeout(() => {
    saveCrop();
  }, 500);
}

function setSaveState(message) {
  els.saveState.textContent = message;
}

function clampCrop(crop) {
  const width = state.image?.width || 0;
  const height = state.image?.height || 0;
  return {
    left: clamp(Math.round(crop.left), 0, width - 1),
    top: clamp(Math.round(crop.top), 0, height - 1),
    right: clamp(Math.round(crop.right), 1, width),
    bottom: clamp(Math.round(crop.bottom), 1, height)
  };
}

function clampPoint(point) {
  return {
    x: clamp(Math.round(point.x), 0, state.image?.width || 0),
    y: clamp(Math.round(point.y), 0, state.image?.height || 0)
  };
}

function isValidCrop(crop, minSize = 1) {
  return Number.isFinite(crop.left) &&
    Number.isFinite(crop.top) &&
    Number.isFinite(crop.right) &&
    Number.isFinite(crop.bottom) &&
    crop.right - crop.left >= minSize &&
    crop.bottom - crop.top >= minSize;
}

function cloneQuad(quad) {
  return Object.fromEntries(QUAD_KEYS.map((key) => [key, { ...quad[key] }]));
}

function rectToQuad(rect) {
  return {
    topLeft: { x: rect.left, y: rect.top },
    topRight: { x: rect.right, y: rect.top },
    bottomRight: { x: rect.right, y: rect.bottom },
    bottomLeft: { x: rect.left, y: rect.bottom }
  };
}

function expandCropToIncludeQuad(crop, quad) {
  const xs = QUAD_KEYS.map((key) => quad[key].x);
  const ys = QUAD_KEYS.map((key) => quad[key].y);
  return clampCrop({
    left: Math.min(crop.left, ...xs),
    top: Math.min(crop.top, ...ys),
    right: Math.max(crop.right, ...xs),
    bottom: Math.max(crop.bottom, ...ys)
  });
}

function constrainQuadToCrop(quad, crop) {
  const nextQuad = cloneQuad(quad);

  if (nextQuad.topLeft.x < crop.left) nextQuad.topLeft.x = crop.left;
  if (nextQuad.bottomLeft.x < crop.left) nextQuad.bottomLeft.x = crop.left;

  if (nextQuad.topRight.x > crop.right) nextQuad.topRight.x = crop.right;
  if (nextQuad.bottomRight.x > crop.right) nextQuad.bottomRight.x = crop.right;

  if (nextQuad.topLeft.y < crop.top) nextQuad.topLeft.y = crop.top;
  if (nextQuad.topRight.y < crop.top) nextQuad.topRight.y = crop.top;

  if (nextQuad.bottomLeft.y > crop.bottom) nextQuad.bottomLeft.y = crop.bottom;
  if (nextQuad.bottomRight.y > crop.bottom) nextQuad.bottomRight.y = crop.bottom;

  return nextQuad;
}

function scheduleDetailRefresh() {
  clearTimeout(state.detailRefreshTimer);
  state.detailRefreshTimer = setTimeout(() => {
    refreshDetailImages();
  }, 120);
}

async function refreshDetailImages() {
  if (!state.currentSheet || !state.currentSheet.detailUrlBase || !state.quad) return;
  const currentSheetId = state.currentSheetId;
  const tasks = QUAD_KEYS.map(async (cornerKey) => {
    const region = computeSourceDetailRegion(cornerKey);
    const requestKey = `${region.left}:${region.top}:${region.size}`;
    if (state.detailRequestKeys[cornerKey] === requestKey && state.detailImages[cornerKey]?.image) return;
    state.detailRequestKeys[cornerKey] = requestKey;
    const image = new Image();
    image.src = `${state.currentSheet.detailUrlBase}?left=${region.left}&top=${region.top}&size=${region.size}&width=${DETAIL_OUTPUT_WIDTH}&t=${Date.now()}`;
    await image.decode();
    if (state.currentSheetId !== currentSheetId || state.detailRequestKeys[cornerKey] !== requestKey) return;
    state.detailImages[cornerKey] = { image, region, requestKey };
  });

  try {
    await Promise.all(tasks);
    if (state.currentSheetId === currentSheetId) drawAllWithoutRefresh();
  } catch (error) {
    console.error(error);
  }
}

function computeSourceDetailRegion(cornerKey) {
  const sourcePoint = previewPointToSource(state.quad[cornerKey]);
  const maxSize = Math.min(DETAIL_REGION_SIZE, state.currentSheet.sourceImage.width, state.currentSheet.sourceImage.height);
  const left = clamp(Math.round(sourcePoint.x - maxSize / 2), 0, state.currentSheet.sourceImage.width - maxSize);
  const top = clamp(Math.round(sourcePoint.y - maxSize / 2), 0, state.currentSheet.sourceImage.height - maxSize);
  return {
    size: maxSize,
    left,
    top,
    point: sourcePoint
  };
}

function previewPointToSource(point) {
  const previewWidth = state.image?.naturalWidth || state.image?.width || state.currentSheet.previewImage.width;
  const previewHeight = state.image?.naturalHeight || state.image?.height || state.currentSheet.previewImage.height;
  return {
    x: Math.round(point.x * (state.currentSheet.sourceImage.width / previewWidth)),
    y: Math.round(point.y * (state.currentSheet.sourceImage.height / previewHeight))
  };
}

function drawDetailGuides(ctx, cornerKey, region) {
  const detailImage = state.detailImages[cornerKey]?.image;
  const renderedWidth = detailImage?.naturalWidth || detailImage?.width || ctx.canvas.width;
  const renderedHeight = detailImage?.naturalHeight || detailImage?.height || ctx.canvas.height;
  const sourcePoint = previewPointToSource(state.quad[cornerKey]);
  const scaleX = ctx.canvas.width / renderedWidth;
  const scaleY = ctx.canvas.height / renderedHeight;
  const lineX = (sourcePoint.x - region.left) * scaleX;
  const lineY = (sourcePoint.y - region.top) * scaleY;
  const cropLeft = (previewPointToSource({ x: state.crop.left, y: 0 }).x - region.left) * scaleX;
  const cropRight = (previewPointToSource({ x: state.crop.right, y: 0 }).x - region.left) * scaleX;
  const cropTop = (previewPointToSource({ x: 0, y: state.crop.top }).y - region.top) * scaleY;
  const cropBottom = (previewPointToSource({ x: 0, y: state.crop.bottom }).y - region.top) * scaleY;

  ctx.strokeStyle = "rgba(210, 50, 36, 0.95)";
  ctx.lineWidth = 2;

  if (cornerKey === "topLeft" || cornerKey === "bottomLeft") {
    ctx.beginPath();
    ctx.moveTo(cropLeft, 0);
    ctx.lineTo(cropLeft, ctx.canvas.height);
    ctx.stroke();
  }
  if (cornerKey === "topRight" || cornerKey === "bottomRight") {
    ctx.beginPath();
    ctx.moveTo(cropRight, 0);
    ctx.lineTo(cropRight, ctx.canvas.height);
    ctx.stroke();
  }
  if (cornerKey === "topLeft" || cornerKey === "topRight") {
    ctx.beginPath();
    ctx.moveTo(0, cropTop);
    ctx.lineTo(ctx.canvas.width, cropTop);
    ctx.stroke();
  }
  if (cornerKey === "bottomLeft" || cornerKey === "bottomRight") {
    ctx.beginPath();
    ctx.moveTo(0, cropBottom);
    ctx.lineTo(ctx.canvas.width, cropBottom);
    ctx.stroke();
  }

  ctx.strokeStyle = "#ffcd40";
  ctx.beginPath();
  ctx.moveTo(lineX, 0);
  ctx.lineTo(lineX, ctx.canvas.height);
  ctx.moveTo(0, lineY);
  ctx.lineTo(ctx.canvas.width, lineY);
  ctx.stroke();

  ctx.fillStyle = "#ffcd40";
  ctx.beginPath();
  ctx.arc(lineX, lineY, 4, 0, Math.PI * 2);
  ctx.fill();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
