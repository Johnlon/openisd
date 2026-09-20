# Plan: component test reorg

**Status:** proposal (awaiting scope decision)
**Companion:** this renames/restructures `packages/ui/test/ui/*.browser.spec.ts` around the
**object under test**, not the skin it renders in.

## Naming rule (new convention)

Name a browser-spec file after the **visual component / object under test** — the tab or the
popup whose behaviour it exercises.

- `box-tab`, `enclosure-tab`, `signal-tab`, `advanced-tab`, `project-tab`, `filters-tab`
- `tune-panel`, `options-dialog`, `alignment-popup`, `box-losses-popup`, `driver-browser`,
  `driver-editor`, `new-project-wizard`
- `winisd-shell` / `shell-layout` / `shell-narrow` for the shell's own structural behaviour

Ban the `original` prefix: it names the shell, not what is tested — an anachronism. No new
file is named after a skin; existing skin-named files are renamed (below).

## Structural rules (already agreed)

- A test must **ensure its own initial condition** (e.g. set the box-type selector to Closed
  before asserting sealed behaviour; never assume what the app "happened to load").
- Sealed/box-tab tests drive **only the Box pane**: Closed selector, Volume, loss-model,
  Alignment popup, losses popup. They never open the Tune panel — Tune is a separate,
  cross-cutting feature with its own file (`tune-panel`).
- Hardcoded expected numbers are **live-verified against the running app**, never hand-derived.
- A skipped/deleted test is a failure; renames are mechanical and must not drop coverage.

## Prohibited pattern: Tune-as-setup (coupling)

Opening the Tune panel just to enter driver T/S params, then asserting the Box pane, couples
every Box test to the Tune UI — a Tune change breaks unrelated Box tests. **Banned.**

Non-coupled alternative: set driver params through the **domain seam** (`page.evaluate` →
`/src/logic/appState.ts` → `requireFocusedProject().driver.spec.woofer.*.set()`), then drive
only the object under test via the UI. Wrap it in a `seedDriverSpec(page, {...})` helper.

- **Affected today:** `app` (sealed/vented/bandpass blocks), `sealed-fsc-winisd-golden` use
  Tune as setup — rewrite them to the domain seam.
- **Re-verify every hardcoded number** after the switch: the Tune-typing path runs the
  Q-group/Rg completion (typing Qts recomputes Qes; Signal Rg loads source-loaded Qts), which
  the domain seam skips, so expected values may shift.
- **Tune owns its own tests.** The Q-group / Qes-from-Qts / Rg (source-loaded Qts) completion
  interactions are `tune-panel` concerns, asserted there — never implicitly via Box tests.

## Decoupling rule (general, not just Tune)

- Tests are named and organised around **human-recognisable features/components** of the app
  (the tab or popup under test) — see the naming rule.
- **Features must not depend on each other at the test level.** A test of one component never
  drives another component's UI to reach its assertion (no Tune-as-setup, no "open the Box tab
  to set up the Signal test", etc.). Each feature file is self-sufficient.
- The **only** exception: coupling is allowed when the test's **intent is to verify the
  coupling in the app itself** (e.g. "Tune→Box sync" is deliberately a test of both panels'
  wiring, and lives in the file that owns that contract).

## Tune feature — distinct test file (`tune-panel`)

The Tune panel is a cross-cutting what-if editor over every project tab. Its file owns:
- live-edit lands immediately; Cancel/✕ discards; Reset discards and stays open
- Q-group completion: entering Qts recomputes Qes/Qms; the Q-group staleness rules
- Rg / source-loaded Qts interaction (Signal tab feeds the loaded Qts)
- edits sync **both ways** with the underlying project — Tune→Box and Box→Tune
  (see the open bug below)

### Known bug to pin first (open)

**One-way sync:** editing a field in the Tune panel (e.g. Fb) updates the Box tab, but editing
the same field on the Box tab does **not** update the Tune panel — the tuner fails to
subscribe to the project's live fields. Write the failing test first, then fix the tuner's
binding (local copies vs live-domain binding), then cover the rest of the tune contract.

## Current → target map

