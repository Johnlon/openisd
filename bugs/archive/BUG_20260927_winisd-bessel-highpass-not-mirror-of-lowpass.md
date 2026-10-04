# BUG_20260927_winisd-bessel-highpass-not-mirror-of-lowpass

**Status:** RESOLVED

## Symptom

WinISD's Bessel high-pass is not the mirror of its Bessel low-pass. WinISD's Bessel high-pass keeps the low-pass's poles and only swaps the numerator to (k·s)^n.
A true Bessel high-pass reflects the poles (s → 1/s). The curve differs from a textbook Bessel HP:
n=4 at fc 25 Hz is up to 6 % off in complex response. Butterworth and SOS are unaffected (their
pole sets are symmetric).

This is a WinISD bug. Evidence and mechanism: [winisd_research/bugs/BUG_20260927_winisd_bessel_highpass_is_not_the_mirror_of_its_lowpass.md](http://localhost:8000/winisd/winisd_research/bugs/BUG_20260927_winisd_bessel_highpass_is_not_the_mirror_of_its_lowpass.md?html).

## OpenISD

Correct by default (2026-10-03): the Bessel high-pass is the mirror of the low-pass,
`packages/design/engine/filters/passFamilies/BesselFamily.ts` `highpass`, pinned by
`packages/design/test/engine/bessel-highpass-switch.test.ts`. The error switch "WinISD Bessel
high-pass" (`winisdBesselHighpass`, off by default, ticked by Reset to WinISD) brings WinISD's form
back; the WinISD captures (`2|1;2;1;4;25;0.707` etc.) in `filters-winisd.test.ts` run with it on.

## Checked by hand (QO170, 2026-10-04)

SEEN. Order 4, fc 25 Hz: the high-pass reads −1.25 dB at 50 Hz and the low-pass −1.67 dB at 12.5 Hz. A true mirror
reads the same at both. Screenshots (`winisd_research/runs/qo170-bessel/`): `bessel_1_lp_n4_25.png` / `bessel_2_hp_n4_25.png`
(compare the two magnitude readings at the cursor).
