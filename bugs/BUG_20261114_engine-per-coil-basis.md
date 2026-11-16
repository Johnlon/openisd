# BUG_20261114_engine-per-coil-basis

**Status:** OPEN (root-caused; fix is plan Phase 1)

Links: issue https://github.com/Johnlon/openisd/issues/512 · plan `/home/johnl/work/winisd/openisd/docs/plans/PLAN_20261114_DVC_WIRING_AND_DQ.md` · rulings in `/home/johnl/work/winisd/questions.yml`: QO900 (R1), QO904 (A1).

## Symptom
OpenISD reports false Qes/BL/Rme/Mpow inconsistencies on multi-coil drivers whose datasheet figures agree with each other. The Dayton MX6-22 shows a 49.5% Qes disagreement and the user cannot clear it.

## Steps to reproduce
1. Open the Dayton MX6-22 from the catalogue (record `/home/johnl/work/winisd/winisd_drivers/snapshot/datasheets/dayton-audio/mx6-22/openisd.json`: Re 4.7 Ω, BL 12.3 Tm, Fs 30 Hz, Mms 0.0638 kg, Qes 0.37, numVC 2, VCCon C = 1).
2. Look at the Driver tab consistency list.
3. Observed: Qes disagrees by 49.5% (also BL 28.9%, Rme 49.5%, Mpow 28.9%). Expected: no warnings. Datasheet: https://daytonaudio.com/images/resources/295-744--dayton-audio-MX6-22-spec-sheet.pdf ("All specifications measured with voice coils wired in series").

## Evidence
- Correct as published: Qes = 2π·30·0.0638·4.7/12.3² = 0.373, stated 0.37.
- The engine uses Re 2.35 (4.7 / 2², VCCon defaulted parallel) → Qes 0.187 vs 0.37 stated; implied BL 8.75; Rme 64.4; Mpow 8.02.
- Switching VCCon to series gives Re 9.4 / BL 24.6 → Qes still 0.187.
- Population: 31 multi-coil records fail this way (24 Dayton/Eminence ×2, 6 Bliesma ×3, +1).
- Same warnings are in `/home/johnl/work/winisd/winisd_drivers/snapshot/datasheets/dayton-audio/mx6-22/dq.alert`.

## Cause
`/home/johnl/work/winisd/openisd/packages/design/engine/driver/DriverEngine.ts:155` `toTerminalSpace` treats stored Re/BL as per coil and converts them by numVC and VCCon before the T/S maths; `checkConsistency` does the same. Published figures are for the whole driver in the measured wiring, so converting them again is wrong: the engine halves Re (and BL) for a wiring the figures were not published in, and the T/S relations then disagree with the stated Qes. The wiring conversion belongs only to the amplifier-side figures.

## Fix
Plan Phase 1 (rulings QO900 R1, QO904 A1):
- remove `toTerminalSpace` from `solveValues` and `checkConsistency`, and the per-coil precision scaling;
- amplifier-side Re/BL come only from the measured → user wiring conversion (series→parallel: Re ÷ N², BL ÷ N);
- `withAddedMass` and `enteredTerminalBL_Tm` use the stored figures.

## Verification
- Engine unit tests: MX6-22 Qes 0.373, Rme 32.2, Mpow 5.67, Mpow² = Rme, no issues; Visaton GF 250 series set, RSS265HO-44, Bliesma W137A-854-4 consistent.
- Conversion unit: MX6-22 series → parallel gives 1.175 Ω / 6.15 Tm, Qes unchanged.
- Whole-catalogue old-vs-new diff (A3): single-coil records change only in the VCCon mark and version stamp.
- Health-scan diff: the 31 records' warnings FIXED.

## Prevention (mechanical)
The engine unit tests above, the `it.fails` parity cases in `driver-edit-parity-e150he-44.test.ts` / `driver-edit-parity-w5.test.ts` converted to normal tests, and the old-vs-new whole-catalogue diff script.
