# BUG_20261114_vccon-default-feeds-maths

**Status:** OPEN (root-caused; fix is plan Phase 1 step 2)

Links: issue https://github.com/Johnlon/openisd/issues/512 · plan `/home/johnl/work/winisd/openisd/docs/plans/PLAN_20261114_DVC_WIRING_AND_DQ.md` · rulings in `/home/johnl/work/winisd/questions.yml`: QO900 (R1).

## Symptom
A driver whose wiring is not stated gets VCCon = parallel and numVC = 1 invented for it, and the invented value is used in the maths. MX6-22 (numVC 2, wiring stated only in prose) is treated as parallel, which produces the #512 warnings.

## Steps to reproduce
1. Load `/home/johnl/work/winisd/winisd_drivers/snapshot/datasheets/dayton-audio/mx6-22/openisd.json` (VCCon `{state: C, value: 1}`, a default).
2. Resolve the driver; the engine converts Re 4.7 → 2.35 using that default.

## Cause
- `/home/johnl/work/winisd/openisd/packages/design/domain/driver/openIsdDriverSpec.ts:391` `resolve()` stores `calcVCCon()` (parallel) when VCCon is unset; `:395` stores `calcNumVC()` (1) for numVC.
- `/home/johnl/work/winisd/openisd/packages/design/domain/winIsdDriverImport.ts:56` does the same on import.
- The default then drives `toTerminalSpace`. In WinISD, VCCon is not a calculation input (`/home/johnl/work/winisd/winisd_research/archive/findings/FINDING_20261019_numvc-is-not-a-simulation-input.md`), so copying the default was harmless there. Here it feeds the maths.

## Fix
Plan Phase 1 step 2 (QO900 R1): no VCCon/numVC default; null stays null; `winIsdDriverImport.ts` does no division by the wiring factor; remove `calcVCCon` / `calcNumVC` from `voiceCoilWiring.ts` as defaults.

## Verification
Unit: an unset VCCon stays null after resolve and import; .wdr round trip byte-identical (`scripts/roundTripGate.mjs`); whole-catalogue old-vs-new diff passes.

## Prevention (mechanical)
Unit test that resolve() never writes VCCon/numVC; the round-trip gate.
