# `ModeledSlot`/`MODELED_SLOTS`/`MODELED_BY_WDRKEY` survived the WinISDDriver rewrite with no caller left

## Status
FIXED — the three declarations deleted from `packages/winisd/src/parstate.ts`.

## Symptom

`parstate.ts` declared and exported `ModeledSlot`, `MODELED_SLOTS` (15 T/S fields the old
`Driver` class modeled directly, each with a WDR key and an internal field-name translation like
`Znom`→`Z`, `BL`→`Bl`) and `MODELED_BY_WDRKEY` (the same list indexed by WDR key). None of the
three had a caller anywhere in `packages/*/src` or `packages/*/test` — confirmed by a repo-wide
grep excluding their own declaration lines, and separately by their absence from every eslint
`no-unused-vars` pass once export was removed from each in turn.

## Cause

`git log -p` on the file that used to import them shows the real consumer: the earlier
`Driver.fromWdr`/`Driver.toWdr` implementation replayed `E` marks for exactly `MODELED_SLOTS`'
15 fields, and `toWdr` looked up each key's internal field name via `MODELED_BY_WDRKEY` before
writing it.

The current `WinISDDriver.fromWdrIni`/`toWdr` (this session's `winisdDriver.ts`) does not work
that way. It iterates the full 48-key `INI_ROWS` list, resolves each key's ParState slot via
`keyPos()`/`POS_TO_WDRKEY`, and keys every `WdrCell` directly by its WDR key — there is no
internal field-name layer left to translate into. The rewrite superseded the narrower
15-field/field-name-mapping model with full-coverage, WDR-key-keyed storage, and the old
supporting declarations were never removed.

This is not a wiring gap: the current code performs the same job (E/C/N replay on import, key
ordering on export) by a different, more complete mechanism. Nothing needs `MODELED_SLOTS` to be
reconnected.

## Fix

Deleted `ModeledSlot`, `MODELED_SLOTS`, and `MODELED_BY_WDRKEY` from `parstate.ts`.

Found and fixed while removing unjustified `export` keywords from `winisdProject.ts` (`WprBox`,
`WprPr` — used only inside their own file, `WprInput` embeds them structurally) at John's
"necessary exports only" instruction — demoting `MODELED_BY_WDRKEY`'s export first is what
surfaced that it had no use even unexported.

## Verification

`npx eslint packages/winisd/src` clean, `npx tsc -p packages/winisd --noEmit` 0 errors,
`npx vitest run packages/winisd` 1275/1275 passing, unchanged from before the deletion.
