import { TabRecorder } from "./recorder.js";
import { NetworkLogger } from "./networkLogger.js";
import { sessionStore } from "./sessionStore.js";
import {
  dataUrlToBlob,
  downloadBlob,
  createZipBlob,
  formatDurationMs,
  formatTimestampForFilename,
  isRestrictedUrl,
  padNumber
} from "./utils.js";

const recorder = new TabRecorder(sessionStore);
const networkLogger = new NetworkLogger(sessionStore);

function getModeCapabilities(mode) {
  return {
    video: mode === "video" || mode === "all",
    network: mode === "network" || mode === "all",
    screenshot: mode === "screenshot" || mode === "all"
  };
}

function getModeLabel(mode) {
  switch (mode) {
    case "screenshot":
      return "Screenshot Only";
    case "video":
      return "Video Only";
    case "network":
      return "Network Only";
    case "all":
      return "All-in-One";
    default:
      return mode;
  }
}

function getActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs?.[0];
      if (!tab || tab.id == null) {
        reject(new Error("No active tab found."));
        return;
      }
      resolve(tab);
    });
  });
}

function ensureTabAllowed(tab) {
  if (!tab?.url || isRestrictedUrl(tab.url)) {
    throw new Error(
      "This page cannot be captured. Switch to a regular website tab."
    );
  }
}

function ensureLockedTabMatches(tab) {
  const lockedTab = sessionStore.store.lockedTab;
  if (!lockedTab) {
    sessionStore.ensureSessionStarted(tab);
    return;
  }
  if (lockedTab.id !== tab.id) {
    throw new Error(
      "This session is locked to a different tab. Switch back to the locked tab."
    );
  }
}

async function safeDetachDebugger(reason) {
  try {
    await networkLogger.detach(reason);
  } catch (error) {
    console.warn("Debugger detach failed", error);
  }
}

async function safeStopRecorder() {
  try {
    if (recorder.state !== "idle") {
      await recorder.stop();
    } else {
      recorder.clear();
    }
  } catch (error) {
    console.warn("Recorder stop failed", error);
  }
}

async function startSession() {
  if (sessionStore.store.sessionState !== "idle") {
    throw new Error("A session is already active.");
  }
  if (sessionStore.store.mode === "screenshot") {
    throw new Error("Screenshot mode does not require Start.");
  }
  const tab = await getActiveTab();
  ensureTabAllowed(tab);

  sessionStore.clearMessage();
  sessionStore.startSession(tab);

  const { video, network } = getModeCapabilities(sessionStore.store.mode);
  let videoError = null;
  let networkError = null;

  if (video) {
    try {
      await recorder.start();
      sessionStore.setVideoCaptureEnabled(true);
    } catch (error) {
      videoError = error;
      sessionStore.setVideoCaptureEnabled(false);
    }
  }

  if (network) {
    try {
      await networkLogger.attach(tab.id);
      sessionStore.setNetworkCaptureEnabled(true);
    } catch (error) {
      networkError = error;
      sessionStore.setNetworkCaptureEnabled(false);
    }
  }

  if (sessionStore.store.mode === "video" && videoError) {
    await safeStopRecorder();
    await safeDetachDebugger("start-failed");
    sessionStore.stopSession();
    sessionStore.clearData();
    throw new Error(`Video capture failed: ${videoError.message}`);
  }

  if (sessionStore.store.mode === "network" && networkError) {
    await safeStopRecorder();
    await safeDetachDebugger("start-failed");
    sessionStore.stopSession();
    sessionStore.clearData();
    throw new Error(`Network capture failed: ${networkError.message}`);
  }

  if (sessionStore.store.mode === "all") {
    if (videoError && networkError) {
      await safeStopRecorder();
      await safeDetachDebugger("start-failed");
      sessionStore.stopSession();
      sessionStore.clearData();
      throw new Error("Failed to start video and network capture.");
    }
    if (videoError) {
      sessionStore.setMessage(
        "warning",
        "Video capture failed. Continuing with network only."
      );
    }
    if (networkError) {
      sessionStore.setMessage(
        "warning",
        "Network capture blocked. Continuing with video only."
      );
    }
  }

  return sessionStore.getSnapshot();
}

async function pauseSession() {
  if (sessionStore.store.sessionState !== "recording") {
    throw new Error("No active session to pause.");
  }
  if (
    sessionStore.store.mode === "screenshot" ||
    sessionStore.store.mode === "network"
  ) {
    throw new Error("Pause is not available in this mode.");
  }
  if (sessionStore.store.videoCaptureEnabled && recorder.state === "recording") {
    recorder.pause();
  }
  sessionStore.pauseSession();
  return sessionStore.getSnapshot();
}

