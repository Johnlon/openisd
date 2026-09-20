import {MAX_SUPPORTED_TEMP_K, MIN_SUPPORTED_TEMP_K} from '@openisd/design/engine';
import {
  type SelectorOption,
  type UnitGroup,
  ARRAY_WIRING_OPTIONS,
  BOX_TYPE_OPTIONS,
  END_CORRECTION_OPTIONS,
  FILTER_TYPE_OPTIONS,
  SEALED_ALIGNMENT_OPTIONS,
  VENT_SHAPE_OPTIONS,
  VC_CONNECTION_OPTIONS,
} from '@openisd/design/fields';
import {lossModeOptions} from '../environment.js';

/** Kind of field — only 'number' carries a `precision`. */
export type FieldKind = 'number' | 'enum' | 'text' | 'toggle' | 'date' | 'control';

export interface UIFieldSpec {
  /** Stable field id — the key the UI and tests reference. */
  readonly id: string;
  /** Human label as shown in the UI. */
  readonly label: string;
  /** Which WinISD/OpenISD pane the field lives on. */
  readonly pane: string;
  /** Field kind — number / enum / text / toggle / date / control. */
  readonly kind: FieldKind;
  /** Display unit symbol, or '' for dimensionless. */
  readonly unit: string;
  /** Interchangeable-unit group this field belongs to. */
  readonly unitGroup?: UnitGroup;
  /** Fixed decimal places a numeric field always shows. */
  readonly precision?: number;
  /** Sanity lower bound for entry. */
  readonly min?: number;
  /** Sanity upper bound for entry. */
  readonly max?: number;
  /** Closed form derivation for calculated fields. */
  readonly formula?: string;
  /** Selectable options for enum fields. */
  readonly options?: readonly SelectorOption[];
  /** Optional legacy/alternative field ID aliases. */
  readonly aliases?: readonly string[];
  /** Description of what the field is and its acoustic function. */
  readonly description: string;
}

