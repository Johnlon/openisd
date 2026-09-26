# BUG_20260926_gyrator-rolloff-shallower-than-winisd

**Status:** FIXED 2026-09-26 — WinISD-compatible inductance option added; textbook model stays the default.

## Symptom

With "Simulate voice coil inductance" checked in both products, OpenISD's high-frequency
roll-off is shallower than WinISD's by a constant 0.56 dB from 5 kHz upward.

## Evidence

Measured 2026-09-26. Driver W5-1138SMF (`Le = 0.34 mH`, `Re = 3.4 Ω`), sealed 4.48 L,
`Rg = 0.1 Ω`, 1 W. WinISD 0.7.0.950 under wine, transfer-function chart traced from pixels
at `[SimulatorOptions] VCInd` 0 and 1 — one capture per launch, no chart-menu interaction,
so both runs are the same chart (`winisd_research/toys/probe_vcind_default_chart.py`,
artifacts `winisd_research/runs/vcind_default/`). OpenISD from `Engine.sweep` in both
circuit models.

| f (Hz) | WinISD, on − off (dB) | OpenISD, gyrator − winisd (dB) | residual |
| -----: | --------------------: | -----------------------------: | -------: |
|    200 |                +0.366 |                         +0.343 |   −0.023 |
|   1000 |                −1.212 |                         −1.040 |   +0.172 |
|   2000 |                −4.152 |                         −3.780 |   +0.372 |
|   5000 |               −10.617 |                        −10.091 |   +0.526 |
|  10000 |               −16.373 |                        −15.815 |   +0.558 |
|  20000 |               −22.314 |                        −21.758 |   +0.556 |

Trace resolution is 0.046 dB per pixel over that axis, so 0.56 dB is 12 px — far outside
trace noise. The residual is flat from 5 kHz up, which rules out a slope difference and
points at a constant factor in the coil impedance.

## Cause

Confirmed 2026-09-26 by decompile plus a BL sweep. Details are in `winisd_research/GHIDRA_FINDINGS.md`
§"VCInd".

- WinISD turns Le into an acoustic compliance `CLe = Sd²·Le/BL²` (`0x45e3ea`) using the
  **entered BL**.
- The source resistance it sits across, `Rae = 1/(2πFs·Qes'·Cas)`, uses **no BL**. It comes from
  Qes, Fs and Vas, with `Qes' = Qes·(Re+Rg)/Re`.
- The corner is `Rae·CLe = Le·(BL_Qes/BL)²/(Re+Rg)`, where `BL_Qes` is the BL implied by
  Fs/Qes/Vas/Re.
- The W5-1138SMF's entered BL is 7.17, but its Fs/Qes/Vas/Re imply 7.3838. That makes the
  factor ×1.0605, which is the 0.56 dB.

OpenISD uses one BL for both, so it gives the textbook `|Re+Rs+jωLe|/(Re+Rs)`. The two agree
whenever the driver's BL is consistent with its Qes/Fs/Vas/Re.

WinISD captures (`winisd_research/runs/vcind_bl/`), 20 kHz on−off:

| BL | WinISD observed | textbook |
| --: | --: | --: |
| 5.0 | −28.55 dB | −21.76 dB |
| 7.17 | −22.31 dB | −21.76 dB |
| 7.3838 | −21.80 dB | −21.76 dB |

The WinISD model above has no free parameters. It reproduces all three BL values from 200 Hz to
20 kHz within ≤0.067 dB, which is about 1.5 trace pixels.

That ≤0.067 dB is a trace error, not a model difference:
- WinISD's own transfer coefficients, read from live memory, give the model's numbers to 4 decimals.
- The residual follows the slope of the curve, and it drops to ≤0.024 dB when the chart's x-axis is
  zoomed to 1–20 kHz.
- See `winisd_research/GHIDRA_FINDINGS.md` §"Live values and the leftover offset".

## WinISD vs conventional

| Model                  | Damping resistance Rae                     | Le's acoustic element CLe      | Roll-off corner          |
| ---------------------- | ------------------------------------------ | ------------------------------ | ------------------------ |
| Conventional (OpenISD) | `BL²/(Sd²·(Re+Rg))`, entered BL            | `Sd²·Le/BL²`, same BL          | `Le/(Re+Rg)`             |
| WinISD                 | `1/(2πFs·Qes'·Cas)`, from Fs/Qes/Vas, no BL | `Sd²·Le/BL²`, entered BL       | `Le·(BL_Qes/BL)²/(Re+Rg)` |

The two give the same answer when the driver's BL agrees with the BL implied by its Fs/Qes/Vas/Re.

**Case for WinISD's model.** Fs, Qes and Vas usually come from one impedance measurement, so
a damping term built from them keeps the low-frequency Q exactly as measured. BL is often a
separate datasheet number, so leaning on it less keeps the bass response faithful to the
measurement.

**Case for the conventional model.** A driver has one motor and one BL. The gyrator carries the
whole electrical branch, Re + Rg + jωLe, into the acoustic domain through that one BL, so Le's
roll-off depends only on Le and the circuit resistance. It should not also depend on a
disagreement between two datasheet numbers. A reader can check the corner `Le/(Re+Rg)` by hand.

**Verdict: a WinISD bug (John and Claude, 2026-09-26). This is a judgement, not a confirmed
fact.** A driver has one BL, and WinISD's roll-off moves with the disagreement between two
datasheet numbers, which nothing physical explains. The Le element is the only place in
WinISD's circuit setup that reads the stored BL field; every other element is built from
Fs/Qes/Vas. For a self-consistent driver the two BLs are equal, so the bug would never have
shown in testing. Nothing in WinISD's help files or the decompile says the split is intended.
The WinISD-compatible option below reproduces the bug for parity; it is not a recommendation.

## Fix

Both models are offered. The textbook model stays OpenISD's default.

- Advanced tab: **Simulate voice coil inductance** turns on the textbook model (`circuitModel`
  `'gyrator'`). A new sub-option, **WinISD-compatible inductance**, selects WinISD's model
  (`'winisdGyrator'`). It is disabled while inductance is off.
- `circuit.ts` implements WinISD's model as an electrical inductance `Le·(BL_Qes/BL)²` in the
  acoustic path, with `BL_Qes² = Re/(2πFs·Qes·Cms)` (`sweep.ts` `blFromQes`). Built through the
  circuit's one BL, this gives exactly WinISD's corner. With no Fs or Qes the factor is 1.
- The impedance chart keeps the entered Le in WinISD-compatible mode. ⚠ Unverified: WinISD's
  impedance routine also reads the VCInd flag, and what it does with Le there is not measured.

## Verification

- `packages/design/test/engine/circuit.test.ts`: on this driver, `'winisdGyrator'` minus
  `'winisd'` matches WinISD's traced on − off at 1, 2, 5, 10 and 20 kHz within 0.1 dB.
- `packages/design/test/domain.test.ts`: `'winisdGyrator'` survives a save and reload through
  .owpr text.
- `packages/ui/test/hooks/AdvancedOptions-hooks.test.ts` and
  `packages/ui/test/ui/advanced-inductance.browser.spec.ts`: the checkbox, its disabled state,
  and the model switch.
