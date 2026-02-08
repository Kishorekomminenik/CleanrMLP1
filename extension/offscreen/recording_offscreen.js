let mediaRecorder = null;
let recordedChunks = [];
let currentStream = null;
let recordingState = "idle";
let recordingMimeType = "video/webm";
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

function sumChunkBytes(chunks) {
  return chunks.reduce((total, chunk) => total + (chunk && chunk.size ? chunk.size : 0), 0);
}

function pickRecordingMimeType() {
  if (!window.MediaRecorder || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) {
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

function resetRecordingState() {
  recordedChunks = [];
  recordingMimeType = "video/webm";
  recordingStartedAt = null;
  recordingPausedAt = null;
  recordingTotalPausedMs = 0;
  recordingHasData = false;
  recordingLastError = null;
  recordingDurationMsSnapshot = null;
  recordingStopReason = null;
  recordingSegmentMode = false;
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
    mimeType: recordingMimeType || "video/webm",
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

async function captureTabStream() {
  if (!chrome?.tabCapture?.capture) {
    throw new Error("Recording not supported in this browser.");
  }
  try {
    return await new Promise((resolve, reject) => {
      try {
        chrome.tabCapture.capture({ audio: false, video: true }, (stream) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!stream) {
            reject(new Error("No stream returned"));
            return;
          }
          resolve(stream);
        });
      } catch (error) {
        reject(error);
      }
    });
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    if (isPolicyError(message)) {
      throw new Error("Recording blocked by browser policy.");
    }
    throw new Error(message || "Recording not supported in this browser.");
  }
}

function attachRecorderHandlers(recorder) {
  recorder.onstart = () => {
    if (!recordingStartedAt) {
      recordingStartedAt = nowMs();
    }
    recordingState = "recording";
    notifyStateChanged("start");
  };
  recorder.onpause = () => {
    recordingPausedAt = nowMs();
    recordingState = "paused";
    notifyStateChanged("pause");
  };
  recorder.onresume = () => {
    if (recordingPausedAt) {
      recordingTotalPausedMs += nowMs() - recordingPausedAt;
      recordingPausedAt = null;
    }
    recordingState = "recording";
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
      "[REC] STOP confirmed (offscreen)",
      `chunks=${recordedChunks.length}`,
      `totalBytes=${totalBytes}`,
      `durationMs=${durationMs}`
    );
    recordingState = "idle";
    mediaRecorder = null;
    stopStreamTracks();
    notifyStateChanged("stop");
    resolveStopPromise({ ok: true });
  };
}

async function startRecording() {
  if (recordingState === "recording" || recordingState === "paused") {
    throw new Error("Recording already in progress.");
  }
  mediaRecorder = null;
  stopStreamTracks();
  resetRecordingState();
  currentStream = await captureTabStream();
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
  const mimeType = pickRecordingMimeType();
  if (mimeType) {
    options.mimeType = mimeType;
  }
  mediaRecorder = new MediaRecorder(currentStream, options);
  recordingMimeType = mimeType || mediaRecorder.mimeType || "video/webm";
  console.log("[REC] mimeType chosen=", recordingMimeType);
  attachRecorderHandlers(mediaRecorder);
  mediaRecorder.start(250);
  return { ok: true, ...getRecordingStateSnapshot() };
}

async function pauseRecording() {
  if (!mediaRecorder || recordingState !== "recording") {
    throw new Error("Recording is not active.");
  }
  recordingState = "paused";
  recordingPausedAt = nowMs();
  if (typeof mediaRecorder.pause === "function") {
    mediaRecorder.pause();
    notifyStateChanged("pause");
    return { ok: true, ...getRecordingStateSnapshot() };
  }
  recordingSegmentMode = true;
  recordingStopReason = "pause";
  const stopPromise = createStopPromise();
  mediaRecorder.stop();
  await stopPromise;
  notifyStateChanged("pause");
  return { ok: true, ...getRecordingStateSnapshot() };
}

async function resumeRecording() {
  if (recordingState !== "paused") {
    throw new Error("Recording is not paused.");
  }
  if (mediaRecorder && mediaRecorder.state === "paused") {
    mediaRecorder.resume();
  } else if (recordingSegmentMode && currentStream) {
    const options = {};
    const mimeType = recordingMimeType || pickRecordingMimeType();
    if (mimeType) {
      options.mimeType = mimeType;
    }
    mediaRecorder = new MediaRecorder(currentStream, options);
    attachRecorderHandlers(mediaRecorder);
    mediaRecorder.start(250);
  } else {
    throw new Error("Recording is not paused.");
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
  if (!mediaRecorder || recordingState === "idle") {
    return { ok: true, ...getRecordingStateSnapshot(), alreadyStopped: true };
  }
  if (recordingState === "stopping") {
    return { ok: true, ...getRecordingStateSnapshot() };
  }
  recordingStopReason = "stop";
  recordingState = "stopping";
  const stopPromise = createStopPromise();
  if (typeof mediaRecorder.requestData === "function" && mediaRecorder.state !== "inactive") {
    try {
      mediaRecorder.requestData();
    } catch (error) {
      console.log(
        "[REC] requestData failed",
        error && error.message ? error.message : String(error)
      );
    }
  }
  mediaRecorder.stop();
  notifyStateChanged("stopping");
  await stopPromise;
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
  const blob = new Blob(recordedChunks, {
    type: recordingMimeType || "video/webm",
  });
  const url = URL.createObjectURL(blob);
  const filename = `repro_recording_${formatZipTimestamp(new Date())}.webm`;
  try {
    await new Promise((resolve, reject) => {
      chrome.downloads.download({ url, filename }, (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(downloadId);
      });
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  return { ok: true };
}

function resetRecording() {
  recordingState = "idle";
  mediaRecorder = null;
  stopStreamTracks();
  resetRecordingState();
  notifyStateChanged("reset");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
          result = await startRecording();
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
