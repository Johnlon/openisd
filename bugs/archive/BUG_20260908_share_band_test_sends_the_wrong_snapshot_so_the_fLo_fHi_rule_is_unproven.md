# The share-link band test sends a snapshot without the band, so the fLo/fHi rule is unproven

Status: RESOLVED

## Symptom

`packages/ui/test/logic/persist.test.ts` "the dragged band crosses as fLo/fHi only — per-panel
stats are derived, not state" builds a `ViewSnapshot` carrying the dragged band, then shares a
DIFFERENT snapshot that has no band, and asserts the band arrived.

## Evidence

```ts
const withBand: ViewSnapshot = { ...uiView, cursor: { f: null, pinnedF: null, locked: false, range: { fLo: 31.6, fHi: 100 } } };
...
assert.deepEqual(decodeShare((await repo.stateToUrl(project, uiView)) as string).cursor.range, { fLo: 31.6, fHi: 100 });
```

`withBand` is constructed and never used; `uiView` is what is shared.

## Cause

A copy of the neighbouring cursor test where the snapshot variable was renamed in the
construction line and not in the `stateToUrl` call. The test could only ever fail, never pass —
which is why it hid behind the wrapper-shape failures rather than being noticed as a false
green.

## Fix

`stateToUrl(project, withBand)` — the snapshot the test builds is the one it sends. The cursor
is read at `shared.view.cursor`, matching the `{project, view}` share wrapper.

## Verification

`npx vitest run packages/ui/test/logic/persist.test.ts` — watched failing on the missing band,
then passing; and with `withBand`'s `range` set to `null`, watched going red again.
