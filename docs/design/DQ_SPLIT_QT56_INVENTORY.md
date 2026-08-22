# DQ split inventory — QT56

Status: evidence for a human ruling. No source, test, or record changed by this document.

Question under ruling (QT56, human's words, 2026-08-21): should python do ONLY structural DQ
(precisely: only DQ that prevents openisd loading/using the driver usefully) plus cross-source
corroboration, with ALL calculation/relation-based DQ done by openisd at load/view time from its
engine — eliminating both the py/oid duplicate relation tables and the need for a stored
calculated-marker (B5)?

---

## 1. Python DQ inventory

### 1.1 `model_driver.py` (1794 lines, full read) — STRUCTURAL and CROSS-SOURCE only

No RELATION-MATH exists anywhere in this file (no relation between two different physical
fields — e.g. no Qts=Qes·Qms/(Qes+Qms), no EBP=Fs/Qes). Every check is one of:

**STRUCTURAL**

| file:line | condition (quoted) | what it checks |
|---|---|---|
| `model_driver.py:1257` | `if not _UUID_RE.match(self.uuid.value):` | uuid format |
| `model_driver.py:1261-1265` | `if role in NON_URL_SOURCE_ROLES: problems.append(...)` / `if not _URL_RE.match(url):` | data_sources URL shape / non-URL role rejection |
| `model_driver.py:1266-1269` | `product_image` URL match; `added` ISO-date `_DATE_RE.match` | format |
| `model_driver.py:1272-1274` | `if self.authoritative.value not in index:` | authoritative role must be indexed |
| `model_driver.py:1277-1280` | `_role_ok()` (applied at 1288,1290,1292,1297,1299,1312,1314) | every cited role is a data_sources key or non-URL role |
| `model_driver.py:1315-1319` | `winning_value = reading_value(entry.winning_reading); if winning_value <= 0: problems.append(...)` | single-field positivity — no relation to another field |
| `model_driver.py:1320-1325` | `entry.definition != SPEC_FIELD_DEFINITIONS[fname2]` | canonical definition-text registry match |
| `model_driver.py:1382-1383` | `if self.nominal_size_cm is not None and self.nominal_size_cm.value <= 0:` | positivity |
| `model_driver.py:1386-1394` | quality list membership | fields cited in confirmed/issues/missing/invalid/cross_source_only must be canonical spec names |
| `model_driver.py:1397-1406` | per-field `definition` must equal `FIELD_DEFINITIONS[fname3]` | registry match |
| `model_driver.py:1411-1419` | same registry-text check for `no_ts_published` / curve definitions | registry match |
| `model_driver.py:1422-1436` | `scraper_meta` key registration, `scraper.value not in SCRAPER_NAMES` | registry membership |
| `model_driver.py:1438-1442` | `discovered_via` must be an indexed role or a URL | format/registry |
| `model_driver.py:663-684` | `_x_is_the_longer_extent`: `if x_mm < y_mm: raise ValueError(...)` | geometric labeling convention (outer_x_mm ≥ outer_y_mm) — an ordering rule between two dimension fields, not a physics formula; classified STRUCTURAL not RELATION-MATH |
| `model_driver.py:344-374` | `Reading._reading_is_evidence` | presence/absence shape of one reading's own fields |
| `model_driver.py:377-402` | `_conformance_is_declared` | shape rules on one reading's conformance metadata |
| `model_driver.py:245-251` | `DispositionField._templated_detail` | `detail` must equal registered template text |
| `model_driver.py:210-215` | `Ground._registered_definition` | `definition not in GROUND_DEFINITIONS` |
| `model_driver.py:255-277` | `_check_readings` (constraint 5) | `readings` present ⇒ ≥2 entries, `origin ∈ readings`, `value == readings[origin]` — self-consistency of ONE field's own envelope |
| `model_driver.py:519-538` | `_origin_names_a_usable_reading` | origin must key readings; winning reading not rejected |

**CROSS-SOURCE** (compares multiple readings/origins of the SAME field)

| file:line | condition (quoted) | what it checks |
|---|---|---|
| `model_driver.py:1024-1042` | `readings_agree(a,b,rel_tol=0.01)`: `abs(a_value-b_value) < halfwidth(a)+halfwidth(b)+rel_tol*max(|a|,|b|)` | numeric agreement between two sources' readings of one field |
| `model_driver.py:1045-1081` | `unlike_conditions(a,b)` | compares measurement-condition notes; falls back to `readings_agree` |
| `model_driver.py:1084-1119` | `verdict_for(readings)` | `len(usable)<2 → UNMATCHED`; any pair `unlike_conditions → NOT_MATCHABLE`; any pair `not readings_agree → MISMATCH`; else `MATCH` |
| `model_driver.py:1122-1162` | `compute_quality_summaries` | derives `confirmed_fields`/`fields_with_issues` from `verdict_for` results, rejected readings, and dq_marks |
| `model_driver.py:1336-1363` | rating-L justification: `has_mismatch = any(entry.corroboration is DQStatus.MISMATCH ...)`, `has_cross_source = bool(self.quality.cross_source_only)` | reuses cross-source verdicts to justify a severity rating |

### 1.2 `crosscheck.py` (313 lines, full read) — entirely CROSS-SOURCE

The whole module IS the N-source corroboration engine. Zero RELATION-MATH; zero STRUCTURAL beyond
reuse of `model_driver.py`'s verdict.

| file:line | what it does |
|---|---|
| `crosscheck.py:58-76` | `FieldDQ` outcome type: `field`, `readings: dict[SourceRole, Reading]`, `status: DQStatus`, `detail` |
| `crosscheck.py:83-100` | `disagreeing_pairs`: same-field pairwise comparison via `unlike_conditions`/`readings_agree`, filtering `r.rejected is None` |
| `crosscheck.py:103-130` | `_verdict`: calls `model_driver.verdict_for` (not reimplemented), builds human-readable detail |
| `crosscheck.py:134-163` | `crosscheck(sources)`: loops `_verdict` per field over the union of fields any source published |
| `crosscheck.py:166-169` | `divergences`: `[d for d in dqs if d.status is DQStatus.MISMATCH]` |
| `crosscheck.py:172-290` | `apply_fielddq`: stamps readings/corroboration onto `SpecEntry`, records unmatched fields into `quality.cross_source_only` (211-215), picks winning origin by `source_rank` (264), recomputes quality summaries, downgrades `rating=L` on any mismatch (288-289) |
| `crosscheck.py:293-313` | `apply_crosscheck`: `crosscheck()` then `apply_fielddq()` |

**Load-bearing prior precedent, directly relevant to QT56** — `crosscheck.py:220-228`, quoted
verbatim: *"TEMPORARY, and knowingly so: the verdict is still COMPUTED here, in Python. The ruling
(TODO.md Q41) is that DQ has one implementation and it lives in openisd — the scraper is to CALL
it, not own it... This repo waits on the Python→JS seam that Q39's calc consolidation builds."*
This is a DIFFERENT, EARLIER ruling (Q41) than QT56, and it says even CROSS-SOURCE verdict
computation should eventually move to openisd/JS, not stay in python indefinitely — broader than
QT56's proposed split (which would keep cross-source in python). The human ruling on QT56 should
either reconcile with Q41 or explicitly supersede it; the two are in tension as written.

### 1.3 `model_wdr.py` — the actual location of python's RELATION-MATH DQ engine

`spec_emit.py:21` imports `semantic_dq` and `_WDR_FIELD_SPEC` from `model_wdr.py` — these are
**defined** in `model_wdr.py`, not in `spec_emit.py` (spec_emit.py only calls them at
`spec_emit.py:338`). This is the single, tight surface QT56 is actually asking whether to delete.

**RELATION-MATH — `_WDR_CALCULATABLE`, `model_wdr.py:454-474`**, 9 formulas, each `{deps, tol, fn}`:

| field | formula | deps | tol |
|---|---|---|---|
| `Qts` | `Qms·Qes/(Qms+Qes)` | Qms, Qes | 0.03 |
| `Vd` | `Sd·Xmax` | Sd, Xmax | 0.01 |
| `Dd` | `2·√(Sd/π)` | Sd | 0.01 |
| `EBP` | `Fs/Qes` | Fs, Qes | 0.01 |
| `Rme` | `BL²/Re` | BL, Re | 0.01 |
| `Mpow` | `BL/√Re` | BL, Re | 0.01 |
| `gamma` | `BL/Mms` | BL, Mms | 0.01 |
| `Vas` | `ρ₀·c²·Sd²·Cms` | roo, c, Sd, Cms | 0.04 |
| `no` (efficiency η₀) | `(4π²/(ρ₀c³))·(Fs³·Mms/(Qes·BL²))` | roo, c, Fs, Mms, Qes, BL | 0.02 |

- `model_wdr.py:554-591` `computable_interval(field, fields)` — interval-arithmetic propagation of
  each dependency's printed rounding half-width through the formula (2ⁿ corner evaluation) to get
  `[lo, hi]`. RELATION-MATH (precision-aware half of the check).
- `model_wdr.py:594-657` `semantic_dq()` — two passes:
  1. `model_wdr.py:606-618` **STRUCTURAL**: range check against `_WDR_FIELD_SPEC[key]["lo"]/["hi"]`
     (e.g. `Fs: lo=1.0, hi=5000.0`) — single-field, no cross-field relation.
  2. `model_wdr.py:620-656` **RELATION-MATH**: for each field in `_WDR_CALCULATABLE` the record
     also stores directly, computes `expected = rule["fn"](values)`, gets `computable_interval`,
     computes `shortfall`, and if `shortfall > tol * max(|stored|,|expected|)` emits a
     `qts-consistency`/`vas-consistency`/`calc-consistency` `DqMark` (kind=CALC).
- `model_wdr.py:501-540` `derived_precisions` — propagates precision for `Vd`, `Dd`, `EBP` via a
  **separate** formula dict `_DERIVED_FORMULAS` (`model_wdr.py:493-498`), reported only into `.wdr`
  output, not applied to the stored value and not part of the DQ-mark path. This is a distinct
  mechanism from `_WDR_CALCULATABLE`/`semantic_dq` and would need its own read before any deletion
  of the DQ engine touches it — flagged, not resolved, here.

### 1.4 `spec_emit.py` — wiring, not derivation

| file:line | what it does |
|---|---|
| `spec_emit.py:306-369` `build_quality` | calls `semantic_dq(_winning_readings(fields))` at line 338, stamps returned marks onto `SpecEntry.dq_marks` (339-344), counts `error_marks` for `DqSeverity.ERROR` marks. Also computes `missing`/`invalid` (345-346, STRUCTURAL — driver-type-expected-field-set membership) and `parse_errors` (358, STRUCTURAL — unit-conversion failures). Sets `rating = L if (error_marks or missing or invalid or parse_errors) else M` (362-363). |
| `spec_emit.py:406-429` `dq_value_error_alert` | filters `dq_marks` for `kind in (CALC, RANGE) and severity is ERROR` — surfaces both structural and relation-math marks as a run-level alert; does not compute anything itself. |

### 1.5 `record_registries.py` — DqKind/DqSeverity/quality registries (full read, 721 lines)

- `DqKind` (`record_registries.py:100-102`): `CALC = "calc"`, `RANGE = "range"`. **Only two kinds
  exist — there is no third "cross-source" DqKind.** Cross-source comparison is a wholly separate
  mechanism (`readings_agree`/`verdict_for`/`compute_quality_summaries` in `model_driver.py`), not
  represented as a `DqMark` at all.
- `DqSeverity` (`105-107`): `INFO`, `ERROR`.
- `Disposition` (`54-90`): `OK`, `NO_TS_PUBLISHED`, `INCOMPLETE` — closed vocabulary.
- `Rating` (`93-97`): `M` (scraped/unverified), `L` (known data problem).
- `DQ_RULES` registry (`584-651`), 6 rules each bound to a typed `DqParams` model:
  - `vas-consistency` → `VasConsistency` (535-540), kind=CALC, severity fixed ERROR — **RELATION-MATH**.
  - `qts-consistency` → `QtsConsistency` (542-547), kind=CALC, severity fixed ERROR — **RELATION-MATH**.
  - `calc-consistency` → `CalcConsistency` (549-556, generic Dd/EBP/etc.), kind=CALC, severity fixed ERROR — **RELATION-MATH**.
  - `range-below-min` / `range-above-max` → `RangeBelowMin`/`RangeAboveMax` (559-570), kind=RANGE, severity fixed ERROR — **STRUCTURAL**.
  - `unknown-surround-material` → `UnknownSurroundMaterial` (573-574), kind=RANGE, severity fixed INFO — **STRUCTURAL**.
- `DqMark` (666-702) is the one storage shape; construction gated through `mark()` (705-720) — no
  vendor-invented free-form marks.

### 1.6 Disposition/quality — the current (B4-wave) state

Freshest relevant commit: `299aa86a` ("B1-B3 model wave (QO42/QT48/QT49)… dq_status→corroboration
and dq→dq_marks…").

- `QualityBlock` (`model_driver.py:954-1014`), `_derive_disposition` (989-1003): disposition is
  strictly **derived**, never stored input — `NO_TS_PUBLISHED` if plugin-set world-fact
  `no_ts_published` is true, else `INCOMPLETE` if `missing` or `parse_errors` non-empty, else `OK`.
- **Disposition has zero dependency on relation-math DQ marks today** — `missing` (structural:
  core T/S fields absent) and `parse_errors` (structural: unit-conversion failures) are the only
  inputs, both structural.
- **`rating` DOES depend on relation-math**: `error_marks` in `spec_emit.py:338-344` is incremented
  for every ERROR-severity mark from `semantic_dq()`, which includes the CALC (relation-math)
  marks, and `rating=L` is triggered by `error_marks` (`spec_emit.py:362-363`). **Deleting py's
  relation-math bucket removes one of the four `rating=L` triggers** (structural triggers —
  missing/invalid/parse_errors — remain).
- The B4 item referenced in the task (disposition-derivation split, ledger QT47) is exactly the
  code just described — already landed, not still in flight.

### 1.7 B5 / calculated-marker — status

`openisd/docs/design/CALCULATED_MARKER_B5_PROPOSAL.md` (read in full) is the existing design doc
for the marker QT56 references. Its own finding: `SpecEntry`/`Reading`
(`model_driver.py:296-427, 439-536`) structurally cannot express "the pipeline computed this" today
— `Reading` requires a non-blank `actual_reading`. **The hazard is latent**: no live scraper/emitter
fabricates a computed T/S value into `driver.yml` today. `model_wdr.py:375-376`'s `.wdr`-only
fallback (below) establishes the pattern that motivated the B5 proposal.
`PROMPT_RELEASE_HARDENING.md:251-259` marks B5 **ON HOLD pending the QT56 ruling**, and already
states the intended resolution verbatim: *"If ruled that way, B5's marker is replaced by a GATE
making pipeline-computed spec values unrepresentable, and the py/oid duplicate relation tables
collapse to the engine's."*

No other "calculated" marker/flag exists anywhere else in `scrapers/scrapers/lib` — grep for
`calculated|is_calculated|computed_marker` across the tree returns only `model_wdr.py`'s
`.wdr`-local `ParStateCode.COMPUTED` (§5 below).

---

## 2. openisd DQ inventory

### 2.1 `packages/engine/src/consistency.ts` — RELATIONS table, `checkConsistency`

All rows are RELATION-MATH (solve one field from others of a different physical role).

| §2 row | file:line | formula | fields | class |
|---|---|---|---|---|
| 1 | 72-73 | `Rms = 2π·Fs·Mms/Qms` | Rms,Fs,Mms,Qms | RELATION-MATH |
| 2 | 75-76 | `Qes = 2π·Fs·Mms·Re/Bl²` | Qes,BL,Fs,Mms,Re | RELATION-MATH |
| 3 | 78-79 | `Rme = Bl²/Re` | Rme,BL,Re | RELATION-MATH |
| 4 | 81-82 | `Rme = 2π·Fs·Mms/Qes` | Rme,Fs,Mms,Qes | RELATION-MATH |
| 5 | 84-85 | `Qts = Qes·Qms/(Qes+Qms)` | Qts,Qes,Qms | RELATION-MATH |
| 6 | 87-88 | `Dd = 2·√(Sd/π)` | Dd,Sd | RELATION-MATH |
| 8 | 90-91 | `Mpow = Bl/√Re` | Mpow,BL,Re | RELATION-MATH |
| 9 | 93-94 | `Mpow = √Rme` | Mpow,Rme | RELATION-MATH |
| 10 | 98-99 | `Vas = ρ₀·c²·Sd²·Cms` | Vas,Cms,Sd | RELATION-MATH |
| 11 | 101-102 | `Fs = 1/(2π·√(Mms·Cms))` | Fs,Mms,Cms | RELATION-MATH |
| 13 | 104-105 | `gamma = Bl/Mms` | gamma,BL,Mms | RELATION-MATH |
| 20 | 107-108 | `Vd = Sd·Xmax` | Vd,Sd,Xmax | RELATION-MATH |

Deliberately excluded, per the file's own header comment (lines 7-24): row 7/21/22
(Mcost/Gloss/SPLmaxLF — ledger QO24 undecided); **row 12, EBP↔Fs — the known bug below**; rows
14-18 (η₀/SPL chain — no `no`/efficiency relation in the RELATIONS table; the engine can
nonetheless COMPUTE η₀ correctly, see below); row 19
(Xmax=|Hc−Hg|/2 — fields never populated).

**The η₀ constant question is settled (2026-08-22).** `packages/engine/src/efficiency.ts:31-33`
computes `referenceEfficiency(Fs,Vas,Qes,c) = efficiencyConstant(c)·Fs³·Vas/Qes`, live in the
solve routes (`driver.ts:194`, `:281`, `:292`) and the sweep (`sweep.ts:214`). There is no
unresolved constant: it is `efficiencyConstant(c)`, derived from the `c` in use. A Wine probe of
real WinISD (Beyma 10BR60V2, `winisd_research/scripts/probe_rme_beyma.py`) matched this form to
0.000000% against WinISD's own saved `no`, while python's `model_wdr.py:471` form — which uses
`Mms` where the textbook form uses `Vas` — was off by a driver-dependent ratio
(`Vas·roo·BL²/Mms`; no universal factor). Python's `.wdr` projection is retired by lane F, so the
python form is not repaired. What remains here is ordinary work, not a blocker: add a `no`
relation to `consistency.ts` (which today contains zero `efficiencyConstant` references).

`checkConsistency` (`consistency.ts:165-207`): computes half-ulp precision intervals per entered
field, propagates through `solveConsistencyGroup`, flags a relation only when the residual exceeds
combined tolerance. **Pure recompute from entered fields at call time — no stored/read DQ state
consulted.**

### 2.2 UI-side DQ display

- `driverHasDqIssues` — `packages/ui/src/db/driverRepo.ts:216-231`. **STRUCTURAL**, computed live
  in TS: checks `Fs>0`, `Re>0`, `(Sd>0 or Vas>0)`, and `qGroupIsIncomplete` (<2 of Qts/Qes/Qms
  present). Not a stored py mark.
- `dqMarks()` — `packages/model/src/openisdDriver.ts:674-` onward: iterates metadata + spec fields,
  collecting each field's `f.dq ?? []`. **This READS stored per-field `DqMark[]` produced
  upstream (by python) — not computed in TS.** Consumed at `openisdDriver.ts:417` to build `.wdr`
  `[DQ]` comment lines, and by UI callers via `driverLibrary.ts:13,95,454`.

**Consequence**: today, oid's UI-visible `dqMarks()` path is *reading python's relation-math
marks* (kind `calc`), while oid's own `checkConsistency` independently *recomputes* 7 of python's
9 relations live. The two paths are not unified — they can disagree, and nothing reconciles them.

### 2.3 EBP/Fs bug — `bugs/BUG_20260821_consistency_relations_miss_the_ebp_fs_route.md`

Filed 2026-08-21, OPEN. Cause: `RELATIONS` never got a row for `Fs = EBP·Qes` when the EBP↔Fs
derivation route was added elsewhere in `driver.ts`; `EBP` participates in no relation in
`consistency.ts`, so no combination of entered values involving it is ever flagged by
`checkConsistency` — even though python's `_WDR_CALCULATABLE` (§1.3) DOES check `EBP = Fs/Qes` via
`calc-consistency`. **This is the one relation python currently catches that oid entirely misses**,
independent of QT56 — it needs fixing regardless of which way QT56 is ruled.

### 2.4 Record schema — does oid have the data to recompute?

`_SpecEntry` (`packages/model/src/openisdDriver.ts:143-151`):

```ts
export interface _SpecEntry {
  origin: SourceRole;
  readings: Partial<Record<SourceRole, Reading>>;
  dq_status?: DQStatus;
  definition?: string;
  dq: DqMark[];
}
```

`Reading` (`packages/model/src/openisdRecord.ts:49-66`): `actual_reading?`, `read_value`,
`read_precision?`, `conformed_reading?`, `conformed_by?`, `rejected?`, `note?`. `DqMark` (69-80):
`kind: 'calc'|'range'`, `severity`, `rule`, `params`, `detail`.

**Confirmed: the record ships every source's raw reading (`readings`, keyed by `SourceRole`) plus
the winning `origin`, not just the winning value** — `winningReading()` (`openisdDriver.ts:152-158`)
is documented as "the one legal way to read a `_SpecEntry`'s value." Per-field `dq: DqMark[]` is
carried too, i.e. openisd currently *loads pre-computed DQ marks* rather than recomputing every
one of them itself.

---

## 3. Overlap table

| relation | in python (`model_wdr.py:_WDR_CALCULATABLE`) | in oid (`consistency.ts` RELATIONS) | status |
|---|---|---|---|
| Qts = Qes·Qms/(Qes+Qms) | yes (tol 0.03) | yes (row 5) | both |
| Vd = Sd·Xmax | yes (tol 0.01) | yes (row 20) | both |
| Dd = 2√(Sd/π) | yes (tol 0.01) | yes (row 6) | both |
| Rme = BL²/Re | yes (tol 0.01) | yes (row 3) | both |
| Mpow = BL/√Re | yes (tol 0.01) | yes (row 8/9) | both |
| gamma = BL/Mms | yes (tol 0.01) | yes (row 13) | both |
| Vas = ρc²Sd²Cms | yes (tol 0.04) | yes (row 10) | both |
| EBP = Fs/Qes | **yes** (tol 0.01) | **no** — BUG_20260821 | **py-only (bug in oid)** |
| no (efficiency η₀) | **yes** (tol 0.02) | **no** relation in RELATIONS — but the engine computes η₀ correctly (`efficiency.ts:31-33`); adding the relation is scheduled work | **py-only today** |
| Rms = 2π·Fs·Mms/Qms | no | yes (row 1) | oid-only |
| Qes = 2π·Fs·Mms·Re/Bl² | no | yes (row 2) | oid-only |
| Fs = 1/(2π√(Mms·Cms)) | no | yes (row 11) | oid-only |

7 of python's 9 relation checks already have an oid equivalent. 2 python-only relations exist
(`EBP`, `no`) with no live oid counterpart — one is a filed bug (EBP), one is an explicit,
documented oid gap (`no`, blocked on an unresolved η₀/SPL constant, not merely missing a row). oid
additionally checks 3 relations (`Rms`, `Qes`, `Fs`-from-Mms/Cms) that python's `_WDR_CALCULATABLE`
does not attempt at all.

---

## 4. What breaks if python's RELATION-MATH bucket is deleted

Scope of deletion: `model_wdr.py:454-474` (`_WDR_CALCULATABLE`), `model_wdr.py:554-591`
(`computable_interval`, if not shared — see §1.3 flag on `derived_precisions`),
`model_wdr.py:620-656` (the relation-math half of `semantic_dq`), and the 3 CALC rules in
`record_registries.py` (`vas-consistency`, `qts-consistency`, `calc-consistency`, `record_registries.py:535-556,584-651` subset).

| stored output | currently depends on relation-math? | breaks if deleted? |
|---|---|---|
| `dq_marks` kind=CALC (`qts-consistency`/`vas-consistency`/`calc-consistency`) | yes, entirely | **yes — these marks disappear from every record.** Nothing replaces them in the record; oid must supply the equivalent live via `checkConsistency`, which it can for 7/9 relations today (§3), cannot for `EBP` (bug, fixable independently) and `no` (blocked on the η₀ constant issue — a real, currently-unresolved gap, not a trivial row addition). |
| `dq_marks` kind=RANGE | no | unaffected — structural, stays in python (§1.3 pass 1, `model_wdr.py:606-618`) |
| `disposition` (OK/NO_TS_PUBLISHED/INCOMPLETE) | no (§1.6) | unaffected |
| `rating` (M/L) | **yes, partially** — one of four triggers (`error_marks`) is fed by CALC marks | `rating=L` for a relation-math mismatch (e.g. a driver whose printed Vas doesn't match Cms/Sd) stops firing in python. Structural triggers (missing/invalid/parse_errors) still work. If oid is meant to be the sole surface for relation-based quality signal, this is intended, not a defect — but it means `rating` in the STORED record can no longer reflect a relation mismatch; only a live oid load/view would show it. |
| `corroboration`/cross-source (`confirmed_fields`, `fields_with_issues`, `MATCH`/`MISMATCH`/`NOT_MATCHABLE`) | no — wholly separate mechanism (§1.1, §1.2) | unaffected; explicitly out of scope of QT56's proposed deletion |
| oid's `dqMarks()`/`.wdr [DQ]` comments | yes — currently reads python's CALC marks (§2.2) | the `.wdr` export's `[DQ]` block loses relation-mismatch lines unless oid's `.wdr` writer is changed to run `checkConsistency` at export time and synthesize equivalent comment lines — **not automatic, requires a code change on the oid side**, not just a deletion on the py side |

**Net**: disposition and cross-source corroboration are unaffected by deleting python's
relation-math. `rating`'s relation-based trigger and the stored `dq_marks[kind=calc]` do disappear
and must be replaced by oid computing and surfacing the equivalent live — which oid's engine
already does for 7 of 9 relations and is missing two to filed, independently-fixable work: EBP
(a recorded bug) and `no`/efficiency (the relation is absent from `consistency.ts`, though the
engine computes η₀ correctly — see the η₀ note above). Neither blocks the split.

---

## 5. `.wdr` projection's computed values — confirmed record-isolated

`model_wdr.py:375` (`Dd = f.get("Dd") or 2·√(Sd/π)`) and `model_wdr.py:376`
(`EBP = f.get("EBP") or Fs/Qes`) inside `build_wdr_dict()` — **fallback fill, only when the
record's own field is absent.** `Dd` and `EBP` ARE in `CANONICAL_SPEC_FIELDS`
(`record_registries.py:300-311`) — legitimate stored spec fields when a source actually publishes
them. Confirmed: `driver.yml`/`openisd.yml` stores whatever a source published for `Dd`/`EBP`, and
this `.wdr`-only fallback fires only when that's absent — it exists because WinISD's `.wdr` INI
format has no "not applicable" concept and must emit something into every slot.

`ParStateCode.COMPUTED` (`model_wdr.py:295`, set only for `Dd`) is a `.wdr`-format-local encoding
(`NOT_PROVIDED`/`ENTERED`/`COMPUTED`, `model_wdr.py:146-165`) that never round-trips into
`driver.yml`/`openisd.yml` — it exists solely to tell WinISD's own UI "this figure in the INI was
computed, not typed."

**Confirmed: these computed values land only in `.wdr` artifacts, never in `driver.yml`/`openisd.yml`
records** — this is the pattern that motivated the B5 proposal (a future emitter doing the same
thing for a stored record would have no legal way to mark it computed), but it is not itself a
present violation.

---

## 6. Recommendation

The evidence supports the human's proposed split, with two qualifications that are not optional:

**Delete from python** (RELATION-MATH only):
- `model_wdr.py:454-474` `_WDR_CALCULATABLE`
- `model_wdr.py:620-656` the relation-math pass of `semantic_dq` (keep the structural range-check
  pass, `model_wdr.py:606-618`)
- `model_wdr.py:554-591` `computable_interval` — **only if** it is not also required by
  `derived_precisions` (`model_wdr.py:501-540`, separate `_DERIVED_FORMULAS` dict,
  `model_wdr.py:493-498`, feeds `.wdr` output only). This dependency was not resolved by the
  research and must be checked before deletion — do not delete blind.
- `record_registries.py` — the 3 CALC `DQ_RULES` entries (`vas-consistency`, `qts-consistency`,
  `calc-consistency`, and their `DqParams` models `VasConsistency`/`QtsConsistency`/`CalcConsistency`,
  `record_registries.py:535-556`). Keep `range-below-min`/`range-above-max`/
  `unknown-surround-material` (structural).
- `spec_emit.py:338-344`/`362-363` — `error_marks` counting and its contribution to `rating=L`
  narrows to structural triggers only (`missing`/`invalid`/`parse_errors`); the CALC-mark branch is
  removed with the marks it counted.

**Keep in python** (out of scope of the proposed deletion): `crosscheck.py` in full, `model_driver.py`'s
cross-source machinery (§1.1, §1.2) — with the caveat that ledger Q41 already calls for this to
move to openisd/JS too, on a different timeline ("waits on the Python→JS seam that Q39's calc
consolidation builds"). QT56's ruling should state explicitly whether it also supersedes/updates
Q41, or leaves cross-source's eventual migration as a separate, later question.

**oid gains** (must land before or with the python deletion, not after):
- Fix `BUG_20260821_consistency_relations_miss_the_ebp_fs_route.md` — add the EBP↔Fs relation to
  `RELATIONS` (`consistency.ts`). Already a filed, independent bug; this makes it load-bearing.
- Resolve the η₀/SPL constant blocker and add a `no`-equivalent relation, or explicitly accept
  losing that one relation-math check with no replacement (a real capability loss, not merely a
  migration formality) until that separate problem is resolved.
- Wire `checkConsistency`'s live results into the `.wdr` export's `[DQ]` comment block
  (`openisdDriver.ts:417`, currently reads the stored `dq: DqMark[]` from the record) — otherwise
  `.wdr` exports silently lose the relation-mismatch annotations they carry today.

**B5 marker**: replaced by a gate, not a stored field, per `PROMPT_RELEASE_HARDENING.md:251-259`'s
already-stated intent — with python's relation-math engine deleted, nothing in the pipeline
computes a T/S value to persist, so the emit path can enforce (e.g. a `_check_constraints` rule, or
simply the absence of any code path that ever constructs a `Reading` without a document/OCR/manual
source) that `SpecEntry`/`Reading` can never be fabricated from a formula. This is cheaper than the
`Ground`-reuse proposal in `CALCULATED_MARKER_B5_PROPOSAL.md`, because it removes the producer
rather than adding a way to label its output — but only holds if the deletion in this section is
complete; if `derived_precisions`/`computable_interval` survive for `.wdr`-only use (per the flag
above), the gate must still make sure that code path is provably `.wdr`-artifact-only and never
reachable from any `driver.yml`/`openisd.yml` emitter.

**Migration cost summary**: python loses ~110 lines across 2 files (`model_wdr.py` relation
block + `record_registries.py` 3 rules) plus the `spec_emit.py` wiring lines; python's `rating`
field becomes structural-only (a real, intended narrowing of what `rating=L` can mean from a
stored record alone). oid gains one bug fix (EBP, already filed), one relation it currently cannot
add without resolving a separate blocker (η₀), and one `.wdr`-export wiring change so exported
`[DQ]` comments don't silently go quiet on relation mismatches. The duplicate relation tables
collapse to oid's single `RELATIONS` array, which becomes the one place a T/S physics relation is
ever encoded.
