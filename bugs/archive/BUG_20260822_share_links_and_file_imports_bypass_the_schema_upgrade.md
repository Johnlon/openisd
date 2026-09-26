# Share links and file imports bypass the schema upgrade

Status: RESOLVED 2026-09-09

## Symptom

A payload saved by an older build loads correctly from localStorage but NOT from a share link
or a `File → Open` of the same content: `loadLocal()` runs `upgrade()` (schemaUpgrade.ts) on
the parsed blob, while `loadFromHash()` (persist.ts) and `importFile`'s SerializedState branch
(useApplicationIO.ts) hand the raw parse straight to `applyState`.

## Evidence

Found during the QO73/QO78 reshape (2026-08-22, working tree): `persist.ts:74-77`
(`loadFromHash`) is `JSON.parse(await gzipDecodeBase64Url(m[1]))` with no `upgrade()` call;
`useApplicationIO.ts`'s import branch is `applyState(JSON.parse(text) as SerializedState)` with no
`upgrade()` call; `persist.ts:105` (`loadLocal`) calls `upgrade(parsed as StoredBlob)`.
ARCHITECTURE.md §"EVERY STORED PAYLOAD CARRIES THE SCHEMA VERSION": *every reader upgrades
from it* — two of the three readers did not.

## Cause

The upgrade call was added at the `loadLocal` boundary when schemaUpgrade.ts was introduced;
the other two readers of the same payload shape were not routed through it.

## Fix

The project upgrade seam was rebuilt as `packages/persistence/src/repos/projectSchemaUpgrade.ts`
— the data-access tier owns wire formats, and `packages/design` owns no format history.

| Export | Does |
|---|---|
| `upgradeProjectPayload(parsed, engine)` | a V1 payload → current-schema `.owpr` TEXT; a current payload passes through as its own text |
| `upgradeSharePayload(parsed, engine)` | a whole V1 share link → `{project, view}`; a current payload is returned unchanged |

Both `loadFromHash` and `readProjectText` in `projectRepo.ts` now run the upgrade before
validation, so the hash, `File → Open` and localStorage accept the same set of payloads.

The upgrade rebuilds the project through `OpenISDProject.builder(...)` and asks it for
`.owprText()`, so this file states no record shape of its own — the encapsulation rule holds.
Two behaviours are stated in the code rather than inferred: a V1 payload states no box volume
(the field did not travel), so the upgraded project takes the builder's sealed default; and it
arrives SAVED, not edited, because it is a design the sender had already committed.

## Verification

`packages/ui/test/logic/persist.test.ts` — a V1 payload (driver as an object) loaded via the
hash path comes back upgraded to the current schema (driver as serialised text).

```
npx vitest run packages/ui/test/logic/persist.test.ts
  11 passed (was: 3 failed)
```

Made to fail on purpose: short-circuiting both `isV1` guards so no payload is ever upgraded
turned exactly the two guard tests red, then restored.

Two stale API reads in the same file were corrected alongside — `project.driver()` called as a
function (it is a getter) and `driver.Fs_hz` (spec fields live under `driver.spec[section]`, as
every other site in the file already had it). The assertions themselves are unchanged.
