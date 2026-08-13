# Competitive landscape — external tools and data sources

Merges `OTHER_TOOLS.md`, `FEATURES.md`'s "Alternative tools" section, `WINISD_OPENISD_COMPARISON.md`'s
"Web-based alternatives" matrix, and `WINISD.md`'s SpeakerBoxLite CORS finding — four files
independently covering third-party design tools and data sources. WinISD itself is **not**
covered here — it's the parity oracle, not a competitor; see
[`WINISD_PARITY.md`](WINISD_PARITY.md).

> Feature notes for closed tools are taken from their own sites and authors' public posts, not
> independent testing. Treat all claims as ⚠ unverified unless an OpenISD contributor has
> directly compared outputs.

---

## Enclosure/box-type support at a glance

**Legend:** ✅ supported · 🟡 announced / "coming" · ✖ explicitly not-yet (on roadmap) ·
— not offered · ? unknown. **BP4** = 4th-order bandpass · **BP6** = 6th-order bandpass ·
**PR** = passive radiator · **TL** = transmission line.

| Tool                       | Sealed | Vented / ported | BP4 | BP6 | PR  | TL  | Other / notes                                            |
| --------------------------- | :----: | :-------------: | :-: | :-: | :-: | :-: | ------------------------------------------------------------ |
| **OpenISD** (this project) |   ✅   |       ✅        | ✅  | ⬜  | ✅  | ⬜  | BP6 + TL are backlog                                     |
| micka.de `#ideal`          |   ✅   |       ✅        |  —  |  —  |  —  |  —  | sealed/vented calculator only                            |
| SpeakerBoxLite             |   ✅   |       ✅        | ✅  | ✅  | ✅  | ✅  | BP6 both parallel & series — verified live 2026-07-04    |
| SpeakerDesign.dev          |   ✅   |       ✅        | 🟡  | 🟡  | 🟡  |  —  | bandpass/PR/ABC listed as coming                          |
| Sonella                    |   ✅   |       ✅        |  —  |  —  |  —  |  —  | full-range + crossover focus, not subs                   |
| 00 Audio Simulator         |   ✅   |       ✅        | ✅  | ✅  | ✅  |  ✖  | horn also ✖ "not yet" (defers to HornResp)                |
| LoudspeakerLab             |   ✅   |       ✅        |  —  |  —  |  —  |  —  | box subordinate to crossover; B4 default                 |
| SoundForm                  |   ?    |        ?        |  ?  |  ?  |  ?  |  ?  | closed beta — no box data published                      |

OpenISD uses ⬜ (planned) for BP6 and TL; every other tool's cells are that tool's current
published/observed support, not an OpenISD plan.

---

## 00 Audio Simulator (simulator.00aud.io) — closest web competitor

_by mbdavis · free, no login, closed source_

**Role:** A "modern, browser-based WinISD alternative" and the closest feature-match to
OpenISD found so far — overlaps OpenISD's core (WDR import, sealed/vented/bandpass/PR,
excursion + impedance + group delay) and exceeds it in a few areas (port velocity, on-graph
parametric EQ, side-by-side comparison). The most important tool to track.

**What the homepage states** (fetched live 2026-07-04): sealed, bass-reflex (vented),
bandpass (BP4+BP6), passive radiator — matches OpenISD's own `BoxType` coverage closely.
Transmission line and horn marked "not yet" (defers to HornResp). Manual T/S entry, **imports
WinISD `.wdr` files**, Unibox spreadsheet compatibility, "paste a spec-sheet and auto-infer
T/S parameters". Outputs: SPL, cone excursion, impedance, **port velocity**, group delay, plus
a parametric-EQ overlay with draggable filter nodes. Resizable charts, **side-by-side
enclosure comparison**. Client-side SPA, zero-install, offline after load. Projects private by
default, **shareable via explicit link generation**. Interactive schematic signal-path
visualization. ~65 shipped features including an amplifier-load graph and a public voted
roadmap (`simulator.00aud.io/roadmap`) with its own WinISD comparison page.

**Why this one matters most:** it imports `.wdr` — the same interchange format OpenISD
reads/writes — so it's directly comparable driver-for-driver and a strong cross-check-oracle
candidate for sealed/vented/BP/PR. Port velocity and side-by-side comparison are features
OpenISD lacks (see `BACKLOG.md`).

