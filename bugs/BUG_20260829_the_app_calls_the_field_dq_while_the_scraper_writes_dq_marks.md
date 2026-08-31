# The app calls the field `dq`, the scraper writes `dq_marks` — 140 real marks are never read

Status: OPEN

## Symptom

Every data-quality mark the scraper produces is invisible to the app. `dqIssues()` returns an
empty list for every driver in the corpus, and always has.

## Evidence, gathered 2026-08-29

- The scraper writes **`dq_marks`**: `record_registries.py:727` declares `class DqMark`, and
  `model_driver.py:1513-1517` orders the emitted keys `kind, severity, rule, params, …,
  detail, grounds, dq_marks`.
- The corpus carries them. Probing `drivers-bundle.json` across all 1970 records:
  - spec-entry keys present: `origin` 36178, `readings` 36178, `corroboration` 36178,
    `definition` 36178, **`dq_marks` 137**
  - **140 marks total — 103 `kind: calc`, 37 `kind: range`**
  - spec entries carrying a key named `dq`: **0 of 36178**
  - metadata fields carrying a key named `dq`: **0 of 19362**
- The app declares **`dq`**: `openisdDriver.ts:132` (`SpecEntry`) and `:151` (`ScrapedField`),
  both REQUIRED, no `?`.
- Its readers are written defensively — `openisdDriver.ts:803` and `:812` both do
  `for (const mark of f.dq ?? [])` — so an absent key yields `[]` with no error.

## Cause

One concept, two names. The wire format says `dq_marks`; the TypeScript says `dq`. Nothing
reconciles them, so the read resolves to `undefined` and the `?? []` fallback turns that into
an empty list — indistinguishable from a driver with no quality problems.

Two things kept it hidden:

1. **`?? []` makes absence look like cleanliness.** An absent key and a clean driver produce
   the identical value, so no reader can tell them apart.
2. **The type is stricter than the data and was never checked against it.** `dq` is declared
   REQUIRED while no record has ever carried it. TypeScript did not report this because the
   bundle's 1893-entry `files` array is large enough that it widens to `any[]` in the JSON
   import, and `any` satisfies any declared shape silently.

## Impact

140 data-quality marks — the scraper's own findings about 137 spec entries — never reach the
user. `dqIssues()` has no callers today, so nothing visibly regressed; the DQ badge in the
driver list reads `quality`/`recordStandingIsOk` instead, which IS populated
(`fields_with_issues` non-empty on 142 records). So the loss is of detail, not of the badge.

The type-level half is the more dangerous part: `OpenISDDriverJson` does not describe the
records the app loads, and the type checker cannot say so.

## Fix

NOT APPLIED. John ruled on the direction 2026-08-29 and it is larger than a rename:

- `driver.yml` (scraper output) carries ONLY scraper-discoverable findings — structural,
  parse and source issues.
- `openisd.yml` and `winisd.wdr` are to be produced by the **OpenISD app**, not by Python.
- `openisd.yml` carries BOTH kinds, in SEPARATE FIELDS: the scraper's findings and the
  calculated ones.
- Calculated marks are computed at BUNDLING time, not at startup, because the driver list
  shows a DQ flag before a driver is opened.

Under that architecture the current `dq` declaration is wrong in name AND in ownership, so
renaming it now would encode the old pipeline. The name is settled as part of that work.

Whatever lands, `?? []` must not be the only guard: an absent key and an empty list must not
read the same, or the next producer/consumer mismatch is equally silent.

## Verification

Not yet verified — no fix applied. When applied: a record carrying `dq_marks` must surface
them through the app's reader, and a test must FAIL when the wire name and the declared name
diverge (fail-on-purpose, so the gate is known non-vacuous).
