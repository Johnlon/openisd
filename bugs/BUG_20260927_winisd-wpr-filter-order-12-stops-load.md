# BUG_20260927_winisd-wpr-filter-order-12-stops-load

**Status:** RESOLVED

## Symptom

A .wpr holding a Butterworth order 12 stops WinISD reaching its main window. Load a project whose `[Filters]` holds a low-pass Butterworth with order 12: WinISD never reaches
a ready main window (the harness attach times out). Order 10 loads fine.

This is a WinISD bug. Evidence and mechanism: [winisd_research/bugs/BUG_20260927_winisd_wpr_filter_order_12_stops_load.md](http://localhost:8000/winisd/winisd_research/bugs/BUG_20260927_winisd_wpr_filter_order_12_stops_load.md?html).

## Cause (John, 2026-10-01)

WinISD's filter calculation hits a floating-point overflow above order 10. The error appears in a
modal dialog, which blocks WinISD's main window — that is the "never reaches a ready main window"
the harness saw, not a hang. The order-10 cap in WinISD's Filter Editor exists because of this bug;
it is not a design limit.

## OpenISD

Not copied: OpenISD reproduces WinISD's calculation warts, not its crashes. `FILTER_ORDER_LIMITS`
(`packages/design/fields/filterLimits.ts`) is 1..20 (was 1..10, copied from WinISD); OpenISD's
Butterworth and Bessel compute order 20 cleanly (−3.01 dB at fc for Butterworth n = 20). The order
field's help says WinISD stops at 10 and shows the overflow error above it. Logged as row 12 in
`docs/research/ACCURACY_IMPROVEMENTS.md`.

Verification: `filter-update.test.ts` (order 15 kept, 25 → 20) and `filter-chain-charts.test.ts`
(order 20 finite, monotonic, −3.01 dB at fc).

⚠ Open: a `.wpr` saved from OpenISD with order > 10 shows WinISD's overflow error when opened in
WinISD. Clamp to 10 on `.wpr` export, warn, or leave as is — John to decide.

## Human verification (QO170)

Confirmed by John, 2026-10-01: "winisd gets an FP overflow when > 10".
