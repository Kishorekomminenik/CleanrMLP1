let mediaRecorder = null;
let recordedChunks = [];
let currentStream = null;
let recordingState = "idle";
let recordingMimeType = "video/webm";

chrome.runtime.sendMessage({ type: "OFFSCREEN_READY" });

function stopStreamTracks() {
  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop());
    currentStream = null;
  }
}

function resetRecording() {
  recordedChunks = [];
  recordingMimeType = "video/webm";
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function finalizeRecording() {
  const mimeType = recordingMimeType || "video/webm";
  const blob = new Blob(recordedChunks, { type: mimeType });
  recordedChunks = [];
  const dataUrl = await blobToDataUrl(blob);
  chrome.runtime.sendMessage({
    type: "RECORDING_COMPLETE",
    dataUrl,
    mimeType: blob.type,
    size: blob.size,
  });
  recordingState = "stopped";
  mediaRecorder = null;
  stopStreamTracks();
}

async function startRecording(tabId, streamId) {
  if (!tabId) {
    throw new Error("No active tab to record.");
  }
  if (recordingState === "recording" || recordingState === "paused") {
    throw new Error("Recording already in progress.");
  }
  if (!chrome?.tabCapture?.capture) {
    throw new Error("Recording not supported in this browser.");
  }

  try {
    resetRecording();
    currentStream = await new Promise((resolve, reject) => {
      try {
        chrome.tabCapture.capture(
          {
            audio: false,
            video: true,
          },
          (stream) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            if (!stream) {
              reject(new Error("No stream returned"));
              return;
            }
            resolve(stream);
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    const lower = message.toLowerCase();
    if (
      lower.includes("policy") ||
      lower.includes("enterprise") ||
      lower.includes("managed") ||
      lower.includes("administrator") ||
      lower.includes("admin") ||
      lower.includes("not allowed") ||
      lower.includes("not permitted") ||
      lower.includes("blocked") ||
      lower.includes("disabled")
    ) {
      throw new Error("Recording blocked by browser policy.");
    }
    throw new Error("Recording not supported in this browser.");
  }

  const options = {};
  if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
    options.mimeType = "video/webm;codecs=vp9";
  } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) {
    options.mimeType = "video/webm;codecs=vp8";
  }

  mediaRecorder = new MediaRecorder(currentStream, options);
  recordingMimeType = mediaRecorder.mimeType || options.mimeType || "video/webm";

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.onerror = (event) => {
    chrome.runtime.sendMessage({
      type: "RECORDING_ERROR",
      error: event.error ? event.error.message : "Recording failed.",
    });
  };

  mediaRecorder.onstop = () => {
    finalizeRecording().catch((error) => {
      chrome.runtime.sendMessage({
        type: "RECORDING_ERROR",
        error: error.message || "Failed to finalize recording.",
      });
    });
  };

  mediaRecorder.start(1000);
  recordingState = "recording";
}

function pauseRecording() {
  if (!mediaRecorder || recordingState !== "recording") {
    throw new Error("Recording is not active.");
  }
  mediaRecorder.pause();
  recordingState = "paused";
}

function resumeRecording() {
  if (!mediaRecorder || recordingState !== "paused") {
    throw new Error("Recording is not paused.");
  }
  mediaRecorder.resume();
  recordingState = "recording";
}

function stopRecording() {
  if (!mediaRecorder || recordingState === "idle") {
    throw new Error("No recording to stop.");
  }
  mediaRecorder.stop();
  recordingState = "stopping";
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "OFFSCREEN_PING") {
    sendResponse({ ok: true, ready: true });
    return;
  }
  if (message.type === "RECORDING_START") {
    startRecording(message.tabId)
      .then(() => sendResponse({ ok: true }))
      .catch((error) =>
        sendResponse({ ok: false, error: error.message || "Start failed." })
      );
    return true;
  }
  if (message.type === "RECORDING_PAUSE") {
    try {
      pauseRecording();
      sendResponse({ ok: true });
    } catch (error) {
      sendResponse({ ok: false, error: error.message });
    }
    return;
  }
  if (message.type === "RECORDING_RESUME") {
    try {
      resumeRecording();
      sendResponse({ ok: true });
    } catch (error) {
      sendResponse({ ok: false, error: error.message });
    }
    return;
  }
  if (message.type === "RECORDING_STOP") {
    try {
      stopRecording();
      sendResponse({ ok: true });
    } catch (error) {
      sendResponse({ ok: false, error: error.message });
    }
  }
});
