# BUG_20260928_pr-added-mass-or-count-not-winisd

**Status:** RESOLVED (2026-09-28)

## Symptom
A passive-radiator box with added mass on the radiator (Me = 10 g) and two radiators (Npr = 2)
does not match WinISD. With Me = 0 and Npr = 1 every chart matches exactly (chart review §3.6).

## Evidence
winisd_research runs/pr-w5-me-npr-1 (W5 in 10 L, radiator Fs 30 Hz, Vas 4.8 L, Qms 3.3, Sd 95 cm²,
Me 0.01, Npr 2, no filters), compared with OpenISD by toys/chart_plot_compare.py:

| Chart | Max difference |
|---|---|
| Impedance | 1.1 Ω at 58.9 Hz |
| Transfer function magnitude | 2.0 dB |
| PR transfer magnitude | 4.8 dB |
| PR transfer phase | 15.8° |
| Cone excursion | 0.11 mm |
| PR excursion | 0.07 mm |

## Cause
Npr, not Me. `PassiveRadiatorBox.ts`'s `winisd-lossy` branch already handles added mass correctly
(Map includes Me, confirmed by pr-w5-me-1 matching before this fix). The box's fixed-loss
frequency ωr was taken from the domain's `systemTuning_hz` (`P.Fr`), which does not depend on
Npr. WinISD's own ωr does, and is wrong: `winisd_research/GHIDRA_FINDINGS.md` "4th-order
bandpass" § "Added mass and radiator count" (fit to pr-w5-me-npr-1, 8e-16 impedance):

    ωr = 1/√(Npr·Map·(Cab ∥ Npr·Cap))     Map = Map_free + Me/Sd² (per radiator)

WinISD's own calc bug: the branch mass is multiplied by Npr where the true tuning divides by it,
so this ωr is Npr times too low — invisible at Npr = 1, where it equals `systemTuning_hz`. Npr 2,
W5 in 10 L, radiator Fs 30 Hz/Vas 4.8 L: WinISD ωr → 21.000 Hz, true tuning 42 Hz.

## Fix
`packages/design/engine/boxes/PassiveRadiatorBox.ts`'s `winisd-lossy` branch now computes ωr from
`Npr`/`Map`/`Cab`/`Cap` directly (WinISD's own formula, bug included), instead of from `P.Fr`.
`P.Fr`/`systemTuning_hz` themselves are untouched — that reading is separately correct and stays
a distinct question from this box's own fixed-loss frequency.

## Verification
`packages/design/test/engine/passive-radiator-count-winisd.test.ts` — two projects (Npr alone,
Npr+Me together) against `pr-w5-npr-1`/`pr-w5-me-npr-1`, same tolerances as
`passive-radiator-winisd.test.ts` (≤1e-12 relative impedance/excursion, ≤1e-10 dB / ≤1e-9 deg
transfer). 8/8 passing. Existing `passive-radiator-winisd.test.ts` (Npr=1) and
`passive-radiator-tf-winisd.test.ts` unaffected, 8/8 still passing.
