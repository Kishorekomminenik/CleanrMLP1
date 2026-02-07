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

const STATUS_COLORS = {
  default: "#4b5563",
  error: "#b91c1c",
  success: "#166534",
};

const APP_VERSION = "v0.1";

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

function pickRecordingMimeType() {
  if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
    return "video/webm;codecs=vp9";
  }
  if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) {
    return "video/webm;codecs=vp8";
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
}

function finalizeRecordingBlob(blob) {
  const reader = new FileReader();
  reader.onload = async () => {
    const dataUrl = reader.result;
    await send("RECORDING_COMPLETE", {
      dataUrl,
      mimeType: blob.type,
      size: blob.size,
    });
    resetLocalRecording();
    setStatus(statusElements.download, "Recording stopped.", "success");
    await refreshStatus();
  };
  reader.onerror = async () => {
    await send("RECORDING_ERROR", {
      error: "Failed to finalize recording.",
    });
    resetLocalRecording();
    setStatus(statusElements.download, "Recording failed.", "error");
    await refreshStatus();
  };
  reader.readAsDataURL(blob);
}

function startMediaRecorderSegment() {
  const options = {};
  const mimeType = pickRecordingMimeType();
  if (mimeType) {
    options.mimeType = mimeType;
  }
  activeMediaRecorder = new MediaRecorder(activeRecordingStream, options);
  recordingMimeType = activeMediaRecorder.mimeType || "video/webm";
  activeMediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
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
    setStatus(statusElements.message, `Recording failed: ${errorMessage}`, "error");
    send("RECORDING_ERROR", { error: errorMessage });
  };
  activeMediaRecorder.onstop = () => {
    if (recordingStopReason === "pause") {
      recordingStopReason = null;
      return;
    }
    const blob = new Blob(recordedChunks, {
      type: activeMediaRecorder.mimeType || "video/webm",
    });
    finalizeRecordingBlob(blob);
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
  ]);
}

async function setRecordingDownloadData(blob) {
  clearRecordingDownloadData();
  recordingObjectUrl = URL.createObjectURL(blob);
  recordingMimeType = blob.type || "video/webm";
  recordingCapturedAt = new Date().toISOString();
  await chrome.storage.session.set({
    latestRecordingUrl: recordingObjectUrl,
    latestRecordingMime: recordingMimeType,
    latestRecordingSize: blob.size,
    latestRecordingAt: recordingCapturedAt,
  });
}

async function loadRecordingDownloadData() {
  const result = await chrome.storage.session.get({
    latestRecordingUrl: null,
    latestRecordingMime: null,
    latestRecordingAt: null,
  });
  if (result.latestRecordingUrl) {
    recordingObjectUrl = result.latestRecordingUrl;
    recordingMimeType = result.latestRecordingMime || "video/webm";
    recordingCapturedAt = result.latestRecordingAt || null;
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
  } else if (recordingUnavailable) {
    recordingUnavailable.classList.add("hidden");
  }
}

