# BUG_20261108_phone-field-labels-wrap

**Status:** OPEN

## Symptom
On the phone skin at 374x705, ten field labels showed on two lines: Number of Vents, End Correction, Vent diameter, 1st port resonance, Velocity limit (Box tab vents), Relative humidity, Sound velocity (Advanced and Options), Input power (What-if sheet), Min box volume, Max box volume (Options).

## Evidence
AI live review of test v20261108T0728Z. `packages/ui/test/ui/phone-field-labels-one-line.browser.spec.ts` measured each label 32px tall on a 16px line (red before the fix, green after).

## Cause
The label column was 82px (vents, What-if sheet) or 96px (Advanced, Options), too narrow for "1st port resonance" at 14px. The label text is not too long for a layout; no text change is needed.

## Ruling needed
Fixing it by widening the shared label column (82/96 -> 132 px) narrows every phone box by ~50 px and breaks the reviewed-width contract the rendition oracle pins. Needs John's ruling on: A widen column, B shorter label texts, or C allow two-line labels.

## Fix tried (reverted)
`PhoneRowColumns.STANDARD` (the one label column on every phone page) and `MEDIUM_LABEL` widened from 82/96 to 132px. Per-field wider columns on one page were tried and broke the field-layout rule that every box on a tab has the same left edge and width.

## Verification
The spec above is an expected failure (test.fail) until ruled; it walks Box (vents), Advanced, Options and the What-if sheet at 374x705 and asserts every label is at most 1.6 line-heights tall.
