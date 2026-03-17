(() => {
  if (window.__debugduckViewerBootstrapped) {
    return;
  }
  window.__debugduckViewerBootstrapped = true;
  console.log("[DebugDuck Viewer] boot start");
  const loadApp = () => {
    const script = document.createElement("script");
    script.src = "./app.js";
    script.defer = true;
    document.head.appendChild(script);
  };
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        console.log("[DebugDuck Viewer] DOM ready");
        loadApp();
      },
      { once: true }
    );
  } else {
    console.log("[DebugDuck Viewer] DOM ready");
    loadApp();
  }
})();
