# BUG_20260928_mobile-skin-imports-original-skin-hooks

**Status:** RESOLVED

## Symptom
There are two skins, Original and Mobile. The Mobile hooks import `createSelectedBox` and
`CHART_LABELS` from `packages/ui/src/hooks/OriginalShell-hooks.ts`, the Original skin's own hooks
file. One skin depends on the other; shared pieces need a skin-neutral module both import.

## Evidence
Mobile session report, 2026-09-28 (push 79d3b59c): both exports were added to OriginalShell-hooks.ts
so desktop and mobile share one implementation.

## Cause
The shared code was extracted into the Original skin's file instead of a neutral module during the
rebase onto main.

## Fix
Moved every piece the Mobile hooks imported from `OriginalShell-hooks.ts` into four skin-neutral
modules, one responsibility each:

- `packages/ui/src/hooks/boxFields.ts` — `createSealedReadouts`, `createBoxVolume`,
  `createSelectedBox` (plus their `*Deps` interfaces, `DUAL_CHAMBER`).
- `packages/ui/src/hooks/driveSignal.ts` — `createDriveSignal` (plus `DriveSignalDeps`).
- `packages/ui/src/logic/cellDataQuality.ts` — `DqReadout`, `dqOfCell`, `dqOfEntry`, `dqOfSolved`.
- `packages/ui/src/logic/tabId.ts` — `TabId`, `isTabId`.
- `CHART_LABELS` moved into the existing `packages/ui/src/logic/series.ts` (alongside `TAB_META`,
  the sibling chart-id-keyed constant it was already next to conceptually).

`OriginalShell-hooks.ts` now imports all of these back and composes them with the shell's own
`project`/`selectedBox`/`projectChanged`, same as before — it no longer defines or re-exports
them. `MobileBoxTab-hooks.ts`, `MobileSignalTab-hooks.ts`, `MobileChartView-hooks.ts` and
`MobileShell-hooks.ts` now import from the new modules directly. `createEnvironmentAir`,
`airFieldDataQuality`, `dateStamp` and `fillBlankMeta` stay in `OriginalShell-hooks.ts` — Mobile
never imported them, so they weren't part of the split.

Doc comments naming `OriginalShell-hooks.ts` as the home of the moved factories were updated in
`OgTune-hooks.ts`, `appState.ts`, `MobileBoxTab.vue`, and the browser-spec comments in
`mobile-signal-tab.browser.spec.ts`, `mobile-box-tab.browser.spec.ts`, `original-skin.browser.spec.ts`,
`signal-drive.browser.spec.ts` and `signal-pane-blur-must-notify.browser.spec.ts`.

Pure move — no behaviour change, no test-expectation edits. Matching test blocks moved out of
`test/hooks/OriginalShell-hooks.test.ts` into `test/hooks/boxFields.test.ts`,
`test/hooks/driveSignal.test.ts`, `test/logic/cellDataQuality.test.ts` and `test/logic/tabId.test.ts`.

## Verification
- `grep -rn "OriginalShell-hooks" packages/ui/src` shows no Mobile* importer (only
  `OriginalShell.vue`'s own import, and two comments referencing it by name).
- `npm run typecheck` and lint (`eslint` on the touched files): both clean.
- `npx vitest run packages/ui --reporter=dot`: 584 passed, 2 unrelated failures (an .owpr fixture
  generation race, reproduced on unmodified files, passes on rerun) — nothing in the moved code.
- Targeted: `boxFields.test.ts` (18), `driveSignal.test.ts` (7), `cellDataQuality.test.ts` (3),
  `tabId.test.ts` (2), `OriginalShell-hooks.test.ts` (17 remaining), `OgTune-hooks.test.ts` (12) —
  all pass.
