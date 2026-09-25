# PLAN — retire calc + DQ from the scrapers; the bridge decides

Implements [TODO.md QT39](http://localhost:8000/winisd/winisd_tools/TODO.md?html#L2398) ("100%
retire calc code in python"), [QT41](http://localhost:8000/winisd/winisd_tools/TODO.md?html#L2483)
("the dq rules need to be moved entirely into the openisd app") and the QO84 small fix
(`openisd/questions.yml` QO84, ruled 2026-08-23: seed consistency tolerance from `read_precision`,
`halfUlp` fallback — never landed; evidence `docs/design/QO84_PRECISION_NECESSITY.md`). QO87 (full
interval-algebra port) stays "not now" — this plan does NOT do it. John lifted the QT41 "future
work" hold on 2026-09-24 and approved this scope: *scraper presents scraped facts only — readings from
reads and OCR — no decisions and no DQ; origin selection, corroboration, calc and range DQ are the
bridge's job, using the engine.*

Two work packages, two repos, two agents, two worktrees, worked in parallel:

| Package | Repo | Branch from | Doc section |
|---|---|---|---|
| WP-T | `winisd_tools` | `main` | §4 |
| WP-O | `openisd` | `refactor` | §5 |

Every judgement call is decided in §3. Do not ask; follow §3. If §3 does not cover something and
the code gives no answer, stop and write the question into your final report — do not guess.

---

## 1. Read first

Both agents:

- This document, whole.
- `~/.claude/CLAUDE.md` and the repo's `CLAUDE.md` / `AGENTS.md`. Hard rules repeated in §7.

WP-T additionally:

- `winisd_tools/AGENTS.md` §"No legacy code", §"No legacy records", §"One model version",
  §"Reuse first", §"Schema discipline", §"Never regenerate more than the change affects",
  §"No full rebuilds".
- `winisd_tools/scrapers/scrapers/lib/semantic_dq.py` (whole — this is what you are deleting;
  its interval arithmetic is what WP-O ports).
- `winisd_tools/scrapers/scrapers/lib/crosscheck.py` lines 175–337.
- `winisd_tools/scrapers/scrapers/lib/model_driver.py` lines 237–300 (`Reading`), 420–510
  (`SpecEntry`), 937–1060 (`readings_agree`, `unlike_conditions`, `verdict_for`,
  `compute_quality_summaries`), 1563–1616 (`spec()`).
- `winisd_tools/scrapers/scrapers/lib/record_registries.py` lines 36–160 (`SourceRole`,
  `source_rank`), 290–420 (`SpecField` incl. `range_lo`/`range_hi`), 600–830 (DQ registry).

WP-O additionally:

- `openisd/packages/design/domain/openisdSchema.ts` lines 34–60, 257–370.
- `openisd/packages/design/domain/driverYmlToOpenisdAndWdr.ts` lines 60–160, 214–260, 880–955.
- `openisd/packages/design/engine/solver.ts` lines 870–1035 (`RELATIONS`, `halfUlp`,
  `checkConsistency`), 1059 (`enteredDriverValue`), 1077–1110 (`solveDriver`).
- `openisd/packages/design/engine/consistency.ts` (whole).
- `openisd/packages/design/engine/solverTypes.ts` lines 1–130.
- `openisd/packages/design/domain/cell.ts` lines 140–200, 340–365.
- `openisd/packages/design/AGENTS.md` (no casts, no module-scope mutable state, exact shape).
- `openisd/.claude/rules/testing.md`, `tdd.md`, `verify.md`.
- The Python files listed under WP-T above — you are porting their logic; read them in the
  main checkout at `/home/john/work/winisd/winisd_tools/` (read-only for you).

---

## 2. Today vs target

### 2.1 Today — two implementations of one judgement

| Judgement | Python (`winisd_tools`) | TypeScript (`openisd`) |
|---|---|---|
| T/S formula consistency (Qts vs Qes·Qms etc.) | `lib/semantic_dq.py` `_CALCULATABLE` + `computable_interval` → `dq_scraper` marks `kind:'calc'` | `engine/solver.ts` `checkConsistency` → `dq_calculated` marks `kind:'calc'` |
| Physical range bands | `semantic_dq.py` range check + `crosscheck.py:267-284` tier 1 → `kind:'range'` marks | none |
| Which reading wins (`origin`) | `crosscheck.py:258-296` three tiers | none — `openisdSchema.ts:316` `legacyToEntry` copies `readings[origin].read_value` |
| Cross-source agreement (`corroboration`) | `model_driver.py` `readings_agree`/`verdict_for` | none |
| Printed precision (`read_precision`) | used by all of the above | declared `openisdSchema.ts:59,270`, read nowhere |

Consequence John hit: `tang-band/w5-1138smf` `openisd.json` carries a `dq_calculated` "Qts, Qes,
Qms disagree by 0.3%" on `Qts=0.49` (`read_precision` 0.005 = ±1%). The Python check, which
honours printed precision, did not flag it; the TS check uses `halfUlp` of the 12-digit float and
does. Same driver, two verdicts.

### 2.2 Target

| Judgement | Producer | Output |
|---|---|---|
| Readings (literal, SI value, precision, rejected, note) | scraper | `driver.json` `specs.<section>.<field>.readings` |
| Structural/parse DQ | scraper | `driver.json` `dq_scraper` (`kind:'parse'` only) |
| Origin selection | bridge (TS) | `openisd.json` entry `origin`, `state:'E'`, `value` |
| Corroboration verdict | bridge (TS) | `openisd.json` entry `corroboration` + bridge `errors` `warn` on MISMATCH |
| Formula consistency, precision-aware | engine (TS) | `dq_calculated` `kind:'calc'` |
| Range bands | engine (TS) | `dq_calculated` `kind:'range'` |

Python holds no formula, no tolerance, no range band, no verdict, no winner.

### 2.3 `driver.json` spec entry — schema change (approved 2026-09-24 by John under this plan)

Before:

```json
"Qts": {
  "corroboration": "UNMATCHED",
  "definition": "total Q factor at Fs (dimensionless)",
  "dq_scraper": [],
  "origin": "manufacturer_datasheet",
  "readings": { "manufacturer_datasheet": { "actual_reading": "0.49", "read_precision": 0.005, "read_value": 0.49 } }
}
```

After:

```json
"Qts": {
  "definition": "total Q factor at Fs (dimensionless)",
  "readings": { "manufacturer_datasheet": { "actual_reading": "0.49", "read_precision": 0.005, "read_value": 0.49 } }
}
```

Removed keys: `origin`, `corroboration` (entry level); `quality.confirmed_fields`,
`quality.fields_with_issues` (record level). `Reading` is unchanged. Empty `dq_scraper` is
omitted (already the rule).

`openisd.json` entry (unchanged shape, now written by the bridge alone):

```json
"Qts": {
  "state": "E", "value": 0.49,
  "origin": "manufacturer_datasheet",
  "corroboration": "UNMATCHED",
  "readings": { "...": {} },
  "dq_scraper": [], "dq_calculated": []
}
```

### 2.4 `DqMark.kind` vocabulary after this plan

| Field | Kinds | Rules | Producer |
|---|---|---|---|
| `dq_scraper` | `parse` | — | scraper |
| `dq_calculated` | `calc` | `inconsistent-inputs`, `missing-dependencies`, `issue` (generic fallback: non-physical, vented plausibility, target-unreachable) | app/bridge |
| `dq_calculated` | `range` | `range-below-min`, `range-above-max` | app/bridge |

---

## 3. Decisions (binding — do not re-open)

| # | Question | Decision |
|---|---|---|
| D1 | Does the scraper still pick `origin`? | No. `SpecEntry` loses `origin`. `spec_entry(field, printed, role)` keeps its `role` parameter — it says which document the literal came from and files the reading under that key. |
| D2 | Does the scraper still compute `corroboration`? | No. Delete `DQStatus`, `readings_agree`, `unlike_conditions`, `verdict_for`, `compute_quality_summaries`, `_AGREE_REL_TOL` from Python. |
| D3 | `quality.confirmed_fields` / `fields_with_issues`? | Deleted (derived from corroboration). `missing`, `invalid`, `parse_errors`, `cross_source_only`, `issue`, `no_ts_published` stay. |
| D4 | What replaces `DqKind.CALC` / `RANGE` in Python? | `DqKind.PARSE = "parse"`. `unknown-surround-material` becomes `PARSE`/`INFO`. Delete the five calc/range rules and their params classes. |
| D5 | `SpecField.range_lo` / `range_hi`? | Deleted from Python; values move verbatim to a frozen TS table (WP-O step O5). WP-T copies the table into this doc's §6 before deleting so WP-O has it without reading Python. |
| D6 | Top-level `ScrapedField` envelopes (manufacturer, model, …) carry `origin`/`value`. | Untouched. Out of scope. |
| D7 | Existing `EXTRACTION_DIVERGENCE`-style MISMATCH alerts raised by vendor emits? | Deleted. The bridge reports MISMATCH as `errors` `{level:'warn', field:'<section>.<field>', message}`; Stage 6 PROJECT surfaces it (WP-T step T9). |
| D8 | `DQ_VALUE_ERROR` run-level alert (`spec_emit.dq_value_error_alert`)? | Deleted with the marks it reads. Range findings are now `dq_calculated` in `openisd.json`. |
| D9 | Origin selection policy in TS | Port `crosscheck.py:258-296` exactly: tier 1 drop `rejected` readings and out-of-range readings; tier 2 strict majority on `read_value`; tier 3 source rank; tie-break alphabetical on role name. Fallbacks as in Python lines 281–284. |
| D10 | Source rank in TS | `manufacturer_datasheet < manufacturer_product_page < manufacturer_listing_page < distributor_datasheet < distributor_product_page < distributor_listing_page < manual`. Unknown role string: rank after `manual`. |
| D11 | Corroboration rule in TS | Port `verdict_for` verbatim: <2 usable (non-rejected) readings → `UNMATCHED`; any pair with unlike measurement conditions → `NOT_MATCHABLE`; every pair agrees → `MATCH`; else `MISMATCH`. Agreement: `|a−b| < prec(a) + prec(b) + 0.01·max(|a|,|b|)`. "Unlike conditions": both readings carry a `note` and the notes differ; a missing note is not a competing claim. |
| D12 | Consistency precision in TS | An entered field's delta is its reading's `read_precision` when the entry came from a reading; `halfUlp(value)` when hand-typed. The expected value's interval is corner arithmetic over the inputs' deltas (port of `semantic_dq.py` `computable_interval`). Pass iff the stored value's own interval overlaps the expected interval; no per-target measurement-variation allowance (John, 2026-09-24: the Python `tol` table 3%/1%/1%/4% is dropped, not ported). |
| D13 | Where does precision enter the solver? | `SolverField` gains `readonly precision: number \| null` — half-width of the entered value, `null` when not entered. The cell sets it: from `readings[origin].read_precision` for a bridge/scraper-sourced entry; `halfUlp(value)` at `entered(v)` for a typed value. `halfUlp` moves out of `solver.ts` to where the typed value is constructed; `checkConsistency` reads `precision`, never recomputes it. |
| D14 | Range DQ shape | New `DqIssue` variant `OutOfRangeIssue {kind:'out-of-range', field, value, limit, side:'below'\|'above'}`. `writeEntryDq` writes it as `{kind:'range', severity:'error', rule:'range-below-min'\|'range-above-max', params:{field,value,limit}, detail}`. |
| D14a | Calc mark `params` | Today `writeEntryDq` (`cell.ts:362`) writes `params:{}`, losing the finding. New: `inconsistent-inputs` → `{kind:'calc', severity:'error', rule:'inconsistent-inputs', params:{target, fields, formula, expected, actual, relative}, detail}`; `missing-dependencies` → `rule:'missing-dependencies', params:{target, missing}`. `params` values are numbers/strings/string arrays only. No Python typed-params classes are ported — `CalculationIssue` is the type. |
| D21 | `scrapers/lib/precision.py` | Delete in T2 if `semantic_dq` was its only non-test importer (liveness guard will say). Its interval logic is NOT ported (that is QO87, "not now"); O2 ports only `semantic_dq.py`'s `computable_interval` overlap rule. |
| D15 | `legacyToEntry` in `openisdSchema.ts` | Deleted. `driver.json` is parsed by its own zod schema inside `driverYmlToOpenisdAndWdr.ts` (entry = `{readings, definition?, dq_scraper?}`); the bridge builds the app entry. The app schema requires `state`. |
| D16 | Bridge envelope | Unchanged: `{openisd, wdr, errors:[{level,field,message}]}`. |
| D17 | Records on disk in the old shape | Not regenerated by either agent. WP-T regenerates one record only (§4 T11) after both packages land. The corpus rebuild is John's call — report it, do not run it. |
| D18 | `bugs/BUG_20260829_the_app_calls_the_field_dq_while_the_scraper_writes_dq_marks.md` | WP-O sets status RESOLVED, one line: name mismatch already gone (`dq_scraper` written since 2026-08); producer split now enforced by this plan. |
| D19 | `DESIGN.md` §12.2 "What Python holds today — the second implementation" | WP-T replaces its body with one paragraph: deleted under this plan, date, link. Remove `semantic_dq` from the Part 7 capability index (liveness test). |
| D20 | Test fixtures copied from the corpus (`openisd/packages/design/test/fixtures/corpus/*.driver.yml`) | WP-O rewrites them to the new shape (delete `origin`, `corroboration`, `confirmed_fields`, `fields_with_issues`). They are copies in openisd, not `winisd_drivers/db`. |
| D22 | Round-trip gate vs stored `dq_calculated` | `scripts/roundTripGate.mjs` `firstDivergence` compares a corpus record's stored `dq_calculated` against the app's recompute. With D14a the mark shape changes and D17 forbids a corpus rebuild, so every real-corpus gate test (`packages/ui/test/persistence/round-trip-gate.test.ts`) goes red. Ruling, same reasoning as QO167 for `state:'C'` values: stored `dq_calculated` is a bridge-computed convenience the app recomputes on open, never trusted as current, so `firstDivergence` skips the `dq_calculated` key at every depth. `dq_scraper` is still compared byte-for-byte (it is scraper data, not derived). Done in O5 with a unit test in the gate's own test file: a record whose stored `dq_calculated` differs from the recompute passes; one whose `dq_scraper` differs fails. |

---

## 4. WP-T — `winisd_tools`

Worktree: `git worktree add ../winisd_tools-retire-calcs -b retire-calcs-from-scrapers main`
(from `/home/john/work/winisd/winisd_tools`). Run Python through `.venv` only. Test command:
`make test` (= `.venv/bin/python -m pytest scrapers/tests`). Test-first for every step
(AGENTS.md §"Test-first for generation and transformation code"): write/adjust the test, watch it
fail, change code, watch it pass.

Order is fixed; each step is one commit.

### T1 — `record_registries.py`: DQ registry shrinks to structural

- `DqKind`: delete `CALC`, `RANGE`; add `PARSE = "parse"`.
- Delete classes `VasConsistency`, `QtsConsistency`, `CalcConsistency`, `RangeBelowMin`,
  `RangeAboveMax`.
- `DQ_RULES`: delete `vas-consistency`, `qts-consistency`, `calc-consistency`,
  `range-below-min`, `range-above-max`. `unknown-surround-material` → `kind=PARSE`,
  `severity=INFO`.
- Delete `range_lo`, `range_hi` and the `__new__` parameters that set them. (WP-O copies the
  band values from the main checkout's `record_registries.py` at HEAD of `main`, which your
  branch does not change — no hand-off needed.)
- Tests: `scrapers/tests/lib/test_record_registries.py`, `test_quality_dq_models.py` — update
  the rule/params expectations to the shrunken registry.

### T2 — delete `semantic_dq`

- Delete `scrapers/scrapers/lib/semantic_dq.py`, `scrapers/bin/apply_semantic_dq.py`,
  `scrapers/tests/lib/test_semantic_dq.py`. Then `scrapers/scrapers/lib/precision.py` per D21
  (`grep -rn "precision import\|import precision" scrapers/scrapers` — if the only hit was
  `semantic_dq`, delete it and its test).
- `lib/emit_record.py`: delete the `stamp_semantic_dq` import and call (line 144) and the
  `meta.quality = meta.quality` revalidation block that only existed because stamping mutated
  the specs (lines 145–160, read the comment to confirm the extent).
- `lib/spec_emit.py`: delete `dq_value_error_alert` (≈ lines 355–395) and every caller; delete
  `DQ_VALUE_ERROR` from `lib/alerts.py`.
- Tests: `test_emit_record.py`, `test_model_names.py`, `test_meta_field_order.py`,
  `test_record_model.py` — remove assertions about calc/range stamping and `DQ_VALUE_ERROR`.
- `DESIGN.md`: remove `semantic_dq` from the capability index; `test_lib_module_liveness.py`
  must pass.

### T3 — `model_driver.py`: `SpecEntry` = readings + definition + dq_scraper

- `SpecEntry`: delete `origin`, `corroboration`, `winning_reading`,
  `_origin_names_a_usable_reading`. Keep `readings: dict[SourceRole, Reading]` (`min_length=1`),
  `definition`, `dq_scraper`, `dq_calculated` (stays `Optional`, stays `None` — the bridge
  attaches it in `openisd.json`, never in `driver.json`).
- Delete `DQStatus`, `_AGREE_REL_TOL`, `readings_agree`, `unlike_conditions`, `verdict_for`,
  `compute_quality_summaries`.
- `QualityBlock`: delete `confirmed_fields`, `fields_with_issues` and record constraint 9
  (the one that recomputes them). `CrossSourceReading` stays.
- `spec(field, actual_reading, origin, ...)` (line 1563): keep the signature; build
  `SpecEntry(readings={**(readings or {}), origin: winner}, definition=..., dq_scraper=...)`.
- Record constraints that referenced `origin`/`corroboration`: delete the check, not the
  constraint numbering comment.
- Every `.origin` / `.corroboration` / `.winning_reading` read on a `SpecEntry` across
  `scrapers/scrapers/**`: `grep -rn "\.winning_reading\|\.corroboration\|DQStatus\|confirmed_fields\|fields_with_issues" scrapers/scrapers` — each hit is either deleted with its feature (D2/D3) or, if it needs "the value", is a decision the scraper no longer makes: delete the code path and note it in the commit body.
- `lib/dats.py` `parse_dats_ts`: builds entries with an origin — same change as `spec()`.
- Tests: `test_record_model.py`, `test_crosscheck_precision.py` (delete — its subject is gone;
  WP-O ports its cases), `test_crosscheck.py`, `test_crosscheck_engine.py` (rewrite per T4).

### T4 — `crosscheck.py`: merge readings, no verdict

- `FieldDQ`: delete `status`; rename to `FieldReadings {field: str, readings: dict[SourceRole, Reading]}`.
- `crosscheck(sources)` returns `list[FieldReadings]` — one per field any source read; no
  comparison.
- Delete `_verdict`, `disagreeing_pairs`, `_condition_text`, `divergences`.
- `apply_fielddq(specs, section_name, quality, items)`: for a field with an entry, rebuild the
  entry with `readings = dict(item.readings)` (all roles, rejected included); for a field with
  no entry, append to `quality.cross_source_only` as today. Delete tiers 1–3 (lines 258–296)
  and the `compute_quality_summaries` call. Return `None`.
- `apply_crosscheck` stays as the one-call wrapper.
- Module docstring: rewrite to say what it now does (readings merge), no history.
- Vendor emits: `plugins/peerless/emit.py`, `plugins/scanspeak/emit.py`,
  `plugins/dayton_audio/{dq,emit,extract}.py`, `plugins/peerless/plugin.py` — delete every use
  of `divergences`, `status`, `DQStatus`, MISMATCH alerting. What remains is: extract per-source
  `Reading` maps, call `apply_crosscheck`.
- Tests: `test_crosscheck.py`, `test_crosscheck_engine.py` rewritten to assert readings merge
  and `cross_source_only` only.

### T5 — `record_round_trip.py`, serialisers

- `OMIT_WHEN_EMPTY`: unchanged unless a deleted key appears; delete `cross_checks` if nothing
  writes it any more.
- Confirm `DriverFile.to_json` / `from_json` round-trip a record with the new entry shape:
  `scrapers/tests/lib/test_record_round_trip*.py`.

### T6 — guards that grep for the deleted vocabulary

- `scrapers/tests/test_no_dynamic_attribute_access.py`, `test_no_compat_shims.py`,
  `test_no_version_supporting_code.py` — run; if any fails on your change, fix the code shape
  (never the guard).
- `grep -rn "origin" scrapers/scrapers/lib/model_driver.py` — every remaining `origin` must
  belong to `ScrapedField`, `Ground`, `CrossSourceReading` or `spec()`'s parameter. Any other is
  a leftover.

### T7 — `openisd_js.py` / Stage 6 warn surfacing

- `_result_from` unchanged (envelope is unchanged, D16).
- `framework.py` Stage 6 PROJECT (`_bridge`, projection loop near line 1752–1800): confirm what
  happens to an `errors` entry with `level == 'warn'`. If it is only logged, write it to
  `<record_dir>/dq.alert` the same way `rebuild_error.alert` is written, one line per warn
  (`<field>: <message>`), overwriting on each projection. If a warn already surfaces in the run
  report, change nothing and say so in the commit body.
- Test: `scrapers/tests/lib/test_openisd_js.py` — add one stub-bundle case whose envelope
  carries a `warn` entry and assert the Stage 6 behaviour you settled on (or the existing one).

### T8 — docs

- `DESIGN.md` §12.2 per D19; Stage 7 / Stage 8 sections: replace the verdict/semantic-DQ
  description with "readings merge; verdict and DQ in openisd (link to this plan)".
- `scrapers/SCRAPING.md` and `DOCUMENTATION.md`: same grep — `semantic_dq`, `DQ_VALUE_ERROR`,
  `corroboration`, `confirmed_fields`, `fields_with_issues`, `range_lo` — fix every hit.
- `TODO.md` QT39, QT41: append one status line each: "Implemented 2026-09 — see
  openisd/docs/plans/PLAN_RETIRE_CALCS_FROM_SCRAPERS.md".

### T9 — bridge differential on one record (after WP-O has landed and the bundle is rebuilt)

Preconditions: WP-O merged into openisd `refactor`; in `/home/john/work/winisd/openisd` run
`npm run build:bridge` so `packages/design/dist/openisd-bridge.js` is current.

- Regenerate exactly one record: `openisd rebuild --only tang_band --only-driver w5-1138smf --fresh`
  (syntax per AGENTS.md §"Never regenerate more than the change affects"; if the vendor slug
  differs, `bin/list_vendors.py` gives it).
- Check the produced `winisd_drivers/db/datasheets/tang-band/w5-1138smf/`:
  `driver.json` entries have no `origin`/`corroboration`; `openisd.json` `Qts` has
  `state:'E'`, `value: 0.49`, `origin: manufacturer_datasheet`, `corroboration: UNMATCHED`,
  and **no** `dq_calculated` calc mark (the 0.3% finding must be gone — it is inside
  ±0.005 printed precision).
- `scrapers/bin/run_bridge_differential.py` on that record dir; paste the output in the final
  report.

### T10 — final report to John

List: commits (hash + subject), test result (`make test` pass/fail counts), the one regenerated
record's before/after `openisd.json` `Qts` entry, and the sentence: "The rest of the corpus is
in the old shape and will not load under the new model; a corpus rebuild is your call."

---

## 5. WP-O — `openisd`

Worktree: `git worktree add ../openisd-retire-calcs -b retire-calcs-from-scrapers refactor`
(from `/home/john/work/winisd/openisd`). TDD per `.claude/rules/tdd.md`: say "doing TDD",
failing test first, at the lowest layer (unit). Gate after every step: `npm run typecheck` and
`npx vitest run packages/design packages/persistence`. Order fixed; one commit per step.

### O1 — `SolverField.precision` (D13)

- `engine/solverTypes.ts`: add `readonly precision: number | null` to `SolverField` with the
  doc comment "half-width of the entered value's rounding interval; `null` unless `entered`".
- `domain/cell.ts`: implement on both field impls. `entered(v)` (typed by a human) sets
  `halfUlp(v)`; an entry restored from a record with `readings[origin].read_precision` sets
  that number; a record entry without `read_precision` sets `halfUlp(value)`. Move `halfUlp`
  from `solver.ts` to a small `engine/precision.ts` exporting `halfUlp` (pure, tested).
- Tests: `test/cell-field.test.ts` — precision after `entered()`, after restore-with-reading,
  after `setCalculated` (null).

### O2 — `checkConsistency` uses precision (D12)

- `engine/solver.ts` `checkConsistency`: `delta[field] = entered field ? params[field].precision : |value|·FLOAT_NOISE`. Needs the `DriverSolverParams` (not just the numeric working set) — thread it through `solveDriver` (line 1077) to `checkConsistency`; keep `valuesFrom`.
- `RELATIONS` (solver.ts:885) lacks the one Python relation TS never had: add
  `{ formula: 'EBP = Fs/Qes', target: 'EBP_hz', fields: ['EBP_hz', 'Fs_hz', 'Qes'], predict: v => v.Fs_hz / v.Qes }`.
  After this the TS relation set is a strict superset of Python's four (Qts, Dd, EBP, Vas).
- No allowance table. The `inconsistent-inputs` test is: the stored value's own interval `[actual−δ, actual+δ]` and the propagated expected interval do not overlap (`semantic_dq.py:158-160` with `tol = 0`). `relative` in the mark params is the gap between the nearest interval edges over `max(|actual|,|expected|)`.
- Tests: `test/engine/consistency.test.ts` — port every case from
  `winisd_tools/scrapers/tests/lib/test_semantic_dq.py` (calc cases: coarse-precision Vas passes,
  precise Vas fails, Qts 0.60 vs 4.75/0.50 fails, EBP 120 vs 43/0.40 fails, consistent
  Fs/Qts/Qes/Qms gives none) and one acceptance case: Qts 0.49 ± 0.005 with the w5-1138smf
  `Qes`/`Qms` readings (read them from `winisd_drivers/db/datasheets/tang-band/w5-1138smf/driver.json`, read-only) → no issue.

### O3 — `OutOfRangeIssue` (D14)

- `engine/consistency.ts`: add the variant to `DqIssue`; `dqIssueText` renders
  `"<field> <value> is below/above the physical limit <limit>"`. Every `switch` on
  `DqIssue.kind` in `packages/design` and `packages/ui` must be exhaustive — typecheck finds
  them.
- `domain/cell.ts` `writeEntryDq`: map by variant per D14 and D14a (exhaustive switch on
  `DqIssue.kind`; `VentedPlausibilityIssue`/`TargetUnreachableIssue` keep their current mapping).
- Tests: `test/engine/issueHelpers.test.ts` (text), `test/cell-field.test.ts` (mark shape for
  every variant, incl. the `params` contents of D14a).
- `docs/plans/PLAN_RETIRE_CALCS_FROM_SCRAPERS.md` §2.4 table gains the `rule` column you
  implemented; `openisd/questions.yml` QO84: add a note "small fix landed in <commit>".

### O4 — range table + `checkRange` (D5)

- `engine/physicalRange.ts`: `PHYSICAL_RANGE: Readonly<Partial<Record<NumericDriverQuantityName, {lo?: number; hi?: number}>>>` frozen, values from §6 of this doc. Export `checkRange(params: DriverSolverParams): DriverIssue[]` — one `OutOfRangeIssue` per entered field outside its band; `0` and non-entered skipped.
- `solveDriver`: call `checkRange` beside `checkConsistency`.
- Tests: `test/engine/physicalRange.test.ts` — below, above, inside, no band.

### O5 — bridge: parse `driver.json`, choose origin, corroborate (D9–D11, D15)

- `domain/openisdSchema.ts`: delete `legacyToEntry` and its preprocess; `specEntrySchema` is the
  plain discriminated union. Add `corroboration: z.enum(['MATCH','MISMATCH','NOT_MATCHABLE','UNMATCHED']).optional()` to `enteredEntrySchema` if not already typed that way.
- `domain/driverYmlToOpenisdAndWdr.ts`:
  - `scraperEntrySchema = z.strictObject({readings: z.record(readingSchema).min(1), definition: z.string().optional(), dq_scraper: dqMarks()})` — the `driver.json` entry. `readingSchema` reused from `openisdSchema.ts` (export it within `domain/`).
  - `selectOrigin(readings, field): string` — D9/D10. Rank list as a frozen array in
    `domain/sourceRank.ts`.
  - `corroborate(readings): Corroboration` — D11, in `domain/corroboration.ts`. `Corroboration`
    is an enum class per `.claude/rules/typescript.md` (`static parse`, `.value`).
  - The projection replaces the old strip-`dq_calculated`/legacy path: each scraper entry →
    `{state:'E', value: readings[origin].read_value, origin, corroboration, readings, dq_scraper}` (rejected readings still dropped from the app copy as today, lines 128–147; but they DO take part in nothing — they are excluded before selection and before corroboration).
  - MISMATCH → push `{level:'warn', field:'<section>.<field>', message:'sources disagree: <role>=<literal>, <role>=<literal>'}` to `errors`.
- Tests: `test/winisd/driverYmlToOpenisdAndWdr.test.ts` — rewrite fixtures per D20; add unit
  tests `test/domain/sourceRank.test.ts`, `test/domain/corroboration.test.ts` porting
  `test_crosscheck_precision.py` cases (`1.01 g` vs `0.995 g` MATCH; `0.03 mH` vs `0.3 mH`
  MISMATCH; unlike SPL conditions NOT_MATCHABLE; bare `98 dB` vs `98 dB (2.83V/1m)` MATCH) and
  the three origin tiers (impossible excluded, strict majority, rank tie-break).
- `scripts/roundTripGate.mjs` `isExpectedSpecEntryUpgrade`: it exists to accept the
  `origin/readings → state/value` upgrade; with the bridge now the only writer, update it to
  the new input shape (no `a.origin`) or delete it if the gate no longer sees scraper entries —
  read the gate's callers to decide, state which in the commit body.
- `scripts/roundTripGate.mjs` `firstDivergence`: skip `dq_calculated` at every depth (D22).
  Test first in `packages/ui/test/persistence/round-trip-gate.test.ts`: stored `dq_calculated`
  differing from the recompute passes; stored `dq_scraper` differing fails. Do this step FIRST
  within O5 — the real-corpus gate tests are red on the branch from the moment O2/D14a lands.

### O6 — rebuild the bridge bundle, verify against a real record

- `npm run build:bridge`.
- Node one-liner in the scratchpad: load `packages/design/dist/openisd-bridge.js`, call
  `driverYmlToOpenisdAndWdr` on a hand-converted copy of
  `winisd_drivers/db/datasheets/tang-band/w5-1138smf/driver.json` (delete `origin`,
  `corroboration`, `confirmed_fields`, `fields_with_issues` in the copy — the copy lives in the
  scratchpad, never in `winisd_drivers/db`). Assert `openisd.Qts` has no calc mark and
  `errors` is empty. Paste result in the final report.

### O7 — docs + bug

- `bugs/BUG_20260829_...md` per D18.
- `openisdSchema.ts` header comments (lines 330–345) and `driverYmlToOpenisdAndWdr.ts` header:
  describe the new producer split; delete history prose.
- `docs/design/*` that mention `legacyToEntry` or "scraper picks origin": grep, fix.

### O8 — final report to John

Commits, gate output, the O6 result, and: "winisd_tools WP-T step T9 can run once this is merged
to `refactor` and `npm run build:bridge` has been run in the main checkout."

---

## 6. Physical range bands (WP-O reads these at O4)

Source of truth for the port: `/home/john/work/winisd/winisd_tools/scrapers/scrapers/lib/record_registries.py`
(main checkout, read-only), the `SpecField` member declarations (≈ lines 316–416) — every member
that declares `range_lo` and/or `range_hi`, SI units as declared. Verbatim (field, lo, hi),
sourced 2026-09-24; `—` means that side is unbounded (`None` in Python):

| Field | lo | hi |
|---|---|---|
| `Fs_hz` | 1.0 | 5000.0 |
| `Re_ohm` | 0.1 | 64.0 |
| `Le_H` | 0.0 | 0.1 |
| `fLe_hz` | 0.0 | — |
| `KLe_H_sqrtHz` | 0.0 | — |
| `Znom_ohm` | 1.0 | 64.0 |
| `Qts` | 0.01 | 5.0 |
| `Qes` | 0.01 | 5.0 |
| `Qms` | 0.1 | 50.0 |
| `Vas_m3` | 1e-6 | 1.0 |
| `Sd_m2` | 1e-5 | 0.3 |
| `BL_Tm` | 0.1 | 50.0 |
| `Mms_kg` | 1e-5 | 2.0 |
| `Cms_m_per_N` | 1e-6 | 0.1 |
| `Rms_kg_per_s` | 0.0 | 200.0 |
| `Xmax_m` | 0.0001 | 0.15 |
| `SPL_dB` | 50.0 | 150.0 |
| `Pe_W` | 1.0 | 20000.0 |
| `Dd_m` | 0.0 | 2.0 |
| `EBP_hz` | 0.0 | — |
| `Hg_m` | 0.0 | — |
| `Hc_m` | 0.0 | — |
| `numVC` | 1.0 | 4.0 |
| `VCCon` | 1.0 | 2.0 |

`numVC`/`VCCon` are listed for completeness but NOT ported into `PHYSICAL_RANGE`: `numVC` is a
`SolverInput` (no `.precision`, excluded from `NumericDriverQuantityName`) and `VCCon` has no
`DriverSolverParams` slot at all (it is `wiring`, a discrete `'series'|'parallel'` field, not a
numeric one) — open gap, see O8.

---

## 7. Hard rules (both agents)

- `openisd` never writes to `winisd_drivers/db`. Copies of records for tests/fixtures live in the
  openisd repo or the scratchpad.
- Commit everything in the worktree, every commit — never a scoped commit that leaves files
  uncommitted. Never `stash`, `checkout --`, `restore`, `reset --hard`, `clean`. Never
  `--no-verify`.
- No AI attribution in commit messages: no `Co-Authored-By` naming a tool, no
  `Claude-Session`, no "Generated with". The harness will offer them; refuse.
- Never delete/skip/weaken a test to go green. A test that asserts the deleted behaviour is
  deleted **with** the behaviour (T2/T3/T4 list them); a test that asserts kept behaviour is
  fixed.
- Sequencing: WP-T steps T1–T8 and WP-O steps O1–O7 are independent. T9 waits for WP-O merged +
  bundle rebuilt. Neither agent merges to `main`/`refactor`; both leave the branch and report.
- Do not run a corpus rebuild. Do not regenerate more than the one record in T9.
