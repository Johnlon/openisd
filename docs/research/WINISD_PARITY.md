# WinISD parity — feature comparison, field-by-field evidence, and investigation notes

This document merges three prior files (`WINISD_OPENISD_COMPARISON.md`, `docs/winisd/INPUT_PARITY.md`,
`WINISD.md`) that independently covered openisd's relationship to WinISD at different
granularity — a feature comparison table, a screenshot-sourced UI field parity ledger, and a
grab-bag of investigation findings. One file now, not three, so there is one place with the
current answer to "does openisd match WinISD on X."

It distinguishes **confirmed** facts (user-observed, sourced), **inferred** conclusions
(deduced from data), and **unverified** assumptions (plausible but not confirmed).

**Confidence markers** (WinISD column, per the project's anti-hallucination rule):

- ✅ Confirmed — source: this document, the WinISD help file, direct user observation, or a
  WinISD 0.7.0.950 screenshot in [`docs/winisd_screenshots/`](../winisd_screenshots/) (Part 2 ties each fact to a
  named screenshot).
- ❌ Confirmed absent — observed directly or follows from platform constraints.
- ❔ Untested — nobody has run a test for this row. Not a soft yes and not a soft no.

**Every row states the test that verified it.** A mark with no quoted test is `❔`, never a
bare ✅/❌. On the OpenISD side "the field exists" is not a test — the row names the line that
CONSUMES the value, or the test that exercises it; a declared-but-unconsumed field is recorded
as inert, not as ✅.

Third-party competitor tools (00 Simulator, SpeakerDesign.dev, SpeakerBoxLite, Sonella) are
**not** covered here — WinISD is the parity oracle, not a competitor. See
[`COMPETITIVE_LANDSCAPE.md`](COMPETITIVE_LANDSCAPE.md).

---

# Part 1 — Feature comparison

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

## Box types & simulation models

| Feature                                               | OpenISD                                                                                                                                                                                                | WinISD                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Sealed (closed)                                       | ✅                                                                                                                                                                                                     | ✅ confirmed                                                                         |
| Vented (bass-reflex)                                  | ✅                                                                                                                                                                                                     | ✅ confirmed                                                                         |
| 4th-order bandpass                                    | ✅                                                                                                                                                                                                     | ✅ confirmed                                                                         |
| 6th-order bandpass (both chambers ported)             | 🚧                                                                                                                                                                                                     | ✅ confirmed — in the box-type list; both chambers' tunings are free fields          |
| ABC (Aperiodic Bi-Chamber)                            | 🚧                                                                                                                                                                                                     | ✅ confirmed — in the box-type list; two vented chambers, both tunings free          |
| Passive radiator                                      | ✅                                                                                                                                                                                                     | ✅ confirmed                                                                         |
| Isobaric / compound loading                           | 🚧                                                                                                                                                                                                     | ✅ confirmed — Driver tab "Iso-Barik" radio (view_1_driver…iso-barik.png)            |
| Multiple drivers (series / parallel wiring)           | ✅                                                                                                                                                                                                     | ✅ confirmed                                                                         |
| Box loss model (Ql leakage, Qa absorption)            | ✅ default Ql=10, Qa=100                                                                                                                                                                               | ✅ confirmed — same defaults (WinISD help file + direct observation)                 |
| WinISD-compatible circuit model                       | ✅ (default mode)                                                                                                                                                                                      | ✅ confirmed                                                                         |
| Full gyrator (frequency-dependent Le)                 | ✅ switchable                                                                                                                                                                                          | ❌ confirmed — Le excluded from WinISD's acoustic circuit (Part 3 §9)                |
| Transmission-line port model                          | ✅ branches port impedance at `engine/src/circuit.ts:69`; tested `advanced-options.test.ts` → "transmission-line port model"                                                                           | ✅ confirmed — Advanced "Use transmission line-model for port" (view_6_advanced.png) |
| Environment model (temp / humidity / pressure → c, ρ) | ⚠ temperature only: `tempK` consumed at `engine/src/circuit.ts:64-66`; `humidityPct`/`pressurePa` appear only in `ui/src/types.ts:225` and `OriginalShell.vue:536-537` — grep finds no engine consumer | ✅ confirmed — Advanced pane derives c=343.68 m/s, ρ=1.20095 (view_6_advanced.png)   |
| Force-flat response                                   | ✅ consumed at `engine/src/sweep.ts:118`                                                                                                                                                               | ✅ confirmed — Advanced "Force flat response" toggle (view_6_advanced.png)           |
| Source-resistance placement (Rg at driver side)       | ✅ consumed at `engine/src/circuit.ts:116`; tested `advanced-options.test.ts` → "Rg placement"                                                                                                         | ✅ confirmed — Advanced "Rg is at driver side" toggle (view_6_advanced.png)          |
| Xmax-limited SPL toggle                               | ✅ selects `splXlim` vs `spl` at `ui/src/utils/series.ts:38-39`; plus a separate Max-SPL chart                                                                                                         | ✅ confirmed — Advanced "SPL graph is Xmax limited" toggle (view_6_advanced.png)     |

## Simulation curves

| Feature                                    | OpenISD                                                                                                                                          | WinISD                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| SPL (sound pressure level)                 | ✅                                                                                                                                               | ✅ confirmed                                                                                  |
| Driver excursion (Xmax)                    | ✅                                                                                                                                               | ✅ confirmed                                                                                  |
| PR excursion                               | ✅                                                                                                                                               | ✅ confirmed — "Cone excursion (PR)" (chart_dropdown.png)                                     |
| Port air velocity                          | ✅                                                                                                                                               | ✅ confirmed — front/rear port "Air velocity" (chart_dropdown.png)                            |
| Impedance magnitude                        | ✅                                                                                                                                               | ✅ confirmed                                                                                  |
| Impedance phase                            | ✅                                                                                                                                               | ✅ confirmed — "Impedance phase" (chart_dropdown.png)                                         |
| Group delay                                | ✅                                                                                                                                               | ✅ confirmed                                                                                  |
| Transfer phase                             | ✅                                                                                                                                               | ✅ confirmed — "Transfer function phase" (chart_dropdown.png)                                 |
| EQ/Filter chain response (mag/phase/GD)    | ✅ `FltMag`/`FltPhase`/`FltGD`, real working curve builders — `types.ts:22-24`, `series.ts:189,201,212` (verified 2026-08-13, see Part 2 Charts) | ✅ confirmed — "(EQ/Filter)" chart group                                                      |
| Max SPL curve (excursion-limited)          | ✅                                                                                                                                               | ✅ confirmed — "Maximum SPL" (chart_dropdown.png)                                             |
| Max power curve (thermal-limited)          | ✅                                                                                                                                               | ✅ confirmed — "Maximum Power" (chart_dropdown.png)                                           |
| Amplifier apparent load power (VA)         | 🚧 menu entry present, `tab: null` — no chart behind it                                                                                          | ✅ confirmed — "Amplifier apparent load power (VA)" (chart_dropdown.png)                      |
| Port "Gain" curve                          | 🚧 (velocity only), menu entries `tab: null`                                                                                                     | ✅ confirmed — front/rear port "Gain" (chart_dropdown.png)                                    |
| PR-specific transfer-function/phase curves | ❌ no PR-variant `ChartTabId` exists (verified 2026-08-13)                                                                                       | ✅ confirmed — "TF magnitude/phase (PR)" (chart_dropdown.png)                                 |
| Compare / overlay multiple designs         | ✅ pin + overlay                                                                                                                                 | ✅ confirmed — two checked projects, two curves overlaid (view_3_ported.png) — see note below |
| Cursor with frequency / value readout      | ✅                                                                                                                                               | ✅ confirmed — header shows "38.01 Hz / −9.896 dB" readout (view_5_signal.png)                |
| Cursor peak snap                           | ✅ right-click snap                                                                                                                              | ❌ confirmed                                                                                  |
| Cursor lock and nudge                      | ✅                                                                                                                                               | ❔ untested                                                                                   |

> **⚠ Correction — WinISD _does_ overlay multiple designs.** `docs/winisd_screenshots/view_3_ported.png`
> shows two projects ("Epique15 - pr" and "Epique15-ported") both checked in the Projects
> pane with both transfer-function curves drawn on one graph. This contradicts an earlier
> claim in Part 3 §9 that WinISD cannot compare designs — that section is corrected below.
> OpenISD's differentiator is not _whether_ it overlays but _how_ (pin + overlay on a single
> project vs. WinISD's checkbox-per-project list).

## Signal chain & drive conditions

| Feature                              | OpenISD                                                                          | WinISD                                                                                        |
| ------------------------------------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Drive voltage (2.83 V IEC reference) | ✅                                                                               | ✅ confirmed — `Eg = sqrt(P × Re)`                                                            |
| Arbitrary input power / voltage      | ✅                                                                               | ✅ confirmed — Signal pane power/voltage fields (view_5_signal.png)                           |
| Series source resistance (Rs)        | ✅                                                                               | ✅ confirmed — Signal pane "Series resistance" (view_5_signal.png)                            |
| High-pass filter                     | ✅                                                                               | ✅ confirmed — Filter Editor Highpass/Butterworth (view_4_filters_edit_highpass.png)          |
| Low-pass filter                      | ✅                                                                               | ✅ confirmed — "Lowpass (Butterworth, n=2)" in filter list (view_4_filters_edit_highpass.png) |
| Linkwitz transform                   | ✅                                                                               | ✅ confirmed — filter type (view_4_filters_edit_linkwitz_transform.png)                       |
| Parametric EQ (peaking)              | ✅                                                                               | ✅ confirmed — filter type (view_4_filters_edit_parametric_eq.png)                            |
| Multiple filters in a chain          | ✅                                                                               | ✅ confirmed — filter list with Add/Delete/Modify (view_4_filters_edit_highpass.png)          |
| All-pass filter                      | ❌ (BACKLOG) confirmed absent — `FilterType` closed union, `engine/types.ts:137` | ✅ confirmed — filter type (view_4_filters_edit_allpass.png)                                  |
| DLP raised-cosine (delay) filter     | ❌ (BACKLOG) confirmed absent — `FilterType` closed union                        | ✅ confirmed — filter type (view_4_filters_edit_dlp_raised_cosine.png)                        |
| Static-gain filter                   | ❌ (BACKLOG) confirmed absent — `FilterType` closed union                        | ✅ confirmed — filter type (view_4_filters_edit_statis_gain.png)                              |
| Configurable listening distance      | ❌ fixed 1 m                                                                     | ✅ confirmed — Signal pane "Distance (m)" (view_5_signal.png)                                 |
| Off-axis listening angle             | ❌                                                                               | ✅ confirmed — Signal pane "Angle (rad)" (view_5_signal.png)                                  |

## Alignment & design tools

| Feature                                    | OpenISD    | WinISD                                                                                                                                         |
| ------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| EBP (Efficiency Bandwidth Product) gauge   | ✅         | ✅ confirmed — EBP is a driver-editor field (Advanced parameters)                                                                              |
| Butterworth (Qtc = 0.707) sealed auto-Vb   | ✅         | ❌ confirmed absent — same three checks as the QB3 row below. OpenISD-only                                                                     |
| QB3 / B4 vented auto-align                 | ✅         | ❌ confirmed absent — no UI affordance, no alignment vocabulary in WinISD's help files, no `15.0`/`2.87` constants in the binary. OpenISD-only |
| Vent ↔ tuning frequency solver             | ✅         | ✅ confirmed — the Vents tab IS this: enter Vb/Fb/diameter, it returns the length                                                              |
| PR mass auto-tune to target Fp             | ✅         | ❔ untested                                                                                                                                    |
| Key stats readout (F3, Qtc, Fb/Fp, peak Z) | ✅ StatBar | ❔ untested                                                                                                                                    |
| Baffle-step / diffraction correction       | 🚧         | ❔ untested                                                                                                                                    |
| Step response (inverse FFT)                | 🚧         | ❔ untested                                                                                                                                    |

## Driver & PR management

| Feature                                   | OpenISD             | WinISD                           |
| ----------------------------------------- | ------------------- | -------------------------------- |
| Built-in driver library (search / browse) | ✅ JSON, extensible | ✅ confirmed (.wdr database)     |
| Import driver from file                   | ✅ .wdr             | ✅ confirmed                     |
| Export driver to file                     | ✅ .wdr             | ✅ confirmed                     |
| Community driver contributions            | ✅ GitHub PR        | ❌ confirmed (abandoned project) |
| PR library (save / recall)                | ✅ localStorage     | ❔ untested                      |
| Edit T/S parameters in-app                | ✅                  | ✅ confirmed                     |

## File formats

| Feature                            | OpenISD                                 | WinISD    |
| ---------------------------------- | --------------------------------------- | --------- |
| WinISD `.wdr` driver import        | ✅                                      | ✅ native |
| WinISD `.wdr` driver export        | ✅                                      | ✅ native |
| WinISD `.wpr` project import       | 🚧 (writer ships; reader not built yet) | ✅ native |
| JSON project save / load           | ✅                                      | ❌        |
| Shareable URL (full state encoded) | ✅                                      | ❌        |

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

## Planned but not yet implemented (OpenISD todo)

See [`BACKLOG.md`](../../BACKLOG.md) to claim one or discuss prioritisation.

| Feature                                   | Notes                                                                                                                                                                                   |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6th-order bandpass                        | Good first issue — template already exists as 4th-order                                                                                                                                 |
| Isobaric / compound loading               | Good first issue — acoustic circuit extension                                                                                                                                           |
| Baffle-step / diffraction correction      | Well-understood model; needs a curve and a UI toggle                                                                                                                                    |
| Step response curve                       | Inverse FFT of transfer function; rendering work only                                                                                                                                   |
| `.wpr` WinISD project import              | Reader only — plain INI text, schema documented, writer already ships (`winisd/src/classic/wpr.ts:128` `toWpr()`); sample in `docs/winisd_screenshots/sample_project_Epique15_-_pr.wpr` |
| Mobile / small-screen layout              | Responsive CSS pass; no new physics                                                                                                                                                     |
| Measurement import (REW `.mdat`, FRD)     | Would allow measured response overlay alongside simulation                                                                                                                              |
| Impedance measurement → T/S extraction    | Closed-box or added-mass method; valuable for DIY builders                                                                                                                              |
| Multi-way SPL summation (with crossovers) | Large feature; needs crossover design first                                                                                                                                             |
| Crossover design                          | Out of scope for v1; see VituixCAD for now                                                                                                                                              |
| Polar response / directivity              | Out of scope for v1                                                                                                                                                                     |

---

# Part 2 — Per-pane field-by-field parity (Original skin only)

Evidence-based comparison built by reading the WinISD 0.7.0.950 screenshots in
[`docs/winisd_screenshots/`](../winisd_screenshots/) against OpenISD's actual **Original**-skin UI (`OriginalShell.vue`
and its sub-components) and engine — Classic/Modern are not parity targets.
**Source of each row is the named screenshot**, unless otherwise marked as code-verified.

