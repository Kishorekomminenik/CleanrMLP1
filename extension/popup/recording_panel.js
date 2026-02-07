const timerEl = document.getElementById("panel_timer");
const stateEl = document.getElementById("panel_state");
const messageEl = document.getElementById("panel_message");
const pauseBtn = document.getElementById("panel_pause");
const resumeBtn = document.getElementById("panel_resume");
const stopBtn = document.getElementById("panel_stop");
const closeBtn = document.getElementById("closePanel");

function send(type, payload = {}) {
  return chrome.runtime.sendMessage({ type, ...payload });
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

async function refreshStatus() {
  const res = await send("GET_STATUS");
  if (!res || !res.ok) {
    messageEl.textContent = res && res.error ? res.error : "Status unavailable.";
    return;
  }
  const state = res.state;
  const sessionState = state.session ? state.session.state : "idle";
  timerEl.textContent = formatElapsedWithPauses(state.session);
  stateEl.textContent = sessionState || "idle";
  messageEl.textContent =
    state.statusMessage && state.statusMessage.message
      ? state.statusMessage.message
      : "-";

  const isCapturing = sessionState === "capturing";
  const isPaused = sessionState === "paused";
  pauseBtn.disabled = !isCapturing;
  resumeBtn.disabled = !isPaused;
  stopBtn.disabled = !(isCapturing || isPaused);
}

pauseBtn.addEventListener("click", async () => {
  await send("RECORDING_PANEL_PAUSE");
  await refreshStatus();
});
resumeBtn.addEventListener("click", async () => {
  await send("RECORDING_PANEL_RESUME");
  await refreshStatus();
});
stopBtn.addEventListener("click", async () => {
  await send("RECORDING_PANEL_STOP");
  await refreshStatus();
});
closeBtn.addEventListener("click", () => window.close());

refreshStatus();
setInterval(refreshStatus, 750);
