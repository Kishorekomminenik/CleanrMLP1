const openZipBtn = document.getElementById("openZipBtn");
const openAnotherBtn = document.getElementById("openAnotherBtn");
const resetBtn = document.getElementById("resetBtn");
const zipInput = document.getElementById("zipInput");
const packageNotice = document.getElementById("packageNotice");
const loaderError = document.getElementById("loaderError");
const errorPanel = document.getElementById("errorPanel");
const errorClose = document.getElementById("errorClose");
const loadedInfo = document.getElementById("loadedInfo");
const emptyState = document.getElementById("emptyState");
const banner = document.getElementById("howtoBanner");
const bannerClose = document.getElementById("bannerClose");
const timeline = document.getElementById("timeline");
const timelineCursor = document.getElementById("timelineCursor");
const timelineLanes = document.getElementById("timelineLanes");
const currentTimeLabel = document.getElementById("currentTime");
const durationLabel = document.getElementById("durationLabel");
const playToggleBtn = document.getElementById("playToggleBtn");
const playheadTime = document.getElementById("playheadTime");
const playheadDuration = document.getElementById("playheadDuration");
const prevIncidentBtn = document.getElementById("prevIncidentBtn");
const nextIncidentBtn = document.getElementById("nextIncidentBtn");
const followPlayheadToggle = document.getElementById("followPlayheadToggle");
const timeWindowSelect = document.getElementById("timeWindowSelect");
const timeBadge = document.getElementById("timeBadge");
const timelineHover = document.getElementById("timelineHover");
const contextIncident = document.getElementById("contextIncident");
const contextScreenshot = document.getElementById("contextScreenshot");
const contextNetworkCount = document.getElementById("contextNetworkCount");
const contextConsoleCount = document.getElementById("contextConsoleCount");
const contextWindow = document.getElementById("contextWindow");
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
const timelineSummary = document.getElementById("timelineSummary");
const panelTabs = Array.from(document.querySelectorAll(".tab-button"));
const panelGroups = Array.from(document.querySelectorAll(".panel-group"));
const panelsWithFilters = Array.from(document.querySelectorAll(".filters"));
const screenshotsList = document.getElementById("screenshotsList");
const screenshotsEmpty = document.getElementById("screenshotsEmpty");
const screenshotPreview = document.getElementById("screenshotPreview");
const networkList = document.getElementById("networkList");
const networkEmpty = document.getElementById("networkEmpty");
const networkFilteredEmpty = document.getElementById("networkFilteredEmpty");
const consoleList = document.getElementById("consoleList");
const consoleEmpty = document.getElementById("consoleEmpty");
const consoleFilteredEmpty = document.getElementById("consoleFilteredEmpty");
const incidentPanel = document.getElementById("incidentPanel");
const incidentList = document.getElementById("incidentList");
const incidentEmpty = document.getElementById("incidentEmpty");
const errorOnlyToggle = document.getElementById("errorOnlyToggle");
const networkFilterChips = Array.from(document.querySelectorAll("[data-net-filter]"));
const networkModeChips = Array.from(document.querySelectorAll("[data-net-mode]"));
const consoleLevelChips = Array.from(
  document.querySelectorAll("[data-console-level]")
);
const consoleModeChips = Array.from(
  document.querySelectorAll("[data-console-mode]")
);
const inspectorPanel = document.getElementById("inspectorPanel");
const inspectorTitle = document.getElementById("inspectorTitle");
const inspectorBody = document.getElementById("inspectorBody");

const state = {
  zip: null,
  zipFiles: null,
  sessionLog: null,
  manifest: null,
  packageMode: false,
  packageBaseUrl: null,
  events: [],
  filtered: [],
  screenshotUrls: new Map(),
  missingScreenshots: [],
  screenshotById: new Map(),
  videoUrl: null,
  videoMissing: false,
  selectedNetworkId: null,
  selectedConsoleId: null,
  filters: {
    errorOnly: false,
    networkStatusBucket: "all",
    consoleLevels: ["error", "warning", "info", "log", "debug"],
    incidentSourcePanel: null,
    showIncidentRail: true,
  },
  playhead: {
    currentTimeMs: 0,
    durationMs: 0,
    isPlaying: false,
    isSeeking: false,
    followPlayhead: true,
    timeWindowMs: 5000,
    selectedEventId: null,
    selectedIncidentId: null,
    selectedScreenshotId: null,
    activePanel: "timeline",
    lastSeekSource: null,
    lastCommittedTimeMs: 0,
    pendingSeekTimeMs: null,
    nearestIncidentId: null,
    nearestScreenshotId: null,
    hasRecording: false,
    nearestMarkerId: null,
  },
  hover: {
    hoverTimeMs: null,
    hoverMarkerId: null,
  },
  panelModes: {
    network: "near",
    console: "near",
  },
  inspector: {
    type: null,
    id: null,
  },
  incidents: [],
  incidentSourcePanel: null,
  loadedArtifacts: {
    network: false,
    console: false,
    recording: false,
    screenshots: false,
  },
  videoSyncAvailable: false,
  partialMode: false,
  networkIndex: null,
  consoleIndex: null,
  networkEntries: [],
  consoleEntries: [],
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

function formatTimeWithMs(ms) {
  const totalMs = Math.max(0, Math.floor(ms));
  const minutes = String(Math.floor(totalMs / 60000)).padStart(2, "0");
  const seconds = String(Math.floor((totalMs % 60000) / 1000)).padStart(2, "0");
  const millis = String(totalMs % 1000).padStart(3, "0");
  return `${minutes}:${seconds}.${millis}`;
}

function normalizeConsoleLevel(level) {
  const raw = String(level || "log").toLowerCase();
  if (raw === "warn") {
    return "warning";
  }
  return raw;
}

function classifyNetworkStatus(entry) {
  const status = entry.response_status || entry.status;
  if (typeof status === "number") {
    if (status >= 500) {
      return "5xx";
    }
    if (status >= 400) {
      return "4xx";
    }
    return "ok";
  }
  if (entry.error_text || entry.errorText) {
    return "failure";
  }
  return "unknown";
}

function isNetworkError(entry) {
  const bucket = classifyNetworkStatus(entry);
  return bucket === "4xx" || bucket === "5xx" || bucket === "failure";
}

function getEffectiveConsoleLevels() {
  if (state.filters.errorOnly) {
    return ["error"];
  }
  return state.filters.consoleLevels;
}

function buildIncidentTitle(incident) {
  if (incident.type.startsWith("network")) {
    const status = incident.statusCode ? String(incident.statusCode) : "";
    const method = incident.method || "";
    const url = incident.url || "";
    return `${status} ${method} ${url}`.trim();
  }
  if (incident.type.startsWith("console")) {
    return `Console ${incident.type.replace("console-", "")}: ${incident.message || ""}`.trim();
  }
  return incident.title || "Incident";
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
    state.playhead.durationMs
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

function clampTimeMs(targetTimeMs, durationMs) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return Math.max(0, targetTimeMs);
  }
  return Math.min(Math.max(0, targetTimeMs), durationMs);
}

function clampToDuration(tms) {
  return clampTimeMs(tms, state.playhead.durationMs || 0);
}

function setPlayState(isPlaying) {
  state.playhead.isPlaying = Boolean(isPlaying);
  if (playToggleBtn) {
    playToggleBtn.textContent = state.playhead.isPlaying ? "Pause" : "Play";
  }
  if (videoPlay) {
    videoPlay.textContent = state.playhead.isPlaying ? "Pause" : "Play";
  }
}

function updatePlayheadDisplay() {
  const current = state.playhead.currentTimeMs || 0;
  const duration = state.playhead.durationMs || 0;
  if (timeline) {
    timeline.max = String(duration || 0);
    timeline.value = String(current || 0);
  }
  if (currentTimeLabel) {
    currentTimeLabel.textContent = formatTime(current);
  }
  if (playheadTime) {
    playheadTime.textContent = formatTime(current);
  }
  if (playheadDuration) {
    playheadDuration.textContent = formatTime(duration);
  }
  if (durationLabel) {
    durationLabel.textContent = `Duration: ${formatTime(duration)}`;
  }
  if (timeBadge) {
    timeBadge.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
  }
  if (videoTime) {
    videoTime.textContent = formatTime(current);
  }
  if (timelineCursor && duration > 0) {
    const left = (current / duration) * 100;
    timelineCursor.style.left = `${left}%`;
  } else if (timelineCursor) {
    timelineCursor.style.left = "0%";
  }
}

function getEntriesNearTime(entries, tms, windowMs) {
  if (!Array.isArray(entries) || !entries.length) {
    return [];
  }
  const min = tms - windowMs;
  const max = tms + windowMs;
  return entries.filter((entry) => {
    const ts =
      typeof entry.timestamp_ms === "number"
        ? entry.timestamp_ms
        : typeof entry.timestampMs === "number"
          ? entry.timestampMs
          : null;
    return typeof ts === "number" && ts >= min && ts <= max;
  });
}

function filterEntriesNearTime(entries, tms, windowMs, getTime) {
  if (!Array.isArray(entries) || !entries.length) {
    return [];
  }
  const min = tms - windowMs;
  const max = tms + windowMs;
  return entries.filter((entry) => {
    const ts = getTime(entry);
    return typeof ts === "number" && ts >= min && ts <= max;
  });
}

function getNetworkTimestampMs(entry) {
  return (
    entry.endTimestampMs ||
    entry.timestampMs ||
    entry.timestamp_ms ||
    0
  );
}

