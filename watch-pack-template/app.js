const packMeta = document.getElementById("packMeta");
const timeline = document.getElementById("timeline");
const timelineTicks = document.getElementById("timelineTicks");
const currentTimeLabel = document.getElementById("currentTime");
const durationLabel = document.getElementById("durationLabel");
const eventList = document.getElementById("eventList");
const detailsBody = document.getElementById("detailsBody");
const videoPanel = document.getElementById("videoPanel");
const videoEl = document.getElementById("videoEl");
const videoPlay = document.getElementById("videoPlay");
const videoTime = document.getElementById("videoTime");
const videoSyncNote = document.getElementById("videoSyncNote");
const autoFollow = document.getElementById("autoFollow");
const filterMarkers = document.getElementById("filterMarkers");
const filterNetwork = document.getElementById("filterNetwork");
const filterConsole = document.getElementById("filterConsole");
const filterScreenshots = document.getElementById("filterScreenshots");
const filterErrors = document.getElementById("filterErrors");
const searchInput = document.getElementById("searchInput");

const state = {
  session: null,
  events: [],
  filtered: [],
  currentTms: 0,
  durationMs: 0,
  selectedEventId: null,
  autoFollow: true,
  videoAvailable: false,
  videoSyncAvailable: false,
  screenshots: new Map(),
};

const EVENT_ICONS = {
  marker: "M",
  network: "N",
  console: "C",
  screenshot: "S",
  session: "I",
};

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function setPackMeta(text) {
  if (packMeta) {
    packMeta.textContent = text;
  }
}

function buildFilters() {
  return {
    marker: filterMarkers.checked,
    network: filterNetwork.checked,
    console: filterConsole.checked,
    screenshot: filterScreenshots.checked,
    errorsOnly: filterErrors.checked,
    query: searchInput.value.trim().toLowerCase(),
  };
}

function filterEvents(events) {
  const filters = buildFilters();
  return events.filter((ev) => {
    if (ev.t_ms > state.currentTms) {
      return false;
    }
    if (!filters[ev.type]) {
      return false;
    }
    if (filters.errorsOnly && !ev.isError) {
      return false;
    }
    if (filters.query) {
      const haystack = `${ev.summary} ${JSON.stringify(ev.payload || {})}`.toLowerCase();
      if (!haystack.includes(filters.query)) {
        return false;
      }
    }
    return true;
  });
}

function renderTimelineTicks(events) {
  timelineTicks.innerHTML = "";
  if (!state.durationMs) {
    return;
  }
  events.forEach((ev) => {
    if (ev.type === "marker" || ev.type === "screenshot" || ev.isError) {
      const tick = document.createElement("div");
      tick.className = "timeline-tick";
      if (ev.isError) {
        tick.classList.add("error");
      }
      const left = (ev.t_ms / state.durationMs) * 100;
      tick.style.left = `${left}%`;
      timelineTicks.appendChild(tick);
    }
  });
}

function renderEventList() {
  eventList.innerHTML = "";
  state.filtered.forEach((ev) => {
    const item = document.createElement("div");
    item.className = "event-item";
    if (state.selectedEventId === ev.id) {
      item.classList.add("active");
    }
    const time = document.createElement("div");
    time.className = "event-time";
    time.textContent = formatTime(ev.t_ms);

    const summary = document.createElement("div");
    summary.className = "event-summary";
    const badge = document.createElement("span");
    badge.className = "event-badge";
    badge.textContent = EVENT_ICONS[ev.type] || ev.type;
    summary.appendChild(badge);
    const text = document.createElement("span");
    text.textContent = ev.summary;
    summary.appendChild(text);

    item.appendChild(time);
    item.appendChild(summary);
    item.addEventListener("click", () => selectEvent(ev, true));
    eventList.appendChild(item);
  });
}

function renderDetails(ev) {
  detailsBody.innerHTML = "";
  const header = document.createElement("div");
  header.className = "details-kv";
  const title = document.createElement("strong");
  title.textContent = ev.summary;
  header.appendChild(title);
  detailsBody.appendChild(header);

  if (ev.type === "marker") {
    const note = document.createElement("div");
    note.textContent = ev.payload?.note || "(no note)";
    detailsBody.appendChild(note);
  } else if (ev.type === "screenshot") {
    const name = ev.refs?.screenshotFile;
    const img = document.createElement("img");
    if (name && state.screenshots.has(name)) {
      img.src = state.screenshots.get(name);
      detailsBody.appendChild(img);
    } else {
      const message = document.createElement("div");
      message.textContent = "Screenshot not found in pack.";
      detailsBody.appendChild(message);
    }
  } else if (ev.type === "network") {
    const fields = [
      ["Method", ev.payload?.method],
      ["URL", ev.payload?.url],
      ["Status", ev.payload?.status],
      ["Duration", ev.payload?.durationMs],
      ["Request ID", ev.payload?.requestId],
    ];
    fields.forEach(([label, value]) => {
      if (!value) {
        return;
      }
      const row = document.createElement("div");
      row.className = "details-kv";
      const key = document.createElement("strong");
      key.textContent = label;
      const val = document.createElement("div");
      val.textContent = String(value);
      row.appendChild(key);
      row.appendChild(val);
      detailsBody.appendChild(row);
    });
  } else if (ev.type === "console") {
    const fields = [
      ["Level", ev.payload?.level],
      ["Message", ev.payload?.message],
      ["Stack", ev.payload?.stack],
    ];
    fields.forEach(([label, value]) => {
      if (!value) {
        return;
      }
      const row = document.createElement("div");
      row.className = "details-kv";
      const key = document.createElement("strong");
      key.textContent = label;
      const val = document.createElement("div");
      val.textContent = String(value);
      row.appendChild(key);
      row.appendChild(val);
      detailsBody.appendChild(row);
    });
  }
}

