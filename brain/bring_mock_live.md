# Bring the mock live — Original skin ↔ `mock/` parity

**Aim:** get an OpenISD skin that is visually and structurally **identical** to the
static prototype `mock/index.html`, wired to the real shared engine/store instead of
the mock's fake state. The vehicle already exists — the **`original` skin**
(`packages/ui/src/shells/original/OriginalShell.vue`), registered in `skins.ts` as
`Original (WinISD)`. This is a _close-the-gaps_ job, not a new skin.

## Source of truth

- Target: `mock/index.html` (~1190 lines), `mock/script.js` (~1263), `mock/style.css` (~644).
- Design intent: `mock/MOCK_DESIGN.md`, `mock/MOCK_PROMPTS.md`.
- Port under audit: `packages/ui/src/shells/original/OriginalShell.vue`.
- Audit mandate: `.claude/agents/arch-reviewer.md` **step 3a** (Original ↔ mock fidelity).
- Fine-grained divergences (with mock line numbers): `CODE_REVIEW/ARCH_REVIEW_LOG.md` §3a.

## INVARIANTS — hard, non-negotiable

1. **Modern must not change in EFFECT.** Modern's function and appearance must stay
   identical — proven by its browser tests (`app.browser.spec.ts`, `visual.browser.spec.ts`
   snapshots, `chart-zoom`, etc.) staying green and its rendered output unchanged. This is
   about the OUTCOME, not the file: you **may** edit a shared component that Modern renders
   (`BoxPanel.vue`, `DriverPanel.vue`, `PRPanel.vue`, …) **when the change is additive and
   default-preserving** — a new optional skin/`variant` prop, or a `switchable` CSS branch —
   so that Modern's existing render path is byte-for-byte unaffected. That is genuine reuse
   and is encouraged. What is **forbidden** is any change that alters what Modern draws or
   does (like the restructure that removed Modern's PR-edit affordance and broke its tests —
   `CODE_REVIEW/POST_MORTEM.md`). Rule of thumb: **additive + default unchanged = OK;
   restructuring shared behaviour = NOT OK.** The precedent already in the tree:
   `BoxPanel.vue`'s `variant` prop — Classic passes it, Modern omits it and renders exactly
   as before.
2. **The calculations engine must NOT be changed.** No edits under `packages/engine/**`
   (nor `packages/winisd/**` ADT math). The Original port consumes the engine/ADT exactly
   as-is. (6th-order-bandpass / ABC engine models are a SEPARATE, later task — NOT part of
   this port; until they land, those box types stay in the pending state.)

**Proof obligation for any shared-component edit:** Modern's + Classic's browser/visual
tests stay green, AND the edit is visibly additive (default path untouched). If you can't
show Modern is unchanged, the edit fails Invariant 1.

## The one hard rule (why past attempts regressed)

Port the **mock's own markup + `mock/style.css` wholesale**: `onclick`→`@click`,
`value`→`v-model` bound to the shared store/ADT. The **only** sanctioned divergence from
the mock is fake-state → shared-engine. Prefer authoring the port's own markup inside
`packages/ui/src/shells/original/` and wiring it to the shared `store.ts` / composables /
ADT / engine APIs. When you DO reuse or extend a shared component, it must satisfy
Invariant 1 (additive + Modern unchanged) — the failure mode to avoid is _restructuring_ a
shared component's default behaviour to suit Original, which regressed Modern once
(`CODE_REVIEW/POST_MORTEM.md`).

### Decision rule — share only when clean, otherwise fork a NEW component

For each panel/modal, choose:

- **Reuse / additively extend the shared component** — only when the extension is small,
  additive, and leaves Modern's default render byte-identical (e.g. a `variant` prop, a
  guarded CSS branch). Clean fit → reuse.
- **Create a NEW Original-owned component** (under `packages/ui/src/shells/original/`) —
  **whenever sharing would compromise either side**: the mock markup fights Modern's layout,
  the two need divergent behaviour, or the shared file would fill with `if skin === …`
  conditionals. A clean new component wired to the same shared `store.ts`/composables/ADT/
  engine is STRONGLY PREFERRED over a contorted shared one. Duplicated _markup_ is fine;
  never duplicate _logic_ — both components call the same shared store/engine APIs.

