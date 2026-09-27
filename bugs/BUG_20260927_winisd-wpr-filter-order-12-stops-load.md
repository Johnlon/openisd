# BUG_20260927_winisd-wpr-filter-order-12-stops-load

**Status:** RESOLVED

## Symptom

A .wpr holding a Butterworth order 12 stops WinISD reaching its main window. Load a project whose `[Filters]` holds a low-pass Butterworth with order 12: WinISD never reaches
a ready main window (the harness attach times out). Order 10 loads fine.

This is a WinISD bug. Evidence and mechanism: [winisd_research/bugs/BUG_20260927_winisd_wpr_filter_order_12_stops_load.md](http://localhost:8000/winisd/winisd_research/bugs/BUG_20260927_winisd_wpr_filter_order_12_stops_load.md?html).

## OpenISD

Not copied (a hang is not a wart to keep). The Filters tab order field is limited to 1–10
(`packages/ui/src/logic/fields/uiFields.ts` `filter_Order`, the highest order WinISD is known to
load), so OpenISD never writes a `.wpr` WinISD cannot open. ⚠ Import of a `.wpr` with order > 10:
decide in chunk 3 (clamp or warn).

## ⚠ Human re-verification pending (QO170)

Found by debugger, disassembly and scripted runs only. Not yet reproduced by hand in WinISD's own
window. Treat as unconfirmed until John and an agent check it together (QO170); record the result
here.
