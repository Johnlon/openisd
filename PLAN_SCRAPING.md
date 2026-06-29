# Scraping pipeline — plans and open work

Companion to [BACKLOG.md](BACKLOG.md) · [drivers/SCRAPING_RULES.md](drivers/SCRAPING_RULES.md) ·
[WDR_SCHEMA.md](WDR_SCHEMA.md) · [drivers/WDR_FILE_MODEL_AND_WORKFLOWS.md](drivers/WDR_FILE_MODEL_AND_WORKFLOWS.md).

---

## Plan: unify DQ and schema validation (reduce duplication)

**Files:** `scripts/wdr_meta_schema.py`, `scripts/dq_check.py`

### Problem

Both files duplicate work they should share:

- Two WDR parsers (`configparser`-based in schema; hand-rolled `parse_fields` in dq)
- Range bounds for the same fields defined twice and inconsistently (Xmax, Vas, SPL, Re)

They also serve different purposes that must remain separate:

|              | `wdr_meta_schema.py`                                                          | `dq_check.py`                                                      |
| ------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Purpose      | Structural validity — type, mandatory fields, range, calculatable consistency | Heuristic warnings — scraper artifact patterns, cross-field sanity |
| Severity     | Hard errors (malformed file)                                                  | Soft warnings (suspicious value)                                   |
| When it runs | At scraper write time (imported by `scraper_lib`)                             | Post-hoc batch CLI                                                 |

**Decision: keep files separate, wire them together.**

### Steps

1. **Expose a shared parser from `wdr_meta_schema.py`**

   Add a public function `parse_wdr_fields(path: Path) -> dict[str, str]` that wraps the
   existing `configparser` logic already used inside `validate_wdr`. This becomes the one
   parser for WDR files.

2. **`dq_check.py` uses the shared parser**

   Replace `parse_fields` in `dq_check.py` with an import of `parse_wdr_fields` from
   `wdr_meta_schema`. Remove the hand-rolled parser. The rest of `dq_check.py` is unchanged.

3. **DQ range-based rules reference `_WDR_FIELD_SPEC` bounds**

   The rules `Re_low`, `Re_high`, `Qts_high`, `SPL_high`, `SPL_low`, `Xmax_huge`, `Vas_huge`
   each hard-code a threshold that duplicates (or contradicts) the `lo`/`hi` in `_WDR_FIELD_SPEC`.
   Refactor these rules to derive their thresholds from `_WDR_FIELD_SPEC` — so a bound is
   defined once and both layers enforce it consistently.

   Rules that are _stricter_ than the schema bounds (DQ as early-warning) stay as DQ-only
   thresholds; rules that _match_ the schema bounds become a direct import.

4. **Align Xmax and Vas thresholds (prerequisite to step 3)**

   Two bounds currently contradict each other:

   - **Xmax**: schema `hi=0.15 m` (150 mm), DQ flags `> 0.1 m` (100 mm). No real passive
     driver reaches 100 mm; lower schema `hi` to `0.1` to match DQ.
   - **Vas**: schema `hi=1.0 m³` (1000 L), DQ flags `> 2.0 m³` (2000 L). Schema is the
     harder gate; lower DQ flag to `> 1.0 m³` to match schema.

   Both changes require human approval before editing `wdr_meta_schema.py` (see CLAUDE.md
   §Schema discipline). They are range-bound tightening only — no field add/remove/rename.

### What this does NOT change

- The two-file structure (separate schema vs DQ concerns)
- The `scraper_lib` import surface (`validate_wdr`, `validate_meta`, `validate_driver`)
- The DQ CLI interface (`--collection`, `--check-urls`)
- Any DQ rule that is a heuristic beyond schema bounds (cross-field checks, artifact
  patterns — these stay in `dq_check.py` as domain knowledge)
