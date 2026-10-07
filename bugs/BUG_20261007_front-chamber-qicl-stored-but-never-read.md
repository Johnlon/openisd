# BUG_20261007_front-chamber-qicl-stored-but-never-read

**Status:** RESOLVED 2026-10-07

## Symptom
A 4th-order bandpass, 6th-order bandpass or ABC project stores a Qicl on each chamber, but WinISD has one (`Qiclfr`)
and the sweep reads only the rear chamber's. The front chamber's `losses.Qicl` is dead storage: nothing shows it or
reads it, and a file that gives it a different value keeps it silently.

## Evidence
Checked 2026-10-07: `projectSweep.ts` and `winIsdProjectConverter.ts` read and write only `rear.losses.Qicl`
(`Qiclfr`); WinISD probe e7c754c shows one Qicl in both chamber panels.

## Fix
A front chamber (bandpass4, bandpass6, ABC) stores Ql, Qa and Qp only: its schema is the plain vented chamber, and
the types are split into `VentedChamber` (front) and `CoupledVentedChamber` (rear, with the box's one Qicl). An
`.owpr` from before, with a front Qicl, loads: `retiredFrontQicl.ts` drops the key before validation in both
readers, with no number changed and nothing reported. The .wpr `Qiclfr` still maps to and from the rear chamber.

## Verification
`packages/design/test/domain/front-chamber-qicl.test.ts`: front chambers hold no Qicl; an old file with a front
Qicl loads by the repairing and the plain reader, the other values are unchanged and a re-save has no front Qicl;
.wpr `Qiclfr` imports to the rear Qicl and exports from it. `packages/ui/test/fixtures/sampleProject.test.ts` passes.
Passed 2026-10-07.