function findNearestIncident(incidents, tms) {
  if (!incidents.length) {
    return null;
  }
  let nearest = incidents[0];
  let best = Math.abs((nearest.timestampMs || 0) - tms);
  incidents.forEach((inc) => {
    const delta = Math.abs((inc.timestampMs || 0) - tms);
    if (delta < best) {
      best = delta;
      nearest = inc;
    }
  });
  return nearest;
}

function findNearestScreenshot(tms) {
  let shots = state.manifest?.artifacts?.screenshots?.items || [];
  if (!shots.length) {
    shots = state.events
      .filter((ev) => ev.type === "screenshot")
      .map((ev) => ({
        id: ev.id,
        timestampMs: ev.t_ms || 0,
        label: ev.summary || "Screenshot",
        kind: "screenshot",
      }));
  }
  if (!shots.length) {
    return null;
  }
  let nearest = shots[0];
  let best = Math.abs((nearest.timestampMs || 0) - tms);
  shots.forEach((shot) => {
    const delta = Math.abs((shot.timestampMs || 0) - tms);
    if (delta < best) {
      best = delta;
      nearest = shot;
    }
  });
  return nearest;
}

function findNearestTimelineEvent(currentTimeMs, events) {
  if (!Array.isArray(events) || !events.length) {
    return null;
  }
  let nearest = events[0];
  let best = Math.abs((nearest.t_ms || 0) - currentTimeMs);
  events.forEach((ev) => {
    const delta = Math.abs((ev.t_ms || 0) - currentTimeMs);
    if (delta < best) {
      best = delta;
      nearest = ev;
    }
  });
  return nearest;
}

function getImportantMarkers() {
  const markers = [];
  const incidents = getFilteredIncidents();
  incidents.forEach((inc) => {
    markers.push({
      id: inc.id,
      timestampMs: inc.timestampMs || 0,
      type: "incident",
      priority: 1,
      label: buildIncidentTitle(inc),
    });
  });
  const screenshots = state.manifest?.artifacts?.screenshots?.items || [];
  screenshots.forEach((shot) => {
    markers.push({
      id: shot.id,
      timestampMs: shot.timestampMs || 0,
      type: "screenshot",
      priority: 2,
      label: shot.label || "Screenshot",
    });
  });
  state.events.forEach((ev) => {
    const rawType = ev.raw?.type || "";
    if (rawType.startsWith("network") && ev.isError) {
      markers.push({
        id: ev.id,
        timestampMs: ev.t_ms || 0,
        type: "network",
        priority: 3,
        label: ev.summary,
      });
    }
    if (rawType.startsWith("console") && ev.isError) {
      markers.push({
        id: ev.id,
        timestampMs: ev.t_ms || 0,
        type: "console",
        priority: 4,
        label: ev.summary,
      });
    }
  });
  return markers;
}

function findNearestMarker(currentTimeMs, markers) {
  if (!markers.length) {
    return null;
  }
  let nearest = markers[0];
  let best = Math.abs((nearest.timestampMs || 0) - currentTimeMs);
  markers.forEach((marker) => {
    const delta = Math.abs((marker.timestampMs || 0) - currentTimeMs);
    if (delta < best || (delta === best && marker.priority < nearest.priority)) {
      best = delta;
      nearest = marker;
    }
  });
  return nearest;
}

function getVisibleNetworkEvents() {
  const entries = state.networkEntries || [];
  const base =
    state.panelModes.network === "near"
      ? filterEntriesNearTime(
          entries,
          state.playhead.currentTimeMs,
          state.playhead.timeWindowMs,
          getNetworkTimestampMs
        )
      : entries;
  return base.filter((entry) => {
    if (state.filters.errorOnly && !isNetworkError(entry)) {
      return false;
    }
    const bucket = classifyNetworkStatus(entry);
    if (state.filters.networkStatusBucket === "errors") {
      return isNetworkError(entry);
    }
    if (state.filters.networkStatusBucket === "4xx") {
      return bucket === "4xx";
    }
    if (state.filters.networkStatusBucket === "5xx") {
      return bucket === "5xx";
    }
    return true;
  });
}

function getVisibleConsoleEvents() {
  const entries = state.consoleEntries || [];
  const base =
    state.panelModes.console === "near"
      ? getEntriesNearTime(
          entries,
          state.playhead.currentTimeMs,
          state.playhead.timeWindowMs
        )
      : entries;
  const allowedLevels = getEffectiveConsoleLevels();
  return base.filter((entry) =>
    allowedLevels.includes(normalizeConsoleLevel(entry.level))
  );
}

function getCurrentMomentContext() {
  return {
    nearestIncident: findNearestIncident(getFilteredIncidents(), state.playhead.currentTimeMs),
    nearestScreenshot: findNearestScreenshot(state.playhead.currentTimeMs),
    nearbyNetworkCount: state.loadedArtifacts.network
      ? filterEntriesNearTime(
          state.networkEntries,
          state.playhead.currentTimeMs,
          state.playhead.timeWindowMs,
          getNetworkTimestampMs
        ).length
      : 0,
    nearbyConsoleCount: state.loadedArtifacts.console
      ? getEntriesNearTime(
          state.consoleEntries,
          state.playhead.currentTimeMs,
          state.playhead.timeWindowMs
        ).length
      : 0,
  };
}

function updateCurrentTimeContext() {
  if (!contextIncident || !contextScreenshot) {
    return;
  }
  const tms = state.playhead.currentTimeMs || 0;
  const moment = getCurrentMomentContext();
  const nearestIncident = moment.nearestIncident;
  state.playhead.nearestIncidentId = nearestIncident ? nearestIncident.id : null;
  contextIncident.textContent = nearestIncident
    ? `${buildIncidentTitle(nearestIncident)} (${formatTimeWithMs(
        nearestIncident.timestampMs || 0
      )})`
    : "None";
  const nearestShot = moment.nearestScreenshot;
  state.playhead.nearestScreenshotId = nearestShot ? nearestShot.id : null;
  contextScreenshot.textContent = nearestShot
    ? `${nearestShot.label || nearestShot.kind || "Screenshot"} (${formatTimeWithMs(
        nearestShot.timestampMs || 0
      )})`
    : "None";
  if (contextNetworkCount) {
    contextNetworkCount.textContent = state.loadedArtifacts.network
      ? String(moment.nearbyNetworkCount)
      : "-";
  }
  if (contextConsoleCount) {
    contextConsoleCount.textContent = state.loadedArtifacts.console
      ? String(moment.nearbyConsoleCount)
      : "-";
  }
  if (contextWindow) {
    contextWindow.textContent = `±${Math.round(state.playhead.timeWindowMs / 1000)}s`;
  }
}

function updateTimeAwarePanels() {
  if (state.loadedArtifacts.network && state.panelModes.network === "near") {
    renderNetworkPanel();
  }
  if (state.loadedArtifacts.console && state.panelModes.console === "near") {
    renderConsolePanel();
  }
}

function seekTo(targetTimeMs, source, options = {}) {
  let next = clampToDuration(targetTimeMs);
  const markers = getImportantMarkers();
  const snapEnabled = Boolean(options.snap);
  if (snapEnabled) {
    const nearest = findNearestMarker(next, markers);
    const thresholdMs = typeof options.snapThresholdMs === "number" ? options.snapThresholdMs : 500;
    if (nearest && Math.abs((nearest.timestampMs || 0) - next) <= thresholdMs) {
      next = nearest.timestampMs || 0;
      state.playhead.nearestMarkerId = nearest.id;
    } else {
      state.playhead.nearestMarkerId = null;
    }
  }
  if (options.updateNearest !== false) {
    const nearest = findNearestMarker(next, markers);
    state.playhead.nearestMarkerId = nearest ? nearest.id : null;
  }
  applyPlayhead(next, {
    ...options,
    source,
  });
}

function applyPlayhead(tms, options = {}) {
  const next = clampToDuration(tms);
  state.playhead.currentTimeMs = next;
  if (options.source) {
    state.playhead.lastSeekSource = options.source;
  }
  if (typeof options.isPlaying === "boolean") {
    state.playhead.isPlaying = options.isPlaying;
  }
  if (typeof options.isSeeking === "boolean") {
    state.playhead.isSeeking = options.isSeeking;
  }
  if (state.playhead.isSeeking) {
    state.playhead.pendingSeekTimeMs = next;
  } else {
    state.playhead.pendingSeekTimeMs = null;
  }
  if (!options.suppressSelectionUpdate) {
    if ("selectedEventId" in options) {
      state.playhead.selectedEventId = options.selectedEventId;
    }
    if ("selectedIncidentId" in options) {
      state.playhead.selectedIncidentId = options.selectedIncidentId;
    }
    if ("selectedScreenshotId" in options) {
      state.playhead.selectedScreenshotId = options.selectedScreenshotId;
    }
  }
  if (options.activePanel) {
    setActivePanel(options.activePanel);
  }
  state.playhead.lastCommittedTimeMs = next;
  updatePlayheadDisplay();
  if (options.updateContext !== false) {
    updateCurrentTimeContext();
  }
  if (
    options.syncVideo !== false &&
    !options.suppressVideoUpdate &&
    state.videoSyncAvailable &&
    options.source !== "video"
  ) {
    ensureVideoLoaded().then(() => syncVideoToTms(next));
  }
  if (options.updatePanels !== false) {
    if (state.playhead.followPlayhead || options.source !== "video") {
      updateTimeAwarePanels();
    }
  }
  if (options.refresh !== false) {
    refreshView();
  }
}

