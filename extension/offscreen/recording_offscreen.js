// FULL-PAGE CAPTURE V1 LOCKED
// DO NOT MODIFY WITHOUT TESTING SHORT + LONG PAGE.
let mediaRecorder = null;
let recordedChunks = [];
let currentStream = null;
let recordingState = "idle";
let recordingMimeType = null;
let recordingStartedAt = null;
let recordingPausedAt = null;
let recordingTotalPausedMs = 0;
let recordingHasData = false;
let recordingLastError = null;
let recordingDurationMsSnapshot = null;
let recordingStopPromise = null;
let recordingStopResolver = null;
let recordingStopReason = null;
let recordingSegmentMode = false;
let recordingObjectUrl = null;
let recordingObjectUrlBytes = 0;
let recordingFinalChunkLogged = false;
let recordingLastTimecodeMs = null;
let recordingSessionId = null;
let recordingTabId = null;
let recordingChunkIndex = 0;
let recordingChunkCount = 0;
let recordingBytesWritten = 0;
let recordingChunkBufferDropped = false;
let recordingStopFallbackUsed = false;
let recordingSessionMeta = null;
let recordingChunkFlushPromise = Promise.resolve();
const RECORDING_CHUNK_BUFFER_LIMIT = 8;
const RECORDING_STOP_TIMEOUT_MS = 10000;
const FULLPAGE_CANVAS_MAX_EDGE = 16384;
const FULLPAGE_PART_HEIGHT = 12000;
const FULLPAGE_DB_NAME = "repro_evidence_db";
let fullpageDbPromise = null;

chrome.runtime.sendMessage({ type: "OFFSCREEN_READY" });

function nowMs() {
  return Date.now();
}

function formatZipTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

function dataUrlToBlob(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    throw new Error("Invalid image data");
  }
  const [meta, base64] = dataUrl.split(",");
  const mimeMatch = meta.match(/data:([^;]+)/);
  const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

async function dataUrlToBitmap(dataUrl) {
  const blob = dataUrlToBlob(dataUrl);
  return await createImageBitmap(blob);
}

