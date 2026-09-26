# Testing strategy

How OpenISD is tested: the rules, the tiers, the patterns, and what runs when.
`.claude/rules/testing.md` points here.

## Principles

1. **TDD is mandatory for every code change.** Write the failing test first, watch it fail
   for the right reason, implement, watch it pass, then run the domain suite. A failing test
   is information: the code and the spec disagree.
2. **A skip is a fail.** Never delete, skip, weaken or corrupt a test to make the suite green.
   The only legitimate removals: a human ruling in `questions.yml` or a spec, a duplicate test,
   or behaviour a human has confirmed is unwanted. When the UI changed, fix the test to match
   the current UI.
3. **No silent narrowing.** `test.only` is forbidden; an empty run must fail; a
   `--pass-with-no-tests` outcome is a broken gate, not success.
4. **Name files by the object under test** (see Naming). A file named after a skin or a layer
   is wrong.
5. **Features are decoupled at the test level.** A test of one component never drives another
   component's UI to reach its assertion. Setup reaches state through the **domain seam**
   (`appState`), not through a sibling feature. The exception is a test whose intent is to
   verify the coupling in the app itself.
6. **A test ensures its own initial condition.** It switches to the tab or popup it intends.
   Only the test whose purpose is the default may assert the default; nothing assumes what the
   app happened to load.
7. **Hardcoded expected numbers are verified against the running app**, never hand-derived.
8. **UI tests are the expensive tier.** Keep them fast and focused: waits sized to real
   interactions (tens of ms), no inflated timeouts, parallel where the machine allows. While
   fixing a failing set, do not re-run the passing tests. The json reporter records per-test
   durations, so every speed claim can be checked.

## Tiers

| Tier | What                                             | Runner        | Where                                     |
|------|--------------------------------------------------|---------------|-------------------------------------------|
| 1    | Physics, solvers, domain, serialisation          | Vitest (node) | `packages/design`, `packages/persistence` |
| 2    | Hooks and logic                                  | Vitest (node) | `packages/ui` (`*.test.ts`)               |
| 3    | The app in a real browser (DOM, hooks, engine)   | Playwright    | `packages/ui` (`*.browser.spec.ts`)       |

Decisions belong in hooks (`*-hooks.ts`), not in `.vue` files, so most coverage runs at Tier 2
speed. The architecture tests enforce the layering that makes this possible:

- `packages/ui/test/ui/architecture.test.ts`: every import points down the layers; a component
  imports no value from the domain; services export factories, not instances or mutable
  bindings; only the approved stores hold state; only licensed logic modules construct an
  `OpenISDDriver`.
- `packages/design/test/architecture-*.test.ts`: no casts, no globals, the engine boundary,
  `OpenISDProject` holds exactly three record fields, and records match `openisd.json`.

## Goldens and coverage

- `packages/design/test/engine/golden.test.ts` compares engine output with committed fixtures
  in `packages/design/test/fixtures/golden/`.
- `packages/design/test/winisd/` compares OpenISD with projects WinISD itself saved (`.wpr`);
  see [RESEARCH.md](RESEARCH.md#methods) for how those files were captured by driving WinISD
  under wine.
- `npm run coverage:design` reports coverage for `packages/design`. The target is 100% for the
  engine and domain.

## Patterns

- **Domain-seam setup:** `page.evaluate` → `/src/logic/appState.ts` →
  `requireFocusedProject()...set()`, then drive only the object under test through the UI.
- **Tune is its own feature.** Never open the Tune panel to enter driver parameters for a Box
  test. `tune-panel` specs own the panel's contract: live edits, Cancel/✕/Reset, the Q-group
  completion and two-way sync with the project.
- **Generated fixtures.** `sample-project.owpr` is generated at test time by
  `packages/ui/test/fixtures/generateSample.ts`; fix the generator, never the JSON. Reference
  drivers and their expected values are in `packages/ui/test/fixtures/reference-drivers.ts`.
- **Wiring tests are physics-agnostic.** A test that proves "the readout re-renders when the
  domain moves" compares the rendered number with the live domain value at the field's display
  precision, rather than pinning a value that drifts when the engine changes.

## Anti-patterns

Each has a gate test where it can be enforced:

- A component that makes a decision instead of delegating to a hook.
- A domain value crossing the component boundary.
- A module with two responsibilities; mutable module scope; casts and `any`.
- A test file that spans many objects: split it by object.
- Sibling-feature UI used as setup.
- Intended coupling is fine only when it is tested as its own contract.

## Naming

A browser spec is named after the component a user would recognise: `box-tab…`,
`signal-tab…`, `tune-panel…`, `options-dialog…`, `driver-editor…`, `new-project-wizard…` and
so on. The rename of older files is tracked in
[docs/plans/PLAN_COMPONENT_TEST_REORG.md](docs/plans/PLAN_COMPONENT_TEST_REORG.md).

## What runs when

| When        | Runs                                                                                  |
|-------------|---------------------------------------------------------------------------------------|
| Pre-commit  | Lint, typecheck, Tier 1 and 2. A commit of `.md` files only runs lint and typecheck.  |
| Pre-push    | `npm run ci`: lint, typecheck, then every Tier 1, 2 and 3 test. Doc-only pushes run lint and typecheck. |
| `npm test`  | Every Vitest test, then every browser spec.                                           |

Guards: Playwright workers are memory-capped; `maxFailures` stops a collapsed run early; the
no-skips reporter turns a skip into a failure; the json reporter records durations on every run.
