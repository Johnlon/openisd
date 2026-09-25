# `OpenISDDriver` getters throw on a record that HAS `specs` but not the `_SpecEntry` shape

# Status
OPEN

## Symptom

`OpenISDDriver.toWdrText()` — and therefore the new V8-bridge seam
`openisdYamlToWdr(yamlText) → Result<string>`
(`packages/model/src/openisdYamlToWdr.ts`) — throws a `TypeError` instead of returning a
`Result` error, for any parsed record whose `specs` key exists but whose contents are not the
`_SpecEntry` shape. The function's own docstring states `value` is null on failure, "never a
thrown exception". That is false.

Two distinct throws, both reachable from valid YAML:

| input | throw |
|---|---|
| `specs: banana` | `TypeError: Cannot set properties of undefined` — `openisdDriver.ts:497` |
| `specs: {woofer: {fs: 12}}` | `TypeError: Cannot read properties of undefined (reading 'undefined')` — `openisdDriver.ts:156` (`winningReading`) |

The second is the dangerous one: `specs: {woofer: {fs: 12}}` is the shape a human or a
generator naturally writes for "Fs is 12 Hz". It is exactly the input the winisd_tools V8
bridge will feed this seam.

## Evidence

Probe run against the working tree, 2026-08-22:

```
FAIL  |winisd| probe > specs woofer garbage
TypeError: Cannot read properties of undefined (reading 'undefined')
 ❯ winningReading ../model/src/openisdDriver.ts:156:19
    155| export function winningReading(entry: _SpecEntry): Reading {
    156|   const r = entry.readings[entry.origin];
 ❯ OpenISDDriver.#stated ../model/src/openisdDriver.ts:512:17
 ❯ OpenISDDriver.#derived ../model/src/openisdDriver.ts:521:36
 ❯ OpenISDDriver.cell ../model/src/openisdDriver.ts:549:20
 ❯ OpenISDDriver.toWinISDDriver ../model/src/openisdDriver.ts:374:22
 ❯ OpenISDDriver.toWdrText ../model/src/openisdDriver.ts:480:36
 ❯ openisdYamlToWdr ../model/src/COMMENTED_openisdYamlToWdr.ts:32:69
```

```
FAIL  |winisd| probe > specs present but garbage
TypeError  ❯ openisdDriver.ts:497
    495|     if (!this.#record.specs) this.#record.specs = {};
    496|     const s = this.#record.specs[this.#section] ?? {};
    497|     this.#record.specs[this.#section] = s;
```

The two `Result`-contract tests in `packages/winisd/test/openisdToWdr.test.ts`
(`'reports malformed YAML as an error'`, `'reports YAML that is not an OpenISD record as an
error'`) both pass, because both stop at the caller-side `'specs' in record` guard. Neither
exercises a record that gets PAST that guard.

## Cause

`openisdYamlToWdr` guards on `record == null || typeof record !== 'object' || !('specs' in
record)` and then casts: `record as _OpenISDDriverJson`. The cast is a claim, not a check —
nothing validates the record's interior.

`OpenISDDriver.fromJsonRecord(record)` (`openisdDriver.ts:303`) is a bare constructor call: it
stores the record and computes `sectionFor(record)`. No validation happens there either.

The failure therefore lands in the getters, one field at a time:
- `#entry()` (`:495-497`) assumes `#record.specs` is indexable by section. `specs: banana`
  makes `specs` a string; `'banana'['woofer']` is `undefined`, and the write-back on `:497`
  throws.
- `winningReading()` (`:155-157`) assumes an entry has `readings` and `origin`. A bare
  `{ fs: 12 }` has neither, so `entry.readings` is `undefined` and the index throws before the
  function's own `if (!r) throw` (which would at least have been a named error) is reached.

The narrower case of this — a record with NO `specs` key at all — was recorded as
`BUG_20260819_fromRecord_on_a_shapeless_object_crashes_instead_of_erroring.md` and closed
"FIXED (superseded)". The fix was the caller-side `'specs' in record` guard, which is a
key-presence test only. The crash class it was closed against is still live one level deeper.

## Fix

Not applied — recorded by the review agent, no production code from this session.

The `Result` contract has to be honoured by the code that owns the shape, not by a guard in
every caller. Two candidate shapes, for the human to rule between:

1. `OpenISDDriver.fromJsonRecord` validates the record and the call becomes fallible
   (`Result<OpenISDDriver>`), so an invalid record is refused once, at the boundary, and every
   getter downstream can keep assuming the shape. This is the one-model-rule-conformant
   option: valid or invalid, nothing in between.
2. `openisdYamlToWdr` catches around the whole composition and reports the throw as a
   `DriverError`. Cheaper, but it converts an unvalidated record into "some fields came out
   wrong" rather than "this is not a record", and leaves every other `fromJsonRecord` caller
   exposed.

Option 1 is the recommendation. Option 2 alone would be a workaround.

Whichever lands, the `Result contract (never throws)` describe block needs a third test for
the valid-YAML/invalid-record path — `specs: {woofer: {fs: 12}}` is the reproducing input.

## Verification

Not yet verified — no fix applied.
