# WinISD ↔ OpenISD — input & feature parity

Evidence-based comparison built by reading the WinISD 0.7.0.950 screenshots in
this folder against OpenISD's actual UI (`packages/ui/src/components/DriverDefineModal.vue`
field list, `BoxPanel.vue`, `SignalPanel.vue`, `FiltersPanel.vue`) and engine.

**Source of each row is the named screenshot.** Where a fact is inferred from a
filename rather than the pixels, it says so.

Legend: ✅ OpenISD has an input/feature · ❌ OpenISD lacks it · ⚠️ partial / different.

---

## Driver editor → Parameters tab (`edit_driver_pg2_parameters.png`)

WinISD's own colour legend on this tab is the ParState model verbatim:
**🟩 Entered · 🟦 Calculated · ⬛ Not available**, plus an "Auto calculate unknowns" toggle.

| WinISD field                                              | OpenISD             |
| --------------------------------------------------------- | -------------------- |
| Fs, Vas, Qms, Qes, Qts                                    | ✅                   |
| Mms, Cms, Rms, BL, Le, Re, Sd, Dd                         | ✅                   |
| fLe, KLe                                                  | ✅ (raw passthrough) |
| Xmax, Hc, Hg, Pe, Vd                                      | ✅                   |
| **Xlim** (mechanical excursion limit, separate from Xmax) | ⚠️ stored, not modelled |
| no (η₀), Znom, SPL, Voicecoils, Connection                | ✅                   |
| **USPL** (dB)                                             | ⚠️ stored, not modelled |

## Driver editor → Advanced parameters tab (`edit_driver_pg3_advanced_parameters.png`)

| WinISD field                                                          | OpenISD                                                    |
| --------------------------------------------------------------------- | ----------------------------------------------------------- |
| Thermal: AlfaVC, R(t), C(t)                                           | ✅ (raw; not simulated)                                     |
| Environment: c, roo                                                   | ⚠️ has fields, but **hardcoded** — see §Constants           |
| Figure-of-merit: EBP                                                  | ⚠️ computed as a gauge, not an editable field               |
| Figure-of-merit: **SPLmaxLF, SPLmax, Rme, gamma, Mpow, Mcost, Gloss** | ⚠️ all present as fields, but `modeled: false` — shown as "calculated" while nothing computes them |

## Driver editor → Dimensions tab (`edit_driver_pg4_dimensions.png`)

| WinISD field                                           | OpenISD                                 |
| ------------------------------------------------------ | ---------------------------------------- |
| Thick, Depth, Magnet Depth, Magnet, Basket, Outer, VCd | ✅                                       |
| **Dvol** (driver displacement volume)                  | ⚠️ stored, not modelled (a Weight field exists too) |

## Driver editor → General tab (`edit_driver_pg1_text.png`) — not detailed here (metadata: brand/model/comment).

---

## Driver project pane (`spl.png`, `tx_fn_mag.png`)

| WinISD field                                         | OpenISD                                |
| ---------------------------------------------------- | --------------------------------------- |
| Brand, Model, Num. of drivers, Voice coil connection | ✅                                      |
| **Iso-Barik** (isobaric loading, vs "Standard")      | 🚧 radio shown for parity; only Standard is modelled |
| **Voice coil temp rise (K)**                         | ❌ (no thermal/power-compression input) |
| Voice coil resistance TC = AlfaVC                    | ✅ (stored, not simulated)              |
| **Added mass to cone (kg)** — driver                 | ❌ (only PR added-mass exists)          |
| Placement (button)                                   | ❔ contents not captured in these shots |

## Box pane (`view_2_box.png`) — parity

Volume, Fh, and an Advanced→ (losses). OpenISD has Vb + Ql/Qa/Qp. ⚠️ — the resonance readout
is wrong for two box types: a **vented** box shows the sealed `Fc = Fs·√(1+Vas/Vb)` under the
label "Fh", and the **PR** box shows the same sealed formula where WinISD's `Fh` is the PR
system tuning (`prTuning()`, which reproduces WinISD exactly). See `winisd_research/GAPS.md` §A2/§A3.

## Passive Radiator pane (`view_3_passive_radiator.png`) — parity

Vas, Fs, Qms, Sd, Xmax, Num. of PRs, Added mass, Fs-with-added-mass. OpenISD's PR panel
(`prSd/prNum/prMmd/prMadd/prCms/prRms/prXmax`, winisd/T-S modes) covers these. ✅

## Signal pane (`view_5_signal.png`)

| WinISD field                                                | OpenISD                     |
| ----------------------------------------------------------- | ---------------------------- |
| System input power, Driver input voltage, Series resistance | ✅                           |
| **Listening Distance** (m)                                  | ❌ fixed at 1 m (BACKLOG P1) |
| **Angle** (rad, off-axis)                                   | ❌ not modelled              |

