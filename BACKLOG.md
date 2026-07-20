# OpenISD — backlog

Working list of capabilities that make OpenISD a complete, professional
enclosure-design tool. Items are described on their own terms; each notes how it
fits the existing engine so it can become a GitHub issue. Priorities are a guide,
not a contract — pick what interests you and open a PR.

Companion documents: [PLAN.md](PLAN.md) (re-architecture phases and gates) ·
[DEVELOPMENT.md](DEVELOPMENT.md) (coding practices) · [ARCHITECTURE.md](ARCHITECTURE.md)
(hard decisions).

**P0** = foundation, gates everything below · **P1** = high value, tractable on
today's engine · **P2** = larger but well-defined · **P3** = big rocks (design first).

**Checkbox format:** `[x]` = implemented · `[ ]` = not implemented.
Implemented items carry a second box for test status: `[x] [x]` = implemented + tested,
`[x] [ ]` = implemented but untested.
**Test tags** — `[unit]` = logic in `packages/engine/src/` with tests in `test/`;
`[ui]` = Playwright browser automation in `test/app.browser.spec.js`.

---

## Next — do first

- [ ] **Bug — `NumInput` spinner shows unbounded precision and the down-arrow sticks.** In the Original skin's Box tab, the Volume field (`state.P.Vb`, `OriginalShell.vue:436` — declared `:precision="2"`) shows values like `8.94924452476786` while its spinner is being clicked, and holding the **down** arrow stalls (must release and re-press) while **up** runs indefinitely. Both originate in the shared `packages/ui/src/components/NumInput.vue` and affect **every** field that uses it, not just Volume. Root cause is one thing — the dynamic `stepAttr` (`NumInput.vue:74-78`) sets the native `<input type=number>` step to `modelValue*scale*0.1`, a geometric 10%-of-current-magnitude step:
  - **Precision:** clicking a spinner arrow focuses the input, so `focused` is true and the `modelValue` watcher (`NumInput.vue:34-36`) skips `fmt()`; the raw stepped float is echoed straight into the field via `display.value = t.value` (`onInput`, line 50). `:precision="2"` is only re-applied on blur, so during spinning the field shows full float precision.
  - **Down sticks / up runs forever:** with `min="0"` and a step that _shrinks_ as the value drops, the browser's step-snapping refuses `stepDown` when it would fall below `min` or off the moving step base — the down-repeat stalls until release recomputes the step. Up has no `max`, so it compounds without limit.
    Fix should keep the field formatted to `precision` during stepping (reformat stepped values instead of echoing the raw float) and give the spinner a stable, well-behaved step (and/or clamp so down-stepping doesn't stall at `min`). Reproduce first with a `[ui]` test on the Volume spinner, then fix in `NumInput.vue`. Related to the per-field decimal-places item below. `[ui]`

- [ ] **Bug — EVERY Original-skin spinner must stay at fixed DP while spinning (two shared root causes).** This is the full audit of the item above — the same "crazy dp while spinning" symptom was reported on Box Volume (`8.94924452476786`), System input power (`138.090848575724`), series resistance, vent diameter, and vent length, and it affects _all_ spinner fields, from two distinct code paths:
  - **Root cause A — the `NumInput` component** (`packages/ui/src/components/NumInput.vue:74-78`), described in the entry above. Affects every `NumInput` on the shell: Volume `state.P.Vb` (`OriginalShell.vue:438,449`) and front volume `Vf` (`:455`), vent diameter `ventD` (`:580`, bp4 `:628`), vent length `ventL` (`:581`, bp4 `:629`), System input power `Pin` (`:683`), series resistance `Rs` (`:685`), PR Sd/Xmax/added-mass (`:606/609/615`), and the Box-losses modal Ql/Qa/Qp. (`prNum` is `:precision="0"` integer — unaffected.)
  - **Root cause B — the `v-expo-step` directive** (`packages/ui/src/directives/expoStep.ts:13-16`): same proportional 10%-of-\|value\| step idea, but it sets only the native `step` and **never reformats the displayed value**, so raw floats show mid-spin (and min-clamped fields can stall the down-arrow) — same two symptoms, different code. Affects the raw `<input type="number" v-expo-step>` fields: Advanced tab Relative humidity/Air pressure (`:695/696`), signal-generator frequency `genHz` (`:373`), Filters fc/Q/gain/f0/Q0/fp/Qp (`OgFilters.vue:79-89`), and the Tune T/S param fields (`OgTune.vue:81,92` — these carry a `dp` and reformat on blur but still show raw float mid-spin). Plain Temperature `advTemp` (`:694`, native `step=1`) is low-risk but shows fractions if the value is fractional.
    Fix both paths to format the displayed value to its DP _during_ stepping, and capture the field→dp mapping (cross-refs the "Match each field's decimal places" item). `[ui]`

- [ ] **Bug — Original-skin `.edit-btn` buttons have no contrast (Select Driver / ✎ Edit / ♫ Tune).** The three action buttons render near-white text on a near-white fill. Cause: the global `button { color: var(--fg) }` reset (`packages/ui/src/style.css:68`, `--fg:#dfe6ee` light text) applies to `.edit-btn`, which sets `background:#f0f0f0` (`OriginalShell.vue:878`) but no `color` override — so light-on-light. Fix: give `.edit-btn` an explicit dark `color` (the WinISD button text colour) so it reads on its light fill. `[ui]`

- [ ] **Bug — Signal tab: Driver input voltage (V) should be editable and bidirectional with System input power (W).** Today "System input power" (W, `state.P.Pin`, `OriginalShell.vue:683`) is editable while "Driver input voltage (each)" (V) is calculated/greyed/read-only as `driveV = √(Pin·Re)` (`OriginalShell.vue:684`). WinISD parity: voltage is also editable and W↔V drive each other via `P = V²/Re` — editing W recomputes V (current behaviour), editing V recomputes W. `[ui]`

- [ ] **Bug — Closed (sealed) box shows a redundant "Closed" enclosure tab that just duplicates the Box tab.** The dynamic 3rd nav tab labelled "Closed" (id `enclosure`, `OriginalShell.vue:636-643`) shows a Rear-chamber Volume editor identical to the Box tab's Volume (`OriginalShell.vue:438`); a sealed box has no vents, so the tab carries nothing unique. The `mock/` prototype does the same (`mock/index.html:523-529`), so dropping it for sealed boxes is a deliberate, sanctioned divergence from the mock — record it as an intentional "Original enhancement" when implemented. `[ui]`

- [ ] **Bug — save-button bar (`.parstate-legend`) is taller than its buttons.** The bar holding Save Changes / Export .wdr (`OriginalShell.vue:412-416`, styled `.parstate-legend` `:901`) is deeper than the short `.save-btn` (`padding:1px 7px; font-size:11px`, `:910`) it contains — it should be no taller than the button height. Candidate causes to check: `.parstate-legend { margin-bottom:8px }` and the swatches column (`.parstate-swatches`) forcing extra height. Layout-only fix. `[ui]`

- [ ] **Bug — New Project does not start fresh: it carries over the previous project's filters (and every other param).** `OgNewProject.create()` (`OgNewProject.vue:36-42`) mutates only `state.box`, `state.P.Vb`, `state.P.Vf` — it never resets `state.P.filters`, `Pin`, `Rs`, vent geometry, PR params, or the compare list, so a "new" project inherits the old one's state. Fix: (1) build a fresh project from the store's initial-state defaults (reuse `store.ts:25` / `resetProjectToGround()` `store.ts:192` — do not reinvent; `filters` defaults to `[]`), then apply the chosen box type + volume on top; (2) if there are **unsaved changes**, warn/confirm before discarding them when New Project is hit (data-loss guard). `[ui]`

- [ ] **Bug — New Project wizard should ask for the project name first.** The wizard (`OgNewProject.vue`) currently starts at step 1 = box type, step 2 = volume, with no name step; it should collect the project name before box type. Pairs with the fresh-start bug above. `[ui]`

- [ ] **Session-context persistence & sharing — two requirements over ONE "session context" object.** Both requirements serialize the same _session context_: the design PLUS the view/UI context that defines "what the user is looking at". They differ only in the sink (localStorage vs URL) and in which fields are device-local. `[ui]`

  **Session context taxonomy** (what must be captured) — _decisions confirmed_:
  - **Design** — driver (full ADT JSON), box type, params `P` (incl. filters), comparison traces. _Persisted today_ (`serialize()`, `persist.ts`).
  - **View context** — skin, active project tab (`state.ui.originalProjectTab`), selected chart (`state.ui.originalChartTab`). _Persisted today_ (in `state.ui`).
  - **Project meta** — name/creator/created/description. _Persisted today_.
  - **Open editor + its uncommitted buffer** — a Tune/edit dialog that is open, plus the in-progress what-if/edit values, **MUST be preserved** across refresh (decision: _preserve the open editor_). This makes the STATE_MODEL what-if/edit overlay **durable**: `serialize()` gains the open-editor flag + the overlay's driver JSON; on load the app re-opens the editor and re-creates the overlay with those values. Extends STATE_MODEL Increment 2/3.
  - **Transient (NOT persisted, by decision)** — per-chart Y-zoom (`state.yRanges`) and live hover cursor/drag. `yRanges` resets to auto-scale on refresh and is **excluded** from share links.

  **R1 — Refresh fidelity (PRIMARY).** A browser refresh (F5) must repaint the _exact_ prior context — zero perceptible change (except the deliberately-transient `yRanges`/cursor). This is purely a **local-persistence completeness** problem: save the full session context to localStorage on change and restore it on load. **It does NOT involve the URL and therefore has zero impact on any skin's address bar.** _Work to do:_ persist the open-editor flag + uncommitted what-if/edit buffer and restore them on load (re-open the editor mid-edit); `[ui]` refresh test covering design + tab + chart + an open Tune with pending values.

  **R2 — Full-context share link (SECONDARY, beneficial).** An explicit "Copy share link" action encodes the SAME session context (design + comparisons + project meta + shareable view context: active tab, selected chart) into a `#s=…` URL, so opening it reproduces the page for another person. Restored by `loadFromHash()` on open. Richer than today's `shareLink()` which encodes design-only and strips `ui`. **Excluded from the link:** skin (recipient keeps their own — decision) and `yRanges` (transient). An open editor/uncommitted buffer is a personal working state — exclude from shared links too (share the committed design, not someone's half-finished edit).

  **Non-goal:** live address-bar syncing / "bookmark just works". Because R1 uses localStorage, refresh already works without the URL, so the URL is reserved for the explicit share action only — no `history.replaceState` on every keystroke, no Modern-skin behaviour change.

