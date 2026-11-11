# A typed driver Cms, Mms or Rms is ignored by the charts (found 8 Nov 2026, QO463.c62)

**Status:** CLOSED
**Fix:** T744. The charts use the boxes Sd, Mms, Cms, Rms, Bl, Re and Le as they show; every box in a disagreeing set is marked.

Symptom: on a driver with Fs, Qes, Qms, Re, Sd, BL, Mms and Cms typed, typing Vas moves the SPL curve; typing Cms moves nothing. The box shows the typed Cms but no chart reads it.
Cause: `DriverEngine.circuitValues`, called by `SimulationEngine.sweep`, works Cms out from Vas and Sd, Mms from Fs and that Cms, Rms from Fs, Mms and Qms, and BL from Re, Fs, Qes and that Cms, before every sweep. This is how WinISD builds its simulation (decompile fr_45e090). The driver has no "typed last wins" rule; the radiator has it since T732 (0f1e8963c).
Ruled (John, QO534, 11 Nov 2026): "an entered value is never overwritten with a calculated value"; "the editor and pr settings will use the [on-screen] values not hidden recalcs always"; "all get the mark".
- `DriverEngine.circuitValues` passes the boxes through unchanged. It fills only a box that is empty, from the WinISD Qts fallback.
- A typed value moves no other box. An empty box is calculated and shown.
- When the boxes disagree, every box in the disagreeing set carries the warning; the popup names them and says what the maths gives (`domain/driver/disagreementNote.ts`).
- The "Cms from Vas" option, the typed-last memory and the shown-figure chain of the earlier T744 rule are removed.
- WinISD's charts ignore the typed boxes: ≠W cue by Mms and Cms; rows in docs/research/WINISD_PARITY.md and ACCURACY_IMPROVEMENTS.md; winisd_research FINDING_20261110_typed-mms-ignored-by-charts.md.
Tests: packages/design/test/domain/on-screen-values.test.ts (QO534 rows 0-4, E150HE-44), packages/ui/test/ui/driver-editor-cms-note.browser.spec.ts.
