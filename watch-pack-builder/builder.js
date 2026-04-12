const openZipBtn = document.getElementById("openZipBtn");
const zipInput = document.getElementById("zipInput");
const generateBtn = document.getElementById("generateBtn");
const fileSummary = document.getElementById("fileSummary");
const builderError = document.getElementById("builderError");

const state = {
  zip: null,
  files: null,
  sessionLogName: null,
  summaryName: null,
  environmentName: null,
  videoName: null,
  screenshotNames: [],
  sessionLog: null,
};

function showError(message) {
  builderError.textContent = message;
  builderError.classList.remove("hidden");
}

function clearError() {
  builderError.textContent = "";
  builderError.classList.add("hidden");
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
    return generic[0];
  }
  return null;
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

function computeDurationMs(session, events) {
  if (session?.startedAt && session?.endedAt) {
    const duration = Date.parse(session.endedAt) - Date.parse(session.startedAt);
    if (Number.isFinite(duration) && duration > 0) {
      return duration;
    }
  }
  return events.reduce((acc, ev) => Math.max(acc, ev.t_ms || 0), 0);
}

function buildCanonicalEvents(normalizedEvents = []) {
  return normalizedEvents.map((ev, index) => {
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
    const summary = ev.msg || "";
    const status = ev.data?.status;
    return {
      id: ev.id || `evt_${String(index).padStart(6, "0")}`,
      t_ms: typeof ev.t_ms === "number" ? ev.t_ms : 0,
      type,
      summary,
      payload: ev.data || {},
      refs: {
        screenshotFile: ev.data?.fileName || null,
        requestId: ev.corr?.requestId || null,
      },
      isError:
        ev.level === "error" ||
        ev.kind === "error" ||
        (type === "network" && typeof status === "number" && status >= 400),
      no_time: typeof ev.t_ms !== "number",
    };
  });
}

function buildEventsFromRaw(raw) {
  const events = [];
  const markers = raw?.markers || [];
  markers.forEach((marker, index) => {
    events.push({
      id: `evt_marker_${index}`,
      t_ms: typeof marker.t_ms === "number" ? marker.t_ms : 0,
      type: "marker",
      summary: `Marker: ${marker.note || "(no note)"}`,
      payload: marker,
      refs: {},
      isError: false,
      no_time: typeof marker.t_ms !== "number",
    });
  });
  const screenshots = raw?.screenshots || [];
  screenshots.forEach((shot, index) => {
    events.push({
      id: `evt_shot_${index}`,
      t_ms: typeof shot.t_ms === "number" ? shot.t_ms : 0,
      type: "screenshot",
      summary: `Screenshot: ${shot.fileName || "image"}`,
      payload: shot,
      refs: { screenshotFile: shot.fileName || null },
      isError: false,
      no_time: typeof shot.t_ms !== "number",
    });
  });
  const network = raw?.network || [];
  network.forEach((entry, index) => {
    const status = entry.response_status;
    const summary = `${entry.method || ""} ${
      typeof status === "number" ? status : ""
    } ${entry.url || ""}`.trim();
    events.push({
      id: `evt_net_${index}`,
      t_ms: 0,
      type: "network",
      summary,
      payload: entry,
      refs: { requestId: entry.request_id || null },
      isError: typeof status === "number" && status >= 400,
      no_time: true,
    });
  });
  const consoleEntries = raw?.console || [];
  consoleEntries.forEach((entry, index) => {
    const summary = `${(entry.level || "log").toUpperCase()}: ${
      entry.message || ""
    }`.trim();
    events.push({
      id: `evt_con_${index}`,
      t_ms: 0,
      type: "console",
      summary,
      payload: entry,
      refs: {},
      isError: entry.level === "error",
      no_time: true,
    });
  });
  return events;
}

async function summarizeZip() {
  const summary = [
    `Session log: ${state.sessionLogName || "none"}`,
    `Summary: ${state.summaryName || "none"}`,
    `Environment: ${state.environmentName || "none"}`,
    `Video: ${state.videoName || "none"}`,
    `Screenshots: ${state.screenshotNames.length}`,
  ];
  fileSummary.textContent = summary.join(" • ");
}

