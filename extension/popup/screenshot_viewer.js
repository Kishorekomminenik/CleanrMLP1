import {
  COLOR_OPTIONS,
  DEFAULT_ANNOTATION_STYLE,
  FONT_OPTIONS,
  OPACITY_OPTIONS,
  SIZE_OPTIONS,
  WEIGHT_OPTIONS,
  normalizeAnnotationStyle,
  resolveFontFamily,
  resolveFontWeight,
} from "../shared/annotationConfig.js";

const APP_TAGLINE = "QA evidence recorder";
const manifest = chrome.runtime.getManifest();
const appName = manifest && manifest.name ? manifest.name : "Repro";
document.title = `${appName} — ${APP_TAGLINE}`;

const baseCanvas = document.getElementById("baseCanvas");
const bootErrorEl = document.getElementById("editor_boot_error");
const drawCanvas = document.getElementById("drawCanvas");
const previewCanvas = document.getElementById("previewCanvas");
const textLayer = document.getElementById("textLayer");
const canvasWrap = document.getElementById("canvasWrap");
const stage = document.getElementById("stage");

const toolButtons = {
  pointer: document.getElementById("toolPointer"),
  pen: document.getElementById("toolPen"),
  rectangle: document.getElementById("toolRectangle"),
  arrow: document.getElementById("toolArrow"),
  highlight: document.getElementById("toolHighlight"),
  circle: document.getElementById("toolCircle"),
  text: document.getElementById("toolText"),
  step: document.getElementById("toolStep"),
  blur: document.getElementById("toolBlur"),
};

const controls = {
  mainColor: document.getElementById("mainColor"),
  penWidth: document.getElementById("penWidth"),
  circleWidth: document.getElementById("circleWidth"),
  highlightColor: document.getElementById("highlightColor"),
  highlightOpacity: document.getElementById("highlightOpacity"),
  blurStrength: document.getElementById("blurStrength"),
  stepSize: document.getElementById("stepSize"),
  textSize: document.getElementById("textSize"),
  textFontFamily: document.getElementById("textFontFamily"),
  textWeight: document.getElementById("textWeight"),
  textColor: document.getElementById("textColor"),
  textOpacity: document.getElementById("textOpacity"),
};

const buttons = {
  undo: document.getElementById("btnUndo"),
  redo: document.getElementById("btnRedo"),
  clear: document.getElementById("btnClear"),
  copy: document.getElementById("btnCopy"),
  copyCompressed: document.getElementById("btnCopyCompressed"),
  download: document.getElementById("btnDownload"),
  downloadCompressed: document.getElementById("btnDownloadCompressed"),
  resetSteps: document.getElementById("btnResetSteps"),
  zoomIn: document.getElementById("btnZoomIn"),
  zoomOut: document.getElementById("btnZoomOut"),
  zoomFit: document.getElementById("btnZoomFit"),
  zoomActual: document.getElementById("btnZoomActual"),
};

const statusEl = document.getElementById("statusText");
const statusMetricsEl = document.getElementById("statusMetrics");

const baseCtx = baseCanvas.getContext("2d", { willReadFrequently: true });
const drawCtx = drawCanvas.getContext("2d", { willReadFrequently: true });
const previewCtx = previewCanvas.getContext("2d", { willReadFrequently: true });

const TOOL = {
  pointer: "pointer",
  pen: "pen",
  rectangle: "rectangle",
  arrow: "arrow",
  highlight: "highlight",
  circle: "circle",
  text: "text",
  step: "step",
  blur: "blur",
};

let latestScreenshotDataUrl = null;
let statusTimer = null;
let imageSize = { width: 0, height: 0 };
let scale = 1;
let fitScale = 1;
let zoom = 1;
let panState = null;
let currentTool = TOOL.pointer;
let isDrawing = false;
let startPoint = null;
let activePointerId = null;
let dragState = null;
let editingTextEl = null;
let stepCounter = 1;
let isImageLoaded = false;
let pendingPoint = null;
let pendingShift = false;
let rafPending = false;
let toolPerfStart = null;
let annotations = [];
let editingAnnotationId = null;
let activeAnnotation = null;

let undoStack = [];
let redoStack = [];

const DEFAULT_TEXT_SETTINGS = { ...DEFAULT_ANNOTATION_STYLE };

function setCopyLabel(text) {
  const label = buttons.copy ? buttons.copy.querySelector(".btn-label") : null;
  if (label) {
    label.textContent = text;
  } else if (buttons.copy) {
    buttons.copy.textContent = text;
  }
}

function setStatus(message, type = "default", autoResetMs = 0) {
  statusEl.textContent = message;
  if (type === "error") {
    statusEl.style.color = "#b91c1c";
  } else if (type === "success") {
    statusEl.style.color = "#166534";
  } else {
    statusEl.style.color = "#4b5563";
  }
  if (statusTimer) {
    clearTimeout(statusTimer);
    statusTimer = null;
  }
  if (autoResetMs > 0) {
    statusTimer = setTimeout(() => {
      statusEl.textContent = "Ready.";
      statusEl.style.color = "#4b5563";
      statusTimer = null;
    }, autoResetMs);
  }
}

function formatTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function hexToRgba(hex, opacity) {
  const normalized = hex.replace("#", "");
  const int = parseInt(normalized, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function updateHistoryButtons() {
  buttons.undo.disabled = undoStack.length <= 1;
  buttons.redo.disabled = redoStack.length === 0;
}

function getAnnotationCount() {
  return annotations.length;
}

function updateStatusMetrics() {
  if (!statusMetricsEl) {
    return;
  }
  if (!imageSize.width || !imageSize.height) {
    statusMetricsEl.textContent = "—";
    return;
  }
  const zoomPercent = Math.round(scale * 100);
  const annotationCount = getAnnotationCount();
  statusMetricsEl.textContent = `${imageSize.width}×${imageSize.height} • ${zoomPercent}% • ${annotationCount} annotations`;
}

function setEditorEnabled(enabled) {
  Object.values(toolButtons).forEach((button) => {
    button.disabled = !enabled;
  });
  Object.values(controls).forEach((control) => {
    control.disabled = !enabled;
  });
  buttons.clear.disabled = !enabled;
  buttons.copy.disabled = !enabled;
  if (buttons.copyCompressed) {
    buttons.copyCompressed.disabled = !enabled;
  }
  buttons.download.disabled = !enabled;
  if (buttons.downloadCompressed) {
    buttons.downloadCompressed.disabled = !enabled;
  }
  if (buttons.resetSteps) {
    buttons.resetSteps.disabled = !enabled;
  }
  if (buttons.zoomIn) {
    buttons.zoomIn.disabled = !enabled;
    buttons.zoomOut.disabled = !enabled;
    buttons.zoomFit.disabled = !enabled;
    buttons.zoomActual.disabled = !enabled;
  }
  if (!enabled) {
    setCopyLabel("Copy (loading...)");
  } else {
    setCopyLabel("Copy");
  }
  if (!enabled) {
    isImageLoaded = false;
  }
  updateHistoryButtons();
}

function clearPreview() {
  if (!previewCtx || !previewCanvas) {
    return;
  }
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
}

function formatOpacityLabel(value) {
  return `${Math.round(value * 100)}%`;
}

function renderTextOptions() {
  const setOptions = (select, options, formatter) => {
    if (!select) {
      return;
    }
    select.innerHTML = "";
    options.forEach((optionValue) => {
      const option = document.createElement("option");
      option.value = String(optionValue);
      option.textContent = formatter ? formatter(optionValue) : String(optionValue);
      select.appendChild(option);
    });
  };
  setOptions(controls.textFontFamily, FONT_OPTIONS);
  setOptions(controls.textSize, SIZE_OPTIONS);
  setOptions(controls.textWeight, WEIGHT_OPTIONS);
  setOptions(controls.textColor, COLOR_OPTIONS);
  setOptions(controls.textOpacity, OPACITY_OPTIONS, formatOpacityLabel);
}

async function loadAnnotationSettings() {
  renderTextOptions();
  const result = await chrome.storage.session.get({
    latestScreenshotAnnotationStyle: null,
    annotationSettings: null,
  });
  const settings = normalizeAnnotationStyle(
    result.latestScreenshotAnnotationStyle ||
      result.annotationSettings ||
      DEFAULT_TEXT_SETTINGS
  );
  if (controls.textFontFamily) {
    controls.textFontFamily.value = settings.fontFamily;
  }
  if (controls.textWeight) {
    controls.textWeight.value = settings.fontWeight;
  }
  if (controls.textSize) {
    controls.textSize.value = String(settings.fontSize);
  }
  if (controls.textColor) {
    controls.textColor.value = settings.color;
  }
  if (controls.textOpacity) {
    controls.textOpacity.value = String(settings.opacity);
  }
}

function getAnnotationSettings() {
  return normalizeAnnotationStyle({
    fontFamily: controls.textFontFamily
      ? controls.textFontFamily.value
      : DEFAULT_TEXT_SETTINGS.fontFamily,
    fontSize: controls.textSize
      ? Number(controls.textSize.value)
      : DEFAULT_TEXT_SETTINGS.fontSize,
    fontWeight: controls.textWeight
      ? controls.textWeight.value
      : DEFAULT_TEXT_SETTINGS.fontWeight,
    color: controls.textColor ? controls.textColor.value : DEFAULT_TEXT_SETTINGS.color,
    opacity: controls.textOpacity
      ? Number(controls.textOpacity.value)
      : DEFAULT_TEXT_SETTINGS.opacity,
  });
}

async function saveAnnotationSettings() {
  const settings = getAnnotationSettings();
  await chrome.storage.session.set({
    annotationSettings: settings,
    latestScreenshotAnnotationStyle: settings,
  });
}

function applySettingsToEditingText() {
  if (!editingTextEl) {
    return;
  }
  const settings = getAnnotationSettings();
  editingTextEl.dataset.color = settings.color;
  editingTextEl.dataset.fontSize = String(settings.fontSize);
  editingTextEl.dataset.fontFamily = settings.fontFamily;
  editingTextEl.dataset.fontWeight = settings.fontWeight;
  editingTextEl.dataset.opacity = String(settings.opacity);
  const annotation = getAnnotationById(editingTextEl.dataset.id);
  if (annotation) {
    annotation.color = settings.color;
    annotation.fontSize = settings.fontSize;
    annotation.fontFamily = settings.fontFamily;
    annotation.fontWeight = settings.fontWeight;
    annotation.opacity = settings.opacity;
  }
  applyTextStyle(editingTextEl);
  positionTextElement(editingTextEl);
}

function setTool(tool) {
  currentTool = tool;
  Object.entries(toolButtons).forEach(([key, button]) => {
    button.classList.toggle("active", key === tool);
  });
  updateControlVisibility();
  updateInteractivity();
  if ([TOOL.pen, TOOL.rectangle, TOOL.arrow, TOOL.highlight, TOOL.circle, TOOL.blur].includes(tool)) {
    drawCanvas.style.cursor = "crosshair";
  } else if (tool === TOOL.text) {
    drawCanvas.style.cursor = "text";
  } else {
    drawCanvas.style.cursor = "default";
  }
}

function updateControlVisibility() {
  const groups = document.querySelectorAll(".control-group");
  groups.forEach((group) => {
    const controlsAttr = group.dataset.controls || "";
    const controlsList = controlsAttr.split(" ").filter(Boolean);
    group.classList.toggle("is-hidden", !controlsList.includes(currentTool));
  });
  if (buttons.resetSteps) {
    buttons.resetSteps.classList.toggle("is-hidden", currentTool !== TOOL.step);
  }
}

function updateInteractivity() {
  if (currentTool === TOOL.text || currentTool === TOOL.pointer) {
    textLayer.classList.add("is-interactive");
    drawCanvas.style.pointerEvents = "none";
  } else {
    textLayer.classList.remove("is-interactive");
    drawCanvas.style.pointerEvents = "auto";
  }
}

function getCanvasPoint(event) {
  const rect = drawCanvas.getBoundingClientRect();
  const scaleX = rect.width ? imageSize.width / rect.width : 1;
  const scaleY = rect.height ? imageSize.height / rect.height : 1;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  return {
    x: clamp(x, 0, imageSize.width),
    y: clamp(y, 0, imageSize.height),
  };
}

function logPointerMap(event, point) {
  console.log("[EDITOR][POINTER_MAP]", {
    clientX: event.clientX,
    clientY: event.clientY,
    imageX: Math.round(point.x),
    imageY: Math.round(point.y),
    zoom: Number(scale.toFixed(3)),
    scrollLeft: stage.scrollLeft,
    scrollTop: stage.scrollTop,
  });
}

function updateScale() {
  if (!imageSize.width || !imageSize.height) {
    return;
  }
  const stageRect = stage.getBoundingClientRect();
  const maxWidth = Math.max(stageRect.width - 32, 100);
  const maxHeight = Math.max(stageRect.height - 32, 100);
  const scaleX = maxWidth / imageSize.width;
  const scaleY = maxHeight / imageSize.height;
  fitScale = Math.min(1, scaleX, scaleY);
  scale = clamp(fitScale * zoom, 0.1, 6);
  canvasWrap.style.width = `${imageSize.width * scale}px`;
  canvasWrap.style.height = `${imageSize.height * scale}px`;
  updateTextPositions();
  updateStatusMetrics();
  console.log("[EDITOR][ZOOM_CHANGED]", {
    zoom: Number(scale.toFixed(3)),
    panX: stage.scrollLeft,
    panY: stage.scrollTop,
  });
}

function setZoom(nextZoom) {
  const stageRect = stage.getBoundingClientRect();
  const centerX = (stage.scrollLeft + stageRect.width / 2) / scale;
  const centerY = (stage.scrollTop + stageRect.height / 2) / scale;
  zoom = clamp(nextZoom, 0.2, 6);
  updateScale();
  stage.scrollLeft = Math.max(0, centerX * scale - stageRect.width / 2);
  stage.scrollTop = Math.max(0, centerY * scale - stageRect.height / 2);
}

function zoomToFit() {
  zoom = 1;
  updateScale();
  stage.scrollTop = 0;
  stage.scrollLeft = 0;
}

function zoomToActual() {
  zoom = fitScale > 0 ? 1 / fitScale : 1;
  updateScale();
}

function createId() {
  return `text_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function applyTextStyle(el) {
  const size = Number(el.dataset.fontSize) || DEFAULT_TEXT_SETTINGS.fontSize;
  const color = el.dataset.color || DEFAULT_TEXT_SETTINGS.color;
  const opacity = Number(el.dataset.opacity);
  const weight = resolveFontWeight(
    el.dataset.fontWeight || DEFAULT_TEXT_SETTINGS.fontWeight
  );
  const fontFamily = resolveFontFamily(
    el.dataset.fontFamily || DEFAULT_TEXT_SETTINGS.fontFamily
  );
  const colorValue =
    !Number.isNaN(opacity) && opacity < 1
      ? hexToRgba(color, opacity)
      : color;
  el.style.color = colorValue;
  el.style.fontSize = `${size * scale}px`;
  el.style.fontWeight = weight;
  el.style.fontFamily = fontFamily;
}

function positionTextElement(el) {
  const x = Number(el.dataset.x) || 0;
  const y = Number(el.dataset.y) || 0;
  el.style.left = `${x * scale}px`;
  el.style.top = `${y * scale}px`;
}

function updateTextPositions() {
  const labels = textLayer.querySelectorAll(".text-label");
  labels.forEach((label) => {
    applyTextStyle(label);
    positionTextElement(label);
  });
}

function cloneAnnotations(value) {
  return JSON.parse(JSON.stringify(value));
}

function getTextAnnotations() {
  return annotations.filter((item) => item.type === "text");
}

function rebuildTextLayer() {
  if (editingTextEl) {
    updateTextPositions();
    return;
  }
  textLayer.innerHTML = "";
  getTextAnnotations().forEach((text) => {
    const el = buildTextElement(text);
    textLayer.appendChild(el);
  });
}

function syncStepCounter() {
  const maxStep = annotations
    .filter((item) => item.type === "step")
    .reduce((max, item) => Math.max(max, item.stepNumber || 0), 0);
  stepCounter = maxStep + 1;
}

function pushState() {
  if (!imageSize.width || !imageSize.height) {
    return;
  }
  undoStack.push(cloneAnnotations(annotations));
  redoStack = [];
  updateHistoryButtons();
  updateStatusMetrics();
}

function applyState(state) {
  annotations = cloneAnnotations(state || []);
  syncStepCounter();
  renderAll();
  updateHistoryButtons();
  updateStatusMetrics();
}

function undo() {
  if (undoStack.length <= 1) {
    return;
  }
  const current = undoStack.pop();
  redoStack.push(current);
  const previous = undoStack[undoStack.length - 1];
  applyState(previous);
}

function redo() {
  if (redoStack.length === 0) {
    return;
  }
  const next = redoStack.pop();
  undoStack.push(next);
  applyState(next);
}

function clearAll() {
  annotations = [];
  stepCounter = 1;
  renderAll();
  pushState();
}

function buildTextElement(data) {
  const el = document.createElement("div");
  el.className = "text-label";
  el.dataset.id = data.id || createId();
  el.dataset.x = data.x;
  el.dataset.y = data.y;
  el.dataset.color = data.color;
  el.dataset.fontSize = String(
    typeof data.fontSize === "number" ? data.fontSize : DEFAULT_TEXT_SETTINGS.fontSize
  );
  el.dataset.fontFamily = data.fontFamily || DEFAULT_TEXT_SETTINGS.fontFamily;
  el.dataset.fontWeight = data.fontWeight || DEFAULT_TEXT_SETTINGS.fontWeight;
  el.dataset.opacity =
    typeof data.opacity === "number" && !Number.isNaN(data.opacity)
      ? String(data.opacity)
      : "1";
  el.textContent = data.text || "";
  el.tabIndex = 0;
  applyTextStyle(el);
  positionTextElement(el);
  attachTextHandlers(el);
  return el;
}

function startEditing(el) {
  if (editingTextEl && editingTextEl !== el) {
    editingTextEl.blur();
  }
  editingTextEl = el;
  editingAnnotationId = el.dataset.id;
  if (!el.dataset.originalText) {
    el.dataset.originalText = el.innerText || "";
  }
  el.contentEditable = "true";
  el.classList.add("editing");
  el.focus();
  requestAnimationFrame(() => {
    el.focus();
  });
  console.log("[TEXT][EDIT_START]", {
    id: el.dataset.id,
    isConnected: Boolean(el && el.isConnected),
  });
  const placeCaret = () => {
    if (!el || !el.isConnected || !document.contains(el)) {
      console.log("[TEXT][CARET_SKIP]", {
        id: el ? el.dataset.id : null,
        reason: "detached",
      });
      return;
    }
    const selection = window.getSelection();
    if (!selection) {
      console.log("[TEXT][CARET_SKIP]", {
        id: el.dataset.id,
        reason: "no_selection",
      });
      return;
    }
    try {
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      if (selection.rangeCount > 0) {
        selection.removeAllRanges();
      }
      selection.addRange(range);
      console.log("[TEXT][CARET_ATTACH]", {
        id: el.dataset.id,
        success: true,
      });
    } catch (error) {
      console.log("[TEXT][CARET_SKIP]", {
        id: el.dataset.id,
        reason: "range_error",
      });
    }
  };
  requestAnimationFrame(placeCaret);
  console.log("[TEXT] start editing", el.dataset.id);
  console.log("activeElement", document.activeElement);
}

function finalizeEditing(el) {
  if (!el) {
    return;
  }
  el.contentEditable = "false";
  el.classList.remove("editing");
  const text = el.innerText.replace(/\r/g, "");
  if (text.trim() === "") {
    removeAnnotationById(el.dataset.id);
    el.remove();
  } else {
    el.textContent = text;
    const annotation = getAnnotationById(el.dataset.id);
    if (annotation) {
      annotation.text = text;
      annotation.x = Number(el.dataset.x) || annotation.x;
      annotation.y = Number(el.dataset.y) || annotation.y;
      annotation.color = el.dataset.color || annotation.color;
      annotation.fontSize = Number(el.dataset.fontSize) || annotation.fontSize;
      annotation.fontFamily = el.dataset.fontFamily || annotation.fontFamily;
      annotation.fontWeight = el.dataset.fontWeight || annotation.fontWeight;
      annotation.opacity = Number(el.dataset.opacity) || annotation.opacity;
    }
  }
  delete el.dataset.originalText;
  editingTextEl = null;
  editingAnnotationId = null;
  renderAll();
  pushState();
  console.log("[EDITOR][ANNOTATION_EDIT]", { toolType: "text" });
}

function attachTextHandlers(el) {
  el.addEventListener("dblclick", (event) => {
    event.stopPropagation();
    startEditing(el);
  });
  el.addEventListener("blur", () => {
    if (el.contentEditable === "true") {
      finalizeEditing(el);
    }
  });
  el.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && el.contentEditable === "true") {
      event.preventDefault();
      const original = el.dataset.originalText || "";
      if (original.trim() === "") {
        removeAnnotationById(el.dataset.id);
        el.remove();
        editingTextEl = null;
        editingAnnotationId = null;
      } else {
        el.textContent = original;
        el.blur();
      }
      delete el.dataset.originalText;
      return;
    }
    if (
      event.key === "Enter" &&
      el.contentEditable === "true" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      el.blur();
      return;
    }
    if (
      (event.key === "Delete" || event.key === "Backspace") &&
      el.contentEditable !== "true"
    ) {
      event.preventDefault();
      removeAnnotationById(el.dataset.id);
      el.remove();
      renderAll();
      pushState();
    }
  });
  el.addEventListener("click", () => {
    if (currentTool === TOOL.pointer && el.contentEditable !== "true") {
      el.focus();
    }
  });
  el.addEventListener("pointerdown", (event) => {
    if (currentTool !== TOOL.pointer || el.contentEditable === "true") {
      return;
    }
    if (event.button !== 0) {
      return;
    }
    if (editingTextEl && editingTextEl !== el) {
      editingTextEl.blur();
    }
    const point = getCanvasPoint(event);
    dragState = {
      el,
      annotationId: el.dataset.id,
      offsetX: point.x - Number(el.dataset.x || 0),
      offsetY: point.y - Number(el.dataset.y || 0),
      moved: false,
    };
    el.classList.add("is-dragging");
    activePointerId = event.pointerId;
    textLayer.setPointerCapture(event.pointerId);
  });
}

function handleTextLayerPointerMove(event) {
  if (!dragState || event.pointerId !== activePointerId) {
    return;
  }
  const point = getCanvasPoint(event);
  const newX = point.x - dragState.offsetX;
  const newY = point.y - dragState.offsetY;
  dragState.el.dataset.x = newX;
  dragState.el.dataset.y = newY;
  const annotation = getAnnotationById(dragState.annotationId);
  if (annotation) {
    annotation.x = newX;
    annotation.y = newY;
  }
  positionTextElement(dragState.el);
  dragState.moved = true;
}

function handleTextLayerPointerUp(event) {
  if (!dragState || event.pointerId !== activePointerId) {
    return;
  }
  dragState.el.classList.remove("is-dragging");
  if (dragState.moved) {
    pushState();
    console.log("[EDITOR][ANNOTATION_EDIT]", { toolType: "text" });
  }
  dragState = null;
  activePointerId = null;
}

function drawHighlightRect(start, end, ctx = drawCtx) {
  const width = end.x - start.x;
  const height = end.y - start.y;
  ctx.fillStyle = hexToRgba(
    controls.highlightColor.value,
    Number(controls.highlightOpacity.value)
  );
  ctx.fillRect(start.x, start.y, width, height);
}

function drawRectangle(start, end, lineWidth, color, ctx = drawCtx) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
}

function drawArrow(start, end, lineWidth, color, ctx = drawCtx) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const angle = Math.atan2(dy, dx);
  const headLength = Math.max(8, lineWidth * 3);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(
    end.x - headLength * Math.cos(angle - Math.PI / 6),
    end.y - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    end.x - headLength * Math.cos(angle + Math.PI / 6),
    end.y - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
}

function drawEllipse(start, end, lineWidth, color, ctx = drawCtx) {
  const cx = (start.x + end.x) / 2;
  const cy = (start.y + end.y) / 2;
  const rx = Math.abs(end.x - start.x) / 2;
  const ry = Math.abs(end.y - start.y) / 2;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function addStepMarker(point) {
  const stepSize = controls.stepSize ? controls.stepSize.value : "md";
  const annotation = {
    id: createId(),
    type: "step",
    x: point.x,
    y: point.y,
    stepNumber: stepCounter,
    stepSize,
    color: controls.mainColor.value,
  };
  console.log("[EDITOR][STEP_ADD]", { stepNumber: stepCounter, stepSize });
  stepCounter += 1;
  addAnnotation(annotation);
}

function drawBlurPreview(start, end, ctx = previewCtx) {
  if (!ctx) {
    return;
  }
  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
  ctx.setLineDash([]);
}

function resolveStepStyle(stepSize) {
  switch (stepSize) {
    case "sm":
      return { radius: 10, fontSize: 11 };
    case "lg":
      return { radius: 18, fontSize: 16 };
    case "xl":
      return { radius: 22, fontSize: 18 };
    default:
      return { radius: 14, fontSize: 14 };
  }
}

function drawStepAnnotation(ctx, annotation) {
  const style = resolveStepStyle(annotation.stepSize || "md");
  ctx.fillStyle = annotation.color;
  ctx.beginPath();
  ctx.arc(annotation.x, annotation.y, style.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${style.fontSize}px system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(annotation.stepNumber), annotation.x, annotation.y);
}

function drawPenAnnotation(ctx, annotation) {
  if (!annotation.points || annotation.points.length < 2) {
    return;
  }
  ctx.strokeStyle = annotation.color;
  ctx.lineWidth = annotation.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
  annotation.points.slice(1).forEach((point) => {
    ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();
}

function drawArrowAnnotation(ctx, annotation) {
  drawArrow(
    { x: annotation.startX, y: annotation.startY },
    { x: annotation.endX, y: annotation.endY },
    annotation.size,
    annotation.color,
    ctx
  );
}

function drawRectAnnotation(ctx, annotation) {
  drawRectangle(
    { x: annotation.x, y: annotation.y },
    { x: annotation.x + annotation.width, y: annotation.y + annotation.height },
    annotation.size,
    annotation.color,
    ctx
  );
}

function drawCircleAnnotation(ctx, annotation) {
  drawEllipse(
    { x: annotation.x, y: annotation.y },
    { x: annotation.x + annotation.width, y: annotation.y + annotation.height },
    annotation.size,
    annotation.color,
    ctx
  );
}

function drawHighlightAnnotation(ctx, annotation) {
  const fill = hexToRgba(annotation.color, annotation.opacity);
  ctx.fillStyle = fill;
  ctx.fillRect(annotation.x, annotation.y, annotation.width, annotation.height);
}

function drawBlurAnnotation(ctx, annotation, sourceCanvas) {
  const width = annotation.width;
  const height = annotation.height;
  if (width < 2 || height < 2) {
    return;
  }
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.filter = `blur(${annotation.blurStrength}px)`;
  tempCtx.drawImage(
    sourceCanvas,
    annotation.x,
    annotation.y,
    width,
    height,
    0,
    0,
    width,
    height
  );
  ctx.drawImage(tempCanvas, annotation.x, annotation.y);
}

function renderAnnotations(ctx, options = {}) {
  const includeText = options.includeText === true;
  const sourceCanvas = options.sourceCanvas || baseCanvas;
  annotations
    .filter((item) => item.type === "blur")
    .forEach((item) => drawBlurAnnotation(ctx, item, sourceCanvas));
  annotations.forEach((item) => {
    switch (item.type) {
      case "pen":
        drawPenAnnotation(ctx, item);
        break;
      case "rectangle":
        drawRectAnnotation(ctx, item);
        break;
      case "arrow":
        drawArrowAnnotation(ctx, item);
        break;
      case "highlight":
        drawHighlightAnnotation(ctx, item);
        break;
      case "circle":
        drawCircleAnnotation(ctx, item);
        break;
      case "step":
        drawStepAnnotation(ctx, item);
        break;
      case "text":
        if (includeText) {
          const opacityValue = Number(item.opacity);
          const colorValue =
            !Number.isNaN(opacityValue) && opacityValue < 1
              ? hexToRgba(item.color, opacityValue)
              : item.color;
          ctx.font = `${item.fontWeight} ${item.fontSize}px ${item.fontFamily}`;
          ctx.fillStyle = colorValue;
          ctx.textBaseline = "top";
          const lines = (item.text || "").split("\n");
          const lineHeight = item.fontSize * 1.2;
          lines.forEach((line, index) => {
            ctx.fillText(line, item.x, item.y + index * lineHeight);
          });
        }
        break;
      default:
        break;
    }
  });
}

function renderAll() {
  if (!drawCtx || !previewCtx) {
    return;
  }
  drawCtx.clearRect(0, 0, imageSize.width, imageSize.height);
  clearPreview();
  renderAnnotations(drawCtx, { includeText: false, sourceCanvas: baseCanvas });
  rebuildTextLayer();
}

function addAnnotation(annotation) {
  annotations.push(annotation);
  renderAll();
  pushState();
  console.log("[EDITOR][ANNOTATION_ADD]", {
    toolType: annotation.type,
    imageSpace: true,
  });
}

function getAnnotationById(id) {
  return annotations.find((item) => item.id === id);
}

function removeAnnotationById(id) {
  annotations = annotations.filter((item) => item.id !== id);
}

function startDrawing(point) {
  toolPerfStart = performance.now();
  if (currentTool === TOOL.pen) {
    drawCtx.strokeStyle = controls.mainColor.value;
    drawCtx.lineWidth = Number(controls.penWidth.value);
    drawCtx.lineCap = "round";
    drawCtx.lineJoin = "round";
    drawCtx.beginPath();
    drawCtx.moveTo(point.x, point.y);
    activeAnnotation = {
      id: createId(),
      type: "pen",
      points: [{ x: point.x, y: point.y }],
      color: controls.mainColor.value,
      size: Number(controls.penWidth.value),
    };
  } else if (
    [TOOL.highlight, TOOL.circle, TOOL.rectangle, TOOL.arrow, TOOL.blur].includes(
      currentTool
    )
  ) {
    clearPreview();
    activeAnnotation = null;
  }
  isDrawing = true;
  startPoint = point;
}

function constrainPoint(start, end, mode, shiftKey) {
  if (!shiftKey) {
    return end;
  }
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (mode === "square") {
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    return { x: start.x + Math.sign(dx || 1) * size, y: start.y + Math.sign(dy || 1) * size };
  }
  if (mode === "axis") {
    if (Math.abs(dx) >= Math.abs(dy)) {
      return { x: end.x, y: start.y };
    }
    return { x: start.x, y: end.y };
  }
  return end;
}

function updateDrawing(point, shiftKey = false) {
  if (!isDrawing || !startPoint) {
    return;
  }
  if (currentTool === TOOL.pen) {
    drawCtx.lineTo(point.x, point.y);
    drawCtx.stroke();
    if (activeAnnotation) {
      activeAnnotation.points.push({ x: point.x, y: point.y });
    }
    return;
  }
  clearPreview();
  if (currentTool === TOOL.highlight) {
    drawHighlightRect(startPoint, point, previewCtx);
  } else if (currentTool === TOOL.circle) {
    drawEllipse(
      startPoint,
      point,
      Number(controls.circleWidth.value),
      controls.mainColor.value,
      previewCtx
    );
  } else if (currentTool === TOOL.rectangle) {
    const end = constrainPoint(startPoint, point, "square", shiftKey);
    drawRectangle(
      startPoint,
      end,
      Number(controls.penWidth.value),
      controls.mainColor.value,
      previewCtx
    );
  } else if (currentTool === TOOL.arrow) {
    const end = constrainPoint(startPoint, point, "axis", shiftKey);
    drawArrow(
      startPoint,
      end,
      Number(controls.penWidth.value),
      controls.mainColor.value,
      previewCtx
    );
  } else if (currentTool === TOOL.blur) {
    drawBlurPreview(startPoint, point, previewCtx);
  }
}

function finishDrawing(point, shiftKey = false) {
  if (!isDrawing) {
    return;
  }
  if (currentTool === TOOL.pen) {
    drawCtx.closePath();
    if (activeAnnotation && activeAnnotation.points.length > 1) {
      annotations.push(activeAnnotation);
      renderAll();
      pushState();
      console.log("[EDITOR][ANNOTATION_ADD]", { toolType: "pen", imageSpace: true });
    }
    activeAnnotation = null;
  } else if (startPoint) {
    clearPreview();
    const distanceX = Math.abs(point.x - startPoint.x);
    const distanceY = Math.abs(point.y - startPoint.y);
    if (distanceX > 1 || distanceY > 1) {
      const baseAnnotation = {
        id: createId(),
        color: controls.mainColor.value,
      };
      if (currentTool === TOOL.highlight) {
        const x = Math.min(startPoint.x, point.x);
        const y = Math.min(startPoint.y, point.y);
        addAnnotation({
          ...baseAnnotation,
          type: "highlight",
          color: controls.highlightColor.value,
          x,
          y,
          width: Math.abs(point.x - startPoint.x),
          height: Math.abs(point.y - startPoint.y),
          opacity: Number(controls.highlightOpacity.value),
        });
      } else if (currentTool === TOOL.circle) {
        const x = Math.min(startPoint.x, point.x);
        const y = Math.min(startPoint.y, point.y);
        addAnnotation({
          ...baseAnnotation,
          type: "circle",
          x,
          y,
          width: Math.abs(point.x - startPoint.x),
          height: Math.abs(point.y - startPoint.y),
          size: Number(controls.circleWidth.value),
        });
      } else if (currentTool === TOOL.rectangle) {
        const end = constrainPoint(startPoint, point, "square", shiftKey);
        const x = Math.min(startPoint.x, end.x);
        const y = Math.min(startPoint.y, end.y);
        addAnnotation({
          ...baseAnnotation,
          type: "rectangle",
          x,
          y,
          width: Math.abs(end.x - startPoint.x),
          height: Math.abs(end.y - startPoint.y),
          size: Number(controls.penWidth.value),
        });
      } else if (currentTool === TOOL.arrow) {
        const end = constrainPoint(startPoint, point, "axis", shiftKey);
        addAnnotation({
          ...baseAnnotation,
          type: "arrow",
          startX: startPoint.x,
          startY: startPoint.y,
          endX: end.x,
          endY: end.y,
          size: Number(controls.penWidth.value),
        });
      } else if (currentTool === TOOL.blur) {
        const x = Math.min(startPoint.x, point.x);
        const y = Math.min(startPoint.y, point.y);
        addAnnotation({
          ...baseAnnotation,
          type: "blur",
          x,
          y,
          width: Math.abs(point.x - startPoint.x),
          height: Math.abs(point.y - startPoint.y),
          blurStrength: Number(controls.blurStrength.value) || 8,
        });
      }
    }
  }
  isDrawing = false;
  startPoint = null;
  if (toolPerfStart) {
    const durationMs = Math.round(performance.now() - toolPerfStart);
    console.log("[EDITOR][TOOL_PERF]", {
      toolType: currentTool,
      phase: "commit",
      durationMs,
    });
    toolPerfStart = null;
  }
}

async function loadScreenshot() {
  setStatus("Loading...");
  setEditorEnabled(false);
  isImageLoaded = false;
  console.log("[EDITOR][INIT]", { isImageLoaded: false });
  const params = new URLSearchParams(window.location.search);
  const artifactKey = params.get("artifactKey");
  if (artifactKey) {
    console.log("[FULLPAGE][VIEWER][LOAD_REQUEST]", { artifactKey });
    if (!window.ReproIdb) {
      setStatus("IDB unavailable for full-page viewer.", "error");
      return;
    }
    const artifact = await ReproIdb.getByKey("capture_artifacts", artifactKey);
    console.log("[FULLPAGE][VIEWER][ARTIFACT_RECORD]", {
      artifactKey,
      hasBlobKey: Boolean(artifact && artifact.blobKey),
    });
    if (!artifact || !artifact.blobKey) {
      setStatus("Full-page artifact not found. Capture again.", "error");
      return;
    }
    const blobRecord = await ReproIdb.getByKey("capture_blobs", artifact.blobKey);
    console.log("[FULLPAGE][VIEWER][BLOB_RECORD]", {
      blobType: blobRecord && blobRecord.blob ? blobRecord.blob.type : null,
      blobSize: blobRecord && blobRecord.blob ? blobRecord.blob.size : null,
    });
    if (!blobRecord || !(blobRecord.blob instanceof Blob)) {
      setStatus("Full-page image missing. Capture again.", "error");
      return;
    }
    const objectUrl = URL.createObjectURL(blobRecord.blob);
    const image = new Image();
    image.onload = () => {
      imageSize = { width: image.naturalWidth, height: image.naturalHeight };
      baseCanvas.width = imageSize.width;
      baseCanvas.height = imageSize.height;
      drawCanvas.width = imageSize.width;
      drawCanvas.height = imageSize.height;
      previewCanvas.width = imageSize.width;
      previewCanvas.height = imageSize.height;
      baseCtx.clearRect(0, 0, imageSize.width, imageSize.height);
      baseCtx.drawImage(image, 0, 0);
      drawCtx.clearRect(0, 0, imageSize.width, imageSize.height);
      previewCtx.clearRect(0, 0, imageSize.width, imageSize.height);
      annotations = [];
      editingAnnotationId = null;
      activeAnnotation = null;
      zoom = 1;
      stepCounter = 1;
      updateScale();
      stage.scrollLeft = 0;
      stage.scrollTop = 0;
      setEditorEnabled(true);
      setTool(currentTool);
      undoStack = [];
      redoStack = [];
      renderAll();
      pushState();
      setStatus("Ready.");
      console.log("[EDITOR][INIT]", {
        sourceType: "fullpage",
        imageWidth: imageSize.width,
        imageHeight: imageSize.height,
      });
      isImageLoaded = true;
      console.log("[EDITOR][IMAGE_LOADED]", {
        sourceType: "fullpage",
        isImageLoaded: true,
        width: imageSize.width,
        height: imageSize.height,
      });
      console.log("[FULLPAGE][VIEWER][IMAGE_READY]", { artifactKey });
      URL.revokeObjectURL(objectUrl);
    };
    image.onerror = () => {
      setCopyLabel("Copy");
      setStatus("Failed to load screenshot. Capture again.", "error");
      URL.revokeObjectURL(objectUrl);
    };
    image.src = objectUrl;
    return;
  }
  const result = await chrome.storage.session.get("latestScreenshotDataUrl");
  latestScreenshotDataUrl = result.latestScreenshotDataUrl;
  if (
    typeof latestScreenshotDataUrl !== "string" ||
    !latestScreenshotDataUrl.startsWith("data:image/png")
  ) {
    latestScreenshotDataUrl = null;
    setCopyLabel("Copy");
    setStatus("No screenshot data found. Capture again.", "error");
    return;
  }
  const image = new Image();
  image.onload = () => {
    imageSize = { width: image.naturalWidth, height: image.naturalHeight };
    baseCanvas.width = imageSize.width;
    baseCanvas.height = imageSize.height;
    drawCanvas.width = imageSize.width;
    drawCanvas.height = imageSize.height;
    previewCanvas.width = imageSize.width;
    previewCanvas.height = imageSize.height;
    baseCtx.clearRect(0, 0, imageSize.width, imageSize.height);
    baseCtx.drawImage(image, 0, 0);
    drawCtx.clearRect(0, 0, imageSize.width, imageSize.height);
    previewCtx.clearRect(0, 0, imageSize.width, imageSize.height);
    annotations = [];
    editingAnnotationId = null;
    activeAnnotation = null;
    zoom = 1;
    stepCounter = 1;
    updateScale();
    stage.scrollLeft = 0;
    stage.scrollTop = 0;
    setEditorEnabled(true);
    setTool(currentTool);
    undoStack = [];
    redoStack = [];
    renderAll();
    pushState();
    setStatus("Ready.");
    console.log("[EDITOR][INIT]", {
      sourceType: "snap",
      imageWidth: imageSize.width,
      imageHeight: imageSize.height,
    });
    isImageLoaded = true;
    console.log("[EDITOR][IMAGE_LOADED]", {
      sourceType: "snap",
      isImageLoaded: true,
      width: imageSize.width,
      height: imageSize.height,
    });
  };
  image.onerror = () => {
    latestScreenshotDataUrl = null;
    setCopyLabel("Copy");
    setStatus("Failed to load screenshot. Capture again.", "error");
  };
  image.src = latestScreenshotDataUrl;
}

async function exportAnnotatedBlob() {
  const exportCanvas = await buildExportCanvas();
  return await canvasToBlob(exportCanvas, "image/png");
}

async function buildExportCanvas() {
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (error) {
      // Continue with fallback fonts.
    }
  }
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = imageSize.width;
  exportCanvas.height = imageSize.height;
  const ctx = exportCanvas.getContext("2d");
  ctx.drawImage(baseCanvas, 0, 0);
  renderAnnotations(ctx, { includeText: true, sourceCanvas: baseCanvas });
  console.log("[EDITOR][EXPORT_READY]", {
    width: exportCanvas.width,
    height: exportCanvas.height,
    annotated: true,
  });
  return exportCanvas;
}

async function canvasToBlob(canvas, type, quality) {
  return await new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

async function exportCompressedAnnotatedBlob({
  targetBytes = 4 * 1024 * 1024,
  mimeType = "image/webp",
} = {}) {
  const candidates = [mimeType, "image/jpeg"];
  for (const candidate of candidates) {
    const result = await exportCompressedWithMime(candidate, targetBytes);
    if (result && result.blob) {
      return result;
    }
  }
  return null;
}

async function exportCompressedWithMime(mimeType, targetBytes) {
  const qualitySteps = [0.82, 0.7, 0.6, 0.5, 0.4];
  let canvas = await buildExportCanvas();
  let best = null;
  let scale = 1;
  for (let pass = 0; pass < 3; pass += 1) {
    for (const quality of qualitySteps) {
      const blob = await canvasToBlob(canvas, mimeType, quality);
      if (!blob) {
        return null;
      }
      if (!best || blob.size < best.size) {
        best = { blob, quality, scale };
      }
      if (blob.size <= targetBytes) {
        return { blob, mimeType, quality, scale };
      }
    }
    const nextScale = scale * 0.85;
    if (nextScale < 0.5) {
      break;
    }
    const scaled = document.createElement("canvas");
    scaled.width = Math.max(1, Math.round(canvas.width * 0.85));
    scaled.height = Math.max(1, Math.round(canvas.height * 0.85));
    const ctx = scaled.getContext("2d");
    ctx.drawImage(canvas, 0, 0, scaled.width, scaled.height);
    canvas = scaled;
    scale = nextScale;
  }
  return best ? { blob: best.blob, mimeType, quality: best.quality, scale } : null;
}

async function downloadExportedBlob(blob, filename, saveAs) {
  let objectUrl = null;
  try {
    objectUrl = URL.createObjectURL(blob);
    await chrome.downloads.download({
      url: objectUrl,
      filename,
      saveAs,
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error && error.message ? error.message : "Download failed.",
    };
  } finally {
    if (objectUrl) {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
    }
  }
}

drawCanvas.addEventListener("pointerdown", (event) => {
  console.log("[EDITOR][POINTER_GATE]", { isImageLoaded });
  if (!isImageLoaded) {
    return;
  }
  if (
    ![
      TOOL.pen,
      TOOL.highlight,
      TOOL.circle,
      TOOL.rectangle,
      TOOL.arrow,
      TOOL.blur,
      TOOL.step,
    ].includes(currentTool)
  ) {
    return;
  }
  if (event.button !== 0) {
    return;
  }
  if (editingTextEl) {
    editingTextEl.blur();
  }
  const point = getCanvasPoint(event);
  logPointerMap(event, point);
  if (currentTool === TOOL.step) {
    addStepMarker(point);
    return;
  }
  activePointerId = event.pointerId;
  drawCanvas.setPointerCapture(event.pointerId);
  startDrawing(point);
});

drawCanvas.addEventListener("pointermove", (event) => {
  if (!isDrawing || event.pointerId !== activePointerId) {
    return;
  }
  const point = getCanvasPoint(event);
  pendingPoint = point;
  pendingShift = event.shiftKey;
  if (rafPending) {
    return;
  }
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    if (!pendingPoint) {
      return;
    }
    updateDrawing(pendingPoint, pendingShift);
    pendingPoint = null;
  });
});

drawCanvas.addEventListener("pointerup", (event) => {
  if (event.pointerId !== activePointerId) {
    return;
  }
  const point = getCanvasPoint(event);
  finishDrawing(point, event.shiftKey);
  pendingPoint = null;
  rafPending = false;
  activePointerId = null;
});

drawCanvas.addEventListener("pointercancel", () => {
  clearPreview();
  isDrawing = false;
  startPoint = null;
  pendingPoint = null;
  rafPending = false;
  activePointerId = null;
  activeAnnotation = null;
});

textLayer.addEventListener("pointermove", handleTextLayerPointerMove);
textLayer.addEventListener("pointerup", handleTextLayerPointerUp);
textLayer.addEventListener("pointercancel", handleTextLayerPointerUp);

textLayer.addEventListener("pointerdown", (event) => {
  if (currentTool !== TOOL.text) {
    return;
  }
  if (event.button !== 0) {
    return;
  }
  if (event.target !== textLayer) {
    return;
  }
  event.preventDefault();
  const point = getCanvasPoint(event);
  logPointerMap(event, point);
  console.log("[TEXT] create textbox at", point.x, point.y);
  const textSettings = getAnnotationSettings();
  const newText = {
    id: createId(),
    x: point.x,
    y: point.y,
    text: "",
    type: "text",
    ...textSettings,
  };
  annotations.push(newText);
  const el = buildTextElement(newText);
  textLayer.appendChild(el);
  startEditing(el);
  console.log("[EDITOR][ANNOTATION_ADD]", { toolType: "text", imageSpace: true });
});

buttons.undo.addEventListener("click", () => {
  if (editingTextEl) {
    editingTextEl.blur();
  }
  undo();
});

buttons.redo.addEventListener("click", () => {
  if (editingTextEl) {
    editingTextEl.blur();
  }
  redo();
});

buttons.clear.addEventListener("click", () => {
  if (editingTextEl) {
    editingTextEl.blur();
  }
  clearAll();
});

if (buttons.resetSteps) {
  buttons.resetSteps.addEventListener("click", () => {
    annotations = annotations.filter((item) => item.type !== "step");
    syncStepCounter();
    renderAll();
    pushState();
    setStatus("Step numbers reset.", "success", 1500);
    console.log("[EDITOR][STEP_RESET]", { nextStep: stepCounter });
  });
}

buttons.copy.addEventListener("click", async () => {
  console.log("[EDITOR][COPY_REQUEST]", {
    focused: document.hasFocus(),
    isImageLoaded,
  });
  if (!isImageLoaded) {
    setStatus("No screenshot to copy.", "error");
    return;
  }
  if (!document.hasFocus()) {
    const message = "Click the editor tab, then try Copy again.";
    setStatus(message, "error");
    console.log("[EDITOR][COPY_RESULT]", { ok: false, message });
    return;
  }
  if (editingTextEl) {
    editingTextEl.blur();
  }
  if (!navigator.clipboard || !window.ClipboardItem) {
    setStatus("Copy failed: Clipboard API unavailable. Use Download.", "error");
    return;
  }
  let blob = null;
  try {
    blob = await exportAnnotatedBlob();
    if (!blob) {
      throw new Error("Failed to create image.");
    }
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob }),
    ]);
    setStatus("Copied!", "success", 2000);
    console.log("[EDITOR][COPY_PNG]", { ok: true });
    console.log("[EDITOR][COPY_RESULT]", { ok: true });
  } catch (error) {
    const message = error && error.message ? error.message : "Unknown error";
    setStatus(`Copy failed: ${message}. Use Download.`, "error");
    console.log("[EDITOR][COPY_PNG]", { ok: false });
    console.log("[EDITOR][COPY_RESULT]", { ok: false, message });
    if (blob) {
      const filename = `screenshot_${formatTimestamp(new Date())}.png`;
      await downloadExportedBlob(blob, filename, true);
    }
  }
});

if (buttons.copyCompressed) {
  buttons.copyCompressed.addEventListener("click", async () => {
    console.log("[EDITOR][COPY_COMPRESSED_REQUEST]", {
      focused: document.hasFocus(),
      isImageLoaded,
    });
    if (!isImageLoaded) {
      setStatus("No screenshot to copy.", "error");
      return;
    }
    if (!document.hasFocus()) {
      const message = "Click the editor tab, then try Copy again.";
      setStatus(message, "error");
      return;
    }
    if (editingTextEl) {
      editingTextEl.blur();
    }
    if (!navigator.clipboard || !window.ClipboardItem) {
      setStatus("Copy failed: Clipboard API unavailable. Use Download.", "error");
      return;
    }
    try {
      const result = await exportCompressedAnnotatedBlob();
      if (!result || !result.blob) {
        throw new Error("Failed to create compressed image.");
      }
      await navigator.clipboard.write([
        new ClipboardItem({ [result.mimeType]: result.blob }),
      ]);
      setStatus("Copied (small)!", "success", 2000);
      console.log("[EDITOR][COPY_COMPRESSED]", {
        ok: true,
        bytes: result.blob.size,
        mimeType: result.mimeType,
        scale: result.scale,
      });
    } catch (error) {
      const message = error && error.message ? error.message : "Unknown error";
      setStatus(`Copy failed: ${message}. Use Download.`, "error");
      console.log("[EDITOR][COPY_COMPRESSED]", { ok: false });
    }
  });
}

buttons.download.addEventListener("click", async () => {
  console.log("[EDITOR][DOWNLOAD_REQUEST]", { isImageLoaded });
  if (!isImageLoaded) {
    setStatus("No screenshot to download.", "error");
    return;
  }
  if (editingTextEl) {
    editingTextEl.blur();
  }
  const filename = `screenshot_${formatTimestamp(new Date())}.png`;
  setStatus("Downloading...");
  try {
    const blob = await exportAnnotatedBlob();
    if (!blob) {
      throw new Error("Failed to create image.");
    }
    await downloadExportedBlob(blob, filename, true);
    setStatus("Download started.", "success", 2000);
    console.log("[EDITOR][DOWNLOAD_PNG]", { ok: true });
  } catch (error) {
    const message = error && error.message ? error.message : "Download failed.";
    setStatus(message, "error");
    console.log("[EDITOR][DOWNLOAD_PNG]", { ok: false });
  }
});

if (buttons.downloadCompressed) {
  buttons.downloadCompressed.addEventListener("click", async () => {
    console.log("[EDITOR][DOWNLOAD_COMPRESSED_REQUEST]", { isImageLoaded });
    if (!isImageLoaded) {
      setStatus("No screenshot to download.", "error");
      return;
    }
    if (editingTextEl) {
      editingTextEl.blur();
    }
    setStatus("Preparing compressed download...");
    try {
      const result = await exportCompressedAnnotatedBlob();
      if (!result || !result.blob) {
        throw new Error("Failed to create compressed image.");
      }
      const extension = result.mimeType === "image/jpeg" ? "jpg" : "webp";
      const filename = `screenshot_${formatTimestamp(new Date())}_small.${extension}`;
      await downloadExportedBlob(result.blob, filename, true);
      setStatus("Download started.", "success", 2000);
      console.log("[EDITOR][DOWNLOAD_COMPRESSED]", {
        ok: true,
        bytes: result.blob.size,
        mimeType: result.mimeType,
        scale: result.scale,
      });
    } catch (error) {
      const message = error && error.message ? error.message : "Download failed.";
      setStatus(message, "error");
      console.log("[EDITOR][DOWNLOAD_COMPRESSED]", { ok: false });
    }
  });
}

if (buttons.zoomIn) {
  buttons.zoomIn.addEventListener("click", () => {
    setZoom(zoom * 1.2);
  });
}
if (buttons.zoomOut) {
  buttons.zoomOut.addEventListener("click", () => {
    setZoom(zoom * 0.8);
  });
}
if (buttons.zoomFit) {
  buttons.zoomFit.addEventListener("click", () => {
    zoomToFit();
  });
}
if (buttons.zoomActual) {
  buttons.zoomActual.addEventListener("click", () => {
    zoomToActual();
  });
}

Object.entries(toolButtons).forEach(([tool, button]) => {
  button.addEventListener("click", () => setTool(tool));
});

function bindTextControl(control, eventName = "change") {
  if (!control) {
    return;
  }
  control.addEventListener(eventName, () => {
    applySettingsToEditingText();
    saveAnnotationSettings();
  });
}

bindTextControl(controls.textFontFamily);
bindTextControl(controls.textWeight);
bindTextControl(controls.textColor);
bindTextControl(controls.textSize);
bindTextControl(controls.textOpacity);

window.addEventListener("resize", () => {
  updateScale();
});

stage.addEventListener("wheel", (event) => {
  if (!(event.ctrlKey || event.metaKey)) {
    return;
  }
  event.preventDefault();
  const direction = event.deltaY > 0 ? -1 : 1;
  const nextZoom = direction > 0 ? zoom * 1.15 : zoom * 0.87;
  setZoom(nextZoom);
});

stage.addEventListener("pointerdown", (event) => {
  if (currentTool !== TOOL.pointer) {
    return;
  }
  if (event.button !== 0) {
    return;
  }
  if (event.target && event.target.classList.contains("text-label")) {
    return;
  }
  panState = {
    startX: event.clientX,
    startY: event.clientY,
    scrollLeft: stage.scrollLeft,
    scrollTop: stage.scrollTop,
  };
  stage.setPointerCapture(event.pointerId);
  stage.style.cursor = "grabbing";
});

stage.addEventListener("pointermove", (event) => {
  if (!panState) {
    return;
  }
  const dx = event.clientX - panState.startX;
  const dy = event.clientY - panState.startY;
  stage.scrollLeft = panState.scrollLeft - dx;
  stage.scrollTop = panState.scrollTop - dy;
});

stage.addEventListener("pointerup", () => {
  if (!panState) {
    return;
  }
  panState = null;
  stage.style.cursor = "";
});

stage.addEventListener("pointercancel", () => {
  panState = null;
  stage.style.cursor = "";
});

function showBootError(message, error) {
  if (bootErrorEl) {
    bootErrorEl.hidden = false;
    bootErrorEl.textContent = message;
  }
  console.error("[EDITOR] bootstrap failed", error);
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    setTool(currentTool);
    setEditorEnabled(false);
    await loadAnnotationSettings();
    loadScreenshot();
  } catch (error) {
    showBootError("Editor failed to load (script error). Check console.", error);
  }
});

document.addEventListener("keydown", () => {
  if (editingTextEl && editingTextEl.contentEditable === "true") {
    if (document.activeElement !== editingTextEl) {
      editingTextEl.focus();
    }
  }
});
