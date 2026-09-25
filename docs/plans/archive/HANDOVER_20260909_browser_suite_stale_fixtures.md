# Handover — browser suite: stale fixtures + QO134 tune hoist

Date: 2026-09-09. Branch: **`refactor`** (not `dev`). Written for the AGY agent to continue.
Goal unchanged: `bash scripts/health-check.sh` green — no skips, no exclusions, no ignores.

A peer Claude session is ALSO live on this tree. Much of `git status` is theirs (the whole
`savedEntries.ts` / `projectSchemaUpgrade.ts` / deleted `schemaUpgrade.ts` + `driverName.ts`
migration). **Do not `git add -A` / `git commit -a`.** Stage by name. See §"Working tree" below.

---

## 1. What was done this session (all staged, NOT committed)

### 1a. Test-instrument fix — the vite server death (was already in place; verified)
`bugs/BUG_20260909_the_playwright_vite_server_dies_mid_run_and_fakes_hundreds_of_failures.md`
— Part 1 DONE. `packages/ui/test/fixtures.ts` throws a distinct "DEV SERVER UNREACHABLE — this
is NOT a test failure" error the moment any request hits `ERR_CONNECTION_REFUSED`, before the
diagnostics categories. `playwright.config.js` has `maxFailures: 180`. **Part 2 (why vite
dies — memory is the leading candidate, unconfirmed) is still OPEN.** The harness killed one
full run for low memory this session, which is corroborating.

**Because of this, the suite was run in three directory batches, not one process.** All three
ran server-clean (0 `ERR_CONNECTION_REFUSED`), so the numbers below are real:

| Batch | Command | Result (server-clean) |
|---|---|---|
| 1 | `npx playwright test packages/ui/test/logic --workers=1` | **15 failed / 44 passed** |
| 2 | `npx playwright test packages/ui/test/persistence packages/ui/test/db --workers=1` | **46 failed / 9 passed** (`db` dir has 0 specs) |
| 3 | `npx playwright test packages/ui/test/ui --workers=1` | **73 failed / 78 passed** (1.4h, 0 server deaths) |

Batch 3 distinct failing specs: `original-skin` 76, `app` 14, `driver-type-chips` 12,
`original-tuning-target` 10, `original-layout` 8, `advanced-environment` 8,
`driver-editor-provenance-and-units` 6, `modal-escape` 4, then 2 each for
`tune-panel-independent-of-box-view` (now fixed — see 1c), `sealed-fsc-winisd-golden`,
`panel-auto-close-on-focus-switch`, `original-narrow`. (`advanced-environment:45` is a
1.20095-vs-1.20096 air-density rounding off-by-one-ulp — its own issue, not a fixture problem.)

**Keep running the suite in these batches.** One 1.3-hour process is what the memory kill hits.

### 1b. Root-caused both batch-1 and batch-2 failures — BOTH are stale tests, not app bugs

**Batch 1 (15 fails)** —
`bugs/BUG_20260909_one_shared_owpr_fixture_cannot_satisfy_tests_with_opposite_driver_needs.md`.
33 specs share `packages/ui/test/fixtures/sample-project.owpr`, whose driver has only 5 fields
(Fs 37, Qts 0.38, Vas 0.03, Re 6.6, Sd 0.0212). Three specs need mutually contradictory driver
states:
- `consistency-dq` needs a COMPLETE driver so a consistency group reconciles before the test
  breaks it — with no Qes/Qms there is no group, so no DQ mark, so the test fails.
- `driver-editor-mandatory` needs a deliberately INCOMPLETE driver.
- `tune-panel-fields` needs Qts/Qes/Qms present.

**Done for batch 1:** built `packages/ui/test/fixtures/complete-driver-project.owpr` (Qes
derived from Qts/Qms so the trio reconciles; Mms/Cms/BL deliberately ABSENT so the solver
derives them and consistency holds by construction). Repointed
`packages/ui/test/logic/consistency-dq.browser.spec.ts` at it. **NOT YET VERIFIED** — needs a
run once batch 3 frees vite.

**Still to do for batch 1:**
- `driver-editor-mandatory.browser.spec.ts` (6 fails) — needs its own deliberately-incomplete
  `.owpr` fixture, missing exactly the fields each test asserts are reported missing.
- `tune-panel-fields.browser.spec.ts` (5 fails) — needs a Qts/Qes/Qms fixture AND it calls
  removed APIs (`s.driverCell(f)`, `s.state.P.Vb`): see
  `bugs/BUG_20260909_tune_panel_tests_call_appState_APIs_that_no_longer_exist.md`. That is a
  SEPARATE defect in the same spec — a better fixture does not fix it. Read the value through
  the DOM (`value-e`/`value-c`/`value-n` class) or the focused project, not the deleted store
  export. Gated on QO121 (below).
- `tune-panel-shots.browser.spec.ts` (1 fail) — screenshot spec; regen the baseline only once
  the panel renders correctly.

