# Peaking 2nd order highpass: a peak magnitude below 0 dB draws nothing, with no issue shown

Status: FIXED by T913 (engine draws no curve and raises an issue; WinISD itself dies on this value, see below). Task T913 (tasks/T913.yml). Found by the copy sweep (`portingle/copysweep`, `scripts/copysweep/`): 0, 3 and 12 dB are right, every negative value is blank.

## Symptom

Add a "Peaking 2nd order highpass" filter (WinISD filter type 5) with Peak mag -6 dB, Peak freq 50 Hz. The filter chart and the system chart draw no curve and no issue is shown. The gain field allows -60..+60 dB (`FILTER_GAIN_LIMITS` in `packages/design/fields/filterLimits.ts`), so 60 of the 120 allowed whole-dB values are affected.

## Cause

`packages/design/engine/filters/PeakHighpassFilterModel.ts` computes Q² = (P² + P·√(P²−1))/2 with P = 10^(Gpk/20). For Gpk < 0 dB, P < 1, P²−1 is negative, the square root is NaN, Q, w0 and the response are NaN, and the chart drops every point.

| Gpk (dB) | P | P²−1 | Q² |
| --- | --- | --- | --- |
| 12 | 3.98 | 14.8 | 15.9 right |
| 3 | 1.41 | 1.0 | right |
| 0 | 1 | 0 | 0.5 right (Butterworth) |
| -6 | 0.501 | -0.749 | NaN |

## What WinISD does

Probe, `winisd_research/toys/probe_peakhp_negative_gain.py`, run `winisd_research/runs/peakhp-negative-20261118/` (WinISD 0.7.0 under wine, headless, one fresh wine prefix):

- Control, `control-plus6/`: Peak mag 6, Peak freq 50: filter added, chart drawn (screen pictures and saved `.wpr`).
- Peak mag -6, Peak freq 50: the value is accepted by the Filter Editor (picture `editor_before_add.png`), and clicking Add makes the WinISD process disappear (no windows left). Repeated twice, same result. `RESULT.txt` records it.

So WinISD does not clamp, refuse or draw a different curve: it dies. Under wine a floating-point exception is fatal (see `winisd_research/PROBE_METHOD.md`), so on real Windows this may be an error box instead; that is not shown by this run.
