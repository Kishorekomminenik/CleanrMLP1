---
title: Repro V1 Architecture
version: v1
status: frozen-core
---

# Repro V1 Architecture

Repro is a local-only MV3 Chrome extension for QA capture and automation handoff.
It provides Snap and Full-page screenshots, tab recording, network/console logs,
and structured evidence export including a Postman collection.

This document contains multiple diagrams for engineering discussion and onboarding.

## System Context Diagram

```mermaid
graph TD
  User[User] --> Popup[Repro Popup UI]
  User --> RecWin[Recording Control Window]
  User --> Viewer[Screenshot Viewer/Editor]

  subgraph Chrome Extension (MV3)
    Popup --> SW[Service Worker]
    RecWin --> SW
    Viewer --> SW
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
    LogsUI[Logs UI]
    ViewerUI[Screenshot Viewer/Editor]
  end

  subgraph Core Runtime
    SW[Service Worker]
    Offscreen[Recording Offscreen]
    CSFull[Full-page Capture Script]
    CSLogs[Logs Overlay Script]
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
  participant CS as Full-page Script
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
    SW->>CS: inject fullpage_capture.js
    SW->>CS: prepare, metrics, scroll, capture tiles
    SW->>Tab: captureVisibleTab per tile (no scrollbar)
    SW->>IDB: persist tiles + compose final image
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
  RecWin->>SW: RECORDING_START (tabId + streamId)
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
  SW->>Tab: attach debugger
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

  Logs[Network + Console] --> NetEntries[NDJSON Entries]
  Logs --> ConsoleEntries[NDJSON Entries]
  NetEntries --> IDB
  ConsoleEntries --> IDB

  IDB --> ExportZIP[Evidence ZIP]
  ExportZIP --> LogsNDJSON[logs/network.ndjson]
  ExportZIP --> LogsJSON[logs/network.json]
  ExportZIP --> ConsoleNDJSON[logs/console.ndjson]
  ExportZIP --> ConsoleJSON[logs/console.json]
  ExportZIP --> Summary[summary/*.json]
  ExportZIP --> Postman[automation/postman_collection.json]
```

## Export Artifact Diagram

```mermaid
graph TD
  ZIP[Evidence ZIP]
  ZIP --> Meta[meta/session.json]
  ZIP --> LogsND[logs/network.ndjson]
  ZIP --> LogsJSON[logs/network.json]
  ZIP --> ConsoleND[logs/console.ndjson]
  ZIP --> ConsoleJSON[logs/console.json]
  ZIP --> SummaryErrors[summary/errors.json]
  ZIP --> SummaryFailed[summary/failed_requests.json]
  ZIP --> SummarySession[summary/session_summary.json]
  ZIP --> Automation[automation/postman_collection.json]

  LogsND --> Postman
  LogsJSON --> Postman
```

## Architecture Assumptions

- Recording controls are detached into a dedicated popup window and are not
  injected into the captured tab DOM.
- Full-page capture uses a content script to scroll and compute tiles, but
  the final image is composed and exported in the service worker.
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
  from network logs and is an export-only bridge, not a capture system.
- Summary files are derived from logs and do not affect capture pipelines.
