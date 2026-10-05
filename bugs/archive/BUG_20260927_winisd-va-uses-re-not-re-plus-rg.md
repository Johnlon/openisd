# BUG_20260927_winisd-va-uses-re-not-re-plus-rg

**Status:** RESOLVED

## Symptom

WinISD's "Amplifier apparent load power (VA)" chart reads Re/(Re + Rg) of the amplifier's actual
apparent power. W5-1138SMF, Rg 1 Ω: 0.773 of the true value at every frequency. This is a WinISD
bug; OpenISD reproduces it by default.

## Evidence

- `f_46bd30` case 0x14 (disassembly 0x46bfff–0x46c059): VA = P·|Hf|²·Re/|Z + Rg|, with
  P = project+0x40, Re = driver+0x68, Rg = project+0x38 added to Z's real part (`0x55fd30`,
  `0x55fb20`).
- Debugger capture `winisd_research/runs/sweep-w5-sealed-va-rg1` (breakpoint 0x46c05c): the
  formula reproduces all 2087 logged values to 3e-16.
- WinISD's drive is eg² = P·(Re + Rg) (SPL chart, chart review §1.2), so the apparent power the
  amplifier delivers is eg²/|Z + Rg| = P·(Re + Rg)/|Z + Rg|.

## Cause

There are two powers, WinISD's drive power and its VA numerator. The drive puts P into Re + Rg;
the VA numerator uses Re alone.

## Fix

Ruling, John 2026-09-27: keep WinISD's by default, with a compat switch for the corrected value.

`sweep.ts` `va`: "WinISD VA model" (now "Enable WinISD Re without Rg bug") on (default) gives WinISD's P·Re·|Hf|²/|Z + Rg|; off gives
P·(Re + Rg)·|Hf|²/|Z_amp|, Z_amp = Z + Rg at the amplifier, Z alone at the driver side (Zel
already holds Rg). Reset to WinISD turns it on.

Size of the bug: a flat factor Re/(Re + Rg), 10·log10 of it in dB. W5 (Re 3.4 Ω): Rg 0.1 Ω
−2.9 % (−0.13 dB), Rg 1 Ω −22.7 % (−1.12 dB), Rg 0 none.

With "Rg is at driver side" on, WinISD counts Rg twice: Z already holds Rg and the VA formula adds
it again (capture `winisd_research/runs/sweep-w5-sealed-va-rg1-driverside`: Z 4.4 Ω at 20 kHz,
VA 0.6296 = 1 W·3.4/|4.4 + 1|, formula fits all 2087 points to 3e-16). OpenISD's default does the
same. ⚠ Unverified: dual voice coil and multi-driver arrays, not captured.

## Verification

`winisdDriverModel.test.ts`: VA at 1, 65.36 and 20000 Hz, Rg 1 Ω, equals WinISD's to 1e-9, with
Rg at the amplifier and at the driver side.
`va-chart.browser.spec.ts`: the chart reads out in VA.
`winisdVaModel.test.ts`: off is (Re + Rg)/Re × WinISD's; Rg counted once whatever its placement;
Reset turns it on; saved and read back. `advanced-inductance.browser.spec.ts`: the checkbox, its
tooltip, and Reset.

## Checked by hand (QO170, 2026-10-04)

SEEN in WinISD's own window under Wine. Flat-band VA reads 0.97 at Rg 0.1 Ω and 0.50 at Rg 3.4 Ω. With
"Rg is at driver side" ticked, impedance is 6.84 Ω and VA is 0.336, which is 3.4/(6.8+3.4): Rg is counted
twice. WinISD's own SPL chart drops 2.84 dB from Rg 0.1 to 3.4 Ω, which matches power into Re + Rg (2.89 dB),
not into Re (5.77 dB), so the VA chart contradicts the SPL chart: a bug, not a definition of power.
Screenshots (`winisd_research/runs/qo170-va2/`): `va_1_rg0.1_va.png` / `va_2_rg3.4_va.png` (look at the flat band of the VA
chart), `va_1_rg0.1_spl.png` / `va_2_rg3.4_spl.png`, `va_3_rg3.4_atamp_impedance.png` /
`va_5_rg3.4_driverside_impedance.png`, `va_5_rg3.4_driverside_va.png`.

## The power readout uses Re too (probe winisd_research dad7b82, 2026-10-05)

WinISD's Signal tab relates "System input power" and "Driver input voltage (each)" through Re
alone: W5-1138SMF, Rg 0.1 Ω, typed 1.85 V each at 4 drivers reads 4.0 W = 4·1.85²/3.4 (Re + Rg
gives 3.91 W). Its SPL chart still drives that power into Re + Rg, so a typed voltage plays
10·log10((Re + Rg)/Re) louder than the voltage itself would: about 0.1 dB at Rg 0.1 Ω (WinISD
92.573 dB at 1 kHz; OpenISD unticked 92.475, ticked 92.601 — WinISD carries the power as shown,
4.0 W, 0.028 dB below 4.026 W). Evidence: `winisd_research/runs/nd-1/92_nd4_signal_after_volt_edit.png`,
`93_nd4_spl_1k_after_volt.png`.

Ruling, John 2026-10-05: one switch for this WinISD habit. The switch is now "Enable WinISD Re
without Rg bug" (field key `winisdVaModel`, unchanged so old files load). Ticked: the VA chart as
above, and P = N·V²/Re both ways (readout and an entered voltage), the sweep driving the power into
Re + Rg. Unticked (the default): Re + Rg throughout. Tests: `driver-count-winisd.test.ts`
("Enable WinISD Re without Rg bug" cases). The switch's tooltip and the ≠W popup carry a "Seen in"
line naming the VA chart and the power readout with their sizes.
