# BUG_20261114_driver-help-contradicts-engine

**Status:** OPEN (root-caused; fix is plan Phase 1 step 6)

Links: issue https://github.com/Johnlon/openisd/issues/512 · plan `/home/johnl/work/winisd/openisd/docs/plans/PLAN_20261114_DVC_WIRING_AND_DQ.md` · rulings in `/home/johnl/work/winisd/questions.yml`: QO900 (R1), QO907 (A4, "My wiring").

## Symptom
The help text and the warning message tell users to do things that are wrong. The user could not fix the MX6-22 in the editor: only Re 2.35 / BL 6.15 / series would clear the warning, which contradicts the datasheet.

## Steps to reproduce
1. Open the MX6-22 Driver editor (Re 4.7, BL 12.3, numVC 2).
2. Read the Re help, the VCCon "Connection" help and the consistency message.
3. Try to clear the Qes warning by editing a value.

## Cause
- `/home/johnl/work/winisd/openisd/packages/design/fields/field.ts:782` Re help: "Resistance across the voice coil terminals", while the engine treats Re as per coil.
- `/home/johnl/work/winisd/openisd/packages/design/fields/field.ts:1399-1403` VCCon "Connection" help: "Series or parallel — sets the driver's total terminal Re and BL for a multi-coil driver" reads as the user's wiring, while the scraper defines VCCon as the wiring the datasheet was measured in.
- `/home/johnl/work/winisd/openisd/packages/design/engine/consistency.ts` `inconsistentInputs` message ends "correct one of them, or clear one to let it be calculated", which tells users to change correct datasheet values.

## Fix
Plan Phase 1 step 6 (QO907 "My wiring" project setting): "Measured wiring" (from the datasheet) and "My wiring" (the build); Re/BL help "as published, for the measured wiring"; the consistency message no longer tells users to change datasheet values. Also `DriverConsistencyList.vue` texts.

## Verification
Hook/UI test: My wiring disabled with its message when measured wiring is unknown, enabled and converting when known. Browser spec: MX6-22 shows no warnings, set My wiring = parallel, Placement shows 1.175 Ω / 6.15 Tm.

## Prevention (mechanical)
The UI and browser specs above; a unit test pinning the new help strings to the field definitions.
