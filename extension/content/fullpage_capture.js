let CAPTURE_LOCK = false;
let captureState = {
  cancelled: false,
  originalY: 0,
  scrollBehavior: null,
  styleEl: null,
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function captureViewportThrottled() {
  if (CAPTURE_LOCK) {
    await sleep(200);
  }
  CAPTURE_LOCK = true;
  try {
    const dataUrl = await chrome.runtime.sendMessage({ type: "FP_CAPTURE_VIEWPORT" });
    if (dataUrl && dataUrl.ok === false) {
      const error = new Error(dataUrl.error || "Capture failed.");
      error.code = "CAPTURE_DENIED";
      throw error;
    }
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
      throw new Error("Invalid viewport capture result");
    }
    return dataUrl;
  } finally {
    await sleep(200);
    CAPTURE_LOCK = false;
  }
}

function applyCaptureOverrides() {
  const doc = document.documentElement;
  captureState.originalY = window.scrollY;
  captureState.scrollBehavior = doc.style.scrollBehavior;
  doc.style.scrollBehavior = "auto";
  const styleEl = document.createElement("style");
  styleEl.setAttribute("data-repro-fullpage-freeze", "true");
  styleEl.textContent =
    "*{scroll-behavior:auto!important;transition:none!important;animation:none!important;}";
  doc.appendChild(styleEl);
  captureState.styleEl = styleEl;
}

function restoreCaptureOverrides() {
  const doc = document.documentElement;
  if (captureState.scrollBehavior !== null) {
    doc.style.scrollBehavior = captureState.scrollBehavior;
  }
  if (captureState.styleEl) {
    captureState.styleEl.remove();
  }
  window.scrollTo(0, captureState.originalY || 0);
  captureState = {
    cancelled: false,
    originalY: 0,
    scrollBehavior: null,
    styleEl: null,
  };
}

function getMetrics() {
  const doc = document.documentElement;
  const body = document.body;
  return {
    scrollHeight: Math.max(doc.scrollHeight, body?.scrollHeight || 0),
    viewportH: window.innerHeight,
    viewportW: window.innerWidth,
    width: Math.max(doc.clientWidth, doc.scrollWidth, body?.scrollWidth || 0),
    dpr: window.devicePixelRatio || 1,
  };
}

async function waitForScroll(targetY) {
  window.scrollTo(0, targetY);
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await sleep(180);
  const currentY = Math.round(window.scrollY);
  if (Math.abs(currentY - targetY) <= 2) {
    return;
  }
  await sleep(150);
  const retryY = Math.round(window.scrollY);
  if (Math.abs(retryY - targetY) <= 2) {
    return;
  }
  const error = new Error("Scroll mismatch");
  error.code = "SCROLL_MISMATCH";
  throw error;
}

function buildScrollPlan(scrollHeight, viewportH, overlap = 80) {
  const step = Math.max(1, viewportH - overlap);
  const positions = [];
  let y = 0;
  while (y < scrollHeight - viewportH) {
    positions.push(y);
    y += step;
  }
  positions.push(Math.max(0, scrollHeight - viewportH));
  return positions;
}

async function captureAllFrames(jobId) {
  const { scrollHeight, viewportH, viewportW, dpr } = getMetrics();
  const scrollHeightStart = scrollHeight;
  const overlap = 80;
  const positions = buildScrollPlan(scrollHeightStart, viewportH, overlap);
  const frames = [];
  captureState.cancelled = false;
  applyCaptureOverrides();
  try {
    for (let i = 0; i < positions.length; i += 1) {
      if (captureState.cancelled) {
        const error = new Error("Capture cancelled");
        error.code = "CANCELLED";
        throw error;
      }
      const y = positions[i];
      await waitForScroll(y);
      if (captureState.cancelled) {
        const error = new Error("Capture cancelled");
        error.code = "CANCELLED";
        throw error;
      }
      const dataUrl = await captureViewportThrottled();
      const clipTop = i === 0 ? 0 : overlap;
      const remaining = scrollHeightStart - y - clipTop;
      const clipHeight = Math.max(0, Math.min(viewportH - clipTop, remaining));
      if (clipHeight <= 0) {
        continue;
      }
      const frame = {
        dataUrl,
        y: Math.round(y * dpr),
        width: Math.round(viewportW * dpr),
        height: Math.round(viewportH * dpr),
        clipTop: Math.round(clipTop * dpr),
        clipHeight: Math.round(clipHeight * dpr),
      };
      frames.push(frame);
      chrome.runtime.sendMessage({
        type: "FP_CAPTURE_PROGRESS",
        jobId,
        stage: "capture",
        current: i + 1,
        total: positions.length,
      });
    }
    const scrollHeightEnd = getMetrics().scrollHeight;
    return {
      ok: true,
      frames,
      width: Math.round(viewportW * dpr),
      totalHeight: Math.round(scrollHeightStart * dpr),
      viewportH: Math.round(viewportH * dpr),
      viewportW: Math.round(viewportW * dpr),
      scrollHeightStart,
      scrollHeightEnd,
      devicePixelRatio: dpr,
    };
  } finally {
    restoreCaptureOverrides();
  }
}

chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  if (msg?.type === "FP_CAPTURE_CANCEL") {
    captureState.cancelled = true;
    sendResponse({ ok: true });
    return true;
  }
  if (msg?.type === "FP_CAPTURE_ALL") {
    captureAllFrames(msg.jobId)
      .then(sendResponse)
      .catch((e) =>
        sendResponse({
          ok: false,
          error: {
            code: e && e.code ? e.code : "CAPTURE_FAILED",
            message: e && e.message ? e.message : "Capture failed.",
          },
        })
      );
    return true;
  }
  return false;
});
