# Typecheck is RED: `driver-editor-units.test.ts` imports the deleted `Driver` ADT

# Status
FIXED

## Symptom

`npm run typecheck` fails in the `ui` project:

    packages/ui/test/ui/driver-editor-units.test.ts(25,10): error TS2305:
    Module '"@openisd/winisd"' has no exported member 'Driver'.

`typecheck:engine`, `typecheck:model` and `typecheck:winisd` are all clean. The failure is
the last step, so the whole gate is red.

## Evidence

- `packages/winisd/src/driver.ts` does not exist — `ls` reports no such file.
- `packages/winisd/src/index.ts` no longer re-exports it. Working-tree diff:

      -export * from './driver.js';
       export * from './classic/wpr.js';

- `packages/ui/test/ui/driver-editor-units.test.ts` is built on that type throughout, not
  merely importing it:

  | line | use |
  |------|-----|
  | 25   | `import { Driver } from '@openisd/winisd';` |
  | 103  | `function coreDriver(): Driver {` |
  | 104  | `const d = new Driver();` |
  | 199  | `Driver.fromWdr(text).cell('loss')` |
  | 299  | `coreDriver().cell(f.field)` |

## Cause

The `Driver` ADT was deleted and its barrel export removed as part of moving the library,
the picker and the editor onto `openisdRecord` / `winisdDriver` (commits `138ade6`,
`c7b618e`). `driver-editor-units.test.ts` was not carried across with them, so it names a
type and a constructor that no longer exist.

Both files are UNCOMMITTED working-tree changes, so this is in-flight work, not a shipped
regression.

## Fix

Ported onto `OpenISDDriver.fromRecord(emptyDriverRecord())` / `WinISDDriver.fromWdr(text).toOpenISDRecord()`,
the pattern the app itself uses (`DriverEditorModal.vue`'s own file-import handler). Two further
gaps surfaced once the file could actually run, both fixed in the same change:

- `boundFields()`'s scraper predates `<UnitToggle>`: a group/base-driven field's unit text lives
  inside that component's own render, not literally in `DriverEditorModal.vue`'s source, so every
  such field scraped as unit `''`. Resolved via `unitDef(group, base)` — the same resolver
  NumInput/UnitToggle use at runtime — read off the `group`/`base` props already on the `<NumInput>`
  tag, instead of requiring a literal `<span class="u">`.
- Two assertions encoded stale expectations that no longer match current, intentional behaviour:
  "Magnet Depth" lost its "(MagDepth)" suffix when every other dimension label gained the
  "Full Name (Short)" pattern; and Voicecoils was asserted to read 1 on an unstated driver, which
  contradicts `openisdDriver.ts`'s own documented split (`cell('numVC')` stays honestly N;
  `toDriver()` is the ONE place the engine-facing default of 1 is applied). Both updated to match
  the current source, the second rewritten to assert the actual documented split instead.

## Verification

`npm run typecheck` green across engine, model, winisd and ui;
`packages/ui/test/ui/driver-editor-units.test.ts` — 21/21 passing.
