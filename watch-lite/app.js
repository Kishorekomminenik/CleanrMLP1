const openZipBtn = document.getElementById("openZipBtn");
const openAnotherBtn = document.getElementById("openAnotherBtn");
const resetBtn = document.getElementById("resetBtn");
const zipInput = document.getElementById("zipInput");
const loaderError = document.getElementById("loaderError");
const errorPanel = document.getElementById("errorPanel");
const errorClose = document.getElementById("errorClose");
const loadedInfo = document.getElementById("loadedInfo");
const emptyState = document.getElementById("emptyState");
const banner = document.getElementById("howtoBanner");
const bannerClose = document.getElementById("bannerClose");
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
const filterMarkers = document.getElementById("filterMarkers");
const filterNetwork = document.getElementById("filterNetwork");
const filterConsole = document.getElementById("filterConsole");
const filterScreenshots = document.getElementById("filterScreenshots");
const filterErrors = document.getElementById("filterErrors");
const searchInput = document.getElementById("searchInput");
const summaryPanel = document.getElementById("summaryPanel");
const summaryNetwork = document.getElementById("summaryNetwork");
const summaryConsole = document.getElementById("summaryConsole");
const summaryErrors = document.getElementById("summaryErrors");
const summaryScreenshots = document.getElementById("summaryScreenshots");
const summaryRecording = document.getElementById("summaryRecording");
const summarySignals = document.getElementById("summarySignals");

const state = {
  zip: null,
  zipFiles: null,
  sessionLog: null,
  manifest: null,
  events: [],
  filtered: [],
  currentTms: 0,
  durationMs: 0,
  screenshotUrls: new Map(),
  missingScreenshots: [],
  screenshotById: new Map(),
  videoUrl: null,
  videoMissing: false,
  selectedEventId: null,
  videoSyncAvailable: false,
  partialMode: false,
  networkIndex: null,
  consoleIndex: null,
  loadingNetwork: false,
  loadingConsole: false,
};

const EVENT_ICONS = {
  marker: "M",
  network: "N",
  console: "C",
  screenshot: "S",
  session: "I",
};

let eventIdCounter = 0;

