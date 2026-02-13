import {
  COLOR_OPTIONS,
  DEFAULT_ANNOTATION_STYLE,
  FONT_OPTIONS,
  OPACITY_OPTIONS,
  SIZE_OPTIONS,
  WEIGHT_OPTIONS,
  normalizeAnnotationStyle,
} from "../shared/annotationConfig.js";

const statusElements = {
  message: document.getElementById("status_message"),
  mode: document.getElementById("status_mode"),
  state: document.getElementById("status_state"),
  timer: document.getElementById("status_timer"),
  counts: document.getElementById("status_counts"),
  download: document.getElementById("downloadStatus"),
};

const appTitleEl = document.getElementById("app_title");
const appIconEl = document.getElementById("app_icon");
const helpButton = document.getElementById("help_button");
const helpModal = document.getElementById("help_modal");
const helpCloseButton = document.getElementById("help_close");

const buttons = {
  screenshot: document.getElementById("btn_take_screenshot"),
  recordStart: document.getElementById("btn_start_recording"),
  recordPause: document.getElementById("btn_pause_recording"),
  recordResume: document.getElementById("btn_resume_recording"),
  recordStop: document.getElementById("btn_stop_recording"),
  recordPanel: document.getElementById("btn_open_recording_panel"),
  networkStart: document.getElementById("btn_start_capture"),
  networkStop: document.getElementById("btn_stop_capture"),
  networkRefresh: document.getElementById("refreshTabBtn"),
  fullPageScreenshotMode: document.getElementById("btn_fullpage_screenshot_mode"),
  download: document.getElementById("btn_download_zip"),
  downloadRecording: document.getElementById("btn_download_recording"),
  reset: document.getElementById("btn_reset_session"),
};

let currentMode = "screenshot";
const redactionToggle = document.getElementById("redactionToggle");
const redactionStatus = document.getElementById("redactionStatus");
const screenshotHint = document.getElementById("screenshotHint");
const recordingDownloadHint = document.getElementById("recordingDownloadHint");
const fullPageProgress = document.getElementById("fullPageProgress");
const statusTimerRow = document.getElementById("status_timer_row");
const statusCountsRow = document.getElementById("status_counts_row");
const downloadControls = document.getElementById("download_controls");
const statusToggle = document.getElementById("status_toggle");
const statusChevron = document.getElementById("status_chevron");
const statusBody = document.getElementById("status_body");
const networkTip = document.getElementById("network_tip");
const networkGuidance = document.getElementById("networkGuidance");
const controlsStatus = document.getElementById("controlsStatus");
const networkStatusStrip = document.getElementById("networkStatusStrip");
const versionBadge = document.getElementById("versionBadge");
const sessionPill = document.getElementById("session_pill");
const sessionMeta = document.getElementById("session_meta");
const recordingUnavailable = document.getElementById("recording-disabled-msg");
const networkUnavailable = document.getElementById("network-disabled-msg");
const annotationToggle = document.getElementById("annotation_toggle");
const annotationChevron = document.getElementById("annotation_chevron");
const annotationBody = document.getElementById("annotation_body");
const annotationFontFamily = document.getElementById("annotationFontFamily");
const annotationFontSize = document.getElementById("annotationFontSize");
const annotationFontWeight = document.getElementById("annotationFontWeight");
const annotationFontColor = document.getElementById("annotationFontColor");
const annotationFontOpacity = document.getElementById("annotationFontOpacity");
const exportHint = document.getElementById("exportHint");
const toastEl = document.getElementById("toast");
const quickActions = document.getElementById("quick_actions");
const autoDownloadToggle = document.getElementById("toggle_auto_download_rollover");
const autoDownloadStatus = document.getElementById("autoDownloadStatus");
const partCapSelect = document.getElementById("dropdown_part_cap_requests");
const maxBodySelect = document.getElementById("dropdown_max_body_kb");
const timestampOverlayToggle = document.getElementById("toggle_timestamp_overlay");
const timestampOverlayStatus = document.getElementById("timestampOverlayStatus");
const partProgressStatus = document.getElementById("status_current_part");
const exportQueueStatus = document.getElementById("status_export_queue");
const autoDownloadStatusLine = document.getElementById("status_auto_download");
const downloadHelp = document.getElementById("status_download_help");
const completedPartsList = document.getElementById("completed_parts_list");
const completedPartsEmpty = document.getElementById("completed_parts_empty");
const exportProgressStatus = document.getElementById("status_export_progress");
const nearLimitStatus = document.getElementById("status_near_limit");
const downloadBanner = document.getElementById("status_download_banner");
const storageLimitModal = document.getElementById("modal_storage_limit");
const storageLimitBody = document.getElementById("storage_limit_body");
const filtersToggle = document.getElementById("filters_toggle");
const filtersChevron = document.getElementById("filters_chevron");
const filtersBody = document.getElementById("filters_body");
const filterRequestType = document.getElementById("filter_request_type");
const filterStatusMode = document.getElementById("filter_status_mode");
const filterStatusCustomWrap = document.getElementById("filter_status_custom_wrap");
const filterStatusCustomList = document.getElementById("filter_status_custom_list");
const filterStatusError = document.getElementById("filter_status_error");
const filterUrlContains = document.getElementById("filter_url_contains");
const filterUrlExcludes = document.getElementById("filter_url_excludes");
const filterCaptureMode = document.getElementById("filter_capture_mode");
const filtersDisabledHint = document.getElementById("filters_disabled_hint");
const filtersSummary = document.getElementById("filters_summary");
let statusUserToggled = false;
let recordingAvailable = true;
let networkAvailable = true;
let recordingCheckToken = 0;
let recordingBlockedReason = null;
let activeRecordingStream = null;
let activeMediaRecorder = null;
let captureSettings = {
  autoDownloadOnRollover: false,
  partCapRequests: 5000,
  maxBodyKb: 200,
  timestampOverlay: false,
};
let recordedChunks = [];
let recordingObjectUrl = null;
let recordingMimeType = "video/webm";
let recordingCapturedAt = null;
let recordingStopReason = null;
let recordingSegmentMode = false;
let recordingLiveState = null;
let recordingState = "idle";
let recordingStartedAt = null;
let recordingPausedAt = null;
let recordingTotalPausedMs = 0;
let recordingHasData = false;
let recordingLastError = null;
let recordingControlInFlight = false;
let recordingStatusMessage = null;
let recordingStopPromise = null;
let recordingStopResolver = null;
let recordingStopRequestedAt = null;
let recordingDurationMsSnapshot = null;
let annotationCollapsed = true;
let toastTimer = null;
let helpIsOpen = false;
let helpReturnFocusEl = null;

const STATUS_COLORS = {
  default: "#4b5563",
  error: "#b91c1c",
  success: "#166534",
};

const ANNOTATION_DEFAULTS = { ...DEFAULT_ANNOTATION_STYLE };

const CLICK_DEBUG = false;

const APP_VERSION = "v0.1";
const APP_TAGLINE = "QA evidence recorder";
const JSZIP_LOAD_ERROR =
  "Export unavailable: JSZip failed to load. Check popup.html script path.";
let jszipAvailable = typeof window !== "undefined" && Boolean(window.JSZip);
const MIN_REQUESTS_TO_EXPORT = 25;
const MSG = {
  RECORDING_GET_STATE: "RECORDING_GET_STATE",
  RECORDING_START: "RECORDING_START",
  RECORDING_PAUSE: "RECORDING_PAUSE",
  RECORDING_RESUME: "RECORDING_RESUME",
  RECORDING_STOP: "RECORDING_STOP",
  RECORDING_EXPORT_WEBM: "RECORDING_EXPORT_WEBM",
  RECORDING_RESET: "RECORDING_RESET",
  CAPTURE_FULLPAGE: "CAPTURE_FULLPAGE",
  SET_ANNOTATION_STYLE: "SET_ANNOTATION_STYLE",
  GET_ANNOTATION_STYLE: "GET_ANNOTATION_STYLE",
  GET_STATUS: "GET_STATUS",
  GET_CAPABILITIES: "GET_CAPABILITIES",
  RESET_SESSION: "RESET_SESSION",
  NETWORK_RESET: "NETWORK_RESET",
};
const EXPORT_EVENTS = {
  REQUEST: "EXPORT_EVIDENCE_ZIP_REQUEST",
  PROGRESS: "EXPORT_EVIDENCE_ZIP_PROGRESS",
  DONE: "EXPORT_EVIDENCE_ZIP_DONE",
  ERROR: "EXPORT_EVIDENCE_ZIP_ERROR",
};
let exportInProgress = false;
let exportProgressPercent = 0;
let exportButtonLabel = null;
let lastExportResultAt = 0;
let exportProgressState = null;
let captureFilters = {
  filter_request_type: "xhr_fetch",
  filter_status_mode: "all",
  filter_status_custom_list: "",
  filter_url_contains: "",
  filter_url_excludes: "",
  filter_capture_mode: "filtered_capture",
  filters_panel_collapsed: true,
};
let filtersLocked = false;
let fullPageInProgress = false;

function setStatus(element, message, type = "default") {
  element.textContent = message;
  element.style.color = STATUS_COLORS[type] || STATUS_COLORS.default;
  element.classList.remove("status--error", "status--success");
  if (type === "error") {
    element.classList.add("status--error");
  } else if (type === "success") {
    element.classList.add("status--success");
  }
}

function showToast(message, type = "info") {
  if (!toastEl) {
    return;
  }
  toastEl.textContent = message;
  toastEl.classList.add("show");
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
  toastTimer = setTimeout(() => {
    toastEl.classList.remove("show");
  }, 2200);
  if (type === "error") {
    toastEl.style.background = "#b91c1c";
  } else {
    toastEl.style.background = "#0f172a";
  }
}

function applyCaptureSettingsToUI() {
  if (autoDownloadToggle) {
    autoDownloadToggle.checked = captureSettings.autoDownloadOnRollover;
  }
  if (autoDownloadStatus) {
    autoDownloadStatus.textContent = captureSettings.autoDownloadOnRollover
      ? "ON"
      : "OFF";
  }
  if (autoDownloadStatusLine) {
    autoDownloadStatusLine.textContent = `Auto-download: ${
      captureSettings.autoDownloadOnRollover ? "ON" : "OFF"
    }`;
  }
  if (partCapSelect) {
    partCapSelect.value = String(captureSettings.partCapRequests);
  }
  if (maxBodySelect) {
    maxBodySelect.value = String(captureSettings.maxBodyKb);
  }
  if (timestampOverlayToggle) {
    timestampOverlayToggle.checked = captureSettings.timestampOverlay;
  }
  if (timestampOverlayStatus) {
    timestampOverlayStatus.textContent = captureSettings.timestampOverlay
      ? "ON"
      : "OFF";
  }
}

function applyFiltersToUI() {
  if (filterRequestType) {
    filterRequestType.value = captureFilters.filter_request_type;
  }
  if (filterStatusMode) {
    filterStatusMode.value = captureFilters.filter_status_mode;
  }
  if (filterStatusCustomList) {
    filterStatusCustomList.value = captureFilters.filter_status_custom_list;
  }
  if (filterUrlContains) {
    filterUrlContains.value = captureFilters.filter_url_contains;
  }
  if (filterUrlExcludes) {
    filterUrlExcludes.value = captureFilters.filter_url_excludes;
  }
  if (filterCaptureMode) {
    const radio = filterCaptureMode.querySelector(
      `input[value="${captureFilters.filter_capture_mode}"]`
    );
    if (radio) {
      radio.checked = true;
    }
  }
  const showCustom = captureFilters.filter_status_mode === "custom";
  if (filterStatusCustomWrap) {
    filterStatusCustomWrap.classList.toggle("is-hidden", !showCustom);
  }
  if (filtersBody && filtersChevron) {
    filtersBody.classList.toggle("collapsed", captureFilters.filters_panel_collapsed);
    filtersChevron.textContent = captureFilters.filters_panel_collapsed ? "▸" : "▾";
    filtersToggle?.classList.toggle("open", !captureFilters.filters_panel_collapsed);
  }
}

function setFiltersLocked(locked) {
  filtersLocked = locked;
  const controls = [
    filterRequestType,
    filterStatusMode,
    filterStatusCustomList,
    filterUrlContains,
    filterUrlExcludes,
  ];
  controls.forEach((control) => {
    if (control) {
      control.disabled = locked;
    }
  });
  if (filterCaptureMode) {
    filterCaptureMode
      .querySelectorAll("input")
      .forEach((input) => (input.disabled = locked));
  }
  if (filtersDisabledHint) {
    filtersDisabledHint.classList.toggle("is-hidden", !locked);
  }
}

function parseStatusList(raw) {
  if (!raw || typeof raw !== "string") {
    return [];
  }
  const entries = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const codes = [];
  entries.forEach((value) => {
    const num = Number(value);
    if (Number.isInteger(num) && num >= 100 && num <= 599) {
      codes.push(num);
    }
  });
  const unique = Array.from(new Set(codes)).slice(0, 30);
  return unique;
}

