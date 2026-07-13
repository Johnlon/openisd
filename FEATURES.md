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

- ✅ Input drive voltage / power
- ✅ Series / source resistance (amp + cabling)
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
- ✅ **URL-encoded shareable designs** — paste a design as a link
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
