const timerEl = document.getElementById("panel_timer");
const stateEl = document.getElementById("panel_state");
const messageEl = document.getElementById("panel_message");
const startBtn = document.getElementById("panel_start");
const pauseBtn = document.getElementById("panel_pause");
const resumeBtn = document.getElementById("panel_resume");
const stopBtn = document.getElementById("panel_stop");
const downloadBtn = document.getElementById("panel_download");
const resetBtn = document.getElementById("panel_reset");
const closeBtn = document.getElementById("closePanel");

const query = new URLSearchParams(window.location.search);
const targetTabIdParam = query.get("targetTabId");
const targetTabId = targetTabIdParam ? Number(targetTabIdParam) : null;
if (query.get("embedded") === "1") {
  document.body.dataset.embedded = "true";
}

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
  return new Promise((resolve) => {
    chrome.windows.getLastFocused(
      { populate: true, windowTypes: ["normal"] },
      (windowInfo) => {
        if (chrome.runtime.lastError || !windowInfo) {
          chrome.tabs
            .query({ active: true, lastFocusedWindow: true })
            .then((tabs) => resolve(Array.isArray(tabs) ? tabs[0] : null))
            .catch(() => resolve(null));
          return;
        }
        const activeTab =
          windowInfo.tabs && Array.isArray(windowInfo.tabs)
            ? windowInfo.tabs.find((tab) => tab.active)
            : null;
        resolve(activeTab || null);
      }
    );
  });
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

function formatExportTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function resolvePanelStateLabel({ liveState, sessionState, statusMessage }) {
  const message = statusMessage || "";
  const lower = message.toLowerCase();
  if (lower.includes("saved from available data")) {
    return "Saved (partial)";
  }
  if (lower.includes("partial")) {
    return "Saved (partial)";
  }
  if (lower.includes("saved")) {
    return "Saved";
  }
  if (lower.includes("failed")) {
    return "Recording failed";
  }
  if (liveState === "recording") {
    return "Recording";
  }
  if (liveState === "paused") {
    return "Paused";
  }
  if (liveState === "stopping" || sessionState === "finalizing") {
    return "Finalizing…";
  }
  if (liveState) {
    return liveState;
  }
  return sessionState || "idle";
}

function setHidden(el, hidden) {
  if (!el) {
    return;
  }
  el.classList.toggle("is-hidden", Boolean(hidden));
}

function applyRecordingControls({
  liveState,
  sessionState,
  hasData,
  isFinalizing,
}) {
  const isRecording = liveState === "recording";
  const isPaused = liveState === "paused";
  const isIdle = liveState === "idle" || !liveState || sessionState === "idle";
  const showStop = isRecording || isPaused || isFinalizing;
  const showReset = hasData && !isRecording && !isPaused && !isFinalizing;
  setHidden(startBtn, !isIdle);
  setHidden(pauseBtn, !isRecording);
  setHidden(resumeBtn, !isPaused);
  setHidden(stopBtn, !showStop);
  setHidden(downloadBtn, !hasData);
  setHidden(resetBtn, !showReset);

  startBtn.disabled = !isIdle || isFinalizing;
  pauseBtn.disabled = !isRecording || isFinalizing;
  resumeBtn.disabled = !isPaused || isFinalizing;
  stopBtn.disabled = !showStop || isFinalizing;
  downloadBtn.disabled = !hasData || isFinalizing;
  if (resetBtn) {
    resetBtn.disabled = !showReset || isFinalizing;
  }
}

async function refreshStatus() {
  const res = await send("GET_STATUS");
  if (!res || !res.ok) {
    messageEl.textContent = "Panel unavailable.";
    applyRecordingControls({
      liveState: "idle",
      sessionState: "idle",
      hasData: false,
      isFinalizing: false,
    });
    return;
  }
  const state = res.state;
  const sessionState = state.session ? state.session.state : "idle";
  const statusMessage =
    state.statusMessage && state.statusMessage.message
      ? state.statusMessage.message
      : "-";
  messageEl.textContent = statusMessage;

  const live = await send("RECORDING_GET_STATE");
  if (live && live.ok) {
    if (live.elapsedText) {
      timerEl.textContent = live.elapsedText;
    } else if (typeof live.elapsedMs === "number") {
      const totalSeconds = Math.max(0, Math.floor(live.elapsedMs / 1000));
      const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
      const seconds = String(totalSeconds % 60).padStart(2, "0");
      timerEl.textContent = `${minutes}:${seconds}`;
    } else {
      timerEl.textContent = "00:00";
    }
    stateEl.textContent = resolvePanelStateLabel({
      liveState: live.state,
      sessionState,
      statusMessage,
    });
    const isCapturing = live.state === "recording";
    const isPaused = live.state === "paused";
    const isTransition =
      live.state === "starting" ||
      live.state === "stopping" ||
      sessionState === "finalizing";
    const hasData =
      Boolean(live.hasData) || Boolean(state.artifacts?.hasRecording);
    applyRecordingControls({
      liveState: live.state,
      sessionState,
      hasData,
      isFinalizing: isTransition,
    });
    return;
  }

  timerEl.textContent = formatElapsedWithPauses(state.session);
  stateEl.textContent = resolvePanelStateLabel({
    liveState: null,
    sessionState,
    statusMessage,
  });
  const isCapturing = sessionState === "capturing";
  const isPaused = sessionState === "paused";
  applyRecordingControls({
    liveState: isCapturing ? "recording" : isPaused ? "paused" : "idle",
    sessionState,
    hasData: Boolean(state.artifacts?.hasRecording),
    isFinalizing: sessionState === "finalizing",
  });
}

