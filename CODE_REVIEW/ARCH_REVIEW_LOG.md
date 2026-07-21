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

## 2026-07-19 22:37:11 UTC — arch review of e097f5e19 (Original skin: Color cycle, bandpass Frc/Tuning readouts, 1st-port-resonance label)
- Mechanical (engine architecture.test.ts): PASS — 3/3 tests green, no engine boundary violations.
- Invariant check 1 (Modern unchanged in effect): PASS — `git show --stat e097f5e19` touches only `packages/ui/src/shells/original/OriginalShell.vue` and `packages/ui/test/original-skin.browser.spec.ts`. No shared component (BoxPanel/DriverPanel/PRPanel/GraphPanel/etc.) and no ModernShell edited.
- Invariant check 2 (Engine unchanged): PASS — no files under `packages/engine/**` or `packages/winisd/**` touched.
- [SEVERITY: medium] packages/ui/src/shells/original/OriginalShell.vue:443,449 vs mock/index.html:392,401 — the new bandpass "Frc" (rear) and "Tuning freq" (front) readouts render `<span class="unit">Hz</span>` (static, non-interactive), but the mock's equivalent rows use `<span class="unit unit-cyc" data-ug="freq" onclick="cycleUnit(this)">Hz</span>` — a clickable unit-cycling control, consistent with every other frequency readout in both the mock and this same file (e.g. OriginalShell.vue:434 `cycleUnit('fc','freq')`, OriginalShell.vue:582 `cycleUnit('fb','freq')`).
  why: structural/behavioural divergence from the mock (AD-4/UI fidelity) — introduced by this commit, not pre-existing; every other calculated-Hz field in the app is unit-cycleable and these two silently are not.
  suggested fix: wire `<span class="unit unit-cyc" @click="cycleUnit('...','freq')">{{ unit('...','freq') }}</span>` for both new rows, adding whatever unit keys (e.g. `frc`/`tf`) the existing `cycleUnit`/`unit` helpers need — same pattern as the adjacent Fsc/Fh and Port-resonance rows.
- [SEVERITY: low] Color-cycle behaviour (packages/ui/src/shells/original/OriginalShell.vue:39-45, 249, 402) — sanctioned improvement over the mock's label-only `cycleColor(this)` (mock/index.html:249, which only relabels/recolors the swatch text with no functional effect elsewhere). Here the cycled colour is fed live into the shared GraphPanel's existing `primaryColor` prop, so the trace itself changes. Noted per review brief as an intentional, sanctioned divergence — not a finding requiring action, flagged for the record only.
- Fidelity/honesty check (item 4): PASS — `rearResonance` (OriginalShell.vue:87-91, `Fs·√(1+Vas/Vb)`) and `helmholtzFb`/`frontTuning` (OriginalShell.vue:94-103, using engine-imported `RHO`/`C`/`END_CORRECTION`) are real computed values off driver T/S and box state, not literals. `rearResonance` is correctly reused for bandpass "Frc" since a 4th/6th-order bandpass rear chamber is a sealed chamber loaded the same as a sealed box (Fc = Fs·√(1+Vas/Vb)). `frontTuning` correctly reuses the single shared vent-geometry fields (`ventD`/`ventL`) against `Vf` instead of `Vb`, matching the mock's dual-chamber box tab which likewise shows only a Volume + Tuning-freq pair for the front chamber (mock/index.html:396-402) with port geometry living on the separate Vents pane — same structure as this file.
- Other mock-fidelity note (pre-existing, not introduced by this commit — out of scope but recorded for completeness): mock/index.html:483 gives "Cross area" a `unit-cyc`/`data-ug="area"` cycling unit and shows "Vent length" as a *calculated* greyed field, whereas OriginalShell.vue:573,579 has Vent length as an *entered* NumInput and Cross area as a plain non-cycling unit. This predates e097f5e19 and was not touched by it.
- RCA_REQUIRED: no — no mid-build bug in range (no bug/regression/broke/revert/hotfix wording in the commit message; TDD red→green cycle recorded as intended, not a fix-after-defect; no new CODE_REVIEW/POST_MORTEM.md entry in this commit).

## $(date -u +"%Y-%m-%d %H:%M:%S UTC") — arch review of ad6f7b320
<!-- correction: heading above did not expand date(); actual timestamp: -->
## 2026-07-19 23:30 UTC — arch review of ad6f7b320 (Original skin: projects checkbox toggles trace visibility, not delete)
- Mechanical (engine architecture.test.ts): PASS — 3/3 tests green (`npx vitest run --project engine packages/engine/test/architecture.test.ts`).
- Scope confirmed: `git diff ad6f7b320^ ad6f7b320 -- packages/engine packages/winisd` is empty — no engine/core touched.
- [SEVERITY: low] packages/ui/src/types.ts:39-44 — additive-only change confirmed. `Design.visible?: boolean` is a new optional field; no existing field renamed/removed. No CONTRACT.md drift (this is a UI-layer type, not the engine API surface).
- [SEVERITY: low] packages/ui/src/utils/series.ts:125-128 — `buildPlotData` filter is `compare.filter(d => d.visible !== false)`, which is default-preserving: any `Design` lacking `visible` (i.e. every Modern-produced overlay, since Modern never sets it) still passes the filter and renders. Verified Modern's own compare-overlay path (`packages/ui/src/App.vue` / Modern shell, not touched by this commit) never writes `.visible`, so its rendered set is unchanged in effect. Ran the two new Playwright specs directly (`original-skin.browser.spec.ts:129,150`) — both green — confirming the Original-skin behavior works as intended without needing a full suite re-run for this narrow, additive change.
- [SEVERITY: medium] packages/ui/src/shells/original/OriginalShell.vue:816 vs mock/style.css:151-159 — the new `.project-row.trace-hidden { opacity:.45; text-decoration:line-through }` dimmed/strikethrough treatment for an unchecked trace has no counterpart in the mock. `mock/script.js:78-80` (`toggleProjectTrace` → `refreshProjectTraceVisibility`) only hides the plotted curve; the mock's `.project-row` CSS (`mock/style.css:151-159`) has no unchecked/hidden-state styling at all — an unchecked row looks structurally identical to a checked one apart from the checkbox itself.
  why: this is new visual chrome invented for Original that the mock does not have — a structural/visual divergence from the "faithful port" mandate (3a), even though it is a reasonable readability aid.
  suggested fix: either drop the dimming/strikethrough to match the mock exactly, or record it explicitly in BACKLOG.md/ARCHITECTURE.md as a deliberate Original-skin enhancement beyond the mock, so it isn't silently divergent.
