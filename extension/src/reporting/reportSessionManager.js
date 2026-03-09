(() => {
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

  const getModel = () => {
    if (
      typeof globalThis !== "undefined" &&
      globalThis.ReportSessionModel &&
      typeof globalThis.ReportSessionModel.createEmptyReportSession === "function"
    ) {
      return globalThis.ReportSessionModel;
    }
    return null;
  };

  let currentSession = null;

  const clone = (value) => {
    if (!value) {
      return null;
    }
    return JSON.parse(JSON.stringify(value));
  };

  const ensureSession = () => {
    if (currentSession) {
      return currentSession;
    }
    const config = getConfig();
    if (!config.enabled) {
      return null;
    }
    const model = getModel();
    if (!model) {
      return null;
    }
    currentSession = model.createEmptyReportSession();
    return currentSession;
  };

  const updateSummary = () => {
    if (!currentSession) {
      return;
    }
    const artifacts = currentSession.artifacts || {};
    const steps = Array.isArray(currentSession.steps)
      ? currentSession.steps
      : [];
    const screenshots = Array.isArray(artifacts.screenshots)
      ? artifacts.screenshots
      : [];
    const consoleLogs = artifacts.consoleLogs;
    const networkLogs = artifacts.networkLogs;
    const consoleCount = Array.isArray(consoleLogs)
      ? consoleLogs.length
      : consoleLogs && typeof consoleLogs.count === "number"
        ? consoleLogs.count
        : 0;
    const networkCount = Array.isArray(networkLogs)
      ? networkLogs.length
      : networkLogs && typeof networkLogs.count === "number"
        ? networkLogs.count
        : 0;
    currentSession.summary = {
      stepCount: steps.length,
      screenshotCount: screenshots.length,
      consoleCount,
      networkCount,
      hasRecording: Boolean(artifacts.recording),
    };
  };

  const touch = () => {
    if (currentSession) {
      currentSession.updatedAt = new Date().toISOString();
    }
  };

  const manager = {
    createSession(partialInit = {}) {
      const config = getConfig();
      if (!config.enabled) {
        return null;
      }
      const model = getModel();
      if (!model) {
        return null;
      }
      const forceNew = Boolean(partialInit && partialInit.forceNew === true);
      if (currentSession && !forceNew) {
        return clone(currentSession);
      }
      const init = { ...partialInit };
      delete init.forceNew;
      currentSession = model.createEmptyReportSession(init);
      updateSummary();
      touch();
      return clone(currentSession);
    },

    getSessionData() {
      return clone(currentSession);
    },

    updateSession(partialPatch = {}) {
      if (!ensureSession()) {
        return null;
      }
      const safeFields = [
        "status",
        "startUrl",
        "currentUrl",
        "browserInfo",
        "viewport",
        "meta",
      ];
      safeFields.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(partialPatch, field)) {
          currentSession[field] = partialPatch[field];
        }
      });
      touch();
      return clone(currentSession);
    },

    addStep(stepPartial = {}) {
      if (!ensureSession()) {
        return null;
      }
      const model = getModel();
      if (!model) {
        return null;
      }
      const steps = Array.isArray(currentSession.steps)
        ? currentSession.steps
        : [];
      const normalized = model.normalizeStep(stepPartial, steps.length);
      steps.push(normalized);
      currentSession.steps = steps;
      updateSummary();
      touch();
      return clone(normalized);
    },

    attachScreenshot(fileMeta = {}) {
      if (!ensureSession()) {
        return null;
      }
      const model = getModel();
      if (!model) {
        return null;
      }
      const normalized = model.normalizeArtifactFile({
        kind: "screenshot",
        ...fileMeta,
      });
      const screenshots = Array.isArray(currentSession.artifacts.screenshots)
        ? currentSession.artifacts.screenshots
        : [];
      screenshots.push(normalized);
      currentSession.artifacts.screenshots = screenshots;
      this.attachExportedFile(normalized);
      updateSummary();
      touch();
      return clone(normalized);
    },

    attachRecording(fileMeta = {}) {
      if (!ensureSession()) {
        return null;
      }
      const model = getModel();
      if (!model) {
        return null;
      }
      const normalized = model.normalizeArtifactFile({
        kind: "recording",
        ...fileMeta,
      });
      currentSession.artifacts.recording = normalized;
      this.attachExportedFile(normalized);
      updateSummary();
      touch();
      return clone(normalized);
    },

    attachConsoleLogs(logsOrMeta) {
      if (!ensureSession()) {
        return null;
      }
      currentSession.artifacts.consoleLogs = logsOrMeta || [];
      updateSummary();
      touch();
      return true;
    },

    attachNetworkLogs(logsOrMeta) {
      if (!ensureSession()) {
        return null;
      }
      currentSession.artifacts.networkLogs = logsOrMeta || [];
      updateSummary();
      touch();
      return true;
    },

    attachExportedFile(fileMeta = {}) {
      if (!ensureSession()) {
        return null;
      }
      const model = getModel();
      if (!model) {
        return null;
      }
      const normalized = model.normalizeArtifactFile(fileMeta);
      const files = Array.isArray(currentSession.artifacts.files)
        ? currentSession.artifacts.files
        : [];
      if (
        normalized.relativePath &&
        files.some((file) => file.relativePath === normalized.relativePath)
      ) {
        return clone(normalized);
      }
      files.push(normalized);
      currentSession.artifacts.files = files;
      updateSummary();
      touch();
      return clone(normalized);
    },

    finalizeSession(finalPatch = {}) {
      if (!ensureSession()) {
        return null;
      }
      currentSession.status = "finalized";
      if (finalPatch && typeof finalPatch === "object") {
        currentSession = { ...currentSession, ...finalPatch };
      }
      updateSummary();
      touch();
      return clone(currentSession);
    },

    clearSession() {
      currentSession = null;
    },

    recalculateSummary() {
      updateSummary();
      touch();
      return clone(currentSession);
    },
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = manager;
  } else {
    const root =
      typeof globalThis !== "undefined"
        ? globalThis
        : typeof window !== "undefined"
          ? window
          : typeof self !== "undefined"
            ? self
            : {};
    root.ReportSessionManager = manager;
  }
})();
