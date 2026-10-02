# BUG_20260927_winisd-filter-charts-skip-zero-box-points

**Status:** RESOLVED

## Symptom

WinISD's plot code skips any point whose box value is exactly zero — EQ/Filter charts included. The per-point plot function returns 0 without plotting whenever the box routine's value |Z| is
exactly 0 — for every chart kind, including the three EQ/Filter charts, which do not depend on the
box. The EQ/Filter group delay chart lost 92 of 2087 points this way on the sealed W5.

This is a WinISD bug. Evidence and mechanism: [winisd_research/bugs/BUG_20260927_winisd_filter_charts_skip_points_where_box_value_is_zero.md](http://localhost:8000/winisd/winisd_research/bugs/BUG_20260927_winisd_filter_charts_skip_points_where_box_value_is_zero.md?html).

## OpenISD

Not copied yet. OpenISD's EQ/Filter charts plot every point. Needs a check of what WinISD draws
at a skipped point (gap or 0) before deciding whether to copy it.

## ⚠ Human re-verification pending (QO170)

Found by debugger, disassembly and scripted runs only. Not yet reproduced by hand in WinISD's own
window. Treat as unconfirmed until John and an agent check it together (QO170); record the result
here.

## Resolution (2026-09-29): not copied — no visible effect
winisd_research runs/filt-peq-2 (sealed W5, peaking EQ): the 92 points kind 19 skips are all single,
isolated points between 9.2 kHz and 20.1 kHz, where the EQ/Filter group delay is ~0 and the trace
sits on the axis (20_filtergroupdelay.png). No run of two adjacent skipped points, so no gap is
visible. OpenISD plots every point; the charts already compare equal at every point WinISD logs
(CHART_REVIEW_WINISD_VS_OPENISD.md, filter GD within WinISD rounding).
