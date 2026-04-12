# UI Sanity Checklist (Popup)

## Manual Clickability Checklist
- [ ] Mode switch (Shot / Record / Net) responds to clicks every time.
- [ ] Start / Pause / Resume / Stop buttons respond in the current mode.
- [ ] Snap / Full / Mark actions fire and show a toast.
- [ ] Export ZIP is clickable when Ready; disabled while Live.
- [ ] WebM button works in Record mode when video exists.
- [ ] Redaction toggle is clickable and updates ON/OFF label.
- [ ] Annotations accordion opens/closes via chevron.
- [ ] Session Status accordion opens/closes via chevron.

## Rerender/Interaction Stress
- [ ] Switch modes 10x quickly; no controls become dead.
- [ ] Open/close accordions repeatedly; no dead UI.
- [ ] Start → Stop → Export → try controls again (all work).

## Visual / Layout
- [ ] No duplicate controls (Snap/Full/Mark appear once).
- [ ] Segmented control shows active state.
- [ ] Buttons have hover/active/focus-visible states.
- [ ] Disabled buttons are visibly disabled (opacity) and not clickable.
- [ ] Toast appears and auto-dismisses (~2.2s).

## Do Not (Guardrails)
- Do NOT attach per-button listeners; use delegated handlers only.
- Do NOT use `pointer-events: none` on containers/cards.
- Do NOT duplicate IDs or render duplicate control blocks.

## Troubleshooting
- Enable click debug: set `CLICK_DEBUG = true` in `popup.js`.
  - Logs routed actions.
  - Highlights elements that may be blocking clicks.
- If clicks don’t work:
  - Use DevTools element picker to verify actual button is on top.
  - Search for unexpected overlays or absolute layers.
