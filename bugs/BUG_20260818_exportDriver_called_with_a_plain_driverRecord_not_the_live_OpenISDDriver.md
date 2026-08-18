# `exportDriver()` called with a plain `_OpenISDDriverJson`, not the live `OpenISDDriver` it declares

## Status
OPEN 2026-08-18 — found via `vue-tsc --noEmit -p packages/ui`; pre-existing, not introduced by
this session's edits (confirmed via `git diff HEAD -- packages/ui/src/logic/useDesignIO.ts`).

## Symptom

```
packages/ui/src/logic/useDesignIO.ts(142,68): error TS2345: Argument of type '_OpenISDDriverJson'
is not assignable to parameter of type 'OpenISDDriver'.
packages/ui/src/logic/useDesignIO.ts(159,68): error TS2345: Argument of type '_OpenISDDriverJson'
is not assignable to parameter of type 'OpenISDDriver'.
```

`useDesignIO.ts`'s `exportWdr()`/`exportWpr()` read `driverRecord.value` (`store.ts:416`, typed
`_OpenISDDriverJson | undefined` — the plain record) and pass it straight to
`WinIsdDriverFileIo.exportDriver(driver: OpenISDDriver)` (`winIsdDriverFileIo.ts:34`), which
declares and needs the live class instance (`driver.toRecord()`, `driver.ebp()` internally).

## Cause

`store.ts` exports `driverRecord` as the plain `_OpenISDDriverJson` (needed for
`serialize()`/`.owdr` export, which genuinely want raw JSON) but has no equivalent export of the
live `OpenISDDriver` instance for callers that need the class, and `ManagedOpenISDProject` has no
public getter for its own driver instance (deliberately — `_OpenISDDriverJson`/`OpenISDDriver`
are private outside 3 named files). `winIsdDriverFileIo.ts` IS one of the 3 permitted files, so
it is allowed to receive the live instance — but nothing in `store.ts` currently hands it one.

## Fix

Not applied. Needs a design decision: either `ManagedOpenISDProject` gains a method that returns
the live driver scoped to `winIsdDriverFileIo.ts` only (a new `PrivateAllow` entry — human
decision per the standing governance rule), or `store.ts` exposes a narrow
`exportWdrRecord()`-style delegating method that calls into `winIsdDriverFileIo.ts` itself rather
than handing the instance out at all. Not resolved here — out of scope for the registry work this
session was doing.

## Verification

Not yet — no fix applied.
