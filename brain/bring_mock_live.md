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

## The one hard rule (why past attempts regressed)

Port the **mock's own markup + `mock/style.css` wholesale**: `onclick`→`@click`,
`value`→`v-model` bound to the shared store/ADT. The **only** sanctioned divergence is
fake-state → shared-engine. **Never edit shared components** (`BoxPanel.vue`,
`DriverPanel.vue`, `PRPanel.vue`) to make Original match the mock — doing so regressed
the Modern skin once (see `CODE_REVIEW/POST_MORTEM.md`). Reusing a shared component
inside Original is _not_ the sanctioned port even though it's "good engineering."

> NOTE: the parallel session is actively expanding `OriginalShell.vue` (it has grown
> well past the 404-line state the arch-review was written against). **Re-audit the
> current `OriginalShell.vue` against `mock/index.html` before starting each item** —
> some below may already be closed.

## Remaining gaps (from BACKLOG.md "Original skin — close remaining mock-fidelity gaps")

### Modals — port the mock's markup, don't reuse shared components

- [ ] **Filters tab** → mock `.filters-quickadd` list (currently mounts shared `FiltersPanel.vue`).
- [ ] **Tune panel** → mock docked `.tune-panel` (currently shared `DriverWhatIfPanel.vue`).
- [ ] **Driver Editor** → mock 4-tab `.modal-tabs` / `.param-grid` (currently shared `DriverEditorModal.vue`).
- [ ] **Select Driver modal** → mock Library / My-Drivers picker table + action row (`mock/index.html:940-1011`); today opens shared `DriverBrowser.vue`.
- [ ] **New Project wizard** → 2-step box-type / volume flow (`mock/index.html:889-938`); missing — New button currently opens the driver browser.
- [ ] **Options modal** → not ported (button disabled).

### Top-bar / chrome

- [ ] **Save bar** → add Unsaved-changes indicator + Revert button (`mock/index.html:255-260`); port currently shows "Export .wdr" in their place.
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
  Revert** are absent (`:396-398`).
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

### My strategic view — the crux and the risk

- **The hard rule vs. real logic is the whole difficulty.** Every open item is a _modal/panel_
  where the shell reuses a shared component precisely because that component carries the REAL
  store/ADT logic (filters, what-if, driver edit, driver library). Porting the mock's markup
  means re-hosting that logic under mock-faithful DOM. The failure mode already burned us: the
  prior agent "made it match" by editing the shared `BoxPanel`/`PRPanel` and regressed Modern
  (`CODE_REVIEW/POST_MORTEM.md`).
- **Recommended pattern to thread the needle:** build **Original-owned** modal components under
  `packages/ui/src/shells/original/` that render the **mock's markup** but call the **shared
  composables/store functions** (e.g. the filter store ops, `DriverModel` ADT `enter/clear`,
  the driver-library loader) — import the _logic_, not the shared `.vue`. This keeps markup
  mock-faithful, logic un-forked, and shared components untouched. If a needed piece of logic
  only exists _inside_ a shared `.vue`, extract it to a composable first (its own commit,
  covered by the existing shared-component tests) — never edit the shared `.vue` to change
  what Modern/Classic render.
- **Sequence low-logic → high-logic**, one green + arch-reviewed commit each: (1) projects
  checkbox toggle, Color cycle, Vented End-Correction + label, dual-chamber Frc/Tuning
  readouts, Save-bar Revert/Unsaved — small, mostly presentational; then (2) Options modal
  (near-static); then (3) Select Driver picker table + New Project wizard (moderate, reuse the
  bundled-driver loader); then (4) the logic-heavy Driver Editor, Tune, Filters last.
- **Gate every chunk** with the arch-reviewer 3a _and_ the full `original-skin.browser.spec.ts`
  - health-check; verify `git show --stat` touches only `shells/original/` (+ any deliberate
    composable extraction) — that check is what would have caught the prior regression.

---

_Snapshot compiled 2026-07-19 from `BACKLOG.md` + `CODE_REVIEW/ARCH_REVIEW_LOG.md` §3a.
Re-audit `OriginalShell.vue` vs `mock/index.html` before actioning — the port is under
active change. Re-audit section added 2026-07-19 against the 899-line shell._
