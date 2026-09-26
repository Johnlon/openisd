# BUG_20260926_wpr-import-drops-source-resistance-and-simulator-options

**Status:** OPEN

## Symptom

`OpenISDProject.fromWprText` imports a WinISD `.wpr` and leaves several of its settings at
OpenISD defaults. A project saved in WinISD with Rg 10 Ω and "Simulate voice coil inductance"
on opens in OpenISD with Rg 0.1 Ω and inductance off, and no import error or warning is
raised.

## Evidence

Observed 2026-09-26 on
`winisd_research/runs/sweep-w5-sealed-impedance-rg10-vcind1/w5.wpr` (`[SignalSource] Rg=10.0`,
`[SimulatorOptions] VCInd=1`), imported, then `toOwprText()`:

| `.wpr` key                      | `.wpr` value | Imported `.owpr`                                | Default it fell back to |
|---------------------------------|--------------|-------------------------------------------------|-------------------------|
| `[SignalSource] Rg`             | 10.0         | `driverEmbedding.Rs_ohm` = 0.1                  | 0.1                     |
| `[SimulatorOptions] VCInd`      | 1            | `advanced.circuitModel` = `winisd` (inductance off) | `winisd`            |

The importer (`packages/design/domain/openIsdProjectToWinIsdProject.ts:216-349`,
`winIsdProjectToOpenIsdProject`) reads only these keys: `[Box]` BType, Vr, Fr, Vf, Ff, Npr,
T, p, phi; `[PassiveRadiator]`; `[SignalSource]` P; `[VentRear]`/`[VentFront]` Num;
`[ProjectInfo]`. It never reads these, all of which WinISD simulates with:

- `[SignalSource]` Rg
- `[SimulatorOptions]` VCInd, FlatResponse, TLPorts
- `[Box]` Qlr/Qar/Qpr (and the front and centre-chamber losses), Nd, Med, Isobarik,
  alfaVC, dTVC
- `[Filters]`

The W5 case hides the box-loss gap: its Ql 10 / Qa 100 happen to equal OpenISD's defaults.

## Cause

`winIsdProjectToOpenIsdProject` has no code for the keys listed above.

## Fix

Map each key onto its OpenISD field. VCInd=1 maps to `circuitModel` `winisdGyrator`, which is
WinISD's own inductance-on model. A key the importer cannot map becomes an import warning,
never a silent default.

## Verification

A `.wpr` round-trip test: a WinISD project with non-default Rg, VCInd, FlatResponse, TLPorts,
Ql/Qa/Qp, Nd, Med, Isobarik, alfaVC, dTVC and one filter imports with every value in its
OpenISD field.
