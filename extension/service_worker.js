const DEBUGGER_PROTOCOL_VERSION = "1.3";

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
  },
  network: {
    active: false,
    tabId: null,
    requests: {},
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

let session = null;

function nowIso() {
  return new Date().toISOString();
}

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
  const consoleErrors = state.console.logs.filter(
    (entry) => entry.level === "error"
  ).length;
  const diagnosticErrors = session.diagnostics.filter(
    (entry) => entry.level === "error"
  ).length;
  session.counts.errors = consoleErrors + diagnosticErrors;
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

function createSession(mode, tab) {
  session = {
    session_id: createSessionId(),
    created_at: nowIso(),
    ended_at: null,
    mode,
    state: "capturing",
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
  session.state = "stopped";
  if (!session.ended_at) {
    session.ended_at = nowIso();
  }
}

function getArtifactsSnapshot() {
  return {
    hasScreenshot: Boolean(state.screenshot.dataUrl),
    hasRecording: Boolean(state.recording.dataUrl),
    hasNetworkLogs: Object.keys(state.network.requests).length > 0,
    hasConsoleLogs: state.console.logs.length > 0,
    hasAnyArtifacts:
      Boolean(state.screenshot.dataUrl) ||
      Boolean(state.recording.dataUrl) ||
      Object.keys(state.network.requests).length > 0 ||
      state.console.logs.length > 0,
  };
}

function getStatusSnapshot() {
  updateSessionCounts();
  return {
    screenshotCapturedAt: state.screenshot.capturedAt,
    recordingStatus: state.recording.status,
    recordingCapturedAt: state.recording.capturedAt,
    networkActive: state.network.active,
    networkCount: Object.keys(state.network.requests).length,
    consoleCount: state.console.logs.length,
    session,
    artifacts: getArtifactsSnapshot(),
  };
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
  const hasDocument = await chrome.offscreen.hasDocument();
  if (!hasDocument) {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["USER_MEDIA"],
      justification: "Record active tab video for QA evidence.",
    });
  }
}

async function captureScreenshot() {
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    throw new Error("No active tab to capture.");
  }
  ensureSessionForMode("screenshot", tab);
  setSessionState("capturing");
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: "png" });
    state.screenshot.dataUrl = dataUrl;
    state.screenshot.capturedAt = nowIso();
    markSessionStopped();
    updateSessionCounts();
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
  if (!tab || !tab.id) {
    throw new Error("No active tab to record.");
  }

  ensureSessionForMode("recording", tab);
  setSessionState("capturing");

  try {
    await ensureOffscreenDocument();
    const response = await sendMessageToOffscreen({
      type: "RECORDING_START",
      tabId: tab.id,
    });

    if (!response.ok) {
      throw new Error(response.error || "Failed to start recording.");
    }

    state.recording.status = "recording";
    state.recording.dataUrl = null;
    state.recording.capturedAt = null;
    state.recording.mimeType = null;
    state.recording.error = null;
  } catch (error) {
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
  state.recording.status = "paused";
  setSessionState("paused");
}

async function resumeRecording() {
  if (state.recording.status !== "paused") {
    throw new Error("Recording is not paused.");
  }
  const response = await sendMessageToOffscreen({ type: "RECORDING_RESUME" });
  if (!response.ok) {
    throw new Error(response.error || "Failed to resume recording.");
  }
  state.recording.status = "recording";
  setSessionState("capturing");
}

async function stopRecording() {
  if (state.recording.status === "idle") {
    throw new Error("No recording to stop.");
  }
  const response = await sendMessageToOffscreen({ type: "RECORDING_STOP" });
  if (!response.ok) {
    addDiagnostic("error", "Recording stop failed.", {
      error: response.error || "Failed to stop recording.",
    });
    throw new Error(response.error || "Failed to stop recording.");
  }
  state.recording.status = "stopping";
  markSessionStopped();
}