function updateTimeline() {
  timeline.max = String(state.durationMs || 0);
  timeline.value = String(state.currentTms || 0);
  currentTimeLabel.textContent = formatTime(state.currentTms);
  durationLabel.textContent = `Duration: ${formatTime(state.durationMs)}`;
  if (videoSyncNote) {
    videoSyncNote.classList.toggle("hidden", state.videoSyncAvailable);
  }
}

function refreshView() {
  state.filtered = filterEvents(state.events);
  if (
    state.selectedEventId &&
    !state.filtered.some((ev) => ev.id === state.selectedEventId)
  ) {
    state.selectedEventId = null;
  }
  renderEventList();
  renderTimelineTicks(state.events);
}

function findNearestEvent(events, tms) {
  let candidate = null;
  for (const ev of events) {
    if (ev.t_ms <= tms) {
      candidate = ev;
    } else {
      break;
    }
  }
  return candidate || events[0] || null;
}

function setCurrentTms(tms, snap = true) {
  state.currentTms = Math.max(0, tms);
  updateTimeline();
  if (state.videoAvailable && state.videoSyncAvailable) {
    videoEl.currentTime = state.currentTms / 1000;
  }
  if (snap) {
    const nearest = findNearestEvent(state.events, state.currentTms);
    if (nearest) {
      state.selectedEventId = nearest.id;
      renderDetails(nearest);
    }
  }
  refreshView();
}

function selectEvent(ev, seek = false) {
  state.selectedEventId = ev.id;
  renderDetails(ev);
  if (seek) {
    setCurrentTms(ev.t_ms, false);
  } else {
    refreshView();
  }
}

async function loadScreenshots(assets) {
  const files = assets?.screenshots || [];
  files.forEach((shot) => {
    if (shot.fileName) {
      state.screenshots.set(shot.fileName, `./assets/screenshots/${shot.fileName}`);
    }
  });
}

async function loadVideo(hasVideo) {
  if (!hasVideo) {
    videoPanel.classList.add("hidden");
    state.videoAvailable = false;
    return;
  }
  videoPanel.classList.remove("hidden");
  videoEl.src = "./assets/video.webm";
  state.videoAvailable = true;
}

function attachVideoSync() {
  let rafId = null;
  function step() {
    if (!videoEl.paused && !videoEl.ended) {
      setCurrentTms(videoEl.currentTime * 1000, true);
      rafId = requestAnimationFrame(step);
    }
  }
  videoEl.addEventListener("play", () => {
    videoPlay.textContent = "Pause";
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
    rafId = requestAnimationFrame(step);
  });
  videoEl.addEventListener("pause", () => {
    videoPlay.textContent = "Play";
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
  });
  videoPlay.addEventListener("click", () => {
    if (videoEl.paused) {
      videoEl.play();
    } else {
      videoEl.pause();
    }
  });
  videoEl.addEventListener("timeupdate", () => {
    const t = Math.floor((videoEl.currentTime || 0) * 1000);
    videoTime.textContent = formatTime(t);
  });
}

async function loadSessionLog() {
  const response = await fetch("./assets/session-log.json");
  if (!response.ok) {
    setPackMeta("Unable to load session log.");
    return;
  }
  const payload = await response.json();
  state.session = payload.session || {};
  state.events = (payload.events || []).map((ev, index) => ({
    ...ev,
    id: ev.id || `evt_${String(index).padStart(6, "0")}`,
    t_ms: typeof ev.t_ms === "number" ? ev.t_ms : 0,
    isError: Boolean(ev.isError),
  }));
  state.events.sort((a, b) => a.t_ms - b.t_ms);
  state.durationMs = payload.session?.durationMs || 0;
  if (!state.durationMs) {
    state.durationMs = state.events.reduce((acc, ev) => Math.max(acc, ev.t_ms), 0);
  }
  state.currentTms = 0;
  state.videoSyncAvailable = state.durationMs > 0;

  const counts = payload.counts || {};
  const metaText = `${payload.packName || "Watch Pack"} • ${formatTime(
    state.durationMs
  )} • N:${counts.network || 0} C:${counts.console || 0} M:${
    counts.marker || 0
  } S:${counts.screenshot || 0}`;
  setPackMeta(metaText);

  await loadScreenshots(payload.assets);
  await loadVideo(payload.assets?.hasVideo);

  updateTimeline();
  refreshView();
  const nearest = findNearestEvent(state.events, 0);
  if (nearest) {
    selectEvent(nearest, false);
  }
}

timeline.addEventListener("input", () => {
  setCurrentTms(Number(timeline.value), true);
});

[filterMarkers, filterNetwork, filterConsole, filterScreenshots, filterErrors].forEach((el) =>
  el.addEventListener("change", refreshView)
);
searchInput.addEventListener("input", refreshView);
autoFollow.addEventListener("change", () => {
  state.autoFollow = autoFollow.checked;
});

eventList.addEventListener("scroll", () => {
  if (!state.autoFollow) {
    return;
  }
});

loadSessionLog().then(attachVideoSync).catch(() => {
  setPackMeta("Failed to load session log.");
});