- [SEVERITY: low, justified divergence — noted per instructions] packages/ui/src/shells/original/OriginalShell.vue:358,361 vs mock/index.html:113-121 — the mock's projects list has no remove control at all (its two rows are hardcoded fake data with no delete path); this commit adds a `.row-remove` (✕) button with `removeCompare(i)`. This is the sanctioned functional substitution called out in the task (the real app needs a way to remove a live overlay that the fake mock never needed) — flagged for completeness, not a defect.
- [SEVERITY: low] packages/ui/src/shells/original/OriginalShell.vue:355 vs mock/index.html:118 (`data-project="ported"`) and mock/script.js:82-84 (`selectProjectRow`) — pre-existing gap, not introduced by this commit: neither the current design row nor compare rows wire row-click → `selected` row-switching (`state.compare` rows have no `@click` for selection; only the checkbox `@change` and the ✕ `@click` were added). Out of scope for this commit (it only touched checkbox semantics) but recorded since 3a requires flagging every mock divergence encountered while reviewing this region.
- RCA_REQUIRED: no — no mid-build bug in range (commit message and diff show a straight TDD red→green feature commit; no bug/regression/broke/revert/hotfix/fixup/work-around wording in `git log --format='%s%n%b' ad6f7b320^..ad6f7b320`; no new CODE_REVIEW/POST_MORTEM.md entry in this commit, none required).

## 2026-07-20T01:53:11Z — arch review of 6bdc5862e (OgFilters) + 3a1c25fa9 (OgTune)

- Mechanical (engine architecture.test.ts): PASS — 3/3 tests green, no engine/DOM boundary violations.
- Invariant 1 (Modern unchanged): PASS — `git show --stat` for both commits touches only `packages/ui/src/shells/original/OriginalShell.vue`, `packages/ui/src/shells/original/OgFilters.vue`/`OgTune.vue`, and `packages/ui/test/original-skin.browser.spec.ts`. The shared `packages/ui/src/components/FiltersPanel.vue` and `DriverWhatIfPanel.vue` are NOT in either diff — OriginalShell.vue's only change is the import/mount swap (`FiltersPanel`→`OgFilters`, `DriverWhatIfPanel`→`OgTune`).
- Invariant 2 (Engine unchanged): PASS — no paths under `packages/engine/**` or `packages/winisd/**` in either commit.
- No AI-LOCKED file edited; no per-brand/per-device hardcoding; no CONTRACT.md-breaking API change (both consume existing store/engine exports `enterDriverField`, `setDriverFromRaw`, `ebp`, `Filter`/`FilterType`).

### 3a fidelity — OgFilters vs mock/index.html:601-614 + mock/style.css:338-368

- [SEVERITY: medium] packages/ui/src/shells/original/OgFilters.vue:57-59 vs mock/index.html:603-611 — quick-add button ORDER differs: mock is LP, HP, AP, LT, PEQ, Peak, DLP, Gain (index.html:604-611); OgFilters emits HP, LP, LT, PEQ (swaps the first two). Trivial to align even with the honest 4-type subset.
  why: gratuitous divergence from the mock's control ordering with no honesty justification (order isn't tied to engine support).
  suggested fix: reorder QUICK_ADD to LP, HP, LT, PEQ to match the mock's relative ordering of the surviving four.
- [SEVERITY: high] packages/ui/src/shells/original/OgFilters.vue:33,45,73-87 vs mock/index.html:1162-1176 + mock/script.js:337-443 — the mock's filter editing UX is a **docked, non-modal "Filter Editor" panel** (`#filter-editor`, same bottom-right docking pattern as `.tune-panel`, mutually exclusive with Tune per `openFilterEditor()` at mock/script.js:349-350), with an explicit transaction: edits apply to a snapshot, "Cancel" (`filterEditorCancel`, mock/script.js:428-441) restores the pre-edit values (or removes the row if it was a fresh Add), "Done" (`filterEditorDone`, mock/script.js:421-426) commits. OgFilters instead does **inline in-row accordion editing** (`.filter-edit-body` toggled by `toggleEdit`) with **no Cancel/Done at all** — every keystroke via `v-model.number="f.fc"` etc. writes straight to `state.P.filters` with no snapshot and no way to discard an edit once started.
  why: this is a missing region (the docked Filter Editor panel that mock/index.html:1165-1176 and mock/style.css:550-560 define) and a missing control affordance (Cancel/Done on filter edits), not just a restyle — a user can no longer back out of an in-progress filter edit.
  suggested fix: port the docked `.filter-editor` panel (or explicitly record the inline-accordion choice as an intentional, tracked simplification in BACKLOG.md — it is not currently tracked there).
- [SEVERITY: low] packages/ui/src/shells/original/OgFilters.vue (whole file) — engine-side type/subtype richness (Butterworth vs Linkwitz-Riley vs SOS subtypes, `order`, `delay`, Allpass/DLP/Gain/Peaking-2nd-HP) from mock/script.js:266-297,365-376 is honestly omitted per the file's own "Honesty note" (packages/engine/src/types.ts `FilterType` only has 4 members) — not a finding, noted for completeness per the honesty-check in step 4 of the task.
- Otherwise structural match confirmed: `.filters-quickadd`/`.filters-list`/`.filter-row-inline`/`.filter-row-head`/`.filter-type-badge`/`.filter-summary`/`.filter-edit-hint`/`.filter-del` class names, the "—" summary-prefix, hover-only edit hint, editing/disabled row states, and all scoped CSS values (OgFilters.vue:93-115) are copied verbatim from mock/style.css:338-368.

