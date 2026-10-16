# BUG_20261016_live-crash-no-project-is-focused

**Status:** OPEN

## Symptom
Live release v20261015T1542Z (7.0.951) shows the crash screen with "no project is focused". Stats dashboard, 16 Oct 2026: 7 crashes in two browsers (a Chrome-style stack, 2 at 13:42; a Firefox-style stack, 5 at 11:28, hash 44211fa4efe9c4e7af10ffc6). One user sent a crash report for it at 11:07 with no note and no contact.

## Evidence
Thrown by `NoFocusedProject` in `packages/ui/src/logic/appState.ts:118`, from a computed inside a component `setup` (frames `k` ← `setup` computed ← Vue effect `Ve`). Not changed on main since the release.

## Cause
Not yet found. A component reads the focused project in a computed while no project is open (all closed, or first launch with nothing restored).

## Fix
Find the component from the release's source map, reproduce with no project open, test first. Nothing reads the focused project while none is focused; the shell's no-project state renders instead.

## John's ruling, 16 Oct 2026
- Never a crash here. With no project open the app says, in plain words: "No project open. Create or open a project." with New project and Open project buttons, on both skins.
- Every error is logged with enough context to diagnose it: which screen and dialog were open, how many projects were open, the focused project's box type (or none), the last few user actions by name, app version and device type. No project data and no values. The privacy text gets the matching sentence.
- Mobile, John 16 Oct: with no project open, every app-level feature stays reachable from the menu: New project, Open project, Import, Options (Your data, Backups, Export/Import, cloud sync), My Drivers / driver manager, About, Diagnostics. Only project-level items (Save, the project tabs, charts, Tune/Learn) are hidden or disabled. Desktop the same.