function validateFilters() {
  if (filterStatusError) {
    filterStatusError.classList.add("is-hidden");
    filterStatusError.textContent = "";
  }
  if (captureFilters.filter_status_mode !== "custom") {
    return { ok: true, statuses: [] };
  }
  const codes = parseStatusList(captureFilters.filter_status_custom_list);
  if (!codes.length) {
    if (filterStatusError) {
      filterStatusError.textContent =
        "Enter at least one valid status code (100-599).";
      filterStatusError.classList.remove("is-hidden");
    }
    return { ok: false, statuses: [] };
  }
  if (filterStatusError) {
    filterStatusError.classList.add("is-hidden");
    filterStatusError.textContent = "";
  }
  return { ok: true, statuses: codes };
}

async function loadFiltersSettings() {
  const settings = await chrome.storage.local.get({
    repro_capture_filters_v1: captureFilters,
  });
  if (settings && settings.repro_capture_filters_v1) {
    captureFilters = {
      ...captureFilters,
      ...settings.repro_capture_filters_v1,
    };
  }
  applyFiltersToUI();
  validateFilters();
}

async function persistFiltersSettings() {
  await chrome.storage.local.set({
    repro_capture_filters_v1: captureFilters,
  });
}

function getFiltersPayload() {
  const validation = validateFilters();
  if (!validation.ok) {
    return { ok: false, error: "Invalid status filter list." };
  }
  const excludeTokens = captureFilters.filter_url_excludes
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 20);
  return {
    ok: true,
    filters: {
      requestType: captureFilters.filter_request_type,
      statusMode: captureFilters.filter_status_mode,
      customStatuses: validation.statuses,
      urlContains: captureFilters.filter_url_contains.trim(),
      urlExcludes: excludeTokens,
      captureMode: captureFilters.filter_capture_mode,
    },
  };
}

function getStatusBadge(status) {
  switch (status) {
    case "queued":
      return { label: "Queued", className: "info" };
    case "completed_ready":
      return { label: "Ready", className: "info" };
    case "exporting":
      return { label: "Exporting", className: "info" };
    case "downloaded":
      return { label: "Downloaded", className: "success" };
    case "download_failed":
      return { label: "Download failed", className: "error" };
    default:
      return { label: "Ready", className: "info" };
  }
}

function renderCompletedParts(parts) {
  if (!completedPartsList || !completedPartsEmpty) {
    return;
  }
  completedPartsList.innerHTML = "";
  if (!Array.isArray(parts) || parts.length === 0) {
    completedPartsEmpty.classList.remove("is-hidden");
    return;
  }
  completedPartsEmpty.classList.add("is-hidden");
  parts.forEach((part) => {
    const item = document.createElement("div");
    item.className = "completed-item";

    const info = document.createElement("div");
    info.className = "completed-item-info";
    const line = document.createElement("div");
    const bytesMb = ((part.bytesInPart || 0) / (1024 * 1024)).toFixed(1);
    line.textContent = `Part ${part.partNumber} — ${part.requestCount} req — ${bytesMb}MB`;
    const badge = document.createElement("span");
    let badgeStatus = part.exportInProgress ? "exporting" : part.status;
    if (!part.exportInProgress && part.queuedForExport) {
      badgeStatus = "queued";
    }
    const badgeInfo = getStatusBadge(badgeStatus);
    badge.className = `status-badge ${badgeInfo.className}`;
    badge.textContent = badgeInfo.label;
    info.appendChild(line);
    info.appendChild(badge);

    const actions = document.createElement("div");
    actions.className = "part-actions";
    const downloadBtn = document.createElement("button");
    downloadBtn.className = "secondary mini";
    downloadBtn.dataset.action = "part:download";
    downloadBtn.dataset.partId = part.partId;
    if (part.status === "download_failed") {
      downloadBtn.textContent = "Retry download";
    } else if (part.status === "downloaded") {
      downloadBtn.textContent = "Download again";
    } else {
      downloadBtn.textContent = "Download";
    }
    const tooSmall = part.requestCount < MIN_REQUESTS_TO_EXPORT;
    const canDownload =
      ["completed_ready", "download_failed", "downloaded"].includes(part.status) &&
      !part.exportInProgress &&
      !part.queuedForExport &&
      !tooSmall;
    downloadBtn.disabled = !canDownload;
    if (part.exportInProgress) {
      downloadBtn.title = "Export in progress.";
    } else if (part.queuedForExport) {
      downloadBtn.title = "Queued for export.";
    } else if (tooSmall) {
      downloadBtn.title = `Need ${MIN_REQUESTS_TO_EXPORT}+ requests to export.`;
    } else {
      downloadBtn.title = "";
    }

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "ghost mini";
    deleteBtn.dataset.action = "part:delete";
    deleteBtn.dataset.partId = part.partId;
    deleteBtn.dataset.partNumber = part.partNumber;
    deleteBtn.textContent = "Delete";
    deleteBtn.disabled = Boolean(part.exportInProgress || part.queuedForExport);
    if (part.exportInProgress) {
      deleteBtn.title = "Export in progress.";
    } else if (part.queuedForExport) {
      deleteBtn.title = "Queued for export.";
    } else {
      deleteBtn.title = "";
    }

    actions.appendChild(downloadBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(info);
    item.appendChild(actions);
    completedPartsList.appendChild(item);
  });
}

async function refreshCompletedParts() {
  const response = await send("GET_COMPLETED_PARTS");
  if (!response.ok) {
    return;
  }
  renderCompletedParts(response.parts);
}

function updateExportProgressUI() {
  if (!exportProgressStatus) {
    return;
  }
  if (!exportProgressState) {
    exportProgressStatus.classList.add("is-hidden");
    exportProgressStatus.textContent = "";
    return;
  }
  const partLabel = exportProgressState.partNumber
    ? `Part ${exportProgressState.partNumber}`
    : "Export";
  const phase = exportProgressState.phase || "Working";
  const percent =
    typeof exportProgressState.percent === "number"
      ? exportProgressState.percent
      : 0;
  exportProgressStatus.textContent = `Exporting ${partLabel}… (${phase} ${percent}%)`;
  exportProgressStatus.classList.remove("is-hidden");
  exportProgressStatus.classList.remove("is-error", "is-info");
}

function mapStageToPhase(stage) {
  if (!stage) {
    return "Working";
  }
  const name = String(stage);
  if (name.includes("ndjson") || name.includes("stringify")) {
    return "Building NDJSON";
  }
  if (name.includes("zip")) {
    return "Zipping";
  }
  if (name.includes("download")) {
    return "Downloading";
  }
  if (name.includes("prepare") || name.includes("data_ready")) {
    return "Reading data";
  }
  return "Working";
}

function buildFiltersSummary(filters) {
  if (!filters) {
    return "";
  }
  const parts = [];
  if (filters.filter_request_type === "xhr_fetch") {
    parts.push("XHR+Fetch");
  } else if (filters.filter_request_type === "xhr") {
    parts.push("XHR");
  } else if (filters.filter_request_type === "fetch") {
    parts.push("Fetch");
  } else {
    parts.push("All requests");
  }
  if (filters.filter_status_mode === "errors") {
    parts.push("Errors>=400");
  } else if (filters.filter_status_mode === "custom") {
    parts.push(
      filters.filter_status_custom_list
        ? `Status: ${filters.filter_status_custom_list}`
        : "Status: custom"
    );
  } else {
    parts.push("All statuses");
  }
  if (filters.filter_url_contains) {
    parts.push(`contains: ${filters.filter_url_contains}`);
  }
  if (filters.filter_url_excludes) {
    parts.push(`exclude: ${filters.filter_url_excludes}`);
  }
  if (filters.filter_capture_mode === "capture_all_export_filter") {
    parts.push("Capture all");
  } else {
    parts.push("Filtered capture");
  }
  return parts.join(" • ");
}

function setDownloadBanner(message, type = "info") {
  if (!downloadBanner) {
    return;
  }
  if (!message) {
    downloadBanner.textContent = "";
    downloadBanner.classList.add("is-hidden");
    downloadBanner.classList.remove("is-error", "is-info");
    return;
  }
  downloadBanner.textContent = message;
  downloadBanner.classList.remove("is-hidden");
  downloadBanner.classList.toggle("is-error", type === "error");
  downloadBanner.classList.toggle("is-info", type === "info");
}

function setFullPageInProgress(active) {
  fullPageInProgress = Boolean(active);
  if (buttons.fullPageScreenshotMode) {
    buttons.fullPageScreenshotMode.disabled = fullPageInProgress;
  }
  if (!fullPageProgress) {
    return;
  }
  if (!fullPageInProgress) {
    fullPageProgress.textContent = "";
    fullPageProgress.classList.add("is-hidden");
  }
}

function updateFullPageProgress(step, current, total) {
  if (!fullPageProgress) {
    return;
  }
  const label =
    step === "stitch"
      ? "Stitching"
      : step === "capture"
        ? "Capturing"
        : "Preparing";
  const progressText =
    total && current
      ? `Full capture ${current}/${total}… (${label})`
      : `Full capture… (${label})`;
  fullPageProgress.textContent = progressText;
  fullPageProgress.classList.remove("is-hidden");
}

function showStorageLimitModal(state) {
  if (!storageLimitModal) {
    return;
  }
  const completedCount = state.part ? state.part.completedPartsCount || 0 : 0;
  const maxCompleted = state.part ? state.part.maxCompletedParts || 0 : 0;
  if (storageLimitBody) {
    storageLimitBody.textContent =
      `You have ${completedCount} completed parts saved locally (max ${maxCompleted}). ` +
      "Download or delete a completed part to continue capturing.";
  }
  storageLimitModal.classList.remove("hidden");
  storageLimitModal.setAttribute("aria-hidden", "false");
}

function hideStorageLimitModal() {
  if (!storageLimitModal) {
    return;
  }
  storageLimitModal.classList.add("hidden");
  storageLimitModal.setAttribute("aria-hidden", "true");
}

function focusCompletedPartsList() {
  if (!completedPartsList) {
    return;
  }
  completedPartsList.scrollIntoView({ behavior: "smooth", block: "start" });
}

function toggleFiltersSection(forceOpen) {
  if (!filtersBody || !filtersChevron) {
    return;
  }
  const shouldCollapse =
    typeof forceOpen === "boolean"
      ? !forceOpen
      : !filtersBody.classList.contains("collapsed");
  filtersBody.classList.toggle("collapsed", shouldCollapse);
  filtersChevron.textContent = shouldCollapse ? "▸" : "▾";
  filtersToggle?.classList.toggle("open", !shouldCollapse);
  captureFilters.filters_panel_collapsed = shouldCollapse;
  persistFiltersSettings();
}

async function loadCaptureSettings() {
  const settings = await chrome.storage.local.get({
    autoDownloadOnRollover: false,
    partCapRequests: 5000,
    maxBodyKb: 200,
    timestampOverlay: false,
  });
  const partCapRequests = parseInt(settings.partCapRequests, 10);
  const maxBodyKb = parseInt(settings.maxBodyKb, 10);
  captureSettings = {
    autoDownloadOnRollover: settings.autoDownloadOnRollover === true,
    partCapRequests: Number.isFinite(partCapRequests) ? partCapRequests : 5000,
    maxBodyKb: Number.isFinite(maxBodyKb) ? maxBodyKb : 200,
    timestampOverlay: settings.timestampOverlay === true,
  };
  applyCaptureSettingsToUI();
}

async function loadCaptureFilters() {
  const stored = await chrome.storage.local.get({
    repro_capture_filters_v1: null,
  });
  if (stored.repro_capture_filters_v1) {
    captureFilters = {
      ...captureFilters,
      ...stored.repro_capture_filters_v1,
    };
  }
  applyFiltersToUI();
}

async function persistCaptureFilters() {
  await chrome.storage.local.set({
    repro_capture_filters_v1: { ...captureFilters },
  });
}

function parseCustomStatusList(value) {
  const tokens = String(value || "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  const numbers = [];
  for (const token of tokens) {
    if (!/^\d+$/.test(token)) {
      return { ok: false, error: "Use comma-separated status codes (100-599)." };
    }
    const num = Number(token);
    if (num < 100 || num > 599) {
      return { ok: false, error: "Status codes must be 100-599." };
    }
    numbers.push(num);
  }
  const unique = Array.from(new Set(numbers));
  if (unique.length > 30) {
    return { ok: false, error: "Limit custom status codes to 30." };
  }
  return { ok: true, values: unique };
}

function parseExcludeTokens(value) {
  const tokens = String(value || "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  return tokens.slice(0, 20);
}

function updateFilterSummaryText(summary) {
  if (!filtersSummary) {
    return;
  }
  if (!summary) {
    filtersSummary.textContent = "";
    filtersSummary.classList.add("is-hidden");
    return;
  }
  filtersSummary.textContent = summary;
  filtersSummary.classList.remove("is-hidden");
}

function showFilterValidationError(message) {
  if (!filterStatusError) {
    return;
  }
  if (message) {
    filterStatusError.textContent = message;
    filterStatusError.classList.remove("is-hidden");
  } else {
    filterStatusError.textContent = "";
    filterStatusError.classList.add("is-hidden");
  }
}

function readFiltersFromUI() {
  const statusMode = filterStatusMode ? filterStatusMode.value : "all";
  const customList = filterStatusCustomList ? filterStatusCustomList.value : "";
  const customParse =
    statusMode === "custom" ? parseCustomStatusList(customList) : null;
  if (statusMode === "custom" && (!customParse || !customParse.ok)) {
    showFilterValidationError(customParse ? customParse.error : "Invalid list.");
    return { ok: false };
  }
  showFilterValidationError("");
  const excludes = parseExcludeTokens(filterUrlExcludes ? filterUrlExcludes.value : "");
  const requestType = filterRequestType ? filterRequestType.value : "xhr_fetch";
  const captureMode = filterCaptureMode
    ? filterCaptureMode.querySelector("input[type='radio']:checked")?.value ||
      "filtered_capture"
    : "filtered_capture";
  return {
    ok: true,
    filters: {
      requestType,
      statusMode,
      customStatuses: customParse ? customParse.values : [],
      urlContains: filterUrlContains ? filterUrlContains.value.trim() : "",
      urlExcludes: excludes,
      captureMode,
    },
  };
}

async function persistCaptureSettings() {
  await chrome.storage.local.set({
    autoDownloadOnRollover: captureSettings.autoDownloadOnRollover,
    partCapRequests: captureSettings.partCapRequests,
    maxBodyKb: captureSettings.maxBodyKb,
    timestampOverlay: captureSettings.timestampOverlay,
  });
  await send("SET_CAPTURE_SETTINGS", {
    autoDownloadOnRollover: captureSettings.autoDownloadOnRollover,
    partCapRequests: captureSettings.partCapRequests,
    maxBodyKb: captureSettings.maxBodyKb,
  });
}

function assertJsZipAvailable() {
  jszipAvailable = typeof window !== "undefined" && Boolean(window.JSZip);
  if (jszipAvailable) {
    return true;
  }
  console.warn(JSZIP_LOAD_ERROR);
  return false;
}

function getExportStageLabel(stage) {
  switch (stage) {
    case "export_start":
      return "Starting";
    case "prepare_data":
    case "data_ready":
    case "stringify_start":
    case "stringify_done":
      return "Preparing";
    case "zip_add_json":
      return "Packing JSON";
    case "zip_add_screenshots":
      return "Packing screenshots";
    case "zip_add_video":
      return "Adding video";
    case "zip_generate_start":
    case "zip_generate":
    case "zip_generate_done":
      return "Building ZIP";
    case "zip_download":
      return "Downloading";
    default:
      return "Exporting";
  }
}

function startExportUI() {
  exportInProgress = true;
  exportProgressPercent = 0;
  if (!exportButtonLabel && buttons.download) {
    exportButtonLabel = buttons.download.textContent || "Export ZIP";
  }
  if (buttons.download) {
    buttons.download.disabled = true;
    buttons.download.textContent = "Exporting… (0%)";
  }
  if (statusElements.download) {
    setStatus(statusElements.download, "Exporting… (0%)");
  }
}

function updateExportUI(percent, stage) {
  if (!exportInProgress) {
    startExportUI();
  }
  if (typeof percent === "number" && Number.isFinite(percent)) {
    exportProgressPercent = Math.max(0, Math.min(100, Math.round(percent)));
  }
  const stageLabel = getExportStageLabel(stage);
  const label = `Exporting… (${exportProgressPercent}%)`;
  if (buttons.download) {
    buttons.download.textContent = label;
  }
  if (statusElements.download) {
    setStatus(statusElements.download, `${label} — ${stageLabel}`);
  }
}

function finishExportUI(message, type = "success") {
  exportInProgress = false;
  exportProgressPercent = 0;
  if (buttons.download) {
    if (!exportButtonLabel) {
      exportButtonLabel = buttons.download.textContent || "Export ZIP";
    }
    buttons.download.disabled = false;
    buttons.download.textContent = exportButtonLabel;
  }
  if (message && statusElements.download) {
    setStatus(statusElements.download, message, type);
  }
}

function clearStatusError() {
  if (statusElements.message) {
    setStatus(statusElements.message, "-", "default");
  }
}

function showRecordingInfo(message) {
  if (statusElements.download) {
    setStatus(statusElements.download, message, "success");
  }
}

function isRestrictedUrl(url) {
  if (!url) {
    return true;
  }
  return (
    url.startsWith("chrome://") ||
    url.startsWith("edge://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("https://chrome.google.com/webstore") ||
    url.startsWith("https://microsoftedge.microsoft.com/addons")
  );
}

function getActiveTab() {
  return chrome.tabs
    .query({ active: true, currentWindow: true })
    .then((tabs) => (Array.isArray(tabs) ? tabs[0] : null))
    .catch(() => null);
}

function getMediaStreamId(tabId) {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(streamId);
      });
    } catch (error) {
      reject(error);
    }
  });
}

