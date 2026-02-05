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
const redactionToggle = document.getElementById("redactionToggle");
const redactionStatus = document.getElementById("redactionStatus");

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
    setStatus(statusElements.download, statusMessage.message, type);
    return;
  }
  if (response && response.error) {
    setStatus(statusElements.download, response.error, "error");
  }
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
    await showErrorFromResponse(response);
    await refreshStatus();
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
    await showErrorFromResponse(response);
    await refreshStatus();
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
    await showErrorFromResponse(response);
    await refreshStatus();
    return;
  }
  setStatus(statusElements.download, "Recording paused.", "success");
  await refreshStatus();
}

async function handleRecordingResume() {
  const response = await sendMessage({ type: "RECORDING_RESUME" });
  if (!response.ok) {
    await showErrorFromResponse(response);
    await refreshStatus();
    return;
  }
  setStatus(statusElements.download, "Recording resumed.", "success");
  await refreshStatus();
}

async function handleRecordingStop() {
  setStatus(statusElements.download, "Stopping recording...");
  const response = await sendMessage({ type: "RECORDING_STOP" });
  if (!response.ok) {
    await showErrorFromResponse(response);
    await refreshStatus();
    return;
  }
  setStatus(statusElements.download, "Recording stopped.", "success");
  await refreshStatus();
}

async function handleNetworkStart() {
  setStatus(statusElements.download, "Starting network capture...");
  const response = await sendMessage({ type: "NETWORK_START" });
  if (!response.ok) {
    await showErrorFromResponse(response);
    await refreshStatus();
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
    await showErrorFromResponse(response);
    await refreshStatus();
    return;
  }
  setStatus(statusElements.download, "Network capture stopped.", "success");
  await refreshStatus();
}

async function buildEnvironment() {
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

  const redactionResult = await chrome.storage.local.get({
    redactionEnabled: true,
  });
  const redactionEnabled = redactionResult.redactionEnabled !== false;

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

  const networkLogs = response.data.networkLogs || {
    version: "1.0",
    entries: [],
  };
  const consoleLogs = response.data.consoleLogs || {
    version: "1.0",
    entries: [],
  };
  const redactedNetworkLogs = redactionEnabled && window.RedactUtils
    ? {
        version: networkLogs.version,
        entries: networkLogs.entries.map((entry) =>
          window.RedactUtils.redactNetworkEntry(entry)
        ),
      }
    : networkLogs;
  const redactedConsoleLogs = redactionEnabled && window.RedactUtils
    ? {
        version: consoleLogs.version,
        entries: consoleLogs.entries.map((entry) =>
          window.RedactUtils.redactConsoleEntry(entry)
        ),
      }
    : consoleLogs;

  zip.file("network_logs.json", JSON.stringify(redactedNetworkLogs, null, 2));
  zip.file("console_logs.json", JSON.stringify(redactedConsoleLogs, null, 2));

  zip.file("session.json", JSON.stringify(response.data.session, null, 2));

  const environment = await buildEnvironment();
  zip.file("environment.json", JSON.stringify(environment, null, 2));

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const filename = `evidence_${formatZipTimestamp(new Date())}.zip`;
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

async function loadRedactionSetting() {
  const result = await chrome.storage.local.get({ redactionEnabled: true });
  const enabled = result.redactionEnabled !== false;
  redactionToggle.checked = enabled;
  redactionStatus.textContent = enabled ? "ON" : "OFF";
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
refreshStatus();