function setPackageMode(enabled, baseUrl = null) {
  state.packageMode = enabled;
  state.packageBaseUrl = baseUrl;
  if (openZipBtn) {
    openZipBtn.style.display = enabled ? "none" : "";
  }
  if (openAnotherBtn) {
    openAnotherBtn.style.display = enabled ? "none" : "";
  }
  if (resetBtn) {
    resetBtn.style.display = enabled ? "none" : "";
  }
  if (packageNotice) {
    packageNotice.textContent = enabled
      ? "Loaded from offline session package."
      : "";
    packageNotice.classList.toggle("hidden", !enabled);
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}`);
  }
  return response.json();
}

async function fetchBlob(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}`);
  }
  return response.blob();
}

async function loadScreenshotBlobsFromPaths(paths, baseUrl) {
  state.missingScreenshots = [];
  state.screenshotUrls.forEach((url) => URL.revokeObjectURL(url));
  state.screenshotUrls.clear();
  for (const path of paths) {
    try {
      const absolute = new URL(path, baseUrl).toString();
      const blob = await fetchBlob(absolute);
      const url = URL.createObjectURL(blob);
      const baseName = path.split("/").pop();
      state.screenshotUrls.set(baseName, url);
    } catch (error) {
      const baseName = path.split("/").pop();
      state.missingScreenshots.push(baseName);
    }
  }
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

async function initFromManifest(manifest, options = {}) {
  state.manifest = manifest;
  state.screenshotById = buildScreenshotIndexFromManifest(manifest);
  const manifestShots = manifest?.artifacts?.screenshots?.items || [];
  const screenshotFiles =
    options.screenshotFiles && options.screenshotFiles.length
      ? options.screenshotFiles
      : manifestShots.length
        ? manifestShots
            .map((shot) => (shot && shot.path ? shot.path : null))
            .filter(Boolean)
        : [];
  state.events = buildEventsFromManifest(manifest);
  state.events.sort((a, b) => a.t_ms - b.t_ms);
  state.playhead.durationMs =
    (manifest.timeline && manifest.timeline.endOffsetMs) ||
    manifest.session?.durationMs ||
    computeDurationMs(state.sessionLog, state.events);
  state.playhead.currentTimeMs = 0;
  state.videoSyncAvailable =
    Boolean(manifest?.artifacts?.recording?.present) &&
    state.playhead.durationMs > 0;
  state.playhead.hasRecording = Boolean(manifest?.artifacts?.recording?.present);

  applyManifestAvailability(manifest);
  renderSummaryFromManifest(manifest);
  updateTimelineSummary(manifest);
  renderScreenshotsPanel();
  setActivePanel("timeline");
  state.incidents = buildIncidentsFromManifest(manifest);
  renderIncidentRail();
  applySummaryInteractions();
  updatePlayheadDisplay();
  updateCurrentTimeContext();
  renderInspector();

  const referencedShots = screenshotFiles.map((name) => name.split("/").pop());
  if (options.baseUrl) {
    await loadScreenshotBlobsFromPaths(screenshotFiles, options.baseUrl);
  } else if (options.zip) {
    await loadScreenshotBlobs(options.zip, screenshotFiles, referencedShots);
  }
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
  if (playToggleBtn) {
    playToggleBtn.disabled = !hasRecording;
  }
  if (videoPlay) {
    videoPlay.disabled = !hasRecording;
  }

  if (!hasNetwork) {
    networkEmpty?.classList.remove("hidden");
  }
  if (!hasConsole) {
    consoleEmpty?.classList.remove("hidden");
  }
  if (!hasScreenshots) {
    screenshotsEmpty?.classList.remove("hidden");
  }

  networkFilterChips.forEach((chip) => {
    chip.disabled = !hasNetwork;
  });
  networkModeChips.forEach((chip) => {
    chip.disabled = !hasNetwork;
  });
  consoleLevelChips.forEach((chip) => {
    chip.disabled = !hasConsole;
  });
  consoleModeChips.forEach((chip) => {
    chip.disabled = !hasConsole;
  });
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

function updateTimelineSummary(manifest) {
  if (!timelineSummary) {
    return;
  }
  if (!manifest || !manifest.summary) {
    timelineSummary.textContent = "";
    return;
  }
  const parts = [];
  if (typeof manifest.summary.networkRequests === "number") {
    parts.push(`${manifest.summary.networkRequests} requests`);
  }
  if (typeof manifest.summary.consoleErrors === "number") {
    parts.push(`${manifest.summary.consoleErrors} console errors`);
  }
  if (typeof manifest.summary.networkFailures === "number") {
    parts.push(`${manifest.summary.networkFailures} network failures`);
  }
  if (typeof manifest.summary.screenshots === "number") {
    parts.push(`${manifest.summary.screenshots} screenshots`);
  }
  if (typeof manifest.summary.hasRecording === "boolean") {
    parts.push(manifest.summary.hasRecording ? "recording" : "no recording");
  }
  timelineSummary.textContent = parts.join(" • ");
}

function buildIncidentsFromManifest(manifest) {
  const incidents = [];
  if (!manifest || !manifest.timeline || !Array.isArray(manifest.timeline.events)) {
    return incidents;
  }
  manifest.timeline.events.forEach((ev) => {
    if (!ev || !ev.type) {
      return;
    }
    if (ev.type.startsWith("network")) {
      const severity = ev.type === "network-error" ? "error" : "warning";
      incidents.push({
        id: `inc_${ev.id}`,
        type: ev.type === "network-error" ? "network-5xx" : "network-4xx",
        timestampMs: ev.timestampMs || 0,
        severity,
        title: ev.label || "Network issue",
        subtitle: formatTimeWithMs(ev.timestampMs || 0),
        sourceRef: ev.ref || ev.id,
        panelTarget: "network",
        statusCode: null,
        consoleLevel: "",
        url: "",
      });
    } else if (ev.type.startsWith("console")) {
      incidents.push({
        id: `inc_${ev.id}`,
        type: ev.type === "console-error" ? "console-error" : "console-warning",
        timestampMs: ev.timestampMs || 0,
        severity: ev.type === "console-error" ? "error" : "warning",
        title: ev.label || "Console issue",
        subtitle: formatTimeWithMs(ev.timestampMs || 0),
        sourceRef: ev.ref || ev.id,
        panelTarget: "console",
        statusCode: null,
        consoleLevel: ev.type.replace("console-", ""),
        url: "",
      });
    }
  });
  return incidents;
}

function applySummaryInteractions() {
  if (!summaryPanel) {
    return;
  }
  if (summaryPanel.dataset.bound === "true") {
    return;
  }
  summaryPanel.dataset.bound = "true";
  summaryPanel.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const label = target.closest(".summary-item");
    if (!label) {
      return;
    }
    const key = label.querySelector(".summary-label")?.textContent || "";
    if (key === "Errors") {
      state.filters.errorOnly = true;
      if (errorOnlyToggle) {
        errorOnlyToggle.checked = true;
      }
      renderIncidentRail();
      renderTimelineLanes(state.events);
    } else if (key === "Network") {
      setActivePanel("network");
      state.filters.networkStatusBucket = "errors";
      networkFilterChips.forEach((chip) => {
        chip.classList.toggle("active", chip.dataset.netFilter === "errors");
      });
      ensureNetworkLogsLoaded().then(renderNetworkPanel);
    } else if (key === "Console") {
      setActivePanel("console");
      state.filters.consoleLevels = ["error"];
      consoleLevelChips.forEach((chip) => {
        chip.classList.toggle("active", chip.dataset.consoleLevel === "error");
      });
      ensureConsoleLogsLoaded().then(renderConsolePanel);
    } else if (key === "Screenshots") {
      setActivePanel("screenshots");
      renderScreenshotsPanel();
    } else if (key === "Recording") {
      setActivePanel("timeline");
    }
    renderIncidentRail();
    updateCurrentTimeContext();
  });
}

function buildIncidentsFromNetwork(entries) {
  return entries
    .filter((entry) => isNetworkError(entry))
    .map((entry) => {
      const bucket = classifyNetworkStatus(entry);
      const type =
        bucket === "5xx"
          ? "network-5xx"
          : bucket === "4xx"
            ? "network-4xx"
            : "network-failure";
      return {
        id: `inc_${entry.id}`,
        type,
        timestampMs: entry.timestampMs || entry.timestamp_ms || 0,
        severity: bucket === "5xx" ? "error" : "warning",
        title: buildIncidentTitle({
          type: "network",
          statusCode: entry.response_status || entry.status,
          method: entry.method,
          url: entry.url,
        }),
        subtitle: formatTimeWithMs(entry.timestampMs || entry.timestamp_ms || 0),
        sourceRef: entry.id,
        panelTarget: "network",
        statusCode: entry.response_status || entry.status || 0,
        consoleLevel: "",
        url: entry.url || "",
      };
    });
}

function buildIncidentsFromConsole(entries) {
  return entries
    .filter((entry) => ["error", "warning"].includes(normalizeConsoleLevel(entry.level)))
    .map((entry) => {
      const level = normalizeConsoleLevel(entry.level);
      return {
        id: `inc_${entry.id}`,
        type: level === "error" ? "console-error" : "console-warning",
        timestampMs: entry.timestamp_ms || 0,
        severity: level === "error" ? "error" : "warning",
        title: `Console ${level}: ${entry.message || ""}`.trim(),
        subtitle: formatTimeWithMs(entry.timestampMs || entry.timestamp_ms || 0),
        sourceRef: entry.id,
        panelTarget: "console",
        statusCode: 0,
        consoleLevel: level,
        url: entry.url || "",
      };
    });
}

function mergeIncidents(existing, incoming) {
  const map = new Map();
  existing.forEach((inc) => {
    map.set(inc.id, inc);
  });
  incoming.forEach((inc) => {
    map.set(inc.id, inc);
  });
  return Array.from(map.values());
}

