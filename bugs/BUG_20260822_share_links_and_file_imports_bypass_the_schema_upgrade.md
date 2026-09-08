# Share links and file imports bypass the schema upgrade

Status: FIXED — `loadFromHash` and `importFile`'s JSON branch now route parsed payloads
through `upgrade()` before `applyState`, same as `loadLocal` always has.

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

`loadFromHash` applies `upgrade()` to the parsed blob exactly as `loadLocal` does (refusing,
with a console error, a payload it cannot bring to the current schema). `importFile`'s
SerializedState branch routes through a shared exported helper (`upgradeParsedState`) so all
three readers upgrade identically.

## Verification

`packages/ui/test/logic/persist.test.ts` — a V1 payload (driver as an object) loaded via the
hash path comes back upgraded to the current schema (driver as serialised text).
