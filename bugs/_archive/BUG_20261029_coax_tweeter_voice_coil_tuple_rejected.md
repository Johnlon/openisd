# BUG 2026-10-29 — coax tweeter voice-coil tuple is rejected

## Symptom

The scraper CLI Stage 6 projection fails for the genuine SB Acoustics SB15BAC30-8 Coax
record. The bridge emits `Unrecognized key: "voice_coil"` at `specs.tweeter`, so the
record's previous `openisd.json` and `.wdr` remain unchanged. The same record's woofer
tuple is accepted; its tweeter tuple is not.

Source record:
`/home/john/work/winisd/winisd_drivers/db/datasheets/sb-acoustics/sb15bac30-8-coax-aluminum/driver.json`

Failed Stage 6 run:
`/home/john/work/winisd/winisd_drivers/db/runs/2026-10-29T16-49-01Z-1820233/`

Concrete tuple shape: the tweeter contains a Re reading, no BL reading, `basis` values
`unknown`, `numVC: {state: "not-stated"}`, `connection: "not-stated"`, and
`connection_reading: null`. The converter is expected to preserve the raw Re evidence,
leave Re unavailable because its basis is unknown, and remove the scraper-only tuple from
the OpenISD projection.

## Cause

The scraper serializes absent optional `Re_ohm` and `BL_Tm` tuple members as JSON `null`.
The OpenISD tuple schema allowed these members to be omitted, but not `null`; the schema
parse failed for the tweeter tuple and left the scraper-only `voice_coil` key in place.
The strict OpenISD record schema then rejected that key.

## Fix and verification — 2026-10-29

The tuple schema now accepts nullable optional Re and BL members and skips a null member
without inventing an app value. Added a regression from the exact scraper-generated coax
record, asserting the tweeter's unknown-basis Re remains unavailable with its 3.8 Ω source
reading retained and the tuple does not leak into the OpenISD output.

- Converter and bridge tests: 42 passed.
- Design typecheck and targeted ESLint: passed.
- Bridge rebuilt; Stage 6 run `2026-10-29T16-55-30Z-1835274`: both selected records
  projected, zero failed, no attention items. Unknown basis remains a warning and preserves
  raw readings.
- Narrow bundle refresh validated 3/3 records and updated only their public record JSON
  files; unrelated index rows were preserved. The refreshed records passed the app round-trip
  gate and bundled-index test.
