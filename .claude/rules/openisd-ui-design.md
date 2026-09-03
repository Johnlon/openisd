---
paths:
  - "packages/ui/src/**/*"
---

# openisd — Vue component design rules

Four further UI rules carry their full rationale in `docs/spec/SPEC_UI.md` §4 (UI-1…UI-4)
and are not repeated here: tooltips on every interactive control (UI-1), box-panel symmetry across
box types (UI-2), WinISD cross-referencing in every tooltip, label, default and doc section
(UI-3), and intrinsic-collapsible vs tunable-always-visible parameters (UI-4). Read them
before changing a panel layout or writing a tooltip.

- **Driver-field purpose rule (single source of truth):** every driver-editor field's tooltip
  lives in exactly one place — the `desc` string of its entry in `PARAMS`
  (`ui/components/DriverDefineModal.vue`). Each `desc` states both (a) what the field _is_ and (b)
  its role in the charts — either which graphs it affects, or that it is descriptive / derived
  / not simulated. The "what each graph needs" legend tooltips read the same `desc` strings via
  `tokPurpose`, so there is no second copy; never add a parallel field-description map. When
  adding or changing a field, verify its purpose against `WINISD.md §13.1` **and** the actual
  engine usage in `packages/engine`, and keep the chart-role clause accurate.

- **Escape dismisses modals:** every modal and overlay closes on the Escape key. Wire it with
  the `useEscToClose(isOpen, onClose)` composable (`src/composables/useEscToClose.ts`) — never
  hand-roll a per-modal keydown listener. Backdrop-click dismissal is also expected on
  overlays. (Native `alert()`/`confirm()` dialogs already handle Escape.) A new modal is not
  done until a browser test presses Escape and asserts it closed
  (`test/modal-escape.browser.spec.ts`).

- **Number-input spinner rule:** up/down steppers belong **only** on live what-if controls —
  inputs that immediately re-render the graphs when nudged (box volume, vent length, losses,
  input power; these use `NumInput.vue`). **Suppress** the spinner
  (`::-webkit-*-spin-button { -webkit-appearance: none; margin: 0 }`) on every non-reactive
  numeric input: datasheet-entry fields in the driver editor, and picker/filter bounds in the
  search min/max. A stepper on a field nothing reacts to is noise; on a live control it is a
  genuine affordance.

- **Alert-colour reserve:** amber/yellow and red are attention colours, reserved for genuine
  alerts — errors and required-but-missing fields (red), warnings (amber). Informational or
  helper text (hints, legends, "click a graph to…" leads) is neutral/muted, never amber.
  Colour that cries wolf stops meaning anything.

- **Filters apply to every list:** any always-visible list section (e.g. "My Drivers")
  respects the active search/type/param filters exactly like the main list — no section is
  exempt. A query that matches nothing must not leave unrelated rows on screen.

- **Authoritative-name display:** show a record's real name from its own data — a driver's
  Brand + Model from the WDR — never a filename, URL slug, or other derived identifier, which
  normalise, lowercase or abbreviate and so mislead. Fall back to the filename only when the
  authoritative fields are genuinely absent.

- **Unique list-key rule:** a `v-for` `:key` is a stable, genuinely unique identifier (e.g.
  source + path-within-source). Never key on a display name that can legitimately repeat — two
  dated files of the same driver share one Brand+Model, and colliding keys make Vue reuse the
  wrong DOM rows (phantom or duplicated entries) and emit a `Duplicate keys found` warning. The
  browser-test console guardrail in `test/fixtures.ts` catches this only if a test renders the
  colliding rows, so drive that state — see `test/driver-search-interactive.browser.spec.ts`.

- **No stretch-fit fields:** a form field's width comes from its own content need, not from
  stretching to fill whatever space its container happens to have (`flex: 1`, or `width: 100%`
  on an input/select without a deliberate reason). Reference: WinISD's own fields
  (`docs/winisd/*.png`) are narrow and natural-width with generous leftover whitespace, never
  edge-to-edge — that is the look to match. Exception: a field WinISD itself renders full-width
  (e.g. Brand/Model text inputs) may stay full-width; that is a decision about that specific
  field, not a default. Before shipping any form or panel layout change, screenshot it next to
  the matching WinISD reference and check whether fields look sized-to-content and lined up, or
  stretched and gapped. A shared component's CSS (e.g. `.row` in `style.css`) may be correct in
  one skin's narrow container and wrong in another's wide one — fix that with a scoped
  `:deep()` override in the consuming skin rather than changing the shared rule, unless the
  shared rule itself is the bug.

- **Save every screenshot:** any screenshot taken during development — parity check, layout
  review, bug repro — is saved to disk, never just viewed and discarded; a screenshot you do
  not keep is one you will have to retake. Save it into the location already established for
  that comparison. For WinISD parity work that is `docs/winisd/`, named after the matching
  reference image with an `_actual` suffix: the reference
  `docs/winisd/view_1_driver_drivers_standard.png` pairs with
  `docs/winisd/view_1_driver_drivers_standard_actual.png`. Name the file after the page or view
  it depicts using the naming shape already used in that folder
  (`view_<n>_<area>_<focus>.png`, `edit_driver_pg<n>_<focus>.png`, `chart_<name>.png`) — pick
  the existing file it corresponds to and reuse its stem rather than inventing a scheme.
