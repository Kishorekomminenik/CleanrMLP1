const RECORDER_SOURCE = "qa-evidence-recorder";
let pageScriptInjected = false;

function getPageScriptContent() {
  return `(function () {
  if (window.__qaEvidenceRecorder) {
    return;
  }

  const state = {
    active: false,
    originalConsole: null,
    errorHandler: null,
    rejectionHandler: null
  };

  function safeStringify(value) {
    if (value instanceof Error) {
      return value.name + ": " + value.message + "\\n" + (value.stack || "");
    }
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (value === null || value === undefined) {
      return String(value);
    }
    try {
      const cache = [];
      const result = JSON.stringify(value, function (key, val) {
        if (typeof val === "object" && val !== null) {
          if (cache.indexOf(val) !== -1) {
            return "[Circular]";
          }
          cache.push(val);
        }
        return val;
      });
      return result;
    } catch (error) {
      return String(value);
    }
  }

  function formatArgs(args) {
    const output = [];
    for (let i = 0; i < args.length; i += 1) {
      output.push(safeStringify(args[i]));
    }
    return output;
  }

  function postLog(payload) {
    window.postMessage(
      {
        source: "${RECORDER_SOURCE}",
        type: "LOG",
        payload: payload
      },
      "*"
    );
  }

  function startCapture() {
    if (state.active) {
      return;
    }
    state.active = true;
    state.originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error
    };

    console.log = function () {
      postLog({
        level: "log",
        message: formatArgs(arguments),
        timestamp: new Date().toISOString(),
        url: window.location.href
      });
      state.originalConsole.log.apply(console, arguments);
    };

    console.warn = function () {
      postLog({
        level: "warn",
        message: formatArgs(arguments),
        timestamp: new Date().toISOString(),
        url: window.location.href
      });
      state.originalConsole.warn.apply(console, arguments);
    };

    console.error = function () {
      postLog({
        level: "error",
        message: formatArgs(arguments),
        timestamp: new Date().toISOString(),
        url: window.location.href
      });
      state.originalConsole.error.apply(console, arguments);
    };

    state.errorHandler = function (event) {
      postLog({
        level: "error",
        kind: "window.onerror",
        message: [
          safeStringify(event.message),
          "source: " + safeStringify(event.filename),
          "line: " + safeStringify(event.lineno),
          "column: " + safeStringify(event.colno)
        ],
        timestamp: new Date().toISOString(),
        url: window.location.href
      });
    };
    window.addEventListener("error", state.errorHandler);

    state.rejectionHandler = function (event) {
      postLog({
        level: "error",
        kind: "unhandledrejection",
        message: [safeStringify(event.reason)],
        timestamp: new Date().toISOString(),
        url: window.location.href
      });
    };
    window.addEventListener("unhandledrejection", state.rejectionHandler);
  }

  function stopCapture() {
    if (!state.active) {
      return;
    }
    state.active = false;
    if (state.originalConsole) {
      console.log = state.originalConsole.log;
      console.warn = state.originalConsole.warn;
      console.error = state.originalConsole.error;
    }
    if (state.errorHandler) {
      window.removeEventListener("error", state.errorHandler);
    }
    if (state.rejectionHandler) {
      window.removeEventListener("unhandledrejection", state.rejectionHandler);
    }
  }

  window.addEventListener("message", function (event) {
    if (event.source !== window) {
      return;
    }
    const data = event.data;
    if (!data || data.source !== "${RECORDER_SOURCE}") {
      return;
    }
    if (data.type === "START") {
      startCapture();
    }
    if (data.type === "STOP") {
      stopCapture();
    }
  });

  window.__qaEvidenceRecorder = {
    start: startCapture,
    stop: stopCapture
  };

  window.postMessage({ source: "${RECORDER_SOURCE}", type: "READY" }, "*");
})();`;
}

function injectPageScript() {
  if (pageScriptInjected) {
    return;
  }
  const script = document.createElement("script");
  script.textContent = getPageScriptContent();
  (document.head || document.documentElement).appendChild(script);
  script.remove();
  pageScriptInjected = true;
}

function sendToPage(type) {
  window.postMessage({ source: RECORDER_SOURCE, type }, "*");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "START_CONSOLE_CAPTURE") {
    injectPageScript();
    sendToPage("START");
    sendResponse({ ok: true });
    return;
  }
  if (message.type === "STOP_CONSOLE_CAPTURE") {
    sendToPage("STOP");
    sendResponse({ ok: true });
  }
});

window.addEventListener("message", (event) => {
  if (event.source !== window) {
    return;
  }
  const data = event.data;
  if (!data || data.source !== RECORDER_SOURCE || data.type !== "LOG") {
    return;
  }
  chrome.runtime.sendMessage({ type: "CONSOLE_LOG", payload: data.payload });
});
