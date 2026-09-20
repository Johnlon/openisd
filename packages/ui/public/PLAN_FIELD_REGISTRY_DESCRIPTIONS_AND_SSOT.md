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

1. **Explanatory Rigour:** Every description must clearly state **what the parameter is**, **the physical mechanism causing it**, and **its acoustic effect** on performance (e.g. heating source, compliance stiffness, pressure displacement).
2. **Redact Technical Debt:** Remove internal decimal-place annotations (`WinISD X dp`), code file paths (`logic/useVentGroup.ts`), internal ledger codes (`QO32`), and dev rants.
3. **Clean Description Format:** Omit redundant leading `[Symbol] –` prefixes. Format descriptions starting directly with `Title: Physical Cause & Acoustic Effect`.

---

## 4. Complete Field Decision Table

| Symmetrical UI Field ID | Domain Key | Pane | Decision | Proposed New User-Facing Description |
| :--- | :--- | :--- | :--- | :--- |
| `box_Vb_l` | `Vb` | Box | `REWRITE` | `Net Enclosure Volume: Internal net air volume acting as the acoustic compliance spring that restores cone displacement and determines system resonance.` |
| `box_Vf_l` | `Vf` | Box | `REWRITE` | `Front Chamber Volume: Front chamber air volume in a bandpass enclosure acting as an acoustic compliance that shapes upper passband cutoff.` |
| `box_Fb_hz` | `tuning_hz` | Box | `REWRITE` | `Box Tuning Frequency: Helmholtz resonance frequency of the port tube and box air volume, suppressing cone excursion and boosting bass output at tuning.` |
| `box_Resonance_hz` | - | Box | `REWRITE` | `System Resonance Frequency: Total resonance frequency (Fsc/Fh) resulting from driver mechanical suspension compliance combined with box air spring stiffness.` |
| `box_RearResonance_hz` | - | Box | `REWRITE` | `Rear Chamber Resonance: Sealed rear-chamber resonance frequency (Frc) created by rear box compliance restoring the driver cone in 4th-order bandpass enclosures.` |
| `box_Frc_hz` | `Frc` | Box | `REWRITE` | `Rear Chamber Tuning Frequency: Target Helmholtz tuning frequency for the vented rear chamber, establishing low-frequency cutoff in 6th-order bandpass enclosures.` |
| `vent_Shape` | - | Vents | `REWRITE` | `Vent Geometry: Port duct cross-section geometry; round tubes minimise surface friction while slotted ducts integrate into cabinet walls.` |
| `vent_D_cm` | - | Vents | `REWRITE` | `Port Diameter: Internal diameter of a round port tube; larger diameters prevent air turbulence choking at high output but require longer port tubes.` |
| `vent_W_cm` | - | Vents | `REWRITE` | `Slot Port Width: Internal width of a slotted port duct; combining width and height determines port area to control air velocity.` |
| `vent_H_cm` | - | Vents | `REWRITE` | `Slot Port Height: Internal height of a slotted port duct; along with width sets port area to prevent chuffing noise.` |
| `vent_L_cm` | - | Vents | `REWRITE` | `Vent Length: Physical port tube length; increasing length adds acoustic air mass inside the duct, lowering box tuning frequency Fb.` |
| `vent_EndCorrection` | - | Vents | `REWRITE` | `End Correction Factor: Dimensionless factor accounting for acoustic air mass oscillating beyond the physical duct ends, extending effective acoustic port length depending on termination boundary geometry (free air vs flanged baffle).` |
| `vent_CrossArea_m2` | - | Vents | `REWRITE` | `Vent Cross-Sectional Area: Internal port duct surface area; sets air velocity (v = Vd · w / Sp) to avoid turbulent noise.` |
| `vent_1stPortResonance_hz` | - | Vents | `REWRITE` | `First Vent Pipe Resonance: Frequency of the lowest organ-pipe standing wave resonance inside the port duct (f = c / 2L). Standing wave peaks in the vent column cause acoustic output peaks and noise within or above the passband, limiting usable port bandwidth.` |
| `pr_Sd_cm2` | `Sd_m2` | PassiveRadiator | `REWRITE` | `Passive Radiator Area: Radiating diaphragm surface area; larger area displaces more air volume without requiring extreme linear excursion.` |
| `pr_Xmax_mm` | `Xmax_m` | PassiveRadiator | `REWRITE` | `Passive Radiator Excursion Limit: Peak linear travel of the PR suspension before non-linear distortion or mechanical bottoming occurs.` |
| `pr_Num` | - | PassiveRadiator | `REWRITE` | `Passive Radiator Count: Number of identical passive radiators; doubling radiators doubles total radiating area and halves individual displacement demand.` |
| `pr_Madd_g` | `Madd_kg` | PassiveRadiator | `REWRITE` | `PR Added Mass: Physical mass added to the PR diaphragm to increase acoustic moving mass, lowering system tuning frequency Fp.` |
| `pr_Fp_hz` | - | PassiveRadiator | `REWRITE` | `Passive Radiator System Tuning: Target Helmholtz tuning frequency resulting from PR moving mass acting against enclosure air spring compliance.` |
| `pr_Vas_l` | `Vas_m3` | PassiveRadiator | `REWRITE` | `PR Equivalent Compliance Volume: Volume of air whose acoustic spring stiffness equals the mechanical suspension compliance of the PR.` |
| `pr_Fs_hz` | `Fs_hz` | PassiveRadiator | `REWRITE` | `Unloaded PR Resonance: Fundamental free-air resonance frequency of the unweighted PR diaphragm set by its bare moving mass and suspension spring.` |
| `pr_Qms` | `Qms` | PassiveRadiator | `REWRITE` | `PR Mechanical Quality Factor: Damping factor measuring mechanical friction losses in the PR surround and spider.` |
| `pr_FsMass_hz` | - | PassiveRadiator | `REWRITE` | `Mass-Loaded PR Resonance: Free-air resonance frequency of the PR cone with added mass attached, prior to box mounting.` |
| `signal_Pin_W` | - | Signal | `REWRITE` | `System Input Power: Electrical power driven into the voice coil (Pin = V² / Re), creating motor force that drives cone excursion and acoustic output.` |
| `signal_DriveV_V` | - | Signal | `REWRITE` | `Driver Terminal Voltage: RMS voltage applied across voice coil terminals, forcing current through coil impedance to drive motor force.` |
| `signal_Rs_ohm` | - | Signal | `REWRITE` | `Series Resistance: Cable, crossover inductor, and amp output resistance in series with driver, degrading electrical Qes damping and reducing SPL.` |
| `signal_Distance_m` | - | Signal | `REWRITE` | `Listening Distance: Distance from speaker to listener; SPL drops 6 dB per doubling of distance in free field (inverse-square law).` |
| `signal_Angle_rad` | - | Signal | `REWRITE` | `Off-Axis Listening Angle: Angular offset from acoustic center; high frequencies attenuate off-axis due to diaphragm beaming.` |
| `signal_GenHz_hz` | - | Signal | `REWRITE` | `Test Tone Frequency: Frequency of continuous sine wave signal generator used for single-point excursion and SPL analysis.` |
| `loss_Ql` | - | Box losses | `REWRITE` | `Enclosure Leakage Q: Quality factor representing air leakage losses through cabinet seams, joint gaps, and driver seals; lower Ql reduces bass extension.` |
| `loss_Qa` | - | Box losses | `REWRITE` | `Enclosure Damping Q: Quality factor measuring acoustic energy absorption by internal fibreglass or polyfill lining, slowing apparent speed of sound.` |
| `loss_Qp` | - | Box losses | `REWRITE` | `Port Friction Q: Quality factor accounting for viscous boundary layer friction along port walls; lower Qp dampens port resonance peak.` |
| `adv_Temp_K` | - | Advanced | `REWRITE` | `Ambient Temperature: Air temperature; higher temperature increases sound velocity and reduces air density, shifting tuning and SPL.` |
| `adv_Humidity_pct` | - | Advanced | `CLEANUP` | `Relative Humidity: Air moisture percentage; alters water vapor mole fraction, subtly modifying speed of sound and air density.` |
| `adv_Pressure_kPa` | - | Advanced | `CLEANUP` | `Barometric Pressure: Atmospheric air pressure; higher barometric pressure increases air mass density and characteristic acoustic impedance.` |
| `adv_SoundVelocity_m_per_s` | - | Advanced | `CLEANUP` | `Speed of Sound: Velocity of acoustic wave propagation through air (c = √(γ·P/ρ)), determining wavelength λ = c/f and organ pipe resonances.` |
| `adv_AirDensity_kg_per_m3` | - | Advanced | `CLEANUP` | `Air Density: Mass per unit volume of air (ρ), acting as medium mass loading on driver cone and port air column.` |
| `adv_SimVcInductance` | - | Advanced | `CLEANUP` | `Simulate Voice Coil Inductance: Includes coil inductance Le in acoustic SPL calculations, modeling high-frequency rolloff from rising coil impedance.` |
| `adv_ForceFlatResponse` | - | Advanced | `CLEANUP` | `Force Flat Response: Applies dynamic inverse-EQ to force flat SPL output, exposing real excursion and power demands needed to boost low bass.` |
| `adv_TlPortModel` | - | Advanced | `CLEANUP` | `Transmission Line Port Model: Models vent as a distributed acoustic transmission line, adding internal organ-pipe standing wave peaks to output graphs.` |
| `adv_RgAtDriverSide` | - | Advanced | `CLEANUP` | `Rg Placement: Applies series resistance Rg to each driver individually (on) vs globally at amp output (off), altering multi-driver impedance.` |
| `adv_SplXmaxLimited` | - | Advanced | `CLEANUP` | `Xmax Limited SPL: Limits plotted SPL output at frequencies where cone displacement exceeds linear travel Xmax, highlighting distortion limits.` |
| `adv_UseWinisdAirModel` | - | Advanced | `REWRITE` | `Air Model Selection: Toggles between legacy WinISD air equations and standardized CIPM-2007 moist air thermodynamics.` |
| `driver_Fs_hz` | `Fs_hz` | Driver | `REWRITE` | `Driver Resonant Frequency: Free-air fundamental resonance frequency where moving mass Mms and suspension compliance Cms resonate (Fs = 1/(2π√(Mms·Cms))).` |
| `driver_Qts` | `Qts` | Driver | `REWRITE` | `Total Quality Factor: Combined total damping factor at Fs (Qts = Qes·Qms/(Qes+Qms)), controlling frequency response peakiness and box volume demand.` |
| `driver_Qes` | `Qes` | Driver | `REWRITE` | `Electrical Quality Factor: Damping factor at Fs from back-EMF current flowing through voice coil resistance Re; primary determinant of motor strength.` |
| `driver_Qms` | `Qms` | Driver | `REWRITE` | `Mechanical Quality Factor: Damping factor at Fs from mechanical friction losses in surround and spider suspension.` |
| `driver_Vas_l` | `Vas_m3` | Driver | `REWRITE` | `Equivalent Compliance Volume: Air volume whose acoustic spring stiffness equals suspension compliance Cms; larger Vas indicates softer suspension.` |
| `driver_Re_ohm` | `Re_ohm` | Driver | `REWRITE` | `DC Voice Coil Resistance: Direct-current electrical resistance of voice coil wire; sets baseline amplifier current draw and motor damping Qes.` |
| `driver_Le_mH` | `Le_H` | Driver | `REWRITE` | `Voice Coil Inductance: Voice coil self-inductance; causes rising impedance at high frequencies, attenuating high-frequency output.` |
| `driver_Mms_g` | `Mms_kg` | Driver | `REWRITE` | `Moving Mass: Total moving mass of cone, voice coil, former, and air loading; heavier Mms lowers resonant frequency Fs and efficiency.` |
| `driver_Sd_cm2` | `Sd_m2` | Driver | `REWRITE` | `Effective Diaphragm Area: Radiating piston area of cone and inner surround; sets acoustic volume displacement (Vd = Sd · Xmax).` |
| `driver_Xmax_mm` | `Xmax_m` | Driver | `REWRITE` | `Peak Linear Excursion: Maximum 1-way linear cone travel before voice coil leaves gap magnetic flux, causing non-linear distortion.` |
| `driver_Pe_W` | `Pe_W` | Driver | `REWRITE` | `Thermal Power Handling: Maximum continuous electrical power voice coil can dissipate without thermal insulation breakdown.` |
| `driver_BL_Tm` | `BL_Tm` | Driver | `REWRITE` | `Motor Force Factor: Product of magnetic flux density B and coil wire length L in gap; measures motor Lorentz force output per ampere (F = BL·I).` |
| `driver_Cms_mm_per_N` | `Cms_m_per_N` | Driver | `REWRITE` | `Mechanical Compliance: Suspension spring flexibility (inverse spring rate); softer suspension increases Cms and Vas.` |
| `driver_Rms_Ns_per_m` | `Rms_kg_per_s` | Driver | `REWRITE` | `Mechanical Resistance: Mechanical friction damping loss in surround and spider materials; lower Rms improves transient clarity.` |
| `driver_Eta0` | `no` | Driver | `REWRITE` | `Reference Efficiency: Percentage of electrical power converted into acoustic sound power in passband (η₀ = (4π²/c³) · (Fs³·Vas/Qes) × 100%).` |
| `driver_USPL_dB` | `USPL_dB` | Driver | `REWRITE` | `Voltage Sensitivity: Sound pressure at 1 m for 2.83 V RMS drive; higher on low-impedance drivers (USPL = SPL + 10·log₁₀(8/Re)).` |
| `driver_SPL_dB` | `SPL_dB` | Driver | `REWRITE` | `Power Sensitivity: Sound pressure level at 1 m produced by 1 W electrical power input, independent of coil impedance.` |
| `driver_NumVC` | `numVC` | Driver | `REWRITE` | `Voice Coil Count: Number of independent voice coil windings on former (single or dual); sets available series/parallel wiring choices.` |
| `driver_VCCon` | `VCCon` | Driver | `CLEANUP` | `Voice Coil Wiring: Wiring setup for dual voice coils; series doubles coil resistance Re and BL, parallel halves Re while keeping BL.` |
| `driver_EBP_hz` | `EBP_hz` | Driver | `REWRITE` | `Efficiency Bandwidth Product: Ratio of Fs to Qes (Fs / Qes); indicates enclosure suitability (EBP < 50 favours sealed, > 90 favours vented).` |
| `driver_SPLmaxLF_dB` | `SPLmaxLF_dB` | Driver | `CLEANUP` | `Low Frequency Excursion Limit SPL: Theoretical maximum sound pressure level at 20 Hz limited strictly by peak diaphragm excursion Xmax.` |
| `driver_SPLmax_dB` | `SPLmax_dB` | Driver | `REWRITE` | `Thermally Limited Max SPL: Maximum acoustic sound pressure level when driven at full thermal power rating Pe.` |
| `driver_Rme_Ns_per_m` | `Rme_kg_per_s` | Driver | `CLEANUP` | `Motional Resistance at Resonance: Electromagnetic damping resistance generated by back-EMF at resonance.` |
| `driver_Gamma` | `gamma_m_per_s2_A` | Driver | `REWRITE` | `Acceleration Factor: Ratio of motor force BL to moving mass Mms, measuring initial cone acceleration per ampere.` |
| `driver_Mpow` | `Mpow_N_per_sqrtW` | Driver | `CLEANUP` | `Power-Normalized Motor Force: Motor force produced per square root of input power (BL / √Re).` |
| `driver_Mcost_kg_per_s` | `Mcost_kg_per_s` | Driver | `CLEANUP` | `Motor Figure of Merit: Dynamic electromagnetic coupling efficiency accounting for gap geometry and displacement.` |
| `driver_Gloss_pct` | `Gloss` | Driver | `CLEANUP` | `Gravity Sag Percentage: Percentage of peak excursion Xmax consumed by cone displacement under gravity when mounted horizontally.` |
| `driver_Znom_ohm` | `Znom_ohm` | Driver | `REWRITE` | `Nominal Impedance: Rated speaker impedance classification (e.g. 4, 8, or 16 ohms) for amplifier matching.` |
| `driver_AlfaVC_per_K` | `alfaVC_per_K` | Driver | `CLEANUP` | `Voice Coil Temp Coefficient: Temperature coefficient of coil wire (copper ≈ 0.00393/K); sets coil resistance rise as temperature increases.` |
| `driver_VcTempRise_K` | - | Driver | `CLEANUP` | `Voice Coil Temp Rise: Voice coil heating caused by electrical power dissipation (I² Re), increasing coil resistance Re and inducing thermal power compression.` |
| `driver_AddedMass_g` | - | Driver | `CLEANUP` | `Cone Added Mass: Test mass temporarily added to the cone to shift resonant frequency (Fs), allowing calculation of suspension compliance (Cms) and moving mass (Mms).` |
| `filter_Fc_hz` | - | Filters | `REWRITE` | `Filter Cutoff Frequency: Frequency where filter attenuation begins (3 dB corner) or center frequency of peaking EQ boost/cut.` |
| `filter_Q` | - | Filters | `REWRITE` | `Filter Quality Factor: Resonance sharpness Q; higher Q creates sharper frequency transition or narrower EQ peaking bandwidth.` |
| `filter_Gain_dB` | - | Filters | `REWRITE` | `Filter Gain: Peak boost or cut amplitude in dB applied by equalizer filter at center frequency Fc.` |
| `filter_Order` | - | Filters | `REWRITE` | `Filter Order: Filter steepness order; each order adds 6 dB/octave attenuation slope past cutoff frequency (e.g., 2nd order = 12 dB/oct, 4th order = 24 dB/oct).` |

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

