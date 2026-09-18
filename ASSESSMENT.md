# OpenISD — Architecture & Quality Assessment

## TL;DR

This is a **remarkably well-governed** codebase for a solo/small-team project. Architecture rules are encoded as AST-level tests, not prose. Testing uses external oracles (real WinISD files, micka.de), not tautologies. The domain model (lens-over-immutable-record with typed cells) is genuinely sophisticated. That said, there are real issues — mostly accumulated tech debt from a major migration, not design failures.

---

## Architecture

### Strengths

| Area | Detail |
|---|---|
| **Monorepo layout** | Clean `design → persistence → ui` dependency chain. No cycles at runtime. |
| **Layer enforcement** | 728-line AST gate (`architecture.test.ts`) mechanically verifies service never imports logic, components never import domain values, etc. |
| **DI discipline** | Composition root in `main.ts` is the only constructor site (in theory). Repos take `KeyValueStorage` as a collaborator. Domain never constructs its own Engine. |
| **Error handling** | Three separated channels: cascaded domain issues (`CalculationIssue` discriminated union), fault log (patches `console.error` because Vue swallows computed throws), typed `{value, errors}` outcomes everywhere else. |
| **Domain model** | `OpenISDProject` = immutable JSON record with 3 layers (saved/edited/whatif), every public member is a freshly-built lens view. `Field<T>` is a pure lens, never a store. |

### Issues

| # | Severity | Issue | Location |
|---|---|---|---|
| A1 | **High** | **Module-level Engine singleton** — `appState.ts:87` exports `const engine = getOrInit(..., () => new Engine())`. Imported as a value by 3 modules. Violates composition-root doctrine. | `ui/src/logic/appState.ts:87` |
| A2 | **Medium** | **5+ Engine construction sites** — main.ts:32, appState:87, appState:449 (computed recompute!), series.ts:92/101/145. Engine is stateless so functionally harmless, but doctrinally wrong. | scattered |
| A3 | **Medium** | **Direct appState imports from hooks/components** — ~12 hooks + 8 `.vue` files import `logic/appState.ts` directly, bypassing the service layer. Service layer is declared "NOT BUILT" in ARCHITECTURE.md. | `DriverEditorModal.vue:4,18`, etc. |
| A4 | **Medium** | **Prototype code shipped in design package** — `packages/design/app/` (composition.ts + workspace.ts) is a prototype "stands in for the real UI" that is unreachable from outside the package. | `packages/design/app/` |
| A5 | **Low** | **0-byte dead file** — `winisd/iniRows.ts` is empty and unreferenced. | `packages/design/winisd/iniRows.ts` |
| A6 | **Low** | **Stale comment** — `driverYmlToOpenisdAndWdr.ts:5-6` says "It lives in `packages/design/winisd`" but the file is in `packages/design/domain/`. | `domain/driverYmlToOpenisdAndWdr.ts:5-6` |
| A7 | **Low** | **Deprecated-but-active method** — `notifyVentChanged()` is `@deprecated` but is the app's *active* notification path (called from `useVentGroup.ts:40,70,102`). | `openisdDomain.ts:2942` |

---

## Testing

### Strengths

| Area | Detail |
|---|---|
| **Volume** | 190 test files, ~1600 cases across 3 tiers (unit, architecture-gate, browser-e2e). |
| **Anti-tautology** | Expectations come from external oracles: real WinISD-written `.wdr` files, micka.de cross-validation, QSpeakers. Not re-derived from code under test. |
| **Architecture gates** | AST-level tests enforce no-casts, no-globals, engine-boundary, schema↔type agreement. Self-verify they can see the code they guard. |
| **Zero-tolerance console** | `browserLog` auto-fixture asserts zero console errors, zero uncaught page errors, zero failed same-origin requests on every browser test. |
| **"A skip is a fail"** | Custom reporters for both Vitest and Playwright fail the run on any skipped/todo/fixme/only test. |

### Issues

| # | Severity | Issue | Detail |
|---|---|---|---|
| T1 | **High** | **Persistence storage layer untested** — `fileSave`, `fileStorage`, `keyValueStorage`, `myDriverRepo`, `prefsRepo`, `viewStateRepo` have zero direct unit tests. Exercised only indirectly via browser specs. | `packages/persistence/` |
| T2 | **Medium** | **16 of 17 Vue hooks lack direct unit tests** — only `SealedAlignment-hooks.test.ts` exists. Rest tested only through Playwright. | `packages/ui/src/hooks/` |
| T3 | **Medium** | **UI statement coverage is 8–16%** — branch floor is 78.5% but statement floor is 15.8%. Hooks and components are least covered. | vitest.config.ts thresholds |
| T4 | **Low** | **Committed debug probe files** — 8 `zz-probe*.spec.ts` files in `test/probes/` are debug scratch, parked outside Playwright testDir but still committed. | `test/probes/zz-*` |
| T5 | **Low** | **Thin tests** — `presentationState.test.ts` is 3 small cases; `store-path.repro.test.ts` is a debug repro with `console.log` and a single loose assertion. | various |

---

## Code Quality

### Strengths

