# OpenISD — Feature Comparison

This table serves two purposes:

- **Promotional** — what OpenISD offers today vs. the tools it replaces or complements.
- **Todo list** — features not yet implemented are marked 🚧 and linked to the roadmap.

Comparison is primarily against **WinISD** (the tool OpenISD is designed to replace or
extend), with notes on other tools where relevant. A separate
[Web-based alternatives](#web-based-alternatives-beyond-winisd) matrix near the end
compares OpenISD against the active browser-based competitors (00 Simulator,
SpeakerDesign.dev, SpeakerBoxLite, Sonella); see [FEATURES.md](FEATURES.md) for the
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
> Per-tool detail and sourcing: [FEATURES.md](FEATURES.md) "Alternative tools".

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
filled with guesses — see [OTHER_TOOLS.md](OTHER_TOOLS.md) §7.

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
| Open / federated driver data  | ✅ commons + scrapers | ❌                  | ❌                  | ❌ (closed DB)   | ❌            |

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
commons (2,100+, growing via scrapers), and physics validated against closed-form solutions in
CI.** See [FEATURES.md](FEATURES.md) "Honest competitive position" for the full argument.

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
author posts (⚠ unverified — no independent OpenISD testing); see [FEATURES.md](FEATURES.md)._