- [ ] **Implement the layered project state model (`STATE_MODEL.md`).** Replace the single flat store state + blanket auto-persist with the **ground → modified → what-if** hierarchy (+ a parallel **edit** state the charts ignore). Charts render highest-priority existing state (what-if › modified › ground). A first project change forks a modified state off ground; what-if/edit dialogs fork off modified-else-ground. What-if previews live; edit commits only on **Accept**; what-if commits on **Keep**; **Save** promotes modified→ground (persist) and **Reset state** discards modified. Every accept/discard button needs a hover tooltip of its state effect (see `STATE_MODEL.md` "Button labels & tooltips"). `[ui]`
  - **Increment 1 (DONE):** ground↔modified layer in `store.ts` (`isModified`/`markProjectSaved`/`resetProjectToGround`) + the Original skin's truthful Unsaved/Save/Reset bar.
  - **Increment 2 (DONE):** driver what-if priorityState overlay — `driver`/`driverRaw`/`driverErrors` resolve to the overlay when active (charts preview live) while `driverJSON` stays committed-only (a live what-if never dirties modified/ground until Keep). OgTune drives start/keep/cancel.
  - **Increment 3 (TODO):** the **edit** dialog (charts ignore the buffer until **Accept**) still runs through the shared `DriverEditorModal`; the overlay is **driver-only** — box-type / param what-ifs are not yet routed through a layer. Both extend the same machinery.

