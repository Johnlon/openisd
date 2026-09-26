# BUG_20260926_impedance-includes-rg-when-rg-is-not-at-driver-side

**Status:** OPEN

## Symptom

With "Rg is at driver side" off, OpenISD's impedance chart still includes the amplifier's
source resistance Rg. WinISD's does not. On the W5-1138SMF sealed case at Rg 0.1 Ω, OpenISD
reads 3.5000 Ω at 20 kHz and WinISD reads 3.4000 Ω. At Rg 10 Ω the gap is 10 Ω.

## Evidence

WinISD 0.7.0.950, unmodified, values logged by the debugger at every chart point
(`winisd_research/scripts/gdb_log_chart_points.py`). VCInd on, 1 Hz–20 kHz, 2086 points. The
option byte "Rg is at driver side" (project+0x53) is read back from memory at every point,
and so is Rg (project+0x38).

| Rg (Ω) | Driver side | WinISD Z @1 Hz | @115.6 Hz | @20 kHz | OpenISD Z @1 Hz | @115.6 Hz | @20 kHz |
|--------|-------------|---------------:|----------:|--------:|----------------:|----------:|--------:|
| 0      | off         |         3.4217 |    4.8773 | 42.8481 |          3.4199 |    4.6935 | 42.8487 |
| 0      | on          |         3.4217 |    4.8773 | 42.8481 |          3.4199 |    4.6935 | 42.8487 |
| 10     | off         |         3.4217 |    4.8773 | 42.8481 |         13.4185 |   14.0998 | 44.7662 |
| 10     | on          |        13.4201 |   14.2476 | 44.7656 |         13.4185 |   14.0998 | 44.7662 |

- WinISD, driver side off: Rg changes nothing. The Rg 0 and Rg 10 curves are identical to the
  last bit.
- WinISD, driver side on: Z = Z(off) + Rg, exactly, at every point (largest complex difference
  0.0).
- OpenISD adds Rg in both positions.
- The 115.6 Hz gap in the Rg 0 rows (4.88 vs 4.69 Ω) is the driver-parameter difference in
  [BUG_20260926_winisd-driver-mode-substitutes-mms-only](BUG_20260926_winisd-driver-mode-substitutes-mms-only.md),
  not Rg.
- ⚠ unverified: what "Rg is at driver side" does to WinISD's SPL, excursion and other acoustic
  curves. Only the impedance chart was logged.
- OpenISD was set up by importing the same `.wpr`, then setting `Rs_ohm` and `rgAtDriverSide`
  by hand. The `.wpr` import drops `[SignalSource] Rg`
  ([BUG_20260926_wpr-import-drops-source-resistance-and-simulator-options](BUG_20260926_wpr-import-drops-source-resistance-and-simulator-options.md)).

Records (`winisd_research/runs/`, validated):
[sweep-w5-sealed-impedance-rg0-vcind1-driverside-off](http://localhost:8000/winisd/winisd_research/runs/sweep-w5-sealed-impedance-rg0-vcind1-driverside-off.json),
[sweep-w5-sealed-impedance-rg0-vcind1-driverside-on](http://localhost:8000/winisd/winisd_research/runs/sweep-w5-sealed-impedance-rg0-vcind1-driverside-on.json),
[sweep-w5-sealed-impedance-rg10-vcind1-driverside-off](http://localhost:8000/winisd/winisd_research/runs/sweep-w5-sealed-impedance-rg10-vcind1-driverside-off.json),
[sweep-w5-sealed-impedance-rg10-vcind1-driverside-on](http://localhost:8000/winisd/winisd_research/runs/sweep-w5-sealed-impedance-rg10-vcind1-driverside-on.json).
Write-up:
[PROBE_W5_SEALED_20260924.md §3.1](http://localhost:8000/winisd/openisd/docs/research/PROBE_W5_SEALED_20260924.md?html).

## Cause

`packages/design/engine/circuit.ts:140-145`. With `rgAtDriverSide` true, Rg goes into `Rdc1`.
With it false, `arrayCoil` adds `cx(Rg, 0)` to the array's coil impedance. Either way `Zel`
contains Rg. WinISD's impedance routine (0x45e740) adds Rg (project+0x38) only when the
"Rg is at driver side" byte is set.

## Fix

The impedance chart (`Zel`) excludes Rg when `rgAtDriverSide` is false. This probe does not
test the acoustic curves (SPL etc.), so this fix leaves them as they are.

## Verification

A unit test on a one-driver sealed case at Rg 10 Ω: `zmag` at 20 kHz equals |Re + jωLe| with
the flag off and |Re + Rg + jωLe| with it on.
