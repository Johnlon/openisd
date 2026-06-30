# Work In Progress

---

## Open — do these next

### 1. Parts-Express: 1346 WDR files need regeneration

`scripts/scrapers/scrape_pe.py --refresh` — rewrites all PE files with the current scraper:
full T/S specs provenance block, calculated Vd/Dd/EBP, correct date format.

### 2. SoundImports: 1649 WDR files need regeneration

`scripts/scrapers/scrape_soundimports.py --refresh` — rewrites all SI files:
fixes Vas ft³ bug, correct date format, full specs provenance.

### 3. Scan-Speak: 121 WDR files need regeneration

`scripts/scrapers/scrape_scanspeak.py --refresh` — rebuilds with current scraper.

### 4. `driver_type` and `nominal_size_cm` still null for many drivers

These must be written at **scrape time** (not a post-hoc second-pass script).
For each affected scraper:

- `scrape_sbacoustics.py` — extract category from product page breadcrumb or JSON-LD,
  map to `driver_type` in `parse_product()`.
- `scrape_soundimports.py` — already extracts `_extract_category()` — wire through
  `parse_product()` return dict as `driver_type` using a `_SI_CATEGORY_MAP`.
- `scrape_wavecor.py` — extract `driver_type` from product page category.
- After scraper fix + refresh, `driver_type` filters in the UI will work correctly.

### 5. `winner: "human"` verification path — future manual verification

Plan (not yet implemented): when a human verifies a field value against a datasheet,
the entry gets `winner: "human"` and `reviewed_by` is set. Build a small interactive tool
(`verify_field.py`) that opens the cached PDF, takes the confirmed value, writes back.
No code yet. Design approved in principle.

### 6. Mobile/responsive UI (P1 in backlog)

### 7. Signal chain / EQ (P1 in backlog)

---

## Reference — architecture decisions

- `_sources` keys are short identifiers (`datasheet`, `manu_page`, `vendor_page`, `human`) —
  provenance keys, NOT field names.
- `matt/` collection is human-curated — never touch without explicit per-session permission.
- All calculation changes require explicit human approval before touching `src/core/`.
- Two valid authorities for any sidecar field: (1) scraper writes at scrape time from HTML/PDF;
  (2) `write_driver()` computes at write time from already-extracted fields. No third option.
