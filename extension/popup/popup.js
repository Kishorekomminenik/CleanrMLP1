const statusElements = {
  message: document.getElementById("status_message"),
  mode: document.getElementById("status_mode"),
  state: document.getElementById("status_state"),
  timer: document.getElementById("status_timer"),
  counts: document.getElementById("status_counts"),
  download: document.getElementById("downloadStatus"),
};

const buttons = {
  screenshot: document.getElementById("btn_take_screenshot"),
  recordStart: document.getElementById("btn_start_recording"),
  recordPause: document.getElementById("btn_pause_recording"),
  recordResume: document.getElementById("btn_resume_recording"),
  recordStop: document.getElementById("btn_stop_recording"),
  recordPanel: document.getElementById("btn_open_recording_panel"),
  networkStart: document.getElementById("btn_start_capture"),
  networkStop: document.getElementById("btn_stop_capture"),
  networkRefresh: document.getElementById("refreshTabBtn"),
  addMarker: document.getElementById("btn_add_marker"),
  download: document.getElementById("btn_download_zip"),
  downloadRecording: document.getElementById("btn_download_recording"),
  reset: document.getElementById("btn_reset_session"),
};

const modeRadios = Array.from(
  document.querySelectorAll('input[name="captureMode"]')
);
const modeControls = Array.from(document.querySelectorAll(".mode-controls"));
let currentMode = "screenshot";
const redactionToggle = document.getElementById("redactionToggle");
const redactionStatus = document.getElementById("redactionStatus");
const screenshotHint = document.getElementById("screenshotHint");
const statusTimerRow = document.getElementById("status_timer_row");
const statusCountsRow = document.getElementById("status_counts_row");
const downloadControls = document.getElementById("download_controls");
const statusToggle = document.getElementById("status_toggle");
const statusChevron = document.getElementById("status_chevron");
const statusBody = document.getElementById("status_body");
const networkTip = document.getElementById("network_tip");
const networkGuidance = document.getElementById("networkGuidance");
const controlsStatus = document.getElementById("controlsStatus");
const networkStatusStrip = document.getElementById("networkStatusStrip");
const versionBadge = document.getElementById("versionBadge");
const recordingUnavailable = document.getElementById("recording-disabled-msg");
const networkUnavailable = document.getElementById("network-disabled-msg");
const recordingRadio = document.getElementById("mode_recording");
const recordingLabel = document.getElementById("label_recording");
const networkRadio = document.getElementById("mode_network");
const networkLabel = document.getElementById("label_network");
let statusUserToggled = false;
let recordingAvailable = true;
let networkAvailable = true;
let recordingCheckToken = 0;
let recordingBlockedReason = null;
let activeRecordingStream = null;
let activeMediaRecorder = null;
let recordedChunks = [];
let recordingObjectUrl = null;
let recordingMimeType = "video/webm";
let recordingCapturedAt = null;
let recordingStopReason = null;
let recordingSegmentMode = false;
let recordingLiveState = null;
let recordingState = "idle";
let recordingStartedAt = null;
let recordingPausedAt = null;
let recordingTotalPausedMs = 0;
let recordingHasData = false;
let recordingLastError = null;
let recordingControlInFlight = false;
let recordingStatusMessage = null;
let recordingStopPromise = null;
let recordingStopResolver = null;
let recordingStopRequestedAt = null;
let recordingDurationMsSnapshot = null;

const STATUS_COLORS = {
  default: "#4b5563",
  error: "#b91c1c",
  success: "#166534",
};

const APP_VERSION = "v0.1";
const JSZIP_LOAD_ERROR =
  "Export unavailable: JSZip failed to load. Check popup.html script path.";
let jszipAvailable = typeof window !== "undefined" && Boolean(window.JSZip);
const MSG = {
  RECORDING_GET_STATE: "RECORDING_GET_STATE",
  RECORDING_START: "RECORDING_START",
  RECORDING_PAUSE: "RECORDING_PAUSE",
  RECORDING_RESUME: "RECORDING_RESUME",
  RECORDING_STOP: "RECORDING_STOP",
  RECORDING_EXPORT_WEBM: "RECORDING_EXPORT_WEBM",
  RECORDING_RESET: "RECORDING_RESET",
  ADD_MARKER: "ADD_MARKER",
  GET_STATUS: "GET_STATUS",
  GET_CAPABILITIES: "GET_CAPABILITIES",
  RESET_SESSION: "RESET_SESSION",
  NETWORK_RESET: "NETWORK_RESET",
};

function setStatus(element, message, type = "default") {
  element.textContent = message;
  element.style.color = STATUS_COLORS[type] || STATUS_COLORS.default;
  element.classList.remove("status--error", "status--success");
  if (type === "error") {
    element.classList.add("status--error");
  } else if (type === "success") {
    element.classList.add("status--success");
  }
}

function assertJsZipAvailable() {
  jszipAvailable = typeof window !== "undefined" && Boolean(window.JSZip);
  if (jszipAvailable) {
    return true;
  }
  if (buttons.download) {
    buttons.download.disabled = true;
  }
  if (statusElements.download) {
    setStatus(statusElements.download, JSZIP_LOAD_ERROR, "error");
  }
  return false;
}

function clearStatusError() {
  if (statusElements.message) {
    setStatus(statusElements.message, "-", "default");
  }
}

function showRecordingInfo(message) {
  if (statusElements.download) {
    setStatus(statusElements.download, message, "success");
  }
}

function isRestrictedUrl(url) {
  if (!url) {
    return true;
  }
  return (
    url.startsWith("chrome://") ||
    url.startsWith("edge://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("https://chrome.google.com/webstore") ||
    url.startsWith("https://microsoftedge.microsoft.com/addons")
  );
}

function getActiveTab() {
  return chrome.tabs
    .query({ active: true, currentWindow: true })
    .then((tabs) => (Array.isArray(tabs) ? tabs[0] : null))
    .catch(() => null);
}

function getMediaStreamId(tabId) {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(streamId);
      });
    } catch (error) {
      reject(error);
    }
  });
}

