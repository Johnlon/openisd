# Plan: UI Field Description Cleanup & SSOT Integration

## Executive Summary
This plan cleans up all user-facing field descriptions and enforces [uiFields.ts](file:///home/john/work/winisd/openisd/packages/design/fields/uiFields.ts) (`UI_FIELD_SPECS`) in `@openisd/design` (sibling file to `openisdFields.ts`) as the exclusive single source of truth (SSOT) for all UI components.

---

## 1. Context Mapping: How UI Fields Map to Domain Models

UI fields in [uiFields.ts](file:///home/john/work/winisd/openisd/packages/design/fields/uiFields.ts) span 10 different UI panes. All field IDs follow a 100% symmetrical `<prefix>_<symbol>_<unit>` snake_case convention (`driver_XXXX`, `pr_XXXX`, `box_XXXX`, `vent_XXXX`, `signal_XXXX`, `loss_XXXX`, `adv_XXXX`, `filter_XXXX`). Every spec entry carries an explicit `domainKey?: OpenIsdFieldKey` linking to [openisdFields.ts](file:///home/john/work/winisd/openisd/packages/design/fields/openisdFields.ts) and a direct OO dispatch method `handle?: (entity: any) => Field<any> | null`:

1. **Driver Specification Context:**  
   - **Fields:** `driver_Fs_hz`, `driver_Vas_l`, `driver_Re_ohm`, `driver_Qts`, `driver_Xmax_mm`, `driver_Pe_W`, `driver_BL_Tm`, `driver_Cms_mm_per_N`, `driver_Qms`, `driver_Qes`, `driver_Rms_Ns_per_m`, `driver_Mms_g`, `driver_Sd_cm2`, `driver_Eta0`, `driver_USPL_dB`, `driver_SPL_dB`, `driver_NumVC`, `driver_VCCon`, `driver_EBP_hz`, `driver_AlfaVC_per_K`, `driver_Znom_ohm`, `driver_C_m_per_s`, `driver_Roo_kg_per_m3`, `driver_Thick_mm`, `driver_Depth_mm`, `driver_MagDepth_mm`, `driver_Magnet_mm`, `driver_Basket_mm`, `driver_Outer_mm`, `driver_Vcd_mm`, `driver_Dvol_cm3`.
   - **Schema & Dispatch:** Maps via `domainKey` to `OPENISD_FIELDS` in [openisdFields.ts](file:///home/john/work/winisd/openisd/packages/design/fields/openisdFields.ts). Dispatch is self-contained on the spec object: `handle: (driver) => driver.spec.ts.Fs_hz`.
2. **Passive Radiator Context:**  
   - **Fields:** `pr_Sd_cm2`, `pr_Xmax_mm`, `pr_Num`, `pr_Madd_g`, `pr_Fp_hz`, `pr_Vas_l`, `pr_Fs_hz`, `pr_Qms`, `pr_FsMass_hz`.
   - **Schema & Dispatch:** Maps via `domainKey` (`pr_Sd_cm2` → `Sd_m2`, `pr_Xmax_mm` → `Xmax_m`, `pr_Vas_l` → `Vas_m3`). Dispatch is self-contained on the spec object: `handle: (radiator) => radiator.spec.Sd_m2`.
3. **Enclosure & Vent Group Context:**  
   - **Fields:** `box_Vb_l`, `box_Vf_l`, `box_Fb_hz`, `box_Resonance_hz`, `box_RearResonance_hz`, `box_Frc_hz`, `vent_Shape`, `vent_D_cm`, `vent_W_cm`, `vent_H_cm`, `vent_L_cm`, `vent_EndCorrection`, `vent_CrossArea_m2`, `vent_PortResonance_hz`.
   - **Schema & Dispatch:** Dispatch is self-contained on the spec object: `handle: (box) => box.Vb`.
4. **Environment & Simulator Options Context:**  
   - **Fields:** `adv_Temp_K`, `adv_Humidity_pct`, `adv_Pressure_kPa`, `adv_SoundVelocity_m_per_s`, `adv_AirDensity_kg_per_m3`, `adv_SimVcInductance`, `adv_ForceFlatResponse`, `adv_TlPortModel`, `adv_RgAtDriverSide`, `adv_SplXmaxLimited`, `adv_UseWinisdAirModel`.
   - **Schema & Dispatch:** Maps to `SimulatorOptions` and engine air state, resolved dynamically via `useAdvancedOptions()` in [AdvancedOptions-hooks.ts](file:///home/john/work/winisd/openisd/packages/ui/src/hooks/AdvancedOptions-hooks.ts).

---

## 2. Universal UI Configuration & Parameter Inheritance

All UI components and form controls obtain their configuration **exclusively from [uiFields.ts](file:///home/john/work/winisd/openisd/packages/design/fields/uiFields.ts) (`UI_FIELD_SPECS`)**:

- **ID Convention:** Symmetrical `<prefix>_<symbol>_<unit>` snake_case IDs (`driver_Fs_hz`, `pr_Sd_cm2`, `box_Vb_l`).
- **Domain Binding (`domainKey`):** Strongly-typed link to `OpenIsdFieldKey` in `openisdFields.ts` (`domainKey?: OpenIsdFieldKey`).
- **OO Handle Dispatch (`handle`):** Instance method on `UIFieldSpec` returning the domain reactive cell (`spec.handle(entity)`), replacing standalone helper functions.
- **Labels & Descriptions:** `label` and `description` (`fieldHelp(id)`).
- **Units & Display Precision:** `unit`, `unitGroup`, and default `precision` (supported up to `MAX_DP = 5` in [units.ts](file:///home/john/work/winisd/openisd/packages/ui/src/logic/fields/units.ts) to prevent silent clamping of 5-dp fields like `Rme`, `Mcost`, `advAirDensity`).
- **Sanity Entry Bounds:** `min` and `max` bounds (`limits(id)`).
- **Enum Options (`options?: string[]`):** Preset arrays (`vent_Shape`, `vent_EndCorrection`, `driver_VCCon`) defined centrally in `uiFields.ts`.

---

## 3. Description Quality Standards & Decision Legend

1. **Redact Technical Debt:** Remove internal decimal-place annotations (`WinISD X dp`), code file paths (`logic/useVentGroup.ts`), internal ledger codes (`QO32`), and dev rants from user-facing descriptions.
2. **Clean Description Format:** Omit the redundant leading `[Symbol] –` prefix (since `label` carries the symbol). Format descriptions starting directly with `Title: Acoustic Function & Physical Meaning`.

### Decision Codes:
- **`REWRITE`**: Redact internal decimal place notes (`WinISD X dp`) and technical debt; reformat string directly as `Title: Acoustic Function & Physical Meaning`.
- **`CLEANUP`**: Strip internal code file paths (`logic/useVentGroup.ts`), dev rants, unverified notes, and ledger tracking codes (`QO32`, `QO97`, `circuit.ts`).

---

## 4. Complete Field Decision Table

| Symmetrical UI Field ID | Domain Key | Pane | Decision | Proposed New User-Facing Description |
| :--- | :--- | :--- | :--- | :--- |
| `box_Vb_l` | `Vb` | Box | `REWRITE` | `Net Enclosure Volume: Internal net air volume of the enclosure acting as the acoustic spring for the driver.` |
| `box_Vf_l` | `Vf` | Box | `REWRITE` | `Front Chamber Volume: Net air volume of the front (vented) chamber in a bandpass enclosure.` |
| `box_Fb_hz` | `tuning_hz` | Box | `REWRITE` | `Box Tuning Frequency: Helmholtz resonance frequency of the vented enclosure determined by port dimensions and box volume.` |
| `box_Resonance_hz` | - | Box | `REWRITE` | `System Resonance Frequency: Effective total resonance frequency of the driver coupled to the enclosure.` |
| `box_RearResonance_hz` | - | Box | `REWRITE` | `Rear Chamber Resonance (Calculated): Sealed rear-chamber resonance frequency in a 4th-order bandpass enclosure (Frc = Fs × √(1 + Vas/Vb)).` |
| `box_Frc_hz` | `Frc` | Box | `REWRITE` | `Rear Chamber Tuning Frequency: Target Helmholtz tuning frequency for the vented rear chamber in 6th-order bandpass and ABC enclosures.` |
| `vent_Shape` | - | Vents | `REWRITE` | `Vent Geometry: Selects between a circular tube (round) or rectangular duct (slotted) port.` |
| `vent_D_cm` | - | Vents | `REWRITE` | `Port Diameter: Internal diameter of a round port tube. Larger diameters reduce port air turbulence (choking) but require longer tubes.` |
| `vent_W_cm` | - | Vents | `REWRITE` | `Slot Port Width: Internal width of a rectangular slotted port.` |
| `vent_H_cm` | - | Vents | `REWRITE` | `Slot Port Height: Internal height of a rectangular slotted port.` |
| `vent_L_cm` | - | Vents | `REWRITE` | `Vent Length: Physical length of the port tube/duct. Longer ports lower the tuning frequency for a fixed volume.` |
| `vent_EndCorrection` | - | Vents | `REWRITE` | `End Correction Factor: Acoustic mass loading coefficient for tube ends (0.613 for free ends, 0.732 for one flanged end, 0.849 for two flanged ends).` |
| `vent_CrossArea_m2` | - | Vents | `REWRITE` | `Vent Cross-Sectional Area: Total internal cross-sectional area of the port.` |
| `vent_PortResonance_hz` | - | Vents | `REWRITE` | `First Vent Pipe Resonance: Lowest organ-pipe standing wave resonance inside the port tube (f = c / 2L).` |
| `pr_Sd_cm2` | `Sd_m2` | PassiveRadiator | `REWRITE` | `Passive Radiator Area: Effective radiating piston surface area of the passive radiator.` |
| `pr_Xmax_mm` | `Xmax_m` | PassiveRadiator | `REWRITE` | `Passive Radiator Excursion Limit: Maximum peak linear cone displacement of the passive radiator diaphragm.` |
| `pr_Num` | - | PassiveRadiator | `REWRITE` | `Passive Radiator Count: Number of identical passive radiators installed in the enclosure.` |
| `pr_Madd_g` | `Madd_kg` | PassiveRadiator | `REWRITE` | `PR Added Mass: Additional ballast mass attached to the passive radiator cone to lower its tuning frequency.` |
| `pr_Fp_hz` | - | PassiveRadiator | `REWRITE` | `Passive Radiator System Tuning: Helmholtz tuning frequency achieved by the passive radiator and enclosure volume.` |
| `pr_Vas_l` | `Vas_m3` | PassiveRadiator | `REWRITE` | `PR Equivalent Compliance Volume: Volume of air having the same acoustic compliance as the passive radiator suspension.` |
| `pr_Fs_hz` | `Fs_hz` | PassiveRadiator | `REWRITE` | `Unloaded PR Resonance: Fundamental free-air resonance frequency of the passive radiator without added mass or box coupling.` |
| `pr_Qms` | `Qms` | PassiveRadiator | `REWRITE` | `PR Mechanical Quality Factor: Quality factor representing mechanical suspension friction losses in the passive radiator.` |
| `pr_FsMass_hz` | - | PassiveRadiator | `REWRITE` | `Mass-Loaded PR Resonance: Free-air resonance frequency of the passive radiator including added mass Madd.` |
| `signal_Pin_W` | - | Signal | `REWRITE` | `System Input Power: Total electrical power supplied to the loudspeaker system (Pin = V² / Re).` |
| `signal_DriveV_V` | - | Signal | `REWRITE` | `Driver Terminal Voltage: RMS input voltage applied across the driver voice coil terminals.` |
| `signal_Rs_ohm` | - | Signal | `REWRITE` | `Series Resistance: Combined amplifier output impedance, wiring, and crossover component resistance in series with the driver.` |
| `signal_Distance_m` | - | Signal | `REWRITE` | `Listening Distance: On-axis distance from the loudspeaker to the listener for SPL calculations.` |
| `signal_Angle_rad` | - | Signal | `REWRITE` | `Off-Axis Angle: Angular offset from the main acoustic axis in radians.` |
| `signal_GenHz_hz` | - | Signal | `REWRITE` | `Test Tone Frequency: Target frequency evaluated by the single-tone signal generator.` |
| `loss_Ql` | - | Box losses | `REWRITE` | `Enclosure Leakage Loss Q: Quality factor accounting for acoustic energy losses through cabinet seams and gaskets.` |
| `loss_Qa` | - | Box losses | `REWRITE` | `Enclosure Damping Loss Q: Quality factor accounting for acoustic energy absorption by internal damping fill.` |
| `loss_Qp` | - | Box losses | `REWRITE` | `Port Friction Loss Q: Quality factor representing air friction and viscous boundary losses inside the vent.` |
| `adv_Temp_K` | - | Advanced | `REWRITE` | `Ambient Temperature: Atmospheric temperature used to calculate speed of sound and air density.` |
| `adv_Humidity_pct` | - | Advanced | `CLEANUP` | `Relative Humidity: Atmospheric humidity percentage affecting sound speed and medium density.` |
| `adv_Pressure_kPa` | - | Advanced | `CLEANUP` | `Air Pressure: Atmospheric barometric pressure influencing medium density and acoustic impedance.` |
| `adv_SoundVelocity_m_per_s` | - | Advanced | `CLEANUP` | `Speed of Sound: Velocity of acoustic wave propagation through air under ambient conditions.` |
| `adv_AirDensity_kg_per_m3` | - | Advanced | `CLEANUP` | `Air Density: Mass density of air derived from temperature, humidity, and barometric pressure.` |
| `adv_SimVcInductance` | - | Advanced | `CLEANUP` | `Simulate Voice Coil Inductance: Includes voice coil inductance (Le) in acoustic output calculations instead of impedance plots alone.` |
| `adv_ForceFlatResponse` | - | Advanced | `CLEANUP` | `Force Flat Response: Applies auto-equalization to reveal excursion and port velocity demands required for a flat passband response.` |
| `adv_TlPortModel` | - | Advanced | `CLEANUP` | `Transmission Line Port Model: Models the vent as a distributed transmission line, incorporating internal organ-pipe resonances into response curves.` |
| `adv_RgAtDriverSide` | - | Advanced | `CLEANUP` | `Rg Placement: Applies series resistance Rg individually to each driver rather than globally at the main amplifier output.` |
| `adv_SplXmaxLimited` | - | Advanced | `CLEANUP` | `Xmax Limited SPL: Clamps the SPL frequency response graph whenever cone displacement exceeds maximum linear excursion Xmax.` |
| `adv_UseWinisdAirModel` | - | Advanced | `REWRITE` | `Air Model Selection: Toggles between legacy WinISD air equations and standardized CIPM moist air calculations.` |
| `driver_Fs_hz` | `Fs_hz` | Driver | `REWRITE` | `Driver Resonant Frequency: Free-air fundamental resonance frequency of the driver moving assembly and suspension.` |
| `driver_Qts` | `Qts` | Driver | `REWRITE` | `Total Quality Factor: Total damping factor of the driver at Fs, combining electrical (Qes) and mechanical (Qms) damping.` |
| `driver_Qes` | `Qes` | Driver | `REWRITE` | `Electrical Quality Factor: Quality factor measuring electrical damping generated by back-EMF in the voice coil at Fs.` |
| `driver_Qms` | `Qms` | Driver | `REWRITE` | `Mechanical Quality Factor: Quality factor measuring mechanical friction damping losses in the surround and spider at Fs.` |
| `driver_Vas_l` | `Vas_m3` | Driver | `REWRITE` | `Equivalent Compliance Volume: Volume of air whose acoustic compliance equals the mechanical compliance of the driver suspension.` |
| `driver_Re_ohm` | `Re_ohm` | Driver | `REWRITE` | `DC Voice Coil Resistance: Direct-current electrical resistance measured across the driver voice coil terminals.` |
| `driver_Le_mH` | `Le_H` | Driver | `REWRITE` | `Voice Coil Inductance: Self-inductance of the voice coil causing high-frequency electrical impedance rise.` |
| `driver_Mms_g` | `Mms_kg` | Driver | `REWRITE` | `Moving Mass: Total mass of the driver diaphragm, voice coil, former, and air mass loading.` |
| `driver_Sd_cm2` | `Sd_m2` | Driver | `REWRITE` | `Effective Diaphragm Area: Effective radiating piston area of the driver cone and inner surround.` |
| `driver_Xmax_mm` | `Xmax_m` | Driver | `REWRITE` | `Peak Linear Excursion: Peak one-way linear cone displacement where voice coil coverage remains inside the magnetic gap.` |
| `driver_Pe_W` | `Pe_W` | Driver | `REWRITE` | `Thermal Power Handling: Maximum continuous electrical power input the voice coil can dissipate without thermal failure.` |
| `driver_BL_Tm` | `BL_Tm` | Driver | `REWRITE` | `Motor Force Factor: Product of magnetic gap flux density B and voice coil wire length L, measuring motor coupling strength.` |
| `driver_Cms_mm_per_N` | `Cms_m_per_N` | Driver | `REWRITE` | `Mechanical Compliance: Mechanical flexibility (spring rate inverse) of the suspension system.` |
| `driver_Rms_Ns_per_m` | `Rms_kg_per_s` | Driver | `REWRITE` | `Mechanical Resistance: Mechanical friction loss resistance of the driver suspension system.` |
| `driver_Eta0` | `no` | Driver | `REWRITE` | `Reference Efficiency: How effectively a speaker converts electrical power into acoustic sound power in its passband (η₀ = P_acc / P_elec × 100%).` |
| `driver_USPL_dB` | `USPL_dB` | Driver | `REWRITE` | `Voltage Sensitivity: Sound pressure level at 1 meter produced by a standard 2.83 V RMS input voltage.` |
| `driver_SPL_dB` | `SPL_dB` | Driver | `REWRITE` | `Power Sensitivity: Sound pressure level at 1 meter produced by a 1 Watt electrical power input.` |
| `driver_NumVC` | `numVC` | Driver | `REWRITE` | `Voice Coil Count: Number of independent voice coil windings on the driver motor assembly.` |
| `driver_VCCon` | `VCCon` | Driver | `CLEANUP` | `Voice Coil Wiring: Wiring configuration (series or parallel) for multi-voice-coil drivers determining total terminal resistance Re and BL.` |
| `driver_EBP_hz` | `EBP_hz` | Driver | `REWRITE` | `Efficiency Bandwidth Product: Ratio of Fs to Qes (Fs / Qes); indicates enclosure suitability (EBP < 50 favours sealed, > 90 favours vented).` |
| `driver_SPLmaxLF_dB` | `SPLmaxLF_dB` | Driver | `CLEANUP` | `Low Frequency Excursion Limit SPL: Theoretical maximum sound pressure level at 20 Hz limited strictly by peak diaphragm excursion Xmax.` |
| `driver_SPLmax_dB` | `SPLmax_dB` | Driver | `REWRITE` | `Thermally Limited Max SPL: Maximum acoustic sound pressure level when driven at full thermal power rating Pe.` |
| `driver_Rme_Ns_per_m` | `Rme_kg_per_s` | Driver | `CLEANUP` | `Motional Resistance at Resonance: Electromagnetic damping resistance generated by back-EMF at resonance.` |
| `driver_Gamma` | `gamma_m_per_s2_A` | Driver | `REWRITE` | `Acceleration Factor: Ratio of motor force BL to moving mass Mms, measuring initial cone acceleration per ampere.` |
| `driver_Mpow` | `Mpow_N_per_sqrtW` | Driver | `CLEANUP` | `Power-Normalized Motor Force: Motor force produced per square root of input power (BL / √Re).` |
| `driver_Mcost_kg_per_s` | `Mcost_kg_per_s` | Driver | `CLEANUP` | `Motor Figure of Merit: Dynamic electromagnetic coupling efficiency accounting for gap geometry and displacement.` |
| `driver_Gloss_pct` | `Gloss` | Driver | `CLEANUP` | `Gravity Sag Percentage: Percentage of peak excursion Xmax consumed by cone displacement under gravity when mounted horizontally.` |
| `driver_Znom_ohm` | `Znom_ohm` | Driver | `REWRITE` | `Nominal Impedance: Rated speaker impedance classification (e.g. 4, 8, or 16 ohms) for amplifier matching.` |
| `driver_AlfaVC_per_K` | `alfaVC_per_K` | Driver | `CLEANUP` | `Voice Coil Temp Coefficient: Thermal resistance coefficient of voice coil wire, determining resistance rise per degree of heating.` |
| `driver_VcTempRise_K` | - | Driver | `CLEANUP` | `Voice Coil Temp Rise: Voice coil heating caused by electrical power dissipation (I² Re), increasing coil resistance Re and inducing thermal power compression.` |
| `driver_AddedMass_g` | - | Driver | `CLEANUP` | `Cone Added Mass: Test mass temporarily added to the cone to shift resonant frequency (Fs), allowing calculation of suspension compliance (Cms) and moving mass (Mms).` |
| `filter_Fc_hz` | - | Filters | `REWRITE` | `Cutoff / Center Frequency: Cutoff or center frequency of the active signal filter.` |
| `filter_Q` | - | Filters | `REWRITE` | `Filter Quality Factor: Quality factor determining resonance peak sharpness or damping of the filter.` |
| `filter_Gain_dB` | - | Filters | `REWRITE` | `Filter Gain: Boost or attenuation gain applied by the equalizer or filter in dB.` |
| `filter_Order` | - | Filters | `REWRITE` | `Filter Order: Filter steepness order (e.g. 1st order 6 dB/oct, 2nd order 12 dB/oct, 4th order 24 dB/oct).` |

---

## 5. Box Type Alignments & Location Mapping

The alignment algorithms across various enclosure types live across 3 distinct module layers:

1. **Domain Engine Physics & Formulas:**  
   - [boxDesign.ts](file:///home/john/work/winisd/openisd/packages/design/engine/boxDesign.ts#L42-L96): Defines alignment calculations and presets:
     - **Sealed Alignments:** `sealedFromQtc`, `SEALED_ALIGNMENT_OPTIONS` ($Q_{tc}$ presets: 0.500 Critically Damped, 0.577 Bessel, 0.707 Butterworth, 0.800–1.500 Equal Ripple), `sealedQtcFromVolume`.
     - **Vented Alignments:** `ventedAlignment` (QB3 polynomial fit for $V_b$ and $F_b$), `ventLength`, `tuningFromLength`.
     - **Passive Radiator Alignments:** `prTuning`, `prMassForFp`, `prFsWithMass`.
     - **Enclosure Suitability:** `ebpSuitability` ($EBP = F_s / Q_{es}$).
2. **Interactive Solver Routines:**  
   - [solver.ts](file:///home/john/work/winisd/openisd/packages/design/engine/solver.ts#L36): Houses iterative and analytical solver routines (`solveSealedAlignment`, `solveVent`, `solvePr`).
3. **UI Alignment Selection Controllers:**  
   - [SealedAlignment-hooks.ts](file:///home/john/work/winisd/openisd/packages/ui/src/hooks/SealedAlignment-hooks.ts#L26): Manages `createSealedAlignmentEditor` for user preset selection and target volume dispatching.

---

## 6. Target Symmetrical Dropdown Architecture (`UIOption<T>`)

To eliminate structural drift, property name mismatches (`qtc` vs `value`), and ad-hoc string/object option handling, all dropdown options across the application are standardized onto a single unified, strongly-typed contract:

```ts
export interface SelectorOption<T = string | number> {
  readonly value: T;
  readonly label: string;
}
```

Every dropdown field in [uiFields.ts](file:///home/john/work/winisd/openisd/packages/design/fields/uiFields.ts) exposes `readonly options?: readonly SelectorOption[]` directly on its spec entry, ensuring 100% template and type symmetry across all controls:

| Target Dropdown Control | SSOT Field Spec ID | Target Option Contract | Option Value & Label Pairs |
| :--- | :--- | :--- | :--- |
| **Port End Correction** | `vent_EndCorrection` | `readonly SelectorOption<number>[]` | `0.613` ("Two free ends"), `0.732` ("One flanged end"), `0.849` ("Two flanged ends") |
| **Vent Geometry / Shape** | `vent_Shape` | `readonly SelectorOption<string>[]` | `'round'` ("Round Tube"), `'slotted'` ("Slotted Duct") |
| **Voice Coil Wiring** | `driver_VCCon` | `readonly SelectorOption<string>[]` | `'Parallel'` ("Parallel"), `'Series'` ("Series") |
| **Sealed Alignment Target ($Q_{tc}$)** | `box_Qtc` | `readonly SelectorOption<number>[]` | `0.500` ("0.500 Critically damped"), `0.577` ("0.577 Max flat delay"), `0.707` ("0.707 Max flat amplitude"), `0.800–1.500` ("Equal ripple") |
| **Enclosure Type** | `box_Type` | `readonly SelectorOption<BoxType>[]` | `'closed'` ("Sealed"), `'vented'` ("Vented"), `'bandpass4'` ("4th-Order Bandpass"), `'box-passive-radiator'` ("Passive Radiator") |
| **Filter Type** | `filter_Type` | `readonly SelectorOption<FilterType>[]` | `'highpass'` ("Highpass"), `'lowpass'` ("Lowpass"), `'peaking'` ("Peaking EQ"), `'linkwitz'` ("Linkwitz-Transform") |
| **Enclosure Damping Fill** | `loss_DampingMode` | `readonly SelectorOption<LossMode>[]` | `'none'` ("None"), `'minimal'` ("Minimal"), `'normal'` ("Normal"), `'heavy'` ("Heavy") |
| **Driver Array Wiring** | `driver_ArrayWiring` | `readonly SelectorOption<Wiring>[]` | `'parallel'` ("Parallel"), `'series'` ("Series") |
| **Passive Radiator Library** | `pr_LibrarySelect` | `readonly SelectorOption<string>[]` | Dynamic list of saved PR records (`value: uuid, label: name`) |
| **Driver Library** | `driver_LibrarySelect` | `readonly SelectorOption<string>[]` | Dynamic list of saved driver records (`value: uuid, label: model`) |


