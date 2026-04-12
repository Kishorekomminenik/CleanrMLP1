---
title: DebugDuck V1 Architecture
version: v1
status: frozen-core
---

# DebugDuck V1 Architecture

DebugDuck is a local-only MV3 Chrome extension for QA capture and automation handoff.
It supports Snap and Full-page screenshots, detached-window tab recording,
network/console logs, structured evidence export, and Postman collection export.

This document contains multiple diagrams for engineering discussion and onboarding.

## System Context Diagram

```mermaid
graph TD
  User[User] --> Popup[DebugDuck Popup UI]
  User --> RecWin[Detached Recording Window]
  User --> Viewer[Screenshot Viewer/Editor]
  User --> LogsUI[Logs Control UI]

  subgraph Chrome Extension (MV3)
    Popup --> SW[Service Worker]
    RecWin --> SW
    Viewer --> SW
    LogsUI --> SW
    SW --> Offscreen[Offscreen Document]
    SW --> ContentScripts[Content Scripts]
    SW --> IDB[(IndexedDB)]
    SW --> Broker[Download Broker]
  end

  User --> Tab[Browser Tab]
  Tab --> WebApp[Target Web App]
  WebApp --> API[External APIs]

  ContentScripts --> Tab
  Offscreen --> Tab
  SW --> Tab

  IDB --> ZIP[Evidence ZIP]
  IDB --> WebM[Recording WebM]
  IDB --> PNG[Screenshots PNG]
  Broker --> ZIP
  Broker --> WebM
  Broker --> PNG
```

## Container / Component Diagram

```mermaid
graph LR
  subgraph UI Surfaces
    PopupUI[Main Popup]
    RecUI[Recording Window]
    LogsUI[Logs Control UI]
    ViewerUI[Screenshot Viewer/Editor]
  end

  subgraph Core Runtime
    SW[Service Worker]
    Offscreen[Recording Offscreen]
    CSFull[Full-page Capture Helper]
    CSLogs[Logs Overlay Script (logs only)]
  end

  subgraph Storage
    IDB[(IndexedDB)]
  end

  subgraph Export
    ZipBuilder[ZIP Builder]
    Broker[Download Broker]
  end

  PopupUI --> SW
  RecUI --> SW
  LogsUI --> SW
  ViewerUI --> SW
  SW --> Offscreen
  SW --> CSFull
  SW --> CSLogs
  SW --> IDB
  SW --> ZipBuilder
  ZipBuilder --> Broker
```

## Sequence Diagram - Snap / Full Capture

```mermaid
sequenceDiagram
  participant User
  participant Popup
  participant SW as Service Worker
  participant CS as Full-page Helper
  participant Tab
  participant IDB
  participant Viewer

  User->>Popup: Snap or Full
  Popup->>SW: CAPTURE_SCREENSHOT or CAPTURE_FULLPAGE

  alt Snap
    SW->>Tab: captureVisibleTab (no scrollbar)
    SW->>IDB: store screenshot metadata
    SW->>Viewer: open viewer with data URL
  else Full
    SW->>CS: inject helper if needed
    SW->>CS: prepare, metrics, scroll, capture tiles
    SW->>Tab: captureVisibleTab per tile (no scrollbar)
    SW->>IDB: persist tiles
    SW->>SW: compose full-page image in extension runtime
    SW->>Viewer: open viewer with full-page image
  end
```

## Sequence Diagram - Recording

```mermaid
sequenceDiagram
  participant User
  participant Popup
  participant RecWin as Recording Window
  participant SW as Service Worker
  participant Offscreen
  participant Tab
  participant IDB
  participant Broker

  User->>Popup: Record
  Popup->>SW: OPEN_RECORDING_PANEL
  SW->>RecWin: Open or focus detached window

  User->>RecWin: Start
  RecWin->>SW: RECORDING_START (tabId)
  SW->>SW: obtain tab capture stream id
  SW->>Offscreen: RECORDING_START
  Offscreen->>Tab: getUserMedia(tab stream)
  Offscreen->>IDB: persist chunks
  Offscreen->>SW: state updates

  User->>RecWin: Stop
  RecWin->>SW: RECORDING_STOP
  SW->>Offscreen: RECORDING_STOP
  Offscreen->>IDB: finalize artifact
  Offscreen->>SW: ready for export
  SW->>Broker: download WebM
```

