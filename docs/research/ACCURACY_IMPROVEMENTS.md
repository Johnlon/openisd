# Accuracy improvements over WinISD — candidates for switches

OpenISD copies WinISD's options by default and fixes its bugs. In the WinISD Compatibility panel a
bug switch reads "Enable WinISD <name> bug" (group "WinISD bugs") and an option reads "Enable WinISD style
<name>" (group "Options"). A new project has every option ticked and every bug unticked.
This log lists places where WinISD is less accurate than it
could be, with the size of the difference a user would see. Each is a candidate for its own
option switch in the WinISD Compatibility panel. Items whose effect cannot be seen
on a chart are listed at the end and not planned.

Rule for adding a row: name the WinISD behaviour, the better behaviour, and a measured or
calculated size of the difference for a realistic case. Claims about WinISD were checked by hand in its own window on 2026-10-04 (QO170); see each bug file.

## Worth a switch

| # | WinISD does                                                                 | Better                                              | Visible effect (example)                                                                                                   | Switch | Source |
|---|-----------------------------------------------------------------------------|-----------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------|--------|--------|
| 1 | VA chart: P·Re·\|Hf\|²/\|Z + Rg\| — Re where the source power is into Re + Rg | P·(Re + Rg)·\|Hf\|²/\|Z + Rg\|                      | VA low by Re/(Re + Rg): Re 3.4 Ω, Rg 0.1 Ω → −2.9 % (−0.13 dB); Rg 1 Ω → −23 % (−1.1 dB)                                      | exists ("Enable WinISD VA model bug") | [bug](../../bugs/archive/BUG_20260927_winisd-va-uses-re-not-re-plus-rg.md); by hand: flat-band VA 0.97 at Rg 0.1 Ω, 0.50 at Rg 3.4 Ω |
| 2 | VA with "Rg is at driver side" on: Rg counted twice (Z already holds Rg)     | count Rg once                                       | Rg 1 Ω, Re 3.4 Ω at 20 kHz, 1 W: WinISD 0.63 VA; Rg once and Re + Rg in the numerator (#1) → 1.0 VA (−37 %)                  | exists ("Enable WinISD VA model bug"): off counts Rg once, at the driver side or at the amplifier (`winisdVaModel.test.ts`) | same bug; by hand: driver side ticked, VA 0.336 = 3.4/(6.8+3.4) |
| 7 | New vent end correction 0.6 (OpenISD's default 0.732)                        | one agreed default, stated                          | Vent length readout: Δ = 0.132·D; 5 cm port, 20 L, 40 Hz → 6.6 mm on 154 mm (4 %). Charts unaffected (they use Fb)            | none   | handover "Still open for vented" |
| 8 | Mixes an entered BL (drive push, CLe inductance corner) with a Qes-derived BL (acoustic damping) instead of one consistent value | use one consistent BL throughout | W5-1138SMF (entered 7.17, Qes-implied 7.384): SPL passband +0.256 dB, impedance peak ~1.23 Ω (8 %) high, TF reference off by 0.507 dB, inductance-on rolloff corner off by 0.56 dB at 20 kHz — all the same (7.384/7.17)² factor | yellow bug switch "Enable WinISD two-BL driver bug", off by default since 2026-10-04 (it also drops the Mms/Rms substitutions) | [bug](../../bugs/archive/BUG_20260926_winisd-spl-level-uses-entered-bl.md), [bug](../../bugs/archive/BUG_20260926_winisd-impedance-uses-entered-bl.md), [bug](../../bugs/archive/BUG_20260926_winisd-tf-reference.md), [bug](../../bugs/archive/BUG_20260926_gyrator-rolloff-shallower-than-winisd.md) |
| 11 | Filter order capped at 10: its filter calculation overflows (floating point) above that | orders up to 20, calculated without overflow | An order 12–20 low/high-pass (Butterworth, Bessel) cannot be entered in WinISD; OpenISD draws it, −3.01 dB at fc for Butterworth n = 20 | none — fixed by default (an overflow is a crash, not a calculation wart to copy) | [bug](../../bugs/archive/BUG_20260927_winisd-wpr-filter-order-12-stops-load.md) |

## WinISD bugs fixed by default — broken links, not calculation differences

These are not accuracy choices and have no switch: WinISD fails to apply something it should, or
ignores an input entirely.

| WinISD does | OpenISD | Bug |
|---|---|---|
| Passive radiator Sd typed in the UI is not linked to the model: the chart does not change, though a file loaded with a different Sd draws a different chart (probe 2026-10-03) | the Sd edit takes effect; PR excursion and PR air velocity scale as 1/Sd | [bug](../../bugs/BUG_20261003_winisd-pr-sd-edit-ignored.md) |
| Emptying the passive radiator's Vas box makes WinISD die with a floating-point divide by zero (Wine; probe 2026-10-04). A crash, so no switch | a cleared PR field never crashes: a zero in Fs, Qms, Vas or Sd leaves every derived value finite or absent | [bug](../../bugs/BUG_20261004_winisd-pr-vas-box-emptied-crashes.md) |
| Allpass (row 5): orders above 2 are ignored; order 3–10 draw exactly order 2 (one section, ω0 = 2/t, delay t/Q). By hand 2026-10-04: order 4 pixel-identical to order 2 | an input WinISD ignores (John, 2026-10-04): above order 2 the order-n Bessel allpass, delay t; orders 1 and 2 stay WinISD's. A ≠W Difference cue by the Order box explains it | [bug](../../bugs/archive/BUG_20260927_winisd-allpass-t-not-delay-order-above-2-ignored.md) |
| Linkwitz-Riley (row 6) ignores the Order box: always LR4; a typed 2 or 6 reopens as 4 (by hand 2026-10-04) | an input WinISD ignores (John, 2026-10-04): LR of even order n = Butterworth(n/2)², even orders only. A ≠W Difference cue by the Order box shows while the order is not 4. User SOS is order 2 by definition (WinISD agrees): its Order box is greyed out | [bug](../../bugs/archive/BUG_20260927_winisd-linkwitz-riley-and-sos-ignore-order.md) |

## WinISD calculation bugs — correct by default, a bug switch brings WinISD back

A wrong formula, or a value that contradicts WinISD's own other charts. OpenISD does the correct
thing by default. A yellow bug switch, editable only where it applies, makes WinISD's
calculation come back. The bug switches sit under "WinISD bugs" in the Compatibility panel.
Rows 1 and 2 (VA) and 8 (two BLs) above are bug switches too, off by default since 2026-10-04
(they were on, as WinISD has them, until then).

| WinISD does | OpenISD default | Switch | Bug |
|---|---|---|---|
| Passive-radiator box: fixed-loss frequency ωr = 1/√(Npr·Map·(Cab ∥ Npr·Cap)) — the branch mass is multiplied by Npr where the true tuning divides by it, so ωr is Npr times too low (invisible at Npr = 1). Npr 2, W5 in 10 L, radiator Fs 30 Hz/Vas 4.8 L: WinISD ωr → 21.0 Hz, true 42 Hz; impedance up to 1 Ω and TF up to 2 dB off at Npr = 2 (chart review) | ωr = the physical tuning, 1/√((Map/Npr)·(Cab ∥ Npr·Cap)) | "Enable WinISD PR Npr resonance bug", off by default, passive radiator boxes only; no effect at Npr = 1 | [bug](../../bugs/archive/BUG_20260928_pr-added-mass-or-count-not-winisd.md) |
| Bessel high-pass = (k·s)ⁿ/Σ cm(k·s)ᵐ, not the mirror of its low-pass; order 4, fc 25 Hz: up to 6 % off in complex response. Butterworth, SOS, Linkwitz-Riley, every low-pass and a first-order Bessel are unaffected. seen by hand 2026-10-04 (high-pass −1.25 dB at 50 Hz, low-pass −1.67 dB at 12.5 Hz) | the mirror of the Bessel low-pass, s → 1/s | "Enable WinISD Bessel high-pass bug", off by default, active only while an enabled Bessel high-pass filter exists | [bug](../../bugs/archive/BUG_20260927_winisd-bessel-highpass-not-mirror-of-lowpass.md) |
| ABC box group delay: the box is stepped to f ± 1e-10 Hz but the driver part is held at the chart frequency f (routine 0x459f90 passes f to the driver routine), so the group delay is the box's phase slope alone and contradicts WinISD's own phase chart. W5-1138SMF ABC (abc-w5-gd2): 1.005 Hz −40.96 ms against −33.86 ms; 10.75 Hz −3.31 against +3.62 ms; 115.6 Hz 1.46 against 2.39 ms | −dφ/dω of the plotted phase | "Enable WinISD ABC group delay bug", off by default, ABC boxes only; on, within 1.03e-3 ms of WinISD over all 2082 points | [bug](../../bugs/archive/BUG_20261005_winisd-abc-group-delay-driver-not-stepped.md) |
| More than one driver: the impedance chart shows one driver's impedance, not the array the amplifier drives (W5 sealed 1 W, 4 drivers: 18.609 Ω peak at 1 and at 4 drivers; in parallel the array is a quarter of that). VA, SPL and maximum power are the array's. | the array's impedance per the project's wiring (÷N parallel, ×N series) | yellow bug switch "Enable WinISD per-driver impedance bug" | [bug](../../bugs/BUG_20261005_winisd-multi-driver-impedance-is-one-drivers.md?html) |

## WinISD conventions — copied by default, an ordinary switch gives the exact form

A simplification WinISD may intend. Not yellow: only a straight WinISD bug is (John, 2026-10-04).
The switch sits under "Options", ticked by default.

| WinISD does | OpenISD default | Switch | Source |
|---|---|---|---|
| ABC box: intra-chamber port velocity chart is V/(jωMai + Zf): it leaves out the leak term Zf·jωMai/Ricl of the current through the port mass. Up to 1.35 dB and 4.6° near 110 Hz, under 0.1 dB elsewhere (W5-1138SMF, abc-w5-1); the two agree when the inter-chamber leak Q is very large (Qiclfr 1e6: 3.3e-6) | WinISD's chart (ticked, the default) | ordinary switch "Enable WinISD style simplified ABC intra-port velocity", unticked = exact current V/[jωMai + Zf(1 + jωMai/Ricl)] | winisd_research/PROBE_FINDINGS.md abc velocity self-consistency; [note](../../bugs/archive/BUG_20261003_winisd-abc-intra-port-velocity-drops-ricl.md) |

## Not an improvement — WinISD matches the textbook

| WinISD does                                                        | Note |
|--------------------------------------------------------------------|------|
| Box leak/absorption/port loss as fixed resistances at the tuning (vented, PR) or ωsc (sealed) | This is Small's convention (Q_L defined at Fb), and OpenISD uses it as WinISD does: there is no other loss model, and Ql and Qa control the losses. |
| Vented port mass from Fb, vent length ignored                       | Same physics when length and Fb are consistent; OpenISD derives one from the other. |
| Radiated output = cone − leak − port/radiator                       | Correct; OpenISD's old vented/PR output (cone − port) was the error. |
| Maximum SPL and Maximum power leave the EQ/filter chain out (row 3) | A filter before the driver scales the SPL by \|Hf\| and the voltage the driver limit allows by 1/\|Hf\|: the limit curves are identical with or without the chain (John, 2026-10-04: no change). [bug](../../bugs/archive/BUG_20260927_max-spl-and-max-power-include-the-filter-chain.md) |

## Not observable — not planned

| WinISD does                                                          | Why omitted |
|----------------------------------------------------------------------|-------------|
| Group delay by 1e-10 Hz central difference                             | Noise floor ≈ 1.8e-4 ms; invisible on the chart. |
| 6th-order bandpass group delay: the 1e-10 Hz step magnifies rounding where the two compliance currents nearly cancel (κ 19 at 200 Hz, ~500 above 4 kHz) | WinISD's H is right; above ~200 Hz its group delay is rounding noise, worst 0.11 ms at 4.0 kHz (bp6-w5-gd1). OpenISD (doubles, same step) has noise of the same size but not the same values (1.24 kHz: exact 0.0178 ms, WinISD −0.0254, OpenISD 0.0344). Cannot be copied; no switch (John, 2026-10-05). [bug](../../bugs/archive/BUG_20260929_bp6-abc-group-delay-not-winisd.md) |
| Group-delay unwrap fixes a −2π jump only                             | Hit only when a phase wrap lies within 1e-10 Hz of a grid point. |
| EQ/filter charts skip points where the box impedance is 0            | Needs \|Z\| exactly 0 at a grid point; not seen in any capture. |
