# BUG_20260927_winisd-va-uses-re-not-re-plus-rg

**Status:** OPEN

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

OpenISD: `sweep.ts` `va` follows WinISD. A conventional P·(Re + Rg)·|Hf|²/|Z + Rg| would go
behind its own WinISD Compatibility control — John to decide whether to add one.

⚠ Unverified: WinISD adds Rg to Z even with "Rg is at driver side" on, where Z already carries
Rg (code path is unconditional; not captured). Dual voice coil and multi-driver arrays not
captured.

## Verification

`winisdDriverModel.test.ts`: VA at 1, 65.36 and 20000 Hz, Rg 1 Ω, equals WinISD's to 1e-9.
`va-chart.browser.spec.ts`: the chart reads out in VA.
