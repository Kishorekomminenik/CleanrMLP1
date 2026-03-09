const activeDownloads = new Map();

chrome.downloads.onChanged.addListener((delta) => {
  if (!delta || typeof delta.id !== "number") {
    return;
  }
  if (delta.state && (delta.state.current === "complete" || delta.state.current === "interrupted")) {
    const url = activeDownloads.get(delta.id);
    if (url) {
      URL.revokeObjectURL(url);
      activeDownloads.delete(delta.id);
    }
  }
});

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
      const byteLength =
        arrayBuffer && typeof arrayBuffer.byteLength === "number"
          ? arrayBuffer.byteLength
          : 0;
      const blob = new Blob([arrayBuffer], { type: mimeType });
      let checksum = null;
      try {
        const payload = new Uint8Array(arrayBuffer);
        let hash = 0x811c9dc5;
        for (let i = 0; i < payload.length; i += 1) {
          hash ^= payload[i];
          hash = (hash * 0x01000193) >>> 0;
        }
        checksum = `fnv1a32:${hash.toString(16).padStart(8, "0")}`;
      } catch (error) {
        checksum = null;
      }
      console.log("[BROKER][DOWNLOAD_BYTES]", {
        filename,
        mimeType,
        bytes: byteLength,
        nonEmpty: byteLength > 0,
        blobSize: blob.size,
        checksum,
      });
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
          activeDownloads.set(downloadId, url);
          sendResponse({ ok: true, downloadId });
        }
      );
    } catch (error) {
      sendResponse({
        ok: false,
        error: error && error.message ? error.message : "Download failed.",
      });
    }
  })();
  return true;
});
