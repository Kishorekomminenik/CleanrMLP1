const statusElements = {
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
  networkStart: document.getElementById("btn_start_capture"),
  networkStop: document.getElementById("btn_stop_capture"),
  download: document.getElementById("btn_download_zip"),
  reset: document.getElementById("btn_reset_session"),
};

const modeRadios = Array.from(
  document.querySelectorAll('input[name="captureMode"]')
);
const modeControls = Array.from(document.querySelectorAll(".mode-controls"));
let currentMode = "screenshot";

const STATUS_COLORS = {
  default: "#4b5563",
  error: "#b91c1c",
  success: "#166534",
};

function setStatus(element, message, type = "default") {
  element.textContent = message;
  element.style.color = STATUS_COLORS[type] || STATUS_COLORS.default;
}

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false, error: "No response from background." });
    });
  });
}

function parseBrowserVersion(userAgent) {
  const edgeMatch = userAgent.match(/Edg\/([\d.]+)/);
  if (edgeMatch) {
    return `Edge ${edgeMatch[1]}`;
  }
  const chromeMatch = userAgent.match(/Chrome\/([\d.]+)/);
  if (chromeMatch) {
    return `Chrome ${chromeMatch[1]}`;
  }
  return "Unknown";
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

function setMode(mode) {
  currentMode = mode;
  modeControls.forEach((block) => {
    const isActive = block.dataset.mode === mode;
    block.classList.toggle("active", isActive);
  });
}

function setRecordingButtons(state) {
  const status = state.recordingStatus;
  buttons.recordStart.disabled = status === "recording" || status === "paused";
  buttons.recordPause.disabled = status !== "recording";
  buttons.recordResume.disabled = status !== "paused";
  buttons.recordStop.disabled =
    status === "idle" || status === "stopped" || status === "stopping";
}

function setNetworkButtons(state) {
  buttons.networkStart.disabled = state.networkActive;
  buttons.networkStop.disabled = !state.networkActive;
}

function applySessionLock(state) {
  if (
    !state.session ||
    (state.session.state !== "capturing" && state.session.state !== "paused")
  ) {
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
  if (!state.statusMessage || !state.statusMessage.message) {
    return;
  }
  const level = state.statusMessage.level;
  const type =
    level === "error" ? "error" : level === "success" ? "success" : "default";
  setStatus(statusElements.download, state.statusMessage.message, type);
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
  const sessionState = state.session ? state.session.state : "idle";
  const modeLabel = sessionMode ? sessionMode.replace("_", " + ") : "-";
  statusElements.mode.textContent = modeLabel;
  statusElements.state.textContent = sessionState || "idle";

  statusElements.timer.textContent = formatElapsed(
    state.session ? state.session.created_at : null,
    state.session ? state.session.ended_at : null
  );

  const counts = state.session ? state.session.counts : null;
  const requestCount = counts ? counts.network_requests : 0;
  const logCount = counts ? counts.console_entries : 0;
  const errorCount = counts ? counts.errors : 0;
  statusElements.counts.textContent = `${requestCount} requests, ${logCount} logs, ${errorCount} errors`;

  setRecordingButtons(state);
  setNetworkButtons(state);
  applySessionLock(state);
  applyStatusMessage(state);

  if (state.artifacts) {
    buttons.download.disabled = !state.artifacts.hasAnyArtifacts;
  }
}

async function refreshStatus() {
  const response = await sendMessage({ type: "GET_STATUS" });
  if (!response.ok) {
    setStatus(statusElements.download, response.error, "error");
    return;
  }
  updateStatusUI(response.state);
}

async function handleScreenshot() {
  setStatus(statusElements.download, "Capturing screenshot...");
  const response = await sendMessage({ type: "CAPTURE_SCREENSHOT" });
  if (!response.ok) {
    setStatus(statusElements.download, response.error, "error");
    return;
  }
  if (response.message) {
    setStatus(statusElements.download, response.message);
  } else {
    setStatus(statusElements.download, "Screenshot captured.", "success");
  }
  await refreshStatus();
}

async function handleRecordingStart() {
  setStatus(statusElements.download, "Starting recording...");
  const response = await sendMessage({ type: "RECORDING_START" });
  if (!response.ok) {
    setStatus(statusElements.download, response.error, "error");
    return;
  }
  if (response.message) {
    setStatus(statusElements.download, response.message);
  } else {
    setStatus(statusElements.download, "Recording started.", "success");
  }
  await refreshStatus();
}

async function handleRecordingPause() {
  const response = await sendMessage({ type: "RECORDING_PAUSE" });
  if (!response.ok) {
    setStatus(statusElements.download, response.error, "error");
    return;
  }
  setStatus(statusElements.download, "Recording paused.", "success");
  await refreshStatus();
}

async function handleRecordingResume() {
  const response = await sendMessage({ type: "RECORDING_RESUME" });
  if (!response.ok) {
    setStatus(statusElements.download, response.error, "error");
    return;
  }
  setStatus(statusElements.download, "Recording resumed.", "success");
  await refreshStatus();
}

async function handleRecordingStop() {
  setStatus(statusElements.download, "Stopping recording...");
  const response = await sendMessage({ type: "RECORDING_STOP" });
  if (!response.ok) {
    setStatus(statusElements.download, response.error, "error");
    return;
  }
  setStatus(statusElements.download, "Recording stopped.", "success");
  await refreshStatus();
}

async function handleNetworkStart() {
  setStatus(statusElements.download, "Starting network capture...");
  const response = await sendMessage({ type: "NETWORK_START" });
  if (!response.ok) {
    setStatus(statusElements.download, response.error, "error");
    return;
  }
  if (response.message) {
    setStatus(statusElements.download, response.message);
  } else {
    setStatus(statusElements.download, "Network capture started.", "success");
  }
  await refreshStatus();
}

async function handleNetworkStop() {
  setStatus(statusElements.download, "Stopping network capture...");
  const response = await sendMessage({ type: "NETWORK_STOP" });
  if (!response.ok) {
    setStatus(statusElements.download, response.error, "error");
    return;
  }
  setStatus(statusElements.download, "Network capture stopped.", "success");
  await refreshStatus();
}

async function buildEnvironment() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const userAgent = navigator.userAgent;
  return {
    url: tab && tab.url ? tab.url : "",
    timestamp: new Date().toISOString(),
    userAgent,
    browserVersion: parseBrowserVersion(userAgent),
  };
}

async function handleDownload() {
  const statusResponse = await sendMessage({ type: "GET_STATUS" });
  if (!statusResponse.ok) {
    setStatus(statusElements.download, statusResponse.error, "error");
    return;
  }
  if (
    statusResponse.state.artifacts &&
    !statusResponse.state.artifacts.hasAnyArtifacts
  ) {
    setStatus(statusElements.download, "No artifacts to export.", "error");
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
    return;
  }

  setStatus(statusElements.download, "Preparing ZIP...");
  const response = await sendMessage({ type: "GET_EXPORT_DATA" });
  if (!response.ok) {
    setStatus(statusElements.download, response.error, "error");
    return;
  }
  if (!response.data.session) {
    setStatus(statusElements.download, "No session to export yet.", "error");
    return;
  }

  const zip = new JSZip();
  if (response.data.screenshotDataUrl) {
    zip.file(
      "screenshot.png",
      dataUrlToBlob(response.data.screenshotDataUrl)
    );
  }
  if (response.data.recordingDataUrl) {
    zip.file(
      "recording.webm",
      dataUrlToBlob(response.data.recordingDataUrl)
    );
  }

  zip.file(
    "network_logs.json",
    JSON.stringify(response.data.networkLogs || [], null, 2)
  );
  zip.file(
    "console_logs.json",
    JSON.stringify(response.data.consoleLogs || [], null, 2)
  );

  zip.file("session.json", JSON.stringify(response.data.session, null, 2));

  const environment = await buildEnvironment();
  zip.file("environment.json", JSON.stringify(environment, null, 2));

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const filename = `evidence_${Date.now()}.zip`;
  const url = URL.createObjectURL(zipBlob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  setStatus(statusElements.download, "Download ready.", "success");
}

async function handleResetSession() {
  const response = await sendMessage({ type: "RESET_SESSION" });
  if (!response.ok) {
    setStatus(statusElements.download, response.error, "error");
    return;
  }
  setStatus(statusElements.download, "Session reset.", "success");
  await refreshStatus();
}

buttons.screenshot.addEventListener("click", handleScreenshot);
buttons.recordStart.addEventListener("click", handleRecordingStart);
buttons.recordPause.addEventListener("click", handleRecordingPause);
buttons.recordResume.addEventListener("click", handleRecordingResume);
buttons.recordStop.addEventListener("click", handleRecordingStop);
buttons.networkStart.addEventListener("click", handleNetworkStart);
buttons.networkStop.addEventListener("click", handleNetworkStop);
buttons.download.addEventListener("click", handleDownload);
buttons.reset.addEventListener("click", handleResetSession);

modeRadios.forEach((radio) => {
  radio.addEventListener("change", (event) => {
    const selectedMode = event.target.value;
    setMode(selectedMode);
  });
});

setMode(currentMode);
refreshStatus();