**Batch 2 (46 fails)** —
`bugs/BUG_20260909_my_drivers_specs_seed_the_pre_migration_localstorage_shape.md`. `myDriverRepo`
now stores a versioned envelope owned by `packages/persistence/src/repos/savedEntries.ts`:

```
{ schema: 1, entries: [ { uuid: string, record: <OpenISDDeviceJson> } ] }
```

opened via `OpenISDDriver.fromConformingRecord`. Six specs seeded `localStorage` with the
pre-migration FLAT shape (`{ brand, model, Fs, ... }`) or a wrong `{ schema: 2, drivers: [...] }`
shape. Nothing parses, My Drivers renders empty, every saved-driver test fails.

**Done for batch 2:**
- NEW `packages/ui/test/fixtures/seedMyDrivers.ts` — the ONE place that knows the envelope
  shape. Exports `MY_DRIVERS_KEY`, `myDriversJson(drivers)` (→ the bucket string), and
  `deviceRecord(seedDriver, uuid)` (→ one conforming record, for specs that hand-build a
  bucket). Each spec still declares its own driver values inline; only the mechanism is shared.
- Repointed all 7 affected specs:
  `driver-scope-chip`, `my-drivers-filtering`, `my-drivers`, `driver-search-interactive`,
  `driver-summary-winisd`, `driver-selection`, `my-drivers-failures`.
  This includes rewriting the READBACK assertions (`saved.map(d => d.model)` →
  `env.entries.map(e => e.record.model.value)`), fixing `PICKED` constants that were matching a
  removed `name` field (row name is now `displayNameOf` = brand + model), and replacing the
  dead `openisd.state` key read in `driver-summary-winisd`'s `currentDriver()` with a read off
  the shell's `.driver-id-row`.
- `vue-tsc -p packages/ui --noEmit` — 0 errors. `eslint` on all changed files — 0 errors.
- **NOT YET VERIFIED against a run.** Re-run batch 2 to confirm.

**Also found in batch 2, a SEPARATE real app bug (not the seed shape):**
`bugs/BUG_20260909_a_starred_bundled_driver_loses_its_favourite_mark_on_reload.md` —
`driver-favorites.browser.spec.ts:47` stars a BUNDLED driver, reloads, the star is gone.
Seeds no My Drivers. Investigate the favourites store's storage key + identity function (does
the bundled-row identity survive a reload?). One test, distinct from the 46.

### 1c. QO134 — the Tune panel hoist (code done, NOT test-verified)

John's ruling: "make this popup a child of a higher component so that it is independent of the
box view from which it was opened."

**Done:** moved `<OgTune v-if="presentationState.editDriver" />` out of
`OriginalShell.vue:1410` and into `App.vue`, inside the `v-if="project"` block beside
`DriverEditorModal` (both global driver overlays). Removed the now-unused `OgTune` import from
`OriginalShell.vue`; left a comment there pointing to the new location. `OgTune` takes no props
and reads `useFocusedProject()`, which `App.vue` provides, so the move is clean. The
`presentationState.editDriver` state and its refresh-persistence watchers stay in
`OriginalShell` (they sync global state, location-independent). `vue-tsc` + `eslint` clean.

**Batch-3 result:** `:26` (box-type change) timed out, `:45` (tab change) passed. The `:26`
failure was NOT the hoist — the test targeted `#boxtype`, an id that does not exist. The
box-type `<select>` is `id="og-box-type"` (`OriginalShell.vue:971`). Fixed both call sites in
the spec (`#boxtype` → `#og-box-type`).
`bugs/BUG_20260909_tune_panel_independence_test_uses_a_boxtype_selector_id_that_does_not_exist.md`.

**To do:** re-run `packages/ui/test/ui/tune-panel-independent-of-box-view.browser.spec.ts` with
the selector fix — expect both to pass. Then close QO134 in the ledger:
`python3 ~/.claude/bin/inbox.py close QO134 - <<'EOF' ...`

---

## 2. Verification steps for the next session

1. `npx playwright test packages/ui/test/logic --workers=1` — expect `consistency-dq`'s 3 to
   go green; `driver-editor-mandatory` (6) and `tune-panel-fields` (5) still red until their
   fixtures + the removed-API fix land.
2. `npx playwright test packages/ui/test/persistence packages/ui/test/db --workers=1` — expect
   the 46 to collapse to ~1 (`driver-favorites:47`, the real bug) plus whatever
   `original-projects.browser.spec.ts` (10) needs — that spec was NOT in the six seed-shape
   specs; check its failure reason before assuming it is the same cause.
3. Read `batch-3.log` for the `test/ui` total and the `tune-panel-independent-of-box-view`
   result.
4. Each batch: `grep -c ERR_CONNECTION_REFUSED <log>` MUST be 0 or the run is void.

Scratchpad logs (this session, may be gone): `batch-logic.log`, `batch-2.log`, `batch-3.log`
under `/tmp/claude-1000/-home-john-work-winisd-openisd/<session>/scratchpad/`.

---

## 3. Open questions blocking this work (state them, do not carry in chat only)

