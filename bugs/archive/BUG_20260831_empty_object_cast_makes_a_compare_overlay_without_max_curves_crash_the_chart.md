# `{} as MaxCurvesResult` turns a legitimately-absent overlay result into a TypeError

Status: RESOLVED

## Symptom

On the **Maximum SPL** or **Maximum power** chart, a compare overlay whose `maxCurves` is `null`
crashes the chart with a `TypeError` instead of being skipped or drawn without a max trace.

Currently UNREACHABLE, and only for that reason: every caller passes an empty overlay list, so
the loop never sees a second design. It fires the moment compare overlays are switched on.

## Evidence

`packages/ui/src/logic/series.ts:267`:

```ts
const pd = seriesFor(tabId, d.driver!, d.box, d.P, d.curves!, d.maxCurves || ({} as MaxCurvesResult), opts.bare);
```

`packages/ui/src/types.ts:62` declares the field nullable, so `null` is a legal, expected state:

```ts
maxCurves: MaxCurvesResult | null;
```

The guard at `series.ts:257` covers only `currentDesign`, never the overlays iterated at `:267`:

```ts
if (!currentDesign.driver || !currentDesign.curves || !currentDesign.maxCurves)
  return { value: null, errors };
```

What the empty object meets, two lines into the Max SPL builder (`series.ts:164-165`):

```ts
const series: Series[] = [{ xs: mx.fs, ys: mx.maxspl, ... }];
const real = realDb(mx.maxspl);          // realDb = ys => ys.filter(...)  ->  undefined.filter is not a function
```

and in the Max power builder (`series.ts:181-182`):

```ts
ymax: Math.max(...mx.maxpwr) * 1.2       // spread of undefined -> TypeError
```

Why it is unreachable today: `packages/ui/src/ui/shells/original/OriginalShell.vue:421` is
`const overlays = computed<Design[]>(() => []);`, and `GraphPanel.vue:21` is
`computed(() => props.overlays ?? [])`. Both always empty.

## Cause

The cast asserts that `{}` is a complete `MaxCurvesResult`. It is not: `fs`, `maxspl`, `maxpwr`
and `xlim` are all absent, and the compiler stops checking precisely where the value stops being
what it claims. A `null` maxCurves means "the sweep for this overlay has not produced max curves",
which is information; the empty object destroys it and substitutes a value that reads as present
and behaves as undefined.

## Fix

John, 2026-08-31: *"if we are filling in defaults `{} as MaxCurvesResult` then why isn't the field
optional?"* — which is the answer. `{}` was never a default: it is a value with no `fs` and no
`maxspl`, so the builders that read it crash rather than draw nothing. A default is a value the
code can use; this was a shape the compiler would accept.

The parameter now says what is true, and the two builders that read it answer for the absence:

  series.ts  `mx: MaxCurvesResult | undefined` on `seriesFor`, and the same on `CurveCtx` —
             present but possibly nothing, so a caller cannot forget the argument entirely.
  MaxSPL     returns `{ series: [], ymin: 0, ymax: 0 }` when `mx` is absent.
  MaxPwr     likewise.
  caller     `d.maxCurves ?? undefined` — `Design.maxCurves` is `MaxCurvesResult | null`, and one
             spelling of "not there" reaches the builders.

A design without max curves therefore contributes no trace to those two charts, while every other
design still draws its own. No other chart reads `mx`.

The cast is gone with it: the tree is down to ONE `as` (`project.ts:1920`, approved by John).

## Verification

`packages/ui/test/ui/chart-types.test.ts`, three new cases, all passing:
  - MaxSPL contributes no series when the max curves are absent
  - MaxPwr contributes no series when the max curves are absent
  - every OTHER chart is unaffected — they never read the max curves

MADE TO FAIL ON PURPOSE, because a test not seen red proves nothing: removing the `if (!mx)` guard
from MaxSPL turns the first case red with `Cannot read properties of undefined (reading 'fs')` —
the very crash this bug records. Restored, all three green.

That test file also had to be brought up to date to run at all: it called the deleted
`Engine.deriveEngineDriver`, used the three-argument `sweep`, and passed `Result` objects where the
unwrapped values belong. One pre-existing failure remains in it, unrelated to this bug —
`Cannot read properties of undefined (reading 'driverAddedMass')`.
