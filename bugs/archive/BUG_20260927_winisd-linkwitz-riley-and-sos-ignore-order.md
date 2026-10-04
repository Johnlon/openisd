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

## Checked by hand (QO170, 2026-10-04)

SEEN, with one correction. A typed Linkwitz-Riley order of 2 or 6 gives caption order 4, and the box reopens at
4.000: the editor does not keep the typed order. (The claim that a loaded file keeps the typed order is not
what the editor does.) SOS order 4 reads −12.4 dB at 100 Hz, the same curve as order 2. Screenshots
(`winisd_research/runs/qo170-bessel/`): `lr_1_order2…png` / `lr_2_order6…png`, `sos_1_order4…png` / `sos_2_order2…png`.
