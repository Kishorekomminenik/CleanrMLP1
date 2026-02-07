const shotImg = document.getElementById("shot");
const statusEl = document.getElementById("status");
const copyBtn = document.getElementById("copyBtn");
const downloadBtn = document.getElementById("downloadBtn");

let latestScreenshotDataUrl = null;

function setStatus(message, type = "default") {
  statusEl.textContent = message;
  if (type === "error") {
    statusEl.style.color = "#b91c1c";
  } else if (type === "success") {
    statusEl.style.color = "#166534";
  } else {
    statusEl.style.color = "#4b5563";
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

async function loadScreenshot() {
  const result = await chrome.storage.session.get("latestScreenshotDataUrl");
  latestScreenshotDataUrl = result.latestScreenshotDataUrl;
  if (
    typeof latestScreenshotDataUrl !== "string" ||
    !latestScreenshotDataUrl.startsWith("data:image/png")
  ) {
    setStatus("No screenshot found.", "error");
    return;
  }
  shotImg.src = latestScreenshotDataUrl;
}

copyBtn.addEventListener("click", async () => {
  if (!latestScreenshotDataUrl) {
    setStatus("No screenshot to copy.", "error");
    return;
  }
  if (!navigator.clipboard || !window.ClipboardItem) {
    setStatus(
      "Copy failed due to browser/permission restrictions. Use right-click Copy image.",
      "error"
    );
    return;
  }
  try {
    const blob = await (await fetch(latestScreenshotDataUrl)).blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    setStatus("Copied!", "success");
  } catch (error) {
    setStatus(
      "Copy failed due to browser/permission restrictions. Use right-click Copy image.",
      "error"
    );
  }
});

downloadBtn.addEventListener("click", async () => {
  if (!latestScreenshotDataUrl) {
    setStatus("No screenshot to download.", "error");
    return;
  }
  const filename = `screenshot_${formatTimestamp(new Date())}.png`;
  try {
    await chrome.downloads.download({
      url: latestScreenshotDataUrl,
      filename,
      saveAs: true,
    });
    setStatus("Download started.", "success");
  } catch (error) {
    setStatus("Download failed.", "error");
  }
});

loadScreenshot();
