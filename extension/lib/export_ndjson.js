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
    const parts = [];
    let size = 0;
    let count = 0;
    const encoder = new TextEncoder();
    let chunk = "";
    let chunkCount = 0;
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
        const payload = redactEntry ? redactEntry(entry) : entry;
        const line = `${JSON.stringify(payload)}\n`;
        chunk += line;
        size += encoder.encode(line).length;
        count += 1;
        chunkCount += 1;
        if (maxBytes && size > maxBytes) {
          const error = new Error("NDJSON exceeds size limit.");
          error.debugCode = "ndjson_too_large";
          error.userMessage = "Export too large (NDJSON). Reduce capture size.";
          throw error;
        }
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
      }
    );
    if (chunk) {
      parts.push(chunk);
    }
    return {
      blob: new Blob(parts, { type: "application/x-ndjson" }),
      size,
      count,
    };
  }

  globalThis.NdjsonExporter = { buildNdjsonBlobFromIdb };
})();
