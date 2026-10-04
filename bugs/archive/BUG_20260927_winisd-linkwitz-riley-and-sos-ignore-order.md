# BUG_20260927_winisd-linkwitz-riley-and-sos-ignore-order

**Status:** RESOLVED

## Symptom

WinISD's Linkwitz-Riley and SOS low/high-pass ignore the Order field. The Filter Editor shows an Order box for every low/high-pass subtype. Linkwitz-Riley is always 4th
order (Butterworth-2 squared) and SOS is always 2nd order, whatever Order holds. The `.wpr` keeps the
typed order.

This is a WinISD bug. Evidence and mechanism: [winisd_research/bugs/BUG_20260927_winisd_linkwitz_riley_and_sos_ignore_order.md](http://localhost:8000/winisd/winisd_research/bugs/BUG_20260927_winisd_linkwitz_riley_and_sos_ignore_order.md?html).

## OpenISD

Linkwitz-Riley: fixed by default, no switch: WinISD ignores the input (John, 2026-10-04). OpenISD
honours the order: a Linkwitz-Riley of even order n is Butterworth(n/2) squared. The Order box
takes even orders only, 2 to 20 (step 2; a typed odd order rounds to the even one above, 3 → 4); a
loaded odd order draws the same way. The caption shows the order drawn. The ≠W Difference cue
beside the Order box shows while the order is not 4 and says WinISD always draws LR4. The WinISD
captures of LR2 and LR6 are a recorded deviation: they match OpenISD's LR4.

User SOS: a second-order section is order 2 by definition, so OpenISD agrees with WinISD. The
Order box is greyed out with a tooltip saying so; no cue.

Code: `engine/filters/passFamilies/LinkwitzRileyFamily.ts`, `FilterEngine.passOrderEntry`,
`fields/winisdDeviation.ts`. Tests: `filters-winisd.test.ts`, `filter-update.test.ts`,
`filter-caption.test.ts`, `original-filters-tab.browser.spec.ts`.

## Checked by hand (QO170, 2026-10-04)

SEEN, with one correction. A typed Linkwitz-Riley order of 2 or 6 gives caption order 4, and the box reopens at
4.000: the editor does not keep the typed order. (The claim that a loaded file keeps the typed order is not
what the editor does.) SOS order 4 reads −12.4 dB at 100 Hz, the same curve as order 2. Screenshots
(`winisd_research/runs/qo170-bessel/`): `lr_1_order2…png` / `lr_2_order6…png`, `sos_1_order4…png` / `sos_2_order2…png`.