## 6. Target Symmetrical Dropdown Architecture (`SelectorOption<T>`)

To eliminate structural drift, property name mismatches (`qtc` vs `value`), and ad-hoc string/object option handling, all dropdown options across the application are standardized onto a single unified, strongly-typed contract:

```ts
export interface SelectorOption<T = string | number> {
  readonly value: T;
  readonly label: string;
}
```

Every dropdown field in [uiFields.ts](file:///home/john/work/winisd/openisd/packages/ui/src/logic/fields/uiFields.ts) exposes `readonly options?: readonly SelectorOption[]` directly on its spec entry, ensuring 100% template and type symmetry across all controls:

| Target Dropdown Control | SSOT Field Spec ID | Target Option Contract | Option Value & Label Pairs | Loaded From (File Path, Class/Func, Data Types & API) |
| :--- | :--- | :--- | :--- | :--- |
| **Port End Correction** | `vent_EndCorrection` | `readonly SelectorOption<number>[]` | `0.613` ("Two free ends"), `0.732` ("One flanged end"), `0.849` ("Two flanged ends") | `packages/design/fields/options.ts` → `END_CORRECTION_OPTIONS` (`readonly SelectorOption<number>[]`) |
| **Vent Geometry / Shape** | `vent_Shape` | `readonly SelectorOption<string>[]` | `'round'` ("Round Tube"), `'slotted'` ("Slotted Duct") | `packages/design/fields/options.ts` → `VENT_SHAPE_OPTIONS` (`readonly SelectorOption<string>[]`) |
| **Voice Coil Wiring** | `driver_VCCon` | `readonly SelectorOption<string>[]` | `'Parallel'` ("Parallel"), `'Series'` ("Series") | `packages/design/fields/options.ts` → `VC_CONNECTION_OPTIONS` (`readonly SelectorOption<string>[]`) |
| **Sealed Alignment Target ($Q_{tc}$)** | `box_Qtc` | `readonly SelectorOption<number>[]` | `0.500` ("0.500 Critically damped"), `0.577` ("0.577 Max flat delay"), `0.707` ("0.707 Max flat amplitude"), `0.800–1.500` ("Equal ripple") | `packages/design/fields/options.ts` → `SEALED_ALIGNMENT_OPTIONS` & `packages/design/engine/boxDesign.ts` → `sealedAlignmentOptions()` |
| **Enclosure Type** | `box_Type` | `readonly SelectorOption<BoxType>[]` | `'closed'` ("Sealed"), `'vented'` ("Vented"), `'bandpass4'` ("4th-Order Bandpass"), `'box-passive-radiator'` ("Passive Radiator") | `packages/design/fields/options.ts` → `BOX_TYPE_OPTIONS` (`readonly SelectorOption<BoxType>[]`) |
| **Filter Type** | `filter_Type` | `readonly SelectorOption<FilterType>[]` | `'highpass'` ("Highpass"), `'lowpass'` ("Lowpass"), `'peaking'` ("Peaking EQ"), `'linkwitz'` ("Linkwitz-Transform") | `packages/ui/src/logic/series.ts` → `FILTER_TYPE_OPTIONS` (`readonly SelectorOption<FilterType>[]`) |
| **Enclosure Damping Fill** | `loss_DampingMode` | `readonly SelectorOption<LossMode>[]` | `'none'` ("None"), `'minimal'` ("Minimal"), `'normal'` ("Normal"), `'heavy'` ("Heavy") | `packages/ui/src/logic/environment.ts` → `lossModeOptions()` (`readonly SelectorOption<LossMode>[]`) |
| **Driver Array Wiring** | `driver_ArrayWiring` | `readonly SelectorOption<Wiring>[]` | `'parallel'` ("Parallel"), `'series'` ("Series") | `packages/ui/src/logic/appState.ts` → `ARRAY_WIRING_OPTIONS` (`readonly SelectorOption<Wiring>[]`) |
| **Passive Radiator Library** | `pr_LibrarySelect` | `readonly SelectorOption<string>[]` | Dynamic list of saved PR records (`value: uuid, label: name`) | `packages/persistence/src/repos/savedLibrary.ts` → `useSavedLibrary().passiveRadiators` (`Ref<SavedRecord[]>`, API: `getLibraryRecords('passive-radiator')`) |
| **Driver Library** | `driver_LibrarySelect` | `readonly SelectorOption<string>[]` | Dynamic list of saved driver records (`value: uuid, label: model`) | `packages/persistence/src/repos/savedLibrary.ts` → `useSavedLibrary().drivers` (`Ref<SavedRecord[]>`, API: `getLibraryRecords('driver')`) |

