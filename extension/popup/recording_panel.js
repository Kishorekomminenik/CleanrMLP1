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

async function refreshStatus() {
  const res = await send("GET_STATUS");
  if (!res || !res.ok) {
    messageEl.textContent = res && res.error ? res.error : "Status unavailable.";
    return;
  }
  const state = res.state;
  const sessionState = state.session ? state.session.state : "idle";
  const createdAt = state.session ? state.session.created_at : null;
  const endedAt = state.session ? state.session.ended_at : null;
  timerEl.textContent = formatElapsed(createdAt, endedAt);
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
  await send("RECORDING_PAUSE");
  await refreshStatus();
});
resumeBtn.addEventListener("click", async () => {
  await send("RECORDING_RESUME");
  await refreshStatus();
});
stopBtn.addEventListener("click", async () => {
  await send("RECORDING_STOP");
  await refreshStatus();
});
closeBtn.addEventListener("click", () => window.close());

refreshStatus();
setInterval(refreshStatus, 750);
