# BUG_20261118_winisd-coil-alfavc-project-only

**Status:** FIXED (T917, the change that heats the voice coil with the driver's own AlfaVC when it is not 0, with a WinISD bug switch for the project-only sum)

## Symptom
WinISD heats the voice coil (Re rises by Re·AlfaVC·dTVC) with the project's AlfaVC only. A driver whose coil is not copper
is heated as copper: Re 3.2 Ω, driver AlfaVC 0.0042 /K, project 0.0039 /K, dTVC 100 K gives hot Re 4.448 Ω, where the coil's own
coefficient gives 4.544 Ω. OpenISD copied WinISD (T908 used the project's value for the Box tab; the charts and the Signal
tab's power already did).

## Evidence
- WinISD 0.7.0: winisd_research runs/s04-dtvc-20261118/ (dTVC 100, driver 0.0039 and project 0: Qtc 0.719, the cold figure;
  project 0.0039: Qtc 0.920 whatever the driver value).
- WinISD Pro 0.50a7: winisd_research commit 9ac0941, 0.50a7/runs/050a7/coil-alfavc-20261118/ and PROBE_FINDINGS: same,
  and Save copies the project's value over the driver's.
- AlfaVC is a property of the coil wire's metal (copper 0.00393 /K; aluminium 0.0041 to 0.0043 /K); dTVC depends on the drive,
  so it is the project's (QO953.c15).

## Ruling
John, QO953.c16 ("a", 18 Nov 2026): option A. The sums use the driver's AlfaVC when it is not 0, else the project's; a
WinISD-bug tick-box gives WinISD's project-only sum. QO953.c17: .wdr import and export of alfaVC stay as they are (all held
.wdr files store 0, so they use the project's value).

## Fix
- One engine rule, `DriverEngine.coilAlfaVC_per_K(driverAlfaVC_per_K, projectAlfaVC_per_K, winisdProjectAlfaVC)`
  (`engine/solvers/driverQuantities.ts`): the driver's value when finite and above 0, else the project's; the project's
  only with the switch ticked. A negative driver value (no coil metal's; the field's floor is non-negative) counts as not stated.
- `OpenISDDriver.coilAlfaVC_per_K` asks it; `driveLoadOf(root, driver)` puts the chosen value in `DriveLoad.alfaVC_per_K`,
  which every reader takes: the Box tab's sealed readout and typed Fsc/Qtc (`heatedSourceLoadedQts`), the project solve,
  the Signal tab's hot Re (`usableRe`) and the charts (`ProjectSweepSource.coilAlfaVC_per_K` -> `SweepParams.alfaVC`).
- New project setting `advanced.winisdProjectAlfaVC` (boolean, optional; absent = off), the yellow bug switch
  "Coil coefficient from project" under "Enable WinISD bugs" on desktop and phone; editable only where it changes a sum
  (dTVC not 0 and a driver AlfaVC other than 0 and the project's); a ≠W cue by the project's AlfaVC on the desktop Driver tab.

## Tests
- packages/design/test/domain/coil-alfavc-driver-first.test.ts
- packages/design/test/domain/sealed-readout-heats-coil.test.ts (WinISD's "driver only" reading now runs with the switch ticked)
- packages/design/test/domain/every-input-recalculates.test.ts (the driver's AlfaVC now moves the charts with a hot coil)
