# A `.wdr`'s `c`/`roo` cannot be verified on round trip when the environment isn't the app default

**Status:** RESOLVED.
**Found:** 2026-09-07, John.

## Symptom

`drivers/sample/winisd/driver-with-semicolons-and-hash.wdr` (a real WinISD-authored `.wdr`) stores
`c=337.499069083998` and `roo=1.98282575313586`. `test/winisd/wdr-openisd-round-trip.test.ts`
recomputes `c`/`roo` independently and asserts agreement with the file's stored values — for this
file it disagrees (recomputed `c=343.6826980479399`, `roo=1.2009621215255684`), because the
recompute uses the app's default environment (`DEFAULT_T_REF_K=293.15`, `DEFAULT_P_REF_PA=101325`,
`DEFAULT_RH_REF_PCT=30` — `packages/design/engine/air.ts:75-77`), not the environment the file was
actually created under (`T=283.15`, `p=161325`, `RH=35`, confirmed by John and verified: recomputing
at those values reproduces the file's stored `c`/`roo` exactly).

## Cause

A driver-only `.wdr` (`[Driver]` section, no `[Box]`/environment section) has no field for
temperature, pressure or humidity. WinISD itself never writes one — the environment lives in the
app's session settings at save time, not in the file. Once saved, the environment that produced
`c`/`roo` is gone; nothing in the file can recover it, and a recompute against any other
environment (including our own defaults) will disagree with the stored values with no way to tell
whether the disagreement is a real bug or a lost environment.

## Fix direction

Same mechanism as `BUG_20260907_driver_type_has_no_wdr_slot_so_every_loaded_driver_becomes_a_woofer.md`:
`Comment=` is the one field real WinISD round-trips opaquely, so it is the only place additional
data can survive a real-WinISD-mediated round trip.

Convention (decided 2026-09-07): append `[ENV T=<kelvin> p=<pascal> RH=<percent>]` to `Comment=`
recording the environment `c`/`roo` were computed under. On read, if this tag is present, use its
values for the recompute-agreement check instead of the app defaults. A file without the tag falls
back to today's behaviour (recompute against the app defaults) — the fix is additive, not a
required key, since real WinISD will never write this tag itself.

On write: when OpenISD's own `.wdr` writer (`packages/design/winisd/winisdDriver.ts`) saves a
record whose environment is not the app default, append the `[ENV ...]` tag the same way
`commentWithDq()` appends `[DQ]` lines, so a round trip through our own writer stays verifiable
without a human doing this by hand.

`drivers/sample/winisd/driver-with-semicolons-and-hash.wdr`'s `Comment=` has been hand-annotated
with `[ENV T=283.15 p=161325 RH=35]` recording the real environment John supplied, ahead of the
parser existing — this lets the round-trip test be fixed once the reader honours the tag.

## Fix

`WinISDDriver` (`packages/design/winisd/winisdDriver.ts`) reads and writes the tag itself:

- `WinISDDriver.build(header, cells, dqLines, env?)` takes an optional `WdrEnv` and appends
  `[ENV T=<K> p=<Pa> RH=<%>]` to `Comment=` on `toWdrIni()`, same mechanism as `commentWithDq`.
  No `env` argument, or a `base` comment already carrying the tag, leaves the text unchanged.
- `WinISDDriver.fromWdrIni()` parses `[ENV ...]` out of `Comment=` into `.env()`.
- `wdr-openisd-round-trip.test.ts` uses `.env()` (via `envTagOf`, now redundant with the class's
  own parsing — kept as the test's own comparison logic) to compare `c`/`roo` against WinISD's
  air model at the recorded environment instead of the app default.
- `OpenISDDriver` and `openIsdDriverToWinIsdDriver()` are untouched — see
  `BUG_20260907_openisddriver_has_no_internal_environment_override.md` for the separate,
  unimplemented idea of feeding this into production driver behaviour.

## Verification

- `test/winisd/wdr-env-tag.test.ts` — 7 tests: `build()` writes the tag when given an `env` and
  omits it otherwise; `fromWdrIni()` parses it back; a tag already present in `Comment=` survives
  `fromWdrIni → toWdrIni` without being duplicated.
- `test/winisd/wdr-round-trip.test.ts` — byte-for-byte format test, 1409 tests including this
  fixture, unaffected: a real WinISD file's plain `fromWdrIni → toWdrIni` never calls `build()`
  with a new `env`, so the hand-added tag round-trips unchanged.
- `test/winisd/wdr-openisd-round-trip.test.ts`'s `driver-with-semicolons-and-hash.wdr` case
  passes without an entry in `FIELD_DISAGREEMENT_EXCUSED`.
- Made the guard fail on purpose: removed the `ENV_TAG.test(base)` check in `commentWithEnv`,
  confirmed `wdr-env-tag.test.ts` and `wdr-round-trip.test.ts` both go red on duplicated tags,
  restored, confirmed green (1409/1409 in `test/winisd/`).
