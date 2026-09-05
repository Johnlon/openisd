# `Sd` marked `calculable: false` in `INI_ROWS_META` — a derived `Sd` exports as `E`, never `C`

**Status:** OPEN.

## Symptom

`test/winisd/wdr-openisd-round-trip.test.ts`'s `s-dd.wdr — N slots stay N unless something was
actually derived` fails: slot 17 (`Sd`) goes `N -> E` with its value unchanged, when the correct
transition (per the test's own stated design intent) is `N -> C`.

## Evidence

`drivers/sample/winisd/s-dd.wdr` — a real WinISD-written file — states only `Dd=123`; every
other numeric field including `Sd` is `N` (`ParState` slot 17 is `N`), confirming real WinISD
does not derive `Sd` from `Dd` at all.

`drivers/sample/winisd/s-sd.wdr` — the mirror case — states only `Sd=0.0123`; `Dd` (slot 21) is
also `N` there, confirming the relationship is symmetric in WinISD: neither field is derived
from the other.

`packages/design/test/winisd/wdr-openisd-round-trip.test.ts:189-192` states this as design
intent: *"`N` -> `C` is legitimate on its own: our solver is more complete than WinISD's, and it
fills slots WinISD left alone — `s-dd.wdr` derives `Sd = π·(Dd/2)²` from an entered `Dd`... both
correctly."* openisd deriving `Sd` where WinISD does not is the intended behavior; only the mark
is wrong.

`packages/design/winisd/winisdDriver.ts:87`: `{key: 'Sd', calculable: false}`, while its sibling
`Dd` (`:92`, `{key: 'Dd', calculable: true}`) — the same derivation relationship in the other
direction — is correctly `true`. Same mechanism as the already-fixed `Rme` defect
(`BUG_20260905_rme_marked_noncalculable_in_ini_rows_meta.md`):
`driverYmlToOpenisdAndWdr.ts:557-559` marks a solver-derived value `calculated` only when its
key is in `WINISD_CALCULABLE`, else `entered`.

## Cause

`Sd`'s `calculable` flag is `false` while `Dd`'s — the same relationship, reversed — is `true`.
Nothing in the spec or in WinISD's observed behavior distinguishes the two; the flag appears to
be a data-entry slip in the 48-row table, matching the `Rme` defect's shape exactly.

## Impact

Every `.wdr` openisd writes for a driver that states `Dd` but not `Sd` (or vice versa via the
same asymmetry, if `Dd`'s derivation from a stated `Sd` also depends on this path) marks the
derived value `E` instead of `C`, silently claiming a human typed a number our own solver
produced.

## Not fixed here

Flip `calculable: false` -> `true` at `winisdDriver.ts:87`, matching `Dd`.

## Verification when fixed

`test/winisd/wdr-openisd-round-trip.test.ts`'s `s-dd.wdr` and `s-sd.wdr` "N slots stay N unless
something was actually derived" tests pass with slot 17/21 correctly showing `N -> C`.
