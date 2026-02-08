# Pipeline Schemas (V1)

This document describes the deterministic pipeline schemas used by the V1
evidence-processing pipeline. All structures are JSON-serializable and designed
to be stable and testable.

## Normalized Event

```
{
  "id": "evt_000001",
  "t_ms": 1234,
  "ts_iso": "2026-02-05T12:34:56.789Z",
  "source": "network|console|ui|system",
  "kind": "action|request|response|error|warning|info|marker|screenshot",
  "level": "debug|info|warn|error",
  "msg": "string",
  "corr": {
    "tabId": 123,
    "sessionId": "uuid",
    "actionId": "act_0001|null",
    "requestId": "string|null"
  },
  "data": {}
}
```

### UI Action Data

```
{
  "actionType": "click|input|navigate|submit",
  "label": "string",
  "selector": "string|null",
  "tagName": "string|null",
  "value": "string|number|null"
}
```

### Network Request Data

```
{
  "method": "string",
  "url": "string",
  "urlPath": "string",
  "urlHost": "string",
  "headers": "object",
  "bodyPreview": "string|null",
  "bodyTruncated": "boolean"
}
```

### Network Response Data

```
{
  "status": "number|null",
  "statusText": "string|null",
  "mimeType": "string|null",
  "headers": "object",
  "durationMs": "number|null",
  "fromCache": "boolean|null",
  "fromServiceWorker": "boolean|null",
  "bodyPreview": "string|null",
  "bodyTruncated": "boolean",
  "bodySkipped": "boolean",
  "bodyError": "string|null"
}
```

### Console Error Data

```
{
  "errorType": "string|null",
  "message": "string",
  "stack": "string|null",
  "url": "string|null",
  "line": "number|null",
  "col": "number|null"
}
```

### Marker Data

```
{
  "note": "string"
}
```

### Screenshot Data

```
{
  "fileName": "string"
}
```

## Signal

```
{
  "signalId": "sig_0001",
  "type": "NetworkFailure|ConsoleError|SlowRequest|BackgroundNoise",
  "level": "info|warn|error",
  "actionId": "string|null",
  "summary": "string",
  "key": "string",
  "stats": {},
  "evidence": {
    "eventIds": ["evt_000001"],
    "requestIds": ["requestId"]
  }
}
```

## Summary Text Sections (qa-summary.txt)

- Session metadata (start/end/duration/tabId/mode)
- Capture notes (actionable signals count)
- Top 5 failures (NetworkFailure + ConsoleError)
- HTTP status counts (4xx, 5xx)
- Top slow requests
- Markers list with timestamps
- Screenshots count
- Truncation/skips/errors counts
