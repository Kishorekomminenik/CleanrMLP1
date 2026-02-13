const STATE_KEY = "__reproFullpageState";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getState() {
  if (!window[STATE_KEY]) {
    window[STATE_KEY] = {
      applied: false,
      originalScrollY: 0,
      originalHtmlScrollBehavior: null,
      originalBodyScrollBehavior: null,
      hiddenElements: [],
      styleEl: null,
    };
  }
  return window[STATE_KEY];
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

function applyCaptureStyles() {
  const state = getState();
  if (state.applied) {
    return;
  }
  const doc = document.documentElement;
  const body = document.body;
  state.originalScrollY = window.scrollY;
  state.originalHtmlScrollBehavior = doc.style.scrollBehavior;
  state.originalBodyScrollBehavior = body ? body.style.scrollBehavior : null;
  doc.style.scrollBehavior = "auto";
  if (body) {
    body.style.scrollBehavior = "auto";
  }
  const styleEl = document.createElement("style");
  styleEl.setAttribute("data-repro-fullpage-style", "true");
  styleEl.textContent = `
    * { scroll-behavior: auto !important; }
    *, *::before, *::after { animation: none !important; transition: none !important; }
  `;
  doc.appendChild(styleEl);
  state.styleEl = styleEl;
  state.hiddenElements = hideFixedSticky();
  state.applied = true;
}

function restoreCaptureStyles() {
  const state = getState();
  if (!state.applied) {
    return;
  }
  const doc = document.documentElement;
  const body = document.body;
  if (state.styleEl) {
    state.styleEl.remove();
  }
  if (state.hiddenElements && state.hiddenElements.length) {
    state.hiddenElements.forEach((entry) => {
      entry.el.style.visibility = entry.visibility || "";
      entry.el.style.opacity = entry.opacity || "";
    });
  }
  doc.style.scrollBehavior = state.originalHtmlScrollBehavior || "";
  if (body) {
    body.style.scrollBehavior = state.originalBodyScrollBehavior || "";
  }
  window.scrollTo(0, state.originalScrollY || 0);
  state.applied = false;
  state.hiddenElements = [];
  state.styleEl = null;
}

function getMetrics() {
  const doc = document.documentElement;
  const body = document.body;
  return {
    scrollHeight: Math.max(doc.scrollHeight, body?.scrollHeight || 0),
    scrollWidth: Math.max(doc.scrollWidth, body?.scrollWidth || 0),
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
    devicePixelRatio: window.devicePixelRatio || 1,
    scrollY: window.scrollY,
  };
}

async function scrollToY(targetY) {
  window.scrollTo(0, targetY);
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await sleep(160);
  return { scrollY: window.scrollY };
}

chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  try {
    if (msg?.type === "FP_APPLY_STYLES") {
      applyCaptureStyles();
      sendResponse({ ok: true });
      return true;
    }
    if (msg?.type === "FP_GET_METRICS") {
      sendResponse({ ok: true, metrics: getMetrics() });
      return true;
    }
    if (msg?.type === "FP_SCROLL_TO") {
      scrollToY(msg.y || 0)
        .then((result) => sendResponse({ ok: true, ...result }))
        .catch((error) =>
          sendResponse({ ok: false, error: error?.message || "Scroll failed." })
        );
      return true;
    }
    if (msg?.type === "FP_RESTORE") {
      restoreCaptureStyles();
      sendResponse({ ok: true });
      return true;
    }
  } catch (error) {
    sendResponse({ ok: false, error: error?.message || "Full page helper failed." });
    return true;
  }
  return false;
});
