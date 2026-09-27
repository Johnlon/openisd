# BUG_20260927_passive-radiator-losses-not-winisd-form

**Status:** OPEN

## Symptom
Passive-radiator charts differ from WinISD whenever Ql or Qa are finite (always, by default).

## Evidence
- WinISD: `winisd_research/runs/pr-w5-1` (Ql 7, Qa 30, Qp 15, radiator Fs 30 / Qms 3.3 / Vas 4.8 L /
  Sd 95 cm²), impedance at all 2087 points reproduced to 9.4e-16 by the closed form in
  winisd_research GHIDRA_FINDINGS.md "Passive radiator box — `0x45a960`".
- OpenISD: `packages/design/engine/circuit.ts` `solve`, `box === 'box-passive-radiator'` branch.

## Cause
OpenISD's radiator branch differs from WinISD's:

| Item             | WinISD                                              | OpenISD                          |
|------------------|-----------------------------------------------------|----------------------------------|
| Leak             | Ral = Ql·ωr·Map, fixed (ωr = box tuning Fr)          | Ql/(ω·Cab), per frequency        |
| Absorption       | Raa = ωr·Map/Qa, in series with Cab                  | Qa/(ω·Cab), in parallel          |
| Radiator loss    | ωp·Map/Qms_pr (its own), box Qp unused               | Rms/Sd² (same when Me = 0)       |
| Radiated output  | cone − leak − radiator (runs/pr-w5-2, 1.6e-15)       | cone − radiator                  |

## Fix
In the `winisd-lossy` loss mode, the radiator branch uses WinISD's form above. `conventional-lossy`
keeps today's form.

## Verification
Engine test pinning the pr-w5-1/pr-w5-2 impedance, transfer and radiator excursion to WinISD ≤ 1e-12.
