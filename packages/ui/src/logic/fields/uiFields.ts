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
  /**
   * What the field is, for the on-hover tooltip. One name line, then one or more short fact
   * lines (`\n`-separated) — never a single dense run-on sentence (2026-09-26, John: avoid long
   * single-line tooltips; multi-line, brief but clear). A fact line states one thing: what it
   * measures, its formula, or a consequence — not restated padding around the label.
   */
  readonly description: string;
}

const UI_FIELD_SPECS: UIFieldSpec[] = [
  // ============================ BOX / ENCLOSURE ============================
  {
    id: 'box_Type', aliases: ['boxType'], label: 'Box type', pane: 'Box', kind: 'enum', unit: '',
    options: BOX_TYPE_OPTIONS,
    description: 'Enclosure Type\nWhich kind of box the driver is loaded into — closed, vented, passive radiator, bandpass or ABC.',
  },
  {
    id: 'box_Qtc', aliases: ['Qtc', 'sealedAlignment'], label: 'Alignment (Qtc)', pane: 'Box', kind: 'enum', unit: '',
    options: SEALED_ALIGNMENT_OPTIONS,
    description: 'Sealed Alignment Target (Qtc)\nThe closed box\'s total system Q.\n0.707 is maximally flat; lower is more damped; higher peaks before rolling off.',
  },
  {
    id: 'box_Vb_l', aliases: ['Vb'], label: 'Volume', pane: 'Box', kind: 'number', unit: 'l', unitGroup: 'volume', precision: 2, min: 0.0001, max: 100,
    description: 'Net Enclosure Volume\nInternal net air volume — the acoustic spring the driver works against.',
  },
  {
    id: 'box_Vf_l', aliases: ['Vf'], label: 'Front volume', pane: 'Box', kind: 'number', unit: 'l', precision: 2, min: 0.0001, max: 100,
    description: 'Front Chamber Volume\nNet air volume of the front, vented chamber in a bandpass enclosure.',
  },
  {
    id: 'box_Fb_hz', aliases: ['Fb'], label: 'Target Tuning Freq (Fb)', pane: 'Box', kind: 'number', unit: 'Hz', precision: 2, min: 0, max: 1000,
    description: 'Box Tuning Frequency (Fb)\nHelmholtz resonance of the vented enclosure, set by port dimensions and box volume.',
  },

  // ============================ VENTS / PORTED ============================
  {
    id: 'vent_Count', aliases: ['Num', 'ventCount'], label: 'Number of vents', pane: 'Vents', kind: 'number', unit: '', precision: 0, min: 1, max: 4,
    description: 'Number of Vents\nHow many identical ports share the chamber.\nMore ports need a longer port for the same tuning, since the air-mass term sees the combined opening; end correction stays that of one port.',
  },
  {
    id: 'vent_Shape', aliases: ['ventShape'], label: 'Vent shape', pane: 'Vents', kind: 'enum', unit: '',
    options: VENT_SHAPE_OPTIONS,
    description: 'Vent Geometry\nA circular tube (round) or a rectangular duct (slotted) port.',
  },
  {
    id: 'vent_D_cm', aliases: ['ventD'], label: 'Vent diameter', pane: 'Vents', kind: 'number', unit: 'cm', precision: 2, min: 0.001, max: 2,
    description: 'Port Diameter\nInternal diameter of a round port.\nLarger diameters reduce turbulence (chuffing) but need a longer tube for the same tuning.',
  },
  {
    id: 'vent_W_cm', aliases: ['ventW'], label: 'Slot width', pane: 'Vents', kind: 'number', unit: 'cm', precision: 2, min: 0.001, max: 2,
    description: 'Slot Port Width\nInternal width of a rectangular slotted port.',
  },
  {
    id: 'vent_H_cm', aliases: ['ventH'], label: 'Slot height', pane: 'Vents', kind: 'number', unit: 'cm', precision: 2, min: 0.001, max: 2,
    description: 'Slot Port Height\nInternal height of a rectangular slotted port.',
  },
  {
    id: 'vent_L_cm', aliases: ['ventL'], label: 'Vent length', pane: 'Vents', kind: 'number', unit: 'cm', precision: 2, min: 0.001, max: 10,
    description: 'Vent Length\nPhysical length of the port tube.\nLonger ports lower the tuning frequency for a fixed box volume.',
  },
  {
    id: 'vent_EndCorrection', aliases: ['endCorrection', 'ventEndCorrection'], label: 'End Correction', pane: 'Vents', kind: 'enum', unit: '',
    options: END_CORRECTION_OPTIONS,
    description: 'End Correction Factor\nAccounts for air moving just beyond the duct\'s physical ends — it extends the port\'s effective length.\nDepends on how the port terminates: free air, or a flanged baffle.',
  },
  {
    id: 'vent_CrossArea_m2', aliases: ['ventCrossArea'], label: 'Cross area', pane: 'Vents', kind: 'number', unit: 'm²', precision: 4, min: 0, max: 10,
    formula: 'π·(ventD/2)²',
    description: 'Vent Cross-Sectional Area\nTotal internal cross-sectional area of the port.',
  },
  {
    id: 'vent_1stPortResonance_hz', aliases: ['portResonance', 'ventPortResonance'], label: '1st port resonance', pane: 'Vents', kind: 'number', unit: 'Hz', precision: 2, min: 0, max: 20000,
    formula: 'c / (2·ventL)',
    description: 'First Vent Pipe Resonance\nThe lowest organ-pipe standing-wave resonance inside the port (f = c / 2L).\nCauses output peaks and noise at or above the passband, limiting usable port bandwidth.',
  },

  // ============================ PASSIVE RADIATOR ============================
  {
    id: 'pr_Sd_cm2', aliases: ['prSd'], label: 'Sd', pane: 'PassiveRadiator', kind: 'number', unit: 'cm²', unitGroup: 'area', precision: 2, min: 0.0001, max: 10,
    description: 'Passive Radiator Area\nEffective radiating piston area of the passive radiator.',
  },
  {
    id: 'pr_Xmax_mm', aliases: ['prXmax'], label: 'Xmax', pane: 'PassiveRadiator', kind: 'number', unit: 'mm', unitGroup: 'length', precision: 2, min: 0, max: 0.5,
    description: 'Passive Radiator Excursion Limit\nMaximum peak linear displacement of the passive radiator diaphragm.',
  },
  {
    id: 'pr_Num', aliases: ['prNum'], label: 'Num. of PRs', pane: 'PassiveRadiator', kind: 'number', unit: '', precision: 0, min: 1, max: 16,
    description: 'Passive Radiator Count\nNumber of identical passive radiators in the enclosure.',
  },
  {
    id: 'pr_Madd_g', aliases: ['prMadd'], label: 'Added mass to cone', pane: 'PassiveRadiator', kind: 'number', unit: 'g', precision: 3, min: 0, max: 5000,
    description: 'PR Added Mass\nBallast mass attached to the passive radiator cone to lower its tuning frequency.',
  },
  {
    id: 'pr_Fp_hz', aliases: ['Fp'], label: 'Target tuning freq (Fp)', pane: 'PassiveRadiator', kind: 'number', unit: 'Hz', precision: 2, min: 1, max: 1000,
    description: 'Passive Radiator System Tuning (Fp)\nHelmholtz tuning frequency the passive radiator and enclosure volume achieve together.',
  },
  {
    id: 'pr_Vas_l', aliases: ['prVas'], label: 'Vas', pane: 'PassiveRadiator', kind: 'number', unit: 'l', unitGroup: 'volume', precision: 2, min: 0.00001, max: 100,
    formula: 'Vas = Cms·Sd²·ρ·c²·1000',
    description: 'PR Equivalent Compliance Volume\nVolume of air whose compliance equals the passive radiator\'s own suspension.',
  },
  {
    id: 'pr_Fs_hz', aliases: ['prFs'], label: 'Fpr', pane: 'PassiveRadiator', kind: 'number', unit: 'Hz', precision: 2, min: 1, max: 1000,
    formula: 'Fpr = 1/(2π·√(Mmd·Cms))',
    description: 'Unloaded PR Resonance (Fpr)\nThe passive radiator\'s free-air resonance, with no added mass and no box coupling.',
  },
  {
    id: 'pr_Qms', aliases: ['prQms'], label: 'Qms', pane: 'PassiveRadiator', kind: 'number', unit: '', precision: 3, min: 0.1, max: 100,
    formula: 'Qms = √(Mmd/Cms)/Rms',
    description: 'PR Mechanical Quality Factor\nQuality factor for mechanical suspension friction losses in the passive radiator.',
  },
  {
    id: 'pr_FsMass_hz', aliases: ['prFsMass'], label: 'Fpr (with added mass)', pane: 'PassiveRadiator', kind: 'number', unit: 'Hz', precision: 2, min: 0, max: 1000,
    formula: 'Fpr = 1/(2π·√((Mmd+Madd)·Cms))',
    description: 'Mass-Loaded PR Resonance\nThe passive radiator\'s free-air resonance including its added mass (Madd).',
  },

  // ============================ SIGNAL ============================
  {
    id: 'signal_Pin_W', aliases: ['Pin'], label: 'System input power', pane: 'Signal', kind: 'number', unit: 'W', precision: 2, min: 0.01, max: 100000,
    description: 'System Input Power\nTotal electrical power supplied to the system (P = V² / Re).',
  },
  {
    id: 'signal_DriveV_V', aliases: ['driveV'], label: 'Driver input voltage (each)', pane: 'Signal', kind: 'number', unit: 'V', precision: 2, min: 0.01, max: 1000,
    formula: 'driveV = √(Pin · Re)',
    description: 'Driver Terminal Voltage\nRMS voltage across the driver\'s voice-coil terminals (V = √(P · Re)).',
  },
  {
    id: 'signal_Rs_ohm', aliases: ['Rs'], label: 'Series resistance', pane: 'Signal', kind: 'number', unit: 'ohm', precision: 3, min: 0, max: 1000,
    description: 'Series Resistance\nCombined amplifier output impedance, wiring and crossover resistance, in series with the driver.',
  },
  {
    id: 'signal_Distance_m', aliases: ['listenDistance'], label: 'Distance', pane: 'Signal', kind: 'number', unit: 'm', precision: 3, min: 0, max: 100,
    description: 'Listening Distance\nOn-axis distance from the loudspeaker to the listener, used for SPL calculations.',
  },
  {
    id: 'signal_Angle_rad', aliases: ['listenAngle'], label: 'Off-Axis Angle', pane: 'Signal', kind: 'number', unit: 'rad', precision: 4, min: 0, max: 3.1416,
    description: 'Off-Axis Angle\nAngular offset from the main acoustic axis, in radians.',
  },
  {
    id: 'signal_GenHz_hz', aliases: ['genHz'], label: 'Signal generator frequency', pane: 'Signal', kind: 'number', unit: 'Hz', precision: 2, min: 1, max: 20000,
    description: 'Test Tone Frequency\nThe frequency the single-tone signal generator evaluates.',
  },

  // ============================ BOX LOSSES ============================
  {
    id: 'loss_Ql', aliases: ['Ql'], label: 'Leakage Ql', pane: 'Box losses', kind: 'number', unit: '', precision: 2, min: 0.1, max: 1000,
    description: 'Enclosure Leakage Loss Q\nAcoustic energy lost through cabinet seams and gaskets.',
  },
  {
    id: 'loss_Qa', aliases: ['Qa'], label: 'Absorption Qa', pane: 'Box losses', kind: 'number', unit: '', precision: 2, min: 0.1, max: 1000,
    description: 'Enclosure Damping Loss Q\nAcoustic energy absorbed by internal damping fill.',
  },
  {
    id: 'loss_DampingMode', aliases: ['lossMode'], label: 'Loss model', pane: 'Box losses', kind: 'enum', unit: '',
    options: lossModeOptions(),
    description: 'Loss Model\nHow Fsc and Qtc account for box losses.\nNone: ideal, lossless (Q = ∞).\nWinISD default: lossy cubic (Ql=10, Qa=100, Qp=100).\nCustom: your own Ql/Qa/Qp values.',
  },
  {
    id: 'loss_Qp', aliases: ['Qp'], label: 'Port Qp', pane: 'Box losses', kind: 'number', unit: '', precision: 2, min: 0.1, max: 1000,
    description: 'Port Friction Loss Q\nAir friction and viscous boundary losses inside the vent.',
  },

  // ============================ ADVANCED (ENVIRONMENT) ============================
  {
    id: 'adv_Temp_K', aliases: ['advTemp'], label: 'Temperature', pane: 'Advanced', kind: 'number', unit: 'K', precision: 2, min: MIN_SUPPORTED_TEMP_K, max: MAX_SUPPORTED_TEMP_K,
    description: 'Ambient Temperature\nUsed to calculate the speed of sound and the density of air.',
  },
  {
    id: 'adv_Humidity_pct', aliases: ['advHumidity'], label: 'Relative humidity', pane: 'Advanced', kind: 'number', unit: '%', precision: 2, min: 0, max: 100,
    description: 'Relative Humidity\nAffects the speed of sound and the density of the air.',
  },
  {
    id: 'adv_Pressure_kPa', aliases: ['advPressure'], label: 'Air pressure', pane: 'Advanced', kind: 'number', unit: 'kPa', precision: 2, min: 1000, max: 200000,
    description: 'Air Pressure\nAtmospheric pressure — affects air density and acoustic impedance.',
  },
  {
    id: 'adv_SoundVelocity_m_per_s', aliases: ['advSoundVelocity'], label: 'Sound velocity', pane: 'Advanced', kind: 'number', unit: 'm/s', precision: 2, min: 0, max: 1000,
    formula: 'c = √(γ·p/ρ), γ = 1.4',
    description: 'Speed of Sound\nHow fast an acoustic wave travels through air, at the stated conditions.',
  },
  {
    id: 'adv_AirDensity_kg_per_m3', aliases: ['advAirDensity'], label: 'Air density', pane: 'Advanced', kind: 'number', unit: 'kg/m³', precision: 5, min: 0, max: 10,
    formula: 'ρ = p·Ma/(R·T)·[1 − xv(1 − Mv/Ma)]',
    description: 'Air Density\nMass density of air, derived from temperature, humidity and pressure.',
  },

  // ---- Advanced pane simulation options ----
  {
    id: 'adv_SimVcInductance', aliases: ['simVcInductance'], label: 'Simulate voice coil inductance', pane: 'Advanced', kind: 'toggle', unit: '',
    description: 'Simulate Voice Coil Inductance\nApplies Le to the acoustic output too, not just the impedance plot.',
  },
  {
    id: 'adv_ForceFlatResponse', aliases: ['forceFlatResponse'], label: 'Force flat response', pane: 'Advanced', kind: 'toggle', unit: '',
    description: 'Force Flat Response\nApplies auto-equalization, revealing the excursion and port velocity a flat passband would demand.',
  },
  {
    id: 'adv_TlPortModel', aliases: ['tlPortModel'], label: 'Use "transmission line"-model for port simulation', pane: 'Advanced', kind: 'toggle', unit: '',
    description: 'Transmission Line Port Model\nModels the vent as a distributed transmission line, adding its internal organ-pipe resonances to the response curves.',
  },
  {
    id: 'adv_RgAtDriverSide', aliases: ['rgAtDriverSide'], label: 'Rg is at driver side', pane: 'Advanced', kind: 'toggle', unit: '',
    description: 'Rg Placement\nApplies the series resistance Rg to each driver individually, rather than once at the amplifier output.',
  },
  {
    id: 'adv_SplXmaxLimited', aliases: ['splXmaxLimited'], label: 'SPL graph is Xmax limited', pane: 'Advanced', kind: 'toggle', unit: '',
    description: 'Xmax Limited SPL\nClamps the SPL curve wherever cone excursion would exceed Xmax.',
  },
  {
    id: 'adv_UseWinisdAirModel', aliases: ['useWinisdAirModel'], label: 'Use WinISD air model', pane: 'Advanced', kind: 'toggle', unit: '',
    description: 'Air Model Selection\nWinISD\'s own air equations, or the CIPM moist-air standard.',
  },

  // ============================ DRIVER EDITOR — T/S (Parameters tab) ============================
  {
    id: 'driver_Fs_hz', aliases: ['Fs_hz', 'Fs'], label: 'Fs', pane: 'Driver: Parameters', kind: 'number', unit: 'Hz', precision: 2, min: 1, max: 5000,
    description: 'Driver Resonant Frequency (Fs)\nFree-air resonance of the driver\'s moving assembly and suspension.',
  },
  {
    id: 'driver_Qts', aliases: ['Qts'], label: 'Qts', pane: 'Driver: Parameters', kind: 'number', unit: '', precision: 3, min: 0, max: 5,
    formula: 'Qts = Qes·Qms/(Qes+Qms)',
    description: 'Total Quality Factor (Qts)\nOverall damping at Fs — electrical (Qes) and mechanical (Qms) combined.',
  },
  {
    id: 'driver_Qes', aliases: ['Qes'], label: 'Qes', pane: 'Driver: Parameters', kind: 'number', unit: '', precision: 3, min: 0, max: 5,
    description: 'Electrical Quality Factor (Qes)\nDamping at Fs from back-EMF in the voice coil.',
  },
  {
    id: 'driver_Qms', aliases: ['Qms'], label: 'Qms', pane: 'Driver: Parameters', kind: 'number', unit: '', precision: 3, min: 0, max: 50,
    description: 'Mechanical Quality Factor (Qms)\nDamping at Fs from friction in the surround and spider.',
  },
  {
    id: 'driver_Vas_l', aliases: ['Vas_m3', 'Vas'], label: 'Vas', pane: 'Driver: Parameters', kind: 'number', unit: 'l', precision: 2, min: 0, max: 100,
    description: 'Equivalent Compliance Volume (Vas)\nVolume of air whose compliance equals the driver suspension\'s own.',
  },
  {
    id: 'driver_Re_ohm', aliases: ['Re_ohm', 'Re'], label: 'Re', pane: 'Driver: Parameters', kind: 'number', unit: 'ohm', precision: 3, min: 0.01, max: 1000,
    description: 'DC Voice Coil Resistance (Re)\nResistance across the voice coil terminals, measured with DC.',
  },
  {
    id: 'driver_Le_mH', aliases: ['Le_H', 'Le'], label: 'Le', pane: 'Driver: Parameters', kind: 'number', unit: 'mH', precision: 3, min: 0, max: 0.1,
    description: 'Voice Coil Inductance (Le)\nSelf-inductance of the coil — raises electrical impedance at high frequency.',
  },
  {
    id: 'driver_Mms_g', aliases: ['Mms_kg', 'Mms'], label: 'Mms', pane: 'Driver: Parameters', kind: 'number', unit: 'g', precision: 2, min: 0, max: 10,
    formula: 'Mms = 1/((2π·Fs)²·Cms)',
    description: 'Moving Mass (Mms)\nTotal mass of the diaphragm, voice coil, former and the air it loads.',
  },
  {
    id: 'driver_Sd_cm2', aliases: ['Sd_m2', 'Sd'], label: 'Sd', pane: 'Driver: Parameters', kind: 'number', unit: 'cm²', precision: 2, min: 0.0001, max: 10,
    description: 'Effective Diaphragm Area (Sd)\nEffective radiating piston area of the cone and inner surround.',
  },
  {
    id: 'driver_Xmax_mm', aliases: ['Xmax_m', 'Xmax'], label: 'Xmax', pane: 'Driver: Parameters', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 0.5,
    description: 'Peak Linear Excursion (Xmax)\nThe furthest the coil can move one way while still fully inside the magnetic gap.',
  },
  {
    id: 'driver_Pe_W', aliases: ['Pe_W', 'Pe'], label: 'Pe', pane: 'Driver: Parameters', kind: 'number', unit: 'W', precision: 2, min: 0, max: 100000,
    description: 'Continuous Power Handling (Pe)\nThermal/RMS rating: the power the coil dissipates indefinitely without failing.\nNot the datasheet\'s peak/short-term figure — see "Peak power".',
  },
  {
    id: 'driver_power_peak_W', aliases: ['power_peak_W'], label: 'Peak power', pane: 'Driver: Parameters', kind: 'number', unit: 'W', precision: 2, min: 0, max: 100000,
    description: 'Peak Power (short-term)\nNon-continuous power handling, above Pe.\nOpenISD-only: WinISD\'s .wdr format has no slot for it, so it never round-trips through a .wdr/.wpr file.',
  },
  {
    id: 'driver_BL_Tm', aliases: ['BL_Tm', 'BL'], label: 'BL', pane: 'Driver: Parameters', kind: 'number', unit: 'Tm', precision: 3, min: 0, max: 1000,
    formula: 'Bl = √(2π·Fs·Mms·Re/Qes)',
    description: 'Motor Force Factor (BL)\nGap flux density (B) times coil wire length (L) — the motor\'s coupling strength.',
  },
  {
    id: 'driver_Cms_mm_per_N', aliases: ['Cms_m_per_N', 'Cms'], label: 'Cms', pane: 'Driver: Parameters', kind: 'number', unit: 'mm/N', precision: 4, min: 0, max: 0.1,
    formula: 'Cms = Vas/(ρ·c²·Sd²)',
    description: 'Mechanical Compliance (Cms)\nHow flexible the suspension is — the inverse of its spring rate.',
  },
  {
    id: 'driver_Rms_Ns_per_m', aliases: ['Rms_kg_per_s', 'Rms'], label: 'Rms', pane: 'Driver: Parameters', kind: 'number', unit: 'Ns/m', unitGroup: 'resistance', precision: 4, min: 0, max: 1000,
    formula: 'Rms = 2π·Fs·Mms/Qms',
    description: 'Mechanical Resistance (Rms)\nFriction loss in the driver\'s suspension.',
  },

  // ============================ DRIVER EDITOR — reference-only ============================
  { id: 'driver_Dd_mm', aliases: ['Dd_m', 'Dd'], label: 'Dd', pane: 'Driver: Parameters', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 2, description: 'Effective Diaphragm Diameter (Dd)\nEffective piston diameter of the cone.\nInterchangeable with Sd (Sd = π·(Dd/2)²).' },
  { id: 'driver_fLe_hz', aliases: ['fLe_hz', 'fLe'], label: 'fLe', pane: 'Driver: Parameters', kind: 'number', unit: 'kHz', precision: 5, min: 0, max: 100000, description: 'Semi-Inductance Reference Frequency (fLe)\nThe frequency at which Le and KLe were measured.' },
  { id: 'driver_KLe_H_sqrtHz', aliases: ['KLe_H_sqrtHz', 'KLe'], label: 'KLe', pane: 'Driver: Parameters', kind: 'number', unit: 'H·√Hz', precision: 6, min: 0, max: 10, description: 'Semi-Inductance Coefficient (KLe)\nLoss factor for eddy currents and other high-frequency coil losses.' },
  { id: 'driver_Hc_mm', aliases: ['Hc_m', 'Hc'], label: 'Hc', pane: 'Driver: Parameters', kind: 'number', unit: 'm', precision: 3, min: 0, max: 1, description: 'Voice Coil Height (Hc)\nWinding height of the coil wire on the former.' },
  { id: 'driver_Hg_mm', aliases: ['Hg_m', 'Hg'], label: 'Hg', pane: 'Driver: Parameters', kind: 'number', unit: 'm', precision: 3, min: 0, max: 1, description: 'Magnetic Gap Height (Hg)\nThickness of the top plate — defines the magnetic gap.' },
  { id: 'driver_Vd_cm3', aliases: ['Vd_m3', 'Vd'], label: 'Vd', pane: 'Driver: Parameters', kind: 'number', unit: 'cm³', precision: 0, min: 0, max: 100000, description: 'Peak Displacement Volume (Vd)\nAir displaced by the cone at full excursion (Vd = Sd × Xmax).' },
  { id: 'driver_Xlim_mm', aliases: ['Xlim_m', 'Xlim'], label: 'Xlim', pane: 'Driver: Parameters', kind: 'number', unit: 'm', precision: 3, min: 0, max: 1, description: 'Mechanical Excursion Limit (Xlim)\nAbsolute travel limit before mechanical damage or bottoming.' },
  { id: 'driver_Eta0', aliases: ['no'], label: 'η₀', pane: 'Driver: Parameters', kind: 'number', unit: '%', unitGroup: 'percent', precision: 4, min: 0, max: 100, description: 'Reference Efficiency (η₀)\nHow much of the electrical power reaching the driver becomes acoustic power (η₀ = P_acc / P_elec × 100%).' },
  { id: 'driver_USPL_dB', aliases: ['USPL_dB', 'USPL'], label: 'USPL', pane: 'Driver: Parameters', kind: 'number', unit: 'dB', precision: 2, min: 0, max: 200, formula: 'USPL = SPL + 10·log₁₀(8/Re)', description: 'Voltage Sensitivity (USPL)\nSPL at 1 m for a standard 2.83 V RMS input.' },
  { id: 'driver_SPL_dB', aliases: ['SPL_dB', 'SPL'], label: 'SPL', pane: 'Driver: Parameters', kind: 'number', unit: 'dB', precision: 2, min: 0, max: 200, description: 'Power Sensitivity (SPL)\nSPL at 1 m for a 1 W electrical input.' },
  { id: 'driver_NumVC', aliases: ['numVC'], label: 'Voicecoils', pane: 'Driver: Parameters', kind: 'number', unit: '', precision: 0, min: 1, max: 4, description: 'Voice Coil Count\nNumber of independent coil windings on the motor.' },
  { id: 'driver_VCCon', aliases: ['VCCon'], label: 'Connection', pane: 'Driver: Parameters', kind: 'enum', unit: '', options: VC_CONNECTION_OPTIONS, description: 'Voice Coil Wiring\nSeries or parallel — sets the driver\'s total terminal Re and BL for a multi-coil driver.' },
  { id: 'driver_AlfaVC_per_K', aliases: ['alfaVC_per_K', 'alfaVC'], label: 'AlfaVC', pane: 'Driver: Advanced', kind: 'number', unit: '1000/K', precision: 4, min: 0, max: 0.1, description: 'Voice Coil Temperature Coefficient (AlfaVC)\nHow much the coil\'s resistance rises per degree of heating.' },
  { id: 'driver_Rt_K_per_W', aliases: ['Rt_K_per_W', 'Rt'], label: 'R(t)', pane: 'Driver: Advanced', kind: 'number', unit: 'K/W', precision: 5, min: 0, max: 1000, description: 'Thermal Resistance (Rt)\nResistance to heat flow from the voice coil to the magnet and ambient air.' },
  { id: 'driver_Ct_J_per_K', aliases: ['Ct_J_per_K', 'Ct'], label: 'C(t)', pane: 'Driver: Advanced', kind: 'number', unit: 'J/K', precision: 5, min: 0, max: 10000, description: 'Thermal Capacitance (Ct)\nHeat storage capacity of the coil and motor structure.' },
  { id: 'driver_EBP_hz', aliases: ['EBP_hz', 'EBP'], label: 'EBP', pane: 'Driver: Advanced', kind: 'number', unit: 'Hz', precision: 2, min: 0, max: 1000, formula: 'EBP = Fs/Qes', description: 'Efficiency Bandwidth Product (EBP)\nFs / Qes.\nBelow ~50 favours a sealed box; above ~90 favours vented.' },
  { id: 'driver_SPLmaxLF_dB', aliases: ['SPLmaxLF_dB', 'SPLmaxLF'], label: 'SPLmaxLF', pane: 'Driver: Advanced', kind: 'number', unit: 'dB', precision: 2, min: 0, max: 200, formula: 'SPLmaxLF = 20·log₁₀(ρ₀·(2π·20)²·Vd / (2π√2) / P0)', description: 'Low-Frequency Excursion-Limited SPL\nMax SPL at 20 Hz, limited purely by peak excursion (Xmax).' },
  { id: 'driver_SPLmax_dB', aliases: ['SPLmax_dB', 'SPLmax'], label: 'SPLmax', pane: 'Driver: Advanced', kind: 'number', unit: 'dB', precision: 2, min: 0, max: 200, formula: 'SPLmax = SPL + 10·log₁₀(Pe) − 3', description: 'Thermally Limited Max SPL\nMax SPL when driven at the full thermal power rating (Pe).' },
  { id: 'driver_Rme_Ns_per_m', aliases: ['Rme_kg_per_s', 'Rme'], label: 'Rme', pane: 'Driver: Advanced', kind: 'number', unit: 'Ns/m', unitGroup: 'resistance', precision: 5, min: 0, max: 1000, formula: 'Rme = 2π·Fs·Mms/Qes (= Bl²/Re)', description: 'Motional Resistance at Resonance (Rme)\nElectromagnetic damping from back-EMF at Fs (= Bl²/Re).' },
  { id: 'driver_Gamma', aliases: ['gamma_m_per_s2_A', 'gamma'], label: 'gamma', pane: 'Driver: Advanced', kind: 'number', unit: 'N/(A·kg)', precision: 5, min: 0, max: 100000, formula: 'gamma = Bl/Mms', description: 'Acceleration Factor (gamma)\nMotor force per unit moving mass (Bl/Mms) — initial cone acceleration per amp.' },
  { id: 'driver_Mpow', aliases: ['Mpow_N_per_sqrtW', 'Mpow'], label: 'Mpow', pane: 'Driver: Advanced', kind: 'number', unit: 'N/√W', precision: 5, min: 0, max: 1000, formula: 'Mpow = √Rme (= Bl/√Re)', description: 'Power-Normalized Motor Force (Mpow)\nMotor force per √W of input power (Bl/√Re).' },
  { id: 'driver_Mcost_kg_per_s', aliases: ['Mcost_kg_per_s', 'Mcost'], label: 'Mcost', pane: 'Driver: Advanced', kind: 'number', unit: 'kg/s', unitGroup: 'resistance', precision: 5, min: 0, max: 1000, formula: 'Mcost = Rme·(1 + Xmax/min(Hc, Hg))', description: 'Motor Figure of Merit (Mcost)\nElectromagnetic coupling efficiency, accounting for gap geometry and excursion.' },
  { id: 'driver_Gloss_pct', aliases: ['Gloss'], label: 'Gloss', pane: 'Driver: Advanced', kind: 'number', unit: '%', unitGroup: 'percent', precision: 4, min: 0, max: 100, formula: 'Gloss = g/((2π·Fs)²·Xmax), g = 9.80665', description: 'Gravity Sag (Gloss)\nHow much of peak excursion (Xmax) gravity consumes when the driver is mounted horizontally.' },
  { id: 'driver_Thick_mm', aliases: ['Thick_m', 'Thick'], label: 'Basket Plate Thickness (Thick)', pane: 'Driver: Dimensions', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 0.3, description: 'Basket Flange Thickness\nFrame flange thickness at the mounting boundary.' },
  { id: 'driver_Depth_mm', aliases: ['Depth_m', 'Depth'], label: 'Driver Depth (Depth)', pane: 'Driver: Dimensions', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 5, description: 'Overall Driver Depth\nFull depth from mounting flange to rear magnet pole plate.' },
  { id: 'driver_MagDepth_mm', aliases: ['MagDepth_m', 'MagDepth'], label: 'Magnet Depth', pane: 'Driver: Dimensions', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 5, description: 'Magnet Assembly Depth\nThickness of the rear magnet assembly.' },
  { id: 'driver_Magnet_mm', aliases: ['Magnet_m', 'Magnet'], label: 'Magnet Diameter (Magnet)', pane: 'Driver: Dimensions', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 5, description: 'Magnet Diameter\nOuter diameter of the motor magnet.' },
  { id: 'driver_Basket_mm', aliases: ['Basket_m', 'Basket'], label: 'Basket Diameter (Basket)', pane: 'Driver: Dimensions', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 5, description: 'Basket Diameter\nOuter diameter of the frame/chassis.' },
  { id: 'driver_Outer_mm', aliases: ['Outer_m', 'Outer'], label: 'Outer Diameter (Outer)', pane: 'Driver: Dimensions', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 5, description: 'Outer Mounting Diameter\nOverall diameter of the front mounting flange.' },
  { id: 'driver_Vcd_mm', aliases: ['Vcd_m', 'Vcd'], label: 'Voice Coil Dia (Vcd)', pane: 'Driver: Dimensions', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 1, description: 'Voice Coil Diameter\nFormer diameter of the coil winding.' },
  { id: 'driver_Dvol_cm3', aliases: ['DVol_m3', 'DVol'], label: 'Driver Displacement Volume (DVol)', pane: 'Driver: Dimensions', kind: 'number', unit: 'cm³', precision: 2, min: 0, max: 1, description: 'Driver Displacement Volume\nVolume the motor and basket occupy inside the enclosure.' },

  // ── Driver: General ──
  { id: 'driver_manufacturer', aliases: ['manufacturer'], label: 'Manufacturer', pane: 'Driver: General', kind: 'text', unit: '', description: 'Manufacturer\nThe company that designed and made the driver.' },
  { id: 'driver_brand', aliases: ['brand'], label: 'Brand', pane: 'Driver: General', kind: 'text', unit: '', description: 'Brand\nThe trade name the driver is marketed under.' },
  { id: 'driver_model', aliases: ['model'], label: 'Model', pane: 'Driver: General', kind: 'text', unit: '', description: 'Model\nManufacturer model designation or part number.\nExamples:\nW5-1138SMF\nRS270-8 10" Reference Woofer 8 Ohm' },
  { id: 'driver_sku', aliases: ['sku'], label: 'Part Number', pane: 'Driver: General', kind: 'text', unit: '', description: 'Part Number (SKU)\nThe exact code from the datasheet.\nExamples:\nW5-1138SMF (Tang Band)\nRS270-8 (Dayton Audio)\n10PR-8 (GRS)\nSB13PFCR-00 (SB Acoustics)\n10FH520-4 (FaitalPRO)\nKappalite-3015 (Eminence)' },
  { id: 'driver_providedBy', aliases: ['providedBy'], label: 'Data provided by', pane: 'Driver: General', kind: 'text', unit: '', description: 'Data Attribution\nWho contributed or measured this parameter data.' },
  { id: 'driver_added', aliases: ['added'], label: 'Date added', pane: 'Driver: General', kind: 'date', unit: '', description: 'Date Added\nWhen this driver record was catalogued.' },
  { id: 'driver_comment', aliases: ['comment'], label: 'Comment', pane: 'Driver: General', kind: 'text', unit: '', description: 'Driver Notes\nFree-text engineering notes on this driver record.' },

  { id: 'driver_Znom_ohm', aliases: ['Znom_ohm', 'Znom'], label: 'Znom', pane: 'Driver: Parameters', kind: 'number', unit: 'ohm', precision: 0, min: 0, max: 64, description: 'Nominal Impedance (Znom)\nRated impedance class for amplifier matching — e.g. 4, 8 or 16 Ω.' },

  { id: 'driver_c_m_per_s', aliases: ['c_m_per_s', 'c'], label: 'c', pane: 'Driver: Advanced', kind: 'number', unit: 'm/s', unitGroup: 'velocity', precision: 2, min: 0, max: 1000, description: 'Reference Speed of Sound (c)\nSpeed of sound at this driver record\'s reference conditions.' },
  { id: 'driver_roo_kg_per_m3', aliases: ['roo_kg_per_m3', 'roo'], label: 'roo', pane: 'Driver: Advanced', kind: 'number', unit: 'kg/m³', unitGroup: 'density', precision: 5, min: 0, max: 10, description: 'Reference Air Density (roo)\nAir density at this driver record\'s reference conditions.' },

  // ── Box readouts ──
  { id: 'box_Resonance_hz', aliases: ['boxResonance'], label: 'Fsc / Fh', pane: 'Box', kind: 'number', unit: 'Hz', unitGroup: 'freq', precision: 2, min: 0, max: 20000, description: 'System Resonance Frequency (Fsc / Fh)\nThe driver\'s resonance once coupled to the enclosure.' },
  { id: 'box_RearResonance_hz', aliases: ['rearResonance', 'boxRearResonance'], label: 'Frc', pane: 'Box', kind: 'number', unit: 'Hz', unitGroup: 'freq', precision: 2, min: 0, max: 20000, description: 'Rear Chamber Resonance (Frc)\nSealed rear-chamber resonance in a 4th-order bandpass box (Frc = Fs·√(1 + Vas/Vb)).' },
  { id: 'box_Frc_hz', aliases: ['Frc'], label: 'Tuning freq (Frc)', pane: 'Box', kind: 'number', unit: 'Hz', unitGroup: 'freq', precision: 2, min: 0, max: 20000, description: 'Rear Chamber Tuning Frequency (Frc)\nTarget Helmholtz tuning for the vented rear chamber in a 6th-order bandpass or ABC box.' },

  // ============================ DRIVER PLACEMENT ============================
  {
    id: 'driver_nDrivers', aliases: ['nDrivers'], label: 'Num. of drivers', pane: 'Driver', kind: 'number', unit: '', precision: 0, min: 1, max: 64,
    description: 'Driver Count\nHow many drivers are active in the enclosure.',
  },
  { id: 'driver_ArrayWiring', aliases: ['wiring', 'arrayWiring'], label: 'Voice coil connection', pane: 'Driver', kind: 'enum', unit: '', options: ARRAY_WIRING_OPTIONS, description: 'Driver Array Wiring\nParallel or series — sets the total load impedance seen by the amplifier.' },
  { id: 'driver_VcTempRise_K', aliases: ['vcTempRise', 'driverVcTempRise'], label: 'Voice coil temp rise', pane: 'Driver', kind: 'number', unit: 'K', precision: 2, min: 0, max: 500, description: 'Voice Coil Temperature Rise\nHeating from electrical power dissipation (I²·Re).\nRaises Re and causes thermal power compression.' },
  { id: 'driver_AddedMass_g', aliases: ['driverAddedMass'], label: 'Added mass to cone', pane: 'Driver', kind: 'number', unit: 'g', precision: 5, min: 0, max: 5, description: 'Cone Added Mass (test)\nMass temporarily added to the cone to shift Fs, so Cms and Mms can be calculated.' },

  // ============================ FILTERS ============================
  { id: 'filter_Type', aliases: ['filterType'], label: 'Filter type', pane: 'Filters', kind: 'enum', unit: '', options: FILTER_TYPE_OPTIONS, description: 'Filter Type\nThe active filter\'s response shape — lowpass, highpass, Linkwitz transform, peaking EQ or shelf.' },
  { id: 'filter_Fc_hz', aliases: ['filterFc'], label: 'Cutoff / Center freq', pane: 'Filters', kind: 'number', unit: 'Hz', precision: 3, min: 1, max: 20000, description: 'Cutoff / Center Frequency\nCutoff or center frequency of the active filter.' },
  { id: 'filter_Q', aliases: ['filterQ'], label: 'Q', pane: 'Filters', kind: 'number', unit: '', precision: 3, min: 0.1, max: 100, description: 'Filter Quality Factor (Q)\nHow sharp the filter\'s resonance peak or its damping is.' },
  { id: 'filter_Gain_dB', aliases: ['filterGain'], label: 'Gain', pane: 'Filters', kind: 'number', unit: 'dB', precision: 3, min: -60, max: 60, description: 'Filter Gain\nBoost or cut applied by the filter or equalizer, in dB.' },
  { id: 'filter_Order', aliases: ['filterOrder'], label: 'Order', pane: 'Filters', kind: 'number', unit: '', precision: 3, min: 1, max: 8, description: 'Filter Order\nFilter steepness: 1st order = 6 dB/oct, 2nd = 12 dB/oct, 4th = 24 dB/oct.' },
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

/** Every integer a count field allows, as the option list its `<select>` renders — so a count
 *  select iterates the spec's own `min..max` and reads its choice back through `selectedOption`,
 *  the same way an enum select does. Throws on a spec without both bounds: a count select
 *  cannot guess its range. */
export function countOptions(id: string): readonly SelectorOption<number>[] {
  const spec = fieldById(id);
  if (!spec) throw new Error(`uiFields: no field "${id}" — add it to uiFields.ts`);
  if (spec.min === undefined || spec.max === undefined) {
    throw new Error(`uiFields: field "${id}" needs both min and max to list count options`);
  }
  const out: SelectorOption<number>[] = [];
  for (let n = spec.min; n <= spec.max; n++) out.push({value: n, label: String(n)});
  return out;
}