function getFilteredIncidents() {
  let incidents = state.incidents.slice();
  if (state.filters.errorOnly) {
    incidents = incidents.filter((inc) => inc.severity === "error");
  }
  if (state.filters.networkStatusBucket !== "all") {
    if (state.filters.networkStatusBucket === "errors") {
      incidents = incidents.filter((inc) =>
        ["network-4xx", "network-5xx", "network-failure"].includes(inc.type)
      );
    } else if (state.filters.networkStatusBucket === "4xx") {
      incidents = incidents.filter((inc) => inc.type === "network-4xx");
    } else if (state.filters.networkStatusBucket === "5xx") {
      incidents = incidents.filter((inc) => inc.type === "network-5xx");
    }
  }
  const allowedLevels = getEffectiveConsoleLevels();
  incidents = incidents.filter((inc) => {
    if (inc.type.startsWith("console")) {
      return allowedLevels.includes(inc.consoleLevel || "");
    }
    return true;
  });
  incidents.sort((a, b) => a.timestampMs - b.timestampMs);
  return incidents;
}

function renderIncidentRail() {
  if (!incidentPanel || !incidentList || !incidentEmpty) {
    return;
  }
  if (!state.filters.showIncidentRail) {
    incidentPanel.classList.add("hidden");
    return;
  }
  const incidents = getFilteredIncidents();
  incidentPanel.classList.remove("hidden");
  incidentList.innerHTML = "";
  if (!incidents.length) {
    incidentEmpty.classList.remove("hidden");
    return;
  }
  incidentEmpty.classList.add("hidden");
  incidents.forEach((inc) => {
    const row = document.createElement("div");
    row.className = "incident-item";
    if (state.playhead.selectedIncidentId === inc.id) {
      row.classList.add("active");
    }
    const dot = document.createElement("div");
    dot.className = `incident-severity ${inc.severity}`;
    const body = document.createElement("div");
    const title = document.createElement("div");
    title.className = "incident-title";
    title.textContent = buildIncidentTitle(inc);
    const subtitle = document.createElement("div");
    subtitle.className = "incident-subtitle";
    subtitle.textContent = inc.subtitle;
    body.appendChild(title);
    body.appendChild(subtitle);
    row.appendChild(dot);
    row.appendChild(body);
    row.addEventListener("click", () => handleIncidentSelection(inc, "incident-click"));
    incidentList.appendChild(row);
  });
  updateIncidentNavControls();
}

function updateIncidentNavControls() {
  if (!prevIncidentBtn || !nextIncidentBtn) {
    return;
  }
  const incidents = getFilteredIncidents();
  const disabled = incidents.length === 0;
  prevIncidentBtn.disabled = disabled;
  nextIncidentBtn.disabled = disabled;
}

function navigateIncident(direction) {
  const incidents = getFilteredIncidents();
  if (!incidents.length) {
    return;
  }
  const currentId = state.playhead.selectedIncidentId;
  let index = incidents.findIndex((inc) => inc.id === currentId);
  if (index === -1) {
    const tms = state.playhead.currentTimeMs || 0;
    if (direction > 0) {
      index = incidents.findIndex((inc) => (inc.timestampMs || 0) > tms);
      if (index === -1) {
        index = incidents.length - 1;
      }
    } else {
      index = incidents.reduce((acc, inc, idx) => {
        return (inc.timestampMs || 0) < tms ? idx : acc;
      }, -1);
      if (index === -1) {
        index = 0;
      }
    }
  } else {
    index = Math.min(Math.max(index + direction, 0), incidents.length - 1);
  }
  handleIncidentSelection(
    incidents[index],
    direction > 0 ? "next-incident" : "prev-incident"
  );
}

function renderScreenshotsPanel() {
  if (!screenshotsList || !screenshotsEmpty) {
    return;
  }
  const items = state.manifest?.artifacts?.screenshots?.items || [];
  screenshotsList.innerHTML = "";
  if (!items.length) {
    screenshotsEmpty.classList.remove("hidden");
    return;
  }
  screenshotsEmpty.classList.add("hidden");
  items.forEach((shot) => {
    const row = document.createElement("div");
    row.className = "screenshot-item";
    if (state.playhead.selectedScreenshotId && shot.id === state.playhead.selectedScreenshotId) {
      row.classList.add("active");
    }
    const thumb = document.createElement("img");
    thumb.className = "screenshot-thumb";
    const baseName = shot.path ? shot.path.split("/").pop() : null;
    if (baseName && state.screenshotUrls.has(baseName)) {
      thumb.src = state.screenshotUrls.get(baseName);
    }
    const meta = document.createElement("div");
    const title = document.createElement("div");
    title.textContent = shot.label || shot.kind || "Screenshot";
    const subtitle = document.createElement("div");
    subtitle.className = "muted";
    subtitle.textContent = formatTimeWithMs(shot.timestampMs || 0);
    meta.appendChild(title);
    meta.appendChild(subtitle);
    row.appendChild(thumb);
    row.appendChild(meta);
    row.addEventListener("click", () => {
      state.playhead.selectedScreenshotId = shot.id;
      setInspector("screenshot", shot.id);
      const baseName = shot.path ? shot.path.split("/").pop() : null;
      const linkedEvent = state.events.find(
        (ev) =>
          ev.refs?.ref === shot.id ||
          (baseName && ev.refs?.screenshotFile === baseName)
      );
      handleEventSelection(
        linkedEvent || {
          id: shot.id,
          t_ms: shot.timestampMs || 0,
          type: "screenshot",
          summary: shot.label || "Screenshot",
          refs: { ref: shot.id, screenshotFile: baseName },
          raw: { type: "screenshot" },
        },
        "screenshot"
      );
      renderScreenshotsPanel();
      renderScreenshotPreview();
    });
    screenshotsList.appendChild(row);
  });
  renderScreenshotPreview();
}

function renderScreenshotPreview() {
  if (!screenshotPreview) {
    return;
  }
  const shot = state.playhead.selectedScreenshotId
    ? state.screenshotById.get(state.playhead.selectedScreenshotId)
    : null;
  if (!shot) {
    screenshotPreview.textContent = "Select a screenshot to preview.";
    return;
  }
  screenshotPreview.innerHTML = "";
  const img = document.createElement("img");
  const baseName = shot.path ? shot.path.split("/").pop() : null;
  if (baseName && state.screenshotUrls.has(baseName)) {
    img.src = state.screenshotUrls.get(baseName);
  }
  const meta = document.createElement("div");
  meta.className = "muted";
  const pieces = [
    shot.kind ? `Kind: ${shot.kind}` : null,
    typeof shot.timestampMs === "number"
      ? `Time: ${formatTimeWithMs(shot.timestampMs)}`
      : null,
  ].filter(Boolean);
  meta.textContent = pieces.join(" • ");
  screenshotPreview.appendChild(img);
  screenshotPreview.appendChild(meta);
}

function renderNetworkPanel() {
  if (!networkList || !networkEmpty) {
    return;
  }
  const entries = state.networkEntries || [];
  const filtered = getVisibleNetworkEvents();
  networkList.innerHTML = "";
  if (!entries.length) {
    networkEmpty.classList.remove("hidden");
    networkFilteredEmpty?.classList.add("hidden");
    return;
  }
  networkEmpty.classList.add("hidden");
  networkFilteredEmpty?.classList.toggle("hidden", filtered.length > 0);
  if (networkFilteredEmpty && filtered.length === 0 && state.panelModes.network === "near") {
    networkFilteredEmpty.textContent = "No network entries near current time.";
  } else if (networkFilteredEmpty) {
    networkFilteredEmpty.textContent = "No network entries match current filter.";
  }
  const maxRows = 500;
  const rows = filtered.slice(0, maxRows);
  rows.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "data-row";
    if (state.selectedNetworkId && entry.id === state.selectedNetworkId) {
      row.classList.add("active");
    }
    const time = document.createElement("div");
    time.className = "muted";
    const entryTime =
      typeof entry.endTimestampMs === "number"
        ? entry.endTimestampMs
        : typeof entry.timestampMs === "number"
          ? entry.timestampMs
          : entry.timestamp_ms || 0;
    time.textContent = formatTimeWithMs(entryTime);
    const status = document.createElement("div");
    status.textContent = entry.response_status || entry.status || "-";
    const url = document.createElement("div");
    url.textContent = `${entry.method || ""} ${entry.url || ""}`.trim();
    row.appendChild(time);
    row.appendChild(status);
    row.appendChild(url);
    row.addEventListener("click", () => {
      state.selectedNetworkId = entry.id;
      setInspector("network", entry.id);
      if (typeof entryTime === "number") {
        seekTo(entryTime, "network", {
          selectedEventId: state.playhead.selectedEventId,
        });
      }
      renderNetworkPanel();
    });
    networkList.appendChild(row);
  });
  if (filtered.length > maxRows) {
    const note = document.createElement("div");
    note.className = "muted";
    note.textContent = `Showing first ${maxRows} entries of ${filtered.length}.`;
    networkList.appendChild(note);
  }
  const activeRow = networkList.querySelector(".data-row.active");
  if (activeRow) {
    activeRow.scrollIntoView({ block: "nearest" });
  }
}