const UI_FIELD_SPECS: UIFieldSpec[] = [
  // ============================ BOX / ENCLOSURE ============================
  {
    id: 'box_Type', aliases: ['boxType'], label: 'Box type', pane: 'Box', kind: 'enum', unit: '',
    options: BOX_TYPE_OPTIONS,
    description: 'Enclosure Type: The kind of enclosure the driver is loaded into — closed, vented, passive radiator, bandpass or ABC.',
  },
  {
    id: 'box_Qtc', aliases: ['Qtc', 'sealedAlignment'], label: 'Alignment (Qtc)', pane: 'Box', kind: 'enum', unit: '',
    options: SEALED_ALIGNMENT_OPTIONS,
    description: 'Sealed Alignment Target: Total system Q of the closed box; 0.707 is maximally flat, lower is more damped, higher peaks before rolling off.',
  },
  {
    id: 'box_Vb_l', aliases: ['Vb'], label: 'Volume', pane: 'Box', kind: 'number', unit: 'l', unitGroup: 'volume', precision: 2, min: 0.0001, max: 100,
    description: 'Net Enclosure Volume: Internal net air volume of the enclosure acting as the acoustic spring for the driver.',
  },
  {
    id: 'box_Vf_l', aliases: ['Vf'], label: 'Front volume', pane: 'Box', kind: 'number', unit: 'l', precision: 2, min: 0.0001, max: 100,
    description: 'Front Chamber Volume: Net air volume of the front (vented) chamber in a bandpass enclosure.',
  },
  {
    id: 'box_Fb_hz', aliases: ['Fb'], label: 'Target Tuning Freq (Fb)', pane: 'Box', kind: 'number', unit: 'Hz', precision: 2, min: 0, max: 1000,
    description: 'Box Tuning Frequency: Helmholtz resonance frequency of the vented enclosure determined by port dimensions and box volume.',
  },

  // ============================ VENTS / PORTED ============================
  {
    id: 'vent_Shape', aliases: ['ventShape'], label: 'Vent shape', pane: 'Vents', kind: 'enum', unit: '',
    options: VENT_SHAPE_OPTIONS,
    description: 'Vent Geometry: Selects between a circular tube (round) or rectangular duct (slotted) port.',
  },
  {
    id: 'vent_D_cm', aliases: ['ventD'], label: 'Vent diameter', pane: 'Vents', kind: 'number', unit: 'cm', precision: 2, min: 0.001, max: 2,
    description: 'Port Diameter: Internal diameter of a round port tube. Larger diameters reduce port air turbulence (choking) but require longer tubes.',
  },
  {
    id: 'vent_W_cm', aliases: ['ventW'], label: 'Slot width', pane: 'Vents', kind: 'number', unit: 'cm', precision: 2, min: 0.001, max: 2,
    description: 'Slot Port Width: Internal width of a rectangular slotted port.',
  },
  {
    id: 'vent_H_cm', aliases: ['ventH'], label: 'Slot height', pane: 'Vents', kind: 'number', unit: 'cm', precision: 2, min: 0.001, max: 2,
    description: 'Slot Port Height: Internal height of a rectangular slotted port.',
  },
  {
    id: 'vent_L_cm', aliases: ['ventL'], label: 'Vent length', pane: 'Vents', kind: 'number', unit: 'cm', precision: 2, min: 0.001, max: 10,
    description: 'Vent Length: Physical length of the port tube/duct. Longer ports lower the tuning frequency for a fixed volume.',
  },
  {
    id: 'vent_EndCorrection', aliases: ['endCorrection', 'ventEndCorrection'], label: 'End Correction', pane: 'Vents', kind: 'enum', unit: '',
    options: END_CORRECTION_OPTIONS,
    description: 'End Correction Factor: Dimensionless factor accounting for acoustic air mass oscillating beyond the physical duct ends, extending effective acoustic port length depending on termination boundary geometry (free air vs flanged baffle).',
  },
  {
    id: 'vent_CrossArea_m2', aliases: ['ventCrossArea'], label: 'Cross area', pane: 'Vents', kind: 'number', unit: 'm²', precision: 4, min: 0, max: 10,
    formula: 'π·(ventD/2)²',
    description: 'Vent Cross-Sectional Area: Total internal cross-sectional area of the port.',
  },
  {
    id: 'vent_1stPortResonance_hz', aliases: ['portResonance', 'ventPortResonance'], label: '1st port resonance', pane: 'Vents', kind: 'number', unit: 'Hz', precision: 2, min: 0, max: 20000,
    formula: 'c / (2·ventL)',
    description: 'First Vent Pipe Resonance: Frequency of the lowest organ-pipe standing wave resonance inside the port duct (f = c / 2L). Standing wave peaks in the vent column cause acoustic output peaks and noise within or above the passband, limiting usable port bandwidth.',
  },

  // ============================ PASSIVE RADIATOR ============================
  {
    id: 'pr_Sd_cm2', aliases: ['prSd'], label: 'Sd', pane: 'PassiveRadiator', kind: 'number', unit: 'cm²', unitGroup: 'area', precision: 2, min: 0.0001, max: 10,
    description: 'Passive Radiator Area: Effective radiating piston surface area of the passive radiator.',
  },
  {
    id: 'pr_Xmax_mm', aliases: ['prXmax'], label: 'Xmax', pane: 'PassiveRadiator', kind: 'number', unit: 'mm', unitGroup: 'length', precision: 2, min: 0, max: 0.5,
    description: 'Passive Radiator Excursion Limit: Maximum peak linear cone displacement of the passive radiator diaphragm.',
  },
  {
    id: 'pr_Num', aliases: ['prNum'], label: 'Num. of PRs', pane: 'PassiveRadiator', kind: 'number', unit: '', precision: 0, min: 1, max: 16,
    description: 'Passive Radiator Count: Number of identical passive radiators installed in the enclosure.',
  },
  {
    id: 'pr_Madd_g', aliases: ['prMadd'], label: 'Added mass to cone', pane: 'PassiveRadiator', kind: 'number', unit: 'g', precision: 3, min: 0, max: 5000,
    description: 'PR Added Mass: Additional ballast mass attached to the passive radiator cone to lower its tuning frequency.',
  },
  {
    id: 'pr_Fp_hz', aliases: ['Fp'], label: 'Target tuning freq (Fp)', pane: 'PassiveRadiator', kind: 'number', unit: 'Hz', precision: 2, min: 1, max: 1000,
    description: 'Passive Radiator System Tuning: Helmholtz tuning frequency achieved by the passive radiator and enclosure volume.',
  },
  {
    id: 'pr_Vas_l', aliases: ['prVas'], label: 'Vas', pane: 'PassiveRadiator', kind: 'number', unit: 'l', unitGroup: 'volume', precision: 2, min: 0.00001, max: 100,
    formula: 'Vas = Cms·Sd²·ρ·c²·1000',
    description: 'PR Equivalent Compliance Volume: Volume of air having the same acoustic compliance as the passive radiator suspension.',
  },
  {
    id: 'pr_Fs_hz', aliases: ['prFs'], label: 'Fpr', pane: 'PassiveRadiator', kind: 'number', unit: 'Hz', precision: 2, min: 1, max: 1000,
    formula: 'Fpr = 1/(2π·√(Mmd·Cms))',
    description: 'Unloaded PR Resonance: Fundamental free-air resonance frequency of the passive radiator without added mass or box coupling.',
  },
  {
    id: 'pr_Qms', aliases: ['prQms'], label: 'Qms', pane: 'PassiveRadiator', kind: 'number', unit: '', precision: 3, min: 0.1, max: 100,
    formula: 'Qms = √(Mmd/Cms)/Rms',
    description: 'PR Mechanical Quality Factor: Quality factor representing mechanical suspension friction losses in the passive radiator.',
  },
  {
    id: 'pr_FsMass_hz', aliases: ['prFsMass'], label: 'Fpr (with added mass)', pane: 'PassiveRadiator', kind: 'number', unit: 'Hz', precision: 2, min: 0, max: 1000,
    formula: 'Fpr = 1/(2π·√((Mmd+Madd)·Cms))',
    description: 'Mass-Loaded PR Resonance: Free-air resonance frequency of the passive radiator including added mass Madd.',
  },

  // ============================ SIGNAL ============================
  {
    id: 'signal_Pin_W', aliases: ['Pin'], label: 'System input power', pane: 'Signal', kind: 'number', unit: 'W', precision: 2, min: 0, max: 100000,
    description: 'System Input Power: Total electrical power supplied to the loudspeaker system (P = V² / Re).',
  },
  {
    id: 'signal_DriveV_V', aliases: ['driveV'], label: 'Driver input voltage (each)', pane: 'Signal', kind: 'number', unit: 'V', precision: 2, min: 0, max: 1000,
    formula: 'driveV = √(Pin · Re)',
    description: 'Driver Terminal Voltage: RMS input voltage applied across the driver voice coil terminals (V = √(P · Re)).',
  },
  {
    id: 'signal_Rs_ohm', aliases: ['Rs'], label: 'Series resistance', pane: 'Signal', kind: 'number', unit: 'ohm', precision: 3, min: 0, max: 1000,
    description: 'Series Resistance: Combined amplifier output impedance, wiring, and crossover component resistance in series with the driver.',
  },
  {
    id: 'signal_Distance_m', aliases: ['listenDistance'], label: 'Distance', pane: 'Signal', kind: 'number', unit: 'm', precision: 3, min: 0, max: 100,
    description: 'Listening Distance: On-axis distance from the loudspeaker to the listener for SPL calculations.',
  },
  {
    id: 'signal_Angle_rad', aliases: ['listenAngle'], label: 'Off-Axis Angle', pane: 'Signal', kind: 'number', unit: 'rad', precision: 4, min: 0, max: 3.1416,
    description: 'Off-Axis Angle: Angular offset from the main acoustic axis in radians.',
  },
  {
    id: 'signal_GenHz_hz', aliases: ['genHz'], label: 'Signal generator frequency', pane: 'Signal', kind: 'number', unit: 'Hz', precision: 2, min: 1, max: 20000,
    description: 'Test Tone Frequency: Target frequency evaluated by the single-tone signal generator.',
  },

  // ============================ BOX LOSSES ============================
  {
    id: 'loss_Ql', aliases: ['Ql'], label: 'Leakage Ql', pane: 'Box losses', kind: 'number', unit: '', precision: 2, min: 0.1, max: 1000,
    description: 'Enclosure Leakage Loss Q: Quality factor accounting for acoustic energy losses through cabinet seams and gaskets.',
  },
  {
    id: 'loss_Qa', aliases: ['Qa'], label: 'Absorption Qa', pane: 'Box losses', kind: 'number', unit: '', precision: 2, min: 0.1, max: 1000,
    description: 'Enclosure Damping Loss Q: Quality factor accounting for acoustic energy absorption by internal damping fill.',
  },
  {
    id: 'loss_DampingMode', aliases: ['lossMode'], label: 'Loss model', pane: 'Box losses', kind: 'enum', unit: '',
    options: lossModeOptions(),
    description: 'Enclosure Loss Model: How box and port losses are modelled — lossless, conventional lossy, or WinISD lossy.',
  },
  {
    id: 'loss_Qp', aliases: ['Qp'], label: 'Port Qp', pane: 'Box losses', kind: 'number', unit: '', precision: 2, min: 0.1, max: 1000,
    description: 'Port Friction Loss Q: Quality factor representing air friction and viscous boundary losses inside the vent.',
  },

  // ============================ ADVANCED (ENVIRONMENT) ============================
  {
    id: 'adv_Temp_K', aliases: ['advTemp'], label: 'Temperature', pane: 'Advanced', kind: 'number', unit: 'K', precision: 2, min: MIN_SUPPORTED_TEMP_K, max: MAX_SUPPORTED_TEMP_K,
    description: 'Ambient Temperature: Atmospheric temperature used to calculate speed of sound and air density.',
  },
  {
    id: 'adv_Humidity_pct', aliases: ['advHumidity'], label: 'Relative humidity', pane: 'Advanced', kind: 'number', unit: '%', precision: 2, min: 0, max: 100,
    description: 'Relative Humidity: Atmospheric humidity percentage affecting sound speed and medium density.',
  },
  {
    id: 'adv_Pressure_kPa', aliases: ['advPressure'], label: 'Air pressure', pane: 'Advanced', kind: 'number', unit: 'kPa', precision: 2, min: 1000, max: 200000,
    description: 'Air Pressure: Atmospheric barometric pressure influencing medium density and acoustic impedance.',
  },
  {
    id: 'adv_SoundVelocity_m_per_s', aliases: ['advSoundVelocity'], label: 'Sound velocity', pane: 'Advanced', kind: 'number', unit: 'm/s', precision: 2, min: 0, max: 1000,
    formula: 'c = √(γ·p/ρ), γ = 1.4',
    description: 'Speed of Sound: Velocity of acoustic wave propagation through air under ambient conditions.',
  },
  {
    id: 'adv_AirDensity_kg_per_m3', aliases: ['advAirDensity'], label: 'Air density', pane: 'Advanced', kind: 'number', unit: 'kg/m³', precision: 5, min: 0, max: 10,
    formula: 'ρ = p·Ma/(R·T)·[1 − xv(1 − Mv/Ma)]',
    description: 'Air Density: Mass density of air derived from temperature, humidity, and barometric pressure.',
  },

  // ---- Advanced pane simulation options ----
  {
    id: 'adv_SimVcInductance', aliases: ['simVcInductance'], label: 'Simulate voice coil inductance', pane: 'Advanced', kind: 'toggle', unit: '',
    description: 'Simulate Voice Coil Inductance: Includes voice coil inductance (Le) in acoustic output calculations instead of impedance plots alone.',
  },
  {
    id: 'adv_ForceFlatResponse', aliases: ['forceFlatResponse'], label: 'Force flat response', pane: 'Advanced', kind: 'toggle', unit: '',
    description: 'Force Flat Response: Applies auto-equalization to reveal excursion and port velocity demands required for a flat passband response.',
  },
  {
    id: 'adv_TlPortModel', aliases: ['tlPortModel'], label: 'Use "transmission line"-model for port simulation', pane: 'Advanced', kind: 'toggle', unit: '',
    description: 'Transmission Line Port Model: Models the vent as a distributed transmission line, incorporating internal organ-pipe resonances into response curves.',
  },
  {
    id: 'adv_RgAtDriverSide', aliases: ['rgAtDriverSide'], label: 'Rg is at driver side', pane: 'Advanced', kind: 'toggle', unit: '',
    description: 'Rg Placement: Applies series resistance Rg individually to each driver rather than globally at the main amplifier output.',
  },
  {
    id: 'adv_SplXmaxLimited', aliases: ['splXmaxLimited'], label: 'SPL graph is Xmax limited', pane: 'Advanced', kind: 'toggle', unit: '',
    description: 'Xmax Limited SPL: Clamps the SPL frequency response graph whenever cone displacement exceeds maximum linear excursion Xmax.',
  },
  {
    id: 'adv_UseWinisdAirModel', aliases: ['useWinisdAirModel'], label: 'Use WinISD air model', pane: 'Advanced', kind: 'toggle', unit: '',
    description: 'Air Model Selection: Toggles between legacy WinISD air equations and standardized CIPM moist air calculations.',
  },

  // ============================ DRIVER EDITOR — T/S (Parameters tab) ============================
  {
    id: 'driver_Fs_hz', aliases: ['Fs_hz', 'Fs'], label: 'Fs', pane: 'Driver: Parameters', kind: 'number', unit: 'Hz', precision: 2, min: 1, max: 5000,
    description: 'Driver Resonant Frequency: Free-air fundamental resonance frequency of the driver moving assembly and suspension.',
  },
  {
    id: 'driver_Qts', aliases: ['Qts'], label: 'Qts', pane: 'Driver: Parameters', kind: 'number', unit: '', precision: 3, min: 0, max: 5,
    formula: 'Qts = Qes·Qms/(Qes+Qms)',
    description: 'Total Quality Factor: Total damping factor of the driver at Fs, combining electrical (Qes) and mechanical (Qms) damping.',
  },
  {
    id: 'driver_Qes', aliases: ['Qes'], label: 'Qes', pane: 'Driver: Parameters', kind: 'number', unit: '', precision: 3, min: 0, max: 5,
    description: 'Electrical Quality Factor: Quality factor measuring electrical damping generated by back-EMF in the voice coil at Fs.',
  },
  {
    id: 'driver_Qms', aliases: ['Qms'], label: 'Qms', pane: 'Driver: Parameters', kind: 'number', unit: '', precision: 3, min: 0, max: 50,
    description: 'Mechanical Quality Factor: Quality factor measuring mechanical friction damping losses in the surround and spider at Fs.',
  },
  {
    id: 'driver_Vas_l', aliases: ['Vas_m3', 'Vas'], label: 'Vas', pane: 'Driver: Parameters', kind: 'number', unit: 'l', precision: 2, min: 0, max: 100,
    description: 'Equivalent Compliance Volume: Volume of air whose acoustic compliance equals the mechanical compliance of the driver suspension.',
  },
  {
    id: 'driver_Re_ohm', aliases: ['Re_ohm', 'Re'], label: 'Re', pane: 'Driver: Parameters', kind: 'number', unit: 'ohm', precision: 3, min: 0.01, max: 1000,
    description: 'DC Voice Coil Resistance: Direct-current electrical resistance measured across the driver voice coil terminals.',
  },
  {
    id: 'driver_Le_mH', aliases: ['Le_H', 'Le'], label: 'Le', pane: 'Driver: Parameters', kind: 'number', unit: 'mH', precision: 3, min: 0, max: 0.1,
    description: 'Voice Coil Inductance: Self-inductance of the voice coil causing high-frequency electrical impedance rise.',
  },
  {
    id: 'driver_Mms_g', aliases: ['Mms_kg', 'Mms'], label: 'Mms', pane: 'Driver: Parameters', kind: 'number', unit: 'g', precision: 2, min: 0, max: 10,
    formula: 'Mms = 1/((2π·Fs)²·Cms)',
    description: 'Moving Mass: Total mass of the driver diaphragm, voice coil, former, and air mass loading.',
  },
  {
    id: 'driver_Sd_cm2', aliases: ['Sd_m2', 'Sd'], label: 'Sd', pane: 'Driver: Parameters', kind: 'number', unit: 'cm²', precision: 2, min: 0.0001, max: 10,
    description: 'Effective Diaphragm Area: Effective radiating piston area of the driver cone and inner surround.',
  },
  {
    id: 'driver_Xmax_mm', aliases: ['Xmax_m', 'Xmax'], label: 'Xmax', pane: 'Driver: Parameters', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 0.5,
    description: 'Peak Linear Excursion: Peak one-way linear cone displacement where voice coil coverage remains inside the magnetic gap.',
  },
  {
    id: 'driver_Pe_W', aliases: ['Pe_W', 'Pe'], label: 'Pe', pane: 'Driver: Parameters', kind: 'number', unit: 'W', precision: 2, min: 0, max: 100000,
    description: 'Thermal Power Handling: Maximum continuous electrical power input the voice coil can dissipate without thermal failure.',
  },
  {
    id: 'driver_BL_Tm', aliases: ['BL_Tm', 'BL'], label: 'BL', pane: 'Driver: Parameters', kind: 'number', unit: 'Tm', precision: 3, min: 0, max: 1000,
    formula: 'Bl = √(2π·Fs·Mms·Re/Qes)',
    description: 'Motor Force Factor: Product of magnetic gap flux density B and voice coil wire length L, measuring motor coupling strength.',
  },
  {
    id: 'driver_Cms_mm_per_N', aliases: ['Cms_m_per_N', 'Cms'], label: 'Cms', pane: 'Driver: Parameters', kind: 'number', unit: 'mm/N', precision: 4, min: 0, max: 0.1,
    formula: 'Cms = Vas/(ρ·c²·Sd²)',
    description: 'Mechanical Compliance: Mechanical flexibility (spring rate inverse) of the suspension system.',
  },
  {
    id: 'driver_Rms_Ns_per_m', aliases: ['Rms_kg_per_s', 'Rms'], label: 'Rms', pane: 'Driver: Parameters', kind: 'number', unit: 'Ns/m', unitGroup: 'resistance', precision: 4, min: 0, max: 1000,
    formula: 'Rms = 2π·Fs·Mms/Qms',
    description: 'Mechanical Resistance: Mechanical friction loss resistance of the driver suspension system.',
  },

  // ============================ DRIVER EDITOR — reference-only ============================
  { id: 'driver_Dd_mm', aliases: ['Dd_m', 'Dd'], label: 'Dd', pane: 'Driver: Parameters', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 2, description: 'Effective Diaphragm Diameter: Effective piston diameter of the cone, interchangeable with Sd (Sd = π · (Dd / 2)²).' },
  { id: 'driver_fLe_hz', aliases: ['fLe_hz', 'fLe'], label: 'fLe', pane: 'Driver: Parameters', kind: 'number', unit: 'kHz', precision: 5, min: 0, max: 100000, description: 'Semi-Inductance Reference Frequency: Frequency at which voice coil semi-inductance parameters Le and KLe were measured.' },
  { id: 'driver_KLe_H_sqrtHz', aliases: ['KLe_H_sqrtHz', 'KLe'], label: 'KLe', pane: 'Driver: Parameters', kind: 'number', unit: 'H·√Hz', precision: 6, min: 0, max: 10, description: 'Semi-Inductance Coefficient: Semi-inductance loss factor accounting for eddy currents and high-frequency coil losses.' },
  { id: 'driver_Hc_mm', aliases: ['Hc_m', 'Hc'], label: 'Hc', pane: 'Driver: Parameters', kind: 'number', unit: 'm', precision: 3, min: 0, max: 1, description: 'Voice Coil Height: Winding height of the voice coil wire on the former.' },
  { id: 'driver_Hg_mm', aliases: ['Hg_m', 'Hg'], label: 'Hg', pane: 'Driver: Parameters', kind: 'number', unit: 'm', precision: 3, min: 0, max: 1, description: 'Magnetic Gap Height: Physical thickness of the top plate defining the magnetic gap height.' },
  { id: 'driver_Vd_cm3', aliases: ['Vd_m3', 'Vd'], label: 'Vd', pane: 'Driver: Parameters', kind: 'number', unit: 'cm³', precision: 0, min: 0, max: 100000, description: 'Peak Displacement Volume: Maximum volume of air displaced by the cone at full linear excursion Xmax (Vd = Sd × Xmax).' },
  { id: 'driver_Xlim_mm', aliases: ['Xlim_m', 'Xlim'], label: 'Xlim', pane: 'Driver: Parameters', kind: 'number', unit: 'm', precision: 3, min: 0, max: 1, description: 'Mechanical Excursion Limit: Absolute physical displacement limit before mechanical damage or bottoming occurs.' },
  { id: 'driver_Eta0', aliases: ['no'], label: 'η₀', pane: 'Driver: Parameters', kind: 'number', unit: '%', unitGroup: 'percent', precision: 4, min: 0, max: 100, description: 'Reference Efficiency: How effectively a speaker converts electrical power into acoustic sound power in its passband (η₀ = P_acc / P_elec × 100%).' },
  { id: 'driver_USPL_dB', aliases: ['USPL_dB', 'USPL'], label: 'USPL', pane: 'Driver: Parameters', kind: 'number', unit: 'dB', precision: 2, min: 0, max: 200, formula: 'USPL = SPL + 10·log₁₀(8/Re)', description: 'Voltage Sensitivity: Sound pressure level at 1 meter produced by a standard 2.83 V RMS input voltage.' },
  { id: 'driver_SPL_dB', aliases: ['SPL_dB', 'SPL'], label: 'SPL', pane: 'Driver: Parameters', kind: 'number', unit: 'dB', precision: 2, min: 0, max: 200, description: 'Power Sensitivity: Sound pressure level at 1 meter produced by a 1 Watt electrical power input.' },
  { id: 'driver_NumVC', aliases: ['numVC'], label: 'Voicecoils', pane: 'Driver: Parameters', kind: 'number', unit: '', precision: 0, min: 1, max: 4, description: 'Voice Coil Count: Number of independent voice coil windings on the driver motor assembly.' },
  { id: 'driver_VCCon', aliases: ['VCCon'], label: 'Connection', pane: 'Driver: Parameters', kind: 'enum', unit: '', options: VC_CONNECTION_OPTIONS, description: 'Voice Coil Wiring: Wiring configuration (series or parallel) for multi-voice-coil drivers determining total terminal resistance Re and BL.' },
  { id: 'driver_AlfaVC_per_K', aliases: ['alfaVC_per_K', 'alfaVC'], label: 'AlfaVC', pane: 'Driver: Advanced', kind: 'number', unit: '1000/K', precision: 4, min: 0, max: 0.1, description: 'Voice Coil Temp Coefficient: Thermal resistance coefficient of voice coil wire, determining resistance rise per degree of heating.' },
  { id: 'driver_Rt_K_per_W', aliases: ['Rt_K_per_W', 'Rt'], label: 'R(t)', pane: 'Driver: Advanced', kind: 'number', unit: 'K/W', precision: 5, min: 0, max: 1000, description: 'Thermal Resistance: Thermal resistance from voice coil to magnet assembly and ambient air.' },
  { id: 'driver_Ct_J_per_K', aliases: ['Ct_J_per_K', 'Ct'], label: 'C(t)', pane: 'Driver: Advanced', kind: 'number', unit: 'J/K', precision: 5, min: 0, max: 10000, description: 'Thermal Capacitance: Heat storage capacity of the voice coil and motor structure.' },
  { id: 'driver_EBP_hz', aliases: ['EBP_hz', 'EBP'], label: 'EBP', pane: 'Driver: Advanced', kind: 'number', unit: 'Hz', precision: 2, min: 0, max: 1000, formula: 'EBP = Fs/Qes', description: 'Efficiency Bandwidth Product: Ratio of Fs to Qes (Fs / Qes); indicates enclosure suitability (EBP < 50 favours sealed, > 90 favours vented).' },
  { id: 'driver_SPLmaxLF_dB', aliases: ['SPLmaxLF_dB', 'SPLmaxLF'], label: 'SPLmaxLF', pane: 'Driver: Advanced', kind: 'number', unit: 'dB', precision: 2, min: 0, max: 200, formula: 'SPLmaxLF = 20·log₁₀(ρ₀·(2π·20)²·Vd / (2π√2) / P0)', description: 'Low Frequency Excursion Limit SPL: Theoretical maximum sound pressure level at 20 Hz limited strictly by peak diaphragm excursion Xmax.' },
  { id: 'driver_SPLmax_dB', aliases: ['SPLmax_dB', 'SPLmax'], label: 'SPLmax', pane: 'Driver: Advanced', kind: 'number', unit: 'dB', precision: 2, min: 0, max: 200, formula: 'SPLmax = SPL + 10·log₁₀(Pe) − 3', description: 'Thermally Limited Max SPL: Maximum acoustic sound pressure level when driven at full thermal power rating Pe.' },
  { id: 'driver_Rme_Ns_per_m', aliases: ['Rme_kg_per_s', 'Rme'], label: 'Rme', pane: 'Driver: Advanced', kind: 'number', unit: 'Ns/m', unitGroup: 'resistance', precision: 5, min: 0, max: 1000, formula: 'Rme = 2π·Fs·Mms/Qes (= Bl²/Re)', description: 'Motional Resistance at Resonance: Electromagnetic damping resistance generated by back-EMF at resonance.' },
  { id: 'driver_Gamma', aliases: ['gamma_m_per_s2_A', 'gamma'], label: 'gamma', pane: 'Driver: Advanced', kind: 'number', unit: 'N/(A·kg)', precision: 5, min: 0, max: 100000, formula: 'gamma = Bl/Mms', description: 'Acceleration Factor: Ratio of motor force BL to moving mass Mms, measuring initial cone acceleration per ampere.' },
  { id: 'driver_Mpow', aliases: ['Mpow_N_per_sqrtW', 'Mpow'], label: 'Mpow', pane: 'Driver: Advanced', kind: 'number', unit: 'N/√W', precision: 5, min: 0, max: 1000, formula: 'Mpow = √Rme (= Bl/√Re)', description: 'Power-Normalized Motor Force: Motor force produced per square root of input power (BL / √Re).' },
  { id: 'driver_Mcost_kg_per_s', aliases: ['Mcost_kg_per_s', 'Mcost'], label: 'Mcost', pane: 'Driver: Advanced', kind: 'number', unit: 'kg/s', unitGroup: 'resistance', precision: 5, min: 0, max: 1000, formula: 'Mcost = Rme·(1 + Xmax/min(Hc, Hg))', description: 'Motor Figure of Merit: Dynamic electromagnetic coupling efficiency accounting for gap geometry and displacement.' },
  { id: 'driver_Gloss_pct', aliases: ['Gloss'], label: 'Gloss', pane: 'Driver: Advanced', kind: 'number', unit: '%', unitGroup: 'percent', precision: 4, min: 0, max: 100, formula: 'Gloss = g/((2π·Fs)²·Xmax), g = 9.80665', description: 'Gravity Sag Percentage: Percentage of peak excursion Xmax consumed by cone displacement under gravity when mounted horizontally.' },
  { id: 'driver_Thick_mm', aliases: ['Thick_m', 'Thick'], label: 'Basket Plate Thickness (Thick)', pane: 'Driver: Dimensions', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 0.3, description: 'Basket Flange Thickness: Frame flange plate thickness at the mounting boundary.' },
  { id: 'driver_Depth_mm', aliases: ['Depth_m', 'Depth'], label: 'Driver Depth (Depth)', pane: 'Driver: Dimensions', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 5, description: 'Overall Driver Depth: Total physical depth of the driver from mounting flange to rear magnet pole plate.' },
  { id: 'driver_MagDepth_mm', aliases: ['MagDepth_m', 'MagDepth'], label: 'Magnet Depth', pane: 'Driver: Dimensions', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 5, description: 'Magnet Assembly Depth: Physical thickness of the rear magnet assembly.' },
  { id: 'driver_Magnet_mm', aliases: ['Magnet_m', 'Magnet'], label: 'Magnet Diameter (Magnet)', pane: 'Driver: Dimensions', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 5, description: 'Magnet Diameter: Outer diameter of the motor magnet structure.' },
  { id: 'driver_Basket_mm', aliases: ['Basket_m', 'Basket'], label: 'Basket Diameter (Basket)', pane: 'Driver: Dimensions', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 5, description: 'Basket Diameter: Outer frame chassis diameter.' },
  { id: 'driver_Outer_mm', aliases: ['Outer_m', 'Outer'], label: 'Outer Diameter (Outer)', pane: 'Driver: Dimensions', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 5, description: 'Outer Mounting Diameter: Overall diameter of the front mounting flange.' },
  { id: 'driver_Vcd_mm', aliases: ['Vcd_m', 'Vcd'], label: 'Voice Coil Dia (Vcd)', pane: 'Driver: Dimensions', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 1, description: 'Voice Coil Diameter: Former diameter of the voice coil winding.' },
  { id: 'driver_Dvol_cm3', aliases: ['DVol_m3', 'DVol'], label: 'Driver Displacement Volume (DVol)', pane: 'Driver: Dimensions', kind: 'number', unit: 'cm³', precision: 2, min: 0, max: 1, description: 'Driver Displacement Volume: Volume occupied by the driver motor and basket inside the enclosure.' },

  // ── Driver: General ──
  { id: 'driver_manufacturer', aliases: ['manufacturer'], label: 'Manufacturer', pane: 'Driver: General', kind: 'text', unit: '', description: 'Manufacturer: Company or organization that designed and manufactured the driver.' },
  { id: 'driver_brand', aliases: ['brand'], label: 'Brand', pane: 'Driver: General', kind: 'text', unit: '', description: 'Brand: Trade brand name under which the driver is marketed.' },
  { id: 'driver_model', aliases: ['model'], label: 'Model', pane: 'Driver: General', kind: 'text', unit: '', description: 'Model: Manufacturer model designation or part number.' },
  { id: 'driver_providedBy', aliases: ['providedBy'], label: 'Data provided by', pane: 'Driver: General', kind: 'text', unit: '', description: 'Data Attribution: Source contributor or measurement laboratory providing the parameter data.' },
  { id: 'driver_added', aliases: ['added'], label: 'Date added', pane: 'Driver: General', kind: 'date', unit: '', description: 'Date Added: Date when the driver parameter record was cataloged.' },
  { id: 'driver_comment', aliases: ['comment'], label: 'Comment', pane: 'Driver: General', kind: 'text', unit: '', description: 'Driver Notes: Free-text engineering notes and comments associated with the driver record.' },

  { id: 'driver_Znom_ohm', aliases: ['Znom_ohm', 'Znom'], label: 'Znom', pane: 'Driver: Parameters', kind: 'number', unit: 'ohm', precision: 0, min: 0, max: 64, description: 'Nominal Impedance: Rated speaker impedance classification (e.g. 4, 8, or 16 ohms) for amplifier matching.' },

  { id: 'driver_c_m_per_s', aliases: ['c_m_per_s', 'c'], label: 'c', pane: 'Driver: Advanced', kind: 'number', unit: 'm/s', unitGroup: 'velocity', precision: 2, min: 0, max: 1000, description: 'Reference Speed of Sound: Velocity of acoustic propagation at reference environmental conditions.' },
  { id: 'driver_roo_kg_per_m3', aliases: ['roo_kg_per_m3', 'roo'], label: 'roo', pane: 'Driver: Advanced', kind: 'number', unit: 'kg/m³', unitGroup: 'density', precision: 5, min: 0, max: 10, description: 'Reference Air Density: Atmospheric mass density at reference environmental conditions.' },

  // ── Box readouts ──
  { id: 'box_Resonance_hz', aliases: ['boxResonance'], label: 'Fsc / Fh', pane: 'Box', kind: 'number', unit: 'Hz', unitGroup: 'freq', precision: 2, min: 0, max: 20000, description: 'System Resonance Frequency: Effective total resonance frequency of the driver coupled to the enclosure.' },
  { id: 'box_RearResonance_hz', aliases: ['rearResonance', 'boxRearResonance'], label: 'Frc', pane: 'Box', kind: 'number', unit: 'Hz', unitGroup: 'freq', precision: 2, min: 0, max: 20000, description: 'Rear Chamber Resonance: Sealed rear-chamber resonance frequency in a 4th-order bandpass enclosure (Frc = Fs × √(1 + Vas/Vb)).' },
  { id: 'box_Frc_hz', aliases: ['Frc'], label: 'Tuning freq (Frc)', pane: 'Box', kind: 'number', unit: 'Hz', unitGroup: 'freq', precision: 2, min: 0, max: 20000, description: 'Rear Chamber Tuning Frequency: Target Helmholtz tuning frequency for the vented rear chamber in 6th-order bandpass and ABC enclosures.' },

  // ============================ DRIVER PLACEMENT ============================
  {
    id: 'driver_nDrivers', aliases: ['nDrivers'], label: 'Num. of drivers', pane: 'Driver', kind: 'number', unit: '', precision: 0, min: 1, max: 64,
    description: 'Driver Count: Total number of active drivers operating in the enclosure system.',
  },
  { id: 'driver_ArrayWiring', aliases: ['wiring', 'arrayWiring'], label: 'Voice coil connection', pane: 'Driver', kind: 'enum', unit: '', options: ARRAY_WIRING_OPTIONS, description: 'Driver Array Wiring: How multiple drivers are wired to the amplifier (parallel or series), setting the total load impedance.' },
  { id: 'driver_VcTempRise_K', aliases: ['vcTempRise', 'driverVcTempRise'], label: 'Voice coil temp rise', pane: 'Driver', kind: 'number', unit: 'K', precision: 2, min: 0, max: 500, description: 'Voice Coil Temp Rise: Voice coil heating caused by electrical power dissipation (I² Re), increasing coil resistance Re and inducing thermal power compression.' },
  { id: 'driver_AddedMass_g', aliases: ['driverAddedMass'], label: 'Added mass to cone', pane: 'Driver', kind: 'number', unit: 'g', precision: 5, min: 0, max: 5, description: 'Cone Added Mass: Test mass temporarily added to the cone to shift resonant frequency (Fs), allowing calculation of suspension compliance (Cms) and moving mass (Mms).' },

  // ============================ FILTERS ============================
  { id: 'filter_Type', aliases: ['filterType'], label: 'Filter type', pane: 'Filters', kind: 'enum', unit: '', options: FILTER_TYPE_OPTIONS, description: 'Filter Type: The response shape of the active filter — lowpass, highpass, Linkwitz transform, peaking EQ or shelf.' },
  { id: 'filter_Fc_hz', aliases: ['filterFc'], label: 'Cutoff / Center freq', pane: 'Filters', kind: 'number', unit: 'Hz', precision: 3, min: 1, max: 20000, description: 'Cutoff / Center Frequency: Cutoff or center frequency of the active signal filter.' },
  { id: 'filter_Q', aliases: ['filterQ'], label: 'Q', pane: 'Filters', kind: 'number', unit: '', precision: 3, min: 0.1, max: 100, description: 'Filter Quality Factor: Quality factor determining resonance peak sharpness or damping of the filter.' },
  { id: 'filter_Gain_dB', aliases: ['filterGain'], label: 'Gain', pane: 'Filters', kind: 'number', unit: 'dB', precision: 3, min: -60, max: 60, description: 'Filter Gain: Boost or attenuation gain applied by the equalizer or filter in dB.' },
  { id: 'filter_Order', aliases: ['filterOrder'], label: 'Order', pane: 'Filters', kind: 'number', unit: '', precision: 3, min: 1, max: 8, description: 'Filter Order: Filter steepness order (e.g. 1st order 6 dB/oct, 2nd order 12 dB/oct, 4th order 24 dB/oct).' },
];

/** All registered field specs (read-only view). */
export const fieldSpecs: readonly UIFieldSpec[] = UI_FIELD_SPECS;
export { UI_FIELD_SPECS };

export function fieldById(id: string): UIFieldSpec | undefined {
  return UI_FIELD_SPECS.find(s => s.id === id || s.aliases?.includes(id));
}

export function fieldHelp(id: string): string {
  return fieldById(id)?.description ?? '';
}

export function precision(id: string): number {
  const spec = fieldById(id);
  if (!spec) throw new Error(`uiFields: no field "${id}" — add it to uiFields.ts`);
  if (spec.precision === undefined) throw new Error(`uiFields: field "${id}" is ${spec.kind}, has no precision`);
  return spec.precision;
}

export function limits(id: string): { min?: number; max?: number } {
  const spec = fieldById(id);
  if (!spec) throw new Error(`uiFields: no field "${id}" — add it to uiFields.ts`);
  return { min: spec.min, max: spec.max };
}
