Status: OPEN

# BUG: `drivers/sample/winisd/s-roo.wdr` contradicts the researched c-from-roo recompute rule

## Symptom

`packages/winisd/test/wdr-openisd-round-trip.test.ts` fails on `s-roo.wdr`:

```
c: WinISD 343.684120962152, ours 33.96016317579804
```

## Evidence

`drivers/sample/winisd/s-roo.wdr`:
```
c=343.684120962152      (ParState slot 47 = C — WinISD's own computed value)
roo=123                 (ParState slot 48 = E — user-entered)
```

`driverC()` (`packages/engine/src/driver.ts`), per `docs/design/WINISD_SCHEMA.md` §12 (the
2026-08-19/20 machine-verified c/roo resolution matrix), computes
`c = √(γ·p_ref/roo) = √(1.4·101325/123) ≈ 33.96` when `roo` is present and `c` is not.

WinISD's own stored `c` in this file is `343.684120962152` — the standard-air value — as if
`roo=123` were never consulted at all.

## Cause (not yet established)

Two candidates, neither confirmed:

1. **WinISD clamps/rejects out-of-range `roo`.** `123 kg/m³` is roughly 100x standard air
   density (`1.2`) — physically absurd. WinISD may validate `roo` before using it in the
   `c=√(γp/roo)` recompute and fall back to its default air pair when the value is nonsensical,
   a behaviour the 2026-08-19/20 matrix probe never tested (its distinct-but-plausible markers
   were chosen to be unambiguous, not extreme).
2. **`s-roo.wdr` predates the matrix research** and may not have been produced by the same
   rigorous roo-present/c-absent probe the matrix later ran — it could be an earlier, less
   careful single-parameter probe whose `c` value is stale/wrong for a different reason.

## Fix

Not fixed. Needs a fresh wine-harness probe of `roo` values across a physically-plausible range
(e.g. `0.5`, `1.2`, `2.0`, `123`) with `c` absent, to determine whether WinISD clamps/validates
`roo` before the `c=√(γp/roo)` recompute. Until then, `driverC()`'s recompute formula is treated
as correct for the plausible range the matrix actually tested, and `s-roo.wdr`'s `c` field is
excluded from the automated oracle comparison (see `WRONG_BY_DESIGN`-style exclusion in
`wdr-openisd-round-trip.test.ts`) rather than silently accepted or the formula silently changed.

## Verification

N/A — open.
