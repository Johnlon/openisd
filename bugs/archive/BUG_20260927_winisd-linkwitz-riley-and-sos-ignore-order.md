# BUG_20260927_winisd-linkwitz-riley-and-sos-ignore-order

**Status:** RESOLVED

## Symptom

WinISD's Linkwitz-Riley and SOS low/high-pass ignore the Order field. The Filter Editor shows an Order box for every low/high-pass subtype. Linkwitz-Riley is always 4th
order (Butterworth-2 squared) and SOS is always 2nd order, whatever Order holds. The `.wpr` keeps the
typed order.

This is a WinISD bug. Evidence and mechanism: [winisd_research/bugs/BUG_20260927_winisd_linkwitz_riley_and_sos_ignore_order.md](http://localhost:8000/winisd/winisd_research/bugs/BUG_20260927_winisd_linkwitz_riley_and_sos_ignore_order.md?html).

## OpenISD

Copied: `filters.ts` `passFilter` keeps the order field (it round-trips through the `.wpr`) and
ignores it for Linkwitz-Riley and SOS, commit bcb445e5, pinned by `filters-winisd.test.ts`.
Filters tab caption shows n=4 for Linkwitz-Riley, as WinISD does (`logic/filterCaption.ts`).

## ⚠ Human re-verification pending (QO170)

Found by debugger, disassembly and scripted runs only. Not yet reproduced by hand in WinISD's own
window. Treat as unconfirmed until John and an agent check it together (QO170); record the result
here.
