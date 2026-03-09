const stateEl = document.getElementById("panel_state");
const requestsEl = document.getElementById("panel_requests");
const consoleEl = document.getElementById("panel_console");
const messageEl = document.getElementById("panel_message");
const exportEl = document.getElementById("panel_export");
const startBtn = document.getElementById("panel_start");
const stopBtn = document.getElementById("panel_stop");
const downloadBtn = document.getElementById("panel_download");
const clearBtn = document.getElementById("panel_clear");
const resetBtn = document.getElementById("panel_reset");
const closeBtn = document.getElementById("closePanel");

const EXPORT_EVENTS = {
  REQUEST: "EXPORT_EVIDENCE_ZIP_REQUEST",
  PROGRESS: "EXPORT_EVIDENCE_ZIP_PROGRESS",
  DONE: "EXPORT_EVIDENCE_ZIP_DONE",
  ERROR: "EXPORT_EVIDENCE_ZIP_ERROR",
};

const DEFAULT_FILTERS = {
  filter_request_type: "xhr_fetch",
  filter_status_mode: "all",
  filter_status_custom_list: "",
  filter_url_contains: "",
  filter_url_excludes: "",
  filter_capture_mode: "filtered_capture",
};

let exportInProgress = false;
let exportProgressPercent = 0;

async function send(type, payload = {}) {
  try {
    const res = await chrome.runtime.sendMessage({ type, ...payload });
    if (!res) {
      return { ok: false, error: "No response from service worker." };
    }
    return res;
  } catch (error) {
    return { ok: false, error: error && error.message ? error.message : String(error) };
  }
}

function parseStatusList(value) {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }
  return value
    .split(",")
    .map((item) => Number(String(item).trim()))
    .filter((num) => Number.isInteger(num) && num >= 100 && num <= 599)
    .slice(0, 30);
}

async function loadFilters() {
  const stored = await chrome.storage.local.get({
    repro_capture_filters_v1: DEFAULT_FILTERS,
  });
  const saved =
    stored && stored.repro_capture_filters_v1
      ? stored.repro_capture_filters_v1
      : DEFAULT_FILTERS;
  return { ...DEFAULT_FILTERS, ...saved };
}

function buildFiltersPayload(filters) {
  const statusList = parseStatusList(filters.filter_status_custom_list);
  if (filters.filter_status_mode === "custom" && statusList.length === 0) {
    return { ok: false, error: "Invalid status filter list." };
  }
  const excludeTokens = filters.filter_url_excludes
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 20);
  return {
    ok: true,
    filters: {
      requestType: filters.filter_request_type,
      statusMode: filters.filter_status_mode,
      customStatuses: statusList,
      urlContains: filters.filter_url_contains.trim(),
      urlExcludes: excludeTokens,
      captureMode: filters.filter_capture_mode,
    },
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

async function getViewportSnapshot() {
  let activeTab = null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tab;
  } catch (error) {
    activeTab = null;
  }
  const fallback = {
    devicePixelRatio: null,
    viewport: {
      w: activeTab && typeof activeTab.width === "number" ? activeTab.width : null,
      h: activeTab && typeof activeTab.height === "number" ? activeTab.height : null,
    },
  };
  if (
    !activeTab ||
    !activeTab.id ||
    !chrome.scripting ||
    typeof chrome.scripting.executeScript !== "function"
  ) {
    return fallback;
  }
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => ({
        devicePixelRatio:
          typeof window.devicePixelRatio === "number" ? window.devicePixelRatio : null,
        viewport: {
          w: typeof window.innerWidth === "number" ? window.innerWidth : null,
          h: typeof window.innerHeight === "number" ? window.innerHeight : null,
        },
      }),
    });
    if (result && result.result) {
      return {
        devicePixelRatio:
          typeof result.result.devicePixelRatio === "number"
            ? result.result.devicePixelRatio
            : null,
        viewport: {
          w:
            result.result.viewport && typeof result.result.viewport.w === "number"
              ? result.result.viewport.w
              : fallback.viewport.w,
          h:
            result.result.viewport && typeof result.result.viewport.h === "number"
              ? result.result.viewport.h
              : fallback.viewport.h,
        },
      };
    }
  } catch (error) {
    return fallback;
  }
  return fallback;
}

function startExportUI() {
  exportInProgress = true;
  exportProgressPercent = 0;
  exportEl.textContent = "Exporting... (0%)";
  downloadBtn.disabled = true;
}

function updateExportUI(percent, stage) {
  exportProgressPercent =
    typeof percent === "number"
      ? Math.max(0, Math.min(100, Math.round(percent)))
      : exportProgressPercent;
  const label = `Exporting... (${exportProgressPercent}%)`;
  exportEl.textContent = stage ? `${label} - ${stage}` : label;
}

function finishExportUI(message) {
  exportInProgress = false;
  exportProgressPercent = 0;
  exportEl.textContent = message;
  downloadBtn.disabled = false;
}

