const openZipBtn = document.getElementById("openZipBtn");
const openAnotherBtn = document.getElementById("openAnotherBtn");
const resetBtn = document.getElementById("resetBtn");
const zipInput = document.getElementById("zipInput");
const openSessionBtn = document.getElementById("openSessionBtn");
const openSessionFolderBtn = document.getElementById("openSessionFolderBtn");
const openUnifiedBtn = document.getElementById("openUnifiedBtn");
const sessionFileInput = document.getElementById("sessionFileInput");
const sessionAnyInput = document.getElementById("sessionAnyInput");
const sessionFolderInput = document.getElementById("sessionFolderInput");
const packageNotice = document.getElementById("packageNotice");
const loaderError = document.getElementById("loaderError");
const errorPanel = document.getElementById("errorPanel");
const errorClose = document.getElementById("errorClose");
const loadedInfo = document.getElementById("loadedInfo");
const emptyState = document.getElementById("emptyState");
const dropZone = document.getElementById("dropZone");
const loaderPanel = document.getElementById("loaderPanel");
const loaderFull = document.getElementById("loaderFull");
const loaderCompact = document.getElementById("loaderCompact");
const sessionIdentityName = document.getElementById("sessionIdentityName");
const sessionIdentityMeta = document.getElementById("sessionIdentityMeta");
const banner = document.getElementById("howtoBanner");
const bannerClose = document.getElementById("bannerClose");
const headerActions = document.querySelector(".header-actions");
const appRoot = document.querySelector(".app");
const timeline = document.getElementById("timeline");
const timelinePanel = document.querySelector(".timeline-panel");
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
const timelineMarkers = document.getElementById("timelineMarkers");
const markerHover = document.getElementById("markerHover");
const contextIncident = document.getElementById("contextIncident");
const contextScreenshot = document.getElementById("contextScreenshot");
const contextNetworkCount = document.getElementById("contextNetworkCount");
const contextConsoleCount = document.getElementById("contextConsoleCount");
const contextWindow = document.getElementById("contextWindow");
const eventList = document.getElementById("eventList");
const detailsBody = document.getElementById("detailsBody");
const videoPanel = document.getElementById("videoPanel");
const videoEl = document.getElementById("videoEl");
const videoTime = document.getElementById("videoTime");
const videoSyncNote = document.getElementById("videoSyncNote");
const layoutEl = document.querySelector(".layout");
const leftColumn = document.querySelector("section.left");
const rightColumn = document.querySelector("section.right");
const videoFrame = document.querySelector(".video-frame");
const filterMarkers = document.getElementById("filterMarkers");
const filterNetwork = document.getElementById("filterNetwork");
const filterConsole = document.getElementById("filterConsole");
const filterScreenshots = document.getElementById("filterScreenshots");
const filterErrors = document.getElementById("filterErrors");
const searchInput = document.getElementById("searchInput");
const summaryPanel = document.getElementById("summaryPanel");
const summaryNetworkRequests = document.getElementById("summaryNetworkRequests");
const summaryNetworkFailures = document.getElementById("summaryNetworkFailures");
const summaryConsoleMessages = document.getElementById("summaryConsoleMessages");
const summaryConsoleErrors = document.getElementById("summaryConsoleErrors");
const summaryScreenshots = document.getElementById("summaryScreenshots");
const summaryRecording = document.getElementById("summaryRecording");
const summaryNetworkRequestsLabel = document.getElementById("summaryNetworkRequestsLabel");
const summaryNetworkFailuresLabel = document.getElementById("summaryNetworkFailuresLabel");
const summaryConsoleMessagesLabel = document.getElementById("summaryConsoleMessagesLabel");
const summaryConsoleErrorsLabel = document.getElementById("summaryConsoleErrorsLabel");
const summaryScreenshotsLabel = document.getElementById("summaryScreenshotsLabel");
const summaryRecordingLabel = document.getElementById("summaryRecordingLabel");
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
const screenshotModal = document.getElementById("screenshotModal");
const screenshotModalMeta = document.getElementById("screenshotModalMeta");
const screenshotModalImage = document.getElementById("screenshotModalImage");
const screenshotModalViewport = document.getElementById("screenshotModalViewport");
const screenshotFitBtn = document.getElementById("screenshotFitBtn");
const screenshotActualBtn = document.getElementById("screenshotActualBtn");
const screenshotZoomOutBtn = document.getElementById("screenshotZoomOutBtn");
const screenshotZoomInBtn = document.getElementById("screenshotZoomInBtn");
const screenshotResetBtn = document.getElementById("screenshotResetBtn");
const screenshotCloseBtn = document.getElementById("screenshotCloseBtn");
const DEBUG_ENABLED = Boolean(window.DEBUGDUCK_DEBUG);
if (DEBUG_ENABLED) {
  console.log("DEBUGDUCK_VIEWER_RUNTIME_MARKER_v2");
}
window.DEBUGDUCK_VIEWER_RUNTIME_MARKER = "v2";
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
const diagnosticsPanel = document.getElementById("diagnosticsPanel");
const inspectorDockNetwork = document.querySelector("[data-inspector-dock='network']");
const inspectorDockConsole = document.querySelector("[data-inspector-dock='console']");
const inspectorDockErrors = document.querySelector("[data-inspector-dock='errors']");
const diagSource = document.getElementById("diagSource");
const diagRoot = document.getElementById("diagRoot");
const diagRecording = document.getElementById("diagRecording");
const diagNetwork = document.getElementById("diagNetwork");
const diagConsole = document.getElementById("diagConsole");
const diagScreenshots = document.getElementById("diagScreenshots");
const diagIncidents = document.getElementById("diagIncidents");
const diagDuration = document.getElementById("diagDuration");
const diagDurationSource = document.getElementById("diagDurationSource");
const diagParseWarnings = document.getElementById("diagParseWarnings");
const diagNetworkCounts = document.getElementById("diagNetworkCounts");
const diagNetworkFailureCounts = document.getElementById("diagNetworkFailureCounts");
const diagConsoleCounts = document.getElementById("diagConsoleCounts");
const diagConsoleErrorCounts = document.getElementById("diagConsoleErrorCounts");
const diagErrorCounts = document.getElementById("diagErrorCounts");
const diagScreenshotCounts = document.getElementById("diagScreenshotCounts");
const diagNetworkLineage = document.getElementById("diagNetworkLineage");
const diagConsoleLineage = document.getElementById("diagConsoleLineage");
const diagScreenshotLineage = document.getElementById("diagScreenshotLineage");
const diagIncidentLineage = document.getElementById("diagIncidentLineage");
const diagMarkerLineage = document.getElementById("diagMarkerLineage");
const integrityBanner = document.getElementById("integrityBanner");
const integrityTitle = document.getElementById("integrityTitle");
const integritySummary = document.getElementById("integritySummary");
const integrityDetails = document.getElementById("integrityDetails");
const integrityErrors = document.getElementById("integrityErrors");
const integrityWarnings = document.getElementById("integrityWarnings");
const integrityCounts = document.getElementById("integrityCounts");
const networkSearchInput = document.getElementById("networkSearchInput");
const networkSearchClear = document.getElementById("networkSearchClear");
const networkResultCount = document.getElementById("networkResultCount");
const networkFilterLabel = document.querySelector("[data-panel=\"network\"] .filter-label");
const networkSelectionNote = document.getElementById("networkSelectionNote");
const consoleSearchInput = document.getElementById("consoleSearchInput");
const consoleSearchClear = document.getElementById("consoleSearchClear");
const consoleResultCount = document.getElementById("consoleResultCount");
const consoleSelectionNote = document.getElementById("consoleSelectionNote");
const consoleQuickChips = Array.from(
  document.querySelectorAll("[data-console-quick]")
);

const state = {
  pkg: null,
  session: null,
  integrityReport: null,
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
    networkQuery: "",
    consoleQuery: "",
    consoleQuick: "all",
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
    activePanel: "network",
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
    network: "all",
    console: "all",
  },
  panelRenderKeys: {
    network: "",
    console: "",
  },
  autoHighlightIds: {
    network: null,
    console: null,
    screenshot: null,
    incident: null,
  },
  autoHighlightGroups: {
    network: null,
  },
  inspector: {
    type: null,
    id: null,
    expandState: {},
    lastKey: null,
    activeTabs: {
      network: "Overview",
      console: "Overview",
    },
  },
  incidents: [],
  sortedIncidentsByTime: [],
  sortedScreenshotsByTime: [],
  sortedScreenshotEvents: [],
  incidentsVersion: 0,
  filteredIncidentsCache: {
    key: "",
    list: [],
  },
  currentMoment: null,
  snapPulse: {
    id: null,
    untilMs: 0,
  },
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
  networkGroupExpanded: new Set(),
  networkGroupIndex: new Map(),
};

let modalState = {
  isOpen: false,
  screenshotId: null,
  imageSrc: null,
  scale: 1,
  translateX: 0,
  translateY: 0,
  dragging: false,
  dragStartX: 0,
  dragStartY: 0,
  fitScale: 1,
  imageWidth: 0,
  imageHeight: 0,
};

function debugLog(...args) {
  if (DEBUG_ENABLED) {
    console.debug(...args);
  }
}

function debugGroup(title) {
  if (DEBUG_ENABLED) {
    console.group(title);
  }
}

function debugGroupEnd() {
  if (DEBUG_ENABLED) {
    console.groupEnd();
  }
}

function debugWarn(...args) {
  if (DEBUG_ENABLED) {
    console.warn(...args);
  }
}

function debugError(...args) {
  if (DEBUG_ENABLED) {
    console.error(...args);
  }
}

function logLayoutMetrics(reason) {
  if (!DEBUG_ENABLED) {
    return;
  }
  const root = document.documentElement;
  const layoutRect = layoutEl?.getBoundingClientRect();
  const leftRect = leftColumn?.getBoundingClientRect();
  const rightRect = rightColumn?.getBoundingClientRect();
  const panelRect = videoPanel?.getBoundingClientRect();
  const frameRect = videoFrame?.getBoundingClientRect();
  const scrollHeight = root?.scrollHeight || 0;
  const clientHeight = root?.clientHeight || 0;
  debugLog("[DD Layout]", {
    reason,
    innerWidth: window.innerWidth,
    docClientWidth: root?.clientWidth || 0,
    scrollHeight,
    clientHeight,
    scrollbarActive: scrollHeight > clientHeight,
    layoutWidth: layoutRect?.width || 0,
    layoutHeight: layoutRect?.height || 0,
    leftWidth: leftRect?.width || 0,
    rightWidth: rightRect?.width || 0,
    videoPanelWidth: panelRect?.width || 0,
    videoPanelHeight: panelRect?.height || 0,
    videoFrameWidth: frameRect?.width || 0,
    videoFrameHeight: frameRect?.height || 0,
  });
}

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

function formatWindowLabel(windowMs) {
  const seconds = Math.max(1, Math.round((windowMs || 0) / 1000));
  return `±${seconds}s`;
}

function updateNearTimeLabels(options = {}) {
  const { networkCount, consoleCount, forceNetwork = false, forceConsole = false } = options;
  const baseLabel = `Near Time ${formatWindowLabel(state.playhead.timeWindowMs)}`;
  const shouldUpdateNetwork = forceNetwork || networkCount !== undefined;
  const shouldUpdateConsole = forceConsole || consoleCount !== undefined;
  if (shouldUpdateNetwork) {
    networkModeChips.forEach((chip) => {
      if (chip.dataset.netMode === "near") {
        chip.textContent = baseLabel;
      }
    });
  }
  if (shouldUpdateConsole) {
    consoleModeChips.forEach((chip) => {
      if (chip.dataset.consoleMode === "near") {
        chip.textContent = baseLabel;
      }
    });
  }
}

function normalizeConsoleLevel(level) {
  const raw = String(level || "log").toLowerCase();
  if (raw === "warn") {
    return "warning";
  }
  return raw;
}

