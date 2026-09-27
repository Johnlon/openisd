# BUG_20260927_vented-box-losses-not-winisd-form

**Status:** OPEN

## Symptom
Vented box charts differ from WinISD whenever Ql, Qa or Qp are finite (always, by default).

## Evidence
- WinISD: `winisd_research/runs/vented-w5-2` (Fb 38, Ql 7, Qa 30, Qp 15), impedance at all 2087
  points matched to 1.05e-15 by one model only (`toys/w5_vented_model_check.py`; winisd_research
  GHIDRA_FINDINGS.md "Vented box — `0x456800`").
- OpenISD: `packages/design/engine/circuit.ts` `solve`, `box === 'vented'` branch.

## Cause
OpenISD's vented branch differs from WinISD's:

| Item               | WinISD                                   | OpenISD                                  |
|--------------------|------------------------------------------|------------------------------------------|
| Port mass          | Map = 1/(ωb²·Cab), from Fb               | ρ·Leff/Sp, from the vent length          |
| Leak, absorption   | Ral = Ql/(ωb·Cab); Raa = ωb·Map/Qa in series with Cab | Ql/(ω·Cab) ∥ Qa/(ω·Cab), per frequency |
| Port loss          | Rap = ωb·Map/Qp, fixed                   | ω·Map/Qp, per frequency                  |
| Radiated output    | cone − leak − port                       | cone − port (leak not subtracted)        |

## Fix
In the `winisd-lossy` loss mode, the vented branch uses WinISD's form above. `conventional-lossy`
keeps today's form.

## Verification
Engine test pinning the vented-w5-2 impedance (and the full vented chart pass) to WinISD ≤ 1e-12.
