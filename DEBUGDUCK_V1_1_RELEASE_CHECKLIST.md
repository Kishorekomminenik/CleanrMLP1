# DebugDuck V1.1 Release Checklist

Freeze target: DebugDuck V1.1 (2026-02-05)

## Build and package readiness
- [ ] Extension loads with DebugDuck branding and icons.
- [ ] Capture modes: screenshot, full-page, recording, logs.
- [ ] Export bundle includes session.json at package root.
- [ ] Export bundle includes viewer/ assets and OPEN_VIEWER.txt.
- [ ] Manifest validation runs without errors.
- [ ] Manifest paths are relative and match bundle layout.

## Smoke path (demo)
- [ ] Open popup and confirm main actions are responsive.
- [ ] Take a standard screenshot and confirm export.
- [ ] Take a full-page screenshot and confirm output integrity.
- [ ] Start, pause, resume, stop recording and confirm output.
- [ ] Capture logs and confirm NDJSON output.
- [ ] Export mixed session and confirm session.json references.
- [ ] Unzip and open viewer/index.html locally.
- [ ] Timeline loads from session.json before heavy logs.
- [ ] Panels (screenshots/network/console/video) work when present.
- [ ] Incident filters and jump-to-incident work.
- [ ] Missing-artifact package degrades gracefully.

## Regression matrix (run or record)
- [ ] Screenshot only
- [ ] Full-page only
- [ ] Recording only
- [ ] Logs only
- [ ] Screenshots + logs
- [ ] Recording + logs
- [ ] Full mixed session
- [ ] Pause/resume recording
- [ ] Partial export scenario
- [ ] Large log session
- [ ] Packaged viewer opened from local files

## Known issues
- [ ] Reviewed and updated: DEBUGDUCK_V1_1_KNOWN_ISSUES.md

## Freeze sign-off
- [ ] Demo path validated.
- [ ] Known issues documented.
- [ ] Package structure confirmed.
- [ ] Ready to freeze as DebugDuck V1.1.
