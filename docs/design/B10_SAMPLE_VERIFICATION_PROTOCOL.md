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
8. A passive radiator — `driver_type: value: passive_radiator` (snake, the only spelling).
9. A record that carried `voice_coil_dia_mm` — now `Vcd:` in METRES (value = old mm ÷ 1000,
   spot-arithmetic checked), plus `OuterX`/`OuterY` where the old x/y pair existed.
10. A dual-voice-coil record — wiring-config readings intact through the migration.

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
