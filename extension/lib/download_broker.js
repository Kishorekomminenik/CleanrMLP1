(function () {
  async function downloadBlob(blob, filename, opts = {}) {
    const saveAs = opts.saveAs !== undefined ? opts.saveAs : false;
    if (typeof ensureOffscreenReady !== "function") {
      throw new Error("Offscreen broker unavailable.");
    }
    if (typeof sendMessageToOffscreen !== "function") {
      throw new Error("Offscreen broker unavailable.");
    }
    await ensureOffscreenReady();
    const response = await sendMessageToOffscreen({
      type: "DOWNLOAD_BLOB",
      blob,
      filename,
      saveAs,
    });
    if (!response || !response.ok) {
      throw new Error(response && response.error ? response.error : "Download failed.");
    }
    return response.downloadId;
  }

  globalThis.DownloadBroker = { downloadBlob };
})();