function setRecordingButtons(state) {
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
  if (!/^https?:\/\//i.test(activeTab.url)) {
    setRecordingBlocked("invalid_tab");
    await refreshStatus();
    return;
  }
  if (!chrome?.tabCapture?.capture) {
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
        "Recording requires an active http(s) webpage.",
        "error"
      );
      return;
    }
    if (recordingBlockedReason === "unsupported") {
      setStatus(
        statusElements.message,
        "Recording not supported in this browser.",
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
  const start = new Date(liveState.startedAt).getTime();
  let end = Date.now();
  if (liveState.state === "paused" && liveState.pausedAt) {
    const pausedAt = new Date(liveState.pausedAt).getTime();
    if (!Number.isNaN(pausedAt)) {
      end = pausedAt;
    }
  }
  const totalSeconds = Math.max(
    0,
    Math.floor((end - start - (liveState.totalPausedMs || 0)) / 1000)
  );
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

  if (liveRecordingState) {
    state.recordingStatus = liveRecordingState;
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
  const response = await send("GET_STATUS");
  if (!response.ok) {
    setStatus(statusElements.download, response.error, "error");
    return;
  }
  if (
    currentMode === "recording" ||
    (response.state.session && response.state.session.mode === "recording")
  ) {
    const live = await send("RECORDING_GET_STATE");
    if (live && live.ok) {
      recordingLiveState = live;
      console.log(
        "[REC] GET_STATE ->",
        `state=${live.state}`,
        `hasData=${live.hasData}`,
        `mimeType=${live.mimeType}`
      );
    } else {
      recordingLiveState = null;
    }
  } else {
    recordingLiveState = null;
  }
  updateStatusUI(response.state);
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
  if (recordingBlockedReason === "invalid_tab") {
    setStatus(
      statusElements.message,
      "Recording requires an active http(s) webpage.",
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
  console.log("[REC] start clicked");
  setStatus(statusElements.download, "Starting recording...");
  clearRecordingDownloadData();
  chrome.tabCapture.capture({ video: true, audio: false }, (stream) => {
    const lastError = chrome.runtime.lastError;
    console.log("[REC] capture returned", stream, lastError);
    if (lastError || !stream) {
      const message = lastError && lastError.message ? lastError.message : "";
      if (message && isPolicyError(message)) {
        setRecordingBlocked("policy");
        setStatus(
          statusElements.message,
          "Recording blocked by browser policy.",
          "error"
        );
      } else if (message) {
        setStatus(statusElements.message, `Recording failed: ${message}`, "error");
      } else {
        setStatus(
          statusElements.message,
          "Recording failed: capture was denied or no stream returned.",
          "error"
        );
      }
      setStatus(statusElements.download, "Recording failed.", "error");
      refreshStatus();
      return;
    }
    activeRecordingStream = stream;
    recordedChunks = [];
    try {
      recordingSegmentMode = false;
      recordingStopReason = null;
      startMediaRecorderSegment();
    } catch (error) {
      setStatus(
        statusElements.message,
        `Recording failed: ${error && error.message ? error.message : String(error)}`,
        "error"
      );
      stopActiveRecordingStream();
      refreshStatus();
      return;
    }
    send("RECORDING_SESSION_START");
    setStatus(statusElements.download, "Recording started.", "success");
    refreshStatus();
  });
}

async function handleRecordingPause() {
  if (!activeMediaRecorder || activeMediaRecorder.state !== "recording") {
    setStatus(statusElements.download, "Recording is not active.", "error");
    return;
  }
  try {
    console.log("[REC] pause clicked", activeMediaRecorder.state);
    if (typeof activeMediaRecorder.pause === "function") {
      activeMediaRecorder.pause();
    } else {
      throw new Error("Pause not supported");
    }
    await send("RECORDING_SESSION_PAUSE");
    setStatus(statusElements.download, "Recording paused.", "success");
    await refreshStatus();
  } catch (error) {
    try {
      recordingSegmentMode = true;
      recordingStopReason = "pause";
      activeMediaRecorder.stop();
      await send("RECORDING_SESSION_PAUSE");
      setStatus(statusElements.download, "Recording paused.", "success");
      await refreshStatus();
    } catch (innerError) {
      setStatus(
        statusElements.download,
        innerError && innerError.message
          ? innerError.message
          : "Failed to pause recording.",
        "error"
      );
    }
  }
}

async function handleRecordingResume() {
  if (!activeMediaRecorder) {
    setStatus(statusElements.download, "Recording is not paused.", "error");
    return;
  }
  try {
    console.log("[REC] resume clicked", activeMediaRecorder.state);
    if (activeMediaRecorder.state === "paused") {
      activeMediaRecorder.resume();
    } else if (recordingSegmentMode && activeMediaRecorder.state === "inactive") {
      startMediaRecorderSegment();
    } else {
      throw new Error("Recording is not paused.");
    }
    await send("RECORDING_SESSION_RESUME");
    setStatus(statusElements.download, "Recording resumed.", "success");
    await refreshStatus();
  } catch (error) {
    setStatus(
      statusElements.download,
      error && error.message ? error.message : "Failed to resume recording.",
      "error"
    );
  }
}

async function handleRecordingStop() {
  if (!activeMediaRecorder || activeMediaRecorder.state === "inactive") {
    if (recordingSegmentMode && recordedChunks.length > 0) {
      const blob = new Blob(recordedChunks, {
        type: recordingMimeType || "video/webm",
      });
      finalizeRecordingBlob(blob);
      await send("RECORDING_SESSION_STOPPING");
      return;
    }
    const live = await send("RECORDING_GET_STATE");
    if (live && live.ok && (live.state === "idle" || live.state === "stopped")) {
      setStatus(statusElements.download, "Recording already stopped.", "success");
      await refreshStatus();
      return;
    }
    setStatus(statusElements.download, "Recording already stopped.", "success");
    await refreshStatus();
    return;
  }
  setStatus(statusElements.download, "Stopping recording...");
  try {
    console.log("[REC] stop clicked", activeMediaRecorder.state);
    await send("RECORDING_SESSION_STOPPING");
    recordingStopReason = "stop";
    activeMediaRecorder.stop();
  } catch (error) {
    setStatus(
      statusElements.download,
      error && error.message ? error.message : "Failed to stop recording.",
      "error"
    );
  }
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
    if (!window.JSZip) {
      setStatus(statusElements.download, "JSZip is not available.", "error");
      hadError = true;
      return;
    }
    const statusResponse = await send("GET_STATUS");
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
    const exportResponse = await send("GET_EXPORT_DATA", { timezone });
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
    const zip = new JSZip();
    if (data.screenshotDataUrl) {
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
    zip.file("session.json", JSON.stringify(data.session || {}, null, 2));
    zip.file("environment.json", JSON.stringify(data.environment || {}, null, 2));

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("ZIP export timed out.")), 10000)
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
  const live = await send("RECORDING_GET_STATE");
  if (live && live.ok && (live.state === "recording" || live.state === "paused")) {
    setStatus(
      statusElements.download,
      "Stop recording to download.",
      "error"
    );
    return;
  }
  setStatus(statusElements.download, "Preparing download...");
  try {
    const res = await Promise.race([
      send("RECORDING_EXPORT_WEBM"),
      new Promise((resolve) =>
        setTimeout(
          () => resolve({ ok: false, error: "Download timed out." }),
          10000
        )
      ),
    ]);
    if (!res.ok) {
      setStatus(
        statusElements.download,
        res.error || "No recording available to download.",
        "error"
      );
      return;
    }
    setStatus(statusElements.download, "Download started.", "success");
  } catch (error) {
    setStatus(
      statusElements.download,
      error && error.message ? error.message : "Download failed.",
      "error"
    );
  }
}

async function handleResetSession() {
  const response = await send("RESET_SESSION");
  if (!response.ok) {
    setStatus(statusElements.download, response.error, "error");
    await refreshStatus();
    return;
  }
  clearRecordingDownloadData();
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
  const res = await send("GET_CAPABILITIES");
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
  const statusResponse = await send("GET_STATUS");
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
buttons.reset.addEventListener("click", handleResetSession);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "RECORDING_PANEL_PAUSE") {
    (async () => {
      await handleRecordingPause();
      sendResponse({ ok: true });
    })().catch((error) =>
      sendResponse({ ok: false, error: error.message || "Pause failed." })
    );
    return true;
  }
  if (message.type === "RECORDING_PANEL_RESUME") {
    (async () => {
      await handleRecordingResume();
      sendResponse({ ok: true });
    })().catch((error) =>
      sendResponse({ ok: false, error: error.message || "Resume failed." })
    );
    return true;
  }
  if (message.type === "RECORDING_PANEL_STOP") {
    (async () => {
      await handleRecordingStop();
      sendResponse({ ok: true });
    })().catch((error) =>
      sendResponse({ ok: false, error: error.message || "Stop failed." })
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

setMode(currentMode);
loadRedactionSetting();
initCapabilities();
refreshStatus();
setInterval(refreshStatus, 1000);

if (versionBadge) {
  versionBadge.textContent = APP_VERSION;
}
