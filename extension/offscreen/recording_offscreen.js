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
const RECORDING_STOP_TIMEOUT_MS = 10000;
const FULLPAGE_CANVAS_MAX_EDGE = 16384;
const FULLPAGE_PART_HEIGHT = 12000;

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
  try {
    if (!data || !Array.isArray(data.tiles) || data.tiles.length === 0) {
      return {
        ok: false,
        code: "FULLPAGE_ERR_STITCH",
        message: "No tiles provided for stitching.",
      };
    }

    const { totalWidth, totalHeight } = data;

    if (!totalWidth || !totalHeight) {
      return {
        ok: false,
        code: "FULLPAGE_ERR_STITCH",
        message: "Invalid canvas dimensions.",
      };
    }

    const canvas = new OffscreenCanvas(totalWidth, totalHeight);
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return {
        ok: false,
        code: "FULLPAGE_ERR_STITCH",
        message: "Could not acquire 2D context.",
      };
    }

    console.log("[FULLPAGE][OFFSCREEN][CANVAS]", {
      width: canvas.width,
      height: canvas.height,
    });
    const drawnTileCount = await drawTilesToCanvas({
      ctx,
      tiles: data.tiles,
      offsetY: 0,
      heightLimit: null,
      debug: data && data.debug,
    });

    if (canvas.width === 0 || canvas.height === 0) {
      return {
        ok: false,
        code: "FULLPAGE_ERR_STITCH",
        message: "Final canvas has zero dimensions.",
      };
    }
    if (drawnTileCount === 0) {
      return {
        ok: false,
        code: "FULLPAGE_ERR_STITCH",
        message: "No tiles were drawn onto final canvas.",
      };
    }
    if (data && data.debug) {
      console.log("[FULLPAGE][OFFSCREEN][TILES_DRAWN]", {
        count: drawnTileCount,
      });
    }

    let pixelLog = null;
    try {
      const imageData = ctx.getImageData(0, 0, 1, 1);
      const rgba = imageData && imageData.data ? imageData.data : null;
      pixelLog = rgba
        ? { r: rgba[0], g: rgba[1], b: rgba[2], a: rgba[3] }
        : { error: "No image data at pixel 0,0." };
    } catch (error) {
      pixelLog = { error: error?.message || "getImageData failed." };
    }
    console.log("[FULLPAGE][OFFSCREEN][PIXEL]", pixelLog);

    const blob = await canvasToPngBlob(canvas);

    if (!(blob instanceof Blob)) {
      return {
        ok: false,
        code: "FULLPAGE_ERR_STITCH",
        message: "Stitch did not return a valid Blob.",
      };
    }
    if (blob.size === 0) {
      return {
        ok: false,
        code: "FULLPAGE_ERR_STITCH",
        message: "Canvas export produced empty blob.",
      };
    }
    console.log("[FULLPAGE][OFFSCREEN][BLOB]", {
      size: blob.size,
    });

    const arrayBuffer = await blob.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return {
        ok: false,
        code: "FULLPAGE_ERR_STITCH",
        message: "Blob converted to empty byte array.",
      };
    }
    if (data && data.debug) {
      console.log("[FULLPAGE][OFFSCREEN][STITCH_RESULT]", {
        byteLength: arrayBuffer.byteLength,
        mimeType: "image/png",
      });
    }

    return {
      ok: true,
      kind: "arraybuffer",
      mimeType: "image/png",
      bytes: arrayBuffer,
      byteLength: arrayBuffer.byteLength,
      parts: 1,
    };
  } catch (err) {
    return {
      ok: false,
      code: "FULLPAGE_ERR_STITCH",
      message: err?.message || "Unexpected stitch error.",
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
      recordedChunks.push(event.data);
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
    const totalBytes = sumChunkBytes(recordedChunks);
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
    resolveStopPromise({ ok: true });
  };
}

async function startRecording(streamId, tabId, requestedMime) {
  if (recordingState === "recording" || recordingState === "paused") {
    return { ok: true, alreadyRecording: true, ...getRecordingStateSnapshot() };
  }
  mediaRecorder = null;
  stopStreamTracks();
  resetRecordingState();
  revokeRecordingUrl();
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
  if (!recordingHasData || recordedChunks.length === 0) {
    return { ok: false, error: "No recording available to download." };
  }
  const totalBytes = sumChunkBytes(recordedChunks);
  console.log(
    "[REC] EXPORT requested",
    `chunks=${recordedChunks.length}`,
    `totalBytes=${totalBytes}`,
    `mimeType=${recordingMimeType || "video/webm"}`
  );
  let blob = new Blob(recordedChunks, {
    type: recordingMimeType || "video/webm",
  });
  console.log("[REC][offscreen] BLOB_ASSEMBLED", {
    bytes: blob.size,
    mimeType: recordingMimeType || "video/webm",
  });
  const durationMs =
    typeof recordingDurationMsSnapshot === "number"
      ? recordingDurationMsSnapshot
      : computeElapsedMs();
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
  return {
    ok: true,
    blobUrl: recordingObjectUrl,
    filename,
    mimeType: recordingMimeType || "video/webm",
    size: blob.size,
    durationMs,
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
    "FULLPAGE_STITCH",
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
            message.mimeType
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
        case "FULLPAGE_STITCH":
          result = await handleFullpageStitch(message.payload || {});
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
