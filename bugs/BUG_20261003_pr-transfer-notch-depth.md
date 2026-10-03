# PR transfer-function magnitude: notch near 43 Hz is -45 dB in OpenISD, ~-20.5 dB in WinISD

Status: OPEN — investigating (2026-10-03). Evidence: /tmp/w.png (WinISD), /tmp/o.png (OpenISD), W5 nd140 + PR.

Same curve everywhere else: -78.5 dB at 1 Hz, +/-0 hump of -20 dB near 30-34 Hz, +3.5 dB peak at 65-71 Hz, flat above 200 Hz.

Difference: OpenISD draws a narrow notch to about -45 dB at ~43.8 Hz. WinISD draws a shallow dip to about -20.5 dB at ~43 Hz with straight polyline segments either side.

Hypothesis (unmeasured): the notch is real (PR transmission zero at the PR resonance) and WinISD's chart grid is too coarse to land a sample at the bottom, as with the group-delay grid difference (BUG_20260926). Test: set WinISD chart resolution to 1-3 Hz / maximum, re-capture, compare notch depth and frequency; also sample OpenISD at WinISD's grid.
Open: peak frequency reads 65 Hz (OpenISD) vs ~71 Hz (WinISD) from pixels; re-measure after the resolution change.
