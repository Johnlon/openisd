# OpenISD — Feature List

The full picture of what OpenISD is and where it's going. This doubles as a backlog: if a ⬜
item appeals, claim it in an issue. For alternative tools (00 Enclosure Simulator,
SpeakerDesign.dev, SpeakerBoxLite, Sonella, LoudspeakerLab, SoundForm, Biquad Cookbook) see
[`docs/research/COMPETITIVE_LANDSCAPE.md`](docs/research/COMPETITIVE_LANDSCAPE.md).

**Legend:** ✅ done · 🔨 in progress · ⬜ planned · _“seen in X”_ = demand already
proven by another tool.

---

## 1. Enclosure types

> Cross-tool support at a glance (which of these each surveyed tool models) lives in
> [`docs/research/COMPETITIVE_LANDSCAPE.md`](docs/research/COMPETITIVE_LANDSCAPE.md) →
> "Enclosure/box-type support at a glance".

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

- ✅ **Pre-bundled at build time** — every local `openisd.yml` collection is
  baked into the app JS; no GitHub API calls, no rate limits, no spinners. The library
  loads in the same round-trip as the page itself. `.wdr` is not a bundleable record —
  a collection stored as `.wdr` has to be converted first.
- ✅ **Federated driver sources** — `drivers/sources.json` links external `.wdr`
  repos so the community can grow the library without forking OpenISD; _no other
  surveyed tool federates its driver data_
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

### Driver data supply

- ✅ **Driver records come from winisd_tools** — the scraping pipeline is a separate
  project; openisd consumes the records it publishes and never scrapes a vendor itself
- ✅ **WDR schema documentation** (`WDR_SCHEMA.md`) — canonical field names, SI units,
  common mistakes table, date semantics; the single source of truth for the file format
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
rate-limited API. A live ingestion pipeline keeps that number growing. No surveyed
competitor offers an open, version-controlled, machine-readable driver commons with
automated ingestion pipelines and a human-review quality framework.

OpenISD’s defensible edges:

- **Open source, fully and permanently.** MIT-licensed, public, and forkable
  today. The code belongs to everyone who uses it.
- **Open _data_, growing.** 2,100+ drivers in a version-controlled commons, fed by an
  automated ingestion pipeline. The data carries
  quality grades, datasheet provenance, and timestamps so you know exactly
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
