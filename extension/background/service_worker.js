try {
  importScripts(chrome.runtime.getURL("utils/redact.js"));
} catch (error) {
  // Redaction helper is optional; export will fall back to raw values.
}

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
    chrome.runtime.getURL("lib/jszip.min.js"),
    chrome.runtime.getURL("lib/zipBuilderChunked.js")
  );
} catch (error) {
  console.warn("Zip builder unavailable:", error);
}

const DEBUGGER_PROTOCOL_VERSION = "1.3";
const MAX_BODY_BYTES = 2000000;
const MAX_NETWORK_ENTRIES = 5000;
const MAX_CONSOLE_ENTRIES = 5000;
const MAX_CONSOLE_ENTRY_BYTES = 50000;
const FULLPAGE_MAX_HEIGHT = 30000;
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

const MODE_LABELS = {
  screenshot: "Screenshot",
  recording: "Recording",
  network_console: "Network + Console",
};

let session = null;
let statusMessage = null;
let offscreenReady = false;
let offscreenCreating = null;
let recordingPanelWindowId = null;
let exportPhase = null;
let exportJob = null;

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
}

function isZipBuilderAvailable() {
  return Boolean(globalThis.JSZip) && Boolean(globalThis.ZipBuilderChunked);
}

async function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  try {
    const downloadId = await new Promise((resolve, reject) => {
      chrome.downloads.download(
        {
          url,
          filename,
          saveAs: false,
        },
        (id) => {
          if (chrome.runtime.lastError || !id) {
            reject(
              new Error(
                chrome.runtime.lastError
                  ? chrome.runtime.lastError.message
                  : "Download failed."
              )
            );
            return;
          }
          resolve(id);
        }
      );
    });
    return downloadId;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
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

function dataUrlToBlob(dataUrl) {
  return fetch(dataUrl).then((res) => res.blob());
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

async function openRecordingPanelWindow() {
  if (recordingPanelWindowId) {
    try {
      await chrome.windows.update(recordingPanelWindowId, { focused: true });
      return;
    } catch (error) {
      recordingPanelWindowId = null;
    }
  }
  const created = await chrome.windows.create({
    url: chrome.runtime.getURL("popup/recording_panel.html"),
    type: "popup",
    width: 340,
    height: 240,
    focused: true,
  });
  recordingPanelWindowId = created && created.id ? created.id : null;
}

function closeRecordingPanelWindowIfOpen() {
  if (!recordingPanelWindowId) {
    return;
  }
  chrome.windows.remove(recordingPanelWindowId, () => {
    void chrome.runtime.lastError;
  });
  recordingPanelWindowId = null;
}

chrome.windows.onRemoved.addListener((id) => {
  if (id === recordingPanelWindowId) {
    recordingPanelWindowId = null;
  }
});

function createSessionId() {
  if (crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const random = Math.random().toString(16).slice(2);
  return `session_${Date.now()}_${random}`;
}

function updateSessionCounts() {
  if (!session) {
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

function checkStartMode(mode) {
  if (!session) {
    return { allowed: true };
  }
  const active =
    session.state === "capturing" ||
    session.state === "paused" ||
    state.recording.status === "recording" ||
    state.recording.status === "paused" ||
    state.network.active;
  if (active) {
    if (session.mode === mode) {
      const message = `${describeMode(mode)} capture is already running.`;
      setStatusMessage(message, "info");
      return { allowed: false, reason: "already_running", message };
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

function createSession(mode, tab) {
  chrome.storage.session.remove(["annotationSettings"]);
  const monotonicBaseline = captureMonotonicBaseline();
  session = {
    session_id: createSessionId(),
    created_at: nowIso(),
    ended_at: null,
    mode,
    state: "capturing",
    pause_started_at: null,
    total_paused_ms: 0,
    screenshots: [],
    markers: [],
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
  };
}

function ensureSessionForMode(mode, tab) {
  if (session) {
    if (session.mode === mode && session.state === "error") {
      session.state = "capturing";
      session.ended_at = null;
      clearStatusMessage();
      return;
    }
    throw new Error("A session already exists. Reset to start a new capture.");
  }
  createSession(mode, tab);
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

function markSessionStopped() {
  if (!session) {
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
  const markerCount =
    session && Array.isArray(session.markers) ? session.markers.length : 0;
  return {
    hasScreenshot: Boolean(state.screenshot.dataUrl) || screenshotCount > 0,
    hasRecording: Boolean(state.recording.dataUrl) || Boolean(state.recording.hasData),
    hasNetworkLogs: Object.keys(state.network.requests).length > 0,
    hasConsoleLogs: state.console.logs.length > 0,
    hasAnyArtifacts:
      Boolean(state.screenshot.dataUrl) ||
      Boolean(state.recording.dataUrl) ||
      Boolean(state.recording.hasData) ||
      Object.keys(state.network.requests).length > 0 ||
      state.console.logs.length > 0 ||
      markerCount > 0,
  };
}

function hasExportableArtifacts() {
  const screenshotCount =
    session && Array.isArray(session.screenshots) ? session.screenshots.length : 0;
  const markerCount =
    session && Array.isArray(session.markers) ? session.markers.length : 0;
  const hasRecording = Boolean(state.recording.dataUrl) || state.recording.hasData;
  const hasNetwork = Object.keys(state.network.requests).length > 0;
  const hasConsole = state.console.logs.length > 0;
  const hasScreenshot = Boolean(state.screenshot.dataUrl) || screenshotCount > 0;
  return (
    hasRecording ||
    hasNetwork ||
    hasConsole ||
    hasScreenshot ||
    markerCount > 0
  );
}

function getStatusSnapshot() {
  updateSessionCounts();
  const artifacts = getArtifactsSnapshot();
  return {
    screenshotCapturedAt: state.screenshot.capturedAt,
    recordingStatus: state.recording.status,
    recordingCapturedAt: state.recording.capturedAt,
    networkActive: state.network.active,
    networkCount: Object.keys(state.network.requests).length,
    consoleCount: state.console.logs.length,
    session,
    artifacts,
    hasArtifacts: artifacts.hasAnyArtifacts,
    statusMessage,
  };
}

function syncRecordingState(snapshot) {
  if (!snapshot) {
    return;
  }
  const nextState = snapshot.state || "idle";
  state.recording.status = nextState;
  state.recording.hasData = Boolean(snapshot.hasData);
  if (snapshot.mimeType) {
    state.recording.mimeType = snapshot.mimeType;
  }
  if (snapshot.lastError) {
    state.recording.error = snapshot.lastError;
  }
  if (nextState === "recording") {
    if (typeof state.recording.videoStartEpochMs !== "number") {
      state.recording.videoStartEpochMs = Date.now();
    }
    state.recording.videoEndEpochMs = null;
    setSessionState("capturing");
  } else if (nextState === "paused") {
    setSessionState("paused");
  } else if (nextState === "idle" && session && session.mode === "recording") {
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
  const exportMetadata = {
    zip_created_at_utc: exportCreatedAt.toISOString(),
    zip_created_at_local: exportCreatedAt.toString(),
    zip_created_at_epoch_ms: exportCreatedAt.getTime(),
    zip_builder_version: extensionVersion || null,
    redaction_enabled:
      typeof redactionEnabled === "boolean" ? redactionEnabled : null,
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
        ? `qa-screenshot-fullpage-${exportTimestamp}.png`
        : `qa-screenshot-${String(displayIndex).padStart(
            3,
            "0"
          )}-${exportTimestamp}.png`,
    };
  });
  const markerEntries =
    session && Array.isArray(session.markers) ? session.markers : [];
  const markerList = markerEntries.map((entry) => {
    const timestampIso = entry.timestampIso || entry.timestamp || nowIso();
    return {
      timestampIso,
      timestamp: timestampIso,
      t_ms:
        typeof entry.t_ms === "number"
          ? entry.t_ms
          : computeSessionOffsetMs(timestampIso),
      note: typeof entry.note === "string" ? entry.note : "Marker",
    };
  });
  const screenshotDownloads = screenshotList.map((meta, index) => ({
    ...meta,
    dataUrl: screenshotEntries[index] ? screenshotEntries[index].dataUrl : null,
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
        fileName: `qa-session-video-${exportTimestamp}.webm`,
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
  };
}

async function runEvidenceZipExport(context) {
  if (exportJob && exportJob.active) {
    throw new Error("Export already in progress.");
  }
  exportJob = {
    active: true,
    startedAt: Date.now(),
    lastProgress: 0,
  };
  const exportStartIso = nowIso();
  reportExportProgress(1, "export_start", { startedAt: exportStartIso });
  try {
    if (!isZipBuilderAvailable()) {
      throw new Error("Zip builder unavailable.");
    }
    reportExportProgress(5, "prepare_data");
    const data = await buildEvidenceExportData(context);
    const networkCount =
      data.networkLogs && Array.isArray(data.networkLogs.entries)
        ? data.networkLogs.entries.length
        : 0;
    const consoleCount =
      data.consoleLogs && Array.isArray(data.consoleLogs.entries)
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
    reportExportProgress(12, "stringify_start");
    const jsonSizes = {
      network_logs: 0,
      console_logs: 0,
      session: 0,
      environment: 0,
      qa_session_log: 0,
      export_metadata: 0,
      export_truncation_report: 0,
      qa_summary: data.qaSummaryText ? data.qaSummaryText.length : 0,
    };
    const zip = new JSZip();
    const zipDate =
      data.session && data.session.ended_at
        ? new Date(data.session.ended_at)
        : new Date();
    const toJsonWithSize = (value, key) => {
      const json = JSON.stringify(value || {}, null, 2);
      jsonSizes[key] = json.length;
      return json;
    };
    const baseItems = [
      {
        path: "network_logs.json",
        getData: () =>
          toJsonWithSize(
            data.networkLogs || { version: "1.0", entries: [] },
            "network_logs"
          ),
        options: { date: zipDate },
      },
      {
        path: "console_logs.json",
        getData: () =>
          toJsonWithSize(
            data.consoleLogs || { version: "1.0", entries: [] },
            "console_logs"
          ),
        options: { date: zipDate },
      },
      {
        path: "session.json",
        getData: () => toJsonWithSize(data.session || {}, "session"),
        options: { date: zipDate },
      },
      {
        path: "environment.json",
        getData: () => toJsonWithSize(data.environment || {}, "environment"),
        options: { date: zipDate },
      },
      {
        path: "export_metadata.json",
        getData: () =>
          toJsonWithSize(data.exportMetadata || {}, "export_metadata"),
        options: { date: zipDate },
      },
    ];
    if (data.qaSessionLog) {
      baseItems.push({
        path: "qa-session-log.json",
        getData: () =>
          toJsonWithSize(data.qaSessionLog || {}, "qa_session_log"),
        options: { date: zipDate },
      });
    }
    if (data.qaSummaryText) {
      baseItems.push({
        path: "qa-summary.txt",
        data: data.qaSummaryText,
        options: { date: zipDate },
      });
    }
    if (data.exportTruncationReport) {
      baseItems.push({
        path: "export_truncation_report.json",
        getData: () =>
          toJsonWithSize(
            data.exportTruncationReport || {},
            "export_truncation_report"
          ),
        options: { date: zipDate },
      });
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
    if (Array.isArray(data.screenshots)) {
      data.screenshots.forEach((shot) => {
        if (!shot || !shot.dataUrl) {
          return;
        }
        const name =
          shot.fileName || `qa-screenshot-${formatZipTimestamp(new Date())}.png`;
        screenshotItems.push({
          path: `screenshots/${name}`,
          getData: () => dataUrlToBlob(shot.dataUrl),
          options: { date: zipDate },
        });
      });
    } else if (data.screenshotDataUrl) {
      screenshotItems.push({
        path: "screenshots/screenshot.png",
        getData: () => dataUrlToBlob(data.screenshotDataUrl),
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

    const exportTimestamp =
      data.exportTimestamp || formatExportTimestamp(new Date());
    let recordingBlob = null;
    let recordingFileName = `qa-session-video-${exportTimestamp}.webm`;
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

    reportExportProgress(78, "zip_generate_start");
    const zipBlob = await ZipBuilderChunked.generateZipBlob(zip, {
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
    logExportPhase("zip_generate_done", { bytes: zipBlob.size });
    reportExportProgress(96, "zip_generate_done", { bytes: zipBlob.size });

    const filename = `evidence_${formatZipTimestamp(new Date())}.zip`;
    await downloadBlob(zipBlob, filename);
    reportExportProgress(100, "zip_download", { filename });
    sendExportEvent("EXPORT_EVIDENCE_ZIP_DONE", { filename });
  } catch (error) {
    console.error("[EXPORT] Failed", error && error.stack ? error.stack : error);
    sendExportEvent("EXPORT_EVIDENCE_ZIP_ERROR", {
      userMessage: "Export failed. Check extension logs.",
      debugCode: error && error.message ? error.message : "unknown",
    });
    throw error;
  } finally {
    if (exportJob) {
      exportJob.active = false;
    }
  }
}

function sendMessageToTab(tabId, message) {
  if (!tabId) {
    return;
  }
  chrome.tabs.sendMessage(tabId, message, () => {
    void chrome.runtime.lastError;
  });
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
        reject(new Error(chrome.runtime.lastError.message));
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
    reasons: ["USER_MEDIA"],
    justification: "Record active tab video while popup is closed.",
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
  const response = await sendMessageToOffscreen({ type: "OFFSCREEN_PING" });
  if (!response.ok || response.owner !== "recording_offscreen") {
    try {
      await chrome.offscreen.closeDocument();
    } catch (error) {
      // Ignore close failures and retry creation.
    }
    await ensureOffscreenDocument();
    const retry = await sendMessageToOffscreen({ type: "OFFSCREEN_PING" });
    if (!retry.ok || retry.owner !== "recording_offscreen") {
      throw new Error(retry.error || "Offscreen document not ready.");
    }
  }
  offscreenReady = true;
}

async function captureScreenshot() {
  const tab = await getActiveTab();
  ensureTabIsCapturable(tab);
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: "png" });
    const timestampIso = nowIso();
    state.screenshot.dataUrl = dataUrl;
    state.screenshot.capturedAt = timestampIso;
    if (session) {
      const tMs = computeSessionOffsetMs(timestampIso);
      const index = session.screenshots.length + 1;
      const blob = dataUrlToBlob(dataUrl);
      session.screenshots.push({
        index,
        timestampIso,
        t_ms: tMs,
        blob,
        fileName: `qa-screenshot-${String(index).padStart(3, "0")}.png`,
        dataUrl,
      });
    }
    clearStatusMessage();
    return dataUrl;
  } catch (error) {
    addDiagnostic("error", "Screenshot capture failed.", {
      error: error.message || String(error),
    });
    throw error;
  }
}

async function captureFullPageScreenshot(requestedTabId) {
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
  if (!chrome.scripting || !chrome.scripting.executeScript) {
    const error = new Error("Scripting API unavailable for full page capture.");
    error.code = "INJECT_FAILED";
    throw error;
  }

  try {
    console.log("[FULL][SW]", { step: "received", tabId, url: tab.url });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content/fullpage_capture.js"],
    });
  } catch (error) {
    console.log("[FULL][SW]", { step: "inject_failed", error: error?.message });
    const err = new Error("Not supported on this page.");
    err.code = "INJECT_FAILED";
    err.details = error && error.message ? error.message : String(error);
    throw err;
  }
  console.log("[FULL][SW]", { step: "inject_ok" });

  const captureResult = await sendMessageToTabWithResponse(tabId, {
    type: "FP_CAPTURE_ALL",
  });
  if (!captureResult || captureResult.ok === false) {
    const message =
      captureResult && captureResult.error
        ? captureResult.error
        : "Unable to prepare full page capture.";
    const code =
      captureResult && captureResult.code ? captureResult.code : "PLAN_FAILED";
    console.log("[FULL][SW]", { step: "plan_failed", error: message });
    const err = new Error(message);
    err.code = code;
    throw err;
  }
  const frames = Array.isArray(captureResult.frames) ? captureResult.frames : [];
  const totalHeight =
    typeof captureResult.totalHeight === "number" ? captureResult.totalHeight : 0;
  const width = typeof captureResult.width === "number" ? captureResult.width : 0;
  const dpr =
    typeof captureResult.devicePixelRatio === "number"
      ? captureResult.devicePixelRatio
      : 1;
  if (!frames.length || !width || !totalHeight) {
    const err = new Error("No frames to stitch.");
    err.code = "PLAN_FAILED";
    throw err;
  }
  console.log("[FULL][SW]", { step: "plan_ok", frames: frames.length });
  if (totalHeight * dpr > FULLPAGE_MAX_HEIGHT) {
    const err = new Error("Page too tall for full page capture.");
    err.code = "PAGE_TOO_LARGE";
    throw err;
  }

  let blob;
  try {
    const { stitchVerticalPng } = await import("./fullpage_stitch.js");
    blob = await stitchVerticalPng({
      frames,
      width: Math.round(width * dpr),
      totalHeight: Math.round(totalHeight * dpr),
    });
  } catch (error) {
    console.log("[FULL][SW]", {
      step: "stitch_failed",
      error: error && error.message ? error.message : String(error),
    });
    const err = new Error("Full page screenshot failed.");
    err.code = "UNKNOWN";
    err.details = error && error.message ? error.message : String(error);
    throw err;
  }
  const dataUrl = await blobToDataUrl(blob);
  console.log("[FULL][SW]", { step: "stitch_ok" });
  state.screenshot.dataUrl = dataUrl;
  state.screenshot.capturedAt = triggerTimestampIso;
  if (session) {
    session.screenshots = session.screenshots.filter((entry) => !entry.fullPage);
    const index = session.screenshots.length + 1;
    session.screenshots.push({
      index,
      timestampIso: triggerTimestampIso,
      t_ms: triggerTms,
      blob,
      dataUrl,
      fullPage: true,
      fileName: "qa-screenshot-fullpage.png",
    });
  }
  clearStatusMessage();
  return dataUrl;
}

function addMarker(note) {
  if (!session) {
    throw new Error("No active session.");
  }
  if (session.mode === "screenshot") {
    throw new Error("Markers are unavailable in screenshot mode.");
  }
  if (session.state !== "capturing" && session.state !== "paused") {
    throw new Error("Session is not recording or paused.");
  }
  const timestampIso = nowIso();
  const tMs = computeSessionOffsetMs(timestampIso);
  const rawNote = typeof note === "string" ? note.trim() : "";
  const trimmedNote = rawNote.slice(0, 200);
  const marker = {
    timestampIso,
    t_ms: tMs,
    note: trimmedNote,
  };
  session.markers.push(marker);
  return marker;
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

async function startRecording(streamId, tabId, mimeType) {
  const tab = tabId ? await chrome.tabs.get(tabId) : await getActiveTab();
  ensureTabIsCapturable(tab);
  if (session) {
    throw new Error("A session already exists. Reset to start a new capture.");
  }

  try {
    await ensureOffscreenReady();
    if (!streamId) {
      throw new Error("Missing stream id. Start recording from the popup.");
    }
    console.log("[REC][sw] routing RECORDING_START to offscreen", {
      tabId: tab.id,
    });
    const response = await sendMessageToOffscreen({
      type: "RECORDING_START",
      tabId: tab.id,
      streamId,
      mimeType,
    });

    if (!response.ok) {
      const errorMessage = response.error || "Failed to start recording.";
      setStatusMessage(errorMessage, "error");
      throw new Error(errorMessage);
    }

    ensureSessionForMode("recording", tab);
    setSessionState("capturing");
    syncRecordingState(response);
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
    clearStatusMessage();
    return response;
  } catch (error) {
    setStatusMessage(error.message || "Failed to start recording.", "error");
    addDiagnostic("error", "Recording start failed.", {
      error: error.message || String(error),
    });
    throw error;
  }
}

async function pauseRecording() {
  if (state.recording.status !== "recording") {
    throw new Error("Recording is not active.");
  }
  const response = await sendMessageToOffscreen({ type: "RECORDING_PAUSE" });
  if (!response.ok) {
    throw new Error(response.error || "Failed to pause recording.");
  }
  setNetworkCaptureEnabled(false);
  syncRecordingState(response);
  if (state.recording.status === "paused") {
    setSessionState("paused");
  }
  clearStatusMessage();
  return response;
}

async function resumeRecording() {
  if (state.recording.status !== "paused") {
    throw new Error("Recording is not paused.");
  }
  const response = await sendMessageToOffscreen({ type: "RECORDING_RESUME" });
  if (!response.ok) {
    throw new Error(response.error || "Failed to resume recording.");
  }
  setNetworkCaptureEnabled(true);
  syncRecordingState(response);
  if (state.recording.status === "recording") {
    setSessionState("capturing");
  }
  clearStatusMessage();
  return response;
}

async function stopRecording() {
  const response = await sendMessageToOffscreen({ type: "RECORDING_STOP" });
  if (!response.ok) {
    addDiagnostic("error", "Recording stop failed.", {
      error: response.error || "Failed to stop recording.",
    });
    throw new Error(response.error || "Failed to stop recording.");
  }
  syncRecordingState(response);
  if (state.recording.status === "idle") {
    markSessionStopped();
  }
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
          typeof exportResponse.size === "number" ? exportResponse.size : null;
      }
    } catch (error) {
      console.warn("Failed to cache recording export reference:", error);
    }
  }
  clearStatusMessage();
  closeRecordingPanelWindowIfOpen();
  return response;
}

async function startNetworkCapture() {
  if (state.network.active) {
    throw new Error("Network capture is already active.");
  }

  const tab = await getActiveTab();
  ensureTabIsCapturable(tab);

  ensureSessionForMode("network_console", tab);
  let attached = false;
  try {
    await attachDebugger(tab.id);
    attached = true;
  } catch (error) {
    const message = error.message || String(error);
    addDiagnostic("error", "Debugger attach failed.", {
      error: message,
    });
    setStatusMessage(
      "Network+Console blocked by enterprise policy.",
      "error"
    );
    const attachError = new Error(
      "Network+Console blocked by enterprise policy."
    );
    attachError.code = "debugger_blocked";
    throw attachError;
  }
  try {
    await sendDebuggerCommand(tab.id, "Network.enable");
  } catch (error) {
    const message = error.message || String(error);
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
  } catch (error) {
    const message = error.message || String(error);
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

async function stopNetworkCapture() {
  if (!state.network.active) {
    throw new Error("Network capture is not active.");
  }

  const tabId = state.network.tabId;

  state.network.active = false;
  setNetworkCaptureEnabled(false);
  state.network.stoppedAt = nowIso();

  state.console.active = false;
  state.console.stoppedAt = nowIso();
  markSessionStopped();

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
  clearStatusMessage();
}

function updateRequestEntry(requestId, updates) {
  const isNew = !state.network.requests[requestId];
  if (isNew) {
    state.network.requests[requestId] = {
      id: requestId,
      timestampIso: null,
      requestHeaders: {},
      responseHeaders: {},
      responseBody: null,
      responseBodyBase64: false,
    };
    state.network.order.push(requestId);
    if (state.network.order.length > MAX_NETWORK_ENTRIES) {
      const oldest = state.network.order.shift();
      if (oldest) {
        delete state.network.requests[oldest];
        state.network.capped = true;
      }
    }
  }
  Object.assign(state.network.requests[requestId], updates);
  if (isNew) {
    updateSessionCounts();
  }
}

chrome.debugger.onEvent.addListener((source, method, params) => {
  if (!state.network.active || source.tabId !== state.network.tabId) {
    return;
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
    updateRequestEntry(params.requestId, {
      url: params.request.url,
      method: params.request.method,
      requestHeaders: normalizeHeaders(params.request.headers),
      requestBody: params.request.postData,
      requestTime: params.timestamp,
      timestampIso: nowIso(),
      initiator: params.initiator,
    });
  }

  if (method === "Network.requestWillBeSentExtraInfo") {
    updateRequestEntry(params.requestId, {
      requestHeaders: {
        ...state.network.requests[params.requestId]?.requestHeaders,
        ...normalizeHeaders(params.headers),
      },
    });
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
    });
  }

  if (method === "Network.responseReceivedExtraInfo") {
    updateRequestEntry(params.requestId, {
      responseHeaders: {
        ...state.network.requests[params.requestId]?.responseHeaders,
        ...normalizeHeaders(params.headers),
      },
    });
  }

  if (method === "Network.loadingFinished") {
    updateRequestEntry(params.requestId, {
      encodedDataLength: params.encodedDataLength,
      endTime: params.timestamp,
    });
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
      })
      .catch(() => {
        addDiagnostic("warning", "Response body fetch failed.", {
          requestId: params.requestId,
        });
        updateRequestEntry(params.requestId, {
          responseBody: null,
          responseBodyBase64: false,
        });
      });
  }

  if (method === "Network.loadingFailed") {
    updateRequestEntry(params.requestId, {
      errorText: params.errorText,
      canceled: params.canceled,
      endTime: params.timestamp,
    });
  }
});

chrome.debugger.onDetach.addListener((source, reason) => {
  if (source.tabId !== state.network.tabId) {
    return;
  }
  state.network.active = false;
  setNetworkCaptureEnabled(false);
  state.network.stoppedAt = nowIso();
  state.network.detachReason = reason;

  state.console.active = false;
  state.console.stoppedAt = nowIso();
  addDiagnostic("error", "Debugger detached unexpectedly.", { reason });
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
  state.console.logs.push(sanitized);
  if (state.console.logs.length > MAX_CONSOLE_ENTRIES) {
    state.console.logs.shift();
  }
  updateSessionCounts();
}

function buildConsoleExportEntries() {
  return state.console.logs.map((entry) => {
    const timestampIso = entry.timestamp || nowIso();
    const timestampEpochMs = parseEpochMs(timestampIso);
    return {
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
  return sliceIds.map((id) => {
    const entry = state.network.requests[id] || {};
    const responseHeaders =
      entry.responseHeaders && Object.keys(entry.responseHeaders).length > 0
        ? entry.responseHeaders
        : null;
    const skipBody = shouldSkipResponseBody(responseHeaders);
    const timestampIso = entry.timestampIso || nowIso();
    const timestampEpochMs = parseEpochMs(timestampIso);
    return {
      request_id: entry.id || null,
      timestamp: timestampIso,
      timestamp_epoch_ms: timestampEpochMs,
      time_missing: timestampEpochMs === null ? true : undefined,
      url: entry.url || null,
      method: entry.method || null,
      request_headers:
        entry.requestHeaders && Object.keys(entry.requestHeaders).length > 0
          ? entry.requestHeaders
          : null,
      request_post_data:
        typeof entry.requestBody === "string" ? entry.requestBody : null,
      response_status:
        typeof entry.status === "number" ? entry.status : null,
      response_status_text: entry.statusText || null,
      response_headers: responseHeaders,
      response_mime_type: entry.mimeType || null,
      response_body_skipped: skipBody ? true : undefined,
      response_body: skipBody ? null : decodeResponseBody(entry),
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
    case "OPEN_RECORDING_PANEL":
      await openRecordingPanelWindow();
      result = { ok: true };
      break;
    case "OFFSCREEN_READY":
      offscreenReady = true;
      result = { ok: true };
      break;
    case "GET_STATUS":
      result = { ok: true, state: getStatusSnapshot() };
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
        const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
          format: "png",
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
        const dataUrl = await captureFullPageScreenshot(normalizedMessage.tabId);
        result = { ok: true, pngDataUrl: dataUrl };
      } catch (error) {
        result = {
          ok: false,
          error: {
            code: error && error.code ? error.code : "UNKNOWN",
            message:
              error && error.message
                ? error.message
                : "Full page screenshot failed.",
            details: error && error.details ? error.details : undefined,
          },
        };
      }
      break;
    case "TAKE_SCREENSHOT":
      try {
        const dataUrl = await captureScreenshot();
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
      const dataUrl = await captureScreenshot();
      result = { ok: true, screenshotDataUrl: dataUrl };
      break;
    }
    case "ADD_MARKER":
      try {
        const marker = addMarker(message.note);
        result = { ok: true, marker };
      } catch (error) {
        result = {
          ok: false,
          error: error && error.message ? error.message : "Failed to add marker.",
        };
      }
      break;
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
        const lock = checkStartMode("recording");
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
          message.mimeType
        );
        if (session) {
          session.state = "capturing";
        }
        await openRecordingPanelWindow();
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
        const lock = checkStartMode("network_console");
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
        const captureResult = await startNetworkCapture();
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
    case "EXPORT_EVIDENCE_ZIP_REQUEST":
      if (exportJob && exportJob.active) {
        result = { ok: false, accepted: false, error: "Export already running." };
        break;
      }
      if (!session && !hasExportableArtifacts()) {
        result = { ok: false, accepted: false, error: "No session to export yet." };
        break;
      }
      result = { ok: true, accepted: true };
      setTimeout(() => {
        runEvidenceZipExport(normalizedMessage).catch(() => {});
      }, 0);
      break;
    case "DOWNLOAD_EVIDENCE_ZIP":
      if (exportJob && exportJob.active) {
        result = { ok: false, accepted: false, error: "Export already running." };
        break;
      }
      if (!session && !hasExportableArtifacts()) {
        result = { ok: false, accepted: false, error: "No session to export yet." };
        break;
      }
      result = { ok: true, accepted: true };
      setTimeout(() => {
        runEvidenceZipExport(normalizedMessage).catch(() => {});
      }, 0);
      break;
    case "CONSOLE_LOG":
      if (
        state.console.active &&
        sender.tab &&
        sender.tab.id === state.console.tabId
      ) {
        addConsoleEntry({
          ...message.payload,
          tabId: sender.tab.id,
        });
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
    case "RECORDING_STATE_CHANGED":
      if (message && message.state) {
        syncRecordingState(message.state);
      }
      result = { ok: true };
      break;
    case "RECORDING_ERROR":
      state.recording.status = "idle";
      state.recording.error = message.error || "Recording failed.";
      state.recording.hasData = Boolean(state.recording.dataUrl);
      addDiagnostic("error", "Recording failed.", {
        error: message.error || "Recording failed.",
      });
      result = { ok: true };
      break;
    case "NETWORK_RESET":
      await resetNetworkState();
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
