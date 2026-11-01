# BUG_20261101_wizard-pr-pick-blank-boxes

**Status:** RESOLVED (T644, 1 Nov 2026)
Found: John, 1 Nov 2026, installed phone app on test.openisd.app.

## Symptom

New project, passive radiator, Select PR, tap a radiator: the picker closes, the name and all five
boxes stay blank, every radiator. Intermittent on his phone; a fresh browser never showed it. A
failed load showed nothing at all.

## Cause

John never emptied a box, and the name was blank too, so the step showed no radiator at all: the pick
did not produce one. Fits the load being rejected (for example a catalogue index and record from
different builds on the installed app) and the rejection being swallowed (`void` on the load, no
message). Not reproduced: a delayed load with taps, blurs and a stepper tap on the blank boxes
(`mobile-new-project-pr-pick.browser.spec.ts`, test 3) fills every box, and the number boxes
only refuse an emptied entry after the user types a blank. Found on the way and fixed:
- The wizard edited the repo's cached radiator, so a later edit leaked into every later pick of it.
- A refused empty entry survived a re-pick of the same radiator.

## Fix

- The wizard takes its own copy of the radiator on every pick (bundled and saved).
- The latest pick wins; a late load result is dropped.
- Each pick re-keys the step, so every box starts afresh.
- A rejected load shows "Could not load passive radiator <id>: <reason>" and reports the fault.

## Verification

- `packages/ui/test/hooks/OriginalNewProject-hooks.test.ts`: (a), (b), (c), (d), a failing load, the real E150HE-PR record.
- `packages/ui/test/ui/mobile-new-project-pr-pick.browser.spec.ts` at 374x705.
