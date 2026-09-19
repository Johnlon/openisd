# Plan: Field Definitions — SSOT, Descriptions, Targets-vs-Results, Shared-Field Layering

> **Status:** plan — nothing in this document is implemented yet.
> **Scope of this amendment:** (a) the SSOT moves out of the UI into a lower layer;
> (b) every field row states whether it is a **target/goal**, a **calculated result**, or an
> **entered/measured quantity** — a target must never be described as if it were a result;
> (c) a single value shown on several screens reuses one abstract field with per-context
> label/description overrides; (d) a detailed row-by-row field plan follows.

---

## 1. Context & Objectives

The single source of truth (SSOT) for every field definition must live in a **lower layer than
the UI** — the design `fields` package (`packages/design/fields`), with the option **value**
lists owned by the domain/engine. The UI obtains every field, every option list and every help
text through **hooks that delegate to that layer**; it must not hold a second copy of any field
definition (no `UI_FIELD_SPECS`, no duplicated `BOX_OPTIONS`, no hardcoded
`<option>`/`group=`/`base=`/`:title="fieldHelp(…)"` in templates).

This plan covers:

1. **A field taxonomy that must never be conflated.** A value that is a (possibly
   unobtainable) design *target/goal* is a different kind of field from a *calculated result*.
   The canonical example: `Fb` (box tuning you aim at) vs `boxResonance` (the resonance the
   finished box actually produces). Each row below states its kind, and descriptions are written
   to that kind.
2. **SSOT layering & reuse for a single value shown on different screens.** One abstract field,
   per-context label/description. Not a per-screen duplicate id (`prSd` is gone).
3. **Detailed row-by-row plan** for every screen field / field-config row (section 6).
4. **Description quality** and **interactive popovers** (sections 4–5).
5. **UI SSOT binding** — `<NumInput field="…">` resolves everything (section 7).

### 1.1 Consequences of moving the SSOT down

- `packages/ui/src/logic/fields/fieldRegistry.ts` (`UI_FIELD_SPECS`, `END_CORRECTION_OPTIONS`,
  dead props `pane`/`provenance`/`appliesTo`/`formula`/`dependsOn`/`options`/`kind`) is
  **deleted**; its live content merges into `packages/design/fields`.
- **This supersedes the current contract** of `packages/design/fields/openisdFields.ts`, whose
  header currently reads "Display text (labels, units) lives in the UI's field registry
  (…`fieldRegistry.ts`), **never here**." That boundary is exactly what this plan reverses: the
  field definitions (labels, descriptions, units, bounds, per-context overrides) move DOWN into
  that package; the UI keeps only a hooks layer that reads it.
- `packages/ui/src/logic/fields/units.ts` (`UNIT_GROUPS`, `toDisplay`/`fromDisplay`/
  `displayPrecision`) moves into the `fields` package so a field's unit metadata and the group
  definitions are co-located in the lower layer.
- The UI keeps only a **hooks layer** that reads the `fields` package + the domain and returns
  resolved display info to components.
- Field keys follow the common `<name>_<unit>` convention. **Dimensionless quantities keep bare
  keys** (`Qts`, `η₀`/`no`, `Gloss`) — there is no unit to suffix. WinISD's own symbols (`Vb`,
  `Fb`, `Fsc`, `Fh`, `Frc`, `Ql`, `Qa`, `Qp`, `Pin`, `Rs`) remain the **codec's** names for the
  `.wpr`/`.wdr` format, never the UI key.
- The dead registry `options` prop (a UI-held list) is deleted. Enum/dropdown fields reference
  a **domain-owned option list** by name (`options: 'voiceCoilWiring'`, `'ventShape'`,
  `'endCorrection'`, `'boxType'`); the hook resolves the values + labels from the domain.

---

## 2. Field taxonomy: Target / Result / Entered

Three kinds — a row must say which it is, and its description must read like it. **Choice/enum
fields are an Entered kind** (a stated selection), not a fourth category.

### Target (a design goal — entered by the user, possibly unobtainable)
The value is what the design **aims at**. The model is free to report that the target cannot be
reached. Description phrasing: *"…you aim the design at; the enclosure may not reach it."*

