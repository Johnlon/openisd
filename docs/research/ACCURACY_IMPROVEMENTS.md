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
| 1 | VA chart: P·Re·\|Hf\|²/\|Z + Rg\| — Re where the source power is into Re + Rg | P·(Re + Rg)·\|Hf\|²/\|Z + Rg\|                      | VA low by Re/(Re + Rg): Re 3.4 Ω, Rg 0.1 Ω → −2.9 % (−0.13 dB); Rg 1 Ω → −23 % (−1.1 dB)                                      | exists ("WinISD VA model") | [bug](../../bugs/archive/BUG_20260927_winisd-va-uses-re-not-re-plus-rg.md) ⚠ |
| 2 | VA with "Rg is at driver side" on: Rg counted twice (Z already holds Rg)     | count Rg once                                       | Rg 1 Ω, Re 3.4 Ω at 20 kHz, 1 W: WinISD 0.63 VA; Rg once and Re + Rg in the numerator (#1) → 1.0 VA (−37 %)                  | exists ("WinISD VA model"): off counts Rg once, at the driver side or at the amplifier (`winisdVaModel.test.ts`) | same bug ⚠ |
| 3 | Maximum SPL and Maximum power leave the EQ/filter chain out                 | include it: the limit applies to the filtered signal | With a Linkwitz transform or bass boost the max-SPL curve ignores the boost: overstates the reachable SPL by the boost at each frequency; a high-pass filter's protection is not shown | none   | [bug](../../bugs/archive/BUG_20260927_max-spl-and-max-power-include-the-filter-chain.md) |
| 5 | Allpass: `t` is not the group delay; orders above 2 ignored                  | t = low-frequency group delay; honour the order     | A user entering t = 1 ms gets 1 ms only for order 1; orders 3–10 silently behave as 2                                          | none   | [bug](../../bugs/archive/BUG_20260927_winisd-allpass-t-not-delay-order-above-2-ignored.md) ⚠ |
| 6 | Linkwitz-Riley and SOS ignore the order field                               | LR of the entered order (LR2/LR4/LR8)              | Only LR4 exists; an LR2 or LR8 crossover cannot be simulated                                                                | none   | [bug](../../bugs/archive/BUG_20260927_winisd-linkwitz-riley-and-sos-ignore-order.md) ⚠ |
| 7 | New vent end correction 0.6 (OpenISD's default 0.732)                        | one agreed default, stated                          | Vent length readout: Δ = 0.132·D; 5 cm port, 20 L, 40 Hz → 6.6 mm on 154 mm (4 %). Charts unaffected (they use Fb)            | none   | handover "Still open for vented" |
| 8 | Mixes an entered BL (drive push, CLe inductance corner) with a Qes-derived BL (acoustic damping) instead of one consistent value | use one consistent BL throughout | W5-1138SMF (entered 7.17, Qes-implied 7.384): SPL passband +0.256 dB, impedance peak ~1.23 Ω (8 %) high, TF reference off by 0.507 dB, inductance-on rolloff corner off by 0.56 dB at 20 kHz — all the same (7.384/7.17)² factor | "WinISD driver calculations" off avoids the mix but also drops the Mms/Rms substitutions | [bug](../../bugs/archive/BUG_20260926_winisd-spl-level-uses-entered-bl.md), [bug](../../bugs/archive/BUG_20260926_winisd-impedance-uses-entered-bl.md), [bug](../../bugs/archive/BUG_20260926_winisd-tf-reference.md), [bug](../../bugs/archive/BUG_20260926_gyrator-rolloff-shallower-than-winisd.md) |
| 11 | Filter order capped at 10: its filter calculation overflows (floating point) above that | orders up to 20, calculated without overflow | An order 12–20 low/high-pass (Butterworth, Bessel) cannot be entered in WinISD; OpenISD draws it, −3.01 dB at fc for Butterworth n = 20 | none — fixed by default (an overflow is a crash, not a calculation wart to copy) | [bug](../../bugs/archive/BUG_20260927_winisd-wpr-filter-order-12-stops-load.md) |

## WinISD bugs fixed by default — broken links, not calculation differences

These are not accuracy choices and have no switch: WinISD fails to apply something it should.

| WinISD does | OpenISD | Bug |
|---|---|---|
| Passive radiator Sd typed in the UI is not linked to the model: the chart does not change, though a file loaded with a different Sd draws a different chart (probe 2026-10-03) | the Sd edit takes effect; PR excursion and PR air velocity scale as 1/Sd | [bug](../../bugs/BUG_20261003_winisd-pr-sd-edit-ignored.md) |

## WinISD calculation errors — correct by default, an error switch brings WinISD back

A wrong formula, or a value that contradicts WinISD's own other charts. OpenISD does the correct
thing by default. A yellow "error switch", editable only where it applies, makes WinISD's
calculation come back. The error switches sit under "WinISD errors" in the Compatibility panel.
Rows 1 and 2 (VA) and 8 (two BLs) above are error switches too.

| WinISD does | OpenISD default | Switch | Bug |
|---|---|---|---|
| ABC box: intra-chamber port velocity chart is V/(jωMai + Zf): it leaves out the leak term Zf·jωMai/Ricl of the current through the port mass. Up to 1.35 dB and 4.6° near 110 Hz, under 0.1 dB elsewhere (W5-1138SMF, abc-w5-1); the two agree when the inter-chamber leak Q is very large (Qiclfr 1e6: 3.3e-6) | WinISD's chart (ticked, the default) | yellow error switch "WinISD ABC intra-port velocity", unticked = exact current V/[jωMai + Zf(1 + jωMai/Ricl)] | winisd_research/PROBE_FINDINGS.md abc velocity self-consistency; [note](../../bugs/archive/BUG_20261003_winisd-abc-intra-port-velocity-drops-ricl.md) |
| Passive-radiator box: fixed-loss frequency ωr = 1/√(Npr·Map·(Cab ∥ Npr·Cap)) — the branch mass is multiplied by Npr where the true tuning divides by it, so ωr is Npr times too low (invisible at Npr = 1). Npr 2, W5 in 10 L, radiator Fs 30 Hz/Vas 4.8 L: WinISD ωr → 21.0 Hz, true 42 Hz; impedance up to 1 Ω and TF up to 2 dB off at Npr = 2 (chart review) | ωr = the physical tuning, 1/√((Map/Npr)·(Cab ∥ Npr·Cap)) | "PR Npr resonance", off by default, passive radiator boxes only; no effect at Npr = 1 | [bug](../../bugs/archive/BUG_20260928_pr-added-mass-or-count-not-winisd.md) |
| Bessel high-pass = (k·s)ⁿ/Σ cm(k·s)ᵐ, not the mirror of its low-pass; order 4, fc 25 Hz: up to 6 % off in complex response. Butterworth, SOS, Linkwitz-Riley, every low-pass and a first-order Bessel are unaffected. ⚠ awaits the by-hand check with John (QO170) | the mirror of the Bessel low-pass, s → 1/s | "WinISD Bessel high-pass", off by default, active only while an enabled Bessel high-pass filter exists | [bug](../../bugs/archive/BUG_20260927_winisd-bessel-highpass-not-mirror-of-lowpass.md) |

## Not an improvement — WinISD matches the textbook

| WinISD does                                                        | Note |
|--------------------------------------------------------------------|------|
| Box leak/absorption/port loss as fixed resistances at the tuning (vented, PR) or ωsc (sealed) | This is Small's convention (Q_L defined at Fb). OpenISD's `conventional-lossy` uses per-frequency Q/(ω·C), which is *not* the textbook form — review what that switch should mean before offering it as "more accurate". |
| Vented port mass from Fb, vent length ignored                       | Same physics when length and Fb are consistent; OpenISD derives one from the other. |
| Radiated output = cone − leak − port/radiator                       | Correct; OpenISD's old vented/PR output (cone − port) was the error. |

## Not observable — not planned

| WinISD does                                                          | Why omitted |
|----------------------------------------------------------------------|-------------|
| Group delay by 1e-10 Hz central difference                             | Noise floor ≈ 1.8e-4 ms; invisible on the chart. |
| Group-delay unwrap fixes a −2π jump only                             | Hit only when a phase wrap lies within 1e-10 Hz of a grid point. |
| EQ/filter charts skip points where the box impedance is 0            | Needs \|Z\| exactly 0 at a grid point; not seen in any capture. |
