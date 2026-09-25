# Plan: UI Field Description Cleanup & SSOT Integration

## Executive Summary
This plan cleans up all user-facing field descriptions and makes
[uiFields.ts](file:///home/john/work/winisd/openisd/packages/ui/src/logic/fields/uiFields.ts)
(`UI_FIELD_SPECS`, in `packages/ui/src/logic/fields/`) the single source of truth (SSOT) for what a
UI control shows about a field: its label, description, unit, display precision, entry bounds and
— for a dropdown — its option list. It is NOT a second table of where the value lives: the value
lives on the domain object under the schema's own field name, and the control binds that name
directly.

**Status (2026-09-20): complete.** §4 (110 rows — every `UI_FIELD_SPECS` entry) matches the
registry text one-for-one; §6 is done for every `<select>` in the app; §1/§2 below describe the
design as shipped. The `packages/ui/public/` copy of this file is gone — this is the only copy.

---

## 1. Context Mapping: How UI Fields Map to Domain Models

`UI_FIELD_SPECS` spans 12 UI panes (Box, Box losses, Vents, PassiveRadiator, Signal, Advanced,
Filters, Driver, Driver: General, Driver: Parameters, Driver: Advanced, Driver: Dimensions).
IDs follow the `<prefix>_<symbol>_<unit>` snake_case
convention (`driver_XXXX`, `pr_XXXX`, `box_XXXX`, `vent_XXXX`, `signal_XXXX`, `loss_XXXX`,
`adv_XXXX`, `filter_XXXX`); each spec also lists the `aliases` the templates use to reach it
(`fieldById('Fs_hz')`, `precision('driverAddedMass')`).

**How a control reaches its value — no mapping table.** The registry carries display text only.
The binding from a control to the domain is the schema field name itself:

1. **Driver Specification Context:**
   - **Fields:** `driver_Fs_hz`, `driver_Vas_l`, `driver_Re_ohm`, `driver_Qts`, `driver_Xmax_mm`, `driver_Pe_W`, `driver_BL_Tm`, `driver_Cms_mm_per_N`, `driver_Qms`, `driver_Qes`, `driver_Rms_Ns_per_m`, `driver_Mms_g`, `driver_Sd_cm2`, `driver_Eta0`, `driver_USPL_dB`, `driver_SPL_dB`, `driver_NumVC`, `driver_VCCon`, `driver_EBP_hz`, `driver_AlfaVC_per_K`, `driver_Znom_ohm`, `driver_c_m_per_s`, `driver_roo_kg_per_m3`, `driver_Thick_mm`, `driver_Depth_mm`, `driver_MagDepth_mm`, `driver_Magnet_mm`, `driver_Basket_mm`, `driver_Outer_mm`, `driver_Vcd_mm`, `driver_Dvol_cm3`.
   - **Binding:** the Driver Editor calls `cellVal('Fs_hz')` / `setNum('Fs_hz', v)` with the schema
     name (`SpecField`, derived from `OpenIsdDeviceFieldKey` in
     [appState.ts](file:///home/john/work/winisd/openisd/packages/ui/src/logic/appState.ts)).
     [driverSpecFields.ts](file:///home/john/work/winisd/openisd/packages/ui/src/logic/driverSpecFields.ts)
     → `specFieldHandle(driver, field)` is `driver.spec[driver.section][field]` — one line, a
     compile error if the schema renames a field. `VCCon` is the wiring select, not a numeric cell.
   - **Record shape:** `specs` is a sum type in
     [openisdSchema.ts](file:///home/john/work/winisd/openisd/packages/design/domain/openisdSchema.ts):
     a driver is `{ woofer, tweeter? }`, a passive radiator is `{ 'passive-radiator' }`; both or
     neither is refused at parse. Readers narrow with `driverSpecsOf(json)` / `radiatorSpecsOf(json)`.
2. **Passive Radiator Context:**
   - **Fields:** `pr_Sd_cm2`, `pr_Xmax_mm`, `pr_Num`, `pr_Madd_g`, `pr_Fp_hz`, `pr_Vas_l`, `pr_Fs_hz`, `pr_Qms`, `pr_FsMass_hz`.
   - **Binding:** the PR section is its own, smaller schema (`passiveRadiatorSpecsSectionJsonSchema`
     — no motor/electrical fields; a `Re_ohm` in a PR section is refused). The Tune pane reads
     `project.box.passiveRadiator.<field>` directly (`usePrGroup`, keys `tuning_hz` / `addedMass_kg`).
3. **Enclosure & Vent Group Context:**
   - **Fields:** `box_Type`, `box_Qtc`, `box_Vb_l`, `box_Vf_l`, `box_Fb_hz`, `box_Resonance_hz`, `box_RearResonance_hz`, `box_Frc_hz`, `vent_Count`, `vent_Shape`, `vent_D_cm`, `vent_W_cm`, `vent_H_cm`, `vent_L_cm`, `vent_EndCorrection`, `vent_CrossArea_m2`, `vent_1stPortResonance_hz`.
   - **Binding:** `project.box.vented.vent.diameter_m`, `project.box.vented.vent.count`,
     `project.box.vented.volume_m3` … — the owning domain object's typed field, read in
     [OriginalShell-hooks.ts](file:///home/john/work/winisd/openisd/packages/ui/src/hooks/OriginalShell-hooks.ts).
     `vent_Count` is the port count WinISD stores as `[VentRear] Num`: a record without one, or with
     one that is not a whole number ≥ 1, READS as the calculated default 1 (`calcVentCount()`,
     the same read-time repair `numVC` has) — never refused at parse.
4. **Environment & Simulator Options Context:**
   - **Fields:** `adv_Temp_K`, `adv_Humidity_pct`, `adv_Pressure_kPa`, `adv_SoundVelocity_m_per_s`, `adv_AirDensity_kg_per_m3`, `adv_SimVcInductance`, `adv_ForceFlatResponse`, `adv_TlPortModel`, `adv_RgAtDriverSide`, `adv_SplXmaxLimited`, `adv_UseWinisdAirModel`.
   - **Binding:** `useAdvancedOptions()` in
     [AdvancedOptions-hooks.ts](file:///home/john/work/winisd/openisd/packages/ui/src/hooks/AdvancedOptions-hooks.ts)
     returns `{hasVent, simVcInductance, project, fieldHelp, inputChecked}`; each toggle binds the
     project's own field (`project.forceFlatResponse`, …). The air fields (`adv_Temp_K` …) live in
     `OptionsModal.vue`, bound to the project's environment.
5. **Signal, Box losses, Filters, Driver panes:**
   - **Signal** (`signal_*`): `project.powerDrive_W`, `project.rs_ohm`, … in `OriginalShell-hooks.ts`.
   - **Box losses** (`loss_*`): `loss_DampingMode` binds `presentationState.lossMode`; `loss_Ql`/`Qa`/`Qp` bind the active box's `losses`.
   - **Filters** (`filter_*`): the filter row's own fields in `OgFilters.vue`.
   - **Driver** (`driver_nDrivers`, `driver_ArrayWiring`): `project.nDrivers`, `project.wiring`.
   - **Driver: General / Parameters / Advanced / Dimensions** (`driver_*`): the Driver Editor's
     `cellVal`/`setNum` on the schema name, as in item 1.

**Removed (2026-09-20):** `logic/fields/fieldRegistry.ts`, a re-export shim of `uiFields.ts` with no importers, is deleted; every comment that named it now says `uiFields`.

**Rejected (2026-09-20):** an earlier draft of this plan put `domainKey?: OpenIsdFieldKey` and
`handle?: (entity: any) => Field<any>` on every spec. That is a second table of the same fields
(the registry re-stating what the schema already types) and an `any`-typed dispatch; the direct
schema-name binding above is the typed reference, so neither was adopted. Likewise a
`LEGACY_FIELD_TO_SCHEMA` short-name → schema-name table was removed from the editor
(questions.yml QO166).

---

## 2. Universal UI Configuration & Parameter Inheritance

All UI controls take their **display** configuration from `UI_FIELD_SPECS`:

- **ID Convention:** `<prefix>_<symbol>_<unit>` snake_case IDs (`driver_Fs_hz`, `pr_Sd_cm2`, `box_Vb_l`), plus `aliases` for the names templates already use.
- **Labels & Descriptions:** `label` and `description` (`fieldHelp(id)`).
- **Units & Display Precision:** `unit`, `unitGroup`, and the base-unit `precision`. Rotating the unit derives the shown decimals in
  [units.ts](file:///home/john/work/winisd/openisd/packages/ui/src/logic/fields/units.ts) → `displayPrecision`: the base unit shows the registry precision unchanged (KLe 6 dp, Rme 5 dp); a converted unit is capped at 4 dp so 100 g never renders as `0.10000 kg`. Pinned by `packages/ui/test/logic/units-displayPrecision.test.ts`.
- **Sanity Entry Bounds:** `min` and `max` (`limits(id)`).
- **Enum Options:** `kind: 'enum'` specs carry `options: readonly SelectorOption<T>[]` (§6) — the same frozen list the domain exports from `packages/design/fields/options.ts`, never a hand-typed copy.

What the registry does **not** carry: where the value lives (see §1 — the schema name is the binding) or any per-field behaviour (no callbacks, no `any`).

---

## 3. Description Quality Standards & Decision Legend

1. **Redact Technical Debt:** Remove internal decimal-place annotations (`WinISD X dp`), code file paths (`logic/useVentGroup.ts`), internal ledger codes (`QO32`), and dev rants from user-facing descriptions.
2. **Clean Description Format:** Omit the redundant leading `[Symbol] –` prefix (since `label` carries the symbol). Format descriptions starting directly with `Title: Acoustic Function & Physical Meaning`.

### Decision Codes:
- **`REWRITE`**: Redact internal decimal place notes (`WinISD X dp`) and technical debt; reformat string directly as `Title: Acoustic Function & Physical Meaning`.
- **`CLEANUP`**: Strip internal code file paths (`logic/useVentGroup.ts`), dev rants, unverified notes, and ledger tracking codes (`QO32`, `QO97`, `circuit.ts`).
- **`KEEP`**: already in the `Title: meaning` form when this table was extended to every spec (2026-09-20); carried verbatim.

---

## 4. Complete Field Decision Table

All 110 `UI_FIELD_SPECS` entries, in registry order. Regenerate with the scratch `gen4.mjs`
(reads `uiFields.ts`, keeps each row's Domain Key/Decision); check with `cmp.mjs` (0 mismatches).

| Symmetrical UI Field ID | Domain Key (reference only — not a registry column) | Pane | Decision | User-Facing Description (verbatim, as `UI_FIELD_SPECS` carries it) |
| :--- | :--- | :--- | :--- | :--- |
| `box_Type` | - | Box | `KEEP` | `Enclosure Type: The kind of enclosure the driver is loaded into — closed, vented, passive radiator, bandpass or ABC.` |
| `box_Qtc` | - | Box | `KEEP` | `Sealed Alignment Target: Total system Q of the closed box; 0.707 is maximally flat, lower is more damped, higher peaks before rolling off.` |
| `box_Vb_l` | `Vb` | Box | `REWRITE` | `Net Enclosure Volume: Internal net air volume of the enclosure acting as the acoustic spring for the driver.` |
| `box_Vf_l` | `Vf` | Box | `REWRITE` | `Front Chamber Volume: Net air volume of the front (vented) chamber in a bandpass enclosure.` |
| `box_Fb_hz` | `tuning_hz` | Box | `REWRITE` | `Box Tuning Frequency: Helmholtz resonance frequency of the vented enclosure determined by port dimensions and box volume.` |
| `vent_Count` | - | Vents | `KEEP` | `Number of Vents: How many identical ports share the chamber. The air-mass term sees the total opening, so more ports of the same size need a longer port for the same tuning; the end correction stays that of one port.` |
| `vent_Shape` | - | Vents | `REWRITE` | `Vent Geometry: Selects between a circular tube (round) or rectangular duct (slotted) port.` |
| `vent_D_cm` | - | Vents | `REWRITE` | `Port Diameter: Internal diameter of a round port tube. Larger diameters reduce port air turbulence (choking) but require longer tubes.` |
| `vent_W_cm` | - | Vents | `REWRITE` | `Slot Port Width: Internal width of a rectangular slotted port.` |
| `vent_H_cm` | - | Vents | `REWRITE` | `Slot Port Height: Internal height of a rectangular slotted port.` |
| `vent_L_cm` | - | Vents | `REWRITE` | `Vent Length: Physical length of the port tube/duct. Longer ports lower the tuning frequency for a fixed volume.` |
| `vent_EndCorrection` | - | Vents | `REWRITE` | `End Correction Factor: Dimensionless factor accounting for acoustic air mass oscillating beyond the physical duct ends, extending effective acoustic port length depending on termination boundary geometry (free air vs flanged baffle).` |
| `vent_CrossArea_m2` | - | Vents | `REWRITE` | `Vent Cross-Sectional Area: Total internal cross-sectional area of the port.` |
| `vent_1stPortResonance_hz` | - | Vents | `REWRITE` | `First Vent Pipe Resonance: Frequency of the lowest organ-pipe standing wave resonance inside the port duct (f = c / 2L). Standing wave peaks in the vent column cause acoustic output peaks and noise within or above the passband, limiting usable port bandwidth.` |
| `pr_Sd_cm2` | `Sd_m2` | PassiveRadiator | `REWRITE` | `Passive Radiator Area: Effective radiating piston surface area of the passive radiator.` |
| `pr_Xmax_mm` | `Xmax_m` | PassiveRadiator | `REWRITE` | `Passive Radiator Excursion Limit: Maximum peak linear cone displacement of the passive radiator diaphragm.` |
| `pr_Num` | - | PassiveRadiator | `REWRITE` | `Passive Radiator Count: Number of identical passive radiators installed in the enclosure.` |
| `pr_Madd_g` | `Madd_kg` | PassiveRadiator | `REWRITE` | `PR Added Mass: Additional ballast mass attached to the passive radiator cone to lower its tuning frequency.` |
| `pr_Fp_hz` | - | PassiveRadiator | `REWRITE` | `Passive Radiator System Tuning: Helmholtz tuning frequency achieved by the passive radiator and enclosure volume.` |
| `pr_Vas_l` | `Vas_m3` | PassiveRadiator | `REWRITE` | `PR Equivalent Compliance Volume: Volume of air having the same acoustic compliance as the passive radiator suspension.` |
| `pr_Fs_hz` | `Fs_hz` | PassiveRadiator | `REWRITE` | `Unloaded PR Resonance: Fundamental free-air resonance frequency of the passive radiator without added mass or box coupling.` |
| `pr_Qms` | `Qms` | PassiveRadiator | `REWRITE` | `PR Mechanical Quality Factor: Quality factor representing mechanical suspension friction losses in the passive radiator.` |
| `pr_FsMass_hz` | - | PassiveRadiator | `REWRITE` | `Mass-Loaded PR Resonance: Free-air resonance frequency of the passive radiator including added mass Madd.` |
| `signal_Pin_W` | - | Signal | `REWRITE` | `System Input Power: Total electrical power supplied to the loudspeaker system (P = V² / Re).` |
| `signal_DriveV_V` | - | Signal | `REWRITE` | `Driver Terminal Voltage: RMS input voltage applied across the driver voice coil terminals (V = √(P · Re)).` |
| `signal_Rs_ohm` | - | Signal | `REWRITE` | `Series Resistance: Combined amplifier output impedance, wiring, and crossover component resistance in series with the driver.` |
| `signal_Distance_m` | - | Signal | `REWRITE` | `Listening Distance: On-axis distance from the loudspeaker to the listener for SPL calculations.` |
| `signal_Angle_rad` | - | Signal | `REWRITE` | `Off-Axis Angle: Angular offset from the main acoustic axis in radians.` |
| `signal_GenHz_hz` | - | Signal | `REWRITE` | `Test Tone Frequency: Target frequency evaluated by the single-tone signal generator.` |
| `loss_Ql` | - | Box losses | `REWRITE` | `Enclosure Leakage Loss Q: Quality factor accounting for acoustic energy losses through cabinet seams and gaskets.` |
| `loss_Qa` | - | Box losses | `REWRITE` | `Enclosure Damping Loss Q: Quality factor accounting for acoustic energy absorption by internal damping fill.` |
| `loss_DampingMode` | - | Box losses | `KEEP` | `Enclosure Loss Model: How box and port losses are modelled — lossless, conventional lossy, or WinISD lossy.` |
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
| `driver_Fs_hz` | `Fs_hz` | Driver: Parameters | `REWRITE` | `Driver Resonant Frequency: Free-air fundamental resonance frequency of the driver moving assembly and suspension.` |
| `driver_Qts` | `Qts` | Driver: Parameters | `REWRITE` | `Total Quality Factor: Total damping factor of the driver at Fs, combining electrical (Qes) and mechanical (Qms) damping.` |
| `driver_Qes` | `Qes` | Driver: Parameters | `REWRITE` | `Electrical Quality Factor: Quality factor measuring electrical damping generated by back-EMF in the voice coil at Fs.` |
| `driver_Qms` | `Qms` | Driver: Parameters | `REWRITE` | `Mechanical Quality Factor: Quality factor measuring mechanical friction damping losses in the surround and spider at Fs.` |
| `driver_Vas_l` | `Vas_m3` | Driver: Parameters | `REWRITE` | `Equivalent Compliance Volume: Volume of air whose acoustic compliance equals the mechanical compliance of the driver suspension.` |
| `driver_Re_ohm` | `Re_ohm` | Driver: Parameters | `REWRITE` | `DC Voice Coil Resistance: Direct-current electrical resistance measured across the driver voice coil terminals.` |
| `driver_Le_mH` | `Le_H` | Driver: Parameters | `REWRITE` | `Voice Coil Inductance: Self-inductance of the voice coil causing high-frequency electrical impedance rise.` |
| `driver_Mms_g` | `Mms_kg` | Driver: Parameters | `REWRITE` | `Moving Mass: Total mass of the driver diaphragm, voice coil, former, and air mass loading.` |
| `driver_Sd_cm2` | `Sd_m2` | Driver: Parameters | `REWRITE` | `Effective Diaphragm Area: Effective radiating piston area of the driver cone and inner surround.` |
| `driver_Xmax_mm` | `Xmax_m` | Driver: Parameters | `REWRITE` | `Peak Linear Excursion: Peak one-way linear cone displacement where voice coil coverage remains inside the magnetic gap.` |
| `driver_Pe_W` | `Pe_W` | Driver: Parameters | `REWRITE` | `Thermal Power Handling: Maximum continuous electrical power input the voice coil can dissipate without thermal failure.` |
| `driver_BL_Tm` | `BL_Tm` | Driver: Parameters | `REWRITE` | `Motor Force Factor: Product of magnetic gap flux density B and voice coil wire length L, measuring motor coupling strength.` |
| `driver_Cms_mm_per_N` | `Cms_m_per_N` | Driver: Parameters | `REWRITE` | `Mechanical Compliance: Mechanical flexibility (spring rate inverse) of the suspension system.` |
| `driver_Rms_Ns_per_m` | `Rms_kg_per_s` | Driver: Parameters | `REWRITE` | `Mechanical Resistance: Mechanical friction loss resistance of the driver suspension system.` |
| `driver_Dd_mm` | - | Driver: Parameters | `KEEP` | `Effective Diaphragm Diameter: Effective piston diameter of the cone, interchangeable with Sd (Sd = π · (Dd / 2)²).` |
| `driver_fLe_hz` | - | Driver: Parameters | `KEEP` | `Semi-Inductance Reference Frequency: Frequency at which voice coil semi-inductance parameters Le and KLe were measured.` |
| `driver_KLe_H_sqrtHz` | - | Driver: Parameters | `KEEP` | `Semi-Inductance Coefficient: Semi-inductance loss factor accounting for eddy currents and high-frequency coil losses.` |
| `driver_Hc_mm` | - | Driver: Parameters | `KEEP` | `Voice Coil Height: Winding height of the voice coil wire on the former.` |
| `driver_Hg_mm` | - | Driver: Parameters | `KEEP` | `Magnetic Gap Height: Physical thickness of the top plate defining the magnetic gap height.` |
| `driver_Vd_cm3` | - | Driver: Parameters | `KEEP` | `Peak Displacement Volume: Maximum volume of air displaced by the cone at full linear excursion Xmax (Vd = Sd × Xmax).` |
| `driver_Xlim_mm` | - | Driver: Parameters | `KEEP` | `Mechanical Excursion Limit: Absolute physical displacement limit before mechanical damage or bottoming occurs.` |
| `driver_Eta0` | `no` | Driver: Parameters | `REWRITE` | `Reference Efficiency: How effectively a speaker converts electrical power into acoustic sound power in its passband (η₀ = P_acc / P_elec × 100%).` |
| `driver_USPL_dB` | `USPL_dB` | Driver: Parameters | `REWRITE` | `Voltage Sensitivity: Sound pressure level at 1 meter produced by a standard 2.83 V RMS input voltage.` |
| `driver_SPL_dB` | `SPL_dB` | Driver: Parameters | `REWRITE` | `Power Sensitivity: Sound pressure level at 1 meter produced by a 1 Watt electrical power input.` |
| `driver_NumVC` | `numVC` | Driver: Parameters | `REWRITE` | `Voice Coil Count: Number of independent voice coil windings on the driver motor assembly.` |
| `driver_VCCon` | `VCCon` | Driver: Parameters | `CLEANUP` | `Voice Coil Wiring: Wiring configuration (series or parallel) for multi-voice-coil drivers determining total terminal resistance Re and BL.` |
| `driver_AlfaVC_per_K` | `alfaVC_per_K` | Driver: Advanced | `CLEANUP` | `Voice Coil Temp Coefficient: Thermal resistance coefficient of voice coil wire, determining resistance rise per degree of heating.` |
| `driver_Rt_K_per_W` | - | Driver: Advanced | `KEEP` | `Thermal Resistance: Thermal resistance from voice coil to magnet assembly and ambient air.` |
| `driver_Ct_J_per_K` | - | Driver: Advanced | `KEEP` | `Thermal Capacitance: Heat storage capacity of the voice coil and motor structure.` |
| `driver_EBP_hz` | `EBP_hz` | Driver: Advanced | `REWRITE` | `Efficiency Bandwidth Product: Ratio of Fs to Qes (Fs / Qes); indicates enclosure suitability (EBP < 50 favours sealed, > 90 favours vented).` |
| `driver_SPLmaxLF_dB` | `SPLmaxLF_dB` | Driver: Advanced | `CLEANUP` | `Low Frequency Excursion Limit SPL: Theoretical maximum sound pressure level at 20 Hz limited strictly by peak diaphragm excursion Xmax.` |
| `driver_SPLmax_dB` | `SPLmax_dB` | Driver: Advanced | `REWRITE` | `Thermally Limited Max SPL: Maximum acoustic sound pressure level when driven at full thermal power rating Pe.` |
| `driver_Rme_Ns_per_m` | `Rme_kg_per_s` | Driver: Advanced | `CLEANUP` | `Motional Resistance at Resonance: Electromagnetic damping resistance generated by back-EMF at resonance.` |
| `driver_Gamma` | `gamma_m_per_s2_A` | Driver: Advanced | `REWRITE` | `Acceleration Factor: Ratio of motor force BL to moving mass Mms, measuring initial cone acceleration per ampere.` |
| `driver_Mpow` | `Mpow_N_per_sqrtW` | Driver: Advanced | `CLEANUP` | `Power-Normalized Motor Force: Motor force produced per square root of input power (BL / √Re).` |
| `driver_Mcost_kg_per_s` | `Mcost_kg_per_s` | Driver: Advanced | `CLEANUP` | `Motor Figure of Merit: Dynamic electromagnetic coupling efficiency accounting for gap geometry and displacement.` |
| `driver_Gloss_pct` | `Gloss` | Driver: Advanced | `CLEANUP` | `Gravity Sag Percentage: Percentage of peak excursion Xmax consumed by cone displacement under gravity when mounted horizontally.` |
| `driver_Thick_mm` | - | Driver: Dimensions | `KEEP` | `Basket Flange Thickness: Frame flange plate thickness at the mounting boundary.` |
| `driver_Depth_mm` | - | Driver: Dimensions | `KEEP` | `Overall Driver Depth: Total physical depth of the driver from mounting flange to rear magnet pole plate.` |
| `driver_MagDepth_mm` | - | Driver: Dimensions | `KEEP` | `Magnet Assembly Depth: Physical thickness of the rear magnet assembly.` |
| `driver_Magnet_mm` | - | Driver: Dimensions | `KEEP` | `Magnet Diameter: Outer diameter of the motor magnet structure.` |
| `driver_Basket_mm` | - | Driver: Dimensions | `KEEP` | `Basket Diameter: Outer frame chassis diameter.` |
| `driver_Outer_mm` | - | Driver: Dimensions | `KEEP` | `Outer Mounting Diameter: Overall diameter of the front mounting flange.` |
| `driver_Vcd_mm` | - | Driver: Dimensions | `KEEP` | `Voice Coil Diameter: Former diameter of the voice coil winding.` |
| `driver_Dvol_cm3` | - | Driver: Dimensions | `KEEP` | `Driver Displacement Volume: Volume occupied by the driver motor and basket inside the enclosure.` |
| `driver_manufacturer` | - | Driver: General | `KEEP` | `Manufacturer: Company or organization that designed and manufactured the driver.` |
| `driver_brand` | - | Driver: General | `KEEP` | `Brand: Trade brand name under which the driver is marketed.` |
| `driver_model` | - | Driver: General | `KEEP` | `Model: Manufacturer model designation or part number.` |
| `driver_providedBy` | - | Driver: General | `KEEP` | `Data Attribution: Source contributor or measurement laboratory providing the parameter data.` |
| `driver_added` | - | Driver: General | `KEEP` | `Date Added: Date when the driver parameter record was cataloged.` |
| `driver_comment` | - | Driver: General | `KEEP` | `Driver Notes: Free-text engineering notes and comments associated with the driver record.` |
| `driver_Znom_ohm` | `Znom_ohm` | Driver: Parameters | `REWRITE` | `Nominal Impedance: Rated speaker impedance classification (e.g. 4, 8, or 16 ohms) for amplifier matching.` |
| `driver_c_m_per_s` | - | Driver: Advanced | `KEEP` | `Reference Speed of Sound: Velocity of acoustic propagation at reference environmental conditions.` |
| `driver_roo_kg_per_m3` | - | Driver: Advanced | `KEEP` | `Reference Air Density: Atmospheric mass density at reference environmental conditions.` |
| `box_Resonance_hz` | - | Box | `REWRITE` | `System Resonance Frequency: Effective total resonance frequency of the driver coupled to the enclosure.` |
| `box_RearResonance_hz` | - | Box | `REWRITE` | `Rear Chamber Resonance: Sealed rear-chamber resonance frequency in a 4th-order bandpass enclosure (Frc = Fs × √(1 + Vas/Vb)).` |
| `box_Frc_hz` | `Frc` | Box | `REWRITE` | `Rear Chamber Tuning Frequency: Target Helmholtz tuning frequency for the vented rear chamber in 6th-order bandpass and ABC enclosures.` |
| `driver_nDrivers` | - | Driver | `KEEP` | `Driver Count: Total number of active drivers operating in the enclosure system.` |
| `driver_ArrayWiring` | - | Driver | `KEEP` | `Driver Array Wiring: How multiple drivers are wired to the amplifier (parallel or series), setting the total load impedance.` |
| `driver_VcTempRise_K` | - | Driver | `CLEANUP` | `Voice Coil Temp Rise: Voice coil heating caused by electrical power dissipation (I² Re), increasing coil resistance Re and inducing thermal power compression.` |
| `driver_AddedMass_g` | - | Driver | `CLEANUP` | `Cone Added Mass: Test mass temporarily added to the cone to shift resonant frequency (Fs), allowing calculation of suspension compliance (Cms) and moving mass (Mms).` |
| `filter_Type` | - | Filters | `KEEP` | `Filter Type: The response shape of the active filter — lowpass, highpass, Linkwitz transform, peaking EQ or shelf.` |
| `filter_Fc_hz` | - | Filters | `REWRITE` | `Cutoff / Center Frequency: Cutoff or center frequency of the active signal filter.` |
| `filter_Q` | - | Filters | `REWRITE` | `Filter Quality Factor: Quality factor determining resonance peak sharpness or damping of the filter.` |
| `filter_Gain_dB` | - | Filters | `REWRITE` | `Filter Gain: Boost or attenuation gain applied by the equalizer or filter in dB.` |
| `filter_Order` | - | Filters | `REWRITE` | `Filter Order: Filter steepness order (e.g. 1st order 6 dB/oct, 2nd order 12 dB/oct, 4th order 24 dB/oct).` |

---

## 5. Box Type Alignments & Location Mapping

The alignment algorithms across various enclosure types live across 3 distinct module layers:

1. **Domain Engine Physics & Formulas:**  
   - [boxDesign.ts](file:///home/john/work/winisd/openisd/packages/design/engine/boxDesign.ts#L42-L135): Defines alignment calculations and presets:
     - **Sealed Alignments:** `sealedFromQtc`, `sealedQtcFromVolume`; the $Q_{tc}$ preset list is `SEALED_ALIGNMENT_OPTIONS` in [options.ts](file:///home/john/work/winisd/openisd/packages/design/fields/options.ts#L43) (0.500 Critically Damped, 0.577 Bessel, 0.707 Butterworth, 0.800–1.500 Equal Ripple), handed out by `sealedAlignmentOptions()` ([boxDesign.ts#L55](file:///home/john/work/winisd/openisd/packages/design/engine/boxDesign.ts#L55)).
     - **Vented Alignments:** `ventedAlignment` (QB3 polynomial fit for $V_b$ and $F_b$), `ventLength(Vb, fb, Sp, count, air, k)`, `tuningFromLength(Vb, L, Sp, count, air, k)` — `Sp` is ONE port's area, `count` the number of identical ports (mass term `count·Sp`, end correction from one port's diameter).
     - **Passive Radiator Alignments:** `prTuning`, `prMassForFp`, `prFsWithMass`.
     - **Enclosure Suitability:** `ebpSuitability` ($EBP = F_s / Q_{es}$).
2. **Interactive Solver Routines:**  
   - [solver.ts](file:///home/john/work/winisd/openisd/packages/design/engine/solver.ts): the handle solves — [`solvePr`](file:///home/john/work/winisd/openisd/packages/design/engine/solver.ts#L648), [`solveVent`](file:///home/john/work/winisd/openisd/packages/design/engine/solver.ts#L774) (`VentSolverParams` carries `count`), [`solveSealedAlignment`](file:///home/john/work/winisd/openisd/packages/design/engine/solver.ts#L919).
3. **UI Alignment Selection Controllers:**  
   - [SealedAlignment-hooks.ts](file:///home/john/work/winisd/openisd/packages/ui/src/hooks/SealedAlignment-hooks.ts#L26): Manages `createSealedAlignmentEditor` for user preset selection and target volume dispatching.

---

## 6. Target Symmetrical Dropdown Architecture (`SelectorOption<T>`)

**Status (2026-09-20):** done for every `<select>` in the app. Each one in
`ui/shells/original/OriginalShell.vue`, `ui/shells/original/OgNewProject.vue` and
`ui/components/DriverEditorModal.vue` iterates a `SelectorOption` list and reads the chosen value
back through `logic/domEvents.ts` → `selectedOption(e, options)` — the typed string→member
boundary: no `v-model`, no `Number(selectValue(e))`, no `as 'round' | 'slotted'`.
`packages/ui/test/logic/uiFields-dropdowns.test.ts` pins it by reading the template source. The
two count selects (drivers, vents) get their list from `uiFields.ts` → `countOptions(id)`, which
enumerates the spec's own `min..max` — no hand-typed `v-for="n in 8"`.

| `<select>` | Where | Options | Reads back via |
| :--- | :--- | :--- | :--- |
| Box type (Box tab, Enclosure tab) | `OriginalShell.vue` `#og-box-type`, `#og-box-type-enclosure` | `BOX_TYPE_OPTIONS` | `selectedOption` |
| Box type (new-project wizard) | `OgNewProject.vue` | `newProjectBoxTypeOptions()` | `selectedOption` |
| Loss model | `OriginalShell.vue` `#lossmode` | `LOSS_MODE_OPTIONS` (`lossModeOptions()`) | `selectedOption` |
| Number of drivers | `OriginalShell.vue` | `N_DRIVERS_OPTIONS = countOptions('driver_nDrivers')` (1..64) | `selectedOption` |
| Array wiring | `OriginalShell.vue` | `ARRAY_WIRING_OPTIONS` | `selectedOption` |
| Number of vents | `OriginalShell.vue` `#vent-count` | `VENT_COUNT_OPTIONS = countOptions('vent_Count')` (1..4) | `selectedOption` → `activeVent.count.set(n)` |
| Vent shape | `OriginalShell.vue` | `VENT_SHAPE_OPTIONS` | `selectedOption` |
| End correction | `OriginalShell.vue` | `END_CORRECTION_OPTIONS` | `selectedOption` |
| Sealed alignment (Qtc) | `OriginalShell.vue` `.alignment-select` | `sealedAlignmentOptions()` | `selectedOption` |
| Voice-coil wiring | `DriverEditorModal.vue` `.de-conn-sel` | `wiringOptions()` (`VC_CONNECTION_OPTIONS`) | `selectedOption` |

Not selects: the two library pickers are list widgets (`ui/components/DriverBrowser.vue`,
`ui/components/PRBrowser.vue`), and the Filters tab's type choice is a row of quick-add buttons
(`OgFilters.vue` `QUICK_ADD`) — `FILTER_TYPE_OPTIONS` is the list a select would use.

To eliminate structural drift, property name mismatches (`qtc` vs `value`), and ad-hoc string/object option handling, all dropdown options across the application are standardized onto a single unified, strongly-typed contract:

```ts
export interface SelectorOption<T = string | number> {
  readonly value: T;
  readonly label: string;
}
```

Every `kind: 'enum'` field in [uiFields.ts](file:///home/john/work/winisd/openisd/packages/ui/src/logic/fields/uiFields.ts) exposes `readonly options?: readonly SelectorOption[]` directly on its spec entry (`UIFieldSpec.options`); a count field exposes `min`/`max` and `countOptions(id)` derives the list:

| Target Dropdown Control | SSOT Field Spec ID | Target Option Contract | Option Value & Label Pairs | Loaded From (File Path, Class/Func, Data Types & API) |
| :--- | :--- | :--- | :--- | :--- |
| **Port End Correction** | `vent_EndCorrection` | `readonly SelectorOption<number>[]` | `0.613` ("Two free ends"), `0.732` ("One flanged end"), `0.849` ("Two flanged ends") | `packages/design/fields/options.ts` → `END_CORRECTION_OPTIONS` (`readonly SelectorOption<number>[]`) |
| **Vent Geometry / Shape** | `vent_Shape` | `readonly SelectorOption<VentShape>[]` | `'round'` ("Round Tube"), `'slotted'` ("Slotted Duct") | `packages/design/fields/options.ts` → `VENT_SHAPE_OPTIONS` (`readonly SelectorOption<VentShape>[]`) |
| **Number of Vents** | `vent_Count` | `readonly SelectorOption<number>[]` | `1`–`4` | `uiFields.ts` → `countOptions('vent_Count')` from the spec's `min`/`max` — no separate list |
| **Number of Drivers** | `driver_nDrivers` | `readonly SelectorOption<number>[]` | `1`–`64` | `uiFields.ts` → `countOptions('driver_nDrivers')` from the spec's `min`/`max` — no separate list |
| **Voice Coil Wiring** | `driver_VCCon` | `readonly SelectorOption<VoiceCoilWiring>[]` | `'parallel'` ("Parallel"), `'series'` ("Series") — the domain's own values, written to the driver as-is | `packages/design/fields/options.ts` → `VC_CONNECTION_OPTIONS`; reached by the editor through `logic/driverDraft.ts` → `wiringOptions()` (layering gate) |
| **Sealed Alignment Target ($Q_{tc}$)** | `box_Qtc` | `readonly SelectorOption<number>[]` | `0.500` ("0.500 Critically damped"), `0.577` ("0.577 Max flat delay response"), `0.707` ("0.707 Max flat amplitude response"), `0.800`–`1.500` ("Equal ripple response") — nine, WinISD's | `packages/design/fields/options.ts` → `SEALED_ALIGNMENT_OPTIONS`; `engine/boxDesign.ts` → `sealedAlignmentOptions()` hands out that same object (no `qtc` twin of `value`) |
| **Enclosure Type** | `box_Type` | `readonly SelectorOption<BoxType>[]` | `'sealed'` ("Closed"), `'vented'` ("Vented"), `'box-passive-radiator'` ("Passive Radiator"), `'bandpass4'` ("4th Order Bandpass"), `'bandpass6'` ("6th Order Bandpass"), `'abc'` ("ABC") | `packages/design/fields/options.ts` → `BOX_TYPE_OPTIONS`; the wizard lists `logic/appState.ts` → `newProjectBoxTypeOptions()` (the same list filtered by `boxTypeIsSimulatable`) |
| **Filter Type** | `filter_Type` | `readonly SelectorOption<FilterType>[]` | `'lowpass'`, `'highpass'`, `'linkwitz'` ("Linkwitz-Transform"), `'peaking'` ("Peaking EQ"), `'lowshelf'`, `'highshelf'` | `packages/design/fields/options.ts` → `FILTER_TYPE_OPTIONS`. The Filters tab still adds filters through its own quick-add buttons (`OgFilters.vue` `QUICK_ADD`) — not yet read from this list |
| **Enclosure Loss Model** | `loss_DampingMode` | `readonly SelectorOption<string>[]` | `'lossless'` ("Lossless"), `'conventional-lossy'` ("Conventional Lossy"), `'winisd-lossy'` ("WinISD Lossy") — `LossMode.value` tokens, what the project stores | `packages/ui/src/logic/environment.ts` → `lossModeOptions()` from `LossMode.ALL` |
| **Driver Array Wiring** | `driver_ArrayWiring` | `readonly SelectorOption<Wiring>[]` | `'parallel'` ("Parallel"), `'series'` ("Series") | `packages/design/fields/options.ts` → `ARRAY_WIRING_OPTIONS` |
| **Passive Radiator Library** (not a select — a list widget; no registry spec) | — | — | Dynamic list of saved + bundled PR records | `packages/persistence/src/repos/myPassiveRadiatorRepo.ts` / `bundledPassiveRadiatorRepo.ts`; rows shaped by `logic/driverDisplay.ts` → `passiveRadiatorRows()` / `bundledPassiveRadiatorRows()`; rendered by `ui/components/PRBrowser.vue` |
| **Driver Library** (not a select — a list widget; no registry spec) | — | — | Dynamic list of saved + bundled driver records | `packages/persistence/src/repos/myDriverRepo.ts` / `bundledDriverRepo.ts`; rendered by `ui/components/DriverBrowser.vue` |