| Field | Proposed user-facing description |
| :--- | :--- |
| `ventTuning_hz` (Fb) | `Fb – Box Tuning Frequency: the Helmholtz tuning frequency the design aims at for the vented enclosure, set by port dimensions and box volume. A target, not a result — the enclosure may not reach it; the resonance it actually produces is boxResonance.` |
| `prTuning_hz` (Fp) | `Fp – Passive Radiator System Tuning: the Helmholtz tuning frequency the design aims at for the passive radiator and the enclosure volume. A target, not a result — it may be unreachable, because adding mass can only lower PR tuning, never raise it.` |
| `rearTuning_hz` (Frc, entered) | `Frc – Rear Chamber Tuning Frequency: the Helmholtz tuning frequency the design aims at for the vented rear chamber of a 6th-order bandpass or ABC enclosure. A target, not a result.` |
| `filterFc_hz` (Fc) | `Fc – Cutoff / Center Frequency: the cutoff or centre frequency the active signal filter is aimed at. A target, not a result.` |

The UI already flags unattainable targets (`prTargetUnreachable`, the `FB_TARGET_TIP` note).
A description that calls `Fb` "the Helmholtz resonance of the box" is wrong — that is the
**result** (`boxResonance`), not the target.

### Result (calculated by the model — read-only)
The value is derived from the entered quantities and the solve. It is displayed, never edited.
Description phrasing: *"calculated from …"*.

| Field | Proposed user-facing description |
| :--- | :--- |
| `boxResonance_hz` (Fsc / Fh) | `Fsc / Fh – System Resonance Frequency: the effective total resonance frequency of the driver coupled to the enclosure, calculated. Labelled Fsc for a sealed box, Fh for a passive-radiator box.` |
| `rearResonance_hz` (Frc, calculated) | `Frc (Calculated) – Rear Chamber Resonance: the sealed rear-chamber resonance frequency in a 4th-order bandpass enclosure (Frc = Fs × √(1 + Vas/Vb)), calculated.` |
| `portResonance_hz` (f_pipe) | `f_pipe – First Vent Pipe Resonance: the lowest organ-pipe standing-wave resonance inside the port tube (f = c / 2L), calculated.` |
| `ventCrossArea_m2` (Av) | `Av – Vent Cross-Sectional Area: the total internal cross-sectional area of the port, calculated from its dimensions.` |
| `prResonanceWithMass_hz` (Fpr loaded) | `Fpr (loaded) – Mass-Loaded PR Resonance: the PR's free-air resonance frequency including the added mass Madd, calculated.` |
| `EBP_hz` (EBP) | `EBP – Efficiency Bandwidth Product: the ratio of Fs to Qes (Fs / Qes), an enclosure-suitability indicator (EBP < 50 favours sealed, > 90 favours vented), calculated.` |
| `soundVelocity_mps` (c) | `c – Speed of Sound: velocity of acoustic wave propagation through air under ambient conditions, calculated.` |
| `airDensity_kg_m3` (ρ₀) | `ρ₀ (Rho) – Air Density: mass density of air derived from temperature, humidity, and barometric pressure, calculated.` |

### Entered / measured (a physical input, or a stated choice)
A quantity the user states (from a datasheet or measurement) — neither aimed-at nor derived.
Choices/enums (vent shape, wiring, end correction, box type, model toggles) are Entered.

This covers the Thiele/Small set, the PR's own spec, vent/box geometry, signal parameters,
the ambient environment, the model toggles, and the choices.

> **Rule:** a row's kind is decided by **who owns the value**: entered→physical input or choice;
> aimed-at→target; solved/read-out→result. Never mix them in one description.

---

## 3. SSOT layering & reuse for a shared field (plan only)

A single value appears on several screens (e.g. `Sd_m2` on the Driver editor and the PR editor;
`Fs_hz` as `Fs` on the driver and `Fpr` on the PR). The reuse mechanism is:

### Layer 1 — the abstract field (`design/fields`)
One definition per field, holding everything **shared**:

```ts
Fs_hz: {
  wdr: 'Fs',
  label: 'Fs',                        // DEFAULT display label
  description: '… free-air resonance …',
  unit: 'Hz', unitGroup: 'freq', base: 'Hz',
  precision: 2,
  min: 1, max: 5000,                  // ONE bound set — no per-screen limits
  options: undefined,                 // enum fields reference a DOMAIN list by name
}
```

