# BUG_20260927_passive-radiator-losses-not-winisd-form

**Status:** RESOLVED

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
`packages/design/engine/circuit.ts`, `box === 'box-passive-radiator'`: the branch now switches on
`lossMode`, same pattern as sealed/vented. `winisd-lossy` uses WinISD's form above (Ral/Raa fixed
at ωr = 2π·Fr — the box's own tuning, `PassiveRadiatorBox.systemTuning_hz`, never the radiator's
free-air Fs; output is cone − leak − radiator). `conventional-lossy`/`lossless` keep today's
per-frequency form unchanged.

`Fr` reaches `solve()` through a new `SweepParams.Fr`, fed from `systemTuning_hz` in
`OpenISDProject#boxSpecificParams`'s `box-passive-radiator` case (`packages/design/domain/
openisdDomain.ts`). Absent → NaN, caught by `classifyFinite`, same as an absent vented `Fb`.

Import fix (`packages/design/domain/openIsdProjectToWinIsdProject.ts`): the `.wpr` [PassiveRadiator]
section states only Vas/Qms/Fs/Sd/Xmax, never the radiator's own Cms/Mms/Rms — these are entry-
backed fields with no consistency solver of their own, so the importer now derives them with the
same closed forms the PR editor uses (`engine.prCmsFromVas`/`prMmdFromFs`/`prRmsFromQms`) instead
of leaving them unset (which blocked the sweep with a `missing-dependencies` issue). The [PassiveRadiator]
`Me` (added mass) is now also imported, applied via `addedMass_kg.set()` after the builder's
`tuning_goal_hz(Fr)` — entering `Me` directly avoids a spurious `target-unreachable` at the exact
tuning ceiling that re-deriving it from `Fr` through the solved pair could hit on float rounding.

⚠ Unverified (doc-commented in circuit.ts): which mass WinISD uses with the radiator's own added
mass Me ≠ 0 or Npr > 1.

## Verification
`packages/design/test/engine/passive-radiator-winisd.test.ts`, importing
`packages/design/test/winisd/fixtures/pr-w5-1.wpr` (golden: `winisdPassiveRadiatorCapture.ts`,
pr-w5-1/pr-w5-2). All 5 tests pass:
- import: Vb, Fr, Ql, Qa, radiator Fs/Qms/Vas/Sd, addedMass_kg (Me) and Rs land as WinISD stated.
- swept grid matches the fixture's own frequencies exactly.
- impedance |Z|/phase ≤ 1e-12 relative / 1e-10 deg.
- transfer tfMag/phase ≤ 1e-10 dB / 1e-9 deg.
- radiator excursion (√2·|radiatorExcursion|, m→mm) ≤ 1e-12 relative.

Existing PR engine/golden tests (`circuit.test.ts`, `engine.test.ts`, `golden.test.ts` pr-single)
updated to feed a consistent `Fr` (via `engine.prTuning`) instead of leaving it absent — otherwise
`winisd-lossy`'s new Ral/Raa poison every point with NaN, which `sweep()`'s `pm > 0` SPL guard
silently turns into the -200 dB silence sentinel rather than a visible NaN, masking the very
differences those tests check for.
