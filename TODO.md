# Resonate — feature backlog

Working list of capabilities that make Resonate a complete, professional
enclosure-design tool. Items are described on their own terms; each notes how it
fits the existing engine so it can become a GitHub issue. Priorities are a guide,
not a contract — pick what interests you and open a PR.

**P1** = high value, tractable on today's engine · **P2** = larger but well-defined
· **P3** = big rocks (design first).

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
