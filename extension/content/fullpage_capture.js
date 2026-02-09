(() => {
  let originalScrollY = 0;

  function getDocumentElement() {
    return document.scrollingElement || document.documentElement || document.body;
  }

  function getPageMetrics() {
    const element = getDocumentElement();
    const scrollHeight = Math.max(
      element.scrollHeight,
      document.body ? document.body.scrollHeight : 0
    );
    const viewportHeight = window.innerHeight || element.clientHeight || 0;
    const viewportWidth = window.innerWidth || element.clientWidth || 0;
    return {
      scrollHeight,
      viewportHeight,
      viewportWidth,
      devicePixelRatio: window.devicePixelRatio || 1,
    };
  }

  function buildScrollPositions(scrollHeight, viewportHeight) {
    const positions = [];
    if (!scrollHeight || !viewportHeight) {
      return positions;
    }
    const maxScrollY = Math.max(0, scrollHeight - viewportHeight);
    let current = 0;
    while (current < maxScrollY) {
      positions.push(current);
      current += viewportHeight;
    }
    positions.push(maxScrollY);
    return positions;
  }

  const freezeStyleId = "repro-fullpage-freeze-style";
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) {
      return false;
    }
    if (message.type === "FP_GET_PLAN") {
      originalScrollY = window.scrollY || 0;
      const doc = document.documentElement;
      const body = document.body;
      const pageW = Math.max(
        doc.scrollWidth,
        body ? body.scrollWidth : 0,
        doc.clientWidth
      );
      const pageH = Math.max(
        doc.scrollHeight,
        body ? body.scrollHeight : 0,
        doc.clientHeight
      );
      const viewportW = window.innerWidth || doc.clientWidth || 0;
      const viewportH = window.innerHeight || doc.clientHeight || 0;
      const dpr = window.devicePixelRatio || 1;

      const steps = [];
      let y = 0;
      while (y < pageH) {
        steps.push({ y });
        y += viewportH;
      }
      if (steps.length > 0) {
        const lastIndex = steps.length - 1;
        const maxScrollY = Math.max(0, pageH - viewportH);
        if (steps[lastIndex].y > maxScrollY) {
          steps[lastIndex].y = maxScrollY;
        } else if (steps[lastIndex].y < maxScrollY) {
          steps.push({ y: maxScrollY });
        }
      }

      sendResponse({
        ok: true,
        plan: {
          viewportW,
          viewportH,
          pageW,
          pageH,
          devicePixelRatio: dpr,
          scrollY0: originalScrollY,
          steps,
        },
      });
      return false;
    }
    if (message.type === "FP_SCROLL_TO") {
      const targetY = typeof message.y === "number" ? message.y : 0;
      window.scrollTo(0, targetY);
      sendResponse({ ok: true });
      return false;
    }
    if (message.type === "FP_RESTORE_SCROLL") {
      window.scrollTo(0, originalScrollY || 0);
      sendResponse({ ok: true });
      return false;
    }
    if (message.type === "FP_FREEZE_UI") {
      const freeze = Boolean(message.freeze);
      if (freeze) {
        if (!document.getElementById(freezeStyleId)) {
          const style = document.createElement("style");
          style.id = freezeStyleId;
          style.textContent =
            "*{scroll-behavior:auto !important;animation:none !important;transition:none !important;caret-color:transparent !important;}";
          document.documentElement.appendChild(style);
        }
      } else {
        const style = document.getElementById(freezeStyleId);
        if (style && style.parentNode) {
          style.parentNode.removeChild(style);
        }
      }
      sendResponse({ ok: true });
      return false;
    }
    return false;
  });
})();
