# BUG_20260928_mobile-skin-imports-original-skin-hooks

**Status:** OPEN

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
Move `createSelectedBox` and `CHART_LABELS` into skin-neutral hooks modules (named for what they are,
not for a skin); both skins import from there. Do it with the queued UI splits (handover queue item 7),
after session a2's Engine-removal work in the same files.

## Verification
`grep -rn "OriginalShell-hooks" packages/ui/src` shows no Mobile* importer.