**Not stated on the homepage (⚠ unverified):** no API/XHR endpoint mentioned; no built-in
driver database mentioned (manual/paste/import entry only); "auto-infer T/S from a pasted
spec sheet" accuracy unknown. Driver data and design saves not offered as open-access or
bulk-exportable. The author has publicly pledged to open-source the code if the project goes
inactive — pledge on record, code not yet public.

---

## SpeakerDesign.dev — WinISD-alternative toolkit

_free, no login, closed source_

**Role:** A free, browser-based enclosure-design toolkit positioning its box simulator as
"the ultimate web-based WinISD alternative" — competes directly with OpenISD's space.

**What it offers** (tool survey 2026-07-04): a broad, polished four-tool suite (client-side,
no download, no account; macOS/Windows/iOS/Android) — **Driver Wizard** (guided setup, sealed
presets, vented alignments QB3/SBB4/EBS), **Box Simulator** (same graph set as OpenISD, plus a
full Ql/Qa/Qp box-loss model, 1–4 vents round or slot, selectable end-correction, drag-to-adjust
Vb/Fb with axis locking, frequency-range presets, configurable listening distance), **Box
Calculator** (six assembly cases, driver/port/bracing/lining displacement, cut list), **Cutlist
Optimiser** (bin-packing, kerf, rotation, fractional inches, PDF output). Plus an open
knowledge-base with tutorials.

**Enclosure types:** sealed and vented only as of the survey; bandpass, PR, and ABC listed as
coming. Broader than OpenISD on construction and education, roughly matched on core
simulation. The Box-Calculator + Cutlist-Optimiser combination carries a design past
simulation into physical build output, which OpenISD does not yet do.

**Gaps (⚠ unverified — closed source, not output-tested):** no WinISD `.wdr` import/export
noted — unlike 00 Audio Simulator, not a drop-in driver-for-driver cross-check without manual
T/S re-entry. Closed source; knowledge base not community-editable. No API/XHR endpoint or
readable computed-output panel confirmed — same oracle blocker as SpeakerBoxLite below.

---

## SpeakerBoxLite — second external oracle

_freemium / pay-as-you-go, web + iOS + Android, closed source_