function renderConsolePanel() {
  if (!consoleList || !consoleEmpty) {
    return;
  }
  const entries = state.consoleEntries || [];
  const filtered = getVisibleConsoleEvents();
  consoleList.innerHTML = "";
  if (!entries.length) {
    consoleEmpty.classList.remove("hidden");
    consoleFilteredEmpty?.classList.add("hidden");
    return;
  }
  consoleEmpty.classList.add("hidden");
  consoleFilteredEmpty?.classList.toggle("hidden", filtered.length > 0);
  if (consoleFilteredEmpty && filtered.length === 0 && state.panelModes.console === "near") {
    consoleFilteredEmpty.textContent = "No console entries near current time.";
  } else if (consoleFilteredEmpty) {
    consoleFilteredEmpty.textContent = "No console entries match current filter.";
  }
  const maxRows = 500;
  const rows = filtered.slice(0, maxRows);
  rows.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "data-row";
    if (state.selectedConsoleId && entry.id === state.selectedConsoleId) {
      row.classList.add("active");
    }
    const time = document.createElement("div");
    time.className = "muted";
    const entryTime =
      typeof entry.timestamp_ms === "number"
        ? entry.timestamp_ms
        : entry.timestampMs || 0;
    time.textContent = formatTimeWithMs(entryTime);
    const level = document.createElement("div");
    level.textContent = (entry.level || "log").toUpperCase();
    const msg = document.createElement("div");
    msg.textContent = entry.message || "";
    row.appendChild(time);
    row.appendChild(level);
    row.appendChild(msg);
    row.addEventListener("click", () => {
      state.selectedConsoleId = entry.id;
      setInspector("console", entry.id);
      if (typeof entryTime === "number") {
        seekTo(entryTime, "console", {
          selectedEventId: state.playhead.selectedEventId,
        });
      }
      renderConsolePanel();
    });
    consoleList.appendChild(row);
  });
  if (filtered.length > maxRows) {
    const note = document.createElement("div");
    note.className = "muted";
    note.textContent = `Showing first ${maxRows} entries of ${filtered.length}.`;
    consoleList.appendChild(note);
  }
  const activeRow = consoleList.querySelector(".data-row.active");
  if (activeRow) {
    activeRow.scrollIntoView({ block: "nearest" });
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
  if (state.packageMode && state.packageBaseUrl && state.manifest?.artifacts?.recording?.path) {
    try {
      const absolute = new URL(
        state.manifest.artifacts.recording.path,
        state.packageBaseUrl
      ).toString();
      const blob = await fetchBlob(absolute);
      state.videoUrl = URL.createObjectURL(blob);
      videoEl.src = state.videoUrl;
      videoPanel.classList.remove("hidden");
      state.videoMissing = false;
      return;
    } catch (error) {
      state.videoMissing = true;
    }
  }
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
    if (state.packageMode && state.packageBaseUrl) {
      try {
        const absolute = new URL(path, state.packageBaseUrl).toString();
        const response = await fetch(absolute);
        if (!response.ok) {
          return [];
        }
        const raw = await response.text();
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
      } catch (error) {
        return [];
      }
    }
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

async function loadIncidentsFromPackage(baseUrl) {
  try {
    const incidentsUrl = new URL("incidents.json", baseUrl).toString();
    const response = await fetch(incidentsUrl);
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }
    return data
      .map((item, index) => ({
        id: item.id || `inc_pkg_${index + 1}`,
        type: item.type || "manifest-marker",
        timestampMs: item.timestampMs || item.timestamp_ms || 0,
        severity: item.severity || "warning",
        title: item.title || item.label || "Incident",
        subtitle: formatTimeWithMs(item.timestampMs || item.timestamp_ms || 0),
        sourceRef: item.sourceRef || item.ref || item.id || null,
        panelTarget: item.panelTarget || "timeline",
        statusCode: item.statusCode || 0,
        consoleLevel: item.consoleLevel || "",
        url: item.url || "",
      }))
      .filter((item) => item.timestampMs !== null);
  } catch (error) {
    return [];
  }
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

function normalizeNetworkEntry(entry) {
  const startMs =
    typeof entry.timestamp_ms === "number"
      ? entry.timestamp_ms
      : typeof entry.timestampMs === "number"
        ? entry.timestampMs
        : typeof entry.timestamp_epoch_ms === "number"
          ? entry.timestamp_epoch_ms
          : 0;
  const durationMs =
    entry.duration_ms ||
    entry.durationMs ||
    entry.timing ||
    entry.total_time_ms ||
    0;
  const endMs =
    typeof entry.end_timestamp_ms === "number"
      ? entry.end_timestamp_ms
      : durationMs
        ? startMs + durationMs
        : startMs;
  return {
    ...entry,
    timestampMs: startMs,
    startTimestampMs: startMs,
    endTimestampMs: endMs,
    durationMs: durationMs,
  };
}

function normalizeConsoleEntry(entry) {
  const timestampMs =
    typeof entry.timestamp_ms === "number"
      ? entry.timestamp_ms
      : typeof entry.timestampMs === "number"
        ? entry.timestampMs
        : typeof entry.timestamp_epoch_ms === "number"
          ? entry.timestamp_epoch_ms
          : 0;
  return {
    ...entry,
    timestampMs,
  };
}

async function ensureNetworkLogsLoaded() {
  if (state.loadingNetwork || state.networkIndex) {
    return;
  }
  state.loadingNetwork = true;
  try {
    const manifestPath = state.manifest?.artifacts?.network?.path || null;
    const entries = await loadNdjsonEntries(manifestPath);
    const normalized = entries.map(normalizeNetworkEntry);
    state.networkEntries = normalized;
    state.networkIndex = indexEntriesById(normalized);
    state.loadedArtifacts.network = true;
    state.incidents = mergeIncidents(
      state.incidents,
      buildIncidentsFromNetwork(normalized)
    );
    renderIncidentRail();
  } catch (error) {
    state.networkIndex = new Map();
    state.networkEntries = [];
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
    const normalized = entries.map(normalizeConsoleEntry);
    state.consoleEntries = normalized;
    state.consoleIndex = indexEntriesById(normalized);
    state.loadedArtifacts.console = true;
    state.incidents = mergeIncidents(
      state.incidents,
      buildIncidentsFromConsole(normalized)
    );
    renderIncidentRail();
  } catch (error) {
    state.consoleIndex = new Map();
    state.consoleEntries = [];
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

function getTimelineMarkerClass(ev) {
  if (ev.raw && typeof ev.raw.type === "string") {
    if (ev.raw.type === "screenshot") {
      return "screenshot";
    }
    if (ev.raw.type.startsWith("network")) {
      return "network";
    }
    if (ev.raw.type.startsWith("console")) {
      return "console";
    }
    if (ev.raw.type.startsWith("recording")) {
      return "recording";
    }
  }
  if (ev.type === "screenshot") {
    return "screenshot";
  }
  if (ev.type === "network") {
    return "network";
  }
  if (ev.type === "console") {
    return "console";
  }
  return ev.isError ? "error" : "marker";
}

function renderTimelineLanes(events) {
  if (!timelineLanes) {
    return;
  }
  const duration = state.playhead.durationMs || 0;
  const tracks = Array.from(timelineLanes.querySelectorAll(".lane-track"));
  tracks.forEach((track) => {
    track.innerHTML = "";
  });
  if (!duration) {
    return;
  }
  const screenshots = events.filter((ev) => ev.type === "screenshot");
  const networkErrors = events.filter((ev) => {
    const rawType = ev.raw?.type || "";
    return (
      rawType.startsWith("network") &&
      (rawType.includes("error") || rawType.includes("warning") || ev.isError)
    );
  });
  const consoleErrors = events.filter((ev) => {
    const rawType = ev.raw?.type || "";
    return (
      rawType.startsWith("console") &&
      (rawType.includes("error") || rawType.includes("warning") || ev.isError)
    );
  });
  const markerEvents = events.filter((ev) => {
    const rawType = ev.raw?.type || "";
    const isMarker =
      ev.type === "marker" || rawType.startsWith("recording") || ev.isError;
    if (state.filters.errorOnly) {
      return isMarker && ev.isError;
    }
    return isMarker;
  });
  const laneMap = {
    screenshots,
    network: networkErrors,
    console: consoleErrors,
    markers: markerEvents,
  };
  Object.entries(laneMap).forEach(([laneName, items]) => {
    const track = timelineLanes.querySelector(
      `[data-lane="${laneName}"] .lane-track`
    );
    if (!track) {
      return;
    }
    items.forEach((ev) => {
      if (state.filters.errorOnly && !ev.isError && laneName !== "markers") {
        return;
      }
      const marker = document.createElement("div");
      marker.className = "lane-marker";
      marker.classList.add(laneName === "markers" ? "marker" : laneName);
      if (ev.isError) {
        marker.classList.add("error");
      }
      const left = (ev.t_ms / duration) * 100;
      marker.style.left = `${left}%`;
      marker.title = ev.summary;
      if (state.playhead.selectedEventId && ev.id === state.playhead.selectedEventId) {
        marker.classList.add("selected");
      }
      if (state.playhead.nearestMarkerId && ev.id === state.playhead.nearestMarkerId) {
        marker.classList.add("nearest");
      }
      marker.addEventListener("click", () => handleEventSelection(ev, "timeline"));
      track.appendChild(marker);
    });
    if (laneName === "markers") {
      const incidents = getFilteredIncidents();
      incidents.forEach((inc) => {
        const marker = document.createElement("div");
        marker.className = "lane-marker incident";
        if (inc.severity === "error") {
          marker.classList.add("error");
        }
        const left = ((inc.timestampMs || 0) / duration) * 100;
        marker.style.left = `${left}%`;
        marker.title = buildIncidentTitle(inc);
        if (state.playhead.selectedIncidentId === inc.id) {
          marker.classList.add("selected");
        }
        if (state.playhead.nearestMarkerId && inc.id === state.playhead.nearestMarkerId) {
          marker.classList.add("nearest");
        }
        marker.addEventListener("click", () => handleIncidentSelection(inc, "incident-click"));
        track.appendChild(marker);
      });
    }
  });
}

function buildFilters() {
  return {
    marker: filterMarkers.checked,
    network: filterNetwork.checked,
    console: filterConsole.checked,
    screenshot: filterScreenshots.checked,
    recording: true,
    errorsOnly: filterErrors.checked,
    query: searchInput.value.trim().toLowerCase(),
  };
}

function filterEvents(events) {
  const filters = buildFilters();
  return events.filter((ev) => {
    if (ev.t_ms > state.playhead.currentTimeMs) {
      return false;
    }
    if (!filters[ev.type]) {
      return false;
    }
    if ((filters.errorsOnly || state.filters.errorOnly) && !ev.isError) {
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

function getEventBadge(ev) {
  if (ev.raw && typeof ev.raw.type === "string") {
    const rawType = ev.raw.type;
    if (rawType.startsWith("recording")) {
      return "REC";
    }
    if (rawType.startsWith("network")) {
      return "NET";
    }
    if (rawType.startsWith("console")) {
      return "CON";
    }
  }
  return EVENT_ICONS[ev.type] || ev.type;
}

function renderEventList() {
  eventList.innerHTML = "";
  state.filtered.forEach((ev, index) => {
    const item = document.createElement("div");
    item.className = "event-item";
    item.dataset.index = String(index);
    if (state.playhead.selectedEventId && ev.id === state.playhead.selectedEventId) {
      item.classList.add("active");
    }

    const time = document.createElement("div");
    time.className = "event-time";
    time.textContent = formatTime(ev.t_ms);

    const summary = document.createElement("div");
    summary.className = "event-summary";
    const badge = document.createElement("span");
    badge.className = "event-badge";
    badge.textContent = getEventBadge(ev);
    summary.appendChild(badge);
    const text = document.createElement("span");
    text.textContent = ev.summary;
    summary.appendChild(text);

    item.appendChild(time);
    item.appendChild(summary);
    item.addEventListener("click", () => handleEventSelection(ev, "timeline"));
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

function truncateText(value, maxLength = 1200) {
  if (typeof value !== "string") {
    return { text: String(value ?? ""), truncated: false };
  }
  if (value.length <= maxLength) {
    return { text: value, truncated: false };
  }
  return { text: value.slice(0, maxLength), truncated: true };
}

function normalizeInspectorValue(value) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
}

function createCopyButton(label, text) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "copy-button";
  button.textContent = label;
  button.addEventListener("click", async () => {
    if (!text) {
      return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const helper = document.createElement("textarea");
        helper.value = text;
        helper.style.position = "fixed";
        helper.style.opacity = "0";
        document.body.appendChild(helper);
        helper.select();
        document.execCommand("copy");
        document.body.removeChild(helper);
      }
      button.textContent = "Copied";
      setTimeout(() => {
        button.textContent = label;
      }, 1200);
    } catch (error) {
      button.textContent = "Copy failed";
      setTimeout(() => {
        button.textContent = label;
      }, 1200);
    }
  });
  return button;
}

function renderExpandableSection(title, value, copyLabel) {
  const section = document.createElement("div");
  section.className = "inspector-section";
  const header = document.createElement("h3");
  header.textContent = title;
  section.appendChild(header);
  if (!value) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "Not available.";
    section.appendChild(empty);
    return section;
  }
  const normalized = normalizeInspectorValue(value);
  const truncated = truncateText(normalized);
  const code = document.createElement("div");
  code.className = "code-block";
  code.textContent = truncated.text;
  section.appendChild(code);
  const actions = document.createElement("div");
  actions.className = "inspector-actions";
  actions.appendChild(createCopyButton(copyLabel, normalized));
  if (truncated.truncated) {
    const expandBtn = document.createElement("button");
    expandBtn.type = "button";
    expandBtn.className = "expand-toggle";
    expandBtn.textContent = "Show more";
    expandBtn.addEventListener("click", () => {
      const expanded = expandBtn.textContent === "Show more";
      expandBtn.textContent = expanded ? "Show less" : "Show more";
      code.textContent = expanded ? normalized : truncated.text;
    });
    actions.appendChild(expandBtn);
  }
  section.appendChild(actions);
  return section;
}

function setInspector(type, id) {
  state.inspector.type = type;
  state.inspector.id = id;
  renderInspector();
}

function renderInspector() {
  if (!inspectorBody || !inspectorTitle) {
    return;
  }
  inspectorBody.innerHTML = "";
  const { type, id } = state.inspector;
  if (!type || !id) {
    inspectorTitle.textContent = "Select an item";
    inspectorBody.textContent =
      "Inspect a network request, console entry, screenshot, or incident.";
    inspectorBody.classList.add("muted");
    return;
  }
  inspectorBody.classList.remove("muted");
  if (type === "network") {
    const entry = state.networkEntries.find((item) => item.id === id);
    inspectorTitle.textContent = "Network request";
    if (!entry) {
      inspectorBody.textContent = "Network entry not found.";
      return;
    }
    const summary = document.createElement("div");
    summary.className = "inspector-section";
    summary.innerHTML = `
      <div><strong>${entry.method || ""} ${entry.url || ""}</strong></div>
      <div class="muted">Status: ${entry.response_status || entry.status || "-"}</div>
      <div class="muted">Duration: ${entry.durationMs || entry.timing || "-"}</div>
    `;
    inspectorBody.appendChild(summary);
    const actions = document.createElement("div");
    actions.className = "inspector-actions";
    actions.appendChild(createCopyButton("Copy URL", entry.url || ""));
    inspectorBody.appendChild(actions);
    inspectorBody.appendChild(
      renderExpandableSection("Request Headers", entry.request_headers, "Copy headers")
    );
    inspectorBody.appendChild(
      renderExpandableSection(
        "Request Body",
        entry.request_post_data || entry.request_body || entry.request_body_raw,
        "Copy request body"
      )
    );
    inspectorBody.appendChild(
      renderExpandableSection("Response Headers", entry.response_headers, "Copy headers")
    );
    inspectorBody.appendChild(
      renderExpandableSection("Response Body", entry.response_body, "Copy response body")
    );
    inspectorBody.appendChild(
      renderExpandableSection("Raw Entry", entry, "Copy raw entry")
    );
    return;
  }
  if (type === "console") {
    const entry = state.consoleEntries.find((item) => item.id === id);
    inspectorTitle.textContent = "Console log";
    if (!entry) {
      inspectorBody.textContent = "Console entry not found.";
      return;
    }
    const summary = document.createElement("div");
    summary.className = "inspector-section";
    summary.innerHTML = `
      <div><strong>${(entry.level || "log").toUpperCase()}</strong></div>
      <div>${entry.message || ""}</div>
    `;
    inspectorBody.appendChild(summary);
    inspectorBody.appendChild(
      renderExpandableSection("Stack Trace", entry.stack, "Copy stack")
    );
    inspectorBody.appendChild(
      renderExpandableSection("Raw Entry", entry, "Copy raw entry")
    );
    return;
  }
  if (type === "screenshot") {
    const shot = state.screenshotById.get(id);
    inspectorTitle.textContent = "Screenshot";
    if (!shot) {
      inspectorBody.textContent = "Screenshot not found.";
      return;
    }
    const img = document.createElement("img");
    const baseName = shot.path ? shot.path.split("/").pop() : null;
    if (baseName && state.screenshotUrls.has(baseName)) {
      img.src = state.screenshotUrls.get(baseName);
    }
    img.style.maxWidth = "100%";
    img.style.borderRadius = "10px";
    inspectorBody.appendChild(img);
    const meta = document.createElement("div");
    meta.className = "inspector-section";
    meta.innerHTML = `
      <div>Time: ${formatTimeWithMs(shot.timestampMs || 0)}</div>
      <div>Kind: ${shot.kind || "-"}</div>
      <div>Label: ${shot.label || "-"}</div>
    `;
    inspectorBody.appendChild(meta);
    return;
  }
  if (type === "incident") {
    const incident = state.incidents.find((item) => item.id === id);
    inspectorTitle.textContent = "Incident";
    if (!incident) {
      inspectorBody.textContent = "Incident not found.";
      return;
    }
    const summary = document.createElement("div");
    summary.className = "inspector-section";
    summary.innerHTML = `
      <div><strong>${buildIncidentTitle(incident)}</strong></div>
      <div class="muted">Severity: ${incident.severity || "-"}</div>
      <div class="muted">Time: ${formatTimeWithMs(incident.timestampMs || 0)}</div>
    `;
    inspectorBody.appendChild(summary);
    inspectorBody.appendChild(
      renderExpandableSection("Raw Incident", incident, "Copy raw incident")
    );
  }
}

function setActivePanel(panel) {
  state.playhead.activePanel = panel;
  panelTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.panel === panel);
  });
  panelGroups.forEach((group) => {
    const active = group.dataset.panel === panel;
    group.classList.toggle("hidden", !active);
  });
  panelsWithFilters.forEach((panelEl) => {
    const active = panelEl.dataset.panel === panel;
    panelEl.classList.toggle("hidden", !active);
  });
}

function mapEventToPanel(ev) {
  if (ev.raw && typeof ev.raw.type === "string") {
    const rawType = ev.raw.type;
    if (rawType === "screenshot") {
      return "screenshots";
    }
    if (rawType.startsWith("network")) {
      return "network";
    }
    if (rawType.startsWith("console")) {
      return "console";
    }
    if (rawType.startsWith("recording")) {
      return "timeline";
    }
  }
  if (ev.type === "screenshot") {
    return "screenshots";
  }
  if (ev.type === "network") {
    return "network";
  }
  if (ev.type === "console") {
    return "console";
  }
  return "timeline";
}

function handleEventSelection(ev, source = "timeline") {
  if (!ev) {
    return;
  }
  const panel = mapEventToPanel(ev);
  const matched = ev.refs?.ref
    ? state.incidents.find((inc) => inc.sourceRef === ev.refs.ref)
    : null;
  const screenshotId =
    panel === "screenshots" && ev.refs?.ref ? ev.refs.ref : state.playhead.selectedScreenshotId;
  seekTo(ev.t_ms || 0, source, {
    activePanel: panel,
    selectedEventId: ev.id,
    selectedIncidentId: matched ? matched.id : state.playhead.selectedIncidentId,
    selectedScreenshotId: screenshotId,
  });
  renderDetails(ev);
  if (panel === "screenshots") {
    if (screenshotId) {
      setInspector("screenshot", screenshotId);
    }
    renderScreenshotsPanel();
  }
  if (panel === "network") {
    state.selectedNetworkId = ev.refs?.ref || null;
    if (state.selectedNetworkId) {
      setInspector("network", state.selectedNetworkId);
    }
    ensureNetworkLogsLoaded().then(renderNetworkPanel);
  }
  if (panel === "console") {
    state.selectedConsoleId = ev.refs?.ref || null;
    if (state.selectedConsoleId) {
      setInspector("console", state.selectedConsoleId);
    }
    ensureConsoleLogsLoaded().then(renderConsolePanel);
  }
  renderIncidentRail();
}

function handleIncidentSelection(incident, source = "incident-click") {
  if (!incident) {
    return;
  }
  const eventMatch = state.events.find(
    (ev) =>
      ev.id === incident.sourceRef ||
      (ev.refs?.ref && ev.refs.ref === incident.sourceRef)
  );
  seekTo(incident.timestampMs || 0, source, {
    activePanel: incident.panelTarget,
    selectedIncidentId: incident.id,
    selectedEventId: eventMatch ? eventMatch.id : state.playhead.selectedEventId,
  });
  setInspector("incident", incident.id);
  if (incident.panelTarget === "network") {
    setActivePanel("network");
    state.selectedNetworkId = incident.sourceRef;
    ensureNetworkLogsLoaded().then(renderNetworkPanel);
  } else if (incident.panelTarget === "console") {
    setActivePanel("console");
    state.selectedConsoleId = incident.sourceRef;
    ensureConsoleLogsLoaded().then(renderConsolePanel);
  } else {
    setActivePanel("timeline");
  }
  if (eventMatch) {
    renderDetails(eventMatch);
  }
  renderIncidentRail();
}

function syncVideoToTms(tms) {
  if (!videoEl || !state.videoSyncAvailable) {
    return;
  }
  videoEl.currentTime = Math.max(0, tms / 1000);
}

let lastVideoSyncAt = 0;

function handleVideoTimeUpdate() {
  if (!videoEl) {
    return;
  }
  const tms = Math.floor((videoEl.currentTime || 0) * 1000);
  const now = Date.now();
  const shouldRefresh =
    state.playhead.followPlayhead && now - lastVideoSyncAt > 250;
  seekTo(tms, "video", {
    syncVideo: false,
    suppressVideoUpdate: true,
    suppressSelectionUpdate: true,
    refresh: shouldRefresh,
    updatePanels: shouldRefresh,
    updateContext: shouldRefresh,
    updateNearest: shouldRefresh,
  });
  if (shouldRefresh) {
    lastVideoSyncAt = now;
  }
}

async function togglePlayback(source = "video") {
  if (!state.videoSyncAvailable) {
    return;
  }
  await ensureVideoLoaded();
  if (!videoEl) {
    return;
  }
  if (videoEl.paused) {
    await videoEl.play();
    setPlayState(true);
    seekTo(state.playhead.currentTimeMs, source, { refresh: false });
  } else {
    videoEl.pause();
    setPlayState(false);
  }
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
  seekTo(tms, "timeline", { refresh: false, snap: state.playhead.isSeeking });
  if (snap) {
    const nearest = findNearestEvent(state.events, state.playhead.currentTimeMs);
    if (nearest) {
      state.playhead.selectedEventId = nearest.id;
      renderDetails(nearest);
    }
  }
  refreshView();
}

function selectEvent(ev, syncTimeline = false) {
  if (!ev) {
    return;
  }
  state.playhead.selectedEventId = ev.id;
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
  updatePlayheadDisplay();
  if (videoSyncNote) {
    videoSyncNote.classList.toggle("hidden", state.videoSyncAvailable);
  }
}

function updateTimelineHover(clientX) {
  if (!timelineHover || !timeline) {
    return;
  }
  const duration = state.playhead.durationMs || 0;
  if (!duration) {
    timelineHover.classList.add("hidden");
    return;
  }
  const rect = timeline.getBoundingClientRect();
  const ratio = Math.min(Math.max(0, clientX - rect.left), rect.width) / rect.width;
  const hoverTime = Math.round(ratio * duration);
  state.hover.hoverTimeMs = hoverTime;
  const nearest = findNearestMarker(hoverTime, getImportantMarkers());
  state.hover.hoverMarkerId = nearest ? nearest.id : null;
  timelineHover.textContent = formatTimeWithMs(hoverTime);
  timelineHover.style.left = `${ratio * 100}%`;
  timelineHover.classList.remove("hidden");
}

function refreshView() {
  state.filtered = filterEvents(state.events);
  if (
    state.playhead.selectedEventId &&
    !state.filtered.some((ev) => ev.id === state.playhead.selectedEventId)
  ) {
    state.playhead.selectedEventId = null;
  }
  renderEventList();
  renderTimelineLanes(state.events);
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

    sessionLabel =
      state.manifest.session?.title ||
      state.manifest.session?.id ||
      "session.json";
    await initFromManifest(state.manifest, {
      zip,
      screenshotFiles: screenshotFilesFromZip,
    });
    const incidentEntry = zip.file("incidents.json");
    if (incidentEntry) {
      try {
        const raw = await incidentEntry.async("string");
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          const normalized = data.map((item, index) => ({
            id: item.id || `inc_pkg_${index + 1}`,
            type: item.type || "manifest-marker",
            timestampMs: item.timestampMs || item.timestamp_ms || 0,
            severity: item.severity || "warning",
            title: item.title || item.label || "Incident",
            subtitle: formatTimeWithMs(item.timestampMs || item.timestamp_ms || 0),
            sourceRef: item.sourceRef || item.ref || item.id || null,
            panelTarget: item.panelTarget || "timeline",
            statusCode: item.statusCode || 0,
            consoleLevel: item.consoleLevel || "",
            url: item.url || "",
          }));
          state.incidents = mergeIncidents(state.incidents, normalized);
          renderIncidentRail();
        }
      } catch (error) {
        // ignore optional incidents file
      }
    }
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
    state.playhead.durationMs = computeDurationMs(state.sessionLog, state.events);
    state.playhead.currentTimeMs = 0;
    state.videoSyncAvailable = state.playhead.durationMs > 0;

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
    state.videoSyncAvailable = !state.videoMissing && state.playhead.durationMs > 0;
    state.playhead.hasRecording = !state.videoMissing;
    if (playToggleBtn) {
      playToggleBtn.disabled = !state.videoSyncAvailable;
    }
    if (videoPlay) {
      videoPlay.disabled = !state.videoSyncAvailable;
    }
  } else {
    const referencedShots = screenshotFiles.map((name) => name.split("/").pop());
    await loadScreenshotBlobs(zip, screenshotFiles, referencedShots);
    const hasRecording = Boolean(state.manifest?.artifacts?.recording?.present);
    videoPanel.classList.toggle("hidden", !hasRecording);
  }

  setLoadedInfo(file.name, sessionLabel);

  updateTimeline();
  if (!state.manifest && timelineSummary) {
    timelineSummary.textContent = `${state.events.length} events`;
  }
  const nearest = findNearestEvent(state.events, state.playhead.currentTimeMs);
  if (nearest) {
    state.playhead.selectedEventId = nearest.id;
    renderDetails(nearest);
  }
  refreshView();
  updateCurrentTimeContext();
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

async function tryLoadPackageSession() {
  try {
    const baseUrl = new URL("../", window.location.href);
    const sessionUrl = new URL("session.json", baseUrl).toString();
    const response = await fetch(sessionUrl);
    if (!response.ok) {
      return false;
    }
    const manifest = await response.json();
    setPackageMode(true, baseUrl);
    await initFromManifest(manifest, { baseUrl });
    const packageIncidents = await loadIncidentsFromPackage(baseUrl);
    if (packageIncidents.length) {
      state.incidents = mergeIncidents(state.incidents, packageIncidents);
      renderIncidentRail();
    }
    setLoadedInfo("package", manifest.session?.id || "session.json");
    updateTimeline();
    refreshView();
    emptyState.textContent = "";
    const nearest = findNearestEvent(state.events, state.playhead.currentTimeMs);
    if (nearest) {
      state.playhead.selectedEventId = nearest.id;
      renderDetails(nearest);
    }
    updateCurrentTimeContext();
    const warnings = [];
    if (manifest.integrity?.warnings?.length) {
      warnings.push(manifest.integrity.warnings.join(" "));
    }
    if (manifest.integrity?.missingArtifacts?.length) {
      warnings.push(`Missing artifacts: ${manifest.integrity.missingArtifacts.join(", ")}`);
    }
    if (warnings.length) {
      showError(warnings.join(" "), true);
    }
    return true;
  } catch (error) {
    return false;
  }
}

function resetState() {
  state.zip = null;
  state.zipFiles = null;
  state.sessionLog = null;
  state.manifest = null;
  state.events = [];
  state.filtered = [];
  state.playhead = {
    currentTimeMs: 0,
    durationMs: 0,
    isPlaying: false,
    isSeeking: false,
    followPlayhead: true,
    timeWindowMs: 5000,
    selectedEventId: null,
    selectedIncidentId: null,
    selectedScreenshotId: null,
    activePanel: "timeline",
    lastSeekSource: null,
    lastCommittedTimeMs: 0,
    pendingSeekTimeMs: null,
    nearestIncidentId: null,
    nearestScreenshotId: null,
    hasRecording: false,
    nearestMarkerId: null,
  };
  state.hover = {
    hoverTimeMs: null,
    hoverMarkerId: null,
  };
  state.missingScreenshots = [];
  state.videoMissing = false;
  state.selectedNetworkId = null;
  state.selectedConsoleId = null;
  state.filters = {
    errorOnly: false,
    networkStatusBucket: "all",
    consoleLevels: ["error", "warning", "info", "log", "debug"],
    incidentSourcePanel: null,
    showIncidentRail: true,
  };
  state.panelModes = {
    network: "near",
    console: "near",
  };
  state.inspector = {
    type: null,
    id: null,
  };
  state.incidents = [];
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
  if (timelineLanes) {
    const tracks = Array.from(timelineLanes.querySelectorAll(".lane-track"));
    tracks.forEach((track) => {
      track.innerHTML = "";
    });
  }
  timeline.value = "0";
  timeline.max = "0";
  currentTimeLabel.textContent = "00:00";
  durationLabel.textContent = "Duration: 00:00";
  if (playheadTime) {
    playheadTime.textContent = "00:00";
  }
  if (playheadDuration) {
    playheadDuration.textContent = "00:00";
  }
  if (timelineCursor) {
    timelineCursor.style.left = "0%";
  }
  if (timelineHover) {
    timelineHover.classList.add("hidden");
  }
  if (timeBadge) {
    timeBadge.textContent = "00:00 / 00:00";
  }
  videoPanel.classList.add("hidden");
  videoEl.removeAttribute("src");
  videoPlay.textContent = "Play";
  if (playToggleBtn) {
    playToggleBtn.disabled = true;
  }
  if (videoPlay) {
    videoPlay.disabled = true;
  }
  setPlayState(false);
  if (videoSyncNote) {
    videoSyncNote.classList.add("hidden");
  }
  emptyState.textContent =
    "Open an evidence ZIP exported from DebugDuck to replay a session locally.";
  if (summaryPanel) {
    summaryPanel.classList.add("hidden");
  }
  if (timelineSummary) {
    timelineSummary.textContent = "";
  }
  if (incidentPanel) {
    incidentPanel.classList.add("hidden");
  }
  if (errorOnlyToggle) {
    errorOnlyToggle.checked = false;
  }
  if (followPlayheadToggle) {
    followPlayheadToggle.checked = true;
  }
  if (timeWindowSelect) {
    timeWindowSelect.value = "5000";
  }
  if (contextWindow) {
    contextWindow.textContent = "±5s";
  }
  networkModeChips.forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.netMode === "near");
  });
  consoleModeChips.forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.consoleMode === "near");
  });
  networkFilterChips.forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.netFilter === "all");
  });
  consoleLevelChips.forEach((chip) => {
    chip.classList.toggle("active", true);
  });
  setActivePanel("timeline");
  clearError();
  clearLoadedInfo();
  renderInspector();
}

