# BUG_20261009_same-project-opens-many-times

**Status:** RESOLVED

## Symptom
John, 9 Oct 2026:
- Opening a project that is already open opens it again; the project list then shows the same project many times.
- With several copies open, it is unclear what Save writes: the one project or a new copy.
- The file-open list is not sorted by last modified, newest first.

## Steps to reproduce
1. File → Open, pick a `.owpr`. It opens as one tab.
2. File → Open the SAME file again (or open the same saved project from the open-project dialog).
   - Before: a second, identical tab appeared.
   - After: the tab that is already open is focused; the list still holds one entry.
3. With one tab now open, edit the name and Save.
   - Before: the stored list gained a second entry for the one project.
   - After: the stored list holds one entry, with the new name.
4. Open the open-project dialog: the stored list is ordered by last modified, newest first.

## Evidence
Re-checked in this change:
- Both open paths appended unconditionally through `addProject` (`packages/ui/src/hooks/OriginalShell-hooks.ts`, `packages/ui/src/hooks/MobileShell-hooks.ts`) and the file import did the same (`packages/ui/src/logic/applicationIO.ts`) — no identity was consulted, so a second open always added a second registry entry.
- `packages/ui/test/logic/project-open-once.test.ts` — with the identity lookup disabled, 3 of its 4 cases fail (file opened twice, Save-in-place, stored project opened twice); the sort case passes. With the fix all 4 pass.
- `listStoredProjects()` already sorts descending by `modified` (`packages/persistence/src/repos/projectRepo.ts:355`); the "unsorted" reading was the same project appearing at several positions because each save added a copy.

## Cause
`addProject` appended and focused the new project on every open, and every open path called it: a project opened a second time became a second registry entry, and a file-opened project minted a fresh id (`OpenISDProject.wrap` → `appContext.newId()`, no store identity) so each Save wrote a new stored entry. No open was ever matched against what was already open.

## Fix
A project is identified by **its stored id when it has one, else the file name and exact content it was opened from** (human ruling, John, 9 Oct 2026). The identity is recorded AT OPEN TIME and never recomputed.

- `packages/ui/src/logic/appState.ts`: `StoredProjectIdentity` / `FileProjectIdentity` (discriminated union `OpenProjectIdentity`), an HMR-slotted `WeakMap<OpenISDProject, OpenProjectIdentity>`, and `openProjectByIdentity()` / `openProjectOnce()` — the latter focuses the already-open match and discards the freshly loaded duplicate, or records the identity and adds the project.
- `packages/ui/src/logic/storedProjectOpen.ts` (new): `openStoredProject(repo, id)`, the one door both shells' open dialogs call; it looks the store id up in the registry BEFORE loading, so a project that is already open is never loaded a second time, and returns `{kind: 'opened'} | {kind: 'refused'}`.
- `packages/ui/src/logic/applicationIO.ts`: both file-import branches use `openProjectOnce(project, {kind: 'file', name: f.name, content: text})`.
- Both shells call `openStoredProject` instead of their former byte-identical copies.

New projects, copies, share links and session restores still call `addProject` directly — they have no existing identity to collide with.

## Verification
- `bash scripts/test.sh packages/ui/test/logic/project-open-once.test.ts` — 4 passed: file twice → one tab focused; Save after reopen → one stored entry, renamed; stored project twice → one tab focused; stored list newest first.
- `bash scripts/quiet-test.sh npm run typecheck` — ok.
- Architecture gates (`architecture.test.ts`, `no-persistence-vocabulary-drift.test.ts`, `import-from-declarer-only.test.ts`) and the affected logic specs (`applicationIO`, `projectRegistry`, `boot`, `sessionSync`) — green.

## Also (John, 9 Oct)
"I've seen my projects list multiple times": the stored project list still accumulates a copy per file-open-per-session, because a freshly parsed file project has no store id and each Save writes a new one. Merging those stored duplicates at start-up is a persistence change, outside T024's file allowance; split out to `BUG_20261009_stored-project-list-holds-copies.md`.
