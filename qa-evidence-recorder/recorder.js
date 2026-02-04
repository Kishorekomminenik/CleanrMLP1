// Prefer a codec supported by the current browser.
const DEFAULT_MIME_TYPES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm"
];

function pickSupportedMimeType() {
  for (const mimeType of DEFAULT_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }
  return "";
}

export class TabRecorder {
  constructor(store) {
    this.store = store;
    this.mediaRecorder = null;
    this.stream = null;
    this.state = "idle";
  }

  async start() {
    if (this.state !== "idle") {
      throw new Error("Recorder is already running.");
    }
    const stream = await new Promise((resolve, reject) => {
      chrome.tabCapture.capture({ audio: true, video: true }, (captured) => {
        if (chrome.runtime.lastError || !captured) {
          reject(
            new Error(
              chrome.runtime.lastError?.message || "Unable to capture tab."
            )
          );
          return;
        }
        resolve(captured);
      });
    });
    this.stream = stream;
    const mimeType = pickSupportedMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    // Collect chunks in memory for export.
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.store.addVideoChunk(event.data);
      }
    };
    recorder.onerror = (event) => {
      console.error("MediaRecorder error", event.error);
    };
    recorder.start(1000);
    this.mediaRecorder = recorder;
    this.state = "recording";
    this.store.setVideoMimeType(recorder.mimeType || "video/webm");
  }

  pause() {
    if (this.state !== "recording" || !this.mediaRecorder) {
      throw new Error("Recorder is not active.");
    }
    this.mediaRecorder.pause();
    this.state = "paused";
  }

  resume() {
    if (this.state !== "paused" || !this.mediaRecorder) {
      throw new Error("Recorder is not paused.");
    }
    this.mediaRecorder.resume();
    this.state = "recording";
  }

  async stop() {
    if (this.state === "idle") {
      throw new Error("Recorder is not active.");
    }
    const recorder = this.mediaRecorder;
    const stream = this.stream;
    this.state = "idle";
    this.mediaRecorder = null;
    this.stream = null;

    return new Promise((resolve) => {
      const finalize = () => {
        const mimeType = recorder?.mimeType || "video/webm";
        const chunks = this.store.consumeVideoChunks();
        const blob = new Blob(chunks, { type: mimeType });
        this.store.setVideoBlob(blob, mimeType);
        if (stream) {
          for (const track of stream.getTracks()) {
            track.stop();
          }
        }
        resolve(blob);
      };

      if (!recorder || recorder.state === "inactive") {
        finalize();
        return;
      }

      recorder.onstop = () => finalize();
      recorder.stop();
    });
  }

  clear() {
    this.mediaRecorder = null;
    this.stream = null;
    this.state = "idle";
  }
}
