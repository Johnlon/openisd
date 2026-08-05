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

## 1. loudspeakerdatabase.com scraper — third-party collection

**Collection:** `drivers/loudspeakerdatabase/` (14 WDR files)

**Source:** Third-party scraper (not WinISD, not OpenISD's current scraper)

### Quality findings (analysis: 2026-06-28)

**EBP computation broken:**

- 6/14 files: EBP field completely absent
- 7/14 files: EBP=0 when both Fs and Qes are present and non-zero
- Example: Beyma 10BR60 V2: Fs=29 Hz, Qes=0.44 → should compute EBP ≈ 66, written as 0

**ParState issues:**

- All 14 files use hardcoded constant: `EEECEENNEENEEEEEEEEEEECENNCCCNNNCCCCECNNNNNNNNECC`
- Does not match dynamically-computed ParState seen in real WinISD files (matt collection)
- Suggests use of older OpenISD scraper version or independent implementation

**Metadata issues:**

- Most files dated December 2025 (future dates; likely test or placeholder data)
- Several files: DateAdded/DateModified fields completely empty
- VCCon=2 (serial connection) as default (unusual for single-VC drivers)

**Vd/Dd coverage:**

- Vd: 14/14 present, 14 computed, 0 zeros (100% perfect coverage)
- Dd: 14/14 present, 14 computed, 0 zeros (100% perfect coverage)
- Contrast with matt (411 real WinISD files): Vd has 9 zeros, Dd has 0 zeros

### Conclusion

loudspeakerdatabase files exhibit data quality issues not seen in real WinISD entries (matt collection).
**Not suitable as reference** for validating WDR format, scraper correctness, or WinISD behaviour.

**Use matt collection (411 real WinISD files) as authoritative reference.**

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

1. Scraper must aim for "full entry" level (9 fields) for professional-quality WDR files
2. Understanding these levels helps validate data quality — files missing multiple core fields may be incomplete
3. Use entry order + minimal levels to understand ParState patterns in real WinISD files

---

## 3. SpeakerBoxLite — second external oracle

**Site:** https://speakerboxlite.com · calculator at `/subwoofer-box-calculator/`

**Role:** Second independent cross-check oracle alongside micka.de, added specifically
to cover enclosure types micka cannot model. Consumed by
`packages/ui/test/speakerboxlite-crosscheck.browser.spec.ts` via the `sbl` field on each
scenario in `packages/ui/test/scenarios.ts`.

### Why a second oracle

micka.de's `#ideal` calculator models only sealed and vented boxes — it exposes no
passive-radiator or bandpass inputs, so it cannot validate the PR and 4th-order-bandpass
scenarios OpenISD already ships. SpeakerBoxLite covers both.

### Enclosure types (verified live 2026-07-04 by fetching the calculator page)

```
Closed
Vented
4th Order Bandpass
6th Order Bandpass (Parallel)
6th Order Bandpass (Series)
Passive Radiator
Transmission Line
```

Of these, OpenISD's engine implements Closed, Vented, 4th Order Bandpass and Passive
Radiator (`BoxType` in `packages/engine/src/types.ts`). The 6th-order bandpass
parallel/series split and Transmission Line are backlog items — see
`BACKLOG.md` "Enclosure types & box model". The parallel-vs-series distinction is
new information from SpeakerBoxLite (micka never surfaced it).

### Rendering & automation — confirmed live 2026-07-04

Driven with a headless Chromium exploration script (`build/` scratch, since deleted).
All of the following was observed in the rendered DOM, not inferred:

- **Client-side SPA (Bootstrap-Vue).** No `<input name>` / stable `id` on fields — every
  parameter input is `input.form-control`, and many share `id="fieldInput"`. Selectors
  must key off the row label, e.g. `.input-field-root:has-text("Fs(Hz)") input.form-control`.
- **Two consent overlays** must be dismissed first: a top cookie bar (`button` "Got it!")
  and a "Privacy and cookie settings" popup (Quantcast/IAB) that overlaps the left inputs.
- **Responsive duplicates:** the DOM holds hidden desktop+mobile copies of controls
  (`d-none d-md-block`); a wide viewport (≈1680×1050) and a `:visible` filter are required,
  otherwise `.first()` grabs a hidden node.
- **Left panel is tabbed:** `Speaker | Network | Enclosure | Box | …`.
  - _Speaker_ tab: driver T/S — `Fs(Hz)`, `Vas(l)`, `Qts`, plus SUB/WOOFER/… ,
    SIMPLE/COMPLEX computation model, LITE/EXPANDED parameter set, ONE/MULTIPLE/ISOBARIC.
  - _Enclosure_ tab: enclosure-type dropdown (`button.dropdown-toggle` → `a.dropdown-item`,
    options exactly the 7 above) plus the box fields (below).
  - _Box_ tab: physical realisation — `Material thickness(mm)`, `Port outside length(mm)`,
    `Displacement(l)`.
- **Enclosure fields per type** (all on the Enclosure tab; `Ql(Box losses)` defaults to 7):
  - Closed: `Vb(l)`, `Qtc`, `F3(Hz)`
  - Vented: `Vb(l)`, `Fb(Hz)`, `F3(Hz)`
  - Passive Radiator: `Vb(l)`, `Fb(Hz)`, `F3(Hz)`
  - 4th Order Bandpass: `front`, `front`, `rear`, `low`, `high`, `Bandwidth(Hz)`

### Two blockers to a working crosscheck spec (unresolved)

1. **No output field to read.** The Enclosure fields (`Vb`, `Qtc`, `Fb`, `F3`) are all
   _inputs_ — you enter whichever you know. Entering `Qtc=0.707` (or `Vb=12.2`) and clicking
   **Draw** did **not** populate the others; SBL's authoritative computed numbers are not
   written back into these inputs. Where SBL surfaces the computed result as parseable text
   (a values/list panel behind the graph toolbar's list icon, vs. graph pixels only) has not
   been located. Until it is, the spec has nothing reliable to assert against.
2. **Model direction likely differs for vented.** SBL's vented Enclosure tab exposes `Fb`
   as an input field (not a readout), with port length/material/displacement on the Box tab
   — so it appears to take `Vb` + target `Fb` and compute the port (⚠ inferred from field
   layout, not confirmed by watching it compute). That is the _inverse_ of OpenISD scenario
   2, which fixes port geometry (ø5cm×10cm) and computes `Fb=37.9`. A like-for-like `Fb`
   cross-check may therefore not be directly expressible in SBL's flow.

### Open question (still not decided)

Drive the rendered UI (heavier, and blocked on #1 above) vs. find an API/XHR endpoint that
returns computed results directly (would sidestep both blockers if one exists). No network
trace captured yet.

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