function delay() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function openFullpageDb() {
  if (fullpageDbPromise) {
    return fullpageDbPromise;
  }
  fullpageDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(FULLPAGE_DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return fullpageDbPromise;
}

function withStore(storeName, mode, handler) {
  return openFullpageDb().then(
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

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getByKey(storeName, key) {
  return withStore(storeName, "readonly", (store) =>
    requestToPromise(store.get(key))
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

function putOne(storeName, item) {
  assertNoPromise(item, storeName);
  return withStore(storeName, "readwrite", (store) => store.put(item));
}

function getAllByIndex(storeName, indexName, keyRange) {
  return withStore(storeName, "readonly", (store) => {
    const index = store.index(indexName);
    const results = [];
    return new Promise((resolve, reject) => {
      const request = index.openCursor(keyRange, "next");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(results);
          return;
        }
        results.push(cursor.value);
        cursor.continue();
      };
    });
  });
}

function buildRecordingChunkKey(sessionId, index) {
  return `${sessionId}:${String(index).padStart(6, "0")}`;
}

async function updateRecordingSessionRecord(fields) {
  if (!recordingSessionId) {
    return;
  }
  const next = {
    ...(recordingSessionMeta || { sessionId: recordingSessionId }),
    ...fields,
  };
  recordingSessionMeta = next;
  await putOne("recording_sessions", next);
}

function queueRecordingChunkFlush(record) {
  recordingChunkFlushPromise = recordingChunkFlushPromise.then(async () => {
    await putOne("recording_chunks", record);
    console.log("[RECORDING][CHUNK_FLUSH]", {
      sessionId: record.sessionId,
      chunkIndex: record.index,
      size: record.size,
      bytesWritten: recordingBytesWritten,
    });
    await updateRecordingSessionRecord({
      chunkCount: recordingChunkCount,
      bytesWritten: recordingBytesWritten,
    });
  });
  return recordingChunkFlushPromise;
}

async function loadRecordingChunksFromDb(sessionId) {
  if (!sessionId) {
    return [];
  }
  const chunks = await getAllByIndex(
    "recording_chunks",
    "sessionId",
    IDBKeyRange.only(sessionId)
  );
  chunks.sort((a, b) => a.index - b.index);
  return chunks.map((entry) => entry.blob);
}

async function drawTilesToCanvas({
  ctx,
  tiles,
  offsetY = 0,
  heightLimit = null,
  debug = false,
}) {
  let drawn = 0;
  for (const tile of tiles) {
    const tileTop = tile.y + tile.clipTop;
    const tileBottom = tileTop + tile.clipHeight;
    const canvasTop = offsetY;
    const canvasBottom =
      heightLimit !== null ? offsetY + heightLimit : Number.POSITIVE_INFINITY;
    if (tileBottom <= canvasTop || tileTop >= canvasBottom) {
      continue;
    }
    const drawTop = Math.max(tileTop, canvasTop);
    const drawBottom = Math.min(tileBottom, canvasBottom);
    const drawHeight = Math.max(0, drawBottom - drawTop);
    if (drawHeight <= 0) {
      continue;
    }
    if (!tile.dataUrl) {
      throw new Error("Tile missing image data.");
    }
    const bmp = await dataUrlToBitmap(tile.dataUrl);
    if (!bmp.width || !bmp.height) {
      throw new Error("Decoded tile has zero dimensions.");
    }
    if (debug) {
      console.log("[FULLPAGE][OFFSCREEN][TILE_DIMENSIONS]", {
        width: bmp.width,
        height: bmp.height,
      });
    }
    const srcY = tile.clipTop + (drawTop - tileTop);
    const frameWidth = tile.width || ctx.canvas.width;
    ctx.drawImage(
      bmp,
      0,
      srcY,
      frameWidth,
      drawHeight,
      0,
      drawTop - offsetY,
      frameWidth,
      drawHeight
    );
    drawn += 1;
    if (drawn % 2 === 0) {
      await delay();
    }
  }
  return drawn;
}

async function drawBlobTilesToCanvas({ ctx, tiles, debug = false }) {
  let drawn = 0;
  const lastTile = tiles && tiles.length ? tiles[tiles.length - 1] : null;
  let prevBottom = null;
  let accumulatedDestY = 0;
  for (const tile of tiles) {
    if (!tile.blobKey) {
      throw new Error("Tile missing blobKey.");
    }
    const blobRecord = await getByKey("capture_blobs", tile.blobKey);
    const blob = blobRecord && blobRecord.blob;
    if (!(blob instanceof Blob)) {
      throw new Error("Missing tile blob.");
    }
    const bmp = await createImageBitmap(blob);
    if (!bmp.width || !bmp.height) {
      throw new Error("Decoded tile has zero dimensions.");
    }
    if (debug) {
      console.log("[FULLPAGE][OFFSCREEN][TILE_DIMENSIONS]", {
        width: bmp.width,
        height: bmp.height,
      });
    }
    // V1 LOCKED: stitch assumes tile placement uses accumulated destY with
    // matching source/dest heights to prevent visible seams.
    const frameWidth = tile.widthPx || ctx.canvas.width;
    const srcY = Math.max(0, tile.clipTopPx);
    let destY = accumulatedDestY;
    let destHeight = Math.min(tile.clipHeightPx, ctx.canvas.height - destY);
    let sourceHeight = Math.min(destHeight, bmp.height - srcY);
    if (sourceHeight <= 0 || destHeight <= 0) {
      continue;
    }
    destHeight = sourceHeight;
    const drawTop = destY;
    const drawHeight = destHeight;
    console.log("[FULLPAGE][STITCH][TILE]", {
      tileIndex: tile.tileIndex,
      sourceHeight,
      destY,
      destHeight,
      accumulatedDestY,
    });
    if (prevBottom !== null) {
      console.log("[FULLPAGE][STITCH][SEAM_CHECK]", {
        tileIndex: tile.tileIndex,
        prevBottom,
        nextTop: drawTop,
        gapPx: drawTop - prevBottom,
      });
    }
    ctx.drawImage(
      bmp,
      0,
      srcY,
      frameWidth,
      sourceHeight,
      0,
      drawTop,
      frameWidth,
      destHeight
    );
    if (lastTile && tile.tileIndex === lastTile.tileIndex) {
      console.log("[FULLPAGE][STITCH][LAST_TILE]", {
        tileIndex: tile.tileIndex,
        sourceHeight,
        destY: drawTop,
        remainingHeight: Math.max(0, ctx.canvas.height - drawTop),
      });
    }
    prevBottom = drawTop + destHeight;
    accumulatedDestY = prevBottom;
    drawn += 1;
    if (drawn % 2 === 0) {
      await delay();
    }
  }
  return drawn;
}

async function normalizeToBlob(input) {
  if (input instanceof Blob) {
    return input;
  }
  if (typeof input === "string" && input.startsWith("data:")) {
    return dataUrlToBlob(input);
  }
  if (input && input.blob instanceof Blob) {
    return input.blob;
  }
  if (input instanceof ArrayBuffer) {
    return new Blob([input], { type: "image/png" });
  }
  throw new Error("FULLPAGE_ERR_INVALID_BLOB");
}

async function canvasToPngBlob(canvas) {
  if (canvas && typeof canvas.convertToBlob === "function") {
    const blob = await canvas.convertToBlob({ type: "image/png" });
    if (!blob) {
      throw new Error("Canvas toBlob returned null");
    }
    return blob;
  }
  if (canvas && typeof canvas.toBlob === "function") {
    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas toBlob returned null"));
            return;
          }
          resolve(blob);
        },
        "image/png"
      );
    });
  }
  throw new Error("Canvas toBlob returned null");
}

async function handleFullpageStitch(data) {
  return {
    ok: false,
    code: "FULLPAGE_ERR_STITCH",
    message: "Fullpage stitch transport disabled.",
  };
}

