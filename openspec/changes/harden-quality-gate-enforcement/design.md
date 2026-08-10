## Context

See `proposal.md` - Why. Two files carry the mechanism:

- `scripts/validate-openspec.py` — a hand-rolled, project-specific traceability validator (no
  such feature exists in the `openspec` CLI itself, confirmed by inspecting the installed
  package `@fission-ai/openspec@1.8.0`'s `dist/`). It already builds `all_referenced_tests`
  (spec → test paths, collected during requirement parsing) and a hardcoded `MAPPING` of
  capability → owned test files, but uses neither for existence or capability-match checking.
- `vitest.config.ts` — already declares `coverage.thresholds` (v8 provider, `@vitest/coverage-v8`
  already a devDependency), but nothing in the gated command chain (`test:unit` →
  `pre-commit`/`health-check.sh`/`ci`) passes `--coverage`, so the thresholds are inert.
  Confirmed: `vitest`'s coverage options type (`node_modules/vitest/dist/chunks/reporters.d.*.ts`)
  documents `autoUpdate?: boolean` (`@default false`) on the threshold config — "when true and a
  metric's actual coverage exceeds its configured threshold, the threshold is rewritten to the
  new value" — this is Vitest's own built-in ratchet, not custom code.

## Goals / Non-Goals

**Goals:**
- Make the two traceability rules (`feature-has-test-reference`, `test-has-feature-reference`)
  actually verify what their names claim.
- Make the coverage thresholds already declared in `vitest.config.ts` actually gate a commit.
- Make coverage regression require a reviewable, human-authored diff to `vitest.config.ts`
  rather than being silently absorbed.

**Non-Goals:**
- Not changing the coverage *targets* (the current 15.8/78.5/54.0/15.8 numbers) beyond what
  `autoUpdate` raises them to as a side effect of this repo's actual current coverage.
- Not building the `extract`/`trace` code-to-spec line-mapping feature discussed in
  `Fission-AI/OpenSpec#739` — that is an unshipped upstream CLI proposal (still absent from
  1.8.0) covering a different axis (production code lines, explicitly excluding tests); this
  change stays inside the existing homegrown validator and Vitest's own coverage machinery.
- Not touching `packages/*/src/` — no calculation, physical-constant, precision, or default
  change (see proposal.md - Impact).

## Decisions

**1. Existence check reuses the already-collected `all_referenced_tests` set, not a fresh scan.**
The script already accumulates every test path cited by a requirement into
`all_referenced_tests` (`scripts/validate-openspec.py`, inside the requirement-parsing loop) and
then drops it. Add one loop after requirement parsing: `for ref in all_referenced_tests: if not
os.path.exists(ref): errors/warnings.append(...)`. Alternative considered: check each reference
inline at collection time — rejected, because the existing structure already separates "collect
all cited paths" from "check the accumulated set," and checking inline would duplicate that
separation for no benefit.

**2. Capability-match check cross-references the existing `MAPPING` table, not a new schema.**
`MAPPING` already states, per capability, exactly which test files belong to it. For each test
file that IS a key in some capability's `MAPPING` entry, replace the current "any spec.md
reference anywhere in the file" check with "does the file reference *that* capability's
spec.md". A test file absent from `MAPPING` keeps today's any-capability-link behavior — this
change does not require every test file to be enumerated in `MAPPING` (out of scope; `MAPPING`
is already incomplete relative to the full test tree and completing it is a separate concern).
Alternative considered: parse `describe()`/test-block-level spec comments for finer-than-file
granularity — rejected as materially larger (requires a JS/TS-aware parser, not regex over
Python) and not what was asked; the file-level, capability-scoped fix closes the actual
mismatch example in the proposal (a file citing a different capability than the one it's
mapped to).

**3. Wire coverage into `test:coverage`, not into `test:unit` directly.**
Add a new npm script `"test:coverage": "vitest run --coverage"` and point
`scripts/hooks-local/pre-commit` and `scripts/health-check.sh`'s "Unit tests" step at it, leaving
`test:unit` (bare, no coverage) available for fast local iteration
(`operations.apply.guidance`: "Run focused tests before the full suite"). `npm run test` (which
chains `test:unit` + the browser suite) and `npm run check`/`ci` keep using `test:unit` — adding
coverage instrumentation to every one of those call sites would slow non-gate-critical paths
(e.g. `predev`, `prebuild`, which call `npm run lint` not tests, are unaffected either way) for
no enforcement benefit, since only the two hook/health-check paths are the actual gates per
`AGENTS.md` §"Quality gates — non-negotiable".

**4. Ratchet via Vitest's own `autoUpdate`, not a custom high-water-mark script.**
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
  local iteration per Decision 3.
- **[Risk] The capability-match check (Decision 2) only covers test files already present in
  `MAPPING`, so a wrongly-cited test file the table doesn't know about still passes.** → Not
  mitigated in this change; flagged as a known limitation in `tasks.md`'s final verification
  task rather than silently presented as fully closed.
- **[Trade-off] Enabling `--coverage` on the gated path, not on `npm run test`/`ci`, means a
  local `npm test` run does not itself demonstrate the coverage gate.** → Accepted: `pre-commit`
  and `health-check.sh` are the actual enforcement points per existing project convention: the
  gate table in `AGENTS.md` lists commands, and `bash scripts/health-check.sh` is already the
  mandated pre-"done" check independent of `npm test`.
