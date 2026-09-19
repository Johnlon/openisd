# Plan: Field Registry Description Audit, Interactive Popovers & UI SSOT Integration

## 1. Context & Objectives

The single source of truth (SSOT) for all field definitions in OpenISD is [fieldRegistry.ts](http://localhost:4000/packages/ui/src/logic/fields/fieldRegistry.ts).

This plan addresses three core architectural & quality issues:
1. **Description Quality:** Remove technical debt, decimal-place notes (`WinISD X dp`), codebase paths (`logic/useVentGroup.ts`), ledger references (`QO32`), and dev rants from `description` strings. Standardize descriptions to `[Symbol / Short Name] – [Title]: [Acoustic Function & Physical Meaning]`.
2. **Interactive Clickable Tooltips:** Replace native HTML `title` attributes with an interactive popover component (`FieldHelpPopover.vue`) that supports clickable external reference links (e.g., [SpeakerWizard](https://speakerwizard.co.uk/)) without dismissing on cursor movement.
3. **Exclusive UI SSOT Binding:** Ensure all UI components ([PREditModal.vue](http://localhost:4000/packages/ui/src/ui/components/PREditModal.vue), [DriverEditorModal.vue](http://localhost:4000/packages/ui/src/ui/components/DriverEditorModal.vue), [OgTune.vue](http://localhost:4000/packages/ui/src/ui/shells/original/OgTune.vue)) derive labels, units, precisions, min/max bounds, and help text exclusively from `fieldRegistry.ts` via `<NumInput field="id">`.

---

## 2. Interactive Tooltip & External Reference Strategy

### Problem:
Native HTML `title` attributes dismiss as soon as the user moves the mouse toward the text, making embedded URLs unclickable.

### Solution:
1. **Optional External Reference URL:** Add `readonly refUrl?: string;` to `UIFieldSpec` in [fieldRegistry.ts](http://localhost:4000/packages/ui/src/logic/fields/fieldRegistry.ts).
2. **Interactive `FieldHelpPopover.vue` Component:**
   - Uses a hover-bridge (`pointer-events: auto` / HTML Popover API) so the card remains visible when hovering over either the input or the popover box itself.
   - Renders formatted markdown links with `target="_blank" rel="noopener"`.
   - Supports keyboard accessibility (`Escape` key close) and click-outside dismissal.

### Example ($\eta_0$ Reference Efficiency):
- **Label:** `no` (η₀ / Reference Efficiency)
- **Short Description:** `η₀ (Eta Zero) – Reference Efficiency: How effectively a speaker converts power into sound.`
- **External Ref:** `https://speakerwizard.co.uk/%CE%B7%E2%82%80-eta-zero-reference-efficiency-how-effectively-a-speaker-converts-power-into-sound/`

---

## 3. UI SSOT Architecture & Precision Unification

1. **Auto-Inheritance in [NumInput.vue](http://localhost:4000/packages/ui/src/ui/components/NumInput.vue):**
   - Passing `field="id"` automatically resolves `precision`, `min`/`max` bounds, `unitGroup`, default `unit`, and `helpText` via `fieldById(id)`.
   - Props passed to `<NumInput>` act as fallback defaults or explicit overrides.
2. **Template Simplification:**
   - Remove hardcoded `<label>` strings, inline `:precision="N"`, and repeated `:title="fieldHelp(...)"` bindings across form components.
3. **Unify Display Precision in [units.ts](http://localhost:4000/packages/ui/src/logic/fields/units.ts):**
   - Update `MAX_DP` to 5 so 5-decimal-place fields (`Rme`, `Mcost`, `advAirDensity`) are not silently clamped.

---

## 4. Comprehensive Field Decision Matrix

| Field ID | Pane | Current Description (Summary) | Decision | Proposed New User-Facing Description |
| :--- | :--- | :--- | :--- | :--- |
| `Vb` | Box | Net internal enclosure volume... WinISD shows 2 dp. | `REWRITE_PARITY` | `Vb – Net Enclosure Volume: Internal net air volume of the enclosure acting as the acoustic spring for the driver.` |
| `Vf` | Box | Front (sealed/vented) chamber volume... | `REWRITE_PARITY` | `Vf – Front Chamber Volume: Net air volume of the front (vented) chamber in a bandpass enclosure.` |
| `Fb` | Box | The tuning the design is aimed at... (logic/useVentGroup.ts, QO11)... WinISD 2 dp. | `REWRITE_PARITY` | `Fb – Box Tuning Frequency: Helmholtz resonance frequency of the vented enclosure determined by port dimensions and box volume.` |
| `boxResonance` | Box | Labelled Fsc for sealed, Fh for PR... winisd_research FINDING-007. | `REWRITE_PARITY` | `Fsc / Fh – System Resonance Frequency: Effective total resonance frequency of the driver coupled to the enclosure.` |
| `rearResonance` | Box | Rear-chamber resonance of 4th-order bandpass... | `REWRITE_PARITY` | `Frc (Calculated) – Rear Chamber Resonance: Sealed rear-chamber resonance frequency in a 4th-order bandpass enclosure (Frc = Fs × √(1 + Vas/Vb)).` |
| `Frc` | Box | Rear-chamber tuning frequency, ENTERED... | `REWRITE_PARITY` | `Frc – Rear Chamber Tuning Frequency: Target Helmholtz tuning frequency for the vented rear chamber in 6th-order bandpass and ABC enclosures.` |
| `ventShape` | Vents | Circular or rectangular/slotted port geometry. | `REWRITE_PARITY` | `Vent Shape – Geometry: Selects between a circular tube (round) or rectangular duct (slotted) port.` |
| `ventD` | Vents | Circular port diameter... WinISD 2 dp (10.20 cm). | `REWRITE_PARITY` | `Dv – Port Diameter: Internal diameter of a round port tube. Larger diameters reduce port air turbulence (choking) but require longer tubes.` |
| `ventW` | Vents | Slotted port width. | `REWRITE_PARITY` | `Wv – Slot Port Width: Internal width of a rectangular slotted port.` |
| `ventH` | Vents | Slotted port height. | `REWRITE_PARITY` | `Hv – Slot Port Height: Internal height of a rectangular slotted port.` |
| `ventL` | Vents | Port length; with diameter sets Fb. OpenISD enters in cm... WinISD derives in m... | `REWRITE_PARITY` | `Lv – Vent Length: Physical length of the port tube/duct. Longer ports lower the tuning frequency for a fixed volume.` |
| `endCorrection` | Vents | Port end-correction coefficient... WinISD parity. | `REWRITE_PARITY` | `k – End Correction Factor: Acoustic mass loading coefficient for tube ends (0.613 for free ends, 0.732 for one flanged end, 0.849 for two flanged ends).` |
| `ventCrossArea` | Vents | Port cross-sectional area (WinISD derived readout, 4 dp)... | `REWRITE_PARITY` | `Av – Vent Cross-Sectional Area: Total internal cross-sectional area of the port.` |
| `portResonance` | Vents | First organ-pipe (standing-wave) resonance... WinISD 2 dp (86.87 Hz). | `REWRITE_PARITY` | `f_pipe – First Vent Pipe Resonance: Lowest organ-pipe standing wave resonance inside the port tube (f = c / 2L).` |
| `prSd` | PassiveRadiator | Passive-radiator effective piston area. OpenISD 2 dp. | `REWRITE_PARITY` | `Sd (PR) – Passive Radiator Area: Effective radiating piston surface area of the passive radiator.` |
| `prXmax` | PassiveRadiator | Passive-radiator peak linear excursion. OpenISD 2 dp. | `REWRITE_PARITY` | `Xmax (PR) – Passive Radiator Excursion Limit: Maximum peak linear cone displacement of the passive radiator diaphragm.` |
| `prNum` | PassiveRadiator | Count of passive radiators (integer). | `REWRITE_PARITY` | `N_PR – Passive Radiator Count: Number of identical passive radiators installed in the enclosure.` |
| `prMadd` | PassiveRadiator | Mass added to PR... WinISD 1 dp (g). | `REWRITE_PARITY` | `Madd (PR) – PR Added Mass: Additional ballast mass attached to the passive radiator cone to lower its tuning frequency.` |
| `Fp` | PassiveRadiator | PR target system tuning... flags with warning. | `REWRITE_PARITY` | `Fp – Passive Radiator System Tuning: Helmholtz tuning frequency achieved by the passive radiator and enclosure volume.` |
| `prVas` | PassiveRadiator | PR compliance-equivalent volume. WinISD 2 dp. | `REWRITE_PARITY` | `Vas (PR) – PR Equivalent Compliance Volume: Volume of air having the same acoustic compliance as the passive radiator suspension.` |
| `prFs` | PassiveRadiator | The RADIATOR's own free-air resonance... view_3_passive_radiator.png... | `REWRITE_PARITY` | `Fpr – Unloaded PR Resonance: Fundamental free-air resonance frequency of the passive radiator without added mass or box coupling.` |
| `prQms` | PassiveRadiator | PR mechanical Q. WinISD 3 dp (3.300). | `REWRITE_PARITY` | `Qms (PR) – PR Mechanical Quality Factor: Quality factor representing mechanical suspension friction losses in the passive radiator.` |
| `prFsMass` | PassiveRadiator | The radiator's free-air resonance loaded with added mass... WinISD 2 dp. | `REWRITE_PARITY` | `Fpr (loaded) – Mass-Loaded PR Resonance: Free-air resonance frequency of the passive radiator including added mass Madd.` |
| `Pin` | Signal | Primary drive level... At project creation OpenISD stores... OpenISD 2 dp. | `REWRITE_PARITY` | `Pin – System Input Power: Total electrical power supplied to the loudspeaker system (Pin = V² / Re).` |
| `driveV` | Signal | Per-driver drive voltage... WinISD 1 dp. | `REWRITE_PARITY` | `Vin – Driver Terminal Voltage: RMS input voltage applied across the driver voice coil terminals.` |
| `Rs` | Signal | Amplifier output + cabling resistance... WinISD 3 dp. | `REWRITE_PARITY` | `Rg – Series Resistance: Combined amplifier output impedance, wiring, and crossover component resistance in series with the driver.` |
| `listenDistance` | Signal | Listening distance (WinISD 3 dp)... Not modelled yet. | `REWRITE_PARITY` | `d – Listening Distance: On-axis distance from the loudspeaker to the listener for SPL calculations.` |
| `listenAngle` | Signal | Off-axis listening angle (WinISD 4 dp)... Not modelled. | `REWRITE_PARITY` | `θ – Off-Axis Angle: Angular offset from the main acoustic axis in radians.` |
| `genHz` | Signal | Tone-generator frequency. WinISD 2 dp. | `REWRITE_PARITY` | `f_gen – Test Tone Frequency: Target frequency evaluated by the single-tone signal generator.` |
| `Ql` | Box losses | Enclosure leakage loss Q. | `REWRITE_PARITY` | `Ql – Enclosure Leakage Loss Q: Quality factor accounting for acoustic energy losses through cabinet seams and gaskets.` |
| `Qa` | Box losses | Enclosure absorption (fill) loss Q. | `REWRITE_PARITY` | `Qa – Enclosure Damping Loss Q: Quality factor accounting for acoustic energy absorption by internal damping fill.` |
| `Qp` | Box losses | Port (vent) loss Q. | `REWRITE_PARITY` | `Qp – Port Friction Loss Q: Quality factor representing air friction and viscous boundary losses inside the vent.` |
| `advTemp` | Advanced | Ambient temperature... WinISD 2 dp (293.15 K). | `REWRITE_PARITY` | `T – Ambient Temperature: Atmospheric temperature used to calculate speed of sound and air density.` |
| `advHumidity` | Advanced | Ambient relative humidity... spurious precision... | `CLEANUP_DEV` | `RH – Relative Humidity: Atmospheric humidity percentage affecting sound speed and medium density.` |
| `advPressure` | Advanced | Ambient air pressure... WinISD shows Pa... MUST guard... | `CLEANUP_DEV` | `p₀ – Air Pressure: Atmospheric barometric pressure influencing medium density and acoustic impedance.` |
| `advSoundVelocity` | Advanced | Speed of sound... WinISD shows 2 dp... engine air.ts... | `CLEANUP_DEV` | `c – Speed of Sound: Velocity of acoustic wave propagation through air under ambient conditions.` |
| `advAirDensity` | Advanced | Air density... WinISD shows 5 dp... engine air.ts... | `CLEANUP_DEV` | `ρ₀ (Rho) – Air Density: Mass density of air derived from temperature, humidity, and barometric pressure.` |
| `simVcInductance` | Advanced | Include voice-coil inductance Le... (.wpr VCInd)... | `CLEANUP_DEV` | `Simulate Voice Coil Inductance: Includes voice coil inductance (Le) in acoustic output calculations instead of impedance plots alone.` |
| `forceFlatResponse` | Advanced | Auto-EQ the system flat... FLAT_MAX_BOOST_DB... | `CLEANUP_DEV` | `Force Flat Response: Applies auto-equalization to reveal excursion and port velocity demands required for a flat passband response.` |
| `tlPortModel` | Advanced | Model the vent as a lossy acoustic transmission line... | `CLEANUP_DEV` | `Transmission Line Port Model: Models the vent as a distributed transmission line, incorporating internal organ-pipe resonances into response curves.` |
| `rgAtDriverSide` | Advanced | Place Rg in series with EACH driver... | `CLEANUP_DEV` | `Rg Placement: Applies series resistance Rg individually to each driver rather than globally at the main amplifier output.` |
| `splXmaxLimited` | Advanced | Plot SPL chart with drive backed off... | `CLEANUP_DEV` | `Xmax Limited SPL: Clamps the SPL frequency response graph whenever cone displacement exceeds maximum linear excursion Xmax.` |
| `useWinisdAirModel` | Advanced | ON selects classic WinISD air equations... | `REWRITE_PARITY` | `Air Model Selection: Toggles between legacy WinISD air equations and standardized CIPM moist air calculations.` |
| `Fs_hz` | Driver: Parameters | Driver free-air resonance. WinISD 2 dp (Hz). | `REWRITE_PARITY` | `Fs – Driver Resonant Frequency: Free-air fundamental resonance frequency of the driver moving assembly and suspension.` |
| `Qts` | Driver: Parameters | Total driver Q. WinISD 3 dp. | `REWRITE_PARITY` | `Qts – Total Quality Factor: Total damping factor of the driver at Fs, combining electrical (Qes) and mechanical (Qms) damping.` |
| `Qes` | Driver: Parameters | Electrical Q. WinISD 3 dp. | `REWRITE_PARITY` | `Qes – Electrical Quality Factor: Quality factor measuring electrical damping generated by back-EMF in the voice coil at Fs.` |
| `Qms` | Driver: Parameters | Mechanical Q. WinISD 3 dp. | `REWRITE_PARITY` | `Qms – Mechanical Quality Factor: Quality factor measuring mechanical friction damping losses in the surround and spider at Fs.` |
| `Vas_m3` | Driver: Parameters | Compliance-equivalent volume... OpenISD 2 dp... | `REWRITE_PARITY` | `Vas – Equivalent Compliance Volume: Volume of air whose acoustic compliance equals the mechanical compliance of the driver suspension.` |
| `Re_ohm` | Driver: Parameters | DC voice-coil resistance. WinISD 3 dp (ohm). | `REWRITE_PARITY` | `Re – DC Voice Coil Resistance: Direct-current electrical resistance measured across the driver voice coil terminals.` |
| `Le_H` | Driver: Parameters | Voice-coil inductance... WinISD 6 dp... | `REWRITE_PARITY` | `Le – Voice Coil Inductance: Self-inductance of the voice coil causing high-frequency electrical impedance rise.` |
| `Mms_kg` | Driver: Parameters | Moving mass... WinISD 5 dp... | `REWRITE_PARITY` | `Mms – Moving Mass: Total mass of the driver diaphragm, voice coil, former, and air mass loading.` |
| `Sd_m2` | Driver: Parameters | Effective piston area. OpenISD shows cm² at 2 dp. | `REWRITE_PARITY` | `Sd – Effective Diaphragm Area: Effective radiating piston area of the driver cone and inner surround.` |
| `Xmax_m` | Driver: Parameters | Peak linear excursion. OpenISD shows mm at 2 dp. | `REWRITE_PARITY` | `Xmax – Peak Linear Excursion: Peak one-way linear cone displacement where voice coil coverage remains inside the magnetic gap.` |
| `Pe_W` | Driver: Parameters | Thermal power handling. WinISD 1 dp (W). | `REWRITE_PARITY` | `Pe – Thermal Power Handling: Maximum continuous electrical power input the voice coil can dissipate without thermal failure.` |
| `BL_Tm` | Driver: Parameters | Force factor... WinISD 5 dp... | `REWRITE_PARITY` | `BL – Motor Force Factor: Product of magnetic gap flux density B and voice coil wire length L, measuring motor coupling strength.` |
| `Cms_m_per_N` | Driver: Parameters | Mechanical compliance... WinISD µm/N... | `REWRITE_PARITY` | `Cms – Mechanical Compliance: Mechanical flexibility (spring rate inverse) of the suspension system.` |
| `Rms_kg_per_s` | Driver: Parameters | Mechanical loss resistance. WinISD 5 dp... | `REWRITE_PARITY` | `Rms – Mechanical Resistance: Mechanical friction loss resistance of the driver suspension system.` |
| `no` | Driver: Parameters | Reference efficiency (WinISD 4 dp). | `EXPAND_DOMAIN` | `η₀ (Eta Zero) – Reference Efficiency: How effectively a speaker converts electrical power into acoustic sound power in its passband (η₀ = P_acc / P_elec × 100%). Benchmarks: ≥4% Very High (compression/horn), 3–4% High (PA woofer), 2–3% Good (studio monitor), 1.5–2% Average (hi-fi), 0.75–1.5% Low, <0.75% Very Low (infra-sub). Higher η₀ raises SPL; Hoffman's Iron Law dictates deep sub bass extension requires lower η₀.` |
| `USPL_dB` | Driver: Parameters | Sensitivity referred to 2.83 V... WinISD 2 dp. | `REWRITE_PARITY` | `USPL – Voltage Sensitivity: Sound pressure level at 1 meter produced by a standard 2.83 V RMS input voltage.` |
| `SPL_dB` | Driver: Parameters | Reference sensitivity SPL (WinISD 2 dp). | `REWRITE_PARITY` | `SPL – Power Sensitivity: Sound pressure level at 1 meter produced by a 1 Watt electrical power input.` |
| `numVC` | Driver: Parameters | Number of voice coils... WinISD: numVC. | `REWRITE_PARITY` | `N_vc – Voice Coil Count: Number of independent voice coil windings on the driver motor assembly.` |
| `VCCon` | Driver: Parameters | How voice coils are wired... Ledger QO97. | `CLEANUP_DEV` | `Voice Coil Wiring: Wiring configuration (series or parallel) for multi-voice-coil drivers determining total terminal resistance Re and BL.` |
| `EBP_hz` | Driver: Advanced | Efficiency bandwidth product (WinISD 2 dp)... | `REWRITE_PARITY` | `EBP – Efficiency Bandwidth Product: Ratio of Fs to Qes (Fs / Qes); indicates enclosure suitability (EBP < 50 favours sealed, > 90 favours vented).` |
| `SPLmaxLF_dB` | Driver: Advanced | Excursion-limited max SPL at 20 Hz... ledger QO32. | `CLEANUP_DEV` | `SPLmaxLF – Low Frequency Excursion Limit SPL: Theoretical maximum sound pressure level at 20 Hz limited strictly by peak diaphragm excursion Xmax.` |
| `SPLmax_dB` | Driver: Advanced | Thermally-limited max SPL... WinISD 2 dp. | `REWRITE_PARITY` | `SPLmax – Thermally Limited Max SPL: Maximum acoustic sound pressure level when driven at full thermal power rating Pe.` |
| `Rme_kg_per_s` | Driver: Advanced | Motional resistance at resonance... Beyma 10BR60... | `CLEANUP_DEV` | `Rme – Motional Resistance at Resonance: Electromagnetic damping resistance generated by back-EMF at resonance.` |
| `gamma_m_per_s2_A` | Driver: Advanced | Motor force per unit moving mass... WinISD 5 dp. | `REWRITE_PARITY` | `γ (Gamma) – Acceleration Factor: Ratio of motor force BL to moving mass Mms, measuring initial cone acceleration per ampere.` |
| `Mpow_N_per_sqrtW` | Driver: Advanced | Motor force per square root of input power... | `CLEANUP_DEV` | `Mpow – Power-Normalized Motor Force: Motor force produced per square root of input power (BL / √Re).` |
| `Mcost_kg_per_s` | Driver: Advanced | Motor figure of merit... ledger QO32. | `CLEANUP_DEV` | `Mcost – Motor Figure of Merit: Dynamic electromagnetic coupling efficiency accounting for gap geometry and displacement.` |
| `Gloss` | Driver: Advanced | Cone sag under gravity... ledger QO32. | `CLEANUP_DEV` | `Gloss – Gravity Sag Percentage: Percentage of peak excursion Xmax consumed by cone displacement under gravity when mounted horizontally.` |
| `Znom_ohm` | Driver: Parameters | Nominal impedance... WinISD: Znom. | `REWRITE_PARITY` | `Znom – Nominal Impedance: Rated speaker impedance classification (e.g. 4, 8, or 16 ohms) for amplifier matching.` |
| `alfaVC_per_K` | Driver: Advanced | Voice-coil resistance temp coeff... circuit.ts... | `CLEANUP_DEV` | `α_VC – Voice Coil Temp Coefficient: Thermal resistance coefficient of voice coil wire, determining resistance rise per degree of heating.` |
| `vcTempRise` | Driver | Voice-coil temp rise... circuit.ts... | `CLEANUP_DEV` | `ΔT_VC – Voice Coil Temp Rise: Temperature rise of the voice coil above ambient, causing thermal power compression.` |
| `driverAddedMass` | Driver | Mass added to ACTIVE DRIVER's cone... sweep()... | `CLEANUP_DEV` | `Madd – Driver Cone Added Mass: Calibration mass added to the cone during testing to measure suspension compliance.` |
| `filterFc` | Filters | Filter cutoff / centre frequency. WinISD 3 dp. | `REWRITE_PARITY` | `Fc – Cutoff / Center Frequency: Cutoff or center frequency of the active signal filter.` |
| `filterQ` | Filters | Filter Q. WinISD 3 dp (0.707). | `REWRITE_PARITY` | `Q_filter – Filter Quality Factor: Quality factor determining resonance peak sharpness or damping of the filter.` |
| `filterGain` | Filters | Filter gain... WinISD 3 dp. | `REWRITE_PARITY` | `Gain – Filter Gain: Boost or attenuation gain applied by the equalizer or filter in dB.` |
| `filterOrder` | Filters | Filter order... WinISD 3 dp. | `REWRITE_PARITY` | `Order – Filter Order: Filter steepness order (e.g. 1st order 6 dB/oct, 2nd order 12 dB/oct, 4th order 24 dB/oct).` |
