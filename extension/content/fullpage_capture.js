let CAPTURE_LOCK = false;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function captureViewportThrottled() {
  if (CAPTURE_LOCK) {
    await sleep(800);
  }

  CAPTURE_LOCK = true;
  try {
    const dataUrl = await chrome.runtime.sendMessage({ type: "FP_CAPTURE_VIEWPORT" });
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
      throw new Error("Invalid viewport capture result");
    }
    return dataUrl;
  } finally {
    await sleep(700);
    CAPTURE_LOCK = false;
  }
}

function getMetrics() {
  const doc = document.documentElement;
  const body = document.body;
  return {
    scrollHeight: Math.max(doc.scrollHeight, body?.scrollHeight || 0),
    viewportH: window.innerHeight,
    width: Math.max(doc.clientWidth, doc.scrollWidth, body?.scrollWidth || 0),
  };
}

async function captureAllFrames() {
  const { scrollHeight, viewportH, width } = getMetrics();
  const frames = [];
  const originalY = window.scrollY;

  for (let y = 0; y < scrollHeight; y += viewportH) {
    window.scrollTo(0, y);
    await sleep(400);

    try {
      const frame = await captureViewportThrottled();
      frames.push(frame);
    } catch (e) {
      console.warn("Viewport capture retry", e);
      await sleep(1000);
      const retry = await captureViewportThrottled();
      frames.push(retry);
    }
  }

  window.scrollTo(0, originalY);

  return {
    frames,
    width: Math.min(width, window.innerWidth),
    totalHeight: frames.length * viewportH,
  };
}

chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  if (msg?.type === "FP_CAPTURE_ALL") {
    captureAllFrames()
      .then(sendResponse)
      .catch((e) => sendResponse({ error: String(e?.message || e) }));
    return true;
  }
  return false;
});