| Area | Detail |
|---|---|
| **Type safety** | Zero `any` in shipped source. `Record<string, unknown>` only at trust boundaries with explicit narrowing. `as const` + `satisfies` used freely. |
| **Sum types** | `CalculationIssue<Q>` = `missing-dependencies | inconsistent-inputs`. `FieldState` = `'entered'|'calculated'|'not-available'`. Exhaustive matches enforced. |
| **Zod schemas** | All JSON records are `z.strictObject()` — unknown keys rejected at parse boundary. |
| **Import hygiene** | No deep/relative imports across package borders. Engine "one door" enforced by ESLint `no-restricted-imports`. |

### Issues

| # | Severity | Issue | Location |
|---|---|---|---|
| Q1 | **High** | **`openisdDomain.ts` is 3077 lines** — `OpenISDProject` class alone is ~1110 lines (1928–3038). `DriverEditorModal.vue` is 1410 lines. `OriginalShell-hooks.ts` is 902 lines. | `domain/openisdDomain.ts`, `ui/...` |
| Q2 | **Medium** | **Magic numbers** — `series.ts:144,159,161,186,189` all marked `FIXME - magic number`. | `ui/src/logic/series.ts` |
| Q3 | **Medium** | **Root-directory clutter** — ~40 stray scripts at repo root (`fix_io.py`, `fix_persist*.py` 1–8, `refactor_*.py`, `scratch.js`, `err.txt`, `tsc_output.txt`). Migration artifacts not cleaned up. | repo root |
| Q4 | **Low** | **6 throwing stubs** — vent/PR group-solve methods throw "not implemented" (QO126). Deliberate pre-existing behavior but could bite new contributors. | `openisdDomain.ts:2921-2932` |
| Q5 | **Low** | **Raw `window.alert()`/`prompt()`** in logic layer — `useApplicationIO.ts:138-139,207-212`. Inconsistent with the otherwise injected-DI style. | `ui/src/logic/useApplicationIO.ts` |

---

## Process & Tooling

### Strengths

| Area | Detail |
|---|---|
| **Layered gates** | pre-commit (lint+typecheck+unit) → pre-push (full CI) → `health-check.sh` (locked, exclusive). |
| **Decision ledger** | `questions.yml` is 9,326 lines — every agent action has an audit trail. |
| **Multi-session concurrency** | Institutionalized: commit-first, disjoint file sets, WIP preserved. Not improvised. |
| **CI/CD** | GitHub Actions: lint → typecheck → unit → browser → build on every push. Deploy on main. |

### Issues

| # | Severity | Issue | Detail |
|---|---|---|---|
| P1 | **High** | **Root `AGENTS.md` deleted but still referenced** — README.md (3 places), CONTRIBUTING.md, BACKLOG.md, questions.yml QO9 all point to a root AGENTS.md that no longer exists. Only `packages/design/AGENTS.md` survives. | stale references |
| P2 | **Medium** | **`core.hookspath=~/.claude/githooks` configured but directory doesn't exist** — hooks run only by git's silent fallback. If the dir ever gets created, hook behavior silently changes. | git config |
| P3 | **Medium** | **pre-push hook references non-existent path** — `../scripts/hooks/pre-push` for "agent self-attribution gate" but real dir is `scripts/hooks-local/`. The self-attribution gate likely isn't running. | pre-push hook |
| P4 | **Low** | **No formatter** — no Prettier, no `.editorconfig`. Style consistency relies entirely on ESLint. | tooling |
| P5 | **Low** | **No lint-staged** — pre-commit runs whole-tree lint + typecheck + full design/persistence suites, not staged-diff-only. Slow, can trip on concurrent session state. | pre-commit |
| P6 | **Low** | **`package.json` `repository.url` is empty string**. | package.json |
| P7 | **Low** | **No version tags** — all packages at `0.1.0` despite ~1000 commits and a live deploy. | process |
| P8 | **Observation** | **`refactor` branch is 541 ahead / 3 behind `origin/main`** — no automated merge hygiene. | git state |

---

## Summary Scorecard

| Area | Grade | Notes |
|---|---|---|
| **Architecture** | **A-** | Exceptional governance (AST gates, documented doctrine). One real singleton violation, service layer unbuilt, some large files. |
| **Type Safety** | **A+** | Zero `any`, sum types, exhaustive matches, Zod at boundaries. Among the best I've seen. |
| **Testing** | **A-** | Anti-tautology discipline, external oracles, architecture-as-tests. Weak on persistence unit tests and hook coverage. |
| **Domain Model** | **A** | Lens-over-immutable-record with typed cells is genuinely sophisticated. One documented purity exception. |
| **Error Handling** | **A** | Three separated channels, Vue-swallow-aware fault log with blast-radius-ordered repairs. |
| **Process** | **B+** | Excellent gates and audit trail. Stale AGENTS.md references, broken hook paths, no formatter. |
| **Code Organization** | **B+** | Clean monorepo, good import hygiene. Root clutter from migration, a few oversized files. |

**Overall: This is a well-architected codebase with unusually strong governance for its size. The main risks are the large domain file (3K+ lines), untested persistence layer, and stale process references. The type system and testing discipline are standouts.**