- [ ] **Max-SPL/Power when BOTH Xmax and Pe are missing** — with neither limit, the max curve is genuinely undefined (currently +∞). Treat it as a "chart issue": show the missing-limit message instead of drawing an unbounded curve. Follow-up to the Xmax=0 fix (which handled Xmax-absent-with-Pe-present).

- [ ] **Classic-skin Color swatch is inert — wire it to a real per-design colour.** The "Color" control in the classic (WinISD) skin's Project rail (`ClassicShell.vue`, `.cl-color`) is a static yellow-green swatch (`WINISD_TRACE`), not a picker — no click handler, no `<input type="color">`. WinISD's Color button opens a chooser and sets the current design's trace colour on the graph. There is no colour-picker component anywhere in the app yet. Add a real control (native `<input type="color">` is enough) that writes a per-design colour into the store and threads it into the trace (replacing the hardcoded `WINISD_TRACE` constant) and the Color swatch itself. See `CLASSIC-SKIN-review.md` #2. `[ui]`

- [ ] **Classic-skin vented view — support both rectangular and circular ports.** The classic (WinISD) skin's Vented/Bandpass port fields (`BoxPanel.vue` `showType`, rendered on `ClassicShell.vue`'s dynamic 3rd rail tab) only model a single **circular** vent (`state.P.ventD` diameter + `ventL` length; `fb` computed from `π·(ventD/2)²`). WinISD lets the user choose a **rectangular** (slot) port as well, entered as width × height instead of diameter. Add a port-shape selector and rectangular dimensions, feed the resulting port cross-sectional area into the shared tuning math (`tuningFromLength` / `ventLength` already take an area, so the engine needs no change — only the area derivation and the UI inputs). Applies to both `vented` and `bandpass4`. `[ui]`