### 3a fidelity — OgTune vs mock/index.html:1111-1160 + mock/style.css:500-547

- [SEVERITY: high] packages/ui/src/shells/original/OgTune.vue (whole file) vs mock/index.html:1148-1156 — the mock's "Save to My Drivers" flow (`tune-save-row`: name input + Save/Cancel, `tuneSaveStart`/`tuneSaveConfirm`/`tuneSaveCancel`) and its `tune-btns` "Save to My Drivers" button are entirely absent from OgTune — only Reset/Cancel/Keep exist.
  why: a whole documented mock feature (persisting the what-if spec as a new library driver) is missing, not merely restyled.
  suggested fix: port the Save-to-My-Drivers row, or record it as a tracked, deferred gap in BACKLOG.md — it is not currently there.
- [SEVERITY: high] packages/ui/src/shells/original/OgTune.vue (whole file) vs mock/index.html:1117-1120 + mock/style.css:573-586 — the mock's `.parstate-legend.tune-legend` (Entered/Calculated color-swatch legend) and the field-level `.entered`/`.calculated` styling classes (mock/index.html:1123-1131, mock/style.css:309-310) that color-code which T/S fields were user-entered vs derived are completely absent from OgTune — all inputs render plain, unstyled, with no provenance indication.
  why: missing region (the legend) + missing per-field visual state that the mock treats as core to the Tune panel's purpose (showing what's entered vs calculated).
  suggested fix: wire OgTune's field rendering to the same driver-ADT provenance/`stateOf()` mechanism the shared `DriverWhatIfPanel`/`DriverPanel` presumably already use, and add the `.tune-legend` block.
- [SEVERITY: medium] packages/ui/src/shells/original/OgTune.vue:65-84 vs mock/index.html:1122-1132 — layout mechanism differs: the mock groups main T/S fields into two explicit `.tune-row` (flex) rows — {Fs,Qts,Qes,Qms} then {Vas,Sd,Re} — each row's fields sized `flex:1` across the row. OgTune instead pours all 7 MAIN fields into one `.tune-grid` (`display:grid; grid-template-columns:1fr 1fr`), giving different pairing/wrapping (Fs+Qts / Qes+Qms / Vas+Sd / Re-alone) than the mock's grouping.
  why: structural/visual divergence from mock/style.css:522-523 (`.tune-row`/`.tune-fld` flex rules) — OgTune's scoped CSS (OgTune.vue:113) invents a `.tune-grid` selector not present in mock/style.css at all.
  suggested fix: reproduce the mock's two `.tune-row` groupings instead of a uniform 2-col grid.
