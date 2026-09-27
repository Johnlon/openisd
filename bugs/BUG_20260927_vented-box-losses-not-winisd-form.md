# BUG_20260927_vented-box-losses-not-winisd-form

**Status:** RESOLVED

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
`packages/design/engine/circuit.ts` `solve`, `box === 'vented'` branch now switches on `lossMode`,
mirroring the sealed box:
- `winisd-lossy` (default): WinISD's form above — Map/Ral/Raa/Rap fixed at ωb = 2π·Fb, U0 = cone
  − leak − port (the Cab branch's own current). `tlPortModel` is not read here — WinISD's port is
  always this lumped Map.
- `conventional-lossy`/`lossless`: today's form, unchanged (Map from `Leff`, per-frequency
  Ql/Qa/Qp, `tlPortModel` still honoured).

`Fb` is a new `SweepParams` field (`packages/design/engine/types.ts`), fed from
`OpenISDProject`'s `box.vented.tuning_goal_hz.value` (`#boxSpecificParams`,
`packages/design/domain/openisdDomain.ts`) — the same value already gated by the vent's own
`VentIssue` (`#ventSweepIssues`) before a sweep runs. When a raw `SweepParams` omits `Fb` (direct
engine callers, several existing unit tests), it reads as `NaN` and poisons the winisd-lossy
vented output exactly like an absent `Leff`/`Sp` does elsewhere in this file — caught by
`classifyFinite`, never a thrown error (the engine's no-throw contract, `hardening.test.ts`).

## Verification
New `packages/design/test/engine/vented-winisd.test.ts`: imports the exact `.wpr` WinISD ran
(`vented-w5-2.wpr`, Fb 38, Ql 7, Qa 30, Qp 15, 50 mm port) via `OpenISDProject.fromWprText`,
sweeps at the fixture's own 522 frequencies (1–19905 Hz), and matches WinISD
(`winisdVentedCapture.ts`, debugger-logged) on:
- impedance |Z|/phase: ≤1e-12 relative / ≤1e-10 deg
- transfer function tfMag(dB)/phase: ≤1e-10 dB / ≤1e-9 deg
- port velocity (√2·|Up/Sp|): ≤1e-12 relative

Confirmed RED-then-GREEN: temporarily reverting the `winisd-lossy` branch to the old
(conventional) formula fails 3 of the 4 chart checks; the fix passes all 4.

Existing tests that swept a `vented` box directly through the engine (bypassing the domain, so
never supplying `Fb`) needed a self-consistent `Fb` added, computed from their own `Sp`/`Leff`/`Vb`
via the Helmholtz relation (never touching conventional-mode expectations):
- `packages/design/test/engine/engine.test.ts` — already computed `Fb_Hz`; just passed it through.
- `packages/design/test/engine/advanced-options.test.ts` (`VENTED`) and
  `packages/ui/test/ui/chart-types.test.ts` (`SP`) — added a derived `Fb` constant.
- `packages/design/test/engine/complex.test.ts` and the TL-port test in
  `advanced-options.test.ts` — these test `tlPortModel` specifically, which is
  conventional-lossy-only now, so both set `lossMode: 'conventional-lossy'` explicitly.
- `packages/design/test/fixtures/golden/vented-single.json` and `vented-2drv-series.json` —
  committed golden fixtures; added `Fb` (Helmholtz-derived from their own `Sp`/`Leff`/`Vb`) and
  regenerated the pinned `sweep`/`maxCurves` arrays, since the underlying formula changed:

  | fixture | old lossless-mode default | new (winisd-lossy, Fb added) |
  |---|---|---|
  | vented-single | `sweep.spl[0]` = 38.350 dB | regenerated to match the WinISD-form circuit |
  | vented-2drv-series | `sweep.spl[0]` = 45.153 dB | regenerated to match the WinISD-form circuit |

  (Both fixtures' entire `sweep`/`maxCurves` arrays were regenerated, not just `spl[0]` — that
  row is the one the test's own failure message showed.)
