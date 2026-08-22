Status: OPEN

# `driver-selection.browser.spec.ts` seeds a flat legacy shape `myDrivers.ts` explicitly refuses to tolerate

## Symptom

Every test in `packages/ui/test/db/driver-selection.browser.spec.ts` fails: `beforeEach` opens
the picker, but the seeded My Drivers row never shows the name the tests look for
(`'Spec Fixture Driver'`) — every locator built on that text times out at 60s. Reproduced
running the full spec (`bash scripts/test-browser.sh
packages/ui/test/db/driver-selection.browser.spec.ts --workers=1`): all 8 tests fail
identically, none of them touching bundled records.

## Evidence

The spec's `beforeEach` (`driver-selection.browser.spec.ts:18-28`) seeds
`localStorage['openisd_my_drivers']` with:

```js
[{ name, brand: 'Spec', model: 'Fixture', Fs: 41, Qts: 0.35, ..., _savedAt: 1 }]
```

a flat bag — `brand`/`model` are bare strings, there is no `quality`/`specs`/`uuid`/etc.

At the time this bug was filed, `myDrivers.ts::list()` did `JSON.parse(...) as
_OpenISDDriverJson[]` with no validation, so the flat blob reached `driverLibrary.ts`'s
`myDrivers` ref unchanged. This is no longer current: `list()` (`myDrivers.ts:107-109`, backed
by `readAndSplit()` at `:89-104`) now refuses a record failing `isConformingRecord()`
(`:73-79`) — see the Superseded paragraph below for what that changed about this spec's
failure.

Captured page snapshot (`test-results/.../error-context.md`, first re-run, before
`myDrivers.ts::list()` gained validation) showed the picker opening and listing a My Drivers
row — but its name read `Driver` (the "nothing stated a name" fallback in `readDisplayName`,
`openisdDriver.ts:759-763`: `record.brand?.value` on a bare string is `undefined`), never
`Spec Fixture Driver`.

**Superseded by the same session's second fix**: `myDrivers.ts::list()` (via `createMyDriverRepo`) now
validates every record with `isConformingRecord()` (`driverRecordProblems()` for `specs`, plus a
check that `quality.missing`/`quality.parse_errors` are present arrays) and drops one that
fails — confirmed by `packages/ui/test/db/myDrivers.test.ts`'s "returns an empty list when
every stored record is invalid" case (a list containing only this spec's flat fixture shape
returns `[]`). So the row this spec's tests wait for no longer renders AT ALL, misnamed or
otherwise — the My Drivers section of the picker is now genuinely empty for this fixture, and
every locator built on `.my-ditem`/`PICKED` fails identically to before (still a 60s timeout),
for a different reason: absence, not misnaming. Every other assertion in the file
(`saved.map(d => d.model)`, `expect(saved).toContain('"model":"Fixture"')`) reads
`localStorage` directly (unaffected by the in-memory filtering) and still assumes the flat
shape, so they remain broken independently.

## Cause

The spec was never updated when `myDrivers.ts` stopped tolerating the flat shape (its own doc
comment names this explicitly as a completed, deliberate change — "It is not read, not
converted and not tolerated"). The fixture and every assertion in this file still assume the
retired shape.

## Fix

Not yet applied — out of scope for task A7 (disposition/bundle-shape work; this spec exercises
My Drivers editing, not bundling). Rewrite the whole file's seed and assertions to a canonical
`_OpenISDDriverJson`: `brand: { value: 'Spec', origin: 'manual', definition: …, dq: [] }`, a
real `quality`/`specs`/`uuid`/`sku`/`driver_type`/`data_sources`/`authoritative` block per
`_emptyDriverRecord()`'s shape, and assertions reading `.brand.value`/`.model.value` instead of
flat strings.

Now that `myDrivers.ts::list()` validates and drops non-conforming records (this session's
second fix), a stale seed in this spec fails LOUDER and EARLIER than before: the row is simply
never in the list, rather than rendering under a wrong name. The rewrite is unchanged in scope
— seed a real `_OpenISDDriverJson` and read it back through envelope fields — but is now also
what makes the fixture visible to `list()` at all.

## Verification

Not yet — confirm by re-running `packages/ui/test/db/driver-selection.browser.spec.ts` after
the rewrite: all 8 tests green with the seeded row showing `Spec Fixture Driver`.

Unaffected by this bug: `packages/ui/test/db/driver-count.browser.spec.ts`, which exercises
only bundled (non-My-Drivers) rows, passes 2/2 against the canonical-shape bundle this task
regenerated.
