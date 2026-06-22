# Resonate — Feature List

The full picture of what Resonate is and where it's going. Synthesised from the
existing tool plus a survey of the field (00 Enclosure Simulator, SoundForm,
SpeakerDesign.dev, SpeakerBoxLite). This doubles as a backlog: if a ⬜ item
appeals, claim it in an issue.

**Legend:** ✅ done · 🔨 in progress · ⬜ planned · *“seen in X”* = demand already
proven by another tool.

---

## Tools surveyed

- **Resonate** *(this project)* — open source, MIT —
  <https://github.com/Johnlon/resonate>
- **00 Simulator** by *mbdavis* (00aud.io) — free, no login, closed source —
  <https://simulator.00aud.io/> · roadmap <https://simulator.00aud.io/roadmap> ·
  WinISD comparison <https://simulator.00aud.io/compare/winisd-vs-00-simulator>.
  The most developed of the field: ~65 shipped features, public voted roadmap,
  amplifier-load graph + interactive schematic view, on-graph parametric EQ +
  HP/LP + Linkwitz transform + shelves, imports **`.wdr` and `.wpr` and Unibox**
  and **exports WinISD-compatible files**, and **shares designs by URL**.
  Notably, it *publicly commits to open-sourcing “if the project ever goes
  stale.”*
- **SoundForm** by *u/BusyEntrepreneur9636* — closed beta, access by DM —
  <https://www.reddit.com/r/diyaudio/comments/1snqre1/new_features_for_web_based_winisd_app/>
- **SpeakerDesign.dev** — 100% free, no login, closed source —
  <https://speakerdesign.dev/> — a deep suite: T/S Parameters (+ personal driver
  DB), a guided **Driver Wizard** (sealed presets; vented QB3/SBB4/EBS; bandpass/
  PR/ABC “coming”), a **Box Simulator** that nearly matches Resonate (transfer
  mag, excursion, port velocity, impedance, phase, group delay, max power, max
  SPL; full Ql/Qa/Qp losses; **1–4 vents, round or slot, selectable end-
  correction; drag-to-adjust Vb/Fb with locking; frequency presets; listening
  distance**), a detailed **Box Calculator** (6 assembly cases, driver/port
  displacement, bracing, lining, component volumes, cutlist), a polished
  **Cutlist Optimizer** (bin-packing, kerf, rotate, fractional inches, PDF), and
  an open **knowledge base + tutorial**. Sealed/vented only (no bandpass/PR/`.wdr`
  yet), but broader than Resonate on vents, construction, and education.
- **SpeakerBoxLite** — established freemium / PAYG (web + iOS + Android), closed
  source — <https://speakerboxlite.com/> — the most feature-complete of the
  field: 5,000+ drivers, transmission line, full crossover suite, 3D builder,
  STL port export.

