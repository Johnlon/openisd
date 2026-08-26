# B10 sample verification — the orchestrator's personal check (John's standing order)

John, verbatim: "run a full emit sweep on the drivers to put them into shape then you check a
sample of the output". This is that check's protocol, fixed BEFORE the sweep so the pass/fail
bar cannot drift to fit the output.

## The ten records (spanning every ruled change)

1. `grs/8pf-8` — the stale-`ok`-with-evidence exemplar (stored `disposition: ok` against
   `missing: ['BL','Mms']`); post-sweep: NO disposition key at all.
2. `accuton/bd20-5-048` — the stale-`incomplete` twin (its `is_incomplete_for_ui` detail text
   came from a rule deleted from python weeks ago).
3. `accuton/c25-6-013` — the bridge-validated record; cross-check its re-emitted form still
   feeds the bridge cleanly.
4. A multi-source MATCH record — `corroboration: MATCH` present, plain string; `dq_status`
   ABSENT; readings under both roles.
5. A multi-source MISMATCH record — `corroboration: MISMATCH` + the registered mark in
   `dq_marks` (not `dq`).
6. A rejected-N/A reading record — `actual_reading` verbatim, null-free omission of
   `read_value`/`read_precision`, per the ruled scenario shapes (value/origin/corroboration
   co-presence honoured).
7. One of the 61 no-Fs records — ships, conforms, and `driverHasDqIssues`-style derivation
   flags it.
8. A passive radiator — `driver_type: value: passive-radiator` (hyphenated, the only spelling).
9. A record that carried `voice_coil_dia_mm` — now `Vcd:` in METRES (value = old mm ÷ 1000,
   spot-arithmetic checked), plus `OuterX`/`OuterY` where the old x/y pair existed.
10. A dual-voice-coil record — wiring-config readings intact through the migration.

### Rows 4–10 instantiated (orchestrator, pre-migration corpus probes, 2026-08-22)

Selected by read-only greps over `/home/john/work/winisd/winisd_drivers/db/datasheets`
BEFORE the migration ran, so the choice cannot chase a favourable output:

4. `scan-speak/32w-8878t11` — carries `dq_status: MATCH` today (becomes `corroboration`).
5. `scan-speak/d2908-716000` — carries `dq_status: MISMATCH` today.
6. `faitalpro/10fh500-4` — carries an `N/A`-class `actual_reading`.
7. `eminence/apt-200` — one of the no-Fs cohort (no `Fs:` key in the file).
8. `tang-band/pr01` — passive radiator.
9. `grs/8fr-8` — carries `voice_coil_dia_mm` today (38.1 → Vcd 0.0381, precision
   1.27 → 0.00127); also `grs/pt2522-4` for the `outer_x_mm`/`outer_y_mm` pair. NOTE:
   pt2522-4's stored outer values are INCHES under mm names (pre-existing scrape defect,
   `winisd_tools/bugs/BUG_20260822_grs_outer_x_y_store_inches_under_mm_named_fields.md`)
   — the row asserts the migration's ×0.001 arithmetic on the stored number (3.5 →
   0.0035) and `actual_reading` verbatim; the wrong magnitude is that bug's business,
   not a migration defect.
10. `visaton/gf-200-2-x-4-ohm` — dual-voice-coil wiring readings.

## Per-record assertions (every one, all ten)

- NO `disposition`, `no_ts_published`, `dq_status`, `dq:` (as the marks key), or any
  mm/litre-named dimension key. `dq_status` anywhere = MIGRATION defect (pre-agreed).
- `corroboration`/`dq_marks` present where evidence exists; enum values as plain strings.
- The ten dimension fields (where present) under WinISD-SI names with SI values.
- New meta fields (`provided_by`/`comment`/`added`) present where sourced, ordered after
  `surround_material`; `added` ISO `yyyy-mm-dd`.