if (openZipBtn && zipInput) {
  openZipBtn.addEventListener("click", () => zipInput.click());
}
if (openAnotherBtn && zipInput) {
  openAnotherBtn.addEventListener("click", () => {
    resetState();
    zipInput.value = "";
    zipInput.click();
  });
}
if (resetBtn) {
  resetBtn.addEventListener("click", resetState);
}
if (zipInput) {
  zipInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
      resetState();
      loadZip(file).catch((error) => {
        showError(error?.message || "Failed to load ZIP.");
      });
    }
  });
}

tryLoadPackageSession()
  .then((loaded) => {
    if (!loaded && emptyState) {
      emptyState.textContent =
        "Unable to load session.json. Ensure this folder is the exported DebugDuck package.";
      showError("Session package missing session.json.", true);
    }
  })
  .catch(() => {});

timeline.addEventListener("input", () => {
  setCurrentTms(Number(timeline.value), true);
});
timeline.addEventListener("mousemove", (event) => {
  updateTimelineHover(event.clientX);
});
timeline.addEventListener("mouseleave", () => {
  state.hover.hoverTimeMs = null;
  state.hover.hoverMarkerId = null;
  if (timelineHover) {
    timelineHover.classList.add("hidden");
  }
});
timeline.addEventListener("mousedown", () => {
  state.playhead.isSeeking = true;
});
timeline.addEventListener("mouseup", () => {
  state.playhead.isSeeking = false;
});
timeline.addEventListener("touchstart", () => {
  state.playhead.isSeeking = true;
});
timeline.addEventListener("touchend", () => {
  state.playhead.isSeeking = false;
});