- [ ] **Engine: 6th-order bandpass model (enables it in the Original skin).** The Original skin (`OriginalShell.vue`) already ports the 6th-order bandpass UI (dual-chamber fields + diagram) but shows a "response model pending" state because `packages/engine/src/circuit.ts` has no branch for it — `BoxType` is `sealed|vented|pr|bandpass4`. Add a `bandpass6` circuit branch: **rear vented chamber + front vented chamber** (bandpass4 is rear _sealed_ + front vented; 6th-order vents the rear too), with independent rear/front vent geometry in `SweepParams`. Both ports radiate to the exterior (`U0 = UP_rear + UP_front`) — **confirm the exact topology and output summation against a WinISD oracle before trusting any curve** (this repo's engine-rules: physics needs oracle validation). Test-first: golden fixture + closed-form passband sanity + WinISD cross-check. Then add `bandpass6` to `SUPPORTED_BOX` in `OriginalShell.vue`. `[unit]`

- [ ] **Engine: ABC (Aperiodic Bi-Chamber) — needs a reference model first (decision required).** The Original skin ports the ABC UI (diagram + dual-chamber) but there is **no validation oracle**: WinISD does not model ABC, and the mock's ABC curve was static artwork. Before any physics is written, decide the reference: (a) locate/define an explicit, citable ABC model (aperiodic = resistively-damped inter-chamber coupling) and validate it, (b) implement it as a documented approximation clearly labelled "unvalidated" in the UI, or (c) keep ABC as UI-only permanently. Do **not** ship an ABC curve without resolving this — an unvalidated curve is a silent correctness bug. Until resolved, `abc` stays out of `SUPPORTED_BOX` and shows the pending state. `[unit]`

- [ ] **Match each field's decimal places to the WinISD screenshots.** Every numeric field's displayed precision must copy WinISD exactly, sourced from the logged screenshots in `docs/winisd/*.png` (index: `docs/winisd/SCREENSHOTS_INDEX.md`, parity notes: `docs/winisd/INPUT_PARITY.md`). Known examples: **System input power** and **Driver input voltage** are **1 dp** (`140.0 W`, `15.2 V`); tuning/resonance frequencies **2 dp** (`40.25 Hz`); series resistance **3 dp** (`0.100 ohm`); Qtc **3 dp** (`0.707`); volumes **2 dp** (`6.00 l`). Go field by field against the screenshots and set each `NumInput :precision` / readout `.toFixed(n)` to match — applies to the Original skin (`OriginalShell.vue`) first, then reconcile the Classic and Modern skins to the same per-field table. Capture the full field→dp mapping in `docs/winisd/INPUT_PARITY.md` so all skins share one source of truth. `[ui]`

- [ ] **Original skin — close remaining mock-fidelity gaps (must be IDENTICAL to `mock/`).** The audit mandate (`.claude/agents/arch-reviewer.md` step 3a) requires `OriginalShell.vue` to be visually and structurally identical to the mock; only the fake-state→shared-engine swap may differ. The window chrome, toolbar (8 icons + chart dropdown + cursor readout), 6-type Box tab + diagrams, Driver (Placement/Advanced), Signal, Advanced, Project tabs, provenance colours, unit-cycling, and the Box-losses modal are ported. Remaining divergences (full detail in `CODE_REVIEW/ARCH_REVIEW_LOG.md`):
  - **Modals — port the mock's own markup instead of reusing shared components.** The Filters tab, Tune panel, and Driver Editor currently mount the shared `FiltersPanel.vue` / `DriverWhatIfPanel.vue` / `DriverEditorModal.vue` (same as ClassicShell) rather than the mock's `.filters-quickadd` list, docked `.tune-panel`, and 4-tab `.modal-tabs`/`.param-grid` Driver Editor. Reusing shared logic is good engineering but is NOT the sanctioned divergence — the mandate wants the mock's markup, wired to the same store/ADT.
  - **Select Driver modal** — port the mock's Library/My-Drivers picker table + action row (`mock/index.html:940-1011`); today it opens the shared `DriverBrowser.vue`.
  - **Select Driver / Driver Editor** — accepted reuse of the shared `DriverBrowser`/`DriverEditorModal` (logic trapped in them; re-skin to mock markup only after extracting that logic to composables — see `brain/bring_mock_live.md`).
  - **Options modal** — not ported (button disabled).
  - ~~Save bar~~ — DONE (STATE_MODEL Increment 1): Unsaved indicator + Save Changes (adopt as ground) + Reset state (revert), wired to the store's real `isModified`/`markProjectSaved`/`resetProjectToGround`.
  - **Color button** — wire the mock's `cycleColor` click behaviour (`mock/index.html:249`); currently static.
  - **Projects-list checkbox** — should toggle trace visibility (`toggleProjectTrace`), not delete the compare row.
  - **Vented pane** — add the "End Correction" select and rename the readout to "1st port resonance" to match `mock/index.html`.
    Cleanest route: port the mock's real body markup + `mock/style.css` wholesale, `onclick`→`@click`, `value`→`v-model` bound to the store — never edit shared components (`BoxPanel`/`DriverPanel`/`PRPanel`) to do it (that regressed the Modern skin once — see `CODE_REVIEW/POST_MORTEM.md`). `[ui]`

- [ ] **Retire the Classic skin in favour of Original (once Original reaches mock parity).** The Original skin supersedes Classic as the WinISD-recreation shell — Classic is a thinner, less faithful recreation. Once Original closes its remaining fidelity gaps (item above), remove the Classic shell: delete `packages/ui/src/shells/classic/`, drop `'classic'` from `SkinId`/`ShellId`/`SKIN_IDS`/`SKIN_LABELS`/`resolveSkin` in `skins.ts`, remove `ClassicShell` from `App.vue`, delete `classic-skin.browser.spec.ts` + the classic cases in `skins.test.ts`, and migrate any persisted `state.ui.skin === 'classic'` to `'original'` on load (so saved prefs don't dangle). Do NOT remove until Original is at parity, so there's no gap with no complete WinISD mode. `[ui]`

- [ ] **Extract duplicated PR / drive-voltage / sound-velocity formulas into the engine.** `prVas`, `prFs`, `prFsMass`, `prQms`, `driveV = √(Pin·Re)`, and `advSoundVelocity` are copy-pasted physics derivations now living in `OriginalShell.vue`, `ClassicShell.vue`, `PRPanel.vue`, and `PREditModal.vue` (3–5 copies each) — a drift risk with no single source of truth. These are pure closed forms that belong in `packages/engine/src/` (or the Driver/PR ADT), exported once and consumed by every shell/panel. Replace all copies. `[unit]`

- [ ] **Skin-selection gate on load — require an explicit skin choice.** On every page load, block the app behind a full-screen chooser presenting the three skins (Auto / Classic (WinISD) / Modern, from `SKIN_IDS` / `SKIN_LABELS` in `packages/ui/src/skins.ts`); the app is not shown or interactable until the human picks one, which sets `state.ui.skin` (`packages/ui/src/store.ts`) and `App.vue` swaps the shell via `resolveSkin()`. Prompt on **every** visit (ignore the saved preference for the gate — drive it from a session/ephemeral flag, letting the persisted skin only seed the highlighted default), and show the gate **even when a shared `#`-design link is opened** (skin is already stripped from shared URLs at `persist.ts`). Reuse the existing overlay pattern (`DriverBrowser.vue` + `useEscToClose`) mounted in `App.vue`; reuse `SKIN_LABELS` for the button text so the gate never drifts from the picker. `[ui]`

---

## Shipped ✓

- [x] [x] Validated engine: sealed, vented, 4th-order bandpass, passive radiator `[unit]`
- [x] [x] Curves: SPL, driver + PR excursion, port velocity, group delay, impedance (mag + phase), transfer phase, max SPL, max power `[unit]`
- [x] [x] EBP gauge, Qtc / QB3-B4 alignment helpers, vent ↔ tuning solver `[unit]`
- [x] [x] Passive-radiator Fp tuning + mass auto-tune `[unit]`
- [x] [x] Multiple drivers (series / parallel) `[unit]`
- [x] [x] WinISD `.wdr` import **and** export; JSON project save/load `[unit]`
- [x] [x] In-browser self-test + CI engine test `[ui]`
- [x] [ ] Published to GitHub Pages with automated CI deploy
- [x] [ ] Vue 3 + Vite + PWA — installable, works offline via service worker
- [x] [ ] Persist design across reloads (Ctrl-R keeps the driver) — localStorage
- [x] [ ] Power input convention: primary input is **power (W)**, voltage derived
- [x] [x] URL-encoded designs — full design lives in a shareable link; no server needed `[ui]`
- [x] [ ] Export / import the complete design as a JSON file

---

## P0 — Test & architecture foundation

**Status: complete.** `packages/engine/src/` is fully extracted (7 modules), golden-master
fixtures cover all box types, CONTRACT.md is written and versioned, per-module unit
tests exist, the Vue UI consumes only the public contract, and Playwright + CI are
both live. The description below is preserved for history.

> ~~OpenISD is a spike: logic is one inline script in `index.html`, "verified" by a
> self-test that string-slices the engine out and `eval`s it, with no real UI tests.~~
> Completed — see [PLAN.md](PLAN.md).

Full plan: [PLAN.md](PLAN.md) ·
practices: [DEVELOPMENT.md](DEVELOPMENT.md) · oracles:
[REFERENCES.md](REFERENCES.md).

- [x] [x] **P0 · Phase 0** Golden-master fixtures: freeze current sweep outputs for
      every box type, assert equality — the net that proves extraction preserves
      behaviour, before any code moves. `[unit]`
- [x] [x] **P0 · Phase 1** Extract the core (`complex`, `driver`, `wdr`, `circuit`,
      `sweep`, `alignments`, `filters`) into `packages/engine/src/*.js` — no DOM — one module
      at a time, **extracting not rewriting**. `[unit]`
- [x] [x] **P0 · Phase 2** Define & version the `Design → Curves` contract
      (`CONTRACT.md`) — the documented API third-party UIs depend on. `[unit]`
- [x] [x] **P0 · Phase 3** Per-module functional tests vs tiered oracles (closed
      forms > datasheets > alignment tables > cross-tool). `[unit]`
- [x] [x] **P0 · Phase 4** Rebuild the OpenISD UI on the core contract only. `[ui]`
- [x] [x] **P0 · Phase 5** Playwright functional tests + CI runs unit + golden +
      functional on every push / PR. `[ui]`
- [ ] **Research** Chrome's MCP server as a functional-test driver — evaluate vs
      Playwright for driving the real app and checking rendered canvases.
- [ ] **P1 · Phase 6** Mobile / responsive (PWA) UI as a second consumer of the
      core — proves the decoupling; deferred, not part of the foundation.
- [ ] **P1** Error visibility sized to a static client tool: global error
      boundary + a debug-log toggle (not an observability stack).
- [x] [ ] **P0** Persist design across reloads (ctrl-R keeps the driver) — localStorage
- [x] [ ] **P0** Power input convention: primary input is **power (W)**, voltage derived

---

## Signal chain & EQ _(the curves are already complex — filters slot in cleanly)_

- [x] [x] **P1** Parametric (peaking) EQ — fc, Q, gain; multiple bands; applied to the transfer function `[unit]`
- [ ] **P1** High-shelf / low-shelf filters
- [x] [x] **P1** High-pass / low-pass filters (Butterworth; selectable Q; Bessel/LR orders not yet exposed) `[unit]`
- [x] [x] **P1** Linkwitz transform (target Fs/Qtc) `[unit]`
- [x] [ ] **P1** Series / source resistance (amp output + cabling) in the drive model
- [ ] **P1** Configurable listening distance (replace the fixed 1 m)
- [ ] **P2** Amplifier output impedance / damping-factor effect on response

## Charts & graph types

WinISD chart inventory mapped to OpenISD status. Box-type scope notes: `[PR]` = passive radiator only · `[BP]` = 4th-order bandpass only · `[EQ]` = only when EQ/Filter is active.

### Universal (all box types)

- [x] [x] SPL `[unit]`
- [ ] **P1** Transfer function magnitude — same data as SPL, Y axis normalized to 0 dB at passband with −3 dB reference line. Display mode on the SPL chart, not a new engine series. (Verified from WinISD screenshots: same cursor value −9.896 dB at 38 Hz in both charts.)
- [x] [x] Transfer function phase `[unit]`
- [x] [x] Group Delay `[unit]`
- [x] [x] Maximum Power `[unit]`
- [x] [x] Maximum SPL `[unit]`
- [x] [x] Cone excursion (driver) `[unit]`
- [x] [x] Impedance `[unit]`
- [x] [x] Impedance phase `[unit]`
- [ ] **P1** Amplifier apparent load power (VA) — V²/Z from existing impedance sweep; no new engine work needed
- [ ] **P1** MaxSPL: color curve by limiting factor — Xmax-limited segments in design color, Pe-limited in amber. `xlim[]` already returned by `maxCurves`. Implement by (a) attaching `xlim` to the MaxSPL series in `series.js`, (b) two color passes in `canvas.js` series loop, (c) phantom legend entries "Xmax limit" / "Pe limit". Only applies to primary design; compare overlays keep their assigned color. WinISD has no equivalent.

### PR box type only

- [x] [x] Cone excursion (PR) — currently combined with driver on one chart; split display is missing `[unit]`
- [ ] **P2** Transfer function magnitude (PR) — PR contribution to system response `[PR]`
- [ ] **P2** Transfer function phase (PR) `[PR]`

### Ported / vented

- [x] [x] Port — Air velocity `[unit]`

### 4th-order bandpass only

- [ ] **P2** Rear port — Air velocity `[BP]`
- [ ] **P2** Rear port — Gain `[BP]`
- [ ] **P2** Front port — Air velocity `[BP]`
- [ ] **P2** Front port — Gain `[BP]`
- [ ] **P2** Intrachamber Port — Air velocity `[BP]`

### EQ/Filter variants (hidden when no EQ active)

- [ ] **P2** Transfer function magnitude (EQ/Filter) `[EQ]`
- [ ] **P2** Transfer function phase (EQ/Filter) `[EQ]`
- [ ] **P2** Group Delay (EQ/Filter) `[EQ]`

### Axis controls & chart UX

- [ ] **P1** Shared X axis range — Hz min/max with log-spaced spinner; all charts react to one X range
- [ ] **P1** Per-chart Y axis autoscaling — fit to data in current X range; on by default
- [ ] **P1** "Single chart" toggle — selecting a chart deselects the current one; toggle switch in chart pane header
- [ ] **P1** Frequency-range presets — sub / woofer / wide / custom shortcuts for the X range
- [ ] **P2** Draggable / resizable chart panels
- [ ] **P2** Configurable graph gridlines (3 / 5 / 10 dB) and contrast

## WinISD input/feature parity

Gaps found by auditing the WinISD 0.7.0.950 screenshots against OpenISD's UI —
full evidence table in [docs/winisd/INPUT_PARITY.md](docs/winisd/INPUT_PARITY.md).

- [ ] **P1** Environment model — derive `c`/`ρ` from **temperature / humidity / air pressure** (per-project + app default), replacing the single hardcoded constant. WinISD: Advanced pane.
- [ ] **P1** Off-axis **listening angle** + configurable **distance** (OpenISD is fixed 1 m on-axis). WinISD: Signal pane.
- [ ] **P1** Filters OpenISD lacks: **all-pass, raised-cosine delay, static gain**, high/low **shelf**. WinISD: Filters.
- [ ] **P2** Driver fields OpenISD lacks: **Xlim**, **USPL**; figure-of-merit read-outs (Rme, gamma, Mpow, Mcost, SPLmax). WinISD: Parameters/Advanced tabs.
- [ ] **P2** Charts OpenISD lacks: **amplifier apparent load power (VA)**, port **gain** (vs velocity), intrachamber port velocity (needs 6th-order BP).
- [ ] **P2** Loading/model options: **isobaric (Iso-Barik)**, **transmission-line port**, **force-flat response**, **Rg-at-driver-side**, **SPL-graph-Xmax-limited**.
- [ ] **P2** Driver **added mass to cone** (WinISD has it for the driver, not just the PR).
- [ ] **P3** Metric ↔ imperial **unit switching** (OpenISD is metric-only).

## Enclosure types & box model

- [x] [ ] **P1** Absorption / fill loss `Qa` (complete the Ql / Qa / Qp loss set). Route `Ql`/`Qa`/`Qp` into the vented & bandpass transfer function — QSpeakers' `system.cpp` `response()` shows the loss-Q coefficients explicitly (reimplement from the physics, not the GPL code).
- [ ] **P1** `F3` (−3 dB) read-out — the engine surfaces `fc` (system resonance) only; add the true −3 dB frequency. Sealed closed form: `F3 = fc·√((1/Qtc²−2+√((2−1/Qtc²)²+4))/2)` (equals `fc` only at Qtc=0.707). This is a display gap, **not** a calc bug: external tools' higher f3 (SpeakerBoxLite 74.5, lautsprechershop 81) come from empirical/leakage models, while our `fc` matches the theoretical −3 dB — see `REPORT_ORACLE_CROSSCHECK.md`.
- [ ] **P2** 6th-order bandpass (both chambers ported) — extend the 4th-order branch. Two distinct alignments to support, as exposed by SpeakerBoxLite: **parallel** (both ports vent to the outside) and **series** (chambers coupled through a shared port).
- [ ] **P2** Isobaric / compound loading
- [ ] **P2** Aperiodic (resistive vent) loading
- [ ] **P3** Transmission line / quarter-wave (line length + stuffing)
- [ ] **P3** Horn / waveguide (throat, mouth, flare)

## Vents & ports

- [ ] **P1** Multiple vents (1–4) sharing the tuning
- [ ] **P1** Slot / rectangular vents (in addition to round)
- [ ] **P1** Selectable end-correction (free/flanged combinations, custom value)
- [ ] **P2** Drag-to-adjust Vb / Fb directly on a graph, with lock-one

## Driver data & T/S

- [ ] **P1** Guided parameter entry — step-by-step flow following the WinISD-recommended order (Mms+Cms → Sd+BL+Re → Qms → Hc/Hg/Pe → numVC → Znom). Each step shows which fields to fill, why they matter, and what WinISD computes from them. Minimum viable path (Qts+Vas+Fs) clearly signposted. WinISD gives you a blank form with no guidance; this should be meaningfully better.
- [ ] **P1** Paste raw datasheet text → infer T/S parameters
- [x] [x] **P1** In-app driver database search / filter (by size, brand, parameters) `[ui]`
- [ ] **P1** "Duplicate / copy from" an existing driver to speed manual entry
- [ ] **P1** WDR writer: when OpenISD writes `.wdr` files, write `VCCon=2` for series wiring — the scraper always writes `VCCon=1` (correct for parallel/single-VC), but the full writer must emit the correct value. WinISD has a save bug and always writes 1; OpenISD should not replicate that bug. See `WINISD.md §12`.
- [ ] **P2** WinISD `.wpr` project import — format is decoded (INI sections:
      ProjectInfo, Driver, Box, Vent*, PassiveRadiator, SignalSource, Filters)
- [ ] **P2** Unibox spreadsheet import
- [ ] **P3** Import measured traces (SPL / impedance / ZMA / FRD)
- [ ] **P3** Physical dimension extraction — Thick, Depth, MagDepth, Magnet, Basket, Outer, Vcd appear as text in some datasheets and as engineering drawings in most. Extracting them would let OpenISD compute DVol (driver displacement volume) and display baffle cutout dimensions alongside the box design. Requires PDF/image parsing per manufacturer drawing conventions.

## Alignments & helpers

- [ ] **P1** Expand vented alignment presets (SBB4, EBS, Bessel, Bullock, Keele-Hoge, Legendre, Chebyshev, Zbinden/M4) alongside QB3/B4. Closed-form Vb/Fb for each are published (Bullock, Keele & Hoge, [Zbinden](http://www.mzbinden.ch/ventedalignments/index.html) papers) and implemented in QSpeakers (`optimizer.cpp`) and Scimpy (`speakermodel.py`, Chebyshev/QB3) — **reimplement from the papers, not the GPL source**; cross-check each preset against QSpeakers/Scimpy output. Rationale & extracted formulas: `SPEAKER_TOOL_LANDSCAPE.html`.
- [ ] **P1** Formula-oracle unit test — assert the engine's sealed/ported/bandpass response at sample frequencies against the published closed-form transfer functions (independent reimplementation, e.g. cross-checked with QSpeakers). An open, inspectable oracle for curve shape, complementing micka's scalar checks and avoiding dependence on unvetted web tools (SpeakerBoxLite driver params are reported "WAY off").
- [ ] **P2** Guided design wizard (driver → count → box type → starting params)
- [ ] **P2** Step-response curve (time-domain, from the transfer function)

## Construction & woodworking

- [ ] **P2** Net / gross internal volume from panel thickness (+ separate baffle thickness)
- [ ] **P2** Driver & port displacement subtraction
- [ ] **P2** Bracing / lining / component (crossover, plate amp) volume subtraction
- [ ] **P2** Panel cut list + per-panel dimension breakdown
- [ ] **P3** 3D enclosure / assembly preview
- [ ] **P3** Sheet-layout cut optimiser (bin-packing, kerf, rip/cross cuts, PDF)
- [ ] **P3** 3D-printable port export (STL)

## Crossover & multi-way _(larger arc)_

- [ ] **P3** Crossover network design (1st–6th order, Butterworth / Linkwitz-Riley)
- [ ] **P3** L-pad / level matching
- [ ] **P3** Multi-driver system summation (2- and 3-way), driver offset / acoustic centre

## Storage & sharing

- [ ] **P2** Project ↔ source-driver traceability & refresh. When a library driver (or
      PR) is pinned into a design/project, its parameters are **copied in and detached**
      from the source — exactly like a WinISD `.wpr`, which embeds a full `[Driver]` copy.
      So: (a) stamp the OpenISD driver id / source path into the embedded driver's
      `Comment` field (WinISD already does this — `Comment=loudspeakerdatabase.com/…`) and
      into the project JSON, giving traceability back to the original selection; (b) add a
      **"refresh drivers"** project action that re-pulls current library values when they
      differ from the embedded copy (delta detection), so a corrected driver can be pulled
      forward; (c) extend the same to the **PR selection** — WinISD has no concept of a PR
      _library_, so this is OpenISD-only. Prerequisite: a stable driver id (see the
      duplicate-driver detection item under Quality/infrastructure).
- [x] [x] **P1** URL-encoded designs — the full design (driver, box, params, graph
      selection, comparisons) lives in a shareable link; no server needed `[ui]`
- [x] [ ] **P1** Export / import the complete design as a JSON file
- [ ] **P2** Optional Google Drive storage — let users save and open designs in
      their _own_ Google Drive. Keeps personal storage entirely on the user's
      side with no server or accounts on ours (opt-in; nothing stored unless the
      user chooses it)
- [ ] **P3** Optional Dropbox / generic cloud storage on the same opt-in basis

## UX & platform

- [x] [ ] **P1** Save / restore graph layout (which graphs, sizes, positions) — graph selection persisted in localStorage
- [ ] **P2** Interactive schematic / lumped-model view of the signal path
- [ ] **P2** Keyboard nudge (arrow keys) on numeric inputs
- [ ] **P2** **Drag-to-scrub on spinner inputs** — press on a numeric spinner field and drag to increment/decrement its value: horizontal (left/right) and/or vertical (up/down) motion counts the value down/up, and dragging further from the start point accelerates the step rate (fine near the origin, coarse far out), mirroring the existing exponential-acceleration of the spinner buttons. The point is fast, tactile value scrubbing while watching the chart update live — a click-drag "scrubber" for live charting, not just click-repeat. Applies to spinner fields everywhere (main-view and popup editors). Release commits the value like any edit (marks the design dirty). Prototyped in `mock/` (`wrapSpinner` drag-scrub) as a reference for the real implementation.
- [ ] **P2** Mobile / small-screen layout pass

## Learning & docs

- [x] [ ] **P2** In-app parameter explanations / tooltips on inputs and curves — `title=` attributes on all controls
- [ ] **P2** "Coming from WinISD?" onboarding view — help page for WinISD users mapping each WinISD pane/control to its OpenISD equivalent, driven by the annotated screenshots in `docs/winisd/`. Present it as a **horizontally draggable before/after image comparison slider** (a vertical splitter the user drags left/right to wipe between the WinISD screenshot and the matching OpenISD view). Sourced from `WINISD_OPENISD_COMPARISON.md` + `docs/winisd/INPUT_PARITY.md`. Also surface a short version in `README.md`.
- [ ] **P3** Open, community-editable knowledge base (T/S, box types, tuning, losses)
- [ ] **P3** Worked-example tutorial

## Quality / infrastructure

- [ ] **P1** Fix existing code-review / vibe-coding issues before adding new features — run `/code-review` and clear all findings first
- [ ] **P1** Enforce architecture at build time — wire ESLint plugins into `vite build` (fail build on lint errors); add `eslint-plugin-functional` (immutability), `eslint-plugin-boundaries` (module layers), `eslint-plugin-sonarjs` (complexity), `eslint-plugin-import` (no-cycle), `dependency-cruiser` (dep graph); Python: add `ruff` + `import-linter`; see `OTHER_TOOLS.md`
- [ ] **P1** `scripts/` utility (+ CI step) to detect duplicate / same-model drivers as the library grows
- [x] [x] **P2** Per-feature engine tests added alongside each new box type / curve `[unit]`
- [ ] **P1** Driver as an ADT — `enter`/`clear`/`state` own the E/C/N provenance invariant, lossless `fromWdr`/`toWdr` round-trip, kills the interim raw-vs-derived ParState heuristic and the lossy `parseWdr`; see `PLAN_DRIVER_ADT.md`

Data-pipeline backlog items (schema/DQ unification, universal value provenance,
per-vendor extraction gaps) live in the sibling `winisd_tools` repo's
`SCRAPING_TODO.md`, not here.

## Driver-type classification / bundle schema

- [ ] **P3** Replace `has_woofer` / `has_tweeter` booleans with a single `sections: [...]` array in the drivers bundle. Today `scripts/bundle-drivers.mjs:85-86` bakes two booleans by regex-testing the `_meta.yml` sidecar for `specs.woofer` / `specs.tweeter` section keys (i.e. they are _literally_ "does `specs.<section>` exist"), consumed by `packages/ui/src/components/DriverBrowser.vue` `classifyTypes()` (`:119` coax = `hasWoofer && hasTweeter`, `:122` tweet fallback, `:134` woofer fallback). Asymmetry: there is **no** `has_passive_radiator` — PR is handled only via name-regex/`driver_type`. A `sections` array (faithful projection of the sidecar's `specs.*` keys) is more consistent (absorbs `passive_radiator` and any future section with no new field), extends without schema churn, and simplifies the coax test to `sections.includes('woofer') && sections.includes('tweeter')`. Processing is not harder (`.includes()` ≈ boolean). Cost: small bundle-size increase (omit when empty, as booleans are already omitted when false). Two-file change: producer `bundle-drivers.mjs` + consumer `DriverBrowser.vue`. Prompted 2026-07-17.
- [ ] **P3** Shared driver-type taxonomy (single source of truth) — cross-repo with `winisd_tools`. `classifyTypes()`'s `driver_type → chips` slice duplicates the `driver_type → spec section` mapping the scraper already owns in `winisd_tools` `emit_metadata.py` `_specs_for()`. A canonical taxonomy table (`driver_type → {section, chips, search synonyms}`) consumed by both the Python emitter and this bundle build would de-duplicate the `driver_type` fact. The name-regex + Fs/Sd numeric fallbacks (`DriverBrowser.vue:145-147`) must stay — they classify sources with a missing/unreliable `driver_type` (matt/, PE, community) that no lookup can cover. Full write-up in `winisd_tools/TODO.md` (New-pipeline backlog).