async function composeFullpageArtifact(captureRunId, isFinal) {
  try {
    if (!captureRunId) {
      return {
        ok: false,
        code: "FULLPAGE_ERR_STITCH",
        message: "Missing capture run id.",
      };
    }
    const run = await getByKey("capture_runs", captureRunId);
    if (!run) {
      return {
        ok: false,
        code: "FULLPAGE_ERR_STITCH",
        message: "Missing capture run.",
      };
    }
    const tiles = await getAllByIndex(
      "capture_tiles",
      "captureRunId",
      IDBKeyRange.only(captureRunId)
    );
    const committed = tiles.filter((tile) => tile.status === "committed");
    if (!committed.length) {
      return {
        ok: false,
        code: "FULLPAGE_ERR_STITCH",
        message: "No tiles committed for compose.",
      };
    }
    committed.sort((a, b) => a.tileIndex - b.tileIndex);
    const tileCountExpected = run.tileCountExpected || committed.length;
    const coveragePercent = tileCountExpected
      ? Math.min(100, Math.round((committed.length / tileCountExpected) * 100))
      : 0;
    const completedThroughTile = committed[committed.length - 1].tileIndex || 0;
    const logPrefix = isFinal ? "FINAL" : "PARTIAL";
    console.log(`[FULLPAGE][OFFSCREEN][COMPOSE_${logPrefix}_START]`, {
      captureRunId,
      committedTileCount: committed.length,
    });
    const canvas = new OffscreenCanvas(run.totalWidthPx, run.totalHeightPx);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return {
        ok: false,
        code: "FULLPAGE_ERR_STITCH",
        message: "Could not acquire 2D context.",
      };
    }
    const drawn = await drawBlobTilesToCanvas({
      ctx,
      tiles: committed,
      debug: false,
    });
    if (drawn === 0) {
      return {
        ok: false,
        code: "FULLPAGE_ERR_STITCH",
        message: "No tiles were drawn onto final canvas.",
      };
    }
    const blob = await canvasToPngBlob(canvas);
    if (!(blob instanceof Blob) || blob.size === 0) {
      return {
        ok: false,
        code: "FULLPAGE_ERR_STITCH",
        message: "Canvas export produced empty blob.",
      };
    }
    const artifactKey = `${isFinal ? "fullpage_final" : "fullpage_partial"}_${captureRunId}_${Date.now()}`;
    const blobKey = artifactKey;
    if (typeof Blob !== "undefined" && !(blob instanceof Blob)) {
      return {
        ok: false,
        code: "FULLPAGE_ERR_STITCH",
        message: "capture_blobs.blob must be a resolved Blob",
      };
    }
    await putOne("capture_blobs", {
      key: blobKey,
      captureRunId,
      kind: isFinal ? "fullpage_final" : "fullpage_partial",
      blob,
      createdAt: Date.now(),
    });
    await putOne("capture_artifacts", {
      key: artifactKey,
      captureRunId,
      kind: isFinal ? "final" : "partial",
      blobKey,
      coveragePercent,
      completedThroughTile,
      isPartial: !isFinal,
      createdAt: Date.now(),
    });
    console.log(`[FULLPAGE][OFFSCREEN][COMPOSE_${logPrefix}_DONE]`, {
      captureRunId,
      artifactKey,
      byteLength: blob.size,
      coveragePercent,
    });
    return {
      ok: true,
      artifactKey,
      coveragePercent,
      completedThroughTile,
      isPartial: !isFinal,
      byteLength: blob.size,
    };
  } catch (error) {
    return {
      ok: false,
      code: "FULLPAGE_ERR_STITCH",
      message: error?.message || "Compose failed.",
    };
  }
}

function sumChunkBytes(chunks) {
  return chunks.reduce((total, chunk) => total + (chunk && chunk.size ? chunk.size : 0), 0);
}

function readVintSize(view, offset) {
  const first = view.getUint8(offset);
  let mask = 0x80;
  let length = 1;
  while (length <= 8 && (first & mask) === 0) {
    mask >>= 1;
    length += 1;
  }
  if (length > 8) {
    throw new Error("Invalid VINT length");
  }
  let value = first & (mask - 1);
  for (let i = 1; i < length; i += 1) {
    value = (value << 8) | view.getUint8(offset + i);
  }
  const max = Math.pow(2, 7 * length) - 1;
  const unknown = value === max;
  return { length, value, unknown };
}

function readVintId(view, offset) {
  const first = view.getUint8(offset);
  let mask = 0x80;
  let length = 1;
  while (length <= 4 && (first & mask) === 0) {
    mask >>= 1;
    length += 1;
  }
  if (length > 4) {
    throw new Error("Invalid EBML ID length");
  }
  let value = 0;
  for (let i = 0; i < length; i += 1) {
    value = (value << 8) | view.getUint8(offset + i);
  }
  return { length, value };
}

function encodeVintSize(value, length) {
  const max = Math.pow(2, 7 * length) - 1;
  if (value < 0 || value >= max) {
    throw new Error("Value does not fit in VINT length");
  }
  const bytes = new Uint8Array(length);
  let remaining = value;
  for (let i = length - 1; i >= 0; i -= 1) {
    bytes[i] = remaining & 0xff;
    remaining = remaining >> 8;
  }
  bytes[0] |= 1 << (8 - length);
  return bytes;
}

function findElement(buffer, start, end, targetId) {
  const view = new DataView(buffer);
  let offset = start;
  while (offset < end) {
    const id = readVintId(view, offset);
    offset += id.length;
    const size = readVintSize(view, offset);
    offset += size.length;
    const dataStart = offset;
    const dataEnd = size.unknown ? end : offset + size.value;
    const element = {
      id: id.value,
      idLength: id.length,
      size: size.value,
      sizeLength: size.length,
      sizeUnknown: size.unknown,
      headerStart: offset - id.length - size.length,
      dataStart,
      dataEnd,
    };
    if (element.id === targetId) {
      return element;
    }
    if (size.unknown) {
      break;
    }
    offset = dataEnd;
  }
  return null;
}

