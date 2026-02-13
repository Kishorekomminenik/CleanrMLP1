chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") {
    return false;
  }
  if (message.type === "BROKER_PING") {
    sendResponse({ ok: true });
    return true;
  }
  if (message.type !== "BROKER_DOWNLOAD_BLOB" && message.type !== "BROKER_DOWNLOAD_BYTES") {
    return false;
  }
  (async () => {
    try {
      const payload = message.payload || {};
      const arrayBuffer = payload.arrayBuffer;
      const filename = payload.filename || "download.bin";
      const mimeType = payload.mimeType || "application/octet-stream";
      const saveAs = payload.saveAs === true;
      if (!arrayBuffer) {
        sendResponse({ ok: false, error: "Missing payload." });
        return;
      }
      const blob = new Blob([arrayBuffer], { type: mimeType });
      const url = URL.createObjectURL(blob);
      chrome.downloads.download(
        {
          url,
          filename,
          saveAs,
        },
        (downloadId) => {
          if (chrome.runtime.lastError || !downloadId) {
            sendResponse({
              ok: false,
              error: chrome.runtime.lastError
                ? chrome.runtime.lastError.message
                : "Download blocked.",
            });
            return;
          }
          sendResponse({ ok: true, downloadId });
        }
      );
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 4000);
    } catch (error) {
      sendResponse({
        ok: false,
        error: error && error.message ? error.message : "Download failed.",
      });
    }
  })();
  return true;
});
