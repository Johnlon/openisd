# The bundler and round-trip-gate scripts import free functions that no longer exist

Status: RESOLVED

## Symptom

Every test exercising `scripts/bundleProjection.mjs` or `scripts/roundTripGate.mjs` fails:

```
TypeError: (0 , conformingRecordToOpenIsdDriver) is not a function
```

Ten failures across `packages/ui/test/persistence/bundle-drivers-disposition.test.ts` (5 of 5) and
`packages/ui/test/persistence/round-trip-gate.test.ts` (5 of 6).

The bundler itself runs these functions — `bundle-drivers.mjs` imports `bundleProjection.mjs` —
so the driver bundle cannot be rebuilt either.

## Evidence

`scripts/bundleProjection.mjs:6` and `scripts/roundTripGate.mjs:20`:

```js
import { conformingRecordToOpenIsdDriver, conformingRecordToOpenIsdPassiveRadiatorStandalone } from '@openisd/design';
```

`packages/design/domain/index.ts` exports neither name — its value exports are `VoiceCoilWiring`,
`OpenISDDriver`, `OpenISDProject`, `OpenISDPassiveRadiatorStandalone`, `projectRepo`. An ES module
named-import of a missing binding is not a load error here because both importers are `.mjs`
resolved against the package's built entry, so the binding arrives `undefined` and fails only when
called.

## Cause

The `packages/model` → `packages/design` migration turned both free functions into static methods:

- `conformingRecordToOpenIsdDriver(record, engine)` → `OpenISDDriver.fromConformingRecord(record, engine)`
  (`openisdDomain.ts:1071`)
- `conformingRecordToOpenIsdPassiveRadiatorStandalone(record, engine)` →
  `OpenISDPassiveRadiatorStandalone.fromConformingRecord(record, engine)` (`openisdDomain.ts:1549`)

Both keep the same signature and the same `T | string[]` return. The two `scripts/*.mjs` callers
were not updated. They are plain JavaScript outside every `tsconfig`, so all three package
typechecks stayed green while the calls were broken — the failure was only ever visible by running
the tests.

## Fix

Both scripts import `OpenISDDriver` and `OpenISDPassiveRadiatorStandalone` and call
`.fromConformingRecord(record, engine)`.

## Verification

`npx vitest run packages/ui/test/persistence/bundle-drivers-disposition.test.ts
packages/ui/test/persistence/round-trip-gate.test.ts` — watched failing with the `TypeError`
above, then passing.
