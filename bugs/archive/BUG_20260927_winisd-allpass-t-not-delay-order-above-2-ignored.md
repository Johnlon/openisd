# BUG_20260927_winisd-allpass-t-not-delay-order-above-2-ignored

**Status:** RESOLVED

## Symptom

WinISD's Allpass: t is not the delay for order ≥ 2, and orders above 2 are ignored. The Allpass Filter Editor asks for "t (s)". For order 1 the DC group delay is t. For order ≥ 2
WinISD uses ω0 = 2/t, so the DC group delay is t/Q, not t (Q 0.6, t 3 ms → 5 ms). Orders 3 and 4
give exactly the order-2 section — the order field above 2 does nothing.

This is a WinISD bug. Evidence and mechanism: [winisd_research/bugs/BUG_20260927_winisd_allpass_t_is_not_the_delay_and_order_above_2_ignored.md](http://localhost:8000/winisd/winisd_research/bugs/BUG_20260927_winisd_allpass_t_is_not_the_delay_and_order_above_2_ignored.md?html).

## OpenISD

Fixed by default, no switch: WinISD ignores the input (John, 2026-10-04: an input WinISD ignores
entirely is a plain bug; OpenISD honours it and a Difference cue explains WinISD's behaviour).

- Order 1: (1 − jωt/2)/(1 + jωt/2), delay t — WinISD's own.
- Order 2: WinISD's own 2nd-order allpass, ω0 = 2/t and entered Q, delay t/Q. That is WinISD's
  definition and stays.
- Above order 2 (WinISD draws order 2): the order-n Bessel (maximally flat delay) allpass
  H(s) = θn(−s·t/2)/θn(s·t/2), θn the reverse Bessel polynomial. Low-frequency delay t, flat to a
  higher frequency as the order rises; Q is not used.

The ≠W Difference cue beside the allpass Order box shows while the order is above 2 and says what
WinISD draws. The WinISD captures above order 2 (`2|0;1;3;0.004;0.8`, `2|0;1;4;0.002;0.7`) are a
recorded deviation: they match OpenISD's order-2 allpass, and OpenISD's default differs from them.

Code: `engine/filters/AllpassFilterModel.ts`, `fields/winisdDeviation.ts`. Tests:
`packages/design/test/engine/filters-winisd.test.ts`, `packages/design/test/domain/error-switches.test.ts`.

## Checked by hand (QO170, 2026-10-04)

SEEN. The group-delay plateau is 3.0 ms at order 1 and 5.0 ms at order 2 with Q 0.6 (t/Q), and the order 4 chart
is pixel-identical to order 2. Screenshots (`winisd_research/runs/qo170-allpass/`): `allpass_3_n1…png` (3 ms), `allpass_1_n2…png`
(5 ms), `allpass_2_n4…png` (identical to order 2).
