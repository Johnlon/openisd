# BUG_20261007_reads-from-sheet-readers-not-accepted

**Status:** FIXED ON BRANCH `reads-schema`, NOT MERGED (overnight rule: no openisd schema change lands on main
until John says so).

## Symptom
winisd_tools' sheet readers keep every reader's read of a datasheet cell in a `reads` field on the reading
(winisd_tools `brain/DESIGN_20261007_sheet_reader.md`, "reads contract"). openisd's strict reading schema refuses a
record that has it, and nothing derives reader agreement from it.

## Fix
- `reader.ts`: the `Reader` set (six wire values, `isOcr`).
- `openisdSchema.ts`: `readingJsonSchema` gains an optional `reads` (reader to `{actual_reading, read_value,
  read_precision}`); a read with no number has both null; unknown readers, an empty `reads`, a precision without a
  value and any stored agreement are refused.
- `corroboration.ts`: `readerVerdict(reads)` derives AGREE / DISAGREE / SINGLE and `unverified` (every numbered
  read is OCR), pairwise through the existing `readingsAgree`; no second formula, nothing stored.
- `winIsdDriverConverter.ts`: a datasheet reading whose readers disagree raises a warning showing every reader's
  read, beside the existing "sources disagree" warning; a reading only OCR readers read raises a warning that no
  text layer confirmed it.

## PROVISIONAL choices (reversible, made overnight)
- DISAGREE is a `warn` in the converter's DriverError list. The levels there are only `error` and `warn`.
- A value that only OCR readers read is a `warn` too, naming the OCR readers and saying no text layer confirmed
  it (John's read-both rule, relayed by lots). How the UI shows it beyond the warning is open.
- Reader order for naming the disagreeing pair and for the warning is `Reader.ALL`'s order (text layer first).
- A `reads` read with `read_value` null is not a side and does not count toward SINGLE/AGREE.

## Verification
`packages/design/test/domain/reader-verdict.test.ts` (the contract's three examples, John's 7.4/7.47 and 5/5.7),
`reads-schema.test.ts`, `packages/design/test/winisd/driverYmlReads.test.ts`. The design domain and winisd
directories and the architecture checks pass (2283 tests); typecheck clean. Passed 2026-10-07.
