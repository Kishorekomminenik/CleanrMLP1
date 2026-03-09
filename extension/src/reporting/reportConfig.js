(() => {
  const REPORTS_ENABLED = true;
  const REPORTS_VERSION = "1.1.0-scaffold";

  const config = {
    REPORTS_ENABLED,
    REPORTS_VERSION,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = config;
  } else {
    const root =
      typeof globalThis !== "undefined"
        ? globalThis
        : typeof window !== "undefined"
          ? window
          : typeof self !== "undefined"
            ? self
            : {};
    root.ReportConfig = config;
  }
})();
