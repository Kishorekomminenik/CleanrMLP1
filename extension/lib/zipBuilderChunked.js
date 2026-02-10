(function () {
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function addItemsInBatches(zip, items, options = {}) {
    const batchSize = options.batchSize || 20;
    const yieldEveryMs =
      typeof options.yieldEveryMs === "number" ? options.yieldEveryMs : 0;
    const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;
    let completed = 0;
    const total = Array.isArray(items) ? items.length : 0;
    if (!Array.isArray(items) || total === 0) {
      return { completed: 0, total: 0 };
    }
    for (const item of items) {
      if (!item || !item.path) {
        completed += 1;
        if (onProgress) {
          onProgress({ completed, total, item: null });
        }
        continue;
      }
      const data = item.getData ? await item.getData() : item.data;
      zip.file(item.path, data, item.options || {});
      completed += 1;
      if (onProgress) {
        onProgress({ completed, total, item });
      }
      if (completed % batchSize === 0) {
        await delay(yieldEveryMs);
      }
    }
    return { completed, total };
  }

  async function generateZipBlob(zip, options = {}) {
    const generateOptions = {
      type: "blob",
      compression: options.compression || "STORE",
      streamFiles:
        typeof options.streamFiles === "boolean" ? options.streamFiles : true,
    };
    const onUpdate = typeof options.onUpdate === "function" ? options.onUpdate : null;
    if (onUpdate) {
      return zip.generateAsync(generateOptions, onUpdate);
    }
    return zip.generateAsync(generateOptions);
  }

  const root =
    typeof window !== "undefined"
      ? window
      : typeof self !== "undefined"
        ? self
        : globalThis;
  root.ZipBuilderChunked = {
    addItemsInBatches,
    generateZipBlob,
    delay,
  };
})();
