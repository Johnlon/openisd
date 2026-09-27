# BUG_20260927_bandpass4-box-not-winisd-form

**Status:** OPEN

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
Engine test pinning bp4-w5-1 impedance, transfer and front port velocity to WinISD ≤ 1e-12.