async function resumeSession() {
  if (sessionStore.store.sessionState !== "paused") {
    throw new Error("Session is not paused.");
  }
  if (
    sessionStore.store.mode === "screenshot" ||
    sessionStore.store.mode === "network"
  ) {
    throw new Error("Resume is not available in this mode.");
  }
  if (sessionStore.store.videoCaptureEnabled && recorder.state === "paused") {
    recorder.resume();
  }
  sessionStore.resumeSession();
  return sessionStore.getSnapshot();
}

async function captureScreenshot() {
  const mode = sessionStore.store.mode;
  if (!["screenshot", "all", "video", "network"].includes(mode)) {
    throw new Error("Screenshot capture is disabled in this mode.");
  }
  if (
    mode !== "screenshot" &&
    !["recording", "paused"].includes(sessionStore.store.sessionState)
  ) {
    throw new Error("Start a session before capturing screenshots.");
  }
  const tab = await getActiveTab();
  ensureTabAllowed(tab);
  ensureLockedTabMatches(tab);

  const dataUrl = await new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(
      tab.windowId,
      { format: "png" },
      (image) => {
        if (chrome.runtime.lastError || !image) {
          reject(
            new Error(
              chrome.runtime.lastError?.message ||
                "Unable to capture screenshot."
            )
          );
          return;
        }
        resolve(image);
      }
    );
  });

  const nowIso = new Date().toISOString();
  const index = sessionStore.store.screenshots.length + 1;
  const shotStamp = formatTimestampForFilename(nowIso);
  const fileName = `qa-screenshot-${padNumber(index)}-${shotStamp}.png`;
  const blob = dataUrlToBlob(dataUrl);
  sessionStore.addScreenshot({
    timestampIso: nowIso,
    t_ms: sessionStore.getElapsedMsNow(),
    blob,
    fileName
  });
  return sessionStore.getSnapshot();
}

async function addMarker(note = "") {
  const mode = sessionStore.store.mode;
  if (sessionStore.store.sessionState === "idle") {
    if (mode !== "screenshot") {
      throw new Error("Start a session before adding markers.");
    }
    const tab = await getActiveTab();
    if (tab?.url && !isRestrictedUrl(tab.url)) {
      ensureLockedTabMatches(tab);
    } else if (!sessionStore.store.lockedTab) {
      sessionStore.ensureSessionStarted(tab);
    }
  }
  if (!["recording", "paused"].includes(sessionStore.store.sessionState)) {
    throw new Error("Markers can only be added while recording or paused.");
  }
  const nowIso = new Date().toISOString();
  sessionStore.addMarker({
    timestampIso: nowIso,
    t_ms: sessionStore.getElapsedMsNow(),
    note: String(note || "")
  });
  return sessionStore.getSnapshot();
}

function buildSignals(logs) {
  const failures = logs.filter((entry) => entry.status >= 400);
  const topFailures = failures
    .slice()
    .sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0))
    .slice(0, 10)
    .map((entry) => ({
      url: entry.url,
      method: entry.method,
      status: entry.status,
      durationMs: entry.durationMs ?? null
    }));

  return {
    topFailures
  };
}