async function fixWebmDuration(blob, durationMs) {
  if (!durationMs || durationMs <= 0) {
    return blob;
  }
  const buffer = await blob.arrayBuffer();
  const view = new DataView(buffer);
  const segment = findElement(buffer, 0, buffer.byteLength, 0x18538067);
  if (!segment) {
    return blob;
  }
  const segmentEnd = segment.sizeUnknown ? buffer.byteLength : segment.dataEnd;
  const info = findElement(buffer, segment.dataStart, segmentEnd, 0x1549a966);
  if (!info) {
    return blob;
  }
  const durationElement = findElement(
    buffer,
    info.dataStart,
    info.dataEnd,
    0x4489
  );
  const durationSeconds = durationMs / 1000;
  if (durationElement) {
    if (durationElement.size === 4) {
      view.setFloat32(durationElement.dataStart, durationSeconds);
      return new Blob([buffer], { type: blob.type });
    }
    if (durationElement.size === 8) {
      view.setFloat64(durationElement.dataStart, durationSeconds);
      return new Blob([buffer], { type: blob.type });
    }
  }

  const durationPayload = new ArrayBuffer(8);
  const durationView = new DataView(durationPayload);
  durationView.setFloat64(0, durationSeconds);
  const durationSizeBytes = encodeVintSize(8, 1);
  const durationBytes = new Uint8Array(2 + durationSizeBytes.length + 8);
  durationBytes[0] = 0x44;
  durationBytes[1] = 0x89;
  durationBytes.set(durationSizeBytes, 2);
  durationBytes.set(new Uint8Array(durationPayload), 2 + durationSizeBytes.length);

  const newInfoSize = info.size + durationBytes.length;
  let newInfoSizeBytes;
  try {
    newInfoSizeBytes = encodeVintSize(newInfoSize, info.sizeLength);
  } catch (error) {
    return blob;
  }

  const newSegmentSize = segment.sizeUnknown
    ? null
    : segment.size + durationBytes.length;
  let newSegmentSizeBytes = null;
  if (newSegmentSize !== null) {
    try {
      newSegmentSizeBytes = encodeVintSize(newSegmentSize, segment.sizeLength);
    } catch (error) {
      newSegmentSizeBytes = null;
    }
  }

  const inserted = new Uint8Array(buffer.byteLength + durationBytes.length);
  const infoSizeOffset = info.headerStart + info.idLength;
  inserted.set(new Uint8Array(buffer.slice(0, info.headerStart)), 0);
  inserted.set(new Uint8Array(buffer.slice(info.headerStart, info.dataStart)), info.headerStart);
  inserted.set(newInfoSizeBytes, infoSizeOffset);

  if (newSegmentSizeBytes) {
    const segmentSizeOffset = segment.headerStart + segment.idLength;
    inserted.set(newSegmentSizeBytes, segmentSizeOffset);
  }

  inserted.set(durationBytes, info.dataStart);
  inserted.set(
    new Uint8Array(buffer.slice(info.dataStart)),
    info.dataStart + durationBytes.length
  );
  return new Blob([inserted], { type: blob.type });
}

function pickRecordingMimeType(requested) {
  if (!window.MediaRecorder || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }
  const candidates = [];
  if (requested) {
    candidates.push(requested);
  }
  candidates.push(
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  );
  for (const candidate of candidates) {
    if (candidate && MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return "";
}

function isPolicyError(message) {
  if (!message) {
    return false;
  }
  const lower = message.toLowerCase();
  return [
    "policy",
    "enterprise",
    "managed",
    "administrator",
    "admin",
    "not allowed",
    "not permitted",
    "blocked",
    "disabled",
  ].some((keyword) => lower.includes(keyword));
}

function stopStreamTracks() {
  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop());
    currentStream = null;
  }
}

function revokeRecordingUrl() {
  if (recordingObjectUrl) {
    URL.revokeObjectURL(recordingObjectUrl);
  }
  recordingObjectUrl = null;
  recordingObjectUrlBytes = 0;
}

function resetRecordingState() {
  recordedChunks = [];
  recordingMimeType = null;
  recordingStartedAt = null;
  recordingPausedAt = null;
  recordingTotalPausedMs = 0;
  recordingHasData = false;
  recordingLastError = null;
  recordingDurationMsSnapshot = null;
  recordingStopReason = null;
  recordingSegmentMode = false;
  recordingHasData = false;
  recordingSessionId = null;
  recordingTabId = null;
  recordingChunkIndex = 0;
  recordingChunkCount = 0;
  recordingBytesWritten = 0;
  recordingChunkBufferDropped = false;
  recordingStopFallbackUsed = false;
  recordingSessionMeta = null;
  recordingLastTimecodeMs = null;
  revokeRecordingUrl();
}

function computeElapsedMs() {
  if (!recordingStartedAt) {
    return recordingDurationMsSnapshot || 0;
  }
  if (recordingState === "idle" && typeof recordingDurationMsSnapshot === "number") {
    return recordingDurationMsSnapshot;
  }
  let end = nowMs();
  if (recordingState === "paused" && recordingPausedAt) {
    end = recordingPausedAt;
  }
  return Math.max(0, end - recordingStartedAt - recordingTotalPausedMs);
}

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getRecordingStateSnapshot() {
  const elapsedMs = computeElapsedMs();
  return {
    sessionId: recordingSessionId,
    state: recordingState,
    startedAt: recordingStartedAt,
    pausedAt: recordingPausedAt,
    totalPausedMs: recordingTotalPausedMs,
    hasData: recordingHasData,
    mimeType: recordingMimeType || null,
    lastError: recordingLastError,
    elapsedMs,
    elapsedText: formatElapsed(elapsedMs),
    recorderState: mediaRecorder ? mediaRecorder.state : "inactive",
    chunkCount: recordingChunkCount,
    bytesWritten: recordingBytesWritten,
  };
}

