# Number box drag-spin: selection flashes to the whole text during a mouse drag (flaky on CI)

## Symptom
`number-box-drag-spin.browser.spec.ts:93` "dragging down lowers the value, and the driven digit is highlighted" failed on GitHub Actions in two landings (T636 earlier; run 41275362771 for T640): `expected length 1, received length 4, "8.00"`. Passes locally.

## Cause
A mouse press-and-drag in a text input also starts the browser's own text selection, which on each mouse move extends from the pressed digit to the end of the text when the pointer is below the box. The spin only reset the one-digit selection on its 40 ms tick, so between a mouse move and the next tick the whole text was selected. On a slow runner the spec read the selection inside that gap (it had dragged the value down to 8.00, digit 0, so "0 to end" was the whole text).

## Fix
`NumInput-hooks.ts`: once a drag is spinning, the `select` and `selectionchange` events put the driven digit's selection back at once. The spec waits for the box to show one digit selected (as a user would) instead of reading it at one instant.

## Verification
Spec run with --repeat-each 5 (75 tests) under a niced CPU busy loop via `bash scripts/test.sh`: 75 passed. Typecheck clean.
