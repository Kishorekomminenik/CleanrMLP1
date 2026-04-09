// FULL-PAGE CAPTURE V1 LOCKED
// DO NOT MODIFY WITHOUT TESTING SHORT + LONG PAGE.
try {
  importScripts(chrome.runtime.getURL("utils/redact.js"));
} catch (error) {
  // Redaction helper is optional; export will fall back to raw values.
}

console.log("[SW][BOOT] service worker started");

try {
  importScripts(
    chrome.runtime.getURL("pipeline/pipelineConfig.js"),
    chrome.runtime.getURL("pipeline/normalizer.js"),
    chrome.runtime.getURL("pipeline/actionGrouper.js"),
    chrome.runtime.getURL("pipeline/signalReducer.js"),
    chrome.runtime.getURL("pipeline/summaryBuilder.js")
  );
} catch (error) {
  console.warn("Pipeline modules unavailable:", error);
}

try {
  importScripts(
    chrome.runtime.getURL("src/reporting/reportConfig.js"),
    chrome.runtime.getURL("src/reporting/reportSessionModel.js"),
    chrome.runtime.getURL("src/reporting/reportSessionManager.js"),
    chrome.runtime.getURL("src/reporting/reportStepTracker.js")
  );
} catch (error) {
  console.warn("Report modules unavailable:", error);
}

try {
  importScripts(
    chrome.runtime.getURL("lib/jszip.min.js"),
    chrome.runtime.getURL("lib/zipBuilderChunked.js"),
    chrome.runtime.getURL("lib/idb.js"),
    chrome.runtime.getURL("lib/export_ndjson.js")
  );
} catch (error) {
  console.warn("Zip builder unavailable:", error);
}

const DEBUGGER_PROTOCOL_VERSION = "1.3";
const MAX_BODY_BYTES = 2000000;
const MAX_NETWORK_ENTRIES = 5000;
const MAX_CONSOLE_ENTRIES = 5000;
const MAX_CONSOLE_ENTRY_BYTES = 50000;
const FULLPAGE_LIMITS = {
  maxTiles: 80,
  maxCanvasEdge: 32767,
  maxCanvasPixels: 268435456,
  maxPartHeight: 12000,
  scrollTolerance: 2,
};
const FULL_CAPTURE_CONFIG = {
  postScrollDelayMs: 250,
  minCaptureIntervalMs: 450,
  retryDelayMs: 800,
  maxRetriesPerShot: 1,
};
const DEBUG_FULLPAGE = true;
const DEBUG_LOGS_PAUSE = false;
const DEBUG_CDP_LOGS = true;
const DEBUG_PERSIST_LOGS = true;
const DEBUG_LOG_BUFFER_MAX = 200;
const DEBUG_LOG_BUFFER_PREFIX = "[DD][DBG]";
let debugLogBuffer = [];

function pushDebugLog(message, payload = null) {
  if (!DEBUG_PERSIST_LOGS) {
    return;
  }
  const entry = {
    ts: Date.now(),
    message: message || "",
    payload: payload ?? null,
  };
  debugLogBuffer.push(entry);
  if (debugLogBuffer.length > DEBUG_LOG_BUFFER_MAX) {
    debugLogBuffer.splice(0, debugLogBuffer.length - DEBUG_LOG_BUFFER_MAX);
  }
}

function appendDebugLog(message, payload = null) {
  const fullMessage = message
    ? `${DEBUG_LOG_BUFFER_PREFIX} ${message}`
    : DEBUG_LOG_BUFFER_PREFIX;
  pushDebugLog(fullMessage, payload);
}

function appendCdpDebugLog(label, payload) {
  if (!DEBUG_CDP_LOGS) {
    return;
  }
  const timestamp = new Date().toISOString();
  const entry = `${timestamp} ${label}${
    payload ? ` ${JSON.stringify(payload)}` : ""
  }`;
  pushDebugLog(entry);
  try {
    chrome.storage.session.set({ debugLogBuffer });
  } catch (error) {
    // ignore storage failures
  }
}
const DEBUG_CDP_LOGS_TIMEOUT_MS = 5000;
console.log("[DD][SW] CDP diagnostics build loaded.", {
  DEBUG_CDP_LOGS,
});
appendDebugLog("[DD][SW] CDP diagnostics build loaded.", { DEBUG_CDP_LOGS });
let debuggerEventStats = null;
let debuggerEventCheckTimer = null;
const TRUNCATION_SUFFIX = "...[truncated]";
const BINARY_CONTENT_TYPE_REGEX =
  /^(image\/|font\/|video\/|audio\/|application\/octet-stream)/i;
const QA_SESSION_LOG_SCHEMA_VERSION = "1.1.0";
const EXPORT_LIMITS = {
  maxRequests: 2000,
  maxConsoleEntries: 5000,
  maxBodyBytes: 204800,
  maxScreenshots: 200,
};
const EXPORT_BATCH_DEFAULTS = {
  files: 20,
  screenshots: 10,
  yieldEveryMs: 0,
};
const EXTENDED_EXPORT = false; // default minimal team export
function debugPersistLog(label, payload) {
  if (!DEBUG_PERSIST_LOGS) {
    return;
  }
  try {
    console.log(label, payload);
  } catch (error) {
    // Ignore logging failures.
  }
}
const EXPORT_SIZE_GUARDS = {
  maxNetworkJsonBytes: 30 * 1024 * 1024,
  maxConsoleJsonBytes: 12 * 1024 * 1024,
  maxTotalJsonBytes: 50 * 1024 * 1024,
  maxScreenshotBytes: 150 * 1024 * 1024,
};
const JSON_BUILD_YIELD_EVERY = 200;
const DEFAULT_PART_CAP_BYTES = 75000000;
const RECORDING_STOP_TIMEOUT_MS = 10000;
const CAPTURE_DEFAULTS = {
  partCapRequests: 5000,
  partCapBytes: DEFAULT_PART_CAP_BYTES,
  maxBodyBytes: 200 * 1024,
  autoDownloadOnRollover: false,
};
const FILTER_DEFAULTS = {
  requestType: "xhr_fetch",
  statusMode: "all",
  customStatuses: [],
  urlContains: "",
  urlExcludes: [],
  captureMode: "filtered_capture",
};
const MIN_REQUESTS_TO_EXPORT = 25;
const MAX_COMPLETED_PARTS_RETAINED = 3;
const RESOURCE_TYPES_DEFAULT = ["xhr", "fetch"];
const PART_STATUS = {
  ACTIVE: "active",
  COMPLETED_READY: "completed_ready",
  EXPORTING: "exporting",
  DOWNLOADED: "downloaded",
  DOWNLOAD_FAILED: "download_failed",
  DELETED: "deleted",
};
const FLUSH_BATCH = {
  network: 100,
  console: 100,
};
const FLUSH_DELAY_MS = 500;

const state = {
  screenshot: {
    dataUrl: null,
    capturedAt: null,
  },
  recording: {
    status: "idle",
    dataUrl: null,
    mimeType: null,
    capturedAt: null,
    error: null,
    hasData: false,
    videoBlobUrl: null,
    videoMime: null,
    videoByteLength: null,
    videoStartEpochMs: null,
    videoEndEpochMs: null,
    sessionId: null,
  },
  network: {
    active: false,
    captureEnabled: false,
    tabId: null,
    requests: {},
    order: [],
    capped: false,
    startedAt: null,
    stoppedAt: null,
  },
  console: {
    active: false,
    tabId: null,
    logs: [],
    startedAt: null,
    stoppedAt: null,
  },
};

const FULLPAGE_STITCH_TIMEOUT_MS = 30000;
const SCROLL_TOLERANCE_PX = 5;
const POPUP_CAPTURE_PORT_NAME = "capture-request";
const POPUP_CAPTURE_DELAY_MS = 200;
const FULLPAGE_STABILIZE_SETTLE_MS = 150;
const FULLPAGE_STABILIZE_MAX_RETRIES = 2;
const FULLPAGE_TILE_STABILITY_RETRIES = 2;
const FULLPAGE_TILE_CAPTURE_RETRIES = 1;
const FULLPAGE_TILE_DIMENSION_TOLERANCE_PX = 2;
const FULLPAGE_TILE_CROP_TOLERANCE_PX = 2;
const FULLPAGE_SEAM_TOLERANCE_PX = 2;
const FULLPAGE_VIEWPORT_TOLERANCE_PX = 2;
const RECORDING_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;

const captureState = {
  sessionId: null,
  partId: null,
  partNumber: 0,
  partCreatedAtMs: null,
  requestsInPart: 0,
  bytesInPart: 0,
  networkBytesInPart: 0,
  consoleBytesInPart: 0,
  consoleInPart: 0,
  errorsInPart: 0,
  lastEventMs: null,
  totalRequests: 0,
  totalConsole: 0,
  totalErrors: 0,
  capRequests: CAPTURE_DEFAULTS.partCapRequests,
  capBytes: CAPTURE_DEFAULTS.partCapBytes,
  maxBodyBytes: CAPTURE_DEFAULTS.maxBodyBytes,
  autoDownloadOnRollover: CAPTURE_DEFAULTS.autoDownloadOnRollover,
  lastCompletedPartId: null,
  lastCompletedPartNumber: null,
  partHasData: false,
  completedPartsCount: 0,
  logsState: "idle",
  pausedForStorageLimit: false,
  rolloverPending: false,
  pendingFinalizePart: null,
  pendingFinalizeStartNewPart: false,
};
let screenshotCaptureQueue = Promise.resolve();
let screenshotCaptureSequence = 0;
// LOGGING V1 STABLE
// DO NOT MODIFY WITHOUT RETESTING NORMAL STOP + DEBUGGER DETACH.
const networkQueue = [];
const consoleQueue = [];
let flushTimer = null;
let flushInProgress = false;
let flushBackoffMs = 0;
let controlOpInFlight = false;
let controlOpDeferredFlush = false;

function setControlOpInFlight(active) {
  controlOpInFlight = active;
  if (!active && controlOpDeferredFlush) {
    controlOpDeferredFlush = false;
    scheduleFlush();
  }
}
const FLUSH_BACKOFF_BASE_MS = 750;
const FLUSH_BACKOFF_MAX_MS = 8000;
const NETWORK_QUEUE_MAX = 4000;
const CONSOLE_QUEUE_MAX = 4000;
const exportedPartIds = new Set();
let rotationSuppressed = false;
let rotationInProgress = false;
const exportQueue = [];
const exportQueueIds = new Set();
let exportRunning = false;
let exportRunningJob = null;
let exportStatus = null;
const brokerState = {
  tabId: null,
  ready: false,
};
let timestampOverlayEnabled = false;
const recordingOverlayState = {
  startMs: null,
  paused: false,
  pauseStartedAt: null,
  totalPausedMs: 0,
  tabId: null,
};
const RECORDING_STATE_TRANSITIONS = {
  idle: new Set(["starting"]),
  starting: new Set(["recording", "error", "idle"]),
  recording: new Set(["paused", "stopping", "error"]),
  paused: new Set(["recording", "stopping", "error"]),
  stopping: new Set(["stopped", "error"]),
  stopped: new Set(["idle"]),
  error: new Set(["idle"]),
};
const recordingController = {
  state: "idle",
  sessionId: null,
  targetTabId: null,
  lastError: null,
};
let recordingTransitionLock = Promise.resolve();
let activeFilters = { ...FILTER_DEFAULTS };

const MODE_LABELS = {
  screenshot: "Screenshot",
  recording: "Recording",
  session: "Session",
  network_console: "Capture Logs",
};

let session = null;
let statusMessage = null;
let offscreenReady = false;
let offscreenCreating = null;
let recordingPanelWindowId = null;
let recordingPanelWindowTabId = null;
let recordingPanelTargetTabId = null;
let recordingPanelReadyWaiter = null;
let logsPanelTabId = null;
const panelOverlayState = {
  recording: {
    closedTabs: new Set(),
    hiddenForCaptureTabs: new Set(),
  },
  logs: {
    closedTabs: new Set(),
    hiddenForCaptureTabs: new Set(),
  },
};

function isPanelClosed(tabId, panel) {
  if (!tabId || !panelOverlayState[panel]) {
    return false;
  }
  return panelOverlayState[panel].closedTabs.has(tabId);
}

function markPanelClosed(tabId, panel, closed = true) {
  if (!tabId || !panelOverlayState[panel]) {
    return;
  }
  if (closed) {
    panelOverlayState[panel].closedTabs.add(tabId);
  } else {
    panelOverlayState[panel].closedTabs.delete(tabId);
  }
}

function isPanelHiddenForCapture(tabId, panel) {
  if (!tabId || !panelOverlayState[panel]) {
    return false;
  }
  return panelOverlayState[panel].hiddenForCaptureTabs.has(tabId);
}

function setPanelHiddenForCapture(tabId, panel, hidden) {
  if (!tabId || !panelOverlayState[panel]) {
    return;
  }
  if (hidden) {
    panelOverlayState[panel].hiddenForCaptureTabs.add(tabId);
  } else {
    panelOverlayState[panel].hiddenForCaptureTabs.delete(tabId);
  }
}
let exportPhase = null;
let exportJob = null;
let lastLogsPauseLogMs = 0;
const brokerDownloadUrls = new Map();

function nowIso() {
  return new Date().toISOString();
}

function parseEpochMs(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function getExtensionVersion() {
  try {
    const manifest = chrome.runtime.getManifest();
    return manifest && manifest.version ? manifest.version : null;
  } catch (error) {
    return null;
  }
}

function captureMonotonicBaseline() {
  const hasPerf =
    typeof performance !== "undefined" && typeof performance.now === "function";
  if (!hasPerf) {
    return {
      monotonic: {
        epoch_origin_ms: null,
        monotonic_origin_ms: null,
      },
      monotonic_available: false,
    };
  }
  const monotonicOriginMs = performance.now();
  if (typeof monotonicOriginMs !== "number" || Number.isNaN(monotonicOriginMs)) {
    return {
      monotonic: {
        epoch_origin_ms: null,
        monotonic_origin_ms: null,
      },
      monotonic_available: false,
    };
  }
  return {
    monotonic: {
      epoch_origin_ms: Date.now(),
      monotonic_origin_ms: monotonicOriginMs,
    },
    monotonic_available: true,
  };
}

function formatExportTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function formatZipTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

function formatSessionIdTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

function createDebugDuckSessionId(date = new Date()) {
  const stamp = formatSessionIdTimestamp(date);
  let rand = "";
  try {
    if (crypto && typeof crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(3);
      crypto.getRandomValues(bytes);
      rand = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch (error) {
    rand = "";
  }
  if (!rand) {
    rand = Math.random().toString(16).slice(2, 8);
  }
  return `dd_${stamp}_${rand}`;
}

function computeSessionOffsetMs(timestampIso) {
  if (!session || !session.created_at) {
    return 0;
  }
  const startMs = new Date(session.created_at).getTime();
  const eventMs = new Date(timestampIso).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(eventMs)) {
    return 0;
  }
  return Math.max(0, eventMs - startMs);
}

function dataUrlToBlob(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") {
    return null;
  }
  const parts = dataUrl.split(",");
  if (parts.length < 2) {
    return null;
  }
  const header = parts[0];
  const base64 = parts[1];
  const mimeMatch = header.match(/data:(.*);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

function readPngDimensionsFromDataUrl(dataUrl) {
  if (
    !dataUrl ||
    typeof dataUrl !== "string" ||
    !dataUrl.startsWith("data:image/png")
  ) {
    return null;
  }
  try {
    const commaIndex = dataUrl.indexOf(",");
    if (commaIndex === -1) {
      return null;
    }
    const sample = dataUrl.slice(commaIndex + 1, commaIndex + 1 + 96);
    const binary = atob(sample);
    if (!binary || binary.length < 24) {
      return null;
    }
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const view = new DataView(bytes.buffer);
    const width = view.getUint32(16, false);
    const height = view.getUint32(20, false);
    if (!width || !height) {
      return null;
    }
    return { width, height };
  } catch (error) {
    return null;
  }
}

function validateCapturedTileDimensions({
  captureDims,
  expectedWidthPx,
  expectedHeightPx,
}) {
  if (!captureDims || !captureDims.width || !captureDims.height) {
    return { ok: false, reason: "missing_dimensions" };
  }
  const widthDelta = Math.abs(captureDims.width - expectedWidthPx);
  const heightDelta = Math.abs(captureDims.height - expectedHeightPx);
  if (widthDelta > FULLPAGE_TILE_DIMENSION_TOLERANCE_PX) {
    return {
      ok: false,
      reason: "width_mismatch",
      widthDelta,
    };
  }
  if (heightDelta > FULLPAGE_TILE_DIMENSION_TOLERANCE_PX) {
    return {
      ok: true,
      reason: "height_mismatch",
      heightDelta,
      warning: true,
    };
  }
  return { ok: true };
}

function validateTileCropBounds({
  captureDims,
  clipTopPx,
  clipHeightPx,
  tolerancePx = FULLPAGE_TILE_CROP_TOLERANCE_PX,
}) {
  if (!captureDims || !captureDims.height) {
    return { ok: false, reason: "missing_dimensions" };
  }
  if (clipTopPx < 0 || clipTopPx >= captureDims.height) {
    return { ok: false, reason: "clip_exceeds_height" };
  }
  if (clipHeightPx < 0) {
    return { ok: false, reason: "negative_clip_height" };
  }
  const overshoot = clipTopPx + clipHeightPx - captureDims.height;
  if (overshoot > 0) {
    if (overshoot <= tolerancePx) {
      return {
        ok: true,
        adjusted: true,
        adjustedHeightPx: Math.max(0, captureDims.height - clipTopPx),
        overshoot,
      };
    }
    return { ok: false, reason: "crop_exceeds_height", overshoot };
  }
  return { ok: true };
}

async function blobToDataUrl(blob) {
  if (!blob) {
    return null;
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToImageBitmap(dataUrl) {
  const blob = dataUrlToBlob(dataUrl);
  if (!blob) {
    throw new Error("Invalid screenshot data.");
  }
  return createImageBitmap(blob);
}

function formatOverlayTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function formatElapsedMs(ms) {
  if (typeof ms !== "number" || Number.isNaN(ms)) {
    return null;
  }
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function computeRecordingElapsedMs(nowMs) {
  if (!recordingOverlayState.startMs) {
    return null;
  }
  const endMs =
    recordingOverlayState.paused && recordingOverlayState.pauseStartedAt
      ? recordingOverlayState.pauseStartedAt
      : nowMs;
  return Math.max(
    0,
    endMs - recordingOverlayState.startMs - recordingOverlayState.totalPausedMs
  );
}

function normalizeFilters(input) {
  const filters = input || {};
  const requestType =
    typeof filters.requestType === "string"
      ? filters.requestType
      : FILTER_DEFAULTS.requestType;
  const statusMode =
    typeof filters.statusMode === "string"
      ? filters.statusMode
      : FILTER_DEFAULTS.statusMode;
  const customStatusesRaw = Array.isArray(filters.customStatuses)
    ? filters.customStatuses
    : typeof filters.customStatuses === "string"
      ? filters.customStatuses.split(",")
      : [];
  const customStatuses = Array.from(
    new Set(
      customStatusesRaw
        .map((value) => Number(String(value).trim()))
        .filter((value) => Number.isInteger(value) && value >= 100 && value <= 599)
    )
  ).slice(0, 30);
  const urlContains =
    typeof filters.urlContains === "string" ? filters.urlContains.trim() : "";
  const urlExcludesRaw = Array.isArray(filters.urlExcludes)
    ? filters.urlExcludes
    : typeof filters.urlExcludes === "string"
      ? filters.urlExcludes.split(",")
      : [];
  const urlExcludes = urlExcludesRaw
    .map((value) => String(value).trim())
    .filter(Boolean)
    .slice(0, 20);
  const captureMode =
    typeof filters.captureMode === "string"
      ? filters.captureMode
      : FILTER_DEFAULTS.captureMode;
  return {
    requestType,
    statusMode,
    customStatuses,
    urlContains,
    urlExcludes,
    captureMode,
  };
}

function buildFiltersSummary(filters) {
  if (!filters) {
    return "";
  }
  const parts = [];
  if (filters.requestType === "xhr_fetch") {
    parts.push("XHR+Fetch");
  } else if (filters.requestType === "xhr") {
    parts.push("XHR");
  } else if (filters.requestType === "fetch") {
    parts.push("Fetch");
  } else {
    parts.push("All requests");
  }
  if (filters.statusMode === "errors") {
    parts.push("Errors>=400");
  } else if (filters.statusMode === "custom") {
    parts.push(
      filters.customStatuses && filters.customStatuses.length
        ? `Status: ${filters.customStatuses.join(",")}`
        : "Status: custom"
    );
  } else {
    parts.push("All statuses");
  }
  if (filters.urlContains) {
    parts.push(`contains: ${filters.urlContains}`);
  }
  if (filters.urlExcludes && filters.urlExcludes.length) {
    parts.push(`exclude: ${filters.urlExcludes.join(",")}`);
  }
  if (filters.captureMode === "capture_all_export_filter") {
    parts.push("Capture all");
  } else {
    parts.push("Filtered capture");
  }
  return parts.join(" • ");
}

function matchesRequestType(resourceType, filters) {
  if (!filters || filters.requestType === "all") {
    return true;
  }
  if (!resourceType) {
    return false;
  }
  const type = String(resourceType).toLowerCase();
  if (filters.requestType === "xhr_fetch") {
    return type === "xhr" || type === "fetch";
  }
  if (filters.requestType === "xhr") {
    return type === "xhr";
  }
  if (filters.requestType === "fetch") {
    return type === "fetch";
  }
  return true;
}

function matchesUrlFilters(url, filters) {
  if (!filters || !url) {
    return true;
  }
  if (filters.urlContains && !url.includes(filters.urlContains)) {
    return false;
  }
  if (filters.urlExcludes && filters.urlExcludes.length) {
    return !filters.urlExcludes.some((token) => token && url.includes(token));
  }
  return true;
}

function matchesStatusFilter(entry, filters) {
  if (!filters || filters.statusMode === "all") {
    return true;
  }
  const status = typeof entry.status === "number" ? entry.status : null;
  if (filters.statusMode === "errors") {
    if (status !== null) {
      return status >= 400;
    }
    return Boolean(entry.errorText);
  }
  if (filters.statusMode === "custom") {
    if (status === null) {
      return false;
    }
    return filters.customStatuses.includes(status);
  }
  return true;
}

function matchesNetworkFilters(entry, filters) {
  if (!entry || !filters) {
    return true;
  }
  if (!matchesRequestType(entry.resourceType, filters)) {
    return false;
  }
  if (!matchesUrlFilters(entry.url || "", filters)) {
    return false;
  }
  if (!matchesStatusFilter(entry, filters)) {
    return false;
  }
  return true;
}

function shouldCaptureAtRequestStage(entry, filters) {
  if (!filters) {
    return true;
  }
  if (filters.captureMode === "capture_all_export_filter") {
    return true;
  }
  if (!matchesRequestType(entry.resourceType, filters)) {
    return false;
  }
  if (!matchesUrlFilters(entry.url || "", filters)) {
    return false;
  }
  return true;
}

function matchesExportNetworkEntry(entry, filters) {
  if (!filters) {
    return true;
  }
  if (!matchesRequestType(entry.resource_type, filters)) {
    return false;
  }
  if (!matchesUrlFilters(entry.url || "", filters)) {
    return false;
  }
  const statusEntry = {
    status: typeof entry.response_status === "number" ? entry.response_status : null,
    errorText: entry.error_text || null,
  };
  if (!matchesStatusFilter(statusEntry, filters)) {
    return false;
  }
  return true;
}

function drawOverlayBadge(ctx, text, width, height) {
  if (!text) {
    return;
  }
  const fontSize = Math.max(12, Math.round(width * 0.012));
  ctx.font = `${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
  ctx.textBaseline = "top";
  const paddingX = 8;
  const paddingY = 6;
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = fontSize * 1.2;
  const boxWidth = textWidth + paddingX * 2;
  const boxHeight = textHeight + paddingY * 2;
  const margin = 10;
  const x = Math.max(margin, width - boxWidth - margin);
  const y = Math.max(margin, height - boxHeight - margin);
  const radius = 8;
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + boxWidth, y, x + boxWidth, y + boxHeight, radius);
  ctx.arcTo(x + boxWidth, y + boxHeight, x, y + boxHeight, radius);
  ctx.arcTo(x, y + boxHeight, x, y, radius);
  ctx.arcTo(x, y, x + boxWidth, y, radius);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, x + paddingX, y + paddingY);
}

async function applyTimestampOverlayToDataUrl(dataUrl, options = {}) {
  if (!dataUrl) {
    return { dataUrl, blob: null };
  }
  if (
    typeof OffscreenCanvas === "undefined" ||
    typeof createImageBitmap !== "function"
  ) {
    return { dataUrl, blob: null };
  }
  const overlayText = options.text;
  if (!overlayText) {
    return { dataUrl, blob: null };
  }
  try {
    const bitmap = await dataUrlToImageBitmap(dataUrl);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    drawOverlayBadge(ctx, overlayText, bitmap.width, bitmap.height);
    const blob = await canvas.convertToBlob({ type: "image/png" });
    const nextDataUrl = await blobToDataUrl(blob);
    return { dataUrl: nextDataUrl || dataUrl, blob };
  } catch (error) {
    console.warn("Failed to apply timestamp overlay:", error);
    return { dataUrl, blob: null };
  }
}

function truncateToBytes(value, maxBytes) {
  if (typeof value !== "string") {
    return value;
  }
  const encoder = new TextEncoder();
  const encoded = encoder.encode(value);
  if (encoded.length <= maxBytes) {
    return value;
  }
  const suffixBytes = encoder.encode(TRUNCATION_SUFFIX).length;
  const sliceLength = Math.max(0, maxBytes - suffixBytes);
  let truncated = "";
  if (sliceLength > 0) {
    truncated = new TextDecoder().decode(encoded.slice(0, sliceLength));
  }
  return `${truncated}${TRUNCATION_SUFFIX}`;
}

function truncateBodyWithMeta(value, maxBytes) {
  if (typeof value !== "string") {
    return {
      value,
      truncated: false,
      originalBytes: null,
    };
  }
  const originalBytes = getByteLength(value);
  if (originalBytes <= maxBytes) {
    return {
      value,
      truncated: false,
      originalBytes,
    };
  }
  return {
    value: truncateToBytes(value, maxBytes),
    truncated: true,
    originalBytes,
  };
}

function decodeResponseBodyWithLimit(entry, maxBytes) {
  if (!entry || !entry.responseBody) {
    return {
      value: null,
      truncated: false,
      originalBytes: null,
    };
  }
  let body = entry.responseBody;
  if (entry.responseBodyBase64) {
    try {
      body = atob(entry.responseBody);
    } catch (error) {
      body = entry.responseBody;
    }
  }
  return truncateBodyWithMeta(body, maxBytes);
}

function getExportLimits(pipelineConfig) {
  const pipelineMaxBody =
    pipelineConfig && typeof pipelineConfig.maxBodyBytes === "number"
      ? pipelineConfig.maxBodyBytes
      : null;
  const maxBodyBytes = pipelineMaxBody
    ? Math.min(EXPORT_LIMITS.maxBodyBytes, pipelineMaxBody)
    : EXPORT_LIMITS.maxBodyBytes;
  return {
    ...EXPORT_LIMITS,
    maxBodyBytes,
  };
}

function limitArrayToTail(items, max) {
  if (!Array.isArray(items)) {
    return { items: [], total: 0, kept: 0, dropped: 0 };
  }
  const total = items.length;
  if (!Number.isFinite(max) || max <= 0 || total <= max) {
    return { items: items.slice(), total, kept: total, dropped: 0 };
  }
  const start = total - max;
  return {
    items: items.slice(start),
    total,
    kept: max,
    dropped: start,
  };
}

function applyNetworkBodyLimit(entries, maxBodyBytes) {
  let truncatedRequest = 0;
  let truncatedResponse = 0;
  const nextEntries = entries.map((entry) => {
    const next = { ...entry };
    if (typeof next.request_post_data === "string") {
      const truncated = truncateToBytes(next.request_post_data, maxBodyBytes);
      if (truncated !== next.request_post_data) {
        truncatedRequest += 1;
        next.request_post_data = truncated;
      }
    }
    if (typeof next.response_body === "string") {
      const truncated = truncateToBytes(next.response_body, maxBodyBytes);
      if (truncated !== next.response_body) {
        truncatedResponse += 1;
        next.response_body = truncated;
      }
    }
    return next;
  });
  return { entries: nextEntries, truncatedRequest, truncatedResponse };
}

function buildExportTruncationReport(options) {
  const {
    limits,
    networkResult,
    consoleResult,
    screenshotResult,
    truncatedBodies,
  } = options;
  const droppedNetwork = networkResult ? networkResult.dropped : 0;
  const droppedConsole = consoleResult ? consoleResult.dropped : 0;
  const droppedScreenshots = screenshotResult ? screenshotResult.dropped : 0;
  const truncatedRequest =
    truncatedBodies && typeof truncatedBodies.request === "number"
      ? truncatedBodies.request
      : 0;
  const truncatedResponse =
    truncatedBodies && typeof truncatedBodies.response === "number"
      ? truncatedBodies.response
      : 0;
  const hasTruncation =
    droppedNetwork > 0 ||
    droppedConsole > 0 ||
    droppedScreenshots > 0 ||
    truncatedRequest > 0 ||
    truncatedResponse > 0;
  if (!hasTruncation) {
    return { report: null, note: null };
  }
  const report = {
    created_at: nowIso(),
    limits,
    original_counts: {
      network_entries: networkResult ? networkResult.total : 0,
      console_entries: consoleResult ? consoleResult.total : 0,
      screenshots: screenshotResult ? screenshotResult.total : 0,
    },
    kept_counts: {
      network_entries: networkResult ? networkResult.kept : 0,
      console_entries: consoleResult ? consoleResult.kept : 0,
      screenshots: screenshotResult ? screenshotResult.kept : 0,
    },
    dropped_counts: {
      network_entries: droppedNetwork,
      console_entries: droppedConsole,
      screenshots: droppedScreenshots,
    },
    truncated_fields: {
      request_post_data: {
        truncated: truncatedRequest,
        max_bytes: limits.maxBodyBytes,
      },
      response_body: {
        truncated: truncatedResponse,
        max_bytes: limits.maxBodyBytes,
      },
    },
    reasons: {
      network_entries: droppedNetwork > 0 ? "maxRequests" : null,
      console_entries: droppedConsole > 0 ? "maxConsoleEntries" : null,
      screenshots: droppedScreenshots > 0 ? "maxScreenshots" : null,
    },
  };
  const note =
    "[Export Notice] Some items were truncated for stability. " +
    "See export_truncation_report.json for details.";
  return { report, note };
}

function appendSummaryNote(summary, note) {
  if (!note) {
    return summary;
  }
  if (!summary) {
    return note;
  }
  return `${summary}\n\n${note}`;
}

function getHeaderValue(headers, name) {
  if (!headers) {
    return null;
  }
  const target = name.toLowerCase();
  const key = Object.keys(headers).find(
    (headerName) => headerName.toLowerCase() === target
  );
  return key ? headers[key] : null;
}

function shouldSkipResponseBody(headers) {
  const contentType = getHeaderValue(headers, "content-type");
  if (!contentType) {
    return false;
  }
  return BINARY_CONTENT_TYPE_REGEX.test(contentType);
}

function logExportPhase(phase, details) {
  exportPhase = phase;
  console.log("[EXPORT]", phase, details || "");
}

function sendExportEvent(type, payload) {
  try {
    chrome.runtime.sendMessage({ type, ...payload });
  } catch (error) {
    console.warn("[EXPORT] Failed to send event", type, error);
  }
}

function sendFullPageProgress(step, current, total, detail) {
  try {
    chrome.runtime.sendMessage({
      type: "FULLPAGE_PROGRESS",
      step,
      current,
      total,
      detail,
    });
  } catch (error) {
    console.warn("[FULLPAGE] Failed to send progress", error);
  }
}

let lastVisibleTabCaptureAt = 0;

function isCaptureQuotaError(error) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : String(error || "");
  return message.includes("MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND");
}

async function waitForCaptureQuotaWindow(minIntervalMs = FULL_CAPTURE_CONFIG.minCaptureIntervalMs) {
  const now = Date.now();
  const elapsed = now - lastVisibleTabCaptureAt;
  if (elapsed < minIntervalMs) {
    await delay(minIntervalMs - elapsed);
  }
}

async function captureVisibleTabAsync(windowId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(
      windowId,
      { format: "png" },
      (dataUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!dataUrl || typeof dataUrl !== "string") {
          reject(new Error("captureVisibleTab returned empty data"));
          return;
        }
        resolve(dataUrl);
      }
    );
  });
}

const SCROLLBAR_HIDE_CSS = `
  html, body {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
  }
  html::-webkit-scrollbar,
  body::-webkit-scrollbar {
    width: 0 !important;
    height: 0 !important;
  }
  *::-webkit-scrollbar {
    width: 0 !important;
    height: 0 !important;
  }
`;

async function hideScrollbarsForCapture(tabId) {
  if (!chrome.scripting || !chrome.scripting.insertCSS) {
    return false;
  }
  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      css: SCROLLBAR_HIDE_CSS,
    });
    return true;
  } catch (error) {
    return false;
  }
}

async function restoreScrollbarsAfterCapture(tabId) {
  if (!chrome.scripting || !chrome.scripting.removeCSS) {
    return;
  }
  try {
    await chrome.scripting.removeCSS({
      target: { tabId },
      css: SCROLLBAR_HIDE_CSS,
    });
  } catch (error) {
    // Ignore restoration failures.
  }
}

async function captureVisibleTabThrottled(windowId, options = {}) {
  let attempt = 0;
  const minIntervalMs = Number.isFinite(options.minIntervalMs)
    ? options.minIntervalMs
    : FULL_CAPTURE_CONFIG.minCaptureIntervalMs;
  const maxRetries = Number.isFinite(options.maxRetries)
    ? options.maxRetries
    : FULL_CAPTURE_CONFIG.maxRetriesPerShot;
  const retryDelayMs = Number.isFinite(options.retryDelayMs)
    ? options.retryDelayMs
    : FULL_CAPTURE_CONFIG.retryDelayMs;
  while (true) {
    await waitForCaptureQuotaWindow(minIntervalMs);
    try {
      const dataUrl = await captureVisibleTabAsync(windowId);
      lastVisibleTabCaptureAt = Date.now();
      return dataUrl;
    } catch (error) {
      if (isCaptureQuotaError(error) && attempt < maxRetries) {
        attempt += 1;
        await delay(retryDelayMs);
        continue;
      }
      throw error;
    }
  }
}

async function isFullpageCaptureLoaded(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => Boolean(window.__REPRO_FULLPAGE_CAPTURE_LOADED__),
  });
  return Boolean(results && results[0] && results[0].result);
}

async function callFullpageCapture(tabId, method, args = []) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: async (methodName, methodArgs) => {
      const api = window.__reproFullpageCapture;
      if (!api || typeof api[methodName] !== "function") {
        return {
          ok: false,
          error: "Fullpage capture not available.",
          code: "FULLPAGE_ERR_UNAVAILABLE",
        };
      }
      try {
        return await api[methodName](...(methodArgs || []));
      } catch (error) {
        return {
          ok: false,
          error: error?.message || String(error),
          code: "FULLPAGE_ERR_EXEC",
        };
      }
    },
    args: [method, args],
  });
  return results && results[0] ? results[0].result : { ok: false };
}

function reportExportProgress(percent, stage, detail) {
  if (!exportJob) {
    exportJob = {};
  }
  const prev =
    typeof exportJob.lastProgress === "number" ? exportJob.lastProgress : 0;
  const next = typeof percent === "number" ? Math.max(prev, percent) : prev;
  exportJob.lastProgress = next;
  logExportPhase(stage, detail);
  sendExportEvent("EXPORT_EVIDENCE_ZIP_PROGRESS", {
    percent: next,
    stage,
    detail,
  });
  const phase = mapExportStageToPhase(stage);
  if (!exportStatus) {
    exportStatus = {
      jobId: exportJob.jobId || null,
      partId: exportJob.partId || null,
      partNumber: exportJob.partNumber || null,
      percent: next,
      phase,
    };
  } else {
    exportStatus.percent = next;
    exportStatus.phase = phase;
  }
  sendExportEvent("EXPORT_PROGRESS", {
    percent: next,
    phase,
    stage,
    detail,
    jobId: exportJob.jobId || null,
    partId: exportJob.partId || null,
    partNumber: exportJob.partNumber || null,
  });
}

function mapExportStageToPhase(stage) {
  if (!stage) {
    return "Working";
  }
  const name = String(stage);
  if (name.includes("ndjson") || name.includes("stringify")) {
    return "Building NDJSON";
  }
  if (name.includes("zip")) {
    return "Zipping";
  }
  if (name.includes("download")) {
    return "Downloading";
  }
  if (name.includes("prepare") || name.includes("data_ready")) {
    return "Reading data";
  }
  return "Working";
}

function isZipBuilderAvailable() {
  return Boolean(globalThis.JSZip) && Boolean(globalThis.ZipBuilderChunked);
}

function isIdbAvailable() {
  return Boolean(globalThis.ReproIdb);
}

function isNdjsonAvailable() {
  return Boolean(globalThis.NdjsonExporter);
}

function getReportConfig() {
  const config = globalThis.ReportConfig || {};
  return {
    enabled: config.REPORTS_ENABLED === true,
    version:
      typeof config.REPORTS_VERSION === "string"
        ? config.REPORTS_VERSION
        : "1.1.0-scaffold",
  };
}

async function loadReportStepsForSession(sessionId) {
  if (
    !isIdbAvailable() ||
    !sessionId ||
    typeof IDBKeyRange === "undefined" ||
    !globalThis.ReproIdb ||
    typeof globalThis.ReproIdb.getAllByIndex !== "function"
  ) {
    return [];
  }
  try {
    const records = await globalThis.ReproIdb.getAllByIndex(
      "report_steps",
      "sessionId",
      IDBKeyRange.only(sessionId)
    );
    if (!Array.isArray(records)) {
      return [];
    }
    return records.slice().sort((a, b) => {
      const aIndex = typeof a.index === "number" ? a.index : 0;
      const bIndex = typeof b.index === "number" ? b.index : 0;
      return aIndex - bIndex;
    });
  } catch (error) {
    return [];
  }
}

function buildStepsNdjson(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return "";
  }
  return `${steps.map((step) => JSON.stringify(step)).join("\n")}\n`;
}

function buildPartId(sessionId, partNumber) {
  return `${sessionId}_part_${partNumber}`;
}

function isAllowedResourceType(resourceType) {
  if (!resourceType) {
    return true;
  }
  const normalized = String(resourceType).toLowerCase();
  return RESOURCE_TYPES_DEFAULT.includes(normalized);
}

async function loadCaptureSettings() {
  const settings = await chrome.storage.local.get({
    autoDownloadOnRollover: CAPTURE_DEFAULTS.autoDownloadOnRollover,
    partCapRequests: CAPTURE_DEFAULTS.partCapRequests,
    maxBodyKb: CAPTURE_DEFAULTS.maxBodyBytes / 1024,
  });
  const capRequests = parseInt(settings.partCapRequests, 10);
  const maxBodyKb = parseInt(settings.maxBodyKb, 10);
  captureState.capRequests = Number.isFinite(capRequests)
    ? capRequests
    : CAPTURE_DEFAULTS.partCapRequests;
  captureState.capBytes = CAPTURE_DEFAULTS.partCapBytes;
  captureState.maxBodyBytes = Number.isFinite(maxBodyKb)
    ? Math.max(1, maxBodyKb) * 1024
    : CAPTURE_DEFAULTS.maxBodyBytes;
  captureState.autoDownloadOnRollover = settings.autoDownloadOnRollover === true;
}

async function loadTimestampOverlaySetting() {
  const settings = await chrome.storage.local.get({
    timestampOverlay: false,
  });
  timestampOverlayEnabled = settings.timestampOverlay === true;
  return timestampOverlayEnabled;
}

async function ensureSessionRecord(tab) {
  if (!session) {
    return;
  }
  if (!isIdbAvailable()) {
    throw new Error("IndexedDB unavailable.");
  }
  if (captureState.sessionId) {
    return;
  }
  const createdAtMs = parseEpochMs(session.created_at) || Date.now();
  captureState.sessionId = session.session_id;
  captureState.partNumber = 0;
  captureState.partCreatedAtMs = null;
  captureState.requestsInPart = 0;
  captureState.bytesInPart = 0;
  captureState.consoleInPart = 0;
  captureState.errorsInPart = 0;
  captureState.lastEventMs = null;
  captureState.totalRequests = 0;
  captureState.totalConsole = 0;
  captureState.totalErrors = 0;
  captureState.partHasData = false;
  captureState.lastCompletedPartId = null;
  captureState.lastCompletedPartNumber = null;
  captureState.completedPartsCount = 0;
  captureState.networkBytesInPart = 0;
  captureState.consoleBytesInPart = 0;
  captureState.pausedForStorageLimit = false;
  captureState.rolloverPending = false;
  captureState.pendingFinalizePart = null;
  captureState.pendingFinalizeStartNewPart = false;
  debugPersistLog("[LOGS][PERSIST][SESSION_LINK]", {
    sessionId: captureState.sessionId || null,
    partId: captureState.partId || null,
    partNumber: captureState.partNumber || null,
    session: session ? session.session_id : null,
  });
  const sessionRecord = {
    sessionId: session.session_id,
    createdAtMs,
    mode: session.mode,
    tabId: session.active_tab ? session.active_tab.tab_id : null,
    url: session.active_tab ? session.active_tab.url : "",
    title: session.active_tab ? session.active_tab.title : "",
  };
  await ReproIdb.putOne("sessions", sessionRecord);
  await startNewPart("session_start");
}

async function startNewPart(reason) {
  if (!captureState.sessionId) {
    return;
  }
  captureState.partNumber += 1;
  captureState.partId = buildPartId(captureState.sessionId, captureState.partNumber);
  debugPersistLog("[LOGS][PERSIST][SESSION_LINK]", {
    sessionId: captureState.sessionId || null,
    partId: captureState.partId || null,
    partNumber: captureState.partNumber || null,
    session: session ? session.session_id : null,
  });
  captureState.partCreatedAtMs = Date.now();
  captureState.requestsInPart = 0;
  captureState.bytesInPart = 0;
  captureState.networkBytesInPart = 0;
  captureState.consoleBytesInPart = 0;
  captureState.consoleInPart = 0;
  captureState.errorsInPart = 0;
  captureState.partHasData = false;
  captureState.lastEventMs = null;
  const partRecord = {
    partId: captureState.partId,
    sessionId: captureState.sessionId,
    partNumber: captureState.partNumber,
    status: PART_STATUS.ACTIVE,
    createdAtMs: captureState.partCreatedAtMs,
    completedAtMs: null,
    requestCount: 0,
    consoleCount: 0,
    errorCount: 0,
    bytesInPart: 0,
    networkBytes: 0,
    consoleBytes: 0,
    lastEventMs: null,
    reason: reason || null,
  };
  await ReproIdb.putOne("parts", partRecord);
  sendPartStatusUpdate();
}

async function completePart(partSnapshot) {
  if (!partSnapshot || !partSnapshot.partId) {
    return;
  }
  const partRecord = {
    partId: partSnapshot.partId,
    sessionId: captureState.sessionId,
    partNumber: partSnapshot.partNumber,
    status: PART_STATUS.COMPLETED_READY,
    createdAtMs: partSnapshot.createdAtMs || Date.now(),
    completedAtMs: Date.now(),
    requestCount: partSnapshot.requestCount || 0,
    consoleCount: partSnapshot.consoleCount || 0,
    errorCount: partSnapshot.errorCount || 0,
    bytesInPart: partSnapshot.bytesInPart || 0,
    networkBytes: partSnapshot.networkBytes || 0,
    consoleBytes: partSnapshot.consoleBytes || 0,
    lastEventMs: partSnapshot.lastEventMs || null,
    reason: partSnapshot.reason || null,
  };
  await ReproIdb.putOne("parts", partRecord);
}

async function persistActivePart() {
  if (!captureState.partId || !isIdbAvailable()) {
    return;
  }
  const partRecord = {
    partId: captureState.partId,
    sessionId: captureState.sessionId,
    partNumber: captureState.partNumber,
    status: PART_STATUS.ACTIVE,
    createdAtMs: captureState.partCreatedAtMs || Date.now(),
    completedAtMs: null,
    requestCount: captureState.requestsInPart,
    consoleCount: captureState.consoleInPart,
    errorCount: captureState.errorsInPart,
    bytesInPart: captureState.bytesInPart,
    networkBytes: captureState.networkBytesInPart,
    consoleBytes: captureState.consoleBytesInPart,
    lastEventMs: captureState.lastEventMs,
  };
  await ReproIdb.putOne("parts", partRecord);
}

function sendPartStatusUpdate(extra) {
  sendExportEvent("CAPTURE_PART_STATUS", {
    partNumber: captureState.partNumber,
    partId: captureState.partId,
    requestsInPart: captureState.requestsInPart,
    capRequests: captureState.capRequests,
    errorsInPart: captureState.errorsInPart,
    lastCompletedPartNumber: captureState.lastCompletedPartNumber,
    lastCompletedPartId: captureState.lastCompletedPartId,
    partHasData: captureState.partHasData,
    completedPartsCount: captureState.completedPartsCount,
    exportQueueLength: getExportQueueLength(),
    autoDownloadOnRollover: captureState.autoDownloadOnRollover,
    pausedForStorageLimit: captureState.pausedForStorageLimit,
    ...extra,
  });
}

// V1 STABLE: flush/backoff/caps coordinated here.
function scheduleFlush() {
  if (controlOpInFlight) {
    controlOpDeferredFlush = true;
    return;
  }
  if (flushTimer) {
    return;
  }
  const delayMs = flushBackoffMs > 0 ? flushBackoffMs : FLUSH_DELAY_MS;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushQueues();
  }, delayMs);
}

// V1 STABLE: safe flush to avoid data loss on IDB errors.
// Changes require retesting normal stop and unexpected detach.
async function flushQueues() {
  debugPersistLog("[LOGS][PERSIST][FLUSH_START]", {
    networkQueueLength: networkQueue.length,
    consoleQueueLength: consoleQueue.length,
    flushInProgress,
    controlOpInFlight,
    controlOpDeferredFlush,
    captureSessionId: captureState.sessionId || null,
    capturePartId: captureState.partId || null,
  });
  if (flushInProgress || controlOpInFlight) {
    debugPersistLog("[LOGS][PERSIST][FLUSH_SKIPPED]", {
      reason: flushInProgress ? "flush_in_progress" : "control_op_in_flight",
      networkQueueLength: networkQueue.length,
      consoleQueueLength: consoleQueue.length,
      flushInProgress,
      controlOpInFlight,
      controlOpDeferredFlush,
    });
    return;
  }
  flushInProgress = true;
  let wroteAny = false;
  try {
    const networkBatch = networkQueue.slice(0, FLUSH_BATCH.network);
    if (networkBatch.length > 0) {
      try {
        await ReproIdb.putMany("network_entries", networkBatch);
        debugPersistLog("[LOGS][PERSIST][FLUSH_NETWORK_OK]", {
          count: networkBatch.length,
          sessionId: networkBatch[0]?.sessionId || null,
          partId: networkBatch[0]?.partId || null,
        });
        networkQueue.splice(0, networkBatch.length);
        wroteAny = true;
        flushBackoffMs = 0;
      } catch (error) {
        debugPersistLog("[LOGS][PERSIST][FLUSH_FAILED]", {
          storeName: "network_entries",
          error: error?.message || String(error),
          networkQueueLength: networkQueue.length,
          consoleQueueLength: consoleQueue.length,
          captureSessionId: captureState.sessionId || null,
          capturePartId: captureState.partId || null,
        });
        console.warn("[NETWORK][FLUSH_FAILED]", error);
        setStatusMessage(
          "Logging storage issue. Retrying network flush.",
          "error"
        );
        flushBackoffMs = flushBackoffMs
          ? Math.min(FLUSH_BACKOFF_MAX_MS, flushBackoffMs * 2)
          : FLUSH_BACKOFF_BASE_MS;
      }
    }
    const consoleBatch = consoleQueue.slice(0, FLUSH_BATCH.console);
    if (consoleBatch.length > 0) {
      try {
        await ReproIdb.putMany("console_entries", consoleBatch);
        debugPersistLog("[LOGS][PERSIST][FLUSH_CONSOLE_OK]", {
          count: consoleBatch.length,
          sessionId: consoleBatch[0]?.sessionId || null,
          partId: consoleBatch[0]?.partId || null,
        });
        consoleQueue.splice(0, consoleBatch.length);
        wroteAny = true;
        flushBackoffMs = 0;
      } catch (error) {
        debugPersistLog("[LOGS][PERSIST][FLUSH_FAILED]", {
          storeName: "console_entries",
          error: error?.message || String(error),
          networkQueueLength: networkQueue.length,
          consoleQueueLength: consoleQueue.length,
          captureSessionId: captureState.sessionId || null,
          capturePartId: captureState.partId || null,
        });
        console.warn("[CONSOLE][FLUSH_FAILED]", error);
        setStatusMessage(
          "Logging storage issue. Retrying console flush.",
          "error"
        );
        flushBackoffMs = flushBackoffMs
          ? Math.min(FLUSH_BACKOFF_MAX_MS, flushBackoffMs * 2)
          : FLUSH_BACKOFF_BASE_MS;
      }
    }
    if (wroteAny) {
      await persistActivePart();
    }
  } finally {
    flushInProgress = false;
    if (networkQueue.length > 0 || consoleQueue.length > 0) {
      scheduleFlush();
    }
  }
}

function getExportQueueLength() {
  const active = exportRunning || (exportJob && exportJob.active);
  return exportQueue.length + (active ? 1 : 0);
}

function sendExportQueueUpdate() {
  sendExportEvent("EXPORT_QUEUE_UPDATE", {
    queueLength: getExportQueueLength(),
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureBrokerTabOrOffscreen() {
  if (brokerState.tabId) {
    brokerState.tabId = null;
  }
  const hasDocument = await chrome.offscreen.hasDocument();
  if (!hasDocument) {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL("background/download_broker.html"),
      reasons: ["BLOBS"],
      justification: "Download exported artifacts without opening a tab.",
    });
  }
  brokerState.ready = false;
  return "offscreen";
}

async function ensureBrokerReady() {
  if (brokerState.ready) {
    return;
  }
  await ensureBrokerTabOrOffscreen();
  let attempts = 0;
  while (attempts < 10) {
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: "BROKER_PING" }, (reply) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(reply);
        });
      });
      if (response && response.ok) {
        brokerState.ready = true;
        return;
      }
    } catch (error) {
      // Retry until broker is ready.
    }
    attempts += 1;
    await delay(200);
  }
  throw new Error("Download broker not ready.");
}

async function brokerDownloadBytes(arrayBuffer, filename, mimeType, opts = {}) {
  await ensureBrokerReady();
  if (!(arrayBuffer instanceof ArrayBuffer)) {
    throw new Error("Missing download bytes.");
  }
  const sendRequest = () =>
    new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: "BROKER_CREATE_URL",
          payload: {
            arrayBuffer,
            mimeType: mimeType || "application/octet-stream",
          },
        },
        (reply) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(reply);
        }
      );
    });
  let response;
  try {
    response = await sendRequest();
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    if (message.includes("message port closed")) {
      brokerState.ready = false;
      await ensureBrokerReady();
      response = await sendRequest();
    } else {
      throw error;
    }
  }
  if (!response || !response.ok || !response.url) {
    throw new Error(response && response.error ? response.error : "Download failed.");
  }
  if (!chrome.downloads?.download) {
    throw new Error("Downloads API unavailable.");
  }
  const downloadId = await new Promise((resolve, reject) => {
    chrome.downloads.download(
      { url: response.url, filename, saveAs: opts.saveAs === true },
      (id) => {
        if (chrome.runtime.lastError || !id) {
          reject(
            new Error(
              chrome.runtime.lastError
                ? chrome.runtime.lastError.message
                : "Download blocked."
            )
          );
          return;
        }
        resolve(id);
      }
    );
  });
  brokerDownloadUrls.set(downloadId, { url: response.url, artifactKey: null });
  return true;
}

async function brokerDownloadExportArtifact(artifactKey, filename, mimeType, opts = {}) {
  await ensureBrokerReady();
  if (!artifactKey) {
    throw new Error("Missing export artifact key.");
  }
  const sendRequest = () =>
    new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: "BROKER_CREATE_EXPORT_URL",
          payload: {
            artifactKey,
            mimeType: mimeType || "application/octet-stream",
          },
        },
        (reply) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(reply);
        }
      );
    });
  let response;
  try {
    response = await sendRequest();
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    if (message.includes("message port closed")) {
      brokerState.ready = false;
      await ensureBrokerReady();
      response = await sendRequest();
    } else {
      throw error;
    }
  }
  if (!response || !response.ok || !response.url) {
    throw new Error(response && response.error ? response.error : "Download failed.");
  }
  if (!chrome.downloads?.download) {
    throw new Error("Downloads API unavailable.");
  }
  const downloadId = await new Promise((resolve, reject) => {
    chrome.downloads.download(
      { url: response.url, filename, saveAs: opts.saveAs === true },
      (id) => {
        if (chrome.runtime.lastError || !id) {
          reject(
            new Error(
              chrome.runtime.lastError
                ? chrome.runtime.lastError.message
                : "Download blocked."
            )
          );
          return;
        }
        resolve(id);
      }
    );
  });
  brokerDownloadUrls.set(downloadId, { url: response.url, artifactKey });
  return true;
}

function overlayBootstrap() {
  if (window.__reproTimestampOverlay) {
    return;
  }
  const overlay = document.createElement("div");
  overlay.id = "repro-timestamp-overlay";
  overlay.style.position = "fixed";
  overlay.style.right = "10px";
  overlay.style.bottom = "10px";
  overlay.style.padding = "6px 8px";
  overlay.style.background = "rgba(0, 0, 0, 0.55)";
  overlay.style.color = "#ffffff";
  overlay.style.font = "12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  overlay.style.borderRadius = "8px";
  overlay.style.zIndex = "2147483647";
  overlay.style.pointerEvents = "none";
  overlay.style.whiteSpace = "nowrap";
  document.documentElement.appendChild(overlay);

  const state = {
    enabled: false,
    startMs: null,
    paused: false,
    pauseStartedAt: null,
    totalPausedMs: 0,
  };

  const formatTimestamp = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const formatElapsed = (ms) => {
    if (typeof ms !== "number") {
      return null;
    }
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  const computeElapsedMs = (nowMs) => {
    if (!state.startMs) {
      return null;
    }
    const endMs =
      state.paused && state.pauseStartedAt ? state.pauseStartedAt : nowMs;
    return Math.max(0, endMs - state.startMs - (state.totalPausedMs || 0));
  };

  const updateText = () => {
    if (!state.enabled) {
      overlay.style.display = "none";
      return;
    }
    overlay.style.display = "block";
    const nowMs = Date.now();
    let text = formatTimestamp(new Date(nowMs));
    const elapsed = computeElapsedMs(nowMs);
    if (elapsed !== null) {
      const elapsedText = formatElapsed(elapsed);
      if (elapsedText) {
        text += ` • +${elapsedText}`;
      }
    }
    overlay.textContent = text;
  };

  const applyState = (next) => {
    if (!next) {
      return;
    }
    if (typeof next.enabled === "boolean") {
      state.enabled = next.enabled;
    }
    if (typeof next.startMs === "number") {
      state.startMs = next.startMs;
    }
    if (typeof next.totalPausedMs === "number") {
      state.totalPausedMs = next.totalPausedMs;
    }
    if (typeof next.paused === "boolean") {
      state.paused = next.paused;
    }
    if (typeof next.pauseStartedAt === "number") {
      state.pauseStartedAt = next.pauseStartedAt;
    }
    updateText();
  };

  const timer = setInterval(updateText, 1000);
  updateText();

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== "TIMESTAMP_OVERLAY_COMMAND") {
      return false;
    }
    if (message.action === "update") {
      applyState(message.state || {});
      return false;
    }
    if (message.action === "remove") {
      clearInterval(timer);
      overlay.remove();
      delete window.__reproTimestampOverlay;
      return false;
    }
    return false;
  });

  window.__reproTimestampOverlay = { applyState };
}

function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

async function ensureTimestampOverlayInjected(tabId) {
  if (!chrome.scripting || !chrome.scripting.executeScript) {
    throw new Error("Scripting API unavailable.");
  }
  await chrome.scripting.executeScript({
    target: { tabId },
    func: overlayBootstrap,
  });
}

async function sendTimestampOverlayUpdate(tabId, state) {
  try {
    await sendMessageToTab(tabId, {
      type: "TIMESTAMP_OVERLAY_COMMAND",
      action: "update",
      state,
    });
    return;
  } catch (error) {
    await ensureTimestampOverlayInjected(tabId);
    await sendMessageToTab(tabId, {
      type: "TIMESTAMP_OVERLAY_COMMAND",
      action: "update",
      state,
    });
  }
}

async function removeTimestampOverlay(tabId) {
  if (!tabId) {
    return;
  }
  try {
    await sendMessageToTab(tabId, {
      type: "TIMESTAMP_OVERLAY_COMMAND",
      action: "remove",
    });
  } catch (error) {
    // Ignore if overlay was never injected.
  }
}

function getRecordingOverlayPayload() {
  return {
    enabled: timestampOverlayEnabled,
    startMs: recordingOverlayState.startMs,
    paused: recordingOverlayState.paused,
    pauseStartedAt: recordingOverlayState.pauseStartedAt,
    totalPausedMs: recordingOverlayState.totalPausedMs,
  };
}

async function applyRecordingTimestampOverlay() {
  const tabId = recordingOverlayState.tabId;
  if (!tabId) {
    return;
  }
  if (!timestampOverlayEnabled) {
    await removeTimestampOverlay(tabId);
    return;
  }
  try {
    await sendTimestampOverlayUpdate(tabId, getRecordingOverlayPayload());
  } catch (error) {
    setStatusMessage("Timestamp overlay not supported on this page.", "info");
  }
}

async function updatePartStatus(partId, status, extra = {}) {
  if (!partId || !isIdbAvailable()) {
    return;
  }
  const record = await ReproIdb.getByKey("parts", partId);
  if (!record) {
    return;
  }
  record.status = status;
  if (status === PART_STATUS.DOWNLOADED) {
    record.downloadedAtMs = Date.now();
  }
  if (status === PART_STATUS.DOWNLOAD_FAILED) {
    record.downloadFailedAtMs = Date.now();
  }
  Object.assign(record, extra);
  await ReproIdb.putOne("parts", record);
}

async function refreshCompletedPartsCount() {
  if (!captureState.sessionId || !isIdbAvailable()) {
    captureState.completedPartsCount = 0;
    return 0;
  }
  const parts = await ReproIdb.getAllByIndex(
    "parts",
    "sessionId",
    IDBKeyRange.only(captureState.sessionId)
  );
  const count = parts.filter(
    (part) =>
      part &&
      part.status &&
      part.status !== PART_STATUS.ACTIVE &&
      part.status !== PART_STATUS.DELETED
  ).length;
  captureState.completedPartsCount = count;
  return count;
}

async function hydrateCaptureStateFromIdb() {
  if (captureState.sessionId || !isIdbAvailable()) {
    return;
  }
  const sessions = await ReproIdb.getAllByIndex(
    "sessions",
    "createdAtMs",
    null,
    { limit: 1, direction: "prev" }
  );
  const latest = Array.isArray(sessions) && sessions.length ? sessions[0] : null;
  if (!latest) {
    return;
  }
  await loadCaptureSettings();
  if (latest.filters) {
    activeFilters = normalizeFilters(latest.filters);
  }
  captureState.sessionId = latest.sessionId;
  const parts = await ReproIdb.getAllByIndex(
    "parts",
    "sessionId",
    IDBKeyRange.only(latest.sessionId)
  );
  let activePart = null;
  let maxPartNumber = 0;
  let totalRequests = 0;
  let totalConsole = 0;
  let totalErrors = 0;
  parts.forEach((part) => {
    if (!part) {
      return;
    }
    if (typeof part.partNumber === "number") {
      maxPartNumber = Math.max(maxPartNumber, part.partNumber);
    }
    if (part.status !== PART_STATUS.DELETED) {
      totalRequests += part.requestCount || 0;
      totalConsole += part.consoleCount || 0;
      totalErrors += part.errorCount || 0;
    }
    if (part.status === PART_STATUS.ACTIVE) {
      activePart = part;
    }
  });
  captureState.totalRequests = totalRequests;
  captureState.totalConsole = totalConsole;
  captureState.totalErrors = totalErrors;
  if (activePart) {
    captureState.partId = activePart.partId;
    captureState.partNumber = activePart.partNumber || maxPartNumber || 1;
    captureState.partCreatedAtMs = activePart.createdAtMs || null;
    captureState.requestsInPart = activePart.requestCount || 0;
    captureState.consoleInPart = activePart.consoleCount || 0;
    captureState.errorsInPart = activePart.errorCount || 0;
    captureState.bytesInPart = activePart.bytesInPart || 0;
    captureState.networkBytesInPart = activePart.networkBytes || 0;
    captureState.consoleBytesInPart = activePart.consoleBytes || 0;
    captureState.lastEventMs = activePart.lastEventMs || null;
    captureState.partHasData =
      (activePart.requestCount || 0) > 0 || (activePart.consoleCount || 0) > 0;
  } else {
    captureState.partId = null;
    captureState.partNumber = maxPartNumber;
    captureState.partCreatedAtMs = null;
    captureState.requestsInPart = 0;
    captureState.consoleInPart = 0;
    captureState.errorsInPart = 0;
    captureState.bytesInPart = 0;
    captureState.networkBytesInPart = 0;
    captureState.consoleBytesInPart = 0;
    captureState.lastEventMs = null;
    captureState.partHasData = false;
  }
  await refreshLastCompletedPart();
}

function buildExportJobId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

async function enqueueExportJob(job) {
  if (!job || typeof job.run !== "function") {
    return { ok: false, error: "Invalid export job." };
  }
  if (job.dedupeId) {
    if (exportQueueIds.has(job.dedupeId)) {
      return { ok: false, error: "Part already queued for export." };
    }
    if (
      exportRunningJob &&
      exportRunningJob.dedupeId &&
      exportRunningJob.dedupeId === job.dedupeId
    ) {
      return { ok: false, error: "Export already running." };
    }
  }
  exportQueue.push(job);
  if (job.dedupeId) {
    exportQueueIds.add(job.dedupeId);
  }
  sendExportQueueUpdate();
  setTimeout(() => {
    void processExportQueue();
  }, 0);
  return { ok: true, queued: true, jobId: job.jobId };
}

async function enqueueExport(partSnapshot, options = {}) {
  if (!partSnapshot || !partSnapshot.partId) {
    return { ok: false, error: "No part available to export." };
  }
  const requestCount = partSnapshot.requestCount || 0;
  if (requestCount < MIN_REQUESTS_TO_EXPORT) {
    return {
      ok: false,
      error: `Not enough requests to export yet (need ${MIN_REQUESTS_TO_EXPORT}+).`,
    };
  }
  const alreadyExported = await isPartExported(partSnapshot.partId);
  if (alreadyExported && !options.allowDuplicate) {
    return { ok: false, error: "Part already exported." };
  }
  const jobId = buildExportJobId("part");
  const job = {
    jobId,
    kind: "export_zip",
    partId: partSnapshot.partId,
    partNumber: partSnapshot.partNumber,
    auto: options.auto === true,
    dedupeId: partSnapshot.partId,
    run: async () =>
      runEvidenceZipExport({
        partId: partSnapshot.partId,
        partNumber: partSnapshot.partNumber,
        exportJobId: jobId,
      }),
  };
  return await enqueueExportJob(job);
}

async function processExportQueue() {
  if (exportRunning) {
    return;
  }
  if (exportQueue.length === 0) {
    return;
  }
  await flushQueues();
  const next = exportQueue.shift();
  if (!next) {
    return;
  }
  if (next.dedupeId) {
    exportQueueIds.delete(next.dedupeId);
  }
  exportRunning = true;
  exportRunningJob = next;
  exportStatus = {
    jobId: next.jobId || null,
    partId: next.partId || null,
    partNumber: next.partNumber || null,
    percent: 0,
    phase: "Queued",
  };
  sendExportQueueUpdate();
  if (next.partId) {
    await updatePartStatus(next.partId, PART_STATUS.EXPORTING);
  }
  sendExportEvent("EXPORT_STARTED", {
    jobId: next.jobId,
    partId: next.partId || null,
    partNumber: next.partNumber || null,
    kind: next.kind || "export_zip",
  });
  try {
    await next.run();
    if (next.partId) {
      await markPartExported(next.partId);
      await updatePartStatus(next.partId, PART_STATUS.DOWNLOADED);
    }
    sendExportEvent("EXPORT_DONE", {
      jobId: next.jobId,
      partId: next.partId || null,
      partNumber: next.partNumber || null,
    });
  } catch (error) {
    if (next.partId) {
      await updatePartStatus(next.partId, PART_STATUS.DOWNLOAD_FAILED);
    }
    const userMessage =
      next.auto === true && next.partNumber
        ? `Auto-download was blocked by the browser. Part ${next.partNumber} is ready—click Download.`
        : "Download failed. Try again.";
    setStatusMessage(userMessage, "error");
    sendExportEvent("EXPORT_FAILED", {
      jobId: next.jobId,
      partId: next.partId || null,
      partNumber: next.partNumber || null,
      userMessage,
    });
  } finally {
    exportRunning = false;
    exportRunningJob = null;
    exportStatus = null;
    sendExportQueueUpdate();
    if (exportQueue.length > 0) {
      setTimeout(() => {
        void processExportQueue();
      }, 0);
    }
  }
}

function buildExportSizeError(message, debugCode) {
  const error = new Error(message);
  error.userMessage = message;
  error.debugCode = debugCode || "size_guard";
  return error;
}

async function yieldExport() {
  if (globalThis.ZipBuilderChunked && globalThis.ZipBuilderChunked.delay) {
    await globalThis.ZipBuilderChunked.delay(0);
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function estimateDataUrlBytes(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") {
    return 0;
  }
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) {
    return 0;
  }
  const base64Length = dataUrl.length - commaIndex - 1;
  return Math.floor((base64Length * 3) / 4);
}

function isFullPageScreenshotFileName(name) {
  if (!name || typeof name !== "string") {
    return false;
  }
  return name.includes("fullpage");
}

async function loadCaptureArtifactBlob(artifactKey) {
  if (!artifactKey || !isIdbAvailable() || !globalThis.ReproIdb) {
    return null;
  }
  const artifact = await ReproIdb.getByKey("capture_artifacts", artifactKey);
  if (!artifact || !artifact.blobKey) {
    return null;
  }
  const blobRecord = await ReproIdb.getByKey("capture_blobs", artifact.blobKey);
  if (!blobRecord || !(blobRecord.blob instanceof Blob)) {
    return null;
  }
  return blobRecord.blob;
}

async function buildEntriesJsonBlob(options) {
  const entries = Array.isArray(options.entries) ? options.entries : [];
  const version = options.version || "1.0";
  const maxBytes =
    typeof options.maxBytes === "number" ? options.maxBytes : null;
  const yieldEvery =
    typeof options.yieldEvery === "number" ? options.yieldEvery : JSON_BUILD_YIELD_EVERY;
  const parts = [];
  let size = 0;
  const pushChunk = (chunk) => {
    parts.push(chunk);
    size += chunk.length;
    if (maxBytes && size > maxBytes) {
      throw buildExportSizeError(
        `${options.label || "Export"} JSON exceeds size guard.`,
        options.debugCode || "json_too_large"
      );
    }
  };
  pushChunk(`{"version":"${version}","entries":[`);
  for (let i = 0; i < entries.length; i += 1) {
    if (i > 0) {
      pushChunk(",");
    }
    const entryJson = JSON.stringify(entries[i] || null);
    pushChunk(entryJson);
    if (yieldEvery > 0 && i % yieldEvery === 0) {
      await yieldExport();
    }
  }
  pushChunk("]}");
  return { blob: new Blob(parts, { type: "application/json" }), size };
}

async function buildNdjsonBlobFromEntries(options) {
  const entries = Array.isArray(options.entries) ? options.entries : [];
  const maxBytes =
    typeof options.maxBytes === "number" ? options.maxBytes : null;
  const yieldEvery =
    typeof options.yieldEvery === "number" ? options.yieldEvery : JSON_BUILD_YIELD_EVERY;
  const redactEntry =
    typeof options.redactEntry === "function" ? options.redactEntry : null;
  const onEntry =
    typeof options.onEntry === "function" ? options.onEntry : null;
  const parts = [];
  let size = 0;
  let count = 0;
  let truncated = false;
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (onEntry) {
      onEntry(entry);
    }
    const payload = redactEntry ? redactEntry(entry) : entry;
    const line = `${JSON.stringify(payload)}\n`;
    const nextSize = size + line.length;
    if (maxBytes && nextSize > maxBytes) {
      truncated = true;
      break;
    }
    size = nextSize;
    parts.push(line);
    count += 1;
    if (yieldEvery > 0 && i % yieldEvery === 0) {
      await yieldExport();
    }
  }
  return {
    blob: new Blob(parts, { type: "application/x-ndjson" }),
    size,
    count,
    truncated,
  };
}

function formatNetworkPrettyEntry(entry) {
  return {
    id: entry.id || null,
    timestamp_ms:
      typeof entry.timestamp_ms === "number"
        ? entry.timestamp_ms
        : typeof entry.t_ms === "number"
          ? entry.t_ms
          : null,
    request_id: entry.request_id || null,
    timestamp: entry.timestamp || null,
    timestamp_epoch_ms: entry.timestamp_epoch_ms || null,
    url: entry.url || null,
    method: entry.method || null,
    resource_type: entry.resource_type || null,
    response_status: entry.response_status || null,
    response_status_text: entry.response_status_text || null,
    error_text: entry.error_text || null,
    incomplete: entry.incomplete ? true : undefined,
    finalize_reason: entry.finalize_reason || null,
    response_mime_type: entry.response_mime_type || null,
    from_disk_cache:
      typeof entry.from_disk_cache === "boolean" ? entry.from_disk_cache : null,
    from_service_worker:
      typeof entry.from_service_worker === "boolean"
        ? entry.from_service_worker
        : null,
    request_headers: entry.request_headers || null,
    response_headers: entry.response_headers || null,
    request_post_data: entry.request_post_data || null,
    response_body: entry.response_body || null,
    response_body_skipped: entry.response_body_skipped ? true : undefined,
    request_body_truncated: entry.request_body_truncated ? true : undefined,
    response_body_truncated: entry.response_body_truncated ? true : undefined,
    request_body_original_bytes: entry.request_body_original_bytes || null,
    response_body_original_bytes: entry.response_body_original_bytes || null,
    timing: entry.timing || null,
  };
}

function isPostmanStaticAssetUrl(url) {
  if (!url) {
    return true;
  }
  const lower = String(url).toLowerCase();
  if (
    lower.startsWith("chrome://") ||
    lower.startsWith("edge://") ||
    lower.startsWith("about:") ||
    lower.startsWith("chrome-extension://") ||
    lower.startsWith("moz-extension://")
  ) {
    return true;
  }
  const staticExts = [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".css",
    ".map",
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".eot",
    ".mp4",
    ".mp3",
    ".webm",
    ".wav",
    ".m4a",
    ".avi",
    ".mov",
    ".pdf",
  ];
  return staticExts.some((ext) => lower.includes(ext));
}

function isPostmanStaticMimeType(mimeType) {
  if (!mimeType) {
    return false;
  }
  const lower = String(mimeType).toLowerCase();
  return (
    lower.startsWith("image/") ||
    lower.startsWith("font/") ||
    lower.startsWith("audio/") ||
    lower.startsWith("video/") ||
    lower === "text/css" ||
    lower.includes("font-woff") ||
    lower.includes("font-woff2") ||
    lower.includes("font-opentype") ||
    lower.includes("font-ttf") ||
    lower.includes("font-eot")
  );
}

function getHeaderValue(rawHeaders, name) {
  if (!rawHeaders || !name) {
    return "";
  }
  const target = name.toLowerCase();
  if (Array.isArray(rawHeaders)) {
    for (const item of rawHeaders) {
      if (item && typeof item === "object") {
        const key = item.key || item.name;
        if (key && String(key).toLowerCase() === target) {
          return String(item.value ?? "");
        }
      } else if (Array.isArray(item) && item.length >= 2) {
        if (String(item[0]).toLowerCase() === target) {
          return String(item[1] ?? "");
        }
      }
    }
    return "";
  }
  if (typeof rawHeaders === "object") {
    const matchKey = Object.keys(rawHeaders).find(
      (key) => String(key).toLowerCase() === target
    );
    if (matchKey) {
      return String(rawHeaders[matchKey] ?? "");
    }
  }
  return "";
}

function isPostmanStaticAsset(entry) {
  if (!entry) {
    return true;
  }
  if (isPostmanStaticAssetUrl(entry.url)) {
    return true;
  }
  return isPostmanStaticMimeType(entry.response_mime_type);
}

function isPostmanApiLikeOther(entry) {
  if (!entry) {
    return false;
  }
  const method = String(entry.method || "").toUpperCase();
  if (method && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    return true;
  }
  const url = String(entry.url || "").toLowerCase();
  if (url.includes("/api/") || url.includes("/graphql")) {
    return true;
  }
  const contentType = getHeaderValue(entry.request_headers, "content-type").toLowerCase();
  if (
    contentType.includes("application/json") ||
    contentType.includes("application/graphql") ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    return true;
  }
  const responseMime = String(entry.response_mime_type || "").toLowerCase();
  if (responseMime.includes("json") || responseMime.includes("graphql")) {
    return true;
  }
  return false;
}

function isPostmanEligibleEntry(entry) {
  if (!entry || !entry.url || !entry.method) {
    return false;
  }
  if (isPostmanStaticAsset(entry)) {
    return false;
  }
  const type = entry.resource_type
    ? String(entry.resource_type).toLowerCase()
    : "";
  if (!type) {
    return isPostmanApiLikeOther(entry);
  }
  if (type === "xhr" || type === "fetch") {
    return true;
  }
  if (type === "other") {
    return isPostmanApiLikeOther(entry);
  }
  return false;
}

function normalizePostmanHeaders(raw) {
  if (!raw) {
    return [];
  }
  const entries = [];
  if (Array.isArray(raw)) {
    raw.forEach((item) => {
      if (item && typeof item === "object") {
        const key = item.key || item.name;
        if (!key) {
          return;
        }
        entries.push([String(key), String(item.value ?? "")]);
        return;
      }
      if (Array.isArray(item) && item.length >= 2) {
        entries.push([String(item[0]), String(item[1] ?? "")]);
      }
    });
  } else if (typeof raw === "object") {
    Object.entries(raw).forEach(([key, value]) => {
      entries.push([String(key), String(value ?? "")]);
    });
  }
  if (entries.length === 0) {
    return [];
  }
  const seen = new Set();
  const normalized = [];
  entries.forEach(([key, value]) => {
    if (!key) {
      return;
    }
    if (key.startsWith(":")) {
      return;
    }
    const lower = key.toLowerCase();
    if (seen.has(lower)) {
      return;
    }
    seen.add(lower);
    normalized.push({ key, value });
  });
  return normalized;
}

function buildPostmanUrl(url) {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname
      .split("/")
      .filter((segment) => segment.length > 0);
    const query = [];
    parsed.searchParams.forEach((value, key) => {
      query.push({ key, value });
    });
    const result = {
      raw: url,
      protocol: parsed.protocol.replace(":", ""),
      host: parsed.hostname ? parsed.hostname.split(".") : [],
      path: pathParts,
    };
    if (parsed.port) {
      result.port = parsed.port;
    }
    if (query.length > 0) {
      result.query = query;
    }
    return result;
  } catch (error) {
    return { raw: url };
  }
}

function buildPostmanBody(entry, headers) {
  if (
    !entry ||
    entry.request_body_unavailable ||
    entry.request_body_truncated
  ) {
    return null;
  }
  const body =
    entry.request_post_data ??
    entry.request_body ??
    entry.request_body_raw ??
    null;
  if (body === null || body === undefined || body === "") {
    return null;
  }
  let contentType = "";
  for (const header of headers) {
    if (header.key && header.key.toLowerCase() === "content-type") {
      contentType = String(header.value || "").toLowerCase();
      break;
    }
  }
  const bodyText = typeof body === "string" ? body : String(body);
  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(bodyText);
      return {
        mode: "raw",
        raw: JSON.stringify(parsed, null, 2),
        options: { raw: { language: "json" } },
      };
    } catch (error) {
      return { mode: "raw", raw: bodyText };
    }
  }
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const urlencoded = [];
    try {
      const params = new URLSearchParams(bodyText);
      params.forEach((value, key) => {
        urlencoded.push({ key, value, type: "text" });
      });
    } catch (error) {
      return { mode: "raw", raw: bodyText };
    }
    return { mode: "urlencoded", urlencoded };
  }
  return { mode: "raw", raw: bodyText };
}

function buildPostmanDescription(entry) {
  if (!entry) {
    return "";
  }
  const bits = [];
  const fields = [
    "timestamp",
    "request_id",
    "resource_type",
    "response_status",
    "response_status_text",
    "incomplete",
    "finalize_reason",
    "error_text",
    "request_body_unavailable",
    "request_body_truncated",
    "response_body_unavailable",
    "response_body_truncated",
    "response_body_skipped",
  ];
  fields.forEach((field) => {
    if (entry[field] !== undefined && entry[field] !== null) {
      bits.push(`${field}: ${entry[field]}`);
    }
  });
  return bits.join("\n");
}

function buildPostmanRequestName(entry) {
  const method = String(entry.method || "GET").toUpperCase();
  try {
    const parsed = new URL(entry.url);
    const path = parsed.pathname || "/";
    return `${method} ${path}`;
  } catch (error) {
    return `${method} ${entry.url || ""}`.trim();
  }
}

function buildPostmanItem(entry) {
  if (!isPostmanEligibleEntry(entry)) {
    return null;
  }
  const headers = normalizePostmanHeaders(entry.request_headers);
  const request = {
    method: String(entry.method || "GET").toUpperCase(),
    header: headers,
    url: buildPostmanUrl(entry.url),
  };
  const body = buildPostmanBody(entry, headers);
  if (body) {
    request.body = body;
  }
  const item = {
    name: buildPostmanRequestName(entry),
    request,
  };
  const description = buildPostmanDescription(entry);
  if (description) {
    item.request.description = description;
  }
  const responseHeaders = normalizePostmanHeaders(entry.response_headers);
  const responseBody =
    entry.response_body_unavailable || entry.response_body_skipped
      ? null
      : entry.response_body;
  if (
    entry.response_status !== null ||
    responseHeaders.length > 0 ||
    (responseBody !== null && responseBody !== undefined && responseBody !== "")
  ) {
    let bodyText = "";
    if (typeof responseBody === "string") {
      bodyText = responseBody;
    } else if (responseBody !== null && responseBody !== undefined) {
      bodyText = JSON.stringify(responseBody, null, 2);
    }
    const responseStatusText =
      entry.response_status_text || String(entry.response_status || "");
    const responsePayload = {
      name: `Example response ${entry.response_status || ""}`.trim(),
      originalRequest: request,
      status: responseStatusText,
      code: typeof entry.response_status === "number" ? entry.response_status : 0,
      header: responseHeaders,
    };
    if (bodyText && !entry.response_body_unavailable && !entry.response_body_skipped) {
      responsePayload.body = bodyText;
    }
    item.response = [responsePayload];
  }
  return item;
}

function buildPostmanCollection(entries, sourceName) {
  const grouped = {};
  entries.forEach((entry) => {
    let host = "unknown-host";
    try {
      host = new URL(entry.url).hostname || host;
    } catch (error) {
      host = "unknown-host";
    }
    if (!grouped[host]) {
      grouped[host] = [];
    }
    grouped[host].push(entry);
  });
  const folders = Object.keys(grouped)
    .sort()
    .map((host) => {
      const items = grouped[host]
        .map((entry) => buildPostmanItem(entry))
        .filter(Boolean);
      return items.length > 0 ? { name: host, item: items } : null;
    })
    .filter(Boolean);
  return {
    info: {
      name: `DebugDuck Import - ${sourceName}`,
      _postman_id: `debugduck-${sourceName}`,
      schema:
        "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      description: "Generated from DebugDuck network NDJSON export.",
    },
    item: folders,
    variable: [],
  };
}

function formatConsolePrettyEntry(entry) {
  return {
    id: entry.id || null,
    timestamp_ms:
      typeof entry.timestamp_ms === "number"
        ? entry.timestamp_ms
        : typeof entry.t_ms === "number"
          ? entry.t_ms
          : null,
    timestamp: entry.timestamp || null,
    timestamp_epoch_ms: entry.timestamp_epoch_ms || null,
    level: entry.level || "log",
    message: entry.message || "",
    args: Array.isArray(entry.args) ? entry.args : [],
    source: entry.source || "console",
    url: entry.url || null,
    line: typeof entry.line === "number" ? entry.line : null,
    column: typeof entry.column === "number" ? entry.column : null,
    stack: entry.stack || null,
  };
}

async function buildEntriesJsonBlobFromIdb(options) {
  if (!isIdbAvailable()) {
    throw new Error("IndexedDB unavailable.");
  }
  const version = options.version || "1.0";
  const maxBytes =
    typeof options.maxBytes === "number" ? options.maxBytes : null;
  const yieldEvery =
    typeof options.yieldEvery === "number" ? options.yieldEvery : JSON_BUILD_YIELD_EVERY;
  const redactEntry =
    typeof options.redactEntry === "function" ? options.redactEntry : null;
  const onEntry =
    typeof options.onEntry === "function" ? options.onEntry : null;
  const limit =
    typeof options.limit === "number" ? Math.max(0, options.limit) : null;
  const batchSize =
    typeof options.batchSize === "number" ? options.batchSize : 500;
  const parts = [];
  let size = 0;
  let count = 0;
  const pushChunk = (chunk) => {
    parts.push(chunk);
    size += chunk.length;
    if (maxBytes && size > maxBytes) {
      throw buildExportSizeError(
        `${options.label || "Export"} JSON exceeds size guard.`,
        options.debugCode || "json_too_large"
      );
    }
  };
  pushChunk(`{"version":"${version}","entries":[`);
  let first = true;
  const keyRange = options.keyRange || null;
  let offset = 0;
  let done = false;
  while (!done) {
    const remaining = limit ? Math.max(0, limit - count) : null;
    const nextBatchSize =
      remaining !== null ? Math.min(batchSize, remaining) : batchSize;
    if (remaining === 0) {
      break;
    }
    const batch = await ReproIdb.getBatchByIndex(
      options.storeName,
      options.indexName,
      keyRange,
      offset,
      nextBatchSize
    );
    const items = batch && Array.isArray(batch.items) ? batch.items : [];
    if (items.length === 0) {
      break;
    }
    items.forEach((record) => {
      const entry = record && record.entry ? record.entry : record;
      if (onEntry) {
        onEntry(entry, record);
      }
      const payload = redactEntry ? redactEntry(entry) : entry;
      const json = JSON.stringify(payload);
      if (!first) {
        pushChunk(",");
      }
      pushChunk(json);
      first = false;
      count += 1;
    });
    offset += items.length;
    done = batch.done === true || items.length < nextBatchSize;
    if (yieldEvery > 0) {
      await yieldExport();
    }
  }
  pushChunk("]}");
  return { blob: new Blob(parts, { type: "application/json" }), size, count };
}

async function loadLimitedEntriesFromIdb(options) {
  if (!isIdbAvailable()) {
    return [];
  }
  const keyRange = options.keyRange || null;
  const direction = options.direction || "prev";
  const limit = options.limit || 0;
  const records = await ReproIdb.getAllByIndex(
    options.storeName,
    options.indexName,
    keyRange,
    { limit, direction }
  );
  const entries = records
    .map((record) => (record && record.entry ? record.entry : record))
    .reverse();
  return entries;
}

async function downloadBlob(blob, filename, opts = {}) {
  const saveAs = opts.saveAs !== undefined ? opts.saveAs : true;
  const arrayBuffer = await blob.arrayBuffer();
  await brokerDownloadBytes(arrayBuffer, filename, blob.type, { saveAs });
  if (saveAs) {
    return true;
  }
  return true;
}

function detectBrowser(userAgent) {
  if (/Edg\//.test(userAgent)) {
    return "edge";
  }
  if (/Chrome\//.test(userAgent)) {
    return "chrome";
  }
  return "chromium";
}

function parseBrowserVersion(userAgent) {
  const edgeMatch = userAgent.match(/Edg\/([\d.]+)/);
  if (edgeMatch) {
    return edgeMatch[1];
  }
  const chromeMatch = userAgent.match(/Chrome\/([\d.]+)/);
  if (chromeMatch) {
    return chromeMatch[1];
  }
  return "unknown";
}

function formatZipTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

async function dataUrlToBlobAsync(dataUrl) {
  const response = await fetch(dataUrl);
  return await response.blob();
}

function getArrayBufferFromUint8Array(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function assertZipSignature(bytes) {
  if (!bytes || bytes.length < 2) {
    const error = new Error("ZIP generation failed (empty output).");
    error.userMessage = "ZIP generation failed (empty output).";
    error.debugCode = "zip_empty";
    throw error;
  }
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    const error = new Error("ZIP generation failed (invalid signature).");
    error.userMessage = "ZIP generation failed (invalid signature).";
    error.debugCode = "zip_bad_signature";
    throw error;
  }
}

function assertZipEocd(bytes) {
  if (!bytes || bytes.length < 22) {
    const error = new Error("ZIP generation failed (missing EOCD).");
    error.userMessage = "ZIP generation failed (missing EOCD).";
    error.debugCode = "zip_missing_eocd";
    throw error;
  }
  const tailScan = Math.max(0, bytes.length - 1024);
  for (let i = bytes.length - 4; i >= tailScan; i -= 1) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x05 &&
      bytes[i + 3] === 0x06
    ) {
      return;
    }
  }
  const error = new Error("ZIP generation failed (missing EOCD).");
  error.userMessage = "ZIP generation failed (missing EOCD).";
  error.debugCode = "zip_missing_eocd";
  throw error;
}

function computeFnv1a(bytes) {
  let hash = 0x811c9dc5;
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < data.length; i += 1) {
    hash ^= data[i];
    hash = (hash * 0x01000193) >>> 0;
  }
  return `fnv1a32:${hash.toString(16).padStart(8, "0")}`;
}

function buildExportArtifactKey() {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : String(Math.floor(Math.random() * 1e9));
  return `export_zip_${Date.now()}_${suffix}`;
}

async function storeExportArtifact(arrayBuffer, metadata) {
  if (!isIdbAvailable()) {
    throw new Error("IndexedDB unavailable.");
  }
  const artifactKey = buildExportArtifactKey();
  const byteLength =
    arrayBuffer && typeof arrayBuffer.byteLength === "number"
      ? arrayBuffer.byteLength
      : 0;
  const checksum = computeFnv1a(new Uint8Array(arrayBuffer));
  const record = {
    key: artifactKey,
    bytes: arrayBuffer,
    size: byteLength,
    checksum,
    mimeType: metadata && metadata.mimeType ? metadata.mimeType : "application/zip",
    filename: metadata && metadata.filename ? metadata.filename : null,
    createdAtMs: Date.now(),
  };
  await ReproIdb.putOne("export_artifacts", record);
  console.log("[EXPORT][ZIP_STORED]", {
    artifactKey,
    bytes: byteLength,
    checksum,
  });
  return { artifactKey, checksum, byteLength };
}

function isRestrictedUrl(url) {
  if (!url) {
    return true;
  }
  if (/\.pdf(\?|#|$)/i.test(url)) {
    return true;
  }
  if (
    url.startsWith("chrome://") ||
    url.startsWith("edge://") ||
    url.startsWith("chrome-extension://")
  ) {
    return true;
  }
  if (url.startsWith("https://chrome.google.com/webstore")) {
    return true;
  }
  if (url.startsWith("https://microsoftedge.microsoft.com/addons")) {
    return true;
  }
  return false;
}

function ensureTabIsCapturable(tab) {
  if (!tab || !tab.id) {
    throw new Error("No active tab available.");
  }
  if (isRestrictedUrl(tab.url)) {
    setStatusMessage(
      "Capture is not supported on browser or store pages. Open a regular website tab and try again.",
      "error"
    );
    throw new Error("Capture not supported on this page.");
  }
}

function setStatusMessage(message, level = "info") {
  statusMessage = {
    message,
    level,
    timestamp: nowIso(),
  };
}

function clearStatusMessage() {
  statusMessage = null;
}

async function ensurePanelOverlayInjected(tabId) {
  if (!chrome.scripting || !chrome.scripting.executeScript) {
    throw new Error("Scripting API unavailable.");
  }
  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ["content/panel_overlays.css"],
  });
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content/panel_overlays.js"],
  });
}

function classifyOverlayError(error) {
  const message = error && error.message ? error.message : String(error || "");
  if (message.includes("Scripting API unavailable")) {
    return {
      userMessage: "Panel unavailable: scripting blocked on this page.",
      detail: message,
    };
  }
  if (
    message.includes("Cannot access") ||
    message.includes("not allowed") ||
    message.includes("restricted")
  ) {
    return {
      userMessage: "Panel unavailable on this page.",
      detail: message,
    };
  }
  if (message.includes("Overlay did not acknowledge")) {
    return {
      userMessage:
        "Panel failed to load. This page may block extension scripts.",
      detail: message,
    };
  }
  return {
    userMessage: `Panel failed to open: ${message}`,
    detail: message,
  };
}

async function probeOverlayHost(tabId) {
  if (!chrome.scripting || !chrome.scripting.executeScript) {
    throw new Error("Scripting API unavailable.");
  }
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => ({
      ok: true,
      hasOverlay: Boolean(window.__reproPanelOverlays),
    }),
  });
  return results && results[0] ? results[0].result : { ok: true, hasOverlay: false };
}

async function sendPanelOverlayCommand(tabId, panel, action, payload = {}) {
  const response = await sendMessageToTabWithResponse(tabId, {
    type: "REPRO_PANEL_OVERLAY",
    panel,
    action,
    ...payload,
  });
  if (!response || response.ok !== true) {
    throw new Error(
      response && response.error
        ? response.error
        : "Overlay did not acknowledge."
    );
  }
  return response;
}

async function mountPanelOverlay(tabId, panel) {
  try {
    await sendPanelOverlayCommand(tabId, panel, "mount");
    return true;
  } catch (error) {
    await ensurePanelOverlayInjected(tabId);
    await sendPanelOverlayCommand(tabId, panel, "mount");
    return true;
  }
}

async function setPanelOverlayHidden(tabId, panel, hidden) {
  try {
    await sendPanelOverlayCommand(tabId, panel, "set_hidden", {
      hidden: hidden === true,
    });
    return true;
  } catch (error) {
    await ensurePanelOverlayInjected(tabId);
    await sendPanelOverlayCommand(tabId, panel, "set_hidden", {
      hidden: hidden === true,
    });
    return true;
  }
}

async function restorePanelAfterRecording(tabId) {
  if (!tabId) {
    return;
  }
  setPanelHiddenForCapture(tabId, "logs", false);
  await setPanelOverlayHidden(tabId, "logs", false);
  if (state.network.active && !isPanelClosed(tabId, "logs")) {
    await showPanelOverlay(tabId, "logs");
  }
}

async function showPanelOverlay(tabId, panel) {
  try {
    await sendPanelOverlayCommand(tabId, panel, "show");
    return true;
  } catch (error) {
    await ensurePanelOverlayInjected(tabId);
    await sendPanelOverlayCommand(tabId, panel, "show");
    return true;
  }
}

async function hidePanelOverlay(tabId, panel) {
  try {
    await sendPanelOverlayCommand(tabId, panel, "hide");
    return true;
  } catch (error) {
    return false;
  }
}

function updateRecordingPanelWindowFocus(windowId) {
  return new Promise((resolve) => {
    chrome.windows.update(windowId, { focused: true }, (windowInfo) => {
      if (chrome.runtime.lastError || !windowInfo) {
        resolve(null);
        return;
      }
      resolve(windowInfo);
    });
  });
}

async function findRecordingPanelWindow() {
  return new Promise((resolve) => {
    const panelUrl = chrome.runtime.getURL("popup/recording_panel.html");
    chrome.windows.getAll({ populate: true, windowTypes: ["popup"] }, (windows) => {
      if (chrome.runtime.lastError || !Array.isArray(windows)) {
        resolve(null);
        return;
      }
      for (const windowInfo of windows) {
        const tab =
          windowInfo && Array.isArray(windowInfo.tabs)
            ? windowInfo.tabs.find((candidate) => {
                const url = candidate && candidate.url ? candidate.url : "";
                return url === panelUrl || url.startsWith(`${panelUrl}?`);
              })
            : null;
        if (tab && windowInfo && typeof windowInfo.id === "number") {
          resolve({ windowId: windowInfo.id, tabId: tab.id || null });
          return;
        }
      }
      resolve(null);
    });
  });
}

async function focusRecordingPanelWindow() {
  if (recordingPanelWindowId) {
    const updated = await updateRecordingPanelWindowFocus(recordingPanelWindowId);
    if (updated) {
      console.log("[REC][sw] recording panel focused", {
        windowId: recordingPanelWindowId,
      });
      if (
        recordingPanelTargetTabId &&
        recordingPanelWindowTabId &&
        typeof recordingPanelTargetTabId === "number"
      ) {
        chrome.tabs.update(recordingPanelWindowTabId, {
          url: chrome.runtime.getURL(
            `popup/recording_panel.html?targetTabId=${recordingPanelTargetTabId}`
          ),
        });
      }
      return { ok: true, windowInfo: updated };
    }
    recordingPanelWindowId = null;
    recordingPanelWindowTabId = null;
  }

  const discovered = await findRecordingPanelWindow();
  if (discovered && typeof discovered.windowId === "number") {
    recordingPanelWindowId = discovered.windowId;
    recordingPanelWindowTabId = discovered.tabId || null;
    const updated = await updateRecordingPanelWindowFocus(recordingPanelWindowId);
    if (updated) {
      console.log("[REC][sw] recording panel focused", {
        windowId: recordingPanelWindowId,
      });
      if (
        recordingPanelTargetTabId &&
        recordingPanelWindowTabId &&
        typeof recordingPanelTargetTabId === "number"
      ) {
        chrome.tabs.update(recordingPanelWindowTabId, {
          url: chrome.runtime.getURL(
            `popup/recording_panel.html?targetTabId=${recordingPanelTargetTabId}`
          ),
        });
      }
      return { ok: true, windowInfo: updated };
    }
  }

  recordingPanelWindowId = null;
  recordingPanelWindowTabId = null;
  return { ok: false, reason: "panel_missing" };
}

async function openRecordingPanelWindow(targetTabId) {
  const createWindow = () =>
    new Promise((resolve, reject) => {
      const url = chrome.runtime.getURL(
        recordingPanelTargetTabId
          ? `popup/recording_panel.html?targetTabId=${recordingPanelTargetTabId}`
          : "popup/recording_panel.html"
      );
      console.log("[REC][sw] openRecordingPanelWindow create", {
        panelUrl: url,
        targetTabId: recordingPanelTargetTabId || null,
      });
      chrome.windows.create(
        {
          url,
          type: "popup",
          width: 360,
          height: 420,
          focused: true,
        },
        (windowInfo) => {
          if (chrome.runtime.lastError || !windowInfo) {
            reject(
              new Error(
                chrome.runtime.lastError
                  ? chrome.runtime.lastError.message
                  : "Failed to open recording panel window."
              )
            );
            return;
          }
          console.log("[REC][sw] recording panel window created", {
            windowId: windowInfo.id || null,
            tabId: windowInfo.tabs && windowInfo.tabs[0] ? windowInfo.tabs[0].id : null,
          });
          resolve(windowInfo);
        }
      );
    });
  const focusResult = await focusRecordingPanelWindow();
  if (focusResult.ok) {
    return focusResult.windowInfo;
  }
  const windowInfo = await createWindow();
  recordingPanelWindowId = windowInfo.id || null;
  recordingPanelWindowTabId =
    windowInfo.tabs && windowInfo.tabs[0] ? windowInfo.tabs[0].id : null;
  return windowInfo;
}

function waitForRecordingPanelReady(timeoutMs = 1500) {
  if (recordingPanelReadyWaiter && recordingPanelReadyWaiter.promise) {
    return recordingPanelReadyWaiter.promise;
  }
  let resolveFn;
  const promise = new Promise((resolve) => {
    resolveFn = resolve;
  });
  const timer = setTimeout(() => {
    resolveFn({ ok: false, timeout: true });
  }, timeoutMs);
  recordingPanelReadyWaiter = {
    promise,
    resolve: (payload) => {
      clearTimeout(timer);
      resolveFn(payload);
    },
  };
  return promise.finally(() => {
    recordingPanelReadyWaiter = null;
  });
}

function closeRecordingPanelWindow() {
  return new Promise((resolve) => {
    if (!recordingPanelWindowId) {
      resolve(false);
      return;
    }
    const windowId = recordingPanelWindowId;
    recordingPanelWindowId = null;
    recordingPanelWindowTabId = null;
    recordingPanelTargetTabId = null;
    chrome.windows.remove(windowId, () => {
      resolve(true);
    });
  });
}

async function openRecordingPanelOverlay(tabId) {
  const tab = tabId ? await chrome.tabs.get(tabId) : await getActiveTab();
  ensureTabIsCapturable(tab);
  markPanelClosed(tab.id, "recording", false);
  try {
    await probeOverlayHost(tab.id);
    await setPanelOverlayHidden(tab.id, "recording", false);
    const ok = await showPanelOverlay(tab.id, "recording");
    if (!ok) {
      throw new Error("Recording panel failed to open.");
    }
  } catch (error) {
    const classified = classifyOverlayError(error);
    console.warn("[PANEL][OVERLAY][RECORDING_OPEN_FAILED]", {
      tabId: tab.id,
      error: classified.detail,
    });
    throw new Error(classified.userMessage);
  }
}

async function openLogsPanelOverlay(tabId) {
  const tab = tabId ? await chrome.tabs.get(tabId) : await getActiveTab();
  ensureTabIsCapturable(tab);
  markPanelClosed(tab.id, "logs", false);
  try {
    await probeOverlayHost(tab.id);
    await setPanelOverlayHidden(tab.id, "logs", false);
    const ok = await showPanelOverlay(tab.id, "logs");
    if (!ok) {
      throw new Error("Logs panel failed to open.");
    }
    logsPanelTabId = tab.id;
  } catch (error) {
    const classified = classifyOverlayError(error);
    console.warn("[PANEL][OVERLAY][LOGS_OPEN_FAILED]", {
      tabId: tab.id,
      error: classified.detail,
    });
    throw new Error(classified.userMessage);
  }
}

function createSessionId() {
  if (crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const random = Math.random().toString(16).slice(2);
  return `session_${Date.now()}_${random}`;
}

async function createRecordingSessionRecord(tabId, mimeType) {
  const sessionId = createSessionId();
  const record = {
    sessionId,
    tabId: tabId || null,
    status: "starting",
    startedAt: Date.now(),
    stoppedAt: null,
    mimeType: mimeType || null,
    durationMs: null,
    chunkCount: 0,
    bytesWritten: 0,
    finalBlobKey: null,
    isPartial: false,
    failureReason: null,
  };
  try {
    await ReproIdb.putOne("recording_sessions", record);
  } catch (error) {
    console.warn("[RECORDING][SESSION_CREATE_FAILED]", error);
  }
  console.log("[RECORDING][SESSION_CREATED]", {
    sessionId,
    tabId: tabId || null,
    mimeType: mimeType || null,
  });
  return sessionId;
}

async function updateRecordingSessionRecord(sessionId, updates) {
  if (!sessionId) {
    return null;
  }
  try {
    const existing = await ReproIdb.getByKey("recording_sessions", sessionId);
    const next = {
      ...(existing || { sessionId }),
      ...updates,
    };
    await ReproIdb.putOne("recording_sessions", next);
    return next;
  } catch (error) {
    console.warn("[RECORDING][SESSION_UPDATE_FAILED]", error);
    return null;
  }
}

async function cleanupRecordingSessionData(
  sessionId,
  { removeArtifacts = true, reason = "manual" } = {}
) {
  if (!sessionId) {
    return { removedChunks: 0, removedArtifacts: 0 };
  }
  let removedChunks = 0;
  let removedArtifacts = 0;
  try {
    const chunks = await ReproIdb.getAllByIndex(
      "recording_chunks",
      "sessionId",
      IDBKeyRange.only(sessionId)
    );
    for (const chunk of chunks) {
      await ReproIdb.deleteByKey("recording_chunks", chunk.key);
      removedChunks += 1;
    }
  } catch (error) {
    console.warn("[RECORDING][CLEANUP_CHUNKS_FAILED]", error);
  }
  if (removeArtifacts) {
    try {
      const artifacts = await ReproIdb.getAllByIndex(
        "recording_artifacts",
        "sessionId",
        IDBKeyRange.only(sessionId)
      );
      for (const artifact of artifacts) {
        await ReproIdb.deleteByKey("recording_artifacts", artifact.key);
        removedArtifacts += 1;
      }
    } catch (error) {
      console.warn("[RECORDING][CLEANUP_ARTIFACTS_FAILED]", error);
    }
  }
  await updateRecordingSessionRecord(sessionId, {
    cleanedAtMs: Date.now(),
    chunksCleanedAtMs: Date.now(),
    artifactsCleanedAtMs: removeArtifacts ? Date.now() : null,
    cleanupReason: reason,
  });
  console.log("[RECORDING][CLEANUP]", {
    sessionId,
    removedChunks,
    removedArtifacts,
  });
  return { removedChunks, removedArtifacts };
}

async function runRecordingRetentionCleanup() {
  try {
    const cutoff = Date.now() - RECORDING_RETENTION_MS;
    const sessions = await ReproIdb.getAllByIndex(
      "recording_sessions",
      "startedAt",
      IDBKeyRange.upperBound(cutoff)
    );
    for (const sessionRecord of sessions) {
      if (!sessionRecord || !sessionRecord.sessionId) {
        continue;
      }
      const status = sessionRecord.status || "idle";
      if (
        ["recording", "paused", "starting", "stopping", "finalizing"].includes(
          status
        )
      ) {
        continue;
      }
      await cleanupRecordingSessionData(sessionRecord.sessionId, {
        removeArtifacts: true,
        reason: "retention",
      });
    }
  } catch (error) {
    console.warn("[RECORDING][RETENTION_CLEANUP_FAILED]", error);
  }
}

function updateSessionCounts() {
  if (!session) {
    return;
  }
  if (captureState && captureState.sessionId) {
    session.counts.network_requests = captureState.totalRequests;
    session.counts.console_entries = captureState.totalConsole;
    session.counts.errors = captureState.totalErrors;
    return;
  }
  session.counts.network_requests = Object.keys(state.network.requests).length;
  session.counts.console_entries = state.console.logs.length;
  session.counts.errors = state.console.logs.filter(
    (entry) => entry.level === "error"
  ).length;
}

function addDiagnostic(level, message, context) {
  if (!session) {
    return;
  }
  session.diagnostics.push({
    timestamp: nowIso(),
    level,
    message,
    context: context || null,
  });
  if (level === "error") {
    session.state = "error";
    if (!session.ended_at) {
      session.ended_at = nowIso();
    }
  }
  updateSessionCounts();
}

function describeMode(mode) {
  return MODE_LABELS[mode] || mode;
}

function checkStartMode(mode, options = {}) {
  if (!session) {
    return { allowed: true };
  }
  const canonicalRecordingState = recordingController.state || state.recording.status;
  const recordingActive = ["starting", "recording", "paused", "stopping"].includes(
    canonicalRecordingState
  );
  const allowExistingSession = options.allowExistingSession === true;
  const active =
    session.state === "capturing" ||
    session.state === "paused" ||
    recordingActive ||
    state.network.active;
  if (active) {
    if (session.mode === mode) {
      const message = `${describeMode(mode)} capture is already running.`;
      setStatusMessage(message, "info");
      return { allowed: false, reason: "already_running", message };
    }
    if (
      allowExistingSession &&
      mode === "network_console" &&
      session.mode === "session" &&
      !state.network.active &&
      (recordingActive || session.state === "error")
    ) {
      return { allowed: true, reason: "session_merge" };
    }
    const message = `Another capture (${describeMode(
      session.mode
    )}) is active. Stop or reset before starting ${describeMode(mode)}.`;
    setStatusMessage(message, "error");
    return { allowed: false, reason: "blocked", message };
  }
  const message = "A session already exists. Reset to start a new capture.";
  setStatusMessage(message, "error");
  return { allowed: false, reason: "session_exists", message };
}

function createSession(mode, tab, options = {}) {
  chrome.storage.session.remove(["annotationSettings"]);
  const monotonicBaseline = captureMonotonicBaseline();
  const lightweight = options.lightweight === true;
  if (options.resetCounters !== false) {
    resetCaptureState();
    state.network.requests = {};
    state.network.order = [];
    state.network.capped = false;
    state.network.startedAt = null;
    state.network.stoppedAt = null;
    state.console.logs = [];
    state.console.startedAt = null;
    state.console.stoppedAt = null;
  }
  session = {
    session_id: createSessionId(),
    created_at: nowIso(),
    ended_at: null,
    mode,
    state: "capturing",
    pause_started_at: null,
    total_paused_ms: 0,
    screenshots: [],
    active_tab: {
      tab_id: tab && tab.id ? tab.id : null,
      url: tab && tab.url ? tab.url : "",
      title: tab && tab.title ? tab.title : "",
    },
    counts: {
      network_requests: 0,
      console_entries: 0,
      errors: 0,
    },
    diagnostics: [],
    monotonic: monotonicBaseline.monotonic,
    monotonic_available: monotonicBaseline.monotonic_available,
    lightweight,
  };
  try {
    if (lightweight) {
      return;
    }
    const reportConfig = getReportConfig();
    if (
      reportConfig.enabled &&
      globalThis.ReportSessionManager &&
      typeof globalThis.ReportSessionManager.createSession === "function"
    ) {
      const now = nowIso();
      globalThis.ReportSessionManager.createSession({
        sessionId: session.session_id,
        startUrl: tab && tab.url ? tab.url : "",
        currentUrl: tab && tab.url ? tab.url : "",
        browserInfo: {
          userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent || "" : "",
          platform:
            typeof navigator !== "undefined" ? navigator.platform || "" : "",
          language:
            typeof navigator !== "undefined" ? navigator.language || "" : "",
        },
        viewport: { width: 0, height: 0 },
        meta: {
          reportEnabled: true,
          reportVersion: reportConfig.version,
        },
      });
      if (
        globalThis.ReportStepTracker &&
        typeof globalThis.ReportStepTracker.recordSessionStartStep === "function"
      ) {
        globalThis.ReportStepTracker.recordSessionStartStep({
          url: tab && tab.url ? tab.url : "",
          title: tab && tab.title ? tab.title : "",
          timestamp: now,
          navigationKind: "start",
          tabId: tab && tab.id ? tab.id : null,
        });
      }
    }
  } catch (error) {
    // Report session is optional; ignore failures.
  }
}

function ensureSessionForMode(mode, tab, options = {}) {
  if (session) {
    if (session.mode === mode && session.state === "error") {
      session.state = "capturing";
      session.ended_at = null;
      clearStatusMessage();
      return;
    }
    throw new Error("A session already exists. Reset to start a new capture.");
  }
  createSession(mode, tab, options);
}

function setSessionState(stateValue) {
  if (!session) {
    return;
  }
  session.state = stateValue;
}

function setNetworkCaptureEnabled(enabled) {
  state.network.captureEnabled = Boolean(enabled);
}

function getLogsCaptureState() {
  if (captureState.pausedForStorageLimit) {
    return "paused";
  }
  if (captureState.logsState) {
    return captureState.logsState;
  }
  return state.network.active ? "capturing" : "idle";
}

function isLogsCapturing() {
  return getLogsCaptureState() === "capturing";
}

function markSessionStopped(options = {}) {
  if (!session) {
    return;
  }
  const recordingState = recordingController.state || state.recording.status || "idle";
  const recordingActive = ["starting", "recording", "paused", "stopping"].includes(
    recordingState
  );
  if (!options.force && (recordingActive || state.network.active)) {
    return;
  }
  if (session.pause_started_at) {
    const pausedAt = new Date(session.pause_started_at).getTime();
    if (!Number.isNaN(pausedAt)) {
      session.total_paused_ms =
        (session.total_paused_ms || 0) + (Date.now() - pausedAt);
    }
    session.pause_started_at = null;
  }
  session.state = "stopped";
  if (!session.ended_at) {
    session.ended_at = nowIso();
  }
}

function getArtifactsSnapshot() {
  const screenshotCount =
    session && Array.isArray(session.screenshots) ? session.screenshots.length : 0;
  const networkCount = captureState.sessionId
    ? captureState.totalRequests
    : Object.keys(state.network.requests).length;
  const consoleCount = captureState.sessionId
    ? captureState.totalConsole
    : state.console.logs.length;
  return {
    hasScreenshot: Boolean(state.screenshot.dataUrl) || screenshotCount > 0,
    hasRecording: Boolean(state.recording.dataUrl) || Boolean(state.recording.hasData),
    hasNetworkLogs: networkCount > 0,
    hasConsoleLogs: consoleCount > 0,
    hasAnyArtifacts:
      Boolean(state.screenshot.dataUrl) ||
      Boolean(state.recording.dataUrl) ||
      Boolean(state.recording.hasData) ||
      networkCount > 0 ||
      consoleCount > 0,
  };
}

function hasExportableArtifacts() {
  const screenshotCount =
    session && Array.isArray(session.screenshots) ? session.screenshots.length : 0;
  const networkCount = captureState.sessionId
    ? captureState.totalRequests
    : Object.keys(state.network.requests).length;
  const consoleCount = captureState.sessionId
    ? captureState.totalConsole
    : state.console.logs.length;
  const hasRecording = Boolean(state.recording.dataUrl) || state.recording.hasData;
  const hasNetwork = networkCount > 0;
  const hasConsole = consoleCount > 0;
  const hasScreenshot = Boolean(state.screenshot.dataUrl) || screenshotCount > 0;
  return (
    hasRecording ||
    hasNetwork ||
    hasConsole ||
    hasScreenshot
  );
}

function getStatusSnapshot() {
  if (session && session.filters) {
    activeFilters = normalizeFilters(session.filters);
  }
  updateSessionCounts();
  const artifacts = getArtifactsSnapshot();
  return {
    screenshotCapturedAt: state.screenshot.capturedAt,
    recordingStatus: state.recording.status,
    recordingCapturedAt: state.recording.capturedAt,
    networkActive: state.network.active,
    debugLogs: DEBUG_PERSIST_LOGS
      ? debugLogBuffer.slice(-DEBUG_LOG_BUFFER_MAX)
      : [],
    logsState: getLogsCaptureState(),
    networkCount: captureState.sessionId
      ? captureState.totalRequests
      : Object.keys(state.network.requests).length,
    consoleCount: captureState.sessionId
      ? captureState.totalConsole
      : state.console.logs.length,
    part: {
      partNumber: captureState.partNumber,
      partId: captureState.partId,
      requestsInPart: captureState.requestsInPart,
      capRequests: captureState.capRequests,
      capBytes: captureState.capBytes,
      errorsInPart: captureState.errorsInPart,
      bytesInPart: captureState.bytesInPart,
      networkBytesInPart: captureState.networkBytesInPart,
      consoleBytesInPart: captureState.consoleBytesInPart,
      maxBodyBytes: captureState.maxBodyBytes,
      autoDownloadOnRollover: captureState.autoDownloadOnRollover,
      lastCompletedPartNumber: captureState.lastCompletedPartNumber,
      lastCompletedPartId: captureState.lastCompletedPartId,
      partHasData: captureState.partHasData,
      completedPartsCount: captureState.completedPartsCount,
      exportQueueLength: getExportQueueLength(),
      maxCompletedParts: MAX_COMPLETED_PARTS_RETAINED,
      pausedForStorageLimit: captureState.pausedForStorageLimit,
      exportInProgress: exportJob ? exportJob.active === true : false,
    },
    exportStatus,
    filtersSummary: buildFiltersSummary(activeFilters),
    filters: activeFilters,
    session,
    artifacts,
    hasArtifacts: artifacts.hasAnyArtifacts,
    statusMessage,
  };
}

function getRecordingPanelStatus() {
  const nowMs = Date.now();
  const elapsedMs = computeRecordingElapsedMs(nowMs);
  return {
    canonicalState: recordingController.state || state.recording.status || "idle",
    elapsedMs,
    elapsedText: formatElapsedMs(elapsedMs),
    hasData: Boolean(state.recording.hasData),
    statusMessage:
      statusMessage && statusMessage.message ? statusMessage.message : "-",
    sessionState: session ? session.state : "idle",
    isFinalizing: session ? session.state === "finalizing" : false,
    hasRecording:
      Boolean(state.recording.dataUrl) || Boolean(state.recording.hasData),
  };
}

function mapPublicRecordingState(stateName) {
  return stateName === "stopped" ? "idle" : stateName;
}

function isRecordingTransitionAllowed(fromState, toState) {
  if (fromState === toState) {
    return true;
  }
  const allowed = RECORDING_STATE_TRANSITIONS[fromState];
  return Boolean(allowed && allowed.has(toState));
}

function logRecordingDiagnostic(action, detail) {
  const payload = {
    sessionId: recordingController.sessionId || state.recording.sessionId || null,
    action,
    canonicalStateBefore: detail?.stateBefore ?? recordingController.state,
    canonicalStateAfter: detail?.stateAfter ?? recordingController.state,
    offscreenReady,
    streamAcquired: detail?.streamAcquired ?? null,
    recorderCreated: detail?.recorderCreated ?? null,
    recorderState: detail?.recorderState ?? null,
    controlWindowId: recordingPanelWindowId || null,
    targetTabId: recordingController.targetTabId || recordingPanelTargetTabId || null,
    errorPhase: detail?.errorPhase ?? null,
    errorMessage: detail?.errorMessage ?? null,
    errorStack: detail?.errorStack ?? null,
    cleanupCompleted: detail?.cleanupCompleted ?? null,
  };
  console.log("[RECORDING][DIAG]", payload);
}

function broadcastRecordingState(reason) {
  chrome.runtime.sendMessage({
    type: "RECORDING_CANONICAL_STATE",
    reason: reason || null,
    state: {
      status: state.recording.status,
      canonicalStatus: recordingController.state,
      sessionId: recordingController.sessionId || state.recording.sessionId || null,
      error: recordingController.lastError || state.recording.error || null,
      hasData: state.recording.hasData,
    },
  });
}

function setRecordingState(nextState, context = {}) {
  const prevState = recordingController.state;
  if (!isRecordingTransitionAllowed(prevState, nextState) && !context.force) {
    logRecordingDiagnostic("invalid_transition", {
      stateBefore: prevState,
      stateAfter: nextState,
      errorPhase: "transition",
      errorMessage: `Invalid transition ${prevState} -> ${nextState}`,
    });
    return false;
  }
  if (context.force) {
    logRecordingDiagnostic("forced_transition", {
      stateBefore: prevState,
      stateAfter: nextState,
    });
  }
  recordingController.state = nextState;
  if (context.sessionId) {
    recordingController.sessionId = context.sessionId;
  }
  if (typeof context.targetTabId === "number") {
    recordingController.targetTabId = context.targetTabId;
  }
  if (context.errorMessage) {
    recordingController.lastError = context.errorMessage;
  }
  state.recording.status = mapPublicRecordingState(nextState);
  logRecordingDiagnostic("transition", {
    stateBefore: prevState,
    stateAfter: nextState,
  });
  broadcastRecordingState("transition");
  return true;
}

async function withRecordingTransitionLock(label, handler) {
  const current = recordingTransitionLock;
  let release;
  recordingTransitionLock = new Promise((resolve) => {
    release = resolve;
  });
  await current;
  try {
    return await handler();
  } finally {
    if (typeof release === "function") {
      release();
    }
  }
}

function syncRecordingState(snapshot, context = {}) {
  if (!snapshot) {
    return;
  }
  let nextState = snapshot.state || "idle";
  if (nextState === "idle" && recordingController.state === "stopping") {
    nextState = "stopped";
  } else if (
    nextState === "idle" &&
    ["starting", "recording", "paused"].includes(recordingController.state)
  ) {
    nextState = "error";
  }
  const shouldForce =
    recordingController.state === "idle" &&
    ["starting", "recording", "paused", "stopping"].includes(nextState);
  const errorMessage =
    nextState === "error"
      ? snapshot.lastError || "Recording ended unexpectedly."
      : null;
  setRecordingState(nextState, {
    sessionId: snapshot.sessionId,
    targetTabId: context.targetTabId,
    force: shouldForce,
    errorMessage,
  });
  state.recording.hasData = Boolean(snapshot.hasData);
  if (snapshot.sessionId) {
    state.recording.sessionId = snapshot.sessionId;
  }
  if (snapshot.mimeType) {
    state.recording.mimeType = snapshot.mimeType;
  }
  if (snapshot.lastError) {
    state.recording.error = snapshot.lastError;
  }
  const publicState = mapPublicRecordingState(recordingController.state);
  if (publicState === "recording") {
    if (typeof state.recording.videoStartEpochMs !== "number") {
      state.recording.videoStartEpochMs = Date.now();
    }
    state.recording.videoEndEpochMs = null;
    setSessionState("capturing");
  } else if (publicState === "paused") {
    setSessionState("paused");
  } else if (publicState === "idle" && session && session.mode === "recording") {
    if (state.recording.hasData && !state.recording.capturedAt) {
      state.recording.capturedAt = nowIso();
    }
    if (
      state.recording.hasData &&
      typeof state.recording.videoEndEpochMs !== "number"
    ) {
      state.recording.videoEndEpochMs = Date.now();
    }
    markSessionStopped();
  }
  if (
    publicState === "idle" &&
    session &&
    session.state === "finalizing" &&
    !state.network.active
  ) {
    markSessionStopped();
  }
}

function normalizeHeaders(headers) {
  if (!headers) {
    return {};
  }
  if (Array.isArray(headers)) {
    return headers.reduce((acc, header) => {
      if (header && header.name) {
        acc[header.name] = header.value;
      }
      return acc;
    }, {});
  }
  return { ...headers };
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function buildEnvironment(context) {
  const userAgent = navigator.userAgent || "";
  const extensionVersion = getExtensionVersion();
  const timezoneOffsetMinutes = new Date().getTimezoneOffset();
  let platform = "unknown";
  try {
    const platformInfo = await chrome.runtime.getPlatformInfo();
    platform = platformInfo.os || platform;
  } catch (error) {
    platform = "unknown";
  }

  let timezone = "unknown";
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || timezone;
  } catch (error) {
    timezone = "unknown";
  }
  if ((!timezone || timezone === "unknown") && context && context.timezone) {
    timezone = context.timezone;
  }

  const tab = session ? session.active_tab : await getActiveTab();
  const contextViewport = context && context.viewport ? context.viewport : null;
  const viewportWidth =
    contextViewport && typeof contextViewport.w === "number"
      ? contextViewport.w
      : contextViewport && typeof contextViewport.width === "number"
        ? contextViewport.width
        : tab && typeof tab.width === "number"
          ? tab.width
          : null;
  const viewportHeight =
    contextViewport && typeof contextViewport.h === "number"
      ? contextViewport.h
      : contextViewport && typeof contextViewport.height === "number"
        ? contextViewport.height
        : tab && typeof tab.height === "number"
          ? tab.height
          : null;
  const devicePixelRatio =
    context && typeof context.devicePixelRatio === "number"
      ? context.devicePixelRatio
      : null;
  return {
    user_agent: userAgent,
    browser: detectBrowser(userAgent),
    browser_version: parseBrowserVersion(userAgent),
    platform,
    timezone,
    timezone_iana: timezone,
    timezone_offset_minutes: timezoneOffsetMinutes,
    extension_version: extensionVersion,
    device_pixel_ratio: devicePixelRatio,
    viewport: {
      w: viewportWidth,
      h: viewportHeight,
    },
    captured_url: tab && tab.url ? tab.url : "",
    captured_title: tab && tab.title ? tab.title : "",
    timestamp: new Date().toISOString(),
  };
}

function buildPartSummaryText(partInfo, truncationNote) {
  const lines = [];
  lines.push("Part summary");
  lines.push(`- Part: ${partInfo && partInfo.partNumber ? partInfo.partNumber : "-"}`);
  lines.push(
    `- Requests: ${partInfo && typeof partInfo.requestCount === "number" ? partInfo.requestCount : 0}`
  );
  lines.push(
    `- Console entries: ${
      partInfo && typeof partInfo.consoleCount === "number" ? partInfo.consoleCount : 0
    }`
  );
  lines.push(
    `- Errors: ${partInfo && typeof partInfo.errorCount === "number" ? partInfo.errorCount : 0}`
  );
  if (truncationNote) {
    lines.push("");
    lines.push(truncationNote);
  }
  return lines.join("\n");
}

function resolveOrigin(url) {
  if (!url) {
    return "";
  }
  try {
    return new URL(url).origin || "";
  } catch (error) {
    return "";
  }
}

function getRelativeMs(timestampIso, startIso) {
  if (!timestampIso || !startIso) {
    return 0;
  }
  const startMs = Date.parse(startIso);
  const eventMs = Date.parse(timestampIso);
  if (Number.isNaN(startMs) || Number.isNaN(eventMs)) {
    return 0;
  }
  return Math.max(0, eventMs - startMs);
}

const isNetworkFailureEntry = (entry) => {
  if (!entry) {
    return false;
  }
  const status =
    typeof entry.response_status === "number"
      ? entry.response_status
      : typeof entry.status === "number"
        ? entry.status
        : null;
  return (
    (typeof status === "number" && status >= 400) ||
    entry.incomplete ||
    entry.finalize_reason ||
    entry.error_text ||
    entry.errorText
  );
};

function buildSessionManifest(options) {
  const {
    data,
    manifestSessionId,
    exportTimestamp,
    screenshotCandidates,
    recordingFileName,
    recordingSizeBytes,
    recordingDurationMs,
    ndjsonStats,
    usePartExport,
    exported,
  } = options;
  const sessionExport = data.session || {};
  const environment = data.environment || {};
  const createdAt = sessionExport.created_at || data.exportMetadata?.zip_created_at_utc || nowIso();
  const startedAt = sessionExport.created_at || createdAt;
  const endedAt = sessionExport.ended_at || data.exportMetadata?.zip_created_at_utc || nowIso();
  const durationMs = Number.isFinite(Date.parse(startedAt)) && Number.isFinite(Date.parse(endedAt))
    ? Math.max(0, Date.parse(endedAt) - Date.parse(startedAt))
    : recordingDurationMs || 0;

  const exportedNetworkEntries = Array.isArray(exported?.networkEntries)
    ? exported.networkEntries
    : data.networkLogs?.entries || [];
  const exportedConsoleEntries = Array.isArray(exported?.consoleEntries)
    ? exported.consoleEntries
    : data.consoleLogs?.entries || [];
  const exportedScreenshots = Array.isArray(exported?.screenshots)
    ? exported.screenshots
    : Array.isArray(screenshotCandidates)
      ? screenshotCandidates
      : [];
  const exportedNetworkCount =
    typeof exported?.networkCount === "number"
      ? exported.networkCount
      : typeof ndjsonStats?.network?.count === "number"
        ? ndjsonStats.network.count
        : exportedNetworkEntries.length;
  const exportedConsoleCount =
    typeof exported?.consoleCount === "number"
      ? exported.consoleCount
      : typeof ndjsonStats?.console?.count === "number"
        ? ndjsonStats.console.count
        : exportedConsoleEntries.length;
  const networkSizeBytes =
    typeof ndjsonStats?.network?.size === "number" ? ndjsonStats.network.size : null;
  const consoleSizeBytes =
    typeof ndjsonStats?.console?.size === "number" ? ndjsonStats.console.size : null;
  const hasRecording =
    Boolean(recordingFileName && recordingSizeBytes !== null) ||
    Boolean(data.video) ||
    Boolean(data.recordingDataUrl) ||
    Boolean(data.recordingMimeType);
  const hasScreenshots = exportedScreenshots.length > 0;
  const hasNetwork = exportedNetworkCount > 0;
  const hasConsole = exportedConsoleCount > 0;
  const hasNetworkArtifacts =
    exportedNetworkCount > 0 || (networkSizeBytes !== null && networkSizeBytes > 0);
  const hasConsoleArtifacts =
    exportedConsoleCount > 0 || (consoleSizeBytes !== null && consoleSizeBytes > 0);
  const sessionMode = sessionExport && sessionExport.mode ? sessionExport.mode : null;
  const captureModeNetwork = hasNetworkArtifacts;
  const captureModeConsole = hasConsoleArtifacts;
  const captureModeRecording = hasRecording;
  const captureModeScreenshot = hasScreenshots;
  const hasFullPage = exportedScreenshots.some(
    (shot) => shot && (shot.fullPage || shot.kind === "fullpage")
  );

  const screenshotItems = exportedScreenshots
    .filter((shot) => shot)
    .map((shot, index) => {
      const fileName =
        shot && shot.fileName ? shot.fileName : `debugduck-screenshot-${exportTimestamp}.png`;
      const dims = shot && shot.dataUrl ? readPngDimensionsFromDataUrl(shot.dataUrl) : null;
      const blob = shot && shot.dataUrl ? dataUrlToBlob(shot.dataUrl) : shot.blob || null;
      return {
        id: `snap_${String(index + 1).padStart(4, "0")}`,
        path: `screenshots/${fileName}`,
        timestampMs:
          shot && typeof shot.t_ms === "number"
            ? shot.t_ms
            : getRelativeMs(shot?.timestampIso, startedAt),
        kind: shot && shot.fullPage ? "fullpage" : "viewport",
        fullPage: Boolean(shot && shot.fullPage),
        width: shot && typeof shot.width === "number" ? shot.width : dims?.width || null,
        height: shot && typeof shot.height === "number" ? shot.height : dims?.height || null,
        sizeBytes:
          typeof shot.sizeBytes === "number" ? shot.sizeBytes : blob ? blob.size : null,
        label: shot && shot.label ? shot.label : null,
      };
    });

  let eventCounter = 0;
  const nextEventId = () => `evt_${String(++eventCounter).padStart(4, "0")}`;
  const timelineEvents = [];

  if (hasRecording && !usePartExport) {
    timelineEvents.push({
      id: nextEventId(),
      type: "recording-start",
      timestampMs: 0,
    });
    if (durationMs > 0) {
      timelineEvents.push({
        id: nextEventId(),
        type: "recording-stop",
        timestampMs: durationMs,
      });
    }
  }

  screenshotItems.forEach((shot) => {
    timelineEvents.push({
      id: nextEventId(),
      type: "screenshot",
      timestampMs: typeof shot.timestampMs === "number" ? shot.timestampMs : 0,
      ref: shot.id,
      label: shot.label || "Screenshot",
    });
  });

  exportedNetworkEntries.forEach((entry) => {
    const status = entry.response_status || entry.status;
    if (!isNetworkFailureEntry(entry)) {
      return;
    }
    const severity = typeof status === "number" && status >= 500 ? "error" : "warning";
    timelineEvents.push({
      id: nextEventId(),
      type: severity === "error" ? "network-error" : "network-warning",
      timestampMs:
        typeof entry.timestamp_ms === "number"
          ? entry.timestamp_ms
          : getRelativeMs(entry.timestamp, startedAt),
      ref: entry.id || entry.request_id || null,
      severity,
      label: `${entry.method || ""} ${entry.url || ""}`.trim(),
    });
  });

  exportedConsoleEntries.forEach((entry) => {
    if (entry.level !== "error") {
      return;
    }
    timelineEvents.push({
      id: nextEventId(),
      type: "console-error",
      timestampMs:
        typeof entry.timestamp_ms === "number"
          ? entry.timestamp_ms
          : getRelativeMs(entry.timestamp, startedAt),
      ref: entry.id || null,
      severity: "error",
      label: entry.message || "Console error",
    });
  });

  const networkFailures =
    typeof exported?.networkFailures === "number"
      ? exported.networkFailures
      : exportedNetworkEntries.filter((entry) => isNetworkFailureEntry(entry)).length;
  const consoleErrors =
    typeof exported?.consoleErrors === "number"
      ? exported.consoleErrors
      : exportedConsoleEntries.filter((entry) => entry.level === "error").length;
  const topSignals = [];
  if (networkFailures > 0) {
    topSignals.push("Network failures detected");
  }
  if (consoleErrors > 0) {
    topSignals.push("Console errors detected");
  }
  if (screenshotItems.length > 0) {
    topSignals.push(`${screenshotItems.length} screenshots captured`);
  }
  if (hasRecording) {
    topSignals.push("Recording captured");
  }

  const truncationReport = data.exportTruncationReport || null;
  const integrityWarnings = [];
  if (truncationReport) {
    integrityWarnings.push("Export truncated due to capture limits.");
  }
  const ensureRelative = (value) => {
    if (!value || typeof value !== "string") {
      return true;
    }
    if (value.startsWith("/") || value.startsWith("\\")) {
      return false;
    }
    return !/^[a-z]+:\/\//i.test(value);
  };
  const invalidPaths = [];
  if (recordingFileName && !ensureRelative(recordingFileName)) {
    invalidPaths.push(recordingFileName);
  }
  if (!ensureRelative("logs/debugduck-logs-network.ndjson")) {
    invalidPaths.push("logs/debugduck-logs-network.ndjson");
  }
  if (!ensureRelative("logs/debugduck-logs-console.ndjson")) {
    invalidPaths.push("logs/debugduck-logs-console.ndjson");
  }
  screenshotItems.forEach((shot) => {
    if (shot && shot.path && !ensureRelative(shot.path)) {
      invalidPaths.push(shot.path);
    }
  });
  if (invalidPaths.length) {
    integrityWarnings.push(
      `Manifest contains non-relative paths: ${invalidPaths.slice(0, 3).join(", ")}`
    );
  }

  return {
    schemaVersion: "1.1.0",
    manifestType: "debugduck-session",
    session: {
      id: manifestSessionId,
      title: "DebugDuck Session",
      createdAt,
      startedAt,
      endedAt,
      durationMs,
      timezone: environment.timezone || environment.timezone_iana || "",
      source: {
        product: "DebugDuck",
        version: environment.extension_version || getExtensionVersion() || "1.1.0",
        build: "local-dev",
        platform: "chrome-extension-mv3",
      },
      captureMode: {
        screenshot: captureModeScreenshot,
        fullPage: Boolean(hasFullPage),
        recording: captureModeRecording,
        network: captureModeNetwork,
        console: captureModeConsole,
      },
    },
    environment: {
      page: {
        url: environment.captured_url || "",
        title: environment.captured_title || "",
        origin: resolveOrigin(environment.captured_url || ""),
      },
      browser: {
        name: environment.browser || "",
        version: environment.browser_version || "",
        userAgent: environment.user_agent || "",
      },
      viewport: {
        width:
          environment.viewport && typeof environment.viewport.w === "number"
            ? environment.viewport.w
            : 0,
        height:
          environment.viewport && typeof environment.viewport.h === "number"
            ? environment.viewport.h
            : 0,
        devicePixelRatio:
          typeof environment.device_pixel_ratio === "number"
            ? environment.device_pixel_ratio
            : 0,
      },
      os: {
        name: environment.platform || "",
        version: "",
      },
    },
    artifacts: {
      recording: {
        present: hasRecording,
        path: recordingFileName || "",
        mimeType: "video/webm",
        durationMs: recordingDurationMs || durationMs || 0,
        sizeBytes: typeof recordingSizeBytes === "number" ? recordingSizeBytes : null,
      },
      network: {
        present: hasNetworkArtifacts,
        path: "logs/debugduck-logs-network.ndjson",
        format: "ndjson",
        entryCount: exportedNetworkCount,
        sizeBytes: networkSizeBytes,
      },
      console: {
        present: hasConsoleArtifacts,
        path: "logs/debugduck-logs-console.ndjson",
        format: "ndjson",
        entryCount: exportedConsoleCount,
        sizeBytes: consoleSizeBytes,
      },
      screenshots: {
        present: hasScreenshots,
        basePath: "screenshots/",
        count: screenshotItems.length,
        items: screenshotItems,
      },
    },
    timeline: {
      timebase: "relative-ms",
      startOffsetMs: 0,
      endOffsetMs: Math.max(durationMs || 0, ...timelineEvents.map((e) => e.timestampMs || 0)),
      events: timelineEvents,
    },
    summary: {
      networkRequests: exportedNetworkCount,
      consoleMessages: exportedConsoleCount,
      consoleErrors,
      networkFailures,
      screenshots: screenshotItems.length,
      hasRecording,
      topSignals,
    },
    integrity: {
      complete: true,
      missingArtifacts: [],
      warnings: integrityWarnings,
    },
    viewerHints: {
      defaultTab: "timeline",
      initialSeekMs: 0,
      highlightEventIds: [],
      preferredPanels: ["video", "network", "console", "screenshots"],
    },
    extensions: {},
  };
}

function validateManifestForExport(manifest) {
  const errors = [];
  const warnings = [];
  if (!manifest || typeof manifest !== "object") {
    errors.push("Missing session.json payload.");
    return { errors, warnings };
  }
  const requiredKeys = [
    "schemaVersion",
    "manifestType",
    "session",
    "environment",
    "artifacts",
    "timeline",
    "summary",
    "integrity",
    "viewerHints",
    "extensions",
  ];
  requiredKeys.forEach((key) => {
    if (!(key in manifest)) {
      errors.push(`Missing manifest key: ${key}`);
    }
  });
  if (!manifest.session || !manifest.session.id) {
    errors.push("Missing session.id in manifest.");
  }
  const ensureRelative = (value) => {
    if (!value || typeof value !== "string") {
      return true;
    }
    if (value.startsWith("/") || value.startsWith("\\")) {
      return false;
    }
    return !/^[a-z]+:\/\//i.test(value);
  };
  const artifacts = manifest.artifacts || {};
  if (artifacts.recording?.present && !artifacts.recording.path) {
    errors.push("Recording marked present but path is empty.");
  }
  if (artifacts.network?.present && !artifacts.network.path) {
    errors.push("Network logs marked present but path is empty.");
  }
  if (artifacts.console?.present && !artifacts.console.path) {
    errors.push("Console logs marked present but path is empty.");
  }
  if (artifacts.screenshots?.present) {
    const items = artifacts.screenshots.items || [];
    if (!artifacts.screenshots.basePath) {
      warnings.push("Screenshots present but basePath is missing.");
    }
    items.forEach((item) => {
      if (!item || !item.id || !item.path) {
        errors.push("Screenshot item missing id or path.");
      } else if (!ensureRelative(item.path)) {
        errors.push(`Screenshot path is not relative: ${item.path}`);
      }
    });
  }
  if (artifacts.network?.path && !ensureRelative(artifacts.network.path)) {
    errors.push(`Network path is not relative: ${artifacts.network.path}`);
  }
  if (artifacts.console?.path && !ensureRelative(artifacts.console.path)) {
    errors.push(`Console path is not relative: ${artifacts.console.path}`);
  }
  if (artifacts.recording?.path && !ensureRelative(artifacts.recording.path)) {
    errors.push(`Recording path is not relative: ${artifacts.recording.path}`);
  }
  const timeline = manifest.timeline || {};
  if (timeline.timebase && timeline.timebase !== "relative-ms") {
    warnings.push("Timeline timebase is not relative-ms.");
  }
  if (
    typeof timeline.startOffsetMs === "number" &&
    typeof timeline.endOffsetMs === "number" &&
    timeline.endOffsetMs < timeline.startOffsetMs
  ) {
    errors.push("Timeline endOffsetMs is before startOffsetMs.");
  }
  const events = Array.isArray(timeline.events) ? timeline.events : [];
  const maxEvent = events.reduce(
    (acc, ev) => Math.max(acc, typeof ev.timestampMs === "number" ? ev.timestampMs : 0),
    0
  );
  if (
    typeof timeline.endOffsetMs === "number" &&
    maxEvent > timeline.endOffsetMs + 1000
  ) {
    warnings.push("Timeline endOffsetMs is below last event timestamp.");
  }
  return { errors, warnings };
}

async function buildPartExportData(context) {
  if (!isIdbAvailable()) {
    throw new Error("IndexedDB unavailable.");
  }
  const metadataOnly = Boolean(context && context.metadataOnly);
  updateSessionCounts();
  const environment = await buildEnvironment(context);
  const exportTimestamp =
    context && context.exportTimestamp
      ? context.exportTimestamp
      : formatExportTimestamp(new Date());
  const redactionResult = await chrome.storage.local.get({
    redactionEnabled: true,
  });
  const redactionEnabled = redactionResult.redactionEnabled !== false;
  const extensionVersion =
    environment && environment.extension_version
      ? environment.extension_version
      : getExtensionVersion();
  const exportCreatedAt = new Date();
  const manifestSessionId =
    context && context.manifestSessionId
      ? context.manifestSessionId
      : createDebugDuckSessionId(exportCreatedAt);
  let sessionExport = buildSessionExport();
  if (!sessionExport && hasExportableArtifacts()) {
    const tab = await getActiveTab();
    const createdAt =
      state.recording.capturedAt || state.screenshot.capturedAt || nowIso();
    sessionExport = {
      session_id: createSessionId(),
      created_at: createdAt,
      ended_at: nowIso(),
      mode: "network_console",
      state: "stopped",
      active_tab: {
        tab_id: tab && tab.id ? tab.id : null,
        url: tab && tab.url ? tab.url : "",
        title: tab && tab.title ? tab.title : "",
      },
      counts: {
        network_requests: captureState.totalRequests,
        console_entries: captureState.totalConsole,
        errors: captureState.totalErrors,
      },
      diagnostics: [],
    };
  }
  const partId = context && context.partId ? context.partId : null;
  const partRecord = partId ? await ReproIdb.getByKey("parts", partId) : null;
  const sessionRecord = sessionExport
    ? await ReproIdb.getByKey("sessions", sessionExport.session_id)
    : null;
  const partInfo = partRecord || {
    partId,
    partNumber:
      context && context.partNumber
        ? context.partNumber
        : captureState.partNumber,
    requestCount: captureState.requestsInPart,
    consoleCount: captureState.consoleInPart,
    errorCount: captureState.errorsInPart,
    networkBytes: captureState.networkBytesInPart,
    consoleBytes: captureState.consoleBytesInPart,
    bytesInPart: captureState.bytesInPart,
  };
  const exportMetadata = {
    created_at_utc: exportCreatedAt.toISOString(),
    created_at_local: exportCreatedAt.toString(),
    timezone_offset_minutes:
      environment && typeof environment.timezone_offset_minutes === "number"
        ? environment.timezone_offset_minutes
        : new Date().getTimezoneOffset(),
    extension_version: extensionVersion || null,
    schema_version: QA_SESSION_LOG_SCHEMA_VERSION,
    sessionId: sessionExport ? sessionExport.session_id : null,
    partNumber:
      context && context.partNumber
        ? context.partNumber
        : captureState.partNumber,
    counts: {
      network: typeof partInfo.requestCount === "number" ? partInfo.requestCount : 0,
      console: typeof partInfo.consoleCount === "number" ? partInfo.consoleCount : 0,
    },
    bytes: {
      networkBytes:
        typeof partInfo.networkBytes === "number"
          ? partInfo.networkBytes
          : captureState.networkBytesInPart,
      consoleBytes:
        typeof partInfo.consoleBytes === "number"
          ? partInfo.consoleBytes
          : captureState.consoleBytesInPart,
      totalBytes:
        typeof partInfo.bytesInPart === "number"
          ? partInfo.bytesInPart
          : captureState.bytesInPart,
    },
    redaction_enabled:
      typeof redactionEnabled === "boolean" ? redactionEnabled : null,
    filters:
      (sessionRecord && sessionRecord.filters) ||
      (sessionExport && sessionExport.filters) ||
      activeFilters,
    filters_summary:
      (sessionRecord && sessionRecord.filters_summary) ||
      (sessionExport && sessionExport.filters_summary) ||
      buildFiltersSummary(activeFilters),
  };
  const reportConfig = getReportConfig();
  exportMetadata.report = {
    enabled: reportConfig.enabled,
    version: reportConfig.version,
    hasSessionData: false,
  };
  const sessionId = sessionExport ? sessionExport.session_id : null;
  const startedAtIso = sessionExport ? sessionExport.created_at : null;
  const endedAtIso = sessionExport ? sessionExport.ended_at : null;
  const startedAtMs = parseEpochMs(startedAtIso);
  const endedAtMs = parseEpochMs(endedAtIso);
  const durationMs =
    startedAtMs !== null && endedAtMs !== null
      ? Math.max(0, endedAtMs - startedAtMs)
      : null;
  const timezoneOffsetMinutes =
    environment && typeof environment.timezone_offset_minutes === "number"
      ? environment.timezone_offset_minutes
      : null;
  const timezoneIana =
    (environment && (environment.timezone_iana || environment.timezone)) || null;
  const monotonicBaseline =
    session && session.monotonic
      ? session.monotonic
      : { epoch_origin_ms: null, monotonic_origin_ms: null };
  const monotonicAvailable =
    session && typeof session.monotonic_available === "boolean"
      ? session.monotonic_available
      : false;
  const videoStartEpochMs =
    typeof state.recording.videoStartEpochMs === "number"
      ? state.recording.videoStartEpochMs
      : null;
  const videoEndEpochMs =
    typeof state.recording.videoEndEpochMs === "number"
      ? state.recording.videoEndEpochMs
      : parseEpochMs(state.recording.capturedAt);
  const videoDurationMs =
    videoStartEpochMs !== null && videoEndEpochMs !== null
      ? Math.max(0, videoEndEpochMs - videoStartEpochMs)
      : null;
  const videoCodec = state.recording.videoMime || state.recording.mimeType || null;
  const qaSessionLogSession = {
    session_id: sessionId,
    startedAt: startedAtIso,
    startedAt_ms: startedAtMs,
    endedAt: endedAtIso,
    endedAt_ms: endedAtMs,
    durationMs,
    tabId:
      sessionExport && sessionExport.active_tab
        ? sessionExport.active_tab.tab_id
        : null,
    mode: sessionExport ? sessionExport.mode : null,
    timezone_offset_minutes: timezoneOffsetMinutes,
    timezone_iana: timezoneIana,
    extension_version: extensionVersion || null,
    monotonic: {
      epoch_origin_ms: monotonicBaseline.epoch_origin_ms,
      monotonic_origin_ms: monotonicBaseline.monotonic_origin_ms,
    },
    monotonic_available: monotonicAvailable,
    video_time_zero_epoch_ms: videoStartEpochMs,
    video_duration_ms: videoDurationMs,
    video_codec: videoCodec,
    video_fps: null,
  };
  const pipelineConfig =
    globalThis.PipelineConfig && globalThis.PipelineConfig.DEFAULTS
      ? globalThis.PipelineConfig.DEFAULTS
      : {
          actionWindowMs: { pre: 250, post: 3000 },
          dedupeWindowMs: 1000,
          slowThresholdMs: 2000,
          maxRequestsStored: 2000,
          maxBodyBytes: 204800,
          burstCollapse: { windowMs: 5000, minCount: 10 },
          topSlowRequestsLimit: 10,
        };
  const exportLimits = getExportLimits(pipelineConfig);
  const keyRange = partId ? IDBKeyRange.only(partId) : null;
  const limitedNetworkEntries = metadataOnly
    ? []
    : await loadLimitedEntriesFromIdb({
        storeName: "network_entries",
        indexName: "partId",
        keyRange,
        limit: exportLimits.maxRequests,
      });
  const limitedConsoleEntries = metadataOnly
    ? []
    : await loadLimitedEntriesFromIdb({
        storeName: "console_entries",
        indexName: "partId",
        keyRange,
        limit: exportLimits.maxConsoleEntries,
      });
  const networkLimit = {
    total: partInfo && typeof partInfo.requestCount === "number"
      ? partInfo.requestCount
      : limitedNetworkEntries.length,
    kept: limitedNetworkEntries.length,
    dropped:
      partInfo && typeof partInfo.requestCount === "number"
        ? Math.max(0, partInfo.requestCount - limitedNetworkEntries.length)
        : 0,
  };
  const consoleLimit = {
    total: partInfo && typeof partInfo.consoleCount === "number"
      ? partInfo.consoleCount
      : limitedConsoleEntries.length,
    kept: limitedConsoleEntries.length,
    dropped:
      partInfo && typeof partInfo.consoleCount === "number"
        ? Math.max(0, partInfo.consoleCount - limitedConsoleEntries.length)
        : 0,
  };
  const truncationResult = buildExportTruncationReport({
    limits: exportLimits,
    networkResult: networkLimit,
    consoleResult: consoleLimit,
    screenshotResult: { total: 0, kept: 0, dropped: 0 },
    truncatedBodies: { request: 0, response: 0 },
  });
  const metadataNote = metadataOnly
    ? "Metadata-only export created due to size limits."
    : truncationResult.note;
  const qaSummaryText = buildPartSummaryText(partInfo, metadataNote);
  const qaSessionLog = null;
  return {
    networkLogsSource: "idb",
    consoleLogsSource: "idb",
    partId,
    partInfo,
    redactionEnabled,
    exportLimits,
    activeFilters:
      (sessionRecord && sessionRecord.filters) ||
      (sessionExport && sessionExport.filters) ||
      activeFilters,
    exportTimestamp,
    manifestSessionId,
    session: sessionExport,
    environment,
    qaSessionLog,
    qaSummaryText,
    exportMetadata,
    exportTruncationReport: truncationResult.report,
  };
}

async function buildEvidenceExportData(context) {
  updateSessionCounts();
  const environment = await buildEnvironment(context);
  const exportTimestamp =
    context && context.exportTimestamp
      ? context.exportTimestamp
      : formatExportTimestamp(new Date());
  const redactionResult = await chrome.storage.local.get({
    redactionEnabled: true,
  });
  const redactionEnabled = redactionResult.redactionEnabled !== false;
  const extensionVersion =
    environment && environment.extension_version
      ? environment.extension_version
      : getExtensionVersion();
  const exportCreatedAt = new Date();
  const manifestSessionId =
    context && context.manifestSessionId
      ? context.manifestSessionId
      : createDebugDuckSessionId(exportCreatedAt);
  const exportMetadata = {
    zip_created_at_utc: exportCreatedAt.toISOString(),
    zip_created_at_local: exportCreatedAt.toString(),
    zip_created_at_epoch_ms: exportCreatedAt.getTime(),
    timezone_offset_minutes:
      environment && typeof environment.timezone_offset_minutes === "number"
        ? environment.timezone_offset_minutes
        : new Date().getTimezoneOffset(),
    zip_builder_version: extensionVersion || null,
    redaction_enabled:
      typeof redactionEnabled === "boolean" ? redactionEnabled : null,
    filters: session && session.filters ? session.filters : activeFilters,
    filters_summary:
      session && session.filters_summary
        ? session.filters_summary
        : buildFiltersSummary(activeFilters),
  };
  const reportConfig = getReportConfig();
  exportMetadata.report = {
    enabled: reportConfig.enabled,
    version: reportConfig.version,
    hasSessionData: false,
  };
  const networkCapped = state.network.capped;
  const rawNetworkCount = Object.keys(state.network.requests).length;
  const networkEntries = buildNetworkExportEntries();
  const consoleEntries = buildConsoleExportEntries();
  const redactedNetworkEntries =
    redactionEnabled && globalThis.RedactUtils
      ? networkEntries.map((entry) =>
          globalThis.RedactUtils.redactNetworkEntry(entry)
        )
      : networkEntries;
  const redactedConsoleEntries =
    redactionEnabled && globalThis.RedactUtils
      ? consoleEntries.map((entry) =>
          globalThis.RedactUtils.redactConsoleEntry(entry)
        )
      : consoleEntries;
  const screenshotEntries =
    session && Array.isArray(session.screenshots) ? session.screenshots : [];
  const screenshotList = screenshotEntries.map((entry, index) => {
    const displayIndex =
      typeof entry.index === "number" && entry.index > 0 ? entry.index : index + 1;
    const timestampIso = entry.timestampIso || entry.timestamp || nowIso();
    const isFullPage = Boolean(entry.fullPage);
    return {
      index: displayIndex,
      timestampIso,
      timestamp: timestampIso,
      t_ms:
        typeof entry.t_ms === "number"
          ? entry.t_ms
          : computeSessionOffsetMs(timestampIso),
      fileName: isFullPage
        ? `debugduck-screenshot-fullpage-${String(displayIndex).padStart(
            3,
            "0"
          )}-${exportTimestamp}.png`
        : `debugduck-screenshot-${String(displayIndex).padStart(
            3,
            "0"
          )}-${exportTimestamp}.png`,
      fullPage: isFullPage,
      artifactKey: entry && entry.artifactKey ? entry.artifactKey : null,
    };
  });
  const markerList = [];
  const screenshotDownloads = screenshotList.map((meta, index) => ({
    ...meta,
    dataUrl: screenshotEntries[index] ? screenshotEntries[index].dataUrl : null,
    fullPage: Boolean(screenshotEntries[index]?.fullPage),
    artifactKey:
      (screenshotEntries[index] && screenshotEntries[index].artifactKey) ||
      meta.artifactKey ||
      null,
  }));
  let sessionExport = buildSessionExport();
  if (!sessionExport && hasExportableArtifacts()) {
    const tab = await getActiveTab();
    const createdAt =
      state.recording.capturedAt || state.screenshot.capturedAt || nowIso();
    sessionExport = {
      session_id: createSessionId(),
      created_at: createdAt,
      ended_at: nowIso(),
      mode: state.recording.hasData
        ? "recording"
        : Object.keys(state.network.requests).length > 0
          ? "network_console"
          : "screenshot",
      state: "stopped",
      active_tab: {
        tab_id: tab && tab.id ? tab.id : null,
        url: tab && tab.url ? tab.url : "",
        title: tab && tab.title ? tab.title : "",
      },
      counts: {
        network_requests: Object.keys(state.network.requests).length,
        console_entries: state.console.logs.length,
        errors: state.console.logs.filter((log) => log.level === "error").length,
      },
      diagnostics: [],
    };
  }
  let videoReference = null;
  if (state.recording.hasData) {
    if (!state.recording.videoBlobUrl) {
      try {
        await ensureOffscreenReady();
        const exportResponse = await sendMessageToOffscreen({
          type: "RECORDING_EXPORT_WEBM",
        });
        if (exportResponse && exportResponse.ok && exportResponse.blobUrl) {
          state.recording.videoBlobUrl = exportResponse.blobUrl;
          state.recording.videoMime = exportResponse.mimeType || null;
          state.recording.videoByteLength =
            typeof exportResponse.size === "number" ? exportResponse.size : null;
        }
      } catch (error) {
        console.warn("Recording export reference unavailable:", error);
      }
    }
    if (state.recording.videoBlobUrl) {
      videoReference = {
        blobUrl: state.recording.videoBlobUrl,
        mime: state.recording.videoMime,
        fileName: `debugduck-recording-${exportTimestamp}.webm`,
        byteLength: state.recording.videoByteLength,
      };
    }
  }
  const pipelineConfig =
    globalThis.PipelineConfig && globalThis.PipelineConfig.DEFAULTS
      ? globalThis.PipelineConfig.DEFAULTS
      : {
          actionWindowMs: { pre: 250, post: 3000 },
          dedupeWindowMs: 1000,
          slowThresholdMs: 2000,
          maxRequestsStored: 2000,
          maxBodyBytes: 204800,
          burstCollapse: { windowMs: 5000, minCount: 10 },
          topSlowRequestsLimit: 10,
        };
  const exportLimits = getExportLimits(pipelineConfig);
  const networkLimit = limitArrayToTail(
    redactedNetworkEntries,
    exportLimits.maxRequests
  );
  const consoleLimit = limitArrayToTail(
    redactedConsoleEntries,
    exportLimits.maxConsoleEntries
  );
  const networkBodyResult = applyNetworkBodyLimit(
    networkLimit.items,
    exportLimits.maxBodyBytes
  );
  const limitedNetworkEntries = networkBodyResult.entries;
  const limitedConsoleEntries = consoleLimit.items;
  const screenshotLimit = limitArrayToTail(
    screenshotList,
    exportLimits.maxScreenshots
  );
  const limitedScreenshotList = screenshotLimit.items;
  const limitedScreenshotDownloads =
    screenshotLimit.dropped > 0
      ? screenshotDownloads.slice(screenshotLimit.dropped)
      : screenshotDownloads.slice();
  const truncationResult = buildExportTruncationReport({
    limits: exportLimits,
    networkResult: networkLimit,
    consoleResult: consoleLimit,
    screenshotResult: screenshotLimit,
    truncatedBodies: {
      request: networkBodyResult.truncatedRequest,
      response: networkBodyResult.truncatedResponse,
    },
  });
  const exportTruncationReport = truncationResult.report;
  const truncationNote = truncationResult.note;
  let normalizedEvents = [];
  let signals = [];
  let qaSummaryText = null;
  if (
    globalThis.PipelineNormalizer &&
    globalThis.PipelineActionGrouper &&
    globalThis.PipelineSignalReducer
  ) {
    const normalized = globalThis.PipelineNormalizer.normalizeSession(
      {
        session: {
          sessionId: sessionExport ? sessionExport.session_id : null,
          startedAt: sessionExport ? sessionExport.created_at : null,
          endedAt: sessionExport ? sessionExport.ended_at : null,
          tabId:
            sessionExport && sessionExport.active_tab
              ? sessionExport.active_tab.tab_id
              : null,
          mode: sessionExport ? sessionExport.mode : null,
        },
        rawNetwork: limitedNetworkEntries,
        markers: markerList,
        screenshots: limitedScreenshotList,
        consoleEvents: limitedConsoleEntries,
        uiActions: [],
      },
      pipelineConfig
    );
    const grouped = globalThis.PipelineActionGrouper.groupByActions(
      normalized.normalizedEvents,
      pipelineConfig
    );
    const reduced = globalThis.PipelineSignalReducer.reduceToSignals(
      grouped.normalizedEventsWithActionIds,
      pipelineConfig,
      {
        rawNetworkCount,
        networkCapped,
      }
    );
    normalizedEvents = grouped.normalizedEventsWithActionIds;
    signals = reduced.signals || [];
    if (globalThis.PipelineSummaryBuilder) {
      qaSummaryText = globalThis.PipelineSummaryBuilder.buildSummaryText({
        session: {
          startedAt: sessionExport ? sessionExport.created_at : null,
          endedAt: sessionExport ? sessionExport.ended_at : null,
          tabId:
            sessionExport && sessionExport.active_tab
              ? sessionExport.active_tab.tab_id
              : null,
          mode: sessionExport ? sessionExport.mode : null,
        },
        signals,
        normalizedEvents,
        config: pipelineConfig,
      });
    }
  }
  qaSummaryText = appendSummaryNote(qaSummaryText, truncationNote);
  const sessionId = sessionExport ? sessionExport.session_id : null;
  const startedAtIso = sessionExport ? sessionExport.created_at : null;
  const endedAtIso = sessionExport ? sessionExport.ended_at : null;
  const startedAtMs = parseEpochMs(startedAtIso);
  const endedAtMs = parseEpochMs(endedAtIso);
  const durationMs =
    startedAtMs !== null && endedAtMs !== null
      ? Math.max(0, endedAtMs - startedAtMs)
      : null;
  const timezoneOffsetMinutes =
    environment && typeof environment.timezone_offset_minutes === "number"
      ? environment.timezone_offset_minutes
      : null;
  const timezoneIana =
    (environment && (environment.timezone_iana || environment.timezone)) || null;
  const monotonicBaseline =
    session && session.monotonic
      ? session.monotonic
      : { epoch_origin_ms: null, monotonic_origin_ms: null };
  const monotonicAvailable =
    session && typeof session.monotonic_available === "boolean"
      ? session.monotonic_available
      : false;
  const videoStartEpochMs =
    typeof state.recording.videoStartEpochMs === "number"
      ? state.recording.videoStartEpochMs
      : null;
  const videoEndEpochMs =
    typeof state.recording.videoEndEpochMs === "number"
      ? state.recording.videoEndEpochMs
      : parseEpochMs(state.recording.capturedAt);
  const videoDurationMs =
    videoStartEpochMs !== null && videoEndEpochMs !== null
      ? Math.max(0, videoEndEpochMs - videoStartEpochMs)
      : null;
  const videoCodec = state.recording.videoMime || state.recording.mimeType || null;
  const qaSessionLog = {
    schema_version: QA_SESSION_LOG_SCHEMA_VERSION,
    session: {
      session_id: sessionId,
      startedAt: startedAtIso,
      startedAt_ms: startedAtMs,
      endedAt: endedAtIso,
      endedAt_ms: endedAtMs,
      durationMs,
      tabId:
        sessionExport && sessionExport.active_tab
          ? sessionExport.active_tab.tab_id
          : null,
      mode: sessionExport ? sessionExport.mode : null,
      timezone_offset_minutes: timezoneOffsetMinutes,
      timezone_iana: timezoneIana,
      extension_version: extensionVersion || null,
      monotonic: {
        epoch_origin_ms: monotonicBaseline.epoch_origin_ms,
        monotonic_origin_ms: monotonicBaseline.monotonic_origin_ms,
      },
      monotonic_available: monotonicAvailable,
      video_time_zero_epoch_ms: videoStartEpochMs,
      video_duration_ms: videoDurationMs,
      video_codec: videoCodec,
      video_fps: null,
    },
    raw: {
      network: limitedNetworkEntries,
      console: limitedConsoleEntries,
      markers: markerList,
      screenshots: limitedScreenshotList,
    },
    normalizedEvents,
    signals,
    config: pipelineConfig,
  };
  return {
    screenshotDataUrl: state.screenshot.dataUrl,
    recordingDataUrl: state.recording.dataUrl,
    recordingMimeType: state.recording.mimeType,
    screenshots: limitedScreenshotDownloads,
    video: videoReference,
    networkLogs: {
      version: "1.0",
      entries: limitedNetworkEntries,
    },
    consoleLogs: {
      version: "1.0",
      entries: limitedConsoleEntries,
    },
    session: sessionExport,
    environment,
    qaSessionLog,
    qaSummaryText,
    exportMetadata,
    exportTruncationReport,
    exportTimestamp,
    manifestSessionId,
    recordingStartEpochMs: videoStartEpochMs,
    recordingEndEpochMs: videoEndEpochMs,
    recordingDurationMs: videoDurationMs,
  };
}

async function runEvidenceZipExport(context) {
  if (exportJob && exportJob.active) {
    throw new Error("Export already in progress.");
  }
  const usePartExport = Boolean(context && context.partId);
  const metadataOnly = Boolean(context && context.metadataOnly);
  if (usePartExport && !isNdjsonAvailable()) {
    throw new Error("NDJSON exporter unavailable.");
  }
  exportJob = {
    active: true,
    startedAt: Date.now(),
    lastProgress: 0,
    partId: usePartExport ? context.partId : null,
    partNumber: usePartExport ? context.partNumber || null : null,
    jobId: context && context.exportJobId ? context.exportJobId : null,
  };
  if (!exportStatus) {
    exportStatus = {
      jobId: exportJob.jobId || null,
      partId: exportJob.partId || null,
      partNumber: exportJob.partNumber || null,
      percent: 0,
      phase: "Starting",
    };
  }
  const exportStartIso = nowIso();
  reportExportProgress(1, "export_start", { startedAt: exportStartIso });
  try {
    if (!isZipBuilderAvailable()) {
      throw new Error("Zip builder unavailable.");
    }
    reportExportProgress(5, "prepare_data");
    const data = usePartExport
      ? await buildPartExportData(context)
      : await buildEvidenceExportData(context);
    const exportFilters =
      usePartExport &&
      data.activeFilters &&
      data.activeFilters.captureMode === "capture_all_export_filter"
        ? data.activeFilters
        : null;
    const redactionEnabled = usePartExport
      ? data.redactionEnabled === true
      : data.exportMetadata && data.exportMetadata.redaction_enabled === true;
    const redactNetworkEntry =
      redactionEnabled && globalThis.RedactUtils
        ? (entry) => globalThis.RedactUtils.redactNetworkEntry(entry)
        : null;
    const redactConsoleEntry =
      redactionEnabled && globalThis.RedactUtils
        ? (entry) => globalThis.RedactUtils.redactConsoleEntry(entry)
        : null;
    const networkCount = usePartExport
      ? data.partInfo && typeof data.partInfo.requestCount === "number"
        ? data.partInfo.requestCount
        : 0
      : data.networkLogs && Array.isArray(data.networkLogs.entries)
        ? data.networkLogs.entries.length
        : 0;
    const consoleCount = usePartExport
      ? data.partInfo && typeof data.partInfo.consoleCount === "number"
        ? data.partInfo.consoleCount
        : 0
      : data.consoleLogs && Array.isArray(data.consoleLogs.entries)
        ? data.consoleLogs.entries.length
        : 0;
    const screenshotCount = Array.isArray(data.screenshots)
      ? data.screenshots.length
      : data.screenshotDataUrl
        ? 1
        : 0;
    logExportPhase("data_ready", {
      networkCount,
      consoleCount,
      screenshotCount,
    });
    reportExportProgress(10, "data_ready", {
      networkCount,
      consoleCount,
      screenshotCount,
    });
    const screenshotCandidates = Array.isArray(data.screenshots)
      ? data.screenshots.filter((shot) => Boolean(shot))
      : data.screenshotDataUrl
        ? [{ dataUrl: data.screenshotDataUrl, fileName: "screenshot.png" }]
        : [];
    const screenshotArtifactBlobs = new Map();
    const resolveScreenshotBlob = async (shot) => {
      if (!shot || !shot.artifactKey) {
        return null;
      }
      if (screenshotArtifactBlobs.has(shot.artifactKey)) {
        return screenshotArtifactBlobs.get(shot.artifactKey);
      }
      const blob = await loadCaptureArtifactBlob(shot.artifactKey);
      screenshotArtifactBlobs.set(shot.artifactKey, blob);
      return blob;
    };
    const exportedScreenshotCandidates = [];
    let estimatedScreenshotBytes = 0;
    for (const shot of screenshotCandidates) {
      if (!shot) {
        continue;
      }
      let blob = null;
      if (shot.dataUrl) {
        blob = dataUrlToBlob(shot.dataUrl);
      } else if (shot.artifactKey) {
        blob = await resolveScreenshotBlob(shot);
      }
      if (!blob) {
        continue;
      }
      const sizeBytes = blob.size || 0;
      exportedScreenshotCandidates.push({
        ...shot,
        blob,
        sizeBytes,
      });
      estimatedScreenshotBytes += sizeBytes;
    }
    if (estimatedScreenshotBytes > EXPORT_SIZE_GUARDS.maxScreenshotBytes) {
      throw buildExportSizeError(
        "Export too large (screenshots). Reduce screenshots and try again.",
        "screenshots_too_large"
      );
    }
    reportExportProgress(12, "ndjson_start");
    const jsonSizes = {
      network_logs: 0,
      console_logs: 0,
      network_ndjson: 0,
      console_ndjson: 0,
      network_json: 0,
      console_json: 0,
      session: 0,
      session_manifest: 0,
      environment: 0,
      qa_session_log: 0,
      export_metadata: 0,
      export_truncation_report: 0,
      qa_summary: data.qaSummaryText ? data.qaSummaryText.length : 0,
      summary_errors: 0,
      summary_failed_requests: 0,
      summary_session: 0,
      summary_truncation: 0,
    };
    let totalJsonBytes = 0;
    const trackJsonSize = (key, size) => {
      jsonSizes[key] = size;
      totalJsonBytes += size;
      if (totalJsonBytes > EXPORT_SIZE_GUARDS.maxTotalJsonBytes) {
        throw buildExportSizeError(
          "Export too large (JSON). Reduce capture size and try again.",
          "json_total_too_large"
        );
      }
    };
    const SUMMARY_SAMPLE_LIMIT = 200;
    const summaryCounts = {
      consoleErrors: 0,
      failedRequests: 0,
    };
    const summarySamples = {
      consoleErrors: [],
      failedRequests: [],
    };
    const summaryFlags = {
      consoleErrorsTruncated: false,
      failedRequestsTruncated: false,
    };
    const recordConsoleError = (entry, redactEntry) => {
      if (!entry || entry.level !== "error") {
        return;
      }
      summaryCounts.consoleErrors += 1;
      const payload = redactEntry ? redactEntry(entry) : entry;
      if (summarySamples.consoleErrors.length < SUMMARY_SAMPLE_LIMIT) {
        summarySamples.consoleErrors.push({
          timestamp: payload.timestamp || null,
          timestamp_epoch_ms: payload.timestamp_epoch_ms || null,
          message: payload.message || "",
          source: payload.source || "console",
          url: payload.url || null,
          line: payload.line || null,
          column: payload.column || null,
          stack: payload.stack || null,
        });
      } else {
        summaryFlags.consoleErrorsTruncated = true;
      }
    };
    const recordFailedRequest = (entry, redactEntry) => {
      if (!entry) {
        return;
      }
      if (!isNetworkFailureEntry(entry)) {
        return;
      }
      summaryCounts.failedRequests += 1;
      const payload = redactEntry ? redactEntry(entry) : entry;
      if (summarySamples.failedRequests.length < SUMMARY_SAMPLE_LIMIT) {
        summarySamples.failedRequests.push({
          request_id: payload.request_id || null,
          timestamp: payload.timestamp || null,
          timestamp_epoch_ms: payload.timestamp_epoch_ms || null,
          url: payload.url || null,
          method: payload.method || null,
          response_status: payload.response_status || null,
          response_status_text: payload.response_status_text || null,
          error_text: payload.error_text || null,
          incomplete: payload.incomplete || undefined,
          finalize_reason: payload.finalize_reason || null,
        });
      } else {
        summaryFlags.failedRequestsTruncated = true;
      }
    };
    const zip = new JSZip();
    const zipDate =
      data.session && data.session.ended_at
        ? new Date(data.session.ended_at)
        : new Date();
    const toJsonWithSize = (value, key) => {
      const json = JSON.stringify(value || {}, null, 2);
      trackJsonSize(key, json.length);
      return json;
    };
    const isFailedRequest = (entry) => {
      return isNetworkFailureEntry(entry);
    };
    const truncationCounts = { request: 0, response: 0 };
    let networkBuilt = false;
    let consoleBuilt = false;
    const finalizePartTruncationReport = () => {
      if (!usePartExport || !networkBuilt || !consoleBuilt) {
        return;
      }
      const partInfo = data.partInfo || {};
      const exportLimits = data.exportLimits || getExportLimits();
      const networkLimit = {
        total:
          typeof partInfo.requestCount === "number" ? partInfo.requestCount : 0,
        kept:
          metadataOnly || typeof partInfo.requestCount !== "number"
            ? 0
            : Math.min(partInfo.requestCount, exportLimits.maxRequests),
        dropped:
          typeof partInfo.requestCount === "number"
            ? Math.max(
                0,
                partInfo.requestCount -
                  (metadataOnly ? 0 : exportLimits.maxRequests)
              )
            : 0,
      };
      const consoleLimit = {
        total:
          typeof partInfo.consoleCount === "number" ? partInfo.consoleCount : 0,
        kept:
          metadataOnly || typeof partInfo.consoleCount !== "number"
            ? 0
            : Math.min(partInfo.consoleCount, exportLimits.maxConsoleEntries),
        dropped:
          typeof partInfo.consoleCount === "number"
            ? Math.max(
                0,
                partInfo.consoleCount -
                  (metadataOnly ? 0 : exportLimits.maxConsoleEntries)
              )
            : 0,
      };
      const truncationResult = buildExportTruncationReport({
        limits: exportLimits,
        networkResult: networkLimit,
        consoleResult: consoleLimit,
        screenshotResult: { total: 0, kept: 0, dropped: 0 },
        truncatedBodies: {
          request: truncationCounts.request,
          response: truncationCounts.response,
        },
      });
      data.exportTruncationReport = truncationResult.report;
      data.qaSummaryText = buildPartSummaryText(partInfo, truncationResult.note);
    };
    let baseItems = [];
    const logItems = [];
    const metaItems = [];
    const summaryItems = [];
    const automationItems = [];
    const ndjsonStats = { network: null, console: null };
    const preparedNdjson = { network: null, console: null };
    const exportSessionId =
      captureState.sessionId ||
      (session && session.session_id) ||
      (data.session && data.session.session_id) ||
      null;
    debugPersistLog("[LOGS][EXPORT][SESSION_KEY]", {
      exportSessionId: exportSessionId || null,
      captureSessionId: captureState.sessionId || null,
      sessionId: session ? session.session_id : null,
      dataSessionId: data?.session?.session_id || null,
      capturePartId: captureState.partId || null,
      usePartExport,
    });
    const buildPostmanAutomationItem = (entries, sourceName, filters) => {
      let postmanEntries = redactNetworkEntry
        ? entries.map((entry) => redactNetworkEntry(entry))
        : entries;
      if (filters) {
        postmanEntries = postmanEntries.filter((entry) =>
          matchesExportNetworkEntry(entry, filters)
        );
      }
      postmanEntries = postmanEntries.filter((entry) =>
        isPostmanEligibleEntry(entry)
      );
      if (postmanEntries.length === 0) {
        return null;
      }
      return {
        path: "automation/postman_collection.json",
        data: toJsonWithSize(
          buildPostmanCollection(postmanEntries, sourceName),
          "postman_collection"
        ),
        options: { date: zipDate },
      };
    };
    const exportTimestamp =
      data.exportTimestamp || formatExportTimestamp(new Date());
    const manifestSessionId =
      data.manifestSessionId || createDebugDuckSessionId(new Date());
    const prepareNetworkNdjson = async () => {
      if (preparedNdjson.network) {
        return preparedNdjson.network;
      }
      let result;
      if (usePartExport && data.partId) {
        const networkTotal =
          data.partInfo && typeof data.partInfo.requestCount === "number"
            ? data.partInfo.requestCount
            : null;
        result = await globalThis.NdjsonExporter.buildNdjsonBlobFromIdb({
          storeName: "network_entries",
          indexName: "partId",
          keyRange: IDBKeyRange.only(data.partId),
          maxBytes: EXPORT_SIZE_GUARDS.maxNetworkJsonBytes,
          redactEntry: redactNetworkEntry,
          filterEntry: exportFilters
            ? (entry) => matchesExportNetworkEntry(entry, exportFilters)
            : null,
          totalCount: networkTotal,
          onProgress: ({ percent }) => {
            reportExportProgress(
              12 + Math.round((percent / 100) * 4),
              "ndjson_network",
              { percent }
            );
          },
          onEntry: (entry) => {
            if (entry.request_body_truncated) {
              truncationCounts.request += 1;
            }
            if (entry.response_body_truncated) {
              truncationCounts.response += 1;
            }
            recordFailedRequest(entry, redactNetworkEntry);
          },
        });
        trackJsonSize("network_ndjson", result.size);
        ndjsonStats.network = {
          size: result.size,
          count: result.count,
          truncated: result.truncated,
        };
        if (result.truncated) {
          logExportPhase("ndjson_truncated", { type: "network" });
        }
        networkBuilt = true;
        finalizePartTruncationReport();
      } else if (exportSessionId && isNdjsonAvailable() && isIdbAvailable()) {
        result = await globalThis.NdjsonExporter.buildNdjsonBlobFromIdb({
          storeName: "network_entries",
          indexName: "sessionId",
          keyRange: IDBKeyRange.only(exportSessionId),
          maxBytes: EXPORT_SIZE_GUARDS.maxNetworkJsonBytes,
          redactEntry: redactNetworkEntry,
          totalCount:
            data.session && data.session.counts
              ? data.session.counts.network_requests
              : null,
          onProgress: ({ percent }) => {
            reportExportProgress(
              12 + Math.round((percent / 100) * 4),
              "ndjson_network",
              { percent }
            );
          },
          onEntry: (entry) => {
            recordFailedRequest(entry, redactNetworkEntry);
          },
        });
        trackJsonSize("network_ndjson", result.size);
        ndjsonStats.network = {
          size: result.size,
          count: result.count,
          truncated: result.truncated,
        };
        if (result.truncated) {
          logExportPhase("ndjson_truncated", { type: "network" });
        }
      } else {
        const fallbackEntries =
          data.networkLogs && Array.isArray(data.networkLogs.entries)
            ? data.networkLogs.entries
            : [];
        result = await buildNdjsonBlobFromEntries({
          entries: fallbackEntries,
          maxBytes: EXPORT_SIZE_GUARDS.maxNetworkJsonBytes,
          label: "Network logs",
          debugCode: "network_ndjson_too_large",
          redactEntry: redactNetworkEntry,
          onEntry: (entry) => {
            recordFailedRequest(entry, redactNetworkEntry);
          },
        });
        trackJsonSize("network_ndjson", result.size);
        ndjsonStats.network = {
          size: result.size,
          count: result.count,
          truncated: result.truncated,
        };
        if (result.truncated) {
          logExportPhase("ndjson_truncated", { type: "network" });
        }
      }
      preparedNdjson.network = result;
      return result;
    };
    const prepareConsoleNdjson = async () => {
      if (preparedNdjson.console) {
        return preparedNdjson.console;
      }
      let result;
      if (usePartExport && data.partId) {
        const consoleTotal =
          data.partInfo && typeof data.partInfo.consoleCount === "number"
            ? data.partInfo.consoleCount
            : null;
        result = await globalThis.NdjsonExporter.buildNdjsonBlobFromIdb({
          storeName: "console_entries",
          indexName: "partId",
          keyRange: IDBKeyRange.only(data.partId),
          maxBytes: EXPORT_SIZE_GUARDS.maxConsoleJsonBytes,
          redactEntry: redactConsoleEntry,
          totalCount: consoleTotal,
          onProgress: ({ percent }) => {
            reportExportProgress(
              16 + Math.round((percent / 100) * 4),
              "ndjson_console",
              { percent }
            );
          },
          onEntry: (entry) => {
            recordConsoleError(entry, redactConsoleEntry);
          },
        });
        trackJsonSize("console_ndjson", result.size);
        ndjsonStats.console = {
          size: result.size,
          count: result.count,
          truncated: result.truncated,
        };
        if (result.truncated) {
          logExportPhase("ndjson_truncated", { type: "console" });
        }
        consoleBuilt = true;
        finalizePartTruncationReport();
      } else if (exportSessionId && isNdjsonAvailable() && isIdbAvailable()) {
        result = await globalThis.NdjsonExporter.buildNdjsonBlobFromIdb({
          storeName: "console_entries",
          indexName: "sessionId",
          keyRange: IDBKeyRange.only(exportSessionId),
          maxBytes: EXPORT_SIZE_GUARDS.maxConsoleJsonBytes,
          redactEntry: redactConsoleEntry,
          totalCount:
            data.session && data.session.counts
              ? data.session.counts.console_entries
              : null,
          onProgress: ({ percent }) => {
            reportExportProgress(
              16 + Math.round((percent / 100) * 4),
              "ndjson_console",
              { percent }
            );
          },
          onEntry: (entry) => {
            recordConsoleError(entry, redactConsoleEntry);
          },
        });
        trackJsonSize("console_ndjson", result.size);
        ndjsonStats.console = {
          size: result.size,
          count: result.count,
          truncated: result.truncated,
        };
        if (result.truncated) {
          logExportPhase("ndjson_truncated", { type: "console" });
        }
      } else {
        const fallbackEntries =
          data.consoleLogs && Array.isArray(data.consoleLogs.entries)
            ? data.consoleLogs.entries
            : [];
        result = await buildNdjsonBlobFromEntries({
          entries: fallbackEntries,
          maxBytes: EXPORT_SIZE_GUARDS.maxConsoleJsonBytes,
          label: "Console logs",
          debugCode: "console_ndjson_too_large",
          redactEntry: redactConsoleEntry,
          onEntry: (entry) => {
            recordConsoleError(entry, redactConsoleEntry);
          },
        });
        trackJsonSize("console_ndjson", result.size);
        ndjsonStats.console = {
          size: result.size,
          count: result.count,
          truncated: result.truncated,
        };
        if (result.truncated) {
          logExportPhase("ndjson_truncated", { type: "console" });
        }
      }
      preparedNdjson.console = result;
      return result;
    };
    if (usePartExport && data.partId) {
      const networkTotal =
        data.partInfo && typeof data.partInfo.requestCount === "number"
          ? data.partInfo.requestCount
          : null;
      const consoleTotal =
        data.partInfo && typeof data.partInfo.consoleCount === "number"
          ? data.partInfo.consoleCount
          : null;
      logItems.push({
        path: "logs/debugduck-logs-network.ndjson",
        getData: async () => {
          const result = await prepareNetworkNdjson();
          return result.blob;
        },
          options: { date: zipDate },
        });
      logItems.push({
        path: "logs/debugduck-logs-console.ndjson",
        getData: async () => {
          const result = await prepareConsoleNdjson();
          return result.blob;
        },
        options: { date: zipDate },
      });
      metaItems.push(
        {
          path: "meta/session.json",
          getData: () => toJsonWithSize(data.session || {}, "session"),
          options: { date: zipDate },
        }
      );
      if (EXTENDED_EXPORT) {
        metaItems.push(
          {
            path: "meta/environment.json",
            getData: () => toJsonWithSize(data.environment || {}, "environment"),
            options: { date: zipDate },
          },
          {
            path: "meta/export_metadata.json",
            getData: () =>
              toJsonWithSize(data.exportMetadata || {}, "export_metadata"),
            options: { date: zipDate },
          }
        );
      }
      logItems.push({
        path: "logs/debugduck-logs-network.json",
        getData: async () => {
          const entries = await loadLimitedEntriesFromIdb({
            storeName: "network_entries",
            indexName: "partId",
            keyRange: IDBKeyRange.only(data.partId),
            limit: data.exportLimits
              ? data.exportLimits.maxRequests
              : EXPORT_LIMITS.maxRequests,
          });
          debugPersistLog("[LOGS][EXPORT][IDB_COUNTS]", {
            storeName: "network_entries",
            indexName: "partId",
            keyUsed: data.partId || null,
            loadedCount: entries.length,
          });
          const redactedEntries = redactNetworkEntry
            ? entries.map((entry) => redactNetworkEntry(entry))
            : entries;
          const failedCount = redactedEntries.filter((entry) =>
            isFailedRequest(entry)
          ).length;
          const payload = {
            session: {
              session_id:
                data.session && data.session.session_id
                  ? data.session.session_id
                  : null,
              part_id: data.partId || null,
              part_number:
                data.partInfo && typeof data.partInfo.partNumber === "number"
                  ? data.partInfo.partNumber
                  : null,
              started_at: data.session ? data.session.created_at || null : null,
              ended_at: data.session ? data.session.ended_at || null : null,
              mode: data.session ? data.session.mode || null : null,
              active_tab: data.session ? data.session.active_tab || null : null,
            },
            export: {
              export_timestamp: data.exportTimestamp || null,
              redaction_enabled: redactionEnabled === true,
              filters_summary:
                data.exportMetadata && data.exportMetadata.filters_summary
                  ? data.exportMetadata.filters_summary
                  : null,
            },
            counts: {
              total_requests: redactedEntries.length,
              failed_requests: failedCount,
            },
            requests: redactedEntries.map((entry) =>
              formatNetworkPrettyEntry(entry)
            ),
          };
          return toJsonWithSize(payload, "network_json");
        },
        options: { date: zipDate },
      });
      if (!metadataOnly) {
        const entries = await loadLimitedEntriesFromIdb({
          storeName: "network_entries",
          indexName: "partId",
          keyRange: IDBKeyRange.only(data.partId),
          limit: data.exportLimits
            ? data.exportLimits.maxRequests
            : EXPORT_LIMITS.maxRequests,
        });
        debugPersistLog("[LOGS][EXPORT][IDB_COUNTS]", {
          storeName: "network_entries",
          indexName: "partId",
          keyUsed: data.partId || null,
          loadedCount: entries.length,
        });
        const sourceName =
          data.partId ||
          (data.session && data.session.session_id
            ? data.session.session_id
            : "session");
        const postmanItem = buildPostmanAutomationItem(
          entries,
          sourceName,
          exportFilters
        );
        if (postmanItem) {
          automationItems.push(postmanItem);
        }
      }
      logItems.push({
        path: "logs/debugduck-logs-console.json",
        getData: async () => {
          const entries = await loadLimitedEntriesFromIdb({
            storeName: "console_entries",
            indexName: "partId",
            keyRange: IDBKeyRange.only(data.partId),
            limit: data.exportLimits
              ? data.exportLimits.maxConsoleEntries
              : EXPORT_LIMITS.maxConsoleEntries,
          });
          debugPersistLog("[LOGS][EXPORT][IDB_COUNTS]", {
            storeName: "console_entries",
            indexName: "partId",
            keyUsed: data.partId || null,
            loadedCount: entries.length,
          });
          const redactedEntries = redactConsoleEntry
            ? entries.map((entry) => redactConsoleEntry(entry))
            : entries;
          const errorCount = redactedEntries.filter(
            (entry) => entry && entry.level === "error"
          ).length;
          const payload = {
            session: {
              session_id:
                data.session && data.session.session_id
                  ? data.session.session_id
                  : null,
              part_id: data.partId || null,
              part_number:
                data.partInfo && typeof data.partInfo.partNumber === "number"
                  ? data.partInfo.partNumber
                  : null,
              started_at: data.session ? data.session.created_at || null : null,
              ended_at: data.session ? data.session.ended_at || null : null,
              mode: data.session ? data.session.mode || null : null,
              active_tab: data.session ? data.session.active_tab || null : null,
            },
            export: {
              export_timestamp: data.exportTimestamp || null,
              redaction_enabled: redactionEnabled === true,
              filters_summary:
                data.exportMetadata && data.exportMetadata.filters_summary
                  ? data.exportMetadata.filters_summary
                  : null,
            },
            counts: {
              total_entries: redactedEntries.length,
              error_entries: errorCount,
            },
            entries: redactedEntries.map((entry) =>
              formatConsolePrettyEntry(entry)
            ),
          };
          return toJsonWithSize(payload, "console_json");
        },
        options: { date: zipDate },
      });
    } else {
      const networkTotal =
        data.session && data.session.counts
          ? data.session.counts.network_requests
          : null;
      const consoleTotal =
        data.session && data.session.counts ? data.session.counts.console_entries : null;
      logItems.push({
        path: "logs/debugduck-logs-network.ndjson",
        getData: async () => {
          const result = await prepareNetworkNdjson();
          return result.blob;
        },
        options: { date: zipDate },
      });
      logItems.push({
        path: "logs/debugduck-logs-network.json",
        getData: async () => {
          let entries = [];
          if (exportSessionId && isIdbAvailable()) {
            entries = await loadLimitedEntriesFromIdb({
              storeName: "network_entries",
              indexName: "sessionId",
              keyRange: IDBKeyRange.only(exportSessionId),
              limit: data.exportLimits
                ? data.exportLimits.maxRequests
                : EXPORT_LIMITS.maxRequests,
            });
            debugPersistLog("[LOGS][EXPORT][IDB_COUNTS]", {
              storeName: "network_entries",
              indexName: "sessionId",
              keyUsed: exportSessionId,
              loadedCount: entries.length,
            });
          } else {
            entries =
              data.networkLogs && Array.isArray(data.networkLogs.entries)
                ? data.networkLogs.entries
                : [];
            debugPersistLog("[LOGS][EXPORT][FALLBACK_MEMORY]", {
              reason: exportSessionId ? "idb_unavailable" : "missing_session_id",
              networkMemoryCount:
                data.networkLogs && Array.isArray(data.networkLogs.entries)
                  ? data.networkLogs.entries.length
                  : 0,
              consoleMemoryCount:
                data.consoleLogs && Array.isArray(data.consoleLogs.entries)
                  ? data.consoleLogs.entries.length
                  : 0,
            });
          }
          const redactedEntries = redactNetworkEntry
            ? entries.map((entry) => redactNetworkEntry(entry))
            : entries;
          const failedCount = redactedEntries.filter((entry) =>
            isFailedRequest(entry)
          ).length;
          const payload = {
            session: {
              session_id:
                data.session && data.session.session_id
                  ? data.session.session_id
                  : null,
              part_id: data.partId || null,
              part_number:
                data.partInfo && typeof data.partInfo.partNumber === "number"
                  ? data.partInfo.partNumber
                  : null,
              started_at: data.session ? data.session.created_at || null : null,
              ended_at: data.session ? data.session.ended_at || null : null,
              mode: data.session ? data.session.mode || null : null,
              active_tab: data.session ? data.session.active_tab || null : null,
            },
            export: {
              export_timestamp: data.exportTimestamp || null,
              redaction_enabled: redactionEnabled === true,
              filters_summary:
                data.exportMetadata && data.exportMetadata.filters_summary
                  ? data.exportMetadata.filters_summary
                  : null,
            },
            counts: {
              total_requests: redactedEntries.length,
              failed_requests: failedCount,
            },
            requests: redactedEntries.map((entry) =>
              formatNetworkPrettyEntry(entry)
            ),
          };
          return toJsonWithSize(payload, "network_json");
        },
        options: { date: zipDate },
      });
      if (!metadataOnly) {
        let entries = [];
        if (exportSessionId && isIdbAvailable()) {
          entries = await loadLimitedEntriesFromIdb({
            storeName: "network_entries",
            indexName: "sessionId",
            keyRange: IDBKeyRange.only(exportSessionId),
            limit: data.exportLimits
              ? data.exportLimits.maxRequests
              : EXPORT_LIMITS.maxRequests,
          });
          debugPersistLog("[LOGS][EXPORT][IDB_COUNTS]", {
            storeName: "network_entries",
            indexName: "sessionId",
            keyUsed: exportSessionId,
            loadedCount: entries.length,
          });
        } else {
          entries =
            data.networkLogs && Array.isArray(data.networkLogs.entries)
              ? data.networkLogs.entries
              : [];
          debugPersistLog("[LOGS][EXPORT][FALLBACK_MEMORY]", {
            reason: exportSessionId ? "idb_unavailable" : "missing_session_id",
            networkMemoryCount:
              data.networkLogs && Array.isArray(data.networkLogs.entries)
                ? data.networkLogs.entries.length
                : 0,
            consoleMemoryCount:
              data.consoleLogs && Array.isArray(data.consoleLogs.entries)
                ? data.consoleLogs.entries.length
                : 0,
          });
        }
        const sourceName =
          data.partId ||
          (data.session && data.session.session_id
            ? data.session.session_id
            : "session");
        const postmanItem = buildPostmanAutomationItem(entries, sourceName, null);
        if (postmanItem) {
          automationItems.push(postmanItem);
        }
      }
      logItems.push({
        path: "logs/debugduck-logs-console.ndjson",
        getData: async () => {
          const result = await prepareConsoleNdjson();
          return result.blob;
        },
        options: { date: zipDate },
      });
      logItems.push({
        path: "logs/debugduck-logs-console.json",
        getData: async () => {
          let entries = [];
          if (exportSessionId && isIdbAvailable()) {
            entries = await loadLimitedEntriesFromIdb({
              storeName: "console_entries",
              indexName: "sessionId",
              keyRange: IDBKeyRange.only(exportSessionId),
              limit: data.exportLimits
                ? data.exportLimits.maxConsoleEntries
                : EXPORT_LIMITS.maxConsoleEntries,
            });
            debugPersistLog("[LOGS][EXPORT][IDB_COUNTS]", {
              storeName: "console_entries",
              indexName: "sessionId",
              keyUsed: exportSessionId,
              loadedCount: entries.length,
            });
          } else {
            entries =
              data.consoleLogs && Array.isArray(data.consoleLogs.entries)
                ? data.consoleLogs.entries
                : [];
            debugPersistLog("[LOGS][EXPORT][FALLBACK_MEMORY]", {
              reason: exportSessionId ? "idb_unavailable" : "missing_session_id",
              networkMemoryCount:
                data.networkLogs && Array.isArray(data.networkLogs.entries)
                  ? data.networkLogs.entries.length
                  : 0,
              consoleMemoryCount:
                data.consoleLogs && Array.isArray(data.consoleLogs.entries)
                  ? data.consoleLogs.entries.length
                  : 0,
            });
          }
          const redactedEntries = redactConsoleEntry
            ? entries.map((entry) => redactConsoleEntry(entry))
            : entries;
          const errorCount = redactedEntries.filter(
            (entry) => entry && entry.level === "error"
          ).length;
          const payload = {
            session: {
              session_id:
                data.session && data.session.session_id
                  ? data.session.session_id
                  : null,
              part_id: data.partId || null,
              part_number:
                data.partInfo && typeof data.partInfo.partNumber === "number"
                  ? data.partInfo.partNumber
                  : null,
              started_at: data.session ? data.session.created_at || null : null,
              ended_at: data.session ? data.session.ended_at || null : null,
              mode: data.session ? data.session.mode || null : null,
              active_tab: data.session ? data.session.active_tab || null : null,
            },
            export: {
              export_timestamp: data.exportTimestamp || null,
              redaction_enabled: redactionEnabled === true,
              filters_summary:
                data.exportMetadata && data.exportMetadata.filters_summary
                  ? data.exportMetadata.filters_summary
                  : null,
            },
            counts: {
              total_entries: redactedEntries.length,
              error_entries: errorCount,
            },
            entries: redactedEntries.map((entry) =>
              formatConsolePrettyEntry(entry)
            ),
          };
          return toJsonWithSize(payload, "console_json");
        },
        options: { date: zipDate },
      });
      metaItems.push(
        {
          path: "meta/session.json",
          getData: () => toJsonWithSize(data.session || {}, "session"),
          options: { date: zipDate },
        }
      );
      if (EXTENDED_EXPORT) {
        metaItems.push(
          {
            path: "meta/environment.json",
            getData: () => toJsonWithSize(data.environment || {}, "environment"),
            options: { date: zipDate },
          },
          {
            path: "meta/export_metadata.json",
            getData: () =>
              toJsonWithSize(data.exportMetadata || {}, "export_metadata"),
            options: { date: zipDate },
          }
        );
      }
    }
    if (EXTENDED_EXPORT && !usePartExport && data.qaSessionLog) {
      summaryItems.push({
        path: "debugduck/debugduck-session-log.json",
        getData: () =>
          toJsonWithSize(data.qaSessionLog || {}, "qa_session_log"),
        options: { date: zipDate },
      });
    }
    if (EXTENDED_EXPORT && data.qaSummaryText) {
      summaryItems.push({
        path: "qa/qa-summary.txt",
        data: data.qaSummaryText,
        options: { date: zipDate },
      });
    }
    summaryItems.push({
      path: "summary/errors.json",
      getData: () => {
        const signalErrors =
          data.qaSessionLog && Array.isArray(data.qaSessionLog.signals)
            ? data.qaSessionLog.signals.filter((signal) => signal.level === "error")
            : [];
        return toJsonWithSize(
          {
            total_errors: summaryCounts.consoleErrors,
            sampled: summarySamples.consoleErrors.length,
            truncated: summaryFlags.consoleErrorsTruncated || false,
            errors: summarySamples.consoleErrors,
            signal_errors: signalErrors,
          },
          "summary_errors"
        );
      },
      options: { date: zipDate },
    });
    summaryItems.push({
      path: "summary/failed_requests.json",
      getData: () =>
        toJsonWithSize(
          {
            total_failed_requests: summaryCounts.failedRequests,
            sampled: summarySamples.failedRequests.length,
            truncated: summaryFlags.failedRequestsTruncated || false,
            failed_requests: summarySamples.failedRequests,
          },
          "summary_failed_requests"
        ),
      options: { date: zipDate },
    });
    summaryItems.push({
      path: "summary/session_summary.json",
      getData: () => {
        const sessionRecord = data.session || {};
        const startedAtIso = sessionRecord.created_at || null;
        const endedAtIso = sessionRecord.ended_at || null;
        const startedAtMs = parseEpochMs(startedAtIso);
        const endedAtMs = parseEpochMs(endedAtIso);
        const durationMs =
          startedAtMs !== null && endedAtMs !== null
            ? Math.max(0, endedAtMs - startedAtMs)
            : null;
        const requestCount =
          data.partInfo && typeof data.partInfo.requestCount === "number"
            ? data.partInfo.requestCount
            : sessionRecord.counts && typeof sessionRecord.counts.network_requests === "number"
              ? sessionRecord.counts.network_requests
              : 0;
        const consoleCount =
          data.partInfo && typeof data.partInfo.consoleCount === "number"
            ? data.partInfo.consoleCount
            : sessionRecord.counts && typeof sessionRecord.counts.console_entries === "number"
              ? sessionRecord.counts.console_entries
              : 0;
        const errorCount =
          data.partInfo && typeof data.partInfo.errorCount === "number"
            ? data.partInfo.errorCount
            : summaryCounts.consoleErrors;
        return toJsonWithSize(
          {
            session_id: sessionRecord.session_id || null,
            part_id: data.partId || null,
            part_number:
              data.partInfo && typeof data.partInfo.partNumber === "number"
                ? data.partInfo.partNumber
                : null,
            started_at: startedAtIso,
            ended_at: endedAtIso,
            duration_ms: durationMs,
            counts: {
              network_requests: requestCount,
              console_entries: consoleCount,
              console_errors: errorCount,
              failed_requests: summaryCounts.failedRequests,
            },
            export: {
              export_timestamp: data.exportTimestamp || null,
              redaction_enabled: data.redactionEnabled === true,
              filters_summary:
                data.exportMetadata && data.exportMetadata.filters_summary
                  ? data.exportMetadata.filters_summary
                  : null,
            },
          },
          "summary_session"
        );
      },
      options: { date: zipDate },
    });
    if (EXTENDED_EXPORT && data.exportTruncationReport) {
      summaryItems.push({
        path: "qa/truncation_report.json",
        getData: () =>
          toJsonWithSize(
            data.exportTruncationReport || {},
            "summary_truncation"
          ),
        options: { date: zipDate },
      });
    }
    const reportItems = [];
    let reportMeta = null;
    try {
      const reportConfig = getReportConfig();
      reportMeta = {
        enabled: reportConfig.enabled,
        version: reportConfig.version,
        hasSessionData: false,
      };
      if (
        reportConfig.enabled &&
        globalThis.ReportSessionManager &&
        typeof globalThis.ReportSessionManager.getSessionData === "function"
      ) {
        const reportSession = globalThis.ReportSessionManager.getSessionData();
        if (reportSession) {
          reportMeta.hasSessionData = true;
          reportItems.push({
            path: "reports/report_session.json",
            getData: () => JSON.stringify(reportSession, null, 2),
            options: { date: zipDate },
          });
          const reportSteps = await loadReportStepsForSession(
            reportSession.sessionId
          );
          if (reportSteps.length > 0) {
            reportItems.push({
              path: "reports/steps.ndjson",
              getData: () => buildStepsNdjson(reportSteps),
              options: { date: zipDate },
            });
          }
        }
      }
    } catch (error) {
      const reportConfig = getReportConfig();
      reportMeta = {
        enabled: reportConfig.enabled,
        version: reportConfig.version,
        hasSessionData: false,
        packagingError: true,
      };
    }
    if (data.exportMetadata && reportMeta) {
      data.exportMetadata.report = {
        ...data.exportMetadata.report,
        ...reportMeta,
      };
    }
    const recordingFileName =
      data.video && data.video.fileName
        ? data.video.fileName
        : `debugduck-recording-${exportTimestamp}.webm`;
    await prepareNetworkNdjson();
    await prepareConsoleNdjson();
    const exportedNetworkEntries = data.networkLogs?.entries || [];
    const exportedConsoleEntries = data.consoleLogs?.entries || [];
    const exportedNetworkCount =
      typeof ndjsonStats?.network?.count === "number"
        ? ndjsonStats.network.count
        : exportedNetworkEntries.length;
    const exportedConsoleCount =
      typeof ndjsonStats?.console?.count === "number"
        ? ndjsonStats.console.count
        : exportedConsoleEntries.length;
    const manifestPayload = buildSessionManifest({
      data,
      manifestSessionId,
      exportTimestamp,
      screenshotCandidates: exportedScreenshotCandidates,
      recordingFileName: data.video || data.recordingDataUrl ? recordingFileName : "",
      recordingSizeBytes:
        data.video && typeof data.video.byteLength === "number"
          ? data.video.byteLength
          : data.recordingDataUrl
            ? estimateDataUrlBytes(data.recordingDataUrl)
            : null,
      recordingDurationMs: data.recordingDurationMs,
      ndjsonStats,
      usePartExport,
      exported: {
        networkEntries: exportedNetworkEntries,
        consoleEntries: exportedConsoleEntries,
        networkCount: exportedNetworkCount,
        consoleCount: exportedConsoleCount,
        networkFailures: summaryCounts.failedRequests,
        consoleErrors: summaryCounts.consoleErrors,
        screenshots: exportedScreenshotCandidates,
      },
    });
    const manifestValidation = validateManifestForExport(manifestPayload);
    if (manifestValidation.warnings.length) {
      manifestPayload.integrity.warnings = Array.from(
        new Set([
          ...(manifestPayload.integrity.warnings || []),
          ...manifestValidation.warnings,
        ])
      );
    }
    if (manifestValidation.errors.length) {
      throw new Error(
        `Export validation failed: ${manifestValidation.errors.join(" ")}`
      );
    }
    const manifestItem = {
      path: "session.json",
      getData: () => toJsonWithSize(manifestPayload, "session_manifest"),
      options: { date: zipDate },
    };
    const viewerItems = [];
    const loadViewerAsset = async (assetPath) => {
      try {
        const response = await fetch(chrome.runtime.getURL(assetPath));
        if (!response.ok) {
          return null;
        }
        const text = await response.text();
        return {
          path: assetPath,
          getData: () => text,
          options: { date: zipDate },
        };
      } catch (error) {
        return null;
      }
    };
    if (!usePartExport) {
      const viewerAssets = [
        "viewer/index.html",
        "viewer/viewer.js",
        "viewer/app.js",
        "viewer/styles.css",
      ];
      for (const assetPath of viewerAssets) {
        const item = await loadViewerAsset(assetPath);
        if (item) {
          viewerItems.push(item);
        }
      }
      if (viewerItems.length !== viewerAssets.length) {
        throw new Error(
          "Export failed: packaged viewer assets missing. Reload DebugDuck and retry."
        );
      }
      viewerItems.push({
        path: "OPEN_VIEWER.txt",
        getData: () =>
          [
            "DebugDuck Session Package",
            "",
            "Open viewer/index.html in a browser to inspect this session offline.",
            "All files are local. No server or install required.",
          ].join("\n"),
        options: { date: zipDate },
      });
    }
    baseItems = [
      ...logItems,
      ...metaItems,
      manifestItem,
      ...viewerItems,
      ...summaryItems,
      ...automationItems,
      ...reportItems,
    ];
    if (!EXTENDED_EXPORT) {
      console.info("[EXPORT] Minimal team export mode active");
    }
    logExportPhase("zip_add_json", { count: baseItems.length });
    await ZipBuilderChunked.addItemsInBatches(zip, baseItems, {
      batchSize: 1,
      yieldEveryMs: EXPORT_BATCH_DEFAULTS.yieldEveryMs,
      onProgress: ({ completed, total }) => {
        const percent = Math.round(20 + (completed / total) * 20);
        reportExportProgress(percent, "zip_add_json", { completed, total });
      },
    });
    logExportPhase("stringify_done", jsonSizes);

    const screenshotItems = [];
    for (const shot of exportedScreenshotCandidates) {
      if (!shot || !shot.blob) {
        continue;
      }
      const name =
        shot.fileName || `debugduck-screenshot-${formatZipTimestamp(new Date())}.png`;
      screenshotItems.push({
        path: `screenshots/${name}`,
        getData: () => shot.blob,
        options: { date: zipDate },
      });
    }
    if (screenshotItems.length > 0) {
      logExportPhase("zip_add_screenshots", { count: screenshotItems.length });
      await ZipBuilderChunked.addItemsInBatches(zip, screenshotItems, {
        batchSize: EXPORT_BATCH_DEFAULTS.screenshots,
        yieldEveryMs: EXPORT_BATCH_DEFAULTS.yieldEveryMs,
        onProgress: ({ completed, total }) => {
          const percent = Math.round(40 + (completed / total) * 30);
          reportExportProgress(percent, "zip_add_screenshots", {
            completed,
            total,
          });
        },
      });
    } else {
      reportExportProgress(70, "zip_add_screenshots", { completed: 0, total: 0 });
    }

    if (!usePartExport) {
      let recordingBlob = null;
      let recordingFileName = `debugduck-recording-${exportTimestamp}.webm`;
      if (data.video && data.video.blobUrl) {
        try {
          const response = await fetch(data.video.blobUrl);
          recordingBlob = await response.blob();
          if (data.video.fileName) {
            recordingFileName = data.video.fileName;
          }
        } catch (error) {
          recordingBlob = null;
        }
      }
      if (!recordingBlob && (data.recordingDataUrl || data.recordingMimeType)) {
        try {
          await ensureOffscreenReady();
          const exportResponse = await sendMessageToOffscreen({
            type: "RECORDING_EXPORT_WEBM",
          });
          if (exportResponse && exportResponse.ok && exportResponse.blobUrl) {
            const response = await fetch(exportResponse.blobUrl);
            recordingBlob = await response.blob();
          } else if (data.recordingDataUrl) {
            recordingBlob = dataUrlToBlob(data.recordingDataUrl);
          }
        } catch (error) {
          recordingBlob = null;
        }
      }
      if (recordingBlob) {
        logExportPhase("zip_add_video", { bytes: recordingBlob.size });
        zip.file(recordingFileName, recordingBlob, { date: zipDate });
        reportExportProgress(75, "zip_add_video", {
          bytes: recordingBlob.size,
        });
      } else {
        reportExportProgress(75, "zip_add_video", { bytes: 0 });
      }
    } else {
      reportExportProgress(75, "zip_add_video", { bytes: 0 });
    }

    reportExportProgress(78, "zip_generate_start");
    await yieldExport();
    const zipBytes = await ZipBuilderChunked.generateZipBytes(zip, {
      compression: "STORE",
      streamFiles: true,
      onUpdate: (metadata) => {
        if (!metadata || typeof metadata.percent !== "number") {
          return;
        }
        const percent = Math.round(78 + (metadata.percent / 100) * 17);
        reportExportProgress(percent, "zip_generate", {
          percent: metadata.percent,
        });
      },
    });
    console.log("[EXPORT][ZIP_BYTES]", { bytes: zipBytes.byteLength });
    console.log("[EXPORT][ZIP_CHECKSUM_BYTES]", {
      checksum: computeFnv1a(zipBytes),
      bytes: zipBytes.byteLength,
    });
    assertZipSignature(zipBytes);
    assertZipEocd(zipBytes);
    console.log("[EXPORT][ZIP_SIGNATURE_OK]", { bytes: zipBytes.byteLength });
    const zipArrayBuffer = getArrayBufferFromUint8Array(zipBytes);
    console.log("[EXPORT][ZIP_ARRAYBUFFER]", {
      bytes: zipArrayBuffer.byteLength,
    });
    console.log("[EXPORT][ZIP_CHECKSUM_ARRAYBUFFER]", {
      checksum: computeFnv1a(new Uint8Array(zipArrayBuffer)),
      bytes: zipArrayBuffer.byteLength,
    });
    logExportPhase("zip_generate_done", { bytes: zipBytes.byteLength });
    reportExportProgress(96, "zip_generate_done", { bytes: zipBytes.byteLength });

    const filename = `debugduck-session-${manifestSessionId}.zip`;
    const stored = await storeExportArtifact(zipArrayBuffer, {
      filename,
      mimeType: "application/zip",
    });
    console.log("[EXPORT][ZIP_DOWNLOAD_REQUEST]", {
      filename,
      mimeType: "application/zip",
      bytes: zipBytes.byteLength,
      artifactKey: stored.artifactKey,
    });
    await brokerDownloadExportArtifact(stored.artifactKey, filename, "application/zip", {
      saveAs: false,
    });
    reportExportProgress(100, "zip_download", { filename });
    if (!usePartExport) {
      sendExportEvent("EXPORT_EVIDENCE_ZIP_DONE", { filename });
    }
  } catch (error) {
    console.error("[EXPORT] Failed", error && error.stack ? error.stack : error);
    if (!usePartExport) {
      sendExportEvent("EXPORT_EVIDENCE_ZIP_ERROR", {
        userMessage:
          error && error.userMessage
            ? error.userMessage
            : "Export failed. Try again or reduce capture size.",
        debugCode:
          error && error.debugCode
            ? error.debugCode
            : error && error.message
              ? error.message
              : "unknown",
      });
    }
    throw error;
  } finally {
    if (exportJob) {
      exportJob.active = false;
      exportJob.partId = null;
    }
    if (exportQueue.length > 0) {
      setTimeout(() => {
        void processExportQueue();
      }, 0);
    }
  }
}

async function isPartExported(partId) {
  if (!partId) {
    return false;
  }
  if (exportedPartIds.has(partId)) {
    return true;
  }
  if (!isIdbAvailable()) {
    return false;
  }
  const record = await ReproIdb.getByKey("parts", partId);
  if (record && record.exportedAtMs) {
    exportedPartIds.add(partId);
    return true;
  }
  return false;
}

async function markPartExported(partId) {
  if (!partId || !isIdbAvailable()) {
    return;
  }
  const record = await ReproIdb.getByKey("parts", partId);
  if (!record) {
    return;
  }
  record.exportedAtMs = Date.now();
  await ReproIdb.putOne("parts", record);
  exportedPartIds.add(partId);
}

async function listCompletedParts() {
  if (!captureState.sessionId || !isIdbAvailable()) {
    return [];
  }
  const parts = await ReproIdb.getAllByIndex(
    "parts",
    "sessionId",
    IDBKeyRange.only(captureState.sessionId)
  );
  return parts
    .filter(
      (part) =>
        part &&
        part.status &&
        part.status !== PART_STATUS.ACTIVE &&
        part.status !== PART_STATUS.DELETED
    )
    .sort((a, b) => (a.partNumber || 0) - (b.partNumber || 0))
    .map((part) => ({
      partId: part.partId,
      partNumber: part.partNumber,
      status:
        part.status === "completed" ? PART_STATUS.COMPLETED_READY : part.status,
      requestCount: part.requestCount || 0,
      consoleCount: part.consoleCount || 0,
      errorCount: part.errorCount || 0,
      bytesInPart: part.bytesInPart || 0,
      networkBytes: part.networkBytes || 0,
      consoleBytes: part.consoleBytes || 0,
      completedAtMs: part.completedAtMs || null,
      downloadedAtMs: part.downloadedAtMs || null,
      downloadFailedAtMs: part.downloadFailedAtMs || null,
      exportInProgress: exportJob ? exportJob.partId === part.partId : false,
      queuedForExport: exportQueueIds.has(part.partId),
    }));
}

async function refreshLastCompletedPart() {
  const parts = await listCompletedParts();
  const last = parts.length ? parts[parts.length - 1] : null;
  captureState.lastCompletedPartId = last ? last.partId : null;
  captureState.lastCompletedPartNumber = last ? last.partNumber : null;
  captureState.completedPartsCount = parts.length;
}

async function deletePart(partId) {
  if (!partId || !isIdbAvailable()) {
    return { ok: false, error: "Part not found." };
  }
  if (exportJob && exportJob.partId === partId) {
    return { ok: false, error: "Part is exporting." };
  }
  if (exportQueueIds.has(partId)) {
    return { ok: false, error: "Part is queued for export." };
  }
  const record = await ReproIdb.getByKey("parts", partId);
  if (!record || record.status === PART_STATUS.ACTIVE) {
    return { ok: false, error: "Cannot delete active part." };
  }
  await ReproIdb.deleteAllByIndex(
    "network_entries",
    "partId",
    IDBKeyRange.only(partId)
  );
  await ReproIdb.deleteAllByIndex(
    "console_entries",
    "partId",
    IDBKeyRange.only(partId)
  );
  record.status = PART_STATUS.DELETED;
  record.deletedAtMs = Date.now();
  await ReproIdb.putOne("parts", record);
  await refreshLastCompletedPart();
  await resumeCaptureAfterStorageLimit();
  return { ok: true };
}

async function clearAllCaptureData() {
  const recordingState = recordingController.state || state.recording.status || "idle";
  if (state.network.active || ["starting", "recording", "paused"].includes(recordingState)) {
    return { ok: false, error: "Stop capture before clearing data." };
  }
  if (!isIdbAvailable()) {
    return { ok: false, error: "Storage unavailable." };
  }
  const safeClear = async (storeName) => {
    try {
      await ReproIdb.clearStore(storeName);
    } catch (error) {
      // Ignore missing store errors.
    }
  };
  await safeClear("parts");
  await safeClear("network_entries");
  await safeClear("console_entries");
  await safeClear("meta");
  await safeClear("sessions");
  await safeClear("counters");
  const wasActive = state.network.active;
  const tab = wasActive ? await getActiveTab() : null;
  resetCaptureState();
  state.network.requests = {};
  state.network.order = [];
  state.network.capped = false;
  state.network.startedAt = null;
  state.network.stoppedAt = null;
  state.console.logs = [];
  state.console.startedAt = null;
  state.console.stoppedAt = null;
  state.screenshot.dataUrl = null;
  state.screenshot.capturedAt = null;
  state.recording.status = "idle";
  state.recording.dataUrl = null;
  state.recording.mimeType = null;
  state.recording.capturedAt = null;
  state.recording.error = null;
  state.recording.hasData = false;
  state.recording.videoBlobUrl = null;
  state.recording.videoMime = null;
  state.recording.videoByteLength = null;
  state.recording.videoStartEpochMs = null;
  state.recording.videoEndEpochMs = null;
  state.recording.sessionId = null;
  recordingController.state = "idle";
  recordingController.sessionId = null;
  recordingController.targetTabId = null;
  recordingController.lastError = null;
  recordingOverlayState.startMs = null;
  recordingOverlayState.paused = false;
  recordingOverlayState.pauseStartedAt = null;
  recordingOverlayState.totalPausedMs = 0;
  recordingOverlayState.tabId = null;
  if (session) {
    session.screenshots = [];
    session.counts = {
      network_requests: 0,
      console_entries: 0,
      errors: 0,
    };
    session.diagnostics = [];
  }
  if (wasActive && tab) {
    await loadCaptureSettings();
    await ensureSessionRecord(tab);
  }
  return { ok: true };
}

function sendMessageToTabWithResponse(tabId, message) {
  return new Promise((resolve) => {
    if (!tabId) {
      resolve({ ok: false, error: "No tab to message." });
      return;
    }
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false, error: "No response from tab." });
    });
  });
}

function attachDebugger(tabId) {
  return new Promise((resolve, reject) => {
    chrome.debugger.attach({ tabId }, DEBUGGER_PROTOCOL_VERSION, () => {
      if (chrome.runtime.lastError) {
        const message = chrome.runtime.lastError.message;
        if (DEBUG_CDP_LOGS) {
          const attachLastErrorPayload = { tabId, error: message };
          console.warn("[LOGS][CDP][ATTACH_LAST_ERROR]", attachLastErrorPayload);
          appendCdpDebugLog("[LOGS][CDP][ATTACH_LAST_ERROR]", attachLastErrorPayload);
        }
        reject(new Error(message));
        return;
      }
      resolve();
    });
  });
}

function detachDebugger(tabId) {
  return new Promise((resolve, reject) => {
    chrome.debugger.detach({ tabId }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

function sendDebuggerCommand(tabId, method, params) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params || {}, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(result);
    });
  });
}

function sendMessageToOffscreen(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        offscreenReady = false;
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false, error: "No response from offscreen." });
    });
  });
}

async function ensureOffscreenDocument() {
  if (offscreenCreating) {
    await offscreenCreating;
    return;
  }
  const hasDocument = await chrome.offscreen.hasDocument();
  if (hasDocument) {
    return;
  }
  offscreenCreating = chrome.offscreen.createDocument({
    url: chrome.runtime.getURL("offscreen/recording_offscreen.html"),
    reasons: ["USER_MEDIA", "BLOBS"],
    justification:
      "Record active tab video and stitch full-page screenshots while popup is closed.",
  });
  try {
    await offscreenCreating;
  } finally {
    offscreenCreating = null;
  }
}

async function ensureOffscreenReady() {
  await ensureOffscreenDocument();
  if (offscreenReady) {
    return;
  }
  const pingWithTimeout = async (label) => {
    const timeoutMs = 1500;
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve({ ok: false, error: "Offscreen ping timeout." }), timeoutMs);
    });
    const response = await Promise.race([
      sendMessageToOffscreen({ type: "OFFSCREEN_PING" }),
      timeoutPromise,
    ]);
    if (!response.ok || response.owner !== "recording_offscreen") {
      logRecordingDiagnostic("offscreen_ping_failed", {
        errorPhase: label,
        errorMessage: response.error || "Offscreen ping failed.",
      });
    }
    return response;
  };
  const response = await pingWithTimeout("initial");
  if (!response.ok || response.owner !== "recording_offscreen") {
    try {
      await chrome.offscreen.closeDocument();
    } catch (error) {
      // Ignore close failures and retry creation.
    }
    offscreenReady = false;
    await ensureOffscreenDocument();
    const retry = await pingWithTimeout("retry");
    if (!retry.ok || retry.owner !== "recording_offscreen") {
      throw new Error(retry.error || "Offscreen document not ready.");
    }
    if (retry.state) {
      syncRecordingState(retry.state);
    }
  }
  offscreenReady = true;
  if (response.state) {
    syncRecordingState(response.state);
  }
}

function getCaptureDebugSnapshot() {
  return {
    recordingState: recordingController.state || state.recording.status || "idle",
    sessionState: session ? session.state : null,
    sessionMode: session ? session.mode : null,
    logsState: captureState.logsState,
    pausedForStorageLimit: captureState.pausedForStorageLimit,
  };
}

function enqueueScreenshotCapture(source, handler) {
  const queuedAt = Date.now();
  const queueId = (screenshotCaptureSequence += 1);
  screenshotCaptureQueue = screenshotCaptureQueue
    .catch(() => {})
    .then(async () => {
      const startAt = Date.now();
      console.log("[CAPTURE][SW][SCREENSHOT_START]", {
        queueId,
        source,
        queuedMs: startAt - queuedAt,
        ...getCaptureDebugSnapshot(),
      });
      try {
        const result = await handler();
        console.log("[CAPTURE][SW][SCREENSHOT_END]", {
          queueId,
          source,
          durationMs: Date.now() - startAt,
          ...getCaptureDebugSnapshot(),
        });
        return result;
      } catch (error) {
        console.warn("[CAPTURE][SW][SCREENSHOT_FAILED]", {
          queueId,
          source,
          durationMs: Date.now() - startAt,
          error: error && error.message ? error.message : String(error),
          ...getCaptureDebugSnapshot(),
        });
        throw error;
      }
    });
  return screenshotCaptureQueue;
}

async function captureScreenshot() {
  const tab = await getActiveTab();
  ensureTabIsCapturable(tab);
  let scrollbarsHidden = false;
  try {
    if (tab && tab.id) {
      scrollbarsHidden = await hideScrollbarsForCapture(tab.id);
    }
    const windowId = tab && typeof tab.windowId === "number" ? tab.windowId : null;
    let dataUrl = await captureVisibleTabThrottled(windowId, {
      minIntervalMs: FULL_CAPTURE_CONFIG.minCaptureIntervalMs,
      maxRetries: 1,
    });
    const timestampIso = nowIso();
    await loadTimestampOverlaySetting();
    if (timestampOverlayEnabled) {
      const nowMs = Date.now();
      const elapsedMs = computeRecordingElapsedMs(nowMs);
      let overlayText = formatOverlayTimestamp(new Date(nowMs));
      if (typeof elapsedMs === "number") {
        const elapsedText = formatElapsedMs(elapsedMs);
        if (elapsedText) {
          overlayText += ` • +${elapsedText}`;
        }
      }
      const overlayResult = await applyTimestampOverlayToDataUrl(dataUrl, {
        text: overlayText,
      });
      if (overlayResult && overlayResult.dataUrl) {
        dataUrl = overlayResult.dataUrl;
      }
    }
    state.screenshot.dataUrl = dataUrl;
    state.screenshot.capturedAt = timestampIso;
    if (session && !session.lightweight) {
      const tMs = computeSessionOffsetMs(timestampIso);
      const index = session.screenshots.length + 1;
      const blob = dataUrlToBlob(dataUrl);
      const fileName = `debugduck-screenshot-${String(index).padStart(3, "0")}.png`;
      session.screenshots.push({
        index,
        timestampIso,
        t_ms: tMs,
        blob,
        fileName,
        dataUrl,
      });
      try {
        if (
          globalThis.ReportStepTracker &&
          typeof globalThis.ReportStepTracker.recordScreenshotEvent === "function"
        ) {
          globalThis.ReportStepTracker.recordScreenshotEvent(
            {
              kind: "screenshot",
              filename: fileName,
              relativePath: `screenshots/${fileName}`,
              mimeType: "image/png",
              size: blob.size,
              createdAt: timestampIso,
            },
            {
              url: tab && tab.url ? tab.url : "",
              title: tab && tab.title ? tab.title : "",
              timestamp: timestampIso,
              captureMode: "visible",
            }
          );
        }
      } catch (error) {
        // Report tracking is optional; ignore failures.
      }
    }
    clearStatusMessage();
    return dataUrl;
  } catch (error) {
    addDiagnostic("error", "Screenshot capture failed.", {
      error: error.message || String(error),
    });
    throw error;
  } finally {
    if (scrollbarsHidden && tab && tab.id) {
      await restoreScrollbarsAfterCapture(tab.id);
    }
  }
}

async function saveCaptureRun(run) {
  await ReproIdb.putOne("capture_runs", run);
  return run;
}

async function updateCaptureRun(captureRunId, updates) {
  const existing = await ReproIdb.getByKey("capture_runs", captureRunId);
  if (!existing) {
    return null;
  }
  const next = {
    ...existing,
    ...updates,
    updatedAt: Date.now(),
  };
  await ReproIdb.putOne("capture_runs", next);
  return next;
}

async function persistCaptureTile({ captureRunId, tileIndex, tile, blob }) {
  if (!blob || (typeof Blob !== "undefined" && !(blob instanceof Blob))) {
    throw new Error("capture_blobs.blob must be a resolved Blob");
  }
  const blobKey = `tile_${captureRunId}_${String(tileIndex).padStart(4, "0")}`;
  await ReproIdb.putOne("capture_blobs", {
    key: blobKey,
    captureRunId,
    kind: "tile",
    blob,
    createdAt: Date.now(),
  });
  const tileId = `${captureRunId}:${tileIndex}`;
  await ReproIdb.putOne("capture_tiles", {
    tileId,
    captureRunId,
    tileIndex,
    scrollY: tile.scrollY,
    cssTop: tile.scrollY,
    yPx: tile.y,
    widthPx: tile.width,
    heightPx: tile.height,
    clipTopPx: tile.clipTop,
    clipHeightPx: tile.clipHeight,
    blobKey,
    status: "committed",
    capturedAt: Date.now(),
  });
  return blobKey;
}

async function composeFullpageArtifact(captureRunId, isFinal) {
  await updateCaptureRun(captureRunId, { status: "composing" });
  const response = await sendMessageToOffscreen({
    type: isFinal ? "FULLPAGE_COMPOSE_FINAL" : "FULLPAGE_COMPOSE_PARTIAL",
    payload: { captureRunId },
  });
  if (!response || response.ok === false) {
    const err = new Error(
      response && response.message ? response.message : "Full page compose failed."
    );
    err.code = response && response.code ? response.code : "FULLPAGE_ERR_STITCH";
    throw err;
  }
  return response;
}

async function scanFullpageRuns() {
  try {
    const activeRuns = await ReproIdb.getAllByIndex(
      "capture_runs",
      "status",
      IDBKeyRange.only("capturing")
    );
    const composingRuns = await ReproIdb.getAllByIndex(
      "capture_runs",
      "status",
      IDBKeyRange.only("composing")
    );
    const recoverableRuns = [...activeRuns, ...composingRuns];
    console.log("[FULLPAGE][SW][RECOVERY_SCAN]", {
      activeRuns: recoverableRuns.length,
      recoverableRuns: recoverableRuns.map((run) => run.captureRunId),
    });
    await Promise.all(
      recoverableRuns.map((run) =>
        updateCaptureRun(run.captureRunId, {
          status: "recovered_after_restart",
          failureReason: "Service worker restarted.",
        })
      )
    );
  } catch (error) {
    console.warn("[FULLPAGE][SW][RECOVERY_SCAN_FAILED]", error);
  }
}

scanFullpageRuns();
runRecordingRetentionCleanup();

function getFullpageUserMessage(error) {
  const code = error && error.code ? error.code : null;
  const rawMessage = error && error.message ? error.message : null;
  if (code === "RESTRICTED_PAGE" || code === "CAPTURE_DENIED") {
    return "Full capture isn’t supported on this page. Open a regular website tab and try again.";
  }
  if (code === "FULLPAGE_ERR_TOO_TALL") {
    return "Page too tall for full capture (exceeds safe size). Try Snap or segment capture.";
  }
  if (code === "FULLPAGE_ERR_SCROLL_LOCKED") {
    return "Page prevented scrolling (likely modal/overflow lock).";
  }
  if (code === "FULLPAGE_ERR_SCROLL_MISMATCH") {
    return "Page layout changed during capture. Try again.";
  }
  if (code === "FULLPAGE_ERR_CAPTURE_VISIBLE_TAB") {
    return rawMessage || "captureVisibleTab failed.";
  }
  if (code === "FULLPAGE_ERR_VIEWPORT_CHANGED") {
    return "Viewport height changed during capture. Try again.";
  }
  if (code === "FULLPAGE_ERR_TILE_INVALID") {
    const reason =
      error && error.details && error.details.reason
        ? ` Reason: ${error.details.reason.replace(/_/g, " ")}.`
        : "";
    return (
      "Full page capture failed due to invalid tile data." +
      reason +
      " Media-heavy pages may block full-page capture. Try again or use Snap."
    );
  }
  if (code === "FULLPAGE_ERR_STITCH") {
    return rawMessage || "Full page capture failed during stitching.";
  }
  if (code === "FULLPAGE_ERR_INCOMPLETE") {
    return "Full page capture incomplete. Missing tile coverage. Try again.";
  }
  if (code === "FULLPAGE_ERR_OFFSCREEN") {
    return "Full page capture failed. Try Snap instead.";
  }
  return rawMessage || "Full capture failed. Try again, or use Snap.";
}

async function handlePopupCaptureRequest(request) {
  const mode = request && request.mode ? request.mode : "snap";
  const payload = request && request.payload ? request.payload : {};
  if (mode === "snap") {
    try {
      const dataUrl = await enqueueScreenshotCapture("popup_snap", () =>
        captureScreenshot()
      );
      if (typeof dataUrl === "string" && dataUrl.startsWith("data:image/png")) {
        await chrome.storage.session.set({
          latestScreenshotDataUrl: dataUrl,
        });
        await chrome.tabs.create({
          url: chrome.runtime.getURL("popup/screenshot_viewer.html"),
        });
      }
    } catch (error) {
      console.warn("[CAPTURE][SW][SNAP_FAILED]", error);
    }
    return;
  }
  if (mode === "full") {
    try {
      const captureResult = await captureFullPageScreenshot(payload.tabId);
      const artifactKey = captureResult && captureResult.artifactKey;
      console.log("[FULLPAGE][SW][RESPONSE_TO_POPUP]", {
        ok: Boolean(artifactKey),
        status: captureResult ? captureResult.status : null,
        artifactKey: artifactKey || null,
        tileCountCaptured:
          captureResult && typeof captureResult.tileCountCaptured === "number"
            ? captureResult.tileCountCaptured
            : 0,
        tileCountExpected:
          captureResult && typeof captureResult.tileCountExpected === "number"
            ? captureResult.tileCountExpected
            : 0,
      });
      if (artifactKey) {
        try {
          await chrome.storage.session.remove(["lastFullpageError"]);
        } catch (error) {
          // Ignore session storage cleanup failures.
        }
        const viewerUrl = new URL(
          chrome.runtime.getURL("popup/screenshot_viewer.html")
        );
        viewerUrl.searchParams.set("artifactKey", artifactKey);
        await chrome.tabs.create({ url: viewerUrl.toString() });
      } else {
        setStatusMessage(
          "Full page capture failed. Try again, or use Snap.",
          "error"
        );
      }
    } catch (error) {
      const message = getFullpageUserMessage(error);
      setStatusMessage(message, "error");
      console.warn("[CAPTURE][SW][FULL_FAILED]", {
        message,
        stage: error && error.stage ? error.stage : "unknown",
        code: error && error.code ? error.code : null,
        details: error && error.details ? error.details : null,
      });
      try {
        await chrome.storage.session.set({ lastFullpageError: message });
      } catch (storageError) {
        // Ignore session storage failures.
      }
    }
  }
}

async function stabilizeFullpageCapture(tabId) {
  console.log("[FULLPAGE][STABILIZE][START]");
  try {
    await callFullpageCapture(tabId, "scrollToFullpagePosition", [0]);
  } catch (error) {
    // Ignore if scroll-to-top fails.
  }
  let previous = null;
  let stable = false;
  for (let attempt = 0; attempt <= FULLPAGE_STABILIZE_MAX_RETRIES; attempt += 1) {
    const sample = await callFullpageCapture(
      tabId,
      "sampleFullpageMetrics",
      [FULLPAGE_STABILIZE_SETTLE_MS]
    );
    if (sample && sample.ok && sample.state) {
      const state = sample.state;
      console.log("[FULLPAGE][STABILIZE][METRICS_SAMPLE]", {
        scrollHeight: state.scrollHeight,
        clientHeight: state.clientHeight,
        scrollTop: state.scrollTop,
      });
      if (
        previous &&
        (previous.scrollHeight !== state.scrollHeight ||
          previous.clientHeight !== state.clientHeight)
      ) {
        console.log("[FULLPAGE][STABILIZE][CHANGED]", {
          beforeHeight: previous.scrollHeight,
          afterHeight: state.scrollHeight,
          beforeClientHeight: previous.clientHeight,
          afterClientHeight: state.clientHeight,
        });
      } else if (previous) {
        stable = true;
        break;
      }
      previous = state;
    } else {
      break;
    }
  }
  console.log("[FULLPAGE][STABILIZE][READY]", { stable });
  return previous;
}

async function captureFullPageScreenshotOnce(requestedTabId, attemptIndex = 0) {
  const sessionActive =
    session && (session.state === "capturing" || session.state === "paused");
  const triggerTimestampIso = nowIso();
  const triggerTms = computeSessionOffsetMs(triggerTimestampIso);
  const activeTabId =
    sessionActive && session.active_tab ? session.active_tab.tab_id : null;
  const tab = requestedTabId
    ? await chrome.tabs.get(requestedTabId)
    : activeTabId
      ? await chrome.tabs.get(activeTabId)
      : await getActiveTab();
  let tileCountCaptured = 0;
  let tileCountCommitted = 0;
  let tileCountFailed = 0;
  let lastArtifactKey = null;
  let tileCountExpected = 0;
  let failureStage = "init";
  let lastPageHeight = null;
  let lastScrollContainerKey = null;
  if (!tab || !tab.id) {
    const error = new Error("No active tab available.");
    error.code = "RESTRICTED_PAGE";
    throw error;
  }
  const isPdf = /\.pdf(\?|#|$)/i.test(tab.url || "");
  if (!tab.url || !/^https?:/i.test(tab.url) || isPdf) {
    const error = new Error(
      isPdf
        ? "Full capture isn’t supported on PDFs. Open a regular website tab and try again."
        : "Not supported on this page."
    );
    error.code = "RESTRICTED_PAGE";
    throw error;
  }
  ensureTabIsCapturable(tab);
  const tabId = tab && tab.id ? tab.id : null;
  if (!tabId) {
    const error = new Error("No active tab available.");
    error.code = "RESTRICTED_PAGE";
    throw error;
  }
  setStatusMessage("Capturing full page… please don’t scroll.", "info");
  if (!chrome.scripting || !chrome.scripting.executeScript) {
    const error = new Error("Scripting API unavailable for full page capture.");
    error.code = "INJECT_FAILED";
    throw error;
  }
  let restoreNeeded = false;
  let scrollbarsHidden = false;
  let metrics = null;
  let windowId = tab.windowId || null;
  let scriptLoaded = false;
  const captureRunId = `full_${Date.now()}`;
  try {
    console.log("[FULLPAGE_PROBE]", { tabId, url: tab.url });
    failureStage = "inject";
    scriptLoaded = await isFullpageCaptureLoaded(tabId);
    if (!scriptLoaded) {
      console.log("[FULLPAGE_INJECT]", { tabId });
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content/fullpage_capture.js"],
      });
      scriptLoaded = await isFullpageCaptureLoaded(tabId);
    }
    if (!scriptLoaded) {
      const err = new Error("Fullpage capture helper failed to load.");
      err.code = "FULLPAGE_ERR_INJECT";
      throw err;
    }
    scrollbarsHidden = await hideScrollbarsForCapture(tabId);
    failureStage = "prepare";
    const applyRes = await callFullpageCapture(tabId, "prepareFullpageCapture", [
      captureRunId,
    ]);
    if (!applyRes || applyRes.ok === false) {
      const err = new Error(applyRes?.error || "Failed to prepare page.");
      err.code = applyRes?.code || "FULLPAGE_ERR_PREPARE";
      throw err;
    }
    restoreNeeded = true;
    console.log("[FULLPAGE_PREPARE]", { captureRunId });
    if (DEBUG_FULLPAGE) {
      const nestedInit = await callFullpageCapture(
        tabId,
        "getNestedScrollDiagnostics"
      );
      console.log("[FULLPAGE][NESTED_SCROLL_INIT]", nestedInit || null);
    }
    const candidatesRes = await callFullpageCapture(
      tabId,
      "getScrollableCandidates"
    );
    if (candidatesRes && candidatesRes.ok && candidatesRes.length) {
      console.log("[FULLPAGE_SCROLL_CANDIDATES]", {
        candidates: candidatesRes.map((candidate) => ({
          key: candidate.key,
          type: candidate.type,
          scrollHeight: candidate.scrollHeight,
          clientHeight: candidate.clientHeight,
          canScroll: candidate.canScroll,
        })),
      });
    }
    failureStage = "stabilize";
    await stabilizeFullpageCapture(tabId);
    failureStage = "metrics";
    const metricsRes = await callFullpageCapture(tabId, "getFullpageMetrics");
    if (metricsRes && metricsRes.ok === false) {
      const err = new Error(metricsRes.error || "Unable to read page metrics.");
      err.code = metricsRes.code || "FULLPAGE_ERR_METRICS";
      throw err;
    }
    metrics = metricsRes && metricsRes.metrics ? metricsRes.metrics : null;
    if (!metrics) {
      const err = new Error("Unable to read page metrics.");
      err.code = "FULLPAGE_ERR_METRICS";
      throw err;
    }
    console.log("[FULLPAGE_METRICS]", metrics);
    const {
      scrollHeight,
      clientHeight,
      clientWidth,
      devicePixelRatio = 1,
      scrollTop = 0,
      selectedKey,
      selectedType,
    } = metrics;
    const viewportHeight =
      typeof clientHeight === "number" && clientHeight > 0
        ? clientHeight
        : metrics.innerHeight;
    const viewportWidth =
      typeof clientWidth === "number" && clientWidth > 0
        ? clientWidth
        : metrics.innerWidth;
    if (!scrollHeight || !viewportHeight || !viewportWidth) {
      const err = new Error("Invalid page metrics for full capture.");
      err.code = "FULLPAGE_ERR_METRICS";
      throw err;
    }
    console.log("[FULLPAGE_SCROLL_SELECTED]", {
      key: selectedKey || "unknown",
      type: selectedType || "unknown",
    });
    const initialState = await callFullpageCapture(tabId, "getFullpagePageState");
    if (initialState && initialState.ok && initialState.state) {
      const state = initialState.state;
      console.log("[FULLPAGE][PAGE_STATE]", {
        scrollHeight: state.scrollHeight,
        clientHeight: state.clientHeight,
        scrollTop: state.scrollTop,
        overflowY: state.overflowY,
        bodyOverflowY: state.bodyOverflowY,
      });
      console.log("[FULLPAGE][SCROLL_CONTAINER]", {
        key: state.key || "unknown",
        type: state.type || "unknown",
      });
      lastPageHeight = state.scrollHeight;
      lastScrollContainerKey = state.key || null;
    }
    const maxScrollY = Math.max(0, scrollHeight - viewportHeight);
    const positions = [];
    for (let y = 0; y <= maxScrollY; y += viewportHeight) {
      positions.push(y);
    }
    if (positions.length === 0 || positions[positions.length - 1] !== maxScrollY) {
      positions.push(maxScrollY);
    }
    const totalTiles = positions.length;
    tileCountExpected = totalTiles;
    const totalWidthPx = Math.ceil(viewportWidth * devicePixelRatio);
    const totalHeightPx = Math.ceil(scrollHeight * devicePixelRatio);
    console.log("[FULLPAGE][PLAN]", {
      pageHeight: scrollHeight,
      viewportHeight,
      devicePixelRatio,
      totalWidthPx,
      totalHeightPx,
      tileCountExpected: totalTiles,
    });
    const frozenViewportHeight = viewportHeight;
    if (totalTiles > FULLPAGE_LIMITS.maxTiles) {
      const err = new Error("Page too tall for full capture.");
      err.code = "FULLPAGE_ERR_TOO_TALL";
      throw err;
    }
    const maxAllowedHeightByPixels = Math.floor(
      FULLPAGE_LIMITS.maxCanvasPixels / Math.max(1, totalWidthPx)
    );
    const maxAllowedHeightPx = Math.min(
      FULLPAGE_LIMITS.maxCanvasEdge,
      maxAllowedHeightByPixels
    );
    let policyReason = "allowed";
    let policyAllowed = true;
    if (totalWidthPx > FULLPAGE_LIMITS.maxCanvasEdge) {
      policyAllowed = false;
      policyReason = "max_canvas_edge_width";
    } else if (totalHeightPx > FULLPAGE_LIMITS.maxCanvasEdge) {
      policyAllowed = false;
      policyReason = "max_canvas_edge_height";
    } else if (totalHeightPx > maxAllowedHeightByPixels) {
      policyAllowed = false;
      policyReason = "max_canvas_pixels";
    }
    console.log("[FULLPAGE][POLICY]", {
      maxAllowedHeightPx,
      reason: policyReason,
      allowed: policyAllowed,
    });
    if (!policyAllowed) {
      const err = new Error("Page too tall for full capture.");
      err.code = "FULLPAGE_ERR_TOO_TALL";
      throw err;
    }
    const runRecord = {
      captureRunId,
      tabId,
      url: tab.url || null,
      status: "capturing",
      devicePixelRatio,
      totalWidthPx,
      totalHeightPx,
      viewportWidthPx: Math.ceil(viewportWidth * devicePixelRatio),
      viewportHeightPx: Math.ceil(viewportHeight * devicePixelRatio),
      tileCountExpected: totalTiles,
      tileCountCaptured: 0,
      tileCountCommitted: 0,
      tileCountFailed: 0,
      coveragePercent: 0,
      partialArtifactKey: null,
      finalArtifactKey: null,
      isPartial: false,
      failureReason: null,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveCaptureRun(runRecord);
    console.log("[FULLPAGE][SW][RUN_CREATED]", {
      captureRunId,
      tabId,
      url: tab.url || null,
      tileCountExpected: totalTiles,
    });
    console.log("[FULLPAGE][CAPTURE][START]", {
      captureRunId,
      tileCountExpected: totalTiles,
    });
    failureStage = "offscreen";
    try {
      await ensureOffscreenReady();
    } catch (error) {
      const err = new Error("Full page capture failed. Try Snap instead.");
      err.code = "FULLPAGE_ERR_OFFSCREEN";
      throw err;
    }
    // Avoid forcing window focus; capture should not jump windows.
    console.log("[FULLPAGE_CAPTURE]", { total: totalTiles, attempt: attemptIndex });
    sendFullPageProgress("capture", 0, totalTiles);
    let prevY = null;
    let prevBottomPx = null;
    let currentScroll = scrollTop;
    failureStage = "capture_tiles";
    for (let i = 0; i < positions.length; i += 1) {
      const isLastTile = i === positions.length - 1;
      let plannedScrollTop = positions[i];
      sendFullPageProgress("capture", i + 1, totalTiles);
      const preState = await callFullpageCapture(tabId, "getFullpagePageState");
      let preScrollHeight = scrollHeight;
      let preClientHeight = viewportHeight;
      if (preState && preState.ok && preState.state) {
        const state = preState.state;
        preScrollHeight = state.scrollHeight;
        preClientHeight = state.clientHeight;
        console.log("[FULLPAGE][PAGE_STATE]", {
          scrollHeight: state.scrollHeight,
          clientHeight: state.clientHeight,
          scrollTop: state.scrollTop,
        });
      }
      if (Math.abs(preClientHeight - frozenViewportHeight) > FULLPAGE_VIEWPORT_TOLERANCE_PX) {
        const err = new Error("Viewport height changed during capture.");
        err.code = "FULLPAGE_ERR_VIEWPORT_CHANGED";
        throw err;
      }
      const preMaxScrollTop = Math.max(0, preScrollHeight - preClientHeight);
      const clampedScrollTop = Math.min(plannedScrollTop, preMaxScrollTop);
      let scrollRes = null;
      for (let attempt = 0; attempt <= FULLPAGE_TILE_STABILITY_RETRIES; attempt += 1) {
        scrollRes = await callFullpageCapture(tabId, "captureTileWithStability", [
          clampedScrollTop,
          FULL_CAPTURE_CONFIG.postScrollDelayMs,
        ]);
        if (DEBUG_FULLPAGE) {
          const diagnostics = scrollRes ? scrollRes.diagnostics : null;
          console.log("[FULLPAGE][SCROLL_STABILITY]", {
            tileIndex: i + 1,
            attempt,
            targetScrollY_css: Math.round(clampedScrollTop),
            actualScrollY_after_scroll_css:
              diagnostics && typeof diagnostics.after === "number"
                ? Math.round(diagnostics.after)
                : null,
            actualScrollY_after_raf1_css:
              diagnostics && typeof diagnostics.afterRaf1 === "number"
                ? Math.round(diagnostics.afterRaf1)
                : null,
            actualScrollY_after_raf2_css:
              diagnostics && typeof diagnostics.afterRaf2 === "number"
                ? Math.round(diagnostics.afterRaf2)
                : null,
            viewportWidth_css: Math.round(viewportWidth),
            viewportHeight_css: Math.round(viewportHeight),
            documentHeight_css: Math.round(scrollHeight),
            devicePixelRatio,
            ok: scrollRes ? scrollRes.ok : false,
            scrollY: scrollRes ? Math.round(scrollRes.scrollY || 0) : null,
            stability: scrollRes ? scrollRes.stability : null,
          });
        }
        if (scrollRes && scrollRes.ok) {
          break;
        }
        await delay(40);
      }
      if (!scrollRes || scrollRes.ok === false) {
        const err = new Error(scrollRes?.error || "Scroll mismatch.");
        err.code = scrollRes?.code || "FULLPAGE_ERR_SCROLL_MISMATCH";
        throw err;
      }
      let actualY =
        scrollRes && typeof scrollRes.scrollY === "number"
          ? scrollRes.scrollY
          : null;
      const pageState = await callFullpageCapture(tabId, "getFullpagePageState");
      let tileScrollHeight = preScrollHeight;
      let tileClientHeight = preClientHeight;
      let reportedScrollTop = actualY;
      if (pageState && pageState.ok && pageState.state) {
        const state = pageState.state;
        tileScrollHeight = state.scrollHeight;
        tileClientHeight = state.clientHeight;
        reportedScrollTop =
          typeof actualY === "number" ? actualY : state.scrollTop;
        if (typeof actualY !== "number") {
          actualY = state.scrollTop;
        }
        console.log("[FULLPAGE][PAGE_STATE]", {
          scrollHeight: state.scrollHeight,
          clientHeight: state.clientHeight,
          scrollTop: state.scrollTop,
        });
        if (
          typeof lastPageHeight === "number" &&
          state.scrollHeight !== lastPageHeight
        ) {
          console.log("[FULLPAGE][LAYOUT_CHANGE]", {
            beforeHeight: lastPageHeight,
            afterHeight: state.scrollHeight,
          });
          lastPageHeight = state.scrollHeight;
        }
        if (
          state.key &&
          lastScrollContainerKey &&
          state.key !== lastScrollContainerKey
        ) {
          console.log("[FULLPAGE][SCROLL_CONTAINER]", {
            key: state.key,
            type: state.type || "unknown",
          });
          lastScrollContainerKey = state.key;
        }
      }
      const maxScrollTopNow = Math.max(0, tileScrollHeight - tileClientHeight);
      const belowPlanned =
        typeof actualY === "number" &&
        actualY < clampedScrollTop - SCROLL_TOLERANCE_PX;
      const treatedAsBottom =
        typeof actualY === "number" &&
        actualY >= maxScrollTopNow - SCROLL_TOLERANCE_PX;
      console.log("[FULLPAGE][TILE_VALIDATION]", {
        tileIndex: i + 1,
        plannedScrollTop: Math.round(plannedScrollTop),
        clampedScrollTop: Math.round(clampedScrollTop),
        actualScrollTop:
          typeof actualY === "number" ? Math.round(actualY) : null,
        maxScrollTop: Math.round(maxScrollTopNow),
        tolerancePx: SCROLL_TOLERANCE_PX,
      });
      if (clampedScrollTop === maxScrollTopNow || treatedAsBottom) {
        console.log("[FULLPAGE][LAST_TILE_MODE]", {
          tileIndex: i + 1,
          actualScrollTop:
            typeof actualY === "number" ? Math.round(actualY) : null,
          maxScrollTop: Math.round(maxScrollTopNow),
          treatedAsBottom,
        });
      }
      if (actualY === null || (belowPlanned && !treatedAsBottom)) {
        const retryTarget = Math.min(clampedScrollTop, maxScrollTopNow);
        const retry = await callFullpageCapture(
          tabId,
          "captureTileWithStability",
          [retryTarget, FULL_CAPTURE_CONFIG.postScrollDelayMs]
        );
        if (DEBUG_FULLPAGE) {
          console.log("[FULLPAGE][SCROLL_STABILITY][RETRY]", {
            tileIndex: i + 1,
            targetScrollTop: Math.round(retryTarget),
            ok: retry ? retry.ok : false,
            scrollY: retry ? Math.round(retry.scrollY || 0) : null,
            diagnostics: retry ? retry.diagnostics : null,
            stability: retry ? retry.stability : null,
          });
        }
        const retryY =
          retry && typeof retry.scrollY === "number" ? retry.scrollY : null;
        const retryState = await callFullpageCapture(
          tabId,
          "getFullpagePageState"
        );
        let retryScrollTop = retryY;
        let retryMaxScrollTop = maxScrollTopNow;
        if (retryState && retryState.ok && retryState.state) {
          const state = retryState.state;
          retryMaxScrollTop = Math.max(
            0,
            state.scrollHeight - state.clientHeight
          );
          if (typeof retryScrollTop !== "number") {
            retryScrollTop = state.scrollTop;
          }
          console.log("[FULLPAGE][PAGE_STATE]", {
            scrollHeight: state.scrollHeight,
            clientHeight: state.clientHeight,
            scrollTop: state.scrollTop,
          });
        }
        const retryBelowPlanned =
          typeof retryScrollTop === "number" &&
          retryScrollTop < retryTarget - SCROLL_TOLERANCE_PX;
        const retryTreatedAsBottom =
          typeof retryScrollTop === "number" &&
          retryScrollTop >= retryMaxScrollTop - SCROLL_TOLERANCE_PX;
        if (retryScrollTop === null || (retryBelowPlanned && !retryTreatedAsBottom)) {
          const err = new Error(
            "Page prevented scrolling (likely modal/overflow lock)."
          );
          err.code =
            currentScroll === retryScrollTop
              ? "FULLPAGE_ERR_SCROLL_LOCKED"
              : "FULLPAGE_ERR_SCROLL_MISMATCH";
          throw err;
        }
        actualY = retryScrollTop;
        reportedScrollTop = retryScrollTop;
      }
      currentScroll = actualY;
      plannedScrollTop = clampedScrollTop;
      let nestedBefore = null;
      if (DEBUG_FULLPAGE) {
        nestedBefore = await callFullpageCapture(tabId, "getNestedScrollDiagnostics");
        console.log("[FULLPAGE][NESTED_SCROLL_DIAG]", {
          tileIndex: i + 1,
          phase: "before",
          diagnostics: nestedBefore || null,
        });
        console.log("[FULLPAGE][STICKY_SUPPRESS_STATE]", {
          tileIndex: i + 1,
          enabled: i > 0 && totalTiles > 1,
        });
      }
      const effectiveViewportHeight = frozenViewportHeight;
      const effectiveScrollTop =
        typeof reportedScrollTop === "number" ? reportedScrollTop : plannedScrollTop;
      let clipTop = 0;
      if (prevY !== null) {
        const overlap = prevY + effectiveViewportHeight - effectiveScrollTop;
        if (overlap > 0) {
          clipTop = overlap;
        }
      }
      const remainingHeight = tileScrollHeight - effectiveScrollTop;
      const baseCropHeight = Math.min(effectiveViewportHeight, remainingHeight);
      const clipHeight = Math.max(0, baseCropHeight - clipTop);
      const expectedWidthPx = Math.ceil(viewportWidth * devicePixelRatio);
      const expectedHeightPx = Math.ceil(effectiveViewportHeight * devicePixelRatio);
      const rawClipTopPx = Math.round(clipTop * devicePixelRatio);
      const rawClipHeightPx = Math.round(clipHeight * devicePixelRatio);
      let dataUrl = null;
      let captureDims = null;
      let tileValidationResult = null;
      let seamGapResult = null;
      let clipHeightPx = rawClipHeightPx;
      try {
        for (let attempt = 0; attempt <= FULLPAGE_TILE_CAPTURE_RETRIES; attempt += 1) {
          dataUrl = await captureVisibleTabThrottled(windowId, {
            minIntervalMs: FULL_CAPTURE_CONFIG.minCaptureIntervalMs,
            maxRetries: FULL_CAPTURE_CONFIG.maxRetriesPerShot,
          });
          if (!dataUrl || !dataUrl.startsWith("data:image/png")) {
            continue;
          }
          captureDims = readPngDimensionsFromDataUrl(dataUrl);
          const dimensionValidation = validateCapturedTileDimensions({
            captureDims,
            expectedWidthPx,
            expectedHeightPx,
          });
          const cropValidation = validateTileCropBounds({
            captureDims,
            clipTopPx: rawClipTopPx,
            clipHeightPx: rawClipHeightPx,
          });
          if (cropValidation.ok && cropValidation.adjusted) {
            clipHeightPx = cropValidation.adjustedHeightPx;
          } else {
            clipHeightPx = rawClipHeightPx;
          }
          let reason = null;
          if (!dimensionValidation.ok) {
            reason = dimensionValidation.reason || "dimension_mismatch";
          } else if (!cropValidation.ok) {
            reason = cropValidation.reason || "crop_invalid";
          }
          tileValidationResult = {
            ok: dimensionValidation.ok && cropValidation.ok,
            reason,
            dimension: dimensionValidation,
            crop: cropValidation,
          };
          const destYpx =
            Math.round(effectiveScrollTop * devicePixelRatio) + rawClipTopPx;
          seamGapResult = null;
          if (typeof prevBottomPx === "number") {
            const gapPx = Math.round(destYpx - prevBottomPx);
            seamGapResult = {
              ok: gapPx <= FULLPAGE_SEAM_TOLERANCE_PX,
              prevBottom: Math.round(prevBottomPx),
              destY: Math.round(destYpx),
              gapPx,
            };
            if (gapPx > FULLPAGE_SEAM_TOLERANCE_PX) {
              tileValidationResult.ok = false;
              tileValidationResult.reason = "seam_gap";
              tileValidationResult.seamGap = seamGapResult;
            }
          }
          if (tileValidationResult.ok) {
            break;
          }
          if (DEBUG_FULLPAGE) {
            console.log("[FULLPAGE][TILE_VALIDATION]", {
              tileIndex: i + 1,
              attempt,
              expectedWidthPx,
              expectedHeightPx,
              captureDims,
              result: tileValidationResult,
              seamGapResult,
            });
            if (seamGapResult && !seamGapResult.ok) {
              console.log("[FULLPAGE][SEAM_GAP_RETRY]", {
                tileIndex: i + 1,
                retryAttempt: attempt,
                prevBottom: seamGapResult.prevBottom,
                destY: seamGapResult.destY,
                gapPx: seamGapResult.gapPx,
              });
            }
          }
          if (attempt < FULLPAGE_TILE_CAPTURE_RETRIES) {
            await delay(80);
          }
        }
        if (i === 0 && totalTiles > 1) {
          try {
            const suppressRes = await callFullpageCapture(
              tabId,
              "suppressFixedStickyElements"
            );
            if (DEBUG_FULLPAGE) {
              console.log("[FULLPAGE][STICKY_SUPPRESS]", {
                tileIndex: i + 1,
                count: suppressRes ? suppressRes.count : 0,
              });
            }
          } catch (error) {
            console.warn("[FULLPAGE] Failed to suppress sticky elements", error);
          }
        }
      } catch (error) {
        const err = new Error(
          error && error.message
            ? `captureVisibleTab failed: ${error.message}`
            : "captureVisibleTab failed."
        );
        err.code = "FULLPAGE_ERR_CAPTURE_VISIBLE_TAB";
        throw err;
      }
      await delay(FULL_CAPTURE_CONFIG.minCaptureIntervalMs);
      if (!dataUrl || !dataUrl.startsWith("data:image/png")) {
        const err = new Error("captureVisibleTab returned invalid data.");
        err.code = "FULLPAGE_ERR_CAPTURE_VISIBLE_TAB";
        throw err;
      }
      if (!tileValidationResult || tileValidationResult.ok !== true) {
        const err = new Error("Captured tile dimensions invalid.");
        err.code = "FULLPAGE_ERR_TILE_INVALID";
        err.details = tileValidationResult;
        throw err;
      }
      if (DEBUG_FULLPAGE) {
        console.log("[FULLPAGE][CAPTURE_IMAGE]", {
          tileIndex: i + 1,
          capturedImageWidth_device: captureDims ? captureDims.width : null,
          capturedImageHeight_device: captureDims ? captureDims.height : null,
          expectedWidth_device: expectedWidthPx,
          expectedHeight_device: expectedHeightPx,
          dataUrlBytes: dataUrl.length,
          tileValidationResult,
          seamGapResult,
        });
        const nestedAfter = await callFullpageCapture(
          tabId,
          "getNestedScrollDiagnostics"
        );
        console.log("[FULLPAGE][NESTED_SCROLL_DIAG]", {
          tileIndex: i + 1,
          phase: "after",
          diagnostics: nestedAfter || null,
        });
      }
      const clipTopPx = rawClipTopPx;
      console.log("[FULLPAGE][CROP_RECALC]", {
        tileIndex: i + 1,
        scrollHeight: Math.round(tileScrollHeight),
        clientHeight: Math.round(effectiveViewportHeight),
        actualScrollTop: Math.round(effectiveScrollTop),
        remainingHeight: Math.round(remainingHeight),
        cropHeight: Math.round(clipHeight),
        cropHeightPx: clipHeightPx,
      });
      console.log("[FULLPAGE][TILE]", {
        tileIndex: i + 1,
        plannedScrollTop: Math.round(plannedScrollTop),
        clampedScrollTop: Math.round(clampedScrollTop),
        actualScrollTop:
          typeof reportedScrollTop === "number"
            ? Math.round(reportedScrollTop)
            : null,
        maxScrollTop: Math.round(maxScrollTopNow),
        scrollHeight: Math.round(tileScrollHeight),
        cropHeight: Math.round(clipHeight),
        remainingHeight: Math.round(remainingHeight),
        drawY_used_for_stitch: Math.round(
          Math.round(effectiveScrollTop * devicePixelRatio) + clipTopPx
        ),
        cropSourceY_device: clipTopPx,
        cropHeight_device: clipHeightPx,
        nestedScrollerCount: nestedBefore && typeof nestedBefore.count === "number"
          ? nestedBefore.count
          : 0,
        nestedScrollerOffsetsSummary:
          nestedBefore && nestedBefore.samples ? nestedBefore.samples : null,
        tileValidationResult,
        seamGapResult,
      });
      if (remainingHeight <= 0) {
        if (treatedAsBottom) {
          if (tileCountCaptured === tileCountExpected - 1) {
            tileCountExpected = tileCountCaptured;
          }
          console.log("[FULLPAGE][LAST_TILE_MODE]", {
            tileIndex: i + 1,
            actualScrollTop: Math.round(effectiveScrollTop),
            maxScrollTop: Math.round(maxScrollTopNow),
            treatedAsBottom: true,
          });
          break;
        }
        prevY = effectiveScrollTop;
        continue;
      }
      if (clipHeight <= 0) {
        prevY = effectiveScrollTop;
        continue;
      }
      // V1 LOCKED: keep rounding consistent for y/clipTop/clipHeight to avoid
      // stitch seams across tiles (short + long pages).
      const tileMeta = {
        scrollY: Math.round(effectiveScrollTop),
        y: Math.round(effectiveScrollTop * devicePixelRatio),
        width: captureDims && captureDims.width ? captureDims.width : expectedWidthPx,
        height: captureDims && captureDims.height ? captureDims.height : expectedHeightPx,
        clipTop: clipTopPx,
        clipHeight: clipHeightPx,
      };
      const tileIndex = i + 1;
      const blob = dataUrlToBlob(dataUrl);
      await persistCaptureTile({
        captureRunId,
        tileIndex,
        tile: tileMeta,
        blob,
      });
      prevBottomPx =
        Math.round(effectiveScrollTop * devicePixelRatio) + clipTopPx + clipHeightPx;
      tileCountCaptured += 1;
      tileCountCommitted += 1;
      console.log("[FULLPAGE][CAPTURE][TILE_SUCCESS]", {
        captureRunId,
        tileIndex,
      });
      const coveragePercent = totalTiles
        ? Math.min(100, Math.round((tileCountCommitted / totalTiles) * 100))
        : 0;
      await updateCaptureRun(captureRunId, {
        tileCountCaptured,
        tileCountCommitted,
        tileCountFailed,
        coveragePercent,
      });
      console.log("[FULLPAGE][SW][TILE_COMMITTED]", {
        captureRunId,
        tileIndex,
        tileCountCommitted,
        tileCountExpected: totalTiles,
      });
      try {
        const partial = await composeFullpageArtifact(captureRunId, false);
        if (partial && partial.artifactKey) {
          lastArtifactKey = partial.artifactKey;
          await updateCaptureRun(captureRunId, {
            partialArtifactKey: partial.artifactKey,
            coveragePercent: partial.coveragePercent,
            status: "capturing",
            updatedAt: Date.now(),
          });
          console.log("[FULLPAGE][SW][PARTIAL_ARTIFACT_SAVED]", {
            captureRunId,
            artifactKey: partial.artifactKey,
            coveragePercent: partial.coveragePercent,
            completedThroughTile: partial.completedThroughTile,
          });
        }
      } catch (error) {
        // Partial compose failure should not abort capture.
      }
      prevY = effectiveScrollTop;
    }
    await loadTimestampOverlaySetting();
    const overlayText = (() => {
      if (!timestampOverlayEnabled) {
        return null;
      }
      const nowMs = Date.now();
      const elapsedMs = computeRecordingElapsedMs(nowMs);
      let text = formatOverlayTimestamp(new Date(nowMs));
      if (typeof elapsedMs === "number") {
        const elapsedText = formatElapsedMs(elapsedMs);
        if (elapsedText) {
          text += ` • +${elapsedText}`;
        }
      }
      return text;
    })();
    if (overlayText) {
      await updateCaptureRun(captureRunId, { overlayText });
    }
    if (tileCountCommitted === 0) {
      const err = new Error("Full page capture failed. No tiles captured.");
      err.code = "FULLPAGE_ERR_STITCH";
      throw err;
    }
    failureStage = "compose_final";
    console.log("[FULLPAGE][CAPTURE][FINALIZE_START]", { captureRunId });
    const finalArtifact = await composeFullpageArtifact(captureRunId, true);
    if (!finalArtifact || !finalArtifact.artifactKey) {
      const err = new Error("Full page capture failed. Missing artifact.");
      err.code = "FULLPAGE_ERR_STITCH";
      throw err;
    }
    await updateCaptureRun(captureRunId, {
      status: "complete",
      finalArtifactKey: finalArtifact.artifactKey || null,
      isPartial: false,
      coveragePercent: finalArtifact.coveragePercent || 100,
      updatedAt: Date.now(),
    });
    const finalRun = await ReproIdb.getByKey("capture_runs", captureRunId);
    const finalFailedCount =
      finalRun && typeof finalRun.tileCountFailed === "number"
        ? finalRun.tileCountFailed
        : tileCountFailed;
    console.log("[FULLPAGE][SW][FINAL_ARTIFACT_SAVED]", {
      captureRunId,
      artifactKey: finalArtifact.artifactKey,
      size: finalArtifact.byteLength || null,
      coveragePercent: finalArtifact.coveragePercent,
    });
    try {
      if (
        globalThis.ReportStepTracker &&
        typeof globalThis.ReportStepTracker.recordScreenshotEvent === "function"
      ) {
        const createdAt = nowIso();
        const fileName = `${finalArtifact.artifactKey}.png`;
        globalThis.ReportStepTracker.recordScreenshotEvent(
          {
            kind: "screenshot",
            filename: fileName,
            relativePath: `screenshots/${fileName}`,
            mimeType: "image/png",
            size: finalArtifact.byteLength || null,
            createdAt,
          },
          {
            url: session && session.active_tab ? session.active_tab.url : "",
            title: session && session.active_tab ? session.active_tab.title : "",
            timestamp: createdAt,
            captureMode: "fullpage",
          }
        );
      }
    } catch (error) {
      // Report tracking is optional; ignore failures.
    }
    console.log("[FULLPAGE][CAPTURE][FINALIZE_SUCCESS]", {
      captureRunId,
      artifactKey: finalArtifact.artifactKey,
    });
    console.log("[FULLPAGE][SW][RUN_FINALIZED]", {
      captureRunId,
      status: "complete",
      isPartial: false,
      failureReason: null,
      tileCountCaptured,
      tileCountExpected,
    });
    setStatusMessage("Full page screenshot captured.", "success");
    if (session && session.mode === "session" && !session.lightweight) {
      const timestampIso = nowIso();
      const tMs = computeSessionOffsetMs(timestampIso);
      const index = session.screenshots.length + 1;
      const fileName = `debugduck-screenshot-fullpage-${String(index).padStart(
        3,
        "0"
      )}.png`;
      session.screenshots.push({
        index,
        timestampIso,
        t_ms: tMs,
        fileName,
        fullPage: true,
        artifactKey: finalArtifact.artifactKey,
      });
    }
    return {
      status: "complete",
      captureRunId,
      artifactKey: finalArtifact.artifactKey,
      isPartial: false,
      coveragePercent: finalArtifact.coveragePercent || 100,
      tileCountCaptured,
      tileCountExpected,
      tileCountFailed: finalFailedCount,
    };
  } catch (error) {
    tileCountFailed += 1;
    if (error && typeof error === "object") {
      error.stage = failureStage;
    }
    const hasPartial = tileCountCommitted > 0;
    const code = error && error.code ? error.code : null;
    const allowPartial =
      hasPartial &&
      code !== "FULLPAGE_ERR_TILE_INVALID" &&
      code !== "FULLPAGE_ERR_INCOMPLETE" &&
      code !== "FULLPAGE_ERR_VIEWPORT_CHANGED";
    let artifactKey = allowPartial ? lastArtifactKey : null;
    if (allowPartial && !artifactKey) {
      try {
        failureStage = "compose_partial";
        const partial = await composeFullpageArtifact(captureRunId, false);
        artifactKey = partial.artifactKey || null;
      } catch (composeError) {
        artifactKey = null;
      }
    }
    console.log("[FULLPAGE][CAPTURE][FINALIZE_FAILURE]", {
      captureRunId,
      stage: failureStage || "unknown",
      message: error && error.message ? error.message : "Capture failed.",
    });
    console.log("[FULLPAGE][FINALIZE_FAILURE]", {
      stage: failureStage || "unknown",
      message: error && error.message ? error.message : "Capture failed.",
    });
    if (tabId) {
      const failureState = await callFullpageCapture(
        tabId,
        "getFullpagePageState"
      );
      if (failureState && failureState.ok && failureState.state) {
        const state = failureState.state;
        console.log("[FULLPAGE][PAGE_STATE]", {
          scrollHeight: state.scrollHeight,
          clientHeight: state.clientHeight,
          scrollTop: state.scrollTop,
          overflowY: state.overflowY,
          bodyOverflowY: state.bodyOverflowY,
        });
      }
    }
    if (allowPartial) {
      await updateCaptureRun(captureRunId, {
        status: "partial_complete",
        isPartial: true,
        failureReason: error && error.message ? error.message : "Capture failed.",
        partialArtifactKey: artifactKey,
        tileCountFailed,
      });
      const partialRun = await ReproIdb.getByKey("capture_runs", captureRunId);
      const partialFailedCount =
        partialRun && typeof partialRun.tileCountFailed === "number"
          ? partialRun.tileCountFailed
          : tileCountFailed;
      console.log("[FULLPAGE][SW][RUN_FINALIZED]", {
        captureRunId,
        status: "partial_complete",
        isPartial: true,
        failureReason: error && error.message ? error.message : "Capture failed.",
        tileCountCaptured,
        tileCountExpected,
      });
      if (artifactKey) {
        const expected =
          tileCountExpected || tileCountCommitted || tileCountCaptured || 0;
        const coveragePercent = expected
          ? Math.min(100, Math.round((tileCountCommitted / expected) * 100))
          : 0;
        const code = error && error.code ? error.code : null;
        const scrollBlocked =
          code === "FULLPAGE_ERR_SCROLL_LOCKED" ||
          code === "FULLPAGE_ERR_SCROLL_MISMATCH";
        const reasonText = scrollBlocked
          ? " — page prevented scrolling."
          : ".";
        setStatusMessage(
          `Partial full capture saved${reasonText} (${coveragePercent}% coverage)`,
          "success"
        );
      } else {
        setStatusMessage(getFullpageUserMessage(error), "error");
      }
      return {
        status: "partial_complete",
        captureRunId,
        artifactKey,
        isPartial: true,
        coveragePercent: (tileCountExpected || tileCountCommitted || tileCountCaptured)
          ? Math.min(
              100,
              Math.round(
                (tileCountCommitted /
                  (tileCountExpected || tileCountCommitted || tileCountCaptured)) *
                  100
              )
            )
          : 0,
        tileCountCaptured,
        tileCountExpected: tileCountExpected || tileCountCommitted || tileCountCaptured,
        tileCountFailed: partialFailedCount,
      };
    }
    await updateCaptureRun(captureRunId, {
      status: hasPartial ? "failed_incomplete" : "failed_before_first_tile",
      isPartial: false,
      failureReason: error && error.message ? error.message : "Capture failed.",
      tileCountFailed,
    });
    setStatusMessage(getFullpageUserMessage(error), "error");
    throw error;
  } finally {
    if (scrollbarsHidden) {
      await restoreScrollbarsAfterCapture(tabId);
    }
    if (restoreNeeded) {
      try {
        await callFullpageCapture(tabId, "restoreFullpagePageState");
        console.log("[FULLPAGE_RESTORE]", { tabId, captureRunId });
        const restoredState = await callFullpageCapture(
          tabId,
          "getFullpagePageState"
        );
        if (restoredState && restoredState.ok && restoredState.state) {
          const state = restoredState.state;
          console.log("[FULLPAGE][PAGE_STATE]", {
            scrollHeight: state.scrollHeight,
            clientHeight: state.clientHeight,
            scrollTop: state.scrollTop,
            overflowY: state.overflowY,
            bodyOverflowY: state.bodyOverflowY,
          });
        }
      } catch (error) {
        console.warn("[FULLPAGE] Failed to restore page state", error);
      }
      try {
        await callFullpageCapture(tabId, "resetFullpageCaptureState");
        console.log("[FULLPAGE_RESET]", { tabId, captureRunId });
      } catch (error) {
        console.warn("[FULLPAGE] Failed to reset page state", error);
      }
    }
  }
}

async function captureFullPageScreenshot(requestedTabId) {
  const maxAttempts = 2;
  let lastError = null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      if (attempt > 0) {
        setStatusMessage("Retrying full page capture…", "info");
      }
      return await captureFullPageScreenshotOnce(requestedTabId, attempt);
    } catch (error) {
      lastError = error;
      if (
        error &&
        error.code === "FULLPAGE_ERR_VIEWPORT_CHANGED" &&
        attempt < maxAttempts - 1
      ) {
        console.warn("[FULLPAGE][RETRY_VIEWPORT_CHANGED]", {
          attempt,
          message: error.message,
        });
        continue;
      }
      throw error;
    }
  }
  throw lastError || new Error("Full page capture failed.");
}

function applyTextAnnotations(ctx, annotations, dpr) {
  annotations.forEach((annotation) => {
    ctx.save();
    const opacity =
      typeof annotation.opacity === "number" ? annotation.opacity : 1;
    ctx.globalAlpha = opacity;
    const weight = annotation.weight === "Bold" ? "700" : annotation.weight || "400";
    const fontSize = typeof annotation.fontSize === "number" ? annotation.fontSize : 14;
    ctx.font = `${weight} ${fontSize * dpr}px ${annotation.fontFamily || "system-ui, Arial"}`;
    ctx.fillStyle = annotation.color || "#111827";
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 2 * dpr;
    ctx.strokeText(annotation.text || "", annotation.x * dpr, annotation.y * dpr);
    ctx.fillText(annotation.text || "", annotation.x * dpr, annotation.y * dpr);
    ctx.restore();
  });
}

async function startRecording(streamId, tabId, mimeType, options = {}) {
  // V1 STABLE: recording state orchestration (start).
  return await withRecordingTransitionLock("start", async () => {
    const tab = tabId ? await chrome.tabs.get(tabId) : await getActiveTab();
    ensureTabIsCapturable(tab);
    if (session) {
      throw new Error("A session already exists. Reset to start a new capture.");
    }
    if (recordingController.state !== "idle") {
      const message = "Recording is already active.";
      setStatusMessage(message, "info");
      logRecordingDiagnostic("start_rejected", {
        stateBefore: recordingController.state,
        errorPhase: "preflight",
        errorMessage: message,
      });
      return { ok: false, error: message };
    }

    setRecordingState("starting", { targetTabId: tab.id });
    recordingController.lastError = null;
    state.recording.error = null;
    logRecordingDiagnostic("start_begin", { stateBefore: "idle", stateAfter: "starting" });

    try {
      await ensureOffscreenReady();
      if (!streamId) {
        throw new Error("Missing stream id. Start recording from the popup.");
      }
      if (logsPanelTabId === tab.id && !isPanelClosed(tab.id, "logs")) {
        setPanelHiddenForCapture(tab.id, "logs", true);
        await setPanelOverlayHidden(tab.id, "logs", true);
      }
      const recordingSessionId = await createRecordingSessionRecord(tab.id, mimeType);
      state.recording.sessionId = recordingSessionId;
      recordingController.sessionId = recordingSessionId;
      recordingController.targetTabId = tab.id;
      console.log("[REC][sw] routing RECORDING_START to offscreen", {
        tabId: tab.id,
      });
      const response = await sendMessageToOffscreen({
        type: "RECORDING_START",
        tabId: tab.id,
        streamId,
        mimeType,
        sessionId: recordingSessionId,
      });

      if (!response.ok) {
        const errorMessage = response.error || "Failed to start recording.";
        setStatusMessage(errorMessage, "error");
        logRecordingDiagnostic("start_failed", {
          errorPhase: "offscreen_start",
          errorMessage,
        });
        await sendMessageToOffscreen({ type: "RECORDING_RESET" });
        throw new Error(errorMessage);
      }

      const sessionMode = options.sessionMode === "session" ? "session" : "recording";
      ensureSessionForMode(sessionMode, tab, {
        lightweight: sessionMode === "recording",
      });
      setSessionState("capturing");
      syncRecordingState(response, { targetTabId: tab.id });
      await updateRecordingSessionRecord(recordingSessionId, { status: "recording" });
      console.log("[RECORDING][STATE]", {
        from: "starting",
        to: "recording",
        sessionId: recordingSessionId,
      });
      state.recording.dataUrl = null;
      state.recording.capturedAt = null;
      state.recording.mimeType = null;
      state.recording.error = null;
      state.recording.hasData = false;
      state.recording.videoBlobUrl = null;
      state.recording.videoMime = null;
      state.recording.videoByteLength = null;
      if (state.recording.status === "recording") {
        if (typeof state.recording.videoStartEpochMs !== "number") {
          state.recording.videoStartEpochMs = Date.now();
        }
        state.recording.videoEndEpochMs = null;
      }
      recordingOverlayState.startMs =
        typeof state.recording.videoStartEpochMs === "number"
          ? state.recording.videoStartEpochMs
          : Date.now();
      recordingOverlayState.paused = false;
      recordingOverlayState.pauseStartedAt = null;
      recordingOverlayState.totalPausedMs = 0;
      recordingOverlayState.tabId = tab.id;
      await loadTimestampOverlaySetting();
      if (timestampOverlayEnabled) {
        await applyRecordingTimestampOverlay();
      }
      clearStatusMessage();
      logRecordingDiagnostic("start_ready", {
        stateBefore: "starting",
        stateAfter: recordingController.state,
      });
      return response;
    } catch (error) {
      const errorMessage = error && error.message ? error.message : "Failed to start recording.";
      setStatusMessage(errorMessage, "error");
      addDiagnostic("error", "Recording start failed.", {
        error: errorMessage,
      });
      recordingController.lastError = errorMessage;
      if (recordingController.state !== "idle") {
        setRecordingState("error", { errorMessage });
      }
      if (tab && tab.id && isPanelHiddenForCapture(tab.id, "logs")) {
        setPanelHiddenForCapture(tab.id, "logs", false);
        await setPanelOverlayHidden(tab.id, "logs", false);
      }
      setControlOpInFlight(false);
      logRecordingDiagnostic("start_error", {
        errorPhase: "start",
        errorMessage,
      });
      if (recordingController.state !== "idle") {
        setRecordingState("idle", { errorMessage });
      }
      throw error;
    }
  });
}

async function pauseRecording() {
  if (recordingController.state !== "recording") {
    throw new Error("Recording is not active.");
  }
  setControlOpInFlight(true);
  logRecordingDiagnostic("pause_begin", {
    stateBefore: recordingController.state,
  });
  const response = await sendMessageToOffscreen({ type: "RECORDING_PAUSE" });
  if (!response.ok) {
    logRecordingDiagnostic("pause_failed", {
      errorPhase: "offscreen_pause",
      errorMessage: response.error || "Failed to pause recording.",
    });
    setControlOpInFlight(false);
    throw new Error(response.error || "Failed to pause recording.");
  }
  setNetworkCaptureEnabled(false);
  syncRecordingState(response);
  if (state.recording.status === "paused") {
    setSessionState("paused");
  }
  if (state.recording.sessionId) {
    await updateRecordingSessionRecord(state.recording.sessionId, {
      status: "paused",
    });
    console.log("[RECORDING][STATE]", {
      from: "recording",
      to: "paused",
      sessionId: state.recording.sessionId,
    });
  }
  if (!recordingOverlayState.paused) {
    recordingOverlayState.paused = true;
    recordingOverlayState.pauseStartedAt = Date.now();
  }
  if (timestampOverlayEnabled) {
    await applyRecordingTimestampOverlay();
  }
  clearStatusMessage();
  setControlOpInFlight(false);
  return response;
}

async function resumeRecording() {
  if (recordingController.state !== "paused") {
    throw new Error("Recording is not paused.");
  }
  setControlOpInFlight(true);
  logRecordingDiagnostic("resume_begin", {
    stateBefore: recordingController.state,
  });
  const response = await sendMessageToOffscreen({ type: "RECORDING_RESUME" });
  if (!response.ok) {
    logRecordingDiagnostic("resume_failed", {
      errorPhase: "offscreen_resume",
      errorMessage: response.error || "Failed to resume recording.",
    });
    setControlOpInFlight(false);
    throw new Error(response.error || "Failed to resume recording.");
  }
  setNetworkCaptureEnabled(true);
  syncRecordingState(response);
  if (state.recording.status === "recording") {
    setSessionState("capturing");
  }
  if (state.recording.sessionId) {
    await updateRecordingSessionRecord(state.recording.sessionId, {
      status: "recording",
    });
    console.log("[RECORDING][STATE]", {
      from: "paused",
      to: "recording",
      sessionId: state.recording.sessionId,
    });
  }
  if (recordingOverlayState.paused && recordingOverlayState.pauseStartedAt) {
    recordingOverlayState.totalPausedMs +=
      Date.now() - recordingOverlayState.pauseStartedAt;
  }
  recordingOverlayState.paused = false;
  recordingOverlayState.pauseStartedAt = null;
  if (timestampOverlayEnabled) {
    await applyRecordingTimestampOverlay();
  }
  clearStatusMessage();
  setControlOpInFlight(false);
  return response;
}

async function stopRecording() {
  // V1 STABLE: stop/finalize flow; changes require retesting normal + fallback.
  return await withRecordingTransitionLock("stop", async () => {
    console.log("[REC][sw] STOP_REQUESTED");
    const recordingTabId = recordingOverlayState.tabId;
    if (state.recording.sessionId) {
      console.log("[RECORDING][STATE]", {
        from: state.recording.status || "unknown",
        to: "stopping",
        sessionId: state.recording.sessionId,
      });
    }
    if (["idle", "error", "stopped"].includes(recordingController.state)) {
      logRecordingDiagnostic("stop_noop", {
        stateBefore: recordingController.state,
        cleanupCompleted: true,
      });
      if (recordingOverlayState.tabId) {
        await removeTimestampOverlay(recordingOverlayState.tabId);
      }
      recordingOverlayState.startMs = null;
      recordingOverlayState.paused = false;
      recordingOverlayState.pauseStartedAt = null;
      recordingOverlayState.totalPausedMs = 0;
      recordingOverlayState.tabId = null;
      await restorePanelAfterRecording(recordingTabId);
      return { ok: true, alreadyStopped: true };
    }
    setControlOpInFlight(true);
    try {
      setRecordingState("stopping", { targetTabId: recordingTabId });
      if (session && session.mode === "session") {
        setSessionState("finalizing");
      }
      logRecordingDiagnostic("stop_begin", {
        stateBefore: "recording",
        stateAfter: "stopping",
      });
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(
          () =>
            resolve({
              ok: false,
              error: "Recording stop timed out.",
              code: "RECORDING_STOP_TIMEOUT",
            }),
          RECORDING_STOP_TIMEOUT_MS
        );
      });
      let response = await Promise.race([
        sendMessageToOffscreen({ type: "RECORDING_STOP" }),
        timeoutPromise,
      ]);
      if (!response.ok) {
        if (response.code === "RECORDING_STOP_TIMEOUT") {
          try {
            const fallbackState = await sendMessageToOffscreen({
              type: "RECORDING_GET_STATE",
            });
            if (fallbackState && fallbackState.ok && fallbackState.hasData) {
              response = {
                ok: true,
                fallback: true,
                message: "Recording stopped and saved from available data.",
                code: "RECORDING_STOP_TIMEOUT_FALLBACK",
                ...fallbackState,
              };
            }
          } catch (error) {
            // continue to error path
          }
        }
      }
      if (!response.ok) {
        const errorMessage = response.error || "Failed to stop recording.";
        addDiagnostic("error", "Recording stop failed.", {
          error: errorMessage,
        });
        setRecordingState("error", { errorMessage });
        logRecordingDiagnostic("stop_failed", {
          errorPhase: "offscreen_stop",
          errorMessage,
        });
        await restorePanelAfterRecording(recordingTabId);
        setRecordingState("idle", { errorMessage });
        throw new Error(errorMessage);
      }
      syncRecordingState(response);
      if (recordingController.state !== "stopped") {
        setRecordingState("stopped", { force: true });
      }
      if (state.recording.sessionId) {
        await updateRecordingSessionRecord(state.recording.sessionId, {
          status: "finalizing",
          stoppedAt: Date.now(),
          durationMs:
            typeof response.elapsedMs === "number" ? response.elapsedMs : null,
        });
        console.log("[RECORDING][STATE]", {
          from: "stopping",
          to: "finalizing",
          sessionId: state.recording.sessionId,
        });
      }
      if (response.fallback) {
        setStatusMessage(
          response.message || "Recording saved from available data.",
          "success"
        );
      }
      if (state.recording.status === "idle") {
        markSessionStopped();
      }
      if (recordingOverlayState.tabId) {
        await removeTimestampOverlay(recordingOverlayState.tabId);
      }
      recordingOverlayState.startMs = null;
      recordingOverlayState.paused = false;
      recordingOverlayState.pauseStartedAt = null;
      recordingOverlayState.totalPausedMs = 0;
      recordingOverlayState.tabId = null;
      if (state.recording.hasData && !state.recording.videoBlobUrl) {
        try {
          await ensureOffscreenReady();
          const exportResponse = await sendMessageToOffscreen({
            type: "RECORDING_EXPORT_WEBM",
          });
          if (exportResponse && exportResponse.ok && exportResponse.blobUrl) {
            state.recording.videoBlobUrl = exportResponse.blobUrl;
            state.recording.videoMime = exportResponse.mimeType || null;
            state.recording.videoByteLength =
              typeof exportResponse.size === "number"
                ? exportResponse.size
                : null;
            if (state.recording.sessionId) {
              const isPartial = Boolean(response.fallback);
              await updateRecordingSessionRecord(state.recording.sessionId, {
                status: isPartial ? "partial_complete" : "complete",
                isPartial,
                failureReason: isPartial ? "stop_timeout" : null,
              });
              console.log("[RECORDING][FINALIZE]", {
                sessionId: state.recording.sessionId,
                status: isPartial ? "partial_complete" : "complete",
                artifactSize: exportResponse.size || null,
                isPartial,
              });
            }
          }
        } catch (error) {
          console.warn("Failed to cache recording export reference:", error);
        }
      }
      clearStatusMessage();
      await restorePanelAfterRecording(recordingTabId);
      setRecordingState("idle");
      logRecordingDiagnostic("stop_complete", {
        stateBefore: "stopped",
        stateAfter: "idle",
        cleanupCompleted: true,
      });
      return response;
    } finally {
      setControlOpInFlight(false);
    }
  });
}

async function startNetworkCapture(filters, options = {}) {
  let tab = null;
  if (state.network.active) {
    throw new Error("Network capture is already active.");
  }

  tab = await getActiveTab();
  ensureTabIsCapturable(tab);
  if (DEBUG_CDP_LOGS) {
    console.log("[LOGS][CDP][ATTACH_CONTEXT]", {
      tabId: tab && tab.id ? tab.id : null,
      url: tab && tab.url ? tab.url : "",
      sessionState: session ? session.state : null,
      sessionMode: session ? session.mode : null,
      recordingState: recordingController.state || state.recording.status || null,
      logsState: getLogsCaptureState(),
      networkActive: state.network.active,
      consoleActive: state.console.active,
    });
  }

  const allowExistingSession = options.allowExistingSession === true;
  if (!session) {
    ensureSessionForMode("network_console", tab);
  } else if (!allowExistingSession || session.mode !== "session") {
    ensureSessionForMode("network_console", tab);
  } else if (session.state === "error") {
    session.state = "capturing";
    session.ended_at = null;
    clearStatusMessage();
  }
  activeFilters = normalizeFilters(filters);
  if (
    activeFilters.statusMode === "custom" &&
    (!activeFilters.customStatuses || activeFilters.customStatuses.length === 0)
  ) {
    const error = new Error("Invalid status filter list.");
    error.code = "invalid_filters";
    throw error;
  }
  if (session) {
    session.filters = activeFilters;
    session.filters_summary = buildFiltersSummary(activeFilters);
  }
  if (!isIdbAvailable()) {
    throw new Error("IndexedDB unavailable for capture.");
  }
  await loadCaptureSettings();
  await ensureSessionRecord(tab);
  if (captureState.sessionId) {
    try {
      const existing = await ReproIdb.getByKey("sessions", captureState.sessionId);
      if (existing) {
        existing.filters = activeFilters;
        existing.filters_summary = buildFiltersSummary(activeFilters);
        await ReproIdb.putOne("sessions", existing);
      }
    } catch (error) {
      console.warn("Failed to persist filters to session record:", error);
    }
  }
  rotationSuppressed = false;
  captureState.pausedForStorageLimit = false;
  captureState.rolloverPending = false;
  captureState.pendingFinalizePart = null;
  captureState.pendingFinalizeStartNewPart = false;
  let attached = false;
  let attachAttempts = 0;
  const attemptAttach = async (label) => {
    attachAttempts += 1;
    if (DEBUG_CDP_LOGS) {
      const attachPayload = {
        tabId: tab.id,
        label,
        url: tab.url || "",
        recordingState: recordingController.state || state.recording.status || "idle",
        recordingStatus: state.recording.status || "idle",
        sessionState: session ? session.state : null,
        captureState: {
          sessionId: captureState.sessionId || null,
          partId: captureState.partId || null,
          logsState: captureState.logsState || null,
        },
        networkState: {
          active: state.network.active,
          captureEnabled: state.network.captureEnabled,
        },
        consoleState: {
          active: state.console.active,
        },
      };
      console.log("[LOGS][CDP][ATTACH_START]", attachPayload);
      appendCdpDebugLog("[LOGS][CDP][ATTACH_START]", attachPayload);
    }
    await attachDebugger(tab.id);
    attached = true;
    if (DEBUG_CDP_LOGS) {
      const attachOkPayload = { tabId: tab.id, url: tab.url || "" };
      console.log("[LOGS][CDP][ATTACH_OK]", attachOkPayload);
      appendCdpDebugLog("[LOGS][CDP][ATTACH_OK]", attachOkPayload);
      debuggerEventStats = {
        tabId: tab.id,
        startMs: Date.now(),
        network: 0,
        console: 0,
      };
      if (debuggerEventCheckTimer) {
        clearTimeout(debuggerEventCheckTimer);
      }
      debuggerEventCheckTimer = setTimeout(() => {
        if (DEBUG_CDP_LOGS && debuggerEventStats) {
          console.warn("[LOGS][CDP][EVENT_TIMEOUT]", {
            tabId: debuggerEventStats.tabId,
            network: debuggerEventStats.network,
            console: debuggerEventStats.console,
            elapsedMs: Date.now() - debuggerEventStats.startMs,
          });
        }
      }, DEBUG_CDP_LOGS_TIMEOUT_MS);
    }
  };
  try {
    await attemptAttach("initial");
  } catch (error) {
    const message = error.message || String(error);
    if (DEBUG_CDP_LOGS) {
      console.warn("[LOGS][CDP][ATTACH_FAILED]", {
        tabId: tab.id,
        error: message,
        recordingState: recordingController.state || state.recording.status || "idle",
        recordingStatus: state.recording.status || "idle",
        sessionState: session ? session.state : null,
        captureState: {
          sessionId: captureState.sessionId || null,
          partId: captureState.partId || null,
          logsState: captureState.logsState || null,
        },
      });
      const attachFailedPayload = {
        tabId: tab.id,
        error: message,
        recordingState: recordingController.state || state.recording.status || "idle",
        recordingStatus: state.recording.status || "idle",
        sessionState: session ? session.state : null,
        captureState: {
          sessionId: captureState.sessionId || null,
          partId: captureState.partId || null,
          logsState: captureState.logsState || null,
        },
      };
      appendCdpDebugLog("[LOGS][CDP][ATTACH_FAILED]", attachFailedPayload);
    }
    await delay(200);
    try {
      await attemptAttach("retry");
    } catch (retryError) {
      const retryMessage = retryError.message || String(retryError);
    if (DEBUG_CDP_LOGS) {
      const attachFailedFinalPayload = {
        tabId: tab.id,
        error: retryMessage,
        attempts: attachAttempts,
        recordingState: recordingController.state || state.recording.status || "idle",
        recordingStatus: state.recording.status || "idle",
        sessionState: session ? session.state : null,
        captureState: {
          sessionId: captureState.sessionId || null,
          partId: captureState.partId || null,
          logsState: captureState.logsState || null,
        },
      };
      console.warn("[LOGS][CDP][ATTACH_FAILED_FINAL]", attachFailedFinalPayload);
      appendCdpDebugLog("[LOGS][CDP][ATTACH_FAILED_FINAL]", attachFailedFinalPayload);
    }
      addDiagnostic("error", "Debugger attach failed.", {
        error: retryMessage,
        attempts: attachAttempts,
      });
      setStatusMessage(
        "Capture Logs unavailable. Failed to attach debugger.",
        "error"
      );
      const attachError = new Error(
        "Capture Logs unavailable. Failed to attach debugger."
      );
      attachError.code = "debugger_attach_failed";
      throw attachError;
    }
  }
  try {
    await sendDebuggerCommand(tab.id, "Network.enable");
    if (DEBUG_CDP_LOGS) {
      console.log("[LOGS][CDP][NETWORK_ENABLE_OK]", { tabId: tab.id });
    }
  } catch (error) {
    const message = error.message || String(error);
    if (DEBUG_CDP_LOGS) {
      console.warn("[LOGS][CDP][NETWORK_ENABLE_FAILED]", { tabId: tab.id, error: message });
    }
    addDiagnostic("warning", "Network enable failed.", {
      error: message,
    });
    if (attached) {
      try {
        await detachDebugger(tab.id);
      } catch (detachError) {
        addDiagnostic("warning", "Debugger detach failed after enable error.", {
          error: detachError.message || String(detachError),
        });
      }
    }
    setSessionState("error");
    setStatusMessage(
      "Unable to enable network capture. Try again or switch tabs.",
      "error"
    );
    throw error;
  }

  let runtimeEnabled = false;
  try {
    await sendDebuggerCommand(tab.id, "Runtime.enable");
    runtimeEnabled = true;
    if (DEBUG_CDP_LOGS) {
      console.log("[LOGS][CDP][RUNTIME_ENABLE_OK]", { tabId: tab.id });
    }
  } catch (error) {
    const message = error.message || String(error);
    if (DEBUG_CDP_LOGS) {
      console.warn("[LOGS][CDP][RUNTIME_ENABLE_FAILED]", { tabId: tab.id, error: message });
    }
    addDiagnostic("warning", "Runtime enable failed.", {
      error: message,
    });
  }

  setSessionState("capturing");
  addDiagnostic("info", "Debugger attached.", {
    debuggerAttached: true,
    tabId: tab.id,
    tabUrl: tab.url || "",
  });
  const baseMessage =
    "Capture started - now Refresh (Ctrl+R) or click a link to capture requests.";
  const warningSuffix = runtimeEnabled
    ? ""
    : " Console capture unavailable (policy blocked). Network capture still running.";
  setStatusMessage(
    `${baseMessage}${warningSuffix}`,
    runtimeEnabled ? "success" : "info"
  );

  state.network.active = true;
  setNetworkCaptureEnabled(true);
  captureState.logsState = "capturing";
  state.network.tabId = tab.id;
  state.network.requests = {};
  state.network.order = [];
  state.network.startedAt = nowIso();
  state.network.stoppedAt = null;

  state.console.active = runtimeEnabled;
  state.console.tabId = runtimeEnabled ? tab.id : null;
  state.console.logs = [];
  state.console.startedAt = nowIso();
  state.console.stoppedAt = null;
  return { consoleEnabled: runtimeEnabled };
}

// V1 STABLE: stop finalization must flush + finalize pending entries.
async function stopNetworkCapture() {
  if (!state.network.active) {
    throw new Error("Network capture is not active.");
  }

  const tabId = state.network.tabId;

  state.network.active = false;
  setNetworkCaptureEnabled(false);
  captureState.logsState = "idle";
  state.network.stoppedAt = nowIso();

  state.console.active = false;
  state.console.stoppedAt = nowIso();
  if (session && session.mode === "session") {
    setSessionState("finalizing");
  }
  rotationSuppressed = true;
  finalizePendingNetworkEntries("manual_stop");
  if (captureState.partId) {
    const completedCount = await refreshCompletedPartsCount();
    if (completedCount >= MAX_COMPLETED_PARTS_RETAINED) {
      const pendingPart = {
        partId: captureState.partId,
        partNumber: captureState.partNumber,
        requestCount: captureState.requestsInPart,
        consoleCount: captureState.consoleInPart,
        errorCount: captureState.errorsInPart,
        bytesInPart: captureState.bytesInPart,
        networkBytes: captureState.networkBytesInPart,
        consoleBytes: captureState.consoleBytesInPart,
        createdAtMs: captureState.partCreatedAtMs || Date.now(),
        lastEventMs: captureState.lastEventMs,
        reason: "manual_stop",
      };
      pauseCaptureForStorageLimit(pendingPart, false);
      await flushQueues();
    } else {
    const completedPart = {
      partId: captureState.partId,
      partNumber: captureState.partNumber,
      requestCount: captureState.requestsInPart,
      consoleCount: captureState.consoleInPart,
      errorCount: captureState.errorsInPart,
      bytesInPart: captureState.bytesInPart,
      networkBytes: captureState.networkBytesInPart,
      consoleBytes: captureState.consoleBytesInPart,
      createdAtMs: captureState.partCreatedAtMs || Date.now(),
      lastEventMs: captureState.lastEventMs,
      reason: "manual_stop",
    };
    captureState.lastCompletedPartId = captureState.partId;
    captureState.lastCompletedPartNumber = captureState.partNumber;
    captureState.partId = null;
    captureState.partHasData = false;
    await completePart(completedPart);
    captureState.completedPartsCount += 1;
    await flushQueues();
    let stopMessage = `Part ${completedPart.partNumber} ready to download.`;
    let stopLevel = "success";
    if (completedPart.requestCount < MIN_REQUESTS_TO_EXPORT) {
      stopMessage = `Stopped. Not enough requests to export yet (need ${MIN_REQUESTS_TO_EXPORT}+).`;
      stopLevel = "info";
    } else if (captureState.autoDownloadOnRollover) {
      await enqueueExport(completedPart, { auto: true, reason: "stop" });
      stopMessage = `Stopped. Auto-downloading Part ${completedPart.partNumber}.`;
      stopLevel = "info";
    }
    setStatusMessage(stopMessage, stopLevel);
    sendPartStatusUpdate({
      message: stopMessage,
    });
    }
  }

  if (tabId) {
    try {
      await detachDebugger(tabId);
    } catch (error) {
      console.warn("Failed to detach debugger:", error);
      addDiagnostic("warning", "Debugger detach failed.", {
        error: error.message || String(error),
      });
    }
  }
  if (!captureState.pausedForStorageLimit) {
    clearStatusMessage();
  }
  await flushQueues();
  markSessionStopped();
}

async function pauseLogsCapture() {
  if (!state.network.active) {
    throw new Error("Network capture is not active.");
  }
  const current = getLogsCaptureState();
  if (current === "paused") {
    return { ok: true, alreadyPaused: true };
  }
  if (current !== "capturing") {
    throw new Error("Logs capture is not running.");
  }
  finalizePendingNetworkEntries("paused");
  state.network.requests = {};
  state.network.order = [];
  captureState.logsState = "paused";
  if (recordingController.state === "paused") {
    setSessionState("paused");
  } else if (recordingController.state === "recording") {
    setSessionState("capturing");
  }
  setStatusMessage("Capture paused. Resume to continue.", "info");
  if (DEBUG_LOGS_PAUSE) {
    console.log("[LOGS][PAUSE]", { sessionId: captureState.sessionId || null });
  }
  return { ok: true };
}

async function resumeLogsCapture() {
  if (!state.network.active) {
    throw new Error("Network capture is not active.");
  }
  const current = getLogsCaptureState();
  if (current === "capturing") {
    return { ok: true, alreadyCapturing: true };
  }
  if (current !== "paused") {
    throw new Error("Logs capture is not paused.");
  }
  captureState.logsState = "capturing";
  if (recordingController.state === "paused") {
    setSessionState("paused");
  } else {
    setSessionState("capturing");
  }
  setStatusMessage("Capture resumed.", "success");
  if (DEBUG_LOGS_PAUSE) {
    console.log("[LOGS][RESUME]", { sessionId: captureState.sessionId || null });
  }
  return { ok: true };
}

function updateRequestEntry(requestId, updates, options = {}) {
  if (!requestId) {
    return;
  }
  const allowCreate = options.allowCreate !== false;
  if (!state.network.requests[requestId]) {
    if (!allowCreate) {
      return;
    }
    state.network.requests[requestId] = {
      id: requestId,
      timestampIso: null,
      requestHeaders: {},
      responseHeaders: {},
      responseBody: null,
      responseBodyBase64: false,
    };
  }
  Object.assign(state.network.requests[requestId], updates);
}

function finalizeNetworkEntry(requestId, options = {}) {
  if (!requestId) {
    return;
  }
  const entry = state.network.requests[requestId];
  if (!entry) {
    return;
  }
  if (options.reason) {
    if (!entry.errorText) {
      entry.errorText = options.reason;
    }
    entry.incomplete = true;
    entry.finalizeReason = options.reason;
  }
  if (
    activeFilters &&
    activeFilters.captureMode === "filtered_capture" &&
    !matchesNetworkFilters(entry, activeFilters)
  ) {
    delete state.network.requests[requestId];
    return;
  }
  const record = buildNetworkStorageRecord(entry);
  queueNetworkRecord(record);
  delete state.network.requests[requestId];
}

function finalizePendingNetworkEntries(reason) {
  const pendingIds = Object.keys(state.network.requests);
  if (pendingIds.length === 0) {
    return;
  }
  pendingIds.forEach((requestId) => {
    finalizeNetworkEntry(requestId, { reason });
  });
}

chrome.debugger.onEvent.addListener((source, method, params) => {
  if (!state.network.active || source.tabId !== state.network.tabId) {
    return;
  }
  if (DEBUG_CDP_LOGS) {
    if (!debuggerEventStats) {
      debuggerEventStats = {
        tabId: source.tabId || null,
        startMs: Date.now(),
        network: 0,
        console: 0,
      };
    }
    debuggerEventStats.network += 1;
    if (!debuggerEventStats.tabId) {
      debuggerEventStats.tabId = source.tabId || null;
      debuggerEventStats.startMs = Date.now();
    }
    if (debuggerEventStats.network === 1) {
      console.log("[LOGS][CDP][EVENT_FIRST]", {
        method,
        tabId: source.tabId || null,
      });
    } else if (debuggerEventStats.network % 50 === 0) {
      console.log("[LOGS][CDP][EVENT_COUNT]", {
        count: debuggerEventStats.network,
        tabId: source.tabId || null,
        elapsedMs: Date.now() - debuggerEventStats.startMs,
      });
    }
  }
  if (!isLogsCapturing()) {
    if (DEBUG_LOGS_PAUSE) {
      const now = Date.now();
      if (now - lastLogsPauseLogMs > 5000) {
        lastLogsPauseLogMs = now;
        console.log("[LOGS][PAUSED][IGNORED_EVENT]", {
          method,
          tabId: source.tabId || null,
        });
      }
    }
    return;
  }
  if (DEBUG_CDP_LOGS) {
    if (method === "Runtime.consoleAPICalled" || method === "Runtime.exceptionThrown") {
      debuggerEventStats.console += 1;
    }
  }

  if (method === "Runtime.consoleAPICalled" && state.console.active) {
    const args = Array.isArray(params.args)
      ? params.args.map((arg) => formatRemoteObject(arg))
      : [];
    const level =
      params.type === "warning"
        ? "warn"
        : params.type === "debug"
          ? "debug"
          : params.type === "info"
            ? "info"
            : params.type === "error"
              ? "error"
              : "log";
    const message = args.join(" ");
    const frames = params.stackTrace ? params.stackTrace.callFrames : null;
    const topFrame = frames && frames.length ? frames[0] : null;
    addConsoleEntry({
      timestamp: nowIso(),
      level,
      message,
      args,
      source: "console",
      url: topFrame && topFrame.url ? topFrame.url : null,
      line:
        topFrame && typeof topFrame.lineNumber === "number"
          ? topFrame.lineNumber
          : null,
      column:
        topFrame && typeof topFrame.columnNumber === "number"
          ? topFrame.columnNumber
          : null,
      stack: extractStackFromFrames(frames),
    });
    return;
  }

  if (method === "Runtime.exceptionThrown" && state.console.active) {
    const details = params.exceptionDetails || {};
    const exception = details.exception || {};
    const message =
      details.text ||
      exception.description ||
      (typeof exception.value !== "undefined" ? String(exception.value) : null) ||
      "Uncaught exception";
    const frames = details.stackTrace ? details.stackTrace.callFrames : null;
    const topFrame = frames && frames.length ? frames[0] : null;
    addConsoleEntry({
      timestamp: nowIso(),
      level: "error",
      message,
      args: [String(message)],
      source: "window.onerror",
      url: details.url || (topFrame && topFrame.url ? topFrame.url : null),
      line:
        typeof details.lineNumber === "number"
          ? details.lineNumber
          : topFrame && typeof topFrame.lineNumber === "number"
            ? topFrame.lineNumber
            : null,
      column:
        typeof details.columnNumber === "number"
          ? details.columnNumber
          : topFrame && typeof topFrame.columnNumber === "number"
            ? topFrame.columnNumber
            : null,
      stack: extractStackFromFrames(frames),
    });
    return;
  }

  const isNetworkEvent = typeof method === "string" && method.startsWith("Network.");
  if (isNetworkEvent && !state.network.captureEnabled) {
    return;
  }

  if (method === "Network.requestWillBeSent") {
    const resourceType = params.type ? String(params.type).toLowerCase() : null;
    const entryPreview = {
      resourceType: resourceType || null,
      url: params.request && params.request.url ? params.request.url : "",
    };
    if (!shouldCaptureAtRequestStage(entryPreview, activeFilters)) {
      return;
    }
    updateRequestEntry(params.requestId, {
      url: params.request.url,
      method: params.request.method,
      requestHeaders: normalizeHeaders(params.request.headers),
      requestBody: params.request.postData,
      requestTime: params.timestamp,
      timestampIso: nowIso(),
      initiator: params.initiator,
      resourceType: resourceType || null,
    });
  }

  if (method === "Network.requestWillBeSentExtraInfo") {
    updateRequestEntry(params.requestId, {
      requestHeaders: {
        ...state.network.requests[params.requestId]?.requestHeaders,
        ...normalizeHeaders(params.headers),
      },
    }, { allowCreate: false });
  }

  if (method === "Network.responseReceived") {
    updateRequestEntry(params.requestId, {
      status: params.response.status,
      statusText: params.response.statusText,
      responseHeaders: normalizeHeaders(params.response.headers),
      responseTime: params.timestamp,
      mimeType: params.response.mimeType,
      timing: params.response.timing,
      protocol: params.response.protocol,
      remoteIPAddress: params.response.remoteIPAddress,
      fromDiskCache:
        typeof params.response.fromDiskCache === "boolean"
          ? params.response.fromDiskCache
          : null,
      fromServiceWorker:
        typeof params.response.fromServiceWorker === "boolean"
          ? params.response.fromServiceWorker
          : null,
    }, { allowCreate: false });
  }

  if (method === "Network.responseReceivedExtraInfo") {
    updateRequestEntry(params.requestId, {
      responseHeaders: {
        ...state.network.requests[params.requestId]?.responseHeaders,
        ...normalizeHeaders(params.headers),
      },
    }, { allowCreate: false });
  }

  if (method === "Network.loadingFinished") {
    updateRequestEntry(params.requestId, {
      encodedDataLength: params.encodedDataLength,
      endTime: params.timestamp,
    }, { allowCreate: false });
    const entry = state.network.requests[params.requestId];
    if (entry && entry.requestTime) {
      entry.durationMs = Math.round(
        (params.timestamp - entry.requestTime) * 1000
      );
    }
    sendDebuggerCommand(source.tabId, "Network.getResponseBody", {
      requestId: params.requestId,
    })
      .then((result) => {
        updateRequestEntry(params.requestId, {
          responseBody: result.body,
          responseBodyBase64: result.base64Encoded,
        });
        finalizeNetworkEntry(params.requestId);
      })
      .catch(() => {
        addDiagnostic("warning", "Response body fetch failed.", {
          requestId: params.requestId,
        });
        updateRequestEntry(params.requestId, {
          responseBody: null,
          responseBodyBase64: false,
        });
        finalizeNetworkEntry(params.requestId);
      });
  }

  if (method === "Network.loadingFailed") {
    updateRequestEntry(params.requestId, {
      errorText: params.errorText,
      canceled: params.canceled,
      endTime: params.timestamp,
    }, { allowCreate: false });
    finalizeNetworkEntry(params.requestId);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!session || !session.active_tab || session.active_tab.tab_id !== tabId) {
    return;
  }
  if (!changeInfo || (!changeInfo.url && changeInfo.status !== "loading")) {
    return;
  }
  const url = changeInfo.url || (tab && tab.url) || "";
  if (!url) {
    return;
  }
  try {
    const reportConfig = getReportConfig();
    if (
      reportConfig.enabled &&
      globalThis.ReportStepTracker &&
      typeof globalThis.ReportStepTracker.recordNavigationEvent === "function"
    ) {
      globalThis.ReportStepTracker.recordNavigationEvent({
        url,
        title: tab && tab.title ? tab.title : "",
        timestamp: nowIso(),
        navigationKind: changeInfo.url
          ? "change"
          : changeInfo.status === "loading"
            ? "reload"
            : "change",
        tabId,
      });
    }
  } catch (error) {
    // Report tracking is optional; ignore failures.
  }

  if (changeInfo.status !== "complete") {
    return;
  }

  if (
    recordingOverlayState.tabId === tabId &&
    (state.recording.status === "recording" || state.recording.status === "paused")
  ) {
    if (state.network.active && !isPanelClosed(tabId, "logs")) {
      if (isPanelHiddenForCapture(tabId, "logs")) {
        void mountPanelOverlay(tabId, "logs");
        void setPanelOverlayHidden(tabId, "logs", true);
      } else {
        void setPanelOverlayHidden(tabId, "logs", false);
        void showPanelOverlay(tabId, "logs");
      }
    }
  } else if (state.network.active && state.network.tabId === tabId) {
    if (!isPanelClosed(tabId, "logs")) {
      void setPanelOverlayHidden(tabId, "logs", false);
      void showPanelOverlay(tabId, "logs");
    }
  }
});

// V1 STABLE: detach finalization must preserve queued logs.
chrome.debugger.onDetach.addListener((source, reason) => {
  appendCdpDebugLog("[LOGS][CDP][DETACH]", {
    tabId: source.tabId || null,
    reason,
    recordingState: recordingController.state || state.recording.status || "idle",
    recordingStatus: state.recording.status || "idle",
    sessionState: session ? session.state : null,
    captureState: {
      sessionId: captureState.sessionId || null,
      partId: captureState.partId || null,
      logsState: captureState.logsState || null,
    },
    networkState: {
      active: state.network.active,
      captureEnabled: state.network.captureEnabled,
    },
    consoleState: {
      active: state.console.active,
    },
  });
  if (source.tabId !== state.network.tabId) {
    return;
  }
  if (DEBUG_CDP_LOGS) {
    console.warn("[LOGS][CDP][DETACH]", {
      tabId: source.tabId || null,
      reason,
      recordingState: recordingController.state || state.recording.status || "idle",
      sessionState: session ? session.state : null,
      captureState: {
        sessionId: captureState.sessionId || null,
        partId: captureState.partId || null,
        logsState: captureState.logsState || null,
      },
    });
  }
  state.network.active = false;
  setNetworkCaptureEnabled(false);
  state.network.stoppedAt = nowIso();
  state.network.detachReason = reason;

  state.console.active = false;
  state.console.stoppedAt = nowIso();
  addDiagnostic("error", "Debugger detached unexpectedly.", { reason });
  rotationSuppressed = true;
  const pendingIds = Object.keys(state.network.requests);
  if (pendingIds.length > 0) {
    pendingIds.forEach((requestId) => {
      finalizeNetworkEntry(requestId);
    });
  }
  if (captureState.partId) {
    const completedPart = {
      partId: captureState.partId,
      partNumber: captureState.partNumber,
      requestCount: captureState.requestsInPart,
      consoleCount: captureState.consoleInPart,
      errorCount: captureState.errorsInPart,
      bytesInPart: captureState.bytesInPart,
      networkBytes: captureState.networkBytesInPart,
      consoleBytes: captureState.consoleBytesInPart,
      createdAtMs: captureState.partCreatedAtMs || Date.now(),
      lastEventMs: captureState.lastEventMs,
      reason: "debugger_detached",
    };
    void (async () => {
      const completedCount = await refreshCompletedPartsCount();
      if (completedCount >= MAX_COMPLETED_PARTS_RETAINED) {
        pauseCaptureForStorageLimit(completedPart, false);
        await flushQueues();
        return;
      }
      captureState.lastCompletedPartId = captureState.partId;
      captureState.lastCompletedPartNumber = captureState.partNumber;
      captureState.partId = null;
      captureState.partHasData = false;
      await completePart(completedPart);
      captureState.completedPartsCount += 1;
      await flushQueues();
      setStatusMessage(`Part ${completedPart.partNumber} ready to download.`, "error");
      sendPartStatusUpdate({
        message: `Part ${completedPart.partNumber} ready to download.`,
      });
    })();
  }
  setStatusMessage(
    "Capture stopped: debugger detached unexpectedly.",
    "error"
  );
  markSessionStopped();
  void flushQueues();
});

async function resetSession() {
  await resetNetworkState();

  try {
    await ensureOffscreenReady();
    if (state.recording.status !== "idle") {
      try {
        await sendMessageToOffscreen({ type: "RECORDING_STOP" });
      } catch (error) {
        console.warn("Failed to stop recording on reset:", error);
      }
    }
    await sendMessageToOffscreen({ type: "RECORDING_RESET" });
  } catch (error) {
    console.warn("Failed to reset recording on reset:", error);
  }
  await closeRecordingPanelWindow();

  state.screenshot.dataUrl = null;
  state.screenshot.capturedAt = null;

  state.recording.status = "idle";
  state.recording.dataUrl = null;
  state.recording.mimeType = null;
  state.recording.capturedAt = null;
  state.recording.error = null;
  state.recording.hasData = false;
  state.recording.videoBlobUrl = null;
  state.recording.videoMime = null;
  state.recording.videoByteLength = null;
  state.recording.videoStartEpochMs = null;
  state.recording.videoEndEpochMs = null;
  state.recording.sessionId = null;
  recordingController.state = "idle";
  recordingController.sessionId = null;
  recordingController.targetTabId = null;
  recordingController.lastError = null;
  recordingOverlayState.startMs = null;
  recordingOverlayState.paused = false;
  recordingOverlayState.pauseStartedAt = null;
  recordingOverlayState.totalPausedMs = 0;
  recordingOverlayState.tabId = null;
  broadcastRecordingState("reset");

  resetCaptureState();
  session = null;
  clearStatusMessage();
}

async function resetNetworkState() {
  if (state.network.tabId) {
    try {
      await detachDebugger(state.network.tabId);
    } catch (error) {
      console.warn("Failed to detach debugger on reset:", error);
    }
  }

  state.network.active = false;
  setNetworkCaptureEnabled(false);
  state.network.tabId = null;
  state.network.requests = {};
  state.network.order = [];
  state.network.capped = false;
  state.network.startedAt = null;
  state.network.stoppedAt = null;

  state.console.active = false;
  state.console.tabId = null;
  state.console.logs = [];
  state.console.startedAt = null;
  state.console.stoppedAt = null;

  resetCaptureState();
}

function resetCaptureState() {
  captureState.sessionId = null;
  captureState.partId = null;
  captureState.partNumber = 0;
  captureState.partCreatedAtMs = null;
  captureState.requestsInPart = 0;
  captureState.bytesInPart = 0;
  captureState.networkBytesInPart = 0;
  captureState.consoleBytesInPart = 0;
  captureState.consoleInPart = 0;
  captureState.errorsInPart = 0;
  captureState.lastEventMs = null;
  captureState.totalRequests = 0;
  captureState.totalConsole = 0;
  captureState.totalErrors = 0;
  captureState.capRequests = CAPTURE_DEFAULTS.partCapRequests;
  captureState.capBytes = CAPTURE_DEFAULTS.partCapBytes;
  captureState.maxBodyBytes = CAPTURE_DEFAULTS.maxBodyBytes;
  captureState.autoDownloadOnRollover = CAPTURE_DEFAULTS.autoDownloadOnRollover;
  captureState.lastCompletedPartId = null;
  captureState.lastCompletedPartNumber = null;
  captureState.partHasData = false;
  captureState.completedPartsCount = 0;
  captureState.logsState = "idle";
  captureState.pausedForStorageLimit = false;
  captureState.rolloverPending = false;
  captureState.pendingFinalizePart = null;
  captureState.pendingFinalizeStartNewPart = false;
  networkQueue.length = 0;
  consoleQueue.length = 0;
  exportedPartIds.clear();
  exportQueue.length = 0;
  exportQueueIds.clear();
  exportStatus = null;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  flushInProgress = false;
  rotationSuppressed = false;
  rotationInProgress = false;
  activeFilters = { ...FILTER_DEFAULTS };
}

function getByteLength(value) {
  return new TextEncoder().encode(value).length;
}

function sanitizeConsoleEntry(entry) {
  const sanitized = {
    ...entry,
    message: typeof entry.message === "string" ? entry.message : "",
    args: Array.isArray(entry.args)
      ? entry.args.map((arg) =>
          typeof arg === "string" ? arg : String(arg)
        )
      : [],
  };

  let size = getByteLength(JSON.stringify(sanitized));
  if (size <= MAX_CONSOLE_ENTRY_BYTES) {
    return sanitized;
  }

  sanitized.message = truncateToBytes(
    sanitized.message,
    MAX_CONSOLE_ENTRY_BYTES
  );
  size = getByteLength(JSON.stringify(sanitized));
  if (size <= MAX_CONSOLE_ENTRY_BYTES) {
    return sanitized;
  }

  const base = { ...sanitized, args: [] };
  let baseSize = getByteLength(JSON.stringify(base));
  if (baseSize >= MAX_CONSOLE_ENTRY_BYTES) {
    sanitized.args = [];
    sanitized.message = truncateToBytes(
      sanitized.message,
      MAX_CONSOLE_ENTRY_BYTES
    );
    return sanitized;
  }

  const trimmedArgs = [];
  for (let i = 0; i < sanitized.args.length; i += 1) {
    const remaining = MAX_CONSOLE_ENTRY_BYTES - baseSize;
    if (remaining <= 0) {
      break;
    }
    const argValue = truncateToBytes(sanitized.args[i], remaining);
    trimmedArgs.push(argValue);
    const nextSize = getByteLength(
      JSON.stringify({ ...base, args: trimmedArgs })
    );
    if (nextSize > MAX_CONSOLE_ENTRY_BYTES) {
      trimmedArgs.pop();
      break;
    }
    baseSize = nextSize;
  }
  sanitized.args = trimmedArgs;
  return sanitized;
}

function buildNetworkStorageRecord(entry) {
  if (!entry || !captureState.partId) {
    return null;
  }
  const hasRequestHeaders =
    entry.requestHeaders && Object.keys(entry.requestHeaders).length > 0;
  const hasResponseHeaders =
    entry.responseHeaders && Object.keys(entry.responseHeaders).length > 0;
  const responseHeaders = hasResponseHeaders ? entry.responseHeaders : null;
  const skipBody = shouldSkipResponseBody(responseHeaders);
  const timestampIso = entry.timestampIso || nowIso();
  const timestampEpochMs = parseEpochMs(timestampIso);
  const hasRequestBody = typeof entry.requestBody === "string";
  const requestBodyMeta = truncateBodyWithMeta(
    hasRequestBody ? entry.requestBody : null,
    captureState.maxBodyBytes
  );
  const hasResponseBody =
    !skipBody && typeof entry.responseBody === "string";
  const responseBodyMeta = skipBody
    ? { value: null, truncated: false, originalBytes: null }
    : decodeResponseBodyWithLimit(entry, captureState.maxBodyBytes);
  const recordId = `net_${captureState.partId}_${entry.id || crypto.randomUUID()}`;
  const relativeMs = computeSessionOffsetMs(timestampIso);
  const exportEntry = {
    id: recordId,
    timestamp_ms: relativeMs,
    request_id: entry.id || null,
    timestamp: timestampIso,
    timestamp_epoch_ms: timestampEpochMs,
    time_missing: timestampEpochMs === null ? true : undefined,
    url: entry.url || null,
    method: entry.method || null,
    resource_type: entry.resourceType || null,
    request_headers: hasRequestHeaders ? entry.requestHeaders : null,
    request_headers_unavailable: hasRequestHeaders ? undefined : true,
    request_post_data: requestBodyMeta.value,
    request_body_unavailable: hasRequestBody ? undefined : true,
    request_body_unavailable_reason: hasRequestBody ? null : "unavailable",
    response_status: typeof entry.status === "number" ? entry.status : null,
    response_status_text: entry.statusText || null,
    response_headers: responseHeaders,
    response_headers_unavailable: hasResponseHeaders ? undefined : true,
    response_mime_type: entry.mimeType || null,
    response_body_skipped: skipBody ? true : undefined,
    response_body: responseBodyMeta.value,
    response_body_unavailable: hasResponseBody ? undefined : true,
    response_body_unavailable_reason: skipBody
      ? "binary_content"
      : hasResponseBody
        ? null
        : "unavailable",
    timing: entry.timing || null,
    from_disk_cache:
      typeof entry.fromDiskCache === "boolean" ? entry.fromDiskCache : null,
    from_service_worker:
      typeof entry.fromServiceWorker === "boolean" ? entry.fromServiceWorker : null,
    error_text: entry.errorText || null,
    request_body_truncated: requestBodyMeta.truncated ? true : undefined,
    response_body_truncated: responseBodyMeta.truncated ? true : undefined,
    request_body_original_bytes: requestBodyMeta.originalBytes,
    response_body_original_bytes: responseBodyMeta.originalBytes,
    incomplete: entry.incomplete ? true : undefined,
    finalize_reason: entry.finalizeReason || null,
  };
  const entryBytes = getByteLength(JSON.stringify(exportEntry));
  return {
    id: recordId,
    sessionId: captureState.sessionId,
    partId: captureState.partId,
    partNumber: captureState.partNumber,
    t_ms: relativeMs,
    entry: exportEntry,
    entry_bytes: entryBytes,
    createdAtMs: Date.now(),
  };
}

function buildConsoleStorageRecord(entry) {
  if (!entry || !captureState.partId) {
    return null;
  }
  const timestampIso = entry.timestamp || nowIso();
  const timestampEpochMs = parseEpochMs(timestampIso);
  const recordId = `con_${captureState.partId}_${crypto.randomUUID()}`;
  const relativeMs = computeSessionOffsetMs(timestampIso);
  const exportEntry = {
    id: recordId,
    timestamp_ms: relativeMs,
    timestamp: timestampIso,
    timestamp_epoch_ms: timestampEpochMs,
    time_missing: timestampEpochMs === null ? true : undefined,
    level: entry.level || "log",
    message: typeof entry.message === "string" ? entry.message : "",
    args: Array.isArray(entry.args) ? entry.args : [],
    source: entry.source || "console",
    url: entry.url || null,
    line: typeof entry.line === "number" ? entry.line : null,
    column: typeof entry.column === "number" ? entry.column : null,
    stack: entry.stack || null,
  };
  const entryBytes = getByteLength(JSON.stringify(exportEntry));
  return {
    id: recordId,
    sessionId: captureState.sessionId,
    partId: captureState.partId,
    partNumber: captureState.partNumber,
    t_ms: relativeMs,
    level: exportEntry.level,
    entry: exportEntry,
    entry_bytes: entryBytes,
    createdAtMs: Date.now(),
  };
}

function queueNetworkRecord(record) {
  if (!record) {
    return;
  }
  networkQueue.push(record);
  debugPersistLog("[LOGS][PERSIST][NETWORK_QUEUE]", {
    recordId: record.id || record.requestId || null,
    sessionId: record.sessionId || null,
    partId: record.partId || null,
    queueLength: networkQueue.length,
    captureSessionId: captureState.sessionId || null,
    capturePartId: captureState.partId || null,
  });
  if (networkQueue.length > NETWORK_QUEUE_MAX) {
    const dropped = networkQueue.splice(
      0,
      networkQueue.length - NETWORK_QUEUE_MAX
    );
    captureState.totalErrors += dropped.length;
    addDiagnostic("warning", "Network log queue overflow.", {
      dropped: dropped.length,
    });
    setStatusMessage(
      "Network logs truncated due to high volume.",
      "error"
    );
  }
  captureState.lastEventMs =
    record.entry && typeof record.entry.timestamp_epoch_ms === "number"
      ? record.entry.timestamp_epoch_ms
      : Date.now();
  captureState.requestsInPart += 1;
  captureState.totalRequests += 1;
  if (record.entry_bytes) {
    captureState.networkBytesInPart += record.entry_bytes;
  }
  captureState.bytesInPart =
    captureState.networkBytesInPart + captureState.consoleBytesInPart;
  captureState.partHasData = true;
  updateSessionCounts();
  scheduleFlush();
  void maybeRotatePart();
}

function queueConsoleRecord(record) {
  if (!record) {
    return;
  }
  consoleQueue.push(record);
  debugPersistLog("[LOGS][PERSIST][CONSOLE_QUEUE]", {
    recordId: record.id || null,
    sessionId: record.sessionId || null,
    partId: record.partId || null,
    queueLength: consoleQueue.length,
    captureSessionId: captureState.sessionId || null,
    capturePartId: captureState.partId || null,
  });
  if (consoleQueue.length > CONSOLE_QUEUE_MAX) {
    const dropped = consoleQueue.splice(
      0,
      consoleQueue.length - CONSOLE_QUEUE_MAX
    );
    captureState.totalErrors += dropped.length;
    addDiagnostic("warning", "Console log queue overflow.", {
      dropped: dropped.length,
    });
    setStatusMessage(
      "Console logs truncated due to high volume.",
      "error"
    );
  }
  captureState.lastEventMs =
    record.entry && typeof record.entry.timestamp_epoch_ms === "number"
      ? record.entry.timestamp_epoch_ms
      : Date.now();
  captureState.consoleInPart += 1;
  captureState.totalConsole += 1;
  if (record.entry_bytes) {
    captureState.consoleBytesInPart += record.entry_bytes;
  }
  captureState.bytesInPart =
    captureState.networkBytesInPart + captureState.consoleBytesInPart;
  if (record.level === "error") {
    captureState.totalErrors += 1;
    captureState.errorsInPart += 1;
  }
  captureState.partHasData = true;
  updateSessionCounts();
  scheduleFlush();
}

function pauseCaptureForStorageLimit(completedPart, startNewPartAfter) {
  captureState.pausedForStorageLimit = true;
  captureState.rolloverPending = true;
  captureState.pendingFinalizePart = completedPart;
  captureState.pendingFinalizeStartNewPart = Boolean(startNewPartAfter);
  captureState.logsState = "paused";
  state.network.requests = {};
  state.network.order = [];
  const message =
    "Storage limit reached. Download or delete a completed part to continue.";
  setStatusMessage(message, "error");
  sendPartStatusUpdate({
    storageLimitPaused: true,
    message,
  });
}

async function resumeCaptureAfterStorageLimit() {
  if (!captureState.pausedForStorageLimit) {
    return;
  }
  const completedCount = await refreshCompletedPartsCount();
  if (completedCount >= MAX_COMPLETED_PARTS_RETAINED) {
    return;
  }
  captureState.pausedForStorageLimit = false;
  captureState.logsState = state.network.active ? "capturing" : "idle";
  const pendingPart = captureState.pendingFinalizePart;
  const shouldStartNewPart = captureState.pendingFinalizeStartNewPart;
  captureState.rolloverPending = false;
  captureState.pendingFinalizePart = null;
  captureState.pendingFinalizeStartNewPart = false;
  if (pendingPart) {
    await completePart(pendingPart);
    captureState.completedPartsCount += 1;
    if (
      captureState.autoDownloadOnRollover &&
      pendingPart.requestCount >= MIN_REQUESTS_TO_EXPORT
    ) {
      await enqueueExport(pendingPart, { auto: true, reason: "resume" });
    }
    if (shouldStartNewPart && state.network.active) {
      await startNewPart("rollover");
      const message = `Part ${pendingPart.partNumber} complete. Continuing in Part ${captureState.partNumber}.`;
      setStatusMessage(message, "success");
      sendPartStatusUpdate({ message });
    } else {
      captureState.partId = null;
      captureState.partHasData = false;
      const message = `Part ${pendingPart.partNumber} ready to download.`;
      setStatusMessage(message, "success");
      sendPartStatusUpdate({ message });
    }
  }
}

async function maybeRotatePart() {
  if (!captureState.partId) {
    return;
  }
  if (rotationSuppressed) {
    return;
  }
  if (captureState.pausedForStorageLimit) {
    return;
  }
  if (rotationInProgress) {
    return;
  }
  const shouldRotate =
    captureState.requestsInPart >= captureState.capRequests ||
    captureState.bytesInPart >= captureState.capBytes;
  if (!shouldRotate) {
    return;
  }
  rotationInProgress = true;
  try {
    const completedCount = await refreshCompletedPartsCount();
    if (completedCount >= MAX_COMPLETED_PARTS_RETAINED) {
      const pendingPart = {
        partId: captureState.partId,
        partNumber: captureState.partNumber,
        requestCount: captureState.requestsInPart,
        consoleCount: captureState.consoleInPart,
        errorCount: captureState.errorsInPart,
        bytesInPart: captureState.bytesInPart,
        networkBytes: captureState.networkBytesInPart,
        consoleBytes: captureState.consoleBytesInPart,
        createdAtMs: captureState.partCreatedAtMs || Date.now(),
        lastEventMs: captureState.lastEventMs,
        reason: "cap_reached",
      };
      pauseCaptureForStorageLimit(pendingPart, true);
      return;
    }
    const completedPart = {
      partId: captureState.partId,
      partNumber: captureState.partNumber,
      requestCount: captureState.requestsInPart,
      consoleCount: captureState.consoleInPart,
      errorCount: captureState.errorsInPart,
      bytesInPart: captureState.bytesInPart,
      networkBytes: captureState.networkBytesInPart,
      consoleBytes: captureState.consoleBytesInPart,
      createdAtMs: captureState.partCreatedAtMs || Date.now(),
      lastEventMs: captureState.lastEventMs,
      reason: "cap_reached",
    };
    captureState.lastCompletedPartId = captureState.partId;
    captureState.lastCompletedPartNumber = captureState.partNumber;
    await completePart(completedPart);
    captureState.completedPartsCount += 1;
    await startNewPart("rollover");
    const rolloverMessage = `Reached ${captureState.capRequests} requests. Continuing in Part ${captureState.partNumber}. Part ${completedPart.partNumber} ready to download.`;
    setStatusMessage(rolloverMessage, "success");
    sendPartStatusUpdate({
      rollover: true,
      message: rolloverMessage,
    });
    if (
      captureState.autoDownloadOnRollover &&
      completedPart.requestCount >= MIN_REQUESTS_TO_EXPORT
    ) {
      await enqueueExport(completedPart, { auto: true, reason: "rollover" });
      const autoMessage = `Auto-downloading Part ${completedPart.partNumber}… continuing capture in Part ${captureState.partNumber}.`;
      setStatusMessage(autoMessage, "info");
      sendPartStatusUpdate({
        autoDownload: true,
        message: autoMessage,
      });
    }
  } finally {
    rotationInProgress = false;
  }
}

function formatRemoteObject(remote) {
  if (!remote) {
    return "undefined";
  }
  if (remote.type === "string") {
    return typeof remote.value === "string"
      ? remote.value
      : remote.description || "";
  }
  if (remote.type === "number" || remote.type === "boolean") {
    return typeof remote.value !== "undefined"
      ? String(remote.value)
      : remote.description || String(remote.type);
  }
  if (remote.type === "undefined") {
    return "undefined";
  }
  if (remote.subtype === "null") {
    return "null";
  }
  if (remote.type === "object") {
    if (typeof remote.value !== "undefined") {
      try {
        return JSON.stringify(remote.value);
      } catch (error) {
        return String(remote.value);
      }
    }
    if (remote.description) {
      return String(remote.description);
    }
    return "[Object]";
  }
  if (remote.type === "function") {
    return remote.description || "[Function]";
  }
  return remote.description || String(remote.type);
}

function extractStackFromFrames(frames) {
  if (!Array.isArray(frames) || frames.length === 0) {
    return null;
  }
  return frames
    .map((frame) => {
      const url = frame.url || "<anonymous>";
      const line = typeof frame.lineNumber === "number" ? frame.lineNumber : 0;
      const column =
        typeof frame.columnNumber === "number" ? frame.columnNumber : 0;
      return `${url}:${line}:${column}`;
    })
    .join("\n");
}

function addConsoleEntry(entry) {
  const sanitized = sanitizeConsoleEntry(entry);
  const record = buildConsoleStorageRecord(sanitized);
  queueConsoleRecord(record);
}

function buildConsoleExportEntries() {
  return state.console.logs.map((entry, index) => {
    const timestampIso = entry.timestamp || nowIso();
    const timestampEpochMs = parseEpochMs(timestampIso);
    const relativeMs = computeSessionOffsetMs(timestampIso);
    return {
      id: `con_${String(index + 1).padStart(4, "0")}`,
      timestamp_ms: relativeMs,
      timestamp: timestampIso,
      timestamp_epoch_ms: timestampEpochMs,
      time_missing: timestampEpochMs === null ? true : undefined,
      level: entry.level || "log",
      message: typeof entry.message === "string" ? entry.message : "",
      args: Array.isArray(entry.args) ? entry.args : [],
      source: entry.source || "console",
      url: entry.url || null,
      line: typeof entry.line === "number" ? entry.line : null,
      column: typeof entry.column === "number" ? entry.column : null,
      stack: entry.stack || null,
    };
  });
}

function decodeResponseBody(entry) {
  if (!entry.responseBody) {
    return null;
  }
  let body = entry.responseBody;
  if (entry.responseBodyBase64) {
    try {
      body = atob(entry.responseBody);
    } catch (error) {
      body = entry.responseBody;
    }
  }
  return truncateToBytes(body, MAX_BODY_BYTES);
}

function buildNetworkExportEntries() {
  const orderedIds = state.network.order.length
    ? state.network.order
    : Object.keys(state.network.requests);
  const sliceIds =
    orderedIds.length > MAX_NETWORK_ENTRIES
      ? orderedIds.slice(-MAX_NETWORK_ENTRIES)
      : orderedIds;
  if (state.network.capped) {
    addDiagnostic("warning", `Network entries capped at ${MAX_NETWORK_ENTRIES}`);
    state.network.capped = false;
  }
  return sliceIds.map((id, index) => {
    const entry = state.network.requests[id] || {};
    const hasRequestHeaders =
      entry.requestHeaders && Object.keys(entry.requestHeaders).length > 0;
    const hasResponseHeaders =
      entry.responseHeaders && Object.keys(entry.responseHeaders).length > 0;
    const responseHeaders = hasResponseHeaders ? entry.responseHeaders : null;
    const skipBody = shouldSkipResponseBody(responseHeaders);
    const timestampIso = entry.timestampIso || nowIso();
    const timestampEpochMs = parseEpochMs(timestampIso);
    const relativeMs = computeSessionOffsetMs(timestampIso);
    const hasRequestBody = typeof entry.requestBody === "string";
    const hasResponseBody =
      !skipBody && typeof entry.responseBody === "string";
    return {
      id: `net_${String(index + 1).padStart(4, "0")}`,
      timestamp_ms: relativeMs,
      request_id: entry.id || null,
      timestamp: timestampIso,
      timestamp_epoch_ms: timestampEpochMs,
      time_missing: timestampEpochMs === null ? true : undefined,
      url: entry.url || null,
      method: entry.method || null,
      request_headers: hasRequestHeaders ? entry.requestHeaders : null,
      request_headers_unavailable: hasRequestHeaders ? undefined : true,
      request_post_data: hasRequestBody ? entry.requestBody : null,
      request_body_unavailable: hasRequestBody ? undefined : true,
      request_body_unavailable_reason: hasRequestBody ? null : "unavailable",
      response_status:
        typeof entry.status === "number" ? entry.status : null,
      response_status_text: entry.statusText || null,
      response_headers: responseHeaders,
      response_headers_unavailable: hasResponseHeaders ? undefined : true,
      response_mime_type: entry.mimeType || null,
      response_body_skipped: skipBody ? true : undefined,
      response_body: skipBody ? null : decodeResponseBody(entry),
      response_body_unavailable: hasResponseBody ? undefined : true,
      response_body_unavailable_reason: skipBody
        ? "binary_content"
        : hasResponseBody
          ? null
          : "unavailable",
      timing: entry.timing || null,
      from_disk_cache:
        typeof entry.fromDiskCache === "boolean" ? entry.fromDiskCache : null,
      from_service_worker:
        typeof entry.fromServiceWorker === "boolean"
          ? entry.fromServiceWorker
          : null,
      error_text: entry.errorText || null,
    };
  });
}

function normalizeDiagnosticLevel(level) {
  if (level === "warning") {
    return "warn";
  }
  if (level === "info" || level === "warn" || level === "error") {
    return level;
  }
  return "info";
}

function buildSessionExport() {
  if (!session) {
    return null;
  }
  return {
    session_id: session.session_id,
    created_at: session.created_at,
    ended_at: session.ended_at || null,
    mode: session.mode,
    state: session.state,
    active_tab: {
      tab_id: session.active_tab.tab_id,
      url: session.active_tab.url,
      title: session.active_tab.title,
    },
    counts: {
      network_requests: session.counts.network_requests,
      console_entries: session.counts.console_entries,
      errors: session.counts.errors,
    },
    filters: session.filters || activeFilters,
    filters_summary: session.filters_summary || buildFiltersSummary(activeFilters),
    diagnostics: session.diagnostics.map((entry) => ({
      timestamp: entry.timestamp,
      level: normalizeDiagnosticLevel(entry.level),
      message: entry.message,
    })),
  };
}

async function handleMessage(message, sender) {
  const legacyTypeMap = {
    START_SCREENSHOT: "TAKE_SCREENSHOT",
    CAPTURE_SCREENSHOT: "TAKE_SCREENSHOT",
    START_RECORDING: "RECORDING_START",
    PAUSE_RECORDING: "RECORDING_PAUSE",
    RESUME_RECORDING: "RECORDING_RESUME",
    STOP_RECORDING: "RECORDING_STOP",
    DOWNLOAD_ZIP: "DOWNLOAD_EVIDENCE_ZIP",
    DOWNLOAD_EVIDENCE_ZIP: "DOWNLOAD_EVIDENCE_ZIP",
    GET_ZIP_DATA: "GET_EVIDENCE_EXPORT_DATA",
  };
  const normalizedType = legacyTypeMap[message.type] || message.type;
  const normalizedMessage =
    normalizedType === message.type ? message : { ...message, type: normalizedType };
  console.log("[SW] msg", normalizedMessage.type);
  let result;
  switch (normalizedMessage.type) {
    case "PANEL_OVERLAY_CLOSED":
      if (sender && sender.tab && sender.tab.id) {
        const panel = normalizedMessage.panel === "logs" ? "logs" : "recording";
        markPanelClosed(sender.tab.id, panel, true);
      }
      result = { ok: true };
      break;
    case "OPEN_RECORDING_PANEL":
      try {
        const requestedTabId = Number.isFinite(normalizedMessage.tabId)
          ? normalizedMessage.tabId
          : null;
        const activeTargetTabId =
          recordingController.targetTabId ||
          recordingPanelTargetTabId ||
          requestedTabId;
        if (Number.isFinite(activeTargetTabId)) {
          recordingPanelTargetTabId = activeTargetTabId;
        }
        if (Number.isFinite(normalizedMessage.panelWindowId)) {
          recordingPanelWindowId = normalizedMessage.panelWindowId;
        }
        if (Number.isFinite(normalizedMessage.panelTabId)) {
          recordingPanelWindowTabId = normalizedMessage.panelTabId;
        }
        console.log("[REC][sw] OPEN_RECORDING_PANEL", {
          tabId: recordingPanelTargetTabId || null,
          currentRecordingState: recordingController.state || state.recording.status,
        });
        const focusResult = await focusRecordingPanelWindow();
        if (focusResult.ok) {
          result = { ok: true, action: "focused" };
          break;
        }
        if (normalizedMessage.openWindow === false) {
          result = { ok: false, reason: "panel_missing" };
          break;
        }
        const readyPromise = waitForRecordingPanelReady();
        await openRecordingPanelWindow(recordingPanelTargetTabId);
        readyPromise.then((ready) => {
          if (!ready || !ready.ok) {
            console.warn("[REC][sw] recording panel ready timeout");
          }
        });
        result = { ok: true, action: "opened" };
      } catch (error) {
        console.warn("[REC][sw] OPEN_RECORDING_PANEL failed", {
          error: error?.message || String(error),
          stack: error?.stack || null,
        });
        result = {
          ok: false,
          error: error?.message || "Failed to open recording panel.",
        };
      }
      break;
    case "OPEN_LOGS_PANEL":
      await openLogsPanelOverlay(
        typeof normalizedMessage.tabId === "number" ? normalizedMessage.tabId : null
      );
      result = { ok: true };
      break;
    case "OFFSCREEN_READY":
      offscreenReady = true;
      logRecordingDiagnostic("offscreen_ready", {
        stateBefore: recordingController.state,
        stateAfter: recordingController.state,
      });
      result = { ok: true };
      break;
    case "GET_STATUS":
      if (!captureState.sessionId) {
        await hydrateCaptureStateFromIdb();
      }
      if (captureState.sessionId) {
        await refreshLastCompletedPart();
      }
      result = { ok: true, state: getStatusSnapshot() };
      break;
    case "GET_RECORDING_PANEL_STATUS":
      result = { ok: true, state: getRecordingPanelStatus() };
      break;
    case "GET_CAPABILITIES":
      result = {
        ok: true,
        capabilities: {
          tabCaptureAvailable: Boolean(
            chrome?.tabCapture?.getMediaStreamId || chrome?.tabCapture?.capture
          ),
          debuggerApiPresent: Boolean(chrome?.debugger),
        },
      };
      break;
    case "PROBE_DEBUGGER": {
      let tabId = message.tabId;
      let tab = null;
      if (!tabId) {
        tab = await getActiveTab();
        tabId = tab && tab.id ? tab.id : null;
      }
      if (!tabId) {
        result = { ok: false, error: "No active tab" };
        break;
      }
      if (state.network.active && state.network.tabId === tabId) {
        result = { ok: true, debuggerAttachAllowed: true };
        break;
      }
      if (!tab) {
        try {
          tab = await chrome.tabs.get(tabId);
        } catch (error) {
          result = { ok: false, error: "No active tab" };
          break;
        }
      }
      try {
        ensureTabIsCapturable(tab);
      } catch (error) {
        result = {
          ok: false,
          error: error && error.message ? error.message : "Tab not capturable.",
        };
        break;
      }

      let attached = false;
      try {
        await attachDebugger(tabId);
        attached = true;
        result = { ok: true, debuggerAttachAllowed: true };
      } catch (error) {
        result = {
          ok: true,
          debuggerAttachAllowed: false,
          reason: error && error.message ? error.message : "Attach failed.",
        };
      } finally {
        if (attached) {
          try {
            await detachDebugger(tabId);
          } catch (error) {
            // Ignore detach failures for probe.
          }
        }
      }
      break;
    }
    case "GET_RECORDING_CAPABILITY":
      result = {
        ok: true,
        isTabCaptureAvailable: Boolean(chrome?.tabCapture?.capture),
      };
      break;
    case "FP_CAPTURE_VIEWPORT": {
      try {
        const windowId = sender && sender.tab ? sender.tab.windowId : null;
        const dataUrl = await captureVisibleTabThrottled(windowId, {
          minIntervalMs: FULL_CAPTURE_CONFIG.minCaptureIntervalMs,
          maxRetries: 1,
        });
        result = dataUrl;
      } catch (error) {
        result = {
          ok: false,
          error: error && error.message ? error.message : "Capture failed.",
        };
      }
      break;
    }
    case "CAPTURE_FULLPAGE":
      try {
        const captureResult = await captureFullPageScreenshot(
          normalizedMessage.tabId
        );
        result = { ok: true, ...captureResult };
      } catch (error) {
        console.log("[FULLPAGE][ERROR]", {
          code: error && error.code ? error.code : "UNKNOWN",
          message: error && error.message ? error.message : "Full capture failed.",
        });
        result = {
          ok: false,
          code: error && error.code ? error.code : "UNKNOWN",
          message:
            error && error.message
              ? error.message
              : "Full page screenshot failed.",
        };
      }
      if (DEBUG_FULLPAGE) {
        console.log("[FULLPAGE][SW][RESPONSE_TO_POPUP]", {
          ok: result?.ok,
          code: result?.code,
          message: result?.message,
          hasBlob: result?.blob instanceof Blob,
          blobType: result?.blob?.type,
          blobSize: result?.blob?.size,
          responseBlobSize: result?.blobSize,
          mimeType: result?.mimeType,
          status: result?.status,
          captureRunId: result?.captureRunId,
          artifactKey: result?.artifactKey,
          isPartial: result?.isPartial,
          coveragePercent: result?.coveragePercent,
          tileCountCaptured: result?.tileCountCaptured,
          tileCountExpected: result?.tileCountExpected,
          keys: result ? Object.keys(result) : null,
        });
        console.log("[FULLPAGE][SW][POPUP_RESPONSE]", {
          ok: result?.ok,
          status: result?.status,
          captureRunId: result?.captureRunId,
          artifactKey: result?.artifactKey,
          isPartial: result?.isPartial,
          coveragePercent: result?.coveragePercent,
        });
      }
      break;
    case "TAKE_SCREENSHOT":
      try {
        const dataUrl = await enqueueScreenshotCapture("message_take_screenshot", () =>
          captureScreenshot()
        );
        if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/png")) {
          result = {
            ok: false,
            error: "Screenshot capture failed to return a PNG data URL.",
          };
          break;
        }
        result = { ok: true, screenshotDataUrl: dataUrl };
      } catch (error) {
        result = {
          ok: false,
          error: error && error.message ? error.message : "Screenshot failed.",
        };
      }
      break;
    case "CAPTURE_SCREENSHOT": {
      try {
        const dataUrl = await enqueueScreenshotCapture(
          "message_capture_screenshot",
          () => captureScreenshot()
        );
        result = { ok: true, screenshotDataUrl: dataUrl };
      } catch (error) {
        result = {
          ok: false,
          error: error && error.message ? error.message : "Screenshot failed.",
        };
      }
      break;
    }
    case "SET_ANNOTATION_STYLE":
      if (message && message.mapped) {
        await chrome.storage.session.set({
          annotationSettings: message.mapped,
        });
      }
      result = { ok: true };
      break;
    case "GET_ANNOTATION_STYLE": {
      const resultData = await chrome.storage.session.get({
        annotationSettings: null,
      });
      result = { ok: true, style: resultData.annotationSettings };
      break;
    }
    case "RECORDING_START":
      try {
        const requestedMode =
          normalizedMessage.sessionMode === "session" ? "session" : "recording";
        const lock = checkStartMode(requestedMode);
        if (!lock.allowed) {
          if (lock.reason === "already_running") {
            result = {
              ok: true,
              message: lock.message,
              state: getStatusSnapshot(),
            };
            break;
          }
          if (session) {
            session.state = "error";
          }
          result = {
            ok: false,
            error: lock.message,
            state: getStatusSnapshot(),
          };
          break;
        }
        const response = await startRecording(
          message.streamId,
          message.tabId,
          message.mimeType,
          { sessionMode: requestedMode }
        );
        if (session) {
          session.state = "capturing";
        }
        result = response || { ok: true };
      } catch (error) {
        if (session) {
          session.state = "error";
        }
        setStatusMessage(
          error && error.message ? error.message : "Failed to start recording.",
          "error"
        );
        result = {
          ok: false,
          error: error && error.message ? error.message : "Failed to start recording.",
          state: getStatusSnapshot(),
        };
      }
      break;
    case "RECORDING_GET_STATE": {
      try {
        await ensureOffscreenReady();
        const response = await sendMessageToOffscreen({
          type: "RECORDING_GET_STATE",
        });
        if (response && response.ok) {
          syncRecordingState(response);
        }
        result = response || { ok: false, error: "No response from offscreen." };
      } catch (error) {
        result = {
          ok: false,
          error: error && error.message ? error.message : "Failed to get state.",
        };
      }
      break;
    }
    case "RECORDING_EXPORT_WEBM": {
      try {
        await ensureOffscreenReady();
        const response = await sendMessageToOffscreen({
          type: "RECORDING_EXPORT_WEBM",
        });
        result = response || { ok: false, error: "No response from offscreen." };
      } catch (error) {
        result = {
          ok: false,
          error: error && error.message ? error.message : "Export failed.",
        };
      }
      break;
    }
    case "RECORDING_DATA_AVAILABLE":
      state.recording.hasData = true;
      result = { ok: true };
      break;
    case "RECORDING_PAUSE":
      result = await pauseRecording();
      break;
    case "RECORDING_RESUME":
      result = await resumeRecording();
      break;
    case "RECORDING_STOP":
      result = await stopRecording();
      break;
    case "RECORDING_RESET": {
      try {
        await ensureOffscreenReady();
        const response = await sendMessageToOffscreen({
          type: "RECORDING_RESET",
        });
        syncRecordingState(response);
        state.recording.dataUrl = null;
        state.recording.mimeType = null;
        state.recording.capturedAt = null;
        state.recording.error = null;
        state.recording.hasData = false;
        state.recording.videoBlobUrl = null;
        state.recording.videoMime = null;
        state.recording.videoByteLength = null;
        recordingController.sessionId = null;
        recordingController.targetTabId = null;
        recordingController.lastError = null;
        setRecordingState("idle");
        if (session && session.mode === "recording") {
          session = null;
        }
        clearStatusMessage();
        result = response || { ok: true };
      } catch (error) {
        result = {
          ok: false,
          error: error && error.message ? error.message : "Failed to reset recording.",
        };
      }
      break;
    }
    case "NETWORK_START":
      {
        const lock = checkStartMode("network_console", {
          allowExistingSession: normalizedMessage.allowExistingSession === true,
        });
        if (!lock.allowed) {
          if (lock.reason === "already_running") {
            result = {
              ok: true,
              message: lock.message,
              state: getStatusSnapshot(),
            };
            break;
          }
          result = {
            ok: false,
            error: lock.message,
            state: getStatusSnapshot(),
          };
          break;
        }
      }
      try {
        const captureResult = await startNetworkCapture(normalizedMessage.filters, {
          allowExistingSession: normalizedMessage.allowExistingSession === true,
        });
        result = {
          ok: true,
          consoleEnabled: captureResult.consoleEnabled,
          state: getStatusSnapshot(),
        };
      } catch (error) {
        const message =
          error && error.message ? error.message : "Failed to start capture.";
        result = {
          ok: false,
          error: message,
          code: error && error.code ? error.code : undefined,
          state: getStatusSnapshot(),
        };
      }
      break;
    case "LOGS_PAUSE":
      try {
        result = await pauseLogsCapture();
      } catch (error) {
        result = {
          ok: false,
          error: error && error.message ? error.message : "Failed to pause logs.",
        };
      }
      break;
    case "LOGS_RESUME":
      try {
        result = await resumeLogsCapture();
      } catch (error) {
        result = {
          ok: false,
          error: error && error.message ? error.message : "Failed to resume logs.",
        };
      }
      break;
    case "NETWORK_STOP":
      await stopNetworkCapture();
      result = { ok: true };
      break;
    case "GET_EXPORT_DATA":
      if (!session && !hasExportableArtifacts()) {
        result = { ok: false, error: "No session to export yet." };
        break;
      }
      result = { ok: true, data: await buildEvidenceExportData(normalizedMessage) };
      break;
    case "GET_EVIDENCE_EXPORT_DATA":
      if (!session && !hasExportableArtifacts()) {
        result = { ok: false, error: "No session to export yet." };
        break;
      }
      result = { ok: true, data: await buildEvidenceExportData(normalizedMessage) };
      break;
    case "SET_CAPTURE_SETTINGS":
      await chrome.storage.local.set({
        autoDownloadOnRollover: normalizedMessage.autoDownloadOnRollover === true,
        partCapRequests: normalizedMessage.partCapRequests,
        maxBodyKb: normalizedMessage.maxBodyKb,
      });
      await loadCaptureSettings();
      result = {
        ok: true,
        settings: {
          autoDownloadOnRollover: captureState.autoDownloadOnRollover,
          partCapRequests: captureState.capRequests,
          maxBodyKb: Math.round(captureState.maxBodyBytes / 1024),
        },
      };
      break;
    case "SET_TIMESTAMP_OVERLAY":
      await chrome.storage.local.set({
        timestampOverlay: normalizedMessage.enabled === true,
      });
      timestampOverlayEnabled = normalizedMessage.enabled === true;
      if (
        state.recording.status === "recording" ||
        state.recording.status === "paused"
      ) {
        if (!recordingOverlayState.startMs) {
          recordingOverlayState.startMs =
            typeof state.recording.videoStartEpochMs === "number"
              ? state.recording.videoStartEpochMs
              : Date.now();
        }
        if (!recordingOverlayState.tabId && session && session.active_tab) {
          recordingOverlayState.tabId = session.active_tab.tab_id;
        }
        await applyRecordingTimestampOverlay();
      } else if (recordingOverlayState.tabId) {
        await removeTimestampOverlay(recordingOverlayState.tabId);
      }
      result = { ok: true, enabled: timestampOverlayEnabled };
      break;
    case "GET_COMPLETED_PARTS":
      if (!captureState.sessionId) {
        await hydrateCaptureStateFromIdb();
      }
      result = { ok: true, parts: await listCompletedParts() };
      break;
    case "EXPORT_PART":
      {
        const partId = normalizedMessage.partId;
        if (!partId || !isIdbAvailable()) {
          result = { ok: false, error: "Part not found." };
          break;
        }
        const record = await ReproIdb.getByKey("parts", partId);
        if (!record) {
          result = { ok: false, error: "Part not found." };
          break;
        }
        if (
          record.status === PART_STATUS.EXPORTING ||
          (exportJob && exportJob.partId === partId) ||
          exportQueueIds.has(partId)
        ) {
          result = { ok: false, error: "Part is already exporting." };
          break;
        }
        if (record.status === PART_STATUS.ACTIVE) {
          result = { ok: false, error: "Stop to download the current part." };
          break;
        }
        await flushQueues();
        const enqueueResult = await enqueueExport(
          {
            partId: record.partId,
            partNumber: record.partNumber,
            requestCount: record.requestCount || 0,
          },
          { allowDuplicate: true, auto: false, reason: "manual" }
        );
        result = enqueueResult.ok
          ? { ok: true, accepted: true }
          : { ok: false, error: enqueueResult.error };
      }
      break;
    case "DELETE_PART":
      {
        const partId = normalizedMessage.partId;
        const deleteResult = await deletePart(partId);
        result = deleteResult.ok
          ? { ok: true }
          : { ok: false, error: deleteResult.error };
      }
      break;
    case "CLEAR_ALL_CAPTURE_DATA":
      {
        const clearResult = await clearAllCaptureData();
        result = clearResult.ok
          ? { ok: true }
          : { ok: false, error: clearResult.error };
      }
      break;
    case "EXPORT_EVIDENCE_ZIP_REQUEST":
      if (session && session.mode === "recording") {
        result = {
          ok: false,
          accepted: false,
          error: "Session export is unavailable for screen-only recordings.",
        };
        break;
      }
      if (session && session.mode === "session" && session.state !== "stopped") {
        result = {
          ok: false,
          accepted: false,
          error: "Session is still active or finalizing. Stop and wait before exporting.",
        };
        break;
      }
      if (!session && !hasExportableArtifacts()) {
        result = { ok: false, accepted: false, error: "No session to export yet." };
        break;
      }
      {
        const jobId = buildExportJobId("evidence");
        const job = {
          jobId,
          kind: "export_zip",
          run: async () =>
            runEvidenceZipExport({ ...normalizedMessage, exportJobId: jobId }),
        };
        const enqueueResult = await enqueueExportJob(job);
        result = enqueueResult.ok
          ? { ok: true, accepted: true, queued: true }
          : { ok: false, accepted: false, error: enqueueResult.error };
      }
      break;
    case "DOWNLOAD_EVIDENCE_ZIP":
      if (session && session.mode === "recording") {
        result = {
          ok: false,
          accepted: false,
          error: "Session export is unavailable for screen-only recordings.",
        };
        break;
      }
      if (session && session.mode === "session" && session.state !== "stopped") {
        result = {
          ok: false,
          accepted: false,
          error: "Session is still active or finalizing. Stop and wait before exporting.",
        };
        break;
      }
      if (!session && !hasExportableArtifacts()) {
        result = { ok: false, accepted: false, error: "No session to export yet." };
        break;
      }
      {
        const jobId = buildExportJobId("evidence");
        const job = {
          jobId,
          kind: "export_zip",
          run: async () =>
            runEvidenceZipExport({ ...normalizedMessage, exportJobId: jobId }),
        };
        const enqueueResult = await enqueueExportJob(job);
        result = enqueueResult.ok
          ? { ok: true, accepted: true, queued: true }
          : { ok: false, accepted: false, error: enqueueResult.error };
      }
      break;
    case "CONSOLE_LOG":
      if (
        state.console.active &&
        sender.tab &&
        sender.tab.id === state.console.tabId
      ) {
        if (isLogsCapturing()) {
          addConsoleEntry({
            ...message.payload,
            tabId: sender.tab.id,
          });
        } else if (DEBUG_LOGS_PAUSE) {
          const now = Date.now();
          if (now - lastLogsPauseLogMs > 5000) {
            lastLogsPauseLogMs = now;
            console.log("[LOGS][PAUSED][IGNORED_CONSOLE]", {
              tabId: sender.tab.id,
            });
          }
        }
      }
      result = { ok: true };
      break;
    case "RECORDING_COMPLETE":
      state.recording.status = "stopped";
      state.recording.dataUrl = message.dataUrl;
      state.recording.mimeType = message.mimeType;
      state.recording.capturedAt = nowIso();
      state.recording.error = null;
      state.recording.hasData = true;
      if (typeof state.recording.videoEndEpochMs !== "number") {
        state.recording.videoEndEpochMs = Date.now();
      }
      markSessionStopped();
      updateSessionCounts();
      result = { ok: true };
      break;
    case "RECORDING_CLEANUP_SESSION": {
      const sessionId =
        message && message.sessionId ? message.sessionId : state.recording.sessionId;
      const cleanupResult = await cleanupRecordingSessionData(sessionId, {
        removeArtifacts: true,
        reason: "download",
      });
      result = { ok: true, ...cleanupResult };
      break;
    }
    case "RECORDING_STATE_CHANGED":
      if (message && message.state) {
        syncRecordingState(message.state);
      }
      result = { ok: true };
      break;
    case "RECORDING_PANEL_READY":
      console.log("[REC][sw] recording panel ready", {
        tabId: message && typeof message.targetTabId === "number" ? message.targetTabId : null,
        panelUrl: message && message.panelUrl ? message.panelUrl : null,
        windowId: recordingPanelWindowId || null,
      });
      if (sender && sender.tab) {
        if (Number.isFinite(sender.tab.windowId)) {
          recordingPanelWindowId = sender.tab.windowId;
        }
        if (Number.isFinite(sender.tab.id)) {
          recordingPanelWindowTabId = sender.tab.id;
        }
      }
      if (message && Number.isFinite(message.targetTabId)) {
        recordingPanelTargetTabId = message.targetTabId;
      }
      if (recordingPanelReadyWaiter && typeof recordingPanelReadyWaiter.resolve === "function") {
        recordingPanelReadyWaiter.resolve({ ok: true });
      }
      result = { ok: true };
      break;
    case "RECORDING_STARTED":
    case "RECORDING_PAUSED":
    case "RECORDING_RESUMED":
    case "RECORDING_STOPPING":
    case "RECORDING_STOPPED":
      if (message && message.state) {
        syncRecordingState(message.state);
      }
      logRecordingDiagnostic("offscreen_event", {
        stateBefore: recordingController.state,
        stateAfter: recordingController.state,
      });
      result = { ok: true };
      break;
    case "RECORDING_TRACK_ENDED": {
      const sessionId =
        message && message.sessionId ? message.sessionId : state.recording.sessionId;
      const recordingTabId = recordingOverlayState.tabId;
      console.log("[RECORDING][TRACK_ENDED]", {
        sessionId: sessionId || null,
        reason: "track_ended",
      });
      if (recordingOverlayState.tabId) {
        await removeTimestampOverlay(recordingOverlayState.tabId);
      }
      recordingOverlayState.startMs = null;
      recordingOverlayState.paused = false;
      recordingOverlayState.pauseStartedAt = null;
      recordingOverlayState.totalPausedMs = 0;
      recordingOverlayState.tabId = null;
      try {
        await ensureOffscreenReady();
        const exportResponse = await sendMessageToOffscreen({
          type: "RECORDING_EXPORT_WEBM",
        });
        if (exportResponse && exportResponse.ok && exportResponse.blobUrl) {
          state.recording.videoBlobUrl = exportResponse.blobUrl;
          state.recording.videoMime = exportResponse.mimeType || null;
          state.recording.videoByteLength =
            typeof exportResponse.size === "number" ? exportResponse.size : null;
          setStatusMessage(
            "Recording ended early. Partial recording saved.",
            "success"
          );
          if (sessionId) {
            await updateRecordingSessionRecord(sessionId, {
              status: "partial_complete",
              isPartial: true,
              failureReason: "track_ended",
            });
          }
          console.log("[RECORDING][FINALIZE]", {
            sessionId: sessionId || null,
            status: "partial_complete",
            artifactSize: exportResponse.size || null,
            isPartial: true,
          });
          await restorePanelAfterRecording(recordingTabId);
          setRecordingState("idle", { errorMessage: "Track ended." });
          result = { ok: true, partial: true };
          break;
        }
      } catch (error) {
        console.warn("[RECORDING][TRACK_ENDED_EXPORT_FAILED]", error);
      }
      await restorePanelAfterRecording(recordingTabId);
      setRecordingState("idle", { errorMessage: "Track ended." });
      result = { ok: true, partial: false };
      break;
    }
    case "RECORDING_ERROR":
      {
        const errorMessage = message.error || "Recording failed.";
        recordingController.lastError = errorMessage;
        if (recordingController.state !== "idle") {
          setRecordingState("error", { errorMessage });
        }
        state.recording.error = errorMessage;
      }
      state.recording.hasData = Boolean(state.recording.dataUrl);
      addDiagnostic("error", "Recording failed.", {
        error: message.error || "Recording failed.",
      });
      if (recordingOverlayState.tabId) {
        const recordingTabId = recordingOverlayState.tabId;
        recordingOverlayState.tabId = null;
        await restorePanelAfterRecording(recordingTabId);
      }
      if (recordingController.state !== "idle") {
        setRecordingState("idle", {
          errorMessage: message.error || "Recording failed.",
        });
      }
      result = { ok: true };
      break;
    case "NETWORK_RESET":
      await resetNetworkState();
      result = { ok: true, state: getStatusSnapshot() };
      break;
    case "RESET_TO_FRESH_START":
      if (exportJob && exportJob.active) {
        result = {
          ok: false,
          code: "reset_blocked",
          error: "Reset blocked while export/finalizing is active.",
        };
        break;
      }
      if (session && session.state === "finalizing") {
        result = {
          ok: false,
          code: "reset_blocked",
          error: "Reset blocked while export/finalizing is active.",
        };
        break;
      }
      await resetSession();
      {
        const clearResult = await clearAllCaptureData();
        if (!clearResult.ok) {
          result = { ok: false, error: clearResult.error };
          break;
        }
      }
      result = { ok: true, state: getStatusSnapshot() };
      break;
    case "RESET_SESSION":
      await resetSession();
      result = { ok: true, state: getStatusSnapshot() };
      break;
    default:
      console.warn("[SW] Unknown message type:", normalizedMessage.type);
      result = {
        ok: false,
        error: `Unknown message type: ${normalizedMessage.type}`,
      };
      break;
  }
  console.log("[SW] reply", result);
  return result;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      const result = await handleMessage(msg, sender);
      sendResponse(result ?? { ok: true });
    } catch (e) {
      console.log("[SW] error", e);
      sendResponse({ ok: false, error: e?.message || String(e) });
    }
  })();
  return true;
});

chrome.windows.onRemoved.addListener((windowId) => {
  if (recordingPanelWindowId && windowId === recordingPanelWindowId) {
    recordingPanelWindowId = null;
    recordingPanelWindowTabId = null;
    recordingPanelTargetTabId = null;
  }
});

chrome.downloads.onChanged.addListener((delta) => {
  if (!delta || typeof delta.id !== "number") {
    return;
  }
  if (
    delta.state &&
    (delta.state.current === "complete" || delta.state.current === "interrupted")
  ) {
    const entry = brokerDownloadUrls.get(delta.id);
    if (!entry) {
      return;
    }
    brokerDownloadUrls.delete(delta.id);
    if (entry.url) {
      chrome.runtime.sendMessage({
        type: "BROKER_REVOKE_URL",
        payload: { url: entry.url },
      });
    }
    if (entry.artifactKey && delta.state.current === "complete") {
      if (globalThis.ReproIdb) {
        ReproIdb.deleteByKey("export_artifacts", entry.artifactKey).catch(() => {});
      }
    }
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (!port || port.name !== POPUP_CAPTURE_PORT_NAME) {
    return;
  }
  let pendingRequest = null;
  port.onMessage.addListener((message) => {
    if (message && message.type === "CAPTURE_REQUEST") {
      pendingRequest = message;
    }
  });
  port.onDisconnect.addListener(() => {
    if (!pendingRequest) {
      return;
    }
    const mode = pendingRequest.mode || "snap";
    console.log("[CAPTURE][SW][POPUP_DISCONNECTED]", { mode });
    setTimeout(() => {
      console.log("[CAPTURE][SW][START_AFTER_DISMISS]", {
        mode,
        delayMs: POPUP_CAPTURE_DELAY_MS,
      });
      handlePopupCaptureRequest(pendingRequest);
    }, POPUP_CAPTURE_DELAY_MS);
  });
});
