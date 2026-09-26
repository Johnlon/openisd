# BUG_20260826 — `.owdr` file save/load serialised JSON, not YAML

## Status
FIXED — 2026-08-26

## Symptom

`.owdr` (driver) Save/Save As wrote JSON text to disk. The intended format is YAML — the same
`openisd.yml` shape the corpus and the V8 bridge (`openisdYamlToWdr`) use — never JSON, on
disk, anywhere (John, 2026-08-26: "we dont serialise json to disk at all — never — yml
only... save as Owdr or Owpr is openisd.yml and a yml project not json").

## Evidence

`packages/ui/src/logic/driverFileText.ts:57-59`:
```ts
/** A driver file's BODY, ready to write. `.wdr` carries its own encoding, so it goes out as
 *  bytes; `.owdr` is JSON and goes out as text. The UI hands over text and a format and never
 *  learns which of the two it got. */
export function driverFileBody(text: string, isWdr: boolean): string | Uint8Array<ArrayBuffer> {
```
The `text` handed to `driverFileBody` for a non-`.wdr` format came from
`DriverEditorModal.vue:697`: `{ value: draftDriver.value.toOwdrJson(), errors: [] }` —
`OpenISDDriver.toOwdrJson()`, JSON, not `.toOwdrYml()`.

`.owdr` import: `DriverEditorModal.vue:673`, `managedProject.ts:854/870` all called
`OpenISDDriver.fromOwdrJson(text)`.

## Cause

`OpenISDDriver` has both a JSON pair (`toOwdrJson`/`fromOwdrJson`) and a YAML pair
(`toOwdrYml`/`fromOwdrYml`, same record shape, `yaml` package `stringify`/`parse`). The UI's
`.owdr` export/import was wired to the JSON pair. The YAML pair had no real caller anywhere in
the app or the bundler at the time (confirmed by grep of `packages/` and `scripts/`: only
`COMMENTED_openisdYamlToWdr.ts`'s own `ymlRoundTripErrors` called it, self-referentially).

## Scope (John, 2026-08-26)

"we dont serialise json to disk at all... standing order in the agent file - there are no
existing users and no data that can't be recovered or trashed as needs be" — clean-sheet, no
backward-compat read path for old JSON files. Scoped to `.owdr` (driver) only.
`.owpr` (project) shares `projectRepo.ts`'s JSON wire encoding with localStorage autosave and
the share-link payload — a separate, larger change — tracked in its own record:
`bugs/BUG_20260826_owpr_file_save_serialises_json_not_yaml.md`.

## Fix

Every `.owdr`-text call site switched from the JSON pair to the YAML pair:
- `packages/model/src/openisdDriver.ts`: `fromFileText`'s `'owdr'` branch; docstrings on all
  four `Owdr*` methods corrected (`fromOwdrJson`/`toOwdrJson` now documented as the
  localStorage/share-link-only wire shape, not `.owdr`).
- `packages/ui/src/logic/managedProject.ts`: `loadDriverFromOwdrText`, `exportDriverOwdr`.
- `packages/ui/src/logic/driverSelection.ts:189`: `adoptIntoProject`.
- `packages/ui/src/ui/components/DriverEditorModal.vue:623,673,697`: draft commit, file load,
  file save.
- `packages/ui/src/logic/driverFileText.ts`: docstring.
- `packages/ui/src/fileFormat.ts`'s `sniff()`: extended to also structurally recognise
  YAML-shaped driver content (`specs` present, `box` absent) via the `yaml` package directly —
  NOT via `OpenISDDriver`, which `architecture.test.ts`'s QO80 ruling forbids this file from
  importing as a value (a first attempt at delegating to `OpenISDDriver.fromOwdrYml` broke that
  ruled architecture test; reverted to pure structural parsing, matching how it already handled
  the JSON `.owpr` case).
- `packages/model/src/openisdYamlToWdr.ts`'s `ymlRoundTripErrors`: was chaining
  `toOwdrJson→fromOwdrJson→toOwdrYml`, then re-reading the YAML with the bare `yaml` package's
  `parse()` instead of `OpenISDDriver.fromOwdrYml()` — passing even if `fromOwdrYml()` itself
  were broken, since nothing had called it. Chain extended to
  `toOwdrJson→fromOwdrJson→toOwdrYml→fromOwdrYml→toOwdrJson`, so every real `OpenISDDriver`
  serialisation method is exercised by name. The outer `openisdYamlToWdr()` construction step
  was also reimplementing `fromOwdrYml` inline (`parse()`+`fromJsonRecord()` separately) —
  switched to calling `OpenISDDriver.fromOwdrYml(yamlText)` directly.

`persistedDriverText()`/`committedDriverText()`/`loadDriverFromPersistedText()` (localStorage,
share-link, `DriverEditorModal.vue:60`'s internal draft-seed) deliberately left on the JSON
pair — out of this bug's scope.

## Verification

- `packages/model` + `packages/ui` + `packages/winisd` full suite: 1732/1732 passing (two
  `openisdDriver.test.ts` cases updated for the format change; `architecture.test.ts`'s QO80
  edge-legality test confirmed clean after the `fileFormat.ts` revert).
- `vue-tsc --noEmit` (packages/ui) and `tsc --noEmit -p packages/model/tsconfig.json`: clean.
- Manual end-to-end check: a real corpus record round-tripped through
  `toOwdrYml()`/`fromOwdrYml()` (the actual `.owdr` save/load path), confirmed the output is
  genuine YAML (`JSON.parse` on it throws) and every field survives.
- 1970 real corpus records scanned through `openisdYamlToWdr()` after the `ymlRoundTripErrors`
  fix: zero `yml-round-trip` errors, confirming `fromOwdrYml()` is correct on real data, not
  just newly-exercised.