In short: **do not force Original and Modern to share a component if it makes either worse.
When in doubt, make a new Original component.** Logic stays single-sourced (the store/engine);
only presentation is per-skin.

> NOTE: the parallel session is actively expanding `OriginalShell.vue` (it has grown
> well past the 404-line state the arch-review was written against). **Re-audit the
> current `OriginalShell.vue` against `mock/index.html` before starting each item** —
> some below may already be closed.

## Remaining gaps (from BACKLOG.md "Original skin — close remaining mock-fidelity gaps")

### Modals — port the mock's markup, don't reuse shared components

- [x] **Filters tab** → ported as `shells/original/OgFilters.vue` (mock `.filters-quickadd` +
      `.filters-list`, wired to `state.P.filters`, 4 engine types only). **Follow-up:** port the
      mock's docked, transactional Filter Editor (`.filter-editor`, Cancel/Done + snapshot revert)
      instead of the current inline in-row editing.
- [x] **Tune panel** → ported as `shells/original/OgTune.vue` (mock docked `.tune-panel`,
      live what-if via `enterDriverField`, Keep/Cancel/Reset per `STATE_MODEL.md`). **Follow-ups:**
      add the "Save to My Drivers" flow; the Entered/Calculated provenance legend + per-field
      colour coding (from the ADT's provenance); unit-cycling on Fs/Vas/Sd/Xmax; derived-field
      units/hints (Bl "T·m", EBP "→ sealed/vented").
- [~] **Driver Editor** → **accepted reuse of shared `DriverEditorModal.vue`** (its multi-tab
  edit logic is substantial and trapped in the shared component). Per the Decision rule,
  re-skinning to the mock's 4-tab `.param-grid` would either duplicate that logic (forbidden)
  or need a large extraction of a Modern-rendered component (Invariant 1 risk). Traded off:
  functional parity via reuse now; mock-visual re-skin only if the edit logic is first
  extracted to a composable. Not a blocking gap.
- [~] **Select Driver modal** → **accepted reuse of shared `DriverBrowser.vue`** (a complete
  working picker; its ~250-line catalog-build + WDR-parse logic is trapped in the shared
  component). Same trade-off as Driver Editor — reuse now, re-skin only after a logic
  extraction. Not a blocking gap.
- [x] **New Project wizard** → ported as `shells/original/OgNewProject.vue` (2-step box-type /
      volume, applies to the store, hands off to the driver picker; 4 engine-modelled box types).
- [ ] **Options modal** → intentionally NOT ported — the mock's Options is entirely inert
      (dead OK/Cancel, no real settings backing). Porting it would ship fake controls (no-fake-data
      rule). Revisit only when a real preferences store exists.

### Top-bar / chrome

- [x] **Save bar** → done (STATE_MODEL Increment 1): Unsaved-changes indicator + **Save Changes**
      (adopt as ground) + **Reset state** (revert to ground), wired to the store's real
      `isModified`/`markProjectSaved`/`resetProjectToGround`. Export .wdr kept alongside.
- [ ] **Color button** → wire the mock's `cycleColor` click (`mock/index.html:249`); currently static.
- [ ] Confirm toolbar = 8 icons + chart dropdown + live cursor Hz/dB readout (arch-review §3a flagged the toolbar as a rewrite; re-check current state).

### Projects list

- [ ] **Checkbox** should toggle trace visibility (`toggleProjectTrace`), not delete the compare row. Keep the mock's separate row-highlight (`selectProjectRow`) vs visibility-checkbox distinction (`mock/index.html:113-121`).

### Tabs — field content (re-verify against current OriginalShell)

- [ ] **Vented pane** — add the "End Correction" select; rename the readout to "1st port resonance" to match the mock.
- [ ] **Signal Generator** — the mock's Generate checkbox + tone-frequency input (`value="13.20"` Hz), not just a heading (`mock/index.html:125-131`).
- [ ] **Driver tab** — mock has Brand/Model + Placement + Advanced content and an options column (`mock/index.html:269-315`), beyond Brand/Model + "Choose".
- [ ] **Signal tab** — add the "Listening place" column (Distance, Angle — `mock/index.html:618-627`); port dropped it.
- [ ] **Box single-chamber** — restore the "Advanced->" link that opens the Box-losses modal (Ql/Qa/Qp, `mock/index.html:1088-1106`).
- [ ] **Box dual-chamber (bandpass4)** — restore the calculated rear "Frc" and front "Tuning freq" greyed readouts (`mock/index.html:392,401`).

## Verification

- Run the arch-reviewer (`.claude/agents/arch-reviewer.md`, step 3a) on the branch after each chunk — it fails on any mock divergence beyond the fake-state swap.
- `packages/ui/test/original-skin.browser.spec.ts` — extend as fields land.
- Side-by-side: `mock/index.html` (open the static file) vs the running `original` skin at each box type / tab / modal.
- `npm run typecheck` + the browser suite (pre-push hook) stay green.

## Related backlog (do AFTER parity)

- Retire the **Classic** skin once Original reaches mock parity (BACKLOG "Retire the Classic skin…").
- Extract duplicated PR / drive-voltage / sound-velocity formulas into `packages/engine/` (they're copy-pasted across OriginalShell/ClassicShell/PRPanel/PREditModal).
- Skin-selection gate on load (BACKLOG "Skin-selection gate…").

---

## Re-audit + my view (2026-07-19, against `OriginalShell.vue` @ 899 lines)

I re-audited the live shell against every item above. Current truth:

### Already CLOSED — do NOT re-do (the doc above is stale on these)

- **Signal Generator** — real Generate checkbox + tone-frequency input wired to the
  shared `toneGenerator` (`OriginalShell.vue:355-356`, `216-219`). Done.
- **Signal tab "Listening place"** — Distance/Angle present (`:657-659`, greyed = not
  modelled, which is honest). Done.
- **Driver tab** — Brand/Model + Placement (num-drivers, Standard/Iso-Barik) + Advanced
  options column all present. Done.
- **Toolbar** — 8 `.tb-btn` icons + `.chart-select` dropdown + **live** cursor readout
  (`cursorHz`/`cursorVal` computeds off `state.cursorF/pinnedF`, `:326-328`) — the readout
  is wired, not static. Done.
- **Box single-chamber "Advanced→"** → real Box-losses modal (Ql/Qa/Qp on `state.P`,
  `:704-712`). Done.

### Genuinely still OPEN (verified in the current shell)

- **Filters tab** — mounts shared `<FiltersPanel/>` (`:650`), not the mock's `.filters-quickadd` list.
- **Tune panel** — shared `<DriverWhatIfPanel/>` (`:725`), not the mock docked `.tune-panel`.
- **Driver Editor** — shared `<DriverEditorModal/>` (`:726`), not the mock 4-tab `.param-grid`.
- **Select Driver / New Project / Manage Drivers** — all just set `state.browseOpen`
  (`:282,300,516`); the mock's picker table + 2-step wizard are absent.
- **Options modal** — button is `.tb-btn disabled` "not yet in OpenISD" (`:303`); not ported.
- **Save bar** — shows the two OpenISD buttons only; the mock's **Unsaved indicator +
  Revert/Reset** are absent (`:396-398`). This is **deferred pending `../STATE_MODEL.md`**
  (the ground→modified→what-if state model) — once the modified-state layer exists, the
  Unsaved indicator + Save + Reset become truthful and should be wired to it. NOT permanently
  fake (that earlier characterisation is superseded by STATE_MODEL.md).
- **Color button** — static swatch, no `cycleColor` (`:390`).
- **Projects checkbox** — deletes the compare row (`removeCompare`, `:345`) instead of
  toggling trace visibility.
- **Vented pane** — no "End Correction" select; readout labelled "Port resonance Fb"
  (`:570`), mock says "1st port resonance".
- **Dual-chamber (bandpass) Box tab** — Rear/Front show only **Volume**; the mock's
  calculated **Frc** / **Tuning freq** greyed readouts are missing (`:431-440`).

### Approved deliberate divergences — the arch-reviewer 3a MUST NOT flag these as regressions

The "identical to mock" goal has explicit, user-approved exceptions. Record them so the
audit stops churning on them:

1. **De-emphasised Save Changes / Export .wdr buttons** — these are OpenISD-only actions,
   not WinISD features; the human asked for them small and muted (lower fidelity on purpose).
2. **Active project-tab junction** — improved beyond the mock to a notebook-tab look
   (concave outward fillets meeting the panel), at the human's request; the mock's flat
   detached tabs are NOT the target.
3. **6th-order bandpass + ABC show "response model pending", not a curve** — the mock's
   curves for these are static fakes; the engine has no model, and the no-fake-data rule
   forbids inventing one. Pending IS the correct fake-state→engine swap here. **ABC parity
   is permanently impossible** (WinISD/mock both faked it) until an oracle exists — treat
   the pending state as the finished target, not a gap.
4. **Fixed decimal precision** — matches the WinISD screenshots (`docs/winisd/`), which may
   differ from the mock's arbitrary literals. The screenshots win, not the mock.
5. **Projects-list affordances** — a hidden overlay's row is dimmed + struck-through
   (`.trace-hidden`), and each overlay has a ✕ remove button. The mock has neither (its
   projects were fixed fake rows with no hide-state styling and no remove). Both are
   deliberate usability additions for the real, dynamic compare list.
6. **Closed box hides the enclosure/Vents tab** — for a Closed (sealed) box the enclosure
   tab is dropped entirely (it would only duplicate the Box tab's Volume). This diverges
   from BOTH the mock (which keeps a `#enclosure-sealed` sub-panel) AND the current Classic
   skin (which keeps the tab with a "Nothing extra…" placeholder). It is a **direct
   user request** — the human's opening report of this whole effort was "there should be no
   tab for Sealed." A spec encodes it. (Classic still shows the placeholder tab — that
   original bug is unfixed there, and Classic is slated for retirement anyway; do NOT claim
   Original "matches Classic" here.)

### My strategic view — the crux and the risk

- **The hard rule vs. real logic is the whole difficulty.** Every open item is a _modal/panel_
  where the shell reuses a shared component precisely because that component carries the REAL
  store/ADT logic (filters, what-if, driver edit, driver library). Porting the mock's markup
  means re-hosting that logic under mock-faithful DOM. The failure mode already burned us: the
  prior agent "made it match" by editing the shared `BoxPanel`/`PRPanel` and regressed Modern
  (`CODE_REVIEW/POST_MORTEM.md`).
- **Recommended pattern (per the Decision rule above):** for each modal/panel, first try a
  clean additive reuse of the shared component (Invariant 1); if that would compromise
  either skin, build a **new Original-owned** component under
  `packages/ui/src/shells/original/` that renders the **mock's markup** and calls the
  **shared store/composables/ADT/engine APIs** directly (e.g. `state.P.filters` ops, the
  `DriverModel` ADT `enter/clear`, the bundled-driver loader) — duplicate presentation, never
  logic. Logic that a Modern `.vue` uses is reached through the store/engine API that `.vue`
  itself calls, so Original needs no edit to that file. Only add a NEW composable/util (a new
  file) if the API genuinely doesn't exist yet — never modify a Modern-rendered file except
  as a proven-additive, default-preserving change.
- **Sequence low-logic → high-logic**, one green + arch-reviewed commit each: (1) projects
  checkbox toggle, Color cycle, Vented End-Correction + label, dual-chamber Frc/Tuning
  readouts, Save-bar Revert/Unsaved — small, mostly presentational; then (2) Options modal
  (near-static); then (3) Select Driver picker table + New Project wizard (moderate, reuse the
  bundled-driver loader); then (4) the logic-heavy Driver Editor, Tune, Filters last.
- **Gate every chunk:** arch-reviewer 3a + the full `original-skin.browser.spec.ts` +
  `bash scripts/health-check.sh`. Any commit that edits a shared/Modern file MUST show
  Modern's + Classic's browser/visual tests green and the change additive; otherwise scope it
  to `shells/original/` + new files only. `git show --stat` on every commit is the guard.

---

_Snapshot compiled 2026-07-19 from `BACKLOG.md` + `CODE_REVIEW/ARCH_REVIEW_LOG.md` §3a.
Re-audit `OriginalShell.vue` vs `mock/index.html` before actioning — the port is under
active change. Re-audit section added 2026-07-19 against the 899-line shell._
