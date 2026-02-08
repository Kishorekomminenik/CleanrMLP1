(() => {
  function formatDuration(ms) {
    if (typeof ms !== "number" || Number.isNaN(ms)) {
      return "unknown";
    }
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}m ${seconds}s`;
  }

  function buildSummaryText({ session, signals, normalizedEvents, config }) {
    const safeSignals = Array.isArray(signals) ? signals : [];
    const events = Array.isArray(normalizedEvents) ? normalizedEvents : [];
    const safeConfig = config || {};

    const startedAt =
      session.startedAt ||
      session.created_at ||
      session.started_at ||
      session.start ||
      null;
    const endedAt =
      session.endedAt || session.ended_at || session.ended_at || session.end || null;
    const startMs = startedAt ? new Date(startedAt).getTime() : null;
    const endMs = endedAt ? new Date(endedAt).getTime() : null;
    const durationMs =
      typeof startMs === "number" && typeof endMs === "number"
        ? Math.max(0, endMs - startMs)
        : null;

    const actionableSignals = safeSignals.filter(
      (signal) =>
        signal.type === "NetworkFailure" ||
        signal.type === "ConsoleError" ||
        signal.type === "SlowRequest"
    );

    const topFailures = safeSignals
      .filter(
        (signal) =>
          signal.type === "NetworkFailure" || signal.type === "ConsoleError"
      )
      .sort((a, b) => {
        const levelOrder = { error: 0, warn: 1, info: 2 };
        const levelDiff = (levelOrder[a.level] || 0) - (levelOrder[b.level] || 0);
        if (levelDiff !== 0) {
          return levelDiff;
        }
        const aCount = a.stats && typeof a.stats.count === "number" ? a.stats.count : 0;
        const bCount = b.stats && typeof b.stats.count === "number" ? b.stats.count : 0;
        return bCount - aCount;
      })
      .slice(0, 5);

    const statusCounts = { "4xx": 0, "5xx": 0 };
    events.forEach((event) => {
      if (event.source === "network" && event.kind === "response") {
        const status = event.data ? event.data.status : null;
        if (typeof status === "number") {
          if (status >= 400 && status < 500) {
            statusCounts["4xx"] += 1;
          } else if (status >= 500) {
            statusCounts["5xx"] += 1;
          }
        }
      }
    });

    const slowSignals = safeSignals
      .filter((signal) => signal.type === "SlowRequest")
      .sort((a, b) => {
        const aMax =
          a.stats && typeof a.stats.maxDurationMs === "number"
            ? a.stats.maxDurationMs
            : 0;
        const bMax =
          b.stats && typeof b.stats.maxDurationMs === "number"
            ? b.stats.maxDurationMs
            : 0;
        return bMax - aMax;
      })
      .slice(0, safeConfig.topSlowRequestsLimit || 10);

    const markers = events.filter((event) => event.kind === "marker");
    const screenshots = events.filter((event) => event.kind === "screenshot");

    let bodySkipped = 0;
    let bodyTruncated = 0;
    let bodyErrors = 0;
    events.forEach((event) => {
      if (event.source !== "network" || event.kind !== "response") {
        return;
      }
      const data = event.data || {};
      if (data.bodySkipped) {
        bodySkipped += 1;
      }
      if (data.bodyTruncated) {
        bodyTruncated += 1;
      }
      if (data.bodyError) {
        bodyErrors += 1;
      }
    });

    const lines = [];
    lines.push("Session Summary");
    lines.push(`- Started: ${startedAt || "unknown"}`);
    lines.push(`- Ended: ${endedAt || "unknown"}`);
    lines.push(`- Duration: ${formatDuration(durationMs)}`);
    lines.push(`- Tab ID: ${session.tabId != null ? session.tabId : "unknown"}`);
    lines.push(`- Mode: ${session.mode || "unknown"}`);
    lines.push("");

    lines.push("Capture Notes");
    lines.push(`- Total actionable signals: ${actionableSignals.length}`);
    lines.push("");

    lines.push("Top 5 Failures");
    if (topFailures.length === 0) {
      lines.push("- None");
    } else {
      topFailures.forEach((signal, index) => {
        lines.push(`${index + 1}. ${signal.summary}`);
      });
    }
    lines.push("");

    lines.push("HTTP Status Counts");
    lines.push(`- 4xx: ${statusCounts["4xx"]}`);
    lines.push(`- 5xx: ${statusCounts["5xx"]}`);
    lines.push("");

    lines.push("Top Slow Requests");
    if (slowSignals.length === 0) {
      lines.push("- None");
    } else {
      slowSignals.forEach((signal, index) => {
        const maxDuration =
          signal.stats && typeof signal.stats.maxDurationMs === "number"
            ? `${signal.stats.maxDurationMs}ms`
            : "unknown";
        lines.push(`${index + 1}. ${signal.summary} (max ${maxDuration})`);
      });
    }
    lines.push("");

    lines.push("Markers");
    if (markers.length === 0) {
      lines.push("- None");
    } else {
      markers.forEach((event) => {
        lines.push(`- [${event.t_ms}ms] ${event.msg}`);
      });
    }
    lines.push("");

    lines.push("Screenshots");
    lines.push(`- Count: ${screenshots.length}`);
    lines.push("");

    lines.push("Truncation / Skips / Errors");
    lines.push(`- Body skipped: ${bodySkipped}`);
    lines.push(`- Body truncated: ${bodyTruncated}`);
    lines.push(`- Body errors: ${bodyErrors}`);
    lines.push("");

    return lines.join("\n");
  }

  self.PipelineSummaryBuilder = { buildSummaryText };
})();
