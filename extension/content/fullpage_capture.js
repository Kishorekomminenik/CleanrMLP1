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

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) {
      return false;
    }
    if (message.type === "FULLPAGE_PREPARE") {
      originalScrollY = window.scrollY || 0;
      const metrics = getPageMetrics();
      const scrollPositions = buildScrollPositions(
        metrics.scrollHeight,
        metrics.viewportHeight
      );
      sendResponse({
        ok: true,
        ...metrics,
        scrollPositions,
        originalScrollY,
      });
      return false;
    }
    if (message.type === "FULLPAGE_SCROLL") {
      const targetY = typeof message.y === "number" ? message.y : 0;
      window.scrollTo(0, targetY);
      setTimeout(() => {
        sendResponse({ ok: true, y: window.scrollY || 0 });
      }, 120);
      return true;
    }
    if (message.type === "FULLPAGE_FINISH") {
      window.scrollTo(0, originalScrollY || 0);
      setTimeout(() => {
        sendResponse({ ok: true });
      }, 60);
      return true;
    }
    return false;
  });
})();