function notifyStateChanged(reason) {
  chrome.runtime.sendMessage({
    type: "RECORDING_STATE_CHANGED",
    state: getRecordingStateSnapshot(),
    reason: reason || null,
  });
}

function createStopPromise() {
  if (recordingStopPromise) {
    return recordingStopPromise;
  }
  recordingStopPromise = new Promise((resolve) => {
    recordingStopResolver = resolve;
  });
  return recordingStopPromise;
}

function resolveStopPromise(result) {
  if (recordingStopResolver) {
    recordingStopResolver(result);
  }
  recordingStopPromise = null;
  recordingStopResolver = null;
}

async function captureTabStream(streamId) {
  if (!streamId) {
    throw new Error("Missing stream id. Start recording from the popup.");
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("MediaDevices API not available.");
  }
  try {
    const constraints = {
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId,
        },
      },
    };
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    console.log("[REC][offscreen] getUserMedia failed", message);
    if (isPolicyError(message)) {
      throw new Error("Recording blocked by browser policy.");
    }
    if (error && error.name === "NotAllowedError") {
      throw new Error("Recording permission was denied.");
    }
    throw new Error(message || "Failed to acquire tab media.");
  }
}

function attachRecorderHandlers(recorder) {
  recorder.onstart = () => {
    if (!recordingStartedAt) {
      recordingStartedAt = nowMs();
    }
    recordingState = "recording";
    console.log("[REC][offscreen] onstart");
    notifyStateChanged("start");
  };
  recorder.onpause = () => {
    recordingPausedAt = nowMs();
    recordingState = "paused";
    console.log("[REC][offscreen] onpause");
    notifyStateChanged("pause");
  };
  recorder.onresume = () => {
    if (recordingPausedAt) {
      recordingTotalPausedMs += nowMs() - recordingPausedAt;
      recordingPausedAt = null;
    }
    recordingState = "recording";
    console.log("[REC][offscreen] onresume");
    notifyStateChanged("resume");
  };
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      const chunk = event.data;
      recordedChunks.push(chunk);
      if (recordedChunks.length > RECORDING_CHUNK_BUFFER_LIMIT) {
        recordedChunks.splice(0, recordedChunks.length - RECORDING_CHUNK_BUFFER_LIMIT);
        recordingChunkBufferDropped = true;
      }
      const index = recordingChunkIndex;
      recordingChunkIndex += 1;
      recordingChunkCount = recordingChunkIndex;
      recordingBytesWritten += chunk.size;
      const record = {
        key: buildRecordingChunkKey(recordingSessionId, index),
        sessionId: recordingSessionId,
        index,
        blob: chunk,
        size: chunk.size,
        timecode:
          typeof event.timecode === "number" && Number.isFinite(event.timecode)
            ? event.timecode
            : null,
        createdAt: Date.now(),
      };
      if (typeof record.timecode === "number") {
        recordingLastTimecodeMs =
          typeof recordingLastTimecodeMs === "number"
            ? Math.max(recordingLastTimecodeMs, record.timecode)
            : record.timecode;
      }
      queueRecordingChunkFlush(record);
      if (!recordingHasData) {
        recordingHasData = true;
        chrome.runtime.sendMessage({ type: "RECORDING_DATA_AVAILABLE" });
        notifyStateChanged("data");
      }
      if (recordingState === "stopping" && !recordingFinalChunkLogged) {
        recordingFinalChunkLogged = true;
        console.log("[REC][offscreen] FINAL_CHUNK_RECEIVED");
      }
    }
  };
  recorder.onerror = (event) => {
    const errorMessage =
      event.error && event.error.message ? event.error.message : "Recording failed.";
    recordingLastError = errorMessage;
    chrome.runtime.sendMessage({ type: "RECORDING_ERROR", error: errorMessage });
    notifyStateChanged("error");
  };
  recorder.onstop = async () => {
    if (recordingStopReason === "pause") {
      recordingStopReason = null;
      resolveStopPromise({ ok: true, paused: true });
      return;
    }
    const durationMs = computeElapsedMs();
    recordingDurationMsSnapshot = durationMs;
    const totalBytes = recordingBytesWritten || sumChunkBytes(recordedChunks);
    console.log(
      "[REC][offscreen] STOP confirmed",
      `chunks=${recordedChunks.length}`,
      `totalBytes=${totalBytes}`,
      `durationMs=${durationMs}`
    );
    recordingState = "idle";
    recordingPausedAt = null;
    mediaRecorder = null;
    stopStreamTracks();
    notifyStateChanged("stop");
    await updateRecordingSessionRecord({
      status: recordingStopFallbackUsed ? "partial_complete" : "stopped",
      stoppedAt: Date.now(),
      durationMs,
      isPartial: recordingStopFallbackUsed,
      failureReason: recordingStopFallbackUsed ? "stop_timeout" : null,
      chunkCount: recordingChunkCount,
      bytesWritten: recordingBytesWritten,
    });
    resolveStopPromise({ ok: true });
  };
}

