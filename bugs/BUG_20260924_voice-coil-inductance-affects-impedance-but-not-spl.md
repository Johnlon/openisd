# BUG_20260924_voice-coil-inductance-affects-impedance-but-not-spl

**Status:** OPEN

## Symptom

A driver's voice-coil inductance raises openisd's impedance curve at high frequency but leaves
the SPL, transfer-function and excursion curves perfectly flat. A 5" driver with Le = 0.34 mH
shows 42.9 Ω at 20 kHz and still 81.4 dB — the same SPL it has at 200 Hz. Real drivers roll off;
so does WinISD.

## Evidence

Re-checked 2026-09-24.

WinISD 0.7 driven under wine this session, same project both times, only the "Simulate voice
coil inductance" checkbox changed (`winisd_research/runs/w5_sealed/charts_base/` and
`charts_vcind/`, curves traced from the plot pixels):

| f (Hz) | WinISD Z, VCInd off | WinISD Z, VCInd on | openisd Z | WinISD SPL, off | WinISD SPL, on | openisd SPL |
|--------|--------------------:|-------------------:|----------:|----------------:|---------------:|------------:|
| 1000   |               3.415 |              3.872 |     3.963 |          80.508 |         79.335 |      81.425 |
| 5000   |               3.389 |             11.153 |    11.186 |          80.508 |         69.954 |      81.422 |
| 20000  |               3.389 |             42.861 |    42.855 |          80.508 |         58.227 |      81.422 |

WinISD's switch governs both curves together. openisd's impedance tracks WinISD's
inductance-on column (42.855 vs 42.861 Ω) while its SPL tracks the inductance-off column.

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

`circuitModel: 'gyrator'` already includes Le in the acoustic circuit and, with Le, reproduces
WinISD's inductance-on roll-off shape (openisd gyrator 59.663 dB at 20 kHz vs WinISD 58.227 dB;
the 1.44 dB gap is 0.92 dB of the separately-recorded passband offset plus 0.5 dB).

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
`toys/w5_charts.py vcind VCInd=1` and compare the traced SPL column against the new openisd
curve; the residual should be the passband offset alone.
