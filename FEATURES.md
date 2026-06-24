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
- ✅ Overlay & compare multiple designs on one graph
- ⬜ Interactive schematic / lumped-model view — *seen in 00 Simulator*
- ⬜ Configurable graph gridlines (3/5/10 dB) and contrast

## 3. Driver & Thiele/Small handling
- ✅ Manual T/S entry, self-consistent derivation of Bl/Cms/Mms/Rms
- ✅ EBP box-type gauge
- ✅ Driver presets
- ✅ Multiple drivers (series / parallel)
- ✅ **WinISD `.wdr` import**
- ✅ **WinISD `.wdr` export** — *00 Simulator also exports WinISD-compatible files*
- ⬜ WinISD `.wpr` project import — *00 Simulator does this; `.wpr` is plain INI text in current WinISD (sections decoded), so this is feasible*
- ⬜ Unibox spreadsheet import — *seen in 00 Simulator*

### Driver library — 2,100+ drivers, instant load
- ✅ **Pre-bundled at build time** — all local `.wdr` collections are baked into
  the app JS; no GitHub API calls, no rate limits, no spinners. The full library
  loads in the same round-trip as the page itself.
- ✅ **Federated driver sources** — `drivers/sources.json` links external `.wdr`
  repos so the community can grow the library without forking Resonate; *no other
  surveyed tool federates its driver data*
- ✅ **In-app driver browser** — token-based multi-word search (case-insensitive,
  every word must match), pure alphabetical list, source tags with clickable links
- ✅ **Newer-version highlighting** — when the same driver exists in multiple
  collections, the entry with the latest `DateModified` is highlighted in accent
  colour; older copies are dimmed so you can see at a glance which measurement to
  trust and where it came from
- ✅ **Date normalisation** — dates from different scrapers and manual entries
  are canonicalised to `YYYY-MM-DD` for consistent display regardless of origin
- ✅ **SpeakerBoxLite opt-in** — one click loads ~6,000 community measurements
  from speakerboxlite.com on top of the bundled library (fetched live, CORS-permitting)
- ✅ **Paste any GitHub repo** — add a custom `owner/repo` or full GitHub URL to
  pull `.wdr` files from any public repository in the browser

### Vendor scrapers (automated data pipelines)
- ✅ **SB Acoustics** — 194 drivers scraped from sbacoustics.com, including
  the full Satori and SB series, with datasheet URLs in machine-readable `_meta.json`
- ✅ **Parts Express** — 1,509 drivers scraped from the PE woofer guide API;
  T/S parameters taken directly from the PE datasheet fields (not keyed by hand)
- 🔨 **SoundImports** — European multi-brand distributor; scraper live, data
  growing (Accuton, HiVi, Faital, Morel, ScanSpeak, Seas, Satori, Wavecor, …)
- ⬜ **Wavecor**, **Dayton Audio** — scrapers written, pending full run
- ✅ **Meta file standard** — every scraped `.wdr` gets a `_meta.json` with
  quality grade (`M` = machine-scraped, unverified), datasheet URL, and scrape
  provenance so human reviewers know exactly where each number came from
- ✅ **WDR schema documentation** (`drivers/README.md`) — canonical field names,
  SI units, common mistakes table, date semantics, quality review workflow; the
  single source of truth for scraper authors and human contributors
- ⬜ Filter drivers by size / params; richer metadata index — *SpeakerBoxLite has 5,000+ / 300+ brands in one DB*
- ⬜ Paste raw datasheet text → infer T/S params — *seen in 00 Simulator*
- ⬜ “Copy from” an existing driver — *seen in 00 Simulator*
- ⬜ Import other formats (SPL/ZMA traces, other tools’ exports)

