# BUG_20261116_chart-readout-is-rebuilt-with-the-same-text

**Status:** FIXED, T848 (2026-11-16)

## Symptom
Every chart redraw wrote the readout line (`.gread`, the cursor frequency and levels, or the dragged range) with
`innerHTML`, even when the text was the same. The browser threw away the readout's elements and built new ones each
time. After a project change the sweep runs again a moment later (the settle run, 150 ms), so a chart that had just
opened lost and rebuilt its readout with nothing changed: a selection a user had made in it was dropped.
Main went red on this: `visual-fonts.browser.spec.ts` "dialog-shared-graph-context-menu" failed with
`CSS.getPlatformFontsForNode: Could not find node with given id` because the readout `<b>` it was asking about had been
replaced by the settle run's redraw. Reproduced 8 of 8 runs locally, also on the commit that was green in CI.

## Fix
`showReadout` (`packages/ui/src/ui/readout.ts`) writes the readout only when its text differs from what is shown.
Test: `packages/ui/test/logic/readout.test.ts`.
