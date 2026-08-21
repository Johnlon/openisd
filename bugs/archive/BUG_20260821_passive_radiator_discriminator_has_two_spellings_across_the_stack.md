Status: RESOLVED

# `passive-radiator` vs `passive_radiator` — one discriminator, two spellings, and OID accepts both

## Symptom

The driver-type discriminator existed in two spellings, and the model tolerated both, inside
`sectionFor()` in `packages/model/src/openisdDriver.ts`:
`if (t === 'passive-radiator' || t === 'passive_radiator') return 'passive_radiator';`

A value that answers to two names is two shapes of one concept — the alias mechanism the
workspace rules ban outright (human, 2026-08-21: "it si a bug if we have mutlipel pr values
here").

## Evidence (measured at filing, 2026-08-21 — see Fix/Verification for the post-fix counts)

- The dual-accept branch, inside `sectionFor()` (line anchor no longer valid — the branch is
  deleted; see Fix item 3).
- The record corpus: an initial sample of **76 records** carried `driver_type` `value:
  passive-radiator` (kebab); zero carried `passive_radiator`. A full re-count during the fix
  (Fix item 2) found the live corpus was larger than this sample: 78 `driver.yml` + 76
  `openisd.yml` (154 files).
- winisd_tools kept TWO vocabularies BY DESIGN — `SpecSectionName`'s section key was snake
  (`passive_radiator`) while `DriverType.PASSIVE_RADIATOR.value == "passive-radiator"` was
  kebab, documented at the time as "Two closed sets" (that docstring is deleted; see Fix
  item 1). That design is what put the second spelling into every emitted record.

## Cause

The section-key vocabulary (snake) and the driver-type vocabulary (kebab) were allowed to
differ, so the boundary code in OID papers over the difference with a dual-accept — coercion
standing in for one canonical spelling.

## Fix (ruled — human, 2026-08-21, QO65)

1. winisd_tools (`scrapers/scrapers/lib/driver_type.py`): `DriverType.PASSIVE_RADIATOR.value`
   is now `"passive_radiator"`, retiring the "two closed sets" split so the `specs:` section
   key and the driver-type wire value share one spelling. The TS mirror
   (`openisd/packages/ui/src/driverType.ts` `DriverType.PassiveRadiator`) was updated in the
   same change to keep `test_driver_type_enum_parity.py` green (its regex widened to
   `[a-z0-9_-]+` to admit the one underscore member).
2. `winisd_tools/scrapers/bin/fix_passive_radiator_spelling.py` — a one-shot script — rewrote
   every live `db/datasheets/**/driver.yml` and `openisd.yml` in `winisd_drivers`, editing ONLY
   the `driver_type: value: passive-radiator` line to `passive_radiator`. **78 `driver.yml`** +
   **76 `openisd.yml`** changed (154 files; measured before/after, not the stale "76" estimate
   above — see Verification). `db/_datasheet_archive/**` (historical snapshots, out of
   `datasheets_root()`) was correctly left untouched: 66 archived files still carry the retired
   kebab spelling, which is expected and fine — they are frozen history, not live records.
3. OID (`openisd/packages/model/src/openisdDriver.ts`): the dual-accept at `sectionFor()` is
   deleted; the function is a one-line ternary (`t === 'tweeter' || t === 'passive_radiator' ?
   t : 'woofer'`). A kebab `driver_type` no longer resolves to the `passive_radiator` section —
   it silently falls to `woofer`, so a PR record's own stated fields (living in
   `specs.passive_radiator`) read as not-available. New tests in
   `packages/model/test/openisdDriver.test.ts` pin both directions. The UI-side scan gate
   (`packages/ui/test/ui/driver-type-chips.test.ts`, "no raw driver_type string literals in
   comparisons") no longer excludes `DriverType.PassiveRadiator` — its value collided with the
   unrelated `AlignmentKind` string `'passive-radiator'` only while both were kebab; now that
   the driver-type value is `passive_radiator`, the collision is gone and the gate covers it
   like every other member.

## Verification

- `winisd_tools`: `pytest scrapers/tests/lib/test_driver_type_field.py
  scrapers/tests/lib/test_wdr_projection.py scrapers/tests/lib/test_generation.py
  scrapers/tests/sbacoustics/test_sbacoustics.py scrapers/tests/scanspeak/test_scanspeak.py
  scrapers/tests/seas/test_seas.py scrapers/tests/purifi/test_purifi.py
  scrapers/tests/wavecor/test_wavecor.py
  scrapers/tests/wavecor/test_pr_fs_freeair_from_mass_series.py
  scrapers/tests/wavecor/test_pr_fs_mms_label_variants.py
  scrapers/tests/test_driver_type_enum_parity.py scrapers/tests/dayton_audio/test_da_emit.py
  scrapers/tests/tangband/test_tang_band.py` — 155 passed. pyright 0 errors on every touched
  file.
- `winisd_drivers` db: `grep -rl "value: passive-radiator" db/datasheets` returns zero files
  (was 111 `driver.yml` + 109 `openisd.yml` = 220 across the WHOLE `db/` tree including
  archive; 78 + 76 = 154 in the live `datasheets_root()` tree, which is what the script
  touched).
- All 78 fixed `driver.yml` were re-validated through `DriverFile.from_yaml()`: 74/78 pass
  cleanly; 4 fail, but every failure is pre-existing, unrelated schema drift (`extra_forbidden`
  on a `dq`/`Vas` field, one "manufacturer: definition is not the canonical schema text" —
  confirmed unrelated: a random 20-file control sample of NON-PR `driver.yml` fails
  identically) — none concerns `driver_type`/`passive_radiator`. All 76 fixed `openisd.yml`
  were re-validated the same way (openisd.yml has no `from_yaml`; it is normally only ever
  built by `OpenIsdYmlFile.from_metadata(DriverFile)`, so this validated it directly via
  `yaml.safe_load()` + `OpenIsdYmlFile.model_validate()`): 0/76 pass cleanly, but every one of
  the 76 failures is the SAME pre-existing `dq_status`/`dq` schema-drift noise, none concerning
  `driver_type`/`passive_radiator`. The fix itself is confirmed correct on both sides; the
  noise is orthogonal, already present in the tree before this task
  (`scrapers/bin/fix_passive_radiator_spelling.py` runs both validation passes and reports
  them).
- `openisd`: `grep -rn "passive-radiator" packages/model/src` returns nothing.
  `npx vitest run packages/model` — 58/58 passed. `npm run typecheck:model` — 0 errors.
  `npm run typecheck:ui` currently fails, but on an UNRELATED pre-existing line
  (`packages/ui/src/logic/store.ts:83: Cannot find name 'ctx'`, inside uncommitted WIP already
  present in the working tree before this task) — confirmed unrelated by reverting only this
  task's own edits and re-running: the same error persists. `driver-type-chips.test.ts` could
  not be run standalone for the same reason (its import chain reaches `store.ts`); its edits
  were verified by inspection instead.
