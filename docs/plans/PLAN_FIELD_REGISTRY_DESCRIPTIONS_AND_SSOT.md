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
  a **domain-owned options function** (`options: voiceCoilWiringOptions`, `ventShapeOptions`,
  `endCorrectionOptions`, `boxTypeOptions`) — an imported function reference, so a renamed or
  removed options provider is a compile error and the call is clickable, never a string that can
  silently drift.

---

## 2. Field taxonomy: Target / Result / Entered

Three kinds — a row must say which it is. **Choice/enum fields are an Entered kind** (a stated
selection), not a fourth category.

### Target (a design goal — entered by the user, possibly unobtainable)
The value is what the design **aims at**. The model is free to report that the target cannot be
reached. Phrasing stays natural — goal/aim language (e.g. *"design goal"*) — never boilerplate.

| Field | Proposed user-facing description |
| :--- | :--- |
| `ventTuning_hz` (Fb) | `The design goal for the Helmholtz tuning frequency of the vented enclosure. Given one of either port length or box volume, the model solves for the other. The goal may not be achievable — then the output field (length or volume) is left blank and marked as unsolvable.` |
| `prTuning_hz` (Fp) | `The design goal for the tuning frequency of the passive-radiator system. Given one of either added mass or tuning, the model solves for the other. Adding mass can only lower the tuning, so a goal above the radiator's own free-air resonance can't be reached — then the output field (added mass or tuning) is left blank and marked as unsolvable.` |
| `rearTuning_hz` (Frc, entered) | `The design goal for the tuning frequency of the sealed rear chamber (bandpass6/ABC).` |
| `filterFc_hz` (Fc) | `The filter's cutoff or centre frequency.` |

### Result (calculated by the model — read-only)
The value is derived from the entered quantities and the solve. It is displayed, never edited.
Phrasing stays natural — *"actually produces"*, *"calculated"*.

| Field | Proposed user-facing description |
| :--- | :--- |
| `boxResonance_hz` (Fsc / Fh) | `The resonance frequency the finished box actually produces — the built result of the tuning goal.` |
| `rearResonance_hz` (Frc, calculated) | `The sealed rear chamber's actual resonance (Frc = Fs × √(1 + Vas/Vb)).` |
| `portResonance_hz` (f_pipe) | `The port tube's own organ-pipe resonance (f = c/2L).` |
| `ventCrossArea_m2` (Av) | `The port's cross-sectional area.` |
| `prResonanceWithMass_hz` (Fpr loaded) | `The PR's free-air resonance including the added mass.` |
| `EBP_hz` | `Fs/Qes — an enclosure-suitability indicator (EBP < 50 favours sealed, > 90 favours vented).` |
| `soundVelocity_mps` (c) | `Speed of sound in the ambient air.` |
| `airDensity_kg_m3` (ρ₀) | `Air density at the ambient temperature, humidity and pressure.` |

### Entered / measured (a physical input, or a stated choice)
A quantity the user states (from a datasheet or measurement) — neither aimed-at nor derived.
Choices/enums (vent shape, wiring, end correction, box type, model toggles) are Entered.

This covers the Thiele/Small set, the PR's own spec, vent/box geometry, signal parameters,
the ambient environment, the model toggles, and the choices.

> **Rule:** a row's kind is decided by **who owns the value**: entered→physical input or choice;
> aimed-at→target; solved/read-out→result. The description reads the kind naturally — it does
> not restate the field's symbol or title (those come from the label).

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
  description: 'Free-air resonance of the driver's moving assembly + suspension.',
  unit: 'Hz', unitGroup: 'freq', base: 'Hz',
  precision: 2,
  min: 1, max: 5000,                  // ONE bound set — no per-screen limits
  options: undefined,                 // enum fields reference a DOMAIN OPTIONS FUNCTION
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
2. **Plain, specific, human** — one or two short sentences. Never restate the field's symbol or
   display title (they come from the label). No boilerplate like *"a target, not a result"* or
   *"calculated from"* — the kind column says that; the wording reads it naturally
   (goal/aim phrasing for targets, *"actually produces"* for results).
