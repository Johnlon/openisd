## Why

Two quality gates currently run but don't enforce what they claim to. The test↔spec
traceability validator (`scripts/validate-openspec.py`) collects every test path referenced
from a spec requirement into `all_referenced_tests` but never checks those paths exist — a
spec citing a deleted test file stays green forever, and the test→spec direction accepts any
capability link anywhere in the file, so a test that cites capability A while verifying
capability B still passes. Separately, `vitest.config.ts` carries a `coverage.thresholds`
block, but no gate (`test:unit`, pre-commit, `health-check.sh`, `ci`) ever invokes Vitest with
`--coverage`, so the configured thresholds enforce nothing and coverage can regress silently.
Both gaps were found and confirmed by direct inspection during this conversation, and the
user has asked for both to be closed now ("I need enforcement").

## What Changes

- Add an existence check to `scripts/validate-openspec.py`: every test path already collected
  in `all_referenced_tests` (spec → test direction) must resolve to a real file on disk; a
  dangling reference is a new `ERROR`/`WARN` entry gated the same way as the two existing
  rules (`requireTraceability`, per-rule `error`/`warn` in `openspec.json`).
- Tighten the test → spec direction in the same script from "any spec link anywhere in the
  file" to "the spec link's capability matches a capability that actually maps this test file"
  — cross-checked against the existing `MAPPING` table (capability → test files) already in
  the script, so a test citing the wrong capability's `spec.md` fails.
- Enable coverage collection in the enforced test path: add a `test:coverage` npm script
  (`vitest run --coverage`) and wire it into `scripts/hooks-local/pre-commit` and
  `scripts/health-check.sh` in place of the un-instrumented `test:unit` invocation, so
  `vitest.config.ts`'s `coverage.thresholds` block actually gates commits.
- Add a coverage ratchet: `vitest.config.ts`'s `coverage.thresholds.autoUpdate: true`, so a
  commit that raises coverage bumps the committed threshold up and a later commit cannot drop
  below the last-recorded high-water mark without an explicit, reviewable edit to
  `vitest.config.ts`.

This change touches only test-gate tooling (`scripts/validate-openspec.py`,
`scripts/hooks-local/pre-commit`, `scripts/health-check.sh`, `vitest.config.ts`,
`package.json`). **It does not touch calculation logic, physical constants, display
precision, or any result-affecting default** — no engine or UI source file under
`packages/*/src/` is changed, so the calculation-logic permission gate
(`openisd/AGENTS.md` §"Calculation logic — permission gate") does not apply. The user
authorised this work explicitly in-conversation ("I need enforcement", "go") after being
shown both gaps.

## Capabilities

### New Capabilities
- `quality-gates`: mechanical enforcement of test↔spec traceability integrity and
  coverage-never-regresses, as run by `scripts/hooks-local/pre-commit` and
  `scripts/health-check.sh`. No existing capability spec covers repo tooling/CI gates — the
  six current capabilities (app-shell, core-engine, driver-database, driver-editor,
  project-management, ui-presentation) describe the shipped application, not its own build
  gates.

### Modified Capabilities
(none — no existing capability's requirements change)

## Impact

- `scripts/validate-openspec.py` — two new checks added to the existing `validate()` function;
  no change to its CLI surface (`--fix` unaffected).
- `scripts/hooks-local/pre-commit`, `scripts/health-check.sh` — swap `test:unit` invocation for
  `test:coverage`.
- `package.json` — new `test:coverage` script.
- `vitest.config.ts` — `coverage.thresholds.autoUpdate: true`; `autoUpdate` runs can rewrite the
  threshold numbers in this file when coverage rises, so a commit that raises coverage must
  re-stage the updated file.
- No engine, UI, or driver-database source changes; no new runtime dependency (`@vitest/coverage-v8`
  is already installed).