async function send(type, payload = {}) {
  try {
    const res = await chrome.runtime.sendMessage({ type, ...payload });
    if (!res) {
      return { ok: false, error: "No response from service worker." };
    }
    return res;
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

function detectBrowser(userAgent) {
  if (/Edg\//.test(userAgent)) {
    return "edge";
  }
  if (/Chrome\//.test(userAgent)) {
    return "chrome";
  }
  return "chromium";
}

function parseBrowserVersion(userAgent) {
  const edgeMatch = userAgent.match(/Edg\/([\d.]+)/);
  if (edgeMatch) {
    return edgeMatch[1];
  }
  const chromeMatch = userAgent.match(/Chrome\/([\d.]+)/);
  if (chromeMatch) {
    return chromeMatch[1];
  }
  return "unknown";
}

function dataUrlToBlob(dataUrl) {
  const [metadata, base64Data] = dataUrl.split(",");
  const mimeMatch = metadata.match(/data:(.*);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

function formatZipTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

function formatExportTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

async function downloadBlob(blob, filename) {
  if (!chrome.downloads?.download) {
    throw new Error("Downloads API unavailable.");
  }
  const url = URL.createObjectURL(blob);
  try {
    await new Promise((resolve, reject) => {
      chrome.downloads.download({ url, filename, saveAs: false }, (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(downloadId);
      });
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

function pickRecordingMimeType() {
  if (!window.MediaRecorder || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return "";
}

function stopActiveRecordingStream() {
  if (activeRecordingStream) {
    activeRecordingStream.getTracks().forEach((track) => track.stop());
  }
  activeRecordingStream = null;
}

function resetLocalRecording() {
  recordedChunks = [];
  activeMediaRecorder = null;
  stopActiveRecordingStream();
  recordingHasData = false;
  recordingLastError = null;
  recordingState = "idle";
  recordingStopRequestedAt = null;
  recordingDurationMsSnapshot = null;
  resetRecordingTiming();
}

function getRecordingOwnerState() {
  return {
    ok: true,
    state: recordingState,
    startedAt: recordingStartedAt,
    pausedAt: recordingPausedAt,
    totalPausedMs: recordingTotalPausedMs,
    hasData: recordingHasData,
    mimeType: recordingMimeType || "video/webm",
    lastError: recordingLastError,
    elapsedMs: computeRecordingElapsedMs(),
    recorderState: activeMediaRecorder ? activeMediaRecorder.state : "inactive",
    elapsedText: (() => {
      const totalSeconds = Math.max(
        0,
        Math.floor(computeRecordingElapsedMs() / 1000)
      );
      const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
      const seconds = String(totalSeconds % 60).padStart(2, "0");
      return `${minutes}:${seconds}`;
    })(),
  };
}

function setRecordingState(nextState) {
  recordingState = nextState;
}

function resetRecordingTiming() {
  recordingStartedAt = null;
  recordingPausedAt = null;
  recordingTotalPausedMs = 0;
}

function computeRecordingElapsedMs() {
  if (!recordingStartedAt) {
    return 0;
  }
  let end = Date.now();
  if (recordingState === "paused" && recordingPausedAt) {
    end = recordingPausedAt;
  }
  return Math.max(0, end - recordingStartedAt - recordingTotalPausedMs);
}

function sumRecordingChunks(chunks) {
  return chunks.reduce((total, chunk) => total + (chunk && chunk.size ? chunk.size : 0), 0);
}

function createRecordingStopPromise() {
  if (recordingStopPromise) {
    return recordingStopPromise;
  }
  recordingStopPromise = new Promise((resolve) => {
    recordingStopResolver = resolve;
  });
  return recordingStopPromise;
}

function resolveRecordingStopPromise(result) {
  if (recordingStopResolver) {
    recordingStopResolver(result);
  }
  recordingStopPromise = null;
  recordingStopResolver = null;
}

function finalizeStop(message) {
  recordingControlInFlight = false;
  recordingState = "idle";
  recordingPausedAt = null;
  resetRecordingTiming();
  recordingStopReason = null;
  activeMediaRecorder = null;
  if (message) {
    setStatus(statusElements.download, message, "success");
  }
  refreshStatus();
}

async function exportRecordingWebm() {
  const totalBytes = sumRecordingChunks(recordedChunks);
  console.log(
    "[REC] EXPORT requested:",
    `hasData=${recordingHasData}`,
    `chunks=${recordedChunks.length}`,
    `totalBytes=${totalBytes}`
  );
  if (recordingState === "recording" || recordingState === "paused") {
    return { ok: false, error: "Stop recording to download." };
  }
  try {
    console.log(
      "[REC] EXPORT start",
      `mimeType=${recordingMimeType || "video/webm"}`,
      `stoppedAt=${recordingStopRequestedAt ? new Date(recordingStopRequestedAt).toISOString() : "unknown"}`,
      `durationMs=${
        typeof recordingDurationMsSnapshot === "number"
          ? recordingDurationMsSnapshot
          : computeRecordingElapsedMs()
      }`
    );
    let downloadUrl = null;
    let mimeType = recordingMimeType || "video/webm";
    if (recordingHasData && recordedChunks.length > 0) {
      const blob = new Blob(recordedChunks, {
        type: mimeType,
      });
      downloadUrl = URL.createObjectURL(blob);
    } else {
      const fallback = await chrome.storage.session.get({
        recordingWebmDataUrl: null,
        recordingMimeType: null,
      });
      if (fallback.recordingWebmDataUrl) {
        downloadUrl = fallback.recordingWebmDataUrl;
        mimeType = fallback.recordingMimeType || "video/webm";
      }
    }
    if (!downloadUrl) {
      return { ok: false, error: "No recording available to download." };
    }
    const filename = `repro_recording_${formatZipTimestamp(new Date())}.webm`;
    try {
      await new Promise((resolve, reject) => {
        chrome.downloads.download({ url: downloadUrl, filename }, (downloadId) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(downloadId);
        });
      });
    } finally {
      if (downloadUrl && downloadUrl.startsWith("blob:")) {
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);
      }
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error && error.message ? error.message : "Download failed.",
    };
  }
}

function finalizeRecordingBlob(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      await send("RECORDING_COMPLETE", {
        dataUrl,
        mimeType: blob.type,
        size: blob.size,
      });
      const durationMs =
        typeof recordingDurationMsSnapshot === "number"
          ? recordingDurationMsSnapshot
          : computeRecordingElapsedMs();
      try {
        await chrome.storage.session.set({
          recordingWebmDataUrl: dataUrl,
          recordingMimeType: blob.type || "video/webm",
          recordingEndedAt: new Date().toISOString(),
          recordingDurationMs: durationMs,
        });
      } catch (error) {
        recordingLastError = "Failed to store recording.";
      }
      stopActiveRecordingStream();
      resolve({ ok: true });
    };
    reader.onerror = async () => {
      await send("RECORDING_ERROR", {
        error: "Failed to finalize recording.",
      });
      stopActiveRecordingStream();
      recordingLastError = "Failed to finalize recording.";
      resolve({ ok: false, error: "Failed to finalize recording." });
    };
    reader.readAsDataURL(blob);
  });
}

function startMediaRecorderSegment() {
  const options = {};
  const mimeType = pickRecordingMimeType();
  if (mimeType) {
    options.mimeType = mimeType;
  }
  activeMediaRecorder = new MediaRecorder(activeRecordingStream, options);
  recordingMimeType = mimeType || activeMediaRecorder.mimeType || "video/webm";
  console.log("[REC] mimeType chosen=", recordingMimeType);
  activeMediaRecorder.onstart = () => {
    setRecordingState("recording");
    console.log("[REC] START confirmed");
  };
  activeMediaRecorder.onpause = () => {
    recordingPausedAt = Date.now();
    setRecordingState("paused");
    console.log("[REC] PAUSE confirmed");
  };
  activeMediaRecorder.onresume = () => {
    if (recordingPausedAt) {
      recordingTotalPausedMs += Date.now() - recordingPausedAt;
      recordingPausedAt = null;
    }
    setRecordingState("recording");
    console.log("[REC] RESUME confirmed");
  };
  activeMediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
      if (!recordingHasData) {
        recordingHasData = true;
      }
      if (recordedChunks.length === 1) {
        send("RECORDING_DATA_AVAILABLE");
      }
    }
  };
  activeMediaRecorder.onerror = (event) => {
    const errorMessage =
      event.error && event.error.message
        ? event.error.message
        : "Recording failed.";
    recordingLastError = errorMessage;
    setStatus(statusElements.message, `Recording failed: ${errorMessage}`, "error");
    send("RECORDING_ERROR", { error: errorMessage });
  };
  activeMediaRecorder.onstop = async () => {
    if (recordingStopReason === "pause") {
      recordingStopReason = null;
      resolveRecordingStopPromise({ ok: true, paused: true });
      return;
    }
    const stoppedAt = new Date().toISOString();
    const durationMs = computeRecordingElapsedMs();
    recordingDurationMsSnapshot = durationMs;
    const totalBytes = sumRecordingChunks(recordedChunks);
    console.log(
      "[REC] STOP confirmed (onstop fired)",
      `chunks=${recordedChunks.length}`,
      `totalBytes=${totalBytes}`,
      `stoppedAt=${stoppedAt}`,
      `durationMs=${durationMs}`
    );
    const blob = new Blob(recordedChunks, {
      type: recordingMimeType || "video/webm",
    });
    try {
      await finalizeRecordingBlob(blob);
    } finally {
      finalizeStop("Recording stopped.");
      resolveRecordingStopPromise({ ok: true });
    }
  };
  activeMediaRecorder.start(250);
}

function clearRecordingDownloadData() {
  if (recordingObjectUrl) {
    URL.revokeObjectURL(recordingObjectUrl);
  }
  recordingObjectUrl = null;
  recordingMimeType = "video/webm";
  recordingCapturedAt = null;
  chrome.storage.session.remove([
    "latestRecordingUrl",
    "latestRecordingMime",
    "latestRecordingSize",
    "latestRecordingAt",
    "recordingWebmDataUrl",
    "recordingEndedAt",
    "recordingDurationMs",
    "recordingStatusMessage",
  ]);
}

async function setRecordingDownloadData(blob) {
  clearRecordingDownloadData();
  recordingObjectUrl = URL.createObjectURL(blob);
  recordingMimeType = blob.type || "video/webm";
  recordingCapturedAt = new Date().toISOString();
  const durationMs = computeRecordingElapsedMs();
  await chrome.storage.session.set({
    latestRecordingUrl: recordingObjectUrl,
    latestRecordingMime: recordingMimeType,
    latestRecordingSize: blob.size,
    latestRecordingAt: recordingCapturedAt,
    recordingWebmDataUrl: null,
    recordingEndedAt: recordingCapturedAt,
    recordingDurationMs: durationMs,
  });
}

async function loadRecordingDownloadData() {
  const result = await chrome.storage.session.get({
    latestRecordingUrl: null,
    latestRecordingMime: null,
    latestRecordingAt: null,
    recordingWebmDataUrl: null,
    recordingEndedAt: null,
    recordingDurationMs: null,
    recordingStatusMessage: null,
  });
  if (result.latestRecordingUrl) {
    recordingObjectUrl = result.latestRecordingUrl;
    recordingMimeType = result.latestRecordingMime || "video/webm";
    recordingCapturedAt = result.latestRecordingAt || null;
  }
  if (result.recordingStatusMessage) {
    recordingStatusMessage = result.recordingStatusMessage;
  }
}

function getModeButtons() {
  return Array.from(document.querySelectorAll(".segmented .seg-btn"));
}

function getModeControls() {
  return Array.from(document.querySelectorAll(".mode-controls"));
}

function setActiveModeButton(mode) {
  getModeButtons().forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });
}

