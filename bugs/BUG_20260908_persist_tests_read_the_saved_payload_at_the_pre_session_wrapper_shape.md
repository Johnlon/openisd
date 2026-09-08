# persist.test.ts reads the saved payload at its pre-wrapper shape, so 7 wire guarantees are unproven

Status: CRITICAL — partially fixed, the QO90 test still passes vacuously

CRITICAL because the failure mode is a FALSE GREEN, not a red: assertions aimed at the wrong
nesting level are trivially satisfied, so the suite reports the wire is clean while a view leak
inside `saved` would go unreported. A green suite that cannot fail is worse than a red one — it
ends the ability to trust the gate, which is the SDLC this work is trying to restore.

## Symptom

With `persist.test.ts`'s fixture faults fixed
(`BUG_20260908_persist_test_fixture_is_stale_and_misnamed_so_ten_tests_cannot_run.md`), 7 tests
still fail, now on their real assertions:

```
→ the driver payload travels
→ driver is REQUIRED on the wire (docs/design/DRIVER_NON_NULL_INVARIANT.md) — never absent
→ the view context travels
→ Cannot read properties of undefined (reading 'range')
```

The guarantees with no working coverage: the driver is always on the wire, the `.owpr` file
carries no view (QO90), the share link carries every ui field, the graph cursor survives, and the
dragged band crosses as fLo/fHi.

## Evidence

A saved `.owpr` payload's top-level keys, probed 2026-09-08 against `createProjectRepo(...)
.saveToFile(...)`:

```
KEYS: [ 'label', 'saved', 'edited' ]
```

The tests read one level higher:

```ts
assert.equal(typeof ser.driver, 'string',
  'driver is REQUIRED on the wire (docs/design/DRIVER_NON_NULL_INVARIANT.md) — never absent');
assert.equal(ser.ui, undefined, 'the file wire writer must not emit UI preferences');
```

`ser.driver` and `ser.ui` are `undefined` because the project payload is now nested under `saved`.

The QO90 test is the dangerous one: it asserts `ser.lossMode`, `ser.graphs`, `ser.ui` and
`ser.cursor` are all `undefined`. Every one of those is trivially undefined at the wrapper level
whatever the writer emits, so with the fixture fixed this test would PASS while proving nothing —
a view leak inside `saved` would go unnoticed.

## Cause

`openISDProjectSessionJsonSchema` (`packages/design/domain/openisdSchema.ts`) wrapped the stored
project as `{label, saved, edited}` so a session can hold a committed project alongside unsaved
edits. `persist.test.ts` was not updated for the new nesting.

The tests could not reveal this while they were failing earlier at fixture construction — the
`Bad driver` throw fired before any assertion ran, so the shape mismatch was invisible behind it.

The same wrapper change is already recorded against `packages/persistence/test/projectRepo-boxtype.test.ts`
in the migration plan (§8).

## Fix

Each assertion reads the project payload at `ser.saved`, not `ser`. The QO90 test must assert the
absence of view keys INSIDE `ser.saved` — asserting them at the wrapper level is vacuous and would
hide exactly the leak it exists to catch.

Not applied here: the correct target for each of the 7 needs checking one at a time against what
the writer actually emits under `saved` (some fields may have moved rather than simply nested),
and mis-targeting them would produce the same false green the QO90 test is already at risk of.

## Verification

When applied: each of the 7 must be watched FAILING for the right reason first. Specifically for
QO90 — put a `ui` key inside `saved`, confirm the test goes red, remove it. A test that passes
whether or not the leak exists is the defect this bug is about.
