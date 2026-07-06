# Work In Progress

---

## Open — do these next

### 0. Resume `mock/` — WinISD UI mockup (logic-free HTML/CSS/JS)

A static, calculation-free mockup of the WinISD UI lives in `mock/` (not part
of the real app — pure look-alike screens with fake values), committed on
`dev`. Read `mock/MOCK_PROMPTS.md` (verbatim prompt history) and
`mock/MOCK_DESIGN.md` (design decisions + open questions, including
unresolved ones like the Box/Vents-tab merge) before continuing.

Landed already (don't redo): 2x2 quadrant layout with book-of-tabs nav,
fills the browser frame with no scrolling, Driver Editor modal (all 4 tabs
column-aligned), Filter Editor with working Add/Modify/Delete, Options
modal, a full Select Driver picker modal (search + spec table — not a
dropdown), the Tune reactive-minimal overlay (native number-input spinners
already on its fields), and Standard/Iso-Barik driver-placement
illustrations.

Still open:
- Box-type cascade: expand the enclosure radio to 6 types (Sealed, Vented,
  Passive Radiator, 4th/6th/8th-order bandpass — "ABC" = Aperiodic
  Bi-Chamber) and wire the Box tab + Vents tab content per type.
- ABC box type: driver mounted on the baffle of the larger (bottom) chamber,
  which also carries the "ABC" label.
- Exponential-accel spinners on reactive (Tune-panel-style) numeric fields
  app-wide (native spinners already on Tune; needs the custom accelerating
  hold behavior + broader coverage).
- Clickable unit labels that cycle through each field's defined unit set.
- ParState color coding (Entered/Calculated/Not-available/Error) applied
  consistently across editor + Tune fields, not just the Driver Editor modal.
- Manage Drivers top-nav menu (Customise/Save-as-new/Edit-custom/
  Delete-custom/Disable-custom).
- Filters tab redesign: per-type quick-add buttons, scrollable filter list,
  inline delete icons, and inline editable spinners instead of the Filter
  Editor popup.
- Multi-project selection should show every checked project's trace on the
  chart (currently only one hardcoded second-trace toggle exists).

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