function setModeButtonDisabled(mode, disabled) {
  const button = document.querySelector(`.segmented .seg-btn[data-mode="${mode}"]`);
  if (button) {
    button.disabled = Boolean(disabled);
  }
}

function setMode(mode) {
  currentMode = mode;
  getModeControls().forEach((block) => {
    const modes = (block.dataset.mode || "")
      .split(" ")
      .map((value) => value.trim())
      .filter(Boolean);
    const isActive = modes.includes(mode);
    block.classList.toggle("active", isActive);
  });
  setActiveModeButton(mode);
  const isScreenshot = mode === "screenshot";
  if (screenshotHint) {
    screenshotHint.classList.toggle("is-hidden", !isScreenshot);
  }
  if (statusTimerRow) {
    statusTimerRow.classList.toggle("is-hidden", isScreenshot);
  }
  if (statusCountsRow) {
    statusCountsRow.classList.toggle("is-hidden", isScreenshot);
  }
  if (downloadControls) {
    downloadControls.classList.toggle("is-hidden", false);
  }
  if (mode === "recording") {
    checkRecordingAvailability();
    refreshStatus();
  } else if (recordingUnavailable) {
    recordingUnavailable.classList.add("hidden");
  }
}

function setRecordingButtons(state) {
  if (recordingControlInFlight) {
    buttons.recordStart.disabled = true;
    buttons.recordPause.disabled = true;
    buttons.recordResume.disabled = true;
    buttons.recordStop.disabled = true;
    buttons.recordStart.classList.add("btn-disabled");
    buttons.recordPause.classList.add("btn-disabled");
    buttons.recordResume.classList.add("btn-disabled");
    buttons.recordStop.classList.add("btn-disabled");
    return;
  }
  if (!recordingAvailable) {
    buttons.recordStart.disabled = true;
    buttons.recordPause.disabled = true;
    buttons.recordResume.disabled = true;
    buttons.recordStop.disabled = true;
    buttons.recordStart.classList.add("btn-disabled");
    buttons.recordPause.classList.add("btn-disabled");
    buttons.recordResume.classList.add("btn-disabled");
    buttons.recordStop.classList.add("btn-disabled");
    if (buttons.recordPanel) {
      buttons.recordPanel.disabled = true;
      buttons.recordPanel.classList.add("is-hidden");
    }
    return;
  }
  if (buttons.recordPanel) {
    buttons.recordPanel.disabled = false;
    buttons.recordPanel.classList.remove("is-hidden");
  }
  const status = state.recordingStatus;
  const startDisabled = status === "recording" || status === "paused";
  const pauseDisabled = status !== "recording";
  const resumeDisabled = status !== "paused";
  const stopDisabled =
    status === "idle" || status === "stopped" || status === "stopping";
  buttons.recordStart.disabled = startDisabled;
  buttons.recordPause.disabled = pauseDisabled;
  buttons.recordResume.disabled = resumeDisabled;
  buttons.recordStop.disabled = stopDisabled;
  buttons.recordStart.classList.toggle("btn-disabled", startDisabled);
  buttons.recordPause.classList.toggle("btn-disabled", pauseDisabled);
  buttons.recordResume.classList.toggle("btn-disabled", resumeDisabled);
  buttons.recordStop.classList.toggle("btn-disabled", stopDisabled);
}

function formatOpacityLabel(value) {
  return `${Math.round(value * 100)}%`;
}

function renderAnnotationOptions() {
  const setOptions = (select, options, formatter) => {
    if (!select) {
      return;
    }
    select.innerHTML = "";
    options.forEach((optionValue) => {
      const option = document.createElement("option");
      option.value = String(optionValue);
      option.textContent = formatter ? formatter(optionValue) : String(optionValue);
      select.appendChild(option);
    });
  };
  setOptions(annotationFontFamily, FONT_OPTIONS);
  setOptions(annotationFontSize, SIZE_OPTIONS);
  setOptions(annotationFontWeight, WEIGHT_OPTIONS);
  setOptions(annotationFontColor, COLOR_OPTIONS);
  setOptions(annotationFontOpacity, OPACITY_OPTIONS, formatOpacityLabel);
}

function mapAnnotationStyleToStorage(style) {
  return normalizeAnnotationStyle(style);
}

function mapAnnotationStyleToUi(style) {
  return normalizeAnnotationStyle(style);
}

function getAnnotationStyleFromUi() {
  return normalizeAnnotationStyle({
    fontFamily: annotationFontFamily
      ? annotationFontFamily.value
      : ANNOTATION_DEFAULTS.fontFamily,
    fontSize: annotationFontSize
      ? Number(annotationFontSize.value)
      : ANNOTATION_DEFAULTS.fontSize,
    fontWeight: annotationFontWeight
      ? annotationFontWeight.value
      : ANNOTATION_DEFAULTS.fontWeight,
    color: annotationFontColor
      ? annotationFontColor.value
      : ANNOTATION_DEFAULTS.color,
    opacity: annotationFontOpacity
      ? Number(annotationFontOpacity.value)
      : ANNOTATION_DEFAULTS.opacity,
  });
}

async function sendAnnotationStyle() {
  const style = getAnnotationStyleFromUi();
  await send(MSG.SET_ANNOTATION_STYLE, {
    style,
    mapped: mapAnnotationStyleToStorage(style),
  });
}

function disableRecordingUI() {
  recordingAvailable = false;
  recordingBlockedReason = "policy";
  setModeButtonDisabled("recording", true);
  if (recordingUnavailable) {
    const shouldShow = currentMode === "recording";
    recordingUnavailable.classList.toggle("hidden", !shouldShow);
  }
  setRecordingButtons({ recordingStatus: "idle" });
}

function enableRecordingUI() {
  recordingAvailable = true;
  recordingBlockedReason = null;
  setModeButtonDisabled("recording", false);
  if (recordingUnavailable) {
    recordingUnavailable.classList.add("hidden");
  }
}

function setRecordingBlocked(reason) {
  recordingAvailable = false;
  recordingBlockedReason = reason;
  setModeButtonDisabled("recording", true);
  if (recordingUnavailable) {
    const shouldShow = currentMode === "recording" && reason === "policy";
    recordingUnavailable.classList.toggle("hidden", !shouldShow);
  }
  setRecordingButtons({ recordingStatus: "idle" });
}

function isPolicyError(message) {
  if (!message) {
    return false;
  }
  const lower = message.toLowerCase();
  return [
    "policy",
    "enterprise",
    "managed",
    "administrator",
    "admin",
    "not allowed",
    "not permitted",
    "blocked",
    "disabled",
  ].some((keyword) => lower.includes(keyword));
}

async function checkRecordingAvailability() {
  const token = ++recordingCheckToken;
  if (recordingBlockedReason === "policy") {
    return;
  }
  let activeTab = null;
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    activeTab = tab;
  } catch (error) {
    activeTab = null;
  }
  if (token !== recordingCheckToken) {
    return;
  }
  if (!activeTab || !activeTab.id || !activeTab.url) {
    enableRecordingUI();
    await refreshStatus();
    return;
  }
  if (isRestrictedUrl(activeTab.url)) {
    setRecordingBlocked("invalid_tab");
    await refreshStatus();
    return;
  }
  if (!chrome?.tabCapture?.getMediaStreamId) {
    setRecordingBlocked("unsupported");
    await refreshStatus();
    return;
  }
  enableRecordingUI();
  await refreshStatus();
}

function disableNetworkUI() {
  networkAvailable = false;
  setModeButtonDisabled("network_console", true);
  if (networkUnavailable) {
    networkUnavailable.classList.remove("hidden");
  }
  if (currentMode === "network_console") {
    setMode("screenshot");
  }
  setNetworkButtons({ networkCount: 0, session: null, networkActive: false });
}

function enableNetworkUI() {
  networkAvailable = true;
  setModeButtonDisabled("network_console", false);
  if (networkUnavailable) {
    networkUnavailable.classList.add("hidden");
  }
}

function setNetworkButtons(state) {
  const session = state.session;
  const isNetworkMode = session && session.mode === "network_console";
  const isCapturing = Boolean(
    session && session.state === "capturing" && isNetworkMode
  );
  const hasRequests = state.networkCount > 0;
  const hasDebuggerAttached = Boolean(
    session &&
      Array.isArray(session.diagnostics) &&
      session.diagnostics.some(
        (entry) => entry && entry.context && entry.context.debuggerAttached === true
      )
  );
  const canStop =
    isNetworkMode && (isCapturing || hasRequests || state.networkActive || hasDebuggerAttached);
  buttons.networkStart.disabled =
    !networkAvailable || Boolean(state.networkActive || isCapturing);
  buttons.networkStop.disabled = !canStop;
}

function applySessionLock(state) {
  const sessionState = state.session ? state.session.state : null;
  const isLocked =
    sessionState === "capturing" ||
    sessionState === "paused" ||
    state.recordingStatus === "recording" ||
    state.recordingStatus === "paused" ||
    state.networkActive;
  if (!isLocked) {
    return;
  }
  const mode =
    (state.session && state.session.mode) ||
    (state.recordingStatus === "recording" || state.recordingStatus === "paused"
      ? "recording"
      : state.networkActive
        ? "network_console"
        : null);
  if (!mode) {
    return;
  }
  if (mode !== "recording") {
    buttons.recordStart.disabled = true;
  }
  if (mode !== "network_console") {
    buttons.networkStart.disabled = true;
  }
  getModeButtons().forEach((button) => {
    button.disabled = button.dataset.mode !== mode;
  });
}

