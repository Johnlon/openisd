# `driverName.ts` is dead code, and holds five of the repo's open casts

Status: RESOLVED 2026-09-09

## Symptom

`packages/design/test/architecture-no-casts.test.ts` lists 23 casts awaiting a ruling. Five of
them — more than a fifth of the total — are in one function:

```
packages/ui/src/driverName.ts:20  brand as string
packages/ui/src/driverName.ts:20  manufacturer as string
packages/ui/src/driverName.ts:22  model as string
packages/ui/src/driverName.ts:26  series as string
packages/ui/src/driverName.ts:32  raw.name as string
```

That function has no consumer in the application:

```
$ command grep -rn "driverShort" packages/ui/src packages/ui/test
packages/ui/src/driverName.ts:16:export function driverShort(...)
packages/ui/test/persistence/driver-search-name.test.ts:3:import { driverShort } from '../../src/driverName.js';
```

One import, and it is the function's own test. (`driverName` — the name that DOES appear across
`OriginalShell.vue`, `appState.ts` and `useApplicationIO.ts` — is an unrelated computed declared
at `packages/ui/src/logic/appState.ts:254`.)

## Cause

`driverShort` takes `Record<string, unknown>` — a raw record bag — and reaches into it field by
field, which is where all five casts come from:

```ts
export function driverShort(raw: Record<string, unknown> | null | undefined): string {
  const { brand, model, manufacturer, series, sku } = raw;
  const lead = (brand as string) || (manufacturer as string);
```

The driver picker used to name rows this way. It no longer does: `displayNameOf(driver)` in
`packages/ui/src/logic/driverDisplay.ts` reads `brand`/`model` off the domain object through its
`Field` accessors, so nothing is asserted and no record bag is passed. The old function was left
behind when the picker moved over.

## Impact

Five casts stand in the ledger for the human to rule on, in code that cannot affect the running
app whichever way they are ruled. Deleting the file settles a fifth of the list without a
judgement call about type safety.

The dead function is also a live trap: it is exported, so the next person naming a driver may
call it and reintroduce record-bag reads the domain accessors exist to prevent.

## Fix

Delete `packages/ui/src/driverName.ts` and its test
`packages/ui/test/persistence/driver-search-name.test.ts`.

No behaviour changes: nothing in `src/` calls it. `displayNameOf` already carries the naming
rule, and `packages/ui/test/logic/driverDisplay.test.ts` already tests it — including the
brand-leads and either-half-alone cases the deleted test covered.

John, 2026-09-09: "delete dead files drivername.ts".

## Verification

Both files deleted.

```
npx vue-tsc -p packages/ui --noEmit                              0 errors
npx vitest run packages/design/test/architecture-no-casts.test.ts
  23 casts -> 18: every driverName.ts row is gone from the list
```

Nothing in `src/` referenced `driverShort`, so no call site needed changing. The naming rule it
held is covered by `displayNameOf` and `packages/ui/test/logic/driverDisplay.test.ts`.