async function startNetworkCapture() {
  if (state.network.active) {
    throw new Error("Network capture is already active.");
  }

  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    throw new Error("No active tab to attach debugger.");
  }

  ensureSessionForMode("network_console", tab);
  setSessionState("capturing");
  try {
    await attachDebugger(tab.id);
    await sendDebuggerCommand(tab.id, "Network.enable");
  } catch (error) {
    addDiagnostic("error", "Debugger attach failed.", {
      error: error.message || String(error),
    });
    throw error;
  }

  state.network.active = true;
  state.network.tabId = tab.id;
  state.network.requests = {};
  state.network.startedAt = nowIso();
  state.network.stoppedAt = null;

  state.console.active = true;
  state.console.tabId = tab.id;
  state.console.logs = [];
  state.console.startedAt = nowIso();
  state.console.stoppedAt = null;

  sendMessageToTab(tab.id, { type: "START_CONSOLE_CAPTURE" });
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
    sendMessageToTab(tabId, { type: "STOP_CONSOLE_CAPTURE" });
    try {
      await detachDebugger(tabId);
    } catch (error) {
      console.warn("Failed to detach debugger:", error);
      addDiagnostic("warning", "Debugger detach failed.", {
        error: error.message || String(error),
      });
    }
  }
}

function updateRequestEntry(requestId, updates) {
  const isNew = !state.network.requests[requestId];
  if (isNew) {
    state.network.requests[requestId] = {
      id: requestId,
      requestHeaders: {},
      responseHeaders: {},
    };
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

  if (method === "Network.requestWillBeSent") {
    updateRequestEntry(params.requestId, {
      url: params.request.url,
      method: params.request.method,
      requestHeaders: normalizeHeaders(params.request.headers),
      requestBody: params.request.postData,
      requestTime: params.timestamp,
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

  sendMessageToTab(source.tabId, { type: "STOP_CONSOLE_CAPTURE" });
});

async function resetSession() {
  if (state.network.tabId) {
    sendMessageToTab(state.network.tabId, { type: "STOP_CONSOLE_CAPTURE" });
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

  state.screenshot.dataUrl = null;
  state.screenshot.capturedAt = null;

  state.recording.status = "idle";
  state.recording.dataUrl = null;
  state.recording.mimeType = null;
  state.recording.capturedAt = null;
  state.recording.error = null;

  state.network.active = false;
  state.network.tabId = null;
  state.network.requests = {};
  state.network.startedAt = null;
  state.network.stoppedAt = null;

  state.console.active = false;
  state.console.tabId = null;
  state.console.logs = [];
  state.console.startedAt = null;
  state.console.stoppedAt = null;

  session = null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handle = async () => {
    switch (message.type) {
      case "GET_STATUS":
        return { ok: true, state: getStatusSnapshot() };
      case "CAPTURE_SCREENSHOT":
        await captureScreenshot();
        return { ok: true };
      case "RECORDING_START":
        await startRecording();
        return { ok: true };
      case "RECORDING_PAUSE":
        await pauseRecording();
        return { ok: true };
      case "RECORDING_RESUME":
        await resumeRecording();
        return { ok: true };
      case "RECORDING_STOP":
        await stopRecording();
        return { ok: true };
      case "NETWORK_START":
        await startNetworkCapture();
        return { ok: true };
      case "NETWORK_STOP":
        await stopNetworkCapture();
        return { ok: true };
      case "GET_EXPORT_DATA":
        if (!session) {
          return { ok: false, error: "No session to export yet." };
        }
        updateSessionCounts();
        return {
          ok: true,
          data: {
            screenshotDataUrl: state.screenshot.dataUrl,
            recordingDataUrl: state.recording.dataUrl,
            recordingMimeType: state.recording.mimeType,
            networkLogs: Object.values(state.network.requests),
            consoleLogs: state.console.logs,
            session,
          },
        };
      case "CONSOLE_LOG": {
        if (
          state.console.active &&
          sender.tab &&
          sender.tab.id === state.console.tabId
        ) {
          state.console.logs.push({
            ...message.payload,
            tabId: sender.tab.id,
          });
          updateSessionCounts();
        }
        return { ok: true };
      }
      case "RECORDING_COMPLETE":
        state.recording.status = "stopped";
        state.recording.dataUrl = message.dataUrl;
        state.recording.mimeType = message.mimeType;
        state.recording.capturedAt = nowIso();
        state.recording.error = null;
        markSessionStopped();
        updateSessionCounts();
        return { ok: true };
      case "RECORDING_ERROR":
        state.recording.status = "idle";
        state.recording.error = message.error || "Recording failed.";
        addDiagnostic("error", "Recording failed.", {
          error: message.error || "Recording failed.",
        });
        return { ok: true };
      case "RESET_SESSION":
        await resetSession();
        return { ok: true, state: getStatusSnapshot() };
      default:
        return { ok: false, error: "Unknown message type." };
    }
  };

  handle()
    .then((response) => sendResponse(response))
    .catch((error) =>
      sendResponse({ ok: false, error: error.message || "Request failed." })
    );

  return true;
});