async function send(type, payload = {}) {
  try {
    const res = await chrome.runtime.sendMessage({ type, ...payload });
    if (!res) {
      return { ok: false, error: "No response from service worker." };
    }
    return res;
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
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

function dataUrlToBlob(dataUrl) {
  const [metadata, base64Data] = dataUrl.split(",");
  const mimeMatch = metadata.match(/data:(.*);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
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

function formatExportTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

async function downloadBlob(blob, filename) {
  if (!chrome.downloads?.download) {
    throw new Error("Downloads API unavailable.");
  }
  const url = URL.createObjectURL(blob);
  try {
    await new Promise((resolve, reject) => {
      chrome.downloads.download({ url, filename, saveAs: false }, (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(downloadId);
      });
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

function pickRecordingMimeType() {
  if (!window.MediaRecorder || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return "";
}

function stopActiveRecordingStream() {
  if (activeRecordingStream) {
    activeRecordingStream.getTracks().forEach((track) => track.stop());
  }
  activeRecordingStream = null;
}

function resetLocalRecording() {
  recordedChunks = [];
  activeMediaRecorder = null;
  stopActiveRecordingStream();
  recordingHasData = false;
  recordingLastError = null;
  recordingState = "idle";
  recordingStopRequestedAt = null;
  recordingDurationMsSnapshot = null;
  resetRecordingTiming();
}

function getRecordingOwnerState() {
  return {
    ok: true,
    state: recordingState,
    startedAt: recordingStartedAt,
    pausedAt: recordingPausedAt,
    totalPausedMs: recordingTotalPausedMs,
    hasData: recordingHasData,
    mimeType: recordingMimeType || "video/webm",
    lastError: recordingLastError,
    elapsedMs: computeRecordingElapsedMs(),
    recorderState: activeMediaRecorder ? activeMediaRecorder.state : "inactive",
    elapsedText: (() => {
      const totalSeconds = Math.max(
        0,
        Math.floor(computeRecordingElapsedMs() / 1000)
      );
      const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
      const seconds = String(totalSeconds % 60).padStart(2, "0");
      return `${minutes}:${seconds}`;
    })(),
  };
}

function setRecordingState(nextState) {
  recordingState = nextState;
}

function resetRecordingTiming() {
  recordingStartedAt = null;
  recordingPausedAt = null;
  recordingTotalPausedMs = 0;
}

function computeRecordingElapsedMs() {
  if (!recordingStartedAt) {
    return 0;
  }
  let end = Date.now();
  if (recordingState === "paused" && recordingPausedAt) {
    end = recordingPausedAt;
  }
  return Math.max(0, end - recordingStartedAt - recordingTotalPausedMs);
}

function sumRecordingChunks(chunks) {
  return chunks.reduce((total, chunk) => total + (chunk && chunk.size ? chunk.size : 0), 0);
}

function createRecordingStopPromise() {
  if (recordingStopPromise) {
    return recordingStopPromise;
  }
  recordingStopPromise = new Promise((resolve) => {
    recordingStopResolver = resolve;
  });
  return recordingStopPromise;
}

function resolveRecordingStopPromise(result) {
  if (recordingStopResolver) {
    recordingStopResolver(result);
  }
  recordingStopPromise = null;
  recordingStopResolver = null;
}

function finalizeStop(message) {
  recordingControlInFlight = false;
  recordingState = "idle";
  recordingPausedAt = null;
  resetRecordingTiming();
  recordingStopReason = null;
  activeMediaRecorder = null;
  if (message) {
    setStatus(statusElements.download, message, "success");
  }
  refreshStatus();
}

async function exportRecordingWebm() {
  const totalBytes = sumRecordingChunks(recordedChunks);
  console.log(
    "[REC] EXPORT requested:",
    `hasData=${recordingHasData}`,
    `chunks=${recordedChunks.length}`,
    `totalBytes=${totalBytes}`
  );
  if (recordingState === "recording" || recordingState === "paused") {
    return { ok: false, error: "Stop recording to download." };
  }
  try {
    console.log(
      "[REC] EXPORT start",
      `mimeType=${recordingMimeType || "video/webm"}`,
      `stoppedAt=${recordingStopRequestedAt ? new Date(recordingStopRequestedAt).toISOString() : "unknown"}`,
      `durationMs=${
        typeof recordingDurationMsSnapshot === "number"
          ? recordingDurationMsSnapshot
          : computeRecordingElapsedMs()
      }`
    );
    let downloadUrl = null;
    let mimeType = recordingMimeType || "video/webm";
    if (recordingHasData && recordedChunks.length > 0) {
      const blob = new Blob(recordedChunks, {
        type: mimeType,
      });
      downloadUrl = URL.createObjectURL(blob);
    } else {
      const fallback = await chrome.storage.session.get({
        recordingWebmDataUrl: null,
        recordingMimeType: null,
      });
      if (fallback.recordingWebmDataUrl) {
        downloadUrl = fallback.recordingWebmDataUrl;
        mimeType = fallback.recordingMimeType || "video/webm";
      }
    }
    if (!downloadUrl) {
      return { ok: false, error: "No recording available to download." };
    }
    const filename = `repro_recording_${formatZipTimestamp(new Date())}.webm`;
    try {
      await new Promise((resolve, reject) => {
        chrome.downloads.download({ url: downloadUrl, filename }, (downloadId) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(downloadId);
        });
      });
    } finally {
      if (downloadUrl && downloadUrl.startsWith("blob:")) {
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);
      }
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error && error.message ? error.message : "Download failed.",
    };
  }
}

function finalizeRecordingBlob(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      await send("RECORDING_COMPLETE", {
        dataUrl,
        mimeType: blob.type,
        size: blob.size,
      });
      const durationMs =
        typeof recordingDurationMsSnapshot === "number"
          ? recordingDurationMsSnapshot
          : computeRecordingElapsedMs();
      try {
        await chrome.storage.session.set({
          recordingWebmDataUrl: dataUrl,
          recordingMimeType: blob.type || "video/webm",
          recordingEndedAt: new Date().toISOString(),
          recordingDurationMs: durationMs,
        });
      } catch (error) {
        recordingLastError = "Failed to store recording.";
      }
      stopActiveRecordingStream();
      resolve({ ok: true });
    };
    reader.onerror = async () => {
      await send("RECORDING_ERROR", {
        error: "Failed to finalize recording.",
      });
      stopActiveRecordingStream();
      recordingLastError = "Failed to finalize recording.";
      resolve({ ok: false, error: "Failed to finalize recording." });
    };
    reader.readAsDataURL(blob);
  });
}

function startMediaRecorderSegment() {
  const options = {};
  const mimeType = pickRecordingMimeType();
  if (mimeType) {
    options.mimeType = mimeType;
  }
  activeMediaRecorder = new MediaRecorder(activeRecordingStream, options);
  recordingMimeType = mimeType || activeMediaRecorder.mimeType || "video/webm";
  console.log("[REC] mimeType chosen=", recordingMimeType);
  activeMediaRecorder.onstart = () => {
    setRecordingState("recording");
    console.log("[REC] START confirmed");
  };
  activeMediaRecorder.onpause = () => {
    recordingPausedAt = Date.now();
    setRecordingState("paused");
    console.log("[REC] PAUSE confirmed");
  };
  activeMediaRecorder.onresume = () => {
    if (recordingPausedAt) {
      recordingTotalPausedMs += Date.now() - recordingPausedAt;
      recordingPausedAt = null;
    }
    setRecordingState("recording");
    console.log("[REC] RESUME confirmed");
  };
  activeMediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
      if (!recordingHasData) {
        recordingHasData = true;
      }
      if (recordedChunks.length === 1) {
        send("RECORDING_DATA_AVAILABLE");
      }
    }
  };
  activeMediaRecorder.onerror = (event) => {
    const errorMessage =
      event.error && event.error.message
        ? event.error.message
        : "Recording failed.";
    recordingLastError = errorMessage;
    setStatus(statusElements.message, `Recording failed: ${errorMessage}`, "error");
    send("RECORDING_ERROR", { error: errorMessage });
  };
  activeMediaRecorder.onstop = async () => {
    if (recordingStopReason === "pause") {
      recordingStopReason = null;
      resolveRecordingStopPromise({ ok: true, paused: true });
      return;
    }
    const stoppedAt = new Date().toISOString();
    const durationMs = computeRecordingElapsedMs();
    recordingDurationMsSnapshot = durationMs;
    const totalBytes = sumRecordingChunks(recordedChunks);
    console.log(
      "[REC] STOP confirmed (onstop fired)",
      `chunks=${recordedChunks.length}`,
      `totalBytes=${totalBytes}`,
      `stoppedAt=${stoppedAt}`,
      `durationMs=${durationMs}`
    );
    const blob = new Blob(recordedChunks, {
      type: recordingMimeType || "video/webm",
    });
    try {
      await finalizeRecordingBlob(blob);
    } finally {
      finalizeStop("Recording stopped.");
      resolveRecordingStopPromise({ ok: true });
    }
  };
  activeMediaRecorder.start(250);
}

function clearRecordingDownloadData() {
  if (recordingObjectUrl) {
    URL.revokeObjectURL(recordingObjectUrl);
  }
  recordingObjectUrl = null;
  recordingMimeType = "video/webm";
  recordingCapturedAt = null;
  chrome.storage.session.remove([
    "latestRecordingUrl",
    "latestRecordingMime",
    "latestRecordingSize",
    "latestRecordingAt",
    "recordingWebmDataUrl",
    "recordingEndedAt",
    "recordingDurationMs",
    "recordingStatusMessage",
  ]);
}

async function setRecordingDownloadData(blob) {
  clearRecordingDownloadData();
  recordingObjectUrl = URL.createObjectURL(blob);
  recordingMimeType = blob.type || "video/webm";
  recordingCapturedAt = new Date().toISOString();
  const durationMs = computeRecordingElapsedMs();
  await chrome.storage.session.set({
    latestRecordingUrl: recordingObjectUrl,
    latestRecordingMime: recordingMimeType,
    latestRecordingSize: blob.size,
    latestRecordingAt: recordingCapturedAt,
    recordingWebmDataUrl: null,
    recordingEndedAt: recordingCapturedAt,
    recordingDurationMs: durationMs,
  });
}

async function loadRecordingDownloadData() {
  const result = await chrome.storage.session.get({
    latestRecordingUrl: null,
    latestRecordingMime: null,
    latestRecordingAt: null,
    recordingWebmDataUrl: null,
    recordingEndedAt: null,
    recordingDurationMs: null,
    recordingStatusMessage: null,
  });
  if (result.latestRecordingUrl) {
    recordingObjectUrl = result.latestRecordingUrl;
    recordingMimeType = result.latestRecordingMime || "video/webm";
    recordingCapturedAt = result.latestRecordingAt || null;
  }
  if (result.recordingStatusMessage) {
    recordingStatusMessage = result.recordingStatusMessage;
  }
}

function setMode(mode) {
  currentMode = mode;
  modeControls.forEach((block) => {
    const isActive = block.dataset.mode === mode;
    block.classList.toggle("active", isActive);
  });
  const isScreenshot = mode === "screenshot";
  if (screenshotHint) {
    screenshotHint.classList.toggle("is-hidden", !isScreenshot);
  }
  if (statusTimerRow) {
    statusTimerRow.classList.toggle("is-hidden", isScreenshot);
  }
  if (statusCountsRow) {
    statusCountsRow.classList.toggle("is-hidden", isScreenshot);
  }
  if (downloadControls) {
    downloadControls.classList.toggle("is-hidden", isScreenshot);
  }
  if (mode === "recording") {
    checkRecordingAvailability();
    refreshStatus();
  } else if (recordingUnavailable) {
    recordingUnavailable.classList.add("hidden");
  }
}

function setRecordingButtons(state) {
  if (recordingControlInFlight) {
    buttons.recordStart.disabled = true;
    buttons.recordPause.disabled = true;
    buttons.recordResume.disabled = true;
    buttons.recordStop.disabled = true;
    buttons.recordStart.classList.add("btn-disabled");
    buttons.recordPause.classList.add("btn-disabled");
    buttons.recordResume.classList.add("btn-disabled");
    buttons.recordStop.classList.add("btn-disabled");
    return;
  }
  if (!recordingAvailable) {
    buttons.recordStart.disabled = true;
    buttons.recordPause.disabled = true;
    buttons.recordResume.disabled = true;
    buttons.recordStop.disabled = true;
    buttons.recordStart.classList.add("btn-disabled");
    buttons.recordPause.classList.add("btn-disabled");
    buttons.recordResume.classList.add("btn-disabled");
    buttons.recordStop.classList.add("btn-disabled");
    if (buttons.recordPanel) {
      buttons.recordPanel.disabled = true;
      buttons.recordPanel.classList.add("is-hidden");
    }
    return;
  }
  if (buttons.recordPanel) {
    buttons.recordPanel.disabled = false;
    buttons.recordPanel.classList.remove("is-hidden");
  }
  const status = state.recordingStatus;
  const startDisabled = status === "recording" || status === "paused";
  const pauseDisabled = status !== "recording";
  const resumeDisabled = status !== "paused";
  const stopDisabled =
    status === "idle" || status === "stopped" || status === "stopping";
  buttons.recordStart.disabled = startDisabled;
  buttons.recordPause.disabled = pauseDisabled;
  buttons.recordResume.disabled = resumeDisabled;
  buttons.recordStop.disabled = stopDisabled;
  buttons.recordStart.classList.toggle("btn-disabled", startDisabled);
  buttons.recordPause.classList.toggle("btn-disabled", pauseDisabled);
  buttons.recordResume.classList.toggle("btn-disabled", resumeDisabled);
  buttons.recordStop.classList.toggle("btn-disabled", stopDisabled);
}

function disableRecordingUI() {
  recordingAvailable = false;
  recordingBlockedReason = "policy";
  if (recordingUnavailable) {
    const shouldShow = currentMode === "recording";
    recordingUnavailable.classList.toggle("hidden", !shouldShow);
  }
  setRecordingButtons({ recordingStatus: "idle" });
}

function enableRecordingUI() {
  recordingAvailable = true;
  recordingBlockedReason = null;
  if (recordingUnavailable) {
    recordingUnavailable.classList.add("hidden");
  }
}

function setRecordingBlocked(reason) {
  recordingAvailable = false;
  recordingBlockedReason = reason;
  if (recordingUnavailable) {
    const shouldShow = currentMode === "recording" && reason === "policy";
    recordingUnavailable.classList.toggle("hidden", !shouldShow);
  }
  setRecordingButtons({ recordingStatus: "idle" });
}

function isPolicyError(message) {
  if (!message) {
    return false;
  }
  const lower = message.toLowerCase();
  return [
    "policy",
    "enterprise",
    "managed",
    "administrator",
    "admin",
    "not allowed",
    "not permitted",
    "blocked",
    "disabled",
  ].some((keyword) => lower.includes(keyword));
}

async function checkRecordingAvailability() {
  const token = ++recordingCheckToken;
  if (recordingBlockedReason === "policy") {
    return;
  }
  let activeTab = null;
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    activeTab = tab;
  } catch (error) {
    activeTab = null;
  }
  if (token !== recordingCheckToken) {
    return;
  }
  if (!activeTab || !activeTab.id || !activeTab.url) {
    enableRecordingUI();
    await refreshStatus();
    return;
  }
  if (isRestrictedUrl(activeTab.url)) {
    setRecordingBlocked("invalid_tab");
    await refreshStatus();
    return;
  }
  if (!chrome?.tabCapture?.getMediaStreamId) {
    setRecordingBlocked("unsupported");
    await refreshStatus();
    return;
  }
  enableRecordingUI();
  await refreshStatus();
}

function disableNetworkUI() {
  networkAvailable = false;
  if (networkRadio) {
    networkRadio.disabled = true;
  }
  if (networkLabel) {
    networkLabel.classList.add("is-disabled");
  }
  if (networkUnavailable) {
    networkUnavailable.classList.remove("hidden");
  }
  if (networkRadio && networkRadio.checked) {
    const screenshotRadio = document.getElementById("mode_screenshot");
    if (screenshotRadio) {
      screenshotRadio.checked = true;
      setMode("screenshot");
    }
  }
  setNetworkButtons({ networkCount: 0, session: null, networkActive: false });
}

function enableNetworkUI() {
  networkAvailable = true;
  if (networkRadio) {
    networkRadio.disabled = false;
  }
  if (networkLabel) {
    networkLabel.classList.remove("is-disabled");
  }
  if (networkUnavailable) {
    networkUnavailable.classList.add("hidden");
  }
}

function setNetworkButtons(state) {
  const session = state.session;
  const isNetworkMode = session && session.mode === "network_console";
  const isCapturing = Boolean(
    session && session.state === "capturing" && isNetworkMode
  );
  const hasRequests = state.networkCount > 0;
  const hasDebuggerAttached = Boolean(
    session &&
      Array.isArray(session.diagnostics) &&
      session.diagnostics.some(
        (entry) => entry && entry.context && entry.context.debuggerAttached === true
      )
  );
  const canStop =
    isNetworkMode && (isCapturing || hasRequests || state.networkActive || hasDebuggerAttached);
  buttons.networkStart.disabled =
    !networkAvailable || Boolean(state.networkActive || isCapturing);
  buttons.networkStop.disabled = !canStop;
}

function applySessionLock(state) {
  const isLocked =
    state.session &&
    (state.session.state === "capturing" ||
      state.session.state === "paused" ||
      state.recordingStatus === "recording" ||
      state.recordingStatus === "paused" ||
      state.networkActive);
  if (!isLocked) {
    return;
  }
  const mode = state.session.mode;
  if (mode !== "screenshot") {
    buttons.screenshot.disabled = true;
  }
  if (mode !== "recording") {
    buttons.recordStart.disabled = true;
  }
  if (mode !== "network_console") {
    buttons.networkStart.disabled = true;
  }
  modeRadios.forEach((radio) => {
    if (radio.value !== mode) {
      radio.disabled = true;
    }
  });
}

function applyStatusMessage(state) {
  if (currentMode === "recording") {
    const sessionState = state.session ? state.session.state : "idle";
    if (recordingStatusMessage) {
      setStatus(statusElements.message, recordingStatusMessage, "default");
      if (controlsStatus) {
        controlsStatus.textContent = recordingStatusMessage;
        controlsStatus.classList.remove("is-hidden");
      }
      return;
    }
    if (recordingBlockedReason === "policy") {
      setStatus(
        statusElements.message,
        "recording_blocked_policy: Recording is unavailable due to browser or enterprise policy. Use Screenshot or Network+Console.",
        "error"
      );
      return;
    }
    if (recordingBlockedReason === "invalid_tab") {
      setStatus(
        statusElements.message,
        "Capture is not supported on browser or store pages. Open a regular website tab and try again.",
        "error"
      );
      return;
    }
    if (recordingBlockedReason === "unsupported") {
      setStatus(
        statusElements.message,
        "Recording not supported: tabCapture.getMediaStreamId is unavailable.",
        "error"
      );
      return;
    }
    if (
      (!state.statusMessage || !state.statusMessage.message) &&
      (sessionState === "idle" || sessionState === "stopped")
    ) {
      setStatus(statusElements.message, "Recording ready.", "success");
      if (controlsStatus) {
        controlsStatus.textContent = "Recording ready.";
        controlsStatus.classList.remove("is-hidden");
      }
      return;
    }
  }
  if (!state.statusMessage || !state.statusMessage.message) {
    statusElements.message.textContent = "-";
    if (controlsStatus) {
      controlsStatus.classList.add("is-hidden");
    }
    if (networkStatusStrip) {
      networkStatusStrip.classList.add("is-hidden");
    }
    return;
  }
  const level = state.statusMessage.level;
  const type =
    level === "error" ? "error" : level === "success" ? "success" : "default";
  setStatus(statusElements.message, state.statusMessage.message, type);
  if (controlsStatus) {
    controlsStatus.textContent = state.statusMessage.message;
    controlsStatus.classList.remove("is-hidden");
  }
  if (networkStatusStrip) {
    networkStatusStrip.textContent = state.statusMessage.message;
    networkStatusStrip.classList.remove("is-hidden");
  }
}

async function showErrorFromResponse(response) {
  const statusMessage =
    (response && response.statusMessage) ||
    (response && response.state ? response.state.statusMessage : null);
  if (statusMessage && statusMessage.message) {
    const level = statusMessage.level;
    const type =
      level === "error"
        ? "error"
        : level === "success"
          ? "success"
          : "default";
    setStatus(statusElements.message, statusMessage.message, type);
    return;
  }
  if (response && response.error) {
    setStatus(statusElements.message, response.error, "error");
  }
}

async function handleFailedResponse(response) {
  const statusMessage =
    (response && response.statusMessage) ||
    (response && response.state ? response.state.statusMessage : null);
  if (statusMessage && statusMessage.message) {
    const level = statusMessage.level;
    const type =
      level === "error"
        ? "error"
        : level === "success"
          ? "success"
          : "default";
    setStatus(statusElements.message, statusMessage.message, type);
    await refreshStatus();
    return;
  }
  if (response && response.error) {
    setStatus(statusElements.message, response.error, "error");
  } else {
    setStatus(statusElements.message, "Request failed.", "error");
  }
  await refreshStatus();
}

function formatElapsed(startIso, endIso) {
  if (!startIso) {
    return "00:00";
  }
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const totalSeconds = Math.max(0, Math.floor((end - start) / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatElapsedWithPauses(session) {
  if (!session || !session.created_at) {
    return "00:00";
  }
  const start = new Date(session.created_at).getTime();
  let end = session.ended_at ? new Date(session.ended_at).getTime() : Date.now();
  const pausedMs = session.total_paused_ms || 0;
  if (session.pause_started_at) {
    const pausedAt = new Date(session.pause_started_at).getTime();
    if (!Number.isNaN(pausedAt)) {
      end = pausedAt;
    }
  }
  const totalSeconds = Math.max(
    0,
    Math.floor((end - start - pausedMs) / 1000)
  );
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatElapsedFromLiveState(liveState, fallbackSession) {
  if (!liveState || !liveState.startedAt) {
    return formatElapsedWithPauses(fallbackSession);
  }
  if (liveState.elapsedText) {
    return liveState.elapsedText;
  }
  const elapsedMs =
    typeof liveState.elapsedMs === "number" ? liveState.elapsedMs : 0;
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function updateStatusUI(state) {
  buttons.screenshot.disabled = false;
  modeRadios.forEach((radio) => {
    radio.disabled = false;
  });

  if (state.session && state.session.mode) {
    const matchingRadio = modeRadios.find(
      (radio) => radio.value === state.session.mode
    );
    if (matchingRadio) {
      matchingRadio.checked = true;
      setMode(state.session.mode);
    }
  }

  const sessionMode = state.session ? state.session.mode : null;
  const liveRecordingState =
    sessionMode === "recording" && recordingLiveState
      ? recordingLiveState.state
      : null;
  const sessionState = liveRecordingState || (state.session ? state.session.state : "idle");
  const modeLabel = sessionMode ? sessionMode.replace("_", " + ") : "-";
  statusElements.mode.textContent = modeLabel;
  statusElements.state.textContent = sessionState || "idle";

  statusElements.timer.textContent = formatElapsedFromLiveState(
    recordingLiveState,
    state.session
  );

  const counts = state.session ? state.session.counts : null;
  const requestCount = counts ? counts.network_requests : 0;
  const logCount = counts ? counts.console_entries : 0;
  const errorCount = counts ? counts.errors : 0;
  statusElements.counts.textContent = `${requestCount} requests, ${logCount} logs, ${errorCount} errors`;

  if (networkTip) {
    let showTip = false;
    if (
      sessionMode === "network_console" &&
      sessionState === "capturing" &&
      requestCount === 0
    ) {
      const startMs =
        state.session && state.session.created_at
          ? Date.parse(state.session.created_at)
          : null;
      if (startMs && Date.now() - startMs > 3000) {
        showTip = true;
      }
    }
    networkTip.classList.toggle("is-hidden", !showTip);
  }

  if (networkGuidance) {
    const showGuidance =
      sessionMode === "network_console" && sessionState === "capturing";
    if (showGuidance && state.statusMessage && state.statusMessage.message) {
      networkGuidance.textContent = state.statusMessage.message;
    }
    networkGuidance.classList.toggle("is-hidden", !showGuidance);
  }

  if (buttons.networkRefresh) {
    const hasActiveTab =
      state.session &&
      state.session.active_tab &&
      state.session.active_tab.tab_id;
    buttons.networkRefresh.disabled =
      currentMode !== "network_console" || !networkAvailable || !hasActiveTab;
  }

  if (liveRecordingState && liveRecordingState.ok) {
    state.recordingStatus = liveRecordingState.state;
    if (state.artifacts) {
      state.artifacts.hasRecording = Boolean(liveRecordingState.hasData);
    }
  }
  setRecordingButtons(state);
  setNetworkButtons(state);
  applySessionLock(state);
  applyStatusMessage(state);

  const isRecordingMode = currentMode === "recording";
  if (buttons.download) {
    buttons.download.classList.toggle("is-hidden", isRecordingMode);
  }
  if (buttons.downloadRecording) {
    buttons.downloadRecording.classList.toggle("is-hidden", !isRecordingMode);
  }
  if (!isRecordingMode) {
    if (state.artifacts) {
      buttons.download.disabled =
        currentMode === "screenshot" || !state.artifacts.hasAnyArtifacts;
    } else if (typeof state.hasArtifacts === "boolean") {
      buttons.download.disabled = currentMode === "screenshot" || !state.hasArtifacts;
    }
  } else if (buttons.downloadRecording) {
    const hasRecording = state.artifacts ? state.artifacts.hasRecording : false;
    const recordingReady =
      hasRecording &&
      state.recordingStatus !== "recording" &&
      state.recordingStatus !== "paused";
    buttons.downloadRecording.disabled = !recordingReady;
  }

  const hasError = state.session && state.session.state === "error";
  const autoExpand =
    sessionState === "capturing" || sessionState === "paused" || hasError;
  const shouldCollapse =
    currentMode === "screenshot" ||
    ((sessionState === "idle" || sessionState === "stopped") && !hasError);
  if (!statusUserToggled) {
    const collapsed = shouldCollapse && !autoExpand;
    statusBody.classList.toggle("collapsed", collapsed);
    statusChevron.textContent = collapsed ? "▸" : "▾";
  }
}

async function refreshStatus() {
  const response = await send(MSG.GET_STATUS);
  if (!response.ok) {
    setStatus(statusElements.download, response.error, "error");
    return;
  }
  const live = await send(MSG.RECORDING_GET_STATE);
  if (live && live.ok) {
    recordingLiveState = live;
    console.log(
      "[REC][popup] GET_STATE ->",
      `state=${live.state}`,
      `hasData=${live.hasData}`,
      `recorderState=${live.recorderState}`
    );
  } else {
    recordingLiveState = null;
  }
  updateStatusUI(response.state);
  if (!jszipAvailable) {
    assertJsZipAvailable();
  }
}

async function handleScreenshot() {
  setStatus(statusElements.message, "Capturing screenshot...");
  const response = await send("TAKE_SCREENSHOT");
  if (
    !response.ok ||
    typeof response.screenshotDataUrl !== "string" ||
    !response.screenshotDataUrl.startsWith("data:image/png")
  ) {
    const reason =
      response && response.error
        ? response.error
        : "missing dataUrl";
    setStatus(
      statusElements.message,
      `Screenshot capture failed: ${reason}`,
      "error"
    );
    await refreshStatus();
    return;
  }
  try {
    await chrome.storage.session.set({
      latestScreenshotDataUrl: response.screenshotDataUrl,
    });
    await chrome.tabs.create({
      url: chrome.runtime.getURL("popup/screenshot_viewer.html"),
    });
    setStatus(
      statusElements.message,
      "Opened screenshot viewer in new tab.",
      "success"
    );
  } catch (error) {
    setStatus(
      statusElements.message,
      error && error.message ? error.message : "Failed to open viewer.",
      "error"
    );
  }
  await refreshStatus();
}

async function handleRecordingStart() {
  clearStatusError();
  if (recordingBlockedReason === "invalid_tab") {
    setStatus(
      statusElements.message,
      "Capture is not supported on browser or store pages. Open a regular website tab and try again.",
      "error"
    );
    return;
  }
  if (recordingBlockedReason === "policy") {
    setStatus(
      statusElements.message,
      "Recording is unavailable due to browser or enterprise policy.",
      "error"
    );
    return;
  }
  console.log("[REC][popup] start clicked");
  setStatus(statusElements.download, "Starting recording...");
  recordingStatusMessage = null;
  chrome.storage.session.remove(["recordingStatusMessage"]);
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    setStatus(statusElements.message, "No active tab.", "error");
    setRecordingButtons({ recordingStatus: "idle" });
    return;
  }
  console.log("[REC][popup] start clicked ->", { tabId: tab.id, url: tab.url });
  if (isRestrictedUrl(tab.url)) {
    setStatus(
      statusElements.message,
      "Capture is not supported on browser or store pages. Open a regular website tab and try again.",
      "error"
    );
    setRecordingButtons({ recordingStatus: "idle" });
    return;
  }
  if (!chrome?.tabCapture?.getMediaStreamId) {
    setStatus(
      statusElements.message,
      "Recording not supported: tabCapture.getMediaStreamId is unavailable.",
      "error"
    );
    setRecordingButtons({ recordingStatus: "idle" });
    return;
  }
  recordingControlInFlight = true;
  setRecordingButtons({ recordingStatus: "idle" });
  let streamId = null;
  try {
    streamId = await getMediaStreamId(tab.id);
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    console.log("[REC][popup] getMediaStreamId failed", message);
    setStatus(
      statusElements.message,
      `Error starting tab capture: ${message}`,
      "error"
    );
    recordingControlInFlight = false;
    setRecordingButtons({ recordingStatus: "idle" });
    return;
  }
  if (!streamId) {
    setStatus(
      statusElements.message,
      "Error starting tab capture: no stream id returned.",
      "error"
    );
    recordingControlInFlight = false;
    setRecordingButtons({ recordingStatus: "idle" });
    return;
  }
  console.log("[REC][popup] getMediaStreamId ok", { streamId });
  const preferredMimeType = pickRecordingMimeType() || "video/webm";
  const res = await send(MSG.RECORDING_START, {
    tabId: tab.id,
    streamId,
    mimeType: preferredMimeType,
  });
  if (!res?.ok) {
    setStatus(
      statusElements.message,
      res?.error
        ? `Failed to start offscreen recorder: ${res.error}`
        : "Failed to start offscreen recorder.",
      "error"
    );
    setRecordingButtons({ recordingStatus: "idle" });
    recordingControlInFlight = false;
    return;
  }
  const st = await send(MSG.RECORDING_GET_STATE);
  if (st && st.ok) {
    recordingLiveState = st;
  }
  showRecordingInfo("Recording started.");
  recordingControlInFlight = false;
  setRecordingButtons({ recordingStatus: st?.state || "recording" });
  await refreshStatus();
}

async function handleRecordingPause() {
  if (recordingControlInFlight) {
    return;
  }
  const res = await send(MSG.RECORDING_PAUSE);
  if (!res.ok) {
    setStatus(
      statusElements.message,
      res.error || "Failed to pause recording.",
      "error"
    );
  }
  const st = await send(MSG.RECORDING_GET_STATE);
  if (st && st.ok) {
    recordingLiveState = st;
  }
  setRecordingButtons({ recordingStatus: st?.state || "idle" });
  await refreshStatus();
}

async function handleRecordingResume() {
  if (recordingControlInFlight) {
    return;
  }
  const res = await send(MSG.RECORDING_RESUME);
  if (!res.ok) {
    setStatus(
      statusElements.message,
      res.error || "Failed to resume recording.",
      "error"
    );
  }
  const st = await send(MSG.RECORDING_GET_STATE);
  if (st && st.ok) {
    recordingLiveState = st;
  }
  setRecordingButtons({ recordingStatus: st?.state || "idle" });
  await refreshStatus();
}

async function handleRecordingStop() {
  if (recordingControlInFlight) {
    return;
  }
  setStatus(statusElements.download, "Stopping recording...");
  const res = await send(MSG.RECORDING_STOP);
  if (!res.ok) {
    setStatus(
      statusElements.message,
      res.error || "Failed to stop recording.",
      "error"
    );
  }
  const st = await send(MSG.RECORDING_GET_STATE);
  if (st && st.ok) {
    recordingLiveState = st;
  }
  setRecordingButtons({ recordingStatus: st?.state || "idle" });
  await refreshStatus();
}

async function handleNetworkStart() {
  setStatus(statusElements.download, "Starting network capture...");
  const response = await send("NETWORK_START");
  if (!response.ok) {
    await handleFailedResponse(response);
    if (response.code === "debugger_blocked") {
      disableNetworkUI();
      setStatus(
        statusElements.message,
        "Network+Console is blocked by enterprise policy on this browser.",
        "error"
      );
    }
    await refreshStatus();
    return;
  }
    const baseMessage =
    "Capture started - now Refresh (Ctrl+R) or click a link to capture requests.";
  const warningSuffix =
    response.consoleEnabled === false
      ? " Console capture unavailable (policy blocked). Network capture still running."
      : "";
  const message = `${baseMessage}${warningSuffix}`;
  setStatus(statusElements.message, message, "success");
  if (networkGuidance) {
    networkGuidance.textContent = message;
    networkGuidance.classList.remove("is-hidden");
  }
  setStatus(statusElements.download, "Network capture started.", "success");
  await refreshStatus();
}

async function handleNetworkStop() {
  setStatus(statusElements.download, "Stopping network capture...");
  const response = await send("NETWORK_STOP");
  if (!response.ok) {
    await handleFailedResponse(response);
    await refreshStatus();
    return;
  }
  setStatus(statusElements.download, "Network capture stopped.", "success");
  await refreshStatus();
}

async function buildEnvironmentFallback() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const userAgent = navigator.userAgent;
  let platform = "unknown";
  try {
    const platformInfo = await chrome.runtime.getPlatformInfo();
    platform = platformInfo.os || platform;
  } catch (error) {
    platform = navigator.platform || platform;
  }

  return {
    user_agent: userAgent,
    browser: detectBrowser(userAgent),
    browser_version: parseBrowserVersion(userAgent),
    platform,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown",
    captured_url: tab && tab.url ? tab.url : "",
    captured_title: tab && tab.title ? tab.title : "",
    timestamp: new Date().toISOString(),
  };
}

async function handleDownload() {
  let hadError = false;
  if (currentMode === "recording") {
    setStatus(
      statusElements.download,
      "Use Download Recording for video captures.",
      "error"
    );
    return;
  }
  buttons.download.disabled = true;
  setStatus(statusElements.download, "Preparing ZIP...");
  try {
    const statusResponse = await send(MSG.GET_STATUS);
    if (!statusResponse.ok) {
      setStatus(statusElements.download, statusResponse.error, "error");
      hadError = true;
      return;
    }
    if (
      statusResponse.state.artifacts &&
      !statusResponse.state.artifacts.hasAnyArtifacts
    ) {
      setStatus(statusElements.download, "No artifacts to export.", "error");
      hadError = true;
      return;
    }

    if (
      statusResponse.state.recordingStatus === "recording" ||
      statusResponse.state.recordingStatus === "paused"
    ) {
      setStatus(
        statusElements.download,
        "Stop recording before downloading.",
        "error"
      );
      hadError = true;
      return;
    }

    const timezone =
      Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
    const requestedExportTimestamp = formatExportTimestamp(new Date());
    const exportResponse = await Promise.race([
      send("GET_EVIDENCE_EXPORT_DATA", {
        timezone,
        exportTimestamp: requestedExportTimestamp,
      }),
      new Promise((resolve) =>
        setTimeout(
          () => resolve({ ok: false, error: "ZIP export timed out. Try again or reduce capture size." }),
          10000
        )
      ),
    ]);
    if (!exportResponse.ok) {
      setStatus(
        statusElements.download,
        exportResponse.error || "Export data unavailable.",
        "error"
      );
      hadError = true;
      return;
    }

    const data = exportResponse.data;
    const exportTimestamp = data.exportTimestamp || requestedExportTimestamp;
    const zip = new JSZip();
    if (Array.isArray(data.screenshots)) {
      for (const shot of data.screenshots) {
        if (shot && shot.dataUrl) {
          const screenshotBlob = await dataUrlToBlob(shot.dataUrl);
          const name =
            shot.fileName ||
            `qa-screenshot-${formatZipTimestamp(new Date())}.png`;
          zip.file(name, screenshotBlob);
        }
      }
    } else if (data.screenshotDataUrl) {
      const screenshotBlob = await dataUrlToBlob(data.screenshotDataUrl);
      zip.file("screenshot.png", screenshotBlob);
    }
    if (data.recordingDataUrl) {
      const recordingBlob = await dataUrlToBlob(data.recordingDataUrl);
      const recordingName = data.recordingMimeType
        ? "recording.webm"
        : "recording.webm";
      zip.file(recordingName, recordingBlob);
    }
    zip.file(
      "network_logs.json",
      JSON.stringify(data.networkLogs || { version: "1.0", entries: [] }, null, 2)
    );
    zip.file(
      "console_logs.json",
      JSON.stringify(data.consoleLogs || { version: "1.0", entries: [] }, null, 2)
    );
    if (data.qaSessionLog) {
      zip.file("qa-session-log.json", JSON.stringify(data.qaSessionLog, null, 2));
    }
    if (data.qaSummaryText) {
      zip.file("qa-summary.txt", data.qaSummaryText);
    }
    zip.file("session.json", JSON.stringify(data.session || {}, null, 2));
    zip.file("environment.json", JSON.stringify(data.environment || {}, null, 2));

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("ZIP export timed out. Try again or reduce capture size.")),
        10000
      )
    );
    await Promise.race([
      (async () => {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        const filename = `evidence_${formatZipTimestamp(new Date())}.zip`;
        try {
          await new Promise((resolve, reject) => {
            chrome.downloads.download({ url, filename }, (downloadId) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
              }
              resolve(downloadId);
            });
          });
        } finally {
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        }
      })(),
      timeoutPromise,
    ]);

    if (data.recordingDataUrl) {
      const recordingBlob = await dataUrlToBlob(data.recordingDataUrl);
      await downloadBlob(
        recordingBlob,
        `qa-session-video-${exportTimestamp}.webm`
      );
    }
    if (data.qaSessionLog) {
      const logBlob = new Blob([JSON.stringify(data.qaSessionLog, null, 2)], {
        type: "application/json",
      });
      await downloadBlob(logBlob, `qa-session-log-${exportTimestamp}.json`);
    }
    if (data.qaSummaryText) {
      const summaryBlob = new Blob([data.qaSummaryText], { type: "text/plain" });
      await downloadBlob(summaryBlob, `qa-summary-${exportTimestamp}.txt`);
    }
    if (Array.isArray(data.screenshots)) {
      for (const shot of data.screenshots) {
        if (!shot || !shot.dataUrl) {
          continue;
        }
        const screenshotBlob = await dataUrlToBlob(shot.dataUrl);
        const name =
          shot.fileName ||
          `qa-screenshot-${formatZipTimestamp(new Date())}.png`;
        await downloadBlob(screenshotBlob, name);
      }
    }

    setStatus(statusElements.download, "Download started.", "success");
  } catch (error) {
    hadError = true;
    setStatus(
      statusElements.download,
      error && error.message ? error.message : "Download failed.",
      "error"
    );
  } finally {
    buttons.download.disabled = false;
    if (!hadError) {
      setStatus(statusElements.download, "Ready.");
    }
    await refreshStatus();
  }
}

