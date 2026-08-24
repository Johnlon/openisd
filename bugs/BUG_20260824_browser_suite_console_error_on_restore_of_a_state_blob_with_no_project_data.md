# Browser suite: dozens of specs fail on a console.error logged for a state blob that never had project data

Status: OPEN — found incidentally during the duplicate-accessor cleanup task; NOT caused by
that task's changes (bisected below); out of that task's scope to fix.

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

## Fix

Not fixed. Needs someone owning `packages/persistence/src/repos/projectRepo.ts` /
`packages/ui/src/logic/schemaUpgrade.ts` to decide whether a state blob with no project keys at
all should be a silent no-op or an error, and to confirm what changed to make so many `browser.spec.ts` fixtures land in this state.