function hasExportableArtifacts(state) {
  if (!state) {
    return false;
  }
  if (state.artifacts && typeof state.artifacts.hasAnyArtifacts === "boolean") {
    return state.artifacts.hasAnyArtifacts;
  }
  if (typeof state.hasArtifacts === "boolean") {
    return state.hasArtifacts;
  }
  return false;
}

function applyStatusMessage(state) {
  if (currentMode === "recording") {
    const sessionState = state.session ? state.session.state : "idle";
    if (recordingStatusMessage) {
      setStatus(statusElements.message, recordingStatusMessage, "default");
      if (controlsStatus) {
        controlsStatus.textContent = recordingStatusMessage;
        controlsStatus.classList.remove("is-hidden");
      }
      return;
    }
    if (recordingBlockedReason === "policy") {
      setStatus(
        statusElements.message,
        "recording_blocked_policy: Recording is unavailable due to browser or enterprise policy. Use Screenshot or Network+Console.",
        "error"
      );
      return;
    }
    if (recordingBlockedReason === "invalid_tab") {
      setStatus(
        statusElements.message,
        "Capture is not supported on browser or store pages. Open a regular website tab and try again.",
        "error"
      );
      return;
    }
    if (recordingBlockedReason === "unsupported") {
      setStatus(
        statusElements.message,
        "Recording not supported: tabCapture.getMediaStreamId is unavailable.",
        "error"
      );
      return;
    }
    if (
      (!state.statusMessage || !state.statusMessage.message) &&
      (sessionState === "idle" || sessionState === "stopped")
    ) {
      setStatus(statusElements.message, "Recording ready.", "success");
      if (controlsStatus) {
        controlsStatus.textContent = "Recording ready.";
        controlsStatus.classList.remove("is-hidden");
      }
      return;
    }
  }
  if (!state.statusMessage || !state.statusMessage.message) {
    statusElements.message.textContent = "-";
    if (controlsStatus) {
      controlsStatus.classList.add("is-hidden");
    }
    if (networkStatusStrip) {
      networkStatusStrip.classList.add("is-hidden");
    }
    return;
  }
  const level = state.statusMessage.level;
  const type =
    level === "error" ? "error" : level === "success" ? "success" : "default";
  setStatus(statusElements.message, state.statusMessage.message, type);
  if (controlsStatus) {
    controlsStatus.textContent = state.statusMessage.message;
    controlsStatus.classList.remove("is-hidden");
  }
  if (networkStatusStrip) {
    networkStatusStrip.textContent = state.statusMessage.message;
    networkStatusStrip.classList.remove("is-hidden");
  }
}

async function showErrorFromResponse(response) {
  const statusMessage =
    (response && response.statusMessage) ||
    (response && response.state ? response.state.statusMessage : null);
  if (statusMessage && statusMessage.message) {
    const level = statusMessage.level;
    const type =
      level === "error"
        ? "error"
        : level === "success"
          ? "success"
          : "default";
    setStatus(statusElements.message, statusMessage.message, type);
    return;
  }
  if (response && response.error) {
    setStatus(statusElements.message, response.error, "error");
  }
}

async function handleFailedResponse(response) {
  const statusMessage =
    (response && response.statusMessage) ||
    (response && response.state ? response.state.statusMessage : null);
  if (statusMessage && statusMessage.message) {
    const level = statusMessage.level;
    const type =
      level === "error"
        ? "error"
        : level === "success"
          ? "success"
          : "default";
    setStatus(statusElements.message, statusMessage.message, type);
    await refreshStatus();
    return;
  }
  if (response && response.error) {
    setStatus(statusElements.message, response.error, "error");
  } else {
    setStatus(statusElements.message, "Request failed.", "error");
  }
  await refreshStatus();
}

