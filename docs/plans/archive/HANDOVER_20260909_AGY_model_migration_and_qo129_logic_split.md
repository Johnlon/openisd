# Handover to AGY — finish the model→design migration, then the QO129 logic-split

Branch: `refactor`. Health check target: `bash scripts/health-check.sh` green — no skips, no
ignores, no excluded specs.

A second Claude session (pid 771702, "openisd-66") is live on this tree in **plan mode** — it
has written nothing to the repo, only `questions.yml` entries. It built the QO129 step plan
recorded in the ledger. Do not sweep its future writes into your commits; it will begin in
`ui/` and `logic/` and take `persistence/` only after this session's batches are committed.

---

## 0. John's rulings that govern everything below

| # | Ruling (verbatim where quoted) | Source |
|---|---|---|
| R1 | "the code below the ui MUST be 100% covered with high quality test SO THAT we dont have to ui test literally every ui interaction/combination" | John, 2026-09-09 |
| R2 | "I need it really stripped out so that the logic can be tested without a browser at all — then a relatively small number of ui tests can check the basic scenarios fully work but most of the test cases can run with the logic components mocked" | John, 2026-09-09 |
| R3 | "stop massaging bad code — do the split then optimise the tests by removing duplication and pointless steps — as well as doing more fast multithreaded unit testing and fewer UI oriented tests for anything that can be unit tested — then we have targeted ui tests to prove the main features work" | John, 2026-09-09 |
| R4 | Test optimisations include NOT restarting the browser per field on the tuner or the driver editor — run through a script or probes on the form that fly quickly by | John, 2026-09-09 |
| R5 | "incorporate your work into 129" — the UI-test repetition/runtime review is not a separate refactor; QO129 owns it | John, 2026-09-09 |
| R6 | Sequencing: **do the split now.** Do not keep fixing stale browser tests against the old structure first. | John, 2026-09-09 |

R6 changes the order of work. The model→design migration (§1) still has to land — the app does
not typecheck-clean-and-run without it — but the browser-test cleanup that was queued behind it
is now folded into QO129 (§3) and done as part of the split, not before it.

---

## 1. Model→design migration — still required, land it first

`packages/model` is deleted (commits `68223e3` human, `ba7babb` AGY). AGY committed
stubbed/broken code as done. The full plan with every ruling and file is in
**`docs/plans/archive/PERSIST_ISSUES.md`** and the plan file
`~/.claude/plans/the-plan-has-moved-ticklish-thacker.md` (copied verbatim into §1a below so it
survives). `npx vue-tsc -p packages/ui --noEmit` currently exits 0 — this session got the
typecheck clean — but the stubbed helper bodies in `driverBrowsingState.ts` are still stubs
(`const brand = ''`, `return false`), so the picker is not actually wired.

### 1a. What is left (from the plan file, unchanged)

1. **New `packages/ui/src/logic/fileImportExport.ts`** — one file holds every driver/project
   file operation (`.wdr` `.wpr` `.owdr` `.owpr`). Plain exported functions, `engine` from
   `./appState.js`, no factory. Functions and bodies are tabulated in the plan file §1. No
   `as any`; every `errors` array returned, never dropped. `.owpr` *write* stays on
   `projectRepo.saveToFile`. **Note: `fileImportExport.ts` already exists in the tree (staged)
   — verify its contents against the plan table before building on it; it may be a stub.**
2. **Rewire `useApplicationIO.ts`** to call those functions; drop the direct
   `@openisd/design/winisd` import, inline `TextEncoder`/`.toWdrIni()`/`stringify`, all three
   `as any`.
3. **`OpenISDProject.loadDriver(source: OpenISDDriver): void`** in
   `packages/design/domain/openisdDomain.ts` — delegates to `this.driver.update(source)`;
   throws on an embedded driver (`instanceof OpenISDDriverEmbedded`). TDD in
   `packages/design/test/domain.test.ts` beside the deep-copy tests.
