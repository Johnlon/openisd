# OpenISD — feature comparison (consolidated)

Single consolidated feature/tool-comparison reference, created 2026-07-20 per
`../winisd_tools/brain/DESIGN_DOCS_RATIONALISATION_PLAN.md` by merging four
previously-separate docs verbatim, one section per source file:

1. [FEATURES.md](#merged-from-featuresmd-2026-07-20) — feature list + per-tool prose writeups + competitive position
2. [WINISD_OPENISD_COMPARISON.md](#merged-from-winisd_openisd_comparisonmd-2026-07-20) — WinISD parity tables + web-alternatives matrix
3. [OTHER_TOOLS.md](#merged-from-other_toolsmd-2026-07-20) — external-tool research, oracle strategy, box-type support matrix
4. [SPEAKER_TOOL_LANDSCAPE.md](#merged-from-speaker_tool_landscapemd-2026-07-20) — wide tool-landscape survey with sources

**Dedup note:** the same tools appear in several sections (WinISD, 00 Simulator,
SpeakerDesign.dev, SpeakerBoxLite, Sonella, SoundForm, LoudspeakerLab, micka.de,
lautsprechershop.de, Sine Design). Each section keeps its original angle — §1 prose
writeups, §2 comparison matrices, §3 research/oracle notes, §4 landscape survey —
the content itself has not been condensed or rewritten. In-text references to the
old filenames resolve to the sections above.

---

## Merged from FEATURES.md (2026-07-20)

# OpenISD — Feature List

The full picture of what OpenISD is and where it's going. Includes notes on
alternative tools (00 Enclosure Simulator, SpeakerDesign.dev, SpeakerBoxLite,
SoundForm) for orientation. This doubles as a backlog: if a ⬜ item appeals,
claim it in an issue.

**Legend:** ✅ done · 🔨 in progress · ⬜ planned · _“seen in X”_ = demand already
proven by another tool.

---

## Alternative tools

Good tools exist. Use whichever works best for you. These notes are for
orientation, not criticism — we record them so contributors understand the
landscape and can spot gaps worth filling.

---

### 00 Enclosure Simulator — <https://simulator.00aud.io/>

_by mbdavis · free, no login, closed source_

The most fully-developed browser-based simulator in the field as of mid-2025.
Around 65 shipped features including: amplifier-load graph, interactive
lumped-model schematic view, on-graph parametric EQ + HP/LP + Linkwitz
transform + shelf filters, URL-encoded shareable designs, imports **`.wdr`,
`.wpr`, and Unibox** spreadsheets, exports WinISD-compatible files. Has a
public voted roadmap (<https://simulator.00aud.io/roadmap>) and a WinISD
feature comparison (<https://simulator.00aud.io/compare/winisd-vs-00-simulator>).

The author has publicly pledged to open-source the code if the project ever
goes inactive. The pledge is on record; the code is not yet public.

Driver data and any design saves are not explicitly offered as open-access or
exportable in bulk.

---

### SpeakerDesign.dev — <https://speakerdesign.dev/>

_free, no login, closed source_

A broad, polished suite: guided Driver Wizard (sealed presets; vented
QB3/SBB4/EBS), Box Simulator covering the same graph set as OpenISD plus
full Ql/Qa/Qp losses, 1–4 vents (round or slot), selectable end-correction,
drag-to-adjust Vb/Fb with axis locking, frequency range presets, and
configurable listening distance. Also includes a detailed Box Calculator (six
assembly cases, driver/port/bracing/lining displacement, cut list), a
Cutlist Optimiser (bin-packing, kerf, rotate, fractional inches, PDF output),
and an open knowledge base with tutorials.

Sealed and vented only as of the survey date (bandpass, PR, and ABC listed as
coming). No `.wdr` import or export noted. Broader than OpenISD on
construction and education; roughly matched on core simulation.

---

### SpeakerBoxLite — <https://speakerboxlite.com/>

_freemium / pay-as-you-go, web + iOS + Android, closed source_

The most feature-complete tool in the field: 5,000+ drivers, transmission
line, full crossover suite, 3D enclosure builder, STL port export. A good,
well-regarded site that covers the basics of enclosure simulation clearly.

**Graph discrepancy noted:** for the same driver and box parameters, SpeakerBoxLite
can produce noticeably different curves from OpenISD (and from WinISD) on some
outputs — particularly SPL and excursion. The cause is not known. It may reflect
a difference in the transfer-function model, loss assumptions, radiation
convention, or a combination. This is an open question; anyone who diagnoses it
is encouraged to open an issue or PR with findings.

The driver database (5,000+ entries) is not made available as open-access data.
Users can export individual designs but there is no bulk export or community
commons equivalent to `drivers/`.

---

### SoundForm

_by u/BusyEntrepreneur9636 · closed beta, access by DM_
<https://www.reddit.com/r/diyaudio/comments/1snqre1/new_features_for_web_based_winisd_app/>

In closed beta as of the survey date. Crossover design and multi-driver
summation appear to be a focus. No independent testing performed.

---

### LoudspeakerLab — <https://loudspeakerlab.io/>

_free, ad-free, web-based · licensing not stated_

A different niche from OpenISD: a **full multiway system designer centred on passive-crossover
synthesis**, where the enclosure is one sub-component rather than the whole product. An
automated solver runs a multi-objective search over an ABCD-matrix circuit model, generating
many candidate topologies per driver (HP/LP 0–4th order, asymmetric slopes, L-pad/T-pad/Zobel
attenuation and R‖L/R‖C/L‖C compensation, LC/RLC trap networks) and combining them into
full-system layouts, then scoring candidates on on-axis flatness, listening window,
directivity, distortion avoidance, preference rating, simplicity, impedance and sensitivity.
Values are snapped to E-series with real parasitics. Built on a **measurement-based, CTA-2034A**
public community driver database — profiles are uploaded as **FRD / ZMA / distortion / off-axis**
files (REW/ARTA/DATS), and the app computes CTA-2034A curves, Directivity Index and a Preference
Rating with community accuracy voting. Box modelling covers **sealed and vented only** (default
B4 vented alignment, from T/S params; merged into driver FR before the solve) — **no bandpass or
passive radiator**. Crossovers can be **imported as a pasted SPICE netlist** and every design
**exports a SPICE netlist**; the schematic exports as **PNG / SVG** and plots save as images.

No WinISD `.wdr` import/export — its interchange is measurement-based (FRD/ZMA + SPICE netlist),
not the lumped-T/S format OpenISD uses — so it is **not** a drop-in cross-check oracle. Full
survey (verified by rendering the SPA with Playwright, 2026-07-05) in `OTHER_TOOLS.md §8`.

---

### Biquad Cookbook EQ Designer — <https://loudifier.github.io/Biquad-Cookbook/>

_by loudifier · free, open source, GitHub-hosted_

A focused, modern web-based EQ filter designer that complements (not replaces)
enclosure simulators. Provides 15+ filter types (1st/2nd order lowpass, highpass,
allpass, shelves, peaking EQ, bandpass, notch, Linkwitz transform) with real-time
visualization across four plot types: frequency response, phase, impulse response,
and group delay. Includes a filter optimizer that matches a target curve or flattens
a response. Saves/loads EQ configurations in YAML format. Orthogonal to OpenISD’s
scope — Biquad focuses on signal-chain EQ filter design while OpenISD simulates
enclosure acoustics. Users often chain both tools: design an enclosure in OpenISD,
then use Biquad to design corrective EQ to flatten the result.

---

> Feature notes for closed tools are taken from their own sites and authors’
> public posts, not independent testing. Treat all claims as ⚠ unverified
> unless a OpenISD contributor has directly compared outputs.

---

## 1. Enclosure types

> Cross-tool support at a glance (which of these each surveyed tool models) lives in
> `OTHER_TOOLS.md` → "Enclosure / box-type support at a glance".

- ✅ Sealed (closed box)
- ✅ Vented / ported (bass-reflex)
- ✅ 4th-order bandpass (single-ported)
- ✅ Passive radiator
- ⬜ 6th-order bandpass (both chambers ported) — _seen in 00 Enc. Sim, SpeakerBoxLite_
- ⬜ Isobaric / compound loading — _planned by 00 Sim & SpeakerDesign.dev_
- ⬜ Aperiodic (resistive vent)
- ⬜ Transmission line / quarter-wave — _seen in SpeakerBoxLite, 00 Sim roadmap_
- ⬜ Horn / waveguide — _SoundForm considering; on 00 Sim roadmap; large effort_

### Box-loss model

- ✅ Leakage loss `Ql`
- ✅ Port/vent loss `Qp`
- ⬜ Absorption / fill loss `Qa` — _full Ql/Qa/Qp set seen in SpeakerDesign.dev_

### Vent / port modelling

- ✅ Single round vent (diameter, length, area, Fb readout)
- ✅ End-correction (fixed ~0.85d)
- ⬜ Multiple vents (1–4) — _seen in SpeakerDesign.dev_
- ⬜ Slot / rectangular vents — _seen in SpeakerDesign.dev_
- ⬜ Selectable end-correction (free/flanged combos, custom) — _seen in SpeakerDesign.dev_
- ⬜ Drag-to-adjust Vb / Fb with lock-one — _seen in SpeakerDesign.dev & 00 Simulator_

## 2. Analysis & graphs

- ✅ SPL / frequency response (half-space, 1 m)
- ✅ Cone excursion (driver) vs Xmax
- ✅ Passive-radiator excursion vs PR Xmax
- ✅ Port air velocity (peak) vs chuffing limit
- ✅ Group delay
- ✅ Impedance magnitude
- ✅ Impedance phase
- ✅ Transfer-function phase
- ✅ Maximum SPL (excursion- and power-limited)
- ✅ Maximum power
- ⬜ Amplifier load — current / VA draw vs frequency — _seen in 00 Simulator_
- ⬜ Step response (impulse / time-domain)
- ✅ Overlay & compare multiple designs on one graph
- ⬜ Interactive schematic / lumped-model view — _seen in 00 Simulator_
- ⬜ Configurable graph gridlines (3/5/10 dB) and contrast

## 3. Driver & Thiele/Small handling

- ✅ Manual T/S entry, self-consistent derivation of Bl/Cms/Mms/Rms
- ✅ EBP box-type gauge
- ✅ Driver presets
- ✅ Multiple drivers (series / parallel)
- ✅ **Driver-side added mass to cone** — weight the cone to lower Fs / raise Qts (WinISD parity)
- ✅ **WinISD `.wdr` import**
- ✅ **WinISD `.wdr` export** — _00 Simulator also exports WinISD-compatible files_
- ⬜ WinISD `.wpr` project import — _00 Simulator does this; `.wpr` is plain INI text in current WinISD (sections decoded), so this is feasible_
- ⬜ Unibox spreadsheet import — _seen in 00 Simulator_

### Driver library — 2,100+ drivers, instant load

- ✅ **Pre-bundled at build time** — all local `.wdr` collections are baked into
  the app JS; no GitHub API calls, no rate limits, no spinners. The full library
  loads in the same round-trip as the page itself.
- ✅ **Federated driver sources** — `drivers/sources.json` links external `.wdr`
  repos so the community can grow the library without forking OpenISD; _no other
  surveyed tool federates its driver data_
- ✅ **In-app driver browser** — token-based multi-word search (case-insensitive,
  every word must match), pure alphabetical list, source tags with clickable links
- ✅ **Newer-version highlighting** — when the same driver exists in multiple
  collections, the entry with the latest `DateModified` is highlighted in accent
  colour; older copies are dimmed so you can see at a glance which measurement to
  trust and where it came from
- ✅ **Date normalisation** — dates from different sources and manual entries
  are canonicalised to `YYYY-MM-DD` for consistent display regardless of origin
- ✅ **SpeakerBoxLite opt-in** — one click loads ~6,000 community measurements
  from speakerboxlite.com on top of the bundled library (fetched live, CORS-permitting)
- ✅ **Paste any GitHub repo** — add a custom `owner/repo` or full GitHub URL to
  pull `.wdr` files from any public repository in the browser

### Driver data pipeline — automated, external

The larger collections below are produced by an automated fetch/extract/quality-check
pipeline that lives in the sibling [`winisd_tools`](../winisd_tools) repo, writing into
[`winisd_drivers`](../winisd_drivers) — see [`drivers/README.md`](drivers/README.md)
for how OpenISD federates that data in.

- ✅ **SB Acoustics** — 194 drivers, including the full Satori and SB series, with
  datasheet URLs in machine-readable `_meta.yml`
- ✅ **Parts Express** — 1,509 drivers; T/S parameters taken directly from the PE
  datasheet fields (not keyed by hand)
- 🔨 **SoundImports** — European multi-brand distributor; coverage growing
  (Accuton, HiVi, Faital, Morel, ScanSpeak, Seas, Satori, Wavecor, …)
- ⬜ **Wavecor**, **Dayton Audio** — pending full coverage
- ✅ **Meta file standard** — every automated `.wdr` gets a `_meta.yml` with
  quality grade (`M` = machine-derived, unverified), datasheet URL, and
  provenance so human reviewers know exactly where each number came from
- ✅ **WDR schema documentation** (`WDR_SCHEMA.md`) — canonical field names,
  SI units, common mistakes table, date semantics, quality review workflow; the
  single source of truth for data-pipeline authors and human contributors
- ⬜ Filter drivers by size / params; richer metadata index — _SpeakerBoxLite has 5,000+ / 300+ brands in one DB_
- ⬜ Paste raw datasheet text → infer T/S params — _seen in 00 Simulator_
- ⬜ “Copy from” an existing driver — _seen in 00 Simulator_
- ⬜ Import other formats (SPL/ZMA traces, other tools’ exports)

## 4. Electronics & signal chain

- ✅ Input drive voltage / power (editable, bidirectional W ↔ V)
- ✅ Series / source resistance (amp + cabling)
- ✅ **Voice-coil thermal power compression** — coil temp rise × resistance TC raise hot Re, so SPL sags and the impedance floor lifts at power (WinISD parity)
- ⬜ Configurable listening distance (currently fixed 1 m) — _seen in SpeakerDesign.dev, 00 Sim_
- ⬜ Frequency-range presets (sub / woofer / wide / custom) — _seen in SpeakerDesign.dev_
- ✅ EQ: parametric (peaking)
- ✅ EQ: Linkwitz transform
- ⬜ EQ: high-shelf / low-shelf — _seen in 00 Simulator_
- ✅ High-pass / low-pass filters
- ⬜ Amplifier output impedance / damping factor effect
- ⬜ Signal generator presets (sine / sweep reference levels)

## 5. Crossover & multi-way _(bigger arc)_

- ⬜ Crossover network design (1st–6th order, Butterworth / Linkwitz-Riley) — _SpeakerBoxLite; SoundForm planned_
- ⬜ L-pad / level matching — _seen in SpeakerBoxLite_
- ⬜ Multi-driver summation / system response (2- and 3-way) — _SpeakerBoxLite, SoundForm_
- ⬜ Driver offset / acoustic centre handling

## 6. Construction & woodworking output

_The clearest gap vs SoundForm and SpeakerDesign.dev — builders love this._

- ⬜ Net/gross internal volume from panel thickness (+ separate baffle thickness)
- ⬜ Driver & port displacement subtraction
- ⬜ Bracing / lining / component (xover, plate amp) volume subtraction — _seen in SpeakerDesign.dev_
- ⬜ Panel cut list + 6-panel dimension breakdown — _SoundForm, SpeakerDesign.dev, SpeakerBoxLite_
- ⬜ 3D enclosure model / assembly view — _SpeakerDesign.dev, SpeakerBoxLite (“Smart 3D Builder”)_
- ⬜ Cut-list / sheet-layout optimiser — _SpeakerDesign.dev, SpeakerBoxLite_
- ⬜ 3D-printable port export (STL) — _seen in SpeakerBoxLite_

## 7. Platform & UX

- ✅ Runs anywhere with a browser (desktop, tablet, phone), no install, no login
- ✅ **Multiple UI skins** — an **"Original"** skin faithfully recreating the WinISD 0.7 window (chrome, 8-icon toolbar, 7-tab project rail, per-box-type diagrams), plus Modern and Classic; switchable, same engine underneath
- ✅ **Refresh keeps your place** — a page reload restores the exact context (design, active tab, selected chart, and an open Tune with its uncommitted what-if)
- ✅ **Live what-if / edit model** — Tune previews changes on the charts immediately; edits commit only on Accept; a truthful Unsaved / Save / Reset bar
- ✅ Dark theme
- ✅ Hover crosshair + value readout on every graph
- ✅ Alignment helpers (Qtc target, QB3/B4 vent, PR mass auto-tune, vent↔tuning)
- ⬜ More vented alignment presets (SBB4, EBS, Bessel, Chebyshev) — _seen in SpeakerDesign.dev wizard_
- ⬜ Guided design wizard (driver → count → box type → params) — _seen in SpeakerDesign.dev_
- ⬜ Draggable / resizable graphs, pin/hide panels — _seen in 00 Simulator_
- ⬜ Accessibility pass (keyboard nav, arrow-key nudge on inputs) — _arrow-key nudge in 00 Simulator_

## 8. Data, sharing & community

- ✅ JSON project save / load
- ✅ **Federated driver data** — `drivers/sources.json` links external `.wdr`
  repos; add one via PR, no re-hosting
- ✅ **URL-encoded shareable designs** — a "Copy share link" carries the design **and** your view context (active tab + chart), so the recipient lands on the same page
- ✅ **Community contribution flow** — PR a `.wdr` file or a new source URL;
  WDR schema + meta standard documented so contributors know exactly what's expected
- ✅ Static hosting on GitHub Pages (<https://openisd.app/>)

## 9. Learning & docs

- ✅ Documented engine + conventions (`CONTRIBUTING.md`)
- ⬜ Open knowledge base — T/S params, box types, tuning, box losses — _SpeakerDesign.dev has a closed one; an **open, community-editable** one would be a first_
- ⬜ In-app explanations / tooltips on parameters and curves
- ⬜ Worked-example tutorial

## 10. Trust & validation _(OpenISD’s differentiator — no other tool surveyed does this)_

- ✅ Validated against closed-form Thiele/Small (sealed fc/Qtc < 0.03 dB)
- ✅ Passband = driver reference sensitivity; vented 24 dB/oct + twin Z-peaks
- ✅ In-browser self-test (console) on every load
- ✅ Node engine test wired into CI — physics re-proven on every push
- ✅ Open, documented model (`CONTRIBUTING.md`)

---

## Honest competitive position

The field is more advanced than “WinISD is dead” implies. **00 Simulator** is
feature-rich and actively developed. **SpeakerDesign.dev** matches OpenISD’s
graph set and exceeds it on vents and construction. **SpeakerBoxLite** is the
broadest tool (transmission line, full crossover, 5,000+ drivers) but paywalled.
On raw simulation features alone, OpenISD is mid-pack today.

But the driver library story has changed materially. OpenISD now ships with
**2,100+ bundled drivers** from SB Acoustics, Parts Express, and community
measurement collections — loaded instantly from the app bundle, not fetched from a
rate-limited API. A live data pipeline keeps that number growing. No surveyed
competitor offers an open, version-controlled, machine-readable driver commons with
automated ingestion pipelines and a human-review quality framework.

OpenISD’s defensible edges:

- **Open source, fully and permanently.** MIT-licensed, public, and forkable
  today. The code belongs to everyone who uses it.
- **Open _data_, growing.** 2,100+ drivers in a version-controlled commons, with
  an automated data pipeline adding new measurements continuously. The data carries
  quality grades, datasheet provenance, and fetch timestamps so you know exactly
  where every number came from. No closed tool opens its aggregated driver data at
  all, let alone federates it.
- **Federated, not hoarded.** Any `.wdr` repo on GitHub can be linked into
  OpenISD’s browser with one PR to `sources.json` — no re-hosting, no import
  queue. The commons grows without a central gatekeeper.
- **Provable physics.** Validated against closed-form Thiele/Small solutions,
  re-verified on every push in CI. No competitor surveyed makes this claim.
- **Truly ownerless longevity.** MIT + on disk in every clone = it cannot die,
  be paywalled, or have its driver data locked away.

## Where it needs to catch up

Construction output (volume calc, cut list, 3D), amplifier-load graph, richer
vents (multi/slot/selectable end-correction), 6th-order bandpass, `.wpr` import,
and datasheet→params paste. All tractable on the existing engine.

Note on EQ: OpenISD includes basic parametric, HP/LP, and Linkwitz-transform
filters. For detailed multi-filter EQ design and optimization, Biquad Cookbook
(open-source companion tool) provides a focused, modern UI with 15+ filter types
and automated optimization against target curves.

## Strategic framing

OpenISD’s pitch is not that it out-simulates the competition today — it doesn’t,
and we say so plainly above. The pitch is that open code _and_ open data, together,
create something that benefits the whole speaker-building world: a permanent,
vendor-neutral commons that anyone can build on, contribute to, and trust. As the
driver library grows toward 5,000+ drivers with verified provenance, that shared
foundation becomes more valuable than any single tool’s feature list.

---

## Merged from WINISD_OPENISD_COMPARISON.md (2026-07-20)

# OpenISD — Feature Comparison

This table serves two purposes:

- **Promotional** — what OpenISD offers today vs. the tools it replaces or complements.
- **Todo list** — features not yet implemented are marked 🚧 and linked to the roadmap.

Comparison is primarily against **WinISD** (the tool OpenISD is designed to replace or
extend), with notes on other tools where relevant. A separate
[Web-based alternatives](#web-based-alternatives-beyond-winisd) matrix near the end
compares OpenISD against the active browser-based competitors (00 Simulator,
SpeakerDesign.dev, SpeakerBoxLite, Sonella); see [FEATURES.md](#merged-from-featuresmd-2026-07-20) for the
per-tool prose writeups.

**Confidence markers** (WinISD column only — per the project's anti-hallucination rule):

- ✅ Confirmed — source: WINISD.md, WinISD help file, direct user observation, or a
  WinISD 0.7.0.950 screenshot in [`docs/winisd/`](docs/winisd/) (see
  [`docs/winisd/INPUT_PARITY.md`](docs/winisd/INPUT_PARITY.md) for the field-by-field
  evidence ledger tying each fact to a named screenshot)
- ⚠ Assumed — plausible but not directly verified; see WINISD.md for details
- ❌ Confirmed absent — observed directly or follows from platform constraints

---

## Platform & access

| Feature                           | OpenISD                             | WinISD                                     |
| --------------------------------- | ----------------------------------- | ------------------------------------------ |
| Runs in browser — no install      | ✅                                  | ❌ confirmed                               |
| Works on Mac and Linux            | ✅ (any browser)                    | ❌ confirmed (Windows-only app)            |
| Works offline                     | ✅ PWA / service worker             | ✅ confirmed (desktop app)                 |
| Mobile / tablet                   | ⚠ responsive layout (not optimised) | ❌ confirmed                               |
| Free to use                       | ✅                                  | ✅ confirmed (freeware)                    |
| Open source (MIT)                 | ✅                                  | ❌ confirmed (closed source, abandoned)    |
| Community-driven                  | ✅ GitHub PRs + issues              | ❌ confirmed (single vendor, now inactive) |
| Shareable design links (URL)      | ✅ hash-encoded state               | ❌ confirmed                               |
| Auto-saves state between sessions | ✅ localStorage                     | ⚠ project files only                       |

---

## Box types & simulation models

| Feature                                               | OpenISD                  | WinISD                                                                               |
| ----------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------ |
| Sealed (closed)                                       | ✅                       | ✅ confirmed                                                                         |
| Vented (bass-reflex)                                  | ✅                       | ✅ confirmed                                                                         |
| 4th-order bandpass                                    | ✅                       | ✅ confirmed                                                                         |
| 6th-order bandpass (both chambers ported)             | 🚧                       | ⚠ assumed yes                                                                        |
| Passive radiator                                      | ✅                       | ✅ confirmed                                                                         |
| Isobaric / compound loading                           | 🚧                       | ✅ confirmed — Driver tab "Iso-Barik" radio (view_1_driver…iso-barik.png)            |
| Multiple drivers (series / parallel wiring)           | ✅                       | ✅ confirmed                                                                         |
| Box loss model (Ql leakage, Qa absorption)            | ✅ default Ql=10, Qa=100 | ✅ confirmed — same defaults (WinISD help file + direct observation)                 |
| WinISD-compatible circuit model                       | ✅ (default mode)        | ✅ confirmed                                                                         |
| Full gyrator (frequency-dependent Le)                 | ✅ switchable            | ❌ confirmed — Le excluded from WinISD's acoustic circuit (WINISD.md §9)             |
| Transmission-line port model                          | 🚧                       | ✅ confirmed — Advanced "Use transmission line-model for port" (view_6_advanced.png) |
| Environment model (temp / humidity / pressure → c, ρ) | ❌ hardcoded c/ρ         | ✅ confirmed — Advanced pane derives c=343.68 m/s, ρ=1.20095 (view_6_advanced.png)   |
| Force-flat response                                   | ❌                       | ✅ confirmed — Advanced "Force flat response" toggle (view_6_advanced.png)           |
| Source-resistance placement (Rg at driver side)       | ❌                       | ✅ confirmed — Advanced "Rg is at driver side" toggle (view_6_advanced.png)          |
| Xmax-limited SPL toggle                               | ⚠ separate Max-SPL chart | ✅ confirmed — Advanced "SPL graph is Xmax limited" toggle (view_6_advanced.png)     |

---

## Simulation curves

| Feature                               | OpenISD             | WinISD                                                                                        |
| ------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------- |
| SPL (sound pressure level)            | ✅                  | ✅ confirmed                                                                                  |
| Driver excursion (Xmax)               | ✅                  | ✅ confirmed                                                                                  |
| PR excursion                          | ✅                  | ✅ confirmed — "Cone excursion (PR)" (chart_dropdown.png)                                     |
| Port air velocity                     | ✅                  | ✅ confirmed — front/rear port "Air velocity" (chart_dropdown.png)                            |
| Impedance magnitude                   | ✅                  | ✅ confirmed                                                                                  |
| Impedance phase                       | ✅                  | ✅ confirmed — "Impedance phase" (chart_dropdown.png)                                         |
| Group delay                           | ✅                  | ✅ confirmed                                                                                  |
| Transfer phase                        | ✅                  | ✅ confirmed — "Transfer function phase" (chart_dropdown.png)                                 |
| Max SPL curve (excursion-limited)     | ✅                  | ✅ confirmed — "Maximum SPL" (chart_dropdown.png)                                             |
| Max power curve (thermal-limited)     | ✅                  | ✅ confirmed — "Maximum Power" (chart_dropdown.png)                                           |
| Amplifier apparent load power (VA)    | 🚧                  | ✅ confirmed — "Amplifier apparent load power (VA)" (chart_dropdown.png)                      |
| Port "Gain" curve                     | 🚧 (velocity only)  | ✅ confirmed — front/rear port "Gain" (chart_dropdown.png)                                    |
| Compare / overlay multiple designs    | ✅ pin + overlay    | ✅ confirmed — two checked projects, two curves overlaid (view_3_ported.png) — see note below |
| Cursor with frequency / value readout | ✅                  | ✅ confirmed — header shows "38.01 Hz / −9.896 dB" readout (view_5_signal.png)                |
| Cursor peak snap                      | ✅ right-click snap | ❌ confirmed                                                                                  |
| Cursor lock and nudge                 | ✅                  | ❌ assumed                                                                                    |

> **⚠ Correction flagged — WinISD _does_ overlay multiple designs.**
> `docs/winisd/view_3_ported.png` shows two projects ("Epique15 - pr" and
> "Epique15-ported") both checked in the Projects pane with both transfer-function
> curves drawn on one graph. This contradicts the earlier "❌ confirmed (section 9)"
> claim in `WINISD.md`, which states WinISD cannot compare designs. `WINISD.md` §9
> needs correcting to match this primary evidence. OpenISD's differentiator is not
> _whether_ it overlays but _how_ (pin + overlay on a single project vs. WinISD's
> checkbox-per-project list).

---

## Signal chain & drive conditions

| Feature                              | OpenISD      | WinISD                                                                                        |
| ------------------------------------ | ------------ | --------------------------------------------------------------------------------------------- |
| Drive voltage (2.83 V IEC reference) | ✅           | ✅ confirmed — `Eg = sqrt(P × Re)`                                                            |
| Arbitrary input power / voltage      | ✅           | ✅ confirmed — Signal pane power/voltage fields (view_5_signal.png)                           |
| Series source resistance (Rs)        | ✅           | ✅ confirmed — Signal pane "Series resistance" (view_5_signal.png)                            |
| High-pass filter                     | ✅           | ✅ confirmed — Filter Editor Highpass/Butterworth (view_4_filters_edit_highpass.png)          |
| Low-pass filter                      | ✅           | ✅ confirmed — "Lowpass (Butterworth, n=2)" in filter list (view_4_filters_edit_highpass.png) |
| Linkwitz transform                   | ✅           | ✅ confirmed — filter type (view_4_filters_edit_linkwitz_transform.png)                       |
| Parametric EQ (peaking)              | ✅           | ✅ confirmed — filter type (view_4_filters_edit_parametric_eq.png)                            |
| Multiple filters in a chain          | ✅           | ✅ confirmed — filter list with Add/Delete/Modify (view_4_filters_edit_highpass.png)          |
| All-pass filter                      | ❌ (BACKLOG) | ✅ confirmed — filter type (view_4_filters_edit_allpass.png)                                  |
| DLP raised-cosine (delay) filter     | ❌ (BACKLOG) | ✅ confirmed — filter type (view_4_filters_edit_dlp_raised_cosine.png)                        |
| Static-gain filter                   | ❌ (BACKLOG) | ✅ confirmed — filter type (view_4_filters_edit_statis_gain.png)                              |
| Configurable listening distance      | ❌ fixed 1 m | ✅ confirmed — Signal pane "Distance (m)" (view_5_signal.png)                                 |
| Off-axis listening angle             | ❌           | ✅ confirmed — Signal pane "Angle (rad)" (view_5_signal.png)                                  |

---

## Alignment & design tools

| Feature                                    | OpenISD    | WinISD       |
| ------------------------------------------ | ---------- | ------------ |
| EBP (Efficiency Bandwidth Product) gauge   | ✅         | ⚠ assumed    |
| Butterworth (Qtc = 0.707) sealed auto-Vb   | ✅         | ⚠ assumed    |
| QB3 / B4 vented auto-align                 | ✅         | ✅ confirmed |
| Vent ↔ tuning frequency solver             | ✅         | ⚠ assumed    |
| PR mass auto-tune to target Fp             | ✅         | ⚠ assumed    |
| Key stats readout (F3, Qtc, Fb/Fp, peak Z) | ✅ StatBar | ⚠ assumed    |
| Baffle-step / diffraction correction       | 🚧         | ⚠ assumed    |
| Step response (inverse FFT)                | 🚧         | ⚠ assumed    |

---

## Driver & PR management

| Feature                                   | OpenISD             | WinISD                           |
| ----------------------------------------- | ------------------- | -------------------------------- |
| Built-in driver library (search / browse) | ✅ JSON, extensible | ✅ confirmed (.wdr database)     |
| Import driver from file                   | ✅ .wdr             | ✅ confirmed                     |
| Export driver to file                     | ✅ .wdr             | ✅ confirmed                     |
| Community driver contributions            | ✅ GitHub PR        | ❌ confirmed (abandoned project) |
| PR library (save / recall)                | ✅ localStorage     | ⚠ assumed limited                |
| Edit T/S parameters in-app                | ✅                  | ✅ confirmed                     |

---

## File formats

| Feature                            | OpenISD                                       | WinISD    |
| ---------------------------------- | --------------------------------------------- | --------- |
| WinISD `.wdr` driver import        | ✅                                            | ✅ native |
| WinISD `.wdr` driver export        | ✅                                            | ✅ native |
| WinISD `.wpr` project import       | 🚧 (binary format; needs reverse-engineering) | ✅ native |
| JSON project save / load           | ✅                                            | ❌        |
| Shareable URL (full state encoded) | ✅                                            | ❌        |

---

## Engineering quality & testing

| Feature                                                 | OpenISD                                 | WinISD                      |
| ------------------------------------------------------- | --------------------------------------- | --------------------------- |
| Physics validated against closed-form equations         | ✅ < 0.03 dB error                      | ❌ (closed source, unknown) |
| Automated unit tests (physics core)                     | ✅ Vitest, human-readable BDD scenarios | ❌                          |
| Golden-master regression tests (6 designs)              | ✅                                      | ❌                          |
| Browser integration tests (Playwright)                  | ✅                                      | ❌                          |
| Runtime self-test on page load                          | ✅ (console output)                     | ❌                          |
| Continuous integration (GitHub Actions)                 | ✅                                      | ❌                          |
| Pure-function physics core (DOM-free, testable in Node) | ✅                                      | ❌ (GUI-coupled)            |
| Citable references for every formula                    | ✅ JAES, Wikipedia, WinISD help         | ❌                          |

---

## Web-based alternatives (beyond WinISD)

WinISD is the incumbent, but it is discontinued (2013) and the live competition is now a
cluster of browser-based tools. This section places OpenISD against the four most relevant.

> **⚠ Confidence — read before trusting a cell.** Every non-OpenISD column below is taken
> from the tool's **own website, public roadmap, or author posts** (captured 2026-07-04),
> **not** from independent OpenISD testing. Treat all of them as ⚠ unverified until a
> contributor directly compares outputs. OpenISD's column is verified against its own source.
> Per-tool detail and sourcing: [FEATURES.md](#merged-from-featuresmd-2026-07-20) "Alternative tools".

**Markers:** ✅ yes · 🚧 partial / planned · ❌ no / absent · ⚠ unclear from public info.
The tools, briefly:

- **00 Simulator** (`simulator.00aud.io`) — the most feature-complete web sim; closest direct
  competitor. Imports `.wdr`/`.wpr`/Unibox, exports WinISD-compatible. Closed source (author
  has pledged to open-source if it goes inactive).
- **SpeakerDesign.dev** — polished box-design + construction suite (Driver Wizard, full
  Ql/Qa/Qp losses, multi-vent, cutlist optimiser). Closed source.
- **SpeakerBoxLite** — broadest tool (transmission line, full crossover, 5,000+ drivers,
  3D builder), but freemium/paywalled. Closed source and closed driver data.
- **Sonella** — guided **full-range** design app (Dayton drivers, crossover, STL). A
  different niche — beginner multi-way builds, not subwoofer simulation. Closed source.

A fifth active competitor, **SoundForm** (crossover + multi-driver summation focus), is in
closed beta with no public feature data, so it is **excluded from the matrix** rather than
filled with guesses — see [OTHER_TOOLS.md](#merged-from-other_toolsmd-2026-07-20) §7.

### Access & licensing

| Feature                       | OpenISD | 00 Simulator ⚠           | SpeakerDesign.dev ⚠ | SpeakerBoxLite ⚠     | Sonella ⚠            |
| ----------------------------- | ------- | ------------------------ | ------------------- | -------------------- | -------------------- |
| Open source                   | ✅ MIT  | ❌ (pledged if inactive) | ❌                  | ❌                   | ❌                   |
| Free, no paywall              | ✅      | ✅ (no login)            | ✅ (no login)       | ❌ freemium          | ✅ (account to save) |
| Runs in browser, zero-install | ✅      | ✅                       | ✅                  | ✅ (+ iOS / Android) | ✅                   |
| Shareable design link (URL)   | ✅      | ✅                       | ⚠                   | ⚠ (export only)      | ⚠                    |

### Box types & scope

| Feature                  | OpenISD         | 00 Simulator ⚠  | SpeakerDesign.dev ⚠ | SpeakerBoxLite ⚠ | Sonella ⚠            |
| ------------------------ | --------------- | --------------- | ------------------- | ---------------- | -------------------- |
| Sealed + vented          | ✅              | ✅              | ✅                  | ✅               | ✅                   |
| Bandpass (BP4 / BP6)     | ✅ BP4 / 🚧 BP6 | ✅ BP4 + BP6    | 🚧 coming           | ✅               | ❌                   |
| Passive radiator         | ✅              | ✅              | 🚧 coming           | ✅               | ❌                   |
| Transmission line / horn | ❌ (planned)    | ❌ "not yet"    | ❌                  | ✅ TL            | ❌                   |
| Primary scope            | subwoofer / box | subwoofer / box | subwoofer / box     | subwoofer / box  | full-range multi-way |

### Simulation & graphs

| Feature                               | OpenISD          | 00 Simulator ⚠  | SpeakerDesign.dev ⚠ | SpeakerBoxLite ⚠                               | Sonella ⚠            |
| ------------------------------------- | ---------------- | --------------- | ------------------- | ---------------------------------------------- | -------------------- |
| Core curves (SPL/excursion/Z/GD/port) | ✅ full set      | ✅              | ✅                  | ⚠ (SPL/excursion differ from OpenISD & WinISD) | 🚧 bass preview only |
| Amplifier-load graph                  | 🚧 planned       | ✅              | ❌                  | ⚠                                              | ❌                   |
| On-graph parametric EQ + HP/LP/LT     | ✅               | ✅ (+ shelves)  | ⚠                   | ⚠                                              | ✅ DSP step          |
| Compare / overlay designs             | ✅ pin + overlay | ✅ side-by-side | ⚠                   | ❌                                             | ⚠                    |
| Interactive schematic / lumped view   | ⬜               | ✅              | ❌                  | ❌                                             | ❌                   |

### Drivers, data & file formats

| Feature                       | OpenISD               | 00 Simulator ⚠      | SpeakerDesign.dev ⚠ | SpeakerBoxLite ⚠ | Sonella ⚠     |
| ----------------------------- | --------------------- | ------------------- | ------------------- | ---------------- | ------------- |
| WinISD `.wdr` import / export | ✅ / ✅               | ✅ / ✅             | ❌                  | ⚠                | ❌            |
| WinISD `.wpr` project import  | 🚧                    | ✅                  | ❌                  | ❌               | ❌            |
| Datasheet → T/S auto-infer    | ⬜                    | ✅ (paste)          | ❌                  | ⚠                | ❌            |
| Built-in driver database      | ✅ 2,100+ bundled     | ❌ (import / paste) | ⚠ personal store    | ✅ 5,000+        | ⚠ Dayton only |
| Open / federated driver data  | ✅ commons + pipeline | ❌                  | ❌                  | ❌ (closed DB)   | ❌            |

### Construction, crossover & validation

| Feature                            | OpenISD               | 00 Simulator ⚠ | SpeakerDesign.dev ⚠ | SpeakerBoxLite ⚠ | Sonella ⚠ |
| ---------------------------------- | --------------------- | -------------- | ------------------- | ---------------- | --------- |
| Cut list / panel breakdown         | ⬜                    | ❌             | ✅                  | ✅               | ✅        |
| 3D enclosure model / STL export    | ⬜                    | ❌             | ✅ 3D               | ✅ 3D + STL port | ✅ STL    |
| Crossover / multi-way summation    | ⬜                    | ❌             | ❌                  | ✅ full suite    | ✅        |
| Provable physics / open model + CI | ✅ (closed-form + CI) | ❌ (closed)    | ❌                  | ❌               | ❌        |

**Where OpenISD stands:** on raw simulation features it is mid-pack — 00 Simulator matches or
leads on graphs and format import, SpeakerDesign.dev and SpeakerBoxLite lead on construction
output, and SpeakerBoxLite alone has transmission line + full crossover. OpenISD's uncontested
edges are the ones no closed tool offers: **open source (MIT), an open + federated driver
commons (2,100+, growing via an automated data pipeline), and physics validated against
closed-form solutions in CI.** See [FEATURES.md](#merged-from-featuresmd-2026-07-20) "Honest competitive position"
for the full argument.

---

## Planned but not yet implemented (OpenISD todo)

Items not in the table above, roughly in priority order.
See [BACKLOG.md](BACKLOG.md) to claim one or discuss prioritisation.

| Feature                                   | Notes                                                      |
| ----------------------------------------- | ---------------------------------------------------------- |
| 6th-order bandpass                        | Good first issue — template already exists as 4th-order    |
| Isobaric / compound loading               | Good first issue — acoustic circuit extension              |
| Baffle-step / diffraction correction      | Well-understood model; needs a curve and a UI toggle       |
| Step response curve                       | Inverse FFT of transfer function; rendering work only      |
| `.wpr` WinISD project import              | Lazarus binary component stream; needs a sample file       |
| Mobile / small-screen layout              | Responsive CSS pass; no new physics                        |
| Measurement import (REW `.mdat`, FRD)     | Would allow measured response overlay alongside simulation |
| Impedance measurement → T/S extraction    | Closed-box or added-mass method; valuable for DIY builders |
| Multi-way SPL summation (with crossovers) | Large feature; needs crossover design first                |
| Crossover design                          | Out of scope for v1; see VituixCAD for now                 |
| Polar response / directivity              | Out of scope for v1                                        |

---

_WinISD comparison accurate as of 2026-07-04. WinISD version observed: 0.7.0.950.
WinISD confirmation sources: official help files extracted from 0.7 installer,
direct UI observation, community reports, and the annotated 0.7.0.950 screenshots in
[`docs/winisd/`](docs/winisd/) (field-by-field evidence ledger:
[`docs/winisd/INPUT_PARITY.md`](docs/winisd/INPUT_PARITY.md)).
See [WINISD.md](WINISD.md) for full citations.
Web-based-alternatives matrix captured 2026-07-04 from each tool's own site / roadmap /
author posts (⚠ unverified — no independent OpenISD testing); see [FEATURES.md](#merged-from-featuresmd-2026-07-20)._

---

## Merged from OTHER_TOOLS.md (2026-07-20)

# Research on external tools and data sources

This file documents findings, observations, and compatibility notes for tools and
data sources that OpenISD users interact with or that inform our design decisions.

---

## Enclosure / box-type support at a glance

Which enclosure (box) types each surveyed design tool can model. Compiled from the
per-tool sections below and, for OpenISD, from `FEATURES.md §1` — see each section for the
source and verification basis of its row.

**Legend:** ✅ supported · 🟡 announced / "coming" · ✖ explicitly not-yet (on roadmap) ·
— not offered · ? unknown. **BP4** = 4th-order bandpass · **BP6** = 6th-order bandpass ·
**PR** = passive radiator · **TL** = transmission line.

| Tool                       | Sealed | Vented / ported | BP4 | BP6 | PR  | TL  | Other / notes                                            |
| -------------------------- | :----: | :-------------: | :-: | :-: | :-: | :-: | -------------------------------------------------------- |
| **OpenISD** (this project) |   ✅   |       ✅        | ✅  | ⬜  | ✅  | ⬜  | BP6 + TL are backlog (`FEATURES.md §1`)                  |
| micka.de `#ideal`          |   ✅   |       ✅        |  —  |  —  |  —  |  —  | sealed/vented calculator only                            |
| SpeakerBoxLite             |   ✅   |       ✅        | ✅  | ✅  | ✅  | ✅  | BP6 both parallel & series — verified live 2026-07-04 §3 |
| SpeakerDesign.dev          |   ✅   |       ✅        | 🟡  | 🟡  | 🟡  |  —  | bandpass/PR/ABC listed as coming §4                      |
| Sonella                    |   ✅   |       ✅        |  —  |  —  |  —  |  —  | full-range + crossover focus, not subs §5                |
| 00 Audio Simulator         |   ✅   |       ✅        | ✅  | ✅  | ✅  |  ✖  | horn also ✖ "not yet" (defers to HornResp) §6            |
| LoudspeakerLab             |   ✅   |       ✅        |  —  |  —  |  —  |  —  | box subordinate to crossover; B4 default §8              |
| SoundForm                  |   ?    |        ?        |  ?  |  ?  |  ?  |  ?  | closed beta — no box data published §7                   |

OpenISD uses ⬜ (planned) for BP6 and TL to match `FEATURES.md`'s own backlog legend; every
other tool's cells are that tool's current published/observed support, not an OpenISD plan.

---

## 1. loudspeakerdatabase.com — third-party collection

**Collection:** federated from the sibling `winisd_drivers` repo's `loudspeakerdatabase/`.

**Source:** a third-party aggregator, not a manufacturer — its values are not
independently re-verified against any manufacturer source (see `winisd_drivers`'s
own `README.md`). Detailed data-quality findings for this and every other
federated collection live in the sibling `winisd_tools` repo (`SCRAPING_TODO.md`,
`DISCREPANCIES.md`).

**Use the `matt/` collection (411 real WinISD files, bundled in this repo) as the
authoritative reference** for validating WDR format or WinISD behaviour —
loudspeakerdatabase is not suitable for that.

---

## 2. WinISD parameter entry — community best practices

**Source:** mtg90 (aka "Matt") via:

- AVS Forum: https://www.avsforum.com/threads/common-sub-driver-winisd-files.2928258/
- HomeTheaterShack forum: https://www.hometheatershack.com/forums/diy-subwoofers-general-discussion/6330-winisd-pro-tutorial-download-detailed-guide-how-use-winisd-pro.html

**Authority:** mtg90 is the curator of `drivers/matt/` (411 WDR files), which are the reference collection for real WinISD behaviour. These recommendations come from the person who created that collection.

### Recommended entry sequence (proven by ~50+ drivers)

1. **Mms and Cms first** (results in Fs auto-calculated)
   - If Mms/Cms unavailable, enter Fs instead
   - **Note:** Cms units vary (meters, millimeters, micrometers); if calculated Fs is way off, try re-entering Mms+Fs and check if Cms decimal point needs adjustment
2. **Enter Sd, Bl, Re** (triggers more auto-calculations; Qms/Qts may still be blank)
3. **Enter Qms or Rms** (whichever is available; Qms more commonly published)
4. **Enter Qes** (if Mms/Cms were not provided; triggers additional auto-calculations)
5. **Enter Hc, Hg, Pe** (optional but Pe helpful for power modeling)
6. **Set voice coil count** (dual-VC drivers may auto-adjust Bl/Re; monitor when switching series/parallel)
7. **Correct Znom** (often defaults to 6Ω when it should be 2, 4, or 8Ω based on configuration)
8. **Enter Xmax and remaining fields** — **DO NOT manually change blue auto-calculated fields**

### Conflict avoidance technique

From same thread:

- Clear all fields first
- Enter Qes, Tab
- Enter Qms, Tab (multiple times to let Qts calculate)
- Tab to Mms, enter Mms, Re, Bl, Le, Sd, Xmax, Pe (tabbing after each)
- Result: No conflicts; minor rounding errors acceptable

### Minimal entry levels

From same source — three levels of completeness:

**Full entry (preferred):**

```
Qms, Mms, Cms, Re, BL, Le, Sd, Xmax, Pe
```

(Minimum required for comprehensive modeling)

**Minimalistic entry:**

```
Qes, Qms, Fs, Vas, Re, Sd, Xmax, Pe
```

**Absolute minimum (basic modeling only):**

```
Qts, Fs, Vas, Sd, Xmax, Pe
```

**Critical note:** Ensure units from datasheet match WinISD's expectations. If Cms unavailable, enter Fs OR Vas (not both).

### Key insight

Minor calculated vs. spec discrepancies are normal (rounding). Significant differences indicate:

- Wrong datasheet values
- Misidentified units
- Need to contact manufacturer

**Implication for OpenISD:**

1. The data pipeline should aim for "full entry" level (9 fields) for professional-quality WDR files
2. Understanding these levels helps validate data quality — files missing multiple core fields may be incomplete
3. Use entry order + minimal levels to understand ParState patterns in real WinISD files

---

## 3. External cross-check oracle strategy

OpenISD validates its box maths against independent calculators (oracles). This section
records the tools surveyed (2026-07-04), how integrable each is, and the **decisions** about
which to use. See `archive/PLAN_SBL_CROSSCHECK.md` for the history that led here.

### Decision summary

- **Sealed + vented:** cross-check against **micka.de** (already wired, passing) and,
  optionally, **lautsprechershop.de** as an easy second web oracle (candidate — see below).
- **Passive radiator + bandpass:** **no external web oracle is both easy to integrate and
  PR-capable.** Validate these against a **synthesized regression baseline** — OpenISD's own
  engine output, frozen as a golden fixture, with the closed-form Thiele/Small derivation and
  a literature citation in the test. ⚠ This is a **regression guard, not independent
  validation**: it catches _changes_ to our result, it does not prove the result is correct.
  The independent-correctness anchor for PR/bandpass is the primary literature (Small, JAES
  1972; Beranek, _Acoustics_), reproduced analytically in the test comments.

### Tool survey

| Tool                    | Enclosure coverage                 | Integration ease                                                                                                         | Decision                                              |
| ----------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| **micka.de**            | sealed, vented                     | Easy — server form POST, table output                                                                                    | **Adopted** (sealed/vented) — `micka-crosscheck` spec |
| **lautsprechershop.de** | sealed, vented                     | Easy — static page, **named inputs** + inline-JS `geschlossen()`, readonly output fields, no cookie banner               | **Candidate** — needs output reconciliation (below)   |
| **SpeakerBoxLite**      | sealed, vented, 4th/6th BP, PR, TL | Hard — Bootstrap-Vue SPA, unnamed fields, 2 consent overlays, results only on "Draw"                                     | **Rejected as oracle** — too slow/brittle to automate |
| **Sine Design**         | sealed, ported, bandpass, PR       | Hard — Next.js SPA, computes **client-side, no API** (verified: only `?_rsc=` route-prefetch calls, no compute endpoint) | **Rejected as oracle** — capable tool, but SPA-only   |
| **mh-audio.nl**         | sealed, vented, **PR**             | N/A — **http-only, unreachable** over HTTPS (site down / no TLS)                                                         | Not usable                                            |

Others noted but not evaluated in depth: AJ Designer, Sparked Builds, UniBox (desktop),
AudioGrid, the12volt — all web UIs, none offering a documented API.

### lautsprechershop.de — reconciliation status

`t_box_closed_en.htm` is genuinely easy to drive (`input[name="fs|vas|qts|qbvalue"]`, a
`Calculate Cabinet` button, readonly outputs `vb/f3/f8/db`). Live drive with
`fs=37, vas=30, qts=0.38, qbvalue=0.707` returned `Vb = "10 (12)"`, `f3 = 81`, `f8 = 52`,
`eff = 88 dB`. The gross **Vb ≈ 12** reconciles with micka (12.21 L) and OpenISD (12.18 L),
but **`f3 = 81 Hz` does not match** OpenISD/micka's 68.8 Hz for Qtc = 0.707 — a units/model/
compute-trigger difference that must be understood before asserting on `f3`. **Do not wire
this as a trusted oracle until that is reconciled.**

### SpeakerBoxLite — feature observations (functional gaps it exposed)

Automating SBL was abandoned, but driving it live surfaced enclosure/simulation features
OpenISD does not yet have. Recorded here and mirrored in `BACKLOG.md`:

- Enclosure types SBL has that OpenISD lacks: **6th-order bandpass — parallel _and_ series**
  (two distinct alignments; micka never surfaced the distinction) and **transmission line**.
- A first-class **box-loss input `Ql`** (SBL default 7); OpenISD's loss model is partial
  (`Qa` is a backlog item).
- Passive-radiator design helpers on a dedicated panel: PR `Fs / Vas / Qms / Sd / Added Mass`
  → computed `Fb`, plus **recommended PR area range** and **"Fb needed vs. Fb real"** read-outs.
- Port options: rectangular/round, **flared/flush end counts**, **multiple ports (1–4)**,
  port displacement volume.
- A **computation-model toggle** (simple vs. complex) and construction outputs (cutting map).

(These are functional simulation features only. UI-layout comparisons are out of scope here.)

---

## 4. SpeakerDesign.dev — WinISD-alternative toolkit

**Site:** https://speakerdesign.dev/

**Role:** A free, browser-based enclosure-design toolkit that positions its box simulator
as "the ultimate web-based WinISD alternative" — i.e. it competes in the same space as
OpenISD. Worth tracking as both a design reference and a potential cross-check oracle.

### What it offers (tool survey, 2026-07-04 — detail per `FEATURES.md`)

A broad, polished four-tool suite (client-side web app, no download, no account;
macOS/Windows/iOS/Android):

1. **Driver Wizard** — guided setup with sealed presets and vented alignments
   (QB3, SBB4, EBS).
2. **Box Simulator** — the same graph set as OpenISD, **plus** a full Ql/Qa/Qp box-loss
   model, 1–4 vents (round or slot), selectable end-correction, drag-to-adjust Vb/Fb with
   axis locking, frequency-range presets, and configurable listening distance.
3. **Box Calculator** — six assembly cases with driver/port/bracing/lining displacement and
   a cut list.
4. **Cutlist Optimiser** — bin-packing with kerf, rotation, fractional inches, PDF output.

Plus an open knowledge base with tutorials.

**Enclosure types:** sealed and vented only as of the survey; **bandpass, passive radiator,
and ABC listed as coming.** Broader than OpenISD on construction and education, roughly
matched on core simulation.

### Gaps / open questions (⚠ unverified — closed source, not output-tested)

- **No WinISD `.wdr` import or export noted** — unlike 00 Audio Simulator (§6), so it is
  **not** a drop-in driver-for-driver cross-check without manual T/S re-entry.
- Closed source; the knowledge base is closed (not community-editable).
- No API/XHR endpoint or readable computed-output panel confirmed — same oracle blocker as
  SpeakerBoxLite §3.

The Box-Calculator + Cutlist-Optimiser combination carries a design past simulation into
physical build output, which OpenISD does not yet do (see `BACKLOG.md`).

---

## 5. Sonella — guided DIY speaker-design app

**Site:** https://sonella.app/

**Role:** A browser-based, beginner-oriented **full-range speaker** design tool (explicitly
"people who build speakers," not subwoofers). Different niche from OpenISD's sub/enclosure
focus, but relevant for the guided-workflow and crossover angles OpenISD lacks.

### What the homepage states (fetched live 2026-07-04)

- **Structured 7-step guided workflow** from driver selection through build prep, aimed at
  users with no prior experience.
- **Driver selection** from "real Dayton Audio drivers" (curated database, single brand).
- **Sealed or vented** enclosure simulation using T/S parameters for bass response.
- **Crossover design** — frequencies, filter slopes, tweeter trim (OpenISD has no crossover
  modelling).
- **Room/user profile** captured via an initial questionnaire.
- **Live preview** of the bass-response curve as enclosure volume changes; **interactive 3D**
  enclosure preview.
- **Cut lists** (automatic panel dimensions) and **STL export** for CAD/3D printing.
- Client-side SPA ("all in your browser"), optional account for saving/exporting.

### Not stated on the homepage (gaps for OpenISD comparison)

- ⚠ unverified — no file **import** mentioned (export is STL only; no WinISD WDR / JSON).
- ⚠ unverified — no detailed FR plot, group delay, cone excursion, or impedance output named.
- ⚠ unverified — no API/XHR endpoint visible.
- Scope is narrower on drivers (Dayton Audio only) but broader on the build (crossover +
  full multi-way, not just the enclosure).

---

## 6. 00 Audio Simulator (simulator.00aud.io) — closest web competitor

**Site:** https://simulator.00aud.io/

**Role:** A "modern, browser-based WinISD alternative" and the closest feature-match to
OpenISD found so far — it overlaps OpenISD's core (WDR import, sealed/vented/bandpass/PR,
excursion + impedance + group delay) and exceeds it in a few areas (port velocity, on-graph
parametric EQ, side-by-side comparison). The most important tool to track.

### What the homepage states (fetched live 2026-07-04)

**Enclosure types** — sealed, bass-reflex (vented), bandpass (BP4 + BP6), passive radiator.
The feature matrix marks **transmission line and horn as "not yet"** (defers to HornResp).
This matches OpenISD's own `BoxType` coverage closely.

**Driver input** — manual T/S entry (Fs, Qts, Vas, Sd, …), **import of WinISD `.wdr`
files**, Unibox spreadsheet compatibility, and "paste a spec-sheet and auto-infer T/S
parameters".

**Outputs** — frequency-response SPL, cone excursion, impedance, **port velocity**, group
delay, plus a parametric-EQ overlay with draggable filter nodes (highpass/lowpass).
Resizable charts and **side-by-side enclosure comparison**.

**Architecture / data** — client-side SPA, zero-install, works offline after load
(Windows/macOS/iPad/mobile). Projects private by default; **shareable via explicit link
generation**. Interactive schematic signal-path visualization.

### Why this one matters most

- **It imports `.wdr`** — the same interchange format OpenISD reads/writes — so it is
  directly comparable driver-for-driver and is a strong candidate cross-check oracle for
  sealed/vented/BP/PR (the exact types OpenISD ships).
- **Port velocity and side-by-side comparison** are features OpenISD lacks (see `BACKLOG.md`).
- **Share-by-link + private-by-default** mirrors OpenISD's own save/share model.

### Not stated on the homepage (verify before relying)

- ⚠ unverified — no API/XHR endpoint mentioned (share links exist, but no documented
  programmatic interface). A network trace would be needed to confirm an oracle-friendly
  endpoint, same open question as SpeakerBoxLite §3.
- ⚠ unverified — no built-in driver **database** mentioned (entry is manual / paste / import).
- ⚠ unverified — the "auto-infer T/S from a pasted spec sheet" accuracy is unknown.

---

## 7. SoundForm — closed-beta web WinISD app

**By:** u/BusyEntrepreneur9636 ·
https://www.reddit.com/r/diyaudio/comments/1snqre1/new_features_for_web_based_winisd_app/

**Role:** Another browser-based WinISD alternative, in **closed beta** (access by DM to the
author). No public URL to fetch, so everything here is second-hand from the author's Reddit
posts — ⚠ unverified, not tested by any OpenISD contributor.

- Apparent focus: **crossover design and multi-driver (2-/3-way) summation** — the multi-way
  arc OpenISD does not cover (see `FEATURES.md §5`).
- Too little public information exists to build a feature matrix, so SoundForm is
  **deliberately excluded from the `COMPARISON.md` web-alternatives matrix** — a row of `⚠`
  guesses would be worse than none.
- Worth re-checking once it opens beyond invite; the crossover/summation focus is the same
  gap SpeakerBoxLite and (planned) OpenISD address.

---

## 8. LoudspeakerLab — automated crossover + system solver

**Site:** https://loudspeakerlab.io/ · driver DB at `/drivers`, designs at `/designs`,
FAQ at `/faq`

**Role:** A free, ad-free, browser-based tool that occupies a **different niche** from
OpenISD: it is a **full multiway loudspeaker-system designer centred on passive-crossover
synthesis** ("Design passive speakers with measured drivers"), where the enclosure is one
sub-component of the chain rather than the whole product. Author not named on the site
(feedback@loudspeakerlab.io). Worth tracking for the crossover/multi-way arc OpenISD does not
cover (`FEATURES.md §5`) and for its measurement-based, CTA-2034A driver-data model.

_Findings below were captured by **rendering the SPA with headless Chromium (Playwright)** on
2026-07-05 — `WebFetch` returns only the empty app shell, so the FAQ accordions were expanded
and the rendered DOM text read directly (primary evidence). Items still unconfirmed after
rendering are marked ⚠ unverified._

### What it does (verified from the rendered `/faq`, 2026-07-05)

- **Automated passive-crossover solver.** Multi-objective search over an **ABCD-matrix**
  circuit model. Rather than a fixed menu, it generates many candidate topologies per driver
  and combines them into full-system layouts (every woofer topology × every tweeter topology
  for a 2-way), then screens thousands of system-level sets before refining the best. Filter
  orders: **HP 0–4th, LP 0–4th**, plus asymmetric slopes (e.g. LP3/HP2). Auxiliary networks:
  attenuation (series R, L-pad, T-pad, Pi-pad, bypassed R), impedance compensation (R‖L, R‖C,
  L‖C, Zobel, shunt L/C, damped RL), resonance control (LC traps, parallel-RLC notch,
  series L-C-R traps). Seeds proven template families (Butterworth / Linkwitz-Riley) for
  2-way, 3-way, 2.5-way, D'Appolito MTM/WTW, multi-woofer. Values are optimised continuously
  then **snapped to E-series** (E24 R/C, E12 L) with real parasitics (inductor DCR, cap ESR).
- **Solver objectives, in default priority order:** on-axis flatness → listening window →
  directivity uniformity → distortion avoidance → preference rating → simplicity (fewer parts)
  → amplifier-friendly impedance → sensitivity. Priority ordering is not user-customisable in
  the web UI.
- **Measurement-based driver profiles + CTA-2034A.** Public community database; profiles are
  built from uploaded **FRD** (on-axis SPL+phase; REW/ARTA export), **ZMA** (impedance
  magnitude+phase; REW/DATS/ARTA/LIMP), optional off-axis FRD, distortion `.txt` (THD +
  harmonics), and nearfield data. The app computes **CTA-2034A curves, Directivity Index and a
  Preference Rating**, estimating sparse off-axis angles with a piston-directivity model.
  Multiple users can upload profiles per driver model; a community accuracy vote surfaces the
  best. An **Evidence score** grades measurement provenance (not sound quality), and an
  **Expected Range** band shows prediction uncertainty. An accuracy study benchmarks it
  against Klippel NFS across five DIY kits.
- **Enclosure/box modelling — sealed or vented only, subordinate to the crossover.** For
  drivers with T/S params (Fs, Qts, Vas, optional Qes/Qms) it auto-designs a **vented or
  sealed** box; the box response is merged into each driver's FR _before_ the solver runs.
  Default alignment is **B4 vented (Butterworth 4th-order)**; volume/port tuning come from
  standard alignment tables indexed by Qts, with automatic port-length-fit adjustment. Cabinet
  depth/bracing/driver-displacement are derived from the required volume and the baffle
  dimensions (auto-sized or user-set). Baffle step and diffraction are modelled; an infinite-
  baffle mode disables diffraction. **No bandpass or passive-radiator box types** (contrast
  OpenISD, which ships both).
- **Import / export.** Crossovers can be **imported by pasting a SPICE-derived netlist**
  (Manual mode) and fully analysed without solving; every completed design also **exports a
  SPICE netlist** to copy into external simulators. The schematic exports as **PNG or SVG**;
  all plots save as images. Component values are editable with real-time in-browser preview.
  Estimated parts cost / vendor shopping lists are region-aware (US/CA/EU/UK/AU).

### Gaps / caveats

- **Not a WinISD `.wdr` cross-check oracle.** Its interchange is measurement-based (FRD/ZMA +
  SPICE netlist), not the lumped-T/S `.wdr` OpenISD reads/writes — so it is **not** a
  drop-in driver-for-driver comparison without re-entry, unlike 00 Audio Simulator (§6).
- **No subwoofer-focused enclosure coverage.** Box design is sealed/vented main-speaker
  alignments; bandpass and passive radiator (OpenISD's shipped types) are absent.
- ⚠ unverified — **open-source status / licensing not stated** (free + ad-free, driver DB is a
  public commons, but code licensing is not published). No documented API/XHR endpoint; an
  account is required to upload/create/solve/vote (browsing is open).

### Why it matters

- The strongest **crossover + system-preference** reference surveyed (ABCD solver + CTA-2034A
  - preference rating), directly relevant to the multi-way gap in `FEATURES.md §5` and the
    crossover items other tools only plan (SpeakerBoxLite, SoundForm).
- Its **public, measurement-based driver commons** with community accuracy voting is a
  data-model contrast to OpenISD's `.wdr` library and to the closed databases of SpeakerBoxLite
  / 00 Audio Simulator.

---

## 9. Open questions

| #   | Tool/Source        | Question                                                                                                                                                                                                            | Priority                                                  |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1   | micka.de           | Cross-check oracle for sealed + vented simulations. ⚠ No PR/bandpass support — its `#ideal` form exposes no passive-radiator or bandpass fields (per archive/PLAN_SBL_CROSSCHECK.md live check).                    | [documented in test/scenarios.ts]                         |
| 2   | SpeakerBoxLite     | Second oracle for PR + bandpass (the types micka lacks). Drive-real-UI vs. API-endpoint approach undecided.                                                                                                         | [see §3; spec: speakerboxlite-crosscheck.browser.spec.ts] |
| 3   | SpeakerDesign.dev  | Self-described "web-based WinISD alternative" (§4). Does it expose enclosure types beyond ported, WDR/JSON import-export, or a readable computed output? Potential cross-check oracle + build-output reference.     | Open                                                      |
| 4   | Sonella            | Guided full-range design app with crossover + STL (§5). Relevant to OpenISD's missing guided workflow and crossover modelling, not sub cross-check.                                                                 | Open                                                      |
| 5   | 00 Audio Simulator | Closest web competitor — imports `.wdr`, covers sealed/vented/BP/PR (§6). Best cross-check-oracle candidate: is there a readable computed output or an XHR endpoint behind the share-link flow?                     | Open                                                      |
| 6   | SoundForm          | Closed-beta web WinISD app focused on crossover + multi-driver summation (§7). Re-evaluate when it opens past invite-only; no feature data yet.                                                                     | Open                                                      |
| 7   | LoudspeakerLab     | Automated crossover + system solver on a CTA-2034A driver commons (§8). Not a `.wdr` cross-check oracle (measurement/spinorama data model). Track as prior art for the crossover/multi-way + preference-rating arc. | Open                                                      |
| 8   | REW                | Impedance + FR measurement reference                                                                                                                                                                                | Open                                                      |
| 9   | LEAP               | High-end simulation suite comparison                                                                                                                                                                                | Open                                                      |

---

## Merged from SPEAKER_TOOL_LANDSCAPE.md (2026-07-20)

# Speaker modelling & design tool landscape

**Compiled:** 2026-07-04

A wide-ranging survey of loudspeaker enclosure/crossover/measurement tools, their feature
sets, cost, source-code availability, and community standing. Companion to
[`REPORT_ORACLE_CROSSCHECK.md`](archive/REPORT_ORACLE_CROSSCHECK.md) and `OTHER_TOOLS.md`.

## Method & caveats

- Sources are **web searches + forum threads + project pages + GitHub/SourceForge**. Every
  non-obvious claim carries a link in the [Sources](#sources) list; claims drawn from a
  search-engine _summary_ (not a page I opened directly) are marked _(search)_.
- Prices, star counts and version numbers are **as of the cited source's date** and drift.
- I did **not** fabricate anything I could not source — notably YouTube view counts (I cite
  tutorial _existence/breadth_, not invented numbers) and the URL-state encoding schemes of
  the web SPAs (see [State-sharing note](#note-on-url-state-sharing)).

---

## Master comparison

| Tool                    | Type                    | Platform             | Cost                            | Source             | Enclosure coverage                    | Crossover                      | Measurement          |
| ----------------------- | ----------------------- | -------------------- | ------------------------------- | ------------------ | ------------------------------------- | ------------------------------ | -------------------- |
| **WinISD**              | Box sim                 | Windows              | Free (donationware)             | Closed             | Sealed, vented, bandpass + filters    | Basic                          | No                   |
| **VituixCAD**           | Full system             | Windows (.NET)       | Free (was €85 pre-1.0)          | Closed             | Sealed, vented, PR, BP, isobaric      | **Yes** (up to 6-way)          | Import FRD/ZMA       |
| **Hornresp**            | 1D horn/TL sim          | Windows              | Free                            | Closed             | Horn, TL, ¼-wave, BP, direct radiator | No                             | No                   |
| **Basta!**              | Box + xover             | Windows              | Free                            | Closed             | Sealed, vented, PR, BP                | Yes                            | No                   |
| **Boxsim**              | Full system             | Windows              | Free                            | Closed             | Multi-driver + baffle diffraction     | Yes                            | No                   |
| **XSim**                | Crossover               | Windows              | Free                            | Closed             | — (xover only)                        | **Yes**                        | No                   |
| **Speaker Workshop**    | Measure + design        | Windows              | Free                            | Closed             | Sealed, vented + xover                | Yes                            | Yes (sound card)     |
| **Akabak 3**            | Electroacoustic network | Windows              | Free edition (b102)             | Closed             | Arbitrary networks, horns, BP         | Yes                            | No                   |
| **Unibox**              | Box sim (Excel)         | Any (Excel)          | Free (non-commercial)           | Spreadsheet (open) | Sealed, vented, **PR**, bandpass      | No                             | No                   |
| **Bagby sheets**        | Xover + FRD (Excel)     | Any (Excel)          | Free                            | Spreadsheet (open) | — (response/xover modelling)          | Yes                            | No                   |
| **BassBox Pro 6**       | Box sim                 | Windows              | **~$140–149**                   | Commercial         | Sealed, vented, BP, PR                | (X-over 3 Pro sold separately) | No                   |
| **LspCAD**              | Full system             | Windows              | **$129 / $495 pro**             | Commercial         | Box + xover (active/passive)          | Yes                            | Yes (w/ hardware)    |
| **LEAP (LinearX)**      | Reference sim           | Windows              | Commercial (**vendor defunct**) | Closed             | Full                                  | Yes                            | Yes                  |
| **ARTA / STEPS / LIMP** | Measurement             | Windows              | **~$99–187** (freemium)         | Closed             | — (measurement/analysis)              | No                             | **Yes**              |
| **REW**                 | Measurement/EQ          | Win/mac/Linux (Java) | Free                            | Closed             | — (measure rooms/speakers)            | No                             | **Yes**              |
| **SpeakerBoxLite**      | Box sim (web)           | Browser (SPA)        | Free                            | Closed             | Sealed, vented, 4th/6th BP, PR, TL    | No                             | No                   |
| **Sine Design**         | Box + xover (web)       | Browser (SPA)        | Free                            | Closed             | Sealed, ported, bandpass, **PR**      | Yes                            | No                   |
| **micka.de**            | Box calc (web)          | Browser (form)       | Free                            | Closed             | Sealed, vented                        | No                             | No                   |
| **lautsprechershop**    | Box calc (web)          | Browser (static)     | Free                            | Closed             | Sealed, vented                        | No                             | No                   |
| **QSpeakers**           | Box sim                 | Linux/Qt             | Free                            | **GPL-3.0**        | Sealed, vented, bandpass              | No                             | No                   |
| **Scimpy**              | Measure + box (Python)  | Cross-platform       | Free                            | **GPL-3.0**        | Sealed, vented                        | No                             | **Yes** (sound card) |
| **GSpeakers**           | Box + xover             | Linux/GTK            | Free                            | **GPL** (SF)       | Box + crossover (needs SPICE)         | Yes                            | No                   |

---

## Desktop — free (the community mainstream)

### VituixCAD — the current de-facto standard

Free engineering/simulation tool for passive & active multi-way loudspeakers (up to 6-way,
4 drivers/way), with enclosure sim, response merger, crossover optimiser and directivity
analysis; imports measured FRD/ZMA. Developer **Kimmo Saunisto** (kimmosaunisto.net); was
€85 shareware before v1.0, now free, updated ~weekly (v3.0.1.4, June 2026) _(search)_.
Forum consensus calls it _"the most widely used blackbox speaker design program at the
moment … most widely tested by usage, with an active author making fixes"_, and notes it
_"calculates with the same equations as WinISD"_ for box work. **Closed source.**

### WinISD — the beginner default

Free/donationware box designer for Windows by **LinearTeam** (linearteam.org): sealed,
vented and bandpass plus a few filters; still officially beta. Forum verdict: _"super fast
and easy … pop out an enclosure sim in about 2 minutes"_ once you enter T/S params in the
right order. **Closed source** — the `ziutek/WinISD` GitHub repo is a community driver/project
collection, **not** the app source. Deepest YouTube tutorial coverage of any tool (many
beginner walkthroughs — the reason it's most newcomers' first tool).

### Hornresp — horns, TL, quarter-wave

Free 1D simulator by **David McBean** (hornresp.net): horns, transmission lines, ¼- and
½-wave resonators, bandpass and direct-radiator. Originally Fortran (1970s), now updated
roughly monthly. The go-to when lumped-element box models don't fit. **Closed source.**

### Others

- **Basta!** (Tolvan Data) — free box + crossover sim.
- **Boxsim** (Visaton, visaton.de) — free full-system sim, up to 20 drivers, baffle
  diffraction + 20-direction polar/directivity; Visaton-oriented. Closed.
- **XSim** (Bill Waslo) — free "draw-the-schematic" crossover designer; common WinISD
  companion.
- **Speaker Workshop** (Audua) — free measurement + design + crossover; old but still used;
  SourceForge presence.
- **Akabak 3** (R&D-Team, randteam.de) — free edition (b102) of an advanced electroacoustic
  network simulator; steeper than Hornresp.
- **Unibox** (Kristian Ougaard) — free (non-commercial) **Excel** model for sealed, vented,
  **passive-radiator** and bandpass boxes — one of the few free tools with PR.
- **Jeff Bagby's spreadsheets** — free Excel _Response Modeler_ and _Passive Crossover
  Designer_; long-standing community staples.

---

## Desktop — commercial

- **BassBox Pro 6** (Harris Technologies, ht-audio.com) — ~**$140–149**; design wizard,
  driver DB, sealed/vented/BP/PR. Sibling: BassBox Lite, X-over 3 Pro.
- **LspCAD** (IJData, ijdata.com) — **$129** standard / **$495** pro; full active/passive
  system design.
- **LEAP** (LinearX) — historically the professional reference simulator; **the vendor is
  defunct**, so it survives only on existing installs.
- **ARTA / STEPS / LIMP** (ARTALABS, artalabs.hr) — **~$99–187**, freemium (limited free
  mode); the popular affordable **measurement** suite.

---

## Measurement (adjacent, feeds the sims)

- **REW – Room EQ Wizard** (John Mulcahy, roomeqwizard.com) — free, cross-platform (Java);
  measures rooms, speakers, subs and devices; the most widely used free measurement tool.
  Closed source. Pro upgrade adds multi-input RMS averaging etc.
- **ARTA** (above), **LMS/CLIO** (commercial, hardware-tied).

---

## Web / browser tools

| Tool                                                                                | Enclosure types                                              | Notes                                                                   |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| **SpeakerBoxLite** (speakerboxlite.com)                                             | sealed, vented, 4th/6th BP, PR, TL                           | Bootstrap-Vue SPA; 300+ driver DB; "Share link/project" state sharing   |
| **Sine Design** (sinedesign.app)                                                    | sealed, ported, bandpass, PR + crossover                     | Next.js SPA; **IndexedDB** local storage; works offline; no compute API |
| **micka.de**                                                                        | sealed, vented                                               | Simple server form; already OpenISD's sealed/vented oracle              |
| **lautsprechershop.de**                                                             | sealed, vented                                               | Static page + inline JS; easy to script                                 |
| **AJ Designer / Sparked Builds / AudioGrid / the12volt / bcae1 / diyaudioandvideo** | sealed/vented/BP (varies; Sparked Builds adds PR + isobaric) | Free web calculators, no API                                            |

See the oracle report for why the PR-capable web SPAs are hard to automate.

---

## Open-source (where the code lives)

| Project                       | Repo                                      | Language | License | Stars   | Scope                                                            |
| ----------------------------- | ----------------------------------------- | -------- | ------- | ------- | ---------------------------------------------------------------- |
| **QSpeakers**                 | github.com/be1/qspeakers                  | C++/Qt   | GPL-3.0 | 54      | Sealed/vented/BP; Debian/Ubuntu packaged; OpenSCAD cut templates |
| **Scimpy**                    | github.com/maqifrnswa/scimpy              | Python   | GPL-3.0 | 72      | Impedance/SPL/GD from T/S; sound-card measurement; sealed/vented |
| **GSpeakers**                 | gspeakers.sourceforge.net                 | C++/GTK  | GPL     | (SF)    | Box + crossover; needs external SPICE                            |
| **speaker-driver-parameters** | github.com/srjh/speaker-driver-parameters | Python   | —       | (small) | Extract T/S params from a WAV                                    |
| **ziutek/WinISD**             | github.com/ziutek/WinISD                  | data     | —       | (small) | ⚠ Driver/project **data**, NOT the WinISD app source             |

Open-source box tools exist but are **niche** (tens of stars) versus the dominant closed
freeware (WinISD/VituixCAD/Hornresp). No open-source tool matches VituixCAD's breadth.
**OpenISD is unusual in being a modern, web-native, open codebase in this space.**

---

## Popularity & community consensus (evidence)

- **Where the discussion happens:** diyAudio and Parts Express "Tech Talk" are the two most
  active hubs; also AVS Forum, DIYMobileAudio, TalkBass, Audio Science Review, pink fish
  media, Free Speaker Plans.
- **Consensus hierarchy** (from the diyAudio "best software" / "comprehensive list" threads):
  VituixCAD = most powerful/most-used all-rounder; WinISD = easiest box sim for beginners;
  Hornresp = horns/TL specialist; XSim = quick crossovers. Typical DIY workflow: _"WinISD
  for box design → baffle-step correction → model the crossover in XSim."_
- **Tutorial breadth:** WinISD has by far the most YouTube beginner tutorials (many distinct
  walkthroughs exist); VituixCAD and Hornresp have active but more advanced tutorial/forum
  followings. (I cite breadth, not view counts — unverified numbers omitted.)
- **Cross-tool disagreement is a known, documented issue** — see next section.

---

## Cross-tool numerical disagreement (ties to the oracle report)

There is an active diyAudio thread, **"Inconsistent bandpass enclosure simulation in
Hornresp vs Basta, WinISD and VituixCAD"**, documenting that these four respected tools
**disagree on bandpass results**. This corroborates the oracle report's finding that even
mature tools diverge (OpenISD/micka gave `f3 ≈ 68.8 Hz` for a Butterworth sealed box while
SpeakerBoxLite read 74.5 Hz and lautsprechershop 81 Hz). Takeaway for OpenISD: **any single
external tool is a fallible oracle for bandpass/PR** — anchor those to the closed-form
Thiele/Small literature, and treat tool-vs-tool deltas as expected, not as proof of a bug.
(The bandpass thread's 403 to automated fetch means this is cited from its title/search
listing, not a full read.)

## Note on URL-state sharing

Some **browser** tools persist a session locally and/or encode it into a shareable link:
**Sine Design** uses **IndexedDB** local storage _(search)_ and **SpeakerBoxLite** exposes
explicit **"Share link" / "Share project"** actions (observed in its DOM). This is a
client-side-web pattern only. **WinISD is a Windows desktop app** — it uses `.wdr`/`.wpr`
files, **not** IndexedDB or URL-encoded state, so it does not participate in this pattern.
I have **not** reverse-engineered and will not guess any tool's URL encoding format.

---

## Relevance to OpenISD

- **Oracles:** micka (sealed/vented, wired); lautsprechershop (easy candidate); everything
  PR-capable is a hard-to-automate SPA or offline (see oracle report).
- **Feature bar to aim at:** VituixCAD (system + crossover + directivity + measurement
  import) is the target for "serious" use; WinISD is the usability bar for beginners.
- **Positioning:** OpenISD's open, web-native, modern codebase is genuinely differentiated —
  the incumbents are closed Windows freeware or niche GPL desktop apps.
- **Feature gaps worth tracking** (also in the oracle report / BACKLOG): 6th-order bandpass
  (parallel & series), transmission line, isobaric, first-class box-loss `Ql`, PR design
  helpers, crossover design, measurement import.

---

## Sources

**Forums / consensus**

- diyAudio — Best software for designing speaker enclosures: https://www.diyaudio.com/community/threads/best-software-for-designing-speaker-enclosures.431500/
- diyAudio — Comprehensive list of recommended design tools: https://www.diyaudio.com/community/threads/speaker-design-comprehensive-list-of-recommended-design-tools.324068/
- diyAudio — Inconsistent bandpass sim (Hornresp/Basta/WinISD/VituixCAD): https://www.diyaudio.com/community/threads/inconsistent-bandpass-enclosure-simulation-in-hornresp-vs-basta-winisd-and-vituixcad.379777/
- diyAudio — WinISD vs BassBox 6 Pro: https://www.diyaudio.com/community/threads/winisd-vs-bassbox-6-pro.409321/
- Parts Express Tech Talk — Modeling and Design Software recommendations: https://techtalk.parts-express.com/forum/tech-talk-forum/1428965-modeling-and-design-software-recommendations
- AVS Forum — suggestions for new speaker design software: https://www.avsforum.com/threads/i-need-suggestions-for-new-speaker-design-software.3329285/
- Audio Science Review — VituixCAD thread: https://www.audiosciencereview.com/forum/index.php?threads/has-anyone-here-used-this-vituix-software.8702/
- Link collection (DIY loudspeaker design): http://euraudio.dx.am/en/links.htm

**Tool homepages**

- WinISD / LinearTeam: https://www.linearteam.org/
- VituixCAD / Kimmo Saunisto: https://kimmosaunisto.net/
- Hornresp: http://www.hornresp.net/
- Boxsim / Visaton: https://www.visaton.de/index.php/en/downloads-boxsim
- Akabak / R&D-Team: http://www.randteam.de/AKABAK3/
- Unibox / Charlie's Audio: http://audio.claub.net/software/kougaard/ubmodel.html
- BassBox Pro (Harris Technologies): https://www.ht-audio.com/pages/Products.html · https://www.parts-express.com/BassBox-6-Pro-Software-CD-ROM-500-923
- LspCAD / IJData: https://www.ijdata.com/
- ARTA: https://artalabs.hr/
- REW – Room EQ Wizard: https://www.roomeqwizard.com/
- SpeakerBoxLite: https://speakerboxlite.com/
- Sine Design: https://sinedesign.app/
- micka.de: https://www.micka.de/en/
- lautsprechershop tools: https://www.lautsprechershop.de/tools/t_box_closed_en.htm

**Open source**

- QSpeakers: https://github.com/be1/qspeakers
- Scimpy: https://github.com/maqifrnswa/scimpy
- GSpeakers: https://gspeakers.sourceforge.net/
- speaker-driver-parameters: https://github.com/srjh/speaker-driver-parameters
- ziutek/WinISD (data only): https://github.com/ziutek/WinISD
