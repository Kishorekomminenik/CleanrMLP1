(() => {
  if (window.__debugduckViewerBootstrapped) {
    return;
  }
  window.__debugduckViewerBootstrapped = true;
  const script = document.createElement("script");
  script.src = "./app.js";
  script.defer = true;
  document.head.appendChild(script);
})();
