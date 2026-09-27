# BUG_20260927_bandpass4-box-not-winisd-form

**Status:** RESOLVED

## Symptom
4th-order bandpass charts differ from WinISD: impedance, SPL, transfer and port velocity.

## Evidence
- WinISD: `winisd_research/runs/bp4-w5-1` (Vr 10 L, Vf 5 L, Ff 60 Hz, Qlr 7, Qar 30, Qiclfr 20,
  Qlf 9, Qaf 40, Qpf 15), impedance/transfer/port velocity reproduced to ≤ 5e-14 by the closed
  form in winisd_research GHIDRA_FINDINGS.md "4th-order bandpass — `0x457a30`".
- OpenISD: `packages/design/engine/circuit.ts` `solve`, `box === 'bandpass4'` branch.

## Cause
OpenISD's bandpass branch differs from WinISD's:

| Item                 | WinISD                                                        | OpenISD                                        |
|----------------------|---------------------------------------------------------------|------------------------------------------------|
| Rear chamber losses  | sealed form at ωsc: Qlr/(ωsc·Cabr), ωsc·Mas/Qar in series      | shared Ql/Qa, per frequency, in parallel       |
| Front chamber losses | vented form at ωf: Qlf·ωf·Mapf, ωf·Mapf/Qaf in series, Rap = ωf·Mapf/Qpf | the same shared Ql/Qa (front's own Ql/Qa/Qp unused), per frequency |
| Inter-chamber leak   | Ricl = Qicl·ωs·Mas, parallel to the cone's load                | absent                                         |
| Port mass            | from Ff                                                        | from vent length                               |
| Radiated output      | port + front leak − rear leak                                  | port only                                      |

## Fix
`winisd-lossy` loss mode: WinISD's form above, with each chamber's own losses reaching `solve`.
`conventional-lossy` keeps today's form.

## Verification
`packages/design/test/engine/bandpass4-winisd.test.ts` — imports `bp4-w5-1.wpr`, sweeps at the
fixture's own frequencies, compares against `WINISD_BANDPASS4_CAPTURE`:
- impedance |Z|/phase: ≤1e-12 rel, ≤1e-10 deg — worst case at the tolerance floor (no looser).
- transfer tfMag/phase: ≤1e-10 dB, ≤1e-9 deg.
- front port velocity (pv vs √2·|Up|): ≤1e-12 rel.
- import: Vr 0.01, Vf 0.005, Ff 60, Qlr 7, Qar 30, Qiclfr 20, Qlf 9, Qaf 40, Qpf 15, dia 0.05,
  Rs 0.1 all land unchanged — the import already carried every one, no fix needed there.

Implementation: `Bandpass4Box.ts` gained a `lossMode` switch (`lossless`/`conventional-lossy`
unchanged; `winisd-lossy`, the new default, is the form in the Cause table). `SweepParams`
gained `Qlr`/`Qar`/`Qiclfr`/`Qlf`/`Qaf`/`Qpf`/`Ff`, fed from `openISDProject.ts`
`#boxSpecificParams`'s `bandpass4` case.

Regression: `bandpass4-single` golden fixture had no `lossMode`, so the engine's changed default
(`winisd-lossy`) silently swapped its formula and broke it. Fixed by pinning the mode it always
exercised — added `"lossMode": "conventional-lossy"` to its `design.P`; the sweep/maxCurves
numbers are unchanged (same code path, same formula).
