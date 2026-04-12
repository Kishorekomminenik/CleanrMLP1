(() => {
  const NAV_TYPES = new Set(["navigation"]);

  const getConfig = () => {
    const config =
      typeof globalThis !== "undefined" && globalThis.ReportConfig
        ? globalThis.ReportConfig
        : {};
    return {
      enabled: config.REPORTS_ENABLED === true,
      version:
        typeof config.REPORTS_VERSION === "string"
          ? config.REPORTS_VERSION
          : "1.1.0-scaffold",
    };
  };

  const getManager = () => {
    if (
      typeof globalThis !== "undefined" &&
      globalThis.ReportSessionManager &&
      typeof globalThis.ReportSessionManager.addStep === "function"
    ) {
      return globalThis.ReportSessionManager;
    }
    return null;
  };

  const nowIso = () => new Date().toISOString();

  const normalizeUrl = (url) => {
    if (typeof url !== "string") {
      return "";
    }
    return url.trim();
  };

  const normalizeTimestamp = (timestamp) => {
    if (typeof timestamp === "string" && timestamp) {
      return timestamp;
    }
    if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
      return new Date(timestamp).toISOString();
    }
    return nowIso();
  };

  const parseTimestampMs = (timestamp) => {
    if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
      return timestamp;
    }
    if (typeof timestamp === "string") {
      const parsed = Date.parse(timestamp);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  const isNavigationType = (type) => NAV_TYPES.has(type);

  const getNavigationKind = (context) => {
    if (context && context.navigationKind === "reload") {
      return "reload";
    }
    if (context && context.navigationKind === "start") {
      return "start";
    }
    return "change";
  };

  const buildNavigationStep = (context, navigationKind) => {
    const url = normalizeUrl(context && context.url);
    const title =
      navigationKind === "start"
        ? "Opened page"
        : navigationKind === "reload"
          ? "Reloaded page"
          : "Navigated to page";
    const verb =
      navigationKind === "start"
        ? "Opened"
        : navigationKind === "reload"
          ? "Reloaded"
          : "Navigated to";
    return {
      type: "navigation",
      title,
      description: `${verb} ${url || "page"}`,
      url,
      timestamp: normalizeTimestamp(context && context.timestamp),
      metadata: {
        navigationKind,
        title: context && context.title ? context.title : "",
        tabId:
          context && typeof context.tabId === "number" ? context.tabId : null,
        frameId:
          context && typeof context.frameId === "number" ? context.frameId : null,
      },
    };
  };

  const shouldSkipDuplicateNavigation = (nextContext, lastStep, rules = {}) => {
    if (!lastStep || !isNavigationType(lastStep.type)) {
      return false;
    }
    const minGapMs =
      typeof rules.minGapMs === "number" ? rules.minGapMs : 1500;
    const nextUrl = normalizeUrl(nextContext && nextContext.url);
    const lastUrl = normalizeUrl(lastStep.url);
    if (!nextUrl || !lastUrl || nextUrl !== lastUrl) {
      return false;
    }
    const nextType = getNavigationKind(nextContext);
    const lastType =
      lastStep && lastStep.metadata && lastStep.metadata.navigationKind
        ? lastStep.metadata.navigationKind
        : "change";
    const nextMs = parseTimestampMs(nextContext && nextContext.timestamp);
    const lastMs = parseTimestampMs(lastStep.timestamp);
    if (nextMs !== null && lastMs !== null && nextMs - lastMs < minGapMs) {
      return true;
    }
    if (rules.skipIfSameUrlAndSameTypeWithinGap !== false && nextType === lastType) {
      return true;
    }
    return false;
  };

  const recordSessionStartStep = (context = {}) => {
    const config = getConfig();
    if (!config.enabled) {
      return null;
    }
    const manager = getManager();
    if (!manager) {
      return null;
    }
    const last = manager.getLastStep ? manager.getLastStep() : null;
    const url = normalizeUrl(context.url);
    if (
      last &&
      last.type === "navigation" &&
      last.metadata &&
      last.metadata.navigationKind === "start" &&
      normalizeUrl(last.url) === url
    ) {
      return last;
    }
    return manager.addStep(buildNavigationStep(context, "start"));
  };

  const recordNavigationEvent = (context = {}) => {
    const config = getConfig();
    if (!config.enabled) {
      return null;
    }
    const manager = getManager();
    if (!manager) {
      return null;
    }
    if (manager.updateSession) {
      manager.updateSession({ currentUrl: normalizeUrl(context.url) });
    }
    const last = manager.getLastStep ? manager.getLastStep() : null;
    if (shouldSkipDuplicateNavigation(context, last, { minGapMs: 1500 })) {
      return last;
    }
    const kind = getNavigationKind(context);
    return manager.addStep(buildNavigationStep(context, kind));
  };

  const recordScreenshotEvent = (fileMeta, context = {}) => {
    const config = getConfig();
    if (!config.enabled) {
      return null;
    }
    const manager = getManager();
    if (!manager) {
      return null;
    }
    const last = manager.getLastStep ? manager.getLastStep() : null;
    if (!last && context && context.url) {
      recordSessionStartStep({
        url: context.url,
        title: context.title || "",
        timestamp: context.timestamp,
        navigationKind: "start",
      });
    }
    if (manager.attachScreenshot) {
      manager.attachScreenshot(fileMeta || {});
    }
    const timestamp = normalizeTimestamp(
      (fileMeta && fileMeta.createdAt) || context.timestamp
    );
    const recent =
      manager.findRecentStep &&
      manager.findRecentStep(
        (step) =>
          step &&
          ["navigation", "screenshot"].includes(step.type) &&
          !(step.screenshotRef || step.screenshotFile),
        { maxAgeMs: 8000, maxCount: 5 }
      );
    if (recent && manager.updateStepById) {
      const ref =
        (fileMeta && fileMeta.relativePath) ||
        (fileMeta && fileMeta.filename) ||
        "";
      manager.updateStepById(recent.id, {
        screenshotRef: ref,
        screenshotFile: fileMeta && fileMeta.filename ? fileMeta.filename : "",
        screenshotPath: fileMeta && fileMeta.relativePath ? fileMeta.relativePath : "",
        screenshotCapturedAt: timestamp,
      });
      return recent;
    }
    return manager.addStep({
      type: "screenshot",
      title: "Captured screenshot",
      description: `Captured screenshot at ${
        context.url || (fileMeta && fileMeta.url) || "current page"
      }`,
      url: context.url || (fileMeta && fileMeta.url) || "",
      screenshotRef:
        (fileMeta && fileMeta.relativePath) ||
        (fileMeta && fileMeta.filename) ||
        "",
      screenshotFile: fileMeta && fileMeta.filename ? fileMeta.filename : "",
      screenshotPath: fileMeta && fileMeta.relativePath ? fileMeta.relativePath : "",
      timestamp,
      metadata: {
        captureMode: context.captureMode || "unknown",
      },
    });
  };

  const tracker = {
    recordSessionStartStep,
    recordNavigationEvent,
    recordScreenshotEvent,
    shouldSkipDuplicateNavigation,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = tracker;
  } else {
    const root =
      typeof globalThis !== "undefined"
        ? globalThis
        : typeof window !== "undefined"
          ? window
          : typeof self !== "undefined"
            ? self
            : {};
    root.ReportStepTracker = tracker;
  }
})();