| Current file | Target file(s) | Notes |
|---|---|---|
| `original-skin` | **split** → `winisd-shell`, `box-tab`, `signal-tab`, `advanced-tab`, `project-tab`, `filters-tab`, `tune-panel`, `options-dialog`, `new-project-wizard`, `driver-browser` | grab-bag; each block becomes its own object file |
| `original-layout` | **split** → `shell-layout`, `alignment-popup` | layout bits vs the Alignment open/cancel test |
| `original-narrow` | `shell-narrow` | narrow-viewport layout |
| `original-tuning-target` | `tuning-target` | Box + enclosure tuning fields (Fb/Fh/Fp) |
| `original-loss-mode-selector` | `box-tab-loss-model` | loss-model selector on the Box tab |
| `sealed-readout-wire` | `box-tab-sealed-readout-wire` | Box-pane Fsc/Qtc track live domain |
| `sealed-fsc-winisd-golden` | `box-tab-sealed-golden` | exact WinISD parity values |
| `sealed-tab-display-values` | `box-tab-display-values` | sealed project display + derived volume |
| `app` | `app-wiring` | smoke: shell + sealed + vented + bandpass + share |

## Missing coverage to add during the reorg

The sealed-box feature wants these (all Box-pane only, Tune-free):

1. **Loss-model change moves Fsc/Qtc.** Lossless ↔ Conventional Lossy ↔ WinISD Lossy must
   give distinct readouts for the same driver + volume (conventional folds Ql/Qa into Qtc,
   Fsc fixed; WinISD-lossy moves Fsc too). *Probe found all three identical today — resolve
   the bug before pinning.*
2. **Alignment OK writes the computed volume.** Choose a different alignment → OK → the
   Volume field becomes the alignment-derived value for the loaded driver.
3. **Alignment Cancel leaves state untouched.** Open → change → Cancel → volume and readouts
   unchanged, modal dismissed.
4. **Volume → Fsc/Qtc step-through.** Reference driver at a volume, then change volume and
   assert the new numbers; then set losses and assert the reaction (partially covered by
   `sealed-readout-wire` / `app` today).

## Execution notes

- Renaming spec files breaks the failing-test runner's per-file paths (`build/failing-tests.json`,
  `build/rerun-results.json`) — regenerate the tracker after the move, before re-running.
- Grab-bag splits are pure moves; do not reorder/weaken assertions while moving.
- Commit the rename as its own step (stage by filename), then add the new coverage.

## Task: consolidated `TESTING_STRATEGY.md`

As part of this work, write a single consolidated testing-strategy doc at the repo root and
wire it into the docs graph:

- **Content = strategy, not historic minutes.** Decisions, rules, patterns, layers, coupling,
  architecture anti-patterns, and the naming rule. No session dates, no "the human ruled on
  date X", no handover logs.
- **Fold in (stripping the history):** `TESTING_GOAL.md` (tiers, acceptance-scenario set),
  root `CLAUDE.md` (TDD-mandatory, A-skip-is-a-fail, fixtures rules), `openspec/project.md`
  §Testing Strategy, `ui-bugfix.md` creed (ensure-initial-condition, tab-switch, no deletion,
  workers/parallelism), `docs/plans/PLAN_COMPONENT_TEST_REORG.md` (naming + decoupling), and the
  Playwright-config gates (no `test.only`, no-skips reporter, `maxFailures`, json durations).
- **Link it into ARCH + index:**
  - `ARCHITECTURE.md` doc-table row "Dev workflow, ports, testing strategy" currently points at
    a **non-existent root `AGENTS.md`** and `openspec/project.md` — repoint it to
    `TESTING_STRATEGY.md` (and remove the dangling ref).
  - `README.md` (index): add a "Testing" section linking `TESTING_STRATEGY.md`.
  - Fix the second dangling ref (`ui-bugfix.md` cites `packages/ui/test/AGENTS.md`, which does
    not exist).
- **Junk to eliminate:** empty/superseded docs (`TESTING_GOAL.md` becomes redundant once folded
  in), broken AGENTS.md links, and any remaining minutes-style files after the fold.