## Advanced (project) pane (`view_6_advanced.png`)

| WinISD field / toggle                                                                   | OpenISD                                              |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Temperature, Relative humidity, Air pressure** → derived Sound velocity + Air density | ⚠️ temperature drives c/ρ; humidity and pressure are collected but never reach the engine |
| Simulate voice coil inductance                                                          | ⚠️ equivalent via WinISD/gyrator circuit-model switch |
| **Force flat response**                                                                 | ✅                                                    |
| **Use "transmission line" model for port**                                              | ✅                                                   |
| **Rg is at driver side** (source-resistance placement)                                  | ✅                                                    |
| **SPL graph is Xmax limited**                                                           | ✅ (plus a separate Max-SPL chart)                   |

## Project pane (`view_7_advanced.png`) — Creator/Created/Modified/Description metadata. OpenISD saves projects but has no per-project author/date/description fields. ⚠️

## App Options (`options_general.png`)

| WinISD                                                         | OpenISD          |
| -------------------------------------------------------------- | ----------------- |
| Environment defaults (Temp/Humidity/Pressure → Sound velocity) | ❌                |
| **Units: metric ↔ imperial**                                   | ⚠️ imperial units throughout (cu ft, cu in, in, in², oz, °F) via per-field toggles; no single global metric↔imperial mode |
| Plot Window options (`options_plot_window.png`)                | not detailed here |

---

## Filters — WinISD filter types (from `view_4_filters_edit_*.png` filenames)

WinISD offers: **allpass, DLP raised-cosine, highpass, Linkwitz transform, lowpass,
parametric EQ, peaking / 2nd-order highpass, static gain.**

| Filter                            | OpenISD        |
| --------------------------------- | --------------- |
| High-pass, Low-pass (Butterworth) | ✅              |
| Linkwitz transform                | ✅              |
| Parametric / peaking EQ           | ✅              |
| **All-pass**                      | ❌              |
| **DLP raised-cosine** (delay)     | ❌              |
| **Static gain**                   | ❌              |
| High-shelf / low-shelf            | ✅              |

_(Per-filter parameter fields not transcribed — say the word and I'll read each of the
8 filter-edit panes individually.)_

## Charts — WinISD chart types (`chart_dropdown.png`)

WinISD: TF magnitude/phase, Group Delay, Maximum Power, Maximum SPL, **Amplifier apparent
load power (VA)**, SPL, Cone excursion, Impedance, Impedance phase, TF magnitude/phase (PR),
Cone excursion (PR), Rear/Front port **Air velocity** and **Gain**, **Intrachamber Port air
velocity**, TF/phase/GD (EQ/Filter).

OpenISD: SPL, Excursion, Port velocity, Group delay, Impedance mag, Impedance phase, Transfer
phase, Max-SPL, Max-power.

OpenISD lacks: **Amplifier apparent load power (VA)** (BACKLOG P2), port **Gain** curves (has
velocity only), **Intrachamber port** velocity (needs 6th-order bandpass), and the EQ/Filter- and
PR-specific transfer-function/phase curves.

---

## The air constants (§20) — definitive

WinISD's Advanced pane derives, from **Temperature 293.15 K (20 °C)**, 30 % RH, 101325 Pa:

- **Sound velocity c = 343.68 m/s**
- **Air density ρ = 1.20095 kg/m³**

OpenISD matches both exactly: `constants.ts` sets `C = 343.68`, `RHO = 1.20095`.

---

## Biggest real gaps (priority view)

1. **Box-pane resonance shows the wrong quantity** for vented and PR boxes — a wrong number
   under a WinISD field name, which reads as verified parity. `GAPS.md` §A2/§A3.
2. **Environment model** — WinISD derives c/ρ from temperature, humidity AND pressure.
   OpenISD's values match WinISD's, but only temperature is wired: humidity and pressure are
   collected, persisted, and ignored.
3. **Off-axis + configurable listening distance** — OpenISD is fixed 1 m on-axis.
4. **Figure-of-merit read-outs are declared "calculated" but nothing computes them.** `Rme`,
   `gamma` and `Mpow` have closed forms confirmed against WinISD; `Gloss`, `SPLmaxLF`,
   `SPLmax` and `Mcost` have none known.
5. **Filters**: all-pass, raised-cosine delay, static gain.
6. **Charts**: amplifier VA load, port gain, intrachamber velocity.
7. **Enclosure types**: isobaric, 6th-order bandpass and ABC are offered but unmodelled.
8. **Vents**: vent count (1–4) and slot/rectangular vents are absent.
</content>