async function handleRecordingDownload() {
  clearStatusError();
  const live = await send(MSG.RECORDING_GET_STATE);
  if (live && live.ok && (live.state === "recording" || live.state === "paused")) {
    setStatus(statusElements.download, "Stop recording to download.", "error");
    return;
  }
  setStatus(statusElements.download, "Preparing download...");
  try {
    const res = await send(MSG.RECORDING_EXPORT_WEBM);
    if (!res?.ok || !res.blobUrl) {
      setStatus(
        statusElements.download,
        res?.error || "No recording available to download.",
        "error"
      );
      return;
    }
    if (!chrome.downloads?.download) {
      setStatus(statusElements.download, "Downloads API unavailable.", "error");
      return;
    }
    const exportTimestamp = formatExportTimestamp(new Date());
    await new Promise((resolve, reject) => {
      chrome.downloads.download(
        {
          url: res.blobUrl,
          filename: `qa-session-video-${exportTimestamp}.webm`,
          saveAs: false,
        },
        (downloadId) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(downloadId);
        }
      );
    });
    setStatus(statusElements.download, "Download started.", "success");
  } catch (error) {
    setStatus(
      statusElements.download,
      error && error.message ? error.message : "Download failed.",
      "error"
    );
  }
}

async function handleAddMarker() {
  const note = window.prompt("Marker note (optional)");
  if (note === null) {
    return;
  }
  const response = await send(MSG.ADD_MARKER, { note });
  if (!response.ok) {
    setStatus(
      statusElements.message,
      response.error || "Failed to add marker.",
      "error"
    );
    return;
  }
  setStatus(statusElements.message, "Marker added.", "success");
  await refreshStatus();
}

