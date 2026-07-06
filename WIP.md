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
independently show/hide their own SPL and transfer-function traces. The
Driver Editor modal now has three distinct modes with their own footer
buttons (project / My Drivers / a standalone toolbar-opened editor that
starts blank and supports Load-from-disk, Save-as-to-disk, and
Create-Box-from-this-driver). The Box tab's enclosure selector is a 6-type
dropdown (Sealed/Vented/Passive Radiator/4th/6th/8th-order bandpass), each
wired to its own Box-tab chamber layout and Vents-tab vent sections
(including the ABC illustration with the driver on the larger chamber's
baffle).

Still open:

- Box tab / Vents-tab merge (see MOCK_DESIGN.md open question) — recommended
  but not yet actioned.

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
