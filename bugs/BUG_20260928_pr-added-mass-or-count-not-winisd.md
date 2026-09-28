# BUG_20260928_pr-added-mass-or-count-not-winisd

**Status:** OPEN

## Symptom
A passive-radiator box with added mass on the radiator (Me = 10 g) and two radiators (Npr = 2)
does not match WinISD. With Me = 0 and Npr = 1 every chart matches exactly (chart review §3.6).

## Evidence
winisd_research runs/pr-w5-me-npr-1 (W5 in 10 L, radiator Fs 30 Hz, Vas 4.8 L, Qms 3.3, Sd 95 cm²,
Me 0.01, Npr 2, no filters), compared with OpenISD by toys/chart_plot_compare.py:

| Chart | Max difference |
|---|---|
| Impedance | 1.1 Ω at 58.9 Hz |
| Transfer function magnitude | 2.0 dB |
| PR transfer magnitude | 4.8 dB |
| PR transfer phase | 15.8° |
| Cone excursion | 0.11 mm |
| PR excursion | 0.07 mm |

## Cause
Unknown yet. Separate captures pr-w5-me-1 (Me only) and pr-w5-npr-1 (Npr only) are running to tell
which of the two OpenISD handles differently from WinISD (0x45a960).

## Fix
Match WinISD's use of Me and Npr in the PR model, once identified.

## Verification
Engine test against the captures, same tolerances as passive-radiator-winisd.test.ts.