[filterMarkers, filterNetwork, filterConsole, filterScreenshots, filterErrors].forEach(
  (el) => el.addEventListener("change", refreshView)
);
searchInput.addEventListener("input", refreshView);

panelTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const panel = tab.dataset.panel || "timeline";
    setActivePanel(panel);
    if (panel === "screenshots") {
      renderScreenshotsPanel();
    }
    if (panel === "network") {
      ensureNetworkLogsLoaded().then(renderNetworkPanel);
    }
    if (panel === "console") {
      ensureConsoleLogsLoaded().then(renderConsolePanel);
    }
  });
});

if (errorOnlyToggle) {
  errorOnlyToggle.addEventListener("change", () => {
    state.filters.errorOnly = errorOnlyToggle.checked;
    if (filterErrors) {
      filterErrors.checked = state.filters.errorOnly || filterErrors.checked;
    }
    renderIncidentRail();
    renderTimelineLanes(state.events);
    if (state.loadedArtifacts.network) {
      renderNetworkPanel();
    }
    if (state.loadedArtifacts.console) {
      renderConsolePanel();
    }
    updateCurrentTimeContext();
  });
}

if (followPlayheadToggle) {
  followPlayheadToggle.addEventListener("change", () => {
    state.playhead.followPlayhead = followPlayheadToggle.checked;
    updateTimeAwarePanels();
    updateCurrentTimeContext();
  });
}

