chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") {
    return false;
  }
  if (message.type === "BROKER_PING") {
    sendResponse({ ok: true });
    return true;
  }
  if (message.type !== "BROKER_DOWNLOAD_BLOB") {
    return false;
  }
  (async () => {
    try {
      const payload = message.payload || {};
      const arrayBuffer = payload.arrayBuffer;
      const filename = payload.filename || "download.bin";
      const mimeType = payload.mimeType || "application/octet-stream";
      if (!arrayBuffer) {
        sendResponse({ ok: false, error: "Missing payload." });
        return;
      }
      const blob = new Blob([arrayBuffer], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        link.remove();
      }, 4000);
      sendResponse({ ok: true });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error && error.message ? error.message : "Download failed.",
      });
    }
  })();
  return true;
});