| Q | Status | Why it blocks |
|---|---|---|
| **QO121** | UNDECIDED | Delete `appState.ts` `state`/`state.box`/`state.project`? `tune-panel-fields.browser.spec.ts` calls the removed `state.P.Vb`. `no-seed-project.test.ts` already asserts `'state' in appState === false`, so the tree is half-committed to "delete". **Rule this first.** |
| **QO120** | UNDECIDED | Confirm `driverHasDqIssues` reimplementation says the same as the deleted `packages/model` version. Gates the picker DQ badge. |
| **QO119** | UNDECIDED | Dedup review of `loadDriver` / wdr-owdr text wrappers / `fileImportExport.ts`. Cleanup, not blocking green. |
| **QO129** | UNDECIDED | `.vue` files hold no logic; composables in `src/stripped/` own state. Shapes where `startTune()` + the Tune watchers belong. Not blocking. |
| **QO134** | UNDECIDED in ledger | Code done (§1c). Close it after the test run. |
| QO87, QO126 | DEFERRED | precision model; PR/vented tuning pair. Leave. |
| QT73, QT75 | DEFERRED | winisd_tools B10. Not this repo. |

---

## 4. Working tree — what is whose

`git status` shows ~115 entries. The peer session owns the persistence-layer migration:
`savedEntries.ts` (new), `projectSchemaUpgrade.ts` (new), `savedLibrary.test.ts` (new),
deleted `packages/ui/src/logic/schemaUpgrade.ts`, `packages/ui/src/driverName.ts`,
`packages/ui/test/logic/schemaUpgrade.test.ts`, `packages/ui/test/persistence/myDriverRepo.test.ts`,
`driver-search-name.test.ts`, and edits across `packages/persistence/src/repos/*`,
`packages/design/domain/*`.

**This session's files (verify with `git diff --cached <file>` before committing):**
- `packages/ui/test/fixtures/seedMyDrivers.ts` (new)
- `packages/ui/test/fixtures/complete-driver-project.owpr` (new)
- `packages/ui/test/logic/consistency-dq.browser.spec.ts`
- `packages/ui/test/persistence/{driver-scope-chip,my-drivers-filtering,my-drivers,driver-search-interactive,driver-summary-winisd,driver-selection,my-drivers-failures}.browser.spec.ts`
- `packages/ui/src/ui/App.vue` (QO134 hoist — my hunk is the `<OgTune>` add + import; the
  file also carries earlier empty-state-file-open work from this session)
- `packages/ui/src/ui/shells/original/OriginalShell.vue` (QO134 — `<OgTune>` removal + import
  removal; **the diff also shows peer/other changes — inspect before staging**)
- `bugs/BUG_20260909_one_shared_owpr_fixture_cannot_satisfy_tests_with_opposite_driver_needs.md` (new)
- `bugs/BUG_20260909_my_drivers_specs_seed_the_pre_migration_localstorage_shape.md` (new)
- `bugs/BUG_20260909_a_starred_bundled_driver_loses_its_favourite_mark_on_reload.md` (new)

Everything above was already `git add`-ed (a hook or the peer staged it) but **nothing is
committed**. Commit this session's stream by name; do not sweep the peer's half-finished
migration into the same commit. Commit message: describe the change only, NO `Co-Authored-By`
naming Claude/Anthropic (project `AGENTS.md` overrides the harness default here).

Banned this session, still banned: `git stash` (any form), `git reset`, `git checkout -- `,
`git restore`, `git clean`, `--no-verify`, `git add -A`/`.`/dir/glob, `git commit -a`/`-am`,
force-push, new branches/worktrees. Pre-existing stash `b4f69cc` — leave it.

---

## 5. Other open bug files from this session (recorded, not fixed)

`tune_panel_independence_test_uses_a_boxtype_selector_id_that_does_not_exist.md` (RESOLVED —
spec targeted `#boxtype`; real id is `#og-box-type`; both call sites fixed),
`no_project_can_be_opened_from_a_file_when_none_is_open.md` (FIXED — empty-state file input
added to `App.vue`, `empty-state-open-file.browser.spec.ts` passes),
`the_empty_state_renders_a_driver_picker_no_user_can_open.md`,
`two_solver_tests_assume_a_blank_driver_and_fail_against_a_real_one.md`,
`original_skin_test_asserts_a_titlebar_string_the_app_no_longer_renders.md`,
`the_app_titlebar_and_its_build_datetime_are_gone.md` (John ruled: put the build datetime
somewhere out of the way on screen — the titlebar was deliberately deleted; NOT implemented),
`bandpass4_rear_chamber_resonance_is_3hz_above_winisds_own_value.md` (RESOLVED — physics fix in
`openisdDomain.ts`, `LossMode.Lossless` for the bp4 rear chamber),
`tune_panel_tests_call_appState_APIs_that_no_longer_exist.md` (see §1b).

Cast list: John authorised clean removals, ask before any hack.
`bugs/BUG_20260909_driverName_ts_is_dead_code_holding_five_of_the_twenty_three_open_casts.md` —
`driverName.ts` is now DELETED by the peer, so those 5 casts are gone; re-count the cast gate.
