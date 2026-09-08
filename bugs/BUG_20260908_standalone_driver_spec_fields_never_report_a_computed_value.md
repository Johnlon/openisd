# A driver's spec fields never report a computed value, so every derived T/S parameter reads as absent

Status: RESOLVED

CRITICAL because it silently withholds values the app has: a driver stating Vas and Sd reports
Cms as unavailable, and the same holds for every derivable parameter. Anything reading a spec
field off an `OpenISDDriver` — the picker's spec summary, the driver editor, `.wdr` export,
consistency checking — sees a blank where a number exists. The failure is silent: the field
answers `not-available`, which is indistinguishable from a driver that genuinely states nothing.

## Symptom

A driver stating Fs, Vas, Sd and Mms reports Cms unavailable, though the solver has two routes
to it. Probed 2026-09-08 against `OpenISDDriver.fromConformingRecord`, printing every spec
field whose state is not `not-available`:

```
Cms before clear {"value":null,"state":"not-available"}
Fs_hz entered 30
Vas_m3 entered 0.05
Sd_m2 entered 0.02
Mms_kg entered 0.05
numVC calculated 1
VCCon calculated parallel
c_m_per_s calculated 343.6826980479399
roo_kg_per_m3 calculated 1.2009621215255684
```

Every `entered` field is one the record states. The only `calculated` fields are the four with
bespoke getters. No solver-derived quantity appears.

## Evidence

`f()` — the builder for every numeric spec field (`packages/design/domain/openisdDomain.ts:823`)
— reads the record and stops:

```ts
const f = (key: SpecFieldName): Field<number> => new Field<number>(
    () => {
        const stated = record.get().specs[section]?.[key];
        const v = winningValue(stated);
        return v === null ? {value: null, state: 'not-available'} : {value: v, state: 'entered'};
    },
```

There is no call to the solver in that getter, and no other route by which a solved value could
reach it. Contrast `numVC` (line 870) and the wiring field (line 797), which DO compute:

```ts
return v === null ? {value: calcNumVC(), state: 'calculated'} : {value: v, state: 'entered'};
```

The relation itself is present and correct in the solver
(`packages/design/engine/solver.ts:193`), so nothing is missing at the physics layer:

```ts
if (r.Cms_m_per_N == null && r.Vas_m3 != null && r.Sd_m2 != null && r.Sd_m2 > 0) setVal('Cms_m_per_N', r.Vas_m3 / (driverRho(r) * driverC(r) * driverC(r) * r.Sd_m2 * r.Sd_m2));
```

`solverQuantitiesOf` (line 1199) already gathers all 40-odd fields for the engine, so the
gathering half exists; only the write-back into the fields is absent.

## Cause

The generic spec field was built to read the record only. The four fields that needed a computed
answer each grew their own getter instead, so the gap in `f()` was never visible: a reader
checking `numVC` or the air constants sees computed values and concludes the mechanism works.

`CellState`'s third value, `'calculated'`, is therefore unreachable for every field built by
`f()` — the type declares a state the code cannot produce.

## Fix

Ruled by John 2026-09-08 (QO127): **a spec field with no stated value reads THROUGH the
solver.** His words:

> "yes a field whose value is nto provided in the domain is obvipously not-available BUT if any
> such fielf is calculable then reading it should hit the solver automativally - NOTHING is
> supposed to call the solver indepencenly and write to the domain THAT WOUDK BE A BUG"

So `f()`'s getter, on finding no stated value, asks the solver: `calculated` when the solver
derives one, `not-available` when it cannot. Solved values are NEVER written back into the
record — the "solve on write" shape is rejected outright, so only stated values reach the wire
and provenance survives a save unchanged.

Solving per `get()` would run a full fixpoint per field, so the solve is memoised against the
record's current value and recomputed when the record changes. That is a cache of a pure
function of the record, not a second copy of the driver's state.

Applied in `packages/design/domain/openisdDomain.ts`:

- `SOLVED_BY` — a frozen table naming, for each record spec key, the solver quantity it is. A key
  absent from it has no relation and stays `not-available`.
- `solvedNow()` inside `OpenIsdDriverSpec`'s constructor — solves this section's stated values,
  memoised against the record's current value, so a `record.set` anywhere invalidates by identity.
- `f()`'s getter — stated value wins and reads `entered`; otherwise the solver's answer reads
  `calculated`; otherwise `not-available`.

Nothing writes back, so only stated values reach the wire.

## Verification

`npx vitest run packages/design/test/domain.test.ts` — five new tests under "a spec field the
record does not state reads through the solver", watched failing first (Cms `not-available`),
then passing. 67/67 green.

Both halves made to fail on purpose and restored:

- derivation removed from `f()` → "Cms comes back calculated from the stated Vas and Sd" went red;
- cache invalidation disabled (`if (solvedFor !== null) return solved`) → "changing a stated input
  changes what the derived field reports" went red.

Each half is caught by a different test, so neither can rot unnoticed.

`packages/ui/test/logic/persist.test.ts` "E stays E and C stays C across save → JSON → restore"
now sets up a genuine C field and passes — its `calculated` precondition was previously
unreachable.
