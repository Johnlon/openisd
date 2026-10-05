# BUG_20261005_drive-voltage-each-stale-with-driver-count

**Status:** FIXED 2026-10-05 — John ruled: a stale-update bug copied from WinISD; fix it, no switch.

## Symptom
"Driver input voltage (each)" did not follow the driver count. W5-1138SMF, 1 W: 1.87 V with one
driver and still 1.87 V with four; each driver is fed P/4, so each sees about 0.94 V. An entered
voltage was treated as the array's: 1.85 V "each" at 4 drivers gave 0.98 W, and each driver ran at
0.93 V.

WinISD shows the same stale value (1.8 V at 4 drivers, 1 W; the real one 0.92 V): a linkage bug,
not copied (winisd_research probe nd-1, 2026-10-05). WinISD's SPL, VA and max power already feed
each driver P/N.

## Cause
`driveVoltage_V` held √(P·(Re+Rg)) whatever the driver count, and the engine divided the sweep's
`eg` by √N for each driver.

## Fix
- Signal solve: V_each = √(P/N·(Re+Rg)); an entered V sets P = N·V²/(Re+Rg). The resolve passes
  the driver count, so a count edit recomputes the calculated side.
- The sweep's `eg` is the voltage each driver gets; the engine no longer divides it by √N.
- Engine goldens `sealed-2drv-parallel`, `vented-2drv-series` regenerated: same `eg` now means
  per driver, so SPL +3.01 dB, excursion and port velocity ×√2, VA ×2; nothing else moved.

## Tests
- `packages/design/test/domain/project-signal.test.ts` — readout, entered voltage, count edit, sweep `eg`.
- `packages/design/test/engine/driver-count-winisd.test.ts` — W5-1138SMF sealed, 4.48 L per driver:
  1 W gives 80.532 → 86.552 dB at 1 kHz (+6.02, WinISD); same volts each gives +12.04 dB (WinISD +12.05).
