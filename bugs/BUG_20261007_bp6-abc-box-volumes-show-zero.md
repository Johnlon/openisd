# BUG_20261007_bp6-abc-box-volumes-show-zero

**Status:** OPEN

## Symptom
New 6th-order bandpass or ABC project: Box tab Vb (rear) and Vf (front) show 0, Frc and Ffc are blank,
vent diameters are blank, and the chart is blank (sweep blocked).

## Evidence
Run 2026-10-07 on a fresh `ProjectBuilder(driver, engine).bandpass6()` / `.abc()` `.build()` (tsx script, scratchpad):
- `box.volumeOf(type).value` = 0, `box.frontVolumeOf(type).value` = 0, `box.rearTuningOf(type).value` = null, `vents.rear.diameter_m.value` = null.
- `project.sweepPlan(...)` = `blocked`, `missing-dependencies` on `length_m` (no tuning, no area).
- `ventGroupOf('bandpass6')` returns `box.vented`, not the bandpass6 front chamber.

## Cause
Nothing ever gives these two types a starting value. `TwoChamberProjectBuilder.boxRecord` writes `?? 0` for both volumes
(`packages/design/domain/openisdTransforms.ts:356,361`) and `emptyBoxJson` holds 0 (`boxDefaults.ts:39-44`).
`OpenISDBox.applyStartingValues` returns straight away for `bandpass6` and `abc` (`openISDBox.ts:486-492`), so the 0 is
never filled, unlike sealed, vented, PR and bandpass4 (which fill any volume that is not > 0, `isStated`, `openISDBox.ts:87`).
The New Project wizard has no volume step for them (`isDual` is bandpass4 only, `OriginalNewProject-hooks.ts:199`), and the
builder call there is `b.bandpass6()` with nothing passed (`OriginalNewProject-hooks.ts:451-452`).

## Fix
`applyStartingValues` gives bandpass6 and ABC volumes, tunings and vent geometry (values from the WinISD capture `winisd_research/runs/bp6_abc_wizard_defaults/`: Vr 0.03 m3, Fr 35 Hz, Vf 0.02 m3, Ff 25 Hz, round vents dia 0.102 m; rear len 0.5906 m, front len 1.8812 m; ABC adds an intra vent dia 0.102 m, len 0.050 m; see
`docs/plans/PLAN_20261007_bp6_abc_complete.md`). The wizard passes its volumes through.

## Verification
- New domain spec: a built bandpass6 and ABC project has Vr, Vf > 0, Fr, Ff stated, vents with a size, and `sweepPlan` is `ready`.
- Existing: `box-volume-of.test.ts`, `project-sweep-plan.test.ts` stay green (the "blocked" case there must change, see plan step 1).
