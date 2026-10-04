# BUG_20260927_winisd-allpass-t-not-delay-order-above-2-ignored

**Status:** RESOLVED

## Symptom

WinISD's Allpass: t is not the delay for order ≥ 2, and orders above 2 are ignored. The Allpass Filter Editor asks for "t (s)". For order 1 the DC group delay is t. For order ≥ 2
WinISD uses ω0 = 2/t, so the DC group delay is t/Q, not t (Q 0.6, t 3 ms → 5 ms). Orders 3 and 4
give exactly the order-2 section — the order field above 2 does nothing.

This is a WinISD bug. Evidence and mechanism: [winisd_research/bugs/BUG_20260927_winisd_allpass_t_is_not_the_delay_and_order_above_2_ignored.md](http://localhost:8000/winisd/winisd_research/bugs/BUG_20260927_winisd_allpass_t_is_not_the_delay_and_order_above_2_ignored.md?html).

## OpenISD

Fixed by default (2026-10-04, John: orders above 2 ignored is a WinISD bug).

Rule chosen: an order-n allpass is the Bessel (maximally flat delay) allpass
H(s) = θn(−s·t/2)/θn(s·t/2), θn the reverse Bessel polynomial. Its low-frequency group delay is t
at every order, flat to a higher frequency as the order rises. Q is not used: a Bessel allpass has
a fixed shape, so WinISD's Q has no counterpart (at order 2 the Bessel section's own Q is 1/√3).
Order 1 is θ1 = s + 1, (1 − jωt/2)/(1 + jωt/2), identical to WinISD's. Order 2 differs from
WinISD's: WinISD's section is a general 2nd-order allpass (ω0 = 2/t, entered Q, delay t/Q), which is
the Bessel one only at Q = 1/√3 and delay √3·t.

Yellow error switch "WinISD allpass order" (`winisdAllpassOrder`, "WinISD errors" group): off by
default, Reset to WinISD ticks it, editable only while an enabled allpass of order 2 or more
exists. Ticked: WinISD's own (ω0 = 2/t, delay t/Q, orders above 2 drawn as 2). A ≠W deviation cue
beside the allpass Order box explains the difference while the switch is off.

Code: `engine/filters/AllpassFilterModel.ts`. Tests: `packages/design/test/engine/filters-winisd.test.ts`
(the WinISD captures `2|0;1;2;0.003;0.6`, `2|0;1;3;0.004;0.8`, `2|0;1;4;0.002;0.7` run with the
switch on; off: delay t for orders 1–20, order 4 ≠ order 2), `packages/design/test/domain/error-switches.test.ts`.

## Checked by hand (QO170, 2026-10-04)

SEEN. The group-delay plateau is 3.0 ms at order 1 and 5.0 ms at order 2 with Q 0.6 (t/Q), and the order 4 chart
is pixel-identical to order 2. Screenshots (`winisd_research/runs/qo170-allpass/`): `allpass_3_n1…png` (3 ms), `allpass_1_n2…png`
(5 ms), `allpass_2_n4…png` (identical to order 2).
