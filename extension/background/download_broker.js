const activeDownloads = new Map();
const hasDownloads =
  typeof chrome !== "undefined" && chrome.downloads && chrome.downloads.download;

if (hasDownloads && chrome.downloads.onChanged) {
  chrome.downloads.onChanged.addListener((delta) => {
    if (!delta || typeof delta.id !== "number") {
      return;
    }
    if (delta.state && (delta.state.current === "complete" || delta.state.current === "interrupted")) {
      const entry = activeDownloads.get(delta.id);
      if (entry && entry.url) {
        URL.revokeObjectURL(entry.url);
      }
      if (entry && entry.artifactKey && delta.state.current === "complete") {
        if (globalThis.ReproIdb) {
          ReproIdb.deleteByKey("export_artifacts", entry.artifactKey).catch(() => {});
        }
        console.log("[BROKER][EXPORT_CLEANUP]", {
          artifactKey: entry.artifactKey,
          status: "complete",
        });
      } else if (entry && entry.artifactKey && delta.state.current === "interrupted") {
        console.log("[BROKER][EXPORT_CLEANUP]", {
          artifactKey: entry.artifactKey,
          status: "interrupted",
          kept: true,
        });
      }
      if (entry) {
        activeDownloads.delete(delta.id);
      }
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") {
    return false;
  }
  if (message.type === "BROKER_PING") {
    sendResponse({ ok: true });
    return true;
  }
  if (
    message.type !== "BROKER_DOWNLOAD_BLOB" &&
    message.type !== "BROKER_DOWNLOAD_BYTES" &&
    message.type !== "BROKER_DOWNLOAD_EXPORT_ARTIFACT" &&
    message.type !== "BROKER_CREATE_URL" &&
    message.type !== "BROKER_CREATE_EXPORT_URL" &&
    message.type !== "BROKER_REVOKE_URL"
  ) {
    return false;
  }
  (async () => {
    try {
      const payload = message.payload || {};
      const filename = payload.filename || "download.bin";
      const mimeType = payload.mimeType || "application/octet-stream";
      const saveAs = payload.saveAs === true;
      let arrayBuffer = payload.arrayBuffer;
      let artifactKey = null;
      if (message.type === "BROKER_REVOKE_URL") {
        const url = payload.url || null;
        if (url) {
          URL.revokeObjectURL(url);
        }
        sendResponse({ ok: true });
        return;
      }
      if (message.type === "BROKER_DOWNLOAD_EXPORT_ARTIFACT") {
        artifactKey = payload.artifactKey || null;
        if (!artifactKey) {
          sendResponse({ ok: false, error: "Missing export artifact key." });
          return;
        }
        if (!globalThis.ReproIdb) {
          sendResponse({ ok: false, error: "IndexedDB unavailable." });
          return;
        }
        const record = await ReproIdb.getByKey("export_artifacts", artifactKey);
        if (!record || !record.bytes) {
          sendResponse({ ok: false, error: "Export artifact not found." });
          return;
        }
        arrayBuffer = record.bytes;
        const retrievedLength =
          arrayBuffer && typeof arrayBuffer.byteLength === "number"
            ? arrayBuffer.byteLength
            : 0;
        const storedChecksum = record.checksum || null;
        let computedChecksum = null;
        try {
          const payloadBytes = new Uint8Array(arrayBuffer);
          let hash = 0x811c9dc5;
          for (let i = 0; i < payloadBytes.length; i += 1) {
            hash ^= payloadBytes[i];
            hash = (hash * 0x01000193) >>> 0;
          }
          computedChecksum = `fnv1a32:${hash.toString(16).padStart(8, "0")}`;
        } catch (error) {
          computedChecksum = null;
        }
        console.log("[BROKER][EXPORT_ARTIFACT_LOADED]", {
          artifactKey,
          bytes: retrievedLength,
          storedChecksum,
          computedChecksum,
        });
      }
      if (message.type === "BROKER_CREATE_EXPORT_URL") {
        artifactKey = payload.artifactKey || null;
        if (!artifactKey) {
          sendResponse({ ok: false, error: "Missing export artifact key." });
          return;
        }
        if (!globalThis.ReproIdb) {
          sendResponse({ ok: false, error: "IndexedDB unavailable." });
          return;
        }
        const record = await ReproIdb.getByKey("export_artifacts", artifactKey);
        if (!record || !record.bytes) {
          sendResponse({ ok: false, error: "Export artifact not found." });
          return;
        }
        arrayBuffer = record.bytes;
      }
      if (message.type === "BROKER_CREATE_URL") {
        arrayBuffer = payload.arrayBuffer;
      }
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
        const payloadBytes = new Uint8Array(arrayBuffer);
        let hash = 0x811c9dc5;
        for (let i = 0; i < payloadBytes.length; i += 1) {
          hash ^= payloadBytes[i];
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
        artifactKey,
      });
      const url = URL.createObjectURL(blob);
      if (message.type === "BROKER_CREATE_URL" || message.type === "BROKER_CREATE_EXPORT_URL") {
        sendResponse({ ok: true, url, bytes: byteLength, artifactKey });
        return;
      }
      if (!hasDownloads) {
        sendResponse({ ok: false, error: "Downloads API unavailable." });
        return;
      }
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
          activeDownloads.set(downloadId, { url, artifactKey });
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