function getNetworkStatusValue(entry) {
  if (!entry) {
    return null;
  }
  const candidates = [
    entry.response_status,
    entry.status,
    entry.statusCode,
    entry.status_code,
    entry.responseStatus,
    entry.response_status_code,
  ];
  for (const raw of candidates) {
    if (typeof raw === "number") {
      return raw;
    }
    if (typeof raw === "string") {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function isFailureFinalizeReason(reason) {
  if (!reason) {
    return false;
  }
  const normalized = String(reason).toLowerCase().trim();
  if (["complete", "completed", "success", "ok", "finished", "done"].includes(normalized)) {
    return false;
  }
  return /abort|error|fail|timeout|cancel|blocked|refused|disconnect|dns|reset|unreachable/.test(
    normalized
  );
}

function isNetworkFailureEntry(entry) {
  if (!entry) {
    return false;
  }
  const status = getNetworkStatusValue(entry);
  const hasStatus = typeof status === "number";
  const hasErrorText = Boolean(entry.error_text || entry.errorText);
  const hasIncomplete = Boolean(entry.incomplete);
  const finalizeReason = entry.finalize_reason || entry.finalizeReason;
  const hasFailureReason = isFailureFinalizeReason(finalizeReason);
  const hasCanceled = Boolean(entry.canceled);
  if (hasStatus && status >= 400) {
    return true;
  }
  if (hasErrorText || hasIncomplete || hasCanceled) {
    return true;
  }
  return !hasStatus && hasFailureReason;
}

function classifyNetworkFailure(entry) {
  if (!entry) {
    return { severity: "info", kind: "unknown" };
  }
  const status = getNetworkStatusValue(entry);
  const hasStatus = typeof status === "number";
  const hasErrorText = Boolean(entry.error_text || entry.errorText);
  const hasIncomplete = Boolean(entry.incomplete);
  const finalizeReason = entry.finalize_reason || entry.finalizeReason;
  const hasFailureReason = isFailureFinalizeReason(finalizeReason);
  const hasCanceled = Boolean(entry.canceled);
  if (hasStatus && status >= 500) {
    return { severity: "error", kind: "server" };
  }
  if (hasStatus && status >= 400) {
    return { severity: "warning", kind: "client" };
  }
  if (hasErrorText) {
    return { severity: "error", kind: "error_text" };
  }
  if (hasIncomplete || hasCanceled || (!hasStatus && hasFailureReason)) {
    return { severity: "warning", kind: "aborted" };
  }
  return { severity: "info", kind: "unknown" };
}

function classifyNetworkStatus(entry) {
  const status = getNetworkStatusValue(entry);
  if (typeof status === "number") {
    if (status >= 500) {
      return "5xx";
    }
    if (status >= 400) {
      return "4xx";
    }
    return "ok";
  }
  if (isNetworkFailureEntry(entry)) {
    const classification = classifyNetworkFailure(entry);
    if (classification.kind === "aborted") {
      return "aborted";
    }
    return "failure";
  }
  return "unknown";
}

function isNetworkError(entry) {
  const classification = classifyNetworkFailure(entry);
  return classification.severity === "error" || classification.severity === "warning";
}

function getEffectiveConsoleLevels() {
  let levels = state.filters.consoleLevels.length
    ? state.filters.consoleLevels
    : ["error", "warning", "info", "log", "debug"];
  if (state.filters.errorOnly) {
    levels = levels.filter((level) => level === "error");
  }
  if (state.filters.consoleQuick === "errors") {
    levels = levels.filter((level) => level === "error");
  } else if (state.filters.consoleQuick === "warnings") {
    levels = levels.filter((level) => level === "warning");
  }
  return levels;
}

function buildIncidentTitle(incident) {
  if (incident.type.startsWith("network")) {
    const status = incident.statusCode ? String(incident.statusCode) : "";
    const method = incident.method || "";
    const url = incident.url || "";
    const base = `${status} ${method} ${url}`.trim();
    const kind =
      incident.failureKind === "aborted"
        ? "aborted"
        : incident.failureKind === "error_text"
          ? "error"
          : "";
    return kind ? `${base} (${kind})`.trim() : base;
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
  if (emptyState) {
    emptyState.textContent = "";
  }
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
  const durationText = formatTime(state.playhead.durationMs || 0);
  if (loadedInfo) {
    loadedInfo.textContent = `Session: ${sessionLogName} • ${durationText} • ${zipName}`;
    loadedInfo.classList.remove("hidden");
  }
  if (sessionIdentityName) {
    sessionIdentityName.textContent = sessionLogName || "Session loaded";
  }
  if (sessionIdentityMeta) {
    sessionIdentityMeta.textContent = `${zipName} • ${durationText}`;
  }
  if (appRoot) {
    appRoot.classList.add("session-loaded");
  }
  if (loaderFull) {
    loaderFull.classList.add("hidden");
  }
  if (loaderCompact) {
    loaderCompact.classList.remove("hidden");
  }
}

function clearLoadedInfo() {
  if (!loadedInfo) {
    if (appRoot) {
      appRoot.classList.remove("session-loaded");
    }
    if (loaderFull) {
      loaderFull.classList.remove("hidden");
    }
    if (loaderCompact) {
      loaderCompact.classList.add("hidden");
    }
    return;
  }
  loadedInfo.textContent = "";
  loadedInfo.classList.add("hidden");
  if (sessionIdentityName) {
    sessionIdentityName.textContent = "Session loaded";
  }
  if (sessionIdentityMeta) {
    sessionIdentityMeta.textContent = "";
  }
  if (appRoot) {
    appRoot.classList.remove("session-loaded");
  }
  if (loaderFull) {
    loaderFull.classList.remove("hidden");
  }
  if (loaderCompact) {
    loaderCompact.classList.add("hidden");
  }
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

const SNAP_TOLERANCE_MS = 120;
const MARKER_SNAP_THRESHOLD_MS = 350;

function applySnapTolerance(rawTimeMs, snappedTimeMs) {
  if (!Number.isFinite(snappedTimeMs)) {
    return rawTimeMs;
  }
  return Math.abs(snappedTimeMs - rawTimeMs) <= SNAP_TOLERANCE_MS
    ? snappedTimeMs
    : rawTimeMs;
}

function clampToDuration(tms) {
  return clampTimeMs(tms, state.playhead.durationMs || 0);
}

function isValidTimestampMs(value) {
  return Number.isFinite(value) && value >= 0;
}

function coerceTimestampMs(value) {
  return isValidTimestampMs(value) ? value : null;
}

function formatMarkerLabel(marker) {
  const typeLabel =
    marker.type === "console-error"
      ? "Console error"
      : marker.type === "network-failure"
        ? marker.failureKind === "aborted"
          ? "Network aborted"
          : "Network failure"
        : marker.type === "screenshot"
          ? "Screenshot"
          : marker.type === "incident"
            ? "Incident"
            : marker.type;
  const time = formatTimeWithMs(marker.timeMs);
  const label = marker.label ? ` • ${marker.label}` : "";
  return `${typeLabel} • ${time}${label}`;
}

function buildNetworkMarkerLabel(entry) {
  const status = entry.response_status || entry.status || "";
  const method = entry.method || "";
  const url = entry.url || "";
  let path = url;
  try {
    const parsed = new URL(url);
    path = parsed.pathname || url;
  } catch (_) {
    // leave as-is
  }
  const classification = classifyNetworkFailure(entry);
  const suffix =
    classification.kind === "aborted"
      ? " (aborted)"
      : classification.kind === "error_text"
        ? " (error)"
        : "";
  return `${method} ${status} ${path}`.trim() + suffix;
}

function buildConsoleMarkerLabel(entry) {
  const message =
    entry.message ||
    entry.text ||
    entry.payload?.message ||
    entry.payload?.text ||
    "";
  return message ? message.slice(0, 120) : "Console error";
}

function getScreenshotDisplayLabel(shot, index = null) {
  const base =
    typeof index === "number"
      ? `#${index + 1}`
      : "Shot";
  const timestamp =
    typeof shot?.timestampMs === "number"
      ? formatTime(shot.timestampMs)
      : null;
  return timestamp ? `${base} • ${timestamp}` : base;
}

function getScreenshotIndexById(shot) {
  if (!shot) {
    return null;
  }
  const list = state.sortedScreenshotsByTime || [];
  const key = shot.id || shot.path;
  if (!key) {
    return null;
  }
  const idx = list.findIndex((entry) => (entry.id || entry.path) === key);
  return idx >= 0 ? idx : null;
}

function deriveTimelineMarkers(session) {
  if (!session) {
    return [];
  }
  const markers = [];
  session.incidents.forEach((inc, index) => {
    markers.push({
      id: `marker_inc_${inc.id || index}`,
      type: "incident",
      timeMs: inc.timestampMs || 0,
      label: buildIncidentTitle(inc),
      severity: inc.severity || "warning",
      sourceRef: inc.id || null,
      priority: 1,
    });
  });
  session.screenshots.forEach((shot, index) => {
    const label = getScreenshotDisplayLabel(shot, index);
    markers.push({
      id: `marker_shot_${shot.id || index}`,
      type: "screenshot",
      timeMs: shot.timestampMs || 0,
      label,
      severity: null,
      sourceRef: shot.id || shot.path || null,
      priority: 2,
    });
  });
  session.networkEvents.forEach((entry, index) => {
    if (!isNetworkFailureEntry(entry)) {
      return;
    }
    const classification = classifyNetworkFailure(entry);
    markers.push({
      id: `marker_net_${entry.id || index}`,
      type: "network-failure",
      timeMs: getNetworkTimestampMs(entry) || 0,
      label: buildNetworkMarkerLabel(entry),
      severity: classification.severity,
      failureKind: classification.kind,
      sourceRef: entry.id || null,
      priority: 3,
    });
  });
  session.consoleEvents.forEach((entry, index) => {
    const level = normalizeConsoleLevel(entry.level);
    if (level !== "error") {
      return;
    }
    markers.push({
      id: `marker_con_${entry.id || index}`,
      type: "console-error",
      timeMs: entry.timestampMs || 0,
      label: buildConsoleMarkerLabel(entry),
      severity: "error",
      sourceRef: entry.id || null,
      priority: 4,
    });
  });
  return markers
    .filter((marker) => isValidTimestampMs(marker.timeMs))
    .sort((a, b) => a.timeMs - b.timeMs);
}

function rebuildTimelineMarkers() {
  if (!state.session) {
    return;
  }
  state.session.markers = deriveTimelineMarkers(state.session);
  state.session.markersVersion = (state.session.markersVersion || 0) + 1;
}

function setPlayState(isPlaying) {
  state.playhead.isPlaying = Boolean(isPlaying);
  if (playToggleBtn) {
    playToggleBtn.textContent = state.playhead.isPlaying ? "Pause" : "Play";
  }
  // Video header play control removed; timeline play is source of truth.
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

function getEntryTimeSafe(entry, getTime) {
  const ts = getTime(entry);
  return Number.isFinite(ts) ? ts : 0;
}

function lowerBoundByTime(entries, min, getTime) {
  let lo = 0;
  let hi = entries.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (getEntryTimeSafe(entries[mid], getTime) < min) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

function upperBoundByTime(entries, max, getTime) {
  let lo = 0;
  let hi = entries.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (getEntryTimeSafe(entries[mid], getTime) <= max) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

function filterEntriesNearTime(entries, tms, windowMs, getTime) {
  if (!Array.isArray(entries) || !entries.length) {
    return [];
  }
  const min = tms - windowMs;
  const max = tms + windowMs;
  const start = lowerBoundByTime(entries, min, getTime);
  const end = upperBoundByTime(entries, max, getTime);
  return entries.slice(start, end);
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
  return findNearestInSorted(incidents, tms, (inc) => inc.timestampMs || 0);
}

function getNearestIncident(tms) {
  return findNearestIncident(getFilteredIncidents(), tms);
}

function findNearestScreenshot(tms) {
  const shots =
    state.sortedScreenshotsByTime.length > 0
      ? state.sortedScreenshotsByTime
      : state.sortedScreenshotEvents;
  if (!shots.length) {
    return null;
  }
  return findNearestInSorted(shots, tms, (shot) => shot.timestampMs || 0);
}

function getNearestScreenshot(tms) {
  return findNearestScreenshot(tms);
}

function findNearestTimelineEvent(currentTimeMs, events) {
  if (!Array.isArray(events) || !events.length) {
    return null;
  }
  return findNearestInSorted(events, currentTimeMs, (ev) => ev.t_ms || 0);
}

function getImportantMarkers() {
  const markers = state.session?.markers || [];
  const availability = getIntegrityAvailability();
  if (availability && availability.global === false) {
    return [];
  }
  return markers.filter((marker) => isMarkerAvailable(marker, availability));
}

function getSnapTargets() {
  return getImportantMarkers();
}

function findNearestMarker(currentTimeMs, markers) {
  if (!markers.length) {
    return null;
  }
  let nearest = markers[0];
  let best = Math.abs((nearest.timeMs || 0) - currentTimeMs);
  markers.forEach((marker) => {
    const delta = Math.abs((marker.timeMs || 0) - currentTimeMs);
    if (delta < best || (delta === best && marker.priority < nearest.priority)) {
      best = delta;
      nearest = marker;
    }
  });
  return nearest;
}

function findNearestInSorted(entries, tms, getTime) {
  if (!Array.isArray(entries) || !entries.length) {
    return null;
  }
  const idx = lowerBoundByTime(entries, tms, getTime);
  let best = entries[Math.min(idx, entries.length - 1)];
  let bestDelta = Math.abs(getEntryTimeSafe(best, getTime) - tms);
  if (idx > 0) {
    const prev = entries[idx - 1];
    const delta = Math.abs(getEntryTimeSafe(prev, getTime) - tms);
    if (delta < bestDelta) {
      best = prev;
      bestDelta = delta;
    }
  }
  return best;
}

function getWindowSlice(entries, tms, windowMs, getTime) {
  const min = tms - windowMs;
  const max = tms + windowMs;
  const start = lowerBoundByTime(entries, min, getTime);
  const end = upperBoundByTime(entries, max, getTime);
  return {
    start,
    end,
    items: entries.slice(start, end),
  };
}

function setSnapPulse(markerId) {
  if (!markerId) {
    return;
  }
  state.snapPulse.id = markerId;
  state.snapPulse.untilMs = Date.now() + 500;
}

function getSnapTarget(timeMs, markers, thresholdMs) {
  if (!markers.length) {
    return null;
  }
  const candidate = findNearestMarker(timeMs, markers);
  if (!candidate) {
    return null;
  }
  const delta = Math.abs((candidate.timeMs || 0) - timeMs);
  return delta <= thresholdMs ? candidate : null;
}

function normalizeSearchQuery(value) {
  return String(value || "").trim().toLowerCase();
}

function buildNetworkSearchText(entry) {
  const status = entry.response_status || entry.status || "";
  const method = entry.method || "";
  const url = entry.url || "";
  let path = url;
  try {
    const parsed = new URL(url);
    path = parsed.pathname || url;
  } catch (_) {
    // ignore
  }
  return `${method} ${status} ${url} ${path}`.toLowerCase();
}

function getNetworkGroupKey(entry) {
  const method = (entry.method || "").trim().toUpperCase();
  const url = (entry.url || "").trim();
  return `${method} ${url}`.trim();
}

function buildNetworkGroupLabel(entry) {
  const method = entry.method || "";
  const url = entry.url || "";
  return `${method} ${url}`.trim() || "Network request";
}

function groupNetworkEntries(entries) {
  const groups = new Map();
  entries.forEach((entry) => {
    const key = getNetworkGroupKey(entry);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: buildNetworkGroupLabel(entry),
        items: [],
      });
    }
    groups.get(key).items.push(entry);
  });
  return Array.from(groups.values());
}

function findEventForNetworkEntry(entry) {
  if (!entry || !state.session) {
    return null;
  }
  const ref = entry.id || entry.request_id || null;
  if (ref && state.session.eventIndexes?.eventByRef?.has(ref)) {
    return state.session.eventIndexes.eventByRef.get(ref);
  }
  return null;
}

function findEventForConsoleEntry(entry) {
  if (!entry || !state.session) {
    return null;
  }
  const ref = entry.id || null;
  if (ref && state.session.eventIndexes?.eventByRef?.has(ref)) {
    return state.session.eventIndexes.eventByRef.get(ref);
  }
  return null;
}

function buildConsoleSearchText(entry) {
  const level = entry.level || "";
  const message = entry.message || entry.msg || entry.text || "";
  const source = entry.source || entry.location || entry.url || "";
  const stack = entry.stack ? String(entry.stack).slice(0, 400) : "";
  return `${level} ${message} ${source} ${stack}`.toLowerCase();
}

function getVisibleNetworkEvents() {
  return getVisibleNetworkEventsAt(
    state.playhead.currentTimeMs || 0,
    state.playhead.timeWindowMs || 0
  );
}

function getVisibleNetworkEventsAt(timeMs, windowMs) {
  const entries = state.networkEntries || [];
  const nearMode = state.panelModes.network === "near";
  const base =
    nearMode
      ? filterEntriesNearTime(entries, timeMs, windowMs, getNetworkTimestampMs)
      : entries;
  const query = normalizeSearchQuery(state.filters.networkQuery);
  const applyErrorOnly =
    state.filters.errorOnly && state.playhead.activePanel === "errors";
  return base.filter((entry) => {
    if (nearMode && entry?.time_missing) {
      return false;
    }
    if (query) {
      const haystack = buildNetworkSearchText(entry);
      if (!haystack.includes(query)) {
        return false;
      }
    }
    if (applyErrorOnly && !isNetworkError(entry)) {
      return false;
    }
    const statusValue = getNetworkStatusValue(entry);
    if (state.filters.networkStatusBucket === "errors") {
      return isNetworkError(entry);
    }
    if (state.filters.networkStatusBucket === "4xx") {
      return typeof statusValue === "number" && statusValue >= 400 && statusValue < 500;
    }
    if (state.filters.networkStatusBucket === "5xx") {
      return typeof statusValue === "number" && statusValue >= 500 && statusValue < 600;
    }
    return true;
  });
}

function getNetworkFilterDebugCounts(timeMs, windowMs) {
  const entries = state.networkEntries || [];
  const normalizedCount = entries.length;
  const mode = state.panelModes.network;
  const query = normalizeSearchQuery(state.filters.networkQuery);
  const bucket = state.filters.networkStatusBucket || "all";
  const applyErrorOnly =
    state.filters.errorOnly && state.playhead.activePanel === "errors";
  const timeFiltered =
    mode === "near"
      ? filterEntriesNearTime(entries, timeMs, windowMs, getNetworkTimestampMs)
          .filter((entry) => !entry?.time_missing)
      : entries;
  const timeFilteredCount = timeFiltered.length;
  const searchFiltered = query
    ? timeFiltered.filter((entry) =>
        buildNetworkSearchText(entry).includes(query)
      )
    : timeFiltered;
  const searchFilteredCount = searchFiltered.length;
  const statusFiltered = searchFiltered.filter((entry) => {
    if (applyErrorOnly && !isNetworkError(entry)) {
      return false;
    }
    const statusValue = getNetworkStatusValue(entry);
    if (bucket === "errors") {
      return isNetworkError(entry);
    }
    if (bucket === "4xx") {
      return typeof statusValue === "number" && statusValue >= 400 && statusValue < 500;
    }
    if (bucket === "5xx") {
      return typeof statusValue === "number" && statusValue >= 500 && statusValue < 600;
    }
    return true;
  });
  const statusFilteredCount = statusFiltered.length;
  return {
    normalizedCount,
    timeFilteredCount,
    searchFilteredCount,
    statusFilteredCount,
    mode,
    bucket,
    query,
    applyErrorOnly,
    windowMs,
    timeMs,
  };
}

function getVisibleConsoleEvents() {
  return getVisibleConsoleEventsAt(
    state.playhead.currentTimeMs || 0,
    state.playhead.timeWindowMs || 0
  );
}

function getVisibleConsoleEventsAt(timeMs, windowMs) {
  const entries = state.consoleEntries || [];
  const base =
    state.panelModes.console === "near"
      ? filterEntriesNearTime(
          entries,
          timeMs,
          windowMs,
          (entry) =>
            typeof entry.timestamp_ms === "number"
              ? entry.timestamp_ms
              : entry.timestampMs || 0
        )
      : entries;
  const query = normalizeSearchQuery(state.filters.consoleQuery);
  const allowedLevels = getEffectiveConsoleLevels();
  return base.filter((entry) =>
    allowedLevels.includes(normalizeConsoleLevel(entry.level)) &&
    (!query || buildConsoleSearchText(entry).includes(query))
  );
}

function buildListKey(entries) {
  if (!entries || !entries.length) {
    return "0";
  }
  const ids = entries.map((entry) => entry.id).filter(Boolean);
  const sample = ids.length > 6 ? ids.slice(0, 3).concat(ids.slice(-3)) : ids;
  return `${ids.length}:${sample.join("|")}`;
}

function escapeSelector(value) {
  const raw = String(value || "");
  if (typeof CSS !== "undefined" && CSS.escape) {
    return CSS.escape(raw);
  }
  return raw.replace(/["\\]/g, "\\$&");
}

function updateAutoHighlightRow(listEl, nextId, key) {
  if (!listEl) {
    return;
  }
  const prevId = state.autoHighlightIds[key];
  if (prevId && prevId !== nextId) {
    const prevRow = listEl.querySelector(
      `[data-entry-id="${escapeSelector(prevId)}"]`
    );
    if (prevRow) {
      prevRow.classList.remove("nearby");
    }
  }
  if (nextId) {
    const nextRow = listEl.querySelector(
      `[data-entry-id="${escapeSelector(nextId)}"]`
    );
    if (nextRow) {
      nextRow.classList.add("nearby");
    }
  }
  state.autoHighlightIds[key] = nextId || null;
}

function updateAutoHighlightRows() {
  const moment = state.currentMoment;
  if (!moment) {
    return;
  }
  updateAutoHighlightRow(networkList, moment.autoHighlight.networkId, "network");
  updateAutoHighlightRow(consoleList, moment.autoHighlight.consoleId, "console");
  updateAutoHighlightRow(screenshotsList, moment.autoHighlight.screenshotId, "screenshot");
  updateAutoHighlightRow(incidentList, moment.autoHighlight.incidentId, "incident");

  if (moment.autoHighlight.networkId && !state.selectedNetworkId) {
    const targetId = moment.autoHighlight.networkId;
    const groupKey = state.networkGroupIndex.get(targetId);
    if (groupKey && groupKey !== state.autoHighlightGroups.network) {
      const prevGroup = state.autoHighlightGroups.network;
      if (prevGroup) {
        const prevEl = networkList?.querySelector(
          `[data-group-key="${escapeSelector(prevGroup)}"]`
        );
        if (prevEl) {
          prevEl.classList.remove("nearby");
        }
      }
      const nextEl = networkList?.querySelector(
        `[data-group-key="${escapeSelector(groupKey)}"]`
      );
      if (nextEl) {
        nextEl.classList.add("nearby");
      }
      state.autoHighlightGroups.network = groupKey;
    }
  } else if (state.autoHighlightGroups.network) {
    const prevEl = networkList?.querySelector(
      `[data-group-key="${escapeSelector(state.autoHighlightGroups.network)}"]`
    );
    if (prevEl) {
      prevEl.classList.remove("nearby");
    }
    state.autoHighlightGroups.network = null;
  }

  if (!state.playhead.followPlayhead || state.playhead.isSeeking) {
    return;
  }
  if (
    state.playhead.activePanel === "network" &&
    state.panelModes.network === "near" &&
    !state.selectedNetworkId
  ) {
    const row = networkList?.querySelector(
      `[data-entry-id="${escapeSelector(moment.autoHighlight.networkId)}"]`
    );
    if (row) {
      row.scrollIntoView({ block: "nearest" });
    }
  }
  if (
    state.playhead.activePanel === "console" &&
    state.panelModes.console === "near" &&
    !state.selectedConsoleId
  ) {
    const row = consoleList?.querySelector(
      `[data-entry-id="${escapeSelector(moment.autoHighlight.consoleId)}"]`
    );
    if (row) {
      row.scrollIntoView({ block: "nearest" });
    }
  }
  if (
    state.playhead.activePanel === "screenshots" &&
    !state.playhead.selectedScreenshotId
  ) {
    const row = screenshotsList?.querySelector(
      `[data-entry-id="${escapeSelector(moment.autoHighlight.screenshotId)}"]`
    );
    if (row) {
      row.scrollIntoView({ block: "nearest" });
    }
  }
  if (state.playhead.activePanel === "errors" && !state.playhead.selectedIncidentId) {
    const row = incidentList?.querySelector(
      `[data-entry-id="${escapeSelector(moment.autoHighlight.incidentId)}"]`
    );
    if (row) {
      row.scrollIntoView({ block: "nearest" });
    }
  }
}

function getCurrentMomentContextAt(timeMs, windowMs, availability = getIntegrityAvailability()) {
  const nearestIncident = getNearestIncident(timeMs);
  const nearestScreenshot =
    availability && availability.screenshots === false ? null : getNearestScreenshot(timeMs);

  const networkWindow =
    state.loadedArtifacts.network && (!availability || availability.network !== false)
      ? getWindowSlice(state.networkEntries, timeMs, windowMs, getNetworkTimestampMs)
      : { items: [], start: 0, end: 0 };
  const consoleWindow =
    state.loadedArtifacts.console && (!availability || availability.console !== false)
      ? getWindowSlice(
          state.consoleEntries,
          timeMs,
          windowMs,
          (entry) =>
            typeof entry.timestamp_ms === "number" ? entry.timestamp_ms : entry.timestampMs || 0
        )
      : { items: [], start: 0, end: 0 };

  const nearestNetwork = networkWindow.items.length
    ? findNearestInSorted(networkWindow.items, timeMs, getNetworkTimestampMs)
    : null;
  const nearestConsole = consoleWindow.items.length
    ? findNearestInSorted(consoleWindow.items, timeMs, (entry) =>
        typeof entry.timestamp_ms === "number" ? entry.timestamp_ms : entry.timestampMs || 0
      )
    : null;

  const selectedNetwork = state.selectedNetworkId || null;
  const selectedConsole = state.selectedConsoleId || null;
  const selectedIncident = state.playhead.selectedIncidentId || null;
  const selectedScreenshot = state.playhead.selectedScreenshotId || null;

  return {
    timeMs,
    timeLabel: formatTimeWithMs(timeMs),
    windowLabel: `±${Math.round(windowMs / 1000)}s`,
    nearestIncident,
    nearestScreenshot,
    nearestNetwork,
    nearestConsole,
    nearbyNetworkCount: networkWindow.items.length,
    nearbyConsoleCount: consoleWindow.items.length,
    nearbyNetworkIds: networkWindow.items.map((entry) => entry.id).filter(Boolean),
    nearbyConsoleIds: consoleWindow.items.map((entry) => entry.id).filter(Boolean),
    autoHighlight: {
      incidentId: selectedIncident ? null : nearestIncident ? nearestIncident.id : null,
      screenshotId: selectedScreenshot ? null : nearestScreenshot ? nearestScreenshot.id : null,
      networkId: selectedNetwork ? null : nearestNetwork ? nearestNetwork.id : null,
      consoleId: selectedConsole ? null : nearestConsole ? nearestConsole.id : null,
    },
  };
}

function getCurrentMomentContext() {
  return getCurrentMomentContextAt(
    state.playhead.currentTimeMs || 0,
    state.playhead.timeWindowMs || 0,
    getIntegrityAvailability()
  );
}

function updateCurrentTimeContext() {
  if (!contextIncident || !contextScreenshot) {
    return;
  }
  updateNearTimeLabels({ forceNetwork: true, forceConsole: true });
  const report = state.integrityReport;
  const availability = report?.availability || null;
  if (report?.failFastGlobal) {
    state.currentMoment = null;
    state.playhead.nearestIncidentId = null;
    state.playhead.nearestScreenshotId = null;
    contextIncident.textContent = "Integrity check failed.";
    contextScreenshot.textContent = "Integrity check failed.";
    if (contextNetworkCount) {
      contextNetworkCount.textContent = "Disabled";
    }
    if (contextConsoleCount) {
      contextConsoleCount.textContent = "Disabled";
    }
    if (contextWindow) {
      contextWindow.textContent = "±0s";
    }
    return;
  }
  const moment = getCurrentMomentContext();
  state.currentMoment = moment;
  const nearestIncident = moment.nearestIncident;
  state.playhead.nearestIncidentId =
    availability && availability.incidents === false ? null : nearestIncident ? nearestIncident.id : null;
  const incidentSeverity = nearestIncident?.severity
    ? String(nearestIncident.severity).toUpperCase()
    : "";
  contextIncident.textContent =
    availability && availability.incidents === false
      ? "Disabled"
      : nearestIncident
        ? `${incidentSeverity ? `${incidentSeverity} ` : ""}${buildIncidentTitle(
            nearestIncident
          )} (${formatTimeWithMs(
            nearestIncident.timestampMs || 0
          )})`
        : "None";
  const nearestShot = moment.nearestScreenshot;
  state.playhead.nearestScreenshotId =
    availability && availability.screenshots === false ? null : nearestShot ? nearestShot.id : null;
  contextScreenshot.textContent =
    availability && availability.screenshots === false
      ? "Disabled"
      : nearestShot
        ? `${getScreenshotDisplayLabel(
            nearestShot,
            getScreenshotIndexById(nearestShot) ?? undefined
          )}`
        : "None";
  if (contextNetworkCount) {
    contextNetworkCount.textContent =
      availability && availability.network === false
        ? "Disabled"
        : state.loadedArtifacts.network
          ? String(moment.nearbyNetworkCount)
          : "Not loaded";
  }
  if (contextConsoleCount) {
    contextConsoleCount.textContent =
      availability && availability.console === false
        ? "Disabled"
        : state.loadedArtifacts.console
          ? String(moment.nearbyConsoleCount)
          : "Not loaded";
  }
  if (contextWindow) {
    contextWindow.textContent =
      availability && availability.timeline === false ? "±0s" : moment.windowLabel;
  }
  updateAutoHighlightRows();
}

function updateTimeAwarePanels() {
  const availability = getIntegrityAvailability();
  const isPlaying = state.playhead.isPlaying;
  if (
    state.loadedArtifacts.network &&
    state.panelModes.network === "near" &&
    (!availability || availability.network !== false)
  ) {
    const visible = getVisibleNetworkEvents();
    const nextKey = buildListKey(visible);
    if (!isPlaying || nextKey !== state.panelRenderKeys.network) {
      renderNetworkPanel({ preserveScroll: isPlaying });
    }
  }
  if (
    state.loadedArtifacts.console &&
    state.panelModes.console === "near" &&
    (!availability || availability.console !== false)
  ) {
    const visible = getVisibleConsoleEvents();
    const nextKey = buildListKey(visible);
    if (!isPlaying || nextKey !== state.panelRenderKeys.console) {
      renderConsolePanel({ preserveScroll: isPlaying });
    }
  }
}

function seekTo(targetTimeMs, source, options = {}) {
  const rawTimeMs = clampToDuration(targetTimeMs);
  let next = rawTimeMs;
  const markers = getImportantMarkers();
  const snapEnabled = Boolean(options.snap);
  if (snapEnabled) {
    const snapCandidate = getSnapTarget(
      rawTimeMs,
      markers,
      typeof options.snapThresholdMs === "number"
        ? options.snapThresholdMs
        : MARKER_SNAP_THRESHOLD_MS
    );
    const thresholdMs =
      typeof options.snapThresholdMs === "number"
        ? options.snapThresholdMs
        : MARKER_SNAP_THRESHOLD_MS;
    const snappedTimeMs =
      snapCandidate && Math.abs((snapCandidate.timeMs || 0) - rawTimeMs) <= thresholdMs
        ? snapCandidate.timeMs || rawTimeMs
        : rawTimeMs;
    next = applySnapTolerance(rawTimeMs, snappedTimeMs);
    if (snapCandidate && next !== rawTimeMs) {
      state.playhead.nearestMarkerId = snapCandidate.id;
      setSnapPulse(snapCandidate.id);
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
  if (options.nearestEvent && !("selectedEventId" in options)) {
    const nearestEvent = findNearestTimelineEvent(next, state.events);
    if (nearestEvent) {
      state.playhead.selectedEventId = nearestEvent.id;
      renderDetails(nearestEvent);
    } else {
      state.playhead.selectedEventId = null;
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
    if (options.source && state.playhead.activePanel === "timeline") {
      afterSelectionOrSeek(options.source);
    }
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

function setHeaderActionsVisible(visible) {
  if (!headerActions) {
    return;
  }
  headerActions.classList.toggle("hidden", !visible);
}

function setZipControlsAvailable(enabled, reason = "") {
  if (openZipBtn) {
    openZipBtn.style.display = enabled ? "" : "none";
    openZipBtn.disabled = !enabled;
    openZipBtn.title = enabled ? "" : reason;
  }
  if (openAnotherBtn) {
    openAnotherBtn.style.display = enabled ? "" : "none";
    openAnotherBtn.disabled = !enabled;
    openAnotherBtn.title = enabled ? "" : reason;
  }
  if (resetBtn) {
    resetBtn.style.display = enabled ? "" : "none";
    resetBtn.disabled = !enabled;
    resetBtn.title = enabled ? "" : reason;
  }
}

function normalizePackagePath(path) {
  return String(path || "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/")
    .trim()
    .toLowerCase();
}

function inferMimeType(path) {
  const lower = String(path || "").toLowerCase();
  if (lower.endsWith(".json")) {
    return "application/json";
  }
  if (lower.endsWith(".ndjson")) {
    return "application/x-ndjson";
  }
  if (lower.endsWith(".webm")) {
    return "video/webm";
  }
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  return "application/octet-stream";
}

function normalizeRelativeWebkitPath(file) {
  return String(file?.webkitRelativePath || file?.name || "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");
}

class VirtualPackage {
  constructor(entries = [], meta = {}) {
    this.meta = meta;
    this.entries = new Map();
    entries.forEach((entry) => {
      const key = this.normalize(entry.path);
      this.entries.set(key, { ...entry, normalizedPath: key });
    });
  }

  normalize(input) {
    return normalizePackagePath(input);
  }

  exists(path) {
    return this.entries.has(this.normalize(path));
  }

  list() {
    return Array.from(this.entries.values());
  }

  getEntry(path) {
    return this.entries.get(this.normalize(path)) || null;
  }

  async readText(path) {
    const entry = this.getEntry(path);
    if (!entry) {
      throw new Error(`Artifact not found: ${path}`);
    }
    if (entry.getText) {
      return entry.getText();
    }
    if (entry.getBlob) {
      return (await entry.getBlob()).text();
    }
    throw new Error(`Artifact cannot be read as text: ${path}`);
  }

  async readBlob(path) {
    const entry = this.getEntry(path);
    if (!entry) {
      throw new Error(`Artifact not found: ${path}`);
    }
    if (entry.getBlob) {
      return entry.getBlob();
    }
    if (entry.getText) {
      return new Blob([await entry.getText()], {
        type: entry.mimeType || "text/plain",
      });
    }
    throw new Error(`Artifact cannot be read as blob: ${path}`);
  }

  async readJson(path) {
    return JSON.parse(await this.readText(path));
  }

  resolveArtifact(candidates = []) {
    for (const candidate of candidates) {
      if (!candidate) {
        continue;
      }
      const entry = this.getEntry(candidate);
      if (entry) {
        return entry;
      }
    }
    return null;
  }

  getRootSummary() {
    return this.list().map((entry) => entry.path);
  }
}

async function buildPackageFromZip(zipFile) {
  const zip = await JSZip.loadAsync(zipFile);
  const entries = [];
  Object.entries(zip.files || {}).forEach(([path, zipEntry]) => {
    if (zipEntry.dir) {
      return;
    }
    const cleanPath = normalizeRelativeWebkitPath({ name: path });
    entries.push({
      path: cleanPath,
      name: cleanPath.split("/").pop() || cleanPath,
      size: zipEntry._data?.uncompressedSize || 0,
      mimeType: inferMimeType(cleanPath),
      sourceKind: "zip",
      getText: async () => zipEntry.async("text"),
      getBlob: async () => zipEntry.async("blob"),
    });
  });
  return new VirtualPackage(entries, { source: "zip", inputName: zipFile.name });
}

async function buildPackageFromFileList(fileList) {
  const entries = [];
  Array.from(fileList || []).forEach((file) => {
    const rawPath = normalizeRelativeWebkitPath(file);
    entries.push({
      path: rawPath,
      name: file.name,
      size: file.size,
      mimeType: file.type || inferMimeType(rawPath),
      sourceKind: "folder",
      file,
      getText: async () => file.text(),
      getBlob: async () => file,
    });
  });
  return new VirtualPackage(entries, { source: "folder", count: entries.length });
}

async function buildPackageFromSessionJsonFile(file) {
  return new VirtualPackage(
    [
      {
        path: "session.json",
        name: file.name,
        size: file.size,
        mimeType: "application/json",
        sourceKind: "single-json",
        file,
        getText: async () => file.text(),
        getBlob: async () => file,
      },
    ],
    { source: "single-json" }
  );
}

function commonTopLevelFolder(paths) {
  const top = new Set(
    paths
      .map((path) => String(path || "").split("/")[0])
      .filter(Boolean)
  );
  return top.size === 1 ? Array.from(top)[0] : null;
}

function normalizePackageRoot(pkg) {
  if (pkg.exists("session.json")) {
    return pkg;
  }
  const paths = pkg.list().map((entry) => entry.path);
  if (!paths.length) {
    return pkg;
  }
  const top = commonTopLevelFolder(paths);
  if (!top) {
    return pkg;
  }
  const rewritten = pkg.list().map((entry) => {
    const nextPath = entry.path.startsWith(`${top}/`)
      ? entry.path.slice(top.length + 1)
      : entry.path;
    return { ...entry, path: nextPath };
  });
  return new VirtualPackage(rewritten, { ...pkg.meta, strippedRoot: top });
}

function validatePackageShape(pkg) {
  const entries = pkg.list();
  if (!entries.length) {
    const error = new Error("Package is empty");
    error.code = "empty_package";
    throw error;
  }
  if (!pkg.exists("session.json")) {
    const error = new Error("session.json not found in selected package");
    error.code = "missing_session_json";
    error.details = { files: pkg.getRootSummary() };
    throw error;
  }
  return true;
}

async function loadManifestFromPackage(pkg) {
  return pkg.readJson("session.json");
}

const RECORDING_CANDIDATES = [
  "recording.webm",
  "artifacts/recording.webm",
  "video/recording.webm",
];

const NETWORK_CANDIDATES = [
  "network.ndjson",
  "logs/network.ndjson",
  "artifacts/network.ndjson",
];

const CONSOLE_CANDIDATES = [
  "console.ndjson",
  "logs/console.ndjson",
  "artifacts/console.ndjson",
];

function resolveRecordingFromPackage(pkg, manifest) {
  const candidates = [
    manifest?.artifacts?.recording?.path,
    manifest?.recordingPath,
    ...RECORDING_CANDIDATES,
  ].filter(Boolean);
  const resolved = pkg.resolveArtifact(candidates);
  if (resolved) {
    return resolved;
  }
  const webms = pkg
    .list()
    .filter((entry) => /\.webm$/i.test(entry.path || ""));
  return webms.length === 1 ? webms[0] : null;
}

function resolveNetworkLogFromPackage(pkg, manifest) {
  const candidates = [
    manifest?.artifacts?.network?.path,
    manifest?.networkPath,
    ...NETWORK_CANDIDATES,
  ].filter(Boolean);
  return pkg.resolveArtifact(candidates);
}

function resolveConsoleLogFromPackage(pkg, manifest) {
  const candidates = [
    manifest?.artifacts?.console?.path,
    manifest?.consolePath,
    ...CONSOLE_CANDIDATES,
  ].filter(Boolean);
  return pkg.resolveArtifact(candidates);
}

function getCurrentViewerPathHint() {
  try {
    return decodeURIComponent(window.location.pathname || "")
      .replace(/\\/g, "/")
      .toLowerCase();
  } catch (_) {
    return String(window.location.pathname || "")
      .replace(/\\/g, "/")
      .toLowerCase();
  }
}

function getSelectedFolderHint(files) {
  if (!files || !files.length) {
    return "";
  }
  const first = files[0]?.webkitRelativePath || "";
  const root = String(first).split("/")[0] || "";
  return root.toLowerCase();
}

function isViewerRunningInsideSelectedPackage(files) {
  const viewerPath = getCurrentViewerPathHint();
  const selectedRoot = getSelectedFolderHint(files);
  if (!viewerPath || !selectedRoot) {
    return false;
  }
  return viewerPath.includes(`/${selectedRoot}/`);
}

function attachVideoDurationReconciliation() {
  if (!videoEl) {
    return;
  }
  if (videoEl.dataset.durationBound === "true") {
    return;
  }
  videoEl.dataset.durationBound = "true";

  videoEl.addEventListener("loadedmetadata", () => {
    const mediaDurationMs =
      Number.isFinite(videoEl.duration) && videoEl.duration > 0
        ? Math.round(videoEl.duration * 1000)
        : 0;

    if (!mediaDurationMs) {
      return;
    }

    const previousDuration = state.playhead.durationMs || 0;
    state.playhead.durationMs = mediaDurationMs;
    if (state.session) {
      state.session.durationMs = mediaDurationMs;
      state.session.durationSource = "media";
    }
    state.videoSyncAvailable = true;

    if (state.manifest?.artifacts?.recording) {
      state.manifest.artifacts.recording.durationMs = mediaDurationMs;
    }
    if (state.manifest?.timeline) {
      state.manifest.timeline.endOffsetMs = mediaDurationMs;
    }
    if (state.playhead.currentTimeMs > mediaDurationMs) {
      state.playhead.currentTimeMs = mediaDurationMs;
    }

    updatePlayheadDisplay();
    updateTimeline();
    updateCurrentTimeContext();
    refreshView();
    updateIntegrityReport();
    logLayoutMetrics("video:loadedmetadata");

    const durationText = formatTime(mediaDurationMs);
    if (loadedInfo && loadedInfo.textContent) {
      const parts = loadedInfo.textContent.split(" • ");
      if (parts.length >= 3) {
        loadedInfo.textContent = `${parts[0]} • ${durationText} • ${parts[2]}`;
      } else {
        loadedInfo.textContent = `Session • ${durationText}`;
      }
    }
    if (sessionIdentityMeta && sessionIdentityMeta.textContent) {
      const metaParts = sessionIdentityMeta.textContent.split(" • ");
      sessionIdentityMeta.textContent =
        metaParts.length >= 2
          ? `${metaParts[0]} • ${durationText}`
          : durationText;
    }

    if (previousDuration && previousDuration !== mediaDurationMs) {
      console.warn("Viewer duration reconciled to actual media duration", {
        manifestDurationMs: previousDuration,
        mediaDurationMs,
      });
    }
  });
}
async function loadScreenshotBlobsFromPackage(paths, pkg) {
  state.missingScreenshots = [];
  state.screenshotUrls.forEach((url) => URL.revokeObjectURL(url));
  state.screenshotUrls.clear();
  updateNearTimeLabels({ forceNetwork: true, forceConsole: true });
  closeScreenshotModal();
  for (const path of paths) {
    if (!pkg || !pkg.exists(path)) {
      const baseName = path.split("/").pop();
      state.missingScreenshots.push(baseName);
      continue;
    }
    let blob;
    try {
      blob = await pkg.readBlob(path);
    } catch (error) {
      const baseName = path.split("/").pop();
      state.missingScreenshots.push(baseName);
      continue;
    }
    const url = URL.createObjectURL(blob);
    const baseName = path.split("/").pop();
    state.screenshotUrls.set(baseName, url);
  }
}

async function loadIncidentsFromPackageFiles(pkg) {
  try {
    if (!pkg || !pkg.exists("incidents.json")) {
      return [];
    }
    const data = await pkg.readJson("incidents.json");
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

function buildScreenshotIndexFromManifest(manifest, screenshots) {
  const map = new Map();
  (screenshots || []).forEach((shot) => {
    if (shot && shot.id) {
      map.set(shot.id, shot);
    }
  });
  return map;
}

function normalizeScreenshotItems(items) {
  return (items || [])
    .map((shot) => {
      const timestampMs = coerceTimestampMs(shot?.timestampMs);
      if (timestampMs === null) {
        return null;
      }
      return { ...shot, timestampMs };
    })
    .filter(Boolean);
}

function normalizeIncidentItems(items) {
  return (items || [])
    .map((inc) => {
      const timestampMs = coerceTimestampMs(inc?.timestampMs);
      if (timestampMs === null) {
        return null;
      }
      return { ...inc, timestampMs };
    })
    .filter(Boolean);
}

function normalizeTimelineEvents(events) {
  return (events || [])
    .map((ev) => {
      const tms = coerceTimestampMs(ev?.t_ms);
      if (tms === null) {
        return null;
      }
      return { ...ev, t_ms: tms };
    })
    .filter(Boolean)
    .sort((a, b) => a.t_ms - b.t_ms);
}

const FAIL_FAST_SCOPE_MAP = {
  network: new Set([
    "MISSING_NETWORK_FILE",
    "FLAG_MISMATCH_NETWORK",
    "SUMMARY_MISMATCH_NETWORK",
    "SUMMARY_MISMATCH_NETWORK_FAILURES",
    "MARKER_SOURCE_MISMATCH_NETWORK",
    "STALE_STATE_SUSPECTED_NETWORK",
  ]),
  console: new Set([
    "MISSING_CONSOLE_FILE",
    "FLAG_MISMATCH_CONSOLE",
    "SUMMARY_MISMATCH_CONSOLE",
    "SUMMARY_MISMATCH_CONSOLE_ERRORS",
    "MARKER_SOURCE_MISMATCH_CONSOLE",
    "STALE_STATE_SUSPECTED_CONSOLE",
  ]),
  screenshots: new Set([
    "MISSING_SCREENSHOT_FILES",
    "FLAG_MISMATCH_SCREENSHOTS",
    "SUMMARY_MISMATCH_SCREENSHOTS",
    "MARKER_SOURCE_MISMATCH_SCREENSHOTS",
  ]),
  recording: new Set(["MISSING_RECORDING_FILE", "FLAG_MISMATCH_RECORDING"]),
  incidents: new Set(["MARKER_SOURCE_MISMATCH_INCIDENTS"]),
  timeline: new Set(["RENDER_STATE_MISMATCH", "DURATION_MISMATCH_LARGE"]),
};

const GLOBAL_FAIL_FAST_CODES = new Set(["RENDER_STATE_MISMATCH", "DURATION_MISMATCH_LARGE"]);

function deriveFailFastScopes(errors) {
  const scopes = new Set();
  (errors || []).forEach((err) => {
    const code = err?.code;
    if (GLOBAL_FAIL_FAST_CODES.has(code)) {
      scopes.add("global");
      return;
    }
    let matched = false;
    Object.entries(FAIL_FAST_SCOPE_MAP).forEach(([scope, codes]) => {
      if (codes.has(code)) {
        scopes.add(scope);
        matched = true;
      }
    });
    if (!matched) {
      scopes.add("global");
    }
  });
  return scopes;
}

function isFailFastActive(scope = null) {
  const report = state.integrityReport;
  if (!report?.hasErrors) {
    return false;
  }
  if (!scope) {
    return Boolean(report.failFastGlobal);
  }
  const availability = report.availability;
  if (!availability) {
    return Boolean(report.failFastGlobal);
  }
  if (scope === "network") {
    return !availability.network;
  }
  if (scope === "console") {
    return !availability.console;
  }
  if (scope === "screenshots") {
    return !availability.screenshots;
  }
  if (scope === "recording") {
    return !availability.recording;
  }
  if (scope === "timeline") {
    return !availability.timeline;
  }
  if (scope === "incidents") {
    return !availability.incidents;
  }
  return Boolean(report.failFastGlobal);
}

function buildIntegrityAvailability(scopes, failFastGlobal) {
  const globalDisabled = Boolean(failFastGlobal || scopes.has("global"));
  const availability = {
    global: !globalDisabled,
    recording: !globalDisabled && !scopes.has("recording"),
    network: !globalDisabled && !scopes.has("network"),
    console: !globalDisabled && !scopes.has("console"),
    screenshots: !globalDisabled && !scopes.has("screenshots"),
    timeline: !globalDisabled && !scopes.has("timeline"),
    incidents: !globalDisabled && !scopes.has("timeline") && !scopes.has("incidents"),
  };
  availability.markers = {
    incident: availability.incidents,
    screenshot: availability.screenshots,
    network: availability.network,
    console: availability.console,
  };
  return availability;
}

const INTEGRITY_REASON_LABELS = {
  MISSING_RECORDING_FILE: "recording: missing from package",
  FLAG_MISMATCH_RECORDING: "recording: presence mismatch",
  MISSING_NETWORK_FILE: "network: log missing from package",
  FLAG_MISMATCH_NETWORK: "network: presence mismatch",
  SUMMARY_MISMATCH_NETWORK: "network: request count mismatch",
  SUMMARY_MISMATCH_NETWORK_FAILURES: "network: failure count mismatch",
  MARKER_SOURCE_MISMATCH_NETWORK: "network: markers exceed parsed failures",
  STALE_STATE_SUSPECTED_NETWORK: "network: logs loaded state mismatch",
  MISSING_CONSOLE_FILE: "console: log missing from package",
  FLAG_MISMATCH_CONSOLE: "console: presence mismatch",
  SUMMARY_MISMATCH_CONSOLE: "console: message count mismatch",
  SUMMARY_MISMATCH_CONSOLE_ERRORS: "console: error count mismatch",
  MARKER_SOURCE_MISMATCH_CONSOLE: "console: markers exceed parsed errors",
  STALE_STATE_SUSPECTED_CONSOLE: "console: logs loaded state mismatch",
  MISSING_SCREENSHOT_FILES: "screenshots: files missing from package",
  FLAG_MISMATCH_SCREENSHOTS: "screenshots: presence mismatch",
  SUMMARY_MISMATCH_SCREENSHOTS: "screenshots: count mismatch",
  MARKER_SOURCE_MISMATCH_SCREENSHOTS: "screenshots: markers exceed parsed items",
  MARKER_SOURCE_MISMATCH_INCIDENTS: "incidents: markers exceed parsed incidents",
  RENDER_STATE_MISMATCH: "render: normalized events mismatch",
  DURATION_MISMATCH_LARGE: "timeline: session duration mismatch",
};

function getIntegrityDomainForCode(code) {
  if (GLOBAL_FAIL_FAST_CODES.has(code)) {
    return "global";
  }
  const match = Object.entries(FAIL_FAST_SCOPE_MAP).find(([, codes]) =>
    codes.has(code)
  );
  return match ? match[0] : null;
}

function getIntegrityIssuesForScope(scope) {
  const report = state.integrityReport;
  if (!report?.errors?.length) {
    return [];
  }
  const scopeSet = FAIL_FAST_SCOPE_MAP[scope] || null;
  return report.errors
    .filter((err) => {
      if (scope === "global") {
        return GLOBAL_FAIL_FAST_CODES.has(err.code);
      }
      return scopeSet ? scopeSet.has(err.code) : false;
    })
    .map((err) => INTEGRITY_REASON_LABELS[err.code] || err.message || err.code);
}

function buildIntegrityDisabledMessage(scope, panelLabel) {
  const issues = getIntegrityIssuesForScope(scope);
  if (!issues.length) {
    return `${panelLabel} disabled due to integrity mismatch.`;
  }
  const unique = Array.from(new Set(issues));
  const detail =
    unique.length > 2 ? `${unique.slice(0, 2).join("; ")}; +${unique.length - 2} more` : unique.join("; ");
  return `${panelLabel} disabled due to integrity mismatch: ${detail}.`;
}

function countNetworkFailures(entries) {
  return (entries || []).filter((entry) => isNetworkFailureEntry(entry)).length;
}

function countConsoleErrors(entries) {
  return (entries || []).filter((entry) => normalizeConsoleLevel(entry.level) === "error")
    .length;
}

function countMarkersByType(markers) {
  const counts = {
    incident: 0,
    screenshot: 0,
    "network-failure": 0,
    "console-error": 0,
  };
  (markers || []).forEach((marker) => {
    if (marker?.type && Object.prototype.hasOwnProperty.call(counts, marker.type)) {
      counts[marker.type] += 1;
    }
  });
  return counts;
}

function resolveManifestCount(...values) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function formatCountPair(manifestValue, parsedValue) {
  const manifestText =
    typeof manifestValue === "number" && Number.isFinite(manifestValue)
      ? String(manifestValue)
      : "-";
  const parsedText =
    typeof parsedValue === "number" && Number.isFinite(parsedValue)
      ? String(parsedValue)
      : "not loaded";
  return `${manifestText} / ${parsedText}`;
}

function buildIntegrityReport(session) {
  const manifest = session?.manifest || {};
  const artifacts = manifest.artifacts || {};
  const pkg = session?.pkg || null;
  const loaded = {
    network: Boolean(state.loadedArtifacts.network),
    console: Boolean(state.loadedArtifacts.console),
    screenshots: Boolean(state.loadedArtifacts.screenshots),
    recording: Boolean(state.loadedArtifacts.recording),
  };
  const networkEvents = Array.isArray(session?.networkEvents)
    ? session.networkEvents
    : [];
  const consoleEvents = Array.isArray(session?.consoleEvents)
    ? session.consoleEvents
    : [];
  const screenshots = Array.isArray(session?.screenshots) ? session.screenshots : [];
  const incidents = Array.isArray(session?.incidents) ? session.incidents : [];
  const markerCounts = countMarkersByType(session?.markers || []);
  const parsedSourceCounts = session?.parsedCounts || {};
  const parsedNetworkRequests = loaded.network
    ? typeof parsedSourceCounts.networkRequests === "number"
      ? parsedSourceCounts.networkRequests
      : networkEvents.length
    : null;
  const parsedConsoleMessages = loaded.console
    ? typeof parsedSourceCounts.consoleMessages === "number"
      ? parsedSourceCounts.consoleMessages
      : consoleEvents.length
    : null;
  const parsedNetworkFailures = loaded.network
    ? typeof parsedSourceCounts.networkFailures === "number"
      ? parsedSourceCounts.networkFailures
      : countNetworkFailures(networkEvents)
    : null;
  const parsedConsoleErrors = loaded.console
    ? typeof parsedSourceCounts.consoleErrors === "number"
      ? parsedSourceCounts.consoleErrors
      : countConsoleErrors(consoleEvents)
    : null;
  const parsedCounts = {
    networkRequests: parsedNetworkRequests,
    consoleMessages: parsedConsoleMessages,
    screenshots: screenshots.length,
    incidents: incidents.length,
    networkFailures: parsedNetworkFailures,
    consoleErrors: parsedConsoleErrors,
    markers: Array.isArray(session?.markers) ? session.markers.length : 0,
    markersByType: markerCounts,
  };
  const manifestCounts = {
    networkRequests: resolveManifestCount(
      manifest.summary?.networkRequests,
      artifacts.network?.entryCount
    ),
    consoleMessages: resolveManifestCount(
      manifest.summary?.consoleMessages,
      artifacts.console?.entryCount
    ),
    screenshots: resolveManifestCount(
      manifest.summary?.screenshots,
      artifacts.screenshots?.count,
      artifacts.screenshots?.items?.length
    ),
    networkFailures: resolveManifestCount(manifest.summary?.networkFailures),
    consoleErrors: resolveManifestCount(manifest.summary?.consoleErrors),
  };
  const lineage = {
    network: artifacts.network?.path
      ? `pkg:${artifacts.network.path} • ${loaded.network ? "parsed:ndjson" : "parsed:not-loaded"}`
      : "pkg:(missing)",
    console: artifacts.console?.path
      ? `pkg:${artifacts.console.path} • ${loaded.console ? "parsed:ndjson" : "parsed:not-loaded"}`
      : "pkg:(missing)",
    screenshots: artifacts.screenshots?.items?.length
      ? `manifest:artifacts.screenshots.items (${artifacts.screenshots.items.length})`
      : "manifest:artifacts.screenshots",
    incidents: "derived:incidents",
    markers: "derived:timelineMarkers",
  };

  const errors = [];
  const warnings = [];
  const addIssue = (list, code, message, detail) => {
    list.push({ code, message, detail });
  };
  const formatMismatch = (label, detail) =>
    `${label} mismatch: manifest=${detail.manifest}, parsed=${detail.parsed}`;
  const formatMarkerMismatch = (label, detail) =>
    `${label} mismatch: markers=${detail.markers}, parsed=${detail.parsed}`;

  if (pkg && artifacts.recording?.present && artifacts.recording?.path) {
    if (!pkg.exists(artifacts.recording.path)) {
      addIssue(
        errors,
        "MISSING_RECORDING_FILE",
        "Recording artifact declared but missing from package.",
        artifacts.recording.path
      );
    }
  }
  if (pkg && artifacts.network?.present && artifacts.network?.path) {
    if (!pkg.exists(artifacts.network.path)) {
      addIssue(
        errors,
        "MISSING_NETWORK_FILE",
        "Network log artifact declared but missing from package.",
        artifacts.network.path
      );
    }
  }
  if (pkg && artifacts.console?.present && artifacts.console?.path) {
    if (!pkg.exists(artifacts.console.path)) {
      addIssue(
        errors,
        "MISSING_CONSOLE_FILE",
        "Console log artifact declared but missing from package.",
        artifacts.console.path
      );
    }
  }
  if (pkg && artifacts.screenshots?.present) {
    const missingShots = (session?.screenshotFiles || []).filter(
      (path) => !pkg.exists(path)
    );
    if (missingShots.length) {
      addIssue(
        errors,
        "MISSING_SCREENSHOT_FILES",
        `${missingShots.length} screenshot files are missing from the package.`,
        missingShots.slice(0, 5)
      );
    }
  }

  if (!artifacts.network?.present && parsedCounts.networkRequests) {
    addIssue(
      errors,
      "FLAG_MISMATCH_NETWORK",
      "Manifest marks network logs as absent but parsed data exists.",
      parsedCounts.networkRequests
    );
  }
  if (!artifacts.console?.present && parsedCounts.consoleMessages) {
    addIssue(
      errors,
      "FLAG_MISMATCH_CONSOLE",
      "Manifest marks console logs as absent but parsed data exists.",
      parsedCounts.consoleMessages
    );
  }
  if (!artifacts.screenshots?.present && parsedCounts.screenshots > 0) {
    addIssue(
      errors,
      "FLAG_MISMATCH_SCREENSHOTS",
      "Manifest marks screenshots as absent but screenshot metadata exists.",
      parsedCounts.screenshots
    );
  }
  if (!artifacts.recording?.present && loaded.recording) {
    addIssue(
      errors,
      "FLAG_MISMATCH_RECORDING",
      "Manifest marks recording as absent but recording is loaded.",
      null
    );
  }

  if (
    typeof manifestCounts.networkRequests === "number" &&
    parsedCounts.networkRequests !== null &&
    manifestCounts.networkRequests !== parsedCounts.networkRequests
  ) {
    const detail = {
      manifest: manifestCounts.networkRequests,
      parsed: parsedCounts.networkRequests,
    };
    addIssue(
      errors,
      "SUMMARY_MISMATCH_NETWORK",
      formatMismatch("Network Requests", detail),
      detail
    );
  }
  if (
    typeof manifestCounts.consoleMessages === "number" &&
    parsedCounts.consoleMessages !== null &&
    manifestCounts.consoleMessages !== parsedCounts.consoleMessages
  ) {
    const detail = {
      manifest: manifestCounts.consoleMessages,
      parsed: parsedCounts.consoleMessages,
    };
    addIssue(
      errors,
      "SUMMARY_MISMATCH_CONSOLE",
      formatMismatch("Console Messages", detail),
      detail
    );
  }
  if (
    typeof manifestCounts.screenshots === "number" &&
    manifestCounts.screenshots !== parsedCounts.screenshots
  ) {
    const detail = {
      manifest: manifestCounts.screenshots,
      parsed: parsedCounts.screenshots,
    };
    addIssue(
      errors,
      "SUMMARY_MISMATCH_SCREENSHOTS",
      formatMismatch("Screenshots", detail),
      detail
    );
  }
  if (
    typeof manifestCounts.networkFailures === "number" &&
    parsedCounts.networkFailures !== null &&
    manifestCounts.networkFailures !== parsedCounts.networkFailures
  ) {
    const detail = {
      manifest: manifestCounts.networkFailures,
      parsed: parsedCounts.networkFailures,
    };
    addIssue(
      errors,
      "SUMMARY_MISMATCH_NETWORK_FAILURES",
      formatMismatch("Network Failures", detail),
      detail
    );
  }
  if (
    typeof manifestCounts.consoleErrors === "number" &&
    parsedCounts.consoleErrors !== null &&
    manifestCounts.consoleErrors !== parsedCounts.consoleErrors
  ) {
    const detail = {
      manifest: manifestCounts.consoleErrors,
      parsed: parsedCounts.consoleErrors,
    };
    addIssue(
      errors,
      "SUMMARY_MISMATCH_CONSOLE_ERRORS",
      formatMismatch("Console Errors", detail),
      detail
    );
  }

  if (
    parsedCounts.networkFailures !== null &&
    markerCounts["network-failure"] > parsedCounts.networkFailures
  ) {
    const detail = {
      markers: markerCounts["network-failure"],
      parsed: parsedCounts.networkFailures,
    };
    addIssue(
      errors,
      "MARKER_SOURCE_MISMATCH_NETWORK",
      formatMarkerMismatch("Network Failures", detail),
      detail
    );
  }
  if (
    parsedCounts.consoleErrors !== null &&
    markerCounts["console-error"] > parsedCounts.consoleErrors
  ) {
    const detail = {
      markers: markerCounts["console-error"],
      parsed: parsedCounts.consoleErrors,
    };
    addIssue(
      errors,
      "MARKER_SOURCE_MISMATCH_CONSOLE",
      formatMarkerMismatch("Console Errors", detail),
      detail
    );
  }
  if (markerCounts.screenshot > parsedCounts.screenshots) {
    const detail = {
      markers: markerCounts.screenshot,
      parsed: parsedCounts.screenshots,
    };
    addIssue(
      errors,
      "MARKER_SOURCE_MISMATCH_SCREENSHOTS",
      formatMarkerMismatch("Screenshots", detail),
      detail
    );
  }
  if (markerCounts.incident > parsedCounts.incidents) {
    const detail = {
      markers: markerCounts.incident,
      parsed: parsedCounts.incidents,
    };
    addIssue(
      errors,
      "MARKER_SOURCE_MISMATCH_INCIDENTS",
      formatMarkerMismatch("Incidents", detail),
      detail
    );
  }

  if (!loaded.network && networkEvents.length > 0) {
    addIssue(
      errors,
      "STALE_STATE_SUSPECTED_NETWORK",
      "Network events exist but network logs are not marked as loaded.",
      networkEvents.length
    );
  }
  if (!loaded.console && consoleEvents.length > 0) {
    addIssue(
      errors,
      "STALE_STATE_SUSPECTED_CONSOLE",
      "Console events exist but console logs are not marked as loaded.",
      consoleEvents.length
    );
  }

  if (
    Array.isArray(state.events) &&
    Array.isArray(session?.allEventsSorted) &&
    state.events.length !== session.allEventsSorted.length
  ) {
    addIssue(
      errors,
      "RENDER_STATE_MISMATCH",
      "Rendered event list length does not match normalized events.",
      { rendered: state.events.length, normalized: session.allEventsSorted.length }
    );
  }

  const manifestDuration =
    manifest?.timeline?.endOffsetMs || manifest?.session?.durationMs || 0;
  if (isValidTimestampMs(manifestDuration) && isValidTimestampMs(session?.durationMs)) {
    const diff = Math.abs((session.durationMs || 0) - manifestDuration);
    const thresholdMs = 3000;
    if (diff > thresholdMs) {
      const target = loaded.recording && session?.durationSource === "media" ? errors : warnings;
      addIssue(
        target,
        "DURATION_MISMATCH_LARGE",
        "Session duration differs materially from manifest duration.",
        { manifest: manifestDuration, session: session.durationMs, diff }
      );
    }
  }

  const hasErrors = errors.length > 0;
  const failFastScopes = hasErrors ? deriveFailFastScopes(errors) : new Set();
  const failFastGlobal = hasErrors && failFastScopes.has("global");
  const availability = buildIntegrityAvailability(failFastScopes, failFastGlobal);
  return {
    errors,
    warnings,
    manifestCounts,
    parsedCounts,
    lineage,
    hasErrors,
    failFast: failFastGlobal,
    failFastGlobal,
    failFastScopes,
    availability,
  };
}

function setIntegrityControlsDisabled(report) {
  if (!report || !report.availability) {
    applyManifestAvailability(state.manifest);
    if (summaryPanel) {
      summaryPanel.classList.remove("integrity-disabled");
    }
    return;
  }
  const availability = report.availability;
  const globalDisabled = !availability.global;
  applyManifestAvailability(state.manifest);
  if (summaryPanel) {
    summaryPanel.classList.remove("integrity-disabled");
  }
  panelTabs.forEach((tab) => {
    const panel = tab.dataset.panel;
    let enabled = !globalDisabled;
    if (panel === "network") {
      enabled = enabled && availability.network !== false;
    } else if (panel === "console") {
      enabled = enabled && availability.console !== false;
    } else if (panel === "screenshots") {
      enabled = enabled && availability.screenshots !== false;
    } else if (panel === "timeline") {
      enabled = enabled && availability.timeline !== false;
    }
    tab.disabled = !enabled;
    tab.classList.toggle("disabled", !enabled);
  });
  if (errorOnlyToggle) {
    errorOnlyToggle.disabled = globalDisabled || !availability.timeline;
  }
  if (filterMarkers) {
    filterMarkers.disabled = globalDisabled || !availability.timeline;
    if (!availability.timeline) {
      filterMarkers.checked = false;
    }
  }
  if (filterErrors) {
    filterErrors.disabled = globalDisabled || !availability.timeline;
    if (!availability.timeline) {
      filterErrors.checked = false;
    }
  }
  if (filterNetwork) {
    filterNetwork.disabled = globalDisabled || !availability.network;
    if (!availability.network) {
      filterNetwork.checked = false;
    }
  }
  if (filterConsole) {
    filterConsole.disabled = globalDisabled || !availability.console;
    if (!availability.console) {
      filterConsole.checked = false;
    }
  }
  if (filterScreenshots) {
    filterScreenshots.disabled = globalDisabled || !availability.screenshots;
    if (!availability.screenshots) {
      filterScreenshots.checked = false;
    }
  }
  if (timeline) {
    timeline.disabled = globalDisabled || !availability.timeline;
  }
  const hasRecording = Boolean(state.manifest?.artifacts?.recording?.present);
  if (playToggleBtn) {
    playToggleBtn.disabled =
      globalDisabled || !availability.timeline || !availability.recording || !hasRecording;
  }
  if (videoSyncNote && availability.recording === false) {
    videoSyncNote.textContent = buildIntegrityDisabledMessage(
      "recording",
      "Video playback"
    );
    videoSyncNote.dataset.integrity = "1";
    videoSyncNote.classList.remove("hidden");
  } else if (videoSyncNote && videoSyncNote.dataset.integrity === "1") {
    videoSyncNote.textContent = "";
    videoSyncNote.classList.add("hidden");
    delete videoSyncNote.dataset.integrity;
  }
  networkFilterChips.forEach((chip) => {
    chip.disabled = globalDisabled || !availability.network;
  });
  networkModeChips.forEach((chip) => {
    chip.disabled = globalDisabled || !availability.network;
  });
  consoleLevelChips.forEach((chip) => {
    chip.disabled = globalDisabled || !availability.console;
  });
  consoleModeChips.forEach((chip) => {
    chip.disabled = globalDisabled || !availability.console;
  });
  if (networkSearchInput) {
    networkSearchInput.disabled = globalDisabled || !availability.network;
  }
  if (consoleSearchInput) {
    consoleSearchInput.disabled = globalDisabled || !availability.console;
  }
  if (networkSearchClear) {
    networkSearchClear.disabled =
      globalDisabled || !availability.network || !networkSearchInput?.value;
  }
  if (consoleSearchClear) {
    consoleSearchClear.disabled =
      globalDisabled || !availability.console || !consoleSearchInput?.value;
  }
}

function renderIntegrityBanner(report) {
  if (!integrityBanner) {
    return;
  }
  if (!report || (report.errors.length === 0 && report.warnings.length === 0)) {
    integrityBanner.classList.add("hidden");
    return;
  }
  integrityBanner.classList.remove("hidden");
  integrityBanner.classList.toggle("warn", report.errors.length === 0);
  if (integrityTitle) {
    integrityTitle.textContent =
      report.errors.length > 0 ? "Integrity check failed" : "Integrity warnings";
  }
  if (integritySummary) {
    const parts = [
      `Errors: ${report.errors.length}`,
      `Warnings: ${report.warnings.length}`,
    ];
    if (report.failFastGlobal) {
      parts.push("Fail-fast mode enabled");
    } else if (report.hasErrors) {
      parts.push("Scoped integrity protections enabled");
    }
    integritySummary.textContent = parts.join(" • ");
  }
  const renderList = (target, items, emptyLabel) => {
    if (!target) {
      return;
    }
    target.innerHTML = "";
    if (!items.length) {
      const li = document.createElement("li");
      li.textContent = emptyLabel;
      target.appendChild(li);
      return;
    }
    items.forEach((item) => {
      const li = document.createElement("li");
      const domain = getIntegrityDomainForCode(item.code);
      li.textContent = `${domain ? `[${domain}] ` : ""}${item.code}: ${item.message}`;
      target.appendChild(li);
    });
  };
  renderList(integrityErrors, report.errors, "No integrity errors.");
  renderList(integrityWarnings, report.warnings, "No integrity warnings.");
  if (integrityCounts) {
    integrityCounts.innerHTML = "";
    const rows = [
      {
        label: "Network Requests",
        value: formatCountPair(
          report.manifestCounts.networkRequests,
          report.parsedCounts.networkRequests
        ),
      },
      {
        label: "Network Failures",
        value: formatCountPair(
          report.manifestCounts.networkFailures,
          report.parsedCounts.networkFailures
        ),
      },
      {
        label: "Console Messages",
        value: formatCountPair(
          report.manifestCounts.consoleMessages,
          report.parsedCounts.consoleMessages
        ),
      },
      {
        label: "Console Errors",
        value: formatCountPair(
          report.manifestCounts.consoleErrors,
          report.parsedCounts.consoleErrors
        ),
      },
      {
        label: "Screenshots",
        value: formatCountPair(
          report.manifestCounts.screenshots,
          report.parsedCounts.screenshots
        ),
      },
    ];
    rows.forEach((row) => {
      const line = document.createElement("div");
      line.className = "integrity-row";
      const label = document.createElement("span");
      label.className = "muted";
      label.textContent = row.label;
      const value = document.createElement("span");
      value.textContent = row.value;
      line.appendChild(label);
      line.appendChild(value);
      integrityCounts.appendChild(line);
    });
  }
  if (integrityDetails) {
    integrityDetails.open = report.failFastGlobal;
  }
}

function updateIntegrityReport() {
  if (!state.session) {
    state.integrityReport = null;
    renderIntegrityBanner(null);
    return;
  }
  const previousFailFastGlobal = state.integrityReport?.failFastGlobal || false;
  const previousAvailabilityKey = JSON.stringify(
    state.integrityReport?.availability || {}
  );
  const report = buildIntegrityReport(state.session);
  state.integrityReport = report;
  renderIntegrityBanner(report);
  setIntegrityControlsDisabled(report);
  updateCurrentTimeContext();
  renderSummaryFromManifest(state.manifest);
  updateTimelineSummary(state.manifest);
  updateDiagnosticsPanel();
  if (report.failFastGlobal && detailsBody) {
    detailsBody.textContent = "Integrity check failed. Event details disabled.";
  }
  const nextAvailabilityKey = JSON.stringify(report.availability || {});
  if (
    previousFailFastGlobal !== report.failFastGlobal ||
    previousAvailabilityKey !== nextAvailabilityKey
  ) {
    refreshView();
    renderIncidentRail();
    renderScreenshotsPanel();
    renderNetworkPanel();
    renderConsolePanel();
    renderInspector();
  }
}

function buildNormalizedSessionState(manifest, pkg) {
  const manifestShots = normalizeScreenshotItems(
    manifest?.artifacts?.screenshots?.items || []
  );
  const screenshotFiles = manifestShots
    .map((shot) => (shot && shot.path ? shot.path : null))
    .filter(Boolean);
  const events = normalizeTimelineEvents(buildEventsFromManifest(manifest));
  const eventById = new Map();
  const eventByRef = new Map();
  events.forEach((ev) => {
    if (ev?.id) {
      eventById.set(ev.id, ev);
    }
    if (ev?.refs?.ref) {
      eventByRef.set(ev.refs.ref, ev);
    }
  });
  const durationCandidate =
    (manifest?.timeline && manifest.timeline.endOffsetMs) ||
    manifest?.session?.durationMs ||
    computeDurationMs(null, events);
  const durationSource = manifest?.timeline?.endOffsetMs
    ? "timeline"
    : manifest?.session?.durationMs
      ? "manifest"
      : "events";
  const durationMs = isValidTimestampMs(durationCandidate) ? durationCandidate : 0;
  const incidents = normalizeIncidentItems(buildIncidentsFromManifest(manifest));
  const screenshotsSorted = manifestShots
    .slice()
    .sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0));
  const screenshotIndex = buildScreenshotIndexFromManifest(manifest, screenshotsSorted);
  const session = {
    manifest,
    pkg,
    durationMs,
    durationSource,
    recordingBlob: null,
    recordingUrl: null,
    networkEvents: [],
    consoleEvents: [],
    screenshots: screenshotsSorted,
    incidents,
    allEventsSorted: events,
    eventIndexes: {
      eventById,
      eventByRef,
      networkById: new Map(),
      consoleById: new Map(),
      incidentById: indexEntriesById(incidents),
      screenshotById: screenshotIndex,
    },
    screenshotFiles,
    artifactPresence: {
      recording: Boolean(manifest?.artifacts?.recording?.present),
      network: Boolean(manifest?.artifacts?.network?.present),
      console: Boolean(manifest?.artifacts?.console?.present),
      screenshots: Boolean(manifest?.artifacts?.screenshots?.present),
      incidents: incidents.length > 0,
    },
    parseWarnings: {
      network: 0,
      console: 0,
      total: 0,
    },
  };
  session.markers = deriveTimelineMarkers(session);
  session.markersVersion = 1;
  return session;
}

function applyNormalizedSessionState(normalized) {
  state.session = normalized;
  state.manifest = normalized.manifest;
  state.events = normalized.allEventsSorted;
  state.screenshotById = normalized.eventIndexes.screenshotById;
  state.sortedScreenshotsByTime = normalized.screenshots;
  state.sortedScreenshotEvents = normalized.allEventsSorted.filter(
    (ev) => ev.type === "screenshot"
  );
  state.playhead.currentTimeMs = 0;
  state.playhead.durationMs = normalized.durationMs;
  state.playhead.selectedEventId = null;
  state.playhead.selectedIncidentId = null;
  state.playhead.selectedScreenshotId = null;
  state.videoSyncAvailable =
    normalized.artifactPresence.recording && normalized.durationMs > 0;
  state.playhead.hasRecording = normalized.artifactPresence.recording;
  setIncidents(normalized.incidents);

  applyManifestAvailability(normalized.manifest);
  renderScreenshotsPanel();
  setActivePanel("network");
  renderIncidentRail();
  applySummaryInteractions();
  updatePlayheadDisplay();
  updateCurrentTimeContext();
  renderInspector();
  updateIntegrityReport();
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
  if (!manifest) {
    summaryPanel.classList.add("hidden");
    return;
  }
  const report = state.integrityReport;
  if (!report) {
    summaryPanel.classList.add("hidden");
    return;
  }
  const pluralizeLabel = (count, singular, plural) => {
    if (typeof count !== "number") {
      return plural;
    }
    return count === 1 ? singular : plural;
  };
  const resolveCount = (manifestCount, parsedCount) =>
    typeof manifestCount === "number" ? manifestCount : parsedCount;
  const formatSummaryCount = ({ manifestCount, parsedCount, present }) => {
    const hasManifest = typeof manifestCount === "number";
    const hasParsed = typeof parsedCount === "number";
    if (!hasManifest && !hasParsed) {
      return present === false ? "Not available" : "Not loaded";
    }
    const baseValue = hasManifest ? manifestCount : parsedCount;
    if (hasManifest && hasParsed && manifestCount !== parsedCount) {
      return `${baseValue} (⚠ parsed: ${parsedCount})`;
    }
    return String(baseValue);
  };
  const appendMismatchSignal = (signals, label, manifestCount, parsedCount) => {
    if (
      typeof manifestCount === "number" &&
      typeof parsedCount === "number" &&
      manifestCount !== parsedCount
    ) {
      signals.push(`${label} mismatch: manifest=${manifestCount}, parsed=${parsedCount}`);
    }
  };
  if (timelinePanel && summaryPanel.parentElement !== timelinePanel) {
    timelinePanel.appendChild(summaryPanel);
  }
  summaryPanel.classList.remove("hidden");
  const parsed = report.parsedCounts || {};
  const manifestCounts = report.manifestCounts || {};
  const requestsCount = resolveCount(
    manifestCounts.networkRequests,
    parsed.networkRequests
  );
  const failuresCount = resolveCount(
    manifestCounts.networkFailures,
    parsed.networkFailures
  );
  const consoleCount = resolveCount(
    manifestCounts.consoleMessages,
    parsed.consoleMessages
  );
  const consoleErrorCount = resolveCount(
    manifestCounts.consoleErrors,
    parsed.consoleErrors
  );
  const screenshotCount = resolveCount(
    manifestCounts.screenshots,
    parsed.screenshots
  );
  const networkRequestsText = formatSummaryCount({
    manifestCount: manifestCounts.networkRequests,
    parsedCount: parsed.networkRequests,
    present: manifest?.artifacts?.network?.present,
  });
  const networkFailuresText = formatSummaryCount({
    manifestCount: manifestCounts.networkFailures,
    parsedCount: parsed.networkFailures,
    present: manifest?.artifacts?.network?.present,
  });
  const consoleMessagesText = formatSummaryCount({
    manifestCount: manifestCounts.consoleMessages,
    parsedCount: parsed.consoleMessages,
    present: manifest?.artifacts?.console?.present,
  });
  const consoleErrorsText = formatSummaryCount({
    manifestCount: manifestCounts.consoleErrors,
    parsedCount: parsed.consoleErrors,
    present: manifest?.artifacts?.console?.present,
  });
  if (summaryNetworkRequests) {
    summaryNetworkRequests.textContent = networkRequestsText;
  }
  if (summaryNetworkFailures) {
    summaryNetworkFailures.textContent = networkFailuresText;
  }
  if (summaryConsoleMessages) {
    summaryConsoleMessages.textContent = consoleMessagesText;
  }
  if (summaryConsoleErrors) {
    summaryConsoleErrors.textContent = consoleErrorsText;
  }
  if (summaryNetworkRequestsLabel) {
    summaryNetworkRequestsLabel.textContent = "Req";
  }
  if (summaryNetworkFailuresLabel) {
    summaryNetworkFailuresLabel.textContent = "Fail";
  }
  if (summaryConsoleMessagesLabel) {
    summaryConsoleMessagesLabel.textContent = "Logs";
  }
  if (summaryConsoleErrorsLabel) {
    summaryConsoleErrorsLabel.textContent = "Console Err";
  }
  if (summaryScreenshotsLabel) {
    summaryScreenshotsLabel.textContent = "Shots";
  }
  if (summaryRecordingLabel) {
    summaryRecordingLabel.textContent = "Rec";
  }
  if (summaryScreenshots) {
    summaryScreenshots.textContent = formatSummaryCount({
      manifestCount: manifestCounts.screenshots,
      parsedCount: parsed.screenshots,
      present: manifest?.artifacts?.screenshots?.present,
    });
  }
  if (summaryRecording) {
    summaryRecording.textContent =
      manifest?.artifacts?.recording?.present ? "Yes" : "No";
  }
  if (summarySignals) {
    const signals = [];
    appendMismatchSignal(
      signals,
      "Network Requests",
      manifestCounts.networkRequests,
      parsed.networkRequests
    );
    appendMismatchSignal(
      signals,
      "Network Failures",
      manifestCounts.networkFailures,
      parsed.networkFailures
    );
    appendMismatchSignal(
      signals,
      "Console Messages",
      manifestCounts.consoleMessages,
      parsed.consoleMessages
    );
    appendMismatchSignal(
      signals,
      "Console Errors",
      manifestCounts.consoleErrors,
      parsed.consoleErrors
    );
    appendMismatchSignal(
      signals,
      "Screenshots",
      manifestCounts.screenshots,
      parsed.screenshots
    );
    if (report.failFastGlobal) {
      signals.unshift("Integrity errors detected.");
    }
    summarySignals.textContent = signals.length ? signals.join(" • ") : "";
  }
}

function updateTimelineSummary(manifest) {
  if (!timelineSummary) {
    return;
  }
  const report = state.integrityReport;
  if (!manifest || !report) {
    timelineSummary.textContent = "";
    return;
  }
  if (report.failFastGlobal) {
    timelineSummary.textContent =
      "Integrity errors detected — timeline summary disabled.";
    return;
  }
  const parts = [];
  if (typeof report.parsedCounts.networkRequests === "number") {
    parts.push(`${report.parsedCounts.networkRequests} requests`);
  }
  if (typeof report.parsedCounts.consoleMessages === "number") {
    parts.push(`${report.parsedCounts.consoleMessages} console`);
  }
  if (typeof report.parsedCounts.consoleErrors === "number") {
    parts.push(`${report.parsedCounts.consoleErrors} errors`);
  }
  if (typeof report.parsedCounts.networkFailures === "number") {
    parts.push(`${report.parsedCounts.networkFailures} failures`);
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

function getIntegrityAvailability() {
  return state.integrityReport?.availability || null;
}

function isIncidentAvailable(incident, availability = getIntegrityAvailability()) {
  if (!availability) {
    return true;
  }
  if (!availability.incidents || availability.global === false) {
    return false;
  }
  if (!incident) {
    return false;
  }
  if (incident.type && incident.type.startsWith("network")) {
    return availability.network !== false;
  }
  if (incident.type && incident.type.startsWith("console")) {
    return availability.console !== false;
  }
  return availability.timeline !== false;
}

function filterAvailableIncidents(incidents, availability = getIntegrityAvailability()) {
  if (!availability) {
    return incidents;
  }
  return incidents.filter((inc) => isIncidentAvailable(inc, availability));
}

function isEventAvailable(event, availability = getIntegrityAvailability()) {
  if (!availability) {
    return true;
  }
  if (availability.global === false) {
    return false;
  }
  if (!event) {
    return false;
  }
  if (event.type === "network") {
    return availability.network !== false;
  }
  if (event.type === "console") {
    return availability.console !== false;
  }
  if (event.type === "screenshot") {
    return availability.screenshots !== false;
  }
  return availability.timeline !== false;
}

function getIncidentForMarker(marker) {
  if (!marker || !marker.sourceRef) {
    return null;
  }
  const incidentMap = state.session?.eventIndexes?.incidentById;
  if (incidentMap && incidentMap.has(marker.sourceRef)) {
    return incidentMap.get(marker.sourceRef);
  }
  return state.session?.incidents?.find((inc) => inc.id === marker.sourceRef) || null;
}

function isMarkerAvailable(marker, availability = getIntegrityAvailability()) {
  if (!availability) {
    return true;
  }
  if (availability.global === false) {
    return false;
  }
  if (!marker) {
    return false;
  }
  if (marker.type === "network-failure") {
    return availability.network !== false;
  }
  if (marker.type === "console-error") {
    return availability.console !== false;
  }
  if (marker.type === "screenshot") {
    return availability.screenshots !== false;
  }
  if (marker.type === "incident") {
    const incident = getIncidentForMarker(marker);
    return isIncidentAvailable(incident, availability);
  }
  return availability.timeline !== false;
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
    if (isFailFastActive("timeline")) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const label = target.closest(".summary-item");
    if (!label) {
      return;
    }
    const key = label.dataset.summary || "";
    const availability = getIntegrityAvailability();
    if (key === "networkRequests" && availability && availability.network === false) {
      return;
    }
    if (key === "networkFailures" && availability && availability.network === false) {
      return;
    }
    if (key === "consoleMessages" && availability && availability.console === false) {
      return;
    }
    if (key === "consoleErrors" && availability && availability.console === false) {
      return;
    }
    if (key === "screenshots" && availability && availability.screenshots === false) {
      return;
    }
    if (key === "recording" && availability && availability.recording === false) {
      return;
    }
    if (key === "networkFailures") {
      state.filters.networkStatusBucket = "errors";
      networkFilterChips.forEach((chip) => {
        chip.classList.toggle("active", chip.dataset.netFilter === "errors");
      });
      setActivePanel("network");
      ensureNetworkLogsLoaded().then(renderNetworkPanel);
    } else if (key === "networkRequests") {
      setActivePanel("network");
      state.filters.networkStatusBucket = "all";
      networkFilterChips.forEach((chip) => {
        chip.classList.toggle("active", chip.dataset.netFilter === "all");
      });
      ensureNetworkLogsLoaded().then(renderNetworkPanel);
    } else if (key === "consoleErrors") {
      setActivePanel("console");
      state.filters.consoleLevels = ["error"];
      consoleLevelChips.forEach((chip) => {
        chip.classList.toggle("active", chip.dataset.consoleLevel === "error");
      });
      ensureConsoleLogsLoaded().then(renderConsolePanel);
    } else if (key === "consoleMessages") {
      setActivePanel("console");
      state.filters.consoleLevels = ["error", "warning", "info", "log", "debug"];
      consoleLevelChips.forEach((chip) => {
        chip.classList.toggle("active", true);
      });
      ensureConsoleLogsLoaded().then(renderConsolePanel);
    } else if (key === "screenshots") {
      setActivePanel("screenshots");
      renderScreenshotsPanel();
    } else if (key === "recording") {
      setActivePanel("timeline");
    }
    renderIncidentRail();
    updateCurrentTimeContext();
  });
}

function buildIncidentsFromNetwork(entries) {
  return entries
    .filter((entry) => isNetworkFailureEntry(entry))
    .map((entry) => {
      const bucket = classifyNetworkStatus(entry);
      const classification = classifyNetworkFailure(entry);
      const type =
        bucket === "5xx"
          ? "network-5xx"
          : bucket === "4xx"
            ? "network-4xx"
            : bucket === "aborted"
              ? "network-aborted"
              : "network-failure";
      return {
        id: `inc_${entry.id}`,
        type,
        timestampMs: entry.timestampMs || entry.timestamp_ms || 0,
        severity: classification.severity,
        title: buildIncidentTitle({
          type: "network",
          statusCode: entry.response_status || entry.status,
          method: entry.method,
          url: entry.url,
          failureKind: classification.kind,
        }),
        subtitle: formatTimeWithMs(entry.timestampMs || entry.timestamp_ms || 0),
        sourceRef: entry.id,
        panelTarget: "network",
        statusCode: entry.response_status || entry.status || 0,
        consoleLevel: "",
        url: entry.url || "",
        failureKind: classification.kind,
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

function setIncidents(nextIncidents) {
  state.incidents = Array.isArray(nextIncidents) ? nextIncidents : [];
  state.sortedIncidentsByTime = state.incidents
    .slice()
    .sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0));
  state.incidentsVersion += 1;
  state.filteredIncidentsCache = {
    key: "",
    list: [],
  };
  if (state.session) {
    state.session.incidents = state.sortedIncidentsByTime;
    state.session.eventIndexes.incidentById = indexEntriesById(
      state.sortedIncidentsByTime
    );
    state.session.artifactPresence.incidents =
      state.sortedIncidentsByTime.length > 0;
    rebuildTimelineMarkers();
    renderTimelineMarkers();
    renderTimelineLanes(state.session?.markers || []);
    updateIntegrityReport();
  }
}

function getFilteredIncidents() {
  const allowedLevels = getEffectiveConsoleLevels();
  const availabilityKey = JSON.stringify(getIntegrityAvailability() || {});
  const key = [
    state.incidentsVersion,
    state.filters.errorOnly ? "errorOnly" : "all",
    state.filters.networkStatusBucket || "all",
    allowedLevels.join(","),
    availabilityKey,
  ].join("|");
  if (state.filteredIncidentsCache.key === key) {
    return state.filteredIncidentsCache.list;
  }
  let incidents = filterAvailableIncidents(state.sortedIncidentsByTime.slice());
  if (state.filters.errorOnly) {
    incidents = incidents.filter((inc) => inc.severity === "error");
  }
  const availability = getIntegrityAvailability();
  const networkFilterEnabled = !availability || availability.network !== false;
  if (networkFilterEnabled && state.filters.networkStatusBucket !== "all") {
    if (state.filters.networkStatusBucket === "errors") {
      incidents = incidents.filter(
        (inc) =>
          ["network-4xx", "network-5xx", "network-failure"].includes(inc.type) &&
          inc.severity !== "info"
      );
    } else if (state.filters.networkStatusBucket === "4xx") {
      incidents = incidents.filter((inc) => inc.type === "network-4xx");
    } else if (state.filters.networkStatusBucket === "5xx") {
      incidents = incidents.filter((inc) => inc.type === "network-5xx");
    }
  }
  incidents = incidents.filter((inc) => {
    if (inc.type.startsWith("console")) {
      return allowedLevels.includes(inc.consoleLevel || "");
    }
    return true;
  });
  state.filteredIncidentsCache = {
    key,
    list: incidents,
  };
  return incidents;
}

function renderIncidentRail() {
  if (!incidentPanel || !incidentList || !incidentEmpty) {
    return;
  }
  const availability = getIntegrityAvailability();
  if (availability && availability.incidents === false) {
    const report = state.integrityReport;
    const scope = report?.failFastScopes?.has("incidents") ? "incidents" : "timeline";
    incidentPanel.classList.remove("hidden");
    incidentEmpty.classList.add("hidden");
    renderIntegrityDisabled(
      incidentList,
      buildIntegrityDisabledMessage(scope, "Errors list")
    );
    updateIncidentNavControls();
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
    row.dataset.entryId = inc.id || "";
    if (state.playhead.selectedIncidentId === inc.id) {
      row.classList.add("active");
    } else if (
      state.currentMoment?.autoHighlight?.incidentId &&
      inc.id === state.currentMoment.autoHighlight.incidentId
    ) {
      row.classList.add("nearby");
    }
    row.classList.add("errors-row");
    if (inc.severity) {
      row.classList.add(`severity-${inc.severity}`);
    }
    const time = document.createElement("div");
    time.className = "mono muted cell-time";
    time.textContent = formatTimeWithMs(inc.timestampMs || 0);
    const type = document.createElement("div");
    type.className = "mono cell-type";
    const typeLabel = inc.type.startsWith("network")
      ? "NET"
      : inc.type.startsWith("console")
        ? "CON"
        : "ERR";
    type.textContent = typeLabel;
    const message = document.createElement("div");
    message.className = "cell-main";
    message.textContent = inc.title || buildIncidentTitle(inc);
    const status = document.createElement("div");
    status.className = "mono cell-status";
    status.textContent =
      typeof inc.statusCode === "number" && inc.statusCode > 0
        ? String(inc.statusCode)
        : "-";
    row.appendChild(time);
    row.appendChild(type);
    row.appendChild(message);
    row.appendChild(status);
    const clickSource =
      state.playhead.activePanel === "errors" ? "errors-panel" : "incident-click";
    row.addEventListener("click", () => {
      setFollowPlayhead(false, "incident-row");
      handleIncidentSelection(inc, clickSource);
    });
    incidentList.appendChild(row);
  });
  updateIncidentNavControls();
}

function updateIncidentNavControls() {
  if (!prevIncidentBtn || !nextIncidentBtn) {
    return;
  }
  const incidents = getNavigableIncidents();
  const disabled = incidents.length === 0;
  prevIncidentBtn.disabled = disabled;
  nextIncidentBtn.disabled = disabled;
}

function getNavigableIncidents() {
  const availability = getIntegrityAvailability();
  const list = filterAvailableIncidents(state.sortedIncidentsByTime.slice());
  if (availability && availability.incidents === false) {
    return [];
  }
  return list;
}

function navigateIncident(direction) {
  const incidents = getNavigableIncidents();
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
  setFollowPlayhead(false, "incident-nav");
  handleIncidentSelection(
    incidents[index],
    direction > 0 ? "next-incident" : "prev-incident"
  );
}

function renderScreenshotsPanel() {
  if (!screenshotsList || !screenshotsEmpty) {
    return;
  }
  if (isFailFastActive("screenshots")) {
    screenshotsEmpty.classList.add("hidden");
    renderIntegrityDisabled(
      screenshotsList,
      buildIntegrityDisabledMessage("screenshots", "Screenshots panel")
    );
    if (screenshotPreview) {
      screenshotPreview.textContent =
        buildIntegrityDisabledMessage("screenshots", "Screenshot preview");
    }
    return;
  }
  const items = state.manifest?.artifacts?.screenshots?.items || [];
  screenshotsList.innerHTML = "";
  if (!items.length) {
    screenshotsEmpty.classList.remove("hidden");
    return;
  }
  screenshotsEmpty.classList.add("hidden");
  items.forEach((shot, index) => {
    const row = document.createElement("div");
    row.className = "screenshot-item";
    row.dataset.entryId = shot.id || shot.path || "";
    if (state.playhead.selectedScreenshotId && shot.id === state.playhead.selectedScreenshotId) {
      row.classList.add("active");
    } else if (
      state.currentMoment?.autoHighlight?.screenshotId &&
      shot.id === state.currentMoment.autoHighlight.screenshotId
    ) {
      row.classList.add("nearby");
    }
    const thumb = document.createElement("img");
    thumb.className = "screenshot-thumb";
    const baseName = shot.path ? shot.path.split("/").pop() : null;
    if (baseName && state.screenshotUrls.has(baseName)) {
      thumb.src = state.screenshotUrls.get(baseName);
    }
    const meta = document.createElement("div");
    const title = document.createElement("div");
    let labelText = "Shot";
    try {
      labelText = getScreenshotDisplayLabel(shot, index) || "Shot";
    } catch (error) {
      console.warn("[DebugDuck] Screenshot label fallback", {
        error: error?.message || String(error),
        shotId: shot?.id || null,
      });
      labelText = "Shot";
    }
    title.textContent = labelText;
    const subtitle = document.createElement("div");
    subtitle.className = "muted";
    const kindLabel = shot.kind === "fullpage" ? "full page" : shot.kind;
    subtitle.textContent = kindLabel || "viewport";
    meta.appendChild(title);
    meta.appendChild(subtitle);
    row.appendChild(thumb);
    row.appendChild(meta);
    row.addEventListener("click", () => {
      setFollowPlayhead(false, "screenshot-row");
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
        "screenshot-click"
      );
      renderScreenshotsPanel();
      renderScreenshotPreview();
  openScreenshotModal(shot);
    });
    screenshotsList.appendChild(row);
  });
  renderScreenshotPreview();
}

function renderScreenshotPreview() {
  if (!screenshotPreview) {
    return;
  }
  const workspace =
    screenshotPreview.closest(".panel-group")?.querySelector(".event-workspace") || null;
  const setCollapsed = (value) => {
    if (workspace) {
      workspace.classList.toggle("details-collapsed", value);
    }
  };
  if (isFailFastActive("screenshots")) {
    screenshotPreview.textContent = buildIntegrityDisabledMessage(
      "screenshots",
      "Screenshot preview"
    );
    setCollapsed(true);
    return;
  }
  const selectedShot = state.playhead.selectedScreenshotId
    ? state.screenshotById.get(state.playhead.selectedScreenshotId)
    : null;
  const nearestShot =
    !selectedShot && state.currentMoment?.nearestScreenshot
      ? state.currentMoment.nearestScreenshot
      : null;
  const shot = selectedShot || nearestShot;
  if (!shot) {
    screenshotPreview.textContent = "Select an item";
    setCollapsed(true);
    return;
  }
  setCollapsed(!selectedShot);
  screenshotPreview.innerHTML = "";
  const img = document.createElement("img");
  const baseName = shot.path ? shot.path.split("/").pop() : null;
  if (baseName && state.screenshotUrls.has(baseName)) {
    img.src = state.screenshotUrls.get(baseName);
  }
  const meta = document.createElement("div");
  meta.className = "muted";
  const previewIndex = getScreenshotIndexById(shot);
  const label = getScreenshotDisplayLabel(shot, previewIndex ?? undefined);
  const kindLabel = shot.kind === "fullpage" ? "full page" : shot.kind;
  const pieces = [label, kindLabel || "viewport", selectedShot ? "Selected" : "Nearest"].filter(
    Boolean
  );
  meta.textContent = pieces.join(" • ");
  screenshotPreview.appendChild(img);
  screenshotPreview.appendChild(meta);
}

function clampScale(value) {
  return Math.min(8, Math.max(0.25, value));
}

function applyScreenshotTransform() {
  if (!screenshotModalImage) {
    return;
  }
  screenshotModalImage.style.transform = `translate(${modalState.translateX}px, ${modalState.translateY}px) scale(${modalState.scale})`;
}

function setScreenshotScale(nextScale) {
  modalState.scale = clampScale(nextScale);
  applyScreenshotTransform();
}

function fitScreenshotToViewport() {
  if (!screenshotModalViewport || !modalState.imageWidth || !modalState.imageHeight) {
    return;
  }
  const rect = screenshotModalViewport.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }
  const scaleX = rect.width / modalState.imageWidth;
  const scaleY = rect.height / modalState.imageHeight;
  modalState.fitScale = clampScale(Math.min(scaleX, scaleY));
  modalState.translateX = 0;
  modalState.translateY = 0;
  modalState.scale = modalState.fitScale;
  applyScreenshotTransform();
}

function resetScreenshotModalView() {
  modalState.translateX = 0;
  modalState.translateY = 0;
  modalState.scale = modalState.fitScale || 1;
  applyScreenshotTransform();
}

function getActiveScreenshotForModal() {
  if (!state.session) {
    return null;
  }
  if (state.playhead.selectedScreenshotId) {
    return state.screenshotById.get(state.playhead.selectedScreenshotId) || null;
  }
  if (state.currentMoment?.nearestScreenshot) {
    return state.currentMoment.nearestScreenshot;
  }
  return null;
}

async function openScreenshotModal(shot) {
  if (!shot || isFailFastActive("screenshots")) {
    return;
  }
  if (!screenshotModal || !screenshotModalImage || !screenshotModalViewport) {
    return;
  }
  if (shot.fullPage || shot.kind === "fullpage") {
    return;
  }
  if (!state.pkg || !shot.path) {
    return;
  }
  const entry = state.pkg.resolveArtifact([shot.path]);
  if (!entry) {
    return;
  }
  let blob = null;
  try {
    blob = await state.pkg.readBlob(entry.path || shot.path);
  } catch (error) {
    return;
  }
  if (!blob) {
    return;
  }
  if (modalState.imageSrc) {
    URL.revokeObjectURL(modalState.imageSrc);
  }
  const imageUrl = URL.createObjectURL(blob);
  modalState.imageSrc = imageUrl;
  modalState.screenshotId = shot.id || null;
  modalState.isOpen = true;
  modalState.translateX = 0;
  modalState.translateY = 0;
  modalState.scale = 1;
  modalState.fitScale = 1;
  modalState.imageWidth = 0;
  modalState.imageHeight = 0;
  screenshotModalImage.onload = () => {
    modalState.imageWidth = screenshotModalImage.naturalWidth || 0;
    modalState.imageHeight = screenshotModalImage.naturalHeight || 0;
    fitScreenshotToViewport();
  };
  screenshotModalImage.src = imageUrl;
  if (screenshotModalMeta) {
    const timestampText =
      typeof shot.timestampMs === "number"
        ? formatTimeWithMs(shot.timestampMs)
        : "00:00";
    const kindLabel = shot.kind === "fullpage" ? "Full page" : "Viewport";
    const name =
      shot.label || (shot.path ? shot.path.split("/").pop() : "") || "";
    screenshotModalMeta.textContent = [kindLabel, timestampText, name]
      .filter(Boolean)
      .join(" • ");
  }
  screenshotModal.classList.remove("hidden");
  screenshotModalViewport.classList.remove("dragging");
}

function closeScreenshotModal() {
  if (!screenshotModal || !screenshotModalImage) {
    return;
  }
  screenshotModal.classList.add("hidden");
  modalState.isOpen = false;
  modalState.screenshotId = null;
  modalState.imageWidth = 0;
  modalState.imageHeight = 0;
  modalState.translateX = 0;
  modalState.translateY = 0;
  modalState.scale = 1;
  modalState.fitScale = 1;
  if (modalState.imageSrc) {
    URL.revokeObjectURL(modalState.imageSrc);
  }
  modalState.imageSrc = null;
  screenshotModalImage.src = "";
  if (screenshotModalMeta) {
    screenshotModalMeta.textContent = "";
  }
}

function renderIntegrityDisabled(container, message) {
  if (!container) {
    return;
  }
  container.innerHTML = "";
  const note = document.createElement("div");
  note.className = "integrity-disabled-note";
  note.textContent = message;
  container.appendChild(note);
}

function renderNetworkPanel(options = {}) {
  if (!networkList || !networkEmpty) {
    return;
  }
  const hasNetwork = Boolean(state.manifest?.artifacts?.network?.present);
  const preserveScroll = Boolean(options.preserveScroll);
  const previousScrollTop = preserveScroll ? networkList.scrollTop : 0;
  if (isFailFastActive("network")) {
    networkEmpty.classList.add("hidden");
    networkFilteredEmpty?.classList.add("hidden");
    if (networkResultCount) {
      networkResultCount.textContent = "";
    }
    if (networkSelectionNote) {
      networkSelectionNote.classList.add("hidden");
    }
    renderIntegrityDisabled(
      networkList,
      buildIntegrityDisabledMessage("network", "Network panel")
    );
    return;
  }
  if (hasNetwork && !state.loadedArtifacts.network) {
    networkEmpty.classList.add("hidden");
    networkFilteredEmpty?.classList.add("hidden");
    if (networkResultCount) {
      networkResultCount.textContent = "";
    }
    if (networkSelectionNote) {
      networkSelectionNote.classList.add("hidden");
    }
    networkList.innerHTML = "";
    const loading = document.createElement("div");
    loading.className = "muted";
    loading.textContent = state.loadingNetwork
      ? "Loading network logs…"
      : "Loading network logs…";
    networkList.appendChild(loading);
    ensureNetworkLogsLoaded().then(renderNetworkPanel);
    return;
  }
  const entries = state.networkEntries || [];
  const filtered = getVisibleNetworkEvents();
  const modeLabel = state.panelModes.network === "near" ? "Near Time" : "All Time";
  const statusLabel = (() => {
    if (state.filters.networkStatusBucket === "errors") {
      return "Err";
    }
    if (state.filters.networkStatusBucket === "4xx") {
      return "4xx";
    }
    if (state.filters.networkStatusBucket === "5xx") {
      return "5xx";
    }
    return "All";
  })();
  state.panelRenderKeys.network = buildListKey(filtered);
  updateNearTimeLabels({
    networkCount: state.panelModes.network === "near" ? filtered.length : null,
  });
  networkList.innerHTML = "";
  const groupIndex = new Map();
  if (!entries.length) {
    if (state.panelModes.network === "near") {
      networkEmpty.textContent = "No network activity in this time window";
    } else {
      networkEmpty.textContent = "No network logs available for this session.";
    }
    networkEmpty.classList.remove("hidden");
    networkFilteredEmpty?.classList.add("hidden");
    if (networkResultCount) {
      networkResultCount.textContent = "";
    }
    if (networkSelectionNote) {
      networkSelectionNote.classList.add("hidden");
    }
    return;
  }
  if (state.selectedNetworkId && !entries.some((entry) => entry.id === state.selectedNetworkId)) {
    state.selectedNetworkId = null;
    state.playhead.selectedEventId = null;
  }
  if (state.panelModes.network === "near") {
    networkEmpty.textContent = "No network activity in this time window";
  } else {
    networkEmpty.textContent = "No network logs available for this session.";
  }
  networkEmpty.classList.add("hidden");
  networkFilteredEmpty?.classList.toggle("hidden", filtered.length > 0);
  if (networkFilteredEmpty && filtered.length === 0 && state.panelModes.network === "near") {
    networkFilteredEmpty.textContent = "No network entries near current time.";
  } else if (networkFilteredEmpty) {
    networkFilteredEmpty.textContent = "No network entries match current filter.";
  }
  const selectedNetworkId = state.selectedNetworkId || null;
  const grouped = groupNetworkEntries(filtered);
  const requestCount = filtered.length;
  const totalRequests =
    state.session?.parsedCounts?.networkRequests ??
    state.manifest?.summary?.networkRequests ??
    entries.length;
  let visibleRows = 0;
  const selectedHidden =
    selectedNetworkId &&
    !filtered.some((entry) => entry.id === selectedNetworkId);
  if (networkSelectionNote) {
    networkSelectionNote.classList.toggle("hidden", !selectedHidden);
  }
  const maxRows = 500;
  let renderedEntries = 0;
  let truncated = false;
  const renderEntryRow = (entry, options = {}) => {
    const row = document.createElement("div");
    row.className = `data-row network-row${options.isChild ? " network-subrow" : ""}`;
    if (entry.id) {
      row.dataset.entryId = entry.id;
    }
    if (isNetworkFailureEntry(entry)) {
      const classification = classifyNetworkFailure(entry);
      if (classification.severity === "error") {
        row.classList.add("network-error");
      } else if (classification.severity === "warning") {
        row.classList.add("network-warning");
      }
    }
    if (selectedNetworkId && entry.id === selectedNetworkId) {
      row.classList.add("active");
    } else if (
      state.currentMoment?.autoHighlight?.networkId &&
      entry.id === state.currentMoment.autoHighlight.networkId
    ) {
      row.classList.add("nearby");
    }
    const time = document.createElement("div");
    time.className = "muted mono cell-time";
    const entryTime =
      typeof entry.endTimestampMs === "number"
        ? entry.endTimestampMs
        : typeof entry.timestampMs === "number"
          ? entry.timestampMs
          : entry.timestamp_ms || 0;
  const hasTimestamp =
    !entry.time_missing &&
    (Number.isFinite(entry.endTimestampMs) ||
      Number.isFinite(entry.timestampMs) ||
      Number.isFinite(entry.timestamp_ms));
  time.textContent = hasTimestamp ? formatTimeWithMs(entryTime) : "—";
    const method = document.createElement("div");
    method.className = "mono cell-method";
    method.textContent = (entry.method || "-").toUpperCase();
    const status = document.createElement("div");
    status.className = "mono cell-status";
    const statusValue = getNetworkStatusValue(entry);
    const statusLabel =
      statusValue ||
      (classifyNetworkStatus(entry) === "aborted" ? "aborted" : "-");
    status.textContent = statusLabel;
    const url = document.createElement("div");
    url.className = "mono cell-main";
    let urlText = entry.url || "";
    if (urlText) {
      try {
        const parsed = new URL(urlText);
        urlText = `${parsed.pathname}${parsed.search || ""}` || urlText;
      } catch (_) {
        // keep raw
      }
    }
    url.textContent = urlText || "-";
    row.appendChild(time);
    row.appendChild(method);
    row.appendChild(url);
    row.appendChild(status);
    row.addEventListener("click", () => {
      setFollowPlayhead(false, "incident-row");
      state.selectedNetworkId = entry.id;
      const linkedEvent = findEventForNetworkEntry(entry);
      state.playhead.selectedEventId = linkedEvent ? linkedEvent.id : null;
      setInspector("network", entry.id);
      if (hasTimestamp) {
        const delta = Math.abs(
          (state.playhead.currentTimeMs || 0) - entryTime
        );
        if (delta > 5) {
          seekTo(entryTime, "network-row", {
            selectedEventId: state.playhead.selectedEventId,
          });
        }
      }
      renderNetworkPanel();
    });
    networkList.appendChild(row);
    visibleRows += 1;
  };
  grouped.forEach((group) => {
    group.items.forEach((entry) => {
      if (entry.id) {
        groupIndex.set(entry.id, group.key);
      }
    });
    if (renderedEntries >= maxRows) {
      truncated = true;
      return;
    }
    if (group.items.length === 1) {
      renderEntryRow(group.items[0]);
      renderedEntries += 1;
      return;
    }
    const groupHasSelected =
      selectedNetworkId &&
      group.items.some((entry) => entry.id === selectedNetworkId);
    const groupHasNearby =
      state.currentMoment?.autoHighlight?.networkId &&
      group.items.some((entry) => entry.id === state.currentMoment.autoHighlight.networkId);
    const isExpanded = state.networkGroupExpanded.has(group.key);
    const canExpand = group.items.length > 1;
    const header = document.createElement("div");
    header.className = "data-row network-group";
    header.dataset.groupKey = group.key;
    if (group.items.some((entry) => classifyNetworkFailure(entry).severity === "error")) {
      header.classList.add("network-error");
    } else if (group.items.some((entry) => classifyNetworkFailure(entry).severity === "warning")) {
      header.classList.add("network-warning");
    }
    if (groupHasSelected) {
      header.classList.add("active");
    } else if (groupHasNearby) {
      header.classList.add("nearby");
    }
    const toggle = document.createElement("div");
    toggle.className = "network-group-toggle";
    toggle.textContent = canExpand ? (isExpanded ? "▾" : "▸") : "•";
    const status = document.createElement("div");
    status.className = "network-group-count";
    status.textContent = `x${group.items.length}`;
    const label = document.createElement("div");
    label.textContent = group.label;
    header.appendChild(toggle);
    header.appendChild(status);
    header.appendChild(label);
    if (canExpand) {
      header.addEventListener("click", () => {
        if (state.networkGroupExpanded.has(group.key)) {
          state.networkGroupExpanded.delete(group.key);
        } else {
          state.networkGroupExpanded.add(group.key);
        }
        renderNetworkPanel();
      });
    }
    networkList.appendChild(header);
    visibleRows += 1;
    if (isExpanded) {
      group.items.forEach((entry) => {
        if (renderedEntries >= maxRows) {
          truncated = true;
          return;
        }
        renderEntryRow(entry, { isChild: true });
        renderedEntries += 1;
      });
    } else if (group.items.length) {
      renderedEntries += Math.min(group.items.length, maxRows - renderedEntries);
      if (renderedEntries >= maxRows && group.items.length > 1) {
        truncated = true;
      }
    }
  });
  state.networkGroupIndex = groupIndex;
  if (networkResultCount) {
    const displayed = grouped.length;
    const modeLabel = state.panelModes.network === "near" ? "Near Time" : "All Time";
    const statusLabel =
      state.filters.networkStatusBucket === "errors"
        ? "Err"
        : state.filters.networkStatusBucket === "4xx"
          ? "4xx"
          : state.filters.networkStatusBucket === "5xx"
            ? "5xx"
            : "All";
    networkResultCount.textContent = `Filter: ${modeLabel} · ${statusLabel}\n${totalRequests} total · ${requestCount} filtered · ${displayed} displayed`;
  }
  if (DEBUG_ENABLED) {
    const debugCounts = getNetworkFilterDebugCounts(
      state.playhead.currentTimeMs || 0,
      state.playhead.timeWindowMs || 0
    );
    const rawTotal =
      state.session?.parsedCounts?.networkRequests ??
      state.manifest?.summary?.networkRequests ??
      null;
    console.log("[DebugDuck] Network filter counts", {
      rawTotal,
      normalizedCount: debugCounts.normalizedCount,
      timeFilteredCount: debugCounts.timeFilteredCount,
      searchFilteredCount: debugCounts.searchFilteredCount,
      statusFilteredCount: debugCounts.statusFilteredCount,
      groupedVisibleRows: visibleRows,
      filteredCount: requestCount,
      mode: debugCounts.mode,
      statusFilter: debugCounts.bucket,
      query: debugCounts.query,
      applyErrorOnly: debugCounts.applyErrorOnly,
      timeWindowMs: debugCounts.windowMs,
      activePanel: state.playhead.activePanel,
      groupingAppliedAfterFiltering: true,
    });
    if (
      debugCounts.mode === "all" &&
      debugCounts.bucket === "all" &&
      !debugCounts.query &&
      !debugCounts.applyErrorOnly &&
      debugCounts.statusFilteredCount !== debugCounts.normalizedCount
    ) {
      console.warn("[DebugDuck] Network All Time + All mismatch", {
        normalizedCount: debugCounts.normalizedCount,
        statusFilteredCount: debugCounts.statusFilteredCount,
      });
    }
  }
  if (filtered.length > maxRows || truncated) {
    const note = document.createElement("div");
    note.className = "muted";
    note.textContent = `Showing first ${maxRows} entries of ${filtered.length}.`;
    networkList.appendChild(note);
  }
  const activeRow = networkList.querySelector(".data-row.active");
  if (activeRow && !preserveScroll) {
    activeRow.scrollIntoView({ block: "nearest" });
  }
  if (preserveScroll) {
    const maxScroll = networkList.scrollHeight - networkList.clientHeight;
    networkList.scrollTop = Math.max(0, Math.min(previousScrollTop, maxScroll));
  }
  updateAutoHighlightRows();
}

function renderConsolePanel(options = {}) {
  if (!consoleList || !consoleEmpty) {
    return;
  }
  const preserveScroll = Boolean(options.preserveScroll);
  const previousScrollTop = preserveScroll ? consoleList.scrollTop : 0;
  if (isFailFastActive("console")) {
    consoleEmpty.classList.add("hidden");
    consoleFilteredEmpty?.classList.add("hidden");
    if (consoleResultCount) {
      consoleResultCount.textContent = "";
    }
    if (consoleSelectionNote) {
      consoleSelectionNote.classList.add("hidden");
    }
    renderIntegrityDisabled(
      consoleList,
      buildIntegrityDisabledMessage("console", "Console panel")
    );
    return;
  }
  const entries = state.consoleEntries || [];
  const filtered = getVisibleConsoleEvents();
  state.panelRenderKeys.console = buildListKey(filtered);
  updateNearTimeLabels({
    consoleCount: state.panelModes.console === "near" ? filtered.length : null,
  });
  consoleList.innerHTML = "";
  if (!entries.length) {
    consoleEmpty.classList.remove("hidden");
    consoleFilteredEmpty?.classList.add("hidden");
    if (consoleResultCount) {
      consoleResultCount.textContent = "";
    }
    if (consoleSelectionNote) {
      consoleSelectionNote.classList.add("hidden");
    }
    return;
  }
  if (state.selectedConsoleId && !entries.some((entry) => entry.id === state.selectedConsoleId)) {
    state.selectedConsoleId = null;
    state.playhead.selectedEventId = null;
  }
  consoleEmpty.classList.add("hidden");
  consoleFilteredEmpty?.classList.toggle("hidden", filtered.length > 0);
  if (consoleFilteredEmpty && filtered.length === 0 && state.panelModes.console === "near") {
    consoleFilteredEmpty.textContent = "No console entries near current time.";
  } else if (consoleFilteredEmpty) {
    consoleFilteredEmpty.textContent = "No console entries match current filter.";
  }
  if (consoleResultCount) {
    const resultLabel = filtered.length === 1 ? "result" : "results";
    consoleResultCount.textContent = `${filtered.length} ${resultLabel}`;
  }
  const selectedHidden =
    state.selectedConsoleId &&
    !filtered.some((entry) => entry.id === state.selectedConsoleId);
  if (consoleSelectionNote) {
    consoleSelectionNote.classList.toggle("hidden", !selectedHidden);
  }
  const maxRows = 500;
  const rows = filtered.slice(0, maxRows);
  rows.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "data-row console-row";
    if (entry.id) {
      row.dataset.entryId = entry.id;
    }
    if (state.selectedConsoleId && entry.id === state.selectedConsoleId) {
      row.classList.add("active");
    } else if (
      state.currentMoment?.autoHighlight?.consoleId &&
      entry.id === state.currentMoment.autoHighlight.consoleId
    ) {
      row.classList.add("nearby");
    }
    const time = document.createElement("div");
    time.className = "muted mono cell-time";
    const entryTime =
      typeof entry.timestamp_ms === "number"
        ? entry.timestamp_ms
        : entry.timestampMs || 0;
    const hasTimestamp =
      Number.isFinite(entry.timestamp_ms) || Number.isFinite(entry.timestampMs);
    time.textContent = formatTimeWithMs(entryTime);
    const level = document.createElement("div");
    level.className = "mono cell-level";
    const rawLevel = normalizeConsoleLevel(entry.level);
    const levelLabel =
      rawLevel === "error"
        ? "ERR"
        : rawLevel === "warning"
          ? "WARN"
          : rawLevel === "info"
            ? "INFO"
            : rawLevel === "debug"
              ? "DBG"
              : "LOG";
    level.textContent = levelLabel;
    const msg = document.createElement("div");
    msg.className = "cell-main";
    msg.textContent = entry.message || "";
    row.appendChild(time);
    row.appendChild(level);
    row.appendChild(msg);
    row.addEventListener("click", () => {
      setFollowPlayhead(false, "console-row");
      state.selectedConsoleId = entry.id;
      const linkedEvent = findEventForConsoleEntry(entry);
      state.playhead.selectedEventId = linkedEvent ? linkedEvent.id : null;
      setInspector("console", entry.id);
      if (hasTimestamp) {
        const delta = Math.abs(
          (state.playhead.currentTimeMs || 0) - entryTime
        );
        if (delta > 5) {
          seekTo(entryTime, "console-row", {
            selectedEventId: state.playhead.selectedEventId,
          });
        }
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
  if (activeRow && !preserveScroll) {
    activeRow.scrollIntoView({ block: "nearest" });
  }
  if (preserveScroll) {
    const maxScroll = consoleList.scrollHeight - consoleList.clientHeight;
    consoleList.scrollTop = Math.max(0, Math.min(previousScrollTop, maxScroll));
  }
  updateAutoHighlightRows();
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

async function loadNdjsonEntries(path) {
  const parseNdjson = (raw) => {
    let parseErrors = 0;
    const entries = raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, idx) => {
        try {
          return JSON.parse(line);
        } catch (error) {
          parseErrors += 1;
          console.warn("[DebugDuck] NDJSON parse skip", {
            path,
            line: idx + 1,
            error: error?.message || String(error),
          });
          return null;
        }
      })
      .filter(Boolean);
    return { entries, parseErrors };
  };

  if (!path) {
    return { entries: [], parseErrors: 0 };
  }

  if (state.pkg) {
    try {
      if (!state.pkg.exists(path)) {
        return { entries: [], parseErrors: 0 };
      }
      const raw = await state.pkg.readText(path);
      return parseNdjson(raw);
    } catch (error) {
      return { entries: [], parseErrors: 0 };
    }
  }

  return { entries: [], parseErrors: 0 };
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
  const sessionStartMs = (() => {
    const startedAt =
      state.manifest?.session?.startedAt ||
      state.manifest?.session?.createdAt ||
      state.sessionLog?.session?.startedAt ||
      state.sessionLog?.session?.started_at;
    if (!startedAt) {
      return null;
    }
    const parsed = Date.parse(startedAt);
    return Number.isFinite(parsed) ? parsed : null;
  })();
  const resolveEpochRelative = (epochValue) => {
    const epochMs = Number(epochValue);
    if (!Number.isFinite(epochMs) || epochMs <= 0) {
      return null;
    }
    if (sessionStartMs) {
      return Math.max(0, epochMs - sessionStartMs);
    }
    return 0;
  };
  const resolveIsoRelative = (isoValue) => {
    if (!isoValue) {
      return null;
    }
    const parsed = Date.parse(isoValue);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    if (sessionStartMs) {
      return Math.max(0, parsed - sessionStartMs);
    }
    return 0;
  };
  const startFallback =
    resolveEpochRelative(entry.timestamp_epoch_ms) ??
    resolveIsoRelative(entry.timestamp) ??
    0;
  const startMs =
    typeof entry.timestamp_ms === "number"
      ? entry.timestamp_ms
      : typeof entry.timestampMs === "number"
        ? entry.timestampMs
        : startFallback;
  const durationCandidate =
    entry.duration_ms ??
    entry.durationMs ??
    entry.total_time_ms ??
    entry.timing ??
    0;
  let durationMs = 0;
  if (typeof durationCandidate === "number" && Number.isFinite(durationCandidate)) {
    durationMs = durationCandidate;
  } else if (typeof durationCandidate === "string") {
    const parsed = Number(durationCandidate);
    if (Number.isFinite(parsed)) {
      durationMs = parsed;
    }
  } else if (durationCandidate && typeof durationCandidate === "object") {
    const timingValue =
      durationCandidate.total_time_ms ??
      durationCandidate.totalTimeMs ??
      durationCandidate.duration_ms ??
      durationCandidate.durationMs;
    const parsed = Number(timingValue);
    if (Number.isFinite(parsed)) {
      durationMs = parsed;
    }
  }
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
    time_missing: entry.time_missing ?? startFallback === 0,
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
    const { entries, parseErrors } = await loadNdjsonEntries(manifestPath);
    const totalNetworkEntries = entries.length;
    const totalNetworkFailures = countNetworkFailures(entries);
    const normalized = entries
      .map(normalizeNetworkEntry)
      .filter((entry) => {
        if (isValidTimestampMs(getNetworkTimestampMs(entry))) {
          return true;
        }
        const hasIdentity =
          Boolean(entry.id) ||
          Boolean(entry.request_id) ||
          Boolean(entry.url) ||
          Boolean(entry.method) ||
          Boolean(entry.error_text || entry.errorText) ||
          Boolean(entry.response_status || entry.status);
        if (hasIdentity) {
          entry.time_missing = true;
          entry.endTimestampMs = 0;
          entry.startTimestampMs = 0;
          entry.timestampMs = 0;
          return true;
        }
        return false;
      });
    normalized.sort((a, b) => getNetworkTimestampMs(a) - getNetworkTimestampMs(b));
    state.networkEntries = normalized;
    state.networkIndex = indexEntriesById(normalized);
    state.loadedArtifacts.network = true;
    if (state.session) {
      state.session.networkEvents = normalized;
      state.session.eventIndexes.networkById = state.networkIndex;
      state.session.artifactPresence.network = normalized.length > 0;
      if (!state.session.parsedCounts) {
        state.session.parsedCounts = {};
      }
      state.session.parsedCounts.networkRequests = totalNetworkEntries;
      state.session.parsedCounts.networkFailures = totalNetworkFailures;
      if (!state.session.parseWarnings) {
        state.session.parseWarnings = { network: 0, console: 0, total: 0 };
      }
      state.session.parseWarnings.network = parseErrors;
      state.session.parseWarnings.total =
        state.session.parseWarnings.network + state.session.parseWarnings.console;
      rebuildTimelineMarkers();
      renderTimelineMarkers();
      renderTimelineLanes(state.session?.markers || []);
      updateIntegrityReport();
    }
    setIncidents(mergeIncidents(
      state.incidents,
      buildIncidentsFromNetwork(normalized)
    ));
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
    const { entries, parseErrors } = await loadNdjsonEntries(manifestPath);
    const totalConsoleEntries = entries.length;
    const totalConsoleErrors = countConsoleErrors(entries);
    const normalized = entries
      .map(normalizeConsoleEntry)
      .filter((entry) => isValidTimestampMs(entry.timestampMs || 0));
    normalized.sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0));
    state.consoleEntries = normalized;
    state.consoleIndex = indexEntriesById(normalized);
    state.loadedArtifacts.console = true;
    if (state.session) {
      state.session.consoleEvents = normalized;
      state.session.eventIndexes.consoleById = state.consoleIndex;
      state.session.artifactPresence.console = normalized.length > 0;
      if (!state.session.parsedCounts) {
        state.session.parsedCounts = {};
      }
      state.session.parsedCounts.consoleMessages = totalConsoleEntries;
      state.session.parsedCounts.consoleErrors = totalConsoleErrors;
      if (!state.session.parseWarnings) {
        state.session.parseWarnings = { network: 0, console: 0, total: 0 };
      }
      state.session.parseWarnings.console = parseErrors;
      state.session.parseWarnings.total =
        state.session.parseWarnings.network + state.session.parseWarnings.console;
      rebuildTimelineMarkers();
      renderTimelineMarkers();
      renderTimelineLanes(state.session?.markers || []);
      updateIntegrityReport();
    }
    setIncidents(mergeIncidents(
      state.incidents,
      buildIncidentsFromConsole(normalized)
    ));
    renderIncidentRail();
  } catch (error) {
    state.consoleIndex = new Map();
    state.consoleEntries = [];
  } finally {
    state.loadingConsole = false;
  }
}

async function ensureVideoLoaded() {
  debugLog("[DD Video] ensureVideoLoaded called");
  debugLog(
    "[DD Video] manifest recording path:",
    state.manifest?.artifacts?.recording?.path
  );
  if (!state.manifest?.artifacts?.recording?.present) {
    state.videoMissing = true;
    state.videoSyncAvailable = false;
    return false;
  }
  if (state.loadedArtifacts.recording && state.videoUrl) {
    return true;
  }
  if (state.pkg) {
    const file = resolveRecordingFromPackage(state.pkg, state.manifest);
    if (!file) {
      if (!state.videoMissing) {
        showError(
          "Recording artifact declared but file not found in package.",
          true
        );
      }
      state.videoMissing = true;
      state.videoSyncAvailable = false;
      return false;
    }
    const blob = await state.pkg.readBlob(file.path || "");
    if (!blob) {
      state.videoMissing = true;
      state.videoSyncAvailable = false;
      return false;
    }
    if (state.videoUrl) {
      URL.revokeObjectURL(state.videoUrl);
    }
    state.videoUrl = URL.createObjectURL(blob);
    videoEl.src = state.videoUrl;
    videoPanel.classList.remove("hidden");
    logLayoutMetrics("video:src-set");
    state.loadedArtifacts.recording = true;
    state.videoMissing = false;
    if (state.session) {
      state.session.recordingBlob = blob;
      state.session.recordingUrl = state.videoUrl;
      state.session.artifactPresence.recording = true;
    }
    attachVideoDurationReconciliation();
    return true;
  }
  return false;
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

function renderTimelineLanes(markers) {
  if (!timelineLanes) {
    return;
  }
  const availability = getIntegrityAvailability();
  if (availability && availability.timeline === false) {
    const tracks = Array.from(timelineLanes.querySelectorAll(".lane-track"));
    tracks.forEach((track) => {
      track.innerHTML = "";
    });
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
  const list = Array.isArray(markers)
    ? markers.filter((marker) => isMarkerAvailable(marker, availability))
    : [];
  const screenshots = list.filter((marker) => marker.type === "screenshot");
  const networkErrors = list.filter((marker) => marker.type === "network-failure");
  const consoleErrors = list.filter((marker) => marker.type === "console-error");
  const markerEvents = list.filter((marker) => marker.type === "incident");
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
    items.forEach((marker) => {
      if (state.filters.errorOnly && marker.severity !== "error") {
        return;
      }
      const markerEl = document.createElement("div");
      markerEl.className = "lane-marker";
      markerEl.classList.add(laneName === "markers" ? "marker" : laneName);
      if (marker.severity) {
        markerEl.classList.add(marker.severity);
      }
      const left = (marker.timeMs / duration) * 100;
      markerEl.style.left = `${left}%`;
      markerEl.title = marker.label || "";
      if (
        marker.type === "incident" &&
        state.playhead.selectedIncidentId === marker.sourceRef
      ) {
        markerEl.classList.add("selected");
      }
      if (
        marker.type === "screenshot" &&
        state.playhead.selectedScreenshotId === marker.sourceRef
      ) {
        markerEl.classList.add("selected");
      }
      const nearestMarkerId = state.playhead.nearestMarkerId;
      if (nearestMarkerId && marker.id === nearestMarkerId) {
        markerEl.classList.add("nearest");
      }
      const now = Date.now();
      if (
        state.snapPulse.id &&
        now < state.snapPulse.untilMs &&
        marker.id === state.snapPulse.id
      ) {
        markerEl.classList.add("pulse");
      } else if (state.snapPulse.id && now >= state.snapPulse.untilMs) {
        state.snapPulse.id = null;
      }
      markerEl.addEventListener("click", () => jumpToMarker(marker));
      track.appendChild(markerEl);
    });
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
    if (!isEventAvailable(ev)) {
      return false;
    }
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

let lastAutoScrollEventId = null;

function revealActiveEventRow(options = {}) {
  if (!eventList) {
    return;
  }
  const active = eventList.querySelector(".event-item.active");
  if (!active) {
    return;
  }
  const eventId = active.dataset.eventId || null;
  if (!options.force && eventId && eventId === lastAutoScrollEventId) {
    return;
  }
  active.scrollIntoView({
    block: "nearest",
    inline: "nearest",
    behavior: options.behavior || "smooth",
  });
  if (eventId) {
    lastAutoScrollEventId = eventId;
  }
}

function afterSelectionOrSeek(source) {
  if (source === "video") {
    return;
  }
  requestAnimationFrame(() => {
    revealActiveEventRow({ force: true, behavior: "smooth" });
  });
}

function renderEventList() {
  eventList.innerHTML = "";
  if (isFailFastActive("timeline")) {
    renderIntegrityDisabled(
      eventList,
      buildIntegrityDisabledMessage("timeline", "Timeline events")
    );
    if (detailsBody) {
      detailsBody.textContent = buildIntegrityDisabledMessage(
        "timeline",
        "Event details"
      );
    }
    return;
  }
  if (!state.filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state muted";
    empty.textContent = "No matching events.";
    eventList.appendChild(empty);
    return;
  }
  state.filtered.forEach((ev, index) => {
    const item = document.createElement("div");
    item.className = "event-item";
    item.dataset.index = String(index);
    item.dataset.eventId = ev.id;
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
  if (!detailsBody) {
    return;
  }
  if (
    state.playhead.activePanel === "network" ||
    state.playhead.activePanel === "console" ||
    state.playhead.activePanel === "errors"
  ) {
    return;
  }
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

const INSPECTOR_PREVIEW_LIMIT = 1200;
const INSPECTOR_SUMMARY_LIMIT = 240;
const INSPECTOR_PREVIEW_DEPTH = 2;
const INSPECTOR_PREVIEW_ENTRIES = 6;

function truncateText(value, maxLength = 1200) {
  if (typeof value !== "string") {
    return { text: String(value ?? ""), truncated: false };
  }
  if (value.length <= maxLength) {
    return { text: value, truncated: false };
  }
  return { text: value.slice(0, maxLength), truncated: true };
}

function getInspectorKey(type, id) {
  if (!type || !id) {
    return null;
  }
  return `${type}:${id}`;
}

function hasInspectorValue(value) {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }
  return true;
}

function formatDurationValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${Math.round(value)}ms`;
  }
  if (value || value === 0) {
    return String(value);
  }
  return "-";
}

function formatHeadersPreview(value) {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item) {
          return "";
        }
        if (Array.isArray(item)) {
          return `${item[0]}: ${item[1] ?? ""}`.trim();
        }
        if (typeof item === "object") {
          const key = item.name || item.key || item.header || "";
          const val = item.value ?? item.val ?? "";
          if (key) {
            return `${key}: ${val}`.trim();
          }
        }
        return String(item);
      })
      .filter(Boolean)
      .join("\n");
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, val]) => `${key}: ${val ?? ""}`.trim())
      .join("\n");
  }
  return String(value);
}

function buildInspectorPreviewValue(value, depth = INSPECTOR_PREVIEW_DEPTH) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (depth <= 0) {
    return Array.isArray(value) ? "[…]" : "{…}";
  }
  if (Array.isArray(value)) {
    const items = value.slice(0, INSPECTOR_PREVIEW_ENTRIES);
    const preview = items
      .map((item) => buildInspectorPreviewValue(item, depth - 1))
      .join(", ");
    return `[${preview}${value.length > INSPECTOR_PREVIEW_ENTRIES ? ", …" : ""}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    const items = keys.slice(0, INSPECTOR_PREVIEW_ENTRIES);
    const preview = items
      .map((key) => `${key}: ${buildInspectorPreviewValue(value[key], depth - 1)}`)
      .join(", ");
    return `{ ${preview}${keys.length > INSPECTOR_PREVIEW_ENTRIES ? ", …" : ""} }`;
  }
  return String(value);
}

function buildInspectorPreview(value, previewLimit, previewValue) {
  if (!hasInspectorValue(value)) {
    return { text: "", truncated: false, expandable: false };
  }
  const rawPreview =
    typeof previewValue === "function"
      ? previewValue(value)
      : buildInspectorPreviewValue(value);
  const truncated = truncateText(rawPreview, previewLimit);
  const expandable =
    typeof value === "object" || truncated.truncated || rawPreview.length > previewLimit;
  return { text: truncated.text, truncated: truncated.truncated, expandable };
}

function createInspectorRow(label, value, options = {}) {
  const row = document.createElement("div");
  row.className = "inspector-row";
  if (options.muted) {
    row.classList.add("muted");
  }
  const key = document.createElement("span");
  key.className = "inspector-key";
  key.textContent = label;
  const val = document.createElement("span");
  val.className = "inspector-value";
  if (options.align) {
    val.style.textAlign = options.align;
  }
  if (options.mono) {
    val.classList.add("mono");
  }
  const emptyLabel = options.emptyLabel || "Not available";
  val.textContent = value || value === 0 ? String(value) : emptyLabel;
  row.appendChild(key);
  row.appendChild(val);
  return row;
}

function createInspectorHeadline(text) {
  const headline = document.createElement("div");
  headline.className = "inspector-headline";
  const strong = document.createElement("strong");
  strong.textContent = text;
  headline.appendChild(strong);
  return headline;
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

function createCopyButton(label, text, options = {}) {
  const button = document.createElement("button");
  const iconOnly = options.iconOnly !== false;
  const tooltip = options.tooltip || label;
  const ariaLabel = options.ariaLabel || tooltip;
  button.type = "button";
  button.className = iconOnly ? "icon-button copy-button" : "copy-button";
  button.setAttribute("title", tooltip);
  button.setAttribute("aria-label", ariaLabel);
  if (iconOnly) {
    const icon = document.createElement("span");
    icon.className = "copy-icon";
    icon.textContent = "⧉";
    const srText = document.createElement("span");
    srText.className = "sr-only";
    srText.textContent = ariaLabel;
    button.appendChild(icon);
    button.appendChild(srText);
  } else {
    button.textContent = label;
  }
  const setStatus = (status) => {
    if (iconOnly) {
      button.dataset.status = status;
      button.setAttribute("title", status);
      button.setAttribute("aria-label", status);
    } else {
      button.textContent = status;
    }
  };
  const enabled =
    typeof text === "function" ? true : text !== null && text !== undefined && text !== "";
  if (!enabled) {
    button.disabled = true;
  }
  button.addEventListener("click", async () => {
    const resolved =
      typeof text === "function"
        ? text()
        : text;
    if (!resolved) {
      setStatus("Nothing to copy");
      setTimeout(() => {
        setStatus(tooltip);
      }, 1500);
      return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(resolved);
      } else {
        const helper = document.createElement("textarea");
        helper.value = resolved;
        helper.style.position = "fixed";
        helper.style.opacity = "0";
        document.body.appendChild(helper);
        helper.select();
        document.execCommand("copy");
        document.body.removeChild(helper);
      }
      setStatus("Copied");
      setTimeout(() => {
        setStatus(tooltip);
      }, 1500);
    } catch (error) {
      setStatus("Copy failed");
      setTimeout(() => {
        setStatus(tooltip);
      }, 1500);
    }
  });
  return button;
}

function renderExpandableSection(title, value, copyLabel, options = {}) {
  const section = document.createElement("div");
  section.className = "inspector-section";
  const headerRow = document.createElement("div");
  headerRow.className = "inspector-section-header";
  const header = document.createElement("h3");
  header.textContent = title;
  headerRow.appendChild(header);
  section.appendChild(headerRow);
  if (!hasInspectorValue(value)) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = options.emptyLabel || "Not available.";
    section.appendChild(empty);
    return section;
  }
  const sectionId = options.sectionId || title;
  const previewLimit = options.previewLimit || INSPECTOR_PREVIEW_LIMIT;
  const preview = buildInspectorPreview(value, previewLimit, options.previewValue);
  const code = document.createElement("div");
  code.className = "code-block";
  const isExpanded = Boolean(state.inspector.expandState[sectionId]);
  code.textContent = isExpanded
    ? normalizeInspectorValue(value)
    : preview.text;
  code.classList.toggle("expanded", isExpanded);
  section.appendChild(code);
  if (options.showCopy !== false) {
    const copyActionLabel = copyLabel || `Copy ${title}`;
    headerRow.appendChild(
      createCopyButton("Copy", () => normalizeInspectorValue(value), {
        tooltip: "Copy",
        ariaLabel: copyActionLabel,
      })
    );
  }
  if (preview.expandable && options.showExpand !== false) {
    const actions = document.createElement("div");
    actions.className = "inspector-actions";
    const expandBtn = document.createElement("button");
    expandBtn.type = "button";
    expandBtn.className = "expand-toggle";
    expandBtn.textContent = isExpanded ? "Show less" : "Show full";
    expandBtn.addEventListener("click", () => {
      const expanded = !state.inspector.expandState[sectionId];
      state.inspector.expandState[sectionId] = expanded;
      expandBtn.textContent = expanded ? "Show less" : "Show full";
      code.textContent = expanded
        ? normalizeInspectorValue(value)
        : preview.text;
      code.classList.toggle("expanded", expanded);
    });
    actions.appendChild(expandBtn);
    section.appendChild(actions);
  }
  return section;
}

function renderInspectorTabs(type, tabs) {
  const wrapper = document.createElement("div");
  wrapper.className = "inspector-tabs";
  const active = state.inspector.activeTabs?.[type] || tabs[0];
  tabs.forEach((tab) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "inspector-tab";
    button.textContent = tab;
    button.classList.toggle("active", tab === active);
    button.addEventListener("click", () => {
      if (!state.inspector.activeTabs) {
        state.inspector.activeTabs = {};
      }
      state.inspector.activeTabs[type] = tab;
      renderInspector();
    });
    wrapper.appendChild(button);
  });
  return wrapper;
}

function getActiveInspectorTab(type, fallback) {
  const active = state.inspector.activeTabs?.[type] || fallback;
  return active;
}

function setInspector(type, id) {
  const nextKey = getInspectorKey(type, id);
  if (state.inspector.lastKey !== nextKey) {
    state.inspector.expandState = {};
    state.inspector.lastKey = nextKey;
  }
  state.inspector.type = type;
  state.inspector.id = id;
  renderInspector();
}

function renderInspector() {
  if (!inspectorBody || !inspectorTitle || !inspectorPanel) {
    return;
  }
  inspectorBody.innerHTML = "";
  const { type, id } = state.inspector;
  const activePanel = state.playhead.activePanel;
  const inspectorVisible =
    activePanel === "network" || activePanel === "console" || activePanel === "errors";
  const workspace =
    inspectorPanel.closest(".panel-group")?.querySelector(".event-workspace") || null;
  const setCollapsed = (value) => {
    if (workspace) {
      workspace.classList.toggle("details-collapsed", value);
    }
  };
  if (!inspectorVisible) {
    inspectorPanel.classList.add("hidden");
    setCollapsed(false);
    return;
  }
  inspectorPanel.classList.remove("hidden");
  if (activePanel === "network" && type && type !== "network") {
    inspectorTitle.textContent = "Details";
    inspectorBody.textContent = "Select an item";
    setCollapsed(true);
    return;
  }
  if (activePanel === "console" && type && type !== "console") {
    inspectorTitle.textContent = "Details";
    inspectorBody.textContent = "Select an item";
    setCollapsed(true);
    return;
  }
  if (activePanel === "errors" && type && type !== "incident") {
    inspectorTitle.textContent = "Details";
    inspectorBody.textContent = "Select an item";
    setCollapsed(true);
    return;
  }
  if (!type || !id) {
    inspectorTitle.textContent = "Details";
    inspectorBody.textContent = "Select an item";
    inspectorBody.classList.add("muted");
    setCollapsed(true);
    return;
  }
  const scope =
    type === "network"
      ? "network"
      : type === "console"
        ? "console"
        : type === "screenshot"
          ? "screenshots"
          : type === "incident"
            ? "incidents"
            : "global";
  if (isFailFastActive(scope)) {
    inspectorTitle.textContent = "Details unavailable";
    inspectorBody.textContent = buildIntegrityDisabledMessage(scope, "Details");
    inspectorBody.classList.add("muted");
    setCollapsed(true);
    return;
  }
  setCollapsed(false);
  inspectorBody.classList.remove("muted");
  if (type === "network") {
    const entry = state.networkIndex?.get(id) || state.networkEntries.find((item) => item.id === id);
    inspectorTitle.textContent = "Details";
    if (!entry) {
      const hasNetwork = Boolean(state.manifest?.artifacts?.network?.present);
      if (hasNetwork && !state.loadedArtifacts.network) {
        const loading = document.createElement("div");
        loading.className = "muted";
        loading.textContent = state.loadingNetwork
          ? "Loading network logs…"
          : "Loading network logs…";
        inspectorBody.appendChild(loading);
        ensureNetworkLogsLoaded().then(renderInspector);
        return;
      }
      inspectorBody.textContent = hasNetwork
        ? "Network entry not found."
        : "Network logs not available.";
      return;
    }
    const headlineText = `${entry.method || ""} ${entry.url || ""}`.trim();
    const methodText = entry.method || "Not available";
    const urlText = entry.url || "Not available";
    const statusValue = getNetworkStatusValue(entry);
    const statusText = statusValue || statusValue === 0 ? statusValue : "Not available";
    const durationText = formatDurationValue(
      entry.durationMs || entry.timing || entry.total_time_ms
    );
    const durationValue = durationText === "-" ? "Not available" : durationText;
    const entryTime = getNetworkTimestampMs(entry);
    const timeValue = Number.isFinite(entryTime)
      ? formatTimeWithMs(entryTime)
      : "Not available";
    const pathValue = (() => {
      if (!entry.url) {
        return "Not available";
      }
      try {
        const parsed = new URL(entry.url);
        return parsed.pathname || entry.url;
      } catch (_) {
        return entry.url;
      }
    })();
    const resourceType =
      entry.resource_type ||
      entry.resourceType ||
      entry.initiator_type ||
      entry.initiatorType ||
      "Not available";
    const fromCache =
      typeof entry.from_disk_cache === "boolean"
        ? entry.from_disk_cache
          ? "Yes"
          : "No"
        : "Not available";
    const fromServiceWorker =
      typeof entry.from_service_worker === "boolean"
        ? entry.from_service_worker
          ? "Yes"
          : "No"
        : "Not available";
    const header = document.createElement("div");
    header.className = "inspector-header-bar";
    const headerLeft = document.createElement("div");
    headerLeft.className = "inspector-header-left";
    const typeBadge = document.createElement("span");
    typeBadge.className = "inspector-badge";
    typeBadge.textContent = "Network";
    const statusBadge = document.createElement("span");
    statusBadge.className = "inspector-badge status mono";
    statusBadge.textContent = statusText;
    const title = document.createElement("div");
    title.className = "inspector-title";
    title.textContent = headlineText || "Network request";
    const meta = document.createElement("div");
    meta.className = "inspector-meta mono";
    meta.textContent = `${timeValue} • ${durationValue}`;
    headerLeft.appendChild(typeBadge);
    headerLeft.appendChild(statusBadge);
    headerLeft.appendChild(title);
    headerLeft.appendChild(meta);
    header.appendChild(headerLeft);
    inspectorBody.appendChild(header);
    const summaryGrid = document.createElement("div");
    summaryGrid.className = "inspector-summary-grid";
    summaryGrid.appendChild(createInspectorRow("Method", methodText, { muted: true, mono: true }));
    summaryGrid.appendChild(createInspectorRow("Status", statusText, { muted: true, mono: true }));
    summaryGrid.appendChild(createInspectorRow("Time", timeValue, { muted: true, mono: true }));
    summaryGrid.appendChild(createInspectorRow("Cache", fromCache, { muted: true }));
    summaryGrid.appendChild(createInspectorRow("Type", resourceType, { muted: true }));
    summaryGrid.appendChild(
      createInspectorRow("URL", urlText, { muted: true, align: "left", mono: true })
    );
    inspectorBody.appendChild(summaryGrid);
    const requestHeaders =
      entry.request_headers || entry.requestHeaders || entry.request_header;
    const responseHeaders =
      entry.response_headers || entry.responseHeaders || entry.response_header;
    const requestBody =
      entry.request_post_data ||
      entry.request_body ||
      entry.request_body_raw ||
      entry.requestBody;
    const responseBody =
      entry.response_body || entry.responseBody || entry.response_body_raw;
    const timing =
      entry.timing ||
      entry.timings ||
      entry.performance ||
      entry.request_timing ||
      entry.response_timing ||
      (entry.total_time_ms ? { total_time_ms: entry.total_time_ms } : null);
    const tabs = ["Overview", "Headers", "Request", "Response", "Raw"];
    inspectorBody.appendChild(renderInspectorTabs("network", tabs));
    const preferredTab = getActiveInspectorTab("network", "Overview");
    const activeTab = tabs.includes(preferredTab) ? preferredTab : "Overview";
    const tabBody = document.createElement("div");
    tabBody.className = "inspector-tab-body";
    if (activeTab === "Overview") {
      tabBody.appendChild(
        renderExpandableSection(
          "Request Summary",
          {
            method: methodText,
            url: urlText,
            status: statusText,
            time: timeValue,
            duration: durationValue,
          },
          "Copy request summary",
          { sectionId: "network-overview-request", showExpand: false }
        )
      );
      tabBody.appendChild(
        renderExpandableSection(
          "Response Summary",
          {
            status: statusText,
            resourceType,
            fromCache,
            fromServiceWorker,
          },
          "Copy response summary",
          { sectionId: "network-overview-response", showExpand: false }
        )
      );
      if (entry.error_text || entry.finalize_reason) {
        tabBody.appendChild(
          renderExpandableSection(
            "Error",
            {
              error_text: entry.error_text || null,
              finalize_reason: entry.finalize_reason || null,
            },
            "Copy error info",
            { sectionId: "network-overview-error", showExpand: false }
          )
        );
      }
      tabBody.appendChild(
        renderExpandableSection("Timing", timing, "Copy timing", {
          sectionId: "network-timing",
        })
      );
    } else if (activeTab === "Headers") {
      tabBody.appendChild(
        renderExpandableSection("Request Headers", requestHeaders, "Copy request headers", {
          sectionId: "network-request-headers",
          previewValue: formatHeadersPreview,
        })
      );
      tabBody.appendChild(
        renderExpandableSection("Response Headers", responseHeaders, "Copy response headers", {
          sectionId: "network-response-headers",
          previewValue: formatHeadersPreview,
        })
      );
    } else if (activeTab === "Request") {
      tabBody.appendChild(
        renderExpandableSection("Request Body", requestBody, "Copy request body", {
          sectionId: "network-request-body",
        })
      );
    } else if (activeTab === "Response") {
      tabBody.appendChild(
        renderExpandableSection("Response Body", responseBody, "Copy response body", {
          sectionId: "network-response-body",
        })
      );
    } else if (activeTab === "Raw") {
      tabBody.appendChild(
        renderExpandableSection("Raw JSON", entry, "Copy full JSON", {
          sectionId: "network-raw-entry",
        })
      );
    }
    inspectorBody.appendChild(tabBody);
    return;
  }
  if (type === "console") {
    const entry = state.consoleIndex?.get(id) || state.consoleEntries.find((item) => item.id === id);
    inspectorTitle.textContent = "Details";
    if (!entry) {
      const hasConsole = Boolean(state.manifest?.artifacts?.console?.present);
      if (hasConsole && !state.loadedArtifacts.console) {
        const loading = document.createElement("div");
        loading.className = "muted";
        loading.textContent = state.loadingConsole
          ? "Loading console logs…"
          : "Loading console logs…";
        inspectorBody.appendChild(loading);
        ensureConsoleLogsLoaded().then(renderInspector);
        return;
      }
      inspectorBody.textContent = hasConsole
        ? "Console entry not found."
        : "Console logs not available.";
      return;
    }
    const message =
      entry.message || entry.msg || entry.text || entry.description || "";
    const summaryMessage = truncateText(message, INSPECTOR_SUMMARY_LIMIT).text;
    const levelLabel = (entry.level || "log").toUpperCase();
    const payload =
      entry.payload ||
      entry.args ||
      entry.data ||
      entry.context ||
      entry.params ||
      entry.details;
    const source =
      entry.source ||
      entry.location ||
      (entry.url && entry.line
        ? `${entry.url}:${entry.line}${entry.column ? `:${entry.column}` : ""}`
        : entry.url) ||
      entry.file ||
      "";
    const messageLine =
      summaryMessage || message || "Not available";
    const header = document.createElement("div");
    header.className = "inspector-header-bar";
    const headerLeft = document.createElement("div");
    headerLeft.className = "inspector-header-left";
    const typeBadge = document.createElement("span");
    typeBadge.className = "inspector-badge";
    typeBadge.textContent = "Console";
    const levelBadge = document.createElement("span");
    levelBadge.className = "inspector-badge level mono";
    levelBadge.textContent = levelLabel;
    const title = document.createElement("div");
    title.className = "inspector-title";
    title.textContent = messageLine;
    const meta = document.createElement("div");
    meta.className = "inspector-meta mono";
    meta.textContent = `${formatTimeWithMs(entry.timestampMs || 0)} • ${
      source || "Not available"
    }`;
    headerLeft.appendChild(typeBadge);
    headerLeft.appendChild(levelBadge);
    headerLeft.appendChild(title);
    headerLeft.appendChild(meta);
    header.appendChild(headerLeft);
    inspectorBody.appendChild(header);
    const summaryGrid = document.createElement("div");
    summaryGrid.className = "inspector-summary-grid";
    summaryGrid.appendChild(createInspectorRow("Level", levelLabel, { muted: true, mono: true }));
    summaryGrid.appendChild(
      createInspectorRow("Time", formatTimeWithMs(entry.timestampMs || 0), {
        muted: true,
        mono: true,
      })
    );
    summaryGrid.appendChild(
      createInspectorRow("Source", source || "Not available", {
        muted: true,
        align: "left",
        mono: true,
      })
    );
    summaryGrid.appendChild(
      createInspectorRow("Message Length", message ? message.length : "Not available", {
        muted: true,
      })
    );
    inspectorBody.appendChild(summaryGrid);
    const tabs = ["Overview", "Stack", "Payload", "Raw"];
    inspectorBody.appendChild(renderInspectorTabs("console", tabs));
    const activeTab = getActiveInspectorTab("console", "Overview");
    const tabBody = document.createElement("div");
    tabBody.className = "inspector-tab-body";
    if (activeTab === "Overview") {
      tabBody.appendChild(
        renderExpandableSection("Message", message || "", "Copy message", {
          sectionId: "console-message",
          emptyLabel: "Not available",
          showExpand: false,
        })
      );
      tabBody.appendChild(
        renderExpandableSection("Source", source || "", "Copy source", {
          sectionId: "console-source",
          emptyLabel: "Not available",
          showExpand: false,
        })
      );
      const stackPreview = entry.stack
        ? String(entry.stack).split("\n").slice(0, 3).join("\n")
        : "";
      tabBody.appendChild(
        renderExpandableSection("Stack Preview", stackPreview, "Copy stack", {
          sectionId: "console-stack-preview",
          emptyLabel: "Not available",
          showExpand: false,
        })
      );
    } else if (activeTab === "Stack") {
      tabBody.appendChild(
        renderExpandableSection("Stack Trace", entry.stack, "Copy stack", {
          sectionId: "console-stack",
        })
      );
    } else if (activeTab === "Payload") {
      tabBody.appendChild(
        renderExpandableSection("Payload", payload, "Copy payload", {
          sectionId: "console-payload",
        })
      );
    } else if (activeTab === "Raw") {
      tabBody.appendChild(
        renderExpandableSection("Raw JSON", entry, "Copy full JSON", {
          sectionId: "console-raw-entry",
        })
      );
    }
    inspectorBody.appendChild(tabBody);
    return;
  }
  if (type === "screenshot") {
    const shot = state.screenshotById.get(id);
    inspectorTitle.textContent = "Details";
    if (!shot) {
      inspectorBody.textContent = "Screenshot not found.";
      return;
    }
    const preview = document.createElement("div");
    preview.className = "inspector-preview";
    const baseName = shot.path ? shot.path.split("/").pop() : null;
    if (baseName && state.screenshotUrls.has(baseName)) {
      const img = document.createElement("img");
      img.src = state.screenshotUrls.get(baseName);
      img.alt = shot.label || "Screenshot preview";
      preview.appendChild(img);
    } else {
      const message = document.createElement("div");
      message.className = "muted";
      const hasScreenshotsLoaded =
        state.screenshotUrls.size > 0 || state.missingScreenshots.length > 0;
      if (!hasScreenshotsLoaded) {
        message.textContent = "Loading preview…";
      } else if (baseName && state.missingScreenshots.includes(baseName)) {
        message.textContent = "Preview missing from package.";
      } else {
        message.textContent = "Preview unavailable.";
      }
      preview.appendChild(message);
    }
    inspectorBody.appendChild(preview);
    const meta = document.createElement("div");
    meta.className = "inspector-section inspector-summary";
    meta.appendChild(
      createInspectorHeadline(shot.label || "Screenshot capture")
    );
    meta.appendChild(
      createInspectorRow("Time", formatTimeWithMs(shot.timestampMs || 0), {
        muted: true,
        mono: true,
      })
    );
    meta.appendChild(createInspectorRow("Kind", shot.kind || "-", { muted: true }));
    meta.appendChild(
      createInspectorRow("Label", shot.label || "-", { muted: true, align: "left" })
    );
    if (shot.path) {
      meta.appendChild(
        createInspectorRow("Path", shot.path, { muted: true, align: "left", mono: true })
      );
    }
    inspectorBody.appendChild(meta);
    const actions = document.createElement("div");
    actions.className = "inspector-actions";
    actions.appendChild(
      createCopyButton("Copy metadata", () => normalizeInspectorValue(shot))
    );
    inspectorBody.appendChild(actions);
    return;
  }
  if (type === "incident") {
    const incident = state.incidents.find((item) => item.id === id);
    inspectorTitle.textContent = "Details";
    if (!incident) {
      inspectorBody.textContent = "Incident not found.";
      return;
    }
    const summary = document.createElement("div");
    summary.className = "inspector-section inspector-summary";
    summary.appendChild(
      createInspectorHeadline(buildIncidentTitle(incident))
    );
    summary.appendChild(
      createInspectorRow("Severity", incident.severity || "-", { muted: true })
    );
    summary.appendChild(
      createInspectorRow("Time", formatTimeWithMs(incident.timestampMs || 0), {
        muted: true,
        mono: true,
      })
    );
    summary.appendChild(
      createInspectorRow("Type", incident.type || "-", { muted: true })
    );
    if (incident.url) {
      summary.appendChild(
        createInspectorRow("URL", incident.url, { muted: true, align: "left", mono: true })
      );
    }
    inspectorBody.appendChild(summary);
    inspectorBody.appendChild(
      renderExpandableSection("Raw Incident", incident, "Copy raw incident", {
        sectionId: "incident-raw-entry",
      })
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
  attachInspectorDock(panel);
  if (panel === "errors") {
    renderIncidentRail();
  }
  renderInspector();
}

function attachInspectorDock(panel) {
  if (!inspectorPanel) {
    return;
  }
  if (panel === "network" && inspectorDockNetwork) {
    inspectorDockNetwork.appendChild(inspectorPanel);
    inspectorPanel.classList.remove("hidden");
    return;
  }
  if (panel === "console" && inspectorDockConsole) {
    inspectorDockConsole.appendChild(inspectorPanel);
    inspectorPanel.classList.remove("hidden");
    return;
  }
  if (panel === "errors" && inspectorDockErrors) {
    inspectorDockErrors.appendChild(inspectorPanel);
    inspectorPanel.classList.remove("hidden");
    return;
  }
  inspectorPanel.classList.add("hidden");
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
  setFollowPlayhead(false, "event-select");
  const panel = mapEventToPanel(ev);
  const scope =
    panel === "screenshots"
      ? "screenshots"
      : panel === "network"
        ? "network"
        : panel === "console"
          ? "console"
          : "timeline";
  if (isFailFastActive(scope)) {
    return;
  }
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
  const stayInErrors = source === "errors-panel";
  if (!stayInErrors) {
    setFollowPlayhead(false, "incident-select");
  }
  const scope =
    incident.panelTarget === "network"
      ? "network"
      : incident.panelTarget === "console"
        ? "console"
        : "timeline";
  if (isFailFastActive(scope)) {
    return;
  }
  const eventMatch = state.events.find(
    (ev) =>
      ev.id === incident.sourceRef ||
      (ev.refs?.ref && ev.refs.ref === incident.sourceRef)
  );
  const nextPanel = stayInErrors ? "errors" : incident.panelTarget;
  seekTo(incident.timestampMs || 0, source, {
    activePanel: nextPanel,
    selectedIncidentId: incident.id,
    selectedEventId: eventMatch ? eventMatch.id : state.playhead.selectedEventId,
  });
  setInspector("incident", incident.id);
  if (incident.panelTarget === "network") {
    state.selectedNetworkId = incident.sourceRef;
    if (!stayInErrors) {
      setActivePanel("network");
      ensureNetworkLogsLoaded().then(renderNetworkPanel);
    }
  } else if (incident.panelTarget === "console") {
    state.selectedConsoleId = incident.sourceRef;
    if (!stayInErrors) {
      setActivePanel("console");
      ensureConsoleLogsLoaded().then(renderConsolePanel);
    }
  } else if (!stayInErrors) {
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
  if (state.playhead.isSeeking) {
    return;
  }
  const tms = Math.floor((videoEl.currentTime || 0) * 1000);
  const now = Date.now();
  const shouldRefresh =
    state.playhead.followPlayhead && now - lastVideoSyncAt > 250;
  if (shouldRefresh) {
    logLayoutMetrics("playback:tick");
  }
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
    logLayoutMetrics("playback:start");
    seekTo(state.playhead.currentTimeMs, source, { refresh: false });
  } else {
    videoEl.pause();
    setPlayState(false);
    logLayoutMetrics("playback:pause");
  }
}

function setCurrentTms(tms, snap = true) {
  const source = state.playhead.isSeeking ? "timeline-drag" : "timeline-click";
  seekTo(tms, source, {
    snap: state.playhead.isSeeking,
    snapThresholdMs: MARKER_SNAP_THRESHOLD_MS,
    nearestEvent: true,
  });
}

function setFollowPlayhead(enabled, reason = "manual") {
  state.playhead.followPlayhead = enabled;
  if (followPlayheadToggle) {
    followPlayheadToggle.checked = enabled;
  }
  if (!enabled && reason) {
    state.playhead.lastSeekSource = reason;
  }
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

function resolveMarkerSelection(marker) {
  const session = state.session;
  if (!session) {
    return { event: null, selection: {} };
  }
  let event = null;
  if (marker.sourceRef && session.eventIndexes.eventByRef.has(marker.sourceRef)) {
    event = session.eventIndexes.eventByRef.get(marker.sourceRef);
  } else if (marker.sourceRef && session.eventIndexes.eventById.has(marker.sourceRef)) {
    event = session.eventIndexes.eventById.get(marker.sourceRef);
  }
  const selection = {};
  if (marker.type === "incident") {
    selection.selectedIncidentId = marker.sourceRef || null;
  }
  if (marker.type === "screenshot") {
    selection.selectedScreenshotId = marker.sourceRef || null;
  }
  if (marker.type === "network-failure") {
    state.selectedNetworkId = marker.sourceRef || null;
  }
  if (marker.type === "console-error") {
    state.selectedConsoleId = marker.sourceRef || null;
  }
  if (event) {
    selection.selectedEventId = event.id;
  }
  return { event, selection };
}

function mapMarkerToPanel(marker) {
  if (marker.type === "screenshot") {
    return "screenshots";
  }
  if (marker.type === "network-failure") {
    return "network";
  }
  if (marker.type === "console-error") {
    return "console";
  }
  if (marker.type === "incident") {
    return "errors";
  }
  return "timeline";
}

function jumpToMarker(marker) {
  if (!marker) {
    return;
  }
  const panel = mapMarkerToPanel(marker);
  const scope =
    panel === "screenshots"
      ? "screenshots"
      : panel === "network"
        ? "network"
        : panel === "console"
          ? "console"
          : panel === "errors"
            ? "incidents"
            : "timeline";
  if (isFailFastActive(scope)) {
    return;
  }
  const resolved = resolveMarkerSelection(marker);
  seekTo(marker.timeMs || 0, "marker-click", {
    activePanel: panel,
    ...resolved.selection,
  });
  if (marker.type === "screenshot" && resolved.selection.selectedScreenshotId) {
    setInspector("screenshot", resolved.selection.selectedScreenshotId);
  } else if (marker.type === "network-failure" && state.selectedNetworkId) {
    setInspector("network", state.selectedNetworkId);
  } else if (marker.type === "console-error" && state.selectedConsoleId) {
    setInspector("console", state.selectedConsoleId);
  } else if (marker.type === "incident" && resolved.selection.selectedIncidentId) {
    setInspector("incident", resolved.selection.selectedIncidentId);
  }
  if (resolved.event) {
    renderDetails(resolved.event);
  }
  if (panel === "screenshots") {
    renderScreenshotsPanel();
  } else if (panel === "network") {
    renderNetworkPanel();
  } else if (panel === "console") {
    renderConsolePanel();
  } else if (panel === "errors") {
    renderIncidentRail();
  }
}

function renderTimelineMarkers() {
  if (!timelineMarkers || !state.session) {
    return;
  }
  const availability = getIntegrityAvailability();
  if (availability && availability.timeline === false) {
    timelineMarkers.innerHTML = "";
    if (markerHover) {
      markerHover.classList.add("hidden");
    }
    return;
  }
  const markers = getImportantMarkers();
  const duration = state.playhead.durationMs || 0;
  if (!duration || !markers.length) {
    timelineMarkers.innerHTML = "";
    if (markerHover) {
      markerHover.classList.add("hidden");
    }
    return;
  }
  const markerById = new Map(markers.map((marker) => [marker.id, marker]));
  const version = String(state.session.markersVersion || 0);
  const durationKey = String(duration);
  const availabilityKey = JSON.stringify(availability || {});
  const needsRebuild =
    timelineMarkers.dataset.version !== version ||
    timelineMarkers.dataset.duration !== durationKey ||
    timelineMarkers.dataset.availability !== availabilityKey;
  if (needsRebuild) {
    timelineMarkers.innerHTML = "";
    markers.forEach((marker) => {
      const el = document.createElement("div");
      const markerClass =
        marker.type === "network-failure"
          ? "network"
          : marker.type === "console-error"
            ? "console"
            : marker.type;
      el.className = `timeline-marker ${markerClass}`;
      if (marker.severity) {
        el.classList.add(marker.severity);
      }
      el.dataset.markerId = marker.id;
      el.dataset.markerTime = String(marker.timeMs || 0);
      el.title = marker.label || "";
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        jumpToMarker(marker);
      });
      el.addEventListener("mouseenter", () => {
        if (!markerHover) {
          return;
        }
        markerHover.textContent = formatMarkerLabel(marker);
        markerHover.style.left = `${(marker.timeMs / duration) * 100}%`;
        markerHover.classList.remove("hidden");
      });
      el.addEventListener("mouseleave", () => {
        if (markerHover) {
          markerHover.classList.add("hidden");
        }
      });
      timelineMarkers.appendChild(el);
    });
    timelineMarkers.dataset.version = version;
    timelineMarkers.dataset.duration = durationKey;
    timelineMarkers.dataset.availability = availabilityKey;
  }
  const nearestId = state.playhead.nearestMarkerId;
  const now = Date.now();
  Array.from(timelineMarkers.children).forEach((child) => {
    const markerId = child.dataset.markerId;
    const marker = markerById.get(markerId);
    if (marker) {
      const isSelected =
        (marker.type === "incident" &&
          state.playhead.selectedIncidentId === marker.sourceRef) ||
        (marker.type === "screenshot" &&
          state.playhead.selectedScreenshotId === marker.sourceRef) ||
        (marker.type === "network-failure" &&
          state.selectedNetworkId === marker.sourceRef) ||
        (marker.type === "console-error" &&
          state.selectedConsoleId === marker.sourceRef);
      child.classList.toggle("selected", isSelected);
    }
    child.classList.toggle("nearest", Boolean(nearestId && markerId === nearestId));
    if (state.snapPulse.id && now < state.snapPulse.untilMs && markerId === state.snapPulse.id) {
      child.classList.add("pulse");
    } else {
      child.classList.remove("pulse");
    }
  });
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
  renderTimelineMarkers();
  renderTimelineLanes(state.session?.markers || []);
}

function buildPackageDiagnostics(pkg, manifest) {
  const entries = pkg ? pkg.list() : [];
  const keys = entries.map((entry) => entry.path || "");
  const recordingCandidates = entries.filter((entry) =>
    /\.webm$/i.test(entry.path || "")
  );
  const networkCandidates = keys.filter((key) => /network.*\.ndjson$/i.test(key));
  const consoleCandidates = keys.filter((key) => /console.*\.ndjson$/i.test(key));
  const screenshotCount = manifest?.artifacts?.screenshots?.items?.length || 0;
  const resolvedRecording = pkg && manifest ? resolveRecordingFromPackage(pkg, manifest) : null;
  const resolvedNetwork = pkg && manifest ? resolveNetworkLogFromPackage(pkg, manifest) : null;
  const resolvedConsole = pkg && manifest ? resolveConsoleLogFromPackage(pkg, manifest) : null;
  return {
    hasManifest: Boolean(manifest),
    recordingCandidates: recordingCandidates.length,
    networkLogPresence: networkCandidates.length > 0,
    consoleLogPresence: consoleCandidates.length > 0,
    screenshotCount,
    packageKeyCount: keys.length,
    resolvedRecordingPath: resolvedRecording?.path || null,
    resolvedNetworkPath: resolvedNetwork?.path || null,
    resolvedConsolePath: resolvedConsole?.path || null,
  };
}

function logPackageDiagnostics(pkg, manifest, label) {
  const diagnostics = buildPackageDiagnostics(pkg, manifest);
  const payload = {
    source: label || "package",
    packageSource: pkg?.meta?.source || null,
    ...diagnostics,
  };
  if (DEBUG_ENABLED) {
    console.table(payload);
  } else {
    console.info("[DebugDuck] Package diagnostics", payload);
  }
}

function updateDiagnosticsPanel() {
  if (!diagnosticsPanel) {
    return;
  }
  const session = state.session;
  const report = state.integrityReport;
  if (!session || !report) {
    diagnosticsPanel.classList.add("hidden");
    return;
  }
  diagnosticsPanel.classList.remove("hidden");
  const availability = report.availability || {};
  const globalDisabled = availability.global === false;
  const meta = session.pkg?.meta || {};
  if (diagSource) {
    diagSource.textContent = meta.source || "-";
  }
  if (diagRoot) {
    diagRoot.textContent = meta.strippedRoot
      ? `Yes (${meta.strippedRoot})`
      : "No";
  }
  if (diagRecording) {
    diagRecording.textContent = session.artifactPresence.recording ? "Yes" : "No";
  }
  if (diagNetwork) {
    diagNetwork.textContent = session.artifactPresence.network ? "Present" : "No";
  }
  if (diagConsole) {
    diagConsole.textContent = session.artifactPresence.console ? "Present" : "No";
  }
  if (diagScreenshots) {
    diagScreenshots.textContent = String(session.screenshots.length);
  }
  if (diagIncidents) {
    diagIncidents.textContent = String(session.incidents.length);
  }
  if (diagDuration) {
    diagDuration.textContent = formatTime(session.durationMs || 0);
  }
  if (diagDurationSource) {
    diagDurationSource.textContent = session.durationSource || "-";
  }
  if (diagParseWarnings) {
    const warnings = session.parseWarnings || { network: 0, console: 0, total: 0 };
    diagParseWarnings.textContent = `${warnings.total} (net ${warnings.network}, con ${warnings.console})`;
  }
  if (diagNetworkCounts) {
    diagNetworkCounts.textContent = globalDisabled || availability.network === false
      ? "Disabled"
      : formatCountPair(
          report.manifestCounts.networkRequests,
          report.parsedCounts.networkRequests
        );
  }
  if (diagNetworkFailureCounts) {
    diagNetworkFailureCounts.textContent = globalDisabled || availability.network === false
      ? "Disabled"
      : formatCountPair(
          report.manifestCounts.networkFailures,
          report.parsedCounts.networkFailures
        );
  }
  if (diagConsoleCounts) {
    diagConsoleCounts.textContent = globalDisabled || availability.console === false
      ? "Disabled"
      : formatCountPair(
          report.manifestCounts.consoleMessages,
          report.parsedCounts.consoleMessages
        );
  }
  if (diagConsoleErrorCounts) {
    diagConsoleErrorCounts.textContent = globalDisabled || availability.console === false
      ? "Disabled"
      : formatCountPair(
          report.manifestCounts.consoleErrors,
          report.parsedCounts.consoleErrors
        );
  }
  if (diagErrorCounts) {
    const includeNetwork = availability.network !== false;
    const includeConsole = availability.console !== false;
    const manifestErrors =
      includeNetwork || includeConsole
        ? (includeNetwork ? report.manifestCounts.networkFailures || 0 : 0) +
          (includeConsole ? report.manifestCounts.consoleErrors || 0 : 0)
        : null;
    const parsedErrors =
      includeNetwork || includeConsole
        ? (includeNetwork ? report.parsedCounts.networkFailures || 0 : 0) +
          (includeConsole ? report.parsedCounts.consoleErrors || 0 : 0)
        : null;
    diagErrorCounts.textContent = globalDisabled || (!includeNetwork && !includeConsole)
      ? "Disabled"
      : formatCountPair(manifestErrors, parsedErrors);
  }
  if (diagScreenshotCounts) {
    diagScreenshotCounts.textContent = globalDisabled || availability.screenshots === false
      ? "Disabled"
      : formatCountPair(report.manifestCounts.screenshots, report.parsedCounts.screenshots);
  }
  if (diagNetworkLineage) {
    diagNetworkLineage.textContent = report.lineage.network || "-";
  }
  if (diagConsoleLineage) {
    diagConsoleLineage.textContent = report.lineage.console || "-";
  }
  if (diagScreenshotLineage) {
    diagScreenshotLineage.textContent = report.lineage.screenshots || "-";
  }
  if (diagIncidentLineage) {
    diagIncidentLineage.textContent = report.lineage.incidents || "-";
  }
  if (diagMarkerLineage) {
    diagMarkerLineage.textContent = report.lineage.markers || "-";
  }
}

function applyDebugArtifactFallbacks(pkg, manifest) {
  if (!DEBUG_ENABLED || !pkg || !manifest) {
    return;
  }
  const keys = pkg.list().map((entry) => entry.path || "");
  const networkCandidates = keys.filter((key) => /network.*\.ndjson$/i.test(key));
  const consoleCandidates = keys.filter((key) => /console.*\.ndjson$/i.test(key));
  if (!manifest.artifacts) {
    manifest.artifacts = {};
  }
  if (!manifest.artifacts.network?.present && networkCandidates.length === 1) {
    manifest.artifacts.network = {
      ...(manifest.artifacts.network || {}),
      present: true,
      path: networkCandidates[0],
      format: manifest.artifacts.network?.format || "ndjson",
    };
    debugWarn(
      "[DD Debug] Network log recovery enabled for",
      networkCandidates[0]
    );
  }
  if (!manifest.artifacts.console?.present && consoleCandidates.length === 1) {
    manifest.artifacts.console = {
      ...(manifest.artifacts.console || {}),
      present: true,
      path: consoleCandidates[0],
      format: manifest.artifacts.console?.format || "ndjson",
    };
    debugWarn(
      "[DD Debug] Console log recovery enabled for",
      consoleCandidates[0]
    );
  }
}

async function hydrateViewerFromPackage(pkg, loadedLabel, options = {}) {
  clearError();
  clearLoadedInfo();
  if (emptyState) {
    emptyState.textContent = "Loading evidence...";
  }

  let manifest;
  try {
    manifest = await loadManifestFromPackage(pkg);
  } catch (error) {
    const err = new Error("session.json could not be parsed.");
    err.code = "malformed_session_json";
    throw err;
  }

  applyDebugArtifactFallbacks(pkg, manifest);
  const normalized = buildNormalizedSessionState(manifest, pkg);
  state.pkg = pkg;
  state.partialMode = false;
  setPackageMode(false, null);
  setHeaderActionsVisible(true);
  applyNormalizedSessionState(normalized);

  const incidents = await loadIncidentsFromPackageFiles(pkg);
  if (incidents.length) {
    setIncidents(mergeIncidents(state.incidents, incidents));
    renderIncidentRail();
  }

  setLoadedInfo(loadedLabel, manifest.session?.id || "session.json");

  if (options.eagerRecording) {
    await ensureVideoLoaded();
  }
  if (options.eagerLogs && manifest?.artifacts?.network?.present) {
    await ensureNetworkLogsLoaded();
  }
  if (options.eagerLogs && manifest?.artifacts?.console?.present) {
    await ensureConsoleLogsLoaded();
  }

  updateTimeline();
  refreshView();
  updateCurrentTimeContext();
  if (emptyState) {
    emptyState.textContent = "";
  }
  if (normalized.screenshotFiles.length) {
    await loadScreenshotBlobsFromPackage(normalized.screenshotFiles, pkg);
    state.loadedArtifacts.screenshots = true;
  }
  updateIntegrityReport();
  logPackageDiagnostics(pkg, manifest, loadedLabel);
  return true;
}

function showLoaderError(error) {
  const code = error?.code || "unknown_loader_error";
  const messages = {
    empty_package: "The selected package is empty.",
    missing_session_json: "session.json was not found. Select a DebugDuck session bundle.",
    unsupported_shape:
      "The selected files do not look like a DebugDuck session package.",
    malformed_session_json: "session.json could not be parsed. Re-export the session.",
    zip_bootstrap_missing:
      "ZIP support is unavailable because JSZip did not load. Folder packages still work.",
  };
  showError(messages[code] || error?.message || "There was a problem loading this session package.");
  if (DEBUG_ENABLED) {
    console.error("[DebugDuck loader]", error);
  }
}

async function loadSessionPackage(input, options = {}) {
  let pkg;
  try {
    resetState();
    if (input?.kind === "zip-file") {
      if (!window.JSZip) {
        const error = new Error("JSZip is required to open ZIP packages");
        error.code = "zip_bootstrap_missing";
        throw error;
      }
      pkg = await buildPackageFromZip(input.file);
    } else if (input?.kind === "folder-files") {
      pkg = await buildPackageFromFileList(input.files);
    } else if (input?.kind === "session-json-file") {
      pkg = await buildPackageFromSessionJsonFile(input.file);
    } else {
      const error = new Error("Unsupported loader input");
      error.code = "unsupported_shape";
      throw error;
    }

    pkg = normalizePackageRoot(pkg);
    validatePackageShape(pkg);

    return await hydrateViewerFromPackage(pkg, options.label || "package", {
      eagerRecording: options.eagerRecording,
      eagerLogs: options.eagerLogs,
    });
  } catch (error) {
    showLoaderError(error);
    return false;
  }
}

async function handlePackageFiles(files, label) {
  const list = Array.from(files || []);
  if (!list.length) {
    return false;
  }

  const zipCandidates = list.filter((file) => /\.zip$/i.test(file.name || ""));
  if (zipCandidates.length === 1 && list.length === 1) {
    return loadSessionPackage(
      { kind: "zip-file", file: zipCandidates[0] },
      { label }
    );
  }
  if (zipCandidates.length > 0 && list.length > 1) {
    showLoaderError({ code: "unsupported_shape" });
    return false;
  }

  const jsonCandidates = list.filter((file) =>
    /session\.json$/i.test(file.name || file.webkitRelativePath || "")
  );
  if (list.length === 1 && jsonCandidates.length === 1) {
    const loaded = await loadSessionPackage(
      { kind: "session-json-file", file: jsonCandidates[0] },
      { label, eagerRecording: false, eagerLogs: false }
    );
    if (loaded) {
      if (emptyState) {
        emptyState.textContent =
          "Session loaded. Select the session folder to load artifacts.";
      }
      showError(
        "Artifacts are not loaded yet. Select the session folder to load video, logs, and screenshots.",
        true
      );
    }
    return loaded;
  }

  const hasRelativePath = list.some((file) => Boolean(file.webkitRelativePath));
  if (hasRelativePath && isViewerRunningInsideSelectedPackage(list)) {
    showError(
      "Viewer is opened from inside this evidence package. Open the viewer from outside the session folder, or use Open Evidence ZIP instead.",
      true
    );
    return false;
  }

  return loadSessionPackage(
    { kind: "folder-files", files: list },
    { label, eagerRecording: true, eagerLogs: true }
  );
}

async function loadZip(file) {
  return loadSessionPackage({ kind: "zip-file", file }, { label: file.name });
}

async function tryLoadPackageSession() {
  return false;
}

function resetState() {
  state.pkg = null;
  state.session = null;
  state.integrityReport = null;
  state.sessionLog = null;
  state.manifest = null;
  state.packageMode = false;
  state.packageBaseUrl = null;
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
    activePanel: "network",
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
    networkQuery: "",
    consoleQuery: "",
    consoleQuick: "all",
    incidentSourcePanel: null,
    showIncidentRail: true,
  };
  state.panelModes = {
    network: "all",
    console: "all",
  };
  state.inspector = {
    type: null,
    id: null,
    expandState: {},
    lastKey: null,
    activeTabs: {
      network: "Overview",
      console: "Overview",
    },
  };
  state.incidents = [];
  state.sortedIncidentsByTime = [];
  state.sortedScreenshotsByTime = [];
  state.sortedScreenshotEvents = [];
  state.incidentsVersion = 0;
  state.filteredIncidentsCache = { key: "", list: [] };
  state.currentMoment = null;
  state.snapPulse = {
    id: null,
    untilMs: 0,
  };
  state.videoSyncAvailable = false;
  state.partialMode = false;
  state.loadedArtifacts = {
    network: false,
    console: false,
    recording: false,
    screenshots: false,
  };
  eventIdCounter = 0;
  state.screenshotById.clear();
  state.networkIndex = null;
  state.consoleIndex = null;
  state.networkEntries = [];
  state.consoleEntries = [];
  state.networkGroupExpanded = new Set();
  state.loadingNetwork = false;
  state.loadingConsole = false;
  if (state.videoUrl) {
    URL.revokeObjectURL(state.videoUrl);
  }
  state.videoUrl = null;
  state.screenshotUrls.forEach((url) => URL.revokeObjectURL(url));
  state.screenshotUrls.clear();
  closeScreenshotModal();

  eventList.innerHTML = "";
  detailsBody.textContent = "Select an item";
  if (searchInput) {
    searchInput.value = "";
  }
  if (filterMarkers) {
    filterMarkers.checked = true;
  }
  if (filterNetwork) {
    filterNetwork.checked = true;
  }
  if (filterConsole) {
    filterConsole.checked = true;
  }
  if (filterScreenshots) {
    filterScreenshots.checked = true;
  }
  if (contextIncident) {
    contextIncident.textContent = "None";
  }
  if (contextScreenshot) {
    contextScreenshot.textContent = "None";
  }
  if (contextNetworkCount) {
    contextNetworkCount.textContent = "-";
  }
  if (contextConsoleCount) {
    contextConsoleCount.textContent = "-";
  }
  if (timelineLanes) {
    const tracks = Array.from(timelineLanes.querySelectorAll(".lane-track"));
    tracks.forEach((track) => {
      track.innerHTML = "";
    });
  }
  if (timelineMarkers) {
    timelineMarkers.innerHTML = "";
    timelineMarkers.dataset.version = "";
    timelineMarkers.dataset.duration = "";
  }
  if (markerHover) {
    markerHover.classList.add("hidden");
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
  if (videoEl && !videoEl.paused) {
    try {
      videoEl.pause();
    } catch (error) {
      // ignore
    }
  }
  videoEl.removeAttribute("src");
  videoEl.load();
  if (playToggleBtn) {
    playToggleBtn.disabled = true;
  }
  setPlayState(false);
  if (videoSyncNote) {
    videoSyncNote.classList.add("hidden");
  }
  emptyState.textContent =
    "Open a DebugDuck session ZIP, folder, or session.json to replay locally. You can also drag and drop files here.";
  if (summaryPanel) {
    summaryPanel.classList.add("hidden");
    summaryPanel.classList.remove("integrity-disabled");
  }
  if (integrityBanner) {
    integrityBanner.classList.add("hidden");
  }
  setIntegrityControlsDisabled(null);
  updateDiagnosticsPanel();
  if (timelineSummary) {
    timelineSummary.textContent = "";
  }
  if (incidentPanel) {
    incidentPanel.classList.add("hidden");
  }
  if (incidentList) {
    incidentList.innerHTML = "";
  }
  if (incidentEmpty) {
    incidentEmpty.classList.add("hidden");
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
    chip.classList.toggle("active", chip.dataset.netMode === "all");
  });
  consoleModeChips.forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.consoleMode === "all");
  });
  networkFilterChips.forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.netFilter === "all");
  });
  if (networkSearchInput) {
    networkSearchInput.value = "";
  }
  if (networkSearchClear) {
    networkSearchClear.disabled = true;
  }
  if (networkList) {
    networkList.innerHTML = "";
  }
  if (networkEmpty) {
    networkEmpty.classList.add("hidden");
  }
  if (networkFilteredEmpty) {
    networkFilteredEmpty.classList.add("hidden");
  }
  if (networkResultCount) {
    networkResultCount.textContent = "";
  }
  if (networkSelectionNote) {
    networkSelectionNote.classList.add("hidden");
  }
  consoleLevelChips.forEach((chip) => {
    chip.classList.toggle("active", true);
  });
  consoleModeChips.forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.consoleMode === "all");
  });
  consoleQuickChips.forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.consoleQuick === "all");
  });
  if (consoleSearchInput) {
    consoleSearchInput.value = "";
  }
  if (consoleSearchClear) {
    consoleSearchClear.disabled = true;
  }
  if (consoleList) {
    consoleList.innerHTML = "";
  }
  if (consoleEmpty) {
    consoleEmpty.classList.add("hidden");
  }
  if (consoleFilteredEmpty) {
    consoleFilteredEmpty.classList.add("hidden");
  }
  if (consoleResultCount) {
    consoleResultCount.textContent = "";
  }
  if (consoleSelectionNote) {
    consoleSelectionNote.classList.add("hidden");
  }
  if (screenshotsList) {
    screenshotsList.innerHTML = "";
  }
  if (screenshotsEmpty) {
    screenshotsEmpty.classList.add("hidden");
  }
  if (screenshotPreview) {
    screenshotPreview.textContent = "Select an item";
  }
  setActivePanel("timeline");
  clearError();
  clearLoadedInfo();
  if (diagnosticsPanel) {
    diagnosticsPanel.open = false;
  }
  if (incidentPanel) {
    incidentPanel.open = false;
  }
  renderInspector();
}

