## Why

`vitest.config.ts` already declares a `coverage.thresholds` block (statements/branches/
functions/lines), but no gated command (`scripts/hooks-local/pre-commit`,
`scripts/health-check.sh`, `npm run ci`) ever invokes Vitest with `--coverage`, so those
thresholds enforce nothing and coverage can regress silently. This was confirmed by direct
inspection during this conversation, and the user asked for it to be closed ("I need
enforcement").

**Scope correction (mid-implementation):** this change originally also hardened
`scripts/validate-openspec.py`'s test↔spec traceability checks (`feature-has-test-reference`,
`test-has-feature-reference`). That work is dropped. Investigation showed the whole mechanism
— `validate-openspec.py`, `openspec.json`, and the rule names themselves — was invented
wholesale by a prior AI session (commit `8df720d`, stamped `(auto)`), not a real OpenSpec CLI
feature (confirmed: zero references to `test-has-feature-reference`,
`feature-has-test-reference`, or `requireTraceability` anywhere in the installed
`@fission-ai/openspec@1.8.0` package). Its actual precision was file-level ("a link exists
somewhere in this file"), which cannot express "this specific test verifies this specific
requirement" — a file cited once can contain describe blocks covering unrelated behavior
(demonstrated: `formulas.test.ts`, cited for "Driver Parameter Consistency & Derivations",
contains an unrelated `formulas — passive radiator derivations` block). Real prior art for
mechanical spec↔test binding (BDD frameworks: Cucumber/Gherkin) works by making the spec
itself executable, which OpenSpec's prose specs are not; the lighter alternative
(scenario-ID/hash tagging) is real but substantially bigger scope than this change, and was
never authorized. Per the user's explicit decision, the whole file-link mechanism — the
script, its config, its test, the "hard rule" it backed in `AGENTS.md` and the `/tdd` skill,
and its invocation from `pre-commit`/`health-check.sh` — has been deleted/removed as a
separate, already-completed action in this conversation, ahead of this change's own tasks.

## What Changes

- Add a `test:coverage` npm script (`vitest run --coverage`) and wire it into
  `scripts/hooks-local/pre-commit` and `scripts/health-check.sh` in place of the
  un-instrumented `test:unit` invocation, so `vitest.config.ts`'s `coverage.thresholds` block
  actually gates commits.
- Add a coverage ratchet: `vitest.config.ts`'s `coverage.thresholds.autoUpdate: true`, so a
  commit that raises coverage bumps the committed threshold up, and a later commit cannot drop
  below the last-recorded high-water mark without an explicit, reviewable edit to
  `vitest.config.ts`.

This change touches only test-gate tooling (`scripts/hooks-local/pre-commit`,
`scripts/health-check.sh`, `vitest.config.ts`, `package.json`). **It does not touch
calculation logic, physical constants, display precision, or any result-affecting default**
— no engine or UI source file under `packages/*/src/` is changed, so the calculation-logic
permission gate (`openisd/AGENTS.md` §"Calculation logic — permission gate") does not apply.
The user authorised this work explicitly in-conversation ("I need enforcement", "go").

## Capabilities

### New Capabilities
- `quality-gates`: mechanical enforcement of coverage-never-regresses, as run by
  `scripts/hooks-local/pre-commit` and `scripts/health-check.sh`. No existing capability spec
  covers repo tooling/CI gates — the six current capabilities (app-shell, core-engine,
  driver-database, driver-editor, project-management, ui-presentation) describe the shipped
  application, not its own build gates.

### Modified Capabilities
(none — no existing capability's requirements change)

## Impact

- `scripts/hooks-local/pre-commit`, `scripts/health-check.sh` — swap `test:unit` invocation for
  `test:coverage`.
- `package.json` — new `test:coverage` script.
- `vitest.config.ts` — `coverage.thresholds.autoUpdate: true`; `autoUpdate` runs can rewrite the
  threshold numbers in this file when coverage rises, so a commit that raises coverage must
  re-stage the updated file.
- No engine, UI, or driver-database source changes; no new runtime dependency (`@vitest/coverage-v8`
  is already installed).
