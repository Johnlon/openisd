# Scraping pipeline — plans and open work

Companion to [BACKLOG.md](BACKLOG.md) · [drivers/SCRAPING_RULES.md](drivers/SCRAPING_RULES.md) ·
[WDR_SCHEMA.md](WDR_SCHEMA.md) · [drivers/WDR_FILE_MODEL_AND_WORKFLOWS.md](drivers/WDR_FILE_MODEL_AND_WORKFLOWS.md).

---

## Plan: universal value provenance in `_meta.yml`

### Goal

Every value that appears in a `_meta.yml` sidecar must carry provenance — where it came from. This applies to T/S fields mirrored from the WDR AND to all other sidecar fields (quality, URLs, driver_type, specs values, etc.).

### WDR files stay unchanged

WDR is a fixed WinISD INI format (`Key=Value` plain scalars). Provenance for WDR field values cannot go into the WDR itself — it lives in the sidecar `_meta.yml`. This is what `field_provenance` already does for T/S fields. That structure is extended, not replaced.

### Proposed `_meta.yml` shape

A `_sources` index at the top maps integer keys to source descriptors. Every value in the file becomes a `[value, source_key]` two-element list. Source types include `html`, `pdf`, `adv_pdf`, `calculated`, `scraper`.

```yaml
_sources:
  1: { type: html, url: "https://www.wavecor.com/product/wf275bd01" }
  2: { type: pdf, path: "datasheets/wf275bd01.pdf" }
  3: { type: calculated, formula: "roo × c² × Sd² × Cms" }
  4: { type: scraper, name: "scrape_wavecor.py", run: "2026-06-29" }

quality: [M, 4]
source: ["https://wavecor.com/...", 1]
datasheet: ["https://wavecor.com/pdf/...", 1]
driver_type: [woofer, 1]
Fs: [42.0, 2]
Vas: [0.0134, 3]
```

### Relationship to existing `field_provenance`

`field_provenance` currently records the full multi-source contest for T/S fields — all competing source values and which won. Under the new scheme the winning value + source key appear inline as `[value, src]`. Two options:

- **Keep contest record:** retain `field_provenance` sub-record alongside inline tuple for full auditability (PDF said 42.0, HTML said 42.5, HTML won). Larger files, more complete.
- **Winner-only:** drop `field_provenance`; inline `[value, src]` is the only record. Simpler, loses the losers' values.

**Open question for human to decide before implementation.**

### Schema changes required

`wdr_meta_schema.py` `MetaModel` must be redesigned:

1. Add `_sources: dict[int, SourceEntry]` field where `SourceEntry` has `type` + optional `url`/`path`/`formula`/`name`/`run`.
2. Every existing field type changes from `Optional[str]` / `Optional[float]` / `Optional[bool]` to `Optional[tuple[<type>, int]]` — a `(value, source_key)` pair validated against `_sources`.
3. `FieldProvenanceEntry` either stays (contest record) or is removed (winner-only).
4. `extra="forbid"` is retained.

### Migration impact

All ~4,700 existing `_meta.yml` files fail the new schema — a breaking change. The correct fix is to update scrapers and re-run them (no patch scripts). Collections without a migrated scraper temporarily have no valid sidecar until their scraper is updated.

### Steps

1. **Decide:** keep full contest record in `field_provenance` alongside inline tuple, or winner-only?
2. **Schema redesign:** update `MetaModel` and `FieldProvenanceEntry` in `wdr_meta_schema.py` (human approval required — schema change).
3. **Scraper lib update:** `scripts/scrapers/scraper_lib.py` `write_meta()` builds `_sources` index and writes `[value, src]` tuples for every field it populates.
4. **Old scraper migration:** old scrapers in `scripts/` migrated to new lib (overlaps with scraper migration plan step 2 above).
5. **Validation update:** `validate_meta()` validates source keys exist in `_sources`; type-checks the value half of each tuple.

---

## Plan: specs + field_provenance — provenance gaps and missing data

### Context

Two `_meta.yml` fields track different things and must stay separate:

| Field              | What it tracks                     | Keys                          | Values                                                     |
| ------------------ | ---------------------------------- | ----------------------------- | ---------------------------------------------------------- |
| `field_provenance` | Provenance of T/S parameters → WDR | WDR field names (Fs, Re, BL…) | Which source (pdf/adv_pdf/html) had which value; which won |
| `specs`            | Non-T/S product data (not in WDR)  | Manufacturer spec names       | Scraped values, possibly nested by component               |

**Decision: do NOT combine them.** Combining would force non-T/S product data into the T/S provenance model. They serve different consumers: `field_provenance` is the audit trail for simulation; `specs` is reference data for the UI/research.

### Root causes of missing data

**Missing `field_provenance` in most collections:**
Only the new `scripts/scrapers/scraper_lib.py` writes it. Old `scripts/scraper_lib.py` has no provenance tracking. Affected: dayton-audio, parts-express, scan-speak, new_ss_tool, sb-acoustics, loudspeakerdatabase.

**Missing / null `specs` in sb-acoustics:**
All 202 `_meta.yml` files show `specs: null`. Two candidates: (1) scraper not re-run since `specs` was added to schema; (2) coaxial detection in `scrape_sbacoustics.py` (`product.get("specs")`) is returning None. Unknown which until the scraper is re-run and the problem log inspected.

**Missing `specs` in all other collections:**
No other scraper was written to extract non-T/S product specs. Feature gap.

### Steps

**Step 1 — Diagnose sb-acoustics `specs: null`**
Re-run `scripts/scrape_sbacoustics.py` and inspect `drivers/sb-acoustics/_problems.log`. If `specs` is still null after a fresh run, fix the coaxial detection logic in the scraper, then re-run. No data file edits.

**Step 2 — Migrate old scrapers to new scraper_lib**
Old scrapers in `scripts/` must use `scripts/scrapers/scraper_lib.py` so they write `field_provenance`, `freq_low_hz`, `freq_high_hz`. Affected:

- `scripts/scrape_dayton.py`
- `scripts/scrape_pe.py`
- `scripts/scrape_scanspeak.py`
- `scripts/scrape_sbacoustics.py`
- `scripts/scrape_wavecor.py` and `scrape_soundimports.py` (already migrated — verify)

Migration pattern: scraper builds `product` dict and calls `scraper_lib.write_meta(...)`, passing all three source extraction results (pdf, adv_pdf, html). New lib handles provenance internally.

**Step 3 — `specs` extraction for structured collections**
Where manufacturer pages publish structured non-T/S specs, add extraction to the scraper's HTML parser and populate `product["specs"]`. Priority: sb-acoustics coaxials first, then others as data quality warrants.

**Step 4 — Schema note (no action)**
`specs` has no per-field provenance sub-structure. Acceptable: non-T/S specs typically come from one source and don't need conflict resolution. Revisit only if PDF-vs-HTML conflicts emerge for `specs` fields.

### Verification

- Step 1 done: at least one coaxial sb-acoustics `_meta.yml` has `specs:` non-null
- Step 2 done: `field_provenance` non-null in a freshly scraped dayton-audio or scan-speak file
- `python scripts/wdr_meta_schema.py` passes on all updated files
- `dq_check.py` shows no new issues

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