Legend: ✅ OpenISD has an input/feature · ❌ OpenISD lacks it · ⚠️ partial / different.

**Every claim below was independently verified against the live code on 2026-08-13** — 6 rows
were found wrong (or partially wrong) against a first-draft version of this ledger, all
corrected below with file:line evidence, not left as originally written.

## Driver editor → Parameters tab (`edit_driver_pg2_parameters.png`)

WinISD's own colour legend on this tab is the ParState model verbatim:
**🟩 Entered · 🟦 Calculated · ⬛ Not available**, plus an "Auto calculate unknowns" toggle.

| WinISD field                                              | OpenISD                 |
| --------------------------------------------------------- | ----------------------- |
| Fs, Vas, Qms, Qes, Qts                                    | ✅                      |
| Mms, Cms, Rms, BL, Le, Re, Sd, Dd                         | ✅                      |
| fLe, KLe                                                  | ✅ (raw passthrough)    |
| Xmax, Hc, Hg, Pe, Vd                                      | ✅                      |
| **Xlim** (mechanical excursion limit, separate from Xmax) | ⚠️ stored, not modelled |
| no (η₀), Znom, SPL, Voicecoils, Connection                | ✅                      |
| **USPL** (dB)                                             | ⚠️ stored, not modelled |

## Driver editor → Advanced parameters tab (`edit_driver_pg3_advanced_parameters.png`)

| WinISD field                                                          | OpenISD                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Thermal: AlfaVC, R(t), C(t)                                           | ✅ (raw; not simulated)                                                                                                                                                                                                                                                          |
| Environment: c, roo                                                   | ✅ the record's own `c`/`roo` are read by `solveConsistencyGroup` via `airOf()` — `engine/src/driver.ts:30-35` — so a WinISD-authored driver reproduces its own `no`/`SPL`; the sweep's air is temperature-derived at `engine/src/circuit.ts:64-66`, not taken from these fields |
| Figure-of-merit: EBP                                                  | ⚠️ computed as a gauge, not an editable field                                                                                                                                                                                                                                    |
| Figure-of-merit: **SPLmaxLF, SPLmax, Rme, gamma, Mpow, Mcost, Gloss** | ⚠️ all present as fields, but `modeled: false` — shown as "calculated" while nothing computes them                                                                                                                                                                               |

## Driver editor → Dimensions tab (`edit_driver_pg4_dimensions.png`)

| WinISD field                                           | OpenISD                                             |
| ------------------------------------------------------ | --------------------------------------------------- |
| Thick, Depth, Magnet Depth, Magnet, Basket, Outer, VCd | ✅                                                  |
| **Dvol** (driver displacement volume)                  | ⚠️ stored, not modelled (a Weight field exists too) |

## Driver editor → General tab (`edit_driver_pg1_text.png`) — not detailed here (metadata: brand/model/comment).

### Field purposes (verified from WinISD help — Claus Futtrup, condensed)

Source: WinISD's own help, `articles/thielesmall.html`. "OpenISD:" notes record how our
engine actually uses each field, verified against `packages/engine`.

**Thiele/Small** — Fs (free-air resonance; _OpenISD: core input, every graph depends on it_),
Qes (electrical Q), Qms (mechanical Q), Qts (total = Qms‖Qes; _enter any 2 of the trio, the
third is computed_), Vas (_core input_).

**Electro-mechanical** — Mms (moving mass incl. air load), Cms (suspension compliance), Rms
(mechanical damping), Re (DC coil resistance; _OpenISD+WinISD power reference: P=V²/Re, Znom
is NOT used_), BL (force factor), Dd (diaphragm diameter, Sd=π·(Dd/2)²), Le (_OpenISD: only
shapes the impedance plot — circuit.ts keeps Le out of the acoustic path_), Sd (_core input_),
fLe / KLe (Vanderkooy lossy-inductance model parameters).

**Large-signal** — Xmax (_OpenISD: cone-excursion limit + excursion-limited part of Max SPL_),
Xlim (damage-limit excursion; WinISD field, not in our WDR schema), Hc/Hg (voice-coil
winding/gap height), Vd (=Sd×Xmax), Pe (_OpenISD: Max power + thermal-limited part of Max
SPL_).

**Miscellaneous** — no/η₀ (reference efficiency), Znom (**WinISD's own help: "not used in
simulation"** — _OpenISD matches: label-only_), USPL (voltage sensitivity), SPL (power
sensitivity), Voicecoils/numVC.

**Thermal** (WinISD: "not used yet in simulations") — AlfaVC (VC resistance temp coefficient,
copper ≈0.0039), R(t)/C(t) (thermal resistance/capacity).

**Figure of merit** (all derived/read-only) — SPLmaxLF, SPLmax, Rme, gamma, Mpow (=√Rme),
Mcost, EBP (=Fs/Qes), Gloss.

**Environment** — c (_OpenISD: autofills 343 m/s, state C, overridable_), roo/ρ (_autofills
1.2, state C, overridable_).

