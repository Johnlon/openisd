# `deriveEngineDriver` asserts eleven required numbers after checking four

Status: OPEN

## Symptom

`packages/design/engine/driver.ts:507` returns the value every simulation runs on:

```ts
return { value: r as unknown as EngineDriver, errors };
```

`r` is `DriverFields` — `Record<string, number | undefined>`. `EngineDriver` declares ELEVEN
required numbers: `Fs, Re, Sd, Vas, Qts, Qes, Qms, Cms, Mms, Rms, BL`. The double cast asserts
the conversion; nothing verifies it.

## Evidence, gathered 2026-08-30

**The validator checks four of the eleven**, plus a count:

- `:448-451` — `Fs`, `Re`, `Sd`, `Vas` must each be `> 0`.
- `:459` — at least TWO of `{Qts, Qes, Qms}` must be finite and positive.
- `Cms`, `Mms`, `Rms`, `BL` and the third Q are never checked. They are expected to arrive
  from `solveConsistencyGroup(r)` at `:483`, whose declared return type is `DriverFields` —
  so it promises nothing about them.

**The comment claims a guarantee the code does not provide** (`:434-436`):

> "is cast to EngineDriver only once every required field is confirmed present, at return."

Seven of the eleven are not confirmed.

**A leak is reachable and was reproduced.** Calling `deriveEngineDriver` directly:

```
  Sd (m²)      | blocking errors | non-finite required fields
  0.02         |   0    | none
  1e-100       |   0    | none
  1e-160       |   0    | Cms      <-- returned as a valid EngineDriver
  1e-200       |   0    | Cms      <-- returned as a valid EngineDriver
```

`Sd` passes the `> 0` test at any positive magnitude. `Cms = Vas / (rho·c²·Sd²)` underflows
`Sd²` to zero below ~1e-160, divides, and yields `Infinity` — which the cast then presents as a
finite `number`.

**Normal input is unaffected.** Every realistic case tested returns a complete driver:
minimum accepted input, `Qms` in place of `Qes`, `Sd` derived from `Dd`, near-singular Q pairs,
`Vas` at 1e-300 and 1e300, huge `Fs`, tiny `Re`, all three Qs given, and `c`/`roo` forced to
zero. The solver closes the group in all of them.

## Cause

The function validates in `DriverFields` shape — where every field is `number | undefined` —
and then asserts the result is `EngineDriver`, where eleven are `number`. A single `as` is
REFUSED by the compiler for exactly that reason, so `as unknown as` was written to get past the
check that was correct.

The `!` non-null assertions throughout (`r.Fs! > 0`, twenty-odd of them) are the same act at
field scale: each one tells the compiler to stop asking whether the value is there.

## Impact

TODAY: low. The leak needs `Sd` below about 1e-160 m², and a real driver's is 1e-4 to 1e-1. No
corpus record or user entry reaches it.

STRUCTURALLY: this is the value every chart, every alignment and every limit curve is computed
from, and the type system has been switched off at the point it is produced. The specific
danger is not the current arithmetic but the next change:

- Add a required field to `EngineDriver` and this still compiles, returning an object without
  it. No error, anywhere.
- Change `solveConsistencyGroup` so it stops filling one of the seven unchecked fields, and
  nothing reports it.

The same shape produced the `box as BoxType` NaN-to-a-chart bug and the `VCCon` always-parallel
bug. Both were casts standing where a check belonged.

## Fix

NOT APPLIED — `packages/design` requires John's explicit approval per its AGENTS.md.

Destructure, narrow, then build. After the guard each name is `number`, so the object literal
satisfies `EngineDriver` with NO cast, and adding a required field later fails to compile at the
literal with the field named:

```ts
const { Fs, Re, Sd, Vas, Qts, Qes, Qms, Cms, Mms, Rms, BL } = r;
if (Fs === undefined || Re === undefined || Sd === undefined || Vas === undefined
 || Qts === undefined || Qes === undefined || Qms === undefined || Cms === undefined
 || Mms === undefined || Rms === undefined || BL === undefined) {
  errors.push({ level: 'error', field: 'driver', message: '…names the missing field…' });
  return { value: null, errors };
}
return { value: { Fs, Re, Sd, Vas, Qts, Qes, Qms, Cms, Mms, Rms, BL, Le: r.Le, /* …optionals… */ }, errors };
```

A finiteness check belongs in the same guard: `Number.isFinite` on each, which closes the
`Sd`-underflow leak as a side effect rather than as a special case.

`packages/model/src/openisdDriver.ts:741` carries the identical `out as unknown as EngineDriver`
and needs the same treatment.

## Verification

Not yet verified — no fix applied. When applied: the `Sd = 1e-160` case must be REFUSED with a
named error rather than returning a driver; every realistic case above must still return a
complete driver unchanged; and adding a twelfth required field to `EngineDriver` must fail to
compile at the literal (fail-on-purpose, so the guard is known non-vacuous).