### Layer 2 — per-context label/description overrides (`design/fields`, same file)

A label or description override is **optional**. A field that is not customised carries one
label used everywhere; a customised field keys its overrides by a **use-case** (a screen, a box
type, or an object type). The `'*'` key is the explicit "use everywhere" base; a specific
use-case key wins over it.

```ts
Fs_hz: {
  label: 'Fs',                          // base — applies wherever no override matches
  labels: { '*': 'Fs', 'pr-editor': 'Fpr' },
  descriptions: { 'pr-editor': "The radiator's own free-air resonance — no box in it." },
}
```

Resolution (`labelFor(useCase, field)` / `descriptionFor(useCase, field)`):

```
useCase in labels ? labels[useCase] : ('*' in labels ? labels['*'] : field.label)
```

`boxResonance_hz` is the box-type case: `labels: { '*': 'Fsc / Fh', sealed: 'Fsc',
'box-passive-radiator': 'Fh' }`. Limits, units and precision are **never** overridden per
use-case — one bound set per field.

Contexts today: `'driver-editor'`, `'pr-editor'`, `'original-shell'`, `'wizard'`, and the box
types `'sealed' | 'vented' | 'bandpass4' | 'bandpass6' | 'abc' | 'box-passive-radiator'`.

### Layer 3 — the resolution seam (`design/fields` accessor + UI hooks)
- `fieldFor(useCase, key)` in `design/fields` merges default + override → `{label, description,
  unit, unitGroup, base, precision, min, max, options}`.
- The UI hooks wrap it: `useFieldSpec(useCase, field)`, `useFieldOptions(field)`,
  `useBoxTypeOptions()`, `useVentShapeOptions()`, `useWiringOptions()`,
  `useEndCorrectionOptions()`, `useAlignmentOptions()`.
- Components bind `field=` + use-case; `<NumInput>` resolves the rest.

### What this kills
- `prSd`/`prFs`/`prQms`/`prVas`/`prXmax`/`prMadd`/`Fp` — replaced by the abstract field key +
  a `'pr-editor'`/`'passive-radiator'` override. The PR's free-air resonance IS the shared
  `Fs_hz` field, labelled `Fpr` in the PR editor.
- Per-screen limit differences (`Qms` max 100 vs 50, `Fs_hz` max 1000 vs 5000) — **removed**;
  one bound per field (the more permissive).
- Duplicate option lists (`BOX_OPTIONS` ×2, `END_CORRECTION_OPTIONS`) — the domain owns the
  values; the hooks present them.

---

## 4. Description standards

1. No decimal-place notes (`WinISD X dp`), no codebase paths (`logic/useVentGroup.ts`), no
   ledger references (`QO32`), no dev rants.
2. Format: `[Symbol / short name] – [Title]: [acoustic function & physical meaning].`
3. State the **kind** in the wording: targets say *aim at / may not reach*; results say
   *calculated from*; entered say *the driver's/PR's stated …*.
4. A target and its result must not read like the same thing: `ventTuning_hz` (aim) and
   `boxResonance_hz` (achieved) are a pair and each says so.

---

## 5. Interactive popover & external references

Replace native `title` attributes with `FieldHelpPopover.vue` (hover-bridge so the card stays
up while moving to it; `Escape`/click-outside close; `target="_blank"` links). Optional
`refUrl?: string` per field for a reference link. Example (η₀ reference efficiency):
`https://speakerwizard.co.uk/%CE%B7%E2%82%80-eta-zero-reference-efficiency-how-effectively-a-speaker-converts-power-into-sound/`.
The `refUrl` lives on the abstract field in the `fields` package, not in the UI.

---

## 6. Detailed row-by-row field plan

Columns: **planned key** (post-rename), **screen(s)**, **kind** (Target / Result / Entered),
**shared?** (which other screens), and the **user-facing description**.

### 6.1 Box