> A further r/diyaudio thread, *“I built a web-based WinISD”*
> (<https://www.reddit.com/r/diyaudio/comments/1rjcvfq/feedback_requested_i_built_a_webbased_winisd/>),
> was also noted; its tool/author isn’t separately confirmed here.
>
> Feature notes for the closed web tools (SpeakerDesign.dev, SpeakerBoxLite) are
> from their own sites; notes for 00 Enclosure Simulator and SoundForm are from
> their authors’ public posts, not independent testing.

---

## 1. Enclosure types
- ✅ Sealed (closed box)
- ✅ Vented / ported (bass-reflex)
- ✅ 4th-order bandpass (single-ported)
- ✅ Passive radiator
- ⬜ 6th-order bandpass (both chambers ported) — *seen in 00 Enc. Sim, SpeakerBoxLite*
- ⬜ Isobaric / compound loading — *planned by 00 Sim & SpeakerDesign.dev*
- ⬜ Aperiodic (resistive vent)
- ⬜ Transmission line / quarter-wave — *seen in SpeakerBoxLite, 00 Sim roadmap*
- ⬜ Horn / waveguide — *SoundForm considering; on 00 Sim roadmap; large effort*

### Box-loss model
- ✅ Leakage loss `Ql`
- ✅ Port/vent loss `Qp`
- ⬜ Absorption / fill loss `Qa` — *full Ql/Qa/Qp set seen in SpeakerDesign.dev*

### Vent / port modelling
- ✅ Single round vent (diameter, length, area, Fb readout)
- ✅ End-correction (fixed ~0.85d)
- ⬜ Multiple vents (1–4) — *seen in SpeakerDesign.dev*
- ⬜ Slot / rectangular vents — *seen in SpeakerDesign.dev*
- ⬜ Selectable end-correction (free/flanged combos, custom) — *seen in SpeakerDesign.dev*
- ⬜ Drag-to-adjust Vb / Fb with lock-one — *seen in SpeakerDesign.dev & 00 Simulator*

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
- ⬜ Amplifier load — current / VA draw vs frequency — *seen in 00 Simulator*
- ⬜ Step response (impulse / time-domain)
- ⬜ Overlay & compare multiple designs on one graph — *seen in 00 Simulator, SpeakerBoxLite*
- ⬜ Interactive schematic / lumped-model view — *seen in 00 Simulator*
- ⬜ Configurable graph gridlines (3/5/10 dB) and contrast

## 3. Driver & Thiele/Small handling
- ✅ Manual T/S entry, self-consistent derivation of Bl/Cms/Mms/Rms
- ✅ EBP box-type gauge
- ✅ Driver presets
- ✅ Multiple drivers (series / parallel)
- ✅ **WinISD `.wdr` import**
- ✅ **WinISD `.wdr` export** — *00 Simulator also exports WinISD-compatible files*
- ⬜ WinISD `.wpr` project import — *00 Simulator does this; Lazarus binary format, needs a sample*
- ⬜ Unibox spreadsheet import — *seen in 00 Simulator*
- 🔨 Open, version-controlled driver database (`drivers/`) — seeded
- ⬜ In-app driver browser / search / filter by size & params — *SpeakerBoxLite has 5,000+ / 300+ brands*
- ⬜ Paste raw datasheet text → infer T/S params — *seen in 00 Simulator*
- ⬜ “Copy from” an existing driver — *seen in 00 Simulator*
- ⬜ Import other formats (SPL/ZMA traces, other tools’ exports)

## 4. Electronics & signal chain
- ✅ Input drive voltage / power
- ⬜ Series / source resistance (amp + cabling) — *seen in SpeakerDesign.dev, 00 Sim*
- ⬜ Configurable listening distance (currently fixed 1 m) — *seen in SpeakerDesign.dev, 00 Sim*
- ⬜ Frequency-range presets (sub / woofer / wide / custom) — *seen in SpeakerDesign.dev*
- ⬜ EQ: parametric (peaking) — *WinISD core feature; 00 Simulator has on-graph editing*
- ⬜ EQ: Linkwitz transform — *seen in 00 Simulator*
- ⬜ EQ: high-shelf / low-shelf — *seen in 00 Simulator*
- ⬜ High-pass / low-pass filters (Butterworth / Bessel / Linkwitz-Riley) — *seen in SpeakerBoxLite*
- ⬜ Amplifier output impedance / damping factor effect
- ⬜ Signal generator presets (sine / sweep reference levels)

## 5. Crossover & multi-way *(bigger arc)*
- ⬜ Crossover network design (1st–6th order, Butterworth / Linkwitz-Riley) — *SpeakerBoxLite; SoundForm planned*
- ⬜ L-pad / level matching — *seen in SpeakerBoxLite*
- ⬜ Multi-driver summation / system response (2- and 3-way) — *SpeakerBoxLite, SoundForm*
- ⬜ Driver offset / acoustic centre handling

## 6. Construction & woodworking output
*The clearest gap vs SoundForm and SpeakerDesign.dev — builders love this.*
- ⬜ Net/gross internal volume from panel thickness (+ separate baffle thickness)
- ⬜ Driver & port displacement subtraction
- ⬜ Bracing / lining / component (xover, plate amp) volume subtraction — *seen in SpeakerDesign.dev*
- ⬜ Panel cut list + 6-panel dimension breakdown — *SoundForm, SpeakerDesign.dev, SpeakerBoxLite*
- ⬜ 3D enclosure model / assembly view — *SpeakerDesign.dev, SpeakerBoxLite (“Smart 3D Builder”)*
- ⬜ Cut-list / sheet-layout optimiser — *SpeakerDesign.dev, SpeakerBoxLite*
- ⬜ 3D-printable port export (STL) — *seen in SpeakerBoxLite*

## 7. Platform & UX
- ✅ Single HTML file, no build step, no dependencies
- ✅ Runs anywhere with a browser (desktop, tablet, phone)
- ✅ Dark theme
- ✅ Hover crosshair + value readout on every graph
- ✅ Alignment helpers (Qtc target, QB3/B4 vent, PR mass auto-tune, vent↔tuning)
- ⬜ More vented alignment presets (SBB4, EBS, Bessel, Chebyshev) — *seen in SpeakerDesign.dev wizard*
- ⬜ Guided design wizard (driver → count → box type → params) — *seen in SpeakerDesign.dev*
- ⬜ Draggable / resizable graphs, pin/hide panels — *seen in 00 Simulator*
- ⬜ Accessibility pass (keyboard nav, arrow-key nudge on inputs) — *arrow-key nudge in 00 Simulator*

## 8. Data, sharing & community
- ✅ JSON project save / load
- ⬜ **URL-encoded shareable designs** — paste a design as a link — *00 Simulator already ships this; table stakes, not a differentiator*
- 🔨 Community driver-data contribution flow (PR a `.wdr`)
- ⬜ Static hosting on GitHub Pages (one canonical URL)

## 9. Learning & docs
- ✅ Documented engine + conventions (`CONTRIBUTING.md`)
- ⬜ Open knowledge base — T/S params, box types, tuning, box losses — *SpeakerDesign.dev has a closed one; an **open, community-editable** one would be a first*
- ⬜ In-app explanations / tooltips on parameters and curves
- ⬜ Worked-example tutorial

## 10. Trust & validation *(Resonate’s differentiator — no other tool surveyed does this)*
- ✅ Validated against closed-form Thiele/Small (sealed fc/Qtc < 0.03 dB)
- ✅ Passband = driver reference sensitivity; vented 24 dB/oct + twin Z-peaks
- ✅ In-browser self-test (console) on every load
- ✅ Node engine test wired into CI — physics re-proven on every push
- ✅ Open, documented model (`CONTRIBUTING.md`)

---

## Honest competitive position

The field is far more advanced than “WinISD is dead” implies — and closer
inspection makes this *more* true, not less. **00 Simulator** is feature-rich,
polished, actively developed, and already does several things once imagined as
Resonate differentiators (WinISD-compatible export, URL design sharing, amp-load
graph, EQ chain). **SpeakerDesign.dev**’s simulator roughly matches Resonate’s
graph set and *exceeds* it on vents/ports, construction, and education.
**SpeakerBoxLite** is the broadest (transmission line, full crossover, 5,000+
drivers) but paywalled. On raw features Resonate is, at best, mid-pack — and
behind on construction/woodworking entirely.

So Resonate does **not** win on features today. Its genuine, defensible edge is
narrower and sharper:

- **Open source, now — not “if it goes stale.”** 00 Simulator *pledges* to open
  up someday; Resonate’s code is MIT and public today. A promise to open later is
  not an open project.
- **Open *data*, not just open code.** A community-owned, version-controlled
  driver commons that no single operator can wall off or take down. None of the
  closed tools open their aggregated driver data.
- **Provable physics.** Published validation against the closed-form solutions,
  re-checked in CI on every push. No competitor surveyed makes (let alone proves)
  this claim.
- **Truly ownerless longevity.** MIT + on disk in every clone = it cannot die or
  get paywalled. That’s a structural guarantee, not a maintainer’s good intentions.

## Where it needs to catch up
EQ chain, amplifier-load graph, datasheet→params paste, 6th-order bandpass, `.wpr`
import, richer vents (multi/slot/end-correction), series resistance + listening
distance, and construction output (volume calc, cut list, 3D). All tractable on
the existing engine — good first contributions.

## Strategic implication for the “unite” pitch
The honest framing isn’t “mine is better.” It’s: the best tools are closing up or
charging, and even the friendliest only *promises* to open up if it dies. Resonate
is the neutral, already-open foundation to pool effort and data into — so no one
has to trust a single operator’s goodwill. The ask to other authors stands, but
the hook is **open now + open data + provable**, not feature superiority.