function formatElapsed(startIso, endIso) {
  if (!startIso) {
    return "00:00";
  }
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const totalSeconds = Math.max(0, Math.floor((end - start) / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatElapsedWithPauses(session) {
  if (!session || !session.created_at) {
    return "00:00";
  }
  const start = new Date(session.created_at).getTime();
  let end = session.ended_at ? new Date(session.ended_at).getTime() : Date.now();
  const pausedMs = session.total_paused_ms || 0;
  if (session.pause_started_at) {
    const pausedAt = new Date(session.pause_started_at).getTime();
    if (!Number.isNaN(pausedAt)) {
      end = pausedAt;
    }
  }
  const totalSeconds = Math.max(
    0,
    Math.floor((end - start - pausedMs) / 1000)
  );
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatElapsedFromLiveState(liveState, fallbackSession) {
  if (!liveState || !liveState.startedAt) {
    return formatElapsedWithPauses(fallbackSession);
  }
  if (liveState.elapsedText) {
    return liveState.elapsedText;
  }
  const elapsedMs =
    typeof liveState.elapsedMs === "number" ? liveState.elapsedMs : 0;
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function updateStatusUI(state) {
  buttons.screenshot.disabled = false;
  getModeButtons().forEach((button) => {
    button.disabled = false;
  });

  const hasLiveRecording =
    recordingLiveState &&
    (recordingLiveState.state === "recording" ||
      recordingLiveState.state === "paused");
  const hasLiveNetwork = Boolean(state.networkActive);
  const sessionStateRaw = state.session ? state.session.state : null;
  const isSessionActive =
    sessionStateRaw === "capturing" || sessionStateRaw === "paused";
  if (hasLiveRecording) {
    setMode("recording");
  } else if (hasLiveNetwork) {
    setMode("network_console");
  } else if (isSessionActive && state.session && state.session.mode) {
    setMode(state.session.mode);
  }

  const sessionMode =
    (state.session && state.session.mode) ||
    (hasLiveRecording ? "recording" : hasLiveNetwork ? "network_console" : null);
  let sessionState = hasLiveRecording
    ? recordingLiveState.state
    : sessionStateRaw || (hasLiveNetwork ? "capturing" : "idle");
  if (state.logsState === "paused") {
    sessionState = "paused";
  }
  const sessionActive =
    sessionState === "capturing" ||
    sessionState === "paused" ||
    sessionState === "recording";
  const allowScreenshots = currentMode === "screenshot" ? true : sessionActive;
  const modeLabelMap = {
    recording: "Record",
    network_console: "Logs",
    screenshot: "Shot",
  };
  const modeLabel = sessionMode ? modeLabelMap[sessionMode] || sessionMode : "-";
  statusElements.mode.textContent = modeLabel;
  statusElements.state.textContent = sessionState || "idle";

  statusElements.timer.textContent = formatElapsedFromLiveState(
    recordingLiveState,
    state.session
  );

  const counts = state.session ? state.session.counts : null;
  const requestCount = counts ? counts.network_requests : 0;
  const logCount = counts ? counts.console_entries : 0;
  const errorCount = counts ? counts.errors : 0;
  statusElements.counts.textContent = `${requestCount} requests, ${logCount} logs, ${errorCount} errors`;
  if (partProgressStatus) {
    if (state.part && state.part.partNumber) {
      const partNumber = state.part.partNumber || 1;
      const capRequests = state.part.capRequests || captureSettings.partCapRequests;
      const partRequests = state.part.requestsInPart || 0;
      const bytesMb = ((state.part.bytesInPart || 0) / (1024 * 1024)).toFixed(1);
      const completedCount = state.part.completedPartsCount || 0;
      const maxCompleted = state.part.maxCompletedParts || 0;
      partProgressStatus.textContent =
        `Part ${partNumber} — ${partRequests}/${capRequests} req ` +
        `• Stored: ${bytesMb}MB • Completed: ${completedCount}/${maxCompleted}`;
    } else {
      partProgressStatus.textContent = "Part - — 0/0 requests";
    }
  }
  if (exportQueueStatus) {
    const queueLength = state.part ? state.part.exportQueueLength || 0 : 0;
    exportQueueStatus.textContent = `Export queue: ${queueLength}`;
  }
  if (autoDownloadStatusLine) {
    const enabled = state.part ? state.part.autoDownloadOnRollover : false;
    autoDownloadStatusLine.textContent = `Auto-download: ${enabled ? "ON" : "OFF"}`;
  }
  if (nearLimitStatus && state.part) {
    const warnings = [];
    const capRequests = state.part.capRequests || 0;
    const capBytes = state.part.capBytes || 0;
    const reqCount = state.part.requestsInPart || 0;
    const bytes = state.part.bytesInPart || 0;
    if (capRequests && reqCount >= capRequests * 0.8) {
      warnings.push(
        `Approaching cap: ${reqCount}/${capRequests}. Rollover soon.`
      );
    }
    if (capBytes && bytes >= capBytes * 0.8) {
      const mb = (bytes / (1024 * 1024)).toFixed(1);
      const capMb = (capBytes / (1024 * 1024)).toFixed(1);
      warnings.push(
        `Approaching size cap: ${mb}MB/${capMb}MB. Rollover soon.`
      );
    }
    if (warnings.length > 0) {
      nearLimitStatus.textContent = warnings.join(" ");
      nearLimitStatus.classList.remove("is-hidden");
    } else {
      nearLimitStatus.textContent = "";
      nearLimitStatus.classList.add("is-hidden");
    }
  }
  if (sessionMeta) {
    const metaMode = modeLabel === "-" ? "Shot" : modeLabel;
    sessionMeta.textContent = `${metaMode} • ${requestCount} req • ${errorCount} err`;
  }
  if (sessionPill) {
    let pillText = "Idle";
    if (sessionState === "capturing" || sessionState === "recording") {
      pillText = "Live";
    } else if (sessionState === "paused") {
      pillText = "Paused";
    } else if (state.artifacts && state.artifacts.hasAnyArtifacts) {
      pillText = "Ready";
    }
    sessionPill.textContent = pillText;
  }
  if (sessionMeta) {
    const metaMode = modeLabel === "-" ? "Shot" : modeLabel;
    sessionMeta.textContent = `${metaMode} • ${requestCount} req • ${errorCount} err`;
  }
  if (sessionPill) {
    let pillText = "Idle";
    if (sessionState === "capturing" || sessionState === "recording") {
      pillText = "Live";
    } else if (sessionState === "paused") {
      pillText = "Paused";
    } else if (state.artifacts && state.artifacts.hasAnyArtifacts) {
      pillText = "Ready";
    }
    sessionPill.textContent = pillText;
  }

  if (networkTip) {
    let showTip = false;
    if (
      sessionMode === "network_console" &&
      sessionState === "capturing" &&
      requestCount === 0
    ) {
      const startMs =
        state.session && state.session.created_at
          ? Date.parse(state.session.created_at)
          : null;
      if (startMs && Date.now() - startMs > 3000) {
        showTip = true;
      }
    }
    networkTip.classList.toggle("is-hidden", !showTip);
  }

  if (networkGuidance) {
    const showGuidance =
      sessionMode === "network_console" && sessionState === "capturing";
    if (showGuidance && state.statusMessage && state.statusMessage.message) {
      networkGuidance.textContent = state.statusMessage.message;
    }
    networkGuidance.classList.toggle("is-hidden", !showGuidance);
  }

  if (buttons.networkRefresh) {
    const hasActiveTab =
      state.session &&
      state.session.active_tab &&
      state.session.active_tab.tab_id;
    buttons.networkRefresh.disabled =
      currentMode !== "network_console" || !networkAvailable || !hasActiveTab;
  }
  if (buttons.screenshot) {
    buttons.screenshot.disabled = !allowScreenshots;
  }
  if (buttons.download) {
    const disableZip = sessionMode === "network_console";
    buttons.download.disabled = disableZip || exportInProgress;
  }
  if (exportHint) {
    if (sessionMode === "network_console") {
      exportHint.textContent =
        "Use Completed Parts to download network capture.";
      exportHint.classList.remove("is-hidden");
    } else {
      exportHint.classList.add("is-hidden");
    }
  }
  if (downloadHelp) {
    const showHelp =
      sessionMode === "network_console" &&
      (sessionState === "capturing" || sessionState === "paused");
    downloadHelp.classList.toggle("is-hidden", !showHelp);
  }
  setFiltersLocked(sessionMode === "network_console" && sessionState === "capturing");
  if (filtersSummary) {
    const summary = filtersLocked
      ? state.filtersSummary
      : buildFiltersSummary(captureFilters);
    if (summary) {
      filtersSummary.textContent = summary;
      filtersSummary.classList.remove("is-hidden");
    } else {
      filtersSummary.textContent = "";
      filtersSummary.classList.add("is-hidden");
    }
  }
  if (state.part && state.part.pausedForStorageLimit) {
    showStorageLimitModal(state);
  } else {
    hideStorageLimitModal();
  }
  if (state.exportStatus) {
    exportProgressState = {
      partNumber: state.exportStatus.partNumber,
      percent: state.exportStatus.percent,
      phase: state.exportStatus.phase,
    };
  } else if (!exportInProgress) {
    exportProgressState = null;
  }
  updateExportProgressUI();
  if (buttons.fullPageScreenshotMode) {
    buttons.fullPageScreenshotMode.disabled =
      !allowScreenshots || fullPageInProgress;
  }
  if (quickActions) {
    const showQuickActions = currentMode === "screenshot" || sessionActive;
    quickActions.classList.toggle("is-hidden", !showQuickActions);
  }

  const captureActive = sessionActive;
  if (recordingLiveState && recordingLiveState.ok) {
    state.recordingStatus = recordingLiveState.state;
    if (state.artifacts) {
      state.artifacts.hasRecording = Boolean(recordingLiveState.hasData);
      if (recordingLiveState.hasData) {
        state.artifacts.hasAnyArtifacts = true;
      }
    }
  }
  setRecordingButtons(state);
  setNetworkButtons(state);
  applySessionLock(state);
  applyStatusMessage(state);

  const isRecordingMode = currentMode === "recording";
  if (buttons.download) {
    buttons.download.classList.toggle("is-hidden", false);
  }
  if (buttons.downloadRecording) {
    buttons.downloadRecording.classList.toggle("is-hidden", !isRecordingMode);
  }
  if (recordingDownloadHint) {
    recordingDownloadHint.classList.toggle("is-hidden", !isRecordingMode);
  }
  if (buttons.download) {
    buttons.download.disabled = !hasExportableArtifacts(state) || captureActive;
  }
  if (exportHint) {
    if (captureActive) {
      exportHint.textContent = "Stop to export.";
      exportHint.classList.remove("is-hidden");
    } else if (!hasExportableArtifacts(state)) {
      exportHint.textContent = "Nothing to export.";
      exportHint.classList.remove("is-hidden");
    } else {
      exportHint.classList.add("is-hidden");
    }
  }
  if (buttons.downloadRecording) {
    const hasRecording = state.artifacts ? state.artifacts.hasRecording : false;
    const recordingReady =
      hasRecording &&
      state.recordingStatus !== "recording" &&
      state.recordingStatus !== "paused" &&
      !captureActive;
    buttons.downloadRecording.disabled = !recordingReady;
  }

  const hasError = state.session && state.session.state === "error";
  const autoExpand =
    sessionState === "capturing" || sessionState === "paused" || hasError;
  const shouldCollapse =
    currentMode === "screenshot" ||
    ((sessionState === "idle" || sessionState === "stopped") && !hasError);
  if (!statusUserToggled) {
    const collapsed = shouldCollapse && !autoExpand;
    statusBody.classList.toggle("collapsed", collapsed);
    statusChevron.textContent = collapsed ? "▸" : "▾";
  }
}

async function refreshStatus() {
  const response = await send(MSG.GET_STATUS);
  if (!response.ok) {
    setStatus(statusElements.download, response.error, "error");
    return;
  }
  const live = await send(MSG.RECORDING_GET_STATE);
  if (live && live.ok) {
    recordingLiveState = live;
    console.log(
      "[REC][popup] GET_STATE ->",
      `state=${live.state}`,
      `hasData=${live.hasData}`,
      `recorderState=${live.recorderState}`
    );
  } else {
    recordingLiveState = null;
  }
  updateStatusUI(response.state);
  await refreshCompletedParts();
  if (!jszipAvailable) {
    assertJsZipAvailable();
  }
}

async function loadAnnotationStyle() {
  renderAnnotationOptions();
  let current = ANNOTATION_DEFAULTS;
  const response = await send(MSG.GET_ANNOTATION_STYLE);
  if (response && response.ok && response.style) {
    current = mapAnnotationStyleToUi(response.style);
  }
  if (annotationFontFamily) {
    annotationFontFamily.value = current.fontFamily;
  }
  if (annotationFontSize) {
    annotationFontSize.value = String(current.fontSize);
  }
  if (annotationFontWeight) {
    annotationFontWeight.value = current.fontWeight;
  }
  if (annotationFontColor) {
    annotationFontColor.value = current.color;
  }
  if (annotationFontOpacity) {
    annotationFontOpacity.value = String(current.opacity);
  }
  await sendAnnotationStyle();
}

async function handleScreenshot() {
  setStatus(statusElements.message, "Capturing screenshot...");
  const response = await send("CAPTURE_SCREENSHOT");
  if (
    !response.ok ||
    typeof response.screenshotDataUrl !== "string" ||
    !response.screenshotDataUrl.startsWith("data:image/png")
  ) {
    const reason =
      response && response.error
        ? response.error
        : "missing dataUrl";
    setStatus(
      statusElements.message,
      `Screenshot capture failed: ${reason}`,
      "error"
    );
    await refreshStatus();
    return;
  }
  try {
    const annotationStyle = getAnnotationStyleFromUi();
    await chrome.storage.session.set({
      latestScreenshotDataUrl: response.screenshotDataUrl,
      latestScreenshotAnnotationStyle: annotationStyle,
    });
    await chrome.tabs.create({
      url: chrome.runtime.getURL("popup/screenshot_viewer.html"),
    });
    setStatus(statusElements.message, "Saved.", "success");
    showToast("Saved");
  } catch (error) {
    setStatus(
      statusElements.message,
      error && error.message ? error.message : "Failed to open viewer.",
      "error"
    );
  }
  await refreshStatus();
}

async function handleFullPageScreenshot() {
  console.log("[FULL] start");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !tab.url) {
      const message = "No active tab found.";
      setStatus(statusElements.message, message, "error");
      showToast(message, "error");
      return;
    }
    if (!/^https?:\/\//i.test(tab.url) || /\.pdf(\?|#|$)/i.test(tab.url)) {
      const isPdf = /\.pdf(\?|#|$)/i.test(tab.url);
      const message = isPdf
        ? "Full capture isn’t supported on PDFs. Open a regular website tab and try again."
        : "Full capture isn’t supported on this page. Open a regular website tab and try again.";
      setStatus(statusElements.message, message, "error");
      showToast(message, "error");
      return;
    }
  } catch (error) {
    const message =
      error && error.message ? error.message : "Unable to read active tab.";
    setStatus(statusElements.message, message, "error");
    showToast(message, "error");
    return;
  }
  const statusResponse = await send(MSG.GET_STATUS);
  const sessionState =
    statusResponse && statusResponse.state && statusResponse.state.session
      ? statusResponse.state.session.state
      : null;
  const recordingState = recordingLiveState ? recordingLiveState.state : null;
  const captureActive =
    sessionState === "capturing" ||
    sessionState === "paused" ||
    recordingState === "recording" ||
    recordingState === "paused";
  if (currentMode !== "screenshot" && !captureActive) {
    setStatus(
      statusElements.message,
      "Start a session first.",
      "error"
    );
    showToast("Start a session", "error");
    return;
  }
  setStatus(
    statusElements.message,
    "Capturing full page… please don’t scroll.",
    "default"
  );
  setFullPageInProgress(true);
  updateFullPageProgress("prepare", 0, 0);
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const response = await send(MSG.CAPTURE_FULLPAGE, {
    tabId: activeTab && activeTab.id ? activeTab.id : null,
  });
  setFullPageInProgress(false);
  if (!response.ok) {
    const errorInfo = response.error || {};
    const code = errorInfo.code || "UNKNOWN";
    let message =
      errorInfo.message ||
      "Full capture failed. Try again, or use Snap.";
    if (code === "RESTRICTED_PAGE" || code === "CAPTURE_DENIED") {
      message =
        errorInfo.message ||
        "Full capture isn’t supported on this page. Open a regular website tab and try again.";
    } else if (code === "FULLPAGE_ERR_TOO_TALL") {
      message = "Page too tall for full capture. Try Snap or segment capture.";
    } else if (code === "FULLPAGE_ERR_SCROLL_LOCKED") {
      message = "Page prevented scrolling (likely modal/overflow lock).";
    } else if (code === "FULLPAGE_ERR_SCROLL_MISMATCH") {
      message = "Page layout changed during capture. Try again.";
    } else if (code === "FULLPAGE_ERR_CAPTURE_VISIBLE_TAB") {
      message = errorInfo.message || "captureVisibleTab failed.";
    } else if (code === "FULLPAGE_ERR_STITCH_CANVAS_LIMIT") {
      message = "Stitching exceeded canvas limits. Exported in parts.";
    }
    setStatus(statusElements.message, message, "error");
    showToast(message, "error");
    await refreshStatus();
    return;
  }
  if (response.dataUrl && typeof response.dataUrl === "string") {
    try {
      const annotationStyle = getAnnotationStyleFromUi();
      await chrome.storage.session.set({
        latestScreenshotDataUrl: response.dataUrl,
        latestScreenshotAnnotationStyle: annotationStyle,
      });
      await chrome.tabs.create({
        url: chrome.runtime.getURL("popup/screenshot_viewer.html"),
      });
    } catch (error) {
      const message =
        error && error.message ? error.message : "Failed to open viewer.";
      setStatus(statusElements.message, message, "error");
      showToast(message, "error");
      await refreshStatus();
      return;
    }
  } else if (response.parts && Array.isArray(response.parts)) {
    const names = response.parts.map((part) => part.fileName).filter(Boolean);
    const message = names.length
      ? `Full capture exported in parts: ${names.join(", ")}`
      : "Full capture exported in parts.";
    setStatus(statusElements.message, message, "success");
    showToast("Full capture exported");
    await refreshStatus();
    return;
  }
  setStatus(statusElements.message, "Full page screenshot captured.", "success");
  showToast("Full captured");
  await refreshStatus();
}

async function handleRecordingStart() {
  clearStatusError();
  if (recordingBlockedReason === "invalid_tab") {
    setStatus(
      statusElements.message,
      "Capture is not supported on browser or store pages. Open a regular website tab and try again.",
      "error"
    );
    return;
  }
  if (recordingBlockedReason === "policy") {
    setStatus(
      statusElements.message,
      "Recording is unavailable due to browser or enterprise policy.",
      "error"
    );
    return;
  }
  console.log("[REC][popup] start clicked");
  setStatus(statusElements.download, "Starting recording...");
  recordingStatusMessage = null;
  chrome.storage.session.remove(["recordingStatusMessage", "annotationSettings"]);
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    setStatus(statusElements.message, "No active tab.", "error");
    setRecordingButtons({ recordingStatus: "idle" });
    return;
  }
  console.log("[REC][popup] start clicked ->", { tabId: tab.id, url: tab.url });
  if (isRestrictedUrl(tab.url)) {
    setStatus(
      statusElements.message,
      "Capture is not supported on browser or store pages. Open a regular website tab and try again.",
      "error"
    );
    setRecordingButtons({ recordingStatus: "idle" });
    return;
  }
  if (!chrome?.tabCapture?.getMediaStreamId) {
    setStatus(
      statusElements.message,
      "Recording not supported: tabCapture.getMediaStreamId is unavailable.",
      "error"
    );
    setRecordingButtons({ recordingStatus: "idle" });
    return;
  }
  recordingControlInFlight = true;
  setRecordingButtons({ recordingStatus: "idle" });
  let streamId = null;
  try {
    streamId = await getMediaStreamId(tab.id);
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    console.log("[REC][popup] getMediaStreamId failed", message);
    setStatus(
      statusElements.message,
      `Error starting tab capture: ${message}`,
      "error"
    );
    recordingControlInFlight = false;
    setRecordingButtons({ recordingStatus: "idle" });
    return;
  }
  if (!streamId) {
    setStatus(
      statusElements.message,
      "Error starting tab capture: no stream id returned.",
      "error"
    );
    recordingControlInFlight = false;
    setRecordingButtons({ recordingStatus: "idle" });
    return;
  }
  console.log("[REC][popup] getMediaStreamId ok", { streamId });
  const preferredMimeType = pickRecordingMimeType() || "video/webm";
  const res = await send(MSG.RECORDING_START, {
    tabId: tab.id,
    streamId,
    mimeType: preferredMimeType,
  });
  if (!res?.ok) {
    setStatus(
      statusElements.message,
      res?.error
        ? `Failed to start offscreen recorder: ${res.error}`
        : "Failed to start offscreen recorder.",
      "error"
    );
    setRecordingButtons({ recordingStatus: "idle" });
    recordingControlInFlight = false;
    return;
  }
  const st = await send(MSG.RECORDING_GET_STATE);
  if (st && st.ok) {
    recordingLiveState = st;
  }
  showRecordingInfo("Recording started.");
  recordingControlInFlight = false;
  setRecordingButtons({ recordingStatus: st?.state || "recording" });
  await refreshStatus();
}

async function handleRecordingPause() {
  if (recordingControlInFlight) {
    return;
  }
  const res = await send(MSG.RECORDING_PAUSE);
  if (!res.ok) {
    setStatus(
      statusElements.message,
      res.error || "Failed to pause recording.",
      "error"
    );
  }
  const st = await send(MSG.RECORDING_GET_STATE);
  if (st && st.ok) {
    recordingLiveState = st;
  }
  setRecordingButtons({ recordingStatus: st?.state || "idle" });
  await refreshStatus();
}

async function handleRecordingResume() {
  if (recordingControlInFlight) {
    return;
  }
  const res = await send(MSG.RECORDING_RESUME);
  if (!res.ok) {
    setStatus(
      statusElements.message,
      res.error || "Failed to resume recording.",
      "error"
    );
  }
  const st = await send(MSG.RECORDING_GET_STATE);
  if (st && st.ok) {
    recordingLiveState = st;
  }
  setRecordingButtons({ recordingStatus: st?.state || "idle" });
  await refreshStatus();
}

async function handleRecordingStop() {
  if (recordingControlInFlight) {
    return;
  }
  setStatus(statusElements.download, "Stopping recording...");
  const res = await send(MSG.RECORDING_STOP);
  if (!res.ok) {
    setStatus(
      statusElements.message,
      res.error || "Failed to stop recording.",
      "error"
    );
  }
  const st = await send(MSG.RECORDING_GET_STATE);
  if (st && st.ok) {
    recordingLiveState = st;
  }
  setRecordingButtons({ recordingStatus: st?.state || "idle" });
  await refreshStatus();
}

async function handleNetworkStart() {
  setStatus(statusElements.download, "Starting network capture...");
  const filterPayload = getFiltersPayload();
  if (!filterPayload.ok) {
    setStatus(
      statusElements.message,
      "Fix filter settings before starting capture.",
      "error"
    );
    showToast("Fix filter settings before starting capture.", "error");
    return;
  }
  const response = await send("NETWORK_START", {
    filters: filterPayload.filters,
  });
  if (!response.ok) {
    await handleFailedResponse(response);
    if (response.code === "debugger_blocked") {
      disableNetworkUI();
      setStatus(
        statusElements.message,
        "Network+Console is blocked by enterprise policy on this browser.",
        "error"
      );
    }
    await refreshStatus();
    return;
  }
    const baseMessage =
    "Capture started - now Refresh (Ctrl+R) or click a link to capture requests.";
  const warningSuffix =
    response.consoleEnabled === false
      ? " Console capture unavailable (policy blocked). Network capture still running."
      : "";
  const message = `${baseMessage}${warningSuffix}`;
  setStatus(statusElements.message, message, "success");
  if (networkGuidance) {
    networkGuidance.textContent = message;
    networkGuidance.classList.remove("is-hidden");
  }
  setStatus(statusElements.download, "Network capture started.", "success");
  await refreshStatus();
}

async function handleNetworkStop() {
  setStatus(statusElements.download, "Stopping network capture...");
  const response = await send("NETWORK_STOP");
  if (!response.ok) {
    await handleFailedResponse(response);
    await refreshStatus();
    return;
  }
  setStatus(statusElements.download, "Network capture stopped.", "success");
  await refreshStatus();
}

async function buildEnvironmentFallback() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const userAgent = navigator.userAgent;
  let platform = "unknown";
  try {
    const platformInfo = await chrome.runtime.getPlatformInfo();
    platform = platformInfo.os || platform;
  } catch (error) {
    platform = navigator.platform || platform;
  }

  return {
    user_agent: userAgent,
    browser: detectBrowser(userAgent),
    browser_version: parseBrowserVersion(userAgent),
    platform,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown",
    captured_url: tab && tab.url ? tab.url : "",
    captured_title: tab && tab.title ? tab.title : "",
    timestamp: new Date().toISOString(),
  };
}

async function getViewportSnapshot() {
  let activeTab = null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tab;
  } catch (error) {
    activeTab = null;
  }
  const fallback = {
    devicePixelRatio: null,
    viewport: {
      w: activeTab && typeof activeTab.width === "number" ? activeTab.width : null,
      h: activeTab && typeof activeTab.height === "number" ? activeTab.height : null,
    },
  };
  if (
    !activeTab ||
    !activeTab.id ||
    !chrome.scripting ||
    typeof chrome.scripting.executeScript !== "function"
  ) {
    return fallback;
  }
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => ({
        devicePixelRatio:
          typeof window.devicePixelRatio === "number" ? window.devicePixelRatio : null,
        viewport: {
          w: typeof window.innerWidth === "number" ? window.innerWidth : null,
          h: typeof window.innerHeight === "number" ? window.innerHeight : null,
        },
      }),
    });
    if (result && result.result) {
      return {
        devicePixelRatio:
          typeof result.result.devicePixelRatio === "number"
            ? result.result.devicePixelRatio
            : null,
        viewport: {
          w:
            result.result.viewport && typeof result.result.viewport.w === "number"
              ? result.result.viewport.w
              : fallback.viewport.w,
          h:
            result.result.viewport && typeof result.result.viewport.h === "number"
              ? result.result.viewport.h
              : fallback.viewport.h,
        },
      };
    }
  } catch (error) {
    return fallback;
  }
  return fallback;
}

