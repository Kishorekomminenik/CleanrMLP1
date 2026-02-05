(function () {
  const HEADER_KEYS = ["authorization", "cookie", "set-cookie"];
  const BODY_KEYS = ["token", "password", "secret", "apikey", "authorization"];

  function isPlainObject(value) {
    return (
      value !== null &&
      typeof value === "object" &&
      Object.prototype.toString.call(value) === "[object Object]"
    );
  }

  function redactHeaders(headers) {
    if (!headers) {
      return headers;
    }
    const redacted = {};
    Object.keys(headers).forEach((key) => {
      if (HEADER_KEYS.includes(key.toLowerCase())) {
        redacted[key] = "[REDACTED]";
      } else {
        redacted[key] = headers[key];
      }
    });
    return redacted;
  }

  function redactObject(value) {
    if (Array.isArray(value)) {
      return value.map((item) => redactObject(item));
    }
    if (!isPlainObject(value)) {
      return value;
    }
    const redacted = {};
    Object.keys(value).forEach((key) => {
      if (BODY_KEYS.includes(key.toLowerCase())) {
        redacted[key] = "[REDACTED]";
      } else if (isPlainObject(value[key]) || Array.isArray(value[key])) {
        redacted[key] = redactObject(value[key]);
      } else {
        redacted[key] = value[key];
      }
    });
    return redacted;
  }

  function redactJsonString(text) {
    if (typeof text !== "string") {
      return text;
    }
    const trimmed = text.trim();
    if (!trimmed || (trimmed[0] !== "{" && trimmed[0] !== "[")) {
      return text;
    }
    try {
      const parsed = JSON.parse(text);
      const redacted = redactObject(parsed);
      return JSON.stringify(redacted);
    } catch (error) {
      return text;
    }
  }

  function redactConsoleArgs(args) {
    if (!Array.isArray(args)) {
      return args;
    }
    return args.map((arg) => {
      if (isPlainObject(arg) || Array.isArray(arg)) {
        return redactObject(arg);
      }
      if (typeof arg === "string") {
        return redactJsonString(arg);
      }
      return arg;
    });
  }

  function redactNetworkEntry(entry) {
    return {
      ...entry,
      request_headers: redactHeaders(entry.request_headers),
      response_headers: redactHeaders(entry.response_headers),
      request_post_data: redactJsonString(entry.request_post_data),
      response_body: redactJsonString(entry.response_body),
    };
  }

  function redactConsoleEntry(entry) {
    return {
      ...entry,
      args: redactConsoleArgs(entry.args),
    };
  }

  const root =
    typeof window !== "undefined"
      ? window
      : typeof self !== "undefined"
        ? self
        : globalThis;

  root.RedactUtils = {
    redactHeaders,
    redactJsonString,
    redactNetworkEntry,
    redactConsoleEntry,
    redactConsoleArgs,
  };
})();
