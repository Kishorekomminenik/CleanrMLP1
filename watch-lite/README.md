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
- `export_metadata.json`

## Schema additions (2026-02)
Recent exports add additive metadata for deterministic playback syncing. Fields may be
present but null when unavailable.

Highlights:
- `qa-session-log.json`: `schema_version`, `session_id`, `startedAt_ms`,
  `endedAt_ms`, `durationMs`, `timezone_offset_minutes`, `timezone_iana`,
  `extension_version`, `monotonic`, `monotonic_available`,
  `video_time_zero_epoch_ms`, `video_duration_ms`, `video_codec`, `video_fps`.
- `network_logs.json` / `console_logs.json` entries: `timestamp_epoch_ms`
  (+ `time_missing` when unknown).
- `environment.json`: `extension_version`, `timezone_offset_minutes`,
  `timezone_iana`, `device_pixel_ratio`, `viewport`.
- `export_metadata.json`: `zip_created_at_utc`, `zip_created_at_local`,
  `zip_created_at_epoch_ms`, `zip_builder_version`, `redaction_enabled`.

## Notes
- All data stays on your machine.
- If the ZIP is missing `qa-session-log-*.json`, a friendly error is shown.
- This repo-mode viewer loads JSZip from `../extension/lib`. For standalone sharing, bundle JSZip into `watch-lite/vendor`.
