# BUG_20261026_mobile-alignment-readout-stepper-gap

**Status:** FIXED (T601)

## Symptom

In the mobile vented alignment sheet, the Volume and Tuning frequency value boxes left a wide
empty area after their L and Hz unit chips.

## Cause

The mobile classic field layout positions unit chips before the ▲▼ stepper area. Read-only fields
do not render steppers, but still reserved that space, so the unit chip floated away from the right
edge of its value box.

## Fix

Read-only mobile fields no longer reserve a stepper area. Their value box spans to its normal edge
and the unit chip sits at that edge. Editable fields retain their stepper spacing.

## Verification

`bash scripts/test.sh packages/ui/test/ui/mobile-box-tab-alignment.browser.spec.ts` asserts both
alignment readouts place the unit at the value-box edge and keep their switchable units grey.
