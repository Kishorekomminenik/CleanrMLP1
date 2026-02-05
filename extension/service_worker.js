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

function getStatusSnapshot() {
  return {
    screenshotCapturedAt: state.screenshot.capturedAt,
    recordingStatus: state.recording.status,
    recordingCapturedAt: state.recording.capturedAt,
    networkActive: state.network.active,
    networkCount: Object.keys(state.network.requests).length,
    consoleCount: state.console.logs.length,
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
  const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: "png" });
  state.screenshot.dataUrl = dataUrl;
  state.screenshot.capturedAt = new Date().toISOString();
  return dataUrl;
}

async function startRecording() {
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    throw new Error("No active tab to record.");
  }

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
}

async function stopRecording() {
  if (state.recording.status === "idle") {
    throw new Error("No recording to stop.");
  }
  const response = await sendMessageToOffscreen({ type: "RECORDING_STOP" });
  if (!response.ok) {
    throw new Error(response.error || "Failed to stop recording.");
  }
  state.recording.status = "stopping";
}

async function startNetworkCapture() {
  if (state.network.active) {
    throw new Error("Network capture is already active.");
  }

  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    throw new Error("No active tab to attach debugger.");
  }

  await attachDebugger(tab.id);
  await sendDebuggerCommand(tab.id, "Network.enable");

  state.network.active = true;
  state.network.tabId = tab.id;
  state.network.requests = {};
  state.network.startedAt = new Date().toISOString();
  state.network.stoppedAt = null;

  state.console.active = true;
  state.console.tabId = tab.id;
  state.console.logs = [];
  state.console.startedAt = new Date().toISOString();
  state.console.stoppedAt = null;

  sendMessageToTab(tab.id, { type: "START_CONSOLE_CAPTURE" });
}

async function stopNetworkCapture() {
  if (!state.network.active) {
    throw new Error("Network capture is not active.");
  }

  const tabId = state.network.tabId;

  state.network.active = false;
  state.network.stoppedAt = new Date().toISOString();

  state.console.active = false;
  state.console.stoppedAt = new Date().toISOString();

  if (tabId) {
    sendMessageToTab(tabId, { type: "STOP_CONSOLE_CAPTURE" });
    try {
      await detachDebugger(tabId);
    } catch (error) {
      console.warn("Failed to detach debugger:", error);
    }
  }
}

function updateRequestEntry(requestId, updates) {
  if (!state.network.requests[requestId]) {
    state.network.requests[requestId] = {
      id: requestId,
      requestHeaders: {},
      responseHeaders: {},
    };
  }
  Object.assign(state.network.requests[requestId], updates);
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
  state.network.stoppedAt = new Date().toISOString();
  state.network.detachReason = reason;

  state.console.active = false;
  state.console.stoppedAt = new Date().toISOString();

  sendMessageToTab(source.tabId, { type: "STOP_CONSOLE_CAPTURE" });
});

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
        return {
          ok: true,
          data: {
            screenshotDataUrl: state.screenshot.dataUrl,
            recordingDataUrl: state.recording.dataUrl,
            recordingMimeType: state.recording.mimeType,
            networkLogs: Object.values(state.network.requests),
            consoleLogs: state.console.logs,
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
        }
        return { ok: true };
      }
      case "RECORDING_COMPLETE":
        state.recording.status = "stopped";
        state.recording.dataUrl = message.dataUrl;
        state.recording.mimeType = message.mimeType;
        state.recording.capturedAt = new Date().toISOString();
        state.recording.error = null;
        return { ok: true };
      case "RECORDING_ERROR":
        state.recording.status = "idle";
        state.recording.error = message.error || "Recording failed.";
        return { ok: true };
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
