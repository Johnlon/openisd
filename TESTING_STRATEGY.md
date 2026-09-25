# Testing Strategy

The single authority on how OpenISD is tested. Decisions, rules, patterns, layers, coupling
and the anti-patterns to avoid. This is strategy — not minutes. Historic rulings and handover
logs live in their own files, not here.

`.claude/rules/testing.md` (path-scoped to code/test files) points here; `ARCHITECTURE.md` and `README.md` link it from the docs
graph. `docs/plans/PLAN_COMPONENT_TEST_REORG.md` is the work plan that shaped the naming/decoupling rules.

## Principles

1. **TDD is mandatory for every code change.** Write the failing test first, watch it fail
   for the right reason, implement, watch it pass, then run the domain suite. A failing test
   is information — the code and the spec disagree.
2. **A skip is a fail.** Never delete, skip, weaken or corrupt a test to make the suite green.
   The only legitimate removals: a human ruling in `questions.yml`/spec, a duplicate test, or
   deliberately-unwanted behaviour confirmed by a human. When the UI changed, fix the test to
   match the current UI.
3. **No silent narrowing.** `test.only` is forbidden; an empty run must fail; a
   `--pass-with-no-tests` outcome is a broken gate, not success.
4. **Name files by the object under test** (see Naming). A file named after a skin or a layer
   is an anachronism.
5. **Features are decoupled at the test level.** A test of one component never drives another
   component's UI to reach its assertion. Setup reaches state through the **domain seam**
   (`appState`), not through a sibling feature. The only exception: a test whose intent is to
   verify the coupling in the app itself.
6. **A test ensures its own initial condition.** It switches to the tab/popup it intends.
   Only the test whose purpose is the default may assert the default; nothing assumes what the
   app "happened to load".
7. **Hardcoded expected numbers are live-verified against the running app** — never hand-derived.
8. **UI tests are the expensive tier.** Keep them fast and focused: waits sized to real
   interactions (tens of ms), no bloated timeouts, run in parallel where the box allows, and
   while fixing the failing set never re-run the passing tests. The json reporter persists
   per-test durations so every speed claim is answerable.

## Layers

Three tiers keep the slow, browser-bound surface as small as the connected acceptance story
allows.

| Tier | What | Runner | Where |
|---|---|---|---|
| 1 | Core physics, solvers, serialization | Vitest (node) | `packages/design`, `packages/persistence` |
| 2 | Hooks/composables + component unit tests | Vitest (node) | `packages/ui` (`.test.ts`) |
| 3 | End-to-end acceptance scenarios (real DOM + hooks + engine) | Playwright | `packages/ui` (`.browser.spec.ts`) |

- Decisions belong in composables/hooks, not `.vue` — that keeps most coverage at Tier 2 speed.
  The architecture test enforces "a line in a `.vue` that makes a decision belongs in a composable".
- All UI tests are retained; the Tier-3 acceptance set is a curated subset of them (see below).

## Patterns

- **Domain-seam setup:** `page.evaluate` → `/src/logic/appState.ts` →
  `requireFocusedProject()...set()`, then drive only the object under test via the UI. This is
  how a component test sets up state without coupling to a sibling feature's UI.
- **Tune is its own feature.** Never open the Tune panel to enter driver params for a Box
  test (that couples every Box test to Tune). `tune-panel` owns its own contract: live-edit
  lands immediately, Cancel/✕/Reset semantics, the Q-group completion (Qts → Qes/Qms), the
  Rg / source-loaded Qts interaction, and two-way sync with the project.
- **Runtime-generated fixtures.** `sample-project.owpr` is generated at test time by
  `generateSample.ts` — never edit the JSON by hand; fix the generator. Reference drivers and
  their expected values live in `packages/ui/test/fixtures/reference-drivers.ts`.
- **Wiring tests are physics-agnostic.** Where a test proves "the readout re-renders when the
  domain moves" it compares the rendered number to the live domain cell at the field's display
  precision, rather than pinning a value that drifts when the engine changes.

## Coupling & architecture anti-patterns

Avoid these; each has a gate test where it is enforceable:

- A component that makes a decision instead of delegating to a composable.
- A domain value crossing the component boundary.
- A module with two responsibilities; a global / mutable module scope; casts and `any`.
- A test file that is a grab-bag spanning many objects — split it by object.
- Sibling-feature UI used as setup (see Decoupling).
- Coupling that *is* intended is fine only when tested explicitly as its own contract.

## Naming

A browser-spec file is named after the human-recognisable component it exercises.

| Component (tab/popup) | File |
|---|---|
| Box tab | `box-tab…` |
| Enclosure/Vents tab | `enclosure-tab…` |
| Signal tab | `signal-tab…` |
| Advanced tab | `advanced-tab…` |
| Project tab | `project-tab…` |
| Filters tab | `filters-tab…` |
| Tune panel | `tune-panel…` |
| Options dialog | `options-dialog…` |
| Alignment popup | `alignment-popup…` |
| Driver browser / editor | `driver-browser…`, `driver-editor…` |
| New Project wizard | `new-project-wizard…` |
| Shell structure (layout/narrow) | `shell-layout…`, `shell-narrow…` |

See `docs/plans/PLAN_COMPONENT_TEST_REORG.md` for the current→target rename map.

## Acceptance scenarios

The Tier-3 acceptance set is a curated subset of the UI suite covering the connected journeys:

1. Project creation & driver selection (wizard → browser → pick → project).
2. Driver editor & storage persistence (edit T/S → save → reload → persisted).
3. Enclosure tuning & real-time graph (box type switch → Vb/Fb edits → canvas redraw).
4. File import/export & share link (`.wdr`/`.owdr`/`.wpr`/`.owpr` → share URL → fidelity).
5. Multi-project tab session (focus switch → edit → state isolation).

## Execution

- **Pre-commit:** lint + typecheck + Tier 1/2 unit tests.
- **Pre-push / health check:** the above + Tier-3 acceptance scenarios in parallel.
- Guards: workers are memory-capped (OOM history); `maxFailures` stops a collapsed run from
  manufacturing a total; the no-skips reporter turns a skip into a fail; the json reporter
  records durations on every run.