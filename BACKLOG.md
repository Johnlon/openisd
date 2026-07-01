# Resonate — backlog

Working list of capabilities that make Resonate a complete, professional
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
**Test tags** — `[unit]` = logic in `src/core/` with tests in `test/`;
`[ui]` = Playwright browser automation in `test/app.browser.spec.js`.

---

## Next — do first

- [ ] **Fix `maxCurves` Xmax guard + magic sentinel** — engine calc, needs human sign-off before editing. In `packages/engine/src/sweep.js`, the line `const vXmax = (excAt283 > 0 && drv.Xmax != null) ? 2.83 * (drv.Xmax / excAt283) : 1e9;`. **Problem:** with `Xmax = 0` and the Max-SPL chart visible, `vXmax` becomes 0 → max-SPL = −∞ (garbage drawn on screen) — the "draw unreliable data" case we want gone. Not hit by current tests (the Xmax test targets the Excursion chart); pre-existing. **Fix:** change `!= null` → `> 0` (treat `Xmax = 0` as absent = no excursion limit), and replace the `1e9` magic sentinel with `Infinity` to match the `vPe` line directly below (`Pe != null ? … : Infinity`). Touches engine calculation → explicit human sign-off required per the engine-calc rule, plus a golden-master re-check (valid drivers all have `Xmax > 0`, so output must be byte-identical). Add a unit test: `Xmax = 0` + Max-SPL must produce finite values limited by Pe alone.

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

**Status: complete.** `src/core/` is fully extracted (7 modules), golden-master
fixtures cover all box types, CONTRACT.md is written and versioned, per-module unit
tests exist, the Vue UI consumes only the public contract, and Playwright + CI are
both live. The description below is preserved for history.

> ~~Resonate is a spike: logic is one inline script in `index.html`, "verified" by a
> self-test that string-slices the engine out and `eval`s it, with no real UI tests.~~
> Completed — see [PLAN.md](PLAN.md).

Full plan: [PLAN.md](PLAN.md) ·
practices: [DEVELOPMENT.md](DEVELOPMENT.md) · oracles:
[references.md](references.md).

- [x] [x] **P0 · Phase 0** Golden-master fixtures: freeze current sweep outputs for
      every box type, assert equality — the net that proves extraction preserves
      behaviour, before any code moves. `[unit]`
- [x] [x] **P0 · Phase 1** Extract the core (`complex`, `driver`, `wdr`, `circuit`,
      `sweep`, `alignments`, `filters`) into `src/core/*.js` — no DOM — one module
      at a time, **extracting not rewriting**. `[unit]`
- [x] [x] **P0 · Phase 2** Define & version the `Design → Curves` contract
      (`CONTRACT.md`) — the documented API third-party UIs depend on. `[unit]`
- [x] [x] **P0 · Phase 3** Per-module functional tests vs tiered oracles (closed
      forms > datasheets > alignment tables > cross-tool). `[unit]`
- [x] [x] **P0 · Phase 4** Rebuild the Resonate UI on the core contract only. `[ui]`
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

WinISD chart inventory mapped to Resonate status. Box-type scope notes: `[PR]` = passive radiator only · `[BP]` = 4th-order bandpass only · `[EQ]` = only when EQ/Filter is active.

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

## Enclosure types & box model

- [x] [ ] **P1** Absorption / fill loss `Qa` (complete the Ql / Qa / Qp loss set)
- [ ] **P2** 6th-order bandpass (both chambers ported) — extend the 4th-order branch
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
- [ ] **P1** WDR writer: when Resonate writes `.wdr` files, write `VCCon=2` for series wiring — the scraper always writes `VCCon=1` (correct for parallel/single-VC), but the full writer must emit the correct value. WinISD has a save bug and always writes 1; Resonate should not replicate that bug. See `WINISD.md §12`.
- [ ] **P2** WinISD `.wpr` project import — format is decoded (INI sections:
      ProjectInfo, Driver, Box, Vent*, PassiveRadiator, SignalSource, Filters)
- [ ] **P2** Unibox spreadsheet import
- [ ] **P3** Import measured traces (SPL / impedance / ZMA / FRD)
- [ ] **P3** Physical dimension extraction — Thick, Depth, MagDepth, Magnet, Basket, Outer, Vcd appear as text in some datasheets and as engineering drawings in most. Extracting them would let Resonate compute DVol (driver displacement volume) and display baffle cutout dimensions alongside the box design. Requires PDF/image parsing per manufacturer drawing conventions.

## Alignments & helpers

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
- [ ] **P2** Mobile / small-screen layout pass

## Learning & docs

- [x] [ ] **P2** In-app parameter explanations / tooltips on inputs and curves — `title=` attributes on all controls
- [ ] **P3** Open, community-editable knowledge base (T/S, box types, tuning, losses)
- [ ] **P3** Worked-example tutorial

## Quality / infrastructure

- [ ] **P1** Fix existing code-review / vibe-coding issues before adding new features — run `/code-review` and clear all findings first
- [ ] **P1** Enforce architecture at build time — wire ESLint plugins into `vite build` (fail build on lint errors); add `eslint-plugin-functional` (immutability), `eslint-plugin-boundaries` (module layers), `eslint-plugin-sonarjs` (complexity), `eslint-plugin-import` (no-cycle), `dependency-cruiser` (dep graph); Python: add `ruff` + `import-linter`; see `OTHER_TOOLS.md`
- [ ] **P1** `scripts/` utility (+ CI step) to detect duplicate / same-model drivers as the library grows
- [x] [x] **P2** Per-feature engine tests added alongside each new box type / curve `[unit]`
- [ ] **P2** Unify DQ and schema validation — single WDR parser, range bounds defined once; see `PLAN_SCRAPING.md`
- [ ] **P1** Universal value provenance in `_meta.yml` — every field becomes `[value, source_key]` with a `_sources` index; redesign `MetaModel` and scraper write path; see `PLAN_SCRAPING.md`
- [ ] **P2** Diagnose and fix sb-acoustics `specs: null` — re-run scraper; fix coaxial detection if still broken after fresh run; see `PLAN_SCRAPING.md`
- [ ] **P2** Migrate old-architecture scrapers (dayton, pe, scan-speak, sb-acoustics) to new `scripts/scrapers/scraper_lib.py` so they write `field_provenance`, `freq_low_hz`, `freq_high_hz`; see `PLAN_SCRAPING.md`
- [ ] **P3** Add `specs` extraction to scrapers where manufacturer pages publish structured non-T/S data; see `PLAN_SCRAPING.md`

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
- WinISD users can import these; Resonate cannot

### Known data sources

- PDF datasheets: mechanical drawings, dimension tables
- Vendor spec sheets (e.g., Parts Express, Mouser pages)
- Datasheet fields: Dia (cone diameter), Xmax (already scraped), voice coil diameter, magnet depth

### Questions for implementation

1. Which dimensions are most commonly published? (priority order)
2. How to parse dimension sections in PDFs reliably?
3. Unit handling (mm, cm, inches)?
4. Fallback: derive from other measurements (e.g., Sd → cone diameter via Sd=π(Dd/2)²)?
