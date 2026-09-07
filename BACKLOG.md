# OpenISD — backlog

Working list of capabilities that make OpenISD a complete, professional
enclosure-design tool. Items are described on their own terms; each notes how it
fits the existing engine so it can become a GitHub issue. Priorities are a guide,
not a contract — pick what interests you and open a PR.

Companion documents: [ARCHITECTURE.md](ARCHITECTURE.md) (hard decisions) ·
[AGENTS.md](AGENTS.md) (coding practices).

**P0** = foundation, gates everything below · **P1** = high value, tractable on
today's engine · **P2** = larger but well-defined · **P3** = big rocks (design first).

**Checkbox format:** `[x]` = implemented · `[ ]` = not implemented.
Implemented items carry a second box for test status: `[x] [x]` = implemented + tested,
`[x] [ ]` = implemented but untested.
**Test tags** — `[unit]` = logic in `packages/engine/src/` with tests in `test/`;
`[ui]` = Playwright browser automation in `test/app.browser.spec.js`.

---

## Next — do first

- [x] [x] **Fsc / Qtc lossy calculation bug (WinISD parity).** OpenISD's UI readouts for sealed system resonance ($F_{sc}$) and Q ($Q_{tc}$) are hardcoded to the simple lossless formulas ($Fs \cdot \sqrt{1 + Vas/Vb}$), ignoring box leakage losses ($Q_L$). WinISD calculates $F_{sc}$ and $Q_{tc}$ from the actual simulated peak frequency and Q including box losses (specifically, leakage $Q_L = 10$ shifts $F_{sc}$ upward, e.g. from $56.57$ to $59.16$ Hz in a 10L box). Update the UI readouts to calculate these from the simulation's impedance peak or the lossy model equations.

- [x] [x] **"Auto calculate unknowns" option (Classic WinISD parity).** WinISD has a toggle to turn off auto-calculating missing/derived driver fields in the model (and suppresses writing calculated values to .wdr export).

- [x] [x] **Driver Field Provenance Inspector & Equation Inspector (Interactive UI feature).** Add a toggle in the Driver Editor ("Inspect Provenance"). Clicking any parameter field highlights all ancestor fields that participate in feeding/calculating that field. If there is more than one equation that feeds the field, color-codes each feeding collection with a distinct color key and pops up a separate non-modal overlay displaying the relevant equations and color key.

- [ ] **Driver identity is `<brand>/<model-slug>`, brand is primary, and a project EMBEDS its
      driver — human direction + rulings, 2026-08-04.** All points ruled; none is open. The
      `_savedAt`-stamp identity in `utils/myDrivers.ts` is rejected — the human's words: _"that
      sounds like crap"_.
  - **Identity is `<brand>/<model-slug>`** — the scheme the driver DB already uses on disk
    (`dayton-audio/pro-8`). Applies to the driver DB **and** to My Drivers. Not a save timestamp,
    not a display string. A rename is therefore a new identity.
  - **Brand is primary everywhere.** Brand drives identity, DB directory paths and the record's
    display name; `manufacturer` becomes a second-order descriptive field, shown only when it
    differs from the brand. Evidence: WinISD's Save-Driver defaults the filename to
    `<brand> <model>.wdr`, not `<manufacturer> …`. **Measured 2026-08-04 over the 1,526 bundled
    records: `brand != manufacturer` in ZERO of them, and no record has a manufacturer without a
    brand.** So this changes no displayed name and no path today — it is correctness against the
    day the two diverge, and cannot be validated by diffing output. The `manufacturer=Parts
Express / brand=GRS` example does not hold: GRS records carry `manufacturer: GRS` **and**
    `brand: GRS`, which agrees with the `../AGENTS.md` carve-out that PE _is_ GRS's manufacturer.
  - **A project embeds its driver.** WinISD has no driver database: its driver manager handles
    ONE driver at a time, on disk, disconnected from any open project. Selecting a driver COPIES
    it into the project. The Driver panel's edit button edits **the project's copy**, never a
    global definition and never the library record.
  - **No write-back from the project to My Drivers.** Editing a project's driver touches the
    project's copy only; My Drivers changes solely through an explicit Save. The
    `acceptDriverEdit()` write-back and its `_savedAt` key are removed. Stated consequence: after
    editing the model, the picker does NOT list the new name until the driver is saved — correct
    behaviour under the embed model, not a bug.
  - **"Use" goes straight to the project**, not to the driver editor.
  - **My Drivers is a separate bucket** in the application-level store, keyed by the same
    `<brand>/<model-slug>` identity.
  - **Save overwrites the entry holding the resulting identity, and adds one when none does.**
    A driver IS its `<brand>/<model>`, so editing brand or model saves a NEW driver; editing
    anything else updates that driver in place.
  - **Clone forks with `brand = <old brand>`, `model = "Copy of " + <old model>`** — already a
    distinct identity, which the user can then rename or leave as it is.
  - **The driver editor gets a "Copy to My Drivers" button.** It copies the driver being edited
    into My Drivers as a DISCONNECTED copy — no link back — and does so regardless of whether the
    editor was opened on the project's driver or on an entry from the My Drivers list.
  - **The editor's window title says which driver is being edited** — "Edit Project's Driver" vs
    "Edit My Driver". ⚠ Only the first is reachable today: the editor always seeds from the
    project's driver, so the second title needs an invocation path from the My Drivers list that
    does not exist yet. Build the title now, build that path with the My-Drivers-editing feature.
  - **Deleting a saved driver must work and be findable.** A per-row `✕` exists in both pickers
    (`.my-del` → `deleteMyDriver`), so the gap is that it either does not work or is not
    discoverable. It provably did NOT work for an entry with no explicit `name`: the filter
    compared `d.name !== name`, which never matched when both were empty. Deletion keys off the
    driver's identity, like everything else here.
  - **⚠ CROSS-REPO (winisd_tools) — the DB directory path derives from BRAND**,
    `<brand-derived>/<model-slug>`, in scraper code AND documentation. Emitted paths do not
    change today (`dayton-audio/pro-8` stays `dayton-audio/pro-8`) because `brand ==
manufacturer` for the DB's records; what changes is which field is authoritative, so the path
    stays correct when the two ever diverge.
  - **⚠ CROSS-REPO (winisd_tools) — the record's display/model name is built from
    `<brand> <model>`**, with `manufacturer` demoted to second-order. **Records are to be
    regenerated** once this lands — read the `regenerate-records` skill before running anything
    that writes records.