| planned key | screen | kind | shared? | description |
| :--- | :--- | :--- | :--- | :--- |
| `boxVolume_m3` (Vb) | Box, wizard | Entered | — | `Vb – Net Enclosure Volume: internal net air volume of the enclosure acting as the acoustic spring for the driver.` |
| `frontVolume_m3` (Vf) | Box (bandpass) | Entered | — | `Vf – Front Chamber Volume: net air volume of the front (vented) chamber in a bandpass enclosure.` |
| `ventTuning_hz` (Fb) | Vents | **Target** | — | `Fb – Box Tuning Frequency: the Helmholtz tuning frequency the design aims at for the vented enclosure, set by port dimensions and box volume. A target, not a result — the box may not reach it; the resonance it actually produces is boxResonance.` |
| `boxResonance_hz` (Fsc/Fh) | Box | **Result** | label by box type (sealed `Fsc`, PR `Fh`) | `Fsc / Fh – System Resonance Frequency: the effective total resonance frequency of the driver coupled to the enclosure, calculated. Labelled Fsc for sealed, Fh for a passive-radiator box.` |
| `rearTuning_hz` (Frc entered) | Box (bandpass6/ABC) | **Target** | — | `Frc – Rear Chamber Tuning Frequency: target Helmholtz tuning frequency for the vented rear chamber in 6th-order bandpass and ABC enclosures. A target, not a result.` |
| `rearResonance_hz` (Frc calc) | Box (bandpass4) | **Result** | — | `Frc (Calculated) – Rear Chamber Resonance: sealed rear-chamber resonance frequency in a 4th-order bandpass enclosure (Frc = Fs × √(1 + Vas/Vb)), calculated.` |

### 6.2 Vents

| planned key | screen | kind | shared? | description |
| :--- | :--- | :--- | :--- | :--- |
| `ventShape` | Vents | Entered (choice) | domain `VentShape` | `Vent Shape – Geometry: selects between a circular tube (round) or rectangular duct (slotted) port.` |
| `ventDiameter_m` (ventD) | Vents | Entered | — | `Dv – Port Diameter: internal diameter of a round port tube. Larger diameters reduce port air turbulence (choking) but require longer tubes.` |
| `ventWidth_m` (ventW) | Vents | Entered | — | `Wv – Slot Port Width: internal width of a rectangular slotted port.` |
| `ventHeight_m` (ventH) | Vents | Entered | — | `Hv – Slot Port Height: internal height of a rectangular slotted port.` |
| `ventLength_m` (ventL) | Vents | Entered | — | `Lv – Vent Length: physical length of the port tube/duct. Longer ports lower the tuning frequency for a fixed volume.` |
| `endCorrection` | Vents | Entered (choice) | domain list | `k – End Correction Factor: acoustic mass loading coefficient for tube ends (0.613 free ends, 0.732 one flanged end, 0.849 two flanged ends).` |
| `ventCrossArea_m2` (Av) | Vents | **Result** | — | `Av – Vent Cross-Sectional Area: total internal cross-sectional area of the port, calculated from its dimensions.` |
| `portResonance_hz` (f_pipe) | Vents | **Result** | — | `f_pipe – First Vent Pipe Resonance: lowest organ-pipe standing-wave resonance inside the port tube (f = c / 2L), calculated.` |

### 6.3 Passive Radiator

| planned key | screen | kind | shared? | description |
| :--- | :--- | :--- | :--- | :--- |
| `passiveRadiatorCount` (prNum) | PR | Entered | — | `N_PR – Passive Radiator Count: number of identical passive radiators installed in the enclosure.` |
| `addedMass_kg` (Madd PR) | PR | Entered | the **driver** concept is separate (`driverAddedMass_kg`) | `Madd (PR) – PR Added Mass: additional ballast mass attached to the passive radiator cone to lower its tuning frequency.` |
| `prTuning_hz` (Fp) | PR | **Target** | — | `Fp – Passive Radiator System Tuning: the Helmholtz tuning frequency the design aims at for the passive radiator and enclosure volume. A target, not a result — it may be unreachable (adding mass only lowers PR tuning, never raises it).` |
| `Fs_hz` (Fpr) | PR | Entered | **shared with the driver**, label overridden to `Fpr` | `Fpr – Unloaded PR Resonance: fundamental free-air resonance frequency of the passive radiator without added mass or box coupling.` |
| `prResonanceWithMass_hz` (Fpr loaded) | PR | **Result** | — | `Fpr (loaded) – Mass-Loaded PR Resonance: free-air resonance frequency of the passive radiator including added mass Madd, calculated.` |
| `Sd_m2` | PR | Entered | driver editor, same label `Sd` | `Sd (PR) – Passive Radiator Area: effective radiating piston surface area of the passive radiator.` |
| `Xmax_m` | PR | Entered | driver editor | `Xmax (PR) – Passive Radiator Excursion Limit: maximum peak linear cone displacement of the passive radiator diaphragm.` |
| `Qms` | PR | Entered | driver editor | `Qms (PR) – PR Mechanical Quality Factor: quality factor representing mechanical suspension friction losses in the passive radiator.` |
| `Vas_m3` | PR | Entered | driver editor | `Vas (PR) – PR Equivalent Compliance Volume: volume of air having the same acoustic compliance as the passive radiator suspension.` |