function createEventId() {
  eventIdCounter += 1;
  return `evt_${String(eventIdCounter).padStart(6, "0")}`;
}

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
  const match = name.match(/(qa-session-log|debugduck-session-log)[-_](\d{8})[-_](\d{6})/i);
  if (!match) {
    return null;
  }
  const rawDate = match[2];
  const rawTime = match[3];
  const year = rawDate.slice(0, 4);
  const month = rawDate.slice(4, 6);
  const day = rawDate.slice(6, 8);
  const hour = rawTime.slice(0, 2);
  const minute = rawTime.slice(2, 4);
  const second = rawTime.slice(4, 6);
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`).getTime();
}

function findSessionManifestFile(zipFiles) {
  if (!zipFiles) {
    return null;
  }
  if (zipFiles["session.json"]) {
    return "session.json";
  }
  return Object.keys(zipFiles).find((name) => /^session\.json$/i.test(name)) || null;
}

function buildEventsFromManifest(manifest) {
  const events = [];
  if (!manifest || !manifest.timeline || !Array.isArray(manifest.timeline.events)) {
    return events;
  }
  manifest.timeline.events.forEach((ev) => {
    const rawType = ev.type || "marker";
    let type = rawType;
    if (rawType.startsWith("recording")) {
      type = "marker";
    } else if (rawType.startsWith("network")) {
      type = "network";
    } else if (rawType.startsWith("console")) {
      type = "console";
    } else if (rawType === "screenshot") {
      type = "screenshot";
    }
    const summary =
      ev.label ||
      (rawType === "recording-start"
        ? "Recording started"
        : rawType === "recording-stop"
          ? "Recording stopped"
          : rawType.replace(/-/g, " "));
    events.push({
      id: ev.id || createEventId(),
      t_ms: typeof ev.timestampMs === "number" ? ev.timestampMs : 0,
      type,
      summary,
      payload: {},
      refs: {
        ref: ev.ref || null,
      },
      isError: ev.severity === "error",
      raw: ev,
    });
  });
  return events;
}

function buildScreenshotIndexFromManifest(manifest) {
  const map = new Map();
  if (!manifest || !manifest.artifacts || !manifest.artifacts.screenshots) {
    return map;
  }
  const items = manifest.artifacts.screenshots.items || [];
  items.forEach((shot) => {
    if (shot && shot.id) {
      map.set(shot.id, shot);
    }
  });
  return map;
}

function applyManifestAvailability(manifest) {
  const artifacts = manifest?.artifacts || {};
  const hasNetwork = Boolean(artifacts.network?.present);
  const hasConsole = Boolean(artifacts.console?.present);
  const hasScreenshots = Boolean(artifacts.screenshots?.present);
  const hasRecording = Boolean(artifacts.recording?.present);

  filterNetwork.disabled = !hasNetwork;
  if (!hasNetwork) {
    filterNetwork.checked = false;
  }
  filterConsole.disabled = !hasConsole;
  if (!hasConsole) {
    filterConsole.checked = false;
  }
  filterScreenshots.disabled = !hasScreenshots;
  if (!hasScreenshots) {
    filterScreenshots.checked = false;
  }

  videoPanel.classList.toggle("hidden", !hasRecording);
}

function renderSummaryFromManifest(manifest) {
  if (!summaryPanel) {
    return;
  }
  if (!manifest || !manifest.summary) {
    summaryPanel.classList.add("hidden");
    return;
  }
  summaryPanel.classList.remove("hidden");
  if (summaryNetwork) {
    summaryNetwork.textContent = String(manifest.summary.networkRequests || 0);
  }
  if (summaryConsole) {
    summaryConsole.textContent = String(manifest.summary.consoleMessages || 0);
  }
  if (summaryErrors) {
    summaryErrors.textContent = String(
      (manifest.summary.consoleErrors || 0) + (manifest.summary.networkFailures || 0)
    );
  }
  if (summaryScreenshots) {
    summaryScreenshots.textContent = String(manifest.summary.screenshots || 0);
  }
  if (summaryRecording) {
    summaryRecording.textContent = manifest.summary.hasRecording ? "Yes" : "No";
  }
  if (summarySignals) {
    const signals = Array.isArray(manifest.summary.topSignals)
      ? manifest.summary.topSignals
      : [];
    summarySignals.textContent = signals.length ? signals.join(" • ") : "";
  }
}

function pickNewestByZipDate(names, zipFiles) {
  if (!names.length) {
    return null;
  }
  const sorted = names
    .map((name) => ({
      name,
      ts: zipFiles[name] && zipFiles[name].date ? zipFiles[name].date.getTime() : 0,
    }))
    .sort((a, b) => b.ts - a.ts);
  return sorted[0].name;
}

function selectSessionLogFile(zipFiles) {
  const names = Object.keys(zipFiles);
  const timestamped = names.filter((name) =>
    /(qa-session-log|debugduck-session-log)[-_]\d{8}[-_]\d{6}\.json$/i.test(name)
  );
  if (timestamped.length) {
    const sorted = timestamped
      .map((name) => ({ name, ts: parseTimestampFromName(name) || 0 }))
      .sort((a, b) => b.ts - a.ts);
    return sorted[0].name;
  }
  const generic = names.filter((name) =>
    /(qa-session-log|debugduck-session-log)\.json$/i.test(name)
  );
  if (generic.length) {
    return pickNewestByZipDate(generic, zipFiles) || generic[0];
  }
  return null;
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

function findFile(zipFiles, regex) {
  return Object.keys(zipFiles).find((name) => regex.test(name));
}

function listScreenshotFiles(zipFiles) {
  const names = Object.keys(zipFiles);
  return names.filter(
    (name) =>
      /^screenshots\/.+\.png$/i.test(name) ||
      /(qa-screenshot|debugduck-screenshot)-.*\.png$/i.test(name)
  );
}

function parseScreenshotTimestamp(name) {
  const match = name.match(/(\d{8})[-_](\d{6})/);
  if (!match) {
    return null;
  }
  const date = match[1];
  const time = match[2];
  const year = date.slice(0, 4);
  const month = date.slice(4, 6);
  const day = date.slice(6, 8);
  const hour = time.slice(0, 2);
  const minute = time.slice(2, 4);
  const second = time.slice(4, 6);
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`).getTime();
}

