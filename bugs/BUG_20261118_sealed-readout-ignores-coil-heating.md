# BUG_20261118_sealed-readout-ignores-coil-heating

**Status:** FIXED (T908, the change that makes the Box tab's sealed Fsc and Qtc use the project's voice-coil heating)

## Symptom
With a voice-coil temperature rise of 100 K (project alfaVC 0.0039) the Box tab reads the W5-1138SMF's sealed Qtc 0.719 and Fsc 67.23 Hz in 4.48 L, the cold-coil figures, where WinISD reads Qtc 0.920 and Fsc 66.64 Hz.

## Evidence
- WinISD Box tab and `.wpr`, Tang Band W5-1138SMF (winisd_research runs/nd-1/w5_nd.wpr; runs/s04-dtvc-20261118/; PROBE_FINDINGS.md "FINDING 2026-11-18"), 1 driver, Vb 4.48 L, Ql 10, Qa 100, Rg 0.1:
  - dTVC 0: Qtc 0.719, Fsc 67.23 (saved Fr 67.2338865319546)
  - dTVC 100, project `[Box] alfaVC` 0.0039: Qtc 0.920, Fsc 66.64 (saved Fr 66.6438991716757)
  - dTVC 100, only the driver record's `[Driver] alfaVC` set, project alfaVC 0: Qtc 0.719, Fsc 67.23 (unchanged)
- WinISD formula (winisd_research/spec/S04_sealed_box.md section 2 and quirk Q8, `fr_45e090` 0x45e150-0x45e183):
  Qes' = Qes*(Re + Rg + Re*alfaVC*dTVC)/Re, alfaVC being the project's, not the driver record's.
- Found by the same spec page, its OpenISD section, difference b.

## Cause
- The sealed feed folded only Rg into Qes (`DriverEngine.sourceLoadedQts`, Qes*(Re + Rg)/Re): the project's alfaVC and
  dTVC never reached the Box tab's Fsc/Qtc, the volume a typed Fsc or Qtc gives, or the project solve.
- The charts already heated the coil: `circuit.ts` `coilRdc` puts hotRe = Re*(1 + alfaVC*dTVC) plus Rg in series with the
  coil, so the readout and the charts disagreed whenever dTVC was not 0.

## Fix
- One engine rule, `DriverEngine.heatedSourceLoadedQts(qms, qes, re, rg, alfaVC_per_K, dT_K, fallbackQts)`:
  Qes' = Qes*(hotRe + Rg)/Re with the engine's own `hotRe`, the circuit's. `sourceLoadedQts` is it with a cold coil.
- `DriveLoad` carries the project's `alfaVC_per_K` and `vcTempRise_K` (required), read by `driveLoadOf` from the
  project's record. No data-model change: both fields were already stored in `driverEmbedding`.
- Every sealed feed (box readout, typed Fsc, typed Qtc, the project solve) uses it.

## Not changed (unproven)
- `ventedDesign` (the vented alignment designer) and the sealed alignment picker with the "Sealed picker volume" bug
  switch ticked keep the cold-coil Qts: WinISD has not been probed with dTVC other than 0 there.

## Tests
- packages/design/test/domain/sealed-readout-heats-coil.test.ts: the three WinISD readings, the typed-Qtc round trip with a
  hot coil, and agreement with the chart model (a hot coil reads and charts as a cold coil with Re*alfaVC*dTVC more Rg).
