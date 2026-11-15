# BUG_20261115_lr2-size-line-states-one-section-not-two

**Status:** OPEN (found reviewing the T793 baseline `desktop-dialog-difference-cue`; not fixed there)

## Symptom
The "WinISD ignores the Linkwitz-Riley order" entry says "Low-pass, one octave above fc: LR2 −7.0 dB, LR4 (WinISD) −24.6 dB."

## Check
An LR2 filter is two cascaded first-order Butterworth sections (the entry's own definition: "two Butterworth filters of order n/2 in a row").
One octave above fc a first-order low-pass is 1/sqrt(1+2^2) = −6.99 dB, so LR2 is 2 x that = −13.98 dB. The LR4 figure checks: two second-order
sections, each 1/sqrt(1+2^4) = −12.30 dB, total −24.6 dB. The −7.0 dB is one section's figure. The phase line (−90° against −180°) is right.

## Evidence
Picture `desktop-dialog-difference-cue` (and `mobile-dialog-shared-winisd-difference-entry`); source `packages/design/fields/winisdDeviation.ts` line 247.

## Fix
Not done in T793. Say "LR2 −14.0 dB" and put a test on the figure computed from the filter definition.