### 6.4 Signal

| planned key | screen | kind | shared? | description |
| :--- | :--- | :--- | :--- | :--- |
| `inputPower_W` (Pin) | Signal | Entered | — | `Pin – System Input Power: total electrical power supplied to the loudspeaker system (Pin = V² / Re).` |
| `driveVoltage_V` (driveV) | Signal | Entered | — | `Vin – Driver Terminal Voltage: RMS input voltage applied across the driver voice coil terminals.` |
| `seriesResistance_ohm` (Rs) | Signal | Entered | — | `Rg – Series Resistance: combined amplifier output impedance, wiring, and crossover component resistance in series with the driver.` |
| `listenDistance_m` | Signal | Entered | — | `d – Listening Distance: on-axis distance from the loudspeaker to the listener for SPL calculations.` |
| `listenAngle_rad` | Signal | Entered | — | `θ – Off-Axis Angle: angular offset from the main acoustic axis in radians.` |
| `signalGenerator_hz` (genHz) | Signal | Entered | — | `f_gen – Test Tone Frequency: target frequency evaluated by the single-tone signal generator.` |

### 6.5 Box losses

| planned key | screen | kind | shared? | description |
| :--- | :--- | :--- | :--- | :--- |
| `leakageQ` (Ql) | Box losses | Entered | — | `Ql – Enclosure Leakage Loss Q: quality factor accounting for acoustic energy losses through cabinet seams and gaskets.` |
| `absorptionQ` (Qa) | Box losses | Entered | — | `Qa – Enclosure Damping Loss Q: quality factor accounting for acoustic energy absorption by internal damping fill.` |
| `portQ` (Qp) | Box losses | Entered | — | `Qp – Port Friction Loss Q: quality factor representing air friction and viscous boundary losses inside the vent.` |

### 6.6 Advanced (environment + model toggles)

| planned key | screen | kind | shared? | description |
| :--- | :--- | :--- | :--- | :--- |
| `temperature_K` (advTemp) | Advanced | Entered | — | `T – Ambient Temperature: atmospheric temperature used to calculate speed of sound and air density.` |
| `humidity_pct` (advHumidity) | Advanced | Entered | — | `RH – Relative Humidity: atmospheric humidity percentage affecting sound speed and medium density.` |
| `pressure_Pa` (advPressure) | Advanced | Entered | — | `p₀ – Air Pressure: atmospheric barometric pressure influencing medium density and acoustic impedance.` |
| `soundVelocity_mps` (advSoundVelocity) | Advanced | **Result** | — | `c – Speed of Sound: velocity of acoustic wave propagation through air under ambient conditions, calculated.` |
| `airDensity_kg_m3` (advAirDensity) | Advanced | **Result** | — | `ρ₀ (Rho) – Air Density: mass density of air derived from temperature, humidity, and barometric pressure, calculated.` |
| `simVcInductance` | Advanced | Entered (choice) | — | `Simulate Voice Coil Inductance: includes voice coil inductance (Le) in acoustic output calculations instead of impedance plots alone.` |
| `forceFlatResponse` | Advanced | Entered (choice) | — | `Force Flat Response: applies auto-equalization to reveal excursion and port velocity demands required for a flat passband response.` |
| `tlPortModel` | Advanced | Entered (choice) | — | `Transmission Line Port Model: models the vent as a distributed transmission line, incorporating internal organ-pipe resonances into response curves.` |
| `rgAtDriverSide` | Advanced | Entered (choice) | — | `Rg Placement: applies series resistance Rg individually to each driver rather than globally at the main amplifier output.` |
| `splXmaxLimited` | Advanced | Entered (choice) | — | `Xmax Limited SPL: clamps the SPL frequency response graph whenever cone displacement exceeds maximum linear excursion Xmax.` |
| `airModel` | Advanced | Entered (choice) | — | `Air Model Selection: toggles between legacy WinISD air equations and standardized CIPM moist air calculations.` |

