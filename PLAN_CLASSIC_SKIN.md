# Classic (WinISD) skin — plan

Companion to [CLASSIC-SKIN-review.md](CLASSIC-SKIN-review.md) (the original
severity-ordered fidelity audit) and [BACKLOG.md](BACKLOG.md). This file tracks
the working plan for the classic-skin build-out: what's done, what's still open,
and what's deliberately out of scope for now. Unlike most project docs, this one
is allowed to record a done-list over time — it's a working plan, not permanent
documentation (see CLAUDE.md's "no history in documentation" rule and its
carve-out for planning files).

## Goal

Recreate the WinISD 0.7.0.950 desktop app as a skin over OpenISD's shared
engine/store — every screen matched against the real reference screenshots in
`docs/winisd/*.png`, with an explicit **screens-first** approach: get layout,
fields, and navigation right (placeholder or cheap-real values) before wiring
deep functionality.

## Done

**Layout & fidelity fixes**

- Dropped the quadrant-divider grid, gave the plot ~75% height, fixed the
  cursor readout and in-plot legend clutter (`CLASSIC-SKIN-review.md` #5-#10).
- Fixed the filters-don't-trigger-a-resweep store bug (shared, not classic-only).
- Compact fixed-height budget for the bottom row (`.cl-body`) so the chart gets
  most of the space with no scrollbars on the common case; `.cl-br` uses
  `overflow-y: auto` (not `hidden`) so genuinely-long content (bandpass with box
  losses expanded, many filters, the driver What-If overlay) scrolls instead of
  clipping invisibly.
- Fields no longer stretch-fit their container (`.claude/context/ui-rules.md`
  "No stretch-fit fields" rule) — natural WinISD-proportioned widths throughout.
- Fixed CRLF/shebang corruption in `scripts/*.sh` that was silently breaking
  script execution on checkout.

**Driver editing — split into two distinct concepts**

- **Edit** (pencil next to Brand/Model): `DriverEditorModal.vue` — a real popup
  recreating WinISD's 4-tab "Driver editor" dialog (General/Parameters/Advanced
  parameters/Dimensions) field-for-field against `edit_driver_pg1-4.png`. Real
  provenance colouring (Entered/Calculated/Not-available) reads the Driver ADT's
  actual E/C/N state, not decoration. Fields the engine doesn't model (Manufacturer,
  Date added, thermal params, most figure-of-merits, all Dimensions) are visibly
  disabled with an honest note, never faked.
- **What-If** (text link under Brand/Model): `DriverWhatIfPanel.vue` — a
  `position: fixed` floating overlay (not a modal, not an inline swap) so the
  graph stays visible and redraws live as you type. Horizontal WinISD-style
  field rows (label above box, unit beside), our own field order
  (Fs/Qts/Qes/Qms/Vas/Sd/Re) for in-app familiarity. Four scoped actions: Reset
  (→ common/library model), Cancel (→ snapshot from when this session opened),
  Save to My Drivers (name it, never touches the live project), Done (keep
  edits, close) — nothing here can ever overwrite the shared driver library.

**Passive Radiator — same Edit/What-If split**

- `PREditModal.vue` (popup: PR name/count/Sd/Xmax/Fs/Qms/Vas) +
  `PRWhatIfPanel.vue` (fixed overlay: added mass / Total Mms / Fp / Fs+mass).
- Fixed BoxPanel embedding the _entire_ PR editor inline in the Box tab (WinISD's
  Box tab only shows Volume/Fh for the PR type — the PR's own specs live on the
  separate Passive Radiator tab). `BoxPanel.vue` gained a `variant` prop
  (`'common' | 'type'`, default unset = original single-panel behaviour) so
  classic can split Type/Vb/losses from the type-specific fields across two rail
  tabs without touching modern.
- The 3rd rail tab's label now tracks the selected box type (Vented / Bandpass /
  Passive Radiator) and hosts that type's specific fields; sealed shows an honest
  "nothing extra" note instead of a dead tab.

**New screens** (all screens-first: real store bindings where cheap, honest
static placeholders where the engine doesn't model something yet)

- **Signal** — "Listening place" (Distance/Angle, not modelled) / "Signal
  source" (System input power, Driver input voltage, Series resistance — real,
  maps to `state.P.Pin`/`Rs`), two-column, matches `view_5_signal.png`.
- **Advanced** — Temperature/Relative humidity/Air pressure + derived Sound
  velocity/Air density (real formula, `c ≈ 20.05√T`) + 5 checkboxes (Simulate
  voice coil inductance, Force flat response, transmission-line port model, "Rg
  is at driver side" — verified label, not "Rd", SPL graph Xmax-limited); none of
  the checkboxes are wired to the engine yet. Matches `view_6_advanced.png`.
- **Project** — Creator/Created/Modified/Description, backed by a real (if
  simple) `state.project`, persisted through `serialize`/`applyState` and the
  local-storage round-trip. Matches `view_7_advanced.png` (actually the Project
  tab).

## Outstanding

Roughly in the order it makes sense to tackle them:

1. **Functionality pass on the screens-first placeholders** — these currently
   look right but don't do anything:
   - Advanced tab's 5 checkboxes and Temperature/Humidity/Pressure fields (no
     engine path consumes them yet).
   - Signal tab's Distance/Angle (no listening-position model exists).
   - Driver Editor modal's Save/Load/Clear buttons (currently inert/no-op).
2. **Classic-skin Color swatch is inert** — see `BACKLOG.md`, needs a real
   `<input type="color">` writing a per-design colour, replacing the hardcoded
   `WINISD_TRACE` constant.
3. **Skin-selection gate on load** — see `BACKLOG.md`, a full-screen chooser
   before the app is usable.
4. **Hold-to-increment spinners** — holding a numeric spinner longer should
   accelerate the increment (not yet built anywhere in the app).
5. **Draggable spinners** (click-drag to scrub a value) and **live graph update
   while dragging** (not just on release) — mentioned as a cross-cutting request,
   not yet built.
6. Remaining classic screenshot-gate polish: batch a few more `_actual.png`
   passes for Box (sealed/bandpass4 variants) and Filters (>4 filters, mixed
   types) now that the layout groundwork is done — cheap to verify, not yet
   re-checked since the `overflow-y: auto` fix.

## Explicitly out of scope for this plan

- **Modern-plus** (responsive desktop+mobile shell) and the reserved mobile
  skin — a separate, later phase (`ui-skins-plan`), not part of classic-skin
  fidelity work.
- Modern-skin-only requests noted earlier (left-nav width, graph-type chip
  wrapping, "Graphs:"/"Range:" label prefixes) — these are modern's own UX,
  tracked separately, not a classic-skin concern.
