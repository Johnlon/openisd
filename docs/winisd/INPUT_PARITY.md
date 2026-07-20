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

| WinISD field                                              | OpenISD              |
| --------------------------------------------------------- | -------------------- |
| Fs, Vas, Qms, Qes, Qts                                    | ✅                   |
| Mms, Cms, Rms, BL, Le, Re, Sd, Dd                         | ✅                   |
| fLe, KLe                                                  | ✅ (raw passthrough) |
| Xmax, Hc, Hg, Pe, Vd                                      | ✅                   |
| **Xlim** (mechanical excursion limit, separate from Xmax) | ❌                   |
| no (η₀), Znom, SPL, Voicecoils, Connection                | ✅                   |
| **USPL** (dB)                                             | ❌                   |

## Driver editor → Advanced parameters tab (`edit_driver_pg3_advanced_parameters.png`)

| WinISD field                                                          | OpenISD                                                    |
| --------------------------------------------------------------------- | ---------------------------------------------------------- |
| Thermal: AlfaVC, R(t), C(t)                                           | ✅ (raw; not simulated)                                    |
| Environment: c, roo                                                   | ⚠️ has fields, but **hardcoded** — see §Constants          |
| Figure-of-merit: EBP                                                  | ⚠️ computed as a gauge, not an editable field              |
| Figure-of-merit: **SPLmaxLF, SPLmax, Rme, gamma, Mpow, Mcost, Gloss** | ❌ (WinISD shows these derived values; OpenISD shows none) |

## Driver editor → Dimensions tab (`edit_driver_pg4_dimensions.png`)

| WinISD field                                           | OpenISD                                 |
| ------------------------------------------------------ | --------------------------------------- |
| Thick, Depth, Magnet Depth, Magnet, Basket, Outer, VCd | ✅                                      |
| **Dvol** (driver displacement volume)                  | ❌ (OpenISD has a Weight field instead) |

## Driver editor → General tab (`edit_driver_pg1_text.png`) — not detailed here (metadata: brand/model/comment).

---

## Driver project pane (`spl.png`, `tx_fn_mag.png`)

| WinISD field                                         | OpenISD                                 |
| ---------------------------------------------------- | --------------------------------------- |
| Brand, Model, Num. of drivers, Voice coil connection | ✅                                      |
| **Iso-Barik** (isobaric loading, vs "Standard")      | ❌ (BACKLOG P2)                         |
| **Voice coil temp rise (K)**                         | ❌ (no thermal/power-compression input) |
| Voice coil resistance TC = AlfaVC                    | ✅ (stored, not simulated)              |
| **Added mass to cone (kg)** — driver                 | ❌ (only PR added-mass exists)          |
| Placement (button)                                   | ❔ contents not captured in these shots |

## Box pane (`view_2_box.png`) — parity

Volume, Fh, and an Advanced→ (losses). OpenISD has Vb + Ql/Qa/Qp. ✅

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

| WinISD field / toggle                                                                   | OpenISD                                               |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Temperature, Relative humidity, Air pressure** → derived Sound velocity + Air density | ❌ none — OpenISD hardcodes c/roo                     |
| Simulate voice coil inductance                                                          | ⚠️ equivalent via WinISD/gyrator circuit-model switch |
| **Force flat response**                                                                 | ❌                                                    |
| **Use "transmission line" model for port**                                              | ❌ (TL is BACKLOG P3)                                 |
| **Rg is at driver side** (source-resistance placement)                                  | ❌                                                    |
| **SPL graph is Xmax limited**                                                           | ❌ (OpenISD has a separate Max-SPL chart)             |

## Project pane (`view_7_advanced.png`) — Creator/Created/Modified/Description metadata. OpenISD saves projects but has no per-project author/date/description fields. ⚠️

## App Options (`options_general.png`)

| WinISD                                                         | OpenISD           |
| -------------------------------------------------------------- | ----------------- |
| Environment defaults (Temp/Humidity/Pressure → Sound velocity) | ❌                |
| **Units: metric ↔ imperial**                                   | ❌ metric only    |
| Plot Window options (`options_plot_window.png`)                | not detailed here |

---

## Filters — WinISD filter types (from `view_4_filters_edit_*.png` filenames)

WinISD offers: **allpass, DLP raised-cosine, highpass, Linkwitz transform, lowpass,
parametric EQ, peaking / 2nd-order highpass, static gain.**

| Filter                            | OpenISD         |
| --------------------------------- | --------------- |
| High-pass, Low-pass (Butterworth) | ✅              |
| Linkwitz transform                | ✅              |
| Parametric / peaking EQ           | ✅              |
| **All-pass**                      | ❌              |
| **DLP raised-cosine** (delay)     | ❌              |
| **Static gain**                   | ❌              |
| High-shelf / low-shelf            | ❌ (BACKLOG P1) |

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

