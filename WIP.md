# Work In Progress

---

## Open — do these next

### 0. Resume `mock/` — WinISD UI mockup (logic-free HTML/CSS/JS)

A static, calculation-free mockup of the WinISD UI lives in `mock/` (not part
of the real app — pure look-alike screens with fake values), committed on
`dev`. Read `mock/MOCK_PROMPTS.md` (verbatim prompt history) and
`mock/MOCK_DESIGN.md` (design decisions + open questions, including
unresolved ones like the Box/Vents-tab merge) before continuing.

Landed already (don't redo): 2x2 quadrant layout with book-of-tabs nav
(Box tab now first, before Driver), fills the browser frame with no
scrolling, Driver Editor modal (all 4 tabs column-aligned, with an in-UI
banner distinguishing "editing the project's embedded driver" vs "editing a
My Drivers entry directly"), a full Select Driver picker modal (search +
spec table, plus a working My Drivers tab) — not a dropdown, the Tune
reactive-minimal overlay (custom accelerating spinners, not native), and
Standard/Iso-Barik driver-placement illustrations. The old popup Filter
Editor modal is gone — filters are now inline, reactive rows on the Filters
tab (quick-add buttons, spin-field inputs, inline delete). Exponential-accel
spinners, clickable unit-cycling labels, and the Entered/Calculated/Not-
available ParState legend are now applied across every tab and the Tune
panel, not just the Driver Editor modal. A Manage Drivers toolbar menu
(Customise/Save-as-new/Edit-custom/Delete-custom/Disable-custom) drives an
in-memory "My Drivers" list. Multi-project chart traces are generalized via
`data-project`/`data-trace-for` attributes — both projects' checkboxes now
independently show/hide their own SPL and transfer-function traces.

Still open:

- Box-type cascade: expand the enclosure radio to 6 types (Sealed, Vented,
  Passive Radiator, 4th/6th/8th-order bandpass — "ABC" = Aperiodic
  Bi-Chamber) and wire the Box tab + Vents tab content per type.
- ABC box type: driver mounted on the baffle of the larger (bottom) chamber,
  which also carries the "ABC" label.
- Box tab / Vents-tab merge (see MOCK_DESIGN.md open question) — recommended
  but deferred until the box-type cascade work above, since it changes that
  work's shape.

### 1. Signal chain / EQ (P1 in backlog)

Filters panel (HP, LP, Linkwitz, Peaking EQ) is already fully implemented in the UI
(`FiltersPanel.vue`) and engine (`filters.ts`). High-shelf and low-shelf are NOT yet
built. Listening distance is fixed at 1 m (not user-configurable yet).

---

## Reference — architecture decisions

- `matt/` collection is human-curated — never touch without explicit per-session permission.
- All calculation changes require explicit human approval before touching `packages/engine/src/`.
- Two valid authorities for any sidecar field: (1) scraper writes at scrape time from HTML/PDF;
  (2) `write_driver()` computes at write time from already-extracted fields. No third option.
