(() => {
  function reduceToSignals(normalizedEvents, config, meta) {
    const safeConfig = config || {};
    const dedupeWindowMs = safeConfig.dedupeWindowMs || 0;
    const slowThresholdMs = safeConfig.slowThresholdMs || 0;
    const burstConfig = safeConfig.burstCollapse || { windowMs: 0, minCount: 0 };
    const events = Array.isArray(normalizedEvents) ? normalizedEvents : [];

    const requestById = new Map();
    const responseEvents = [];
    const consoleErrorEvents = [];
    const requestIdsWithResponse = new Set();

    events.forEach((event) => {
      if (event.source === "network" && event.kind === "request") {
        if (event.corr && event.corr.requestId) {
          requestById.set(event.corr.requestId, event);
        }
      }
      if (event.source === "network" && event.kind === "response") {
        responseEvents.push(event);
        if (event.corr && event.corr.requestId) {
          requestIdsWithResponse.add(event.corr.requestId);
        }
      }
      if (event.source === "console" && (event.level === "error" || event.kind === "error")) {
        consoleErrorEvents.push(event);
      }
    });

    let signalIndex = 0;
    const signals = [];

    function nextSignalId() {
      signalIndex += 1;
      return `sig_${String(signalIndex).padStart(4, "0")}`;
    }

    function addSignal(type, level, summary, key, actionId, stats, evidence) {
      signals.push({
        signalId: nextSignalId(),
        type,
        level,
        actionId: actionId || null,
        summary,
        key,
        stats: stats || {},
        evidence: evidence || { eventIds: [] },
      });
    }

    function getRequestInfo(event) {
      const requestId = event.corr ? event.corr.requestId : null;
      const requestEvent = requestId ? requestById.get(requestId) : null;
      const method = requestEvent && requestEvent.data ? requestEvent.data.method : null;
      const urlPath = requestEvent && requestEvent.data ? requestEvent.data.urlPath : null;
      return {
        requestId,
        method: method || "REQUEST",
        urlPath: urlPath || "",
      };
    }

    const failureGroups = new Map();
    const dedupeNetwork = new Map();
    const sortedResponses = responseEvents.slice().sort((a, b) => a.t_ms - b.t_ms);

    sortedResponses.forEach((event) => {
      const status = event.data ? event.data.status : null;
      const bodyError = event.data ? event.data.bodyError : null;
      const bodySkipped = event.data ? event.data.bodySkipped : false;
      const isFailure =
        (typeof status === "number" && status >= 400) || bodyError || bodySkipped;
      if (!isFailure) {
        return;
      }
      const requestInfo = getRequestInfo(event);
      const key = `${requestInfo.method}|${requestInfo.urlPath}|${
        typeof status === "number" ? status : "fail"
      }`;
      const lastSeen = dedupeNetwork.get(key);
      if (typeof lastSeen === "number" && event.t_ms - lastSeen <= dedupeWindowMs) {
        return;
      }
      dedupeNetwork.set(key, event.t_ms);
      const group = failureGroups.get(key) || {
        key,
        method: requestInfo.method,
        urlPath: requestInfo.urlPath,
        status,
        count: 0,
        firstMs: event.t_ms,
        lastMs: event.t_ms,
        maxDurationMs: 0,
        eventIds: [],
        requestIds: [],
        actionId: event.corr ? event.corr.actionId : null,
      };
      group.count += 1;
      group.lastMs = event.t_ms;
      if (event.data && typeof event.data.durationMs === "number") {
        group.maxDurationMs = Math.max(group.maxDurationMs, event.data.durationMs);
      }
      if (event.id) {
        group.eventIds.push(event.id);
      }
      if (requestInfo.requestId) {
        group.requestIds.push(requestInfo.requestId);
      }
      failureGroups.set(key, group);
    });

    const pendingRequests = [];
    requestById.forEach((requestEvent, requestId) => {
      if (!requestIdsWithResponse.has(requestId)) {
        pendingRequests.push(requestEvent);
      }
    });
    pendingRequests.forEach((event) => {
      const requestInfo = getRequestInfo({ corr: { requestId: event.corr.requestId } });
      const key = `${requestInfo.method}|${requestInfo.urlPath}|unfinished`;
      const lastSeen = dedupeNetwork.get(key);
      if (typeof lastSeen === "number" && event.t_ms - lastSeen <= dedupeWindowMs) {
        return;
      }
      dedupeNetwork.set(key, event.t_ms);
      const summary = `${requestInfo.method} ${requestInfo.urlPath} did not complete.`;
      addSignal(
        "NetworkFailure",
        "error",
        summary,
        key,
        event.corr ? event.corr.actionId : null,
        { count: 1 },
        { eventIds: event.id ? [event.id] : [], requestIds: [requestInfo.requestId] }
      );
    });

    Array.from(failureGroups.values()).forEach((group) => {
      const statusText =
        typeof group.status === "number" ? `status ${group.status}` : "failed";
      const summary = `${group.method} ${group.urlPath} failed with ${statusText} (x${group.count}).`;
      addSignal(
        "NetworkFailure",
        "error",
        summary,
        group.key,
        group.actionId,
        {
          count: group.count,
          firstMs: group.firstMs,
          lastMs: group.lastMs,
          maxDurationMs: group.maxDurationMs || null,
        },
        {
          eventIds: group.eventIds,
          requestIds: group.requestIds,
        }
      );
    });

    const consoleGroups = new Map();
    const dedupeConsole = new Map();
    consoleErrorEvents.forEach((event) => {
      const stackTop =
        event.data && event.data.stack ? event.data.stack.split("\n")[0] : "";
      const key = `${event.data ? event.data.errorType : ""}|${event.msg}|${stackTop}`;
      const lastSeen = dedupeConsole.get(key);
      if (typeof lastSeen === "number" && event.t_ms - lastSeen <= dedupeWindowMs) {
        return;
      }
      dedupeConsole.set(key, event.t_ms);
      const group = consoleGroups.get(key) || {
        key,
        message: event.msg,
        count: 0,
        eventIds: [],
        actionId: event.corr ? event.corr.actionId : null,
      };
      group.count += 1;
      if (event.id) {
        group.eventIds.push(event.id);
      }
      consoleGroups.set(key, group);
    });

    Array.from(consoleGroups.values()).forEach((group) => {
      const summary = `Console error: ${group.message} (x${group.count}).`;
      addSignal(
        "ConsoleError",
        "error",
        summary,
        group.key,
        group.actionId,
        { count: group.count },
        { eventIds: group.eventIds }
      );
    });

    const slowGroups = new Map();
    const dedupeSlow = new Map();
    sortedResponses.forEach((event) => {
      const status = event.data ? event.data.status : null;
      const durationMs = event.data ? event.data.durationMs : null;
      if (
        typeof durationMs !== "number" ||
        !slowThresholdMs ||
        durationMs < slowThresholdMs
      ) {
        return;
      }
      if (typeof status === "number" && status >= 400) {
        return;
      }
      const requestInfo = getRequestInfo(event);
      const bucket = Math.round(durationMs / 1000);
      const key = `${requestInfo.method}|${requestInfo.urlPath}|slow_${bucket}`;
      const lastSeen = dedupeSlow.get(key);
      if (typeof lastSeen === "number" && event.t_ms - lastSeen <= dedupeWindowMs) {
        return;
      }
      dedupeSlow.set(key, event.t_ms);
      const group = slowGroups.get(key) || {
        key,
        method: requestInfo.method,
        urlPath: requestInfo.urlPath,
        count: 0,
        maxDurationMs: 0,
        eventIds: [],
        actionId: event.corr ? event.corr.actionId : null,
      };
      group.count += 1;
      group.maxDurationMs = Math.max(group.maxDurationMs, durationMs);
      if (event.id) {
        group.eventIds.push(event.id);
      }
      slowGroups.set(key, group);
    });

    Array.from(slowGroups.values()).forEach((group) => {
      const summary = `Slow request: ${group.method} ${group.urlPath} (x${group.count}).`;
      addSignal(
        "SlowRequest",
        "warn",
        summary,
        group.key,
        group.actionId,
        { count: group.count, maxDurationMs: group.maxDurationMs },
        { eventIds: group.eventIds }
      );
    });

    const burstSignals = [];
    const burstWindowMs = burstConfig.windowMs || 0;
    const burstMinCount = burstConfig.minCount || 0;
    if (burstWindowMs > 0 && burstMinCount > 0) {
      const byPath = new Map();
      sortedResponses.forEach((event) => {
        const info = getRequestInfo(event);
        const key = `${info.method}|${info.urlPath}`;
        if (!byPath.has(key)) {
          byPath.set(key, []);
        }
        byPath.get(key).push(event);
      });
      byPath.forEach((list, key) => {
        const eventsSorted = list.slice().sort((a, b) => a.t_ms - b.t_ms);
        let maxCount = 0;
        let maxWindowStart = 0;
        let maxWindowEnd = 0;
        let startIdx = 0;
        for (let endIdx = 0; endIdx < eventsSorted.length; endIdx += 1) {
          const endMs = eventsSorted[endIdx].t_ms;
          while (endMs - eventsSorted[startIdx].t_ms > burstWindowMs) {
            startIdx += 1;
          }
          const count = endIdx - startIdx + 1;
          if (count > maxCount) {
            maxCount = count;
            maxWindowStart = eventsSorted[startIdx].t_ms;
            maxWindowEnd = endMs;
          }
        }
        if (maxCount >= burstMinCount) {
          const windowEvents = eventsSorted.filter(
            (event) => event.t_ms >= maxWindowStart && event.t_ms <= maxWindowEnd
          );
          const statusHistogram = {};
          const eventIds = [];
          windowEvents.forEach((event) => {
            const status = event.data ? event.data.status : null;
            const bucket = typeof status === "number" ? String(status) : "unknown";
            statusHistogram[bucket] = (statusHistogram[bucket] || 0) + 1;
            if (event.id) {
              eventIds.push(event.id);
            }
          });
          burstSignals.push({
            key,
            count: maxCount,
            eventIds,
            statusHistogram,
          });
        }
      });
    }

    burstSignals.forEach((burst) => {
      const [method, urlPath] = burst.key.split("|");
      const summary = `High traffic: ${method} ${urlPath} (${burst.count} in burst).`;
      addSignal(
        "BackgroundNoise",
        "info",
        summary,
        `burst|${burst.key}`,
        null,
        { count: burst.count, statusHistogram: burst.statusHistogram },
        { eventIds: burst.eventIds }
      );
    });

    const unattributed = events.filter((event) => {
      if (event.kind === "marker" || event.kind === "action") {
        return false;
      }
      return !event.corr || !event.corr.actionId;
    });
    if (unattributed.length > 0) {
      const eventIds = unattributed.map((event) => event.id).filter(Boolean);
      addSignal(
        "BackgroundNoise",
        "info",
        `Background noise: ${unattributed.length} events without actions.`,
        "noise|unattributed",
        null,
        { count: unattributed.length },
        { eventIds }
      );
    }

    if (
      meta &&
      ((typeof meta.rawNetworkCount === "number" &&
        meta.rawNetworkCount > (safeConfig.maxRequestsStored || 0)) ||
        meta.networkCapped)
    ) {
      addSignal(
        "BackgroundNoise",
        "warn",
        "Network capture capped by limits.",
        "noise|network_capped",
        null,
        {
          limit: safeConfig.maxRequestsStored,
          count: meta.rawNetworkCount,
        },
        { eventIds: [] }
      );
    }

    const visibleEvents = events.filter((event) => {
      if (event.source !== "network" || event.kind !== "response") {
        return true;
      }
      const status = event.data ? event.data.status : null;
      const durationMs = event.data ? event.data.durationMs : null;
      if (typeof status === "number" && status >= 400) {
        return true;
      }
      if (
        typeof durationMs === "number" &&
        slowThresholdMs &&
        durationMs >= slowThresholdMs
      ) {
        return true;
      }
      return false;
    });

    return { signals, visibleEvents };
  }

  self.PipelineSignalReducer = { reduceToSignals };
})();
