# BUG_20261114_bridge-writes-calculated-per-coil-values-as-entered

**Status:** OPEN (root-caused; fix is plan Phase 1 step 2)

Links: issue https://github.com/Johnlon/openisd/issues/512 · plan `/home/johnl/work/winisd/openisd/docs/plans/PLAN_20261114_DVC_WIRING_AND_DQ.md` · rulings in `/home/johnl/work/winisd/questions.yml`: QO900 (R1), QO904 (A1, keeps "a typed value is never rewritten, derived values are marked C").

## Symptom
The bridge divides stated series figures by the coil count and keeps them marked E. The datasheet says Re 6.2 Ω; openisd.json says Re 3.1 Ω marked entered.

## Steps to reproduce
1. Read `/home/johnl/work/winisd/winisd_drivers/snapshot/datasheets/visaton/gf-250-2-x-4-ohm/driver.json`: Re_ohm "6.2 Ohm", BL_Tm "13 T m" (series set, VCCon 2, numVC 2). Page: https://www.visaton.de/en/products/drivers/archive/gf-250-2-x-4-ohm.
2. Read the sibling `openisd.json`: Re_ohm 3.1 (E), BL_Tm 6.5 (E).

Same for the 9 Visaton/SB records (visaton gf-200-2-x-4-ohm, gf-250-2-x-4-ohm, tiw-360-ds-2-x-4-ohm, tiw-400-ds-2-x-4-ohm, w-100-x-2-x-4-ohm, w-130-x-2-x-4-ohm; sb-acoustics sb34swpl76-3-dv, sw26dac76-3-dv, sw26dbac76-3-dv).

## Cause
`/home/johnl/work/winisd/openisd/packages/design/domain/driverRecordConverter.ts:795` `#derivePerCoilVoiceCoilFields` divides Re/BL by numVC for series-wired records and keeps the state E. A calculated value is presented as entered.

## Fix
Plan Phase 1 step 2 (QO900): delete `#derivePerCoilVoiceCoilFields`; store the published figures. The V4 upgrade (QO908) multiplies existing E-series values back.

## Verification
GF 250 openisd.json holds Re 6.2 / BL 13 marked E; engine reports it consistent; old-vs-new catalogue diff shows only the 9 expected records changing.

## Prevention (mechanical)
Whole-catalogue old-vs-new diff script (A3) and a converter unit test that no field's value differs from its driver.json reading.
