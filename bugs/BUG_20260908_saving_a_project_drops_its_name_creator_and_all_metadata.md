# Saving a project writes empty metadata, losing its name, creator, description and dates

Status: CRITICAL — OPEN

CRITICAL because it is silent USER DATA LOSS in the primary save path: every `.owpr` the app
writes loses the project's name and every other metadata field, and the user is told the save
succeeded.

## Symptom

A project with a name and creator set in memory saves with all metadata blank. Probed directly
against `createProjectRepo(...).saveToFile(...)` on 2026-09-08:

```
IN MEMORY name: "PROBE-NAME-999999"
SAVED meta:     {"name":"","creator":"","created":"","modified":"","description":""}
```

Reopening such a file yields an unnamed project. The name is not recoverable from the file.

## Evidence

Probe: build a project, set `name` and `creator` through the project's own fields, save through
the repo, read the bytes the picker received.

```ts
const p = OpenISDProject.builder(OpenISDDriver.empty(new Engine()), new Engine())
  .sealed().volume_m3(0.03).build();
p.name.set('PROBE-NAME-999999');
p.creator.set('PROBE-CREATOR-999999');
// p.name.get() === 'PROBE-NAME-999999'
await repo.saveToFile(p, { suggestedName: 'p.owpr', mime: 'application/json', label: 'x', ext: '.owpr' });
// JSON.parse(written).saved.meta === {name:"",creator:"",created:"",modified:"",description:""}
```

The `meta` block is present and correctly shaped — five keys, all empty strings — so the writer is
emitting the block and filling it from something that is not the project's live fields. This is not
a missing key or a schema rejection.

The reads are proven live: `p.name.get()` returns the value immediately before the save.

## Cause

`OpenISDProject` layers an edit record over a saved one, and a file write reads the SAVED record
only. Every field write goes to `#edited` (`openisdDomain.ts:1898`):

```ts
#slot<K extends keyof OpenISDProjectJson>(key: K): Lens<OpenISDProjectJson[K]> {
    return {
        get: () => this.#current()[key],
        set: (value) => {
            const base = this.#ensureEditing();
            this.#edited = {...base, [key]: value};
```

while the record a file write serialises reads `#saved`, deliberately (`openisdDomain.ts:1909`):

```
/** @internal The record a save writes, deep-cloned — `projectRepo()`'s one way to reach it,
 *  never field by field. Reads `#saved`, NEVER `#edited`: a file/share write must never
```

`OpenISDProject.save()` (line 2241) is what promotes one to the other:

```ts
save(): void {
    if (!this.#edited) return;
    this.#saved = this.#edited;
    this.#edited = null;
```

Nothing in the file-save path calls it, so a project edited and then saved to disk writes the
record as it stood before the edits — for a project built and immediately named, that is the
builder's blank metadata.

This affects EVERY field, not only metadata: box volume, filters and driver changes made since the
last `save()` are equally absent from the file. Metadata is simply where the probe caught it.

The `#saved`-not-`#edited` rule is deliberate and probably right; the defect is that no caller
commits before writing. Which layer should call `save()` — the repo, `useApplicationIO`, or the
Save button — is a design decision for John, not an agent's pick.

Nothing caught it because the test that would have —
`packages/ui/test/logic/persist.test.ts` "the stored payload carries no ui/cursor/graphs/lossMode",
which asserts `meta.name` round-trips — was itself failing earlier in its body on a stale fixture,
so its metadata assertion never ran.

Cause confirmed by probe: inserting `p.save()` between the field write and the file write makes the
value appear in the file.

```
p.name.set('PROBE-NAME-999999'); p.save(); → SAVED meta: {"name":"PROBE-NAME-999999", ...}
p.name.set('PROBE-NAME-999999');           → SAVED meta: {"name":"", ...}
```

## Fix

Not applied — WHERE the commit belongs is a design decision reserved for John (the repo before it
serialises, `useApplicationIO` around the save, or the Save button explicitly). An agent choosing
one would be picking the app's edit/commit semantics.

The two candidate readings, both defensible:

- **File-save commits.** "Save to disk" means the on-screen design is what lands in the file, so
  `saveToFile` calls `save()` first. Matches what a user expects of a Save button.
- **File-save writes only committed state.** The `#saved`/`#edited` split exists so a file records
  a deliberate checkpoint; then the UI must call `save()` and the current silence is a missing call
  at the button, not in the repo.

Whichever is chosen, the share-link path (`stateToUrl`) needs the same answer — it reads the same
saved record.

## Verification

When fixed: the probe above must show the saved `meta.name` matching what was set. The assertion is
already in place at `packages/ui/test/logic/persist.test.ts` (`assert.equal(ser.meta?.name,
'View-free save')`) and is currently RED for this reason — it goes green when this is fixed, and it
must be watched doing so.

A `.owpr` save/reopen round trip through the real UI is also needed, since this is user-visible
data loss.