- [ ] **Stop reading `.wdr` in the app; the app reads `openisd.yml` only. Reimplement the
      yml→wdr writer as a shared JS lib, called on-demand by the UI's Save-As and, as a subprocess,
      by the Python scraper pipeline.** Design decision (human, 2026-07-31): `.wdr` is WinISD's
      format, not OpenISD's. Its only legitimate purpose is letting a design be opened in classic
      WinISD — that is a UI export concern, not something the app or its data pipeline needs to
      carry as a stored, checked-in artifact. Concretely:
  - The disk loader and the driver browser stop treating `.wdr` as a source of driver data.
    `openisd.yml` is the only record read. (The bundler is done: it reads `openisd.yml`/
    `.owdr` records only and never `.wdr`. Still outstanding here: the federated-GitHub path,
    which fetches `.wdr` from third-party repos, and a build-time `.wdr` → `.owdr` converter
    so a collection stored as `.wdr` can be bundled at all.)
  - `.wdr` is generated ONLY on demand, when the user does Save-As → WinISD driver, by calling
    a JS `ymlToWdr()`/equivalent lib function — not by reading a pre-baked file off disk.
  - `winisd_tools`'s scraper pipeline (`scrapers/scrapers/lib/rebuild_wdr.py`) currently
    reimplements this conversion in Python. It must NOT keep two independent implementations
    of the same yml→wdr mapping (see the `Rme` formula divergence already found between
    `model_wdr.py` and `driver.ts` this session — same failure mode, different field). Instead
    the Python pipeline calls the JS lib's `ymlToWdr()` through the same embedded V8 runtime
    (`mini-racer`) used for all other Python→JS calc calls — not a subprocess, not a CLI — so
    there is exactly one implementation and one bridge.
  - See [PLAN_JS_CALC_CONSOLIDATION.md](http://localhost:8000/winisd/openisd/docs/plans/PLAN_JS_CALC_CONSOLIDATION.md#L1)
    for the calc half of this ruling (TODO.md QT39). `.owdr` and `openisd.yml` are the same
    schema per [ARCHITECTURE.md AD-8](http://localhost:8000/winisd/openisd/ARCHITECTURE.md#L400-L406) —
    line 32 above is accurate.
  - The bridge (embedded V8 via `mini-racer`, not a Node CLI) and the math API it shares with
    this call are specified in
    [MATH_MIGRATION.md §6 / §9.2](http://localhost:8000/winisd/openisd/docs/plans/MATH_MIGRATION.md#L474-L491),
    which also covers precision-propagation parity and the full retirement/testing plan.
  - **Same pattern, other direction (human, 2026-07-31, `ARCHITECTURE.md` AD-8):**
    `openisd.yml` itself is read and written EXCLUSIVELY by this JS/TS code, never by Python.
    When `winisd_tools` needs an `openisd.yml` produced from a `driver.yml`, it invokes the
    JS/TS side via an API (shape TBD, same subprocess pattern as above) taking two arguments
    — the input `driver.yml` path and the output `openisd.yml` path — rather than writing one
    itself. One implementation of `driver.yml → openisd.yml`, one of `openisd.yml → .wdr`,
    each owned by JS/TS and invoked externally by Python, not duplicated per language.
  - Scope note: this is a design/architecture task, not yet planned in detail — needs its own
    plan for the JS lib's package location, its CLI entry point, and what `rebuild_wdr.py`'s
    subprocess call looks like, before implementation starts.
  - **The concrete cost of the two implementations, measured 2026-08-13 (human direction: this is
    the reason `winisd_tools` must call the TS implementation).** 245 of 1622 library `.wdr` files
    carry `Gloss = 0` despite holding the inputs to derive it. The ADT reads the carried `Gloss=`
    line as ENTERED and backfills `0` when the key is absent, so a stale zero blocks the
    derivation. It cannot simply leave the carried set — WinISD legitimately marks `Gloss` as `E`
    in 4 oracle files — and the principled fix, honouring `ParState` slot 37, breaks an
    oracle-backed round-trip test. `SPLmaxLF` and `Mcost` are unaffected: neither is a carried key.
    The Python writer is what put those zeros in the records, so the fix belongs with the export
    re-architecture, not in a patch to the reader.
  - **Two dependent tasks, both blocked on this landing:** the record regeneration that clears
    those 245 stale zeros (do not run it twice — fold it into this change), and the
    re-architecture of `.wdr` export in `winisd_tools` so the Python side owns no mapping of its
    own. `manufacturer`'s definition string is a second instance of the same shape: a value the
    Python side serialises into all 1912 records, wrong, and only fixable by regenerating.

- [ ] **Bookmarkable URL — UI state must live in the URL (reported broken).** The URL should be bookmarkable so that reopening it restores the full UI state (driver, box type, params, graph selection, comparisons). User reports this does **not** work today. Note the contradiction to resolve first: two "Shipped ✓" / Storage entries below already mark **URL-encoded designs** as implemented **and** `[ui]`-tested (`[x] [x] … no server needed [ui]`). So before building anything, **reproduce**: does the URL update as UI state changes, and does pasting that URL into a fresh tab restore that state? If it regressed, the existing `[ui]` test is not catching it — fix the test too. If it never covered bookmarkability (e.g. URL only updates on an explicit "share" action, not live as state changes), that gap is the actual feature. Distinguish "shareable link on demand" from "the address bar always reflects current state so a browser bookmark just works." The user wants the latter.

- [ ] **Max-SPL/Power when BOTH Xmax and Pe are missing** — with neither limit, the max curve is genuinely undefined (currently +∞). Treat it as a "chart issue": show the missing-limit message instead of drawing an unbounded curve. Follow-up to the Xmax=0 fix (which handled Xmax-absent-with-Pe-present).

- [ ] **Classic-skin Color swatch is inert — wire it to a real per-design colour.** The "Color" control in the classic (WinISD) skin's Project rail (`ClassicShell.vue`, `.cl-color`) is a static yellow-green swatch (`WINISD_TRACE`), not a picker — no click handler, no `<input type="color">`. WinISD's Color button opens a chooser and sets the current design's trace colour on the graph. There is no colour-picker component anywhere in the app yet. Add a real control (native `<input type="color">` is enough) that writes a per-design colour into the store and threads it into the trace (replacing the hardcoded `WINISD_TRACE` constant) and the Color swatch itself. `[ui]`

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
fixtures cover all box types, the engine/UI contract is specified in
[`docs/spec/SPEC_ENGINE.md`](docs/spec/SPEC_ENGINE.md) and
[`docs/spec/SPEC_UI.md`](docs/spec/SPEC_UI.md), per-module unit tests exist, the Vue UI
consumes only the public contract, and Playwright + CI are both live. The description below
is preserved for history.

> ~~OpenISD is a spike: logic is one inline script in `index.html`, "verified" by a
> self-test that string-slices the engine out and `eval`s it, with no real UI tests.~~
> Completed.

Oracles: [`docs/research/REFERENCES.md`](docs/research/REFERENCES.md).

- [x] [x] **P0 · Phase 0** Golden-master fixtures: freeze current sweep outputs for
      every box type, assert equality — the net that proves extraction preserves
      behaviour, before any code moves. `[unit]`
- [x] [x] **P0 · Phase 1** Extract the core (`complex`, `driver`, `wdr`, `circuit`,
      `sweep`, `alignments`, `filters`) into `packages/engine/src/*.js` — no DOM — one module
      at a time, **extracting not rewriting**. `[unit]`
- [x] [x] **P0 · Phase 2** Define & version the `Design → Curves` contract
      ([`docs/spec/SPEC_ENGINE.md`](docs/spec/SPEC_ENGINE.md),
      [`docs/spec/SPEC_UI.md`](docs/spec/SPEC_UI.md)) — the documented API third-party UIs
      depend on. `[unit]`
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

- [ ] **Implement the remaining unticked chart types below**, built from the WinISD findings in
      `../winisd_research`. **Do not build a chart while unknowns remain** — raise it with the
      human and do more research first.

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

- [ ] **P1 — ALIGNMENT-DRIVEN BOX SIZING (missing feature, not a defect).** WinISD calculates
      box volume and tuning from (1) driver type, (2) box type, (3) alignment — QB3, BB4, SBB4,
      C4 … — i.e. the Thiele/Small alignment tables: given the driver's `Qts`/`Vas`/`Fs` and a
      named alignment, `Vb` and `Fb` follow. OpenISD has none of this; `prototypeBox()`
      (`packages/model/src/openisdProject.ts`) writes invented literals into all four alignments
      at once. Also: WinISD's default vent is 4″ (0.102 m) not OpenISD's 0.05 m, and vent LENGTH
      is read-only/derived where OpenISD treats it as the input and derives tuning from it.
      **Requires reverse-engineering first** — how WinISD initialises project attributes from
      the wizard's selections is not known. Probe it with the wine harness across at least three
      drivers of differing `Qts`, per the matrix specified in the bug; do not implement from a
      textbook alignment table and assume WinISD agrees.
      NOT in conflict with E.2 (b) below: WinISD has alignment selection in the NEW PROJECT
      WIZARD but none inside an open project, so OpenISD can have BOTH — creation-time
      initialisation (this item) and the in-project alignment tool it already has.
      `bugs/BUG_20260821_new_project_invents_box_and_vent_values_instead_of_asking_the_user.md`.

Gaps found by auditing the WinISD 0.7.0.950 screenshots against OpenISD's UI —
full evidence table in [`docs/research/WINISD_PARITY.md`](docs/research/WINISD_PARITY.md).

- [ ] **P1** Environment model — derive `c`/`ρ` from **temperature / humidity / air pressure** (per-project + app default), replacing the single hardcoded constant. WinISD: Advanced pane.
- [ ] **P1** Off-axis **listening angle** + configurable **distance** (OpenISD is fixed 1 m on-axis). WinISD: Signal pane.
- [ ] **P1** Filters OpenISD lacks: **all-pass, raised-cosine delay, static gain**, high/low **shelf**. WinISD: Filters.
- [ ] **P2** Driver fields OpenISD lacks: **Xlim**, **USPL**; figure-of-merit read-outs (Rme, gamma, Mpow, Mcost, SPLmax). WinISD: Parameters/Advanced tabs.
- [ ] **P2** Charts OpenISD lacks: **amplifier apparent load power (VA)**, port **gain** (vs velocity), intrachamber port velocity (needs 6th-order BP).
- [ ] **P2** Loading/model options: **isobaric (Iso-Barik)**, **transmission-line port**, **force-flat response**, **Rg-at-driver-side**, **SPL-graph-Xmax-limited**.
- [ ] **P2** Driver **added mass to cone** (WinISD has it for the driver, not just the PR).
- [ ] **P3** Metric ↔ imperial **unit switching** (OpenISD is metric-only).

- [ ] **GAPS.md section F — 11 ranked WinISD-parity fixes, moved from QO24 (openisd
      ledger).** Full evidence tier (live / derived / open) and exact `file:line` for each is in
      `winisd_research/GAPS.md` section F — read it before starting any item, do not re-derive.
  - [ ] **A3.** Bind the PR pane's `Fh` to `prTuning()` — screen and file currently disagree
        (72.25 vs 194.87 Hz).
  - [ ] **A7.** Default end correction to `0.6` (WinISD's own value), allow free numeric entry —
        the shipped default `0.732` misses vent length by 4.6%.
  - [ ] **E.2 (a).** Delete the "`.wpr` is binary, needs reverse-engineering" claim — it is plain
        INI and a serialiser already ships; the claim has parked import as a hard job.
  - [ ] **E.2 (b).** Narrow the QB3 alignment row to "no IN-PROJECT alignment tool" — WinISD has
        none for a design already open, so OpenISD is ahead there and its buttons stay. It DOES
        have alignment selection in the New Project wizard (John, 2026-08-21), so a flat "no
        alignment tool" would be wrong. See the P1 item at the top of this section.
  - [ ] **A5.** Implement `Rme`, `gamma`, `Mpow` from the pinned formulas. The rest of this item
        is **superseded**: `Mcost`, `Gloss`, `SPLmaxLF` are already correctly calculated
        (`packages/engine/src/driver.ts:323,332,344`, confirmed 2026-08-17) — they were never
        pass-through. What IS still a total gap, found the same day: the `DVol`/`Depth`/
        `MagDepth`/`Magnet` geometry relation has zero implementation, see
        `bugs/BUG_20260817_dvol_relation_is_fully_documented_but_zero_percent_implemented.md`.
  - [ ] **E.3.** Clear the six stale rows in `INPUT_PARITY.md` and `WINISD_OPENISD_COMPARISON.md`
        that mark shipped features as missing.
  - [ ] **A1.** Reverse the vented direction — `Fb` entered, vent length solved via
        `ventLength()`, per chamber. Highest-value item; surfaces `ventLength`'s hidden 5mm
        clamp.
  - [ ] **A6.** Wire humidity and pressure per the QO7 ruling, surface air density beside sound
        velocity.
  - [ ] **E.4.** Re-mark the six "assumed" alignment rows as untested — "assumed" reads as a weak
        yes, and one such row (QB3) turned out to be a confident no.
  - [ ] **D.** One confirming live run for the Signal-pane Power/Voltage/Rg cascade — `Rg` is
        absent from the power formula; the 4.0→3.9 shift is a display-rounding round-trip.
  - [ ] **A4 — LARGE, blocked.** Make the driver editor a group solver rather than a fixed
        substitution chain. Do NOT start until the probe campaign in
        `winisd_research/PROMPT_solver_probe_campaign.md` has run — GAPS.md A4 states explicitly
        "do not copy the numbers": the Re/Rms/Cms recompute residuals (~1.3%) are real and
        unexplained (`DISCOVERIES.md` BUG-006), so the group-solve BEHAVIOUR is the spec, not
        WinISD's exact outputs.

## Enclosure types & box model

- [x] [ ] **P1** Absorption / fill loss `Qa` (complete the Ql / Qa / Qp loss set)
- [ ] **P2** 6th-order bandpass (both chambers ported) — extend the 4th-order branch. Two distinct alignments to support, as exposed by SpeakerBoxLite: **parallel** (both ports vent to the outside) and **series** (chambers coupled through a shared port).
- [ ] **P3 — blocked on a spec.** ABC alignment. `BoxType` (`packages/engine/src/types.ts:125`) has no `'abc'` member and nothing in the repo says what fields an ABC alignment holds — this needs a human spec (what parameters, what topology) before it can be modelled at all. From QO44.
- [ ] **P2** `ManagedOpenISDProject.setFrcHz()` (`packages/ui/src/logic/managedProject.ts:391`) is a stub — its `value` parameter is discarded (`_value`), it only calls `#notify()`. Rear-chamber tuning target has no field/home on the domain model yet for bandpass6/ABC. Give it a real backing field once bandpass6 (P2 above) or ABC (P3 above) lands, then drop the `_` prefix and wire the value through.
- [ ] **P2** Isobaric / compound loading
- [ ] **P2** Aperiodic (resistive vent) loading
- [ ] **P3** Transmission line / quarter-wave (line length + stuffing)
- [ ] **P3** Horn / waveguide (throat, mouth, flare)

## Vents & ports

- [x] [x] **P0** WinISD direction for the vented box — tuning entered, vent length solved.
      `UiParams.entered` stores which vent-group member the user typed and
      `composables/useVentGroup.ts` solves the rest, so changing the vent diameter moves the
      LENGTH and holds the tuning (WinISD's behaviour) while entering a length instead makes
      the tuning the solved member. Restores are adopted verbatim — re-solving on restore
      breaks STATE_MODEL.md rule 3. `[unit]` `vent-group.test.ts`
- [ ] **P1** **Fb is a TARGET input — label it "Target Tuning Freq" and say what it drives.**
      Human ruling (QO11): Fb is not a system output to be pinned, it is the target the port
      solver designs to. The plumbing already matches the ruling — `OriginalShell.vue:157`
      `fbEntered` writes through `enterVentField('Fb', v)`, and `useVentGroup.ts:85` solves
      `ventL = ventLength(V, P.Fb, Sp, P.endCorrection)`; `vent-group.test.ts:59` asserts an
      entered tuning is never rewritten and the length absorbs a diameter change (10/10 pass).
      What is missing is the presentation:
  - Rename the field to **"Target Tuning Freq"**. It currently reads `Tuning freq (Fb)`
    (`OriginalShell.vue:1011`, `:1012`) and `Tuning freq` / `Tuning freq (Ffc)` (`:1049`,
    `:1054`). No occurrence of "Target Tuning" exists anywhere under `packages/ui/src`.
  - Add a tooltip on that field explaining it drives the PORT DIMENSIONS calculation. Those
    rows carry no `title` and no `<HelpTip>`, and `NumInput.vue` renders no tooltip of its
    own, so the field has none at all. The registry description
    (`fieldRegistry.ts:96`, `'Box tuning frequency (WinISD "Fh"). WinISD shows 2 dp…'`)
    never mentions the port, so it is not usable as-is.
  - Fix two defects in the same registry entry while there: `fieldRegistry.ts:93` labels Fb
    `'Fh (tuning frequency)'`, borrowing the symbol the PR / rear-chamber resonance already
    owns (`OriginalShell.vue:1018`, `BoxPanel.vue:118`); and `:94` declares
    `provenance: 'calculated'`, which contradicts both `store.ts:38` (ships `Fb: true` in the
    default entered set) and the ruling that Fb is an input.
  - Modern skin only: `BoxPanel.vue:144` renders Fb as a read-only span
    (`Fb ≈ {{ fb.toFixed(1) }} Hz`) with no input, and its vent block has no "length is
    calculated to meet the target tuning" hint. The Original Vents pane already carries that
    sentence (`OriginalShell.vue:1267`) and Original is the default skin (`skins.ts`
    `resolveSkin`), so this is a secondary-skin gap, not a shipping-path one.
- [ ] **P1** Multiple vents (1–4) sharing the tuning
- [ ] **P1** Slot / rectangular vents (in addition to round)
- [ ] **P1** Selectable end-correction (free/flanged combinations, custom value)
- [ ] **P2** Drag-to-adjust Vb / Fb directly on a graph, with lock-one
- [ ] **P2** **Vent solver — pin any subset, solve the rest (OpenISD-only; WinISD has nothing
      like it).** Beyond the fixed direction above: let the user pin any combination of `Vb`,
      `Fb`, port shape (round `d`, or slot `W`×`H`), length `L` and peak port velocity, and
      solve whatever is left. The mechanism already exists — `entered` + `useVentGroup` — so
      this is a UI for choosing the set, not new state. Reuse the driver editor's
      Entered/Calculated/Not-available colours, plus a line of help text naming what is under-
      or over-determined.
      **Two tiers, and they are not the same problem.** Tier 1 — `Vb`, `Sp`, `L`, `Fb` — is
      one closed-form relation, solvable on every keystroke (shipped). Tier 2 — port velocity
      — is **not** algebraic with the others: it depends on volume velocity at a given
      frequency and drive level, so it needs root-finding over the sweep, i.e. a deliberate
      "solve" action rather than live recompute.
      **Prefer a feasible-region chart over solving for a velocity target.** Chuffing is a
      soft constraint (a region to stay inside), not a value to aim at, so a `d` vs `L` plot
      with the sub-threshold region shaded and iso-`Fb` curves crossing it says more than a
      solved number — and makes the trade visible: widen the port and the length grows to hold
      the same tuning. Build the chart first; treat the velocity-target solve as optional.

## Driver data & T/S

- [ ] **P1** **`clear()` stops restoring a displaced reading — becomes unconditional field deletion.**
      Ruled 2026-08-18: clearing a driver field deletes it, full stop — no automatic restore of
      whichever source's reading was winning before a manual override. `OpenISDDriver.clear()`
      (`packages/model/src/openisdDriver.ts:337-352`) currently does `entry.origin = displaced`
      when `#displaced` (line 183) names a prior non-manual origin still present in `readings`;
      that branch and `#displaced` itself are deleted. `clear()` becomes unconditionally
      `delete specs[field]` (the existing `else` branch, made the only branch) — the whole
      `_SpecEntry` for that field goes, not just the `manual` reading, so the OTHER sources'
      readings (manufacturer/distributor datasheets) are lost too, not preserved for later
      cross-source/DQ audit. Getting the value back means retyping it, or discarding the edit and
      re-picking the driver fresh from the library — never an automatic restore. See
      `bugs/BUG_20260818_managedproject_edit_draft_lifecycle_is_fully_built_but_never_called_from_the_app.md`
      for the related finding that `clear()` is currently the ONLY undo mechanism available for
      driver fields at all (the edit-draft `cancelEdit()` path is dead code, never called from
      the app).
- [ ] **P1** **Group solver — relation groups solve in every direction, with WinISD's route precedence.** Ruled 2026-08-13: _"winisd allows that Xmax back calc so Winisd wins that decision"_. WinISD is the oracle, so a group solves in whichever direction the entered data allows — `{Vd, Sd, Xmax}` yields `Xmax = Vd / Sd` as readily as `Vd = Sd · Xmax`. `solveConsistencyGroup` ([`packages/engine/src/driver.ts:46`](packages/engine/src/driver.ts)) already runs to a fixpoint and already carries both `Xmax` routes — `abs(Hc − Hg) / 2` at line 135, `Vd / Sd` at line 144 — so the formulas are not what is missing.
      **Route precedence is part of the contract, and it is what the code does not yet express.** `setVal` (line 94) writes only into a still-null field, so whichever branch is reached first wins and source order silently _is_ the precedence. Two engines with identical, correct formulas disagree on any record supplying inputs for both routes, so the order must be stated and tested rather than inherited from line numbering. `Rme` is settled: `2π·Fs·Mms/Qes` beats `BL² / Re`, measured exactly against the Beyma 10BR60_V2 fixture — 18.22124 vs 18.27846 (`winisd_research/GAPS.md` §A5).
      **`Xmax`'s order is NOT settled — re-test it in WinISD before touching the branches.** [`docs/design/WINISD_SCHEMA.md`](docs/design/WINISD_SCHEMA.md) states it twice and the two statements contradict each other: the §4 group table's row 19 (line 268) says row 20 `Vd / Sd` takes precedence and `abs(Hc − Hg) / 2` fires only when `Vd` is absent, while §4.1's tie-break table (line 310) says row 19 `abs(Hc − Hg) / 2` wins and row 20 is the last-resort fallback used only when nothing else can supply the field. One session settles it: enter `Hc`, `Hg`, `Vd` and `Sd` together with `Xmax` blank, and read which value appears. Correct the losing statement in `WINISD_SCHEMA.md` in the same change.
      **Blast radius — every record holding two members of any group's three.** Computed values move across the whole collection, so the golden fixtures move with them: expect `packages/engine/test/golden.test.ts` to go red and regenerate it with `npm run gen-golden`. A fixture diff is the expected outcome of this change, not evidence of a regression.
      **A derived value carries state `C`, never `E`.** `Xmax = Vd / Sd` claims _the excursion implied by a published `Vd`_, not _the linear limit the manufacturer measured_; the mark is what keeps those two apart — see [`ARCHITECTURE.md`](ARCHITECTURE.md#relation-groups-solve-in-every-direction) §3 "Relation groups solve in every direction".
      **Related.** `winisd_research/GAPS.md` §A4 ("the driver editor cannot express WinISD's group solve") records the same gap generally and ranks it item 11 in its §F table. The side-by-side parity suite (ledger QO8) must drop its expectation of an `Xmax` divergence — openisd matches WinISD here.
- [ ] **P1** Guided parameter entry — step-by-step flow following the WinISD-recommended order (Mms+Cms → Sd+BL+Re → Qms → Hc/Hg/Pe → numVC → Znom). Each step shows which fields to fill, why they matter, and what WinISD computes from them. Minimum viable path (Qts+Vas+Fs) clearly signposted. WinISD gives you a blank form with no guidance; this should be meaningfully better.
- [ ] **P1** Paste raw datasheet text → infer T/S parameters
- [x] [x] **P1** In-app driver database search / filter (by size, brand, parameters) `[ui]`
- [ ] **P1** "Duplicate / copy from" an existing driver to speed manual entry
- [ ] **P1** WDR writer: when OpenISD writes `.wdr` files, write `VCCon=2` for series wiring — the scraper always writes `VCCon=1` (correct for parallel/single-VC), but the full writer must emit the correct value. WinISD has a save bug and always writes 1; OpenISD should not replicate that bug. See
      [`docs/research/WINISD_PARITY.md` §12](docs/research/WINISD_PARITY.md).
- [ ] **P2** WinISD `.wpr` project import — format is decoded (INI sections:
      ProjectInfo, Driver, Box, Vent*, PassiveRadiator, SignalSource, Filters)
- [ ] **P2** Unibox spreadsheet import
- [ ] **P3** Import measured traces (SPL / impedance / ZMA / FRD)
- [ ] **P3** Physical dimension extraction — Thick, Depth, MagDepth, Magnet, Basket, Outer, Vcd appear as text in some datasheets and as engineering drawings in most. Extracting them would let OpenISD compute DVol (driver displacement volume) and display baffle cutout dimensions alongside the box design. Requires PDF/image parsing per manufacturer drawing conventions.

## Alignments & helpers

- [ ] **P1** **BIG ITEM, not needing work at the moment (human, 2026-08-21, closing QO64: "big
      item not needing work atm").** **Alignment selection in New Project wizard AND changeable
      from the tabs (WinISD parity).** Full ruled scope in the QO64 ledger answer: driver → box
      type → alignment → calculated Vb/Fb, only the chosen alignment configured; vent seeded
      4 in / 0.732 with LENGTH derived read-only (ventL reads C, Fb reads E on a new project);
      PR arm offers library-select OR from-scratch entry; formulas pinned by the wine-harness
      reverse-engineering campaign in
      `bugs/BUG_20260821_new_project_invents_box_and_vent_values_instead_of_asking_the_user.md`
      FIRST — never implemented from textbook tables on the assumption WinISD agrees.
      WinISD's new-project wizard asks for an alignment (sealed: Butterworth/Bessel/Chebyshev/critically-damped by target Qtc; vented: QB3/SBB4/SC4/B4/…) and seeds Vb/Fb from it. OpenISD's
      `OgNewProject.vue` has no alignment step at all, and the Box tab exposes only one-shot
      suggest buttons (QB3-or-B4 via `ventedAlignment()`, B2 via `sealedFromQtc()` in
      `BoxPanel.vue`). Required: an alignment picker in the New Project wizard that seeds the
      box parameters, plus the same picker on the box/tuning tabs so the alignment can be
      re-applied or switched after the project exists — selecting one recomputes Vb (and Fb +
      vent length for vented) for the current driver; subsequent manual edits to Vb/Fb mean the
      project is no longer "on" that alignment, matching WinISD's behaviour.
      Measured ground truth for the closed-box route (the 9-item Qtc list, default 0.707, and
      the exact Vb/Fr each choice produces): `winisd_research/CLOSED_BOX_SIM.md` (2026-08-09).

- [ ] **P1** **EBP-based box-type recommendation in the New Project flow — and it must SAY so.**
      WinISD's wizard silently pre-selects the box type from the driver's Efficiency Bandwidth
      Product (EBP = Fs/Qes; measured 2026-08-09: the Epique E150HE-44 at EBP≈89 arrived with
      `Vented` pre-selected, and the box-type page prints the EBP — see
      `winisd_research/CLOSED_BOX_SIM.md`). The recommendation itself is good; the silence is
      the defect — the human ruled they had no idea WinISD was even making a recommendation.
      openisd's new-project flow gets the same feature done openly: show the computed EBP, the
      suggested box type, and one sentence of why ("EBP 89 — above ~90 favours vented, below
      ~50 favours sealed; in between either works"), with the user free to override. WinISD's
      exact thresholds are unknown (`winisd_research/TODO.md` — flip-point probe pending);
      until measured, use the classic 50/90 rule and label it as a rule of thumb, not parity.
- [ ] **P1** Expand vented alignment presets (SBB4, EBS, Bessel, Chebyshev) alongside QB3/B4
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
- [ ] **P2** Round-trip chart view state (`OpenISDProjectJson.charts` — shared sweep
      fmin/fmax/N, per-chart Y-axis zoom) through `.owpr` export/import. Today `charts` is
      part of `OpenISDProjectJson` but stays local-only; exporting/sharing a project does not
      carry the reader's chart zoom to whoever opens the file.
- [ ] **P2** Interactive schematic / lumped-model view of the signal path
- [ ] **P2** Keyboard nudge (arrow keys) on numeric inputs
- [ ] **P2** Mobile / small-screen layout pass

## Learning & docs

- [ ] **P1** **Every automatic decision the app makes is explained in-place** (human direction
      2026-08-09). Wherever openisd computes, recommends, or pre-selects on the user's behalf
      — box-type suggestion, alignment seeding, auto-calculated driver fields, DQ marks — the
      UI states what it did and from which inputs, in visible text next to the control, not
      only a hover tooltip. Origin: WinISD's wizard pre-selects box type from EBP with no
      indication it is recommending anything; the human used it for years without knowing.
- [x] [ ] **P2** In-app parameter explanations / tooltips on inputs and curves — `title=` attributes on all controls
- [ ] **P2** "Coming from WinISD?" onboarding view — help page for WinISD users mapping each WinISD pane/control to its OpenISD equivalent, driven by the annotated screenshots in `docs/winisd_screenshots/`. Present it as a **horizontally draggable before/after image comparison slider** (a vertical splitter the user drags left/right to wipe between the WinISD screenshot and the matching OpenISD view). Sourced from `docs/research/WINISD_PARITY.md`. Also surface a short version in `README.md`.
- [ ] **P3** Open, community-editable knowledge base (T/S, box types, tuning, losses)
- [ ] **P3** Worked-example tutorial

## Quality / infrastructure

- [ ] **P1** Make the wdr round-trip leg of `scripts/roundTripGate.mjs` build-fatal. Landed
      warn-only (commit `cb84600`) because every corpus `.wdr` predates the restored bridge
      writer (winisd_tools F4 deleted the old Python `.wdr` serialiser; today's corpus is stale
      — 0/1893 pass, a sample legacy file has 38 rows vs the app's fixed 48-row table). Once
      winisd_tools' Stage 6 projection phase (`8186e1f6`) sweeps the corpus and every `.wdr` is
      bridge-generated, flip this leg to fatal alongside the openisd.yml leg — a fresh regression
      should fail the build the same way a bad openisd.yml does.
- [ ] **P1** driverRepo takes the domain object, not the JSON record — retire the
      `_OpenISDDriverJson` HUMAN_GRANTED pair in `packages/ui/test/ui/architecture.test.ts` by
      changing the repo's API to accept/return `OpenISDDriver`, keeping the JSON shape private
      to `@openisd/model`. John's ruling (2026-08-23): "allow repo to see Json class, though
      personally I would expect the API of the remote take the domain object to avoid callers
      having access to Json object too"
- [ ] **P1** Fix existing code-review / vibe-coding issues before adding new features — run `/code-review` and clear all findings first
- [ ] **P1** Enforce architecture at build time — wire ESLint plugins into `vite build` (fail build on lint errors); add `eslint-plugin-functional` (immutability), `eslint-plugin-boundaries` (module layers), `eslint-plugin-sonarjs` (complexity), `eslint-plugin-import` (no-cycle), `dependency-cruiser` (dep graph); see `docs/research/COMPETITIVE_LANDSCAPE.md`
- [ ] **P1** `scripts/` utility (+ CI step) to detect duplicate / same-model drivers as the library grows
- [ ] **P1** **Side-by-side WinISD vs openisd validation suite, with mechanically regenerable
      golden fixtures.** Same inputs into both, compare the CHARTS and the FIELD CALCULATIONS,
      fail on divergence. Today parity is asserted by hand-checked spot values; nothing
      mechanically proves openisd still matches.
  - **Scenarios required.** Humidity varied with T and p fixed (settles QO7 empirically rather
    than by back-solve — read WinISD's derived sound velocity and air density off the Advanced
    pane and prove RH moves them). Temperature 293.15 → 303.15 K at RH 30%, p 101325 (derived
    c should read ~349.51 m/s, ρ ~1.16133 if c is derived rather than fixed). Pressure varied
    alone (ρ moves, c does not). Plus a spread of ordinary alignments across sealed, vented,
    bandpass and PR, so the chart comparison is not only environmental edge cases.
  - **Fixtures are parameterised by VALUES, never by naming a driver from the database.** Encode
    each scenario as explicit T/S figures, electrical parameters and environment settings. A
    fixture that says "Dayton RS180-8" silently re-baselines itself when the scraper pipeline
    regenerates that record; one that says Fs=37.2, Qts=0.38, Vas=23.1, Re=6.4 does not.
  - **Extraction is automated via the existing win32 harness in `../winisd_research`** —
    `lib/control.py` (UI automation), `lib/probes.py` (reading values back out), `lib/wdr.py`
    (`.wdr` handling), `overnight_runner.py`, `runs/`, `screenshots/` (run scaffolding), and
    `vm/` + `vm_guest_assets/winisd_bin` (the Windows VM WinISD runs in).
  - **⚠ OPEN TECHNICAL BLOCKER — getting CURVES out as text rather than pixels.** Reading a chart
    from a screenshot is not acceptable as a golden. Establish whether WinISD can export curve
    data, or whether the harness must read the plotted series out of the control, and write down
    what was found either way.
  - **Deliverables.** (1) A scenario definition file a script can consume mechanically, one entry
    per scenario, all values explicit. (2) A generator that drives WinISD from it and writes the
    goldens as text. (3) The goldens committed as test fixtures. (4) A comparison test running
    openisd over the same scenario file and diffing against the goldens, with a stated numeric
    tolerance **and the reason for that tolerance**. (5) A README beside the fixtures giving
    exactly how they were made, which WinISD build and which harness commit produced them, what
    every parameter means, and the exact refresh command — a golden nobody can regenerate becomes
    unfalsifiable the first time it disagrees with reality.
  - **The extract is one-off; the REGENERATION must not be.** The point of encoding the scenarios
    mechanically is that a refresh is a single command, not a repeat of the manual investigation.
  - **Cross-reference QO7.** Its ruling means this suite must run with "Ignore humidity and air
    pressure (as WinISD does)" ON, or it reports a permanent ~0.07 dB divergence at 30 °C.
  - **Known deliberate divergences the suite EXPECTS rather than flags.** `numVC`'s `ParState`
    slot: openisd emits `C`, WinISD pins `E`. WinISD marks that slot `E` — entered by the human —
    on a value nobody typed (`../winisd_research/KNOWLEDGE_REPORT.md:190`, `:198`); openisd
    autofills `numVC = 1` in `Driver#derive()`
    ([`packages/winisd/src/driver.ts:432`](packages/winisd/src/driver.ts)) so the slot reads `C`.
    Ruled 2026-08-13: _"there was a winisd bug here - obvuously dont replicate that"_. A red row
    here is the suite being wrong, not the app. `Xmax` is NOT such a divergence — see the group
    solver item above.
- [ ] **P2** Share one implementation of the three physics gates between the runtime self-test and the unit suite — `packages/ui/src/diagnostics/selftest.ts:43-47` and `packages/engine/test/engine.test.ts:29-33` each declare the same driver fixture independently (Fs 37, Qts 0.38, Vas 0.030), and each reimplements the gates over it. Two declarations of one fixture drift silently. `ARCHITECTURE.md` AD-5 explains why the two test layers both exist — that stays; only the duplication goes. `[unit]`
- [x] [x] **P2** Per-feature engine tests added alongside each new box type / curve `[unit]`
- [x] **P1** ~~Driver as an ADT~~ — **DONE, AND NOW OBSOLESCENT: this item is WinISD-focused.** It framed the app's data model around `.wdr` — `enter`/`clear`/`state` over a flat WinISD-shaped bag, with a lossless `fromWdr`/`toWdrIni` round-trip as the goal. That shipped (`packages/winisd/src/driver.ts`) and killed the raw-vs-derived ParState heuristic and the lossy `parseWdr`. But `ARCHITECTURE.md` AD-8 then reversed the premise: `OpenISDDriver`/`openisd.yml` is the app's model and `.wdr` is a serialisation format generated on demand, so the class this item built is condemned rather than extended. Do not add work to it — successor plan: [`docs/plans/PLAN_OPENISD_DRIVER_MODEL.md`](docs/plans/PLAN_OPENISD_DRIVER_MODEL.md)

---

## Physical dimension extraction gap

**Priority:** P2  
**Status:** Not started  
**Type:** Feature gap / Scraper enhancement

### Problem

Scraper writes physical dimensions (Thick, Depth, MagDepth, Magnet, Basket, Outer, Vcd, DVol) as hardcoded 0.

```python
# Physical dimensions — 0 (not scraped)
lines += ["Thick=0", "Depth=0", "MagDepth=0", "Magnet=0", "Basket=0", "Outer=0", "Vcd=0", "DVol=0"]
```

These measurements are often available in datasheets (PDF dimensions section, mechanical drawings, spec tables). Currently not extracted.

### Gap

- No PDF dimension extraction implemented
- Physical measurements remain absent from WDR files
- Users cannot design enclosures that account for driver displacement volume
- WinISD users can import these; OpenISD cannot

### Known data sources

- PDF datasheets: mechanical drawings, dimension tables
- Vendor spec sheets (e.g., Parts Express, Mouser pages)
- Datasheet fields: Dia (cone diameter), Xmax (already scraped), voice coil diameter, magnet depth

### Questions for implementation

1. Which dimensions are most commonly published? (priority order)
2. How to parse dimension sections in PDFs reliably?
3. Unit handling (mm, cm, inches)?
4. Fallback: derive from other measurements (e.g., Sd → cone diameter via Sd=π(Dd/2)²)?

## Driver type classification and matching

**Priority:** P3
**Status:** Not started — design only, unverified

> ⚠ **UNVERIFIED DRAFT — for discussion only.** The rules below are written from general DIY
> and small-signal loudspeaker design understanding. No primary sources (textbooks, AES
> papers, or authoritative community references) were fetched or verified. Every threshold
> and formula should be cross-checked before this section is treated as authoritative.
> Citations are TBD. Do not implement algorithms based on the numbers here without
> verification.

Two planned features built on top of the driver record model
(`ARCHITECTURE.md` §3) and WDR schema (`docs/design/WINISD_SCHEMA.md`):

1. **Type-based filtering** in the driver browser (tweeter / midrange / woofer / subwoofer /
   passive radiator / full-range).
2. **Matching assistant** — given a loaded driver, suggest complementary drivers from the
   library (e.g. "tweeters that pair well with the DS115-8").

### Driver type classification

A driver's type is not stored in the WDR format; it must be inferred from T/S parameters.
Proposed heuristics:

| Type             | Primary criterion     | Secondary checks                           |
| ---------------- | --------------------- | ------------------------------------------ |
| Subwoofer        | Fs < 35 Hz            | Sd large, Pe > 100 W, Xmax > 10 mm         |
| Woofer           | 35 Hz ≤ Fs < 100 Hz   | Sd > 80 cm², Pe > 30 W                     |
| Mid-bass         | 100 Hz ≤ Fs < 300 Hz  | Sd 30–150 cm²                              |
| Midrange         | 300 Hz ≤ Fs < 1000 Hz | Sd 5–50 cm²                                |
| Full-range       | 80 Hz ≤ Fs < 600 Hz   | Sd small (< 40 cm²), wide usable bandwidth |
| Tweeter          | Fs ≥ 1000 Hz          | Sd < 10 cm², Pe < 50 W                     |
| Passive radiator | No voice coil         | Re = 0 or missing, no Qes                  |

Thresholds are approximate; many drivers (especially full-range) overlap multiple categories
— should be a best-guess label, not a hard gate. `Fs ≥ 1000 Hz` alone is a weak tweeter
discriminator (many dome tweeters sit at 500–1000 Hz); `Sd < 10 cm²` (small piston) is the
stronger primary criterion, `Fs` a secondary check only.

### Crossover matching rules

All rules must be satisfied simultaneously for a "good match"; passing only some flags a
"marginal match":

1. **Tweeter minimum crossover**: `f_cross_min = k × Fs_tweeter`, k = 3 minimum (some
   designers use 4). Crossing closer to Fs risks over-excursion near resonance.
2. **Woofer maximum crossover (beaming)**: onset `f_beam ≈ c / (π × Dd)`, c = 344 m/s,
   `Dd = 2 × √(Sd / π)`. ⚠ Convention-dependent — `c/(π·Dd)` (ka=1 onset) is conservative;
   `c/Dd` is ~3× higher. The choice is load-bearing.
3. **Valid crossover window**: `f_cross_min < f_cross < f_cross_max`. Negative window ⇒
   incompatible pair; window < 1 octave ⇒ "tight, requires care."
4. **Sensitivity matching**: ≤2 dB excellent, 2–4 dB good, 4–6 dB marginal (padding
   needed), >6 dB poor (large L-pad, impedance complications). ⚠ Applies at the crossover
   frequency, not 1W/1m nominal — needs full FRD data for accuracy.
5. **Power handling**: tweeter Pe should be ≥20% of total system rated power for a 2-way at
   moderate slope; higher-order filters (24 dB/oct) offer better protection. ⚠ Simplified —
   actual split depends on programme content and filter shape.

### EBP as a box-type guide

`EBP = Fs / Qes`: <50 → sealed (high Qes, better electrically damped); 50–100 → either; >100
→ vented (low Qes, benefits from port tuning). ⚠ Fast heuristic, not a modelling substitute —
a driver with EBP=110 can still work well sealed if cabinet size/extension allow.

### Passive radiator sizing rules

| Parameter | Rule                                                                                         |
| --------- | -------------------------------------------------------------------------------------------- |
| Sd (PR)   | ≥ Sd of the active driver, ideally 1.0–2.0× ⚠                                                |
| Mmd (PR)  | `Mmd ≈ (ρ₀ × c² × Sd_pr²) / (Vas × (2π×fb)²)` so PR-box resonance fb ≈ port-tuned equivalent |
| Qms (PR)  | Should be >>3 (very low mechanical loss) — a lossy PR damps the tuning peak                  |
| Fs (PR)   | Lower is better — ideally Fs_pr < fb so the PR moves freely at tuning frequency              |

### Proposed matching algorithm (future implementation)

Given a loaded driver D: classify D, compute its crossover constraint (`f_cross_max` if
woofer/mid-bass, `f_cross_min` if tweeter); for each library candidate C, classify it, skip
same-type pairs, compute the crossover window (rule 3, skip if negative), score by window
width (wider better), sensitivity delta (smaller better, fail >6 dB), and power handling; sort
by score, return top N. The algorithm deliberately does not pick the crossover frequency
itself — it reports whether a pair _can_ be crossed, not where, since that depends on room
acoustics, baffle diffraction, and filter design beyond T/S parameters alone.
