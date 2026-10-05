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
4. **Name files by the object under test** (see Naming). A file named only after a skin or a
   layer is wrong; the skin prefix stays, the rest names what is tested (John, 2026-10-04).
5. **Features are decoupled at the test level.** A test of one component never drives another
   component's UI to reach its assertion. Setup reaches state through the **domain seam**
   (`appState`), not through a sibling feature. The exception is a test whose intent is to
   verify the coupling in the app itself.
6. **A test ensures its own initial condition.** It switches to the tab or popup it intends.
   Only the test whose purpose is the default may assert the default; nothing assumes what the
   app happened to load.
7. **Hardcoded expected numbers are verified against the running app**, never hand-derived.
8. **UI tests are the expensive tier.** Keep them fast and focused: waits sized to real
   interactions (tens of ms), parallel where the machine allows (timeout limits are a hang
   guard, see "Timeouts and hangs", not a pace to aim at). While
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

- `packages/ui/test/architecture/architecture.test.ts`: every import points down the layers; a component
  imports no value from the domain; services export factories, not instances or mutable
  bindings; only the approved stores hold state; only licensed logic modules construct an
  `OpenISDDriver`.
- `packages/design/test/architecture-*.test.ts`: no casts, no globals, the engine boundary,
  `OpenISDProject` holds exactly three record fields, and records match `openisd.json`.

## Goldens and coverage

- `packages/design/test/engine/sweep-golden-master.test.ts` compares engine output with committed fixtures
  in `packages/design/test/fixtures/golden/`.
