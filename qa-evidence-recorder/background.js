import { TabRecorder } from "./recorder.js";
import { NetworkLogger } from "./networkLogger.js";
import { dataUrlToBlob, downloadBlob, padNumber } from "./utils.js";

const recorder = new TabRecorder();
const networkLogger = new NetworkLogger();

const session = {
  status: "idle",
  startedAt: null,
  tabId: null,
  screenshots: [],
  markers: []
};

function getStatusLabel(status) {
  if (status === "recording") {
    return "Recording";
  }
  if (status === "paused") {
    return "Paused";
  }
  return "Idle";
}

function getStatusPayload() {
  return {
    status: session.status,
    statusLabel: getStatusLabel(session.status),
    counts: {
      screenshots: session.screenshots.length,
      networkEvents:
        networkLogger.getLogCount() + networkLogger.getPendingCount(),
      markers: session.markers.length
    }
  };
}

function resetSessionData() {
  session.status = "idle";
  session.startedAt = null;
  session.tabId = null;
  session.screenshots = [];
  session.markers = [];
  networkLogger.clear();
  recorder.clear();
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

async function startSession() {
  if (session.status !== "idle") {
    throw new Error("A session is already active.");
  }
  resetSessionData();
  const tab = await getActiveTab();
  session.tabId = tab.id;
  session.startedAt = new Date().toISOString();
  try {
    await networkLogger.attach(tab.id);
    await recorder.start(tab.id);
    session.status = "recording";
    return getStatusPayload();
  } catch (error) {
    await stopSessionCleanup();
    throw error;
  }
}

async function pauseSession() {
  if (session.status !== "recording") {
    throw new Error("No active recording to pause.");
  }
  recorder.pause();
  session.status = "paused";
  return getStatusPayload();
}

async function resumeSession() {
  if (session.status !== "paused") {
    throw new Error("Recording is not paused.");
  }
  recorder.resume();
  session.status = "recording";
  return getStatusPayload();
}

async function captureScreenshot() {
  if (session.status === "idle") {
    throw new Error("Start a session before capturing screenshots.");
  }
  const tab = await getActiveTab();
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

  const blob = dataUrlToBlob(dataUrl);
  session.screenshots.push({
    timestamp: new Date().toISOString(),
    blob
  });
  return getStatusPayload();
}

async function addMarker(note = "") {
  if (session.status === "idle") {
    throw new Error("Start a session before adding markers.");
  }
  session.markers.push({
    timestamp: new Date().toISOString(),
    note: String(note || "").trim()
  });
  return getStatusPayload();
}

async function stopSessionCleanup() {
  try {
    await networkLogger.detach();
  } catch (error) {
    console.warn("Debugger detach failed", error);
  }
  try {
    if (recorder.state !== "idle") {
      await recorder.stop();
    } else {
      recorder.clear();
    }
  } catch (error) {
    console.warn("Recorder cleanup failed", error);
  }
}

async function stopAndExport() {
  if (session.status === "idle") {
    throw new Error("No active session to stop.");
  }
  const endedAt = new Date().toISOString();
  let videoBlob;
  try {
    videoBlob = await recorder.stop();
  } finally {
    await networkLogger.detach();
  }

  // Build JSON log summary alongside asset file names.
  const screenshotMeta = session.screenshots.map((shot, index) => ({
    index: index + 1,
    timestamp: shot.timestamp,
    fileName: `qa-screenshot-${padNumber(index + 1)}.png`
  }));

  const logPayload = {
    session: {
      startedAt: session.startedAt,
      endedAt,
      tabId: session.tabId
    },
    markers: session.markers,
    screenshots: screenshotMeta,
    network: networkLogger.getLogs()
  };

  await downloadBlob(videoBlob, "qa-session-video.webm");
  await downloadBlob(
    new Blob([JSON.stringify(logPayload, null, 2)], {
      type: "application/json"
    }),
    "qa-session-log.json"
  );

  // Download each captured screenshot.
  for (const [index, screenshot] of session.screenshots.entries()) {
    const fileName = `qa-screenshot-${padNumber(index + 1)}.png`;
    await downloadBlob(screenshot.blob, fileName);
  }

  resetSessionData();
  return getStatusPayload();
}

// Command router from popup actions.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const respond = (promise) => {
    promise
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
  };

  switch (message?.type) {
    case "GET_STATUS":
      sendResponse({ ok: true, data: getStatusPayload() });
      break;
    case "START_SESSION":
      respond(startSession());
      break;
    case "PAUSE_RECORDING":
      respond(pauseSession());
      break;
    case "RESUME_RECORDING":
      respond(resumeSession());
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