async function handleResetSession() {
  await send(MSG.RECORDING_RESET);
  await send(MSG.NETWORK_RESET);
  const response = await send(MSG.RESET_SESSION);
  if (!response.ok) {
    setStatus(statusElements.download, response.error, "error");
    await refreshStatus();
    return;
  }
  recordingStatusMessage = null;
  chrome.storage.session.remove(["recordingStatusMessage"]);
  clearRecordingDownloadData();
  setStatus(statusElements.message, "Ready.", "default");
  setStatus(statusElements.download, "Session reset.", "success");
  await refreshStatus();
}

async function loadRedactionSetting() {
  const result = await chrome.storage.local.get({ redactionEnabled: true });
  const enabled = result.redactionEnabled !== false;
  redactionToggle.checked = enabled;
  redactionStatus.textContent = enabled ? "ON" : "OFF";
}

async function loadRecordingAvailability() {
  const res = await send(MSG.GET_CAPABILITIES);
  const tabCaptureAvailable = Boolean(
    res && res.ok && res.capabilities && res.capabilities.tabCaptureAvailable
  );
  if (!res.ok || !tabCaptureAvailable) {
    enableRecordingUI();
    return res;
  }
  enableRecordingUI();
  return res;
}

async function probeRecordingAvailability() {
  if (currentMode !== "recording") {
    return;
  }
  await checkRecordingAvailability();
}

