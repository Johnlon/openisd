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

## Signal chain & EQ  *(the curves are already complex — filters slot in cleanly)*
- [x] [x] **P1** Parametric (peaking) EQ — fc, Q, gain; multiple bands; applied to the transfer function `[unit]`
- [ ] **P1** High-shelf / low-shelf filters
- [x] [x] **P1** High-pass / low-pass filters (Butterworth; selectable Q; Bessel/LR orders not yet exposed) `[unit]`
- [x] [x] **P1** Linkwitz transform (target Fs/Qtc) `[unit]`
- [x] [ ] **P1** Series / source resistance (amp output + cabling) in the drive model
- [ ] **P1** Configurable listening distance (replace the fixed 1 m)
- [ ] **P1** Frequency-range presets (sub / woofer / wide / custom) for the plot range
- [ ] **P2** Amplifier-load graph — current and VA draw vs frequency
- [ ] **P2** Amplifier output impedance / damping-factor effect on response

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
- [ ] **P1** Paste raw datasheet text → infer T/S parameters
- [x] [x] **P1** In-app driver database search / filter (by size, brand, parameters) `[ui]`
- [ ] **P1** "Duplicate / copy from" an existing driver to speed manual entry
- [ ] **P2** WinISD `.wpr` project import — format is decoded (INI sections:
      ProjectInfo, Driver, Box, Vent*, PassiveRadiator, SignalSource, Filters)
- [ ] **P2** Unibox spreadsheet import
- [ ] **P3** Import measured traces (SPL / impedance / ZMA / FRD)

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

## Crossover & multi-way  *(larger arc)*
- [ ] **P3** Crossover network design (1st–6th order, Butterworth / Linkwitz-Riley)
- [ ] **P3** L-pad / level matching
- [ ] **P3** Multi-driver system summation (2- and 3-way), driver offset / acoustic centre

## Storage & sharing
- [x] [x] **P1** URL-encoded designs — the full design (driver, box, params, graph
      selection, comparisons) lives in a shareable link; no server needed `[ui]`
- [x] [ ] **P1** Export / import the complete design as a JSON file
- [ ] **P2** Optional Google Drive storage — let users save and open designs in
      their *own* Google Drive. Keeps personal storage entirely on the user's
      side with no server or accounts on ours (opt-in; nothing stored unless the
      user chooses it)
- [ ] **P3** Optional Dropbox / generic cloud storage on the same opt-in basis

## UX & platform
- [x] [ ] **P1** Save / restore graph layout (which graphs, sizes, positions) — graph selection persisted in localStorage
- [ ] **P2** Draggable / resizable graph panels
- [ ] **P2** Interactive schematic / lumped-model view of the signal path
- [ ] **P2** Configurable graph gridlines (3 / 5 / 10 dB) and contrast
- [ ] **P2** Keyboard nudge (arrow keys) on numeric inputs
- [ ] **P2** Mobile / small-screen layout pass

## Learning & docs
- [x] [ ] **P2** In-app parameter explanations / tooltips on inputs and curves — `title=` attributes on all controls
- [ ] **P3** Open, community-editable knowledge base (T/S, box types, tuning, losses)
- [ ] **P3** Worked-example tutorial

## Quality / infrastructure
- [ ] **P1** `scripts/` utility (+ CI step) to detect duplicate / same-model drivers as the library grows
- [x] [x] **P2** Per-feature engine tests added alongside each new box type / curve `[unit]`