OpenISD hardcodes `C = 345.0`, `RHO = 1.184` (constants.ts) — labelled "20 °C" but actually
~24 °C. Correcting to **c ≈ 343.7, ρ ≈ 1.201** fixes the mislabel, matches textbook 20 °C, _and_
brings OpenISD in line with WinISD. Cost: every result shifts ~0.4 %, so the golden-master
baseline must be regenerated as a deliberate one-time reset.

---

## Field decimal places (WinISD screenshots)

Per-field display precision, read from the WinISD 0.7.0.950 screenshots in this folder. This
table is the **evidence log**: it records the screenshot each dp came from so a value can be
audited. The **machine-readable SSOT the UI and tests actually consume** is the field registry
`packages/ui/src/fields/fieldRegistry.ts` (`precision(id)`) — skins read `NumInput :precision`
from it rather than hardcoding a literal, and `fieldRegistry.test.ts` anchors the registry back
to the rows below. Add a field to the registry AND record its screenshot evidence here; do not
guess a dp without the evidence.

Spinners must **hold their fixed dp while being spun** (Arrow keys / wheel), including below
1.0 — the step is floored at the field's own resolution so it never gains a decimal
(`NumInput.vue` `stepAttr`, `directives/expoStep.ts`); guarded by the class-level test in
`original-skin.browser.spec.ts`.

**The COMPLETE, machine-readable catalogue is `packages/ui/src/fields/fieldRegistry.ts`** — every
field (modeled + WinISD-only reference), each with unit, precision, min/max sanity bounds,
derivation, and dependencies. The table below is the human-readable dp evidence subset; where
OpenISD shows a different unit than WinISD the registry carries the unit-adjusted dp (noted there).

| Field                   | WinISD example               | dp        | Source screenshot          | OpenISD dp (if different)              |
| ----------------------- | ---------------------------- | --------- | -------------------------- | -------------------------------------- |
| System input power      | `140.0 W`                    | 1         | signal / main window       | 1                                      |
| Driver input voltage    | `15.2 V`                     | 1         | signal / main window       | 1                                      |
| Series resistance       | `0.100 ohm`                  | 3         | signal / main window       | 3                                      |
| Box volume              | `6.00 l`                     | 2         | box tab                    | 2                                      |
| Tuning / resonance freq | `40.25 Hz`                   | 2         | box tab                    | 2                                      |
| Vent diameter           | `10.20 cm`                   | 2         | view_3_ported              | 2                                      |
| Cross area              | `0.0082 m²`                  | 4         | view_3_ported              | 4                                      |
| PR Vas / Fs / Qms       | `4.80 / 30.00 / 3.300`       | 2 / 2 / 3 | view_3_passive_radiator    | 2 / 2 / 3                              |
| Temperature             | `293.15 K`                   | 2         | view_6_advanced            | 2                                      |
| Sound velocity          | `343.68 m/s`                 | 2         | view_6_advanced            | 2                                      |
| Air density             | `1.20095 kg/m³`              | 5         | view_6_advanced            | 5                                      |
| Relative humidity       | `30.0000 %`                  | 4         | view_6_advanced            | **1** (WinISD's 4 dp is spurious)      |
| Air pressure            | `101325.0 Pa`                | 1         | view_6_advanced            | **2 (kPa)** (unit-adjusted)            |
| Driver Vas / Sd / Xmax  | `in³ / m² / m` (imperial/SI) | 1 / 4 / 3 | edit_driver_pg2_parameters | **2 l / 1 cm² / 1 mm** (unit-adjusted) |
| Driver Mms / Le         | `kg 5 dp / H 6 dp`           | 5 / 6     | edit_driver_pg2_parameters | **2 g / 3 mH** (unit-adjusted)         |

## Biggest real gaps (priority view)

1. **Environment model** — WinISD derives c/ρ from temperature/humidity/pressure (per-project
   and app-default). OpenISD has a single hardcoded, mislabelled, slightly-wrong constant.
2. **Off-axis + configurable listening distance** — OpenISD is fixed 1 m on-axis.
3. **Xlim / USPL / Dvol** driver fields; the figure-of-merit read-outs (Rme, gamma, Mpow, Mcost…).
4. **Filters**: all-pass, raised-cosine delay, static gain, shelving.
5. **Charts**: amplifier VA load, port gain, intrachamber velocity.
6. **Loading/model options**: isobaric, transmission-line port, force-flat, Rg placement.
</content>
