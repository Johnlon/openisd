# Work In Progress

---

## Open — do these next

### 1. `driver_type` and `nominal_size_cm` still null for many drivers

These must be written at **scrape time** (not a post-hoc second-pass script).
For each affected scraper:

- `scrape_sbacoustics.py` — extract category from product page breadcrumb or JSON-LD,
  map to `driver_type` in `parse_product()`.
- `scrape_soundimports.py` — already extracts `_extract_category()` — wire through
  `parse_product()` return dict as `driver_type` using a `_SI_CATEGORY_MAP`.
- `scrape_wavecor.py` — extract `driver_type` from product page category.
- After scraper fix + refresh, `driver_type` filters in the UI will work correctly.

### 2. `winner: "human"` verification path — future manual verification

Plan (not yet implemented): when a human verifies a field value against a datasheet,
the entry gets `winner: "human"` and `reviewed_by` is set. Build a small interactive tool
(`verify_field.py`) that opens the cached PDF, takes the confirmed value, writes back.
No code yet. Design approved in principle.

### 3. Signal chain / EQ (P1 in backlog)

Filters panel (HP, LP, Linkwitz, Peaking EQ) is already fully implemented in the UI
(`FiltersPanel.vue`) and engine (`filters.ts`). High-shelf and low-shelf are NOT yet
built. Listening distance is fixed at 1 m (not user-configurable yet).

---

## Reference — architecture decisions

- `_sources` keys are short identifiers (`datasheet`, `manu_page`, `vendor_page`, `human`) —
  provenance keys, NOT field names.
- `matt/` collection is human-curated — never touch without explicit per-session permission.
- All calculation changes require explicit human approval before touching `packages/engine/src/`.
- Two valid authorities for any sidecar field: (1) scraper writes at scrape time from HTML/PDF;
  (2) `write_driver()` computes at write time from already-extracted fields. No third option.
