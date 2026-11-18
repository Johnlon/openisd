# BUG_20261117_driver-editor-tab-switch-drops-refused-entry

**Status:** OPEN (T868, the change that makes the Driver Editor show every refused entry)

## Symptom
In the Driver Editor, type an out-of-range number (Qts `0`) on the Parameters tab: the box turns red with a note, as on every other screen.
Click another tab (Advanced) and back: the box shows the old value again, no mark, no note. Press OK with such an entry standing: the editor closes and the entry is gone.
Nothing told the person the entry was refused and lost. John: "nothing the app does happens silently".

## Cause
`DriverEditorModal.vue` shows each tab with `v-if`, so leaving a tab unmounts its number boxes and the refused text with its red mark. `OK` never looks at refused boxes.

## Fix
A tab holding a refused entry is kept mounted (hidden) while another shows, so the entry and its mark stay where they were typed. The tab button carries a red mark while its tab holds one, and OK says which entry was refused and not applied.

## Tests
`packages/ui/test/hooks/DriverEditorModal-hooks.test.ts` (refusal ledger); `packages/ui/test/ui/driver-editor-refusal.browser.spec.ts`.
