## Purpose

Defines the mechanical checks that gate a commit and a push in this repository — test↔spec
traceability integrity and coverage never regressing — so that a green gate is proof the
underlying property actually holds, not just that a check ran.

## ADDED Requirements

### Requirement: Spec-to-test references must resolve to real files
`scripts/validate-openspec.py` SHALL treat a test file path cited by a `### Requirement:`
block in `openspec/specs/**/spec.md` as invalid unless that path exists on disk, applying the
existing `feature-has-test-reference` severity (`error`/`warn`, from `openspec.json`) to the
failure.

#### Scenario: Requirement cites a deleted test file
- **WHEN** a spec requirement references `packages/engine/test/removed.test.ts` and that file
  no longer exists in the working tree
- **THEN** `python3 scripts/validate-openspec.py` reports a dangling-reference error naming the
  requirement, the spec file, and the missing path, and exits non-zero (when the rule severity
  is `error`)

#### Scenario: Requirement cites an existing test file
- **WHEN** every test path referenced by a spec requirement exists on disk
- **THEN** `python3 scripts/validate-openspec.py` reports no dangling-reference error for that
  requirement

### Requirement: Test-to-spec references must match the referencing test's own capability
`scripts/validate-openspec.py` SHALL reject a test file whose `openspec/specs/<capability>/spec.md`
reference names a capability other than the one that capability's own test-file listing (the
script's existing `MAPPING` table) assigns to that test file, applying the existing
`test-has-feature-reference` severity to the failure. A test file not listed in `MAPPING` for
any capability is unaffected by this requirement (existing any-capability-link behavior stands
for it).

#### Scenario: Test cites the wrong capability's spec
- **WHEN** `packages/engine/test/driver.test.ts` (mapped to `core-engine` in `MAPPING`) contains
  a reference to `openspec/specs/ui-presentation/spec.md` and no reference to
  `openspec/specs/core-engine/spec.md`
- **THEN** `python3 scripts/validate-openspec.py` reports a capability-mismatch error naming the
  test file, the capability it is mapped to, and the capability it actually cites

#### Scenario: Test cites its own mapped capability
- **WHEN** a test file listed under a capability in `MAPPING` references that same capability's
  `openspec/specs/<capability>/spec.md`
- **THEN** `python3 scripts/validate-openspec.py` reports no capability-mismatch error for that
  test file

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
