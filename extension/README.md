# QA Evidence Recorder Extension

QA Evidence Recorder is a Manifest V3 browser extension for Chrome/Edge that
captures screenshots, tab recordings, and network + console logs from the active
tab and exports a single ZIP evidence bundle.

## Load unpacked (Chrome / Edge)
1. Open **chrome://extensions** (Chrome) or **edge://extensions** (Edge).
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `/workspace/extension` folder.

## Use the extension
### Screenshot
1. Open the tab you want to capture.
2. Choose **Screenshot** mode.
3. Click **Capture**.
4. Click **Download Evidence ZIP**.

### Recording
1. Choose **Recording** mode.
2. Click **Start** to record the active tab.
3. Optionally **Pause/Resume**.
4. Click **Stop**.
5. Click **Download Evidence ZIP**.

### Network + Console
1. Choose **Network + Console** mode.
2. Click **Start** to attach the debugger and begin capture.
3. Reproduce the issue.
4. Click **Stop**.
5. Click **Download Evidence ZIP**.

## Redaction
Redaction is ON by default. Toggle **Redaction ON/OFF** to mask:
- Headers: Authorization, Cookie, Set-Cookie
- JSON keys: token, password, secret, apiKey, authorization

## Permissions
- **activeTab**: capture the currently active tab.
- **tabs**: read active tab URL/title.
- **debugger**: network capture via DevTools Protocol.
- **tabCapture**: record the active tab.
- **offscreen**: run MediaRecorder in MV3.
- **storage**: persist redaction toggle.

## Notes
- Capture is **active-tab only**, **user-triggered**, and **local-only** (no uploads).
- A content script is present on all URLs but only captures after you start a mode.
- Chrome/Edge store pages and browser internal pages cannot be captured.