- [SEVERITY: medium] packages/ui/src/shells/original/OgTune.vue:88-91 vs mock/index.html:1143-1145 — derived-field units/hints dropped: mock shows Bl with unit "T·m" and EBP with the qualitative hint "→ sealed or vented" (mock/index.html:1145); OgTune's Bl/EBP spans render bare numbers with no unit/hint text.
  why: loses information the mock surfaces inline (unit correctness for Bl, and EBP's practical interpretation).
  suggested fix: append the unit spans (`T·m`, and the EBP interpretive hint) to the Derived row markup.
- [SEVERITY: medium] packages/ui/src/shells/original/OgTune.vue:69,80 vs mock/index.html:1123,1129,1130,1137 — unit-cycling omitted: mock's Fs/Vas/Sd/Xmax unit spans are `<span class="unit-cyc" data-ug="..." onclick="cycleUnit(this)">` (clickable, cycles Hz/L/cm²/mm to alternate units); OgTune renders `<span v-if="f.unit">{{ f.unit }}</span>` — a static, non-interactive label for every field, including these four.
  why: named explicitly in the fidelity-check criteria as a control class that must not be silently dropped (unit-cycling).
  suggested fix: reuse the shared unit-cycling mechanism (`cycleUnit`/the Vue equivalent already used elsewhere in OriginalShell.vue, e.g. its own `cycleUnit` function referenced at OriginalShell.vue) for the freq/volume/area/length-grouped fields.
- [SEVERITY: low] packages/ui/src/shells/original/OgTune.vue:60 vs mock/index.html:1113 — title text "Tune — What-if" vs mock's "Tune — reactive minimal"; and button label "Keep" vs mock's "Done" (mock/index.html:1158). The label change is EXPLICITLY correct per STATE_MODEL.md:50 ("The what-if dialog's accept button is labelled 'Keep'") — not a finding, the mock itself is stale here and should be updated to match STATE_MODEL.md rather than the other way round. Recorded for completeness only.
- Confirmed match: `.tune-panel` positioning/sizing/chrome (fixed bottom-right, 420px, 80vh, box-shadow, border-radius) — OgTune.vue:103-108 is byte-for-byte the same values as mock/style.css:501-516. `.tune-titlebar`/`.tune-subsect`/`.tune-btns`/button hover and `.footer-buttons-pri` styling also match mock/style.css:518-547.

### Step 4 — honesty checks

- OgFilters quick-add is honestly restricted to the 4 engine-supported `FilterType` values (packages/engine/src/types.ts) with an explicit code comment explaining the restriction — no faked/no-op controls for Allpass/DLP/Gain/Peaking-2nd-HP. Confirmed.
- OgTune Keep/Cancel/Reset semantics match STATE_MODEL.md:50-57 exactly: Keep = `state.editDriver = false` (live edits already applied via `enterDriverField`, so "apply" is a no-op close — consistent with what-if previewing live); Cancel = `setDriverFromRaw(snapshot)` then close, reverting to the pre-open snapshot taken in `onMounted` (OgTune.vue:48-50); Reset = `setDriverFromRaw(state.driverSource)`, back to the library driver. No forked physics — all three route through the shared `enterDriverField`/`setDriverFromRaw` in store.ts and `ebp()` from `@openisd/engine`. Confirmed no faked values.
- Caveat: STATE_MODEL.md:7 records the full ground/modified/what-if/edit layering as "target design, not yet implemented" — OgTune's single pre-open `snapshot` is a reduced (single-level) approximation of the what-if layer, adequate for today's flat store, not a full implementation of the target model. Not a finding against this range (matches the store's current capability), but the gap is pre-existing and not introduced here.

- RCA_REQUIRED: no — no mid-build bug in range. `git log --format='%s%n%b' 6bdc5862e^..3a1c25fa9` shows no bug/regression/broke/revert/hotfix/fixup/work-around/corruption language for these two commits (unrelated grep hits were from the OgTune commit body's own prose "revert to the... snapshot", not a bug report). `CODE_REVIEW/POST_MORTEM.md`'s one entry (2026-07-19, commit 8a06b5e0f) predates this range and concerns a different port agent's out-of-scope edits — not applicable here.

## 2026-07-20 03:04:54 UTC — arch review of eb674d34b..b105308a6 (Original-skin palette fix + OgNewProject wizard)

- Mechanical (engine architecture.test.ts): PASS — 3/3 tests green, `npx vitest run --project engine packages/engine/test/architecture.test.ts`.

### Invariant 1 — Modern unchanged in effect
- `git show --stat eb674d34b`: touches only `BACKLOG.md`, `packages/ui/src/shells/original/OriginalShell.vue`, `packages/ui/test/original-skin.browser.spec.ts`. Confirmed.
- `git show --stat b105308a6`: touches only `packages/ui/src/shells/original/OgNewProject.vue` (new), `packages/ui/src/shells/original/OriginalShell.vue`, `packages/ui/test/original-skin.browser.spec.ts`. Confirmed.
- The palette-var fix adds `--bg/--panel/--panel2/--line/--fg/--mut/--acc/--acc2/--good/--bad` inside the selector `.original-root { … }` in `OriginalShell.vue`'s `<style scoped>` block (`packages/ui/src/shells/original/OriginalShell.vue:757-761`). Scoped-CSS custom-property leakage risk checked: the declaration block is keyed off the `.original-root` class selector, which only the Original shell's own root element carries (`grep` for `.original-root` outside `OriginalShell.vue` returns nothing) — Modern/Classic roots don't match the selector so the vars cannot apply to them even though custom properties normally inherit through the DOM. No leak. Same pattern as the pre-existing `.classic-root` override, confirmed as precedent by the commit message.
- Modern's own browser/visual suites are not in either diff and are asserted green by the referenced full `health-check.sh` run (not independently re-run by this reviewer beyond the mechanical guard, which is engine-only by design).

### Invariant 2 — Engine unchanged
- Neither commit touches `packages/engine/**` or `packages/winisd/**` (confirmed by both `--stat` outputs above).

### 3a — Original-skin/mock fidelity: OgNewProject.vue vs mock/index.html:889-938, mock/script.js:743-837

- [SEVERITY: low] `OgNewProject.vue` (whole file) vs `mock/index.html:889-938` — box-type `<select>` omits `bp6` (6th Order Bandpass) and `abc` (ABC) options present in the mock (`mock/index.html:907-908`).
  why: divergence from the mock, but justified — `BACKLOG.md` already carries open items "Engine: 6th-order bandpass model" and "Engine: ABC — needs a reference model first" gating these two box types everywhere in the skin (consistent with the already-accepted `SUPPORTED_BOX` pending-state pattern), and the commit message states the same honesty rationale used elsewhere (omitted filter buttons). Recording per 3a mandate that all divergences must be logged even when justified.
  suggested fix: none required now; close automatically when the two BACKLOG engine items land.

- [SEVERITY: medium] `OgNewProject.vue:33-39` (`create()`) vs `mock/script.js:758-759` (`startNewProjectWizard`) — the mock guards entry to the wizard with `if (projectModified && !window.confirm('Discard unsaved changes and start a new project?')) return;` before wiping the enclosure state; `OgNewProject`/`OriginalShell.vue:295` (`@click="newProjectOpen = true"`) has no such guard — clicking the toolbar "New project" button always opens the wizard, and `create()` always overwrites `state.box`/`state.P.Vb` with no discard confirmation.
  why: silent, unconfirmed loss of an in-progress design departs from the mock's explicit safeguard; this is a functional (not merely cosmetic) divergence.
  suggested fix: note — the store currently has no dirty-tracking concept (`grep` for `projectModified`/`isDirty` in `store.ts` finds none), so this is dependent on the open BACKLOG item "Implement the layered project state model (STATE_MODEL.md)"; until then, at minimum surface the gap in `BACKLOG.md` rather than silently diverging.

- [SEVERITY: medium] `OgNewProject.vue:26-27,66-71` vs `mock/script.js:778-788` (`npwResetVolumeDefaultsForType`) — the mock resets `npw-volume`/`npw-rear-volume`/`npw-front-volume` to **per-box-type** defaults (`ENCLOSURE_FIELD_DEFAULTS[type]`, e.g. rear default 8.00 L, front default 10.00 L per `mock/index.html:921,924`) each time the box type changes and Next is pressed; `OgNewProject` hardcodes a single `vol = ref(6)` reused for BOTH the single-chamber volume AND the dual rear-chamber volume regardless of box type, and `frontVol = ref(10)` never changes.
  why: the dual-chamber rear default is silently wrong for a user going Closed→Next→Back→Bandpass (mock would show 8.00 L rear, this component shows whatever `vol` was left at, e.g. 6); no per-type default table exists in the ported component.
  suggested fix: port `ENCLOSURE_FIELD_DEFAULTS`-equivalent per-box-type defaults, or at minimum separate the rear-chamber ref from the single-chamber ref so the two volumes don't alias.

- [SEVERITY: medium] `OgNewProject.vue:79-80` vs `mock/script.js:797` (`showNewProjectWizardStep`) — the mock's step-2 button keeps the id `npw-btn-next` and its label becomes **"Next: Pick Driver >"**; `OgNewProject` swaps in a differently-labelled `ok-btn` reading **"Create"**.
  why: copy divergence from the mock (3a: "different… labels… or copy").
  suggested fix: match the mock's exact step-2 label "Next: Pick Driver >" (or record the rename as an intentional wording improvement in `BACKLOG.md`/`brain/bring_mock_live.md` if kept).

- [SEVERITY: low] `OgNewProject.vue:61,72` vs `mock/index.html:912,927` — hint copy drops the mock's leading "Optional — " qualifier ("Optional — starts at a sensible default (Closed). Change box type any time…" / "Optional — starting volume, refine later…") in favour of shorter rewordings.
  why: copy divergence (3a).
  suggested fix: match verbatim, or record as an intentional simplification.

- [SEVERITY: low] `OgNewProject.vue:66,69,70` vs `mock/index.html:917,921,924` — the mock's volume fields are `<input type="text" value="6.00">` (2 dp formatted, matching the app-wide `.field input` styling and the "match decimal places to WinISD" convention); `OgNewProject` uses native `<input type="number" step="0.1">` bound raw to an unformatted numeric ref (no forced 2 dp).
  why: structural/input-type divergence; also sidesteps the open BACKLOG item "Match each field's decimal places to the WinISD screenshots" rather than following its stated convention (volumes 2 dp, `6.00 l`).
  suggested fix: use the shared `NumInput` (already imported by `OriginalShell.vue`) or a formatted text input at 2 dp, consistent with the rest of the skin.

- [SEVERITY: low] `OgNewProject.vue:47` vs `mock/index.html:894` — modal titlebar `win-controls` renders only the close (✕) glyph; the mock renders minimize (–) + maximize (□) + close. Note: this omission is **pre-existing** in the skin (the Box-Losses modal at `OriginalShell.vue:728` already does the same close-only `win-controls`), so it is not a regression introduced by this diff, but it is still an uncorrected divergence from the mock and should be tracked once, not re-litigated per new modal.
  why: structural chrome divergence (3a), consistently repeated rather than newly introduced.
  suggested fix: track as one BACKLOG item covering all Original-skin modals' `win-controls`, rather than fixing ad hoc per modal.

- [SEVERITY: low] `BACKLOG.md:49` ("New Project wizard — the 2-step box-type/volume flow … is missing; the New button opens the driver browser") is now stale — `b105308a6` implemented the wizard, and the companion commit `da5b672a4` updated `brain/bring_mock_live.md` to mark it done but did not update this `BACKLOG.md` bullet.
  why: doc drift — a closed gap still listed as open in the tracked fidelity-gap list.
  suggested fix: remove/update the "New Project wizard" sub-bullet in `BACKLOG.md:49`.

- Palette fix (`eb674d34b`) is a bug fix, not a mock divergence — confirmed no separate 3a finding needed for it; `.original-root`'s light-fill buttons rendering dark text now matches the mock's own `button { color: var(--fg) }`-independent styling intent.

- RCA_REQUIRED: no — no mid-build bug/regression language in `git log --format='%s%n%b' eb674d34b^..b105308a6` (both commit bodies describe a pre-logged BACKLOG bug fixed via TDD and a clean feature port; no revert/hotfix/corruption markers), and no new dated `CODE_REVIEW/POST_MORTEM.md` entry in this range (the existing 2026-07-19 entry predates and is unrelated to this range).

## 2026-07-20T04:31:22Z — arch review of commit ebbe62f13 (dev) — "STATE_MODEL Increment 1 — ground↔modified layer + truthful Save/Reset bar"
- Mechanical (engine architecture.test.ts): PASS — 3/3 tests green, no engine boundary breaks.
- Engine/winisd unchanged: confirmed — diff touches only `STATE_MODEL.md`, `brain/bring_mock_live.md`, `packages/ui/src/App.vue`, `packages/ui/src/shells/original/OriginalShell.vue`, `packages/ui/src/store.ts`, `packages/ui/test/original-skin.browser.spec.ts`. Nothing under `packages/engine/**` or `packages/winisd/**`.
- store.ts additivity (invariant 1): CONFIRMED. `packages/ui/src/store.ts:177-198` adds `projectFingerprint()`, `_ground`, `isModified`, `markProjectSaved()`, `resetProjectToGround()` as pure new exports; no existing export's signature or body changed. `grep` for consumers of the four new exports shows only `packages/ui/src/App.vue:53` (`markProjectSaved()` call in `onMounted`) and `packages/ui/src/shells/original/OriginalShell.vue:22` (import) — Modern/Classic shells import neither. `isModified` is a Vue `computed`, lazily evaluated only when a template/watcher reads it; since no Modern/Classic component reads it, it never runs for those skins, so it cannot alter their rendered output or timing. `markProjectSaved()` in `App.vue:53` runs once after `applyState`/`loadLocal` at mount and only writes `_ground.value` (a `ref` no other skin reads) — it does not touch `state.*`, so it cannot alter Modern/Classic's rendered DOM. Verdict: invariant holds, no risk found.
- [SEVERITY: low] `packages/ui/src/store.ts:184` — `projectFingerprint()` — minor: relies on `JSON.stringify` key-insertion-order stability of `state.P` (reactive proxy) and `Driver#inputs`/`driverJSON.value` for `isModified`/reset round-trip correctness (see next item). Not a defect as shipped (verified below), but it is an implicit contract worth a code comment: any future field added to `UiParams` or `Driver#inputs` via a path other than plain assignment/`enter()` (e.g. `Object.defineProperty`, non-enumerable props) would silently break fingerprint equality.
  why: undocumented invariant a future edit could break silently (isModified permanently true or falsely false).
  suggested fix: add a one-line comment on `projectFingerprint()` noting it depends on stable JSON key order from `state.P`/`Driver#toJSON()`.
- Correctness of `resetProjectToGround()` (verified by reading `packages/winisd/src/driver.ts:155-177`): round-trip is lossless and order-deterministic. `Driver.toJSON()` spreads `#inputs` in insertion order (`packages/winisd/src/driver.ts:156`); `Driver.fromJSON()` re-inserts via `Object.entries(j.inputs)` in the same (parse-preserved) order (`driver.ts:167-168`), so `toJSON→fromJSON→toJSON` reproduces an identical string, and `carry` presence/absence round-trips symmetrically. `Object.assign(state.P, g.P)` (`store.ts:195`) only ever writes the fixed key set defined by `P_DEFAULTS` (`store.ts:12-20`), so no stray keys are left over. `state.box = g.box` (`store.ts:194`) is a plain string assignment. No spurious post-reset `isModified` found; confirmed further by the new Playwright test (`packages/ui/test/original-skin.browser.spec.ts` — "Reset state" test) which exercises exactly this path end-to-end and is green per health-check.
- [SEVERITY: high] `packages/ui/src/shells/original/OriginalShell.vue:87-89,222-223,420` vs `mock/index.html:240-243,523-529` — the Original skin now HIDES the "Passive Radiator"/enclosure nav tab entirely for a Closed (sealed) box (`showEnclosureTab` computed, `v-if="showEnclosureTab"` on the `<li>`). The mock never hides this nav item: `mock/index.html:243` (`<li data-tab="enclosure">`) is unconditional, and the mock has a dedicated `#enclosure-sealed` sub-panel (`mock/index.html:523-529`) with its own Volume field, an Fh readout, and the hint text "Closed enclosure — no vents or passive radiator configured." — i.e. the mock's sanctioned design for a Closed box is to KEEP the tab and show that sub-panel, not remove the tab. The commit message additionally claims this "matches the Classic skin's sealed-box behaviour", but `packages/ui/src/shells/classic/ClassicShell.vue:293-295` shows Classic also keeps the "Passive Radiator" rail tab for a sealed box (it renders a `cl-todo` placeholder — "Nothing extra for a Sealed box — Box volume and losses are on the Box tab" — it does not remove the tab). So Original's new behaviour matches neither the mock nor Classic; it introduces a third, novel behaviour, and a Playwright test now locks it in (`packages/ui/test/original-skin.browser.spec.ts` — "the Closed (sealed) box hides the dynamic enclosure tab").
  why: 3a hard mandate — Original must be structurally identical to the mock except for the sanctioned store/physics substitution; removing a whole nav region + its sub-panel (including the Fh readout, which is NOT purely duplicate of the Box tab) is a missing-region divergence, not a store swap.
  suggested fix: revert to always showing the enclosure/"Passive Radiator" nav tab; for `state.box === 'sealed'` render the mock's `#enclosure-sealed` sub-panel content (Volume + Fh + hint) inside it, matching `mock/index.html:523-529`, instead of hiding the tab. Update/replace the new "hides the dynamic enclosure tab" spec accordingly.
- [SEVERITY: medium] `packages/ui/src/shells/original/OriginalShell.vue:422-424` vs `mock/index.html:258-259` — Save Changes / Reset state buttons now carry `:disabled="!isModified"`. The mock never disables these buttons (`mock/script.js:626-670` — `saveProjectChangesLocal`/`revertProjectChanges` are always wired and clickable; only `.dirty` class + the `#unsaved-label` visibility toggle with `projectModified`, per the explicit design-intent comment at `mock/style.css:588-592`: "always visible in the legend bar... Only their styling (yellow) and the 'Unsaved changes' label toggle with projectModified"). Disabling is new interactive behaviour not present in the mock and not called for by `STATE_MODEL.md` (`STATE_MODEL.md:78-95`, which specifies label/tooltip only, not enablement).
  why: 3a — structural/behavioural divergence from the mock's chrome for a region this commit directly touches.
  suggested fix: drop the `:disabled` binding (or confirm intentionally and record it in `BACKLOG.md`/`STATE_MODEL.md` as a deliberate divergence with rationale).
- [SEVERITY: low] `packages/ui/src/shells/original/OriginalShell.vue:422` — button label "Reset state" vs mock's "Revert" (`mock/index.html:259`, `id="btn-revert"`). This is a documented, deliberate rename per `STATE_MODEL.md:91,95` (the project's own evolving spec chose "Reset state" over the mock's "Revert"), not an oversight — recording as a finding per the 3a "intentionally-deferred items are still divergences" rule, no action requested beyond noting it in `BACKLOG.md` alongside the existing `BACKLOG.md:51` Save-bar entry (which is now stale — the "Export .wdr in their place" description no longer reflects current state and should be refreshed or closed).
- Fidelity scope note: this review's 3a pass was limited to the region this commit actually touches (the `.parstate-legend`/Save-bar row and the enclosure nav tab). A full seven-tab/six-box-type/modal-by-modal sweep of `OriginalShell.vue` against `mock/` was NOT re-run here (out of the diff's footprint); any prior open findings from earlier reviews remain outstanding independent of this commit.
- RCA_REQUIRED: no — no mid-build bug in range. Commit message describes standard TDD (red→green tests written before the fix, `packages/ui/test/original-skin.browser.spec.ts`), not a defect surfaced/worked around during the build; `git log -1 --format='%s%n%b' ebbe62f13` contains no bug/regression/broke/revert/hotfix/fixup/corruption language. `CODE_REVIEW/POST_MORTEM.md`'s only entry (2026-07-19, delegated port agent regressing Modern skin) is unrelated to this commit.

## 2026-07-20 21:22:50 UTC — arch review of 9966de8e2^..HEAD
- Mechanical (engine architecture.test.ts): PASS — `npx vitest run --project engine packages/engine/test/architecture.test.ts` → 3/3 tests green, no DOM/Vue import found in `packages/engine/src/`.
- Invariant 2 (formulas.ts additive): CONFIRMED. `packages/engine/src/formulas.ts` (new file, commit 9966de8e2) adds `prVas`/`prFs`/`prFsWithMass`/`prQms`/`driveVoltage`/`soundVelocity` as pure functions with byte-for-byte identical bodies to the inline computeds they replaced in `PRPanel.vue`, `PREditModal.vue`, `SignalPanel.vue`, `ClassicShell.vue`, `OriginalShell.vue` (diffed each call site — same arithmetic, same 0-guards). `index.ts` gains exactly one new export line (`export * from './formulas.js'`); no existing engine module (`circuit.ts`, `sweep.ts`, `alignments.ts`, `filters.ts`, `constants.ts`) was touched. New unit tests (`packages/engine/test/formulas.test.ts`, 9 tests) pass. No AD-3 violation, no engine/logic fork.
- Invariant 1 (Modern unchanged bar the intentional dp corrections): CONFIRMED for the formula-extraction commit (9966de8e2) — pure refactor, same values. For the registry/wiring commits (6b834d835, 728e0cf4d): dp changes landing in shared components (`BoxPanel.vue` ventD 1→2dp; `DriverEditorModal.vue` Vas 3→2dp, Sd 4→1dp, Xmax 3→1dp; `PREditModal.vue` prNum 2→0dp, prSd 4→1dp, prXmax 3→1dp, prFs 4→2dp, prQms 3→3dp(unchanged), prVas 3→2dp; `OgTune.vue` Qms 2→3dp, Re 2→3dp, Pe 0→1dp) are all display-only precision changes routed through `precision(id)`/`NumInput :precision` — no calculation path or engine call changed. Confirmed no other Modern behaviour changed: `git diff` shows no logic edits to `BoxPanel.vue`/`PRPanel.vue`/`DriverEditorModal.vue`/`PREditModal.vue`/`PRWhatIfPanel.vue` beyond the literal→`fieldDp(id)` substitution. `NumInput.vue`'s dp-is-display-only fix (d7bd0f147) is itself a correctness fix (spinner/blur paths were leaking dp-truncated values into `state.P`/the model) — this is a real behavioural change but is the *documented, intended* fix, not an unnoticed regression; it is covered by a red→green unit test (6.123456 into a 2dp field asserts model stays 0.006123456).
- [SEVERITY: low] CONTRACT.md — no line — CONTRACT/documentation completeness
  why: `packages/engine/src/index.ts` gained a new re-export (`formulas.js` — `prVas`, `prFs`, `prFsWithMass`, `prQms`, `driveVoltage`, `soundVelocity`), all reachable via the stable entry point `import {...} from './packages/engine/src/index.ts'` that CONTRACT.md says it documents, but CONTRACT.md was not updated to list them. Not a breaking change (additive, so no drift/violation), but CONTRACT.md is no longer a complete inventory of the stable surface it claims to define.
  suggested fix: add a short "Formula helpers" section to CONTRACT.md listing the 6 new functions (signatures + units), or explicitly scope CONTRACT.md to `deriveDriver`/`sweep`/`maxCurves`/alignments only and note formulas.ts is UI-convenience, not contract-bound.
- [SEVERITY: low] `docs/winisd/INPUT_PARITY.md` — dp evidence table (lines 163-170) — documentation completeness
  why: `fieldRegistry.ts` now cites WinISD dp evidence inline in `description` for fields not present in INPUT_PARITY.md's "Field decimal places" table (e.g. ventD 10.20cm — actually present in `docs/winisd/info/view_3_ported.md:16`, confirmed correct; but advHumidity/advPressure/prVas/prFs/prQms dp claims rely only on `docs/winisd/info/view_6_advanced.md` / inference, not the INPUT_PARITY.md table itself). All spot-checked values I could verify against primary screenshots/`.md` transcripts (ventD 2dp, advHumidity WinISD 4dp→OpenISD 1dp divergence, advPressure WinISD 1dp Pa→OpenISD 2dp kPa divergence) were consistent with `docs/winisd/info/view_6_advanced.md` and `view_3_ported.md`. No inconsistency found, but INPUT_PARITY.md's own table (line 163-170) was not extended to include the newly-added/newly-corrected fields, so the "evidence log" is now less complete than the registry it's meant to back.
  suggested fix: append the new dp evidence rows (ventD, advHumidity, advPressure, prVas/prFs/prQms, driver-editor Vas/Sd/Xmax) to the INPUT_PARITY.md table so the registry's citations trace back to a table row, not just prose.
- [SEVERITY: none] driver_type wire-contract — not touched in this range; `packages/ui/src/driverType.ts` was not edited.
- [SEVERITY: none] AI-LOCKED files — `CLAUDE.md` was edited in commit 3e203679f (table/list reformatting + a new "release build purges build/" note), but CLAUDE.md carries no "AI LOCKED — DO NOT EDIT" header itself (it only *describes* the AI-locked-file rule at line 97) — not a violation.
- [SEVERITY: none] drivers/<collection> subdirectory naming — not touched in this range.
- 3a (Original-skin ↔ mock fidelity): out of scope for this range's substantive review — the touched `OriginalShell.vue`/`OgTune.vue` hunks are precision-only (`:precision="2"` → `:precision="fieldDp('id')"`, `fmt(x, 2)` → `fmt(x, fieldDp('id'))`), no markup/structure/class/layout changed, so no new mock-divergence was introduced by this range.
- RCA_REQUIRED: yes — mid-build bug fixed in-range with no matching POST_MORTEM.md entry. Commit `9de9f006d257daa900f7387114b027b8e72588c9` ("feat(build): guard bundle-drivers against wiping a non-empty bundle to empty") states verbatim: "Writing that silently wiped the committed bundle (dropping all 57 PRs), broke the app and drivers-bundle.test.ts, and was easy to commit by accident." This is committed evidence of a defect surfacing during the build (an incomplete/failed driver-source walk silently overwrote the production bundle to empty, breaking the app and a test). `CODE_REVIEW/POST_MORTEM.md` has no 2026-07-20 entry (only `2026-07-19 — Delegated port agent...`) covering this class of fault (guard-less overwrite of committed generated artefacts). No RCA on record for it — orchestrator should convene one with the impl agent and code-reviewer to establish whether the prevention (refuse-to-empty guard) is sufficient or whether the class of fault (silent artefact-wipe on upstream-source failure) needs a broader gate.

## 2026-07-21 04:09:37 UTC — arch review of d21bfc77e^..HEAD (d21bfc77e, 53240d419, c95d8bc33[, bca68769a])
- Mechanical (engine architecture.test.ts): PASS — `npx vitest run --project engine packages/engine/test/architecture.test.ts` → 3/3 tests green, no DOM/Vue reach-in from `packages/engine/src/`.
- Golden regression: PASS — `npx vitest run --project engine packages/engine/test/golden.test.ts` → 6/6 green; `git diff --stat` shows **zero changes** to `packages/engine/test/fixtures/golden/**`, confirming the no-op property (`driverAddedMass=0`/`vcTempRise=0`/`alfaVC` at ΔT=0) holds byte-for-byte as claimed in the commit messages, not just asserted by new unit tests.
- New unit tests: PASS — `added-mass.test.ts` (4/4) and `power-compression.test.ts` (2/2) both assert the no-op case explicitly (`assert.deepEqual(zero.zmag, base.zmag, ...)`) in addition to the physics-shape assertions (Fs↓, Qts↑ for mass; impedance floor↑/SPL↓ for hot Re).
- Layering: sound. `packages/engine/src/driver.ts` imports only `constants.js`/`types.js` (no import of `circuit.js`/`sweep.js`); `circuit.ts` imports `hotRe` from `driver.js` and `sweep.ts` imports `withAddedMass` from `driver.js` — dependencies point strictly downward (circuit/sweep → driver), no cycle. `sweep()`'s own `Sdt`/`s = solve(f, d, box, P)` correctly use the mass-adjusted `d`, and `maxCurves()` correctly keeps reading `Pe`/`Re`/`Xmax` off the original `drv` since `withAddedMass` never touches those fields (verified: `withAddedMass` only sets `Mms, Fs, Qms, Qes, Qts`) — no discrepancy there.
- [SEVERITY: medium] CONTRACT.md (whole file, e.g. `CONTRACT.md:82-100`, `CONTRACT.md:183-201`) — new stable engine exports `withAddedMass(drv, MaddKg) → Driver` and `hotRe(Re, alfaVC, dT) → number` (both exported publicly via `export * from './driver.js'` in `packages/engine/src/index.ts:4`) and three new `SweepParams` fields (`driverAddedMass`, `vcTempRise`, `alfaVC` — `packages/engine/src/types.ts:147-151`) are not documented anywhere in `CONTRACT.md`. §2's "Common parameters" table (`CONTRACT.md:84-100`) lists every other `SweepParams` field but omits these three; §5 "Alignment helpers" (`CONTRACT.md:183-194`) is the closest analogous table for driver.ts-adjacent helper functions and does not list `withAddedMass`/`hotRe`.
  why: CONTRACT.md is declared "the stable engine API surface" and these are additive (non-breaking) but real, tested, publicly-exported additions to that surface — per this review's own remit ("CONTRACT.md drift … without the contract doc updated in the same change") and ARCHITECTURE.md's AD-4/self-documentation intent, the contract doc should track the surface it claims to describe.
  suggested fix: add a row for `driverAddedMass`/`vcTempRise`/`alfaVC` to the §2 Common-parameters table, and a row for `withAddedMass`/`hotRe` to §5 (or a new §5b "Thermal/mass helpers"), mirroring the style already used for `ebp`/`sealedFromQtc`.
- No AD-3 boundary violations, no per-device/per-brand hardcoding, no `driver_type` enum edits (`packages/ui/src/driverType.ts` untouched in this range — confirmed via `git diff --name-only`), no AI-LOCKED file edited, no new `drivers/<collection>/` subdir added.
- fieldRegistry.ts / UI wiring (`packages/ui/src/fields/fieldRegistry.ts:335-364`, `packages/ui/src/shells/original/OriginalShell.vue:591-600`, `packages/ui/src/store.ts:20`, `packages/ui/src/types.ts:138-142`): sound — `modeled:false→true` flips match the engine now actually consuming these fields; unit-scale conversions (`AlfaVC` ×1000 display, added-mass kg↔g via `:scale="1000"`) mirror the existing `Vb`/`Vf` NumInput pattern (`OriginalShell.vue:472`); `P_DEFAULTS` sets `alfaVC: 0.0039` (copper) but `vcTempRise: 0`, so `hotRe(Re, 0.0039, 0) === Re` — the nonzero default alfaVC is still a genuine no-op by construction (ΔT gates it), consistent with the design intent stated in the commit message.
- Original-skin↔mock fidelity: N/A for this severity check — this range's `OriginalShell.vue` edit is confined to the pre-existing "Advanced options" driver-pane row (mock has no equivalent live region to diverge from; the mock's static placeholder fields are what's being replaced by the modeled inputs), not a new region/tab/modal, so §3a's full region-by-region audit was not re-run for this narrow diff.
- RCA_REQUIRED: no — no mid-build bug in range. `git log --format='%s%n%b' d21bfc77e^..HEAD` contains no bug/regression/broke/revert/hotfix/fixup/"work around" language; all three commit messages describe a clean red→green TDD sequence (unit test written and shown failing, then the closed-form/no-op fix, then golden suite re-verified green) with no evidence of a defect surfacing mid-build.