function deriveSessionStartIso({
  sessionLog,
  networkEntries,
  consoleEntries,
  screenshotTimes,
  environmentTimestamp,
}) {
  if (sessionLog?.session?.startedAt) {
    return sessionLog.session.startedAt;
  }
  const candidates = [];
  networkEntries.forEach((entry) => {
    const ts = Date.parse(entry.timestamp);
    if (!Number.isNaN(ts)) {
      candidates.push(ts);
    }
  });
  consoleEntries.forEach((entry) => {
    const ts = Date.parse(entry.timestamp);
    if (!Number.isNaN(ts)) {
      candidates.push(ts);
    }
  });
  screenshotTimes.forEach((ts) => {
    if (typeof ts === "number") {
      candidates.push(ts);
    }
  });
  if (environmentTimestamp) {
    const ts = Date.parse(environmentTimestamp);
    if (!Number.isNaN(ts)) {
      candidates.push(ts);
    }
  }
  if (!candidates.length) {
    return null;
  }
  return new Date(Math.min(...candidates)).toISOString();
}

function buildEventsFromNormalized(normalizedEvents = []) {
  return normalizedEvents.map((ev) => {
    const eventId = ev.id || createEventId();
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
      ev.kind === "error" ||
      (type === "console" && /exception/i.test(ev.msg || "")) ||
      (type === "network" && typeof status === "number" && status >= 400);

    return {
      id: eventId,
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
      id: createEventId(),
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
      id: createEventId(),
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
      id: createEventId(),
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
      id: createEventId(),
      t_ms: computeTmsFromIso(entry.timestamp, sessionStart),
      type: "console",
      summary,
      payload: entry,
      refs: {},
      isError:
        entry.level === "error" ||
        /exception/i.test(entry.source || "") ||
        /exception/i.test(entry.message || ""),
    });
  });

  return events;
}

function buildEventsFromSupplemental({ networkLogs, consoleLogs, sessionStartIso }) {
  const events = [];
  const networkEntries = networkLogs?.entries || [];
  networkEntries.forEach((entry) => {
    const status = entry.response_status;
    const summary = `${entry.method || ""} ${
      typeof status === "number" ? status : ""
    } ${entry.url || ""}`.trim();
    events.push({
      id: createEventId(),
      t_ms: computeTmsFromIso(entry.timestamp, sessionStartIso),
      type: "network",
      summary,
      payload: entry,
      refs: { requestId: entry.request_id || null },
      isError: typeof status === "number" && status >= 400,
    });
  });

  const consoleEntries = consoleLogs?.entries || [];
  consoleEntries.forEach((entry) => {
    const summary = `${(entry.level || "log").toUpperCase()}: ${
      entry.message || ""
    }`.trim();
    events.push({
      id: createEventId(),
      t_ms: computeTmsFromIso(entry.timestamp, sessionStartIso),
      type: "console",
      summary,
      payload: entry,
      refs: {},
      isError:
        entry.level === "error" ||
        /exception/i.test(entry.source || "") ||
        /exception/i.test(entry.message || ""),
    });
  });

  return events;
}

