(() => {
  if (window.__REPRO_FULLPAGE_CAPTURE_LOADED__) {
    return;
  }
  window.__REPRO_FULLPAGE_CAPTURE_LOADED__ = true;

  const STATE_KEY = "__reproFullpageState__";
  const STYLE_ID = "__repro_fullpage_style__";

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getState() {
    if (!window[STATE_KEY]) {
      window[STATE_KEY] = {
        applied: false,
        originalScrollY: null,
        originalHtmlScrollBehavior: null,
        originalBodyScrollBehavior: null,
        hiddenElements: [],
        styleTagId: STYLE_ID,
        captureRunId: null,
        lastMetrics: null,
      };
    }
    return window[STATE_KEY];
  }

  function resetState() {
    window[STATE_KEY] = {
      applied: false,
      originalScrollY: null,
      originalHtmlScrollBehavior: null,
      originalBodyScrollBehavior: null,
      hiddenElements: [],
      styleTagId: STYLE_ID,
      captureRunId: null,
      lastMetrics: null,
    };
  }

  function hideFixedSticky() {
    const hidden = [];
    const elements = document.querySelectorAll("*");
    elements.forEach((el) => {
      const style = window.getComputedStyle(el);
      if (style.position === "fixed" || style.position === "sticky") {
        hidden.push({
          el,
          visibility: el.style.visibility,
          opacity: el.style.opacity,
        });
        el.style.visibility = "hidden";
        el.style.opacity = "0";
      }
    });
    return hidden;
  }

  function ensureStyleTag() {
    const existing = document.getElementById(STYLE_ID);
    if (existing) {
      return existing;
    }
    const styleEl = document.createElement("style");
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
      * { scroll-behavior: auto !important; }
      *, *::before, *::after { animation: none !important; transition: none !important; }
    `;
    document.documentElement.appendChild(styleEl);
    return styleEl;
  }

  function prepareFullpageCapture(captureRunId) {
    const state = getState();
    if (state.applied) {
      if (captureRunId && state.captureRunId && captureRunId !== state.captureRunId) {
        restoreFullpagePageState();
        resetState();
      } else {
        return { ok: true, captureRunId: state.captureRunId, alreadyApplied: true };
      }
    }
    const doc = document.documentElement;
    const body = document.body;
    state.originalScrollY = window.scrollY;
    state.originalHtmlScrollBehavior = doc.style.scrollBehavior || "";
    state.originalBodyScrollBehavior = body ? body.style.scrollBehavior || "" : "";
    doc.style.scrollBehavior = "auto";
    if (body) {
      body.style.scrollBehavior = "auto";
    }
    ensureStyleTag();
    state.hiddenElements = hideFixedSticky();
    state.applied = true;
    state.captureRunId = captureRunId || state.captureRunId || String(Date.now());
    return { ok: true, captureRunId: state.captureRunId };
  }

  function getFullpageMetrics() {
    const doc = document.documentElement;
    const body = document.body;
    const metrics = {
      scrollHeight: Math.max(doc.scrollHeight, body?.scrollHeight || 0),
      scrollWidth: Math.max(doc.scrollWidth, body?.scrollWidth || 0),
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      devicePixelRatio: window.devicePixelRatio || 1,
      scrollY: window.scrollY,
    };
    const state = getState();
    state.lastMetrics = metrics;
    return { ok: true, metrics };
  }

  async function scrollToFullpagePosition(targetY) {
    window.scrollTo(0, targetY);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await sleep(160);
    return { ok: true, scrollY: window.scrollY };
  }

  function restoreFullpagePageState() {
    const state = getState();
    if (!state.applied) {
      return { ok: true, restored: false };
    }
    const doc = document.documentElement;
    const body = document.body;
    const styleEl = document.getElementById(state.styleTagId || STYLE_ID);
    if (styleEl) {
      styleEl.remove();
    }
    if (state.hiddenElements && state.hiddenElements.length) {
      state.hiddenElements.forEach((entry) => {
        if (!entry || !entry.el) {
          return;
        }
        entry.el.style.visibility = entry.visibility || "";
        entry.el.style.opacity = entry.opacity || "";
      });
    }
    doc.style.scrollBehavior = state.originalHtmlScrollBehavior || "";
    if (body) {
      body.style.scrollBehavior = state.originalBodyScrollBehavior || "";
    }
    if (typeof state.originalScrollY === "number") {
      window.scrollTo(0, state.originalScrollY);
    }
    state.applied = false;
    return { ok: true, restored: true };
  }

  function resetFullpageCaptureState() {
    const styleEl = document.getElementById(STYLE_ID);
    if (styleEl) {
      styleEl.remove();
    }
    resetState();
    return { ok: true };
  }

  window.__reproFullpageCapture = {
    stateKey: STATE_KEY,
    prepareFullpageCapture,
    getFullpageMetrics,
    scrollToFullpagePosition,
    restoreFullpagePageState,
    resetFullpageCaptureState,
  };
})();
