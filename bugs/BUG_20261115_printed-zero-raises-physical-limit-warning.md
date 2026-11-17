# BUG_20261115_printed-zero-raises-physical-limit-warning

**Status:** FIXED by T823 (QO935)

## Symptom
A datasheet that prints an exact zero for a physically positive field (Accuton C51-6-286 prints Mms "0 g") has the field marked
not available, yet the record's `dq.alert` still carries "Mms_kg: moving mass (Mms) 0 is below the physical limit 0.000010."
John, QO935 (2026-11-15): "the Accuton zero + a zero is same as not provided surely". A zero is not provided, so there is no
value to be out of range.

## Steps to reproduce
1. `cat winisd_drivers/snapshot/datasheets/accuton/c51-6-286/dq.alert`: Cms, Mms and Rms "0 is below the physical limit" lines.
   Same in accuton/p173, volt/vm754, dayton-audio/pa165-8, tang-band/w0-2008s: 27 such lines in 9 records.
2. Project a `driver.json` whose `Mms_kg` reading is `read_value: 0` (`driver-dq-range-calc.test.ts`, "an exact printed zero").
3. Observed: `errors` holds the physical-limit warning. Expected: none.

## Cause
`driverRecordConverter.ts` `#projectParsedEntry` range-checks every usable raw reading through `Engine.driver.rangeIssue`, which
deliberately does not special-case 0 (`physicalRange.ts`: a raw reading of 0 is "a failed extraction" for selection). The
solve-time `checkRange` skips 0; the converter's own raw-reading loop did not, so a reading already refused as a value still
raised a warning.

## Fix
The raw-reading loop skips `read_value === 0`. Selection still refuses the zero (`isPhysicallyPlausible`), so the field stays
not available. A negative figure in a positive field is still reported.

## Verification
`bash scripts/test.sh packages/design/test/winisd/driver-dq-range-calc.test.ts`. On the snapshot, 27 lines in 9 records fall
away; the data-quality ratchet allows a fall.