- `packages/design/test/winisd/` compares OpenISD with projects WinISD itself saved (`.wpr`);
  see [RESEARCH.md](RESEARCH.md#methods) for how those files were captured by driving WinISD
  under wine.
- `npm run coverage:design` reports coverage for `packages/design`. The target is 100% for the
  engine and domain.

## Where a test goes

One file tests one object, and its folder is the layer of that object.

| Folder                              | Holds                                                                  |
|-------------------------------------|------------------------------------------------------------------------|
| `packages/design/test/engine/`      | formulas, solvers, the sweep, WinISD parity of engine output           |
| `packages/design/test/domain/`      | OpenISD objects: project, box, driver, cells, compat-switch plumbing   |
| `packages/design/test/fields/`      | field registry, limits, unit groups, display precision, formatting     |
| `packages/design/test/chart/`       | axes, plot data, chart errors                                          |
| `packages/design/test/winisd/`      | `.wdr` / `.wpr` formats and converters                                 |
| `packages/design/test/architecture-*` | design-package gates                                                 |
| `packages/persistence/test/`        | one file per repo (`projectRepo`, `viewStateRepo`, `myDriverRepo`, ...) |
| `packages/ui/test/logic/`           | `src/logic` modules (`appState`, `ventGroup`, `provenance`, ...)    |
| `packages/ui/test/hooks/`           | one file per `*-hooks.ts`                                              |
| `packages/ui/test/ui/`              | browser specs, one per component; component SFC tests                  |
| `packages/ui/test/architecture/`    | UI gates and every template/source scan                                |
| `packages/ui/test/scripts/`         | tests of `scripts/*.mjs` build tooling and `vite.config.js`            |

A recorder or screenshot writer is not a test: it lives in `scripts/`. A spec never writes into
the tracked tree.

## Patterns

- **Shape of a file:** one top-level `describe` named after the object; nested `describe`s per
  behaviour. Titles state the behaviour ("clearing V returns the pair to 1 W"), never a ticket,
  bug or plan id.
- **Variants are a table:** the same check per box type, filter type or skin row is one
  `it.each` / loop, not one file or one copy per variant.
- **Domain-seam setup:** `page.evaluate` → `/src/logic/appState.ts` →
  `requireFocusedProject()...set()`, then drive only the object under test through the UI. Helpers:
  `packages/ui/test/fixtures.ts` (`openAProject`, `focusedBoxVolume`, `setFocusedBoxVolume`),
  `fixtures/focusedProjectSeam.ts` (`setFocusedBoxType`, `renameFocusedProject`). The wizard is
  walked only in the wizard specs.
- **Mobile specs** force the skin with `forceMobileSkin` (`fixtures/mobileSkin.ts`), never an inline
  storage script.
- **Tune is its own feature.** Never open the Tune panel to enter driver parameters for a Box
  test. `tune-panel` specs own the panel's contract: live edits, Cancel/✕/Reset, the Q-group
  completion and two-way sync with the project.
- **Lowest layer that proves it** (`.claude/rules/tdd.md`). A browser spec proves a seam is wired;
  it does not re-check maths a unit test already pins.
- **WinISD bug and option switches:** the `domain/winisd-*` file tests the switch (default, saved); the `engine/` file tests what the switch does to the numbers. Not both in both.
- **Generated fixtures.** `sample-project.owpr` is generated at test time by
  `packages/ui/test/fixtures/generateSample.ts`; fix the generator, never the JSON. Reference
  drivers and their expected values are in `packages/ui/test/fixtures/reference-drivers.ts`.
- **Wiring tests are physics-agnostic.** A test that proves "the readout re-renders when the
  domain moves" compares the rendered number with the live domain value at the field's display
  precision, rather than pinning a value that drifts when the engine changes.
- **Locators:** exact title or role locators (`getByTitle('Open project', {exact: true})`); no
  hard-coded counts of toolbar buttons or menu rows unless the count is the thing under test.

## Anti-patterns

Each has a gate test where it can be enforced:

- A component that makes a decision instead of delegating to a hook.
- A domain value crossing the component boundary.
- A module with two responsibilities; mutable module scope; casts and `any`.
- A test file that spans many objects: split it by object.
- Sibling-feature UI used as setup. Intended coupling is fine only when it is tested as its own
  contract.
- **A test that defines what it asserts:** logic re-implemented inside the test, or CSS rules
  written as strings in the test. It tests nothing; import the real module.
- **A test of a test helper:** asserting a mock factory's own defaults.
- **The same behaviour pinned twice at the same layer:** keep the stronger test, remove the other.
- A file named after a layer ("wiring", "logic", "app", "advanced"), a bug, a ticket or a
  behaviour sentence ("tab-scroll", "blur-must-notify").

## Naming

A browser spec is named after the component a user would recognise: `box-tab…`,
`signal-tab…`, `tune-panel…`, `options-dialog…`, `driver-editor…`, `new-project-wizard…` and
so on. There are two skins, so a component that exists in both keeps its skin prefix:
`original-box-tab…`, `mobile-box-tab…`. The prefix says which skin; the rest says what is
tested. A component shared by both skins (one `.vue` used by both) carries no prefix. Unit
tests are named after the module or domain object (`ventGroup.test.ts`, `projectRepo.test.ts`,
`vent-length.test.ts`).

## What runs when

| When        | Runs                                                                                  |
|-------------|---------------------------------------------------------------------------------------|
| Pre-commit  | Lint, typecheck, Tier 1 and 2. A commit of `.md` files only runs lint and typecheck.  |
| Pre-push    | `npm run ci`: lint, typecheck, then every Tier 1, 2 and 3 test. Doc-only pushes run lint and typecheck. |
| `npm test`  | Every Vitest test, then every browser spec.                                           |

Guards: Playwright workers are memory-capped; `maxFailures` stops a collapsed run early; the
no-skips reporter turns a skip into a failure; the json reporter records durations on every run.

## Timeouts and hangs

A test that keeps making progress is never killed. Only a stuck one fails. (John, 2026-10-04.)

- **Playwright:** the per-step limits are the guard. Each `expect` and each action gets
  20 s; each navigation (`page.goto`, reload) gets 60 s, because a page load is what stalls first
  when other sessions load the machine (`playwright.config.js`; John, 2026-10-04). A passing step returns the moment its condition
  holds, so the long limit costs nothing on green; it stops a spec flickering red when other
  sessions load the machine. A step stuck past its limit fails and names itself. There is no
  whole-test limit (`timeout: 0`): it cannot tell progress from a hang, so it would kill a test
  that is still moving.
- **Vitest:** no per-test limit either (`testTimeout: 0`), for the same reason, in the pre-commit
  gate too. The gate runs vitest through `quiet-test.sh`, so the idle watchdog guards it.
- **Stuck runs: the idle watchdog in `scripts/quiet-test.sh`.** A run that keeps writing output is
  making progress and is left alone. If its log does not grow for 180 s (`OPENISD_IDLE_LIMIT_S`),
  every node process in it writes a diagnostic report to `build/test-reports/`, the run is
  stopped, and the exit code is 124 with a `STALLED` line in the log.
- **Finding what is stuck, not just that something is:**

  | Tool                                                            | Use                                                                                                                                                                                        |
  |-----------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
  | `blocked-at` (vitest setup `scripts/test-setup/blocked-at.mjs`) | Prints the stack where the event loop was held longer than 1 s. Report only, never fails a test. Off with `OPENISD_BLOCKED_AT=0`; threshold `OPENISD_BLOCKED_AT_MS`. It reports once the loop frees, so a loop that never ends is not reported. |
  | `kill -USR2 <pid>` on a run started through `quiet-test.sh`     | Writes a node diagnostic report (JS stack, open handles) to `build/test-reports/`. Works on a process waiting on something that never finishes; does not work on one spinning in a sync loop. |
  | `hanging-process` vitest reporter                               | Names whatever stops a finished run from exiting.                                                                                                                                          |
  | Playwright trace viewer                                         | The last action before a stuck browser step.                                                                                                                                               |

  For a sync spin that never ends, attach `node --inspect`.

## Compatibility suite

Rare, selective checks outside the pre-commit suite: OpenISD consistency (a value loaded from a
`.wpr` vs entered by hand: `bash scripts/compat.sh --list`), WinISD consistency (the same two routes
in the real WinISD under Wine), and OpenISD vs WinISD compat (parity register). See
[`packages/design/compat/README.md`](packages/design/compat/README.md).
