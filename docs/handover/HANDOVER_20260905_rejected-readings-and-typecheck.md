# Handover — 2026-09-05 — rejected readings/metadata origin + typecheck cleanup

## Done, committed (`fbcc905`)

Bridge (`packages/design/winisd/driverYmlToOpenisdAndWdr.ts`) now strips two more things
before emitting `openisd.yml`, on top of the pre-existing `scraper_meta`/`definition` strips:

- **`origin` from named metadata fields** (`manufacturer`, `brand`, `model`, `driver_type`,
  `series`, `nominal_size_cm`, `product_image`, `description`, `surround_material`,
  `provided_by`, `comment`, `added`) — `stripMetadataOrigin()`. Spec-entry `origin` and
  `sku.grounds[].origin` are untouched — those still need it.
- **An entire REJECTED reading**, not just its `rejected` key, from a spec entry's `readings`
  map — `stripRejectedReadings()`. A `rejected` reading (`RejectedRead` enum, `model_driver.py`)
  is scraper diagnostic evidence for a human, never a value the app should see.

`openisdRecordSchema.ts`: removed `origin` from `scrapedFieldOf` (the metadata envelope).
Spec-entry `readingJsonSchema`/`specEntryJsonSchema` unchanged — already correctly modelled.

Design reasoning recorded in `drivers/drivers.md` Part A, all attributed John 2026-09-05.

TDD: new test in `driverYmlToOpenisdAndWdr.test.ts` using a real corpus fixture
(`test/fixtures/corpus/scanspeak-15w-4424g00.driver.yml`, copied from the live corpus — genuine
multi-source `Re` field with one OCR-misread reading marked `rejected:
ohm-glyph-merged-as-digit`). All 16 tests in that file pass.

`model_driver.py`: comment-only additions on `ScrapedField.note`/`Reading.note` explaining
they're populated only for SPL with the `MeasurementNote` enum. **Do not rename this field or
move it off `Reading`/`ScrapedField`** — `unlike_conditions()` in `crosscheck.py` depends on it
staying per-reading to detect cross-source SPL-condition disagreement (TODO.md Q25(b)/Q30).
Explored and reverted both a rename (`measurement_condition`) and a top-level-field redesign
this session; John's final ruling: keep the name `note`, comment only.

Regression fixed: removing `origin` from `scrapedFieldOf` broke ~90 tests via shared `scraped()`
fixture helpers in `domain.test.ts`, `engine-wiring.test.ts`, `persistence.test.ts`,
`workspace.test.ts` — each one-line fixed (`{value, origin}` → `{value}`).

Also fixed while unblocking the commit's lint/typecheck gate (all confirmed real defects, not
peer WIP):
- `packages/design/domain/project.ts` — unused `WinISDDriver` import, deleted.
- `packages/ui/src/ui/components/DriverEditorModal.vue` — two literally corrupted import lines
  (stray text pasted into the middle of import paths), fixed. Still imports from the deleted
  `@openisd/model` elsewhere in the file — out of scope, not touched.
- `packages/design/test/winisd/wdr-import-fidelity.test.ts` — fully rewritten off the defunct
  `OpenISDDriverJson.fromWinISDDriver()`/`Provenance.Entered`/`.SPLCell()`/`.toWinISDDriver()`
  API onto the current one (see pattern below). All 5 tests pass.

Committed with `git commit --no-verify` — explicit one-time user exception ("COMMIT NO VERIFY
THEN CONTINUE FIXING") because typecheck had ~26 pre-existing errors outside the changed files.
**This bypassed the `pre-commit` hook** (lint+unit+golden) for this one commit only; nothing
after this should skip it.

## Not done — typecheck still red, ~26 errors, none in files touched this session

User's ruling: **fix these too, one category at a time, report after each, never implement a
missing API — only rewrite tests onto whatever already exists in `@openisd/design`.**

### The working API pattern (already proven, use it for all remaining rewrites)

```ts
import { WinISDDriver } from '@openisd/design/winisd';
import { conformingRecordToDriver, type OpenISDDriver } from '@openisd/design';
import { Engine } from '@openisd/design/engine';
import { winISDDriverToOpenISDDeviceJson } from '../../domain/openisdRecordSchema.js';
import { openIsdDriverToWinIsdDriver } from '../../winisd/driverYmlToOpenisdAndWdr.js';

function driverOf(wdr: string): OpenISDDriver {
  const { record } = winISDDriverToOpenISDDeviceJson(WinISDDriver.fromWdrIni(wdr));
  const driver = conformingRecordToDriver(record, new Engine());
  if (Array.isArray(driver)) throw new Error(`fixture is not a valid driver: ${driver.join(', ')}`);
  return driver;
}
// read a field:
driver.spec[driver.section].SPL_dB.get()   // → {value, state: 'entered'|'calculated'|'not-available', origin?}
// export:
const wdr = openIsdDriverToWinIsdDriver(driver, new Engine(), []);
wdr.toWdrIni();
```

`Provenance` is now `z.enum(['entered','calculated','not-available'])` — a plain string type,
no `.Entered`/`.Calculated` runtime enum. Use the literal strings.

### Category 1 — 4 files still import the deleted `@openisd/model` package

`winisd-parity.test.ts`, `winisdDriver-diff.test.ts`, `wdr-to-openisd-record.test.ts`,
`wdr-model-coverage.test.ts`. Confirmed (grep on `project.ts`, empty result) there is NO
equivalent of `toJsonRecord`/`FsCell`/`QtsCell`/`fromJsonRecord` anywhere in `@openisd/design`
under any name — these need full rewrites onto the pattern above, not import-path fixes.
Start with `wdr-to-openisd-record.test.ts` (smallest, already fully read this session).

`wdr-model-coverage.test.ts` additionally calls `WinISDDriver.missingKeys` and imports
`CellState` from `../../winisd/parstate.js` — neither exists. Same "don't invent" rule applies;
find what the test should actually assert instead, or report if nothing covers it.

### Category 2 — `Engine.deriveEngineDriver` missing

`air.test.ts`, `engine.test.ts` (3 call sites), `filter-chain-charts.test.ts`. Not started.
Do not implement this method — find the existing `Engine` method the test should call.

### Category 3 — `wdr-model-coverage.test.ts`'s `CellState`/`missingKeys`

Overlaps Category 1's fourth file; same file, same rule.

### Category 4 — narrower type mismatches, not started

- `domain.test.ts` — `Qts` missing-in-type errors, lines 140, 362.
- `advanced-figures.test.ts` — `Record<string, number>` cast issue.
- `boxDesign.test.ts` / `engine.test.ts` — optional-vs-required drift.
- `golden.test.ts` — `verbatimModuleSyntax` type-only import issue.
- `winisd-parity.test.ts:358` — argument-count mismatch.
- `wdrDiff.ts:28` — `'N'` comparison type error.

## Open ledger items (unrelated to this work, still pending ack)

QO98, QO99, QO100, QT73 undecided; QO87, QT75 deferred. QO99 (openisd owns openisd.yml/wdr,
driver.yml is scraper-only) is closely related to this session's work — worth reviewing next.

## Multi-agent note

3 peer sessions were live throughout. Uncommitted changes to `solver.ts`, `winisdDriver.ts`,
`parstate.ts`, `wdr-openisd-round-trip.test.ts`, etc. in `git status` are peer work-in-progress,
not part of this handover — do not commit them as part of continuing this work.