### 6.7 Driver: Parameters — all **Entered** unless noted

| key | kind | shared? | description |
| :--- | :--- | :--- | :--- |
| `Fs_hz` | Entered | PR editor as `Fpr` | `Fs – Driver Resonant Frequency: free-air fundamental resonance frequency of the driver moving assembly and suspension.` |
| `Qts` | Entered | — | `Qts – Total Quality Factor: total damping factor of the driver at Fs, combining electrical (Qes) and mechanical (Qms) damping.` |
| `Qes` | Entered | — | `Qes – Electrical Quality Factor: quality factor measuring electrical damping generated by back-EMF in the voice coil at Fs.` |
| `Qms` | Entered | PR editor | `Qms – Mechanical Quality Factor: quality factor measuring mechanical friction damping losses in the surround and spider at Fs.` |
| `Vas_m3` | Entered | PR editor | `Vas – Equivalent Compliance Volume: volume of air whose acoustic compliance equals the mechanical compliance of the driver suspension.` |
| `Re_ohm` | Entered | — | `Re – DC Voice Coil Resistance: direct-current electrical resistance measured across the driver voice coil terminals.` |
| `Le_H` | Entered | — | `Le – Voice Coil Inductance: self-inductance of the voice coil causing high-frequency electrical impedance rise.` |
| `Mms_kg` | Entered | — | `Mms – Moving Mass: total mass of the driver diaphragm, voice coil, former, and air mass loading.` |
| `Sd_m2` | Entered | PR editor | `Sd – Effective Diaphragm Area: effective radiating piston area of the driver cone and inner surround.` |
| `Xmax_m` | Entered | PR editor | `Xmax – Peak Linear Excursion: peak one-way linear cone displacement where voice coil coverage remains inside the magnetic gap.` |
| `Pe_W` | Entered | — | `Pe – Thermal Power Handling: maximum continuous electrical power input the voice coil can dissipate without thermal failure.` |
| `BL_Tm` | Entered | — | `BL – Motor Force Factor: product of magnetic gap flux density B and voice coil wire length L, measuring motor coupling strength.` |
| `Cms_m_per_N` | Entered | — | `Cms – Mechanical Compliance: mechanical flexibility (spring rate inverse) of the suspension system.` |
| `Rms_kg_per_s` | Entered | — | `Rms – Mechanical Resistance: mechanical friction loss resistance of the driver suspension system.` |
| `Znom_ohm` | Entered | — | `Znom – Nominal Impedance: rated speaker impedance classification (e.g. 4, 8, or 16 ohms) for amplifier matching.` |
| `Dd_m` | Entered | — | `Dd – Effective Piston Diameter: effective piston diameter, interchangeable with Sd (Sd = π·(Dd/2)²).` |
| `fLe_hz` | Entered | — | `fLe – Semi-Inductance Reference Frequency: the frequency at which Le and KLe were measured; 0 = standard Le model only.` |
| `KLe_H_sqrtHz` | Entered | — | `KLe – Semi-Inductance Coefficient: semi-inductance coefficient of the voice coil.` |
| `numVC` | Entered | — | `N_vc – Voice Coil Count: number of independent voice coil windings on the driver motor assembly.` |
| `VCCon` | Entered (choice) | domain `VoiceCoilWiring` | `Voice Coil Wiring: wiring configuration (series or parallel) for multi-voice-coil drivers determining total terminal resistance Re and BL.` |
| `USPL_dB` | **Result** | — | `USPL – Voltage Sensitivity: sound pressure level at 1 meter produced by a standard 2.83 V RMS input voltage, calculated.` |
| `SPL_dB` | **Result** | — | `SPL – Power Sensitivity: sound pressure level at 1 meter produced by a 1 Watt electrical power input, calculated.` |

