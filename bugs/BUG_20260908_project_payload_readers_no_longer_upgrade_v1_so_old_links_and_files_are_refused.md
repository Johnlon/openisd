# Project payload readers no longer upgrade V1, so every old share link and saved file is refused

Status: CRITICAL — OPEN

CRITICAL because it silently breaks data users already hold: a share link sent before the session
wrapper landed, and any `.owpr` saved before it, now fail to open. The user's own saved work
becomes unopenable, and the only message is a schema complaint.

## Symptom

Loading a pre-wrapper (V1) project payload is refused rather than upgraded. Via the share-link
path:

```
the V1 payload was refused: share link is not a recognised session payload
```

Via the File → Open seam (`readProjectText`):

```
the V1 payload was refused: 'label': Invalid input: expected string, received undefined;
'saved': Invalid input: expected object, received undefined;
'edited': Invalid input: expected object, received undefined;
Unrecognized keys: "schema", "v", "box", "P", "graphs", "project", "driver"
```

## Evidence

`packages/ui/test/logic/persist.test.ts`'s V1 fixture is the shape the app used to write:

```ts
const v1 = {
  schema: 1, v: 2, box: 'sealed', P: {}, graphs: [],
  project: { name: 'v1-fixture', creator: '', created: '', modified: '', description: '' },
  driver: sampleDriverRecord(),
};
```

The reader now requires `{label, saved, edited}` (`openISDProjectSessionJsonSchema`) and refuses
every V1 key as unrecognised — it does not attempt an upgrade first.

The upgrade seam still exists but no longer covers this payload family:
`command grep -rln "schemaUpgrade" packages/ui/src packages/persistence/src` returns
`packages/ui/src/main.ts` and `packages/persistence/src/repos/myDriverRepo.ts` only. `main.ts`
registers `createMyDriversSchema` — the My Drivers family. Nothing registers a project-payload
upgrade, and `packages/persistence/src/repos/projectRepo.ts` contains no reference to upgrading at
all.

This directly reverses `bugs/BUG_20260822_share_links_and_file_imports_bypass_the_schema_upgrade.md`,
whose ruling was that EVERY reader of a persisted payload upgrades it. Its two regression tests are
the ones now failing.

## Cause

The session wrapper `{label, saved, edited}` was introduced and the project payload's V1→V2 upgrade
step was not carried across with it. The reader validates strictly against the new schema as its
FIRST action, so a V1 payload is rejected before any upgrade could run.

Not caught because the two tests guarding it were already failing on a stale fixture
(`BUG_20260908_persist_test_fixture_is_stale_and_misnamed_so_ten_tests_cannot_run.md`) and reported
a bare `throw new Error('fail')` that named nothing — the discarded reason list hid the schema
complaint that identifies the defect.

## Fix

The project payload reader must try the upgrade chain before validating, exactly as the My Drivers
reader does: recognise a V1 payload (`schema: 1`, or the absence of `label`/`saved`/`edited`), map
it to the session wrapper — the old top-level `project`/`box`/`P`/`driver` becoming `saved`, with a
`label` and a null `edited` — then validate.

Not applied: the mapping from V1's flat shape onto the current `saved` sub-record is a data
decision (which V1 keys map to `meta`, `box`, `driverEmbedding`, and what a V1 payload's `label`
should be), and inventing it would risk silently mis-loading real user files. Needs John's ruling
on the mapping, or confirmation that V1 payloads are deliberately abandoned — in which case the two
tests and the 2026-08-22 ruling are what change, and the app should say so in plain words rather
than emit a schema dump.

## Verification

When fixed: the two tests in `packages/ui/test/logic/persist.test.ts`
("persisted-payload readers upgrade the schema (V1 driver-object → V2 driver-text)") must be
watched going from the refusal above to green, and a V1 payload must be confirmed to load through
BOTH seams — the hash path and `readProjectText` — since the bug they descend from was specifically
that one seam upgraded and the other did not.
