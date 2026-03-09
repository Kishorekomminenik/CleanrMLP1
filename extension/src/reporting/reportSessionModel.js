(() => {
  const getReportVersion = () => {
    if (
      typeof globalThis !== "undefined" &&
      globalThis.ReportConfig &&
      typeof globalThis.ReportConfig.REPORTS_VERSION === "string"
    ) {
      return globalThis.ReportConfig.REPORTS_VERSION;
    }
    return "1.1.0-scaffold";
  };

  const nowIso = () => new Date().toISOString();

  const safeString = (value) => (typeof value === "string" ? value : "");

  const safeNumber = (value, fallback = 0) =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;

  const createSessionId = () =>
    `rep_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

  function createEmptyReportSession(partialInit = {}) {
    const version = getReportVersion();
    const createdAt = safeString(partialInit.createdAt) || nowIso();
    const sessionId = safeString(partialInit.sessionId) || createSessionId();
    return {
      sessionId,
      createdAt,
      updatedAt: createdAt,
      version,
      status: "active",
      startUrl: safeString(partialInit.startUrl),
      currentUrl: safeString(partialInit.currentUrl),
      browserInfo: {
        userAgent: safeString(partialInit.browserInfo?.userAgent),
        platform: safeString(partialInit.browserInfo?.platform),
        language: safeString(partialInit.browserInfo?.language),
      },
      viewport: {
        width: safeNumber(partialInit.viewport?.width),
        height: safeNumber(partialInit.viewport?.height),
      },
      artifacts: {
        screenshots: [],
        recording: null,
        consoleLogs: [],
        networkLogs: [],
        files: [],
      },
      steps: [],
      summary: {
        stepCount: 0,
        screenshotCount: 0,
        consoleCount: 0,
        networkCount: 0,
        hasRecording: false,
      },
      meta: {
        reportEnabled: true,
        reportVersion: version,
      },
    };
  }

  function normalizeStep(stepPartial = {}, currentStepCount = 0) {
    const index = currentStepCount + 1;
    const timestamp = safeString(stepPartial.timestamp) || nowIso();
    const id = safeString(stepPartial.id) || `step_${String(index).padStart(4, "0")}`;
    return {
      id,
      stepId: safeString(stepPartial.stepId) || id,
      sessionId: safeString(stepPartial.sessionId),
      index,
      timestamp,
      type: safeString(stepPartial.type),
      title: safeString(stepPartial.title),
      description: safeString(stepPartial.description),
      url: safeString(stepPartial.url),
      screenshotFile: safeString(stepPartial.screenshotFile),
      screenshotRef:
        safeString(stepPartial.screenshotRef) ||
        safeString(stepPartial.screenshotPath) ||
        safeString(stepPartial.screenshotFile),
      notes: safeString(stepPartial.notes) || safeString(stepPartial.manualNote),
      manualNote: safeString(stepPartial.manualNote),
      metadata:
        stepPartial && typeof stepPartial.metadata === "object"
          ? stepPartial.metadata
          : stepPartial && typeof stepPartial.meta === "object"
            ? stepPartial.meta
            : {},
    };
  }

  function normalizeArtifactFile(fileMeta = {}) {
    return {
      kind: safeString(fileMeta.kind),
      filename: safeString(fileMeta.filename),
      relativePath: safeString(fileMeta.relativePath),
      mimeType: safeString(fileMeta.mimeType),
      size:
        typeof fileMeta.size === "number" && Number.isFinite(fileMeta.size)
          ? fileMeta.size
          : null,
      createdAt: safeString(fileMeta.createdAt) || nowIso(),
    };
  }

  const model = {
    createEmptyReportSession,
    normalizeStep,
    normalizeArtifactFile,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = model;
  } else {
    const root =
      typeof globalThis !== "undefined"
        ? globalThis
        : typeof window !== "undefined"
          ? window
          : typeof self !== "undefined"
            ? self
            : {};
    root.ReportSessionModel = model;
  }
})();