if (timeWindowSelect) {
  timeWindowSelect.addEventListener("change", () => {
    const value = Number(timeWindowSelect.value);
    if (Number.isFinite(value)) {
      state.playhead.timeWindowMs = value;
      updateTimeAwarePanels();
      updateCurrentTimeContext();
    }
  });
}

if (prevIncidentBtn) {
  prevIncidentBtn.addEventListener("click", () => navigateIncident(-1));
}

if (nextIncidentBtn) {
  nextIncidentBtn.addEventListener("click", () => navigateIncident(1));
}

if (playToggleBtn) {
  playToggleBtn.addEventListener("click", () => togglePlayback("video"));
}

networkFilterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    if (chip.disabled) {
      return;
    }
    networkFilterChips.forEach((btn) => btn.classList.remove("active"));
    chip.classList.add("active");
    state.filters.networkStatusBucket = chip.dataset.netFilter || "all";
    renderIncidentRail();
    if (state.loadedArtifacts.network) {
      renderNetworkPanel();
    }
  });
});

networkModeChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    if (chip.disabled) {
      return;
    }
    networkModeChips.forEach((btn) => btn.classList.remove("active"));
    chip.classList.add("active");
    state.panelModes.network = chip.dataset.netMode || "near";
    if (state.loadedArtifacts.network) {
      renderNetworkPanel();
    }
  });
});

consoleLevelChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    if (chip.disabled) {
      return;
    }
    const level = chip.dataset.consoleLevel;
    if (!level) {
      return;
    }
    const levels = new Set(state.filters.consoleLevels);
    if (levels.has(level)) {
      levels.delete(level);
      chip.classList.remove("active");
    } else {
      levels.add(level);
      chip.classList.add("active");
    }
    state.filters.consoleLevels = Array.from(levels);
    renderIncidentRail();
    if (state.loadedArtifacts.console) {
      renderConsolePanel();
    }
  });
});

consoleModeChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    if (chip.disabled) {
      return;
    }
    consoleModeChips.forEach((btn) => btn.classList.remove("active"));
    chip.classList.add("active");
    state.panelModes.console = chip.dataset.consoleMode || "near";
    if (state.loadedArtifacts.console) {
      renderConsolePanel();
    }
  });
});

if (videoPlay) {
  videoPlay.addEventListener("click", () => togglePlayback("video"));
}

if (videoEl) {
  videoEl.addEventListener("timeupdate", handleVideoTimeUpdate);
  videoEl.addEventListener("play", () => setPlayState(true));
  videoEl.addEventListener("pause", () => setPlayState(false));
  videoEl.addEventListener("ended", () => setPlayState(false));
}

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

window.addEventListener("keydown", (event) => {
  const target = event.target;
  if (
    target &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable)
  ) {
    return;
  }
  if (event.code === "Space") {
    event.preventDefault();
    togglePlayback("keyboard");
  } else if (event.code === "ArrowLeft") {
    event.preventDefault();
    seekTo(state.playhead.currentTimeMs - 5000, "keyboard");
  } else if (event.code === "ArrowRight") {
    event.preventDefault();
    seekTo(state.playhead.currentTimeMs + 5000, "keyboard");
  } else if (event.key === "[") {
    navigateIncident(-1);
  } else if (event.key === "]") {
    navigateIncident(1);
  }
});
