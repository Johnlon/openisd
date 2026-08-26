# BUG_20260826 — `.owpr` project file save/load serialises JSON, not YAML

## Status
OPEN — 2026-08-26

## Symptom

`.owpr` (project) Save/Save As writes JSON text to disk. Per John, 2026-08-26: "we dont
serialise json to disk at all — never — yml only... save as Owdr or Owpr is openisd.yml and a
yml project not json." The sibling `.owdr` (driver) case is fixed —
`bugs/BUG_20260826_owdr_file_save_serialised_json_not_yaml.md`.

## Evidence

**`.owpr` project export** — `packages/persistence/src/repos/projectRepo.ts:381,386`:
```ts
return fileStorage.save(JSON.stringify(projectPayloadOf(project), null, 2), ...);
return fileStorage.saveAs(JSON.stringify(projectPayloadOf(project), null, 2), ...);
```
Reached via `useDesignIO.ts:97/122` (`deps.projectRepo.saveToFile`/`saveToNewFile`).

**`.owpr` project import sniffing assumes JSON** — `useDesignIO.ts:197`:
```ts
} else if (format === ProjectFileFormat.Owpr || /^\s*\{/.test(text)) {
```
Detects a bare driver record inside an `.owpr`-named file by testing whether the text starts
with `{` — a JSON-shape assumption baked into the sniffer itself.

**Also JSON, same file, same functions** (`projectPayloadOf`/`readParsedProject`/
`sessionPayloadOf`/`readParsedSession`): localStorage autosave (`projectRepo.ts:333`,
`JSON.stringify`), share-link payload (`projectRepo.ts:366`, gzip+JSON). Neither writes a
user-visible file to disk — this is why `.owpr` was split out from the `.owdr` fix rather than
converted alongside it: the SAME payload-building functions serve the file, localStorage, and
the share-link, so a `.owpr`-only fix either needs to give the file its own serialisation step
separate from `projectPayloadOf`'s existing callers, or convert all three together.

## Cause

`projectRepo.ts`'s own docstring (line 1-3): "the JSON wire shape stays inside this file" — a
deliberate design that `.owpr` file save, localStorage autosave, and the share-link all share
one JSON wire encoding via `projectPayloadOf(project)`/`readParsedProject`.

## Not yet decided

Whether localStorage/the share-link stay JSON (they are not "disk") while only the `.owpr`
FILE path switches to YAML, or whether `projectRepo.ts`'s wire shape becomes YAML uniformly
across all three. Needs a ruling before implementation — this file's shared payload functions
make a `.owpr`-only change nontrivial to do without either duplicating the payload-building
logic or touching localStorage/the share-link too.

## Fix
Not yet applied.

## Verification
Not yet done — fix not yet applied.
