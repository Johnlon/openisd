# BUG_20261018_what-if-qts-vas-do-not-move-charts

**Status:** FIXED (T403)

## Symptom
On the phone Graph page, What-if sheet: changing Qts or Vas does not change any chart. Fs does.
John saw it on test.openisd.app, 18 Oct 2026.

## Evidence
Probe (tsx, design package, sealed 30 L, driver Fs 30, Vas 30 L, Qes 0.4, Qms 7), What-if open, SPL at the first 6 grid points:

| Edit | SPL |
|---|---|
| none | 58.66 62.54 66.31 … |
| Qts 0.38 → 0.8 | unchanged |
| Vas 30 → 100 L (no Cms entered) | changes |
| Vas 30 → 100 L (Cms and Mms entered) | unchanged |
| Fs 30 → 50 | changes |

The field itself reads back the new value (Qts = 0.8, Vas = 0.1), so the sheet shows the edit.

## Cause
Not the What-if layer: the same probe with no What-if open (a plain project edit) gives the same result — Qts
and Vas edits leave the curve unchanged, Fs moves it. Any edit path (Driver editor, Tune, What-if) hits it.

The sheet writes `driver.specField('Qts')` and `specField('Vas_m3')` (`packages/ui/src/hooks/sheetSession.ts` write()).
The sweep uses the driver's other entered values: Qes and Qms decide Qts; Cms (with Sd) decides Vas. A library
driver has those entered, so the Qts / Vas value is stored but the curve is solved from the others.

## WinISD (captured 18 Oct 2026, E150HE-44, headless)
winisd_research/runs/qts_vas_edit_e150he/, commit dc8bb1c. Driver editor, real keystrokes:
- Qts 0.39 → 0.80: only Qts changes (pinned E); Qes, Qms kept. Box unchanged (Qtc 0.467, Fsc 48.53): the sim ignores the typed Qts.
- Vas doubled: only Vas changes (pinned E); Cms, Mms kept. Box changes (Qtc 0.467 → 0.526, Fsc 48.53 → 55.39): the sim uses the typed Vas.
OpenISD matches WinISD on Qts and differs on Vas. What-if is OpenISD's own control, so its Qts row must move the charts whatever WinISD's editor does.

## WinISD decompile (18 Oct 2026, winisd_research 4f05120, GHIDRA_FINDINGS.md)
Static, exe 0.7.0.950. One function builds the sim state (fr_45e090): Cas from Vas, Mas from Fs and Cas, Ras from Qms,
Rae from Qes (Rg-corrected), plus BL, Sd, Re, Le. It never reads Cms, Mms or Rms; Qts only as a fallback when Qes or
Qms is not positive. Readouts and every chart use that state. Cms and Mms are display and fill values only, so the
screen Cms/Mms can disagree with what WinISD plots. ⚠ unverified: driver-to-sim copy not located; debugger check named
in the finding.
OpenISD's circuit (`engine/circuit.ts`) reads the other set: Cms, Mms, Rms, BL. That is why a typed Vas moves WinISD and not OpenISD.

## Rulings (John, 18 Oct 2026)
- "Should OpenISD drive the circuit from the T/S values, as WinISD does?" — "yes"
- "When Cms or Mms was typed but the engine no longer uses it, should it turn to C" — "no - but dq shows"
- "Is WinISD ignoring a typed Qts a bug?" — "I don't know , explain this one again"; then: "Qts becomes an input for the solver to calculate a missing qes or qms or to show conflicts but not used for ant other calcs"

- "The What-if Qts row ... swap it for Qes and Qms rows, which do move the charts" — "1 agree"

- Driver with Qts but no Qes or Qms: "ok copy WinIsd and warn" (WinISD's fallback, Qes = Qms = 2·Qts, plus a dq warning that the charts are approximate)

## Fix
A What-if Qts or Vas edit must move the quantities the sweep reads. Which one follows (Qes or Qms for Qts; Cms or
Mms for Vas, keeping Fs) is a data-model ruling for John. ⚠ unverified: what WinISD's driver editor moves when Qts
or Vas is typed — settle it under wine before ruling.

## Verification
Unit test in `packages/design/test/domain/project-what-if.test.ts`: library-style driver (Qes, Qms, Cms, Mms
entered), What-if Qts and Vas edits each change the swept SPL; cancel restores it.

## Done (T403, 18 Oct 2026)
- The circuit is built from Fs, Vas, Qes, Qms, Re, Sd, BL, Le (DriverEngine.circuitValues). Cms, Mms, Rms are display
  only; a typed value that disagrees keeps E and gets the inconsistent-inputs dq mark.
- Qts only fills a missing Qes/Qms; a Qts-only driver uses Qes = Qms = 2·Qts with an approximate-charts dq mark.
- What-if rows: Fs, Vas, Qes, Qms (phone and desktop, from SheetField.DRIVER_SPEC).
- "Two-BL driver" switch: unticked = one BL (the Qes-implied one); ticked = WinISD (damping from Qes, push from typed BL).
- Proof: packages/design/test/domain/every-input-recalculates.test.ts — every driver field, project setting, compat
  switch and What-if row either moves the charts (and cancel restores them) or is on its exempt list with a reason.
- Follow-up: BUG_20261018_typed-bl-conflict-no-dq-mark.md.
