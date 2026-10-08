# BUG_20261008_non-numeric-reading-is-dropped-or-refused

**Status:** OPEN. Fix is a land.sh task after the admission slot and the decoupling, test first.

## John's rule (2026-10-08)
A reading's `actual_reading` is the text exactly as printed, whatever it is ("N/A", "banana").
A parse failure is a flag on the reading, never a drop. "Missing" means no source printed the
field.

## The shape (lots' ruling, mirrors winisd_tools DESIGN.md: actual_reading + rejected)
A reading is a discriminated union:
- Usable: `{actual_reading, read_value: number, …}`
- Rejected: `{actual_reading?: string, rejected: <reason>}` — no number.

There is no nullable `read_value`. `rejected` today is a free string in `readingJsonSchema`
(`packages/design/domain/openisdSchema.ts:191`); winisd_tools writes `rejected: no-numeric-value`
(DESIGN.md:264). The reason enum must be taken from the winisd_tools contract, not guessed:
**open point:** that contract does not list the enum yet.

## 1. The schema cannot store a Rejected reading
`packages/design/domain/openisdSchema.ts:187`: `read_value: z.number()` is required. A reading
printed "N/A" with no number fails the strict parse. `winIsdDriverConverter.ts:777-785` returns the
entry unchanged on a failed parse, and the next stage rejects the record or skips the entry with
no flag.
Fix: the schema accepts Rejected.

## 2. A .wdr text cell becomes NaN or is not imported
`packages/design/domain/winIsdDriverImport.ts:122-136` (`readSpecEntryInto`): an entered cell with
text writes `read_value: Number(cell.value)`, which is NaN; a `not-available` cell with text is
not imported at all. No flag either way.
Fix: both become a Rejected reading carrying the text.

## 3. A non-finite VCCon is dropped without a trace
`winIsdDriverImport.ts:44-47` (`wdrVCConEntry`): blank or non-finite returns `undefined`.
Pinned by `packages/design/test/winisd/wdr-vccon-numvc-import.test.ts:86`.
Fix: blank = nothing printed, absence is fine (the test stays for blank). Non-finite with text =
a Rejected reading with that text.

## 4. The converter drops readings that carry `rejected`
`winIsdDriverConverter.ts:155` (policy text :140-147): the reading and its rejected text are
lost on conversion.
Fix: keep them with their text. The UI shows the printed text.

## Tests to write first
`rss210ho-8`-style "N/A" and a synthetic "banana", through the schema, the converter, the .wdr
import and the round trip. No test today has `actual_reading` "N/A" / "banana" / "" with no number.

## Doc
State the rule in `docs/FIELD_REFERENCE.md` (a paragraph after line 20) in the same task.