async function addZipItemsInChunks(zip, items, options = {}) {
  const batchSize = options.batchSize || 25;
  const onProgress = options.onProgress || null;
  let completed = 0;
  for (const item of items) {
    const data = await item.getData();
    zip.file(item.path, data);
    completed += 1;
    if (onProgress) {
      onProgress(completed, items.length);
    }
    if (completed % batchSize === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
}

async function handleDownload() {
  if (exportInProgress) {
    return;
  }
  let hadError = false;
  try {
    const statusResponse = await send(MSG.GET_STATUS);
    if (!statusResponse.ok) {
      setStatus(statusElements.download, statusResponse.error, "error");
      hadError = true;
      return;
    }
    if (
      statusResponse.state.artifacts &&
      !statusResponse.state.artifacts.hasAnyArtifacts
    ) {
      setStatus(statusElements.download, "No artifacts to export.", "error");
      hadError = true;
      return;
    }

    if (
      statusResponse.state.recordingStatus === "recording" ||
      statusResponse.state.recordingStatus === "paused"
    ) {
      setStatus(
        statusElements.download,
        "Stop recording before downloading.",
        "error"
      );
      hadError = true;
      return;
    }
    if (
      statusResponse.state.session &&
      (statusResponse.state.session.state === "capturing" ||
        statusResponse.state.session.state === "paused")
    ) {
      setStatus(
        statusElements.download,
        "Stop capture before downloading.",
        "error"
      );
      hadError = true;
      return;
    }

    const timezone =
      Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
    const viewportSnapshot = await getViewportSnapshot();
    const requestedExportTimestamp = formatExportTimestamp(new Date());
    startExportUI();
    const exportResponse = await send(EXPORT_EVENTS.REQUEST, {
      timezone,
      exportTimestamp: requestedExportTimestamp,
      devicePixelRatio: viewportSnapshot.devicePixelRatio,
      viewport: viewportSnapshot.viewport,
      sessionId:
        statusResponse.state.session && statusResponse.state.session.session_id
          ? statusResponse.state.session.session_id
          : null,
    });
    if (!exportResponse.ok || exportResponse.accepted !== true) {
      setStatus(
        statusElements.download,
        exportResponse.error || "Export could not be started.",
        "error"
      );
      hadError = true;
      return;
    }
    setStatus(
      statusElements.download,
      "Export queued…",
      "success"
    );
    setDownloadBanner(null);
  } catch (error) {
    hadError = true;
    setStatus(
      statusElements.download,
      error && error.message ? error.message : "Download failed.",
      "error"
    );
  } finally {
    if (hadError) {
      finishExportUI("Export failed to start.", "error");
    }
    await refreshStatus();
  }
}

async function handleDownloadPart(partId) {
  if (!partId) {
    return;
  }
  try {
    const response = await send("EXPORT_PART", { partId });
    if (!response.ok) {
      setStatus(
        statusElements.download,
        response.error || "Export could not be started.",
        "error"
      );
      return;
    }
    setStatus(
      statusElements.download,
      "Export queued…",
      "success"
    );
    setDownloadBanner(null);
  } catch (error) {
    setStatus(
      statusElements.download,
      error && error.message ? error.message : "Export failed to start.",
      "error"
    );
  }
}

async function handleDeletePart(partId, partNumber) {
  if (!partId || exportInProgress) {
    return;
  }
  const confirmDelete = window.confirm(
    `Delete Part ${partNumber || ""} from local storage? This cannot be undone.`
  );
  if (!confirmDelete) {
    return;
  }
  const response = await send("DELETE_PART", { partId });
  if (!response.ok) {
    setStatus(
      statusElements.message,
      response.error || "Failed to delete part.",
      "error"
    );
    return;
  }
  await refreshCompletedParts();
  await refreshStatus();
  setStatus(statusElements.message, "Part deleted.", "success");
}

async function handleClearAll() {
  hideStorageLimitModal();
  const confirmClear = window.confirm(
    "Clear all locally stored capture data (all parts)? This cannot be undone."
  );
  if (!confirmClear) {
    return;
  }
  const response = await send("CLEAR_ALL_CAPTURE_DATA");
  if (!response.ok) {
    setStatus(
      statusElements.message,
      response.error || "Failed to clear data.",
      "error"
    );
    return;
  }
  await refreshCompletedParts();
  await refreshStatus();
  setStatus(statusElements.message, "Cleared local capture data.", "success");
}

async function handleRecordingDownload() {
  clearStatusError();
  const live = await send(MSG.RECORDING_GET_STATE);
  if (live && live.ok && (live.state === "recording" || live.state === "paused")) {
    setStatus(statusElements.download, "Stop recording to download.", "error");
    return;
  }
  setStatus(statusElements.download, "Preparing download...");
  try {
    const res = await send(MSG.RECORDING_EXPORT_WEBM);
    if (!res?.ok || !res.blobUrl) {
      setStatus(
        statusElements.download,
        res?.error || "No recording available to download.",
        "error"
      );
      return;
    }
    if (!chrome.downloads?.download) {
      setStatus(statusElements.download, "Downloads API unavailable.", "error");
      return;
    }
    const exportTimestamp = formatExportTimestamp(new Date());
    await new Promise((resolve, reject) => {
      chrome.downloads.download(
        {
          url: res.blobUrl,
          filename: `qa-session-video-${exportTimestamp}.webm`,
          saveAs: false,
        },
        (downloadId) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(downloadId);
        }
      );
    });
    setStatus(statusElements.download, "Saved.", "success");
    showToast("Saved");
  } catch (error) {
    setStatus(
      statusElements.download,
      error && error.message ? error.message : "Download failed.",
      "error"
    );
  }
}

async function handleNetworkRefresh() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw new Error("No active tab to refresh.");
    }
    await chrome.tabs.reload(tab.id);
    setStatus(statusElements.message, "Refreshing tab...", "success");
  } catch (error) {
    setStatus(
      statusElements.message,
      error && error.message ? error.message : "Unable to refresh the active tab.",
      "error"
    );
  }
}

function toggleStatusSection() {
  if (!statusBody || !statusChevron) {
    return;
  }
  const collapsed = statusBody.classList.toggle("collapsed");
  statusChevron.textContent = collapsed ? "▸" : "▾";
  statusUserToggled = true;
}

function toggleAnnotationSection() {
  if (!annotationBody || !annotationChevron || !annotationToggle) {
    return;
  }
  annotationCollapsed = !annotationCollapsed;
  annotationBody.classList.toggle("collapsed", annotationCollapsed);
  annotationChevron.textContent = annotationCollapsed ? "▸" : "▾";
  annotationToggle.classList.toggle("open", !annotationCollapsed);
}

async function handleRedactionToggle(checked) {
  await chrome.storage.local.set({ redactionEnabled: checked });
  redactionStatus.textContent = checked ? "ON" : "OFF";
}

async function handleOpenRecordingPanel() {
  await send("OPEN_RECORDING_PANEL");
  await refreshStatus();
}

function routeAction(action, el) {
  if (!action) {
    return;
  }
  if (CLICK_DEBUG) {
    console.log("[UI] action:", action);
  }
  if (action === "screenshot:full") {
    console.log("[UI] screenshot:full click", {
      id: el && el.id ? el.id : null,
      action: el && el.dataset ? el.dataset.action : action,
    });
  }
  if (action.startsWith("mode:")) {
    const mode = action.split(":")[1];
    void persistLastSelectedMode(mode);
    setMode(mode);
    return;
  }
  switch (action) {
    case "help:open":
      openHelp();
      break;
    case "help:close":
      closeHelp();
      break;
    case "help:gotit":
      closeHelp();
      break;
    case "filters:toggle":
      toggleFiltersSection();
      break;
    case "recording:start":
      handleRecordingStart();
      break;
    case "recording:pause":
      handleRecordingPause();
      break;
    case "recording:resume":
      handleRecordingResume();
      break;
    case "recording:stop":
      handleRecordingStop();
      break;
    case "recording:panel":
      handleOpenRecordingPanel();
      break;
    case "network:start":
      handleNetworkStart();
      break;
    case "network:stop":
      handleNetworkStop();
      break;
    case "network:refresh":
      handleNetworkRefresh();
      break;
    case "screenshot:snap":
      handleScreenshot();
      break;
    case "screenshot:full":
      handleFullPageScreenshot();
      break;
    case "part:download":
      handleDownloadPart(el.dataset.partId);
      break;
    case "part:delete":
      handleDeletePart(el.dataset.partId, el.dataset.partNumber);
      break;
    case "storage:download":
      hideStorageLimitModal();
      focusCompletedPartsList();
      break;
    case "storage:delete":
      hideStorageLimitModal();
      focusCompletedPartsList();
      break;
    case "storage:clear":
      hideStorageLimitModal();
      handleClearAll();
      break;
    case "storage:clear_all":
      handleClearAll();
      break;
    case "storage:close":
      hideStorageLimitModal();
      break;
    case "export:zip":
      handleDownload();
      break;
    case "export:webm":
      handleRecordingDownload();
      break;
    case "session:reset":
      handleResetSession();
      break;
    case "status:toggle":
      toggleStatusSection();
      break;
    case "annotations:toggle":
      toggleAnnotationSection();
      break;
    default:
      break;
  }
}

