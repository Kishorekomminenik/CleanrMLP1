(function () {
  function delay() {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  async function buildNdjsonBlobFromIdb(options) {
    if (!globalThis.ReproIdb) {
      throw new Error("IndexedDB unavailable.");
    }
    const keyRange = options.keyRange || null;
    const batchSize =
      typeof options.batchSize === "number" ? options.batchSize : 500;
    const yieldEvery =
      typeof options.yieldEvery === "number" ? options.yieldEvery : batchSize;
    const maxBytes =
      typeof options.maxBytes === "number" ? options.maxBytes : null;
    const redactEntry =
      typeof options.redactEntry === "function" ? options.redactEntry : null;
    const onEntry =
      typeof options.onEntry === "function" ? options.onEntry : null;
    const filterEntry =
      typeof options.filterEntry === "function" ? options.filterEntry : null;
    const totalCount =
      typeof options.totalCount === "number" ? options.totalCount : null;
    const onProgress =
      typeof options.onProgress === "function" ? options.onProgress : null;
    const parts = [];
    let size = 0;
    let count = 0;
    let processed = 0;
    let truncated = false;
    const encoder = new TextEncoder();
    let chunk = "";
    let chunkCount = 0;
    let lastPercent = -1;
    try {
      await ReproIdb.iterateByIndex(
        options.storeName,
        options.indexName,
        keyRange,
        { direction: "next" },
        async (record) => {
          const entry = record && record.entry ? record.entry : record;
          if (onEntry) {
            onEntry(entry, record);
          }
          processed += 1;
          if (filterEntry && !filterEntry(entry)) {
            if (totalCount && onProgress) {
              const percent = Math.min(
                100,
                Math.floor((processed / Math.max(1, totalCount)) * 100)
              );
              if (percent !== lastPercent) {
                lastPercent = percent;
                onProgress({ count, total: totalCount, percent });
              }
            }
            return;
          }
          const payload = redactEntry ? redactEntry(entry) : entry;
          const line = `${JSON.stringify(payload)}\n`;
          const lineBytes = encoder.encode(line).length;
          if (maxBytes && size + lineBytes > maxBytes) {
            const error = new Error("NDJSON exceeds size limit.");
            error.debugCode = "ndjson_too_large";
            error.userMessage = "Export too large (NDJSON). Reduce capture size.";
            throw error;
          }
          chunk += line;
          size += lineBytes;
          count += 1;
          chunkCount += 1;
          if (chunkCount >= batchSize) {
            parts.push(chunk);
            chunk = "";
            chunkCount = 0;
            if (yieldEvery > 0) {
              await delay();
            }
          } else if (yieldEvery > 0 && count % yieldEvery === 0) {
            await delay();
          }
          if (totalCount && onProgress) {
            const percent = Math.min(
              100,
              Math.floor((processed / Math.max(1, totalCount)) * 100)
            );
            if (percent !== lastPercent) {
              lastPercent = percent;
              onProgress({ count, total: totalCount, percent });
            }
          }
        }
      );
    } catch (error) {
      if (error && error.debugCode === "ndjson_too_large") {
        truncated = true;
      } else {
        throw error;
      }
    }
    if (chunk) {
      parts.push(chunk);
    }
    return {
      blob: new Blob(parts, { type: "application/x-ndjson" }),
      size,
      count,
      truncated,
    };
  }

  globalThis.NdjsonExporter = { buildNdjsonBlobFromIdb };
})();
