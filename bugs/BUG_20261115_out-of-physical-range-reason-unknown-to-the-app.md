# BUG_20261115_out-of-physical-range-reason-unknown-to-the-app

**Status:** FIXED by T825 (ruling QO934)

## Symptom
The scraper now refuses a reading that parses outside its field's physical band with `rejected: "out-of-physical-range"` and keeps
the number it read. The app did not know that reason, so each such reading wrote a `dq.alert` line
`unrecognised rejection reason on <role>: "out-of-physical-range" (reading kept as written)`, which is noise and would have
raised Gate A of the driver-snapshot sync.

## Steps to reproduce
1. Take a `driver.json` whose Fs_hz has `manufacturer_datasheet: {actual_reading: "750 kHz", read_value: 750000,
   rejected: "out-of-physical-range"}` and `manufacturer_product_page: {actual_reading: "750 Hz", read_value: 750}`
   (wavecor/tw030wa21).
2. Project it (`driverYmlToOpenisdAndWdr`).
3. Observed: the warning above. Expected: none; Fs 750 Hz entered from the page.

## Cause
`PARSED_REJECTION_REASONS` in `domain/openisdSchema.ts` listed only `ohm-glyph-merged-as-digit`.

## Fix
`out-of-physical-range` is a parsed rejection reason. A refused reading never wins (`isUsable`), keeps its number, raises no
physical-limit line, and the `.wdr` comment of a field left not available names it ("Xlim_m: manufacturer_datasheet 750 kHz —
out-of-physical-range"). No other place turns a reason into words.

## Verification
`bash scripts/test.sh packages/design/test/winisd/driverYmlToOpenisdAndWdr.test.ts`.
