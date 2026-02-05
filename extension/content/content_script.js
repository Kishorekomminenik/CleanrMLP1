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

  const MAX_ARG_CHARS = 2000;
  const TRUNC_SUFFIX = "...[truncated]";

  function truncateString(value) {
    if (value.length <= MAX_ARG_CHARS) {
      return value;
    }
    return value.slice(0, MAX_ARG_CHARS) + TRUNC_SUFFIX;
  }

  function toSerializable(value, depth, seen) {
    if (value === null || value === undefined) {
      return value;
    }
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack || null
      };
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return value;
    }
    if (typeof value === "function") {
      return "[Function]";
    }
    if (typeof value !== "object") {
      return String(value);
    }
    if (seen.has(value)) {
      return "[Circular]";
    }
    if (depth <= 0) {
      return "[MaxDepth]";
    }
    seen.add(value);
    if (Array.isArray(value)) {
      const arr = value.map((item) => toSerializable(item, depth - 1, seen));
      seen.delete(value);
      return arr;
    }
    const result = {};
    Object.keys(value).forEach((key) => {
      result[key] = toSerializable(value[key], depth - 1, seen);
    });
    seen.delete(value);
    return result;
  }

  function safeStringify(value) {
    if (typeof value === "string") {
      return truncateString(value);
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return truncateString(String(value));
    }
    if (value === null || value === undefined) {
      return truncateString(String(value));
    }
    try {
      const serializable = toSerializable(value, 4, new WeakSet());
      const result = JSON.stringify(serializable);
      return truncateString(result);
    } catch (error) {
      return truncateString(String(value));
    }
  }

  function extractStack(args) {
    for (let i = 0; i < args.length; i += 1) {
      if (args[i] instanceof Error && args[i].stack) {
        return String(args[i].stack);
      }
    }
    return null;
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
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug
    };

    console.log = function () {
      const args = formatArgs(arguments);
      postLog({
        level: "log",
        message: args.join(" "),
        args: args,
        timestamp: new Date().toISOString(),
        source: "console",
        url: window.location.href,
        line: null,
        column: null,
        stack: extractStack(arguments)
      });
      state.originalConsole.log.apply(console, arguments);
    };

    console.info = function () {
      const args = formatArgs(arguments);
      postLog({
        level: "info",
        message: args.join(" "),
        args: args,
        timestamp: new Date().toISOString(),
        source: "console",
        url: window.location.href,
        line: null,
        column: null,
        stack: extractStack(arguments)
      });
      state.originalConsole.info.apply(console, arguments);
    };

    console.warn = function () {
      const args = formatArgs(arguments);
      postLog({
        level: "warn",
        message: args.join(" "),
        args: args,
        timestamp: new Date().toISOString(),
        source: "console",
        url: window.location.href,
        line: null,
        column: null,
        stack: extractStack(arguments)
      });
      state.originalConsole.warn.apply(console, arguments);
    };

    console.error = function () {
      const args = formatArgs(arguments);
      postLog({
        level: "error",
        message: args.join(" "),
        args: args,
        timestamp: new Date().toISOString(),
        source: "console",
        url: window.location.href,
        line: null,
        column: null,
        stack: extractStack(arguments)
      });
      state.originalConsole.error.apply(console, arguments);
    };

    console.debug = function () {
      const args = formatArgs(arguments);
      postLog({
        level: "debug",
        message: args.join(" "),
        args: args,
        timestamp: new Date().toISOString(),
        source: "console",
        url: window.location.href,
        line: null,
        column: null,
        stack: extractStack(arguments)
      });
      state.originalConsole.debug.apply(console, arguments);
    };

    state.errorHandler = function (event) {
      postLog({
        level: "error",
        message: safeStringify(event.message),
        args: [safeStringify(event.message)],
        timestamp: new Date().toISOString(),
        source: "window.onerror",
        url: event.filename || window.location.href,
        line: typeof event.lineno === "number" ? event.lineno : null,
        column: typeof event.colno === "number" ? event.colno : null,
        stack: event.error && event.error.stack ? String(event.error.stack) : null
      });
    };
    window.addEventListener("error", state.errorHandler);

    state.rejectionHandler = function (event) {
      const reasonString = safeStringify(event.reason);
      const reasonStack =
        event.reason && event.reason.stack ? String(event.reason.stack) : null;
      postLog({
        level: "error",
        message: reasonString,
        args: [reasonString],
        timestamp: new Date().toISOString(),
        source: "unhandledrejection",
        url: window.location.href,
        line: null,
        column: null,
        stack: reasonStack
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
      console.info = state.originalConsole.info;
      console.warn = state.originalConsole.warn;
      console.error = state.originalConsole.error;
      console.debug = state.originalConsole.debug;
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