async function startRecording(streamId, tabId, requestedMime, sessionId) {
  if (recordingState === "recording" || recordingState === "paused") {
    return { ok: true, alreadyRecording: true, ...getRecordingStateSnapshot() };
  }
  mediaRecorder = null;
  stopStreamTracks();
  resetRecordingState();
  revokeRecordingUrl();
  recordingSessionId = sessionId || `rec_${Date.now()}`;
  recordingTabId = tabId || null;
  recordingChunkIndex = 0;
  recordingChunkCount = 0;
  recordingBytesWritten = 0;
  recordingChunkBufferDropped = false;
  recordingStopFallbackUsed = false;
  recordingSessionMeta = {
    sessionId: recordingSessionId,
    tabId: recordingTabId,
    status: "starting",
    startedAt: Date.now(),
    stoppedAt: null,
    mimeType: requestedMime || null,
    durationMs: null,
    chunkCount: 0,
    bytesWritten: 0,
    finalBlobKey: null,
    isPartial: false,
    failureReason: null,
  };
  try {
    await putOne("recording_sessions", recordingSessionMeta);
  } catch (error) {
    // Ignore IDB session creation failures.
  }
  console.log("[REC][offscreen] start ->", { tabId });
  try {
    currentStream = await captureTabStream(streamId);
    console.log("[REC][offscreen] getUserMedia ok");
  } catch (error) {
    recordingLastError =
      "getUserMedia failed: " + (error && error.message ? error.message : String(error));
    recordingState = "idle";
    recordingStartedAt = null;
    recordingPausedAt = null;
    recordingTotalPausedMs = 0;
    return { ok: false, error: recordingLastError };
  }
  currentStream.getTracks().forEach((track) => {
    track.onended = () => {
      recordingLastError = "Track ended";
      recordingState = "idle";
      mediaRecorder = null;
      stopStreamTracks();
      notifyStateChanged("ended");
      recordingDurationMsSnapshot = computeElapsedMs();
      recordingStopFallbackUsed = true;
      console.log("[RECORDING][TRACK_ENDED]", {
        sessionId: recordingSessionId,
        reason: "track_ended",
      });
      updateRecordingSessionRecord({
        status: "partial_complete",
        stoppedAt: Date.now(),
        durationMs: computeElapsedMs(),
        isPartial: true,
        failureReason: "track_ended",
        chunkCount: recordingChunkCount,
        bytesWritten: recordingBytesWritten,
      });
      chrome.runtime.sendMessage({
        type: "RECORDING_TRACK_ENDED",
        sessionId: recordingSessionId,
      });
      resolveStopPromise({ ok: false, reason: "ended" });
    };
  });

  const options = {};
  const mimeType = pickRecordingMimeType(requestedMime);
  if (mimeType) {
    options.mimeType = mimeType;
  }
  try {
    mediaRecorder = new MediaRecorder(currentStream, options);
  } catch (error) {
    recordingLastError =
      "MediaRecorder init failed: " +
      (error && error.message ? error.message : String(error));
    stopStreamTracks();
    currentStream = null;
    mediaRecorder = null;
    recordingState = "idle";
    return { ok: false, error: recordingLastError };
  }
  recordingMimeType = mimeType || mediaRecorder.mimeType || "video/webm";
  console.log("[REC][offscreen] mimeType chosen=", recordingMimeType);
  await updateRecordingSessionRecord({
    status: "recording",
    mimeType: recordingMimeType,
  });
  attachRecorderHandlers(mediaRecorder);
  recordingStartedAt = nowMs();
  recordingPausedAt = null;
  recordingTotalPausedMs = 0;
  recordingState = "recording";
  try {
    mediaRecorder.start(250);
  } catch (error) {
    recordingLastError =
      "Recorder start failed: " +
      (error && error.message ? error.message : String(error));
    recordingState = "idle";
    recordingStartedAt = null;
    recordingPausedAt = null;
    recordingTotalPausedMs = 0;
    stopStreamTracks();
    currentStream = null;
    mediaRecorder = null;
    return { ok: false, error: recordingLastError };
  }
  notifyStateChanged("start");
  return { ok: true, ...getRecordingStateSnapshot() };
}

async function pauseRecording() {
  if (
    !mediaRecorder ||
    recordingState !== "recording" ||
    mediaRecorder.state !== "recording"
  ) {
    throw new Error("Not recording.");
  }
  try {
    mediaRecorder.pause();
  } catch (error) {
    throw new Error(
      "Pause failed: " + (error && error.message ? error.message : String(error))
    );
  }
  recordingPausedAt = nowMs();
  recordingState = "paused";
  notifyStateChanged("pause");
  return { ok: true, ...getRecordingStateSnapshot() };
}

async function resumeRecording() {
  if (
    !mediaRecorder ||
    recordingState !== "paused" ||
    mediaRecorder.state !== "paused"
  ) {
    throw new Error("Not paused.");
  }
  try {
    mediaRecorder.resume();
  } catch (error) {
    throw new Error(
      "Resume failed: " + (error && error.message ? error.message : String(error))
    );
  }
  if (recordingPausedAt) {
    recordingTotalPausedMs += nowMs() - recordingPausedAt;
    recordingPausedAt = null;
  }
  recordingState = "recording";
  notifyStateChanged("resume");
  return { ok: true, ...getRecordingStateSnapshot() };
}

