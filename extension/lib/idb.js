(function () {
  const DB_NAME = "repro_evidence_db";
  const DB_VERSION = 1;
  let dbPromise = null;

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function openEvidenceDb() {
    if (dbPromise) {
      return dbPromise;
    }

    function applySchema(db, transaction) {
      if (!db.objectStoreNames.contains("sessions")) {
        const store = db.createObjectStore("sessions", { keyPath: "sessionId" });
        store.createIndex("createdAtMs", "createdAtMs", { unique: false });
      }
      let partStore;
      if (!db.objectStoreNames.contains("parts")) {
        partStore = db.createObjectStore("parts", { keyPath: "partId" });
        partStore.createIndex("sessionId", "sessionId", { unique: false });
        partStore.createIndex("partNumber", "partNumber", { unique: false });
        partStore.createIndex("status", "status", { unique: false });
      } else {
        partStore = transaction.objectStore("parts");
      }
      if (partStore && !partStore.indexNames.contains("completedAtMs")) {
        partStore.createIndex("completedAtMs", "completedAtMs", {
          unique: false,
        });
      }
      if (!db.objectStoreNames.contains("network_entries")) {
        const store = db.createObjectStore("network_entries", { keyPath: "id" });
        store.createIndex("sessionId", "sessionId", { unique: false });
        store.createIndex("partId", "partId", { unique: false });
        store.createIndex("t_ms", "t_ms", { unique: false });
      }
      if (!db.objectStoreNames.contains("console_entries")) {
        const store = db.createObjectStore("console_entries", { keyPath: "id" });
        store.createIndex("sessionId", "sessionId", { unique: false });
        store.createIndex("partId", "partId", { unique: false });
        store.createIndex("t_ms", "t_ms", { unique: false });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("counters")) {
        db.createObjectStore("counters", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("capture_runs")) {
        const store = db.createObjectStore("capture_runs", {
          keyPath: "captureRunId",
        });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains("capture_tiles")) {
        const store = db.createObjectStore("capture_tiles", { keyPath: "tileId" });
        store.createIndex("captureRunId", "captureRunId", { unique: false });
        store.createIndex("tileIndex", "tileIndex", { unique: false });
        store.createIndex("status", "status", { unique: false });
      }
      if (!db.objectStoreNames.contains("capture_blobs")) {
        const store = db.createObjectStore("capture_blobs", { keyPath: "key" });
        store.createIndex("captureRunId", "captureRunId", { unique: false });
        store.createIndex("kind", "kind", { unique: false });
      }
      if (!db.objectStoreNames.contains("capture_artifacts")) {
        const store = db.createObjectStore("capture_artifacts", { keyPath: "key" });
        store.createIndex("captureRunId", "captureRunId", { unique: false });
        store.createIndex("kind", "kind", { unique: false });
      }
    }

    function openWithVersion(version) {
      return new Promise((resolve, reject) => {
        const request =
          typeof version === "number"
            ? indexedDB.open(DB_NAME, version)
            : indexedDB.open(DB_NAME);
        request.onupgradeneeded = () => {
          applySchema(request.result, request.transaction);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    dbPromise = (async () => {
      try {
        return await openWithVersion(DB_VERSION);
      } catch (error) {
        if (error && error.name === "VersionError") {
          const db = await openWithVersion();
          const missingStores = [
            "meta",
            "parts",
            "capture_runs",
            "capture_tiles",
            "capture_blobs",
            "capture_artifacts",
          ].some((name) => !db.objectStoreNames.contains(name));
          let needsCompletedIndex = false;
          if (db.objectStoreNames.contains("parts")) {
            needsCompletedIndex = !db
              .transaction("parts", "readonly")
              .objectStore("parts")
              .indexNames.contains("completedAtMs");
          } else {
            needsCompletedIndex = true;
          }
          const needsCaptureRunIndex = db.objectStoreNames.contains("capture_runs")
            ? !db
                .transaction("capture_runs", "readonly")
                .objectStore("capture_runs")
                .indexNames.contains("updatedAt")
            : true;
          if (missingStores || needsCompletedIndex || needsCaptureRunIndex) {
            const nextVersion = db.version + 1;
            db.close();
            return await openWithVersion(nextVersion);
          }
          return db;
        }
        throw error;
      }
    })();
    return dbPromise;
  }

  function withStore(storeName, mode, handler) {
    return openEvidenceDb().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, mode);
          const store = tx.objectStore(storeName);
          let resultPromise = Promise.resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () =>
            reject(tx.error || new Error("IndexedDB transaction aborted"));
          tx.oncomplete = () => {
            resultPromise.then(resolve).catch(reject);
          };
          try {
            resultPromise = Promise.resolve(handler(store, tx));
          } catch (error) {
            try {
              tx.abort();
            } catch (abortError) {
              // Ignore abort errors.
            }
            reject(error);
          }
        })
    );
  }

  function assertNoPromise(value, label) {
    if (!value) {
      return;
    }
    if (typeof value.then === "function") {
      throw new Error(`Attempting to store unresolved Promise in IDB (${label}).`);
    }
    if (typeof value === "object") {
      Object.entries(value).forEach(([key, field]) => {
        if (field && typeof field.then === "function") {
          throw new Error(
            `Attempting to store unresolved Promise in IDB (${label}.${key}).`
          );
        }
      });
    }
  }

  function putMany(storeName, items) {
    if (!Array.isArray(items) || items.length === 0) {
      return Promise.resolve();
    }
    return withStore(storeName, "readwrite", (store) => {
      items.forEach((item, index) => {
        assertNoPromise(item, `${storeName}[${index}]`);
        store.put(item);
      });
    });
  }

  function putOne(storeName, item) {
    assertNoPromise(item, storeName);
    return withStore(storeName, "readwrite", (store) => store.put(item));
  }

  function getByKey(storeName, key) {
    return withStore(storeName, "readonly", (store) =>
      requestToPromise(store.get(key))
    );
  }

  function deleteByKey(storeName, key) {
    return withStore(storeName, "readwrite", (store) => store.delete(key));
  }

  function getAllByIndex(storeName, indexName, keyRange, options = {}) {
    const limit =
      typeof options.limit === "number" ? Math.max(0, options.limit) : null;
    const direction = options.direction || "next";
    return withStore(storeName, "readonly", (store) => {
      const index = store.index(indexName);
      const results = [];
      return new Promise((resolve, reject) => {
        const request = index.openCursor(keyRange, direction);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            resolve(results);
            return;
          }
          results.push(cursor.value);
          if (limit && results.length >= limit) {
            resolve(results);
            return;
          }
          cursor.continue();
        };
      });
    });
  }

  function getBatchByIndex(storeName, indexName, keyRange, offset, limit) {
    const safeOffset = typeof offset === "number" ? Math.max(0, offset) : 0;
    const safeLimit = typeof limit === "number" ? Math.max(0, limit) : null;
    return withStore(storeName, "readonly", (store) => {
      const index = store.index(indexName);
      const results = [];
      let skipped = safeOffset === 0;
      return new Promise((resolve, reject) => {
        const request = index.openCursor(keyRange, "next");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            resolve({ items: results, done: true });
            return;
          }
          if (!skipped) {
            skipped = true;
            cursor.advance(safeOffset);
            return;
          }
          results.push(cursor.value);
          if (safeLimit && results.length >= safeLimit) {
            resolve({ items: results, done: false });
            return;
          }
          cursor.continue();
        };
      });
    });
  }

  function deleteAllByIndex(storeName, indexName, keyRange) {
    return withStore(storeName, "readwrite", (store) => {
      const index = store.index(indexName);
      return new Promise((resolve, reject) => {
        const request = index.openCursor(keyRange);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            resolve();
            return;
          }
          cursor.delete();
          cursor.continue();
        };
      });
    });
  }

  function clearStore(storeName) {
    return withStore(storeName, "readwrite", (store) => store.clear());
  }

  function iterateByIndex(storeName, indexName, keyRange, options, onItem) {
    const direction = options && options.direction ? options.direction : "next";
    const limit = options && typeof options.limit === "number" ? options.limit : null;
    return withStore(storeName, "readonly", (store) => {
      const index = store.index(indexName);
      let count = 0;
      return new Promise((resolve, reject) => {
        const request = index.openCursor(keyRange, direction);
        request.onerror = () => reject(request.error);
        request.onsuccess = async () => {
          const cursor = request.result;
          if (!cursor) {
            resolve(count);
            return;
          }
          count += 1;
          try {
            await onItem(cursor.value);
          } catch (error) {
            reject(error);
            return;
          }
          if (limit && count >= limit) {
            resolve(count);
            return;
          }
          cursor.continue();
        };
      });
    });
  }

  const root =
    typeof window !== "undefined"
      ? window
      : typeof self !== "undefined"
        ? self
        : globalThis;

  root.ReproIdb = {
    openEvidenceDb,
    putMany,
    putOne,
    getByKey,
    deleteByKey,
    getAllByIndex,
    getBatchByIndex,
    deleteAllByIndex,
    clearStore,
    iterateByIndex,
  };
})();
