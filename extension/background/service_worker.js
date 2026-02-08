try {
  importScripts(chrome.runtime.getURL("utils/redact.js"));
} catch (error) {
  // Redaction helper is optional; export will fall back to raw values.
}

const DEBUGGER_PROTOCOL_VERSION = "1.3";
const MAX_BODY_BYTES = 2000000;
const MAX_NETWORK_ENTRIES = 5000;
const MAX_CONSOLE_ENTRIES = 5000;
const MAX_CONSOLE_ENTRY_BYTES = 50000;
const TRUNCATION_SUFFIX = "...[truncated]";
const BINARY_CONTENT_TYPE_REGEX =
  /^(image\/|font\/|video\/|audio\/|application\/octet-stream)/i;

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
  },
  network: {
    active: false,
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

function nowIso() {
  return new Date().toISOString();
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
  session = {
    session_id: createSessionId(),
    created_at: nowIso(),
    ended_at: null,
    mode,
    state: "capturing",
    pause_started_at: null,
    total_paused_ms: 0,
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
  return {
    hasScreenshot: Boolean(state.screenshot.dataUrl),
    hasRecording: Boolean(state.recording.dataUrl) || Boolean(state.recording.hasData),
    hasNetworkLogs: Object.keys(state.network.requests).length > 0,
    hasConsoleLogs: state.console.logs.length > 0,
    hasAnyArtifacts:
      Boolean(state.screenshot.dataUrl) ||
      Boolean(state.recording.dataUrl) ||
      Boolean(state.recording.hasData) ||
      Object.keys(state.network.requests).length > 0 ||
      state.console.logs.length > 0,
  };
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
    setSessionState("capturing");
  } else if (nextState === "paused") {
    setSessionState("paused");
  } else if (nextState === "idle" && session && session.mode === "recording") {
    if (state.recording.hasData && !state.recording.capturedAt) {
      state.recording.capturedAt = nowIso();
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
  return {
    user_agent: userAgent,
    browser: detectBrowser(userAgent),
    browser_version: parseBrowserVersion(userAgent),
    platform,
    timezone,
    captured_url: tab && tab.url ? tab.url : "",
    captured_title: tab && tab.title ? tab.title : "",
    timestamp: new Date().toISOString(),
  };
}

async function buildEvidenceExportData(context) {
  updateSessionCounts();
  const environment = await buildEnvironment(context);
  const redactionResult = await chrome.storage.local.get({
    redactionEnabled: true,
  });
  const redactionEnabled = redactionResult.redactionEnabled !== false;
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
  return {
    screenshotDataUrl: state.screenshot.dataUrl,
    recordingDataUrl: state.recording.dataUrl,
    recordingMimeType: state.recording.mimeType,
    networkLogs: {
      version: "1.0",
      entries: redactedNetworkEntries,
    },
    consoleLogs: {
      version: "1.0",
      entries: redactedConsoleEntries,
    },
    session: buildSessionExport(),
    environment,
  };
}

function sendMessageToTab(tabId, message) {
  if (!tabId) {
    return;
  }
  chrome.tabs.sendMessage(tabId, message, () => {
    void chrome.runtime.lastError;
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
    state.screenshot.dataUrl = dataUrl;
    state.screenshot.capturedAt = nowIso();
    clearStatusMessage();
    return dataUrl;
  } catch (error) {
    addDiagnostic("error", "Screenshot capture failed.", {
      error: error.message || String(error),
    });
    throw error;
  }
}

async function startRecording() {
  const tab = await getActiveTab();
  ensureTabIsCapturable(tab);

  ensureSessionForMode("recording", tab);
  setSessionState("capturing");

  try {
    await ensureOffscreenReady();
    const response = await sendMessageToOffscreen({
      type: "RECORDING_START",
      tabId: tab.id,
    });

    if (!response.ok) {
      const errorMessage = response.error || "Failed to start recording.";
      setStatusMessage(errorMessage, "error");
      throw new Error(errorMessage);
    }

    syncRecordingState(response);
    state.recording.dataUrl = null;
    state.recording.capturedAt = null;
    state.recording.mimeType = null;
    state.recording.error = null;
    state.recording.hasData = false;
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
  state.network.stoppedAt = nowIso();
  state.network.detachReason = reason;

  state.console.active = false;
  state.console.stoppedAt = nowIso();
  addDiagnostic("error", "Debugger detached unexpectedly.", { reason });
});

async function resetSession() {
  if (state.network.tabId) {
    try {
      await detachDebugger(state.network.tabId);
    } catch (error) {
      console.warn("Failed to detach debugger on reset:", error);
    }
  }

  if (state.recording.status !== "idle") {
    try {
      await sendMessageToOffscreen({ type: "RECORDING_STOP" });
    } catch (error) {
      console.warn("Failed to stop recording on reset:", error);
    }
  }
  try {
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

  state.network.active = false;
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

  session = null;
  clearStatusMessage();
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
  return state.console.logs.map((entry) => ({
    timestamp: entry.timestamp || nowIso(),
    level: entry.level || "log",
    message: typeof entry.message === "string" ? entry.message : "",
    args: Array.isArray(entry.args) ? entry.args : [],
    source: entry.source || "console",
    url: entry.url || null,
    line: typeof entry.line === "number" ? entry.line : null,
    column: typeof entry.column === "number" ? entry.column : null,
    stack: entry.stack || null,
  }));
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
    return {
      request_id: entry.id || null,
      timestamp: entry.timestampIso || nowIso(),
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
  console.log("[SW] msg", message.type);
  let result;
  switch (message.type) {
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
          tabCaptureAvailable: Boolean(chrome?.tabCapture?.capture),
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
    case "CAPTURE_SCREENSHOT":
      {
        const dataUrl = await captureScreenshot();
        result = { ok: true, screenshotDataUrl: dataUrl };
      }
      break;
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
        const response = await startRecording();
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
      if (!session) {
        result = { ok: false, error: "No session to export yet." };
        break;
      }
      result = { ok: true, data: await buildEvidenceExportData(message) };
      break;
    case "GET_EVIDENCE_EXPORT_DATA":
      if (!session) {
        result = { ok: false, error: "No session to export yet." };
        break;
      }
      result = { ok: true, data: await buildEvidenceExportData(message) };
      break;
    case "DOWNLOAD_EVIDENCE_ZIP":
      result = {
        ok: false,
        error: "Export is handled in the popup.",
      };
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
    case "RESET_SESSION":
      await resetSession();
      result = { ok: true, state: getStatusSnapshot() };
      break;
    default:
      result = { ok: false, error: "Unknown message type." };
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
