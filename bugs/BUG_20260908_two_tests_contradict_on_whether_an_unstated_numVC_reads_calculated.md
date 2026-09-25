# Two suites assert opposite things about an unstated numVC, so one of them is always red

Status: RESOLVED

## Symptom

`packages/ui/test/ui/driver-editor-units.test.ts` requires an unstated `numVC` to read
`not-available`:

```
→ Voicecoils cell is calculated — an unstated field must not read as entered or calculated
+ 'calculated'
- 'not-available'
```

`packages/design/test/domain.test.ts` requires the opposite, and passes:

```ts
it('reads the default coil count the same way', () => {
  const numVC = OpenISDDriver.empty(new Engine()).spec.woofer.numVC.get();
  expect(numVC.value).toBe(1);
  expect(numVC.state).toBe('calculated');
});
```

Both cannot hold. The domain has one getter and it answers one way.

## Evidence

The UI test's own comment sources its rule from a file that no longer exists:

```
// openisdDriver.ts's own comment on toDriver() (~line 337): "numVC defaults to 1 here
// ONLY ... cell('numVC') stays honestly N when nothing stated it
```

`packages/model/src/openisdDriver.ts` was deleted with `packages/model`. The behaviour it
described — a default applied at `toDriver()` and deliberately NOT on the cell — went with it.

The domain tests cite a later ruling, recorded in `domain.test.ts` at the describe block "a blank
device reports WinISD's own defaults without stating them":

> John, 2026-09-08: "use the existing WinIsd default values - but some of these are functions
> like calcVcCon() ... which isn't really a calc but plays that role if the VCCon isn't yet
> stated"

`numVC`'s getter implements that ruling (`openisdDomain.ts`, the `numVC` field builder):

```ts
return v === null ? {value: calcNumVC(), state: 'calculated'} : {value: v, state: 'entered'};
```

## Cause

The UI test encoded the pre-migration behaviour and was not revisited when the ruling changed
the domain. It went unnoticed because the file was failing earlier on a stale `blankDriver()`
fixture (`{section: 'woofer', woofer: {}}`, a shape the current schema refuses), so its
assertions never ran.

## Fix

The later ruling wins: an unstated `numVC` reads `calculated` carrying WinISD's default of 1,
which is what `'calculated'` means — a value the app derived rather than one the user typed. The
UI test is corrected to assert that, and its citation of the deleted file is removed.

The half of it that is still a real guarantee — that the ENGINE-facing driver defaults `numVC`
to 1 for simulation — is kept.

## Verification

`npx vitest run packages/ui/test/ui/driver-editor-units.test.ts` — watched failing with
`'calculated' !== 'not-available'`, then 31/31 green, with
`packages/design/test/domain.test.ts` staying 67/67.