## 4. Electronics & signal chain
- ✅ Input drive voltage / power
- ✅ Series / source resistance (amp + cabling)
- ⬜ Configurable listening distance (currently fixed 1 m) — *seen in SpeakerDesign.dev, 00 Sim*
- ⬜ Frequency-range presets (sub / woofer / wide / custom) — *seen in SpeakerDesign.dev*
- ✅ EQ: parametric (peaking)
- ✅ EQ: Linkwitz transform
- ⬜ EQ: high-shelf / low-shelf — *seen in 00 Simulator*
- ✅ High-pass / low-pass filters
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
- ✅ Runs anywhere with a browser (desktop, tablet, phone), no install, no login
- ✅ Dark theme
- ✅ Hover crosshair + value readout on every graph
- ✅ Alignment helpers (Qtc target, QB3/B4 vent, PR mass auto-tune, vent↔tuning)
- ⬜ More vented alignment presets (SBB4, EBS, Bessel, Chebyshev) — *seen in SpeakerDesign.dev wizard*
- ⬜ Guided design wizard (driver → count → box type → params) — *seen in SpeakerDesign.dev*
- ⬜ Draggable / resizable graphs, pin/hide panels — *seen in 00 Simulator*
- ⬜ Accessibility pass (keyboard nav, arrow-key nudge on inputs) — *arrow-key nudge in 00 Simulator*

## 8. Data, sharing & community
- ✅ JSON project save / load
- ✅ **Federated driver data** — `drivers/sources.json` links external `.wdr`
  repos; add one via PR, no re-hosting
- ✅ **URL-encoded shareable designs** — paste a design as a link
- ✅ **Community contribution flow** — PR a `.wdr` file or a new source URL;
  WDR schema + meta standard documented so contributors know exactly what's expected
- ✅ Static hosting on GitHub Pages (<https://johnlon.github.io/resonate/>)

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

The field is more advanced than “WinISD is dead” implies. **00 Simulator** is
feature-rich and actively developed. **SpeakerDesign.dev** matches Resonate’s
graph set and exceeds it on vents and construction. **SpeakerBoxLite** is the
broadest tool (transmission line, full crossover, 5,000+ drivers) but paywalled.
On raw simulation features alone, Resonate is mid-pack today.

But the driver library story has changed materially. Resonate now ships with
**2,100+ bundled drivers** from SB Acoustics, Parts Express, and community
measurement collections — loaded instantly from the app bundle, not fetched from a
rate-limited API. A live scraper pipeline keeps that number growing. No surveyed
competitor offers an open, version-controlled, machine-readable driver commons with
automated ingestion pipelines and a human-review quality framework.

Resonate’s defensible edges:

- **Open source, now.** 00 Simulator pledges to open source “if it goes stale.”
  Resonate is MIT, public, and forkable today — not contingent on a maintainer’s
  goodwill.
- **Open *data*, growing.** 2,100+ drivers in a version-controlled commons, with
  vendor scraper pipelines adding new measurements automatically. The data carries
  quality grades, datasheet provenance, and scrape timestamps so you know exactly
  where every number came from. No closed tool opens its aggregated driver data at
  all, let alone federates it.
- **Federated, not hoarded.** Any `.wdr` repo on GitHub can be linked into
  Resonate’s browser with one PR to `sources.json` — no re-hosting, no import
  queue. The commons grows without a central gatekeeper.
- **Provable physics.** Validated against closed-form Thiele/Small solutions,
  re-verified on every push in CI. No competitor surveyed makes this claim.
- **Truly ownerless longevity.** MIT + on disk in every clone = it cannot die,
  be paywalled, or have its driver data locked away.

## Where it needs to catch up
Construction output (volume calc, cut list, 3D), amplifier-load graph, richer
vents (multi/slot/selectable end-correction), 6th-order bandpass, `.wpr` import,
datasheet→params paste, and EQ shelves. All tractable on the existing engine.

## Strategic framing
The honest pitch isn’t “mine is better at simulation.” It’s: the best tools are
closing up or charging, and even the friendliest only promises to open if it dies.
Resonate is the neutral, already-open foundation — code *and* data — that no one
can take away. As the driver library approaches 5,000+ drivers with verified
provenance, that data commons becomes the deepest moat of all.