async function stopRecording() {
  console.log("[REC][offscreen] STOP_REQUESTED");
  if (recordingState === "idle" || !mediaRecorder) {
    return { ok: true, ...getRecordingStateSnapshot(), alreadyStopped: true };
  }
  if (mediaRecorder.state === "inactive") {
    recordingState = "idle";
    recordingPausedAt = null;
    mediaRecorder = null;
    stopStreamTracks();
    return { ok: true, ...getRecordingStateSnapshot(), alreadyStopped: true };
  }
  if (recordingState === "stopping") {
    return { ok: true, ...getRecordingStateSnapshot() };
  }
  recordingStopReason = "stop";
  recordingState = "stopping";
  recordingFinalChunkLogged = false;
  const stopPromise = createStopPromise();
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(
      () => resolve({ ok: false, reason: "timeout" }),
      RECORDING_STOP_TIMEOUT_MS
    );
  });
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    if (typeof mediaRecorder.requestData === "function") {
      try {
        mediaRecorder.requestData();
      } catch (error) {
        console.log(
          "[REC][offscreen] requestData failed",
          error && error.message ? error.message : String(error)
        );
      }
    }
    try {
      mediaRecorder.stop();
      console.log("[REC][offscreen] RECORDER_STOP_CALLED");
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      recordingLastError = `Stop failed: ${message}`;
      recordingState = "idle";
      stopStreamTracks();
      notifyStateChanged("error");
      resolveStopPromise({ ok: false, reason: "stop_failed" });
      return { ok: false, error: "Failed to stop recording." };
    }
  }
  notifyStateChanged("stopping");
  const result = await Promise.race([stopPromise, timeoutPromise]);
  if (result && result.ok === false && result.reason === "timeout") {
    if (recordingChunkCount > 0 || recordedChunks.length > 0) {
      recordingLastError = null;
      recordingState = "idle";
      mediaRecorder = null;
      stopStreamTracks();
      notifyStateChanged("stop");
      recordingDurationMsSnapshot = computeElapsedMs();
      recordingStopFallbackUsed = true;
      const fallback = {
        ok: true,
        fallback: true,
        message: "Recording stopped and saved from available data.",
        code: "RECORDING_STOP_TIMEOUT_FALLBACK",
        ...getRecordingStateSnapshot(),
      };
      console.log("[RECORDING][STOP_TIMEOUT_FALLBACK]", {
        sessionId: recordingSessionId,
        chunkCount: recordingChunkCount,
        bytesWritten: recordingBytesWritten,
      });
      console.log("[REC][offscreen] STOP_TIMEOUT_FALLBACK", {
        chunks: recordedChunks.length,
      });
      updateRecordingSessionRecord({
        status: "partial_complete",
        stoppedAt: Date.now(),
        durationMs: computeElapsedMs(),
        isPartial: true,
        failureReason: "stop_timeout",
        chunkCount: recordingChunkCount,
        bytesWritten: recordingBytesWritten,
      });
      resolveStopPromise(fallback);
      return fallback;
    }
    recordingLastError = "Recording stop timed out.";
    recordingState = "idle";
    mediaRecorder = null;
    stopStreamTracks();
    notifyStateChanged("error");
    resolveStopPromise(result);
    return {
      ok: false,
      error: "Recording stop timed out.",
      code: "RECORDING_STOP_TIMEOUT",
      ...getRecordingStateSnapshot(),
    };
  }
  if (!recordingHasData || recordedChunks.length === 0) {
    recordingLastError = "No recording data captured.";
    recordingState = "idle";
    stopStreamTracks();
    notifyStateChanged("error");
    return {
      ok: false,
      error: "No recording data captured.",
      ...getRecordingStateSnapshot(),
    };
  }
  return { ok: true, ...getRecordingStateSnapshot() };
}

async function exportRecordingWebm() {
  if (recordingState === "recording" || recordingState === "paused") {
    return { ok: false, error: "Stop recording to download." };
  }
  if (recordingState === "stopping") {
    return { ok: false, error: "Recording is still stopping. Try again." };
  }
  await recordingChunkFlushPromise;
  if (!recordingHasData || (recordedChunks.length === 0 && recordingChunkCount === 0)) {
    return { ok: false, error: "No recording available to download." };
  }
  let chunks = recordedChunks;
  if (
    recordingSessionId &&
    (recordingChunkBufferDropped || recordedChunks.length < recordingChunkCount)
  ) {
    const stored = await loadRecordingChunksFromDb(recordingSessionId);
    if (stored.length > 0) {
      chunks = stored;
    }
  }
  if (!chunks.length) {
    return { ok: false, error: "No recording available to download." };
  }
  const totalBytes = sumChunkBytes(chunks);
  console.log(
    "[REC] EXPORT requested",
    `chunks=${chunks.length}`,
    `totalBytes=${totalBytes}`,
    `mimeType=${recordingMimeType || "video/webm"}`
  );
  let blob = new Blob(chunks, {
    type: recordingMimeType || "video/webm",
  });
  console.log("[REC][offscreen] BLOB_ASSEMBLED", {
    bytes: blob.size,
    mimeType: recordingMimeType || "video/webm",
  });
  let durationMs =
    typeof recordingDurationMsSnapshot === "number"
      ? recordingDurationMsSnapshot
      : computeElapsedMs();
  if (!durationMs || durationMs <= 0) {
    if (typeof recordingLastTimecodeMs === "number") {
      durationMs = Math.round(recordingLastTimecodeMs);
    }
  }
  try {
    const fixed = await fixWebmDuration(blob, durationMs);
    if (fixed instanceof Blob) {
      blob = fixed;
    }
  } catch (error) {
    console.log(
      "[REC] duration fix failed",
      error && error.message ? error.message : String(error)
    );
  }
  if (recordingObjectUrl && recordingObjectUrlBytes !== blob.size) {
    revokeRecordingUrl();
  }
  if (!recordingObjectUrl) {
    recordingObjectUrl = URL.createObjectURL(blob);
    recordingObjectUrlBytes = blob.size;
  }
  const filename = `repro_recording_${formatZipTimestamp(new Date())}.webm`;
  if (recordingSessionId) {
    const artifactKey = `recording_final_${recordingSessionId}_${Date.now()}`;
    try {
      await putOne("recording_artifacts", {
        key: artifactKey,
        sessionId: recordingSessionId,
        blob,
        size: blob.size,
        mimeType: recordingMimeType || "video/webm",
        kind: recordingStopFallbackUsed ? "partial" : "final",
        createdAt: Date.now(),
      });
      await updateRecordingSessionRecord({
        status: recordingStopFallbackUsed ? "partial_complete" : "complete",
        stoppedAt: Date.now(),
        durationMs,
        finalBlobKey: artifactKey,
        isPartial: recordingStopFallbackUsed,
        failureReason: recordingStopFallbackUsed ? "stop_timeout" : null,
        chunkCount: recordingChunkCount || chunks.length,
        bytesWritten: recordingBytesWritten || totalBytes,
      });
      console.log("[RECORDING][FINALIZE]", {
        sessionId: recordingSessionId,
        status: recordingStopFallbackUsed ? "partial_complete" : "complete",
        artifactSize: blob.size,
        isPartial: recordingStopFallbackUsed,
      });
    } catch (error) {
      // Ignore artifact persistence failures.
    }
  }
  return {
    ok: true,
    blobUrl: recordingObjectUrl,
    filename,
    mimeType: recordingMimeType || "video/webm",
    size: blob.size,
    durationMs,
    sessionId: recordingSessionId,
  };
}

