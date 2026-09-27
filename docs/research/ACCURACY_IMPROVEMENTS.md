# Accuracy improvements over WinISD — candidates for switches

OpenISD copies WinISD by default. This log lists places where WinISD is less accurate than it
could be, with the size of the difference a user would see. Each is a candidate for its own
WinISD-vs-conventional switch in the WinISD Compatibility panel. Items whose effect cannot be seen
on a chart are listed at the end and not planned.

Rule for adding a row: name the WinISD behaviour, the better behaviour, and a measured or
calculated size of the difference for a realistic case. ⚠ marks a claim about WinISD that still
awaits the by-hand check with John (QO170).

## Worth a switch

| # | WinISD does                                                                 | Better                                              | Visible effect (example)                                                                                                   | Switch | Source |
|---|-----------------------------------------------------------------------------|-----------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------|--------|--------|
| 1 | VA chart: P·Re·\|Hf\|²/\|Z + Rg\| — Re where the source power is into Re + Rg | P·(Re + Rg)·\|Hf\|²/\|Z + Rg\|                      | VA low by Re/(Re + Rg): Re 3.4 Ω, Rg 0.1 Ω → −2.9 % (−0.13 dB); Rg 1 Ω → −23 % (−1.1 dB)                                      | exists ("WinISD VA model") | [bug](../../bugs/BUG_20260927_winisd-va-uses-re-not-re-plus-rg.md) ⚠ |
| 2 | VA with "Rg is at driver side" on: Rg counted twice (Z already holds Rg)     | count Rg once                                       | Rg 1 Ω, Re 3.4 Ω at 20 kHz, 1 W: WinISD 0.63 VA; Rg once and Re + Rg in the numerator (#1) → 1.0 VA (−37 %)                  | covered by #1's switch? — check | same bug ⚠ |
| 3 | Maximum SPL and Maximum power leave the EQ/filter chain out                 | include it: the limit applies to the filtered signal | With a Linkwitz transform or bass boost the max-SPL curve ignores the boost: overstates the reachable SPL by the boost at each frequency; a high-pass filter's protection is not shown | none   | [bug](../../bugs/BUG_20260927_max-spl-and-max-power-include-the-filter-chain.md) |
| 4 | Bessel high-pass = (k·s)ⁿ/Σ cm(k·s)ᵐ, not the mirror of its low-pass        | textbook Bessel HP (mirror, s → 1/s)               | Response shape differs from the published Bessel HP; size per order not yet measured                                        | none   | [bug](../../bugs/BUG_20260927_winisd-bessel-highpass-not-mirror-of-lowpass.md) ⚠ |
| 5 | Allpass: `t` is not the group delay; orders above 2 ignored                  | t = low-frequency group delay; honour the order     | A user entering t = 1 ms gets 1 ms only for order 1; orders 3–10 silently behave as 2                                          | none   | [bug](../../bugs/BUG_20260927_winisd-allpass-t-not-delay-order-above-2-ignored.md) ⚠ |
| 6 | Linkwitz-Riley and SOS ignore the order field                               | LR of the entered order (LR2/LR4/LR8)              | Only LR4 exists; an LR2 or LR8 crossover cannot be simulated                                                                | none   | [bug](../../bugs/BUG_20260927_winisd-linkwitz-riley-and-sos-ignore-order.md) ⚠ |
| 7 | New vent end correction 0.6 (OpenISD's default 0.732)                        | one agreed default, stated                          | Vent length readout: Δ = 0.132·D; 5 cm port, 20 L, 40 Hz → 6.6 mm on 154 mm (4 %). Charts unaffected (they use Fb)            | none   | handover "Still open for vented" |

## Not an improvement — WinISD matches the textbook

| WinISD does                                                        | Note |
|--------------------------------------------------------------------|------|
| Box leak/absorption/port loss as fixed resistances at the tuning (vented, PR) or ωsc (sealed) | This is Small's convention (Q_L defined at Fb). OpenISD's `conventional-lossy` uses per-frequency Q/(ω·C), which is *not* the textbook form — review what that switch should mean before offering it as "more accurate". |
| Vented port mass from Fb, vent length ignored                       | Same physics when length and Fb are consistent; OpenISD derives one from the other. |
| Radiated output = cone − leak − port/radiator                       | Correct; OpenISD's old vented/PR output (cone − port) was the error. |

## Not observable — not planned

| WinISD does                                                          | Why omitted |
|----------------------------------------------------------------------|-------------|
| Group delay by 1e-10 Hz central difference in x87 arithmetic         | Staircase noise ≈ 1.8e-4 ms; invisible on the chart. |
| Group-delay unwrap fixes a −2π jump only                             | Hit only when a phase wrap lies within 1e-10 Hz of a grid point. |
| EQ/filter charts skip points where the box impedance is 0            | Needs \|Z\| exactly 0 at a grid point; not seen in any capture. |
