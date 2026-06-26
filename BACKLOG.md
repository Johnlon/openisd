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

---

## Shipped ✓

- Validated engine: sealed, vented, 4th-order bandpass, passive radiator
- Curves: SPL, driver + PR excursion, port velocity, group delay, impedance (mag + phase), transfer phase, max SPL, max power
- EBP gauge, Qtc / QB3-B4 alignment helpers, vent ↔ tuning solver
- Passive-radiator Fp tuning + mass auto-tune
- Multiple drivers (series / parallel)
- WinISD `.wdr` import **and** export; JSON project save/load
- In-browser self-test + CI engine test
- Published to GitHub Pages with automated CI deploy
- Vue 3 + Vite + PWA — installable, works offline via service worker
- Persist design across reloads (Ctrl-R keeps the driver) — localStorage
- Power input convention: primary input is **power (W)**, voltage derived
- URL-encoded designs — full design lives in a shareable link; no server needed
- Export / import the complete design as a JSON file

---

## P0 — Test & architecture foundation  *(do this before more features)*

Resonate is a spike: logic is one inline script in `index.html`, "verified" by a
self-test that string-slices the engine out and `eval`s it, with no real UI tests.
The aim: a decoupled, fully-tested core library that any UI (web, mobile,
third-party) can build on. **Full plan: [PLAN.md](PLAN.md)** ·
practices: [DEVELOPMENT.md](DEVELOPMENT.md) · oracles:
[references.md](references.md). **Feature work is gated on this.**

- [ ] **P0 · Phase 0** Golden-master fixtures: freeze current sweep outputs for
      every box type, assert equality — the net that proves extraction preserves
      behaviour, before any code moves.
- [ ] **P0 · Phase 1** Extract the core (`complex`, `driver`, `wdr`, `circuit`,
      `sweep`, `alignments`, `state`) into `src/core/*.js` — no DOM — one module
      at a time, **extracting not rewriting**, with the dual export (classic
      `<script src>` + `module.exports`). Go/no-go after each: opens from
      `file://` **and** `node --test` requires it.
- [ ] **P0 · Phase 2** Define & version the `Design → Curves` contract
      (`docs/CONTRACT.md`) — the documented API third-party UIs depend on.
- [ ] **P0 · Phase 3** Per-module functional tests vs tiered oracles (closed
      forms > datasheets > alignment tables > cross-tool); retire the string-slice
      hack. Verify alignment-table numbers against a primary source first.
- [ ] **P0 · Phase 4** Rebuild the Resonate UI on the core contract only.
- [ ] **P0 · Phase 5** Playwright functional tests + CI runs unit + golden +
      functional on every push / PR.
- [ ] **Research** Chrome's MCP server as a functional-test driver — evaluate vs
      Playwright for driving the real app and checking rendered canvases.
- [ ] **P1 · Phase 6** Mobile / responsive (PWA) UI as a second consumer of the
      core — proves the decoupling; deferred, not part of the foundation.
- [ ] **P1** Error visibility sized to a static client tool: global error
      boundary + a debug-log toggle (not an observability stack).
- [x] **P0** Persist design across reloads (ctrl-R keeps the driver) — localStorage
- [x] **P0** Power input convention: primary input is **power (W)**, voltage derived

---

## Signal chain & EQ  *(the curves are already complex — filters slot in cleanly)*
- [ ] **P1** Parametric (peaking) EQ — fc, Q, gain; multiple bands; applied to the transfer function
- [ ] **P1** High-shelf / low-shelf filters
- [ ] **P1** High-pass / low-pass filters (Butterworth, Bessel, Linkwitz-Riley; selectable order)
- [ ] **P1** Linkwitz transform (target Fs/Qtc)
- [ ] **P1** Series / source resistance (amp output + cabling) in the drive model
- [ ] **P1** Configurable listening distance (replace the fixed 1 m)
- [ ] **P1** Frequency-range presets (sub / woofer / wide / custom) for the plot range
- [ ] **P2** Amplifier-load graph — current and VA draw vs frequency
- [ ] **P2** Amplifier output impedance / damping-factor effect on response

## Enclosure types & box model
- [ ] **P1** Absorption / fill loss `Qa` (complete the Ql / Qa / Qp loss set)
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
- [ ] **P1** In-app driver database search / filter (by size, brand, parameters)
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
- [x] **P1** URL-encoded designs — the full design (driver, box, params, graph
      selection, comparisons) lives in a shareable link; no server needed
- [x] **P1** Export / import the complete design as a JSON file
- [ ] **P2** Optional Google Drive storage — let users save and open designs in
      their *own* Google Drive. Keeps personal storage entirely on the user's
      side with no server or accounts on ours (opt-in; nothing stored unless the
      user chooses it)
- [ ] **P3** Optional Dropbox / generic cloud storage on the same opt-in basis

## UX & platform
- [ ] **P1** Save / restore graph layout (which graphs, sizes, positions)
- [ ] **P2** Draggable / resizable graph panels
- [ ] **P2** Interactive schematic / lumped-model view of the signal path
- [ ] **P2** Configurable graph gridlines (3 / 5 / 10 dB) and contrast
- [ ] **P2** Keyboard nudge (arrow keys) on numeric inputs
- [ ] **P2** Mobile / small-screen layout pass

## Learning & docs
- [ ] **P2** In-app parameter explanations / tooltips on inputs and curves
- [ ] **P3** Open, community-editable knowledge base (T/S, box types, tuning, losses)
- [ ] **P3** Worked-example tutorial

## Quality / infrastructure
- [ ] **P1** `scripts/` utility (+ CI step) to detect duplicate / same-model drivers as the library grows
- [ ] **P2** Per-feature engine tests added alongside each new box type / curve
