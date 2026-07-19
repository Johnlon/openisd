# ARCH REVIEW LOG

Architecture-review runs (append-only, one timestamped section per run — written by the arch-reviewer subagent). Design/structure conformance vs ARCHITECTURE.md + CONTRACT.md.

<!-- new sections appended below -->

## 2026-07-19T11:27:45Z — arch review of 431a13d8b^..431a13d8b

- Mechanical (engine architecture.test.ts): PASS — 3/3 tests green, no engine→DOM/Vue boundary breaks detected.

### 3a — Original-skin ↔ mock fidelity (CRITICAL FOCUS)

The commit's own message says "Phase 0" and explicitly defers "remaining mock modals" to
the backlog — but the stated human requirement reviewed here is that the Original skin be
**visually and structurally IDENTICAL** to `mock/`, with the *only* allowed divergence
being the fake-state/physics swap for the shared store+engine. Judged against that bar,
this commit is a large simplification, not a port. `mock/index.html` is 1190 lines,
`mock/script.js` 1263 lines, `mock/style.css` 644 lines (3097 total); the port,
`packages/ui/src/shells/original/OriginalShell.vue`, is 404 lines total (template ~220
lines). Findings, mock line numbers vs `OriginalShell.vue` line numbers:

- [SEVERITY: high] `packages/ui/src/shells/original/OriginalShell.vue:103-114` vs
  `mock/index.html:24-105` — toolbar is a near-total rewrite, not a port. Mock has 8
  distinct icon-button controls: Open project (icon + dropdown with Open.../recent
  projects, `mock/index.html:27-36`), New project wizard (`:37-39`), Save (`:40-42`), Save
  As dropdown (native/.openisd.yml + Export WPR, `:43-50`), Save All (`:51-53`), Manage
  Drivers (`:55-57`), Options (`:58-60`), Info dropdown (About/Help/Check updates,
  `:61-69`), plus a full ~19-item chart-type dropdown with icon+caret (`:71-102`) and a
  live cursor-readout showing crosshair Hz/dB (`:104`). OriginalShell replaces this with
  two plain text buttons ("Drivers…", "Save"), a bare `<select>` limited to `TABS` (no
  icon, no separators, no the other ~13 WinISD chart types), a text "Info" button, and
  `SkinPicker` (not in the mock at all). Missing entirely: Open project menu, New project
  wizard trigger, Save As (native/.wpr) dropdown, Save All, Manage Drivers icon, Options
  modal trigger, cursor readout.
  why: AD-4/"port not rewrite" — icon buttons condensed to two text buttons and most
  toolbar functionality dropped, not ported.
  suggested fix: port the icon-button set structurally (even as stubs wired to
  `state.browseOpen`/future modals) and keep the full chart-type list + cursor readout.

