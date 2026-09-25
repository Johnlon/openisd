# sectionFor sends `amt` records to the empty woofer section — every T/S read silently zero

## Symptom

The V8 bridge (and any `OpenISDDriver` read) returns zero/absent for EVERY spec field of
the five Beyma TPL records (`driver_type: amt`), with `errors: []` — a silent hollow
projection, found by the whole-corpus bridge differential
(winisd_tools `bugs/BUG_20260822_v8_bridge_zeroes_all_ts_fields_for_5_of_11_amt_records.md`).

## Evidence

- Reproduced in the UNMINIFIED source (vite-node probe, 2026-08-22): beyma/tpl-75
  `openisdYamlToWdr` → `errors: []`, `Znom=0 Pe=0 SPL=0 Re=0`; the record carries
  `specs.tweeter.{Znom:8, Pe:40, SPL:92, Re:4.9}`.
- Control: dayton-audio/amt3-4 (`driver_type.value: tweeter`, specs also under `tweeter`)
  projects correctly (`Znom=4 Pe=25 SPL=93 Re=3`) through the identical chain — isolating
  the discriminator to the `driver_type` value, not the record shape.
- `packages/model/src/openisdDriver.ts:277` `sectionFor`: only `'tweeter' | 'passive-radiator'`
  map to themselves; everything else — including `amt` — reads `'woofer'`. The Beyma records
  have no woofer section, so `#record.specs['woofer'] ?? {}` reads empty, and every getter
  answers N/absent with no error.
- The corpus side of the convention, `winisd_tools scrapers/lib/spec_emit.py:124`:
  `if driver_type in (DriverType.TWEETER, DriverType.AMT): return Specs(tweeter=section)` —
  AMT files under `specs.tweeter` by design ("HF transducers file under specs.tweeter").

## Cause

Cross-side convention mismatch: the emitter's section rule maps `amt → tweeter`; openisd's
`sectionFor` was written from the three section names and never learned that `amt` is a
tweeter-class TYPE. The five Beyma records are the only corpus records with
`driver_type: amt` (the six Dayton AMTs are typed `tweeter`).

## Fix

`sectionFor` maps `amt` to `'tweeter'`, mirroring `spec_emit.py`'s rule — the two sides
must share one section convention. Red-first test on a real amt-shaped record.

## Verification

- New model test: an `amt` record with `specs.tweeter.Re` reads Re through the driver
  (red before the fix, green after).
- Bridge re-run on beyma/tpl-75 returns the record's real values (Znom=8, Pe=40, SPL=92,
  Re=4.9).
- The B10 sweep is HELD until the fixed bridge artifact is rebuilt and handed to
  winisd_tools — sweeping on the old artifact ships five hollow .wdr projections.
