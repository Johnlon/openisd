## Context

See `proposal.md` - Why. `vitest.config.ts` already declares `coverage.thresholds` (v8
provider, `@vitest/coverage-v8` already a devDependency), but nothing in the gated command
chain (`test:unit` → `pre-commit`/`health-check.sh`/`ci`) passes `--coverage`, so the
thresholds are inert. Confirmed: `vitest`'s coverage options type
(`node_modules/vitest/dist/chunks/reporters.d.*.ts`) documents `autoUpdate?: boolean`
(`@default false`) on the threshold config — "when true and a metric's actual coverage
exceeds its configured threshold, the threshold is rewritten to the new value" — this is
Vitest's own built-in ratchet, not custom code.

## Goals / Non-Goals

**Goals:**
- Make the coverage thresholds already declared in `vitest.config.ts` actually gate a commit.
- Make coverage regression require a reviewable, human-authored diff to `vitest.config.ts`
  rather than being silently absorbed.

**Non-Goals:**
- Not changing the coverage *targets* (the current 15.8/78.5/54.0/15.8 numbers) beyond what
  `autoUpdate` raises them to as a side effect of this repo's actual current coverage.
- Not building any spec↔test traceability/correlation mechanism. That was this change's
  original scope (see proposal.md - Why, "Scope correction"); it was dropped as a separate,
  already-completed action, not part of this change's remaining work.
- Not touching `packages/*/src/` — no calculation, physical-constant, precision, or default
  change (see proposal.md - Impact).

## Decisions

**1. Wire coverage into `test:coverage`, not into `test:unit` directly.**
Add a new npm script `"test:coverage": "vitest run --coverage"` and point
`scripts/hooks-local/pre-commit` and `scripts/health-check.sh`'s "Unit tests" step at it, leaving
`test:unit` (bare, no coverage) available for fast local iteration
(`operations.apply.guidance`: "Run focused tests before the full suite"). `npm run test` (which
chains `test:unit` + the browser suite) and `npm run check`/`ci` keep using `test:unit` — adding
coverage instrumentation to every one of those call sites would slow non-gate-critical paths
for no enforcement benefit, since only the two hook/health-check paths are the actual gates per
`AGENTS.md` §"Quality gates — non-negotiable".

**2. Ratchet via Vitest's own `autoUpdate`, not a custom high-water-mark script.**
`coverage.thresholds.autoUpdate: true` is a one-line, already-shipped Vitest feature that does
exactly "raise on improvement, never silently lower" — building a bespoke ratchet (e.g. a
committed `coverage-baseline.json` diffed by a wrapper script) would duplicate behavior Vitest
already provides and add a second thing to keep in sync with `vitest.config.ts`.

## Risks / Trade-offs

- **[Risk] `autoUpdate` rewrites `vitest.config.ts` on disk during a gated run, which can leave
  the working tree dirty mid-commit if coverage rose.** → Mitigation: this is the intended
  ratchet behavior, not a bug — `tasks.md` includes a task to re-stage `vitest.config.ts` if
  `pre-commit`'s coverage step modifies it, matching the existing "hooks are the source of
  truth, never bypass" posture (`AGENTS.md`). A commit that raises coverage picks up the raised
  threshold in the same commit.
- **[Risk] Coverage collection under v8 adds wall-clock time to every commit.** → Mitigation:
  accepted per the user's explicit "I need enforcement" — the whole point is that the existing
  inert thresholds start actually gating; `test:unit` (uninstrumented) stays available for quick
  local iteration per Decision 1.
- **[Trade-off] Enabling `--coverage` on the gated path, not on `npm run test`/`ci`, means a
  local `npm test` run does not itself demonstrate the coverage gate.** → Accepted: `pre-commit`
  and `health-check.sh` are the actual enforcement points per existing project convention: the
  gate table in `AGENTS.md` lists commands, and `bash scripts/health-check.sh` is already the
  mandated pre-"done" check independent of `npm test`.