function buildSummaryText(metadata, logs, signals) {
  const totalRequests = logs.length;
  const count4xx = logs.filter(
    (entry) => entry.status >= 400 && entry.status < 500
  ).length;
  const count5xx = logs.filter((entry) => entry.status >= 500).length;

  const sortedByDuration = logs
    .filter((entry) => Number.isFinite(entry.durationMs))
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 10);

  const truncatedBodies = logs.filter((entry) => entry.bodyTruncated).length;
  const skippedBodies = logs.filter((entry) => entry.bodySkipped).length;
  const bodyErrors = logs.filter((entry) => entry.bodyError).length;

  const lines = [
    "QA Evidence Recorder Summary",
    "============================",
    `Mode: ${getModeLabel(metadata.mode)}`,
    `Session start: ${metadata.startedAt || "N/A"}`,
    `Session end: ${metadata.endedAt || "N/A"}`,
    `Duration: ${metadata.durationLabel || "00:00"}`,
    "",
    `Locked tab: ${
      metadata.lockedTab?.title
        ? `${metadata.lockedTab.title} (${metadata.lockedTab.url || "N/A"})`
        : metadata.lockedTab?.id != null
        ? `Tab ${metadata.lockedTab.id}`
        : "Not set"
    }`,
    "",
    `Network requests captured: ${totalRequests}`,
    `4xx responses: ${count4xx}`,
    `5xx responses: ${count5xx}`,
    "",
    "Top 10 slowest requests:"
  ];

  if (sortedByDuration.length === 0) {
    lines.push("  (none)");
  } else {
    for (const entry of sortedByDuration) {
      lines.push(
        `  ${Math.round(entry.durationMs)} ms | ${entry.method} ${
          entry.status ?? "-"
        } | ${entry.url}`
      );
    }
  }

  lines.push("");
  lines.push(`Screenshots captured: ${sessionStore.store.screenshots.length}`);
  lines.push(`Markers captured: ${sessionStore.store.markers.length}`);
  lines.push("");
  lines.push("Top failures:");
  if (!signals?.topFailures?.length) {
    lines.push("  (none)");
  } else {
    for (const entry of signals.topFailures) {
      lines.push(
        `  ${entry.method} ${entry.status} | ${
          entry.durationMs != null ? Math.round(entry.durationMs) : "-"
        } ms | ${entry.url}`
      );
    }
  }
  lines.push("");
  lines.push("Notes:");
  lines.push(
    `  Response bodies truncated: ${truncatedBodies} (limit 200KB)`
  );
  lines.push(`  Response bodies skipped: ${skippedBodies}`);
  lines.push(`  Response body errors: ${bodyErrors}`);
  lines.push(
    `  Network request limit reached: ${
      metadata.networkLimitReached ? "Yes" : "No"
    }`
  );
  lines.push(
    `  Video capture enabled: ${metadata.capture.video ? "Yes" : "No"}`
  );
  lines.push(
    `  Network capture enabled: ${metadata.capture.network ? "Yes" : "No"}`
  );

  return lines.join("\n");
}

async function stopAndExport() {
  const hasData = sessionStore.hasData();
  const mode = sessionStore.store.mode;
  if (sessionStore.store.sessionState === "idle" && !hasData) {
    throw new Error("There is no session data to export.");
  }

  const endedAtIso = new Date().toISOString();
  const exportStamp = formatTimestampForFilename(endedAtIso);
  let exportError = null;

  try {
    await safeStopRecorder();
    await safeDetachDebugger("stopped");

    const metadata = sessionStore.getSessionMetadata(endedAtIso);
    const downloads = [];
    const signals = buildSignals(sessionStore.store.networkLogs);

    const rawScreenshots = sessionStore.store.screenshots.map(
      (shot, index) => ({
        index: index + 1,
        timestampIso: shot.timestampIso,
        t_ms: shot.t_ms,
        fileName: shot.fileName
      })
    );
    const rawMarkers = sessionStore.store.markers.map((marker) => ({
      timestampIso: marker.timestampIso,
      t_ms: marker.t_ms,
      note: marker.note
    }));

    const sessionLog = {
      session: {
        startedAt: metadata.startedAt,
        endedAt: metadata.endedAt,
        tabId: metadata.lockedTab?.id ?? null
      },
      raw: {
        network: sessionStore.store.networkLogs,
        markers: rawMarkers,
        screenshots: rawScreenshots
      },
      normalizedEvents: [],
      signals,
      pipeline: {
        version: "v1",
        limits: {
          maxRequests: 2000,
          maxBodyBytes: 200 * 1024
        }
      }
    };

    const videoBlob = sessionStore.getVideoBlob();
    if (videoBlob && ["video", "all"].includes(mode)) {
      downloads.push(
        downloadBlob(videoBlob, `qa-session-video-${exportStamp}.webm`)
      );
    }

    downloads.push(
      downloadBlob(
        new Blob([JSON.stringify(sessionLog, null, 2)], {
          type: "application/json"
        }),
        `qa-session-log-${exportStamp}.json`
      )
    );

    const summaryText = buildSummaryText(
      {
        ...metadata,
        durationLabel: formatDurationMs(sessionStore.getDurationMs())
      },
      sessionStore.store.networkLogs,
      signals
    );
    downloads.push(
      downloadBlob(
        new Blob([summaryText], { type: "text/plain" }),
        `qa-summary-${exportStamp}.txt`
      )
    );

    for (const [index, screenshot] of sessionStore.store.screenshots.entries()) {
      const fileName =
        screenshot.fileName ||
        `qa-screenshot-${padNumber(index + 1)}-${exportStamp}.png`;
      downloads.push(downloadBlob(screenshot.blob, fileName));
    }

    for (const download of downloads) {
      await download;
    }
  } catch (error) {
    exportError = error;
  } finally {
    sessionStore.stopSession();
    sessionStore.clearData();
  }

  if (exportError) {
    throw exportError;
  }
  return sessionStore.getSnapshot();
}