- `definition:` texts match the CURRENT registry (the 3,989-record cohort-lag headline).
- The record parses through `OpenISDDriver.fromJsonRecord` equivalent (via the bridge or a
  vite-node probe) with ZERO dropped fields.
- `readings` blocks present per the single-entry-legal ruling; `read_precision` carried where
  a printed literal existed (feeds the QO84 port later).

## Corpus-level assertions

- Counts: records in == records out; the migration's before/after per debt class reported.
- `grep -rl "dq_status\|voice_coil_dia_mm\|driver_volume_l\|outer_x_mm"` over the corpus → 0.
- db-conformance suite GREEN (the 3,981 standing reds die here — that suite going green is
  B10's single loudest success signal).
- The emit-seam mandate is EXPLICITLY ABSENT (expected-fields 23-vs-39 awaits John) — records
  are NOT padded with mandatory empty entries; that lands as its own later change.

## Output

A verdict per record and per corpus assertion, evidence quoted (the audit rule: the test, not
the conclusion), appended to this file. FAIL on any assertion = the sweep does not stand; the
defect routes to its owner (migration vs emitter vs bridge) before any re-run — H1 means a
repeat sweep needs the same one-pass discipline, not casual re-runs.

## VERDICTS — orchestrator's personal check, 2026-08-22, post-migration

Method: mechanical walker (`scratchpad/b10_sample_check.py`, proven non-vacuous by a
pre-migration run that FOUND every debt class in these same files) over all sample records,
both file types, plus targeted reads quoted below. Migration run: 2012 driver.yml + 1969
openisd.yml fixed, 0 validation failures, 0 disk-reload failures (executor's run output).

Per-record — ALL ELEVEN FILespairs PASS the walker's three checks: banned/old keys NONE;
`actual_reading` multiset byte-identical to my pre-migration snapshots; corroboration plain
strings under the Q31 names. Targeted assertions:

1. `grs/8pf-8` — old keys (24 pre) → NONE. NOTE: `quality.disposition` was present PRE and
   is gone POST in the walker output — see the disposition note below.
2. `accuton/bd20-5-048` — old keys (9 pre) → NONE. ✓
3. `accuton/c25-6-013` — migrated openisd.yml through the REAL V8 bridge
   (`python -m scrapers.lib.openisd_js …`): `errors: []`, well-formed `[Driver]` .wdr. ✓
4. `scan-speak/32w-8878t11` — `corroboration: MATCH` ×7, plain strings, no dq_status. ✓
5. `scan-speak/d2908-716000` — `corroboration: MISMATCH` ×2; NO `dq_marks` — the
   PRE-migration file carried `dq_status: MISMATCH` with no `dq:` key at all (snapshot
   grep quoted: lines 80/132, zero `dq:` hits), so there was nothing to rename. The
   protocol's row-5 mark expectation was wrong about THIS record, not the migration.
   The dq→dq_marks rename is proven instead by record 10 (gf-200 carries
   `specs.woofer.SPL.dq_marks` post-migration). ✓ (amended evidence)
6. `faitalpro/10fh500-4` — reclassified: its `actual_reading: 15.5 N/A` is BL in
   newtons-per-ampere (a REAL unit, = T·m), not a rejected reading. The ruled
   value-less rejected-entry shape does not exist in the corpus yet — it lands with the
   B-lane scenario implementation (QT59/QT71), so row 6 is UNTESTABLE today and passes
   vacuously. ❔ untested (no exemplar exists; not a migration defect)
7. `eminence/apt-200` — no `Fs:` key, record conforms (db-conformance green incl. this
   file). ✓
8. `tang-band/pr01` — `driver_type: value: passive-radiator`, and its section key is
   `specs.passive-radiator` (re-verified 2026-08-23 after the hyphen ruling). ✓
9. `grs/8fr-8` — Vcd `read_value: 0.0381`, `read_precision: 0.00127` (exact ÷1000 of
   38.1/1.27), `actual_reading: '1.5'` verbatim. `grs/pt2522-4` — OuterX `0.0035`/`5.0e-05`
   from 3.5/0.05, reading `'3.5'` verbatim (magnitude wrongness = the recorded GRS inch
   bug, carved out above). ✓
10. `visaton/gf-200-2-x-4-ohm` — wiring-config entry intact with definition text, plus
    the corpus's exemplar `dq_marks` key. ✓

Definitions: `grs/8fr-8` `manufacturer.definition == FIELD_DEFINITIONS['manufacturer']`
verified in-process against the live registry (`True`). Restamp count: manufacturer ×3981 —
matching the drift scan's exactly-one-field finding.

Corpus-level: all twelve old dimension keys + `dq_status` + `dq:` grep to ZERO as KEYS.
A substring sweep finds 90 residual mentions — ALL inside stored `parse_errors`/warning
STRINGS quoting old field names in diagnostic prose (e.g. "…not recognised for field
'voice_coil_dia_mm'"); scrape-time data, refreshed on next scrape, not keys and not
migration scope. db-conformance: 3983 passed / 0 failed — TWO independent runs (executor's,
and the orchestrator's own: `pytest tests/test_db_conformance.py -q` → "3983 passed,
3953 warnings in 143.43s").

Disposition note: rows 1–2 asserted "NO disposition key"; the walker shows
`quality.disposition` present PRE and absent POST for 8pf-8 — that removal happened in this
pass; the migration script does not touch disposition, so the removal came through the
canonical writer: `model_driver.py:912` declares `disposition` with `exclude=True` and
`_derive_disposition` recomputes it from evidence (QT47 — a record can never carry a stored
disposition), so the one write drops the stale stored key by construction. Verified against
the model source, not inferred. Accepted — this is exactly the stale-`ok` cleanup row 1 was
designed to catch.

**VERDICT: the migration STANDS.** One row untestable (6 — no exemplar shape exists yet),
every other assertion green with quoted evidence.

## VERDICTS — post-sweep sample check, 2026-08-23

Method: mechanical walker over all eleven sample driver.yml files (banned keys anywhere in
the mapping tree; corroboration/dq_marks shape; EVERY `definition:` text compared in-process
against the live registries — `FIELD_DEFINITIONS`, the `SpecField` enum, `SCRAPER_META_KEYS`
in `record_registries.py`; quality block; readings/read_precision), plus targeted reads and
a real V8 bridge run, evidence quoted per row.

Per-record:

1. `grs/8pf-8` — banned/old keys NONE; no `disposition` anywhere; `quality.missing:
   [BL, Mms]` (driver.yml:9); 19 spec entries, 19 readings all with `read_precision`;
   all definitions match the live registry. ✓
2. `accuton/bd20-5-048` — banned keys NONE; no incomplete/disposition residue; definitions
   current. ✓
3. `accuton/c25-6-013` — openisd.yml through the REAL V8 bridge
   (`python -m scrapers.lib.openisd_js …`): `errors: []`, well-formed populated `[Driver]`
   .wdr (Fs=1294, Re=6.46, Qts=0.88). ✓
4. `scan-speak/32w-8878t11` — `corroboration: MATCH` ×7, plain strings, no dq_status;
   Fs (driver.yml:61–77) carries readings under THREE roles, all 21.0. ✓
5. `scan-speak/d2908-716000` — `corroboration: MISMATCH` ×2 (Fs :76, Qts :128), plain
   strings; no `dq_marks`, matching row 5's amended evidence above. ✓
6. `faitalpro/10fh500-4` — BL (driver.yml:137–145) `actual_reading: 15.5 N/A`,
   `read_value: 15.5` — still the N/A-unit reading; no value-less rejected-entry exemplar
   exists in the corpus. ❔ untested (no exemplar shape exists)
7. `eminence/apt-200` — no `Fs:` key (grep count 0); `quality.missing: [Fs, Re]` gives the
   derivation its basis; conforms (db-conformance green incl. this file). It has NO
   openisd.yml/.wdr (one of 95 such dirs), so the "ships" half is ❔ untested. ✓ / ❔
8. `tang-band/pr01` — `driver_type: value: passive-radiator` (driver.yml:39–40); specs
   section key `passive-radiator`. ✓
9. `grs/8fr-8` — Vcd (driver.yml:199–207) `actual_reading: '1.5'` verbatim,
   `read_value: 0.0381`, `read_precision: 0.00127` — the expected values exactly.
   `grs/pt2522-4` — OuterX (:155–164) `actual_reading: '3.5'` verbatim but
   `read_value: 0.0889` = 3.5 in × 25.4 / 1000, NOT this row's pre-registered 0.0035:
   the carved-out GRS inch bug is marked Fixed 2026-08-22 in
   `winisd_tools/bugs/BUG_20260822_grs_outer_x_y_store_inches_under_mm_named_fields.md:44`
   (`plugins/grs/emit.py:230-233`, `unit_when_unprinted="in"`), so the sweep re-scraped
   with correct inch conversion; OuterY 2.66 → 0.067564 = 2.66 × 25.4 / 1000, consistent.
   ✓ (row's expected number superseded by the recorded bug fix; arithmetic verified
   against the fix)
10. `visaton/gf-200-2-x-4-ohm` — wiring entry intact: `specs.woofer.VCCon`
    (driver.yml:206–215), reading `'2'`, value 2.0, full definition text; numVC adjacent;
    definitions current. ✓

Corpus-level:

- Banned keys as keys (`dq_status`, `voice_coil_dia_mm`, `driver_volume_l`, `outer_x_mm`,
  `outer_y_mm`, `no_ts_published`, `disposition`) grep → 0 files; SUBSTRING sweep for the
  same names → 0 hits (the 90 parse_errors-prose residuals are gone, refreshed by the
  scrape sweep).
- db-conformance: `pytest tests/test_db_conformance.py -q` → 4035 passed, 0 failed in
  375.64s.
- Counts: 2064 driver.yml on disk, all 2064 mtime 2026-08-23; 1969 openisd.yml, all
  2026-08-23. Records-in == records-out is ❔ untested read-only (corpus gitignored, no
  pre-sweep snapshot).
- Emit-seam padding absent as required: apt-200/pr01 carry empty specs sections, not
  padded mandatory entries.
- New meta fields (`provided_by`/`comment`/`added`): 0 files corpus-wide contain
  `provided_by`; ordering/ISO assertions ❔ untested (no sourced instance exists).

Observations (routed, not protocol failures):

1. `.wdr` files were NOT re-emitted: 1893 `winisd.wdr` on disk, 0 dated 2026-08-23
   (e.g. `grs/8pf-8/winisd.wdr` mtime 2026-08-03). The bridge produces correct .wdr live
   (row 3); the on-disk .wdr set is stale relative to the sweep.
2. gf-200 carries no `dq_marks`: the 2026-08-22 verdicts above quote
   `specs.woofer.SPL.dq_marks` as the exemplar; the file now has zero `dq` mentions. The
   mechanism is alive elsewhere — 14 seas driver.yml files carry `dq_marks`
   (e.g. `seas/fa22rcz/driver.yml:132`, structured `kind`/`severity` entries). Correct
   re-derivation vs regression is ❔ untested read-only (no pre-sweep file to diff).
3. gf-200 SPL parse defect candidate: `read_value: 1.0` (dB) from
   `actual_reading: (1) 85 dB (1 W/1 m)(2) 88 dB…` (driver.yml:183–184), with
   `quality.fields_with_issues: []` and no mark — scrape-extraction scope, routes to the
   extractor owner.

**VERDICT: all testable assertions PASS — 0 failures.** Untested: row 6 (no exemplar),
records-in/out count, meta-field ordering, apt-200's "ships" half; observations 1–3 above
routed to their owners.
