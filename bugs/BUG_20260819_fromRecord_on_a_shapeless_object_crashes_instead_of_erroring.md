# `OpenISDDriver.fromRecord()` on a valid-but-shapeless object crashes instead of returning an error

# Status
OPEN

## Symptom

`packages/winisd/test/openisdToWdr.test.ts` — `'reports YAML that is not an OpenISD record as
an error, does not throw'` — parsing `'hello: world\n'` (valid YAML, parses to the JS object
`{ hello: 'world' }`) and calling `OpenISDDriver.fromRecord(...)` then any getter that reaches
`#specs()` throws `TypeError: Cannot read properties of undefined (reading 'woofer')`, instead
of the caller's own `typeof record !== 'object'` guard catching it and returning a `Result`
error.

## Evidence

```
TypeError: Cannot read properties of undefined (reading 'woofer')
 ❯ OpenISDDriver.#specs ../model/src/openisdDriver.ts:411:28
    411|     const s = this.#record.specs[this.#section] ?? {};
 ❯ OpenISDDriver.#entry ../model/src/openisdDriver.ts:417:17
 ❯ OpenISDDriver.cell ../model/src/openisdDriver.ts:458:24
 ❯ OpenISDDriver.toWinISDDriver ../model/src/openisdDriver.ts:308:22
```

## Cause

`{ hello: 'world' }` is a genuine JS object, so `typeof record !== 'object'` (the guard both the
test-local `fromYaml` helper in `openisdToWdr.test.ts` and the original, now-deleted
`WinISDDriver.fromYaml` used) does not catch it — the check only rejects non-objects (`null`,
strings, numbers), not an object missing the required shape.

`OpenISDDriver.#specs()` (`packages/model/src/openisdDriver.ts:410-413`) then does
`this.#record.specs[this.#section] ?? {}` — the `?? {}` only guards the RESULT of the property
access, not the access itself. When `this.#record.specs` is `undefined` (absent from the
malformed input), indexing it with `[this.#section]` throws before the `??` ever runs.

This is not new to this session's refactor: the same shape-less-input crash risk existed in the
original, pre-refactor code path (`OpenISDDriver.fromRecord(record)` was always constructed the
same way, `#specs()`'s guard is unchanged) — the refactor's test-suite pass is what surfaced it,
not what caused it.

## Fix

Not applied — reported per bug-first rule. Two independent options, either fixes the crash:
1. `#specs()`: guard the intermediate access — `(this.#record.specs ?? {})[this.#section] ?? {}`.
2. The callers' `typeof record !== 'object'` shape check should be a real schema check (at
   minimum, `'specs' in record`) rather than a bare `typeof`.
Option 1 is the more robust fix — it protects every caller of `fromRecord()` with a malformed
record, not just this one YAML-import path.

## Verification

Not yet — no fix applied.