3. A target and its result must not read like the same thing: `ventTuning_hz` (aim) and
   `boxResonance_hz` (achieved) are a pair and each reads differently.

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
| `boxVolume_m3` (Vb) | Box, wizard | Entered | — | Net internal enclosure volume — the air spring on the driver. |
| `frontVolume_m3` (Vf) | Box (bandpass) | Entered | — | Net air volume of the front chamber in a bandpass. |
| `ventTuning_hz` (Fb) | Vents | **Target** | — | The design goal for the Helmholtz tuning frequency of the vented enclosure. Given one of either port length or box volume, the model solves for the other. The goal may not be achievable — then the output field (length or volume) is left blank and marked as unsolvable. |
| `boxResonance_hz` (Fsc/Fh) | Box | **Result** | label by box type (sealed `Fsc`, PR `Fh`) | The resonance frequency the finished box actually produces — the built result of the tuning goal. |
| `rearTuning_hz` (Frc entered) | Box (bandpass6/ABC) | **Target** | — | The design goal for the tuning frequency of the sealed rear chamber. |
| `rearResonance_hz` (Frc calc) | Box (bandpass4) | **Result** | — | The sealed rear chamber's actual resonance (Frc = Fs × √(1 + Vas/Vb)). |

### 6.2 Vents

| planned key | screen | kind | shared? | description |
| :--- | :--- | :--- | :--- | :--- |
| `ventShape` | Vents | Entered (choice) | domain `ventShapeOptions` | Round tube or slotted duct. |
| `ventDiameter_m` (ventD) | Vents | Entered | — | Internal diameter of a round port. Larger diameters cut port turbulence but need longer tubes. |
| `ventWidth_m` (ventW) | Vents | Entered | — | Internal width of a slotted port. |
| `ventHeight_m` (ventH) | Vents | Entered | — | Internal height of a slotted port. |
| `ventLength_m` (ventL) | Vents | Entered | — | Physical port length. Longer ports lower the tuning for a fixed volume. |
| `endCorrection` | Vents | Entered (choice) | domain `endCorrectionOptions` | End-correction coefficient: 0.613 free ends, 0.732 one flanged end, 0.849 two flanged ends. |
| `ventCrossArea_m2` (Av) | Vents | **Result** | — | The port's cross-sectional area. |
| `portResonance_hz` (f_pipe) | Vents | **Result** | — | The port tube's own organ-pipe resonance (f = c/2L). |

### 6.3 Passive Radiator

| planned key | screen | kind | shared? | description |
| :--- | :--- | :--- | :--- | :--- |
| `passiveRadiatorCount` (prNum) | PR | Entered | — | Number of identical passive radiators. |
| `addedMass_kg` (Madd PR) | PR | Entered | the **driver** concept is separate (`driverAddedMass_kg`) | Ballast mass on the PR cone to lower its tuning. |
| `prTuning_hz` (Fp) | PR | **Target** | — | The design goal for the tuning frequency of the passive-radiator system. Given one of either added mass or tuning, the model solves for the other. Adding mass can only lower the tuning, so a goal above the radiator's own free-air resonance can't be reached — then the output field (added mass or tuning) is left blank and marked as unsolvable. |
| `Fs_hz` (Fpr) | PR | Entered | **shared with the driver**, label overridden to `Fpr` | The radiator's own free-air resonance — no box in it. |
| `prResonanceWithMass_hz` (Fpr loaded) | PR | **Result** | — | The PR's free-air resonance including the added mass. |
| `Sd_m2` | PR | Entered | driver editor, same label `Sd` | The PR's effective radiating piston area. |
| `Xmax_m` | PR | Entered | driver editor | The PR's peak linear excursion. |
| `Qms` | PR | Entered | driver editor | The PR's mechanical quality factor. |
| `Vas_m3` | PR | Entered | driver editor | The PR's compliance-equivalent volume. |

### 6.4 Signal

