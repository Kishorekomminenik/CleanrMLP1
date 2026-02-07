const baseCanvas = document.getElementById("baseCanvas");
const drawCanvas = document.getElementById("drawCanvas");
const textLayer = document.getElementById("textLayer");
const canvasWrap = document.getElementById("canvasWrap");
const stage = document.getElementById("stage");

const toolButtons = {
  pointer: document.getElementById("toolPointer"),
  pen: document.getElementById("toolPen"),
  highlight: document.getElementById("toolHighlight"),
  circle: document.getElementById("toolCircle"),
  text: document.getElementById("toolText"),
};

const controls = {
  mainColor: document.getElementById("mainColor"),
  penWidth: document.getElementById("penWidth"),
  circleWidth: document.getElementById("circleWidth"),
  highlightColor: document.getElementById("highlightColor"),
  highlightOpacity: document.getElementById("highlightOpacity"),
  textSize: document.getElementById("textSize"),
  textBold: document.getElementById("textBold"),
};

const buttons = {
  undo: document.getElementById("btnUndo"),
  redo: document.getElementById("btnRedo"),
  clear: document.getElementById("btnClear"),
  copy: document.getElementById("btnCopy"),
  download: document.getElementById("btnDownload"),
};

const statusEl = document.getElementById("statusText");

const baseCtx = baseCanvas.getContext("2d");
const drawCtx = drawCanvas.getContext("2d");

const TOOL = {
  pointer: "pointer",
  pen: "pen",
  highlight: "highlight",
  circle: "circle",
  text: "text",
};

let latestScreenshotDataUrl = null;
let statusTimer = null;
let imageSize = { width: 0, height: 0 };
let scale = 1;
let currentTool = TOOL.pointer;
let isDrawing = false;
let startPoint = null;
let previewImageData = null;
let activePointerId = null;
let dragState = null;
let editingTextEl = null;

let undoStack = [];
let redoStack = [];

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

function setEditorEnabled(enabled) {
  Object.values(toolButtons).forEach((button) => {
    button.disabled = !enabled;
  });
  Object.values(controls).forEach((control) => {
    control.disabled = !enabled;
  });
  buttons.clear.disabled = !enabled;
  buttons.copy.disabled = !enabled;
  buttons.download.disabled = !enabled;
  if (!enabled) {
    buttons.copy.textContent = "Copy (loading...)";
  } else {
    buttons.copy.textContent = "Copy";
  }
  updateHistoryButtons();
}