async function stopCapture() {
  if (sessionStore.store.sessionState === "idle") {
    throw new Error("No active capture to stop.");
  }
  await safeStopRecorder();
  await safeDetachDebugger("stopped");
  sessionStore.stopSession();
  return sessionStore.getSnapshot();
}

async function exportEvidenceZip() {
  if (sessionStore.store.sessionState !== "idle") {
    throw new Error("Stop capture before downloading.");
  }
  if (!sessionStore.hasData()) {
    throw new Error("There is no session data to export.");
  }

  const endedAtIso = new Date().toISOString();
  const exportStamp = formatTimestampForFilename(endedAtIso);
  const metadata = sessionStore.getSessionMetadata(endedAtIso);
  const signals = buildSignals(sessionStore.store.networkLogs);

  const rawScreenshots = sessionStore.store.screenshots.map((shot, index) => ({
    index: index + 1,
    timestampIso: shot.timestampIso,
    t_ms: shot.t_ms,
    fileName: shot.fileName
  }));
  const rawMarkers = sessionStore.store.markers.map((marker) => ({
    timestampIso: marker.timestampIso,
    t_ms: marker.t_ms,
    note: marker.note
  }));

  const sessionLog = {
    session: {
      startedAt: metadata.startedAt,
      endedAt: metadata.endedAt,
      tabId: metadata.lockedTab?.id ?? null
    },
    raw: {
      network: sessionStore.store.networkLogs,
      markers: rawMarkers,
      screenshots: rawScreenshots
    },
    normalizedEvents: [],
    signals,
    pipeline: {
      version: "v1",
      limits: {
        maxRequests: 2000,
        maxBodyBytes: 200 * 1024
      }
    }
  };

  const summaryText = buildSummaryText(
    {
      ...metadata,
      durationLabel: formatDurationMs(sessionStore.getDurationMs())
    },
    sessionStore.store.networkLogs,
    signals
  );

  const entries = [
    {
      path: `qa-session-log-${exportStamp}.json`,
      blob: new Blob([JSON.stringify(sessionLog, null, 2)], {
        type: "application/json"
      })
    },
    {
      path: `qa-summary-${exportStamp}.txt`,
      blob: new Blob([summaryText], { type: "text/plain" })
    }
  ];

  const videoBlob = sessionStore.getVideoBlob();
  if (videoBlob) {
    entries.push({
      path: `qa-session-video-${exportStamp}.webm`,
      blob: videoBlob
    });
  }

  for (const [index, screenshot] of sessionStore.store.screenshots.entries()) {
    const fileName =
      screenshot.fileName ||
      `qa-screenshot-${padNumber(index + 1)}-${exportStamp}.png`;
    entries.push({
      path: `screenshots/${fileName}`,
      blob: screenshot.blob
    });
  }

  const zipBlob = await createZipBlob(entries);
  await downloadBlob(zipBlob, `qa-evidence-${exportStamp}.zip`);

  sessionStore.clearData();
  return sessionStore.getSnapshot();
}

async function exportVideoOnly() {
  if (sessionStore.store.sessionState !== "idle") {
    throw new Error("Stop capture before downloading.");
  }
  const videoBlob = sessionStore.getVideoBlob();
  if (!videoBlob) {
    throw new Error("No video recording available.");
  }
  const exportStamp = formatTimestampForFilename(new Date().toISOString());
  await downloadBlob(videoBlob, `qa-session-video-${exportStamp}.webm`);
  return sessionStore.getSnapshot();
}

async function setMode(mode) {
  sessionStore.setMode(mode);
  return sessionStore.getSnapshot();
}

// Command router from popup actions.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const respond = (promise) => {
    promise
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
  };

  switch (message?.type) {
    case "GET_STATE":
      sendResponse({ ok: true, data: sessionStore.getSnapshot() });
      break;
    case "SET_MODE":
      respond(setMode(message.mode));
      break;
    case "START_SESSION":
      respond(startSession());
      break;
    case "PAUSE_SESSION":
      respond(pauseSession());
      break;
    case "RESUME_SESSION":
      respond(resumeSession());
      break;
    case "STOP_CAPTURE":
      respond(stopCapture());
      break;
    case "EXPORT_EVIDENCE_ZIP":
      respond(exportEvidenceZip());
      break;
    case "EXPORT_VIDEO_ONLY":
      respond(exportVideoOnly());
      break;
    case "STOP_AND_EXPORT":
      respond(stopAndExport());
      break;
    case "CAPTURE_SCREENSHOT":
      respond(captureScreenshot());
      break;
    case "ADD_MARKER":
      respond(addMarker(message.note));
      break;
    default:
      sendResponse({ ok: false, error: "Unknown command." });
      break;
  }

  return true;
});