function clearAllLoaderInputs() {
  if (zipInput) {
    zipInput.value = "";
  }
  if (sessionAnyInput) {
    sessionAnyInput.value = "";
  }
  if (sessionFileInput) {
    sessionFileInput.value = "";
  }
  if (sessionFolderInput) {
    sessionFolderInput.value = "";
  }
}

if (openZipBtn && zipInput) {
  openZipBtn.addEventListener("click", () => {
    clearAllLoaderInputs();
    zipInput.click();
  });
}
if (openUnifiedBtn && sessionAnyInput) {
  openUnifiedBtn.addEventListener("click", () => {
    clearAllLoaderInputs();
    sessionAnyInput.click();
  });
}
if (openSessionBtn && sessionFileInput) {
  openSessionBtn.addEventListener("click", () => {
    clearAllLoaderInputs();
    sessionFileInput.click();
  });
}
if (openSessionFolderBtn && sessionFolderInput) {
  openSessionFolderBtn.addEventListener("click", () => {
    clearAllLoaderInputs();
    sessionFolderInput.click();
  });
}
if (openAnotherBtn && zipInput) {
  openAnotherBtn.addEventListener("click", () => {
    resetState();
    clearAllLoaderInputs();
    zipInput.click();
  });
}
if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    resetState();
    clearAllLoaderInputs();
  });
}
if (screenshotZoomInBtn) {
  screenshotZoomInBtn.addEventListener("click", () => {
    setScreenshotScale(modalState.scale * 1.2);
  });
}
if (screenshotZoomOutBtn) {
  screenshotZoomOutBtn.addEventListener("click", () => {
    setScreenshotScale(modalState.scale / 1.2);
  });
}
if (screenshotResetBtn) {
  screenshotResetBtn.addEventListener("click", () => {
    resetScreenshotModalView();
  });
}
if (screenshotFitBtn) {
  screenshotFitBtn.addEventListener("click", () => {
    fitScreenshotToViewport();
  });
}
if (screenshotActualBtn) {
  screenshotActualBtn.addEventListener("click", () => {
    modalState.translateX = 0;
    modalState.translateY = 0;
    setScreenshotScale(1);
  });
}
if (screenshotCloseBtn) {
  screenshotCloseBtn.addEventListener("click", () => {
    closeScreenshotModal();
  });
}
if (screenshotModalViewport) {
  screenshotModalViewport.addEventListener(
    "wheel",
    (event) => {
      if (!modalState.isOpen) {
        return;
      }
      event.preventDefault();
      const delta = event.deltaY < 0 ? 1.1 : 0.9;
      setScreenshotScale(modalState.scale * delta);
    },
    { passive: false }
  );
  screenshotModalViewport.addEventListener("mousedown", (event) => {
    if (!modalState.isOpen) {
      return;
    }
    if (event.button !== 0) {
      return;
    }
    modalState.dragging = true;
    modalState.dragStartX = event.clientX - modalState.translateX;
    modalState.dragStartY = event.clientY - modalState.translateY;
    screenshotModalViewport.classList.add("dragging");
  });
}
if (screenshotModal) {
  screenshotModal.addEventListener("click", (event) => {
    if (!modalState.isOpen) {
      return;
    }
    const target = event.target;
    if (target && target.classList && target.classList.contains("dd-modal-backdrop")) {
      closeScreenshotModal();
    }
  });
}
if (screenshotPreview) {
  screenshotPreview.addEventListener("click", () => {
    const shot = getActiveScreenshotForModal();
    if (shot) {
      openScreenshotModal(shot);
    }
  });
}
console.log("[DebugDuck Viewer] bind controls start");
const missingRequiredElements = [
  ["#timeline", timeline],
  ["#filterMarkers", filterMarkers],
  ["#filterNetwork", filterNetwork],
  ["#filterConsole", filterConsole],
  ["#filterScreenshots", filterScreenshots],
  ["#filterErrors", filterErrors],
  ["#searchInput", searchInput],
].filter(([, el]) => !el);
if (missingRequiredElements.length) {
  const missingSelectors = missingRequiredElements.map(([selector]) => selector);
  console.error(
    "[DebugDuck Viewer] Missing required elements:",
    missingSelectors.join(", ")
  );
  throw new Error(
    `DebugDuck viewer boot failed: missing required elements: ${missingSelectors.join(
      ", "
    )}`
  );
}

