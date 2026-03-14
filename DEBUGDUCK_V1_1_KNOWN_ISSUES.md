# DebugDuck V1.1 Known Issues

This list tracks known limitations intentionally deferred for V1.1 freeze.

## Viewer and package
- Opening viewer/index.html via file:// may be blocked by some browsers' local-file
  security rules. If blocked, use Chrome/Edge or a simple local web server.

## Performance
- Network and console panels cap visible rows to the first 500 entries to keep
  large sessions usable.

## Export
- Extremely large sessions may hit export size limits and require capture
  reduction.
