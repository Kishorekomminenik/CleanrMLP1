const modeSelect = document.getElementById("modeSelect");
const sessionStateEl = document.getElementById("sessionState");
const lockedTabEl = document.getElementById("lockedTab");
const durationLabel = document.getElementById("durationLabel");
const screenshotCount = document.getElementById("screenshotCount");
const networkCount = document.getElementById("networkCount");
const markerCount = document.getElementById("markerCount");
const messageEl = document.getElementById("message");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resumeBtn = document.getElementById("resumeBtn");
const stopBtn = document.getElementById("stopBtn");
const screenshotBtn = document.getElementById("screenshotBtn");
const markerBtn = document.getElementById("markerBtn");
const downloadZipBtn = document.getElementById("downloadZipBtn");
const downloadWebmBtn = document.getElementById("downloadWebmBtn");
const webmHint = document.getElementById("webmHint");
const exportHint = document.getElementById("exportHint");
const markerInput = document.getElementById("markerInput");
const markerText = document.getElementById("markerText");
const markerSaveBtn = document.getElementById("markerSaveBtn");
const markerCancelBtn = document.getElementById("markerCancelBtn");

let localMessage = null;
let messageTimeout = null;

function renderMessage(stateMessage) {
  const message = localMessage || stateMessage;
  if (!message || !message.text) {
    messageEl.textContent = "";
    messageEl.classList.remove("error", "warning");
    return;
  }
  messageEl.textContent = message.text;
  messageEl.classList.toggle("error", message.type === "error");
  messageEl.classList.toggle("warning", message.type === "warning");
}

function setLocalMessage(text, type = "info", timeoutMs = 4000) {
  localMessage = { text, type };
  renderMessage();
  if (messageTimeout) {
    clearTimeout(messageTimeout);
  }
  if (timeoutMs) {
    messageTimeout = setTimeout(() => {
      localMessage = null;
      renderMessage();
    }, timeoutMs);
  }
}

function formatLockedTab(lockedTab) {
  if (!lockedTab) {
    return "Not set";
  }
  if (lockedTab.title) {
    return lockedTab.title;
  }
  if (lockedTab.url) {
    return lockedTab.url;
  }
  if (lockedTab.id != null) {
    return `Tab ${lockedTab.id}`;
  }
  return "Not set";
}

function updateButtons(state) {
  const isIdle = state.sessionState === "idle";
  const isRecording = state.sessionState === "recording";
  const isPaused = state.sessionState === "paused";
  const isActive = isRecording || isPaused;
  const mode = state.mode;
  const isScreenshotMode = mode === "screenshot";
  const isNetworkMode = mode === "network";
  const modeHasVideo = mode === "video" || mode === "all";
  const hasExportableData =
    state.counts.screenshots > 0 || state.counts.markers > 0;

  startBtn.disabled = !isIdle || isScreenshotMode;
  pauseBtn.disabled = !isRecording || isScreenshotMode || isNetworkMode;
  resumeBtn.disabled = !isPaused || isScreenshotMode || isNetworkMode;
  stopBtn.disabled = isIdle;
  screenshotBtn.disabled = isScreenshotMode ? false : !isActive;
  markerBtn.disabled = isScreenshotMode ? false : isIdle;
  downloadZipBtn.disabled = isActive || !state.hasData;
  downloadWebmBtn.disabled =
    isActive || !modeHasVideo || !state.capture?.video || !state.hasData;

  stopBtn.textContent = "Stop Capture";
  modeSelect.disabled = !isIdle || state.hasData;

  pauseBtn.classList.toggle("hidden", isNetworkMode || isScreenshotMode);
  resumeBtn.classList.toggle("hidden", isNetworkMode || isScreenshotMode);

  downloadWebmBtn.classList.toggle("hidden", !modeHasVideo);
  webmHint.classList.toggle("hidden", !modeHasVideo);
  exportHint.classList.toggle("hidden", !isActive);
}