window.addEventListener("mousemove", (event) => {
  if (!modalState.dragging) {
    return;
  }
  modalState.translateX = event.clientX - modalState.dragStartX;
  modalState.translateY = event.clientY - modalState.dragStartY;
  applyScreenshotTransform();
});
window.addEventListener("mouseup", () => {
  if (!modalState.dragging) {
    return;
  }
  modalState.dragging = false;
  if (screenshotModalViewport) {
    screenshotModalViewport.classList.remove("dragging");
  }
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modalState.isOpen) {
    closeScreenshotModal();
  }
});
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

if (sessionAnyInput) {
  sessionAnyInput.addEventListener("change", async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      return;
    }
    resetState();
    await handlePackageFiles(files, "selected files");
  });
}

if (dropZone) {
  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("active");
  });
  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("active");
  });
  dropZone.addEventListener("drop", async (event) => {
    event.preventDefault();
    dropZone.classList.remove("active");
    const files = Array.from(event.dataTransfer?.files || []);
    if (!files.length) {
      showError("No files were dropped.");
      return;
    }
    resetState();
    await handlePackageFiles(files, "dropped files");
  });
}

if (sessionFileInput) {
  sessionFileInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }
    resetState();
    const loaded = await loadSessionPackage(
      { kind: "session-json-file", file },
      { label: "session.json", eagerRecording: false, eagerLogs: false }
    );
    if (loaded) {
      if (emptyState) {
        emptyState.textContent =
          "Session loaded. Select the session folder to load artifacts.";
      }
      showError(
        "Artifacts are not loaded yet. Select the session folder to load video, logs, and screenshots.",
        true
      );
    }
  });
}