startBtn.addEventListener("click", async () => {
  messageEl.textContent = "Starting recording...";
  let tab = null;
  if (Number.isFinite(targetTabId)) {
    try {
      tab = await chrome.tabs.get(targetTabId);
    } catch (error) {
      tab = null;
    }
  }
  if (!tab) {
    tab = await getActiveTab();
  }
  if (!tab || !tab.id) {
    messageEl.textContent = "No active tab.";
    return;
  }
  if (isRestrictedUrl(tab.url)) {
    messageEl.textContent = "Recording not supported on this page.";
    return;
  }
  if (!chrome?.tabCapture?.getMediaStreamId) {
    messageEl.textContent = "tabCapture.getMediaStreamId unavailable.";
    return;
  }
  const prep = await send("RECORDING_GET_STATE");
  if (!prep || !prep.ok) {
    messageEl.textContent = prep?.error
      ? `Recording unavailable: ${prep.error}`
      : "Recording unavailable.";
    return;
  }
  let streamId = null;
  try {
    streamId = await getMediaStreamId(tab.id);
  } catch (error) {
    messageEl.textContent =
      error && error.message ? `Start failed: ${error.message}` : "Start failed.";
    return;
  }
  if (!streamId) {
    messageEl.textContent = "Start failed: no stream id.";
    return;
  }
  const preferredMimeType = pickRecordingMimeType() || "video/webm";
  const res = await send("RECORDING_START", {
    tabId: tab.id,
    streamId,
    mimeType: preferredMimeType,
  });
  if (!res?.ok) {
    messageEl.textContent = res?.error
      ? `Failed to start: ${res.error}`
      : "Failed to start recording.";
    return;
  }
  await refreshStatus();
});

pauseBtn.addEventListener("click", async () => {
  await send("RECORDING_PAUSE");
  await refreshStatus();
});
resumeBtn.addEventListener("click", async () => {
  await send("RECORDING_RESUME");
  await refreshStatus();
});
stopBtn.addEventListener("click", async () => {
  await send("RECORDING_STOP");
  await refreshStatus();
});
downloadBtn.addEventListener("click", async () => {
  messageEl.textContent = "Preparing download...";
  const res = await send("RECORDING_EXPORT_WEBM");
  if (!res?.ok || !res.blobUrl) {
    messageEl.textContent = res?.error || "No recording available.";
    return;
  }
  if (!chrome.downloads?.download) {
    messageEl.textContent = "Downloads API unavailable.";
    return;
  }
  const exportTimestamp = formatExportTimestamp(new Date());
  chrome.downloads.download(
    {
      url: res.blobUrl,
      filename: `qa-session-video-${exportTimestamp}.webm`,
      saveAs: false,
    },
    () => {
      if (chrome.runtime.lastError) {
        messageEl.textContent = chrome.runtime.lastError.message;
        return;
      }
      messageEl.textContent = "Download started.";
    }
  );
});
resetBtn.addEventListener("click", async () => {
  const confirmReset = window.confirm(
    "Clear the finished recording? This allows a new recording to start."
  );
  if (!confirmReset) {
    return;
  }
  messageEl.textContent = "Resetting recording...";
  const res = await send("RECORDING_RESET");
  if (!res?.ok) {
    messageEl.textContent = res?.error || "Failed to reset recording.";
    await refreshStatus();
    return;
  }
  timerEl.textContent = "00:00";
  messageEl.textContent = "Recording cleared.";
  await refreshStatus();
});
closeBtn.addEventListener("click", () => window.close());

refreshStatus();
setInterval(refreshStatus, 750);