| planned key | screen | kind | shared? | description |
| :--- | :--- | :--- | :--- | :--- |
| `inputPower_W` (Pin) | Signal | Entered | — | Total electrical power into the system (Pin = V²/Re). |
| `driveVoltage_V` (driveV) | Signal | Entered | — | RMS voltage across each driver's terminals. |
| `seriesResistance_ohm` (Rs) | Signal | Entered | — | Amplifier output + wiring + crossover resistance in series. |
| `listenDistance_m` | Signal | Entered | — | On-axis distance to the listener. |
| `listenAngle_rad` | Signal | Entered | — | Off-axis listening angle. |
| `signalGenerator_hz` (genHz) | Signal | Entered | — | Single-tone generator frequency. |

### 6.5 Box losses

| planned key | screen | kind | shared? | description |
| :--- | :--- | :--- | :--- | :--- |
| `leakageQ` (Ql) | Box losses | Entered | — | Enclosure leakage-loss Q (seams and gaskets). |
| `absorptionQ` (Qa) | Box losses | Entered | — | Enclosure damping/absorption-loss Q (fill). |
| `portQ` (Qp) | Box losses | Entered | — | Port friction-loss Q. |

### 6.6 Advanced (environment + model toggles)

| planned key | screen | kind | shared? | description |
| :--- | :--- | :--- | :--- | :--- |
| `temperature_K` (advTemp) | Advanced | Entered | — | Ambient temperature (drives speed of sound and air density). |
| `humidity_pct` (advHumidity) | Advanced | Entered | — | Ambient relative humidity. |
| `pressure_Pa` (advPressure) | Advanced | Entered | — | Ambient barometric pressure. |
| `soundVelocity_mps` (advSoundVelocity) | Advanced | **Result** | — | Speed of sound in the ambient air. |
| `airDensity_kg_m3` (advAirDensity) | Advanced | **Result** | — | Air density at the ambient conditions. |
| `simVcInductance` | Advanced | Entered (choice) | — | Include voice-coil inductance in the output. |
| `forceFlatResponse` | Advanced | Entered (choice) | — | Auto-EQ the system flat. |
| `tlPortModel` | Advanced | Entered (choice) | — | Model the port as a transmission line. |
| `rgAtDriverSide` | Advanced | Entered (choice) | — | Apply Rg per driver, not at the amplifier output. |
| `splXmaxLimited` | Advanced | Entered (choice) | — | Clamp the SPL graph at Xmax. |
| `airModel` | Advanced | Entered (choice) | domain `airModelOptions` | WinISD air vs CIPM moist air. |

### 6.7 Driver: Parameters — all **Entered** unless noted

| key | kind | shared? | description |
| :--- | :--- | :--- | :--- |
| `Fs_hz` | Entered | PR editor as `Fpr` | Free-air resonance of the driver's moving assembly + suspension. |
| `Qts` | Entered | — | Total quality factor at Fs (electrical + mechanical damping). |
| `Qes` | Entered | — | Electrical quality factor (back-EMF damping). |
| `Qms` | Entered | PR editor | Mechanical quality factor (suspension friction). |
| `Vas_m3` | Entered | PR editor | Volume of air with the same compliance as the suspension. |
| `Re_ohm` | Entered | — | DC voice-coil resistance. |
| `Le_H` | Entered | — | Voice-coil inductance. |
| `Mms_kg` | Entered | — | Moving mass (diaphragm + coil + former + air load). |
| `Sd_m2` | Entered | PR editor | Effective radiating piston area. |
| `Xmax_m` | Entered | PR editor | Peak linear one-way excursion. |
| `Pe_W` | Entered | — | Thermal power handling. |
| `BL_Tm` | Entered | — | Motor force factor. |
| `Cms_m_per_N` | Entered | — | Mechanical compliance of the suspension. |
| `Rms_kg_per_s` | Entered | — | Mechanical loss resistance. |
| `Znom_ohm` | Entered | — | Nominal impedance class (4/8/16 Ω). |
| `Dd_m` | Entered | — | Effective piston diameter (Sd ↔ Dd pair). |
| `fLe_hz` | Entered | — | Semi-inductance reference frequency. |
| `KLe_H_sqrtHz` | Entered | — | Semi-inductance coefficient. |
| `numVC` | Entered | — | Number of voice coils. |
| `VCCon` | Entered (choice) | domain `voiceCoilWiringOptions` | Series/parallel wiring of multi-coil drivers. |
| `USPL_dB` | **Result** | — | SPL at 1 m from 2.83 V. |
| `SPL_dB` | **Result** | — | SPL at 1 m from 1 W. |

