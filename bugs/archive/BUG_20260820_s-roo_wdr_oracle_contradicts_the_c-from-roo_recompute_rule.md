Status: CLOSED 2026-10-05 by John's ruling — a driver file's own `c`/`roo` feed no calculation, so no c is recomputed from roo at all.

# BUG: `drivers/mysamples/winisd/s-roo.wdr` contradicts the researched c-from-roo recompute rule

## Symptom

`packages/winisd/test/wdr-openisd-round-trip.test.ts` fails on `s-roo.wdr`:

```
c: WinISD 343.684120962152, ours 33.96016317579804
```

## Evidence

`drivers/mysamples/winisd/s-roo.wdr`:
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

Closed by ruling, not by a probe (John, 2026-10-05): "driver air c and roo should not be used, use
project or project delegate." The recompute `c = √(γ·p/roo)` is deleted with the `DriverAir` class.
Every driver calculation takes one injected `Air`: the project's (T/RH/p through the WinISD air
model), or with no project the app's environment defaults. A record's `c`/`roo` are written back as
that air, marked C, and a `.wdr` export writes them so. `s-roo.wdr` (roo=123) now exports
c=343.684120962152-equivalent reference air, matching WinISD's own stored c; its roo is written as
the air used, not 123.

## Verification

`packages/design/test/domain/driver-air-is-the-projects.test.ts`;
`packages/design/test/winisd/wdr-round-trip-through-driver.test.ts` ("the file's own c and roo are
replaced by the air used") over the sample corpus, `s-roo.wdr` included.