if (sessionFolderInput) {
  sessionFolderInput.addEventListener("change", async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      return;
    }
    resetState();
    await handlePackageFiles(files, "session folder");
  });
}

tryLoadPackageSession()
  .then((loaded) => {
    if (!loaded) {
      setHeaderActionsVisible(true);
      if (openSessionBtn) {
        openSessionBtn.style.display = "";
      }
      if (openSessionFolderBtn) {
        openSessionFolderBtn.style.display = "";
      }
      const zipAvailable = Boolean(window.JSZip);
      if (!zipAvailable) {
        setZipControlsAvailable(
          false,
          "ZIP loading is not available in this viewer build."
        );
      } else {
        setZipControlsAvailable(true);
      }

      if (emptyState) {
        emptyState.textContent =
          "Open session.json or the session folder from an extracted DebugDuck bundle.";
      }
      const fileWarning =
        window.location.protocol === "file:"
          ? " This file was opened via file://, which can block loading session.json. Use a local web server or enable file access."
          : "";
      const zipGuidance = zipAvailable
        ? " Use Open Evidence ZIP to load a package manually."
        : " ZIP loading is disabled in this viewer build.";
      showError(
        `Session package not loaded.${fileWarning}${zipGuidance} You can also open session.json directly.`,
        true
      );
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
  if (markerHover) {
    markerHover.classList.add("hidden");
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
    renderTimelineMarkers();
    renderTimelineLanes(state.session?.markers || []);
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

if (networkSearchInput) {
  networkSearchInput.addEventListener("input", () => {
    state.filters.networkQuery = normalizeSearchQuery(networkSearchInput.value);
    if (networkSearchClear) {
      networkSearchClear.disabled = !state.filters.networkQuery;
    }
    if (state.loadedArtifacts.network) {
      renderNetworkPanel();
    }
  });
}
if (networkSearchClear) {
  networkSearchClear.addEventListener("click", () => {
    if (networkSearchInput) {
      networkSearchInput.value = "";
    }
    state.filters.networkQuery = "";
    networkSearchClear.disabled = true;
    if (state.loadedArtifacts.network) {
      renderNetworkPanel();
    }
  });
}

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

consoleQuickChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    if (chip.disabled) {
      return;
    }
    consoleQuickChips.forEach((btn) => btn.classList.remove("active"));
    chip.classList.add("active");
    state.filters.consoleQuick = chip.dataset.consoleQuick || "all";
    renderIncidentRail();
    if (state.loadedArtifacts.console) {
      renderConsolePanel();
    }
  });
});

if (consoleSearchInput) {
  consoleSearchInput.addEventListener("input", () => {
    state.filters.consoleQuery = normalizeSearchQuery(consoleSearchInput.value);
    if (consoleSearchClear) {
      consoleSearchClear.disabled = !state.filters.consoleQuery;
    }
    if (state.loadedArtifacts.console) {
      renderConsolePanel();
    }
  });
}
if (consoleSearchClear) {
  consoleSearchClear.addEventListener("click", () => {
    if (consoleSearchInput) {
      consoleSearchInput.value = "";
    }
    state.filters.consoleQuery = "";
    consoleSearchClear.disabled = true;
    if (state.loadedArtifacts.console) {
      renderConsolePanel();
    }
  });
}

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
console.log("[DebugDuck Viewer] bind controls complete");