function applyState(state) {
  if (!state) {
    return;
  }
  modeSelect.value = state.mode || "all";
  if (state.sessionState) {
    sessionStateEl.textContent =
      state.sessionState.charAt(0).toUpperCase() +
      state.sessionState.slice(1);
  } else {
    sessionStateEl.textContent = "Idle";
  }
  lockedTabEl.textContent = formatLockedTab(state.lockedTab);
  durationLabel.textContent = state.durationLabel || "00:00";
  screenshotCount.textContent = state.counts?.screenshots ?? 0;
  networkCount.textContent = state.counts?.networkEvents ?? 0;
  markerCount.textContent = state.counts?.markers ?? 0;
  updateButtons(state);
  renderMessage(state.message);
}

function sendMessage(type, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...payload }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response);
    });
  });
}

async function refreshStatus() {
  const response = await sendMessage("GET_STATE");
  if (response?.ok) {
    applyState(response.data);
  } else if (response?.error) {
    setLocalMessage(response.error, "error", 6000);
  }
}

modeSelect.addEventListener("change", async (event) => {
  const mode = event.target.value;
  const response = await sendMessage("SET_MODE", { mode });
  if (!response?.ok) {
    setLocalMessage(response?.error || "Failed to change mode.", "error", 6000);
    await refreshStatus();
    return;
  }
  applyState(response.data);
});

startBtn.addEventListener("click", async () => {
  const response = await sendMessage("START_SESSION");
  if (!response?.ok) {
    setLocalMessage(response?.error || "Failed to start session.", "error", 6000);
    return;
  }
  applyState(response.data);
  setLocalMessage("Session started.", "info");
});

pauseBtn.addEventListener("click", async () => {
  const response = await sendMessage("PAUSE_SESSION");
  if (!response?.ok) {
    setLocalMessage(response?.error || "Failed to pause session.", "error", 6000);
    return;
  }
  applyState(response.data);
  setLocalMessage("Session paused.", "info");
});

resumeBtn.addEventListener("click", async () => {
  const response = await sendMessage("RESUME_SESSION");
  if (!response?.ok) {
    setLocalMessage(response?.error || "Failed to resume session.", "error", 6000);
    return;
  }
  applyState(response.data);
  setLocalMessage("Session resumed.", "info");
});

stopBtn.addEventListener("click", async () => {
  const response = await sendMessage("STOP_CAPTURE");
  if (!response?.ok) {
    setLocalMessage(response?.error || "Failed to stop capture.", "error", 6000);
    return;
  }
  applyState(response.data);
  setLocalMessage("Capture stopped.", "info", 4000);
});

screenshotBtn.addEventListener("click", async () => {
  const response = await sendMessage("CAPTURE_SCREENSHOT");
  if (!response?.ok) {
    setLocalMessage(
      response?.error || "Failed to capture screenshot.",
      "error",
      6000
    );
    return;
  }
  applyState(response.data);
  setLocalMessage("Screenshot captured.", "info");
});

markerBtn.addEventListener("click", () => {
  markerInput.classList.remove("hidden");
  markerText.focus();
});

markerSaveBtn.addEventListener("click", async () => {
  const note = markerText.value || "";
  const response = await sendMessage("ADD_MARKER", { note });
  if (!response?.ok) {
    setLocalMessage(response?.error || "Failed to add marker.", "error", 6000);
    return;
  }
  markerText.value = "";
  markerInput.classList.add("hidden");
  applyState(response.data);
  setLocalMessage("Marker added.", "info");
});

markerCancelBtn.addEventListener("click", () => {
  markerText.value = "";
  markerInput.classList.add("hidden");
});

downloadZipBtn.addEventListener("click", async () => {
  const response = await sendMessage("EXPORT_EVIDENCE_ZIP");
  if (!response?.ok) {
    setLocalMessage(
      response?.error || "Failed to download evidence ZIP.",
      "error",
      6000
    );
    return;
  }
  applyState(response.data);
  setLocalMessage("Evidence ZIP downloaded.", "info", 4000);
});

downloadWebmBtn.addEventListener("click", async () => {
  const response = await sendMessage("EXPORT_VIDEO_ONLY");
  if (!response?.ok) {
    setLocalMessage(response?.error || "Failed to download WebM.", "error", 6000);
    return;
  }
  applyState(response.data);
  setLocalMessage("WebM downloaded.", "info", 4000);
});

refreshStatus();
setInterval(refreshStatus, 500);