- [SEVERITY: high] `packages/ui/src/shells/original/OriginalShell.vue:131-139` vs
  `mock/index.html:125-131` — "Signal Generator" panel is a different control, not a port
  with state swapped. Mock's Signal Generator is a **tone generator**: a "Generate"
  checkbox + a frequency input (`value="13.20"`) + Hz unit. OriginalShell's "Signal
  Generator" panel is instead a Power (W) input + a computed drive-voltage readout — this
  is the *Signal tab's* "System input power" control relabelled under the Signal
  Generator heading, not the mock's tone generator ported with real state.
  why: not a state/physics swap of the same control — a different control substituted
  under the same label; the mock's actual Generate/tone-frequency feature is dropped with
  no equivalent.
  suggested fix: port the Generate checkbox + frequency field (wire to a real tone
  generator or, if none exists yet, an honest "not yet implemented" state per the
  project's own convention for unimplemented features) rather than reusing Signal-tab
  power here.

- [SEVERITY: medium] `packages/ui/src/shells/original/OriginalShell.vue:121-128` vs
  `mock/index.html:113-121` — Projects list checkboxes are structurally different. Mock
  uses real `<input type="checkbox">` per row that independently toggles trace visibility
  without removing the row (`toggleProjectTrace`, `:115,119`) and a separate
  `selectProjectRow` for the "current" selection highlight. OriginalShell collapses both
  into one `og-cbx` span whose click handler is `removeCompare(i)` — clicking it deletes
  the compare overlay outright rather than toggling its visibility, and there is no
  separate row-select interaction.
  why: same visual affordance (a checkbox) now carries a destructive action instead of a
  toggle — a behavioural/structural change, not a physics/state swap.
  suggested fix: keep a real checkbox bound to a per-overlay visibility flag; move removal
  to a separate explicit action if desired.

- [SEVERITY: high] `packages/ui/src/shells/original/OriginalShell.vue:279-287` vs
  `mock/index.html:269-315` — Driver tab drops most of the mock's content. Mock has Brand/
  Model fields + 3 buttons (Select Driver, "✎ Edit", "♬ Tune", `:271-276`), plus an entire
  two-column section: Placement (Num. of drivers select, Standard/Iso-Barik radio group,
  Voice coil connection select, and a real wiring-diagram SVG that swaps between
  `wiring-standard`/`wiring-isobarik`, `:277-300`) and Advanced options (Voice coil temp
  rise with unit-cycling, Voice coil resistance TC, Added mass to cone with unit-cycling,
  `:302-313`). OriginalShell's Driver tab is only Brand/Model (readonly) + a "Choose
  driver…" button + the What-If toggle (`DriverWhatIfPanel`) — the entire Placement
  section (num. of drivers, Standard/Iso-Barik, wiring diagrams) and the entire Advanced
  options column are missing.
  why: AD-4 — large regions of a tab dropped rather than ported/stubbed.
  suggested fix: port the Placement + Advanced-options field groups (even against
  placeholder store fields if the engine doesn't yet support multi-driver placement),
  keeping the wiring-diagram SVGs verbatim as done for the box diagrams.

- [SEVERITY: high] `packages/ui/src/shells/original/OriginalShell.vue:293-298` vs
  `mock/index.html:617-641` — Signal tab drops the "Listening place" column entirely
  (Distance, Angle fields, `mock/index.html:618-627`); only the "Signal source" column
  survives (System input power / Driver input voltage / Series resistance).
  why: AD-4 — half the tab's fields dropped.
  suggested fix: port Distance/Angle fields even if not yet wired to the engine's SPL
  calc, or mark them explicitly pending per the project's own "response model pending"
  convention used elsewhere in this same file.

- [SEVERITY: medium] `packages/ui/src/shells/original/OriginalShell.vue:309-312` vs
  `mock/index.html:462-599` (Vents/Enclosure tab) and `mock/index.html:644-672` (Advanced
  tab) — both tabs are fully stubbed with a generic "ported in a later phase" message;
  none of the mock's field content (per-box-type vent groups, PR parameters, environment
  fields, 5-item checkbox column) exists in any form. Two of the seven nav items in
  `PROJECT_TABS` (`:77`) are pure placeholders.
  why: not a partial-fidelity port — zero structural content ported for these two tabs.
  suggested fix: acceptable as an explicitly-scoped phase IF the human has actually
  approved phasing (the review brief here states the requirement is identical porting,
  so flagging rather than waiving); if phasing is approved, the placeholder should name
  what's missing per-tab rather than a generic message, to keep the gap visible.

- [SEVERITY: medium] `packages/ui/src/shells/original/OriginalShell.vue:183-186` vs
  `mock/index.html:336-345` — single-chamber Box fields drop the "Advanced->" link button
  that opens the Box losses modal (Ql/Qa/Qp, `mock/index.html:1088-1106`) and the hidden
  Qtc row (`box-single-qtc-row`, `:342-344`). Neither exists in the port.
  why: AD-4 — a real, wired control (Advanced-> link) dropped with no stub.
  suggested fix: port the link + Box-losses modal (Ql/Qa/Qp are already store-backed
  concepts — `state.P` likely has loss params) or an honest pending affordance.

- [SEVERITY: medium] `packages/ui/src/shells/original/OriginalShell.vue:189-200` vs
  `mock/index.html:384-403` — dual-chamber Box fields drop the calculated
  frequency/tuning readouts entirely. Mock always shows a calculated field per chamber:
  rear "Frc" (`:392`) and front "Tuning freq" (`:401`), both computed+greyed. OriginalShell's
  dual-chamber branch shows only the two Volume inputs — no resonance/tuning-frequency
  readout for either chamber.
  why: a calculated readout the mock always renders is silently dropped, not merely
  deferred behind a "pending" banner (the bandpass4 case IS engine-supported per
  `SUPPORTED_BOX`, so a real Frc/tuning-freq value should be computable and shown).
  suggested fix: add rear/front resonance readouts for the dual-chamber case, matching
  mock's `Frc`/"Tuning freq" labels, at least for `bandpass4` (already in `SUPPORTED_BOX`).

- [SEVERITY: high] Every field in `OriginalShell.vue`'s Box/Signal tabs (e.g.
  `:183-186,193-197,295-297`) vs `mock/index.html` (e.g. `:337,340,476,482...`) — the
  mock's unit-cycling affordance (`class="unit-cyc" data-ug="..." onclick="cycleUnit(this)"`,
  styled via `mock/style.css:625-626` — dotted underline, blue on hover) is completely
  absent. Every `<span class="og-u">` in OriginalShell is inert static text (e.g.
  `OriginalShell.vue:136,183,185,193,197,297`) — none is clickable, none cycles units.
  why: an interactive, house-style control (unit-cycling) is dropped everywhere it
  appears in the mock, not merely swapped for real state.
  suggested fix: either port `cycleUnit` behaviour for `og-u` spans, or if intentionally
  deferred, mark it in the backlog explicitly per-field rather than silently dropping it.