**Dimensions** — Thick, Depth, Magnet Depth, Magnet, Basket (baffle cutout diameter), Outer
(baffle clearance diameter), VCd, Dvol (driver displacement volume).

---

## Driver project pane (`spl.png`, `tx_fn_mag.png`)

| WinISD field                                         | OpenISD                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand, Model, Num. of drivers, Voice coil connection | ✅                                                                                                                                                                                                                                                                                                                  |
| **Iso-Barik** (isobaric loading, vs "Standard")      | 🚧 radio shown for parity; only Standard is modelled                                                                                                                                                                                                                                                                |
| **Voice coil temp rise (K)**                         | ✅ live and engine-wired: `OriginalShell.vue:1175` `state.P.vcTempRise` → `circuit.ts:117` `hotRe(drv.Re, P.alfaVC, P.vcTempRise)` (corrected 2026-08-13 — a first draft of this row said ❌; that was checked against the Classic skin's disabled stub, not Original)                                              |
| Voice coil resistance TC = AlfaVC                    | ✅ (stored, consumed by the same `hotRe()` call above)                                                                                                                                                                                                                                                              |
| **Added mass to cone (kg)** — driver                 | ✅ live and engine-wired: `OriginalShell.vue:1177` `state.P.driverAddedMass` → `engine/sweep.ts:126` `withAddedMass()`, WinISD-verified physics in `fieldRegistry.ts:431` (+100g on a ~14.6g cone shifts Fs 70→25 Hz) (corrected 2026-08-13 — same Classic-vs-Original mistake as above; only PR added-mass exists) |
| Placement (button)                                   | ❔ contents not captured in these shots                                                                                                                                                                                                                                                                             |

## Box pane (`view_2_box.png`) — parity

Volume, Fh, and an Advanced→ (losses). OpenISD has Vb + Ql/Qa/Qp.
**⚠ Two different states for the two non-sealed box types under the "Fh" label:**

- **PR box: ✅ fixed.** `OriginalShell.vue:134-142`'s `prFh` computed calls `prTuning(state.P)`
  specifically — WinISD's own PR system tuning, not the sealed formula. Matches WinISD's
  72.25 Hz reference exactly (vs. the sealed formula's wrong 194.87 Hz). Part 3 §GAPS.
- **Vented box: still ⚠ WRONG, confirmed unfixed (2026-08-13).** `boxResonance`
  (`OriginalShell.vue:143-144`, `selectedBox.value === 'pr' ? prFh.value : rearResonance.value`)
  falls through to `rearResonance` — the **sealed**-box `Fsc` formula — for every non-PR box,
  vented included. A plain vented box's "Fh" readout still shows the wrong quantity.

## Passive Radiator pane (`view_3_passive_radiator.png`) — parity

Vas, Fs, Qms, Sd, Xmax, Num. of PRs, Added mass, Fs-with-added-mass. OpenISD's PR panel
(`prSd/prNum/prMmd/prMadd/prCms/prRms/prXmax`, winisd/T-S modes) covers these. ✅

## Signal pane (`view_5_signal.png`)

| WinISD field                                                | OpenISD                      |
| ----------------------------------------------------------- | ---------------------------- |
| System input power, Driver input voltage, Series resistance | ✅                           |
| **Listening Distance** (m)                                  | ❌ fixed at 1 m (BACKLOG P1) |
| **Angle** (rad, off-axis)                                   | ❌ not modelled              |

## Advanced (project) pane (`view_6_advanced.png`)

| WinISD field / toggle                                                                   | OpenISD                                                                                   |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Temperature, Relative humidity, Air pressure** → derived Sound velocity + Air density | ⚠️ temperature drives c/ρ; humidity and pressure are collected but never reach the engine |
| Simulate voice coil inductance                                                          | ⚠️ equivalent via WinISD/gyrator circuit-model switch (`fieldRegistry.ts:281-283`)        |
| **Force flat response**                                                                 | ✅                                                                                        |
| **Use "transmission line" model for port**                                              | ✅                                                                                        |
| **Rg is at driver side** (source-resistance placement)                                  | ✅                                                                                        |
| **SPL graph is Xmax limited**                                                           | ✅ (plus a separate Max-SPL chart)                                                        |

## Project pane (`view_7_advanced.png`) — Creator/Created/Modified/Description metadata

✅ **Confirmed live** (corrected 2026-08-13 — a first draft said these fields don't exist).
All five are live `v-model` bindings in `OriginalShell.vue:1385-1392`, auto-populated on
project creation (`:271-274`, `:316-321`) and stamped on save (`:780`).

## App Options (`options_general.png`)

| WinISD                                                                         | OpenISD                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Environment defaults (Temp/Humidity/Pressure → Sound velocity)                 | ⚠️ exists but calc-incomplete — `OptionsModal.vue:182-192` has the full `envDefaults.{tempK,pressurePa,humidityPct}` section; only `tempK` reaches `circuit.ts` (corrected 2026-08-13 — a first draft said ❌ doesn't exist at all)                                                                                                                                                                                                                                                 |
| App-level environment silently overriding a project's own Advanced-pane T/RH/p | **Fixed.** WinISD lets its app-level Options environment substitute for a project's own stated temperature/humidity/pressure, so two projects with identical Advanced-pane values can simulate differently depending on global app state. OpenISD has no such override: a project's air always comes from that project's own environment fields. `useWinisdAirModel` (which formula computes the air — WinISD's or the physical CIPM-2007 model) is a separate, unaffected setting. |
| **Units: metric ↔ imperial**                                                   | ⚠️ imperial units throughout (cu ft, cu in, in, in², oz, °F) via per-field toggles; no single global metric↔imperial mode (confirmed 2026-08-13 — no global toggle found anywhere, only per-field `UnitToggle` components)                                                                                                                                                                                                                                                          |
| Plot Window options (`options_plot_window.png`)                                | not detailed here                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

---

## Filters — WinISD filter types (from `view_4_filters_edit_*.png` filenames)

WinISD offers: **allpass, DLP raised-cosine, highpass, Linkwitz transform, lowpass,
parametric EQ, peaking / 2nd-order highpass, static gain.**

| Filter                            | OpenISD |
| --------------------------------- | ------- |
| High-pass, Low-pass (Butterworth) | ✅      |
| Linkwitz transform                | ✅      |
| Parametric / peaking EQ           | ✅      |
| **All-pass**                      | ❌      |
| **DLP raised-cosine** (delay)     | ❌      |
| **Static gain**                   | ❌      |
| High-shelf / low-shelf            | ✅      |

**Confirmed fully accurate 2026-08-13**: `FilterType` (`packages/engine/src/types.ts:137`) is
a closed union — `'highpass' | 'lowpass' | 'linkwitz' | 'peaking' | 'lowshelf' | 'highshelf'`.
No all-pass, no raised-cosine/delay, no static-gain anywhere in the codebase.

## Charts — WinISD chart types (`chart_dropdown.png`)

WinISD: TF magnitude/phase, Group Delay, Maximum Power, Maximum SPL, **Amplifier apparent
load power (VA)**, SPL, Cone excursion, Impedance, Impedance phase, TF magnitude/phase (PR),
Cone excursion (PR), Rear/Front port **Air velocity** and **Gain**, **Intrachamber Port air
velocity**, TF/phase/GD (EQ/Filter).

OpenISD: SPL, Excursion, Port velocity, Group delay, Impedance mag, Impedance phase, Transfer
phase, Max-SPL, Max-power, **EQ/Filter magnitude/phase/group-delay** (`FltMag`/`FltPhase`/
`FltGD`).

**OpenISD lacks (confirmed 2026-08-13)**: Amplifier apparent load power (VA) — menu entry
present, `tab: null` (`OriginalShell.vue:222`); port **Gain** curves (velocity only, same
`tab: null` pattern, `:231,233`); **Intrachamber port** velocity (`:234`, needs 6th-order
bandpass); PR-specific TF/phase curves (no PR-variant `ChartTabId` member exists).

**Correction (2026-08-13) — OpenISD does NOT lack EQ/Filter charts.** An earlier draft of this
row claimed OpenISD lacks "the EQ/Filter- and PR-specific transfer-function/phase curves" as
one combined claim. Checked directly: `FltMag`/`FltPhase`/`FltGD` are real `ChartTabId`
members (`types.ts:22-24`, comment-labeled "WinISD's '(EQ/Filter)' charts") with working curve
builders (`series.ts:189,201,212`), not stubs. Only the PR-specific half of the original claim
was accurate.

---

## The air constants — definitive

WinISD's Advanced pane derives, from **Temperature 293.15 K (20 °C)**, 30 % RH, 101325 Pa:

- **Sound velocity c = 343.68 m/s**
- **Air density ρ = 1.20095 kg/m³**

OpenISD matches both exactly: `constants.ts` sets `C = 343.68`, `RHO = 1.20095`.

---

## Biggest real gaps (priority view)

1. **Box-pane resonance shows the wrong quantity for a plain vented box** — a wrong number
   under a WinISD field name, which reads as verified parity. The PR-box half of this same
   defect is fixed; the vented half is not (see Part 2 "Box pane" above).
2. **Environment model** — WinISD derives c/ρ from temperature, humidity AND pressure.
   OpenISD's values match WinISD's, but only temperature is wired: humidity and pressure are
   collected, persisted, and ignored.
3. **Off-axis + configurable listening distance** — OpenISD is fixed 1 m on-axis.
4. **Figure-of-merit read-outs are declared "calculated" but nothing computes them.** `Rme`,
   `gamma` and `Mpow` have closed forms confirmed against WinISD; `Gloss`, `SPLmaxLF`,
   `SPLmax` and `Mcost` have none known.
5. **Filters**: all-pass, raised-cosine delay, static gain.
6. **Charts**: amplifier VA load, port gain, intrachamber velocity, PR-specific TF/phase.
7. **Enclosure types**: isobaric, 6th-order bandpass and ABC are offered but unmodelled.
8. **Vents**: vent count (1–4) and slot/rectangular vents are absent.

---

# Part 3 — Investigation notes

## 1. SPL reference convention

### Observation (user-reported)

Same driver, same box: WinISD showed **92.6 dB**, OpenISD showed **94.4 dB** —
a fixed +1.8 dB offset.

### OpenISD's original formula

```
eg = sqrt(Pin × Re)
```

where `Pin` defaults to 1 W and `Re` is the driver's DC resistance.

For Re ≠ 8 Ω this diverges from the IEC sensitivity reference voltage of 2.83 Vrms.

### Inferred cause

If WinISD uses 2.83 Vrms fixed as its simulation voltage, the offset would be:

```
ΔdB = 20 · log10(sqrt(Re) / sqrt(8))  =  10 · log10(Re / 8)
```

For a 1.8 dB offset: `Re ≈ 12 Ω` (consistent with a nominal 16 Ω driver or a high-Re
voice coil).

### ✓ Confirmed: WinISD uses sqrt(Pin × Re) — Re only, not Re+Rs

**Initial (wrong) reading:** User observed WinISD showing 11.7 V at 40 W with Rs=0.1 Ω and
back-calculated Re+Rs ≈ 3.42 Ω. This briefly suggested WinISD included Rs in the voltage formula.

**Corrected by second observation (2026-06-24):**

- Same driver: Re=3.4 Ω, Rs=0.1 Ω, Pin=1 W
- WinISD displayed **1.8 V**
- `sqrt(Re + Rs) = sqrt(3.5) = 1.871` — does NOT round to 1.8
- `sqrt(Re) = sqrt(3.4) = 1.844` — rounds to **1.8** ✓
- Formula confirmed: `Eg = sqrt(Pin × Re)` — Rs is in the circuit but NOT in the voltage reference

Confirmed independently from WinISD help file (`docs/winisd_helpfiles/help/plottypes.html`):

> "The power applied can be related to excitation voltage with following relation:
> **Eg = sqrt(P × Re)**, or P = Eg²/Re"

Forum corroboration (talkbass.com, thread "WinISD and sensitivity ratings"):

> "WinISD uses Re to calculate sensitivity" — Rick James

### Current OpenISD implementation (matches WinISD)

```
eg = sqrt(Pin × Re)          // Re only — matches WinISD convention
Zcoil = (Re + Rs) + jω·Le   // Rs still in the circuit, just not the voltage reference
```

Note: 2.83 V is the IEC 60268-5 sensitivity standard and is _not_ what WinISD uses.
WinISD's Re-based convention means its SPL curves are reference-power curves, not
IEC sensitivity curves.

### ✓ Confirmed: 2.83V IEC mode matches "2.83V/1m" datasheets for 8Ω drivers (2026-06-24)

Test driver: **Morel UW 1258** (8Ω nominal). Measured on IEC baffle, Brüel & Kjær 3144 mic.
Datasheet: **"Sensitivity 2.83V/1m 87 dB SPL"**

| Tool                   | Parameters                 | Voltage | SPL                 |
| ---------------------- | -------------------------- | ------- | ------------------- |
| OpenISD 2.83V IEC mode | OpenISD entry              | 2.83V   | **87.0 dB** ✓       |
| WinISD                 | Built-in Morel DB entry    | 2.83V   | 86.59 dB (−0.41 dB) |
| WinISD                 | .wdr exported from OpenISD | 2.83V   | **87.1 dB** ✓       |

The 0.41 dB gap with WinISD's built-in entry was a **parameter difference** (different T/S values in
WinISD's database vs the datasheet). With identical parameters (via .wdr export), both tools agree
to within 0.1 dB — rounding noise.

IEC baffle (1.2×1.2 m flat baffle) is half-space (2π sr) — identical to WinISD/OpenISD radiation model.
For 8Ω drivers with explicit "2.83V/1m" datasheet specs, the 2.83V IEC mode is correct.

### ⚠ Observed sensitivity offset vs datasheet (2026-06-24)

Test driver: Tang Band W5-1138SMF (Re ≈ 3.24 Ω, 4 Ω nominal). Datasheet: **82 dB 1W/1m**.

| Drive condition       | WinISD SPL | Spec                    |
| --------------------- | ---------- | ----------------------- |
| 1 W, 1.8 V (sqrt(Re)) | 79.75 dB   | 82.00 dB → **−2.25 dB** |
| 1.5 W, 2.3 V          | 82.3 dB    | 82.00 dB → **≈ match**  |

**Conclusion:** The datasheet "1W/1m" was measured at Z(1 kHz) ≈ 5.3 Ω, giving Vref = sqrt(5.3) ≈ 2.3 V.
WinISD uses sqrt(Re) = 1.8 V, which is lower, producing a ~2.25 dB systematic shortfall vs
manufacturer sensitivity specs for low-Re drivers.

**To match a datasheet sensitivity in WinISD/OpenISD:** set input power so that
`sqrt(Pin × Re) ≈ sqrt(Z_measurement_freq)`, i.e. `Pin = Z_meas / Re` watts.
For this driver: Pin ≈ 5.3 / 3.24 ≈ 1.63 W.

## 2. Passive radiator parameter entry

### User-reported WinISD PR input fields

WinISD takes the following for a passive radiator:

```
Vas, Qms, Fs, Sd, Xmax, numPR, added_mass
```

WinISD **outputs** "Fs with added mass" — the free-air resonance of the PR with the
added mass attached (no box).

### Derivation WinISD performs

WinISD does **not** ask for Mms directly. It derives it:

```
Cms = Vas / (Sd² × ρc²)
Mms = 1 / ((2π·Fs)² × Cms)
Rms = sqrt(Mms / Cms) / Qms
```

This is internally identical to entering {Mms, Cms, Rms} from a T/S datasheet — both
representations carry the same information.

OpenISD's WinISD entry mode implements these exact conversions.

### "Fs with added mass" (WinISD output)

WinISD reports the **free-air** resonance after adding mass, not the in-box tuning
frequency Fp:

```
Fs_loaded = 1 / (2π · sqrt((Mms + Madd) · Cms))
           = Fs · sqrt(Mms / (Mms + Madd))
```

OpenISD shows this as "Fs+mass" alongside the in-box Fp. They differ because the box
compliance in series with the PR compliance reduces the total system compliance, raising
the resonance: Fp > Fs+mass.

### ⚠ Assumption — NOT directly verified

> **WinISD's Fs input is the unloaded free-air resonance of the PR (no added mass).**

This is the natural interpretation and is consistent with the conversion formulas, but it
has not been confirmed by testing an actual WinISD session with a known PR.

## 3. Multiple passive radiators (numPR)

WinISD accepts `numPR` as an input. OpenISD implements this as `prNum` (default 1).

**Physical effect of n identical PRs in parallel:**

- Combined acoustic mass: `Map_total = Map_single / n`
- Combined acoustic compliance: `Cap_total = n × Cap_single`
- Tuning frequency Fp is **unchanged** (the n factors cancel under the square root)
- Effective PR branch acoustic impedance: `Zpr_total = Zpr_single / n`
- SPL contribution from PR branch increases because lower Zpr means more volume velocity
  through the PR branch at a given driver drive
- Per-PR excursion = total PR volume velocity / (n × Sd)

OpenISD implements this in `circuit.js` (scale `Zpr` by `1/n`) and `sweep.js`
(divide `excPR` by `n`).

### ⚠ Assumption

> **WinISD models n identical PRs as n acoustic elements in parallel.**

The physics is unambiguous; whether WinISD models it the same way has not been
cross-checked by comparing per-PR excursion curves.

## 4. T/S conversion formulas (confirmed)

These are standard acoustics and verified by the engine round-trip tests:

```
Cms [m/N]  = Vas [m³] / (Sd² [m⁴] × ρ [kg/m³] × c² [m²/s²])
Mms [kg]   = 1 / ((2π·Fs)² × Cms)
Rms [kg/s] = sqrt(Mms / Cms) / Qms
Fp  [Hz]   = 1 / (2π · sqrt((Mms + Madd) / Sd² × Cms × Sd²))
           = 1 / (2π · sqrt((Mms + Madd) × Cms))
```

Engine test `WinISD PR Fs/Qms/Vas round-trips` confirms these are exact inverses.

## 5. Box losses (Ql, Qa, Qp) — confirmed from help file

**Sources:**

- `docs/winisd_helpfiles/help/boxdesign.html` (extracted from official WinISD 0.7 installer)
- `docs/winisd_helpfiles/versions.txt` — 0.50alpha1: _"Added advanced settings (Ql, Qa, Qp) for chambers."_
- `docs/winisd_helpfiles/versions.txt` — 0.50alpha7: _"Box alignment calculation now considers external resistance and
  reduction of Q as box has some absorption loss. Leak losses are not considered when calculating alignments."_ (
  confirms Ql and Qa are distinct; Ql excluded from alignment math)

WinISD models three independent box loss factors:

| Parameter | Meaning                                                   | WinISD default    | Typical range         |
| --------- | --------------------------------------------------------- | ----------------- | --------------------- |
| Ql        | Leakage losses (enclosure sealing, driver surround leaks) | **10**            | 5–20                  |
| Qa        | Absorption losses (stuffing material)                     | 100 (no stuffing) | 3–5 (heavily stuffed) |
| Qp        | Port losses (air friction in port)                        | 100               | —                     |

Combined: `1/Qlt = 1/Qa + 1/Ql + 1/Qp`

**Direct quote from help file:**

> "For reasonable quality box, WinISD pro uses Ql of **10** by default."

### UI location — confirmed from help file screenshots + direct user observation in 0.7.0.950

The losses control is an **"Advanced->" button at the bottom-left of the Box tab panel** —
NOT the top-level "Advanced" tab in the main window. Clicking it opens a popup listing
Ql / Qa / Qp with their current values; clicking any entry opens a small float window with
an editable field and a drag-square. Confirmed with screenshots in `docs/winisd_helpfiles/help/`.

**Directly observed in WinISD 0.7.0.950 (2026-06-24):** Ql = 10.000, Qa = 100.000.
**Correction (2026-06-24):** Qp IS shown in WinISD 0.7 — it appears on the **ported (vented) box view**
specifically, not in the general box losses popup. Default: **100**. Earlier observation that
"Qp is not shown" was incorrect; it was observed in the sealed box view where the port loss
field does not apply.

OpenISD exposes `Ql` (default 10), `Qa` (default 100), and `Qp` (default 100), matching WinISD.
`Qp` is implemented in `circuit.js` (`portLoss()`) and applied for vented and bandpass4 boxes.

**Practical Qa values (from DIYAudio community, thread 316996):**

- 100 — no stuffing (WinISD default)
- 20–50 — light stuffing
- 5–10 — heavy stuffing
- 3 — theoretical minimum; only achievable with a variovent

**Modelling limitation:** Real stuffing is not purely resistive. It also increases the apparent
box volume (velocity of sound is reduced in stuffed enclosures) and can modify driver Qms near
the driver cone. WinISD's resistive model (and OpenISD's) captures only the damping component.
Cut-and-try with an impedance measurement is the only reliable way to determine real Qa.

## 6. Signal / voltage reference — confirmed from help file

**Source:** `docs/winisd_helpfiles/help/boxdesign.html` and `plottypes.html`

> "Term 'power' should more correctly be voltage. This term 'power' comes from definition by
> Richard Small, who defined the input power to be P=Eg²/Re … where Eg is RMS output voltage
> of your amplifier, and Re is DC resistance of voice coil."

> "The power applied can be related to excitation voltage with following relation:
> **Eg = sqrt(P × Re)**, or P = Eg²/Re"

Series resistance (default **0.1 Ω**): included in the electrical circuit model but NOT in the
power-to-voltage conversion. OpenISD matches this behaviour.

## 7. Group delay calibration

**Observation (2026-06-24):** Same driver + PR box, same parameters.

|                   | OpenISD (before) | OpenISD (after) | WinISD 0.7 |
| ----------------- | ---------------- | --------------- | ---------- |
| GD peak frequency | 58.9 Hz          | 60 Hz           | 61.9 Hz    |
| GD peak magnitude | 11.4 ms          | 12.1 ms         | 12.2 ms    |

**Root cause:** OpenISD's Ql default was 7; WinISD's confirmed default is 10. Higher loss
(lower Ql) damps the resonance, shifting the peak down in frequency and reducing its magnitude.

**Fix applied:** Changed Ql default to 10 in `P_DEFAULTS` and circuit fallback.

**Remaining offset after Ql fix:** ~1.9 Hz in frequency. Root cause identified and fixed —
see §9 (circuit model). Le was included in OpenISD's acoustic circuit but WinISD
excludes it. Removing Le from the acoustic drive in WinISD mode resolved the offset.

**Final result (2026-06-24):** OpenISD WinISD mode → **61 Hz / 12 ms**, WinISD → **61.9 Hz / 12.2 ms**. Essentially
matched.

## 8. Driver volume / net vs gross Vb

**Confirmed by community consensus** (DIY Loudspeaker Project Pad, Facebook, post by Christopher Avery):

> WinISD does NOT account for driver displacement volume. The Vb entered is the **net acoustic volume**.

To size the physical enclosure, users must manually add to Vb:

- Driver motor/basket displacement
- Port volume (tube cross-section × length)
- Bracing volume
- Crossover/wiring hardware (if internal)

Stuffing (polyfill, fibreglass) is typically excluded because it is low-density and its
volume displacement is negligible, but it does reduce the effective speed of sound and increase
apparent Vb — a separate effect from its Qa damping contribution.

**Implication for OpenISD:** Vb is treated as net acoustic volume, consistent with WinISD.
The UI should make this explicit. The Vb label tooltip should note "net acoustic volume".

## 9. Circuit model — WinISD vs Full Gyrator

**Source:** `docs/winisd_helpfiles/help/aboutequivalentcircuits.html` (from official WinISD 0.7 installer)

WinISD's acoustic simulation works entirely in the **acoustical domain** using a simplified
constant-element model. OpenISD implements both this model and a physically more complete one.

### WinISD model (default in OpenISD — "WinISD" mode)

Driver acoustic elements are **constants** derived from T/S parameters at resonance:

```
Ccas = Vas / (ρ·c²)
Lmas = 1 / ((2π·Fs)² · Ccas)          = Mms / Sd²
Rae  = 1 / (2π·Fs · Qes · Ccas)       = Bl² / (Re·Sd²)   ← constant, NO Le
Ram  = 1 / (2π·Fs · Qms · Ccas)       = Rms / Sd²
```

The drive source `Uad = Eg·Bl / (Re·Sd)` is also **constant** (Le excluded).

Le appears **only** when computing the electrical impedance plot, added back afterwards:

```
Ze = Re + jω·Le + Zem    where Zem = Bl²/(Sd²·Za)
```

Box loss resistors are described as "determined at resonance frequency of boxed driver."

Group delay is computed by WinISD as a centred finite difference on phase:

```
gd(ω) = −(arg H(f+δ) − arg H(f−δ)) / (2δ)
```

### Full gyrator model (OpenISD "Full gyrator" mode)

The electrical domain is fully modelled and coupled to the acoustic circuit via a gyrator:

```
Zcoil = (Re + Rs) + jω·Le          ← frequency-dependent
pg    = Eg·Bl / (Sd · Zcoil)       ← frequency-dependent drive
ZaE   = Bl² / (Sd² · Zcoil)        ← frequency-dependent electrical damping
```

Le feeds into every acoustic quantity (SPL, GD, excursion). Physically more complete
but diverges slightly from WinISD at frequencies where Le is non-negligible.

### Observed difference

With the demo 6.5" driver (Le = 0.7 mH, Re = 5.6 Ω) in a PR box:

| Mode                                          | GD peak freq | GD peak mag |
| --------------------------------------------- | ------------ | ----------- |
| WinISD 0.7.0.950 (observed)                   | 61.9 Hz      | 12.2 ms     |
| OpenISD — WinISD model (confirmed 2026-06-24) | **61 Hz**    | **12 ms**   |
| OpenISD — Full gyrator                        | 60.0 Hz      | 12.1 ms     |

At 60 Hz: `jωLe ≈ j0.26 Ω` (4.6% of Re). This reactive component in ZaE shifts the
effective electrical Q and coupled system resonance by ~1.9 Hz in the full gyrator model.

### OpenISD advantage over WinISD

| Feature                   | WinISD                                                                                         | OpenISD                        |
| ------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------ |
| Le in acoustic circuit    | No (constant Rae)                                                                              | Yes (full gyrator, switchable) |
| Box losses (Ql, Qa)       | Ql + Qa via UI                                                                                 | Ql + Qa via UI                 |
| Series resistance Rs      | Yes (Signal tab)                                                                               | Yes                            |
| Filter / EQ chain         | Yes                                                                                            | Yes                            |
| Passive radiator mode     | Yes                                                                                            | Yes                            |
| Multiple drivers          | Yes                                                                                            | Yes                            |
| Browser-based, no install | No                                                                                             | Yes                            |
| Open source               | No                                                                                             | Yes                            |
| State persistence         | Project files                                                                                  | localStorage (auto)            |
| Driver library            | Local .wdr files                                                                               | Bundled JSON + browse          |
| **Compare designs**       | **Yes — checkbox-per-project overlay (`view_3_ported.png`), corrected 2026-07-04, see Part 1** | Yes (pin + overlay)            |
| Cursor peak snap          | No                                                                                             | Right-click on graph           |
| Export                    | Print / project file                                                                           | (planned)                      |

### Recommendation

Use **WinISD mode** (default) when cross-checking designs against WinISD.
Use **Full gyrator** when Le is large (>1 mH) or at higher frequencies where Le effects
are significant, accepting that results will differ slightly from WinISD.

## 10. WDR file format — consistency rules and parameter entry

**Source:** Parts Express TechTalk forum, thread "WinISD Pro frustrations, help please."
https://techtalk.parts-express.com/forum/tech-talk-forum/1318003-winisd-pro-frustrations-help-please
(retrieved 2026-06-25)

### Consistency check — Qts / Qms / Qes

WinISD internally calculates Qts from Qms and Qes to **3 decimal places** of precision:

```
Qts = (Qms × Qes) / (Qms + Qes)
```

> "When you enter Qms and Qes, WinISD will calculate Qts from these 2 parameters to a
> high level of accuracy (higher than what is shown as the calculated Qts). If you try
> to enter Qts as a parameter as well as Qms and Qes, it will show the error as the
> calculated value and your entered value will differ." — thekorvers

**Rule: never store Qts in a WDR file alongside Qms and Qes.** If all three are present,
WinISD computes Qts from Qms/Qes and compares to the stored value; any rounding difference
at the 3rd decimal place triggers "consistency check failed: Qts Qms Qes".

Spec sheets commonly round Qts, Qms, Qes to 2 decimal places. Even when arithmetically
consistent on paper, the 3rd-decimal recompute may differ.

**OpenISD fix:** WDR files must not contain Qts when Qms and Qes are both present.
Either omit Qts entirely, or ensure it is marked 'C' (calculated) in ParState.

### Recommended parameter entry sequence

From `thekorvers` (2,000+ WinISD sessions):

```
Qes, Qms, Fs, Vas, Re, Le, Sd, Xmax, Pe, Znom
```

WinISD then calculates: Qts, Dd, Cms, Mms, Rms, EBP, SPL, Vd, and all
box/port parameters.

> "Enter the first parameter and tab to the next. If it's blank, enter it and tab again.
> If it's filled in by WinISD, tab over it to the next." — Millstonemike

### Precision and rounding

> "WinISD is accurate to three decimal places, but many driver spec sheets round off some
> of them to two. That can result in WinISD calculating a different, more accurate result
> than the manufacturer data sheets, triggering an error." — billfitzmaurice

You can round primary measurements (e.g. Fs=30 instead of 29.8) as long as they don't
conflict with other already-entered specs.

### Pre-loaded driver file integrity

Old WDR files (pre-2006) may red-flag in current WinISD because they were saved at a
different internal precision than the current version expects. WDR files should be
regenerated from current datasheet values when this occurs.

### WDR field order and ParState

`ParState` is the last WinISD-native field in a WDR file. Fields after `ParState` are
ignored by WinISD. OpenISD's provenance metadata lives in the driver record (`openisd.yml`), not in the WDR.

`ParState` is a 49-character string: each position is `E` (user-Entered), `C` (Calculated
by WinISD from other entered values), or `N` (Not set). The mapping of positions to
parameter names has been reverse-engineered via single-parameter probes in `drivers/sample/`
and is documented in `drivers/sample/README.md`.

**A ParState builder** constructs ParState from which fields were actually sourced from the
datasheet, rather than writing a fixed template:

- **E** — field is present and non-zero (user-entered or sourced from datasheet)
- **C** — field is computed from available dependencies (e.g., Vd from Sd+Xmax, EBP from Fs+Qes+Qms)
- **N** — field is absent or not relevant

This reflects the actual E/C/N state that WinISD would assign if a user entered the same fields.

### Fields to include in WDR files

**Primary T/S parameters** (sourced from datasheet):

```
Fs  Qes  Qms  Re  Le  Sd  Vas  Xmax  Pe  Znom  BL  Mms  Cms  Rms  SPL
```

**Derived T/S** (computed from primary parameters when dependencies available, else 0):

```
Vd  Dd  EBP
```

**Evidence:** Analysis of 411 real WinISD files in `drivers/matt/` (human-curated collection)
confirms this behaviour:

- **Vd** (Sd × Xmax): 402/411 computed, 9 zeros (missing when Xmax absent)
- **Dd** (√(4Sd/π)): 411/411 computed, 0 zeros (always derivable from Sd alone)
- **EBP** (Fs/Qes): 410/411 computed, 1 zero (missing when Qes absent)

**Structural** (required by WinISD):

```
numVC  VCCon  ParState
```

Fields written by OpenISD's `to_wdr()`:

```
Calculatable — computed from T/S when dependencies are available, otherwise 0:
  Vd (Sd × Xmax), Dd (2·√(Sd/π)), EBP (Fs/Qes)

Fields written only when extracted from source:
  fLe, KLe, Dia (and all other non-mandatory fields)

Air properties (standard 20°C, overridable via WinISD UI):
  c=343.684120962152
  roo=1.20095217714682

Physical dimensions (not currently extracted by scrapers):
  Thick, Depth, MagDepth, Magnet, Basket, Outer, Vcd, DVol
  (See BACKLOG.md: Physical dimension extraction gap)
```

**Do NOT store Qts** when Qms and Qes are both present — see consistency rule above.

## 11. Open questions

| #   | Question                                                                                                                                                                                                                                                                                                                                                                                                                                           | Priority |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | ~~Does WinISD use 2.83 V fixed or `sqrt(Pin × Z_nom)`?~~ **RESOLVED: uses `Eg = sqrt(P × Re)`** — confirmed in WinISD help file                                                                                                                                                                                                                                                                                                                    | Closed   |
| 2   | ~~Does WinISD include Le in its acoustic circuit model?~~ **RESOLVED: No. Le only for impedance. Source: aboutequivalentcircuits.html**                                                                                                                                                                                                                                                                                                            | Closed   |
| 3   | ~~Does WinISD model box leakage (Ql)?~~ **RESOLVED: Ql=10, Qa=100, Qp=100; entry via "Advanced->" button in the Box tab panel (not the top-level Advanced tab). Confirmed by help file text + screenshots boxdes05/06.**                                                                                                                                                                                                                           | Closed   |
| 4   | ~~What radiation model does WinISD use?~~ **RESOLVED: half-space (infinite baffle). Formula `p(r) = ρ·ω·U0/(2π·r)` confirmed in `aboutequivalentcircuits.html`. OpenISD uses identical formula.**                                                                                                                                                                                                                                                  | Closed   |
| 5   | ~~Does WinISD account for air load (radiation mass) on the PR separately from Mms?~~ **RESOLVED: No separate term added. `thielesmall.html` defines Mms as "including air load" for all drivers. For PRs, WinISD derives Mms from Fs+Vas via `Mms = 1/((2π·Fs)²·Cms)` — the measured Fs already encodes air-load implicitly. Neither WinISD nor OpenISD adds an extra radiation-mass term. Source: `docs/winisd_helpfiles/help/thielesmall.html`** | Closed   |
| 6   | ~~Does WinISD's Qms in PR mode mean the same as T/S Qms?~~ **RESOLVED: Yes — standard T/S definition. `aboutequivalentcircuits.html` gives `Ram = 1/(2π·Fs·Qms·Ccas)` applied identically for drivers and PRs. Algebraically equivalent to OpenISD's `Rms = sqrt(Mms/Cms)/Qms`. Source: `docs/winisd_helpfiles/help/aboutequivalentcircuits.html`**                                                                                                | Closed   |

## 11b. Dual voice coils — a DELIBERATE deviation, and why (2026-08-28)

**WinISD's mechanism, decompiled** (`winisd_research/GHIDRA_FINDINGS.md`, `0x461242`): switching
the wiring combo REWRITES the driver in place — parallel→series multiplies `BL` by `numVC` and
`Re` by `numVC²`, series→parallel divides by the same. `numVC`/`VCCon` are **not inputs to any
calculation**; nothing reads them during a sweep. The combo is a converter, fired once on change.

The arithmetic is correct physics: `N` coils of resistance `r` give `r/N` in parallel and `N·r` in
series, with force factor `bl` and `N·bl` respectively.

**What WinISD gets wrong is the bookkeeping.** The rewritten value keeps its `E` (Entered) mark,
so the file asserts the user typed a number the app computed. Combined with §12's save bug below
— the dropdown always writes `VCCon=1` — a user can quadruple their driver twice without warning:
set series (`Re`×4, file says parallel), reload, set series again (`Re`×16).

**OPENISD DEVIATES, on John's ruling 2026-08-28 ("evil", "make it two"):**

|                         | WinISD                                                   | OpenISD                                                                                       |
| ----------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| fields                  | one `Re`, whose meaning changes silently with the wiring | `Re_per_coil` (entered, never rewritten) and `Re_terminal` (calculated) — same split for `BL` |
| on a wiring change      | rewrites the stored value in place                       | recomputes the derived field; the typed value is untouched                                    |
| provenance              | rewritten value stays marked `E`                         | entered stays entered, calculated is marked calculated                                        |
| where the scaling lives | in the editor                                            | ONLY in the `.wdr`/`.wpr` adapter                                                             |

**The files stay byte-compatible** — the writer emits the effective (terminal) values, exactly
what WinISD would have written. The deviation is in what OpenISD KEEPS, not in what it produces.

Two reasons this is worth diverging over: OpenISD round-trips and TESTS the `E`/`C`/`N` marks, so
a false `E` corrupts the parity suite itself; and a destructive edit of a typed value is
unrecoverable — the user cannot get 6.4 back out of 25.6 without knowing what happened to it.

### Reading a `.wdr` back — the rule, and why a known-broken field is safe to trust

A `.wdr`/`.wpr` carries ONE `Re`, and it is always the TERMINAL value — what the amplifier sees.
OpenISD stores `Re` PER COIL, so the reader must divide by the wiring factor. And the file's
`VCCon` cannot be trusted, because WinISD's own dropdown always writes `1` whatever was selected
(§12 below).

**The rule (ledger QO97): trust the file's stated `VCCon` anyway.**

```
factor(parallel, N) = 1/N     factor(series, N) = N     factor(anything, 1) = 1

import     Re_per_coil = Re_file / factor(VCCon_file, numVC)
simulate   Re_terminal = Re_per_coil × factor(...)   ==  Re_file
export     Re_file'    = Re_per_coil × factor(...)   ==  Re_file
```

**Why trusting it is safe: the same factor is applied inbound and outbound, so it cancels.** Even
when WinISD lied about the wiring —

- **every simulated number is exact** — the terminal `Re` reaching the engine is the file's own
  `Re`, byte for byte;
- **the round-trip is exact** — read and rewrite leaves the file unchanged;
- the only casualty is the **displayed per-coil figure**, and only for a multi-coil driver: a
  wrong label on a number nothing simulates from.

For `numVC = 1` — every driver in the bundled corpus — the factor is 1 and there is no ambiguity
to have.

**Alternatives, and why each is worse:**

| alternative                            | why not                                                                                                                                 |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| assume parallel whenever `numVC > 1`   | invents information the file does not carry, and breaks the round-trip for a CORRECTLY saved series file — worse than the case it fixes |
| refuse to import multi-coil drivers    | punishes the user for WinISD's bug                                                                                                      |
| store the terminal value, not per-coil | that IS WinISD's design, and §11b rejects it: storing the terminal value is exactly what forces the silent rewrite                      |

**The one consequence to SURFACE, not hide:** when `numVC > 1`, the per-coil figure is only as
good as the file's `VCCon`. That belongs in the field help — the user may well know the truth when
the file does not.

Tracked as ledger QO96 (the two-field design) and QO97 (this reader rule).

## 12. VCCon — confirmed save bug (verified 2026-06-26)

**VCCon** is the voice coil connection field (parallel vs series). Its WDR encoding is:

| VCCon value | Meaning                                               |
| :---------: | ----------------------------------------------------- |
|      1      | Parallel (default; single-VC drivers always use this) |
|      2      | Series                                                |

**Save bug:** WinISD does not correctly persist the connection type on save. When you select serial in the UI and save,
the file is always written with `VCCon=1` (parallel) regardless of UI selection. Verified by creating two files — one
with serial selected, one with parallel — and observing identical byte output in both.

**Read is correct:** If `VCCon=2` is placed in the file by hand-editing, WinISD opens it and correctly displays serial
connection. Subsequent saves **preserve** the `VCCon=2` value — the bug only affects setting it via the UI dropdown.
Once `VCCon=2` is in the file, WinISD keeps it.

**ParState:** VCCon has **no ParState position** — confirmed by exhaustive single-param probe methodology (
drivers/sample/README.md). Even with all T/S params present and VCCon=1 in the file, no ParState position changes. VCCon
is pure WDR metadata, not part of WinISD's 49-position internal state machine.

**Implication for scraper:** Always write `VCCon=1`. Correct for all single-VC drivers and matches what WinISD writes.

**TODO — OpenISD WDR writer (future):** When OpenISD gains the ability to write WDR files, it must write `VCCon=2`
when the user has selected series wiring. The save bug is WinISD-specific — OpenISD's own writer should write the
correct value. See BACKLOG.md.

## 13. Suggested default units — frequency analysis from datasheets

Analysis of 411 driver datasheets identified the most common unit conventions per parameter.
This table shows WDR storage units (left) vs typical datasheet units (middle) and conversion factors.

| WDR param | WDR unit | Typical datasheet unit             | Conversion to WDR                    |
| --------- | -------- | ---------------------------------- | ------------------------------------ |
| Fs        | Hz       | Hz                                 | × 1                                  |
| Re        | Ω        | Ω                                  | × 1                                  |
| Znom      | Ω        | Ω                                  | × 1                                  |
| Pe        | W        | W                                  | × 1                                  |
| BL        | T·m      | Tm or T·m                          | × 1                                  |
| Qts       | —        | —                                  | × 1                                  |
| Qms       | —        | —                                  | × 1                                  |
| Qes       | —        | —                                  | × 1                                  |
| Le        | H        | mH                                 | ÷ 1,000                              |
| Xmax      | m        | mm                                 | ÷ 1,000                              |
| Mms       | kg       | g                                  | ÷ 1,000                              |
| Vas       | m³       | L (litres)                         | ÷ 1,000                              |
| Sd        | m²       | cm² (most) or m² (Tang Band)       | ÷ 10,000 if cm²                      |
| Cms       | m/N      | μm/N (Tang Band) or mm/N (some)    | ÷ 1,000,000 if μm/N; ÷ 1,000 if mm/N |
| Rms       | kg/s     | Rarely listed — derived            | —                                    |
| Dd        | m        | mm (voice coil diameter)           | ÷ 1,000                              |
| Vd        | m³       | Not listed — computed as Sd × Xmax | —                                    |

### Key gotchas

- **Cms** is the most dangerous — μm/N vs mm/N is a 1000× difference. SB Acoustics don't list Cms; Tang Band shows μm/N.
- **Sd:** Tang Band uses m² directly; SB Acoustics and most European drivers use cm².
- **Rms and Vd** are typically computed, not listed in datasheets — WinISD derives them internally.

### Unit cycle mapping — complete inventory (sorted by unit type)

| Field        | Unit Cycles                                    |
| ------------ | ---------------------------------------------- |
| Fs           | Hz / kHz                                       |
| fLe          | Hz / kHz                                       |
| EBP          | Hz / kHz                                       |
| Re           | Ω                                              |
| Znom         | Ω                                              |
| Qes          | —                                              |
| Qms          | —                                              |
| Qts          | —                                              |
| Dd           | m / mm / cm / in / ft / yd                     |
| Hc           | m / mm / cm / in / ft / yd                     |
| Hg           | m / mm / cm / in / ft / yd                     |
| Xmax         | m / mm / cm / in / ft / yd                     |
| Xlim         | m / mm / cm / in / ft / yd                     |
| Thick        | m / mm / cm / in / ft / yd                     |
| Depth        | m / mm / cm / in / ft / yd                     |
| Magnet Depth | m / mm / cm / in / ft / yd                     |
| Magnet       | m / mm / cm / in / ft / yd                     |
| Basket       | m / mm / cm / in / ft / yd                     |
| Outer        | m / mm / cm / in / ft / yd                     |
| VCd          | m / mm / cm / in / ft / yd                     |
| Vas          | cm³ / m³ / L / in³ / ft³                       |
| Vd           | cm³ / m³ / L / in³ / ft³                       |
| Dvol         | cm³ / m³ / L / in³ / ft³                       |
| Mms          | g / kg                                         |
| Sd           | m² / cm² / mm² / in² / ft² / yd²               |
| Cms          | m/N / μm/N / mm/N                              |
| Rms          | Ns/m / kg/s                                    |
| Rme          | Ns/m / kg/s                                    |
| Mcost        | Ns/m / kg/s                                    |
| Le           | mH / H / μH                                    |
| BL           | T·m                                            |
| KLe          | mH*sqrt(Hz) / H*sqrt(Hz)                       |
| Pe           | W                                              |
| Mpow         | N/sqrt(W)                                      |
| SPL          | dB                                             |
| SPLmaxLF     | dB                                             |
| SPLmax       | dB                                             |
| USPL         | dB                                             |
| c            | m/s / cm/s / ft/s / km/h / mph                 |
| roo          | kg/m³                                          |
| R(t)         | K/W                                            |
| C(t)         | J/K                                            |
| AlfaVC       | 1/K / 1000/K / 1/°C / 1000/°C / 1/°F / 1000/°F |
| gamma        | N/(A*kg)                                       |
| Gloss        | %                                              |
| no           | (unitless count)                               |
| Voicecoils   | (count)                                        |
| Connection   | Parallel / Series                              |

**Unit equivalence notes:**

- **gamma:** Both N/(A*kg) and m/(s²*A) are equivalent units. Proof: Start with T·m/kg, substitute Tesla (T = N/(A·m)) →
  N/(A·m) · m/kg = N/(A·kg), then substitute Newton (N = kg·m/s²) → (kg·m/s²) · 1/(A·kg) = m/(s²·A)

## 14. WinISD help file index

All 21 HTML files in `C:\ProgramData\winisd\help\` — read in full 2026-06-26.
Version: WinISD Pro 0.7 (Linearteam).

| File                                     | Key authoritative content                                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| `index.html`                             | Directory listing only                                                                    |
| `usingwinisd/gettingstarted.html`        | Project workflow, driver selection, EBP bar                                               |
| `usingwinisd/boxdesign.html`             | All box-design tabs; loss params (Ql/Qa/Qp); PR tab; Signal tab power convention          |
| `usingwinisd/newdriver.html`             | Driver entry, ParState colour coding, recommended entry order, Xmax = peak                |
| `usingwinisd/graphs.html`                | Every graph type; cone excursion modes (RMS/peak/p-p); port velocity limit 17 m/s         |
| `usingwinisd/plottypes.html`             | Duplicate of graphs.html (shorter form)                                                   |
| `usingwinisd/options.html`               | Options dialog: graph, general (env defaults), joystick                                   |
| `usingwinisd/filtersimulator.html`       | All filter types, Linkwitz transform, parametric EQ                                       |
| `usingwinisd/fsimexample.html`           | Subsonic filter for ported box; SOS with Q=1.5811 plate-amp example                       |
| `faq/faq.html`                           | Net vs gross box volume; port end correction 0.732; Vas air-dependence                    |
| `articles/thielesmall.html`              | Authoritative definitions of every T/S field (Claus Futtrup)                              |
| `articles/boxtypes.html`                 | Sealed/vented/PR/bandpass trade-offs                                                      |
| `articles/portterminology.html`          | End correction table: two-free=0.613, one-flanged+one-free=0.731, two-flanged=0.849       |
| `articles/crossovers.html`               | Passive/active crossover theory; cap/inductor formulas                                    |
| `articles/db_oct_hertz.html`             | dB, octave, hearing background                                                            |
| `technical/aboutequivalentcircuits.html` | Full equivalent circuit model; all key acoustical formulas; far-field pressure; impedance |
| `technical/closed.html`                  | Image only — closed box eq circuit diagram                                                |
| `technical/vented.html`                  | Image only — vented eq circuit diagram                                                    |
| `technical/pr.html`                      | Image only — passive radiator eq circuit diagram                                          |
| `technical/bp4.html`                     | Image only — 4th-order bandpass eq circuit diagram                                        |
| `technical/bp6a.html`                    | Image only — 6th-order bandpass type A eq circuit diagram                                 |

## 15. WDR fields that are non-functional in WinISD — historic parity only

These fields exist in the WDR format and are written by OpenISD's WDR exporter for
WinISD compatibility, but they have **no effect on any WinISD simulation output**. They are
present purely because real WinISD files contain them and omitting them could prevent correct
round-trip import. OpenISD includes them for historic parity with WinISD, not because they
drive any curve or calculation.

### Confirmed no simulation effect — WinISD help says so explicitly

| Field      | Source                                              | What WinISD actually does with it                                                                                                                                                                                |
| ---------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Znom**   | `thielesmall.html`: _"not used in simulation"_      | Label only — shown in the driver browser and editor as the nominal impedance rating. WinISD uses Re (not Znom) as the power/voltage reference throughout. OpenISD uses it for the 4Ω/8Ω/16Ω browser filter only. |
| **alfaVC** | `thielesmall.html`: _"not used yet in simulations"_ | Voice coil resistance temperature coefficient. Shown in the Advanced parameters tab. No simulation path consumes it.                                                                                             |
| **Rt**     | `thielesmall.html`: _"not used yet in simulations"_ | Thermal resistance (VC to ambient). Same — displayed, not simulated.                                                                                                                                             |
| **Ct**     | `thielesmall.html`: _"not used yet in simulations"_ | Thermal capacity. Same — displayed, not simulated.                                                                                                                                                               |

### Pure metadata — no functional role at all

| Field            | Notes                                                      |
| ---------------- | ---------------------------------------------------------- |
| **Manufacturer** | Separate from Brand; shown in the General tab editor only. |
| **ProvidedBy**   | Attribution text; shown in General tab only.               |
| **Comment**      | Free text note; shown in General tab only.                 |
| **DateAdded**    | Entry date; shown in General tab only.                     |
| **DateModified** | Last-edit date; shown in General tab only.                 |

### Physical dimensions — WinISD Dimensions tab, no simulation effect

All eight dimension fields (Thick, Depth, MagDepth, Magnet, Basket, Outer, Vcd, DVol) are
shown on the Dimensions tab for the builder's reference. **WinISD does not subtract driver
displacement (DVol) from box volume** — users must do that manually. Source: `faq.html`:
_"WinISD doesn't take driver displacement into account."_

These are written as `0` because the data is not extracted from datasheets. See BACKLOG.md
(Physical dimension extraction gap).

### Inert in practice — but WOULD affect output if entered

| Field       | What would actually change                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hc / Hg** | **Not truly inert.** When both are entered, WinISD computes `Xmax = \|Hc−Hg\|/2` (consistency group 19) and marks Xmax as C. That Xmax then affects the excursion limit line, the Xmax-limited part of the Max-SPL curve, and `Vd = Sd × Xmax`. These are an alternative, physically-grounded path to Xmax rather than entering it directly. In every file analysed they are 0 because engineers measure and enter Xmax directly. |
| **Mcost**   | Genuinely display-only. A figure-of-merit (T.L. Clarke motor cost factor) derived from Rme, Xmax, Hc, Hg. Appears in the Advanced parameters panel. No consistency group uses Mcost as an input to anything else — it does not feed back into any acoustic simulation curve. Zero in practice because it requires Hc/Hg to be populated.                                                                                          |
| **Dia**     | Superseded by Dd since WinISD alpha2 (2001). Still present in the canonical write order for legacy compatibility; Dd takes precedence. Source: `versions.txt alpha2`.                                                                                                                                                                                                                                                             |

### VCCon — sets UI dropdown; simulation effect for DVC unverified

VCCon (parallel/series) sets the connection-type dropdown when WinISD loads the file.
For **single-VC drivers** (VCCon=1, essentially every real file) this is a no-op — there
is only one configuration. For **dual-VC drivers** (numVC=2), the dropdown would logically
affect Re and BL (series doubles both; parallel halves Re), but whether WinISD actually uses
VCCon to adjust simulation calculations for DVC drivers **has not been verified** in our
primary-source testing. The save bug (§12) means VCCon=1 in all natively-saved WinISD files
anyway, so this path is never exercised by normal WinISD users.

## 16. SPL vs Transfer Function Magnitude charts — verified difference

**Source:** Screenshots captured from WinISD 0.7.0.950, project "Epique15 - pr", same cursor position (38.01 Hz, −9.896 dB shown top-right in both).

### Finding

Both charts display the **same underlying data series** (system frequency response). The only difference is Y axis reference:

| Chart                       | Y axis                         | Reference                                                            |
| --------------------------- | ------------------------------ | -------------------------------------------------------------------- |
| SPL                         | Absolute dB SPL at input power | Driver sensitivity + power offset                                    |
| Transfer function magnitude | Relative dB                    | 0 dB = high-frequency passband asymptote; −3 dB reference line drawn |

The cursor readout (−9.896 dB at 38.01 Hz) is identical in both screenshots, confirming no separate computation.

### Implication for OpenISD

"Transfer function magnitude" is a **display mode on the SPL chart**, not a new engine series. Implementation: subtract the high-frequency passband asymptote reference level (`sw.spl[sw.spl.length - 1]`) from the curve so 0 dB represents the flat passband response (ensuring any resonant peak sits above 0 dB), draw 0 dB and −3 dB dashed reference lines, and relabel Y axis from "dB SPL" to "dB".

## 17. Fsc and Qtc lossy calculations and DVC connection calibration

### Lossy Sealed Resonance ($F_{sc}$) and Q ($Q_{tc}$) Shift

In classic WinISD, the system resonance frequency ($F_{sc}$) and system Q ($Q_{tc}$) values displayed in the UI and exported as `Fr` in `.wpr` project files are recalculations derived from the simulated physical model including box losses rather than raw lossless formulas.

- **The Leakage Loss ($Q_L$) Effect:** While box absorption loss ($Q_a$) has no effect on system resonance, box leakage ($Q_L$) acts as a physical leak (an acoustic mass in parallel with box compliance). This parallel mass increases system stiffness at resonance, shifting the system impedance peak and the actual resonance frequency $F_{sc}$ upward.
- **Example:** For $Fs = 40\text{ Hz}$, $Vas = 10\text{ L}$, $Vb = 10\text{ L}$:
  - **Lossless box ($Q_L=10000$):** WinISD calculates $F_{sc} = 56.57\text{ Hz}$, matching the lossless formula $F_s\sqrt{1+Vas/Vb} = 56.57\text{ Hz}$.
  - **Lossy box ($Q_L=10$):** WinISD calculates $F_{sc} = 59.16\text{ Hz}$.
- **OpenISD Implementation:** To maintain parity, OpenISD implements the sealed-box lossy resonance calculation (`sealedResonance()`, WinISD loss mode) which reproduces WinISD's own algorithm, taking leakage losses into account for both $F_{sc}$ and $Q_{tc}$.

### Dual Voice Coil (DVC) Connection Calibration

DVC drivers (`numVC=2`) allow voice coil connections to be wired in Series or Parallel.

- **Dropdown Parameter Scaling:** Switching the connection dropdown in WinISD's driver editor scales the displayed driver parameters:
  - Switching from **Parallel** to **Series** multiplies $R_e$ by 4 and $BL$ by 2.
  - Switching from **Series** to **Parallel** divides $R_e$ by 4 and $BL$ by 2.
- **The VCCon Save Bug:** Classic WinISD has a known project writer bug where it always exports `VCCon=1` (Parallel) to the `.wpr` project file, regardless of the user's selected dropdown option. However, the simulation calculations remain correct as long as the parameters loaded into the solver match the active configuration.

## 18. WinISD Auto-Calculation Update Bug (UI update lag)

### The Recalculation Trigger Bug

Classic WinISD has a known UI calculation dependency bug where the calculated values (such as `Fsc` and `Qtc`) do not always update immediately in response to typing single characters in active box or signal fields (e.g. typing `1` of `10` L in the volume edit box can freeze `Fsc` at a stale intermediate value of `120.70 Hz` derived from a volume of `1.0` L).

- **Forced Update Techniques:** To force WinISD's VCL UI controls to process the change and refresh the dependent calculated values:
  - **Large Perturbation:** Change the volume/parameter to a vastly different value (e.g. `100` L), wait for recalculation, and change it back.
  - **Cut and Paste (Preferred):** Select all text in the edit field, Cut it (Ctrl+X), and Paste it (Ctrl+V). The deletion/re-insertion events trigger immediate VCL recalculation and refresh the display readouts instantly.

## 19. WinISD parameter entry — community best practices (a second source)

**Source:** mtg90 ("Matt") via AVS Forum
(<https://www.avsforum.com/threads/common-sub-driver-winisd-files.2928258/>) and
HomeTheaterShack. **Authority:** mtg90 curates `drivers/matt/` (411 WDR files), the reference
collection for real WinISD behaviour cited throughout §10 above — these recommendations come
from the person who created that collection. A second, independent source from §10's
(thekorvers); both agree entry order matters and minor rounding differences are normal.

### Recommended entry sequence (proven by ~50+ drivers)

1. **Mms and Cms first** (results in Fs auto-calculated). If unavailable, enter Fs instead.
   Cms units vary (m, mm, μm) — if calculated Fs is way off, try re-entering Mms+Fs and check
   if Cms' decimal point needs adjustment.
2. **Enter Sd, Bl, Re** (triggers more auto-calculations; Qms/Qts may still be blank).
3. **Enter Qms or Rms** (whichever is available; Qms more commonly published).
4. **Enter Qes** (if Mms/Cms were not provided; triggers additional auto-calculations).
5. **Enter Hc, Hg, Pe** (optional but Pe helpful for power modeling).
6. **Set voice coil count** (dual-VC drivers may auto-adjust Bl/Re; monitor when switching
   series/parallel).
7. **Correct Znom** (often defaults to 6Ω when it should be 2, 4, or 8Ω based on
   configuration).
8. **Enter Xmax and remaining fields** — do NOT manually change blue auto-calculated fields.

### Conflict-avoidance technique

Clear all fields first; enter Qes, Tab; enter Qms, Tab (multiple times to let Qts calculate);
Tab to Mms, enter Mms, Re, Bl, Le, Sd, Xmax, Pe (tabbing after each). Result: no conflicts,
minor rounding errors acceptable.

### Minimal entry levels

Three levels of completeness, from the same source:

- **Full entry (preferred)** — minimum for comprehensive modeling: `Qms, Mms, Cms, Re, BL,
Le, Sd, Xmax, Pe`
- **Minimalistic entry** — `Qes, Qms, Fs, Vas, Re, Sd, Xmax, Pe`
- **Absolute minimum** (basic modeling only) — `Qts, Fs, Vas, Sd, Xmax, Pe`

Ensure units from the datasheet match WinISD's expectations. If Cms unavailable, enter Fs OR
Vas (not both).

**Key insight:** minor calculated-vs-spec discrepancies are normal (rounding). Significant
differences indicate wrong datasheet values, misidentified units, or a need to contact the
manufacturer.

**Implication for OpenISD:** the scraper should aim for "full entry" level (9 fields) for
professional-quality WDR files; understanding these levels helps validate data quality (files
missing multiple core fields may be incomplete); the entry order + minimal levels help
interpret ParState patterns in real WinISD files.

---

_WinISD comparison (Part 1) accurate as of 2026-07-04. WinISD version observed: 0.7.0.950.
Part 2 field-by-field claims independently re-verified 2026-08-13 against live Original-skin
code. WinISD confirmation sources: official help files extracted from the 0.7 installer,
direct UI observation, community reports, and the annotated 0.7.0.950 screenshots in
[`docs/winisd_screenshots/`](../winisd_screenshots/)._