function buildScreenshotEventsFromFiles(files, sessionStartIso) {
  return files.map((fileName) => {
    const baseName = fileName.split("/").pop();
    const ts = parseScreenshotTimestamp(baseName);
    const t_ms = ts && sessionStartIso ? Math.max(0, ts - Date.parse(sessionStartIso)) : 0;
    return {
      id: createEventId(),
      t_ms,
      type: "screenshot",
      summary: `Screenshot: ${baseName}`,
      payload: { fileName: baseName },
      refs: { screenshotFile: baseName },
      isError: false,
    };
  });
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

async function loadScreenshotBlobs(zip, screenshotFiles, referencedNames = []) {
  state.missingScreenshots = [];
  state.screenshotUrls.forEach((url) => URL.revokeObjectURL(url));
  state.screenshotUrls.clear();

  for (const path of screenshotFiles) {
    const entry = zip.file(path);
    if (!entry) {
      continue;
    }
    const blob = await entry.async("blob");
    const url = URL.createObjectURL(blob);
    const baseName = path.split("/").pop();
    state.screenshotUrls.set(baseName, url);
  }

  referencedNames.forEach((name) => {
    if (name && !state.screenshotUrls.has(name)) {
      state.missingScreenshots.push(name);
    }
  });
}

async function loadVideo(zip) {
  const candidates = Object.keys(zip.files).filter((name) =>
    /(qa-session-video|debugduck-recording)-.*\.webm$/i.test(name)
  );
  if (!candidates.length) {
    videoPanel.classList.add("hidden");
    if (videoEl) {
      videoEl.removeAttribute("src");
    }
    state.videoMissing = true;
    if (videoSyncNote) {
      videoSyncNote.classList.add("hidden");
    }
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
  if (videoSyncNote) {
    videoSyncNote.classList.toggle("hidden", state.videoSyncAvailable);
  }
}

async function loadNdjsonEntries(path) {
  if (!path || !state.zip) {
    return [];
  }
  const entry = state.zip.file(path);
  if (!entry) {
    return [];
  }
  const raw = await entry.async("string");
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);
}

function indexEntriesById(entries) {
  const map = new Map();
  entries.forEach((entry) => {
    if (entry && entry.id) {
      map.set(entry.id, entry);
    }
  });
  return map;
}

async function ensureNetworkLogsLoaded() {
  if (state.loadingNetwork || state.networkIndex) {
    return;
  }
  state.loadingNetwork = true;
  try {
    const manifestPath = state.manifest?.artifacts?.network?.path || null;
    const entries = await loadNdjsonEntries(manifestPath);
    state.networkIndex = indexEntriesById(entries);
  } catch (error) {
    state.networkIndex = new Map();
  } finally {
    state.loadingNetwork = false;
  }
}

async function ensureConsoleLogsLoaded() {
  if (state.loadingConsole || state.consoleIndex) {
    return;
  }
  state.loadingConsole = true;
  try {
    const manifestPath = state.manifest?.artifacts?.console?.path || null;
    const entries = await loadNdjsonEntries(manifestPath);
    state.consoleIndex = indexEntriesById(entries);
  } catch (error) {
    state.consoleIndex = new Map();
  } finally {
    state.loadingConsole = false;
  }
}

async function ensureVideoLoaded() {
  if (!state.zip || state.videoUrl || !state.manifest?.artifacts?.recording?.present) {
    return;
  }
  const path = state.manifest.artifacts.recording.path;
  if (!path) {
    return;
  }
  const entry = state.zip.file(path);
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
    if (state.selectedEventId && ev.id === state.selectedEventId) {
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
    const manifestShot = ev.refs?.ref ? state.screenshotById.get(ev.refs.ref) : null;
    const name = manifestShot?.path
      ? manifestShot.path.split("/").pop()
      : ev.refs?.screenshotFile;
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
    if (!ev.payload || !Object.keys(ev.payload).length) {
      if (!state.networkIndex) {
        const loading = document.createElement("div");
        loading.textContent = "Loading network logs…";
        detailsBody.appendChild(loading);
        ensureNetworkLogsLoaded().then(() => renderDetails(ev));
        return;
      }
      if (ev.refs?.ref && state.networkIndex.has(ev.refs.ref)) {
        ev.payload = state.networkIndex.get(ev.refs.ref);
      }
    }
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
    if (!ev.payload || !Object.keys(ev.payload).length) {
      if (!state.consoleIndex) {
        const loading = document.createElement("div");
        loading.textContent = "Loading console logs…";
        detailsBody.appendChild(loading);
        ensureConsoleLogsLoaded().then(() => renderDetails(ev));
        return;
      }
      if (ev.refs?.ref && state.consoleIndex.has(ev.refs.ref)) {
        ev.payload = state.consoleIndex.get(ev.refs.ref);
      }
    }
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

function syncVideoToTms(tms) {
  if (!videoEl || !state.videoSyncAvailable) {
    return;
  }
  videoEl.currentTime = Math.max(0, tms / 1000);
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
  syncVideoToTms(state.currentTms);
  if (snap) {
    const nearest = findNearestEvent(state.events, state.currentTms);
    if (nearest) {
      state.selectedEventId = nearest.id;
      renderDetails(nearest);
    }
  }
  refreshView();
}

function selectEvent(ev, syncTimeline = false) {
  if (!ev) {
    return;
  }
  state.selectedEventId = ev.id;
  renderDetails(ev);
  if (ev.raw && typeof ev.raw.type === "string" && ev.raw.type.startsWith("recording")) {
    ensureVideoLoaded().then(() => syncVideoToTms(ev.t_ms));
  }
  if (syncTimeline) {
    setCurrentTms(ev.t_ms, false);
  } else {
    refreshView();
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
    showError("Unable to read ZIP file. Please select a valid DebugDuck export.");
    return;
  }
  state.zip = zip;
  state.zipFiles = zip.files;
  state.partialMode = false;

  const manifestName = findSessionManifestFile(zip.files);
  const screenshotFilesFromZip = listScreenshotFiles(zip.files);
  let sessionLabel = "partial logs";
  let networkLogs = null;
  let consoleLogs = null;
  let environment = null;
  let sessionStartIso = null;
  let screenshotFiles = screenshotFilesFromZip;

  if (manifestName) {
    let manifestRaw = "";
    try {
      manifestRaw = await zip.file(manifestName).async("string");
    } catch (error) {
      showError("Unable to read session.json from ZIP.");
      return;
    }
    try {
      state.manifest = JSON.parse(manifestRaw);
    } catch (error) {
      showError("Invalid session.json. Re-export the evidence ZIP.");
      return;
    }

    state.screenshotById = buildScreenshotIndexFromManifest(state.manifest);
    const manifestShots = state.manifest?.artifacts?.screenshots?.items || [];
    screenshotFiles = manifestShots.length
      ? manifestShots
          .map((shot) => (shot && shot.path ? shot.path : null))
          .filter(Boolean)
      : screenshotFilesFromZip;
    state.events = buildEventsFromManifest(state.manifest);
    state.events.sort((a, b) => a.t_ms - b.t_ms);
    state.durationMs =
      (state.manifest.timeline && state.manifest.timeline.endOffsetMs) ||
      state.manifest.session?.durationMs ||
      computeDurationMs(state.sessionLog, state.events);
    state.currentTms = state.durationMs;
    state.videoSyncAvailable =
      Boolean(state.manifest?.artifacts?.recording?.present) && state.durationMs > 0;
    sessionLabel =
      state.manifest.session?.title ||
      state.manifest.session?.id ||
      "session.json";
    applyManifestAvailability(state.manifest);
    renderSummaryFromManifest(state.manifest);
  } else {
    const sessionLogName = selectSessionLogFile(zip.files);
    const screenshotTimes = screenshotFiles
      .map((name) => parseScreenshotTimestamp(name.split("/").pop()))
      .filter(Boolean);
    if (sessionLogName) {
      let sessionLogRaw = "";
      try {
        sessionLogRaw = await zip.file(sessionLogName).async("string");
      } catch (error) {
        showError("Unable to read session log JSON from ZIP.");
        return;
      }
      try {
        state.sessionLog = JSON.parse(sessionLogRaw);
      } catch (error) {
        showError("Invalid session log JSON. Re-export the evidence ZIP.");
        return;
      }

      sessionStartIso = state.sessionLog?.session?.startedAt || null;
      const normalized = state.sessionLog.normalizedEvents || [];
      state.events = normalized.length
        ? buildEventsFromNormalized(normalized)
        : buildEventsFromRaw(state.sessionLog);
      sessionLabel = sessionLogName;
    } else {
      const networkName = findFile(zip.files, /network_logs\.json$/i);
      const consoleName = findFile(zip.files, /console_logs\.json$/i);
      const environmentName = findFile(zip.files, /environment\.json$/i);
      if (!networkName && !consoleName) {
        const found = Object.keys(zip.files)
          .filter((name) => name.endsWith(".json"))
          .slice(0, 5)
          .join(", ");
        const foundText = found ? `Found JSON: ${found}` : "No JSON files found.";
        showError(
          `This ZIP does not look like a DebugDuck export (missing session log). ${foundText}`
        );
        return;
      }
      state.partialMode = true;
      try {
        if (networkName) {
          const raw = await zip.file(networkName).async("string");
          networkLogs = JSON.parse(raw);
        }
        if (consoleName) {
          const raw = await zip.file(consoleName).async("string");
          consoleLogs = JSON.parse(raw);
        }
        if (environmentName) {
          const raw = await zip.file(environmentName).async("string");
          environment = JSON.parse(raw);
        }
      } catch (error) {
        showError("Unable to read logs JSON from ZIP.");
        return;
      }
      sessionStartIso = deriveSessionStartIso({
        sessionLog: null,
        networkEntries: networkLogs?.entries || [],
        consoleEntries: consoleLogs?.entries || [],
        screenshotTimes,
        environmentTimestamp: environment?.timestamp,
      });
      state.events = buildEventsFromSupplemental({
        networkLogs,
        consoleLogs,
        sessionStartIso,
      });
      state.events = state.events.concat(
        buildScreenshotEventsFromFiles(screenshotFiles, sessionStartIso)
      );
      state.sessionLog = {
        session: { startedAt: sessionStartIso, endedAt: null, mode: null },
        raw: {
          network: networkLogs?.entries || [],
          console: consoleLogs?.entries || [],
          markers: [],
          screenshots: [],
        },
      };
      sessionLabel = "partial logs";
    }
  }

  if (!state.manifest) {
    state.events.sort((a, b) => a.t_ms - b.t_ms);
    state.durationMs = computeDurationMs(state.sessionLog, state.events);
    state.currentTms = state.durationMs;
    state.videoSyncAvailable = state.durationMs > 0;

    const referencedShots =
      state.sessionLog?.raw?.screenshots?.map((s) => s.fileName) || [];
    if (!referencedShots.length && screenshotFiles.length) {
      state.events = state.events.concat(
        buildScreenshotEventsFromFiles(screenshotFiles, sessionStartIso)
      );
      state.events.sort((a, b) => a.t_ms - b.t_ms);
    }
    await loadScreenshotBlobs(zip, screenshotFiles, referencedShots);
    await loadVideo(zip);
  } else {
    const referencedShots = screenshotFiles.map((name) => name.split("/").pop());
    await loadScreenshotBlobs(zip, screenshotFiles, referencedShots);
    const hasRecording = Boolean(state.manifest?.artifacts?.recording?.present);
    videoPanel.classList.toggle("hidden", !hasRecording);
  }

  setLoadedInfo(file.name, sessionLabel);

  updateTimeline();
  const nearest = findNearestEvent(state.events, state.currentTms);
  if (nearest) {
    state.selectedEventId = nearest.id;
    renderDetails(nearest);
  }
  refreshView();
  emptyState.textContent = "";

  const warnings = [];
  if (state.partialMode) {
    warnings.push("Loaded partial logs (no session log). Some details may be missing.");
  }
  if (state.manifest?.integrity?.warnings?.length) {
    warnings.push(state.manifest.integrity.warnings.join(" "));
  }
  if (state.missingScreenshots.length) {
    warnings.push("Some screenshots referenced in the log are missing from this ZIP.");
  }
  if (state.videoMissing && state.sessionLog?.session?.mode === "recording") {
    warnings.push("Video file is missing from this ZIP.");
  }
  if (warnings.length) {
    showError(warnings.join(" "), true);
  }
}

function resetState() {
  state.zip = null;
  state.zipFiles = null;
  state.sessionLog = null;
  state.manifest = null;
  state.events = [];
  state.filtered = [];
  state.currentTms = 0;
  state.durationMs = 0;
  state.missingScreenshots = [];
  state.videoMissing = false;
  state.selectedEventId = null;
  state.videoSyncAvailable = false;
  state.partialMode = false;
  eventIdCounter = 0;
  state.screenshotById.clear();
  state.networkIndex = null;
  state.consoleIndex = null;
  state.loadingNetwork = false;
  state.loadingConsole = false;
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
  if (videoSyncNote) {
    videoSyncNote.classList.add("hidden");
  }
  emptyState.textContent =
    "Open an evidence ZIP exported from DebugDuck to replay a session locally.";
  if (summaryPanel) {
    summaryPanel.classList.add("hidden");
  }
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
  setCurrentTms(Number(timeline.value), true);
});

[filterMarkers, filterNetwork, filterConsole, filterScreenshots, filterErrors].forEach(
  (el) => el.addEventListener("change", refreshView)
);
searchInput.addEventListener("input", refreshView);

videoPlay.addEventListener("click", async () => {
  await ensureVideoLoaded();
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

if (errorClose) {
  errorClose.addEventListener("click", clearError);
}

if (bannerClose && banner) {
  const dismissed = localStorage.getItem("watchLiteBannerDismissed") === "1";
  if (dismissed) {
    banner.classList.add("hidden");
  }
  bannerClose.addEventListener("click", () => {
    banner.classList.add("hidden");
    localStorage.setItem("watchLiteBannerDismissed", "1");
  });
}
