(() => {
  if (window.__reproPanelOverlays) {
    return;
  }

  const overlays = new Map();

  const buildPanel = (panel) => {
    const root = document.createElement("div");
    root.className = `repro-panel-overlay repro-panel-${panel}`;
    root.setAttribute("data-repro-panel", panel);
    root.setAttribute("data-repro-hidden", "false");

    const header = document.createElement("div");
    header.className = "repro-panel-header";

    const brand = document.createElement("div");
    brand.className = "repro-panel-brand";
    const title = document.createElement("div");
    title.className = "repro-panel-title";
    title.textContent = "Repro";
    const subtitle = document.createElement("div");
    subtitle.className = "repro-panel-subtitle";
    subtitle.textContent = panel === "recording" ? "Recording" : "Logs";
    brand.appendChild(title);
    brand.appendChild(subtitle);

    const closeBtn = document.createElement("button");
    closeBtn.className = "repro-panel-close";
    closeBtn.type = "button";
    closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", () => {
      root.style.display = "none";
      try {
        chrome.runtime.sendMessage({
          type: "PANEL_OVERLAY_CLOSED",
          panel,
        });
      } catch (error) {
        // Ignore overlay close telemetry failures.
      }
    });

    header.appendChild(brand);
    header.appendChild(closeBtn);

    const body = document.createElement("div");
    body.className = "repro-panel-body";

    const frame = document.createElement("iframe");
    frame.className = "repro-panel-frame";
    const src =
      panel === "recording"
        ? "popup/recording_panel.html?embedded=1"
        : "popup/logs_panel.html?embedded=1";
    frame.src = chrome.runtime.getURL(src);
    frame.title = panel === "recording" ? "Repro Recording Panel" : "Repro Logs Panel";
    frame.setAttribute("aria-label", frame.title);

    body.appendChild(frame);
    root.appendChild(header);
    root.appendChild(body);

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const onMove = (event) => {
      if (!isDragging) {
        return;
      }
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      const nextLeft = Math.max(8, startLeft + dx);
      const nextTop = Math.max(8, startTop + dy);
      root.style.left = `${nextLeft}px`;
      root.style.top = `${nextTop}px`;
      root.style.right = "auto";
      root.style.bottom = "auto";
    };

    const onUp = () => {
      if (!isDragging) {
        return;
      }
      isDragging = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    header.addEventListener("mousedown", (event) => {
      isDragging = true;
      startX = event.clientX;
      startY = event.clientY;
      const rect = root.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });

    document.documentElement.appendChild(root);
    return root;
  };

  const showPanel = (panel) => {
    let root = overlays.get(panel);
    if (!root) {
      root = buildPanel(panel);
      overlays.set(panel, root);
    }
    root.style.display = "block";
  };

  const mountPanel = (panel) => {
    let root = overlays.get(panel);
    if (!root) {
      root = buildPanel(panel);
      overlays.set(panel, root);
    }
    root.style.display = "none";
  };

  const hidePanel = (panel) => {
    const root = overlays.get(panel);
    if (!root) {
      return;
    }
    root.style.display = "none";
  };

  const setHidden = (panel, hidden) => {
    let root = overlays.get(panel);
    if (!root) {
      root = buildPanel(panel);
      overlays.set(panel, root);
    }
    root.setAttribute("data-repro-hidden", hidden ? "true" : "false");
    if (!hidden && root.style.display === "none") {
      root.style.display = "block";
    }
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== "REPRO_PANEL_OVERLAY") {
      return false;
    }
    try {
      if (message.action === "show") {
        showPanel(message.panel);
        sendResponse({ ok: true, panel: message.panel, action: "show" });
        return true;
      }
      if (message.action === "mount") {
        mountPanel(message.panel);
        sendResponse({ ok: true, panel: message.panel, action: "mount" });
        return true;
      }
      if (message.action === "set_hidden") {
        setHidden(message.panel, message.hidden === true);
        sendResponse({
          ok: true,
          panel: message.panel,
          action: "set_hidden",
          hidden: message.hidden === true,
        });
        return true;
      }
      if (message.action === "hide") {
        hidePanel(message.panel);
        sendResponse({ ok: true, panel: message.panel, action: "hide" });
        return true;
      }
      sendResponse({ ok: false, error: "Unknown overlay action." });
      return true;
    } catch (error) {
      sendResponse({
        ok: false,
        error: error && error.message ? error.message : String(error),
      });
      return true;
    }
  });

  window.__reproPanelOverlays = { showPanel, hidePanel, setHidden };
})();
