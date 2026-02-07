const shotImg = document.getElementById("shot");
const statusEl = document.getElementById("statusText");
const copyBtn = document.getElementById("copyBtn");
const downloadBtn = document.getElementById("downloadBtn");

let latestScreenshotDataUrl = null;
let statusTimer = null;

function setStatus(message, type = "default", autoResetMs = 0) {
  statusEl.textContent = message;
  if (type === "error") {
    statusEl.style.color = "#b91c1c";
  } else if (type === "success") {
    statusEl.style.color = "#166534";
  } else {
    statusEl.style.color = "#4b5563";
  }
  if (statusTimer) {
    clearTimeout(statusTimer);
    statusTimer = null;
  }
  if (autoResetMs > 0) {
    statusTimer = setTimeout(() => {
      statusEl.textContent = "Ready.";
      statusEl.style.color = "#4b5563";
      statusTimer = null;
    }, autoResetMs);
  }
}

function formatTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
}

async function loadScreenshot() {
  setStatus("Loading...");
  copyBtn.disabled = true;
  downloadBtn.disabled = true;
  const result = await chrome.storage.session.get("latestScreenshotDataUrl");
  latestScreenshotDataUrl = result.latestScreenshotDataUrl;
  if (
    typeof latestScreenshotDataUrl !== "string" ||
    !latestScreenshotDataUrl.startsWith("data:image/png")
  ) {
    latestScreenshotDataUrl = null;
    setStatus("No screenshot data found. Capture again.", "error");
    return;
  }
  shotImg.onload = () => {
    copyBtn.disabled = false;
    downloadBtn.disabled = false;
    setStatus("Ready.");
  };
  shotImg.onerror = () => {
    latestScreenshotDataUrl = null;
    setStatus("Failed to load screenshot. Capture again.", "error");
  };
  shotImg.src = latestScreenshotDataUrl;
}

copyBtn.addEventListener("click", async () => {
  if (!latestScreenshotDataUrl) {
    setStatus("No screenshot to copy.", "error");
    return;
  }
  if (!navigator.clipboard || !window.ClipboardItem) {
    setStatus("Copy failed: Clipboard API unavailable. Use Download.", "error");
    return;
  }
  try {
    const blob = await dataUrlToBlob(latestScreenshotDataUrl);
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob }),
    ]);
    setStatus("Copied!", "success", 2000);
  } catch (error) {
    const message = error && error.message ? error.message : "Unknown error";
    setStatus(`Copy failed: ${message}. Use Download.`, "error");
  }
});

downloadBtn.addEventListener("click", async () => {
  if (!latestScreenshotDataUrl) {
    setStatus("No screenshot to download.", "error");
    return;
  }
  const filename = `screenshot_${formatTimestamp(new Date())}.png`;
  setStatus("Downloading...");
  let objectUrl = null;
  try {
    const blob = await dataUrlToBlob(latestScreenshotDataUrl);
    objectUrl = URL.createObjectURL(blob);
    await chrome.downloads.download({
      url: objectUrl,
      filename,
      saveAs: true,
    });
    setStatus("Downloaded.", "success", 2000);
  } catch (error) {
    const message = error && error.message ? error.message : "Download failed.";
    setStatus(message, "error");
  } finally {
    if (objectUrl) {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
    }
  }
});

document.addEventListener("DOMContentLoaded", () => {
  loadScreenshot();
});
