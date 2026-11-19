# BUG_20261118_sealed-readout-ignores-driver-count

**Status:** FIXED (T901)

## Symptom
One sentence: with 4 drivers in a 4.48 L sealed box the Box tab reads Qtc 0.719 (one driver's), where WinISD reads 1.085.

## Evidence
- WinISD Box tab, Tang Band W5-1138SMF (winisd_research runs/nd-1/w5_nd.wpr, Ql 10, Qa 100, Rg 0.1): 1 driver in 4.48 L Qtc 0.719; 4 drivers in 4.48 L Qtc 1.085 (runs/nd-1/53_nd4_vb4.48_boxtab.png); 4 drivers in 17.92 L Qtc 0.719, Fsc 67.23 Hz (runs/nd-1/60_nd4_vb17.92_boxtab.png).
- Found by the WinISD spec page winisd_research/spec/S04_sealed_box.md (its OpenISD section, difference a); John, 18 Nov 2026: "is there any bug in openisd".

## Cause
- `OpenISDBox.#sealedResonance` (packages/design/domain/box/openISDBox.ts, the Fsc/Qtc readout), `#sealedVolumeFromQtcOrFsc` (the volume a typed Fsc gives) and `OpenISDDriver.#sealedFeed` (the volume a typed Qtc gives) fed the engine one driver's Vas with the whole box volume.
- `projectResolve.ts` fed `SealedEngine.solve` (the Qtc a volume gives, the volume a Qtc gives) the same single-driver Vas.
- The chart sweep already runs one driver alone in Vb/N (`oneBoxOfN`, SimulationEngine.ts); WinISD does the same by making Cas = Nd*Vas (0x45e0ad). Two separate sums.

## Fix
- One engine rule, `SealedEngine.arrayVas(Vas, nDrivers, loading)` = N*Vas, halved for an isobaric pair (the chart's `isobarikPair` halves Vas; WinISD halves Nd*Vas at 0x45e0dd): Vb/(N*Vas) is the chart's (Vb/N)/Vas. Fs and Qts are unchanged.
- Every sealed feed (box readout, typed Fsc, typed Qtc, the project solve) takes it through `DriveLoad` (source resistance, driver count, loading; required, no default), read off the project's record by `driveLoadOf`.

## Not changed (unproven)
- Sealed alignment picker volume with the "Sealed picker volume" bug switch ticked, and `ventedDesign`: WinISD's own picker formula (0x45c140) and vented designer do not show a driver count in the findings; a WinISD probe with Nd 4 is needed.
- Qes' coil heating term (Re*alfaVC*dTVC): decompiled only, no WinISD readout with dTVC other than 0 exists.

## Tests
- packages/design/test/domain/sealed-readout-counts-drivers.test.ts: the three WinISD readings, isobaric, typed-Qtc round trip, and agreement with the chart's impedance peak for 1, 2 and 4 drivers.
