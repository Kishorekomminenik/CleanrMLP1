const openZipBtn = document.getElementById("openZipBtn");
const openAnotherBtn = document.getElementById("openAnotherBtn");
const resetBtn = document.getElementById("resetBtn");
const zipInput = document.getElementById("zipInput");
const loaderError = document.getElementById("loaderError");
const errorPanel = document.getElementById("errorPanel");
const errorClose = document.getElementById("errorClose");
const loadedInfo = document.getElementById("loadedInfo");
const emptyState = document.getElementById("emptyState");
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
const filterMarkers = document.getElementById("filterMarkers");
const filterNetwork = document.getElementById("filterNetwork");
const filterConsole = document.getElementById("filterConsole");
const filterScreenshots = document.getElementById("filterScreenshots");
const filterErrors = document.getElementById("filterErrors");
const searchInput = document.getElementById("searchInput");

const state = {
  zip: null,
  zipFiles: null,
  sessionLog: null,
  events: [],
  filtered: [],
  currentTms: 0,
  durationMs: 0,
  screenshotUrls: new Map(),
  missingScreenshots: [],
  videoUrl: null,
  videoMissing: false,
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

function showError(message, isWarning = false) {
  if (!errorPanel) {
    return;
  }
  loaderError.textContent = message;
  errorPanel.classList.remove("hidden");
  if (isWarning) {
    errorPanel.style.borderColor = "rgba(217, 119, 6, 0.4)";
    errorPanel.style.background = "#fff7ed";
    loaderError.style.color = "#b45309";
  } else {
    errorPanel.style.borderColor = "rgba(220, 38, 38, 0.4)";
    errorPanel.style.background = "#fef2f2";
    loaderError.style.color = "#b91c1c";
  }
}

function clearError() {
  if (!errorPanel) {
    return;
  }
  loaderError.textContent = "";
  errorPanel.classList.add("hidden");
  loaderError.style.color = "";
  errorPanel.style.borderColor = "";
  errorPanel.style.background = "";
}

function setLoadedInfo(zipName, sessionLogName) {
  if (!loadedInfo) {
    return;
  }
  loadedInfo.textContent = `Loaded: ${zipName} • ${sessionLogName} • ${formatTime(
    state.durationMs
  )}`;
  loadedInfo.classList.remove("hidden");
}

function clearLoadedInfo() {
  if (!loadedInfo) {
    return;
  }
  loadedInfo.textContent = "";
  loadedInfo.classList.add("hidden");
}

function parseTimestampFromName(name) {
  const match = name.match(/qa-session-log-(\d{8}-\d{6})/);
  if (!match) {
    return null;
  }
  const raw = match[1];
  const year = raw.slice(0, 4);
  const month = raw.slice(4, 6);
  const day = raw.slice(6, 8);
  const hour = raw.slice(9, 11);
  const minute = raw.slice(11, 13);
  const second = raw.slice(13, 15);
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`).getTime();
}

function selectSessionLogFile(zipFiles) {
  const candidates = Object.keys(zipFiles).filter((name) =>
    /qa-session-log.*\.json$/i.test(name)
  );
  if (!candidates.length) {
    return null;
  }
  const sorted = candidates
    .map((name) => ({ name, ts: parseTimestampFromName(name) }))
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return sorted[0].name;
}

function computeTmsFromIso(tsIso, sessionStartIso) {
  if (!tsIso || !sessionStartIso) {
    return 0;
  }
  const base = Date.parse(sessionStartIso);
  const ts = Date.parse(tsIso);
  if (Number.isNaN(base) || Number.isNaN(ts)) {
    return 0;
  }
  return Math.max(0, ts - base);
}

function buildEventsFromNormalized(normalizedEvents = []) {
  return normalizedEvents.map((ev) => {
    let type = "session";
    if (ev.kind === "marker") {
      type = "marker";
    } else if (ev.kind === "screenshot") {
      type = "screenshot";
    } else if (ev.source === "console") {
      type = "console";
    } else if (ev.source === "network" || ev.kind === "request" || ev.kind === "response") {
      type = "network";
    }

    let summary = ev.msg || "";
    if (type === "marker") {
      summary = `Marker: ${ev.data?.note || "(no note)"}`;
    } else if (type === "screenshot") {
      summary = `Screenshot: ${ev.data?.fileName || "image"}`;
    } else if (type === "console") {
      summary = `${(ev.level || "log").toUpperCase()}: ${ev.msg || ""}`;
    } else if (type === "network") {
      const method = ev.data?.method || "";
      const url = ev.data?.urlPath || ev.data?.url || "";
      const status = ev.data?.status ? ` ${ev.data.status}` : "";
      summary = `${method}${status} ${url}`.trim();
    }

    const status = ev.data?.status;
    const isError =
      ev.level === "error" ||
      (type === "network" && typeof status === "number" && status >= 400);

    return {
      t_ms: typeof ev.t_ms === "number" ? ev.t_ms : 0,
      type,
      summary,
      payload: ev.data || {},
      refs: {
        screenshotFile: ev.data?.fileName || null,
        requestId: ev.corr?.requestId || null,
      },
      isError,
      raw: ev,
    };
  });
}

function buildEventsFromRaw(sessionLog) {
  const sessionStart = sessionLog?.session?.startedAt || null;
  const events = [];

  const markers = sessionLog?.raw?.markers || [];
  markers.forEach((marker) => {
    events.push({
      t_ms:
        typeof marker.t_ms === "number"
          ? marker.t_ms
          : computeTmsFromIso(marker.timestampIso, sessionStart),
      type: "marker",
      summary: `Marker: ${marker.note || "(no note)"}`,
      payload: marker,
      refs: {},
      isError: false,
    });
  });

  const screenshots = sessionLog?.raw?.screenshots || [];
  screenshots.forEach((shot) => {
    events.push({
      t_ms:
        typeof shot.t_ms === "number"
          ? shot.t_ms
          : computeTmsFromIso(shot.timestampIso, sessionStart),
      type: "screenshot",
      summary: `Screenshot: ${shot.fileName || "image"}`,
      payload: shot,
      refs: { screenshotFile: shot.fileName || null },
      isError: false,
    });
  });

  const network = sessionLog?.raw?.network || [];
  network.forEach((entry) => {
    const status = entry.response_status;
    const summary = `${entry.method || ""} ${
      typeof status === "number" ? status : ""
    } ${entry.url || ""}`.trim();
    events.push({
      t_ms: computeTmsFromIso(entry.timestamp, sessionStart),
      type: "network",
      summary,
      payload: entry,
      refs: { requestId: entry.request_id || null },
      isError: typeof status === "number" && status >= 400,
    });
  });

  const consoleEntries = sessionLog?.raw?.console || [];
  consoleEntries.forEach((entry) => {
    const summary = `${(entry.level || "log").toUpperCase()}: ${
      entry.message || ""
    }`.trim();
    events.push({
      t_ms: computeTmsFromIso(entry.timestamp, sessionStart),
      type: "console",
      summary,
      payload: entry,
      refs: {},
      isError: entry.level === "error",
    });
  });

  return events;
}

function computeDurationMs(sessionLog, events) {
  const start = sessionLog?.session?.startedAt;
  const end = sessionLog?.session?.endedAt;
  if (start && end) {
    const duration = Date.parse(end) - Date.parse(start);
    if (Number.isFinite(duration) && duration > 0) {
      return duration;
    }
  }
  const max = events.reduce((acc, ev) => Math.max(acc, ev.t_ms || 0), 0);
  return Math.max(max, 0);
}

async function loadScreenshotBlobs(zip, sessionLog) {
  const screenshots = sessionLog?.raw?.screenshots || [];
  state.missingScreenshots = [];
  for (const shot of screenshots) {
    if (!shot.fileName) {
      continue;
    }
    const candidates = Object.keys(zip.files).filter((name) =>
      name.endsWith(shot.fileName)
    );
    if (!candidates.length) {
      state.missingScreenshots.push(shot.fileName);
      continue;
    }
    const entry = zip.file(candidates[0]);
    if (!entry) {
      state.missingScreenshots.push(shot.fileName);
      continue;
    }
    const blob = await entry.async("blob");
    const url = URL.createObjectURL(blob);
    state.screenshotUrls.set(shot.fileName, url);
  }
}

async function loadVideo(zip) {
  const candidates = Object.keys(zip.files).filter((name) =>
    /qa-session-video-.*\.webm$/i.test(name)
  );
  if (!candidates.length) {
    videoPanel.classList.add("hidden");
    if (videoEl) {
      videoEl.removeAttribute("src");
    }
    state.videoMissing = true;
    return;
  }
  const entry = zip.file(candidates[0]);
  if (!entry) {
    return;
  }
  const blob = await entry.async("blob");
  state.videoUrl = URL.createObjectURL(blob);
  videoEl.src = state.videoUrl;
  videoPanel.classList.remove("hidden");
  state.videoMissing = false;
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
      tick.title = ev.summary;
      timelineTicks.appendChild(tick);
    }
  });
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

function renderEventList() {
  eventList.innerHTML = "";
  state.filtered.forEach((ev, index) => {
    const item = document.createElement("div");
    item.className = "event-item";
    item.dataset.index = String(index);

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
    item.addEventListener("click", () => renderDetails(ev));
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
    if (name && state.screenshotUrls.has(name)) {
      img.src = state.screenshotUrls.get(name);
      detailsBody.appendChild(img);
    } else {
      const message = document.createElement("div");
      message.textContent =
        "Screenshot file missing from ZIP. Re-export the evidence to include it.";
      detailsBody.appendChild(message);
    }
  } else if (ev.type === "network") {
    const fields = [
      ["Method", ev.payload?.method],
      ["URL", ev.payload?.url],
      ["Status", ev.payload?.status || ev.payload?.response_status],
      ["Duration", ev.payload?.durationMs || ev.payload?.timing],
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
      ["Message", ev.payload?.message || ev.payload?.msg],
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
}

function refreshView() {
  state.filtered = filterEvents(state.events);
  renderEventList();
  renderTimelineTicks(state.events);
}

async function loadZip(file) {
  clearError();
  clearLoadedInfo();
  emptyState.textContent = "Loading evidence...";

  if (!window.JSZip) {
    showError("JSZip failed to load. Ensure vendor/jszip.min.js exists.");
    return;
  }

  let zip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch (error) {
    showError("Unable to read ZIP file. Please select a valid Repro export.");
    return;
  }
  state.zip = zip;
  state.zipFiles = zip.files;

  const sessionLogName = selectSessionLogFile(zip.files);
  if (!sessionLogName) {
    showError(
      "This ZIP does not look like a Repro export (missing qa-session-log*.json)."
    );
    return;
  }

  let sessionLogRaw = "";
  try {
    sessionLogRaw = await zip.file(sessionLogName).async("string");
  } catch (error) {
    showError("Unable to read qa-session-log JSON from ZIP.");
    return;
  }
  try {
    state.sessionLog = JSON.parse(sessionLogRaw);
  } catch (error) {
    showError("Invalid qa-session-log JSON. Re-export the evidence ZIP.");
    return;
  }

  const normalized = state.sessionLog.normalizedEvents || [];
  state.events = normalized.length
    ? buildEventsFromNormalized(normalized)
    : buildEventsFromRaw(state.sessionLog);

  state.events.sort((a, b) => a.t_ms - b.t_ms);
  state.durationMs = computeDurationMs(state.sessionLog, state.events);
  state.currentTms = state.durationMs;

  await loadScreenshotBlobs(zip, state.sessionLog);
  await loadVideo(zip);

  setLoadedInfo(file.name, sessionLogName);

  updateTimeline();
  refreshView();
  emptyState.textContent = "";

  if (state.missingScreenshots.length) {
    showError(
      "Some screenshots referenced in the log are missing from this ZIP.",
      true
    );
  } else if (state.videoMissing && state.sessionLog?.session?.mode === "recording") {
    showError("Video file is missing from this ZIP.", true);
  }
}

function resetState() {
  state.zip = null;
  state.zipFiles = null;
  state.sessionLog = null;
  state.events = [];
  state.filtered = [];
  state.currentTms = 0;
  state.durationMs = 0;
  state.missingScreenshots = [];
  state.videoMissing = false;
  if (state.videoUrl) {
    URL.revokeObjectURL(state.videoUrl);
  }
  state.videoUrl = null;
  state.screenshotUrls.forEach((url) => URL.revokeObjectURL(url));
  state.screenshotUrls.clear();

  eventList.innerHTML = "";
  detailsBody.textContent = "Select an event to see details.";
  timelineTicks.innerHTML = "";
  timeline.value = "0";
  timeline.max = "0";
  currentTimeLabel.textContent = "00:00";
  durationLabel.textContent = "Duration: 00:00";
  videoPanel.classList.add("hidden");
  videoEl.removeAttribute("src");
  videoPlay.textContent = "Play";
  emptyState.textContent =
    "Open an evidence ZIP exported from Repro to replay a session locally.";
  clearError();
  clearLoadedInfo();
}

openZipBtn.addEventListener("click", () => zipInput.click());
openAnotherBtn.addEventListener("click", () => {
  resetState();
  zipInput.value = "";
  zipInput.click();
});
resetBtn.addEventListener("click", resetState);
zipInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) {
    resetState();
    loadZip(file).catch((error) => {
      showError(error?.message || "Failed to load ZIP.");
    });
  }
});

timeline.addEventListener("input", () => {
  state.currentTms = Number(timeline.value);
  currentTimeLabel.textContent = formatTime(state.currentTms);
  if (!videoEl.classList.contains("hidden") && videoEl.duration) {
    videoEl.currentTime = state.currentTms / 1000;
  }
  refreshView();
});

[filterMarkers, filterNetwork, filterConsole, filterScreenshots, filterErrors].forEach(
  (el) => el.addEventListener("change", refreshView)
);
searchInput.addEventListener("input", refreshView);

videoPlay.addEventListener("click", () => {
  if (videoEl.paused) {
    videoEl.play();
    videoPlay.textContent = "Pause";
  } else {
    videoEl.pause();
    videoPlay.textContent = "Play";
  }
});

videoEl.addEventListener("timeupdate", () => {
  const t = Math.floor((videoEl.currentTime || 0) * 1000);
  videoTime.textContent = formatTime(t);
});
