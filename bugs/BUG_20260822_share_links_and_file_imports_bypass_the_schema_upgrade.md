# Share links and file imports bypass the schema upgrade

Status: OPEN — REGRESSED. The `packages/model` → `packages/design` migration removed the
project upgrade seam entirely; no project load path upgrades anything any more, so the defect is
now WIDER than when first recorded (localStorage no longer upgrades either).

Re-verified 2026-09-09:

- `packages/ui/src/logic/schemaUpgrade.ts` declares exactly one function,
  `createMyDriversSchema()` — the DRIVER LIBRARY's chain. There is no project upgrader left, and
  a repo-wide search for `schemaUpgrade` / `upgradePayload` / `upgradeTo` finds no other
  definition and no project-path caller.
- Every project reader now goes straight to `openISDProjectSessionJsonSchema.safeParse`, which
  requires `label`/`saved`/`edited`. A V1 payload (`{schema, v, box, P, graphs, project, driver}`)
  has none of them and is refused outright.
- The three guard tests in `packages/ui/test/logic/persist.test.ts` (the `describe` block
  "persisted-payload readers upgrade the schema (V1 driver-object → V2 driver-text)") FAIL, with
  `'label': Invalid input: expected string, received undefined; … Unrecognized keys: "schema",
  "v", "box", "P", "graphs", "project", "driver"`.
- Confirmed pre-existing, not caused by the current `.owpr`-text work: `git show
  HEAD:packages/persistence/src/repos/projectRepo.ts` shows the previous `readProjectText` also
  went `JSON.parse` → `projectOf` → `repo.load` → the same session schema, refusing a V1 payload
  identically.

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
