## QA Evidence Recorder - Setup

### Load Unpacked in Chrome
1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked**.
4. Select the `qa-evidence-recorder/` folder.

### Permissions You'll See
- **Tab Capture**: required to record the current tab video/audio.
- **Debugger**: required to capture DevTools-style network logs.

If your organization blocks the debugger API, Network mode will be unavailable.

### How to Use
Open the extension popup and pick a mode:

**Screenshot Only**
- Click **Capture Screenshot** to take a shot of the visible tab.
- Add markers as needed.
- Click **Export** to download screenshots + markers + summary.

**Video Only**
- Click **Start** to begin recording the locked tab.
- Pause/Resume as needed.
- Click **Stop & Export** to download the video + markers + summary.

**Network Only**
- Click **Start** to attach the debugger and begin capturing requests.
- Pause/Resume to stop/start logging.
- Click **Stop & Export** to download network logs + markers + summary.

**All-in-One**
- Click **Start** to capture video + network together.
- Capture screenshots while recording or paused.
- Click **Stop & Export** to download everything.

### Export Files
Downloads are saved to your default Downloads folder:
- `qa-video-YYYYMMDD-HHMMSS.webm`
- `qa-network-YYYYMMDD-HHMMSS.json`
- `qa-markers-YYYYMMDD-HHMMSS.json`
- `qa-screenshot-###-YYYYMMDD-HHMMSS.png`
- `qa-summary-YYYYMMDD-HHMMSS.txt`

### Known Limitations
- Response bodies may be unavailable for some requests.
- Response bodies are truncated at 200KB.
- Binary bodies are skipped when decoding fails.
- Restricted pages (`chrome://`, Web Store, extension pages) cannot be captured.
- Some corporate policies block `chrome.debugger`; Network mode will fail.
