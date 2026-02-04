import { formatDurationMs } from "./utils.js";

const VALID_MODES = ["screenshot", "video", "network", "all"];

const store = {
  sessionState: "idle",
  mode: "all",
  lockedTab: null,
  startTimeMs: null,
  startTimeIso: null,
  pausedAtMs: null,
  pausedTotalMs: 0,
  cdpTimeOriginMs: null,
  videoChunks: [],
  videoMimeType: null,
  videoBlob: null,
  screenshots: [],
  markers: [],
  networkLogs: [],
  requestsById: new Map(),
  message: null,
  networkLimitReached: false,
  networkCaptureEnabled: false,
  videoCaptureEnabled: false
};

function clearData() {
  store.lockedTab = null;
  store.startTimeMs = null;
  store.startTimeIso = null;
  store.pausedAtMs = null;
  store.pausedTotalMs = 0;
  store.cdpTimeOriginMs = null;
  store.videoChunks = [];
  store.videoMimeType = null;
  store.videoBlob = null;
  store.screenshots = [];
  store.markers = [];
  store.networkLogs = [];
  store.requestsById.clear();
  store.message = null;
  store.networkLimitReached = false;
  store.networkCaptureEnabled = false;
  store.videoCaptureEnabled = false;
}

function setLockedTab(tab) {
  if (!tab) {
    return;
  }
  store.lockedTab = {
    id: tab.id ?? null,
    title: tab.title || "",
    url: tab.url || ""
  };
}

function hasData() {
  return (
    store.videoChunks.length > 0 ||
    store.videoBlob != null ||
    store.screenshots.length > 0 ||
    store.markers.length > 0 ||
    store.networkLogs.length > 0 ||
    store.requestsById.size > 0
  );
}

function setMode(mode) {
  if (!VALID_MODES.includes(mode)) {
    throw new Error("Invalid mode selection.");
  }
  if (store.sessionState !== "idle" || hasData()) {
    throw new Error("Cannot change mode during an active session.");
  }
  store.mode = mode;
}

function startSession(tab) {
  clearData();
  store.sessionState = "recording";
  store.startTimeMs = Date.now();
  store.startTimeIso = new Date(store.startTimeMs).toISOString();
  setLockedTab(tab);
}

function ensureSessionStarted(tab) {
  if (store.sessionState === "idle") {
    store.sessionState = "recording";
    store.startTimeMs = Date.now();
    store.startTimeIso = new Date(store.startTimeMs).toISOString();
  }
  if (!store.lockedTab) {
    setLockedTab(tab);
  }
}

function pauseSession() {
  if (store.sessionState !== "recording") {
    throw new Error("Session is not recording.");
  }
  store.sessionState = "paused";
  store.pausedAtMs = Date.now();
}

function resumeSession() {
  if (store.sessionState !== "paused") {
    throw new Error("Session is not paused.");
  }
  if (store.pausedAtMs) {
    store.pausedTotalMs += Date.now() - store.pausedAtMs;
  }
  store.pausedAtMs = null;
  store.sessionState = "recording";
}

function stopSession() {
  store.sessionState = "idle";
  store.pausedAtMs = null;
  store.pausedTotalMs = 0;
}

function setMessage(type, text) {
  if (!text) {
    store.message = null;
    return;
  }
  store.message = {
    type,
    text,
    timestamp: new Date().toISOString()
  };
}

function clearMessage() {
  store.message = null;
}

function addVideoChunk(chunk) {
  store.videoChunks.push(chunk);
}

function setVideoMimeType(mimeType) {
  store.videoMimeType = mimeType;
}

function setVideoBlob(blob, mimeType) {
  store.videoBlob = blob;
  if (mimeType) {
    store.videoMimeType = mimeType;
  }
}

function consumeVideoChunks() {
  const chunks = [...store.videoChunks];
  store.videoChunks = [];
  return chunks;
}

function getVideoBlob() {
  return store.videoBlob;
}

