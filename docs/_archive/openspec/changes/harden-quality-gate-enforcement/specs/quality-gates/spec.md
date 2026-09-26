## Purpose

Defines the mechanical checks that gate a commit and a push in this repository — coverage
never regressing — so that a green gate is proof the underlying property actually holds, not
just that a check ran.

## ADDED Requirements

### Requirement: Coverage thresholds are enforced on every gated test run
The commands that gate a commit and a full health check (`scripts/hooks-local/pre-commit`,
`scripts/health-check.sh`) SHALL run the Vitest unit suite with coverage collection enabled, so
that `vitest.config.ts`'s `coverage.thresholds` block fails the run when actual coverage drops
below the configured statements/branches/functions/lines thresholds.

#### Scenario: A commit drops coverage below the configured threshold
- **WHEN** a change under `packages/{engine,winisd,ui}/src/` is staged such that measured
  coverage for any configured metric (statements, branches, functions, lines) falls below
  `vitest.config.ts`'s `coverage.thresholds` value for that metric
- **THEN** `git commit` is blocked by `scripts/hooks-local/pre-commit`, and
  `bash scripts/health-check.sh` reports the coverage step as failed

#### Scenario: A commit keeps coverage at or above threshold
- **WHEN** measured coverage for every configured metric meets or exceeds
  `vitest.config.ts`'s `coverage.thresholds`
- **THEN** `git commit` and `bash scripts/health-check.sh` both pass the coverage step

### Requirement: Coverage thresholds never decrease without an explicit edit
`vitest.config.ts` SHALL set `coverage.thresholds.autoUpdate` to `true`, so a run whose actual
coverage exceeds the current committed thresholds rewrites those threshold values upward in
`vitest.config.ts`, and no mechanism in the gated test path lowers a threshold value — a lower
number can only reach `vitest.config.ts` through a human-authored edit reviewed like any other
source change.

#### Scenario: Coverage rises on a gated run
- **WHEN** `npm run test:coverage` measures coverage above the currently committed threshold for
  some metric
- **THEN** `vitest.config.ts`'s `coverage.thresholds` value for that metric is rewritten to the
  new, higher measured value

#### Scenario: Coverage regresses without a corresponding config edit
- **WHEN** a change lowers actual coverage below the currently committed threshold and
  `vitest.config.ts` is not edited to lower that threshold
- **THEN** the gated coverage run fails (per the "Coverage thresholds are enforced on every
  gated test run" requirement) instead of silently accepting the drop
