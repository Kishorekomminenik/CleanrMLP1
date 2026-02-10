# Repro Watch Lite

Standalone local viewer for Repro evidence exports. No uploads. No backend.

## How to use
1. Open `watch-lite/index.html` in Chrome or Edge.
2. Click **Open Evidence ZIP** and select a Repro export zip.

## What it expects
Required files inside the ZIP:
- `qa-session-log-*.json`
- `qa-summary-*.txt`
- `environment.json`

Optional files:
- `qa-session-video-*.webm`
- `screenshots/qa-screenshot-*.png`
- `network_logs.json`, `console_logs.json`

## Notes
- All data stays on your machine.
- If the ZIP is missing `qa-session-log-*.json`, a friendly error is shown.
- This repo-mode viewer loads JSZip from `../extension/lib`. For standalone sharing, bundle JSZip into `watch-lite/vendor`.