### 6.8 Driver: Advanced

| key | kind | description |
| :--- | :--- | :--- |
| `EBP_hz` | **Result** | `EBP – Efficiency Bandwidth Product: ratio of Fs to Qes (Fs / Qes); indicates enclosure suitability (EBP < 50 favours sealed, > 90 favours vented), calculated.` |
| `SPLmaxLF_dB` | **Result** | `SPLmaxLF – Low Frequency Excursion Limit SPL: theoretical maximum sound pressure level at 20 Hz limited strictly by peak diaphragm excursion Xmax, calculated.` |
| `SPLmax_dB` | **Result** | `SPLmax – Thermally Limited Max SPL: maximum acoustic sound pressure level when driven at full thermal power rating Pe, calculated.` |
| `Rme_kg_per_s` | **Result** | `Rme – Motional Resistance at Resonance: electromagnetic damping resistance generated by back-EMF at resonance, calculated.` |
| `gamma_m_per_s2_A` | **Result** | `γ (Gamma) – Acceleration Factor: ratio of motor force BL to moving mass Mms, measuring initial cone acceleration per ampere, calculated.` |
| `Mpow_N_per_sqrtW` | **Result** | `Mpow – Power-Normalized Motor Force: motor force produced per square root of input power (BL / √Re), calculated.` |
| `Mcost_kg_per_s` | **Result** | `Mcost – Motor Figure of Merit: dynamic electromagnetic coupling efficiency accounting for gap geometry and displacement, calculated.` |
| `Gloss` | **Result** | `Gloss – Gravity Sag Percentage: percentage of peak excursion Xmax consumed by cone displacement under gravity when mounted horizontally, calculated.` |
| `η₀` (key `no`) | **Result** | `η₀ (Eta Zero) – Reference Efficiency: how effectively a speaker converts electrical power into acoustic sound power in its passband (η₀ = P_acc / P_elec × 100%), calculated. Benchmarks: ≥4% Very High (compression/horn), 3–4% High (PA woofer), 2–3% Good (studio monitor), 1.5–2% Average (hi-fi), 0.75–1.5% Low, <0.75% Very Low (infra-sub). Higher η₀ raises SPL; Hoffman's Iron Law dictates deep sub bass extension requires lower η₀.` — label is **η₀**, `refUrl` = <https://speakerwizard.co.uk/%CE%B7%E2%82%80-eta-zero-reference-efficiency-how-effectively-a-speaker-converts-power-into-sound/> |
| `alfaVC_per_K` | Entered | `α_VC – Voice Coil Temp Coefficient: thermal resistance coefficient of voice coil wire, determining resistance rise per degree of heating.` |

### 6.9 Driver: Dimensions — all Entered

| key | description |
| :--- | :--- |
| `Thick_m` | `Thick – Basket Plate Thickness: thickness of the basket mounting plate.` |
| `Depth_m` | `Depth – Driver Depth: overall mounting depth of the driver.` |
| `MagDepth_m` | `MagDepth – Magnet Depth: depth of the magnet structure (labelled Magnet Depth).` |
| `Magnet_m` | `Magnet – Magnet Diameter: diameter of the magnet structure.` |
| `Basket_m` | `Basket – Basket Diameter: outer diameter of the frame/basket.` |
| `Outer_m` | `Outer – Outer Mounting Diameter: outer mounting diameter of the driver.` |
| `Vcd_m` | `Vcd – Voice Coil Diameter: diameter of the voice coil former.` |
| `DVol_m3` | `DVol – Driver Displacement Volume: driver displacement volume, locked to Depth/MagDepth/Magnet (DVol = (π/4)·[S·(Depth−MagDepth)/3 + Magnet²·MagDepth]).` |
| `OuterX_m` / `OuterY_m` | `OuterX / OuterY – Outer X / Y dimensions: mounting footprint extents.` |

### 6.10 Driver: General (metadata)

`manufacturer`, `brand`, `model`, `providedBy`, `added`, `comment` — entered metadata, no unit,
no limits, no options.

### 6.11 Driver (project-level)