function getVideoMimeType() {
  return store.videoMimeType;
}

function addScreenshot(entry) {
  store.screenshots.push(entry);
}

function addMarker(entry) {
  store.markers.push(entry);
}

function addNetworkLog(entry) {
  store.networkLogs.push(entry);
}

function getRequestMap() {
  return store.requestsById;
}

function setRequest(requestId, entry) {
  store.requestsById.set(requestId, entry);
}

function getRequest(requestId) {
  return store.requestsById.get(requestId);
}

function deleteRequest(requestId) {
  store.requestsById.delete(requestId);
}

function clearRequests() {
  store.requestsById.clear();
}

function setNetworkLimitReached() {
  store.networkLimitReached = true;
}

function setNetworkCaptureEnabled(enabled) {
  store.networkCaptureEnabled = enabled;
}

function setVideoCaptureEnabled(enabled) {
  store.videoCaptureEnabled = enabled;
}

function ensureCdpTimeOrigin(timestampSeconds) {
  if (store.cdpTimeOriginMs == null && Number.isFinite(timestampSeconds)) {
    store.cdpTimeOriginMs = Date.now() - timestampSeconds * 1000;
  }
}

function getElapsedMsForTimestamp(timestampSeconds) {
  if (!store.startTimeMs || !Number.isFinite(timestampSeconds)) {
    return 0;
  }
  ensureCdpTimeOrigin(timestampSeconds);
  const absoluteMs = store.cdpTimeOriginMs + timestampSeconds * 1000;
  return Math.max(0, absoluteMs - store.startTimeMs - store.pausedTotalMs);
}

function getElapsedMsNow() {
  if (!store.startTimeMs) {
    return 0;
  }
  const nowMs =
    store.sessionState === "paused" && store.pausedAtMs
      ? store.pausedAtMs
      : Date.now();
  return Math.max(0, nowMs - store.startTimeMs - store.pausedTotalMs);
}

function getDurationMs() {
  return getElapsedMsNow();
}

function getSnapshot() {
  return {
    sessionState: store.sessionState,
    mode: store.mode,
    lockedTab: store.lockedTab,
    startedAt: store.startTimeIso,
    durationMs: getDurationMs(),
    durationLabel: formatDurationMs(getDurationMs()),
    counts: {
      networkEvents: store.networkLogs.length,
      screenshots: store.screenshots.length,
      markers: store.markers.length
    },
    message: store.message,
    hasData: hasData(),
    networkLimitReached: store.networkLimitReached,
    capture: {
      video: store.videoCaptureEnabled,
      network: store.networkCaptureEnabled
    }
  };
}

function getSessionMetadata(endedAtIso) {
  return {
    mode: store.mode,
    startedAt: store.startTimeIso,
    endedAt: endedAtIso,
    durationMs: getDurationMs(),
    durationLabel: formatDurationMs(getDurationMs()),
    lockedTab: store.lockedTab,
    networkLimitReached: store.networkLimitReached,
    capture: {
      video: store.videoCaptureEnabled,
      network: store.networkCaptureEnabled
    }
  };
}

export const sessionStore = {
  store,
  hasData,
  setMode,
  startSession,
  ensureSessionStarted,
  pauseSession,
  resumeSession,
  stopSession,
  setMessage,
  clearMessage,
  addVideoChunk,
  setVideoMimeType,
  setVideoBlob,
  consumeVideoChunks,
  getVideoBlob,
  getVideoMimeType,
  addScreenshot,
  addMarker,
  addNetworkLog,
  getRequestMap,
  setRequest,
  getRequest,
  deleteRequest,
  clearRequests,
  setNetworkLimitReached,
  setNetworkCaptureEnabled,
  setVideoCaptureEnabled,
  ensureCdpTimeOrigin,
  getElapsedMsForTimestamp,
  getElapsedMsNow,
  getDurationMs,
  getSnapshot,
  getSessionMetadata,
  clearData
};
