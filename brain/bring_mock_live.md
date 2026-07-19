# Bring the mock live — Original skin ↔ `mock/` parity

**Aim:** get an OpenISD skin that is visually and structurally **identical** to the
static prototype `mock/index.html`, wired to the real shared engine/store instead of
the mock's fake state. The vehicle already exists — the **`original` skin**
(`packages/ui/src/shells/original/OriginalShell.vue`), registered in `skins.ts` as
`Original (WinISD)`. This is a *close-the-gaps* job, not a new skin.

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
inside Original is *not* the sanctioned port even though it's "good engineering."

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
*Snapshot compiled 2026-07-19 from `BACKLOG.md` + `CODE_REVIEW/ARCH_REVIEW_LOG.md` §3a.
Re-audit `OriginalShell.vue` vs `mock/index.html` before actioning — the port is under
active change.*
