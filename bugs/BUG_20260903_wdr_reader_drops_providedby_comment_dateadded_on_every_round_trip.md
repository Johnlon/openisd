# `winISDDriverToOpenISDDeviceJson` drops ProvidedBy/Comment/DateAdded on every .wdr -> record read

**Status:** FIXED by file-spec in `openisdRecordSchema.ts` (`providedBy`/`comment`/`dateAdded` now
read at lines 353-355). Verified 2026-09-04: `npx vitest run
packages/design/test/winisd/driverYmlToOpenisdAndWdr.test.ts` — 15/15.
**Found:** 2026-09-03, running the T1 -> W2 -> I3 -> driver -> W3 -> T2 chain John asked for
(`docs/design/WDR_LOGIC.md`-style round trip, implemented in `roundTripProblems`/`wdrDriverDiffs`,
`packages/design/winisd/driverYmlToOpenisdAndWdr.ts`).

## Symptom

Any `.wdr` whose `ProvidedBy=`, `Comment=` or `DateAdded=` line is non-empty fails the extended
round trip: reading it into a record and writing that record back out produces empty values for
all three, every time.

## Evidence

Minimal record: `provided_by: 'A Community Contributor'`, `added: '2026-09-01'`. First write (W1)
correctly produces `ProvidedBy=A Community Contributor` and `DateAdded=2026-09-01`. Reading that
`.wdr` back (`winISDDriverToOpenISDDeviceJson`) and writing the resulting driver out again (W3)
produces `ProvidedBy=` and `DateAdded=` — both lost.

## Cause

`packages/design/domain/openisdRecordSchema.ts`, `winISDDriverToOpenISDDeviceJson` (~line 306):

```ts
const brand = named(wdr.headerField('brand'));
const model = named(wdr.headerField('model'));
const manufacturer = named(wdr.headerField('manufacturer'));
```

Only three of the six header fields are read. `wdr.headerField('providedBy')`,
`wdr.headerField('comment')` and `wdr.headerField('dateAdded')` are never called, so the returned
`OpenISDDeviceJson` has no `provided_by`, `comment` or `added` — the record schema then treats
them as never stated.

## Impact

Every `.wdr` a person or WinISD writes with any of these three fields populated loses them the
moment anything reads that file back through this function. `docs/design/WDR_LOGIC.md` §"Loading
.wdr INI text into OpenISD" documents the ParState fields' load rules in detail but says nothing
about the six header fields on the read side — the write side ("Non-ParState fields") is
documented, the read side is not, and this is the gap.

## Not fixed here

`openisdRecordSchema.ts` is another session's (`file-spec`) active file — flagged to them rather
than edited, per John's standing instruction not to write a parallel version of their conversion
methods.

## Verification when fixed

`npx vitest run packages/design/test/winisd/driverYmlToOpenisdAndWdr.test.ts` — "the .wdr survives
text -> WinISDDriver -> record -> driver -> WinISDDriver -> text" and "STRIPS definition" and
"projects an APP-AUTHORED record" all currently fail on this; they should pass once the three
header fields are read.
