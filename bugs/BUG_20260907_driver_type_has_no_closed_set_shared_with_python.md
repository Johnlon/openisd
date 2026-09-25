Status: DEFERRED

John, 2026-09-07: "park the shared python entirely". The scraper/domain shared `driver_type`
enum is not being built. Any future closed-set work on this field is TypeScript-domain-only;
Python-side parity is out of scope until John reopens it.

## Symptom

`driver_type` is a free string everywhere it is declared or read:

- `packages/design/domain/openisdRecordSchema.ts:415` — `driver_type: textField` (`z.string()`,
  no enum constraint).
- `packages/design/domain/project.ts` — `OpenISDDriver.driverType(): string` returns the raw
  scraped string, unchecked against any closed set.
- The scraper (`model_driver.py` and the `winisd_drivers` scrapers) writes `driver_type.value` as
  a plain string into `driver.yml`, with the same 10 values seen consistently across the corpus
  (`woofer`, `full-range`, `tweeter`, `subwoofer`, `midrange`, `passive-radiator`, `mid-woofer`,
  `coaxial`, `mid-bass`, `amt`), but nothing in the scraper or the TypeScript domain declares
  those 10 values as a closed set either side can check against.

The only closed set that exists today, `packages/design/filter/DriverType`, is explicitly a
UI/search concern (`.chips`, used by `driverDisplay.ts`'s chip-matching) — not a shared
domain/scraper contract, and has no Python counterpart.

## Cause

`driver_type` was modelled as `scrapedFieldOf(z.string())` like `brand`/`model` (free text with no
natural closed set), but unlike those fields, `driver_type` states a closed vocabulary — the
`driver.yml` field comment says so verbatim: `definition: what kind of driver this is (closed
vocabulary); decides which specs section applies`. No enum was ever created to back that
definition, on either side of the scraper/domain boundary.

## Fix

Not yet applied. Needs a closed-set type for `driver_type` that:

1. Is declared once and shared by both the Python scraper/writer and the TypeScript domain
   reader — the two must agree on the member set without copy-pasting it, the way
   `filter/driverType.ts` and `scrapers/tests/test_driver_type_enum_parity.py` already keep
   `DriverType`/`Chip` in parity (`.claude/rules/typescript.md` "Closed sets are enums").
2. Lives in the domain (`packages/design/domain/`), separate from `packages/design/filter/
   DriverType`, which stays a UI/search-only concept (chips, display labels) and must not move
   into `domain/`.
3. `OpenISDDriver.driverType()` returns this domain type; the raw string stays in
   `openisdRecordSchema.ts` (as `textField`) so a scraped value the current member set does not
   yet declare fails to reach the app as a crash rather than reaching a caller unchecked.

Corpus check (`winisd_drivers/db/datasheets/**/driver.yml`, 2266 files): every stated
`driver_type` value already matches one of 10 strings, so a closed set will not reject existing
data — `woofer` 902, `full-range` 335, `tweeter` 320, `subwoofer` 138, `midrange` 134,
`passive-radiator` 78, `mid-woofer` 46, `coaxial` 36, `mid-bass` 19, `amt` 5.

## Verification

Not yet done.