- [SEVERITY: high] Every field in `OriginalShell.vue`'s tabs vs `mock/index.html`'s
  Entered/Calculated/Not-available colour convention (`mock/index.html:255-266` "Unsaved
  changes" bar + parstate legend, and the `entered`/`calculated`/`greyed` classes used on
  nearly every field throughout the file, e.g. `:337,340,392,401,637`) — the entire
  "Unsaved changes" indicator (Save Changes / Revert buttons) and the parstate legend
  (green=Entered / blue=Calculated / black=Not available) are absent from OriginalShell.
  No field in OriginalShell visibly distinguishes entered-vs-calculated state via colour;
  `NumInput.vue` (shared, unmodified) has no entered/calculated colour variant at all.
  why: this is WinISD's signature state-provenance affordance (also called out as a hard
  rule in CLAUDE.md — "Provenance... is sourced where entry happens") and it is missing
  structurally, not merely re-themed.
  suggested fix: port the parstate legend + Save Changes/Revert bar and colour-code fields
  by entered/calculated/unavailable, reusing whatever provenance tracking `stateOf()` (per
  CLAUDE.md) already provides.

- [SEVERITY: high] No structural presence anywhere in `OriginalShell.vue` for 6 of the
  mock's 7 modal/floating-panel structures: Driver editor modal (4 sub-tabs, huge param
  grid, `mock/index.html:688-887`), New Project wizard (`:890-938`), Select Driver modal
  (Library/My Drivers tabs + picker table, `:941-1010`), Options modal (General/Plot
  Window tabs incl. Colors + Limits table, `:1013-1085`), Box losses modal (`:1088-1106`),
  Filter Editor docked panel (`:1165-1180`). Only the Tune floating panel has a rough
  analogue (`DriverWhatIfPanel`, reused unmodified from elsewhere in the app — not ported
  from the mock's `#tune-panel`, `mock/index.html:1111-1160`).
  why: AD-4 — these are named in the commit message itself as deferred ("Backlog entries
  added for... remaining mock modals"), confirming the scope gap is known, not accidental.
  suggested fix: this is the single largest remaining gap; track as the next phase(s) per
  the commit's own backlog entries — flagging here since the review brief's bar is strict
  full-fidelity identity, not phased delivery.

- [SEVERITY: low] `packages/ui/src/shells/original/OriginalShell.vue:98` vs
  `mock/index.html:15` — title-bar text differs: mock says "WinISD 0.7.0.950" (also the
  `<title>`, `mock/index.html:5`), OriginalShell says "OpenISD — WinISD Original Mode".
  why: copy divergence in a region required to be visually identical.
  suggested fix: low priority — acceptable brand differentiation, but note if strict
  fidelity is truly required.

- [SEVERITY: low] `packages/ui/src/shells/original/OriginalShell.vue:162-164` vs
  `mock/index.html:249` — the "Color" control is inert (static swatch + label) in
  OriginalShell; the mock's `.color-btn` has `onclick="cycleColor(this)"` and is a real
  cycling control.
  why: an interactive control degraded to a static display.
  suggested fix: wire click-to-cycle even against a small fixed palette.

- [SEVERITY: low] `packages/ui/src/shells/original/OriginalShell.vue:290` vs
  `mock/index.html:602-614` — Filters tab reuses the shared `FiltersPanel` component
  (pre-existing, not touched by this diff) rather than the mock's WinISD-style quick-add
  button row (`+LP +HP +AP +LT +PEQ +Peak +DLP +Gain`, `mock/index.html:604-611`).
  Reasonable if `FiltersPanel` is deliberately the one cross-skin filters UI, but it is
  visually and structurally unlike the mock's quick-add row and was not verified in this
  review to render identically to it.
  why: unverified — flagging for confirmation rather than asserting a break, since
  `FiltersPanel` predates this diff.
  suggested fix: confirm intentionally, or port the quick-add button row if strict
  fidelity is required here too.

**Positive finding (for balance):** the six box-type cut-through SVG diagrams
(`OriginalShell.vue:205-266`) are byte-for-byte identical path/line/rect data to the
mock's (`mock/index.html:353-454`) — a genuine, faithful port of that region. The 2×2
quadrant layout skeleton (Projects+Signal top-left, Graph top-right, tab-rail
bottom-left, tab-content bottom-right) and the WinISD-light colour palette
(`--acc:#1868d1` etc., matching `mock/style.css:158,310,430...`) are also faithfully
carried over.

- RCA_REQUIRED: no — no mid-build bug evidenced in this range (`git log --format='%s%n%b'
  431a13d8b^..431a13d8b` shows only the feature commit message, TDD red→green noted, no
  bug/regression/broke/revert/hotfix language); no new dated entry expected/found in
  `CODE_REVIEW/POST_MORTEM.md` for this range.

## 2026-07-19 14:19:54 UTC — arch review of commit 8147d3033 (Original skin wholesale port)

- Mechanical (engine architecture.test.ts): PASS — 3/3 tests green, no engine/DOM boundary breaks.
- Scope check: `git show 8147d3033 --stat` touches only `packages/ui/src/shells/original/OriginalShell.vue`, `packages/ui/src/types.ts`, `packages/ui/test/original-skin.browser.spec.ts`. Confirmed `BoxPanel.vue`/`DriverPanel.vue`/`PRPanel.vue` are byte-identical before/after (empty diff) — the commit message's claim that the out-of-scope shared-component edits were reverted is verified true.

### 3a — Original-skin ↔ mock fidelity

- [SEVERITY: high] `packages/ui/src/shells/original/OriginalShell.vue:648-651` (Filters tab), `:725` (Tune), `:726` (Driver Editor) — the commit substitutes three shared, pre-existing components (`FiltersPanel.vue`, `DriverWhatIfPanel.vue`, `DriverEditorModal.vue` — all also used verbatim by `ClassicShell.vue`) for the mock's own markup, instead of porting it. This is a different divergence than the ONE sanctioned swap (fake state/physics → real store/engine): it replaces the mock's DOM/class structure wholesale with a different skin's UI.
  - Filters: mock `mock/index.html:602-614` is a `.filters-quickadd` button row (`+ LP`/`+ HP`/`+ AP`/`+ LT`/`+ PEQ`/`+ Peak`/`+ DLP`/`+ Gain`, `onclick="quickAddFilter(...)"`) + `#filters-list`. `FiltersPanel.vue` (`packages/ui/src/components/FiltersPanel.vue:23-66`) renders unrelated markup (`.flt-item`/`.flt-row`/`.flt-tag`/`.fi`/`.fdel`) with no quick-add buttons at all.
  - Driver Editor: mock `mock/index.html:688-887` is a `.modal.wide` with `.modal-tabs`/`.mtab` and **4** panes (General, Parameters, Advanced parameters, Dimensions — the commit message itself undercounts this as "3 modes") built from `.param-grid`/`.pg-label`/`.pg-input`/`.pg-unit`, plus an 11-button footer (Select Driver / Load driver / Clone / Save As / Export WDR / Save to My Drivers / Create Box / Clone / Clear / Done / Cancel). `DriverEditorModal.vue` (`packages/ui/src/components/DriverEditorModal.vue:60-143`) is a completely different component (`.de-modal`/`.de-tabs`/`.de-tab`/`.de-fld`) with none of that footer.
  - Tune: mock's floating "Tune" overlay (`mock/index.html:1108` on) is not ported; `DriverWhatIfPanel.vue` is reused verbatim.
  why: violates the 3a hard mandate — only the physics/state swap is sanctioned, not swapping in a different skin's whole UI; also contradicts the commit message's own claim of a "faithful port" for these regions.
  suggested fix: port the mock's Filters/Driver-Editor/Tune markup + CSS into Original-skin-scoped markup, wiring the *same* underlying store/filter-array logic that `FiltersPanel`/`DriverEditorModal`/`DriverWhatIfPanel` already use, rather than reusing the components themselves.
  Note: `BACKLOG.md:39,45` already tracks "3-mode Driver Editor, ... Select Driver, Options, ..., docked Tune panel, Filter Editor" as an open gap — this finding is not newly-undiscovered, but the commit message's claim of delivering it is inaccurate and worth correcting.

- [SEVERITY: high] `packages/ui/src/shells/original/OriginalShell.vue:282,300,516` vs `mock/index.html:940-1011` (Select Driver modal) — "New project" and "Manage Drivers"/"Select Driver" all open `state.browseOpen = true`, which mounts the shared `DriverBrowser.vue` (also used by `ClassicShell.vue:164,174` and `DriverPanel.vue:159`). The mock's Select Driver modal has a `.modal-tabs` (Library / My Drivers) and a `#driver-library-actions` row (New driver.../Load driver.../Export WDR.../Customise/Edit) that `DriverBrowser.vue` does not reproduce.
  why: same shared-component substitution as above — not the sanctioned divergence.
  suggested fix: port the mock's Select-Driver two-tab markup, backed by the same catalogue data `DriverBrowser.vue` already exposes.
  Tracked generically in `BACKLOG.md:39,45`.

- [SEVERITY: high] `packages/ui/src/shells/original/OriginalShell.vue:282` vs `mock/index.html:889-938` (New Project wizard) — mock's "New project" toolbar button opens a 2-step wizard (`#modal-new-project`: Step 1 box type, Step 2 starting volume, single vs dual chamber). OriginalShell's "New project" button (title says "pick a driver from the library") just opens the driver browser — the wizard is entirely missing, not merely restyled.
  why: missing region — a control whose title text was rewritten to describe different (lesser) functionality rather than the wizard being ported.
  suggested fix: port the 2-step wizard modal; wire "Next"/box-type-select to `state.box`/`state.P.Vb`/`state.P.Vf` before opening the driver picker.
  Tracked generically in `BACKLOG.md:39,45`.

- [SEVERITY: medium] `packages/ui/src/shells/original/OriginalShell.vue:303-305` vs `mock/index.html:1012-1086` (Options modal) — mock's Options icon opens a tabbed modal (General / Plot window panes). OriginalShell's Options button is `disabled` with title "Options — not yet in OpenISD." This is an intentionally-deferred item, but per the 3a mandate it is still a divergence that must be recorded, not silently passed as fine.
  why: missing modal, honestly labelled but still a fidelity gap.
  suggested fix: either port the Options modal (even as inert fields, matching the Driver-tab "Advanced options" precedent already in this same commit) or add an explicit `BACKLOG.md` line item naming it (currently only bundled into the generic "Modals/docked panels" bullet at `BACKLOG.md:45`).

- [SEVERITY: medium] `packages/ui/src/shells/original/OriginalShell.vue:390` vs `mock/index.html:249` + `mock/script.js:1223-1226` (`cycleColor`) — mock's Color button cycles through a palette on click, changing `btn.style.background` and (per `script.js`) the design's plotted trace colour. OriginalShell's `.color-btn` (`:style="{ background: WINISD_TRACE }"`) has no `@click` handler at all — a static, inert div.
  why: named in the task's checklist ("the Color button") as a region to verify; it is present visually but its one piece of behaviour (click-to-cycle) is entirely missing.
  suggested fix: wire a click handler that cycles a palette and updates the current design's trace colour (there is currently only one hardcoded `WINISD_TRACE`).

- [SEVERITY: medium] `packages/ui/src/shells/original/OriginalShell.vue:396-399` vs `mock/index.html:255-260` (save/revert bar) — mock has an `#unsaved-label` dot+text that appears only when `projectModified` is true (`mock/script.js:629`), plus a **Revert** button (`revertProjectChanges`, `mock/script.js:663`) that discards live changes back to last-saved state. OriginalShell has neither: no unsaved-changes indicator at all, and no Revert button (it substitutes an unrelated "Export .wdr" button in the second slot instead).
  why: missing controls, not merely relabelled — "Revert" is a distinct function (discard) that "Export .wdr" does not provide.
  suggested fix: add a computed `dirty` flag (diff current state vs last save) driving an unsaved-changes indicator, and a Revert action that restores the last-saved snapshot; keep Export .wdr as an addition alongside, not a replacement.
  Partially tracked: `BACKLOG.md:39,43` calls out "provenance + save bar" as a Phase-0 gap; this commit resolved the provenance-colour legend but not the Unsaved/Revert half of that same bullet — worth splitting in BACKLOG.md so the remaining gap isn't marked done by association.

- [SEVERITY: medium] `packages/ui/src/shells/original/OriginalShell.vue:344-345` vs `mock/index.html:118-121` + `mock/script.js:78` (`toggleProjectTrace`) — mock's per-project-row checkbox toggles that trace's visibility on the graph, leaving the row in the Projects list. OriginalShell's checkbox `@click="removeCompare(i)"` **deletes** the compare entry from `state.compare` outright — a destructive action standing in for a toggle.
  why: different control semantics for the same-looking checkbox — a user unchecking to "hide" instead permanently loses the comparison snapshot.
  suggested fix: give each compare entry a `visible` flag; toggle it instead of splicing the array; add a separate explicit remove ("×") affordance if deletion is still wanted.
  Tracked in `BACKLOG.md:44` ("projects-list checkbox is toggle-visibility (not delete)").

- [SEVERITY: medium] `packages/ui/src/shells/original/OriginalShell.vue:557,570` vs `mock/index.html:469-480` (vented enclosure pane) — mock has an "End Correction" `<select>` (0.732/0.613/0.849) next to Vent diameter, and labels the calculated readout "1st port resonance". OriginalShell has no End-Correction control at all (the 0.732 constant is hardcoded inside `ventFb`'s formula, `OriginalShell.vue:91`), and relabels the readout "Port resonance Fb".
  why: a user-facing control (end-correction choice) present in the mock is missing entirely, not merely renamed; label text also diverges.
  suggested fix: expose the end-correction constant as a bound `<select>` feeding the same `ventFb` computation; rename the readout label back to "1st port resonance" for fidelity (or record the rename as a deliberate improvement in `BACKLOG.md` if intentional).

- [SEVERITY: low] `packages/ui/src/shells/original/OriginalShell.vue:352-357` vs `mock/index.html:125-130` (Signal Generator) — mock's frequency field is `<input type="text" value="13.20">`; OriginalShell uses `<input type="number" ... v-model.number="genHz">`. Functionally reasonable (it drives a real tone), but is a type/markup divergence from the mock worth a one-line note; not worth blocking on.

- [SEVERITY: low] Section DOM order — mock's tab `<section>` order in the file is Driver, Box, Vents/Enclosure, Filters, Signal, Advanced, Project (`mock/index.html:269,318,462,602,617,644,675`); OriginalShell's order is Box, Driver, Enclosure, Filters, Signal, Advanced, Project (`OriginalShell.vue:408,512,550,649,654,672,694`), matching the nav-tab order instead. Since only the active `.tab-section` is visible, this has no visual effect, but is a structural (DOM-order) divergence per the letter of the 3a mandate.

- No divergences found in: titlebar; toolbar's 8 icon buttons + chart-select dropdown + ~19-item chart menu + cursor readout (all now ported, closing the corresponding `BACKLOG.md:39-43` bullets); Box tab's 6 box-type diagrams, single/dual-chamber layout, and box-type selector; Driver tab's Placement (num.-drivers, Standard/Iso-Barik radio, wiring) and Advanced-options column; sealed/PR/bandpass4 enclosure panes' field sets (bar the two items above); Signal tab's Listening-place + Signal-source groups; Advanced tab's environment fields + 5 checkboxes; Project tab; Box-losses modal; unit-cycling click affordance; provenance Entered/Calculated/Not-available swatch legend.

### RCA-trigger detection

- Commit message states: "Recovered from a failed port attempt; its out-of-scope shared-component edits (BoxPanel/DriverPanel/PRPanel, which had regressed the Modern skin's PR tests) were reverted — this commit touches only the Original skin + its types/tests." This names a concrete mid-build defect (an out-of-scope edit to shared components broke the Modern skin's PR tests) that was discovered and worked around (reverted) during this build.
- `CODE_REVIEW/POST_MORTEM.md` contains no entries (template only, line 1-5) — no RCA has been recorded for this defect.

- RCA_REQUIRED: yes — bug: an earlier attempt at this port edited `BoxPanel.vue`/`DriverPanel.vue`/`PRPanel.vue` (shared components) and regressed the Modern skin's PR (passive-radiator) browser tests; evidence: commit 8147d3033's own message ("its out-of-scope shared-component edits ... which had regressed the Modern skin's PR tests ... were reverted"); no matching entry exists in `CODE_REVIEW/POST_MORTEM.md`.