async function loadNetworkAvailability(capabilities, tabId) {
  const statusResponse = await send(MSG.GET_STATUS);
  const statusState = statusResponse && statusResponse.ok ? statusResponse.state : null;
  const captureActive =
    statusState &&
    statusState.session &&
    statusState.session.mode === "network_console" &&
    (statusState.session.state === "capturing" || statusState.networkActive);
  if (captureActive) {
    enableNetworkUI();
    return;
  }
  const debuggerPresent = Boolean(
    capabilities && capabilities.debuggerApiPresent
  );
  if (!debuggerPresent) {
    disableNetworkUI();
    return;
  }

  const probe = await send("PROBE_DEBUGGER", { tabId });
  if (probe.ok && probe.debuggerAttachAllowed === false) {
    disableNetworkUI();
    return;
  }

  enableNetworkUI();
}

async function initCapabilities() {
  const res = await loadRecordingAvailability();
  if (!res || !res.ok) {
    return;
  }
  let tabId = null;
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    tabId = tab && tab.id ? tab.id : null;
  } catch (error) {
    tabId = null;
  }
  await probeRecordingAvailability();
  await loadNetworkAvailability(res.capabilities, tabId);
}

buttons.screenshot.addEventListener("click", handleScreenshot);
buttons.recordStart.addEventListener("click", handleRecordingStart);
buttons.recordPause.addEventListener("click", handleRecordingPause);
buttons.recordResume.addEventListener("click", handleRecordingResume);
buttons.recordStop.addEventListener("click", handleRecordingStop);
buttons.recordPanel.addEventListener("click", async () => {
  await send("OPEN_RECORDING_PANEL");
  await refreshStatus();
});
buttons.networkStart.addEventListener("click", handleNetworkStart);
buttons.networkStop.addEventListener("click", handleNetworkStop);
if (buttons.networkRefresh) {
  buttons.networkRefresh.addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab || !tab.id) {
        setStatus(
          statusElements.message,
          "No active tab to refresh.",
          "error"
        );
        return;
      }
      await chrome.tabs.reload(tab.id);
      setStatus(statusElements.message, "Refreshing tab...", "success");
    } catch (error) {
      setStatus(
        statusElements.message,
        "Unable to refresh the active tab.",
        "error"
      );
    }
  });
}
buttons.download.addEventListener("click", handleDownload);
if (buttons.downloadRecording) {
  buttons.downloadRecording.addEventListener("click", handleRecordingDownload);
}
if (buttons.addMarker) {
  buttons.addMarker.addEventListener("click", handleAddMarker);
}
buttons.reset.addEventListener("click", handleResetSession);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "RECORDING_STATE_CHANGED") {
    (async () => {
      await refreshStatus();
      sendResponse({ ok: true });
    })().catch((error) =>
      sendResponse({ ok: false, error: error.message || "Update failed." })
    );
    return true;
  }
  return false;
});
statusToggle.addEventListener("click", () => {
  const collapsed = statusBody.classList.toggle("collapsed");
  statusChevron.textContent = collapsed ? "▸" : "▾";
  statusUserToggled = true;
});
redactionToggle.addEventListener("change", async (event) => {
  const enabled = event.target.checked;
  await chrome.storage.local.set({ redactionEnabled: enabled });
  redactionStatus.textContent = enabled ? "ON" : "OFF";
});

modeRadios.forEach((radio) => {
  radio.addEventListener("change", (event) => {
    const selectedMode = event.target.value;
    setMode(selectedMode);
  });
});

assertJsZipAvailable();
setMode(currentMode);
loadRedactionSetting();
initCapabilities();
refreshStatus();
setInterval(refreshStatus, 1000);

if (versionBadge) {
  versionBadge.textContent = APP_VERSION;
}

loadRecordingDownloadData();
