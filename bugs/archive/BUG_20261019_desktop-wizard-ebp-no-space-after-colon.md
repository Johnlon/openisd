# BUG_20261019_desktop-wizard-ebp-no-space-after-colon

**Status:** FIXED (T540)

Recorded 19 Oct 2026 by bob, from the QO269 prod capture.

## Symptom
On desktop wizard step 3 (Type of design) the recommendation line reads
"Efficiency Bandwidth Product (EBP):78.9" with no space after the colon.

Picture: ui-gallery/QO269/prod-desktop-wizard3.png (served at
http://lap:8000/winisd/ui-gallery/QO269/prod-desktop-wizard3.png).

## Fix
Put a space after the colon, with a spec that reads the line on screen.

## Cause
In `OriginalNewProject.vue` the label `<span>` and the value `<strong>` sat on separate lines. Vue drops
whitespace between elements when it holds a line break, so nothing separated the colon from the value.

## Verification
`packages/ui/test/ui/OriginalNewProject-ebp-line.test.ts` (unit): the `.ebp-row` template keeps a space text node
between the label and the value; on the old template Vue parsed only `span`, `strong`.
`packages/ui/test/ui/new-project-wizard.browser.spec.ts`, "step 3 reads ... with a space after the colon":
red before (read "Efficiency Bandwidth Product (EBP):67.5"), green after. The six desktop wizard step 3
baselines were re-taken.