function setTool(tool) {
  currentTool = tool;
  Object.entries(toolButtons).forEach(([key, button]) => {
    button.classList.toggle("active", key === tool);
  });
  updateControlVisibility();
  updateInteractivity();
  if (tool === TOOL.pen) {
    drawCanvas.style.cursor = "crosshair";
  } else if (tool === TOOL.highlight || tool === TOOL.circle) {
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
  const rect = canvasWrap.getBoundingClientRect();
  const x = (event.clientX - rect.left) / scale;
  const y = (event.clientY - rect.top) / scale;
  return {
    x: clamp(x, 0, imageSize.width),
    y: clamp(y, 0, imageSize.height),
  };
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
  scale = Math.min(1, scaleX, scaleY);
  canvasWrap.style.width = `${imageSize.width * scale}px`;
  canvasWrap.style.height = `${imageSize.height * scale}px`;
  updateTextPositions();
}

function createId() {
  return `text_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function applyTextStyle(el) {
  const size = Number(el.dataset.size) || 16;
  const bold = el.dataset.bold === "true";
  el.style.color = el.dataset.color || "#111827";
  el.style.fontSize = `${size * scale}px`;
  el.style.fontWeight = bold ? "700" : "400";
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

function getTextsSnapshot() {
  return Array.from(textLayer.querySelectorAll(".text-label")).map((el) => ({
    id: el.dataset.id,
    x: Number(el.dataset.x) || 0,
    y: Number(el.dataset.y) || 0,
    text: el.innerText || "",
    color: el.dataset.color || "#111827",
    size: Number(el.dataset.size) || 16,
    bold: el.dataset.bold === "true",
  }));
}

function rebuildTextLayer(texts) {
  textLayer.innerHTML = "";
  texts.forEach((text) => {
    const el = buildTextElement(text);
    textLayer.appendChild(el);
  });
}

function pushState() {
  if (!imageSize.width || !imageSize.height) {
    return;
  }
  const imageData = drawCtx.getImageData(
    0,
    0,
    imageSize.width,
    imageSize.height
  );
  const texts = getTextsSnapshot();
  undoStack.push({ drawImageData: imageData, texts });
  redoStack = [];
  updateHistoryButtons();
}

function applyState(state) {
  drawCtx.putImageData(state.drawImageData, 0, 0);
  rebuildTextLayer(state.texts);
  updateHistoryButtons();
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
  drawCtx.clearRect(0, 0, imageSize.width, imageSize.height);
  textLayer.innerHTML = "";
  pushState();
}

function buildTextElement(data) {
  const el = document.createElement("div");
  el.className = "text-label";
  el.dataset.id = data.id || createId();
  el.dataset.x = data.x;
  el.dataset.y = data.y;
  el.dataset.color = data.color;
  el.dataset.size = data.size;
  el.dataset.bold = data.bold ? "true" : "false";
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
  if (!el.dataset.originalText) {
    el.dataset.originalText = el.innerText || "";
  }
  el.contentEditable = "true";
  el.classList.add("editing");
  el.focus();
  requestAnimationFrame(() => {
    el.focus();
  });
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
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
    el.remove();
  } else {
    el.textContent = text;
  }
  delete el.dataset.originalText;
  editingTextEl = null;
  pushState();
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
        el.remove();
        editingTextEl = null;
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
      el.remove();
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
  }
  dragState = null;
  activePointerId = null;
}

function drawHighlightRect(start, end) {
  const width = end.x - start.x;
  const height = end.y - start.y;
  drawCtx.fillStyle = hexToRgba(
    controls.highlightColor.value,
    Number(controls.highlightOpacity.value)
  );
  drawCtx.fillRect(start.x, start.y, width, height);
}

function drawEllipse(start, end) {
  const cx = (start.x + end.x) / 2;
  const cy = (start.y + end.y) / 2;
  const rx = Math.abs(end.x - start.x) / 2;
  const ry = Math.abs(end.y - start.y) / 2;
  drawCtx.strokeStyle = controls.mainColor.value;
  drawCtx.lineWidth = Number(controls.circleWidth.value);
  drawCtx.beginPath();
  drawCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  drawCtx.stroke();
}

function startDrawing(point) {
  if (currentTool === TOOL.pen) {
    drawCtx.strokeStyle = controls.mainColor.value;
    drawCtx.lineWidth = Number(controls.penWidth.value);
    drawCtx.lineCap = "round";
    drawCtx.lineJoin = "round";
    drawCtx.beginPath();
    drawCtx.moveTo(point.x, point.y);
  } else {
    previewImageData = drawCtx.getImageData(
      0,
      0,
      imageSize.width,
      imageSize.height
    );
  }
  isDrawing = true;
  startPoint = point;
}

function updateDrawing(point) {
  if (!isDrawing || !startPoint) {
    return;
  }
  if (currentTool === TOOL.pen) {
    drawCtx.lineTo(point.x, point.y);
    drawCtx.stroke();
    return;
  }
  if (!previewImageData) {
    return;
  }
  drawCtx.putImageData(previewImageData, 0, 0);
  if (currentTool === TOOL.highlight) {
    drawHighlightRect(startPoint, point);
  } else if (currentTool === TOOL.circle) {
    drawEllipse(startPoint, point);
  }
}

function finishDrawing(point) {
  if (!isDrawing) {
    return;
  }
  if (currentTool === TOOL.pen) {
    drawCtx.closePath();
    pushState();
  } else if (previewImageData && startPoint) {
    drawCtx.putImageData(previewImageData, 0, 0);
    const distanceX = Math.abs(point.x - startPoint.x);
    const distanceY = Math.abs(point.y - startPoint.y);
    if (distanceX > 1 || distanceY > 1) {
      if (currentTool === TOOL.highlight) {
        drawHighlightRect(startPoint, point);
      } else if (currentTool === TOOL.circle) {
        drawEllipse(startPoint, point);
      }
      pushState();
    }
  }
  previewImageData = null;
  isDrawing = false;
  startPoint = null;
}

async function loadScreenshot() {
  setStatus("Loading...");
  setEditorEnabled(false);
  const result = await chrome.storage.session.get("latestScreenshotDataUrl");
  latestScreenshotDataUrl = result.latestScreenshotDataUrl;
  if (
    typeof latestScreenshotDataUrl !== "string" ||
    !latestScreenshotDataUrl.startsWith("data:image/png")
  ) {
    latestScreenshotDataUrl = null;
    buttons.copy.textContent = "Copy";
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
    baseCtx.clearRect(0, 0, imageSize.width, imageSize.height);
    baseCtx.drawImage(image, 0, 0);
    drawCtx.clearRect(0, 0, imageSize.width, imageSize.height);
    updateScale();
    setEditorEnabled(true);
    setTool(currentTool);
    undoStack = [];
    redoStack = [];
    pushState();
    setStatus("Ready.");
  };
  image.onerror = () => {
    latestScreenshotDataUrl = null;
    buttons.copy.textContent = "Copy";
    setStatus("Failed to load screenshot. Capture again.", "error");
  };
  image.src = latestScreenshotDataUrl;
}

async function exportAnnotatedBlob() {
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = imageSize.width;
  exportCanvas.height = imageSize.height;
  const ctx = exportCanvas.getContext("2d");
  ctx.drawImage(baseCanvas, 0, 0);
  ctx.drawImage(drawCanvas, 0, 0);
  const texts = getTextsSnapshot();
  texts.forEach((text) => {
    const weight = text.bold ? "700" : "400";
    ctx.font = `${weight} ${text.size}px system-ui, Arial`;
    ctx.fillStyle = text.color;
    ctx.textBaseline = "top";
    const lines = text.text.split("\n");
    const lineHeight = text.size * 1.2;
    lines.forEach((line, index) => {
      ctx.fillText(line, text.x, text.y + index * lineHeight);
    });
  });
  return new Promise((resolve) => {
    exportCanvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

drawCanvas.addEventListener("pointerdown", (event) => {
  if (!latestScreenshotDataUrl) {
    return;
  }
  if (![TOOL.pen, TOOL.highlight, TOOL.circle].includes(currentTool)) {
    return;
  }
  if (event.button !== 0) {
    return;
  }
  if (editingTextEl) {
    editingTextEl.blur();
  }
  const point = getCanvasPoint(event);
  activePointerId = event.pointerId;
  drawCanvas.setPointerCapture(event.pointerId);
  startDrawing(point);
});

drawCanvas.addEventListener("pointermove", (event) => {
  if (!isDrawing || event.pointerId !== activePointerId) {
    return;
  }
  const point = getCanvasPoint(event);
  updateDrawing(point);
});

drawCanvas.addEventListener("pointerup", (event) => {
  if (event.pointerId !== activePointerId) {
    return;
  }
  const point = getCanvasPoint(event);
  finishDrawing(point);
  activePointerId = null;
});

drawCanvas.addEventListener("pointercancel", () => {
  if (previewImageData) {
    drawCtx.putImageData(previewImageData, 0, 0);
  }
  isDrawing = false;
  startPoint = null;
  previewImageData = null;
  activePointerId = null;
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
  console.log("[TEXT] create textbox at", point.x, point.y);
  const newText = {
    id: createId(),
    x: point.x,
    y: point.y,
    text: "",
    color: controls.mainColor.value,
    size: Number(controls.textSize.value),
    bold: controls.textBold.checked,
  };
  const el = buildTextElement(newText);
  textLayer.appendChild(el);
  startEditing(el);
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

buttons.copy.addEventListener("click", async () => {
  if (!latestScreenshotDataUrl) {
    setStatus("No screenshot to copy.", "error");
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
    const blob = await exportAnnotatedBlob();
    if (!blob) {
      throw new Error("Failed to create image.");
    }
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob }),
    ]);
    setStatus("Copied!", "success", 2000);
  } catch (error) {
    const message = error && error.message ? error.message : "Unknown error";
    setStatus(`Copy failed: ${message}. Use Download.`, "error");
  }
});

buttons.download.addEventListener("click", async () => {
  if (!latestScreenshotDataUrl) {
    setStatus("No screenshot to download.", "error");
    return;
  }
  if (editingTextEl) {
    editingTextEl.blur();
  }
  const filename = `screenshot_${formatTimestamp(new Date())}.png`;
  setStatus("Downloading...");
  let objectUrl = null;
  try {
    const blob = await exportAnnotatedBlob();
    if (!blob) {
      throw new Error("Failed to create image.");
    }
    objectUrl = URL.createObjectURL(blob);
    await chrome.downloads.download({
      url: objectUrl,
      filename,
      saveAs: true,
    });
    setStatus("Download started.", "success", 2000);
  } catch (error) {
    const message = error && error.message ? error.message : "Download failed.";
    setStatus(message, "error");
  } finally {
    if (objectUrl) {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
    }
  }
});

Object.entries(toolButtons).forEach(([tool, button]) => {
  button.addEventListener("click", () => setTool(tool));
});

window.addEventListener("resize", () => {
  updateScale();
});

document.addEventListener("DOMContentLoaded", () => {
  setTool(currentTool);
  setEditorEnabled(false);
  loadScreenshot();
});

document.addEventListener("keydown", () => {
  if (editingTextEl && editingTextEl.contentEditable === "true") {
    if (document.activeElement !== editingTextEl) {
      editingTextEl.focus();
    }
  }
});
