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
