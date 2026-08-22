# openisd.yml format changes — the consolidated inventory (for the regeneration work)

Every ruled/landed change to the record format, gathered 2026-08-22 from the release run's
rulings (`questions.yml` QT47/QT48/QT49/QT56/QO42/QO65), bugs, and the release plan
(`docs/plans/PROMPT_RELEASE_HARDENING.md`). The MODEL changes are all landed in winisd_tools
(commit `16492ffc` and earlier); the CORPUS lags until the single B10 re-emission. Hazard H1:
the regeneration runs ONCE, after everything below is in — never per-change.

## Format changes the re-emitted records will carry

1. **SI dimension keys** (B5b, CRITICAL — bug
   `BUG_20260819_record_stores_dimension_fields_in_mm_litres_instead_of_si.md`): the 10
   dimension fields move from mm/litre-named keys to SI keys. The TS reader
   (`OpenISDDriver.fromJsonRecord`) reads SI names only, no remap shim exists or is
   permitted; pre-B10 reads of old records are lossy by design. B10 pre-flight: VERIFY the
   emitter writes SI (the B5b "emitter writes SI" check was folded into B10, not separately
   verified).
2. **Three new optional meta fields** (B1, QO42): `provided_by`, `comment`, `added` — emitted
   when present; `added` constrained to ISO `yyyy-mm-dd`; ordered after `surround_material`.
3. **Renames** (B3, QT49): `dq_status` → `corroboration` (enum values
   MATCH/MISMATCH/NOT_MATCHABLE/UNMATCHED, serialised as plain strings), `dq` → `dq_marks`.
   Old keys are INVALID (`extra="forbid"`) — on-disk records currently fail conformance for
   this, expected until B10.
4. **Nullable readings** (B2+B5, QT48/QT56): `read_value`/`read_precision` may be null,
   licensed ONLY by `rejected: no-numeric-value`; a numberless printed literal ("N/A",
   "TBD"…) is now KEPT verbatim in `actual_reading` with null numerics. The openisd
   READ-SIDE change rides B10: a null `read_value` spec entry reads back as Provenance **N**
   (NotAvailable), never Entered (QT56 refinement, human verbatim in the ledger).
5. **Disposition derived** (B4, QT47): records store the new fact `no_ts_published`
   (bookkeeping bool); `disposition` is derived (no_ts_published wins; else
   missing|parse_errors → incomplete; else ok) and re-serialised. A supplied `disposition:`
   is silently ignored at load — TOLERANCE THAT MUST DIE WITH B10 (QT58, open: post-B10 it
   becomes a refused input).
6. **No calculated marker** (QT56 ruling): the `grounds` proposal is retired; a
   pipeline-computed `read_value` is UNREPRESENTABLE (construction-surface gate in
   winisd_tools). No new key.
7. **Discriminator spelling** (D7, QO65): `driver_type: value: passive_radiator` (snake) is
   the only spelling — ALREADY migrated on disk (154 live records, script
   `scrapers/bin/fix_passive_radiator_spelling.py`); B10 re-emission preserves it.
8. **Definition-text refresh** (the cohort-lag bug,
   `winisd_tools/bugs/BUG_20260821_emitted_records_lag_the_openisd_model_and_the_cohort_needs_re_emission.md`):
   3,989 records carry the retired manufacturer `definition` string; every stamped
   `definition:` re-emits from the current registry (2,026 records currently fail
   db-conformance on this — the headline symptom B10 clears).
9. **`name` field: dead** (B1 spin-out): no record carries it, the registry entry is deleted,
   and the TS-side declaration awaits deletion
   (`openisd/bugs/BUG_20260821_openisd_name_field_declared_but_inert.md`).
10. **Brand-primary definition** (QO34/QO42): fixed in source; lands via the regeneration.

## Open items that could still touch the format — settle BEFORE B10

- **QT59 (OPEN, human):** single-source N/A — a `SpecEntry` whose ONLY reading is numberless
  cannot exist (`origin` must name a usable reading), so the printed fact is dropped in the
  single-source case, QT48's motivating scenario. If ruled representable (optional origin /
  a no-usable-reading state), that is a format change and must precede B10.
- **QT57 (closed, delegated verdict):** `rating` derivation-or-deletion — MEASURE first
  (including the crosscheck mutation axis); if deleted, that removes a key. Lands with/after
  B10 per the verdict; deleting pre-B10 avoids a second touch.
- **QT58 (open):** the `disposition=` refusal — post-B10 by definition.

## Out of scope for the record format

- `db/_datasheet_archive/**` keeps its frozen second-shape records
  (`winisd_tools/bugs/BUG_20260821_archive_records_carry_disposition_in_a_second_shape.md`)
  — no load path reaches them; B10 does not touch the archive.
- `.wdr`/`.wpr` projections compute artifact-only values (Dd from Sd etc.) — never written
  into records.

## Sequencing constraints for whoever runs the regeneration (B10)

1. All model changes above are landed (they are, at winisd_tools `16492ffc`+).
2. QT59 ruled (or explicitly deferred by John with the loss accepted).
3. Pre-flight: verify the emitter writes SI dimension keys on a fixture before the corpus run.
4. ONE run over the full live corpus (`regenerate-records` skill has the exact command).
5. Done-criteria (from the release plan's B10): 0 records with the retired brand string; a
   random regenerated record loads through `OpenISDDriver.fromJsonRecord` with ZERO dropped
   fields (all 10 dimension fields under SI keys); new meta fields present; pytest +
   db-conformance green. Then B11 rebuilds the openisd bundle (note the
   `bundle-drivers.mjs` specSection hazard recorded on B11's checklist row).
