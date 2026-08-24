# Browser suite: dozens of specs fail on a console.error logged for a state blob that never had project data

Status: RESOLVED — found incidentally during the duplicate-accessor cleanup task; NOT caused by
that task's changes (bisected below).

## Symptom

Running the full Playwright suite (`npm run ci` → `npm test` → `scripts/test-browser.sh`) on
`dev` at commit `287da42` (and later) fails around 100+ specs across
`packages/ui/test/persistence/*.browser.spec.ts` and several `packages/ui/test/logic/
*.browser.spec.ts` (`driver-editor-mandatory`, `driver-editor-solver`, `whatif-panel-fields`,
`consistency-dq`), all with the same console error caught by `packages/ui/test/fixtures.ts`'s
`browserLog` auto-fixture:

    [restore] saved state states a schema but carries no box type — refused

The affected specs seed `localStorage['openisd.state']` with a PARTIAL blob that carries only
UI preference, never project data — e.g. `driver-favorites.browser.spec.ts`:

    await page.addInitScript(() => {
      localStorage.setItem('openisd.state', JSON.stringify({ ui: { skin: 'original' } }));
    });

`ManagedOpenISDProject`'s persistence layer (`packages/persistence/src/repos/projectRepo.ts`
`loadLocal()` → `readParsedProject()` → `upgradeParsedState()` → `carriesStateShape()`, lines
~292-313) reads this key on every app boot, tries to restore a project from it, finds no `box`
key, and calls `console.error(...)`. The test fixture's zero-console-errors policy then fails
the test outright — the picker never opens because the click on `[title*="librar" i]` times out
underneath the thrown diagnostics error.

## Evidence

Reproduced deterministically with `--workers=1` (rules out the documented concurrent-worker
false-failure class):

    npx playwright test packages/ui/test/persistence/driver-favorites.browser.spec.ts --workers=1 --reporter=line

— 4/4 tests fail, every one with exactly the one console error above.

## Bisection: NOT caused by the duplicate-accessor cleanup

Isolated by stashing only the cleanup's changed files
(`packages/ui/src/logic/{appState,managedProject,useVentGroup}.ts`,
`packages/ui/src/ui/shells/original/OriginalShell.vue`, and their touched tests) back to
`287da42` (`git stash push -- <those files>`), then re-running the same spec:

    npx playwright test "packages/ui/test/persistence/driver-favorites.browser.spec.ts:22" --workers=1

— still fails, same console error, on `287da42` alone with none of the cleanup's edits present.
The cleanup's changes are pure accessor-call-site substitutions (`managedProject.frontVolume_m3()`
→ `managedProject.projectCell('Vf').value`, etc.) with no reach into `projectRepo.ts` or the
schema-upgrade path, and the full unit suite (2119/2119) plus lint and typecheck are green on
top of them.

## Not yet diagnosed

Whether `openisd.state = {ui:{skin:'original'}}` reaching the project-restore path and logging
an ERROR (rather than silently no-op'ing, the way "nothing was ever saved" should) is itself the
defect, or whether some other recent change caused a UI-only write to start being visible to the
project reader that previously wasn't. Not investigated further — out of scope for the
duplicate-accessor task this was found during.

## Root cause

`carriesStateShape()` (`packages/persistence/src/repos/projectRepo.ts`) is correct as written.
`PROJECT_STATE_KEY` ('openisd.state') has exactly one writer, `saveLocal()`, and it always
writes the complete payload (`box`/`driver`/`P`/`project` together — `projectPayloadOf()`).
"Nothing was ever saved" is therefore represented by the key being ABSENT, which `loadLocal()`
already handles silently (`if (!raw) return null`). There is no code path under which the key
legitimately holds a value carrying zero project-shaped keys — any such value is anomalous, and
the loud `console.error` refusal is the correct response to it, not a bug to silence.

The actual defect was in the FIXTURES. Seven `packages/ui/test/persistence/*.browser.spec.ts`
files (`driver-favorites`, `driver-count`, `my-drivers`, `my-drivers-failures`,
`my-drivers-filtering`, `driver-scope-chip`, `driver-summary-winisd`) seeded
`localStorage['openisd.state'] = JSON.stringify({ ui: { skin: 'original' } })`, with a comment
explaining this worked around "`store.ts` forces `modern` on port 4100". That mechanism does not
exist: there is no `store.ts` anywhere in `packages/ui/src`, no code reads a `ui.skin` field, and
`App.vue` imports `OriginalShell` directly with no runtime skin switching (MEMORY.md: "Original
is the only skin — Classic and Modern are deleted from the tree"). Separately, a QO90 refactor
split persistence into two independent storage keys — `PROJECT_STATE_KEY` ('openisd.state', pure
project data) and `VIEW_STATE_KEY` ('openisd.view', UI/view prefs, `viewStateRepo.ts`) — so even
if `ui.skin` still meant something, it would never belong under `openisd.state`. The fixtures
were dead code from a deleted feature, writing garbage to a key whose reader correctly refuses
garbage.

## Fix

Removed the dead `localStorage.setItem('openisd.state', ...skin...)` seeding (and the stale
"store.ts forces modern" comments) from all 7 fixture files. No production code changed —
`carriesStateShape()` / `upgradeParsedState()` / `loadLocal()` in `projectRepo.ts` are untouched,
since the investigation found them correct.

Added `packages/ui/test/logic/persist.test.ts` → `describe('loadLocal — key absent is silent,
key present-but-shapeless is refused loudly')`, three tests pinning the correct current
behaviour: (1) key absent → `null`, zero `console.error` calls; (2) key present with a value
carrying no project-shaped fields (the exact `{ui:{skin:'original'}}` shape the fixtures used) →
`null`, refused loudly; (3) key present with a partial/corrupt project shape (`box` present,
`driver` missing) → `null`, refused loudly. This guards against a future "fix" that weakens
`carriesStateShape()` to silence case (2).

## Verification

- `npx vitest run packages/ui/test/logic/persist.test.ts` → 15/15 pass (12 pre-existing + 3 new).
- `bash scripts/test-browser.sh packages/ui/test/persistence/driver-favorites.browser.spec.ts --workers=1 --reporter=line`
  → 4/4 pass, zero console errors (previously 4/4 failed on
  `[restore] saved state states a schema but carries no box type — refused`).
