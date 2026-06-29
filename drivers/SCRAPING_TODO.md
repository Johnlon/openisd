# Driver scraping — outstanding work

`[ ]` = open

Ordered roughly by impact. Each item notes the affected collection(s) and what
the fix requires. All fixes must be scripted — no manual edits.

---

## Data quality / schema fixes

### [ ] 1. Split Wavecor combined variant WDRs

**Collections:** `wavecor/`
**Priority:** high

The Wavecor mfr scraper merges impedance variants into one file:
`FR070WA03_04.wdr` instead of `FR070WA03.wdr` + `FR070WA04.wdr`.
Pattern: model name ends `_NN_NN` (two two-digit suffix codes).

The combined WDR only contains T/S for one variant. `soundimports/` already
has both variants scraped separately with correct T/S data.

**Fix:** detect all `_NN_NN` WDRs in `wavecor/`, rename to the first variant,
look up the second variant in `soundimports/` by model number, and create a
separate WDR for it there (or copy into wavecor/).

---

### [ ] 3. Scan-Speak: SI stores sub-series in brand field

**Collections:** `soundimports/` (Scan-Speak records)
**Priority:** medium

SI's Scan-Speak records use `Brand=Scan-Speak Discovery`, `Brand=Scan-Speak
Illuminator`, etc. instead of `Brand=Scan-Speak`. This prevents model-level
deduplication against the `scan-speak/` mfr collection.

**Fix:** in the SI scraper (or a post-process normaliser), for any brand
matching `Scan-Speak <Series>`, split on the first space after `Scan-Speak`:

- `Manufacturer=Scan-Speak`
- `Model=<Series> <original_model>` — e.g. `Illuminator 18WU/8741T00`

This matches the mfr-collection convention and makes model-level deduplication
work. The series name becomes a searchable prefix in the model string.

---

### [ ] 4. `matt/` and `loudspeakerdatabase/` have no sidecars

**Collections:** `matt/` (411 WDRs), `loudspeakerdatabase/` (24 WDRs)
**Priority:** medium

These collections have zero `_meta.yml` sidecars — no provenance, no URL,
no quality flag. `matt/` drivers came from an imported WinISD library;
`loudspeakerdatabase/` from a third-party database.

**Fix:** create stub sidecars for each WDR marking `quality: L` (low
confidence), `issue: no_provenance`, `source:` pointing to the origin where
known.

---

### [ ] 5. Scan-Speak mfr scraper missing fields (incl. Xmax)

**Collections:** `scan-speak/`
**Priority:** medium

The Scan-Speak scraper only captures 7 T/S fields. `Xmax` is not among them.
Scan-Speak publishes Xmax in their datasheets.

**Fix:** extend the Scan-Speak scraper to extract Xmax (and any other missing
fields) from the product page HTML or PDF.

---

## Coverage gaps

### [ ] 6. SoundImports datasheet coverage: 4% (69 / 1659)

**Collections:** `soundimports/`
**Priority:** medium

Only 69 of 1659 SI drivers have a `datasheet` URL in their sidecar. SI product
pages do link to manufacturer datasheets for many drivers.

**Fix:** add Playwright backfill for SI (similar to `backfill_pe_frd.py`) to
scrape datasheet and FRD links from SI product pages.

---

### [ ] 7. PE manu_page: 0%

**Collections:** `parts-express/`
**Priority:** low

No PE drivers have a `manu_page` URL. PE product pages often link to the
manufacturer site, but this requires HTML scraping.

**Fix:** extend `backfill_pe_frd.py` to also extract manufacturer URLs from
the product page and write to `manu_page` in the sidecar.

---

### [ ] 8. Dayton Audio scraper broken (SSL error)

**Collections:** `dayton-audio/` (not yet scraped)
**Priority:** low

`scrape_dayton.py` fails with `SSLEOFError` on `https://www.dayton-audio.com/sitemap.xml`.

