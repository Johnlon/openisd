# BUG_20260927_winisd-allpass-t-not-delay-order-above-2-ignored

**Status:** RESOLVED

## Symptom

WinISD's Allpass: t is not the delay for order ≥ 2, and orders above 2 are ignored. The Allpass Filter Editor asks for "t (s)". For order 1 the DC group delay is t. For order ≥ 2
WinISD uses ω0 = 2/t, so the DC group delay is t/Q, not t (Q 0.6, t 3 ms → 5 ms). Orders 3 and 4
give exactly the order-2 section — the order field above 2 does nothing.

This is a WinISD bug. Evidence and mechanism: [winisd_research/bugs/BUG_20260927_winisd_allpass_t_is_not_the_delay_and_order_above_2_ignored.md](http://localhost:8000/winisd/winisd_research/bugs/BUG_20260927_winisd_allpass_t_is_not_the_delay_and_order_above_2_ignored.md?html).

## OpenISD

Copied by default: `filters.ts` `allpass` (ω0 = 2/t for order ≥ 2, order above 2 ignored),
commit bcb445e5, pinned by `filters-winisd.test.ts` (captures `2|0;1;2;0.003;0.6`,
`2|0;1;3;0.004;0.8`, `2|0;1;4;0.002;0.7`). Stretch, not built: a conventional allpass where t is
the delay and every order is honoured.

## Checked by hand (QO170, 2026-10-04)

SEEN. The group-delay plateau is 3.0 ms at order 1 and 5.0 ms at order 2 with Q 0.6 (t/Q), and the order 4 chart
is pixel-identical to order 2. Screenshots (`winisd_research/runs/qo170-allpass/`): `allpass_3_n1…png` (3 ms), `allpass_1_n2…png`
(5 ms), `allpass_2_n4…png` (identical to order 2).
