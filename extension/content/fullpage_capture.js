function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function captureViewport() {
  const response = await chrome.runtime.sendMessage({ type: "FP_CAPTURE_VIEWPORT" });
  if (typeof response === "string") {
    return response;
  }
  if (response && response.dataUrl) {
    return response.dataUrl;
  }
  throw new Error(response && response.error ? response.error : "CAPTURE_DENIED");
}

async function captureAll() {
  const height = document.documentElement.scrollHeight;
  const width = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  const frames = [];
  const originalY = window.scrollY;

  if (!height || !width || !vh) {
    return { ok: false, code: "PLAN_FAILED", error: "Unable to read page size." };
  }

  try {
    for (let y = 0; y < height; y += vh) {
      window.scrollTo(0, y);
      await sleep(120);
      frames.push(await captureViewport());
    }
  } catch (error) {
    return {
      ok: false,
      code: "CAPTURE_DENIED",
      error: error && error.message ? error.message : String(error),
    };
  }

  window.scrollTo(0, originalY);
  return { ok: true, frames, width, totalHeight: height, devicePixelRatio: dpr };
}

chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  if (msg?.type === "FP_CAPTURE_ALL") {
    captureAll()
      .then(sendResponse)
      .catch((e) =>
        sendResponse({ ok: false, error: e && e.message ? e.message : String(e) })
      );
    return true;
  }
  return false;
});
