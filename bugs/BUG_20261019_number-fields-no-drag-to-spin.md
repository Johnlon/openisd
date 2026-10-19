# BUG_20261019_number-fields-no-drag-to-spin

**Status:** OPEN

Recorded 19 Oct 2026 by fable's worker. John asked: "btw the existing UI should be allowing spin by
dragging any field, does it still work?" It does not.

## Symptom
A number field cannot be changed by dragging on it. Press on the box and move the mouse or finger:
nothing happens. A value changes only by typing, the arrow keys, the mouse wheel while the box has
focus, and holding the ▲▼ stepper buttons.

## Evidence
- `packages/ui/src/ui/components/NumInput.vue`: the pointerdown handler on the box (`onBoxPointer`)
  only clears the caret underline. No pointermove or drag handling exists in the component.
- Drag-to-scrub existed only in an early mock (commit c4af6452, `mock/script.js`, 8 Jul 2026) and
  never reached `packages/ui`.

## WinISD
Only what the WinISD sources show:
- Box tab: hold the left mouse button on the box diagram and move the mouse; left/right changes Vb, up/down
  changes Fb on vented boxes (`docs/winisd_helpfiles/help/boxdesign.html`, lines 110-125).
- Losses float window (Ql, Qa, Qp): a "white square beside input box" is dragged to change the value,
  and the graph updates in real time (`boxdesign.html` line 185; `docs/research/WINISD_PARITY.md`
  around line 643).
- Passive radiator extra mass: dragging vertically changes it (`docs/winisd_helpfiles/versions.txt`
  lines 23-27).
- The sources do not show drag-spin on every WinISD number box. ⚠ unverified whether other boxes
  have it.

## Cause
Never built in `NumInput.vue`.

## Fix
Dragging on a number box scrubs its value, through the same step and clamp path as the arrow keys
(step maths in `packages/design`, not in the UI). Which fields scrub and the drag direction and
speed need John's say.

## Verification
A browser spec that presses on a number box, drags, and reads the new value from the screen. Also a
touch case at 374x705.