**Fix:** investigate SSL issue — may need certificate bundle update, or switch
to fetching the sitemap via a different entry point.

---

## matt/ T/S discrepancies

Source data: `drivers/DISCREPANCIES.md` (generated 2026-06-27, 87 conflicts across 411 WDRs).
Analysis: 79 false positives, 6 measurement variants (#1/#2), 2 genuine conflicts.

**`drivers/matt/` is human-curated — no script may write to it.** Items 14a–14c
involve analysis scripts only; any actual changes to `matt/` files require explicit
human action. See `HUMAN_REVIEW.md` for the per-item review queue.

### [ ] 14a. Replace fuzzy matcher with exact normalised match + human review of ambiguous pairs

**Collections:** `matt/`
**Priority:** high

The discrepancy checker used 88% fuzzy string matching, which groups different
models from the same family (e.g. `B&C 10FW64` vs `B&C 10NW64` — 1 letter
difference). Model numbers are precise identifiers; a 1-character difference is
a different product. Fuzzy matching is the wrong tool.

**Exact change required in the discrepancy checker script:**

Replace the fuzzy-match grouping step with exact normalised matching:

```python
def normalise(brand, model):
    # 1. Strip leading library-source prefix (e.g. "WT3 ")
    model = re.sub(r'^WT\d+\s+', '', model).strip()
    # 2. Strip trailing measurement-variant suffix (e.g. " #1", " #2")
    model = re.sub(r'\s*#\d+$', '', model).strip()
    # 3. Normalise whitespace and punctuation to single space / hyphen
    brand = re.sub(r'[^\w]', ' ', brand).lower().split()
    model = re.sub(r'[^\w]', ' ', model).lower().split()
    return (' '.join(brand), ' '.join(model))
```

Two WDRs are the same driver iff `normalise(brand, model)` returns the same
tuple. No fuzzy ratio. Drivers in the same model family (different size or
impedance suffix) will no longer be grouped.

Re-run and regenerate `DISCREPANCIES.md`. Expect ~79 false-positive rows to
disappear; remaining groups are true matches (measurement variants or genuine
T/S conflicts).

**Before running the script**, human review is required for Group A and C items
in `HUMAN_REVIEW.md` — some "false positives" are actually naming errors for the
same driver (e.g. `Eminence CA15-4` vs `Eminence CA154`). The script cannot
distinguish a typo from a different product.

---

### [ ] 14b. Tag 6 measurement variants (#1/#2) with sidecar provenance

**Collections:** `matt/`
**Priority:** medium

Six groups contain `#1`/`#2` variants — the same driver measured by different users
or at different times. Both records are valid; they just need provenance.

**Script:** for every WDR whose Model ends `#N`, create a `_meta.yml` sidecar
(if absent) with `issue: user_measurement_variant` and `corrections: "Measurement
variant of [base model] — T/S differ from [other variant(s)]; both retained."`.
Log any that lack a corresponding base record.

---

### [ ] 14c. Resolve 2 genuine T/S conflicts against vendor data

**Collections:** `matt/`
**Priority:** medium

Two unexplained conflicts remain after the above: one blank entry and `B&C 8PS21`.

**Script:** for each genuine conflict, cross-reference T/S values against the
`parts-express/` and `soundimports/` collections by exact `Brand+Model` match.
Write the winning value (vendor-sourced wins over unknown provenance), record the
decision in `corrections`, and log any case where no vendor match exists for human
review in `_problems.log`.

---

## Hacks to encode (pipeline not yet reproducible without these)

### [ ] 15. Merge `backfill_pe_frd.py` into `scrape_pe.py` — eliminate the backfill hack

**Files:** `scripts/scrape_pe.py`, `scripts/backfill_pe_frd.py`
**Priority:** high

`backfill_pe_frd.py` exists because `scrape_pe.py` used static urllib and missed
JS-rendered product HTML. It is a patch on a broken scraper, not a legitimate
long-term script.

**Fix:** integrate Playwright into `scrape_pe.py` so one run does everything:

1. API fetch for T/S data (existing)
2. Playwright fetch of product HTML → pedocs `datasheet` + `frd` URLs
3. Obsolete detection from HTML (`cart-add-to-cart-button disabled … No Longer Available`)
4. URL sanitisation (percent-encode spaces, strip query strings before extension check)
5. Apply `MANUAL_DECISIONS` dict overrides
6. Write WDR + `_meta.yml` in one pass

The `_html/` cache stays — Playwright results are cached so re-runs are fast.
Once `scrape_pe.py` produces correct output in one pass, delete `backfill_pe_frd.py`.

Items 16 and 17 are absorbed into this task.

---

### [ ] 15a. Add `MANUAL_DECISIONS` to `scrape_pe.py`

**File:** `scripts/backfill_pe_frd.py` — worker loop
**Priority:** high

Add `OBSOLETE_PAT` check inside `_worker()` alongside FRD/datasheet extraction:

```python
OBSOLETE_PAT = re.compile(
    r'cart-add-to-cart-button[^>]*disabled[^>]*>\s*No Longer Available', re.I)
meta["obsolete"] = True if OBSOLETE_PAT.search(html) else None
```

Write `obsolete` to sidecar on every run (not just when null), so stale flags
are corrected when PE re-enables a product.

---

### [ ] 16. Encode URL percent-encoding into `backfill_pe_frd.py`

**File:** `scripts/backfill_pe_frd.py` — `_parse_pedocs()`
**Priority:** high

After extracting any pedocs URL, sanitise it before writing to sidecar:

```python
from urllib.parse import quote
url = quote(url, safe=':/?=&#%+@')
```

Prevents spaces and control characters in URLs (GRS `Spec Sheets/` path hit this).

---

### [ ] 17. Add `MANUAL_OBSOLETE` guard to `backfill_pe_frd.py`

**File:** `scripts/backfill_pe_frd.py`
**Priority:** medium

Human-confirmed obsolete drivers must survive a `--refresh` re-run. Add:

```python
MANUAL_OBSOLETE = {"264-1520"}  # Peerless NE315W-04 — confirmed obsolete via Digikey 2026-06-27
```

In the worker: if `sku in MANUAL_OBSOLETE`, always set `meta["obsolete"] = True`
regardless of HTML content.

---

### [ ] 22. Capture all datasheet fields — non-T/S data into `specs:` block in `_meta.yml`

**Collections:** all
**Priority:** high

WDR files hold only T/S parameters. All other data the datasheet publishes
(sensitivity, power handling, frequency range, Hc/Hg/Xlim, VCd, physical
dimensions, materials, DVC info) must be captured and stored in `_meta.yml`
under a `specs:` block. Nothing from the datasheet should be discarded.

**New `_meta.yml` schema:** `specs:` dict with fields including:
`sensitivity_dB`, `sensitivity_ref`, `power_rms_W`, `power_peak_W`,
`freq_low_Hz`, `freq_high_Hz`, `Hc_mm`, `Hg_mm`, `Xlim_mm`, `VCd_mm`,
`diameter_mm`, `cutout_mm`, `depth_mm`, `weight_kg`,
`cone_material`, `surround_material`, `magnet_material`, `vc_material`,
`num_voice_coils`, `vc_wiring`.

**DQ cross-checks to add:**

- If `Hc_mm` + `Hg_mm` present: verify `abs(Hc-Hg)/2 ≈ Xmax` from WDR
- If `power_rms_W` differs from WDR `Pe` by >20%: log PROBLEM
- If `sensitivity_ref` contains "1W": flag as power-sensitivity, not voltage

**Scrapers to extend:** all (PE, SB, SS, Wavecor, SI).

**Also capture for fact sheet / search (full content, not just specs):**

- `description` — product description paragraph (marketing copy)
- `features` — bullet points verbatim
- `series` — product family/line name (SATORI, Illuminator, Reference, etc.)
- `applications` — what the driver is marketed for
- `ean` / `part_number` — barcode and vendor SKU
- `images` — all product image URLs
- `in_stock`, `price_usd` — volatile, tag with scrape date
- `certifications` — RoHS etc.
- `materials.*` — cone, surround, dust cap, frame, magnet, vc wire, vc former
- `num_voice_coils`, `vc_wiring` — DVC detection

Full schema and extraction detail in `SCRAPING_REMEDIATION_PLAN.md` § ITEM J.

---

## Infrastructure

### [ ] 13. Add `_problems.log` to all scrapers

**Collections:** all
**Priority:** high

All scrapers must write a structured problem log to `drivers/<collection>/_problems.log`.
See CLAUDE.md §"Script rules — scraper problem logs" for the required format.

Log must include: missing mandatory fields (`Brand`, `Model`, `Manufacturer`, `Fs`),
unparseable values (raw string + parse attempt), unexpected URL responses (status +
content-type), skipped items with reason, and full tracebacks for exceptions.

Each run appends a header line so history is preserved. A clean run writes
`problems=0` — absence of a log is not acceptable.

Scrapers to update: `scrape_pe.py`, `scrape_sb.py`, `scrape_scan_speak.py`,
`scrape_wavecor.py`, `scrape_si.py` (SoundImports), `scrape_dayton.py`.

---

## Housekeeping

### [ ] 11. One `matt/` WDR still has `boxbench_` fields

One file in `matt/` had no `ParState=` line so the strip script skipped it.
Find and strip manually.

---

### [ ] 23. Merge cross-collection link backfill into `restore_matt_from_archive.py`

**Collections:** `matt/`
**Priority:** high

`backfill-matt-links.mjs` was deleted but its logic must live somewhere. It
cross-referenced matt/ WDRs against scraped collections (parts-express,
soundimports, sb-acoustics, scan-speak, wavecor) by exact brand+model match and
copied `datasheet`, `manu_page`, `vendor_page`, `frd`, `impedance` into matt/
`_meta.yml` sidecars where missing.

**Fix:** port this logic into `restore_matt_from_archive.py` as a post-restore
step. Recover the original implementation from git:

```
git show 1e41e43e:scripts/backfill-matt-links.mjs
```

The field names are now `_meta.yml` keys (not `boxbench_*` WDR fields), so the
port must read/write sidecars rather than appending to WDR files.

---

### [ ] 24. B&C coaxials misclassified — PE labels them "Midbass Speaker"

**Collections:** `parts-express/` (B&C drivers)
**Priority:** medium

Parts Express describes some B&C coaxials as "Midbass Speaker" (e.g. `12PE32`, `6PE13`).
The PE scraper gets the product title from PE, not from B&C's own website, so the
"Coaxial" keyword never appears in the WDR name and the app classifies them as woofers.

B&C's PE-series model numbers (e.g. `12PE32`, `6PE13`, `10PE32`) are all coaxials.
The `manu_page` link in the sidecar points to `bcspeakers.com/en/products/...`; the
URL path contains `lf-driver` rather than `coaxial` for some, so URL-parsing is not
reliable either.

**Fix:** in `scrape_pe.py` (or a post-process script), for any driver with
`Brand=B&C Speakers` whose model matches `/^\d+PE\d+/`, write `driver_type: coaxial`
to the sidecar. The app reads `driver_type` from the sidecar and uses it to override
auto-classification.

Alternatively, extend `backfill_pe_frd.py` to fetch the B&C product page and look
for "coaxial" in the `<h1>` title — B&C's own titles say "Professional Enhanced Coaxial
Speaker" even when the URL path says "lf-driver".

---

### [ ] 12. PE obsolete drivers — set `dq_issue`

77 PE drivers have no datasheet; of these, the ones flagged `obsolete: true`
should also carry `dq_issue: obsolete` so the DQ check reports them cleanly
rather than as missing-datasheet warnings.
