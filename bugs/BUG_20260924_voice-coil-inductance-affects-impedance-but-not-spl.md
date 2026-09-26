# BUG_20260924_voice-coil-inductance-affects-impedance-but-not-spl

Status: RESOLVED (2026-09-26) — updated `circuit.ts` so `circuitModel` switch controls Le in both electrical impedance (`Zel`) and acoustic response (`ZcoilForAC`) together. Unchecked (`'winisd'`) excludes Le from both curves (WinISD inductance-off default); Checked (`'gyrator'`) includes Le in both curves.

## Symptom

A driver's voice-coil inductance raises openisd's impedance curve at high frequency but leaves
the SPL, transfer-function and excursion curves perfectly flat. A 5" driver with Le = 0.34 mH
shows 42.9 Ω at 20 kHz and still 81.4 dB — the same SPL it has at 200 Hz. Real drivers roll off;
so does WinISD.

## Evidence

Re-measured 2026-09-26. The WinISD values are WinISD's own doubles, logged by the debugger at
every chart point from the unmodified exe; none is traced from pixels. The runs use the same
project with only "Simulate voice coil inductance" changed, Rg 0.1 Ω, driver side off. The
OpenISD values come from the fixed code: `circuitModel` `winisd` (off) and `winisdGyrator`
(on), with "Use WinISD driver calculations" on.

| f (Hz)  | WinISD Z, off | WinISD Z, on | OpenISD Z, off | OpenISD Z, on | WinISD SPL, off | WinISD SPL, on | OpenISD SPL, off | OpenISD SPL, on |
|---------|--------------:|-------------:|---------------:|--------------:|----------------:|---------------:|-----------------:|----------------:|
| 998.56  |        3.4129 |       3.8875 |         3.5110 |        3.9804 |          80.532 |         79.340 |           80.136 |          78.788 |
| 4996.7  |        3.4005 |      11.1545 |         3.5004 |       11.1876 |          80.530 |         69.977 |           80.128 |          69.186 |
| 20000   |        3.4000 |      42.8481 |         3.5000 |       42.8568 |          80.530 |         58.264 |           80.128 |          57.445 |

WinISD's switch governs both curves together, and so does OpenISD's since the fix. What is
left:

- the +0.1 Ω in OpenISD's Z is Rg
  ([BUG_20260926_impedance-includes-rg-when-rg-is-not-at-driver-side](BUG_20260926_impedance-includes-rg-when-rg-is-not-at-driver-side.md));
- the ~0.40 dB SPL offset is the driver parameter set (`docs/research/PROBE_W5_SEALED_20260924.md` §4.2);
- the 20 kHz roll-off (on − off) is −22.266 dB in WinISD and −22.683 dB in OpenISD, a 0.42 dB
  gap. ⚠ unverified: that this is the same driver-parameter gap rather than the inductance
  element.

Records:
[sweep-w5-sealed-baseline-charts](http://localhost:8000/winisd/winisd_research/runs/sweep-w5-sealed-baseline-charts.json) (off),
[sweep-w5-sealed-vcind1-charts](http://localhost:8000/winisd/winisd_research/runs/sweep-w5-sealed-vcind1-charts.json) (on).

The original report, before the fix:

Source: `packages/design/engine/circuit.ts:115-142` — `ZcoilAC` (Re + Rs, no Le) is used for
`pg` and `ZaE`, i.e. the whole acoustic circuit, while `Zcoil` (Re + Rs + jωLe) is used only for
`Zel`. The comment cites `docs/winisd_helpfiles/help/aboutequivalentcircuits.html` for the split.

`packages/design/test/scratch-w5.test.ts` (scratch, run this session) confirms it from the
openisd side: variants `app` (Le present) and `noLe` produce identical SPL, phase, group delay
and excursion and differ only in `zmag`.

## Cause

`circuit.ts` builds two coil impedances and feeds the Le-free one to the acoustic circuit
deliberately, on the reading that WinISD excludes Le from acoustic simulation. Probing WinISD
this session shows WinISD has no such state: with the inductance switch off Le is absent from
both the impedance and the SPL, with it on Le is present in both. openisd's default
`circuitModel: 'winisd'` reproduces neither.

## Fix

`circuitModel: 'gyrator'` already includes Le in the acoustic circuit and follows WinISD's
inductance-on roll-off in shape. The measured numbers are in the Evidence table above.

Options, for John's decision:

1. Make the inductance a single switch as WinISD has it — Le either in both curves or in
   neither — and drop the `'winisd'`/`'gyrator'` circuit-model split, which exists only to
   express the half-and-half state.
2. Keep both models but change what `'winisd'` means: Le in neither curve (WinISD's default),
   with `'gyrator'` as WinISD's inductance-on state.

The comment in `circuit.ts:115-121` and the cited help-file reading must be corrected either
way.

## Verification

A unit test on `Engine.sweep` for this case: with Le = 0.34 mH the SPL at 20 kHz must be about
22 dB below the passband, not equal to it, and `zmag` at 20 kHz must stay ≈ 42.9 Ω. Re-run
`toys/w5_chart_refresh.py <run> VCInd=1 charts=spl|impedance` (debugger) and compare it with the
OpenISD curve; the residual should be the passband offset alone.
