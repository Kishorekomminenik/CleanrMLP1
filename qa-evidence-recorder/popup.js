const statusText = document.getElementById("statusText");
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

function setMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.classList.toggle("error", isError);
}

function updateButtons(status) {
  const isIdle = status === "idle";
  const isRecording = status === "recording";
  const isPaused = status === "paused";

  startBtn.disabled = !isIdle;
  pauseBtn.disabled = !isRecording;
  resumeBtn.disabled = !isPaused;
  stopBtn.disabled = isIdle;
  screenshotBtn.disabled = isIdle;
  markerBtn.disabled = isIdle;
}

function applyStatus(payload) {
  if (!payload) {
    return;
  }
  statusText.textContent = payload.statusLabel || "Idle";
  screenshotCount.textContent = payload.counts?.screenshots ?? 0;
  networkCount.textContent = payload.counts?.networkEvents ?? 0;
  markerCount.textContent = payload.counts?.markers ?? 0;
  updateButtons(payload.status);
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
  const response = await sendMessage("GET_STATUS");
  if (response?.ok) {
    applyStatus(response.data);
    setMessage("");
  } else if (response?.error) {
    setMessage(response.error, true);
  }
}

startBtn.addEventListener("click", async () => {
  setMessage("Starting session...");
  const response = await sendMessage("START_SESSION");
  if (!response?.ok) {
    setMessage(response?.error || "Failed to start session.", true);
    return;
  }
  applyStatus(response.data);
  setMessage("Recording started.");
});

pauseBtn.addEventListener("click", async () => {
  const response = await sendMessage("PAUSE_RECORDING");
  if (!response?.ok) {
    setMessage(response?.error || "Failed to pause recording.", true);
    return;
  }
  applyStatus(response.data);
  setMessage("Recording paused.");
});

resumeBtn.addEventListener("click", async () => {
  const response = await sendMessage("RESUME_RECORDING");
  if (!response?.ok) {
    setMessage(response?.error || "Failed to resume recording.", true);
    return;
  }
  applyStatus(response.data);
  setMessage("Recording resumed.");
});

stopBtn.addEventListener("click", async () => {
  setMessage("Stopping & exporting...");
  const response = await sendMessage("STOP_AND_EXPORT");
  if (!response?.ok) {
    setMessage(response?.error || "Failed to stop session.", true);
    return;
  }
  applyStatus(response.data);
  setMessage("Export complete. Files saved to Downloads.");
});

screenshotBtn.addEventListener("click", async () => {
  const response = await sendMessage("CAPTURE_SCREENSHOT");
  if (!response?.ok) {
    setMessage(response?.error || "Failed to capture screenshot.", true);
    return;
  }
  applyStatus(response.data);
  setMessage("Screenshot captured.");
});

markerBtn.addEventListener("click", async () => {
  const note = prompt("Marker note (optional):", "");
  const response = await sendMessage("ADD_MARKER", { note: note ?? "" });
  if (!response?.ok) {
    setMessage(response?.error || "Failed to add marker.", true);
    return;
  }
  applyStatus(response.data);
  setMessage("Marker added.");
});

refreshStatus();
