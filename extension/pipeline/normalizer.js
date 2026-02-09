(() => {
  const TRUNCATION_SUFFIX = "...[truncated]";

  function safeDateMs(value) {
    if (!value) {
      return null;
    }
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? null : ms;
  }

  function toIso(ms, fallbackIso) {
    if (typeof ms === "number" && !Number.isNaN(ms)) {
      return new Date(ms).toISOString();
    }
    return fallbackIso || new Date().toISOString();
  }

  function computeTms(tsIso, sessionStartMs) {
    const ms = safeDateMs(tsIso);
    if (!ms || !sessionStartMs) {
      return 0;
    }
    return Math.max(0, ms - sessionStartMs);
  }

  function truncateString(value, maxBytes) {
    if (typeof value !== "string" || !maxBytes) {
      return { text: value || null, truncated: false };
    }
    const encoder = new TextEncoder();
    const encoded = encoder.encode(value);
    if (encoded.length <= maxBytes) {
      return { text: value, truncated: false };
    }
    const suffixBytes = encoder.encode(TRUNCATION_SUFFIX).length;
    const sliceLength = Math.max(0, maxBytes - suffixBytes);
    const truncated = new TextDecoder().decode(encoded.slice(0, sliceLength));
    return { text: `${truncated}${TRUNCATION_SUFFIX}`, truncated: true };
  }

  function parseUrlParts(url) {
    if (!url || typeof url !== "string") {
      return { host: null, path: null };
    }
    try {
      const parsed = new URL(url);
      return { host: parsed.host, path: parsed.pathname || "/" };
    } catch (error) {
      return { host: null, path: null };
    }
  }

  function normalizeNetworkEntries(entries, sessionMeta, config) {
    const events = [];
    const slowThresholdMs = config.slowThresholdMs || 0;
    const maxBodyBytes = config.maxBodyBytes || 0;
    const sessionStartMs = sessionMeta.startedAtMs;
    entries.forEach((entry) => {
      const method = entry.method || "REQUEST";
      const url = entry.url || "";
      const parts = parseUrlParts(url);
      const requestTsIso = entry.timestamp || sessionMeta.startedAtIso;
      const requestTsMs = safeDateMs(requestTsIso) || sessionStartMs;
      const requestBody = truncateString(entry.request_post_data, maxBodyBytes);
      events.push({
        t_ms: computeTms(requestTsIso, sessionStartMs),
        ts_iso: requestTsIso,
        source: "network",
        kind: "request",
        level: "info",
        msg: `${method} ${parts.path || url}`,
        corr: {
          tabId: sessionMeta.tabId,
          sessionId: sessionMeta.sessionId,
          actionId: null,
          requestId: entry.request_id || null,
        },
        data: {
          method,
          url,
          urlPath: parts.path || url,
          urlHost: parts.host,
          headers: entry.request_headers || {},
          bodyPreview: requestBody.text,
          bodyTruncated: requestBody.truncated,
        },
      });

      const hasResponse =
        typeof entry.response_status === "number" ||
        entry.response_status_text ||
        entry.response_headers ||
        entry.response_body ||
        entry.response_body_skipped ||
        entry.error_text ||
        entry.timing;
      if (!hasResponse) {
        return;
      }
      const timing = entry.timing || null;
      let durationMs = null;
      if (timing && typeof timing.receiveHeadersEnd === "number") {
        durationMs = Math.max(0, Math.round(timing.receiveHeadersEnd));
      }
      const responseTsMs =
        typeof durationMs === "number" && requestTsMs
          ? requestTsMs + durationMs
          : requestTsMs;
      const responseTsIso = toIso(responseTsMs, requestTsIso);
      const responseBody = truncateString(entry.response_body, maxBodyBytes);
      const status =
        typeof entry.response_status === "number" ? entry.response_status : null;
      let level = "info";
      if (typeof status === "number" && status >= 400) {
        level = "error";
      } else if (
        typeof durationMs === "number" &&
        slowThresholdMs &&
        durationMs >= slowThresholdMs
      ) {
        level = "warn";
      }
      if (entry.error_text) {
        level = "error";
      }
      const statusText =
        typeof status === "number" ? String(status) : "response";
      const msg = `${method} ${parts.path || url} -> ${statusText}`;
      events.push({
        t_ms: computeTms(responseTsIso, sessionStartMs),
        ts_iso: responseTsIso,
        source: "network",
        kind: "response",
        level,
        msg,
        corr: {
          tabId: sessionMeta.tabId,
          sessionId: sessionMeta.sessionId,
          actionId: null,
          requestId: entry.request_id || null,
        },
        data: {
          status,
          statusText: entry.response_status_text || null,
          mimeType: entry.response_mime_type || null,
          headers: entry.response_headers || {},
          durationMs: typeof durationMs === "number" ? durationMs : null,
          fromCache:
            typeof entry.from_disk_cache === "boolean"
              ? entry.from_disk_cache
              : null,
          fromServiceWorker:
            typeof entry.from_service_worker === "boolean"
              ? entry.from_service_worker
              : null,
          bodyPreview: responseBody.text,
          bodyTruncated: responseBody.truncated,
          bodySkipped: Boolean(entry.response_body_skipped),
          bodyError: entry.error_text || null,
        },
      });
    });
    return events;
  }

  function trimStack(stack) {
    if (!stack || typeof stack !== "string") {
      return null;
    }
    const lines = stack.split("\n").slice(0, 10);
    const joined = lines.join("\n");
    return joined.length > 2000 ? `${joined.slice(0, 2000)}...` : joined;
  }

  function normalizeConsoleEntries(entries, sessionMeta) {
    const events = [];
    entries.forEach((entry) => {
      const tsIso = entry.timestamp || sessionMeta.startedAtIso;
      const level = entry.level || "log";
      let kind = "info";
      if (level === "error") {
        kind = "error";
      } else if (level === "warn") {
        kind = "warning";
      }
      events.push({
        t_ms: computeTms(tsIso, sessionMeta.startedAtMs),
        ts_iso: tsIso,
        source: "console",
        kind,
        level,
        msg: entry.message || "",
        corr: {
          tabId: sessionMeta.tabId,
          sessionId: sessionMeta.sessionId,
          actionId: null,
          requestId: null,
        },
        data: {
          errorType: entry.source || null,
          message: entry.message || "",
          stack: trimStack(entry.stack),
          url: entry.url || null,
          line: typeof entry.line === "number" ? entry.line : null,
          col: typeof entry.column === "number" ? entry.column : null,
        },
      });
    });
    return events;
  }

  function normalizeMarkerEntries(entries, sessionMeta) {
    const events = [];
    entries.forEach((entry) => {
      const tsIso = entry.timestamp || entry.ts_iso || sessionMeta.startedAtIso;
      const note =
        typeof entry.note === "string"
          ? entry.note
          : entry.message || "Marker";
      events.push({
        t_ms: computeTms(tsIso, sessionMeta.startedAtMs),
        ts_iso: tsIso,
        source: "ui",
        kind: "marker",
        level: "info",
        msg: note,
        corr: {
          tabId: sessionMeta.tabId,
          sessionId: sessionMeta.sessionId,
          actionId: null,
          requestId: null,
        },
        data: { note },
      });
    });
    return events;
  }

  function normalizeActionEntries(entries, sessionMeta) {
    const events = [];
    entries.forEach((entry) => {
      const tsIso = entry.timestamp || entry.ts_iso || sessionMeta.startedAtIso;
      const label = entry.label || entry.actionType || "Action";
      events.push({
        t_ms: computeTms(tsIso, sessionMeta.startedAtMs),
        ts_iso: tsIso,
        source: "ui",
        kind: "action",
        level: "info",
        msg: label,
        corr: {
          tabId: sessionMeta.tabId,
          sessionId: sessionMeta.sessionId,
          actionId: null,
          requestId: null,
        },
        data: {
          actionType: entry.actionType || "click",
          label,
          selector: entry.selector || null,
          tagName: entry.tagName || null,
          value:
            typeof entry.value === "string" || typeof entry.value === "number"
              ? entry.value
              : null,
        },
      });
    });
    return events;
  }

  function normalizeScreenshotEntries(entries, sessionMeta) {
    const events = [];
    entries.forEach((entry) => {
      const tsIso = entry.timestamp || entry.ts_iso || sessionMeta.startedAtIso;
      const fileName = entry.fileName || entry.file_name || "screenshot.png";
      events.push({
        t_ms: computeTms(tsIso, sessionMeta.startedAtMs),
        ts_iso: tsIso,
        source: "system",
        kind: "screenshot",
        level: "info",
        msg: fileName,
        corr: {
          tabId: sessionMeta.tabId,
          sessionId: sessionMeta.sessionId,
          actionId: null,
          requestId: null,
        },
        data: { fileName },
      });
    });
    return events;
  }

  function normalizeSession(input, config) {
    const safeConfig = config || {};
    const session = input.session || {};
    const startedAtIso =
      session.startedAt ||
      session.created_at ||
      session.createdAt ||
      session.started_at ||
      new Date().toISOString();
    const sessionStartMs = safeDateMs(startedAtIso) || Date.now();
    const sessionMeta = {
      startedAtIso,
      startedAtMs: sessionStartMs,
      sessionId: session.sessionId || session.session_id || null,
      tabId:
        typeof session.tabId === "number"
          ? session.tabId
          : session.active_tab && typeof session.active_tab.tab_id === "number"
            ? session.active_tab.tab_id
            : null,
    };
    const rawNetwork = Array.isArray(input.rawNetwork) ? input.rawNetwork : [];
    const consoleEvents = Array.isArray(input.consoleEvents)
      ? input.consoleEvents
      : [];
    const markers = Array.isArray(input.markers) ? input.markers : [];
    const screenshots = Array.isArray(input.screenshots) ? input.screenshots : [];
    const uiActions = Array.isArray(input.uiActions) ? input.uiActions : [];
    const maxRequestsStored = safeConfig.maxRequestsStored || rawNetwork.length;
    const networkSlice =
      rawNetwork.length > maxRequestsStored
        ? rawNetwork.slice(-maxRequestsStored)
        : rawNetwork;

    let events = [];
    events = events.concat(
      normalizeNetworkEntries(networkSlice, sessionMeta, safeConfig)
    );
    events = events.concat(normalizeConsoleEntries(consoleEvents, sessionMeta));
    events = events.concat(normalizeMarkerEntries(markers, sessionMeta));
    events = events.concat(normalizeScreenshotEntries(screenshots, sessionMeta));
    events = events.concat(normalizeActionEntries(uiActions, sessionMeta));

    events.sort((a, b) => {
      if (a.t_ms !== b.t_ms) {
        return a.t_ms - b.t_ms;
      }
      if (a.ts_iso === b.ts_iso) {
        return 0;
      }
      return a.ts_iso < b.ts_iso ? -1 : 1;
    });

    const normalizedEvents = events.map((event, index) => ({
      ...event,
      id: `evt_${String(index + 1).padStart(6, "0")}`,
    }));

    return { normalizedEvents };
  }

  self.PipelineNormalizer = { normalizeSession };
})();