async function loadZip(file) {
  clearError();
  fileSummary.textContent = "Loading ZIP...";
  if (!window.JSZip) {
    showError("JSZip failed to load. Ensure vendor/jszip.min.js exists.");
    return;
  }
  const zip = await JSZip.loadAsync(file);
  state.zip = zip;
  state.files = zip.files;
  state.sessionLogName = selectSessionLogFile(zip.files);
  state.summaryName = findFile(zip.files, /qa-summary.*\.txt$/i);
  state.environmentName = findFile(zip.files, /environment\.json$/i);
  state.videoName = findFile(
    zip.files,
    /(qa-session-video|debugduck-recording)-.*\.webm$/i
  );
  state.screenshotNames = listScreenshotFiles(zip.files);

  if (state.sessionLogName) {
    const raw = await zip.file(state.sessionLogName).async("string");
    state.sessionLog = JSON.parse(raw);
  }
  await summarizeZip();
  generateBtn.disabled = false;
}

async function buildPackZip() {
  if (!state.zip) {
    showError("Load an Evidence ZIP first.");
    return;
  }
  const out = new JSZip();
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(
    now.getMinutes()
  ).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  const root = `debugduck-watch-pack-${stamp}`;

  const templateFiles = [
    "index.html",
    "app.js",
    "styles.css",
    "vendor/jszip.min.js",
  ];
  for (const fileName of templateFiles) {
    const response = await fetch(`../watch-pack-template/${fileName}`);
    const text = await response.text();
    out.file(`${root}/${fileName}`, text);
  }

  const assets = out.folder(`${root}/assets`);
  let session = state.sessionLog?.session || {};
  let normalizedEvents = state.sessionLog?.normalizedEvents || [];
  let events = normalizedEvents.length
    ? buildCanonicalEvents(normalizedEvents)
    : buildEventsFromRaw(state.sessionLog?.raw);
  events.sort((a, b) => a.t_ms - b.t_ms);
  const durationMs = computeDurationMs(session, events);

  const counts = {
    network: events.filter((e) => e.type === "network").length,
    console: events.filter((e) => e.type === "console").length,
    marker: events.filter((e) => e.type === "marker").length,
    screenshot: events.filter((e) => e.type === "screenshot").length,
    errors: events.filter((e) => e.isError).length,
  };

  const screenshots = events
    .filter((e) => e.type === "screenshot")
    .map((e) => ({ fileName: e.refs?.screenshotFile, t_ms: e.t_ms }));

  const sessionLog = {
    packName: root,
    session: {
      startedAt: session.startedAt || null,
      endedAt: session.endedAt || null,
      durationMs,
      tabId: session.tabId || null,
    },
    events,
    counts,
    assets: {
      hasVideo: Boolean(state.videoName),
      screenshots,
    },
  };

  assets.file("session-log.json", JSON.stringify(sessionLog, null, 2));
  if (state.summaryName) {
    const summaryText = await state.zip.file(state.summaryName).async("string");
    assets.file("summary.txt", summaryText);
  }
  if (state.environmentName) {
    const envText = await state.zip.file(state.environmentName).async("string");
    assets.file("environment.json", envText);
  }
  if (state.videoName) {
    const videoBlob = await state.zip.file(state.videoName).async("blob");
    assets.file("video.webm", videoBlob);
  }
  if (state.screenshotNames.length) {
    for (const shot of state.screenshotNames) {
      const blob = await state.zip.file(shot).async("blob");
      const fileName = shot.split("/").pop();
      assets.file(`screenshots/${fileName}`, blob);
    }
  }

  const zipBlob = await out.generateAsync({ type: "blob", compression: "STORE" });
  const url = URL.createObjectURL(zipBlob);
  const filename = `debugduck-watch-pack-${stamp}.zip`;
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

openZipBtn.addEventListener("click", () => zipInput.click());
zipInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) {
    loadZip(file).catch((error) => showError(error.message || "Load failed."));
  }
});

generateBtn.addEventListener("click", () => {
  buildPackZip().catch((error) => showError(error.message || "Build failed."));
});
