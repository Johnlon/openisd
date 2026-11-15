# BUG_20261115_provenance-view-cannot-show-a-refused-sibling-reading

**Status:** OPEN (feature; written up for the lead to schedule)

## Symptom
QO934: when the maker's other source supplied a value because one source's reading was refused as impossible, a user looking at
that field in the app should be able to see the event and why. The app cannot show it.

## Steps to reproduce
1. Open the driver editor on dayton-audio/cfc150-8 and look at Le (provenance / field note). Its `driver.json` holds
   `manufacturer_datasheet "0.55 mH"` (used) and `manufacturer_product_page "-0.55 mH @ 1 kHz"` (refused as below the physical limit).
2. Same for wavecor/tw030wa21 Fs: sheet `750 kHz` (refused), page `750 Hz` (used).
3. Observed: only the value (E, 0.00055 / 750) and its precision. Expected: "the page printed -0.55 mH, which is not possible; the
   datasheet's 0.55 mH is used".

## Evidence
- `packages/ui/src/logic/provenance.ts` is the editor's provenance: a static map of formula paths per field (`Fs_hz`: five
  formulas from other fields). It knows no source, reading or refusal. `grep -rn "readings\|read_value\|actual_reading"
  packages/ui/src packages/design/fields` finds no reading anywhere in the editor or the field notes.
- The projected `openisd.json` entry of an entered field is `{"precision": 5e-06, "state": "E", "value": 0.00055}` (QO395, deliberate:
  source, readings and verdict stay in `driver.json`). Only a not-available field (state N) carries `readings`, and
  `rejectedReadingCommentLines` writes them into the `.wdr` comment.
- So the app, holding only openisd.json, has the winner but not the refused sibling: it cannot show the event from what it has.

## Smallest change
Without changing the projection schema, give the converter a note on the field: when a field is entered and a sibling reading was
refused, `#projectParsedEntry` already sees both. It raises no line today (a refused reading is skipped). It would emit one
`dq`-style NOTE (not a warning; the ratchet counts only warnings) per field: `Le: manufacturer_product_page printed "-0.55 mH @ 1 kHz",
below the physical limit 1e-6 H; manufacturer_datasheet "0.55 mH" is used` (limit from the same `rangeIssue`). The editor's
field note would show it by reading notes by field key, as it already reads `dq` text. That reaches the .wdr comment and
dq.alert; the in-app editor only sees it if the record carries it, and the record carries only the schema above. The honest
smallest in-app change is therefore a schema addition (an optional `refused: [{role, actual_reading, reason}]` on an entered
entry), which needs John's ruling per QO395. Choose between the converter note (no schema change, tools only) and the schema
field (in-app).

## Verification
Load cfc150-8 and tw030wa21 in the editor; the Le and Fs field notes name the refused reading and the source used.