async function refreshStatus() {
  const res = await send("GET_STATUS");
  if (!res || !res.ok) {
    messageEl.textContent = "Logs window closed.";
    startBtn.disabled = true;
    stopBtn.disabled = true;
    downloadBtn.disabled = true;
    return;
  }
  const state = res.state || {};
  const logsState = state.logsState || "idle";
  stateEl.textContent =
    logsState === "capturing"
      ? "Capturing"
      : logsState === "paused"
        ? "Paused"
        : "Idle";
  requestsEl.textContent = String(state.networkCount || 0);
  consoleEl.textContent = String(state.consoleCount || 0);
  messageEl.textContent =
    state.statusMessage && state.statusMessage.message
      ? state.statusMessage.message
      : "-";

  const hasArtifacts = Boolean(state.artifacts && state.artifacts.hasAnyArtifacts);
  startBtn.disabled = logsState === "capturing" || logsState === "paused";
  stopBtn.disabled = logsState === "idle";
  downloadBtn.disabled =
    exportInProgress || logsState !== "idle" || !hasArtifacts;
  if (!exportInProgress && hasArtifacts && logsState === "idle") {
    exportEl.textContent = "Ready.";
  }
}

startBtn.addEventListener("click", async () => {
  messageEl.textContent = "Starting capture...";
  const filters = await loadFilters();
  const payload = buildFiltersPayload(filters);
  if (!payload.ok) {
    messageEl.textContent = payload.error || "Invalid filter settings.";
    return;
  }
  const res = await send("NETWORK_START", { filters: payload.filters });
  if (!res.ok) {
    messageEl.textContent = res.error || "Failed to start capture.";
    await refreshStatus();
    return;
  }
  messageEl.textContent = "Capture started.";
  await refreshStatus();
});

stopBtn.addEventListener("click", async () => {
  messageEl.textContent = "Stopping capture...";
  const res = await send("NETWORK_STOP");
  if (!res.ok) {
    messageEl.textContent = res.error || "Failed to stop capture.";
    await refreshStatus();
    return;
  }
  messageEl.textContent = "Capture stopped.";
  await refreshStatus();
});

downloadBtn.addEventListener("click", async () => {
  if (exportInProgress) {
    return;
  }
  const statusResponse = await send("GET_STATUS");
  if (!statusResponse.ok) {
    messageEl.textContent = statusResponse.error || "Unable to export.";
    return;
  }
  if (
    statusResponse.state.recordingStatus === "recording" ||
    statusResponse.state.recordingStatus === "paused"
  ) {
    messageEl.textContent = "Stop recording before downloading.";
    return;
  }
  if (
    statusResponse.state.session &&
    (statusResponse.state.session.state === "capturing" ||
      statusResponse.state.session.state === "paused")
  ) {
    messageEl.textContent = "Stop capture before downloading.";
    return;
  }

  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
  const viewportSnapshot = await getViewportSnapshot();
  const requestedExportTimestamp = formatExportTimestamp(new Date());
  startExportUI();
  const exportResponse = await send(EXPORT_EVENTS.REQUEST, {
    timezone,
    exportTimestamp: requestedExportTimestamp,
    devicePixelRatio: viewportSnapshot.devicePixelRatio,
    viewport: viewportSnapshot.viewport,
    sessionId:
      statusResponse.state.session && statusResponse.state.session.session_id
        ? statusResponse.state.session.session_id
        : null,
  });
  if (!exportResponse.ok || exportResponse.accepted !== true) {
    finishExportUI(exportResponse.error || "Export could not be started.");
    return;
  }
  exportEl.textContent = "Export queued...";
});

clearBtn.addEventListener("click", async () => {
  const confirmClear = window.confirm(
    "Clear all locally stored capture data? This cannot be undone."
  );
  if (!confirmClear) {
    return;
  }
  messageEl.textContent = "Clearing data...";
  const res = await send("CLEAR_ALL_CAPTURE_DATA");
  if (!res.ok) {
    messageEl.textContent = res.error || "Failed to clear data.";
    return;
  }
  messageEl.textContent = "Cleared local capture data.";
  await refreshStatus();
});

resetBtn.addEventListener("click", async () => {
  const confirmReset = window.confirm(
    "Reset the session? This clears recording, logs, and export state."
  );
  if (!confirmReset) {
    return;
  }
  await send("RECORDING_RESET");
  await send("NETWORK_RESET");
  const res = await send("RESET_SESSION");
  if (!res.ok) {
    messageEl.textContent = res.error || "Failed to reset session.";
    await refreshStatus();
    return;
  }
  messageEl.textContent = "Session reset.";
  await refreshStatus();
});

closeBtn.addEventListener("click", () => window.close());

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === EXPORT_EVENTS.PROGRESS) {
    updateExportUI(message.percent, message.stage);
    sendResponse({ ok: true });
    return true;
  }
  if (message.type === EXPORT_EVENTS.DONE || message.type === "EXPORT_DONE") {
    finishExportUI("Export complete.");
    messageEl.textContent = "Export complete.";
    refreshStatus();
    sendResponse({ ok: true });
    return true;
  }
  if (message.type === EXPORT_EVENTS.ERROR || message.type === "EXPORT_FAILED") {
    finishExportUI(message.userMessage || "Export failed.");
    messageEl.textContent = message.userMessage || "Export failed.";
    refreshStatus();
    sendResponse({ ok: true });
    return true;
  }
  return false;
});

refreshStatus();
setInterval(refreshStatus, 1000);