## Sequence Diagram - Logs Capture

```mermaid
sequenceDiagram
  participant User
  participant Popup
  participant SW as Service Worker
  participant Tab
  participant IDB
  participant Zip as ZIP Builder
  participant Broker

  User->>Popup: Start Logs
  Popup->>SW: NETWORK_START
  SW->>Tab: activate logs capture session
  SW->>IDB: persist network/console entries

  User->>Popup: Export ZIP
  Popup->>SW: EXPORT_EVIDENCE_ZIP_REQUEST
  SW->>Zip: build logs NDJSON + JSON
  SW->>Zip: build Postman collection (API-only)
  Zip->>Broker: download ZIP
```

## Data Flow Diagram

```mermaid
flowchart TD
  Snap[Snap Capture] --> ShotData[PNG Data URL]
  Full[Full Capture] --> Tiles[Tile Images]
  Tiles --> FullImage[Stitched PNG]
  ShotData --> IDB
  FullImage --> IDB

  Record[Recording] --> Chunks[WebM Chunks]
  Chunks --> IDB
  IDB --> FinalWebM[Final WebM]

  Logs[Capture Logs] --> NetEntries[Network Entries]
  Logs --> ConsoleEntries[Console Entries]
  NetEntries --> IDB
  ConsoleEntries --> IDB

  IDB --> ExportZIP[Evidence ZIP]
  ExportZIP --> LogsNDJSON[logs/debugduck-logs-network.ndjson]
  ExportZIP --> LogsJSON[logs/debugduck-logs-network.json]
  ExportZIP --> ConsoleNDJSON[logs/debugduck-logs-console.ndjson]
  ExportZIP --> ConsoleJSON[logs/debugduck-logs-console.json]
  ExportZIP --> Summary[summary/*.json]
  ExportZIP --> Postman[automation/postman_collection.json]
```

## Export Artifact Diagram

```mermaid
graph TD
  ZIP[Evidence ZIP]
  ZIP --> Meta[meta/session.json]
  ZIP --> Env[meta/environment.json (if present)]
  ZIP --> ExportMeta[meta/export_metadata.json (if present)]
  ZIP --> LogsND[logs/debugduck-logs-network.ndjson]
  ZIP --> LogsJSON[logs/debugduck-logs-network.json]
  ZIP --> ConsoleND[logs/debugduck-logs-console.ndjson]
  ZIP --> ConsoleJSON[logs/debugduck-logs-console.json]
  ZIP --> SummaryErrors[summary/errors.json]
  ZIP --> SummaryFailed[summary/failed_requests.json]
  ZIP --> SummarySession[summary/session_summary.json]
  ZIP --> SummaryTrunc[summary/truncation_report.json (if present)]
  ZIP --> Automation[automation/postman_collection.json]

  LogsND --> Automation
```

## Architecture Assumptions

- Recording controls are detached into a dedicated popup window and are not
  injected into the captured tab DOM.
- Full-page capture uses a content script to scroll and compute tiles; the final
  image is composed in the extension runtime and then opened in the viewer/export path.
- Logs export uses IndexedDB as the durable source of truth; network.ndjson is
  the raw canonical log, while network.json is the readable structured view.
- The download broker mediates ZIP and WebM file downloads using local blobs.

## V1 Frozen / Stable Areas

- Screenshot capture and full-page stitching pipeline.
- Recording engine (offscreen capture, chunk persistence, export).
- Logs capture pipeline and IndexedDB persistence.
- ZIP export structure, NDJSON/JSON logs, and Postman collection export.

## Export / Automation Bridge Extensions

- Postman collection export (automation/postman_collection.json) is derived
  from captured network entries (raw log data) and is an export-only bridge,
  not a capture system.
- Summary files are derived from logs and do not affect capture pipelines.
