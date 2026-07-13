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
which to use. See `PLAN_SBL_CROSSCHECK.md` for the history that led here.

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
| 1   | micka.de           | Cross-check oracle for sealed + vented simulations. ⚠ No PR/bandpass support — its `#ideal` form exposes no passive-radiator or bandpass fields (per PLAN_SBL_CROSSCHECK.md live check).                            | [documented in test/scenarios.ts]                         |
| 2   | SpeakerBoxLite     | Second oracle for PR + bandpass (the types micka lacks). Drive-real-UI vs. API-endpoint approach undecided.                                                                                                         | [see §3; spec: speakerboxlite-crosscheck.browser.spec.ts] |
| 3   | SpeakerDesign.dev  | Self-described "web-based WinISD alternative" (§4). Does it expose enclosure types beyond ported, WDR/JSON import-export, or a readable computed output? Potential cross-check oracle + build-output reference.     | Open                                                      |
| 4   | Sonella            | Guided full-range design app with crossover + STL (§5). Relevant to OpenISD's missing guided workflow and crossover modelling, not sub cross-check.                                                                 | Open                                                      |
| 5   | 00 Audio Simulator | Closest web competitor — imports `.wdr`, covers sealed/vented/BP/PR (§6). Best cross-check-oracle candidate: is there a readable computed output or an XHR endpoint behind the share-link flow?                     | Open                                                      |
| 6   | SoundForm          | Closed-beta web WinISD app focused on crossover + multi-driver summation (§7). Re-evaluate when it opens past invite-only; no feature data yet.                                                                     | Open                                                      |
| 7   | LoudspeakerLab     | Automated crossover + system solver on a CTA-2034A driver commons (§8). Not a `.wdr` cross-check oracle (measurement/spinorama data model). Track as prior art for the crossover/multi-way + preference-rating arc. | Open                                                      |
| 8   | REW                | Impedance + FR measurement reference                                                                                                                                                                                | Open                                                      |
| 9   | LEAP               | High-end simulation suite comparison                                                                                                                                                                                | Open                                                      |