### 6.8 Driver: Advanced

| key | kind | description |
| :--- | :--- | :--- |
| `EBP_hz` | **Result** | Fs/Qes — enclosure-suitability indicator. |
| `SPLmaxLF_dB` | **Result** | Max SPL at 20 Hz limited by Xmax. |
| `SPLmax_dB` | **Result** | Max SPL at full thermal power. |
| `Rme_kg_per_s` | **Result** | Motional resistance at resonance. |
| `gamma_m_per_s2_A` | **Result** | BL/Mms — acceleration per ampere. |
| `Mpow_N_per_sqrtW` | **Result** | BL/√Re — motor force per √W. |
| `Mcost_kg_per_s` | **Result** | Motor figure of merit. |
| `Gloss` | **Result** | Gravity sag as % of Xmax. |
| `η₀` (key `no`) | **Result** | `How effectively a speaker converts electrical power into acoustic sound power in its passband (η₀ = P_acc / P_elec × 100%). Benchmarks: ≥4% Very High (compression/horn), 3–4% High (PA woofer), 2–3% Good (studio monitor), 1.5–2% Average (hi-fi), 0.75–1.5% Low, <0.75% Very Low (infra-sub). Higher η₀ raises SPL; Hoffman's Iron Law dictates deep sub bass extension requires lower η₀.` — label is **η₀**, `refUrl` = <https://speakerwizard.co.uk/%CE%B7%E2%82%80-eta-zero-reference-efficiency-how-effectively-a-speaker-converts-power-into-sound/> |
| `alfaVC_per_K` | Entered | Voice-coil temperature coefficient. |

### 6.9 Driver: Dimensions — all Entered

| key | description |
| :--- | :--- |
| `Thick_m` | Basket plate thickness. |
| `Depth_m` | Driver mounting depth. |
| `MagDepth_m` | Magnet depth (labelled Magnet Depth). |
| `Magnet_m` | Magnet diameter. |
| `Basket_m` | Basket diameter. |
| `Outer_m` | Outer mounting diameter. |
| `Vcd_m` | Voice-coil diameter. |
| `DVol_m3` | Driver displacement volume, derived from the depth and magnet dimensions. |
| `OuterX_m` / `OuterY_m` | Outer X / Y mounting footprint. |

### 6.10 Driver: General (metadata)

`manufacturer`, `brand`, `model`, `providedBy`, `added`, `comment` — entered metadata, no unit,
no limits, no options.

### 6.11 Driver (project-level)

| key | screen | kind | description |
| :--- | :--- | :--- | :--- |
| `numDrivers` (nDrivers) | Driver | Entered | Number of drivers wired in parallel. |
| `vcTempRise_K` (vcTempRise) | Driver | Entered | Voice-coil temperature rise above ambient. |
| `driverAddedMass_kg` (driverAddedMass) | Driver | Entered | Calibration mass on the driver's cone — distinct from the passive radiator's added mass. |

### 6.12 Filters

| planned key | kind | description |
| :--- | :--- | :--- |
| `filterFc_hz` (Fc) | **Target** | The filter's cutoff or centre frequency. |
| `filterQ` (Q_filter) | Entered | Filter quality factor. |
| `filterGain_dB` (Gain) | Entered | Filter gain (dB). |
| `filterOrder` (Order) | Entered | Filter order (6/12/24 dB/oct). |

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
4. Move option lists to the domain/engine as **functions**; rewire dropdowns through the hooks.
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