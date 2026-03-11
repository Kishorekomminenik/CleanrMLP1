// FULL-PAGE CAPTURE V1 LOCKED
// DO NOT MODIFY WITHOUT TESTING SHORT + LONG PAGE.
(() => {
  if (window.__REPRO_FULLPAGE_CAPTURE_LOADED__) {
    return;
  }
  window.__REPRO_FULLPAGE_CAPTURE_LOADED__ = true;

  const STATE_KEY = "__reproFullpageState__";
  const STYLE_ID = "__repro_fullpage_style__";
  const SCROLL_TOLERANCE_PX = 4;
  const SETTLE_DELAY_MS = 180;
  const MIN_SCROLLABLE_HEIGHT = 200;
  const SINGLE_FRAME_DELTA = 8;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function buildBaseState() {
    return {
      applied: false,
      originalScrollY: null,
      originalHtmlScrollBehavior: null,
      originalBodyScrollBehavior: null,
      hiddenElements: [],
      nestedScrollOverrides: [],
      styleTagId: STYLE_ID,
      captureRunId: null,
      lastMetrics: null,
      scrollEngine: {
        selectedKey: null,
        selectedType: null,
        candidates: [],
        originalPositions: {},
        lastSuccessfulScrollTop: null,
      },
    };
  }

  function getState() {
    if (!window[STATE_KEY]) {
      window[STATE_KEY] = buildBaseState();
    }
    return window[STATE_KEY];
  }

  function resetState() {
    window[STATE_KEY] = buildBaseState();
  }

  function collectFixedStickyElements() {
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
      }
    });
    return hidden;
  }

  function suppressFixedStickyElements() {
    const state = getState();
    if (!state.hiddenElements || !state.hiddenElements.length) {
      return { ok: true, count: 0 };
    }
    state.hiddenElements.forEach((entry) => {
      if (!entry || !entry.el) {
        return;
      }
      entry.el.style.visibility = "hidden";
      entry.el.style.opacity = "0";
    });
    return { ok: true, count: state.hiddenElements.length };
  }

  function freezeNestedScrollContainers(selectedKey) {
    const state = getState();
    const overrides = [];
    const candidates = state.scrollEngine.candidates || [];
    const selected = candidates.find((item) => item.key === selectedKey) || null;
    candidates.forEach((candidate) => {
      if (!candidate || candidate.type !== "element") {
        return;
      }
      const el = candidate.element;
      if (!el || !isVisibleElement(el)) {
        return;
      }
      if (selected && selected.element === el) {
        return;
      }
      overrides.push({
        el,
        overflow: el.style.overflow,
        overflowY: el.style.overflowY,
        overflowX: el.style.overflowX,
        maxHeight: el.style.maxHeight,
        height: el.style.height,
        scrollTop: el.scrollTop,
      });
      el.style.overflow = "visible";
      el.style.overflowY = "visible";
      el.style.overflowX = "visible";
      el.style.maxHeight = "none";
      el.style.height = "auto";
    });
    state.nestedScrollOverrides = overrides;
    return overrides.length;
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

  function isVisibleElement(el) {
    if (!el || el.nodeType !== 1) {
      return false;
    }
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    if (el.clientHeight <= 0 || el.clientWidth <= 0) {
      return false;
    }
    return true;
  }

  function getScrollableCandidates() {
    const candidates = [];
    const seen = new Set();
    const addCandidate = (key, type, element) => {
      if (!element || seen.has(element)) {
        return;
      }
      seen.add(element);
      const scrollHeight = element.scrollHeight || 0;
      const clientHeight = element.clientHeight || 0;
      const delta = scrollHeight - clientHeight;
      candidates.push({
        key,
        type,
        element,
        scrollHeight,
        clientHeight,
        delta,
        canScroll: delta > SINGLE_FRAME_DELTA,
      });
    };
    const scrollingElement = document.scrollingElement || document.documentElement;
    addCandidate("scrollingElement", "document", scrollingElement);
    addCandidate("documentElement", "document", document.documentElement);
    if (document.body) {
      addCandidate("body", "document", document.body);
    }
    const nodes = Array.from(document.querySelectorAll("*"));
    const elementCandidates = [];
    nodes.forEach((el, index) => {
      if (!isVisibleElement(el)) {
        return;
      }
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      if (!["auto", "scroll", "overlay"].includes(overflowY)) {
        return;
      }
      if (el.scrollHeight <= el.clientHeight + SINGLE_FRAME_DELTA) {
        return;
      }
      const key = el.id ? `el#${el.id}` : `el@${index}`;
      elementCandidates.push({
        key,
        type: "element",
        element: el,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        delta: el.scrollHeight - el.clientHeight,
        canScroll: true,
      });
    });
    const filtered = elementCandidates.filter(
      (candidate) => candidate.clientHeight >= MIN_SCROLLABLE_HEIGHT
    );
    const list = filtered.length ? filtered : elementCandidates;
    list.sort((a, b) => {
      if (b.delta !== a.delta) {
        return b.delta - a.delta;
      }
      return b.clientHeight - a.clientHeight;
    });
    list.forEach((candidate) => {
      if (!seen.has(candidate.element)) {
        seen.add(candidate.element);
        candidates.push(candidate);
      }
    });
    return candidates.map((candidate) => ({
      ...candidate,
    }));
  }

  function readScrollTop(candidate) {
    if (candidate.type === "document") {
      return window.scrollY || 0;
    }
    return candidate.element ? candidate.element.scrollTop || 0 : 0;
  }

  function writeScrollTop(candidate, value) {
    if (candidate.type === "document") {
      window.scrollTo(0, value);
      return;
    }
    if (candidate.element) {
      candidate.element.scrollTop = value;
    }
  }

  function readScrollHeight(candidate) {
    if (!candidate || !candidate.element) {
      return 0;
    }
    return candidate.element.scrollHeight || 0;
  }

  function readClientHeight(candidate) {
    if (candidate.type === "document") {
      return window.innerHeight || 0;
    }
    return candidate.element ? candidate.element.clientHeight || 0 : 0;
  }

  async function tryScrollTarget(candidate, targetY) {
    const before = readScrollTop(candidate);
    writeScrollTop(candidate, targetY);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await sleep(SETTLE_DELAY_MS);
    const after = readScrollTop(candidate);
    const delta = Math.abs(after - targetY);
    const moved = delta <= SCROLL_TOLERANCE_PX;
    const locked =
      Math.abs(after - before) <= SCROLL_TOLERANCE_PX &&
      Math.abs(targetY - before) > SCROLL_TOLERANCE_PX;
    return {
      ok: moved,
      before,
      after,
      locked,
    };
  }

  async function selectWorkingScrollTarget(initialY = 0) {
    const state = getState();
    const candidates = getScrollableCandidates();
    state.scrollEngine.candidates = candidates;
    state.scrollEngine.originalPositions = {};
    candidates.forEach((candidate) => {
      state.scrollEngine.originalPositions[candidate.key] = readScrollTop(candidate);
    });
    if (!candidates.length) {
      return { ok: false, code: "FULLPAGE_ERR_SCROLL_LOCKED", details: [] };
    }
    let lockedCount = 0;
    for (const candidate of candidates) {
      const scrollHeight = readScrollHeight(candidate);
      const clientHeight = readClientHeight(candidate);
      const delta = scrollHeight - clientHeight;
      if (delta <= SINGLE_FRAME_DELTA) {
        state.scrollEngine.selectedKey = candidate.key;
        state.scrollEngine.selectedType = candidate.type;
        state.scrollEngine.lastSuccessfulScrollTop = readScrollTop(candidate);
        return { ok: true, candidate, singleFrame: true };
      }
      const maxScrollY = Math.max(0, delta);
      const testY = Math.min(Math.max(1, initialY), maxScrollY);
      const result = await tryScrollTarget(candidate, testY);
      if (result.ok) {
        state.scrollEngine.selectedKey = candidate.key;
        state.scrollEngine.selectedType = candidate.type;
        state.scrollEngine.lastSuccessfulScrollTop = result.after;
        return { ok: true, candidate, singleFrame: false };
      }
      if (result.locked) {
        lockedCount += 1;
      }
    }
    return {
      ok: false,
      code:
        lockedCount > 0 && lockedCount === candidates.length
          ? "FULLPAGE_ERR_SCROLL_LOCKED"
          : "FULLPAGE_ERR_SCROLL_MISMATCH",
      details: candidates.map((candidate) => candidate.key),
    };
  }

  async function prepareFullpageCapture(captureRunId) {
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
    state.hiddenElements = collectFixedStickyElements();
    state.applied = true;
    state.captureRunId = captureRunId || state.captureRunId || String(Date.now());
    const selection = await selectWorkingScrollTarget(0);
    if (!selection.ok) {
      return {
        ok: false,
        error: "Unable to find a scroll container.",
        code: selection.code,
        details: selection.details,
      };
    }
    if (selection && selection.candidate) {
      freezeNestedScrollContainers(selection.candidate.key);
    }
    return { ok: true, captureRunId: state.captureRunId };
  }

  function getFullpageMetrics() {
    const state = getState();
    if (!state.scrollEngine.selectedKey) {
      return { ok: false, error: "Scroll target not selected." };
    }
    const candidate = state.scrollEngine.candidates.find(
      (item) => item.key === state.scrollEngine.selectedKey
    );
    if (!candidate) {
      return { ok: false, error: "Scroll target not found." };
    }
    const scrollHeight = readScrollHeight(candidate);
    const clientHeight = readClientHeight(candidate);
    const scrollWidth = candidate.element ? candidate.element.scrollWidth : 0;
    const clientWidth =
      candidate.type === "document" ? window.innerWidth : candidate.element.clientWidth;
    const metrics = {
      scrollHeight,
      clientHeight,
      scrollWidth,
      clientWidth,
      devicePixelRatio: window.devicePixelRatio || 1,
      scrollTop: readScrollTop(candidate),
      selectedKey: candidate.key,
      selectedType: candidate.type,
      singleFrame: scrollHeight - clientHeight <= SINGLE_FRAME_DELTA,
    };
    state.lastMetrics = metrics;
    return { ok: true, metrics };
  }

  function getFullpagePageState() {
    const state = getState();
    const selectedKey = state.scrollEngine.selectedKey;
    const selectedType = state.scrollEngine.selectedType;
    const candidate =
      selectedKey && state.scrollEngine.candidates.length
        ? state.scrollEngine.candidates.find((item) => item.key === selectedKey)
        : null;
    const fallbackElement =
      document.scrollingElement || document.documentElement || document.body;
    const element = candidate && candidate.element ? candidate.element : fallbackElement;
    const type = candidate ? candidate.type : selectedType || "document";
    const key = candidate ? candidate.key : selectedKey || "scrollingElement";
    const scrollHeight =
      type === "document"
        ? document.documentElement.scrollHeight || 0
        : element
          ? element.scrollHeight || 0
          : 0;
    const clientHeight =
      type === "document"
        ? window.innerHeight || 0
        : element
          ? element.clientHeight || 0
          : 0;
    const scrollTop =
      type === "document" ? window.scrollY || 0 : element ? element.scrollTop || 0 : 0;
    const overflowY =
      element && element.nodeType === 1
        ? window.getComputedStyle(element).overflowY
        : "";
    const bodyOverflowY =
      document.body && document.body.nodeType === 1
        ? window.getComputedStyle(document.body).overflowY
        : "";
    return {
      ok: true,
      state: {
        scrollHeight,
        clientHeight,
        scrollTop,
        overflowY,
        bodyOverflowY,
        key,
        type,
      },
    };
  }

  async function sampleFullpageMetrics(settleMs = 0) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (settleMs > 0) {
      await sleep(settleMs);
    }
    return getFullpagePageState();
  }

  async function scrollToFullpagePosition(targetY) {
    const state = getState();
    if (!state.scrollEngine.selectedKey) {
      const selection = await selectWorkingScrollTarget(targetY);
      if (!selection.ok) {
        return {
          ok: false,
          error: "Scroll target unavailable.",
          code: selection.code,
          details: selection.details,
        };
      }
    }
    const candidates = state.scrollEngine.candidates;
    const selected = candidates.find(
      (item) => item.key === state.scrollEngine.selectedKey
    );
    const tryCandidate = async (candidate) => {
      const maxScrollY = Math.max(0, readScrollHeight(candidate) - readClientHeight(candidate));
      const target = Math.min(Math.max(0, targetY), maxScrollY);
      return await tryScrollTarget(candidate, target);
    };
    const result = selected ? await tryCandidate(selected) : { ok: false };
    if (result.ok && selected) {
      state.scrollEngine.lastSuccessfulScrollTop = result.after;
      return { ok: true, scrollY: result.after };
    }
    let lockedCount = result.locked ? 1 : 0;
    for (const candidate of candidates) {
      if (!selected || candidate.key === selected.key) {
        continue;
      }
      const attempt = await tryCandidate(candidate);
      if (attempt.ok) {
        state.scrollEngine.selectedKey = candidate.key;
        state.scrollEngine.selectedType = candidate.type;
        state.scrollEngine.lastSuccessfulScrollTop = attempt.after;
        return { ok: true, scrollY: attempt.after, fallback: true };
      }
      if (attempt.locked) {
        lockedCount += 1;
      }
    }
    return {
      ok: false,
      error: "Scroll mismatch.",
      code:
        lockedCount > 0 && lockedCount === candidates.length
          ? "FULLPAGE_ERR_SCROLL_LOCKED"
          : "FULLPAGE_ERR_SCROLL_MISMATCH",
      details: candidates.map((candidate) => candidate.key),
    };
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
    if (state.nestedScrollOverrides && state.nestedScrollOverrides.length) {
      state.nestedScrollOverrides.forEach((entry) => {
        if (!entry || !entry.el) {
          return;
        }
        entry.el.style.overflow = entry.overflow || "";
        entry.el.style.overflowY = entry.overflowY || "";
        entry.el.style.overflowX = entry.overflowX || "";
        entry.el.style.maxHeight = entry.maxHeight || "";
        entry.el.style.height = entry.height || "";
        if (typeof entry.scrollTop === "number") {
          entry.el.scrollTop = entry.scrollTop;
        }
      });
    }
    doc.style.scrollBehavior = state.originalHtmlScrollBehavior || "";
    if (body) {
      body.style.scrollBehavior = state.originalBodyScrollBehavior || "";
    }
    Object.entries(state.scrollEngine.originalPositions || {}).forEach(
      ([key, value]) => {
        const candidate = state.scrollEngine.candidates.find(
          (item) => item.key === key
        );
        if (!candidate || typeof value !== "number") {
          return;
        }
        writeScrollTop(candidate, value);
      }
    );
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
    const state = getState();
    if (state.applied) {
      restoreFullpagePageState();
    }
    resetState();
    return { ok: true };
  }

  window.__reproFullpageCapture = {
    stateKey: STATE_KEY,
    prepareFullpageCapture,
    getFullpageMetrics,
    getFullpagePageState,
    sampleFullpageMetrics,
    getScrollableCandidates,
    scrollToFullpagePosition,
    suppressFixedStickyElements,
    restoreFullpagePageState,
    resetFullpageCaptureState,
  };
})();