| key | screen | kind | description |
| :--- | :--- | :--- | :--- |
| `numDrivers` (nDrivers) | Driver | Entered | `N_drv – Number of Drivers: number of drivers wired in parallel.` |
| `vcTempRise_K` (vcTempRise) | Driver | Entered | `ΔT_VC – Voice Coil Temp Rise: temperature rise of the voice coil above ambient, causing thermal power compression.` |
| `driverAddedMass_kg` (driverAddedMass) | Driver | Entered | `Madd – Driver Cone Added Mass: calibration mass added to the DRIVER's cone during testing to measure suspension compliance — distinct from the PR's addedMass_kg.` |

### 6.12 Filters

| planned key | kind | description |
| :--- | :--- | :--- |
| `filterFc_hz` (Fc) | **Target** | `Fc – Cutoff / Center Frequency: cutoff or center frequency the active signal filter is aimed at.` |
| `filterQ` (Q_filter) | Entered | `Q_filter – Filter Quality Factor: quality factor determining resonance peak sharpness or damping of the filter.` |
| `filterGain_dB` (Gain) | Entered | `Gain – Filter Gain: boost or attenuation gain applied by the equalizer or filter in dB.` |
| `filterOrder` (Order) | Entered | `Order – Filter Order: filter steepness order (e.g. 1st order 6 dB/oct, 2nd order 12 dB/oct, 4th order 24 dB/oct).` |

---

## 7. UI SSOT binding & unit/group activation

1. `<NumInput field="…">` resolves `precision`, `min`/`max`, `unitGroup`, `base`, `label` and
   `description` from the fields package via the hooks; explicit props become overrides.
2. Templates drop hardcoded `<label>` text, `:precision="…"`, `group=`/`base=`, and
   `:title="fieldHelp(…)"`.
3. `units.ts` `MAX_DP` rises to 5 so 5-dp fields (`Rme`, `Mcost`, `airDensity`) are not clamped.
4. Option dropdowns bind the domain lists via hooks (box types, vent shape, wiring, end
   correction, alignment — the last already exists as `engine.sealedAlignmentOptions()`).

---

## 8. Migration steps & risks

1. Move the field definitions + `units.ts` down into `design/fields`; delete `fieldRegistry.ts`.
   Update `openisdFields.ts`'s header contract (it currently says display text lives in the UI).
2. Add the per-context `labels`/`descriptions` overrides; unify bounds (remove the
   PR/driver `Qms` 100-vs-50 and `Fs_hz` 1000-vs-5000 differences).
3. Rename errant keys to `<name>_<unit>` (dimensionless fields keep bare keys); update
   `data-field-key`, `field=`, tests, and the provenance/label-drift browser specs.
4. Move option lists to the domain/engine; rewire dropdowns through the hooks.
5. Replace `title` tooltips with `FieldHelpPopover.vue`; add `refUrl` where a reference exists.
6. **Corpus DQ regeneration (risk, from the S2-11/12/13 refactor — `4ad463b`).** The domain
   driver's `projectFormulaDq` now writes `engine.issueToText` **prose** into `dq_calculated`
   (`Qes, Fs_hz, … disagree by 1.1%: …`), and never emits the `range-above-max`/`range-below-min`
   marks. The corpus stores the registry-template format (`dqCalculated.ts`:
   `Qes=6.16 above max 5`, `calc-consistency`) that the bridge and the external Python mark
   registry expect. The bundler round-trip gate therefore fails corpus records — the count
   tracks the corpus (19 at the first report; a later full run over 2006 records found 25).
   **This is a format divergence, not mere staleness** — the record contract
   (`dqCalculated.ts` header, and the external scraper package's mark registry
   `scrapers/lib/record_registries.py`, which lives in the `winisd_drivers` checkout, not this
   repo) requires the template details. Decision needed: either the driver emits the registry
   templates (via `calcMark`/`rangeMark`) and the tooltip reads `issueToText` only for display,
   or the format change is accepted and the corpus + Python registry are regenerated in
   lockstep. This plan's field-definition move must not change any DQ semantics.

---

## 9. Non-goals

- No physics/model changes — this is display/SSOT only.
- No change to the `.wpr`/`.wdr` codec's use of WinISD's own symbols.
- No per-screen limits (bounds are per-field, unified).