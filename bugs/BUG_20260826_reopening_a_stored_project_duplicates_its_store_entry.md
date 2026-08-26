# Reopening a stored project duplicates its store entry

**Where:** `packages/design/domain/project.ts` — `projectRepo().load()` and `.save()`.

**Status:** FIXED 2026-08-26, in the same turn it was found. Raised by John: "doesnt it need to
proj uid to be useful?", then "since we are in the desig then just fix that immediately no
exceptions" — design-stage defects are fixed on sight, not recorded and queued.

This record is kept only for the identity rule it works out (store key vs file id, below), which
is a design decision rather than a bug history.

## Symptom

Open a stored project, edit it, and the store now holds TWO entries for one design — the
original, frozen at the moment it was reopened, and a second one collecting every edit since.

```
ws.create(...); p.name.set('Original');   // stored: 1 entry
const id = ws.stored()[0].id;
const reopened = ws.open(id);
reopened.box.sealed.volume_m3.set(0.05);  // autosave fires
ws.stored()                               // 2 entries  — expected 1
```

Each reopen adds another copy, so a user who opens the same design five times has five entries
with the same name and no way to tell which is current.

## Cause — the mechanism

`save()` keys the store on the project's own identity:

```ts
store.put(project.uuid(), json, { name: json.meta.name });
```

`load()` rebuilds the project through `OpenISDProject.wrap(json)`, and `wrap()` MINTS a fresh
uuid — correctly, on its own terms: the record carries no identity, so there is none to restore.

The two are individually right and wrong together. The loaded project's uuid is not the key it
came from, so its next autosave writes to a NEW key, and the entry it was loaded from is never
written again.

## Why the minting rule was wrong HERE

Identity is in-memory only, and a FILE carries none — so a file import must mint. That rule was
taken from the driver precedent (QO81, `driverBrowsingState.ts:425`: "the file's own uuid is
provenance, never the store key — importing twice yields two entries"), and it is right.

But a STORE ENTRY IS NOT A FILE. Its key was minted in this app, by this app, and it is the store
key already — the very thing QO81 says a file's id must never be adopted as. The driver precedent
does not merely permit reusing it, it does exactly that: `myDriverRepo.upsert()` finds the
existing entry by `x.uuid() === uuid` and OVERWRITES it, which is only possible because a driver
loaded from the store keeps its key.

So the correct rule is the one drivers already follow, and it splits on WHERE the record came
from, not on whether identity is persisted:

| source            | identity        | rationale                                              |
|-------------------|-----------------|--------------------------------------------------------|
| store entry       | ADOPT the key   | minted in-process; it IS the store key                  |
| file (.owpr)      | MINT fresh      | a file's id is provenance, never a key (QO81)           |
| new project       | MINT fresh      | nothing to adopt                                        |

## Fix — applied

`OpenISDProject.wrapWithIdentity(json, uuid)` added beside `wrap()`, unexported so only this
module — where the repo lives — can reach it. `projectRepo().load()` calls it with the store key,
so a loaded project's next save writes back to the entry it came from.

`Workspace.open()` now checks whether that uuid is already open and focuses it rather than loading
a second editable copy — two copies of one design, both autosaving to one entry, would have made
the last write win silently.

The test "a loaded project is a NEW project" asserted the defective behaviour and was inverted,
not kept.

## Verification

48/48 in `packages/design`. Added: a loaded project adopts the store key as its identity; editing
a reopened project writes back to its own entry rather than a second one (both in
`test/persistence.test.ts`); the same through the app, plus opening an already-open project
focuses it instead of duplicating (`test/workspace.test.ts`).