function resetRecording() {
  try {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
  } catch (error) {
    // ignore reset stop errors
  }
  stopStreamTracks();
  currentStream = null;
  mediaRecorder = null;
  recordedChunks = [];
  recordingHasData = false;
  recordingStartedAt = null;
  recordingPausedAt = null;
  recordingTotalPausedMs = 0;
  recordingDurationMsSnapshot = null;
  recordingStopReason = null;
  recordingSegmentMode = false;
  recordingMimeType = null;
  recordingState = "idle";
  recordingLastError = null;
  revokeRecordingUrl();
  notifyStateChanged("reset");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handledTypes = new Set([
    "OFFSCREEN_PING",
    "RECORDING_GET_STATE",
    "RECORDING_START",
    "RECORDING_PAUSE",
    "RECORDING_RESUME",
    "RECORDING_STOP",
    "RECORDING_EXPORT_WEBM",
    "RECORDING_RESET",
    "DOWNLOAD_BLOB",
    "FULLPAGE_COMPOSE_PARTIAL",
    "FULLPAGE_COMPOSE_FINAL",
  ]);
  if (!handledTypes.has(message.type)) {
    if (
      typeof message.type === "string" &&
      (message.type.startsWith("RECORDING_") ||
        message.type.startsWith("OFFSCREEN_"))
    ) {
      console.warn("[OFFSCREEN] Unknown message type:", message.type);
    }
    return false;
  }
  (async () => {
    let result;
    try {
      switch (message.type) {
        case "OFFSCREEN_PING":
          result = { ok: true, ready: true, owner: "recording_offscreen" };
          break;
        case "RECORDING_GET_STATE":
          result = { ok: true, ...getRecordingStateSnapshot() };
          break;
        case "RECORDING_START":
          result = await startRecording(
            message.streamId,
            message.tabId,
            message.mimeType,
            message.sessionId
          );
          break;
        case "RECORDING_PAUSE":
          result = await pauseRecording();
          break;
        case "RECORDING_RESUME":
          result = await resumeRecording();
          break;
        case "RECORDING_STOP":
          result = await stopRecording();
          break;
        case "RECORDING_EXPORT_WEBM":
          result = await exportRecordingWebm();
          break;
        case "RECORDING_RESET":
          resetRecording();
          result = { ok: true };
          break;
        case "DOWNLOAD_BLOB": {
          const blob = message.blob;
          const filename = message.filename || "download.bin";
          const saveAs = message.saveAs === true;
          if (!blob) {
            result = { ok: false, error: "Missing blob for download." };
            break;
          }
          const url = URL.createObjectURL(blob);
          result = await new Promise((resolve) => {
            chrome.downloads.download(
              {
                url,
                filename,
                saveAs,
              },
              (downloadId) => {
                if (chrome.runtime.lastError || !downloadId) {
                  resolve({
                    ok: false,
                    error: chrome.runtime.lastError
                      ? chrome.runtime.lastError.message
                      : "Download failed.",
                  });
                  return;
                }
                resolve({ ok: true, downloadId });
              }
            );
            setTimeout(() => URL.revokeObjectURL(url), 2000);
          });
          break;
        }
        case "FULLPAGE_COMPOSE_PARTIAL":
          result = await composeFullpageArtifact(
            message.payload ? message.payload.captureRunId : null,
            false
          );
          break;
        case "FULLPAGE_COMPOSE_FINAL":
          result = await composeFullpageArtifact(
            message.payload ? message.payload.captureRunId : null,
            true
          );
          break;
        default:
          result = { ok: false, error: "Unknown message type." };
          break;
      }
    } catch (error) {
      const messageText = error && error.message ? error.message : "Recording failed.";
      recordingLastError = messageText;
      result = { ok: false, error: messageText };
      notifyStateChanged("error");
    }
    sendResponse(result);
  })();
  return true;
});