async function routeChange(action, el) {
  if (!action) {
    return;
  }
  if (CLICK_DEBUG) {
    console.log("[UI] change:", action);
  }
  switch (action) {
    case "filters:update":
      if (filtersLocked) {
        showToast("Stop capture to change filters.", "error");
        applyFiltersToUI();
        break;
      }
      captureFilters.filter_request_type = filterRequestType
        ? filterRequestType.value
        : captureFilters.filter_request_type;
      captureFilters.filter_status_mode = filterStatusMode
        ? filterStatusMode.value
        : captureFilters.filter_status_mode;
      captureFilters.filter_status_custom_list = filterStatusCustomList
        ? filterStatusCustomList.value
        : captureFilters.filter_status_custom_list;
      captureFilters.filter_url_contains = filterUrlContains
        ? filterUrlContains.value
        : captureFilters.filter_url_contains;
      captureFilters.filter_url_excludes = filterUrlExcludes
        ? filterUrlExcludes.value
        : captureFilters.filter_url_excludes;
      if (filterCaptureMode) {
        const selected = filterCaptureMode.querySelector("input:checked");
        captureFilters.filter_capture_mode = selected
          ? selected.value
          : captureFilters.filter_capture_mode;
      }
      applyFiltersToUI();
      validateFilters();
      await persistFiltersSettings();
      break;
    case "redaction:toggle":
      handleRedactionToggle(el.checked);
      break;
    case "part:auto_download":
      captureSettings.autoDownloadOnRollover = Boolean(el.checked);
      applyCaptureSettingsToUI();
      await persistCaptureSettings();
      break;
    case "part:cap_requests":
      captureSettings.partCapRequests = parseInt(el.value, 10) || 5000;
      applyCaptureSettingsToUI();
      await persistCaptureSettings();
      break;
    case "part:max_body":
      captureSettings.maxBodyKb = parseInt(el.value, 10) || 200;
      applyCaptureSettingsToUI();
      await persistCaptureSettings();
      break;
    case "overlay:toggle":
      captureSettings.timestampOverlay = Boolean(el.checked);
      applyCaptureSettingsToUI();
      await chrome.storage.local.set({
        timestampOverlay: captureSettings.timestampOverlay,
      });
      await send("SET_TIMESTAMP_OVERLAY", {
        enabled: captureSettings.timestampOverlay,
      });
      setStatus(
        statusElements.message,
        captureSettings.timestampOverlay
          ? "Timestamp overlay enabled."
          : "Timestamp overlay disabled.",
        "success"
      );
      break;
    case "annotation:style":
      sendAnnotationStyle();
      break;
    default:
      break;
  }
}

function openHelp() {
  if (!helpModal) {
    return;
  }
  helpReturnFocusEl = document.activeElement;
  helpModal.classList.remove("hidden");
  helpModal.setAttribute("aria-hidden", "false");
  helpIsOpen = true;
  if (helpCloseButton) {
    helpCloseButton.focus();
  }
}

function closeHelp() {
  if (!helpModal) {
    return;
  }
  helpModal.classList.add("hidden");
  helpModal.setAttribute("aria-hidden", "true");
  helpIsOpen = false;
  if (helpReturnFocusEl && helpReturnFocusEl.focus) {
    helpReturnFocusEl.focus();
  } else if (helpButton) {
    helpButton.focus();
  }
}

async function persistLastSelectedMode(mode) {
  await chrome.storage.local.set({ lastSelectedMode: mode });
}

async function loadLastSelectedMode() {
  const result = await chrome.storage.local.get({
    lastSelectedMode: "screenshot",
  });
  return result.lastSelectedMode || "screenshot";
}

document.addEventListener("click", (event) => {
  const actionEl = event.target.closest("[data-action]");
  if (!actionEl) {
    if (CLICK_DEBUG) {
      const top = document.elementsFromPoint(event.clientX, event.clientY)[0];
      if (top) {
        top.style.outline = "2px solid #f59e0b";
        setTimeout(() => {
          top.style.outline = "";
        }, 500);
      }
    }
    return;
  }
  if (actionEl.disabled) {
    return;
  }
  routeAction(actionEl.dataset.action, actionEl);
});

document.addEventListener("change", (event) => {
  const actionEl = event.target.closest("[data-action]");
  if (!actionEl) {
    return;
  }
  routeChange(actionEl.dataset.action, actionEl);
});


document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && helpIsOpen) {
    closeHelp();
  }
});

async function handleResetSession() {
  await send(MSG.RECORDING_RESET);
  await send(MSG.NETWORK_RESET);
  const response = await send(MSG.RESET_SESSION);
  if (!response.ok) {
    setStatus(statusElements.download, response.error, "error");
    await refreshStatus();
    return;
  }
  recordingStatusMessage = null;
  chrome.storage.session.remove(["recordingStatusMessage"]);
  clearRecordingDownloadData();
  setStatus(statusElements.message, "Ready.", "default");
  setStatus(statusElements.download, "Session reset.", "success");
  await refreshStatus();
}

async function loadRedactionSetting() {
  const result = await chrome.storage.local.get({ redactionEnabled: true });
  const enabled = result.redactionEnabled !== false;
  redactionToggle.checked = enabled;
  redactionStatus.textContent = enabled ? "ON" : "OFF";
}

async function loadRecordingAvailability() {
  const res = await send(MSG.GET_CAPABILITIES);
  const tabCaptureAvailable = Boolean(
    res && res.ok && res.capabilities && res.capabilities.tabCaptureAvailable
  );
  if (!res.ok || !tabCaptureAvailable) {
    enableRecordingUI();
    return res;
  }
  enableRecordingUI();
  return res;
}

async function probeRecordingAvailability() {
  if (currentMode !== "recording") {
    return;
  }
  await checkRecordingAvailability();
}

async function loadNetworkAvailability(capabilities, tabId) {
  const statusResponse = await send(MSG.GET_STATUS);
  const statusState = statusResponse && statusResponse.ok ? statusResponse.state : null;
  const captureActive =
    statusState &&
    statusState.session &&
    statusState.session.mode === "network_console" &&
    (statusState.session.state === "capturing" || statusState.networkActive);
  if (captureActive) {
    enableNetworkUI();
    return;
  }
  const debuggerPresent = Boolean(
    capabilities && capabilities.debuggerApiPresent
  );
  if (!debuggerPresent) {
    disableNetworkUI();
    return;
  }

  const probe = await send("PROBE_DEBUGGER", { tabId });
  if (probe.ok && probe.debuggerAttachAllowed === false) {
    disableNetworkUI();
    return;
  }

  enableNetworkUI();
}

async function initCapabilities() {
  const res = await loadRecordingAvailability();
  if (!res || !res.ok) {
    return;
  }
  let tabId = null;
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    tabId = tab && tab.id ? tab.id : null;
  } catch (error) {
    tabId = null;
  }
  await probeRecordingAvailability();
  await loadNetworkAvailability(res.capabilities, tabId);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "RECORDING_STATE_CHANGED") {
    (async () => {
      await refreshStatus();
      sendResponse({ ok: true });
    })().catch((error) =>
      sendResponse({ ok: false, error: error.message || "Update failed." })
    );
    return true;
  }
  if (message.type === "EXPORT_STARTED") {
    if (!exportInProgress && !message.partNumber) {
      startExportUI();
    }
    exportProgressState = {
      partNumber: message.partNumber || null,
      percent: 0,
      phase: "Starting",
    };
    updateExportProgressUI();
    setStatus(statusElements.download, "Export started.", "success");
    sendResponse({ ok: true });
    return true;
  }
  if (message.type === "EXPORT_PROGRESS") {
    exportProgressState = {
      partNumber: message.partNumber || null,
      percent:
        typeof message.percent === "number" ? message.percent : 0,
      phase: message.phase || "Working",
    };
    updateExportProgressUI();
    sendResponse({ ok: true });
    return true;
  }
  if (message.type === "FULLPAGE_PROGRESS") {
    if (!fullPageInProgress) {
      setFullPageInProgress(true);
    }
    updateFullPageProgress(message.step, message.current, message.total);
    sendResponse({ ok: true });
    return true;
  }
  if (message.type === "EXPORT_DONE") {
    if (!message.partNumber) {
      finishExportUI("Export complete.", "success");
    } else {
      setStatus(statusElements.download, "Export complete.", "success");
    }
    showToast("Exported");
    refreshCompletedParts();
    lastExportResultAt = Date.now();
    exportProgressState = null;
    updateExportProgressUI();
    setDownloadBanner(null);
    sendResponse({ ok: true });
    return true;
  }
  if (message.type === "EXPORT_FAILED") {
    if (!message.partNumber) {
      finishExportUI(message.userMessage || "Export failed.", "error");
    } else {
      setStatus(
        statusElements.download,
        message.userMessage || "Export failed.",
        "error"
      );
    }
    refreshCompletedParts();
    lastExportResultAt = Date.now();
    exportProgressState = null;
    updateExportProgressUI();
    setDownloadBanner(
      message.userMessage || "Export failed. Retry download.",
      "error"
    );
    sendResponse({ ok: true });
    return true;
  }
  if (message.type === EXPORT_EVENTS.PROGRESS) {
    updateExportUI(message.percent, message.stage);
    exportProgressState = {
      partNumber: message.partNumber || null,
      percent:
        typeof message.percent === "number" ? message.percent : 0,
      phase: mapStageToPhase(message.stage),
    };
    updateExportProgressUI();
    sendResponse({ ok: true });
    return true;
  }
  if (message.type === EXPORT_EVENTS.DONE) {
    if (Date.now() - lastExportResultAt < 1000) {
      sendResponse({ ok: true });
      return true;
    }
    finishExportUI("Export complete.", "success");
    showToast("Exported");
    refreshCompletedParts();
    lastExportResultAt = Date.now();
    exportProgressState = null;
    updateExportProgressUI();
    setDownloadBanner(null);
    sendResponse({ ok: true });
    return true;
  }
  if (message.type === EXPORT_EVENTS.ERROR) {
    if (Date.now() - lastExportResultAt < 1000) {
      sendResponse({ ok: true });
      return true;
    }
    finishExportUI(message.userMessage || "Export failed.", "error");
    refreshCompletedParts();
    lastExportResultAt = Date.now();
    exportProgressState = null;
    updateExportProgressUI();
    setDownloadBanner(
      message.userMessage || "Export failed. Retry download.",
      "error"
    );
    sendResponse({ ok: true });
    return true;
  }
  if (message.type === "CAPTURE_PART_STATUS") {
    (async () => {
      await refreshStatus();
      sendResponse({ ok: true });
    })().catch((error) =>
      sendResponse({ ok: false, error: error.message || "Update failed." })
    );
    return true;
  }
  if (message.type === "EXPORT_QUEUE_UPDATE") {
    (async () => {
      await refreshStatus();
      sendResponse({ ok: true });
    })().catch((error) =>
      sendResponse({ ok: false, error: error.message || "Update failed." })
    );
    return true;
  }
  if (message.type === "EXPORT_PART_FAILED") {
    finishExportUI(message.userMessage || "Download failed.", "error");
    (async () => {
      await refreshCompletedParts();
    })();
    sendResponse({ ok: true });
    return true;
  }
  return false;
});

async function initPopup() {
  const manifest = chrome.runtime.getManifest();
  const appName = manifest && manifest.name ? manifest.name : "Repro";
  const headerText = `${appName} — ${APP_TAGLINE}`;
  if (appTitleEl) {
    appTitleEl.textContent = headerText;
  }
  if (appIconEl) {
    appIconEl.src = chrome.runtime.getURL("assets/icon32.png");
    appIconEl.alt = appName;
  }
  document.title = headerText;
  assertJsZipAvailable();
  const lastMode = await loadLastSelectedMode();
  currentMode = lastMode;
  setMode(currentMode);
  await loadRedactionSetting();
  await loadCaptureSettings();
  await loadFiltersSettings();
  await loadAnnotationStyle();
  await initCapabilities();
  await refreshStatus();
  setInterval(refreshStatus, 1000);
  if (versionBadge) {
    versionBadge.textContent = APP_VERSION;
  }
  await loadRecordingDownloadData();
  if (filtersBody) {
    filtersBody.addEventListener("click", () => {
      if (filtersLocked) {
        showToast("Stop capture to change filters.", "error");
      }
    });
  }
}

initPopup();
