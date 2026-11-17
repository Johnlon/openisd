# BUG_20261114_saved-multicoil-projects-need-upgrade

**Status:** OPEN (root-caused; fix is plan Phase 1 step 5)

Links: issue https://github.com/Johnlon/openisd/issues/512 · plan `/home/johnl/work/winisd/openisd/docs/plans/PLAN_20261114_DVC_WIRING_AND_DQ.md` · rulings in `/home/johnl/work/winisd/questions.yml`: QO908 (V4), QO900 (R1).

## Symptom
Once Re/BL are stored as published (R1), a saved project's embedded multi-coil driver holds the old meaning and would load with wrong figures.

## Steps to reproduce
1. Take a v3 project embedding a multi-coil driver, e.g. Visaton GF 250 saved with Re 3.1 / BL 6.5 (per coil, E, VCCon series).
2. Load it after R1 ships. Expected: Re 6.2 / BL 13. Observed without an upgrade: 3.1 / 6.5 read as published.

## Cause
Projects embed their driver (`/home/johnl/work/winisd/openisd/packages/design/domain/project/openISDProject.ts:125-156`). v3 saved data holds per-coil Re/BL for multi-coil drivers; R1 changes their meaning. `schemaVersion` exists (`/home/johnl/work/winisd/openisd/packages/design/domain/schemaVersion.ts`, stamped by `/home/johnl/work/winisd/openisd/packages/design/domain/project/projectSerialization.ts:25` and `/home/johnl/work/winisd/openisd/packages/design/domain/driver/openISDDriver.ts:330`) but has no step for this.

## Fix
`schemaVersion` 3 → 4 upgrade step (QO908), for driver records and embedded project drivers. For numVC ≥ 2: VCCon E → multiply back by the wiring factor; VCCon C → leave the figures, VCCon becomes unknown; single coil untouched.

## Verification
Upgrade unit tests: v3 VCCon E series (Visaton 3.1 → 6.2); E parallel; C default (MX6-22 4.7 kept, VCCon → unknown); single coil unchanged; an embedded project driver; a v2 file through 2 → 3 → 4; a v5 file refused.

## Prevention (mechanical)
The upgrade unit tests, run in pr-gate; every change in the meaning of a stored field bumps `schemaVersion`.