4. **Un-stub `driverBrowsingState.ts`** — kill `FileEntry` / `Preview`. A bundled driver and a
   My Driver are both just `OpenISDDriver`; the pool is `OpenISDDriver[]`. New driver
   accessors on `OpenISDDriver` (`dataSource(role)`, `series`, `sku`, `productImage`,
   `description`, `surroundMaterial`, `nominalSizeCm()`). Move `specSummaryOf`,
   `previewSpecsOf`, `previewTextOf`, `matchesCriteria`, `PreviewSpec`, `SearchCriteria`,
   `driverHasDqIssues` into `driverDisplay.ts`. Full field-by-field list in the plan file §4.
5. **`driverRepo.ts`** — `bundledEntries(): FileEntry[]` → `bundledDrivers(): OpenISDDriver[]`.
   Delete `FileEntry`, the commented-out `Preview`/`previewOf`/`matchesCriteria`/
   `parseWdrLoose`/`normaliseDate` block, the `name`/`path`/`sourceName` assembly.
6. **`driverSelection.ts`** — retype `PoolEntry`/`selectDriver`/`editMyDriver`/
   `editOverviewDriver` off `FileEntry` onto `OpenISDDriver`. The `openedAs: ''` gap (a My
   Driver edit can't name its own storage entry) is a **behaviour change, out of scope** — leave
   it, note it to John.
7. **`DriverBrowserWinisd.vue`** — read row/driver, not `FileEntry`. Delete the `.stag`
   source-tag span + CSS, the `.ddate` dated-file span + CSS, the `previewData.source` block.
   `:key="driverKey(f)"` → `:key="driverId(d)"`. **This file is 981 lines and is a QO129 target
   too (§3) — coordinate the two passes; do the migration retype first, the logic-strip
   second.**
8. **`projectRepo-boxtype.test.ts`** — wrap the fixture in the session envelope
   `{ label, saved, edited }` (`openisdSchema.ts:697-701`). Loader is correct; test is stale.
9. **~10 scattered test typecheck errors** — `driver-editor-units.test.ts` (4),
   `bundle-drivers-disposition.test.ts` (2), `chart-types.test.ts` (1), `round-trip-gate.test.ts`
   (1), `gen-scenarios.ts` (1), `main.ts` (1). Fix stale-API renames; list anything needing a
   decision.

Deleted outright per John (every reference goes): source name / bundle identity
(`sourceName`/`sourceKey`/`sourceUrl`/`shortSource`/source tag/"from X" line); dated-file
grouping (`isLatest`/`isOlder`/`normalisedDate`/`normaliseDate`/`ditem-latest`/`ddate`/
newer-older sort). Loose `.wdr` preview is dropped.

### 1b. Junk cleanup — confirm with John first, do not do unilaterally

~40 untracked `fix_*.py` / `*.txt` at repo root (AGY session scratch). Propose moving to
`build/` (gitignored) or list for John to confirm deletion. `package.json` /
`package-lock.json` are modified — `git diff` and report, do not revert without a ruling.

---

## 2. What this session already did (staged, NOT committed)

Branch `refactor`. Everything is `git add`-ed by a write hook; **nothing is committed**. The
staged set is large and mixes this session's work with the peer's migration commits — stage by
name, never `git add -A` / `git commit -a`.

### 2a. Stale-fixture triage — the browser suite in three server-clean batches

Ran the suite as three batches (one-suite rule; the 1.4-hour single process is what a memory
kill hits). All server-clean (0 `ERR_CONNECTION_REFUSED` — the vite-death instrument in
`fixtures.ts` + `maxFailures: 180` in `playwright.config.js` held).

| Batch | Command | Before | After this session's fix |
|---|---|---|---|
| 1 | `npx playwright test packages/ui/test/logic --workers=1` | 15 failed / 44 passed | not re-run — `consistency-dq` fix unverified |
| 2 | `npx playwright test packages/ui/test/persistence packages/ui/test/db --workers=1` | 46 failed / 9 passed | **15 failed / 29 passed** (verified 2026-09-09) |
| 3 | `npx playwright test packages/ui/test/ui --workers=1` | — | 73 failed / 78 passed (1.4h) |

**Batch 2 verified — the seed-shape fix collapsed 31 of 46.** Remaining 15, none of which are
the seed-shape bug. This session investigated each group (no `list`-reporter stack traces were
kept, so classification is from reading the current source against the spec):

| Spec:line | ×N | Cause | Fix difficulty |
|---|---|---|---|
| `persistence/driver-favorites.browser.spec.ts:47` | 2 | Real app bug — a starred BUNDLED driver loses its star on reload. `bugs/BUG_20260909_a_starred_bundled_driver_loses_its_favourite_mark_on_reload.md`. The two sibling favourites tests (`:66`, `:91`) pass; they never reload. | App bug — investigate the favourites store's storage key and identity function for bundled rows. |
| `persistence/driver-search-interactive.browser.spec.ts:28,60` | 4 | **Not a stale premise** — this session already repointed both to `seedMyDrivers.js` with real brand+model records, so "no name" is a misnomer now. They fail at line 44/72 `page.getByRole('button', { name: /Browse \/ Select/ })` — that control no longer exists. It is now `<div class="tb-btn" title="Manage Drivers — browse the library.">` (`OriginalShell.vue:820`). | **Trivial.** Swap both call sites to `await page.locator('[title*="librar" i]').first().click();` — exactly how the passing `my-drivers.browser.spec.ts` opens the picker (`my-drivers.browser.spec.ts:105`). NOT DONE — John scoped this turn to the handover only. |
| `persistence/driver-selection.browser.spec.ts:182,202` | 4 | Confirmed the `openedAs: ''` gap (§1 item 6). Both tests assert "editing a saved driver rewrites its entry"; `editMyDriver` cannot name its storage entry, so the rewrite is a no-op and the saved row keeps its old model. | Out of scope — behaviour change awaiting John's ruling. |
| `persistence/my-drivers-failures.browser.spec.ts:89,128,153` | 6 | **Selectors still exist** — `.my-storage-modal`, `.my-export-raw`, `.my-delete-all`, `.my-broken-row` are all in `DriverBrowserWinisd.vue:83-107`; `.de-rename-panel` is in `DriverEditorModal.vue:979`. A corrupt bucket still routes to `{ kind: 'unreadable' }` via `savedEntries.ts:157` → the modal condition `myDriversRead.kind === 'unreadable'` still fires. So the failure is NOT stale markup. `:128` exercises the same save→rewrite path as the `driver-selection` pair above — likely the same `openedAs` gap. `:153` is the mint-fresh-on-import rule in `driverBrowsingState.loadFromDisk`. `:89` is the export-and-disarm flow. | **Unclassified** — needs a targeted run for the real assertion failures. A triage run was launched this session (`packages/ui/test/persistence/my-drivers-failures.browser.spec.ts` + `driver-search-interactive` alone); its result is in `scratchpad/triage.log` if the session is still alive, otherwise re-run. |

### 2b. The two root causes and the fixes made

**Batch 1 — one shared fixture, contradictory needs.**
`bugs/BUG_20260909_one_shared_owpr_fixture_cannot_satisfy_tests_with_opposite_driver_needs.md`.
33 specs share `packages/ui/test/fixtures/sample-project.owpr`, whose driver has only 5 fields.
Three specs need mutually exclusive driver states: `consistency-dq` needs a COMPLETE driver
(so a consistency group reconciles before the test breaks it); `driver-editor-mandatory` needs
a deliberately INCOMPLETE one; `tune-panel-fields` needs Qts/Qes/Qms present.

- **Done:** built `packages/ui/test/fixtures/complete-driver-project.owpr` (Qes derived from
  Qts/Qms so the trio reconciles; Mms/Cms/BL deliberately absent so the solver derives them
  and consistency holds by construction). Repointed
  `packages/ui/test/logic/consistency-dq.browser.spec.ts` at it. **NOT re-run — verify.**
- **Still to do:** `driver-editor-mandatory.browser.spec.ts` (6) needs its own
  deliberately-incomplete `.owpr`, missing exactly the fields each test asserts are reported
  missing. `tune-panel-fields.browser.spec.ts` (5) needs a Qts/Qes/Qms fixture AND the
  removed-API fix (`s.driverCell`, `s.state.P.Vb` no longer exist —
  `bugs/BUG_20260909_tune_panel_tests_call_appState_APIs_that_no_longer_exist.md`); gated on
  QO121. `tune-panel-shots.browser.spec.ts` (1) — regen baseline once the panel renders.

**Batch 2 — 7 specs seeded the pre-migration localStorage shape.**
`bugs/BUG_20260909_my_drivers_specs_seed_the_pre_migration_localstorage_shape.md`.
`myDriverRepo` now reads a versioned uuid-keyed envelope
(`{ schema: 1, entries: [{ uuid, record: <OpenISDDeviceJson> }] }`, owned by
`packages/persistence/src/repos/savedEntries.ts`). The 7 specs seeded a flat
`{ brand, model, Fs }` literal — not a conforming record — so My Drivers loaded empty.

- **Done:** built `packages/ui/test/fixtures/seedMyDrivers.ts` — the ONE place that knows the
  envelope shape. Exports `MY_DRIVERS_KEY`, `myDriversJson(SeedDriver[])`, and `deviceRecord`
  (for specs that hand-build a bucket). Each spec still declares its own driver values inline —
  `AGENTS.md` "tests construct their own data" is untouched; the module owns only the
  mechanism. This is the same seam the peer's QO129 step 1 cites as precedent for a shared
  `openAProject` fixture.
- **Repointed 7 specs** to it: `driver-scope-chip`, `my-drivers-filtering`, `my-drivers`,
  `driver-search-interactive`, `driver-summary-winisd`, `driver-selection`,
  `my-drivers-failures` (all `packages/ui/test/persistence/*.browser.spec.ts`).

### 2c. QO134 — the Tune panel hoist (code done, one spec fixed)

John's ruling: "make this popup a child of a higher component so that it is independent of the
box view from which it was opened."

- **Done:** moved `<OgTune v-if="presentationState.editDriver" />` out of
  `OriginalShell.vue` and into `App.vue`, inside `v-if="project"` beside `DriverEditorModal`
  (both global driver overlays). Removed the now-unused `OgTune` import from `OriginalShell`;
  left a comment pointing to the new home. `OgTune` takes no props and reads
  `useFocusedProject()`, which `App.vue` provides. The `presentationState.editDriver` state and
  its refresh-persistence watchers stay in `OriginalShell` — they sync global state,
  location-independent. `vue-tsc` + `eslint` clean.
- **Test result:** `tune-panel-independent-of-box-view.browser.spec.ts:45` (tab change) passed.
  `:26` (box-type change) timed out — NOT the hoist. The spec targeted `#boxtype`, an id that
  does not exist; the box-type `<select>` is `id="og-box-type"` (`OriginalShell.vue:971`).
  Fixed both call sites in the spec.
  `bugs/BUG_20260909_tune_panel_independence_test_uses_a_boxtype_selector_id_that_does_not_exist.md`.
- **To do:** re-run that spec, expect both green, then
  `python3 ~/.claude/bin/inbox.py close QO134 -` with John's ruling verbatim.

### 2d. Earlier this session (also staged)

Empty-state file open: `App.vue` got an `emptyStateFileInput` ref + `openFileFromEmptyState` +
`<input ref="emptyStateFileInput" type="file" accept=".owpr,.wpr,.owdr,.wdr,.json">`.
`empty-state-open-file.browser.spec.ts` passes.
`bugs/BUG_20260909_no_project_can_be_opened_from_a_file_when_none_is_open.md` — FIXED.

---

## 3. QO129 — the logic-split (the main job, per R6 do it now)

The peer session recorded a three-step plan in `questions.yml` QO129. Read it in full with
`python3 ~/.claude/bin/inbox.py get QO129`. Summary and the measured baseline below; the
ledger entry is authoritative.

### 3a. Measured baseline (this session, not estimated)

- `packages/ui/test/ui/original-layout.browser.spec.ts`: 9 tests, **2.1 min** wall clock, 5
  workers. ~14 s/test. **4 of those 9 were already RED** (chart level-line, project-row,
  chart-maximise) — unrelated to this work, must not be silenced by it.
- 36 `*.browser.spec.ts` files, ~293 browser tests. 45 vitest `*.test.ts` files.
- Root cause of the per-test cost: `packages/ui/src/main.ts:16` — a static
  `import bundleJson from './drivers-bundle.json'` (11.5 MB). Every `page.goto('/')` parses all
  of it before the app mounts; a `goto → clear → goto` test pays it twice.

### 3b. The three steps (from the QO129 ledger entry)

**STEP 1 — one shared `openAProject`, as a fixture. No semantics change.**
34 of 36 specs carry a byte-identical `openAProject` + its 4-line comment (~580 lines, ~10% of
all browser-spec code), pinning `.no-project-open input[type=file]` and the `.original-root`
readiness selector in 35 places each. Move it into `packages/ui/test/fixtures.ts` — the module
every spec already imports and `.claude/rules/openisd-ui-tests.md` already mandates. Same seam
as `fixtures/seedMyDrivers.ts` (§2b): the module owns the mechanism (fixture path, readiness
selector), each spec keeps its own values inline.
*Verify:* after step 1, `grep -rl "async function openAProject" packages/ui/test` returns
nothing.

**STEP 2 — delete the redundant second page load. The actual speed win.**
15 specs do `goto('/') → localStorage.clear() → goto('/')`. Playwright already gives every
test a fresh context with empty storage. In-repo evidence it is safe: 16 specs already pass
with a single `goto` and no clear, including the storage-heavy `my-drivers`,
`my-drivers-failures`, `driver-favorites`, `driver-scope-chip`. Where a spec must pre-seed
storage, use `page.addInitScript` (runs before page scripts on the first load), never
evaluate-then-reload. Worst case: `persistence/driver-selection.browser.spec.ts:38-51` boots
and opens the project twice in `beforeEach` for a 9-test file. Also normalise the four
`addInitScript` sites that have different argument order and pointless `as string` casts.

**STEP 3 — move browser-tab unit tests down to vitest. This is the QO129 core.**
`packages/ui/test/ui/app.browser.spec.ts:72` already states the rule: *"if the number being
asserted was computed by calling core from the test (e.g. `page.evaluate → import(/src/...)`),
it is a unit test in a browser tab and does NOT qualify as a UI wiring test."* Nothing
enforces it. 26 sites violate it, in 4 files: `ui/original-skin` (22),
`logic/tune-panel-fields` (2), `ui/driver-editor-provenance-and-units` (2). (This session's
grep also flags `ui/app.browser.spec.ts` itself — check it.)

Per test: keep ONE wiring test in the browser (control → store updated), move the ARITHMETIC
to vitest against the module. Worked example, `original-skin:670-673` — the g→kg conversion
and "heavier cone → lower resonance" are pure; only `amc.fill('50')` reaching the store needs
a browser.

Same treatment, lower priority: `logic/driver-editor-solver.browser.spec.ts` (476 lines, 29
tests) — a T/S solver is a pure function; what needs a browser is which fields the editor greys
out, not the derived values.

**Method (R3, TDD):** one at a time — write the vitest test, watch it pass against the real
module, THEN delete the browser assertion. Never bulk-delete a browser test; a moved test must
be green in its new home first.
*Verify:* after step 3, the count of `import(/* @vite-ignore */ modPath)` in browser specs is
zero.

### 3c. R4 — the per-field browser restart

The tuner (`OgTune.vue`, 367 lines) and driver editor (`DriverEditorModal.vue`, 1393 lines)
have browser specs that reload the page or re-open the panel once per field asserted. John:
run a script or probes over the form that fly quickly by, in one page load. Two ways, pick per
spec:

- If the field logic is pure (unit conversion, derived value, grey-out predicate): it moves to
  vitest under step 3 and there is no browser loop at all.
- If it genuinely needs the rendered form (the field is only reachable through real DOM state):
  one `beforeEach` that opens the panel once, then a loop of `fill → assert` inside a single
  test, or `test.describe.configure({ mode: 'serial' })` sharing one page. No `goto` per field.

### 3d. R1 — the coverage bar

`vitest.config.ts:18-23` thresholds are currently `statements: 15.8, branches: 78.5,
functions: 54.0, lines: 15.8` with `include: ['packages/ui/src/**/*.{ts,vue}']`. As logic
moves out of `.vue` into `logic/` modules and gains real vitest tests, **raise these
thresholds to match — never lower them** (R1: "MUST be 100% covered"). The end state is the
`logic/` layer at or near 100% statements/lines, with `.vue` files thin enough that the
remaining gap is template wiring only. Add a per-directory threshold for `packages/ui/src/logic/**`
if the global number moves too slowly to be a useful ratchet.

### 3e. Where the logic goes

There is **no `src/stripped/` directory** (the QO129 title predates the decision). The
existing home is `packages/ui/src/logic/` — it already holds `driverBrowsingState.ts`,
`driverDisplay.ts`, `driverDraft.ts`, `driverSpecFields.ts`, `useDriverCells.ts`,
`usePrGroup.ts`, `useVentGroup.ts`, `presentationState.ts`, `appState.ts`. New composables go
there beside them. Do not create a new directory without a ruling from John (see
`memory: john-decides-architecture`).

### 3f. Not in scope, deliberately

`retries: 1`, `maxFailures: 180`, `channel: 'chromium'`, the `browserLog` auto-fixture — all
stay; each has a bug file or a reproduced incident behind it. `driver-type-chips.test.ts` vs
`driver-type-chips.browser.spec.ts` are NOT duplicate coverage (enum vs rendered filter bar) —
checked and rejected as a merge target.

---

## 4. QO135 — dead `test:visual` script (peer raised, John ruled delete)

`npm run test:visual` (`package.json:27`) points at
`packages/ui/test/ui/visual.browser.spec.ts`, which does not exist; neither does its snapshot
dir. `.claude/rules/openisd-ui-tests.md:75-88` documents it as live SPL-canvas coverage. Not a
gate hole — `scripts/test-browser.sh:37-45` refuses a zero-match run. John's ruling: **delete
both** the `package.json` script and the rules section; do not rebuild the spec or baselines.
Per the bug-first rule, write a `bugs/*.md` record BEFORE the two deletions, in the same
change.

---

## 5. Open questions — state by number, do not carry in chat only

Ledger: `python3 ~/.claude/bin/inbox.py get <QID>`. Live now:

| QID | What it blocks | Note |
|---|---|---|
| QO121 | The `tune-panel-fields` removed-API fix (§2b). Deletes `appState.ts` `state` / `state.box` / `state.project`. | Rule this first — the tree is half-committed to "delete" and several batch-1 fixes wait on it. |
| QO119 | Whether `loadDriver` is redundant with `setDriver`/`update` (§1 item 3). | Review after the migration lands. |
| QO120 | Hand-check of `FileEntry`/`Preview` deletion (§1 items 4-7). | |
| QO129 | The whole §3. Intent is ruled (R1-R6); the step plan is in the ledger. | |
| QO134 | Nothing — code done (§2c). Close it after re-running the one spec. | |
| QO135 | Nothing — ruled delete (§4). | |
| QO87, QO126, QT73, QT75 | DEFERRED. | |

---

## 6. Verification

1. `npx vue-tsc -p packages/ui --noEmit` — 0 (already true; keep it).
2. `npx tsc -p packages/design --noEmit && npx tsc -p packages/persistence --noEmit` — 0.
3. `npx vitest run` — all green, no skips. Coverage thresholds met (and raised as §3d).
4. `npx playwright test packages/ui/test/logic --workers=1` — `consistency-dq` green.
5. `npx playwright test packages/ui/test/persistence packages/ui/test/db --workers=1` — the 15
   remaining (§2a) resolve or are explicitly deferred with a bug file.
6. `npx playwright test packages/ui/test/ui --workers=1` — re-time against the 2.1-min
   `original-layout` baseline; expect a large drop after §3 steps 1-2.
7. `bash scripts/health-check.sh` — green. Background, one run, never concurrent with a peer's
   suite.
8. Manual smoke (`.claude/rules/openisd-ui-tests.md` §"Post-deploy smoke test"):
   `bash scripts/preview-4000.sh`, open the app → driver picker. Rows show real names, type
   chips, spec summary, datasheet/FRD links — no source tag, no dated-file markers. Preview
   pane: spec table + text block, no source line. Clone → "Copy of …" row in My Drivers.
   Export `.wdr`/`.wpr`/`.owdr` → non-empty. Open a `.wdr`/`.wpr` → loads. Console + Network
   clean.

---

## 7. Constraints in force (do not relax)

- **Git:** branch `refactor`. Stage by name — never `git add -A` / `.` / a directory / a glob;
  never `git commit -a` / `-am`. Banned: `git stash` (any form), `git reset` (any mode),
  `git checkout -- <path>` / `.`, `git restore`, `git clean`, `git revert`, `--no-verify`,
  force-push, new branches / worktrees. Pre-existing stash `b4f69cc` — leave it. To undo,
  commit forward.
- **Commit messages:** describe the change only. **No `Co-Authored-By` naming Claude/Anthropic**
  — the project `AGENTS.md` overrides the harness default here.
- **Peer session:** commit your own stream naming the files; do not commit its migration work.
  Verify its claims, do not accept them. Load the `multi-agent-session` skill before your first
  write.
- **TDD mandatory** for every code change. After editing any gate, break it on purpose, watch
  it go red, restore.
- **No `// eslint-disable`, no rename-to-`_foo`** to pass lint. A failing gate is a finding:
  name the defect and fix the code, or stop and report the cost.
- **A skip is a fail.** `command grep` (grep is ugrep honouring `.gitignore`).
  `vue-tsc -p packages/ui --noEmit` for `.vue`.
- **Every user-visible behaviour** keeps a Playwright functional test importing from
  `packages/ui/test/fixtures.js` — §3 moves the *arithmetic* down, not the wiring proof.
- **A defect gets a `bugs/*.md` file the same turn it is noticed**, before it is mentioned or
  fixed.
- **One suite at a time**, `--workers=1` for the batches, background not foreground, confirm no
  peer run is in flight first.
- **Transient files** → the session scratchpad (`build/` is deny-listed for writes this
  session).

---

## 8. Bug files opened this session (recorded, most not fixed)

`bugs/`:
- `BUG_20260909_tune_panel_independence_test_uses_a_boxtype_selector_id_that_does_not_exist.md`
  — RESOLVED (spec targeted `#boxtype`; real id `#og-box-type`; both call sites fixed).
- `BUG_20260909_no_project_can_be_opened_from_a_file_when_none_is_open.md` — FIXED (empty-state
  file input added to `App.vue`).
- `BUG_20260909_one_shared_owpr_fixture_cannot_satisfy_tests_with_opposite_driver_needs.md` —
  partial (`consistency-dq` repointed; `driver-editor-mandatory` + `tune-panel-fields`
  outstanding).
- `BUG_20260909_my_drivers_specs_seed_the_pre_migration_localstorage_shape.md` — FIXED via
  `seedMyDrivers.ts`; 7 specs repointed.
- `BUG_20260909_a_starred_bundled_driver_loses_its_favourite_mark_on_reload.md` — OPEN, real
  app bug, investigation steps in the file.
- `BUG_20260909_tune_panel_tests_call_appState_APIs_that_no_longer_exist.md` — OPEN, gated on
  QO121.
- `BUG_20260909_the_empty_state_renders_a_driver_picker_no_user_can_open.md` — OPEN.
- `BUG_20260909_two_solver_tests_assume_a_blank_driver_and_fail_against_a_real_one.md` — OPEN.
- `BUG_20260909_original_skin_test_asserts_a_titlebar_string_the_app_no_longer_renders.md` /
  `BUG_20260909_the_app_titlebar_and_its_build_datetime_are_gone.md` — OPEN; John ruled put the
  build datetime somewhere out of the way on screen (titlebar was deliberately deleted); NOT
  implemented.
- `BUG_20260909_bandpass4_rear_chamber_resonance_is_3hz_above_winisds_own_value.md` — RESOLVED
  (physics fix).

Plus the architecture-gate and empty-test-file bugs staged from the peer's migration work —
read `git diff --cached --stat bugs/` for the full list.