**Role:** The most feature-complete tool in the field: 5,000+ drivers, transmission line, full
crossover suite, 3D enclosure builder, STL port export. Also a second independent cross-check
oracle alongside micka.de (added specifically to cover PR and bandpass, which micka's
`#ideal` calculator can't model) — consumed by
`packages/ui/test/speakerboxlite-crosscheck.browser.spec.ts` via the `sbl` field on each
scenario in `packages/ui/test/scenarios.ts`.

**Enclosure types** (verified live 2026-07-04 by fetching the calculator page): Closed,
Vented, 4th Order Bandpass, 6th Order Bandpass (Parallel), 6th Order Bandpass (Series),
Passive Radiator, Transmission Line. Of these, OpenISD's engine implements Closed, Vented, 4th
Order Bandpass and Passive Radiator; 6th-order (parallel/series split) and Transmission Line
are backlog items — the parallel-vs-series distinction is new information from SpeakerBoxLite
(micka never surfaced it).

**Rendering & automation** (confirmed live 2026-07-04, headless Chromium exploration): a
client-side SPA (Bootstrap-Vue) with no stable `id`/`name` on fields — every input is
`input.form-control`, selectors must key off the row label. Two consent overlays must be
dismissed first (a cookie bar and a Quantcast/IAB privacy popup). The DOM holds hidden
desktop+mobile duplicate controls — a wide viewport and a `:visible` filter are required. Left
panel is tabbed: Speaker (driver T/S: Fs, Vas, Qts, SUB/WOOFER/…, SIMPLE/COMPLEX model,
LITE/EXPANDED params, ONE/MULTIPLE/ISOBARIC) | Network | Enclosure (type dropdown + box
fields, `Ql` defaults to 7) | Box (physical realisation: material thickness, port outside
length, displacement).

**Two blockers to a working crosscheck spec (unresolved):** (1) no output field to read — the
Enclosure fields (Vb/Qtc/Fb/F3) are all *inputs*; entering one and clicking Draw does not
populate the others, and where SBL surfaces its computed numbers as parseable text (vs. graph
pixels only) hasn't been located. (2) the vented model direction likely differs — `Fb` appears
to be an input (not a readout) with port geometry computed from it, the inverse of OpenISD's
scenario 2 (fixed port geometry → computed `Fb`), so a like-for-like `Fb` cross-check may not
be directly expressible in SBL's flow. Open question, undecided: drive the rendered UI
(heavier, blocked on #1) vs. find an API/XHR endpoint (no network trace captured yet).

**Graph discrepancy noted** (from `FEATURES.md`'s survey): for the same driver and box
parameters, SpeakerBoxLite can produce noticeably different curves from OpenISD (and from
WinISD) on some outputs — particularly SPL and excursion. Cause unknown; may be
transfer-function model, loss assumptions, or radiation convention. Open question — anyone who
diagnoses it is encouraged to open an issue or PR with findings.

**API CORS finding** (verified 2026-06-24 via curl): `speakerboxlite.com/api/v1/speakers`
returns `Access-Control-Allow-Origin: *` on **HEAD** requests but omits the CORS header
entirely on **GET** requests. Since browsers always use GET for `fetch()`, every browser-side
fetch to this API is blocked by CORS enforcement — a server-side misconfiguration, no
client-side workaround possible. The site itself remains reachable by direct navigation.
OpenISD exposes SpeakerBoxLite as an opt-in button; clicking it immediately hits this error.
Re-enabling requires either the site adding the header on GET, or OpenISD adding a CORS proxy
(introduces a server dependency).

The driver database (5,000+ entries) is not available as open-access data. Users can export
individual designs but there is no bulk export or community-commons equivalent to `drivers/`.

---

## Sonella — guided DIY speaker-design app

_by Sonella · free tier + account to save_

**Role:** A browser-based, beginner-oriented **full-range speaker** design tool (explicitly
"people who build speakers," not subwoofers). Different niche from OpenISD's sub/enclosure
focus, but relevant for the guided-workflow and crossover angles OpenISD lacks.

**What the homepage states** (fetched live 2026-07-04): a structured 7-step guided workflow
from driver selection through build prep, aimed at users with no prior experience. Driver
selection from "real Dayton Audio drivers" (curated, single-brand database). Sealed or vented
enclosure simulation using T/S parameters. Crossover design — frequencies, filter slopes,
tweeter trim (OpenISD has no crossover modelling). Room/user profile via an initial
questionnaire. Live preview of the bass-response curve as volume changes; interactive 3D
enclosure preview. Cut lists (automatic panel dimensions) and STL export for CAD/3D printing.
Client-side SPA, optional account for saving/exporting.

**Not stated on the homepage (⚠ unverified, gaps for comparison):** no file import mentioned
(export is STL only, no WinISD WDR/JSON); no detailed FR plot, group delay, cone excursion, or
impedance output named; no API/XHR endpoint visible. Scope is narrower on drivers (Dayton
Audio only) but broader on the build (crossover + full multi-way, not just the enclosure).

---

## LoudspeakerLab — automated crossover + system solver

_free, ad-free, web-based · licensing not stated_

**Role:** A different niche from OpenISD: a **full multiway loudspeaker-system designer
centred on passive-crossover synthesis** ("Design passive speakers with measured drivers"),
where the enclosure is one sub-component rather than the whole product. Author not named on
the site (feedback@loudspeakerlab.io).

_Findings below were captured by rendering the SPA with headless Chromium (Playwright) on
2026-07-05 — `WebFetch` returns only the empty app shell, so the FAQ accordions were expanded
and the rendered DOM text read directly (primary evidence). Items still unconfirmed after
rendering are marked ⚠ unverified._

**Automated passive-crossover solver:** multi-objective search over an **ABCD-matrix** circuit
model. Generates many candidate topologies per driver, combines them into full-system layouts
(every woofer topology × every tweeter topology for a 2-way), screens thousands of
system-level sets before refining the best. Filter orders: HP 0–4th, LP 0–4th, plus asymmetric
slopes. Auxiliary networks: attenuation (series R, L-pad, T-pad, Pi-pad, bypassed R), impedance
compensation (R‖L, R‖C, L‖C, Zobel, shunt L/C, damped RL), resonance control (LC traps,
parallel-RLC notch, series L-C-R traps). Seeds proven template families (Butterworth /
Linkwitz-Riley) for 2-way, 3-way, 2.5-way, D'Appolito MTM/WTW, multi-woofer. Values optimised
continuously then snapped to E-series (E24 R/C, E12 L) with real parasitics.

**Solver objectives, default priority order:** on-axis flatness → listening window →
directivity uniformity → distortion avoidance → preference rating → simplicity (fewer parts) →
amplifier-friendly impedance → sensitivity. Not user-customisable in the web UI.

**Measurement-based driver profiles + CTA-2034A:** public community database; profiles built
from uploaded FRD (on-axis SPL+phase; REW/ARTA export), ZMA (impedance mag+phase;
REW/DATS/ARTA/LIMP), optional off-axis FRD, distortion `.txt`, nearfield data. Computes
CTA-2034A curves, Directivity Index, and a Preference Rating, estimating sparse off-axis angles
with a piston-directivity model. Multiple users can upload profiles per driver; a community
accuracy vote surfaces the best. An Evidence score grades measurement provenance; an Expected
Range band shows prediction uncertainty. Benchmarked against Klippel NFS across five DIY kits.

**Enclosure/box modelling — sealed or vented only, subordinate to the crossover.** For drivers
with T/S params it auto-designs a vented or sealed box, merged into each driver's FR *before*
the solver runs. Default alignment B4 vented (Butterworth 4th-order); volume/port tuning from
standard alignment tables indexed by Qts. Baffle step and diffraction are modelled; an
infinite-baffle mode disables diffraction. **No bandpass or passive-radiator box types**
(contrast OpenISD, which ships both).

**Import/export:** crossovers can be imported by pasting a SPICE-derived netlist and fully
analysed without solving; every completed design also exports a SPICE netlist. Schematic
exports as PNG/SVG; plots save as images. Estimated parts cost / vendor shopping lists are
region-aware (US/CA/EU/UK/AU).

**Gaps:** not a WinISD `.wdr` cross-check oracle — interchange is measurement-based (FRD/ZMA +
SPICE netlist), not the lumped-T/S `.wdr` OpenISD uses, so not a drop-in comparison without
re-entry. No subwoofer-focused enclosure coverage (bandpass/PR absent). ⚠ unverified —
open-source status/licensing not stated; no documented API/XHR endpoint; account required to
upload/create/solve/vote (browsing is open).

**Why it matters:** the strongest crossover + system-preference reference surveyed (ABCD
solver + CTA-2034A preference rating), directly relevant to OpenISD's multi-way gap. Its
public, measurement-based driver commons with community accuracy voting is a data-model
contrast to OpenISD's `.wdr` library and to the closed databases of SpeakerBoxLite/00 Audio
Simulator.

---

## SoundForm — closed-beta web WinISD app

_by u/BusyEntrepreneur9636 · closed beta, access by DM_
<https://www.reddit.com/r/diyaudio/comments/1snqre1/new_features_for_web_based_winisd_app/>

In closed beta as of the survey date. No public URL to fetch, so everything here is
second-hand from the author's Reddit posts — ⚠ unverified, not independently tested. Apparent
focus: crossover design and multi-driver (2-/3-way) summation — the multi-way arc OpenISD does
not cover. Too little public information exists to build a feature matrix, so it's
deliberately excluded from the structured comparison tables below rather than filled with
guesses. Worth re-checking once it opens beyond invite-only.

---

## Biquad Cookbook EQ Designer

_by loudifier · free, open source, GitHub-hosted_
<https://loudifier.github.io/Biquad-Cookbook/>

A focused, modern web-based EQ filter designer that complements (not replaces) enclosure
simulators. 15+ filter types (1st/2nd order lowpass, highpass, allpass, shelves, peaking EQ,
bandpass, notch, Linkwitz transform) with real-time visualization across four plot types:
frequency response, phase, impulse response, group delay. Includes a filter optimizer that
matches a target curve or flattens a response. Saves/loads EQ configurations in YAML format.
Orthogonal to OpenISD's scope — Biquad focuses on signal-chain EQ filter design while OpenISD
simulates enclosure acoustics. Users often chain both tools: design an enclosure in OpenISD,
then use Biquad to design corrective EQ to flatten the result.

---

## Structured comparison tables

Captured 2026-07-04 from each tool's own site/roadmap/author posts — ⚠ unverified, no
independent OpenISD testing except OpenISD's own column.

### Access & licensing

| Feature                       | OpenISD | 00 Simulator ⚠           | SpeakerDesign.dev ⚠ | SpeakerBoxLite ⚠     | Sonella ⚠            |
| ----------------------------------- | --------- | --------------------------- | ---------------------- | ----------------------- | ----------------------- |
| Open source                   | ✅ MIT  | ❌ (pledged if inactive) | ❌                  | ❌                   | ❌                   |
| Free, no paywall              | ✅      | ✅ (no login)            | ✅ (no login)       | ❌ freemium          | ✅ (account to save) |
| Runs in browser, zero-install | ✅      | ✅                       | ✅                  | ✅ (+ iOS / Android) | ✅                   |
| Shareable design link (URL)   | ✅      | ✅                       | ⚠                   | ⚠ (export only)      | ⚠                    |

### Box types & scope

| Feature                  | OpenISD         | 00 Simulator ⚠  | SpeakerDesign.dev ⚠ | SpeakerBoxLite ⚠ | Sonella ⚠            |
| --------------------------- | ----------------- | ------------------ | ---------------------- | ------------------- | ----------------------- |
| Sealed + vented          | ✅              | ✅              | ✅                  | ✅               | ✅                   |
| Bandpass (BP4 / BP6)     | ✅ BP4 / 🚧 BP6 | ✅ BP4 + BP6    | 🚧 coming           | ✅               | ❌                   |
| Passive radiator         | ✅              | ✅              | 🚧 coming           | ✅               | ❌                   |
| Transmission line / horn | ❌ (planned)    | ❌ "not yet"    | ❌                  | ✅ TL            | ❌                   |
| Primary scope            | subwoofer / box | subwoofer / box | subwoofer / box     | subwoofer / box  | full-range multi-way |

### Simulation & graphs

| Feature                               | OpenISD          | 00 Simulator ⚠  | SpeakerDesign.dev ⚠ | SpeakerBoxLite ⚠                               | Sonella ⚠            |
| ----------------------------------------- | ------------------ | ------------------ | ---------------------- | ---------------------------------------------------- | ----------------------- |
| Core curves (SPL/excursion/Z/GD/port) | ✅ full set      | ✅              | ✅                  | ⚠ (SPL/excursion differ from OpenISD & WinISD) | 🚧 bass preview only |
| Amplifier-load graph                  | 🚧 planned       | ✅              | ❌                  | ⚠                                              | ❌                   |
| On-graph parametric EQ + HP/LP/LT     | ✅               | ✅ (+ shelves)  | ⚠                   | ⚠                                              | ✅ DSP step           |
| Compare / overlay designs             | ✅ pin + overlay | ✅ side-by-side | ⚠                   | ❌                                             | ⚠                    |
| Interactive schematic / lumped view   | ⬜               | ✅              | ❌                  | ❌                                             | ❌                   |

### Drivers, data & file formats

| Feature                       | OpenISD               | 00 Simulator ⚠      | SpeakerDesign.dev ⚠ | SpeakerBoxLite ⚠ | Sonella ⚠     |
| ---------------------------------- | ------------------------ | ---------------------- | ---------------------- | ------------------- | ---------------- |
| WinISD `.wdr` import / export | ✅ / ✅               | ✅ / ✅             | ❌                  | ⚠                | ❌            |
| WinISD `.wpr` project import  | 🚧                    | ✅                  | ❌                  | ❌               | ❌            |
| Datasheet → T/S auto-infer    | ⬜                    | ✅ (paste)          | ❌                  | ⚠                | ❌            |
| Built-in driver database      | ✅ 2,100+ bundled     | ❌ (import / paste) | ⚠ personal store    | ✅ 5,000+        | ⚠ Dayton only |
| Open / federated driver data  | ✅ commons + scrapers | ❌                  | ❌                  | ❌ (closed DB)   | ❌            |

### Construction, crossover & validation

| Feature                            | OpenISD               | 00 Simulator ⚠ | SpeakerDesign.dev ⚠ | SpeakerBoxLite ⚠ | Sonella ⚠ |
| --------------------------------------- | ------------------------ | ----------------- | ---------------------- | ------------------- | ----------- |
| Cut list / panel breakdown         | ⬜                    | ❌             | ✅                  | ✅               | ✅        |
| 3D enclosure model / STL export    | ⬜                    | ❌             | ✅ 3D               | ✅ 3D + STL port | ✅ STL    |
| Crossover / multi-way summation    | ⬜                    | ❌             | ❌                  | ✅ full suite    | ✅        |
| Provable physics / open model + CI | ✅ (closed-form + CI) | ❌ (closed)    | ❌                  | ❌               | ❌        |

**Where OpenISD stands:** on raw simulation features it is mid-pack — 00 Simulator matches or
leads on graphs and format import, SpeakerDesign.dev and SpeakerBoxLite lead on construction
output, and SpeakerBoxLite alone has transmission line + full crossover. OpenISD's uncontested
edges are the ones no closed tool offers: **open source (MIT), an open + federated driver
commons (2,100+, growing via scrapers), and physics validated against closed-form solutions in
CI.**

---

## A data-source quality finding (not a design tool)

**loudspeakerdatabase.com scraper — third-party collection.** Collection:
`drivers/loudspeakerdatabase/` (14 WDR files). Source: third-party scraper (not WinISD, not
OpenISD's current scraper). Analysis (2026-06-28) found: **EBP computation broken** (6/14
files missing the field entirely, 7/14 written as 0 when it should compute ≈66 from present
Fs/Qes — e.g. Beyma 10BR60 V2). **ParState issues**: all 14 files use one hardcoded constant
(`EEECEENNEENEEEEEEEEEEECENNCCCNNNCCCCECNNNNNNNNECC`), not matching the dynamically-computed
ParState seen in real WinISD files (the `matt` collection) — suggests an older OpenISD scraper
version or an independent implementation. **Metadata issues**: most files dated December 2025
(future dates, likely placeholder), several with empty DateAdded/DateModified, `VCCon=2`
(serial) as default (unusual for single-VC drivers). **Vd/Dd coverage** is suspiciously
perfect (14/14, 0 zeros) vs. the `matt` collection's realistic 9 zeros for Vd.

**Conclusion:** loudspeakerdatabase files exhibit data-quality issues not seen in real WinISD
entries. Not suitable as a reference for validating WDR format, scraper correctness, or WinISD
behaviour — use the `matt` collection (411 real WinISD files) as the authoritative reference.

---

## Open questions

| #   | Tool/Source        | Question                                                                                                                                                                                                                                                                                                                                                                                                                                     | Priority                                                  |
| ----- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | micka.de           | Cross-check oracle for sealed + vented simulations. ⚠ No PR/bandpass support — its `#ideal` form exposes no passive-radiator or bandpass fields.                            | [documented in `test/scenarios.ts`]                         |
| 2   | SpeakerBoxLite     | Second oracle for PR + bandpass (the types micka lacks). Drive-real-UI vs. API-endpoint approach undecided.                                                                                                                                                                                                         | [spec: `speakerboxlite-crosscheck.browser.spec.ts`] |
| 3   | SpeakerDesign.dev  | Self-described "web-based WinISD alternative". Does it expose enclosure types beyond ported, WDR/JSON import-export, or a readable computed output? Potential cross-check oracle + build-output reference.     | Open                                                      |
| 4   | Sonella            | Guided full-range design app with crossover + STL. Relevant to OpenISD's missing guided workflow and crossover modelling, not sub cross-check.                                                                                                                                 | Open                                                      |
| 5   | 00 Audio Simulator | Closest web competitor — imports `.wdr`, covers sealed/vented/BP/PR. Best cross-check-oracle candidate: is there a readable computed output or an XHR endpoint behind the share-link flow?                     | Open                                                      |
| 6   | SoundForm          | Closed-beta web WinISD app focused on crossover + multi-driver summation. Re-evaluate when it opens past invite-only; no feature data yet.                                                                     | Open                                                      |
| 7   | LoudspeakerLab     | Automated crossover + system solver on a CTA-2034A driver commons. Not a `.wdr` cross-check oracle (measurement/spinorama data model). Track as prior art for the crossover/multi-way + preference-rating arc. | Open                                                      |
| 8   | REW                | Impedance + FR measurement reference                                                                                                                                                                                | Open                                                      |
| 9   | LEAP               | High-end simulation suite comparison                                                                                                                                                                                | Open                                                      |
