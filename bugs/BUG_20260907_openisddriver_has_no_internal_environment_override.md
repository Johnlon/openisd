# `OpenISDDriver` cannot stay internally consistent with its own stated `c`/`roo`

**Status:** OPEN — idea, not a fix. Not to be implemented without a separate decision.
**Found:** 2026-09-07, John.

## Symptom

`OpenISDDriver.spec[section].c_m_per_s`/`roo_kg_per_m3` fall back to `airFor()` at the app's
default reference conditions (`DEFAULT_T_REF_K=293.15`, `DEFAULT_P_REF_PA=101325`,
`DEFAULT_RH_REF_PCT=30`, `packages/design/engine/air.ts:75-77`) whenever the field's `state`
isn't `'entered'`. A record whose `c`/`roo` were computed at a different real environment (see
`BUG_20260907_wdr_c_roo_environment_not_recoverable_on_round_trip.md`) has no way to make
`OpenISDDriver`'s own getters agree with its own stated values — the driver record and its own
derived fields can disagree, permanently, with nothing to reconcile them.

## Cause

`OpenISDDriver` has no concept of "the environment this record's own `c`/`roo` were computed
under." WinISD has no such concept either — this is not a WinISD parity gap, it is a possible
OpenISD-only addition.

## Possible feature (not decided, not scoped)

Give `OpenISDDriver` an internal, OpenISD-native environment field per driver record (distinct
from `OpenISDEnvironment` on the project, which is what a simulation runs on — see the existing
comment in `packages/design/domain/openisdRecordSchema.ts:144-148`). When present, `c_m_per_s`/
`roo_kg_per_m3` would compute their fallback against that stored environment instead of the app
default, so the record stays internally consistent with itself.

This has no WinISD equivalent and would need its own decision on: whether it belongs on the
driver record at all, how it interacts with the `[ENV]` `.wdr` tag convention, and whether a
`.wdr` round trip should populate it automatically or leave it null until a human enters it.

## Scope note

2026-09-07 ruling: the `[ENV]` tag fix for the round-trip test
(`BUG_20260907_wdr_c_roo_environment_not_recoverable_on_round_trip.md`) is test-only —
`wdr-openisd-round-trip.test.ts` reads the tag for its own comparison. `OpenISDDriver` itself is
untouched. This file records the idea for later; it is not authorization to build it.
