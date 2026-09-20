import type {CellState} from '@openisd/design/winisd';
import type {BoxType} from '@openisd/design/engine';
import {MAX_SUPPORTED_TEMP_K, MIN_SUPPORTED_TEMP_K} from '@openisd/design/engine';
import type {OpenIsdFieldKey} from '@openisd/design/fields';
import {
  type SelectorOption,
  type UnitGroup,
  END_CORRECTION_OPTIONS,
  VENT_SHAPE_OPTIONS,
  VC_CONNECTION_OPTIONS,
} from '@openisd/design/fields';

/** Kind of field — only 'number' carries a `precision`. */
export type FieldKind = 'number' | 'enum' | 'text' | 'toggle' | 'date' | 'control';

/** Whether a field's value is supplied by the human or derived by the app. */
type Provenance = Exclude<CellState, 'not-available'>;

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
  /** Entered by the human, or Calculated by the app. */
  readonly provenance: Provenance;
  /** Box types the field applies to, or 'all' when independent. */
  readonly appliesTo: BoxType[] | 'all';
  /** Closed form derivation for calculated fields. */
  readonly formula?: string;
  /** Field ids this value is derived from. */
  readonly dependsOn?: string[];
  /** Selectable options for enum fields. */
  readonly options?: readonly SelectorOption[];
  /** Optional link to domain field key. */
  readonly domainKey?: OpenIsdFieldKey;
  /** Direct OO method handle for typed field resolution. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly handle?: (entity: any) => unknown;
  /** Description of what the field is and its acoustic function. */
  readonly description: string;
}

const UI_FIELD_SPECS: UIFieldSpec[] = [
  // ============================ BOX / ENCLOSURE ============================
  {
    id: 'Vb', label: 'Volume', pane: 'Box', kind: 'number', unit: 'l', unitGroup: 'volume', precision: 2, min: 0.0001, max: 100,
    provenance: 'entered', appliesTo: 'all',
    description: 'Net Enclosure Volume: Internal net air volume of the enclosure acting as the acoustic spring for the driver.',
  },
  {
    id: 'Vf', label: 'Front volume', pane: 'Box', kind: 'number', unit: 'l', precision: 2, min: 0.0001, max: 100,
    provenance: 'entered', appliesTo: ['bandpass4'],
    description: 'Front Chamber Volume: Net air volume of the front (vented) chamber in a bandpass enclosure.',
  },
  {
    id: 'Fb', label: 'Target Tuning Freq (Fb)', pane: 'Box', kind: 'number', unit: 'Hz', precision: 2, min: 0, max: 1000,
    provenance: 'entered', appliesTo: ['vented', 'bandpass4', 'box-passive-radiator'],
    description: 'Box Tuning Frequency: Helmholtz resonance frequency of the vented enclosure determined by port dimensions and box volume.',
  },

  // ============================ VENTS / PORTED ============================
  {
    id: 'ventShape', label: 'Vent shape', pane: 'Vents', kind: 'enum', unit: '',
    provenance: 'entered', appliesTo: ['vented', 'bandpass4'],
    options: VENT_SHAPE_OPTIONS,
    description: 'Vent Geometry: Selects between a circular tube (round) or rectangular duct (slotted) port.',
  },
  {
    id: 'ventD', label: 'Vent diameter', pane: 'Vents', kind: 'number', unit: 'cm', precision: 2, min: 0.001, max: 2,
    provenance: 'entered', appliesTo: ['vented', 'bandpass4'],
    description: 'Port Diameter: Internal diameter of a round port tube. Larger diameters reduce port air turbulence (choking) but require longer tubes.',
  },
  {
    id: 'ventW', label: 'Slot width', pane: 'Vents', kind: 'number', unit: 'cm', precision: 2, min: 0.001, max: 2,
    provenance: 'entered', appliesTo: ['vented', 'bandpass4'],
    description: 'Slot Port Width: Internal width of a rectangular slotted port.',
  },
  {
    id: 'ventH', label: 'Slot height', pane: 'Vents', kind: 'number', unit: 'cm', precision: 2, min: 0.001, max: 2,
    provenance: 'entered', appliesTo: ['vented', 'bandpass4'],
    description: 'Slot Port Height: Internal height of a rectangular slotted port.',
  },
  {
    id: 'ventL', label: 'Vent length', pane: 'Vents', kind: 'number', unit: 'cm', precision: 2, min: 0.001, max: 10,
    provenance: 'entered', appliesTo: ['vented', 'bandpass4'],
    description: 'Vent Length: Physical length of the port tube/duct. Longer ports lower the tuning frequency for a fixed volume.',
  },
  {
    id: 'endCorrection', label: 'End Correction', pane: 'Vents', kind: 'enum', unit: '',
    provenance: 'entered', appliesTo: ['vented', 'bandpass4'],
    options: END_CORRECTION_OPTIONS,
    description: 'End Correction Factor: Dimensionless factor accounting for acoustic air mass oscillating beyond the physical duct ends, extending effective acoustic port length depending on termination boundary geometry (free air vs flanged baffle).',
  },
  {
    id: 'ventCrossArea', label: 'Cross area', pane: 'Vents', kind: 'number', unit: 'm²', precision: 4, min: 0, max: 10,
    provenance: 'calculated', appliesTo: ['vented', 'bandpass4'],
    formula: 'π·(ventD/2)²', dependsOn: ['ventD'],
    description: 'Vent Cross-Sectional Area: Total internal cross-sectional area of the port.',
  },
  {
    id: 'portResonance', label: '1st port resonance', pane: 'Vents', kind: 'number', unit: 'Hz', precision: 2, min: 0, max: 20000,
    provenance: 'calculated', appliesTo: ['vented', 'bandpass4'],
    formula: 'c / (2·ventL)',
    dependsOn: ['ventL'],
    description: 'First Vent Pipe Resonance: Frequency of the lowest organ-pipe standing wave resonance inside the port duct (f = c / 2L). Standing wave peaks in the vent column cause acoustic output peaks and noise within or above the passband, limiting usable port bandwidth.',
  },

  // ============================ PASSIVE RADIATOR ============================
  {
    id: 'prSd', label: 'Sd', pane: 'PassiveRadiator', kind: 'number', unit: 'cm²', unitGroup: 'area', precision: 2, min: 0.0001, max: 10,
    provenance: 'entered', appliesTo: ['box-passive-radiator'], domainKey: 'Sd_m2',
    description: 'Passive Radiator Area: Effective radiating piston surface area of the passive radiator.',
  },
  {
    id: 'prXmax', label: 'Xmax', pane: 'PassiveRadiator', kind: 'number', unit: 'mm', unitGroup: 'length', precision: 2, min: 0, max: 0.5,
    provenance: 'entered', appliesTo: ['box-passive-radiator'], domainKey: 'Xmax_m',
    description: 'Passive Radiator Excursion Limit: Maximum peak linear cone displacement of the passive radiator diaphragm.',
  },
  {
    id: 'prNum', label: 'Num. of PRs', pane: 'PassiveRadiator', kind: 'number', unit: '', precision: 0, min: 1, max: 16,
    provenance: 'entered', appliesTo: ['box-passive-radiator'],
    description: 'Passive Radiator Count: Number of identical passive radiators installed in the enclosure.',
  },
  {
    id: 'prMadd', label: 'Added mass to cone', pane: 'PassiveRadiator', kind: 'number', unit: 'g', precision: 2, min: 0, max: 5,
    provenance: 'entered', appliesTo: ['box-passive-radiator'], domainKey: 'addedMass_kg',
    description: 'PR Added Mass: Additional ballast mass attached to the passive radiator cone to lower its tuning frequency.',
  },
  {
    id: 'Fp', label: 'Target tuning freq (Fp)', pane: 'PassiveRadiator', kind: 'number', unit: 'Hz', precision: 2, min: 1, max: 1000,
    provenance: 'entered', appliesTo: ['box-passive-radiator'],
    description: 'Passive Radiator System Tuning: Helmholtz tuning frequency achieved by the passive radiator and enclosure volume.',
  },
  {
    id: 'prVas', label: 'Vas', pane: 'PassiveRadiator', kind: 'number', unit: 'l', unitGroup: 'volume', precision: 2, min: 0.00001, max: 100,
    provenance: 'calculated', appliesTo: ['box-passive-radiator'], domainKey: 'Vas_m3',
    formula: 'Vas = Cms·Sd²·ρ·c²·1000', dependsOn: ['prCms', 'prSd'],
    description: 'PR Equivalent Compliance Volume: Volume of air having the same acoustic compliance as the passive radiator suspension.',
  },
  {
    id: 'prFs', label: 'Fpr', pane: 'PassiveRadiator', kind: 'number', unit: 'Hz', precision: 2, min: 1, max: 1000,
    provenance: 'calculated', appliesTo: ['box-passive-radiator'], domainKey: 'Fs_hz',
    formula: 'Fpr = 1/(2π·√(Mmd·Cms))', dependsOn: ['prMmd', 'prCms'],
    description: 'Unloaded PR Resonance: Fundamental free-air resonance frequency of the passive radiator without added mass or box coupling.',
  },
  {
    id: 'prQms', label: 'Qms', pane: 'PassiveRadiator', kind: 'number', unit: '', precision: 3, min: 0.1, max: 100,
    provenance: 'calculated', appliesTo: ['box-passive-radiator'], domainKey: 'Qms',
    formula: 'Qms = √(Mmd/Cms)/Rms', dependsOn: ['prMmd', 'prCms', 'prRms'],
    description: 'PR Mechanical Quality Factor: Quality factor representing mechanical suspension friction losses in the passive radiator.',
  },
  {
    id: 'prFsMass', label: 'Fpr (with added mass)', pane: 'PassiveRadiator', kind: 'number', unit: 'Hz', precision: 2, min: 0, max: 1000,
    provenance: 'calculated', appliesTo: ['box-passive-radiator'],
    formula: 'Fpr = 1/(2π·√((Mmd+Madd)·Cms))', dependsOn: ['prMmd', 'prMadd', 'prCms'],
    description: 'Mass-Loaded PR Resonance: Free-air resonance frequency of the passive radiator including added mass Madd.',
  },

  // ============================ SIGNAL ============================
  {
    id: 'Pin', label: 'System input power', pane: 'Signal', kind: 'number', unit: 'W', precision: 2, min: 0, max: 100000,
    provenance: 'entered', appliesTo: 'all',
    description: 'System Input Power: Total electrical power supplied to the loudspeaker system (Pin = V² / Re).',
  },
  {
    id: 'driveV', label: 'Driver input voltage (each)', pane: 'Signal', kind: 'number', unit: 'V', precision: 2, min: 0, max: 1000,
    provenance: 'calculated', appliesTo: 'all',
    formula: 'driveV = √(Pin · Re)', dependsOn: ['Pin', 'Re'],
    description: 'Driver Terminal Voltage: RMS input voltage applied across the driver voice coil terminals.',
  },
  {
    id: 'Rs', label: 'Series resistance', pane: 'Signal', kind: 'number', unit: 'ohm', precision: 3, min: 0, max: 1000,
    provenance: 'entered', appliesTo: 'all',
    description: 'Series Resistance: Combined amplifier output impedance, wiring, and crossover component resistance in series with the driver.',
  },
  {
    id: 'listenDistance', label: 'Distance', pane: 'Signal', kind: 'number', unit: 'm', precision: 3, min: 0, max: 100,
    provenance: 'entered', appliesTo: 'all',
    description: 'Listening Distance: On-axis distance from the loudspeaker to the listener for SPL calculations.',
  },
  {
    id: 'listenAngle', label: 'Angle', pane: 'Signal', kind: 'number', unit: 'rad', precision: 4, min: 0, max: 3.1416,
    provenance: 'entered', appliesTo: 'all',
    description: 'Off-Axis Angle: Angular offset from the main acoustic axis in radians.',
  },
  {
    id: 'genHz', label: 'Signal generator frequency', pane: 'Signal', kind: 'number', unit: 'Hz', precision: 2, min: 1, max: 20000,
    provenance: 'entered', appliesTo: 'all',
    description: 'Test Tone Frequency: Target frequency evaluated by the single-tone signal generator.',
  },

  // ============================ BOX LOSSES ============================
  {
    id: 'Ql', label: 'Leakage Ql', pane: 'Box losses', kind: 'number', unit: '', precision: 2, min: 0.1, max: 1000,
    provenance: 'entered', appliesTo: 'all',
    description: 'Enclosure Leakage Loss Q: Quality factor accounting for acoustic energy losses through cabinet seams and gaskets.',
  },
  {
    id: 'Qa', label: 'Absorption Qa', pane: 'Box losses', kind: 'number', unit: '', precision: 2, min: 0.1, max: 1000,
    provenance: 'entered', appliesTo: 'all',
    description: 'Enclosure Damping Loss Q: Quality factor accounting for acoustic energy absorption by internal damping fill.',
  },
  {
    id: 'Qp', label: 'Port Qp', pane: 'Box losses', kind: 'number', unit: '', precision: 2, min: 0.1, max: 1000,
    provenance: 'entered', appliesTo: ['vented', 'bandpass4'],
    description: 'Port Friction Loss Q: Quality factor representing air friction and viscous boundary losses inside the vent.',
  },

  // ============================ ADVANCED (ENVIRONMENT) ============================
  {
    id: 'advTemp', label: 'Temperature', pane: 'Advanced', kind: 'number', unit: 'K', precision: 2, min: MIN_SUPPORTED_TEMP_K, max: MAX_SUPPORTED_TEMP_K,
    provenance: 'entered', appliesTo: 'all',
    description: 'Ambient Temperature: Atmospheric temperature used to calculate speed of sound and air density.',
  },
  {
    id: 'advHumidity', label: 'Relative humidity', pane: 'Advanced', kind: 'number', unit: '%', precision: 2, min: 0, max: 100,
    provenance: 'entered', appliesTo: 'all',
    description: 'Relative Humidity: Atmospheric humidity percentage affecting sound speed and medium density.',
  },
  {
    id: 'advPressure', label: 'Air pressure', pane: 'Advanced', kind: 'number', unit: 'kPa', precision: 2, min: 1000, max: 200000,
    provenance: 'entered', appliesTo: 'all',
    description: 'Air Pressure: Atmospheric barometric pressure influencing medium density and acoustic impedance.',
  },
  {
    id: 'advSoundVelocity', label: 'Sound velocity', pane: 'Advanced', kind: 'number', unit: 'm/s', precision: 2, min: 0, max: 1000,
    provenance: 'calculated', appliesTo: 'all',
    formula: 'c = √(γ·p/ρ), γ = 1.4', dependsOn: ['advTemp', 'advHumidity', 'advPressure'],
    description: 'Speed of Sound: Velocity of acoustic wave propagation through air under ambient conditions.',
  },
  {
    id: 'advAirDensity', label: 'Air density', pane: 'Advanced', kind: 'number', unit: 'kg/m³', precision: 5, min: 0, max: 10,
    provenance: 'calculated', appliesTo: 'all',
    formula: 'ρ = p·Ma/(R·T)·[1 − xv(1 − Mv/Ma)]',
    dependsOn: ['advTemp', 'advHumidity', 'advPressure'],
    description: 'Air Density: Mass density of air derived from temperature, humidity, and barometric pressure.',
  },

  // ---- Advanced pane simulation options ----
  {
    id: 'simVcInductance', label: 'Simulate voice coil inductance', pane: 'Advanced', kind: 'toggle', unit: '',
    provenance: 'entered', appliesTo: 'all',
    description: 'Simulate Voice Coil Inductance: Includes voice coil inductance (Le) in acoustic output calculations instead of impedance plots alone.',
  },
  {
    id: 'forceFlatResponse', label: 'Force flat response', pane: 'Advanced', kind: 'toggle', unit: '',
    provenance: 'entered', appliesTo: 'all',
    description: 'Force Flat Response: Applies auto-equalization to reveal excursion and port velocity demands required for a flat passband response.',
  },
  {
    id: 'tlPortModel', label: 'Use "transmission line"-model for port simulation', pane: 'Advanced', kind: 'toggle', unit: '',
    provenance: 'entered', appliesTo: ['vented', 'bandpass4'],
    description: 'Transmission Line Port Model: Models the vent as a distributed transmission line, incorporating internal organ-pipe resonances into response curves.',
  },
  {
    id: 'rgAtDriverSide', label: 'Rg is at driver side', pane: 'Advanced', kind: 'toggle', unit: '',
    provenance: 'entered', appliesTo: 'all',
    description: 'Rg Placement: Applies series resistance Rg individually to each driver rather than globally at the main amplifier output.',
  },
  {
    id: 'splXmaxLimited', label: 'SPL graph is Xmax limited', pane: 'Advanced', kind: 'toggle', unit: '',
    provenance: 'entered', appliesTo: 'all',
    description: 'Xmax Limited SPL: Clamps the SPL frequency response graph whenever cone displacement exceeds maximum linear excursion Xmax.',
  },
  {
    id: 'useWinisdAirModel', label: 'Use WinISD air model', pane: 'Advanced', kind: 'toggle', unit: '',
    provenance: 'entered', appliesTo: 'all',
    description: 'Air Model Selection: Toggles between legacy WinISD air equations and standardized CIPM moist air calculations.',
  },

  // ============================ DRIVER EDITOR — T/S (Parameters tab) ============================
  {
    id: 'Fs_hz', label: 'Fs', pane: 'Driver: Parameters', kind: 'number', unit: 'Hz', precision: 2, min: 1, max: 5000,
    provenance: 'entered', appliesTo: 'all', domainKey: 'Fs_hz',
    handle: (driver) => driver?.spec?.ts?.Fs_hz ?? null,
    description: 'Driver Resonant Frequency: Free-air fundamental resonance frequency of the driver moving assembly and suspension.',
  },
  {
    id: 'Qts', label: 'Qts', pane: 'Driver: Parameters', kind: 'number', unit: '', precision: 3, min: 0, max: 5,
    provenance: 'calculated', appliesTo: 'all', domainKey: 'Qts',
    handle: (driver) => driver?.spec?.ts?.Qts ?? null,
    formula: 'Qts = Qes·Qms/(Qes+Qms)', dependsOn: ['Qes', 'Qms'],
    description: 'Total Quality Factor: Total damping factor of the driver at Fs, combining electrical (Qes) and mechanical (Qms) damping.',
  },
  {
    id: 'Qes', label: 'Qes', pane: 'Driver: Parameters', kind: 'number', unit: '', precision: 3, min: 0, max: 5,
    provenance: 'entered', appliesTo: 'all', domainKey: 'Qes',
    handle: (driver) => driver?.spec?.ts?.Qes ?? null,
    description: 'Electrical Quality Factor: Quality factor measuring electrical damping generated by back-EMF in the voice coil at Fs.',
  },
  {
    id: 'Qms', label: 'Qms', pane: 'Driver: Parameters', kind: 'number', unit: '', precision: 3, min: 0, max: 50,
    provenance: 'entered', appliesTo: 'all', domainKey: 'Qms',
    handle: (driver) => driver?.spec?.ts?.Qms ?? null,
    description: 'Mechanical Quality Factor: Quality factor measuring mechanical friction damping losses in the surround and spider at Fs.',
  },
  {
    id: 'Vas_m3', label: 'Vas', pane: 'Driver: Parameters', kind: 'number', unit: 'l', precision: 2, min: 0, max: 100,
    provenance: 'entered', appliesTo: 'all', domainKey: 'Vas_m3',
    handle: (driver) => driver?.spec?.ts?.Vas_m3 ?? null,
    description: 'Equivalent Compliance Volume: Volume of air whose acoustic compliance equals the mechanical compliance of the driver suspension.',
  },
  {
    id: 'Re_ohm', label: 'Re', pane: 'Driver: Parameters', kind: 'number', unit: 'ohm', precision: 3, min: 0.01, max: 1000,
    provenance: 'entered', appliesTo: 'all', domainKey: 'Re_ohm',
    handle: (driver) => driver?.spec?.ts?.Re_ohm ?? null,
    description: 'DC Voice Coil Resistance: Direct-current electrical resistance measured across the driver voice coil terminals.',
  },
  {
    id: 'Le_H', label: 'Le', pane: 'Driver: Parameters', kind: 'number', unit: 'mH', precision: 3, min: 0, max: 0.1,
    provenance: 'entered', appliesTo: 'all', domainKey: 'Le_H',
    handle: (driver) => driver?.spec?.ts?.Le_H ?? null,
    description: 'Voice Coil Inductance: Self-inductance of the voice coil causing high-frequency electrical impedance rise.',
  },
  {
    id: 'Mms_kg', label: 'Mms', pane: 'Driver: Parameters', kind: 'number', unit: 'g', precision: 2, min: 0, max: 10,
    provenance: 'calculated', appliesTo: 'all', domainKey: 'Mms_kg',
    handle: (driver) => driver?.spec?.ts?.Mms_kg ?? null,
    formula: 'Mms = 1/((2π·Fs)²·Cms)', dependsOn: ['Fs', 'Cms'],
    description: 'Moving Mass: Total mass of the driver diaphragm, voice coil, former, and air mass loading.',
  },
  {
    id: 'Sd_m2', label: 'Sd', pane: 'Driver: Parameters', kind: 'number', unit: 'cm²', precision: 2, min: 0.0001, max: 10,
    provenance: 'entered', appliesTo: 'all', domainKey: 'Sd_m2',
    handle: (driver) => driver?.spec?.ts?.Sd_m2 ?? null,
    description: 'Effective Diaphragm Area: Effective radiating piston area of the driver cone and inner surround.',
  },
  {
    id: 'Xmax_m', label: 'Xmax', pane: 'Driver: Parameters', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 0.5,
    provenance: 'entered', appliesTo: 'all', domainKey: 'Xmax_m',
    handle: (driver) => driver?.spec?.ts?.Xmax_m ?? null,
    description: 'Peak Linear Excursion: Peak one-way linear cone displacement where voice coil coverage remains inside the magnetic gap.',
  },
  {
    id: 'Pe_W', label: 'Pe', pane: 'Driver: Parameters', kind: 'number', unit: 'W', precision: 2, min: 0, max: 100000,
    provenance: 'entered', appliesTo: 'all', domainKey: 'Pe_W',
    handle: (driver) => driver?.spec?.ts?.Pe_W ?? null,
    description: 'Thermal Power Handling: Maximum continuous electrical power input the voice coil can dissipate without thermal failure.',
  },
  {
    id: 'BL_Tm', label: 'BL', pane: 'Driver: Parameters', kind: 'number', unit: 'Tm', precision: 3, min: 0, max: 1000,
    provenance: 'calculated', appliesTo: 'all', domainKey: 'BL_Tm',
    handle: (driver) => driver?.spec?.ts?.BL_Tm ?? null,
    formula: 'Bl = √(2π·Fs·Mms·Re/Qes)', dependsOn: ['Fs', 'Mms', 'Re', 'Qes'],
    description: 'Motor Force Factor: Product of magnetic gap flux density B and voice coil wire length L, measuring motor coupling strength.',
  },
  {
    id: 'Cms_m_per_N', label: 'Cms', pane: 'Driver: Parameters', kind: 'number', unit: 'mm/N', precision: 4, min: 0, max: 0.1,
    provenance: 'calculated', appliesTo: 'all', domainKey: 'Cms_m_per_N',
    handle: (driver) => driver?.spec?.ts?.Cms_m_per_N ?? null,
    formula: 'Cms = Vas/(ρ·c²·Sd²)', dependsOn: ['Vas', 'Sd'],
    description: 'Mechanical Compliance: Mechanical flexibility (spring rate inverse) of the suspension system.',
  },
  {
    id: 'Rms_kg_per_s', label: 'Rms', pane: 'Driver: Parameters', kind: 'number', unit: 'Ns/m', unitGroup: 'resistance', precision: 4, min: 0, max: 1000,
    provenance: 'calculated', appliesTo: 'all', domainKey: 'Rms_kg_per_s',
    handle: (driver) => driver?.spec?.ts?.Rms_kg_per_s ?? null,
    formula: 'Rms = 2π·Fs·Mms/Qms', dependsOn: ['Fs', 'Mms', 'Qms'],
    description: 'Mechanical Resistance: Mechanical friction loss resistance of the driver suspension system.',
  },

  // ============================ DRIVER EDITOR — reference-only ============================
  { id: 'Dd_m', label: 'Dd', pane: 'Driver: Parameters', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 2, provenance: 'entered', appliesTo: 'all', domainKey: 'Dia_m', description: 'Effective Diaphragm Diameter: Effective piston diameter of the cone, interchangeable with Sd (Sd = π · (Dd / 2)²).' },
  { id: 'fLe_hz', label: 'fLe', pane: 'Driver: Parameters', kind: 'number', unit: 'kHz', precision: 5, min: 0, max: 100000, provenance: 'entered', appliesTo: 'all', domainKey: 'fLe_hz', description: 'Semi-Inductance Reference Frequency: Frequency at which voice coil semi-inductance parameters Le and KLe were measured.' },
  { id: 'KLe_H_sqrtHz', label: 'KLe', pane: 'Driver: Parameters', kind: 'number', unit: 'H·√Hz', precision: 6, min: 0, max: 10, provenance: 'entered', appliesTo: 'all', domainKey: 'KLe_H_sqrtHz', description: 'Semi-Inductance Coefficient: Semi-inductance loss factor accounting for eddy currents and high-frequency coil losses.' },
  { id: 'Hc_m', label: 'Hc', pane: 'Driver: Parameters', kind: 'number', unit: 'm', precision: 3, min: 0, max: 1, provenance: 'entered', appliesTo: 'all', domainKey: 'Hc_m', description: 'Voice Coil Height: Winding height of the voice coil wire on the former.' },
  { id: 'Hg_m', label: 'Hg', pane: 'Driver: Parameters', kind: 'number', unit: 'm', precision: 3, min: 0, max: 1, provenance: 'entered', appliesTo: 'all', domainKey: 'Hg_m', description: 'Magnetic Gap Height: Physical thickness of the top plate defining the magnetic gap height.' },
  { id: 'Vd_m3', label: 'Vd', pane: 'Driver: Parameters', kind: 'number', unit: 'cm³', precision: 0, min: 0, max: 100000, provenance: 'calculated', appliesTo: 'all', domainKey: 'Vd_m3', description: 'Peak Displacement Volume: Maximum volume of air displaced by the cone at full linear excursion Xmax (Vd = Sd × Xmax).' },
  { id: 'Xlim_m', label: 'Xlim', pane: 'Driver: Parameters', kind: 'number', unit: 'm', precision: 3, min: 0, max: 1, provenance: 'entered', appliesTo: 'all', domainKey: 'Xlim_m', description: 'Mechanical Excursion Limit: Absolute physical displacement limit before mechanical damage or bottoming occurs.' },
  { id: 'no', label: 'η₀', pane: 'Driver: Parameters', kind: 'number', unit: '%', unitGroup: 'percent', precision: 4, min: 0, max: 100, provenance: 'calculated', appliesTo: 'all', domainKey: 'no', description: 'Reference Efficiency: How effectively a speaker converts electrical power into acoustic sound power in its passband (η₀ = P_acc / P_elec × 100%).' },
  { id: 'USPL_dB', label: 'USPL', pane: 'Driver: Parameters', kind: 'number', unit: 'dB', precision: 2, min: 0, max: 200, provenance: 'calculated', appliesTo: 'all', domainKey: 'USPL_dB', formula: 'USPL = SPL + 10·log₁₀(8/Re)', dependsOn: ['SPL', 'Re'], description: 'Voltage Sensitivity: Sound pressure level at 1 meter produced by a standard 2.83 V RMS input voltage.' },
  { id: 'SPL_dB', label: 'SPL', pane: 'Driver: Parameters', kind: 'number', unit: 'dB', precision: 2, min: 0, max: 200, provenance: 'calculated', appliesTo: 'all', domainKey: 'SPL_dB', description: 'Power Sensitivity: Sound pressure level at 1 meter produced by a 1 Watt electrical power input.' },
  { id: 'numVC', label: 'Voicecoils', pane: 'Driver: Parameters', kind: 'number', unit: '', precision: 0, min: 1, max: 4, provenance: 'entered', appliesTo: 'all', domainKey: 'numVC', description: 'Voice Coil Count: Number of independent voice coil windings on the driver motor assembly.' },
  { id: 'VCCon', label: 'Connection', pane: 'Driver: Parameters', kind: 'enum', unit: '', provenance: 'entered', appliesTo: 'all', options: VC_CONNECTION_OPTIONS, domainKey: 'VCCon', description: 'Voice Coil Wiring: Wiring configuration (series or parallel) for multi-voice-coil drivers determining total terminal resistance Re and BL.' },
  { id: 'alfaVC_per_K', label: 'AlfaVC', pane: 'Driver: Advanced', kind: 'number', unit: '1000/K', precision: 4, min: 0, max: 0.1, provenance: 'entered', appliesTo: 'all', domainKey: 'alfaVC_per_K', description: 'Voice Coil Temp Coefficient: Thermal resistance coefficient of voice coil wire, determining resistance rise per degree of heating.' },
  { id: 'Rt_K_per_W', label: 'R(t)', pane: 'Driver: Advanced', kind: 'number', unit: 'K/W', precision: 5, min: 0, max: 1000, provenance: 'entered', appliesTo: 'all', description: 'Thermal Resistance: Thermal resistance from voice coil to magnet assembly and ambient air.' },
  { id: 'Ct_J_per_K', label: 'C(t)', pane: 'Driver: Advanced', kind: 'number', unit: 'J/K', precision: 5, min: 0, max: 10000, provenance: 'entered', appliesTo: 'all', description: 'Thermal Capacitance: Heat storage capacity of the voice coil and motor structure.' },
  { id: 'EBP_hz', label: 'EBP', pane: 'Driver: Advanced', kind: 'number', unit: 'Hz', precision: 2, min: 0, max: 1000, provenance: 'calculated', appliesTo: 'all', domainKey: 'EBP_hz', formula: 'EBP = Fs/Qes', dependsOn: ['Fs', 'Qes'], description: 'Efficiency Bandwidth Product: Ratio of Fs to Qes (Fs / Qes); indicates enclosure suitability (EBP < 50 favours sealed, > 90 favours vented).' },
  { id: 'SPLmaxLF_dB', label: 'SPLmaxLF', pane: 'Driver: Advanced', kind: 'number', unit: 'dB', precision: 2, min: 0, max: 200, provenance: 'calculated', appliesTo: 'all', domainKey: 'SPLmaxLF_dB', formula: 'SPLmaxLF = 20·log₁₀(ρ₀·(2π·20)²·Vd / (2π√2) / P0)', dependsOn: ['Vd'], description: 'Low Frequency Excursion Limit SPL: Theoretical maximum sound pressure level at 20 Hz limited strictly by peak diaphragm excursion Xmax.' },
  { id: 'SPLmax_dB', label: 'SPLmax', pane: 'Driver: Advanced', kind: 'number', unit: 'dB', precision: 2, min: 0, max: 200, provenance: 'calculated', appliesTo: 'all', domainKey: 'SPLmax_dB', formula: 'SPLmax = SPL + 10·log₁₀(Pe) − 3', dependsOn: ['SPL', 'Pe'], description: 'Thermally Limited Max SPL: Maximum acoustic sound pressure level when driven at full thermal power rating Pe.' },
  { id: 'Rme_kg_per_s', label: 'Rme', pane: 'Driver: Advanced', kind: 'number', unit: 'Ns/m', unitGroup: 'resistance', precision: 5, min: 0, max: 1000, provenance: 'calculated', appliesTo: 'all', domainKey: 'Rme_kg_per_s', formula: 'Rme = 2π·Fs·Mms/Qes (= Bl²/Re)', dependsOn: ['Fs', 'Mms', 'Qes'], description: 'Motional Resistance at Resonance: Electromagnetic damping resistance generated by back-EMF at resonance.' },
  { id: 'gamma_m_per_s2_A', label: 'gamma', pane: 'Driver: Advanced', kind: 'number', unit: 'N/(A·kg)', precision: 5, min: 0, max: 100000, provenance: 'calculated', appliesTo: 'all', domainKey: 'gamma_m_per_s2_A', formula: 'gamma = Bl/Mms', dependsOn: ['Bl', 'Mms'], description: 'Acceleration Factor: Ratio of motor force BL to moving mass Mms, measuring initial cone acceleration per ampere.' },
  { id: 'Mpow_N_per_sqrtW', label: 'Mpow', pane: 'Driver: Advanced', kind: 'number', unit: 'N/√W', precision: 5, min: 0, max: 1000, provenance: 'calculated', appliesTo: 'all', domainKey: 'Mpow_N_per_sqrtW', formula: 'Mpow = √Rme (= Bl/√Re)', dependsOn: ['Rme'], description: 'Power-Normalized Motor Force: Motor force produced per square root of input power (BL / √Re).' },
  { id: 'Mcost_kg_per_s', label: 'Mcost', pane: 'Driver: Advanced', kind: 'number', unit: 'kg/s', unitGroup: 'resistance', precision: 5, min: 0, max: 1000, provenance: 'calculated', appliesTo: 'all', domainKey: 'Mcost_kg_per_s', formula: 'Mcost = Rme·(1 + Xmax/min(Hc, Hg))', dependsOn: ['Rme', 'Xmax', 'Hc', 'Hg'], description: 'Motor Figure of Merit: Dynamic electromagnetic coupling efficiency accounting for gap geometry and displacement.' },
  { id: 'Gloss', label: 'Gloss', pane: 'Driver: Advanced', kind: 'number', unit: '%', unitGroup: 'percent', precision: 4, min: 0, max: 100, provenance: 'calculated', appliesTo: 'all', domainKey: 'Gloss', formula: 'Gloss = g/((2π·Fs)²·Xmax), g = 9.80665', dependsOn: ['Fs', 'Xmax'], description: 'Gravity Sag Percentage: Percentage of peak excursion Xmax consumed by cone displacement under gravity when mounted horizontally.' },
  { id: 'Thick_m', label: 'Basket Plate Thickness (Thick)', pane: 'Driver: Dimensions', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 0.3, provenance: 'entered', appliesTo: 'all', description: 'Basket Flange Thickness: Frame flange plate thickness at the mounting boundary.' },
  { id: 'Depth_m', label: 'Driver Depth (Depth)', pane: 'Driver: Dimensions', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 5, provenance: 'entered', appliesTo: 'all', description: 'Overall Driver Depth: Total physical depth of the driver from mounting flange to rear magnet pole plate.' },
  { id: 'MagDepth_m', label: 'Magnet Depth', pane: 'Driver: Dimensions', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 5, provenance: 'entered', appliesTo: 'all', description: 'Magnet Assembly Depth: Physical thickness of the rear magnet assembly.' },
  { id: 'Magnet_m', label: 'Magnet Diameter (Magnet)', pane: 'Driver: Dimensions', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 5, provenance: 'entered', appliesTo: 'all', description: 'Magnet Diameter: Outer diameter of the motor magnet structure.' },
  { id: 'Basket_m', label: 'Basket Diameter (Basket)', pane: 'Driver: Dimensions', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 5, provenance: 'entered', appliesTo: 'all', description: 'Basket Diameter: Outer frame chassis diameter.' },
  { id: 'Outer_m', label: 'Outer Diameter (Outer)', pane: 'Driver: Dimensions', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 5, provenance: 'entered', appliesTo: 'all', description: 'Outer Mounting Diameter: Overall diameter of the front mounting flange.' },
  { id: 'Vcd_m', label: 'Voice Coil Dia (Vcd)', pane: 'Driver: Dimensions', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 1, provenance: 'entered', appliesTo: 'all', description: 'Voice Coil Diameter: Former diameter of the voice coil winding.' },
  { id: 'DVol_m3', label: 'Driver Displacement Volume (DVol)', pane: 'Driver: Dimensions', kind: 'number', unit: 'cm³', precision: 2, min: 0, max: 1, provenance: 'entered', appliesTo: 'all', description: 'Driver Displacement Volume: Volume occupied by the driver motor and basket inside the enclosure.' },

  // ── Driver: General ──
  { id: 'manufacturer', label: 'Manufacturer', pane: 'Driver: General', kind: 'text', unit: '', provenance: 'entered', appliesTo: 'all', description: 'Manufacturer: Company or organization that designed and manufactured the driver.' },
  { id: 'brand', label: 'Brand', pane: 'Driver: General', kind: 'text', unit: '', provenance: 'entered', appliesTo: 'all', description: 'Brand: Trade brand name under which the driver is marketed.' },
  { id: 'model', label: 'Model', pane: 'Driver: General', kind: 'text', unit: '', provenance: 'entered', appliesTo: 'all', description: 'Model: Manufacturer model designation or part number.' },
  { id: 'providedBy', label: 'Data provided by', pane: 'Driver: General', kind: 'text', unit: '', provenance: 'entered', appliesTo: 'all', description: 'Data Attribution: Source contributor or measurement laboratory providing the parameter data.' },
  { id: 'added', label: 'Date added', pane: 'Driver: General', kind: 'date', unit: '', provenance: 'entered', appliesTo: 'all', description: 'Date Added: Date when the driver parameter record was cataloged.' },
  { id: 'comment', label: 'Comment', pane: 'Driver: General', kind: 'text', unit: '', provenance: 'entered', appliesTo: 'all', description: 'Driver Notes: Free-text engineering notes and comments associated with the driver record.' },

  { id: 'Znom_ohm', label: 'Znom', pane: 'Driver: Parameters', kind: 'number', unit: 'ohm', precision: 0, min: 0, max: 64, provenance: 'entered', appliesTo: 'all', domainKey: 'Znom_ohm', description: 'Nominal Impedance: Rated speaker impedance classification (e.g. 4, 8, or 16 ohms) for amplifier matching.' },

  { id: 'c_m_per_s', label: 'c', pane: 'Driver: Advanced', kind: 'number', unit: 'm/s', unitGroup: 'velocity', precision: 2, min: 0, max: 1000, provenance: 'calculated', appliesTo: 'all', description: 'Reference Speed of Sound: Velocity of acoustic propagation at reference environmental conditions.' },
  { id: 'roo_kg_per_m3', label: 'roo', pane: 'Driver: Advanced', kind: 'number', unit: 'kg/m³', unitGroup: 'density', precision: 5, min: 0, max: 10, provenance: 'calculated', appliesTo: 'all', description: 'Reference Air Density: Atmospheric mass density at reference environmental conditions.' },

  // ── Box readouts ──
  { id: 'boxResonance', label: 'Fsc / Fh', pane: 'Box', kind: 'number', unit: 'Hz', unitGroup: 'freq', precision: 2, min: 0, max: 20000, provenance: 'calculated', appliesTo: 'all', description: 'System Resonance Frequency: Effective total resonance frequency of the driver coupled to the enclosure.' },
  { id: 'rearResonance', label: 'Frc', pane: 'Box', kind: 'number', unit: 'Hz', unitGroup: 'freq', precision: 2, min: 0, max: 20000, provenance: 'calculated', appliesTo: ['bandpass4'], description: 'Rear Chamber Resonance: Sealed rear-chamber resonance frequency in a 4th-order bandpass enclosure (Frc = Fs × √(1 + Vas/Vb)).' },
  { id: 'Frc', label: 'Tuning freq (Frc)', pane: 'Box', kind: 'number', unit: 'Hz', unitGroup: 'freq', precision: 2, min: 0, max: 20000, provenance: 'entered', appliesTo: ['bandpass6', 'abc'], description: 'Rear Chamber Tuning Frequency: Target Helmholtz tuning frequency for the vented rear chamber in 6th-order bandpass and ABC enclosures.' },

  // ============================ DRIVER PLACEMENT ============================
  {
    id: 'nDrivers', label: 'Num. of drivers', pane: 'Driver', kind: 'number', unit: '', precision: 0, min: 1, max: 64,
    provenance: 'entered', appliesTo: 'all',
    description: 'Driver Count: Total number of active drivers operating in the enclosure system.',
  },
  { id: 'vcTempRise', label: 'Voice coil temp rise', pane: 'Driver', kind: 'number', unit: 'K', precision: 2, min: 0, max: 500, provenance: 'entered', appliesTo: 'all', description: 'Voice Coil Temp Rise: Voice coil heating caused by electrical power dissipation (I² Re), increasing coil resistance Re and inducing thermal power compression.' },
  { id: 'driverAddedMass', label: 'Added mass to cone', pane: 'Driver', kind: 'number', unit: 'g', precision: 5, min: 0, max: 5, provenance: 'entered', appliesTo: 'all', description: 'Cone Added Mass: Test mass temporarily added to the cone to shift resonant frequency (Fs), allowing calculation of suspension compliance (Cms) and moving mass (Mms).' },

  // ============================ FILTERS ============================
  { id: 'filterFc', label: 'Cutoff / Center freq', pane: 'Filters', kind: 'number', unit: 'Hz', precision: 3, min: 1, max: 20000, provenance: 'entered', appliesTo: 'all', description: 'Cutoff / Center Frequency: Cutoff or center frequency of the active signal filter.' },
  { id: 'filterQ', label: 'Q', pane: 'Filters', kind: 'number', unit: '', precision: 3, min: 0.1, max: 100, provenance: 'entered', appliesTo: 'all', description: 'Filter Quality Factor: Quality factor determining resonance peak sharpness or damping of the filter.' },
  { id: 'filterGain', label: 'Gain', pane: 'Filters', kind: 'number', unit: 'dB', precision: 3, min: -60, max: 60, provenance: 'entered', appliesTo: 'all', description: 'Filter Gain: Boost or attenuation gain applied by the equalizer or filter in dB.' },
  { id: 'filterOrder', label: 'Order', pane: 'Filters', kind: 'number', unit: '', precision: 3, min: 1, max: 8, provenance: 'entered', appliesTo: 'all', description: 'Filter Order: Filter steepness order (e.g. 1st order 6 dB/oct, 2nd order 12 dB/oct, 4th order 24 dB/oct).' },
];

const UI_FIELDS_BY_ID = new Map<string, UIFieldSpec>(UI_FIELD_SPECS.map((f) => [f.id, f]));

/** All registered field specs (read-only view). */
export const fieldSpecs: readonly UIFieldSpec[] = UI_FIELD_SPECS;
export { UI_FIELD_SPECS };

export function fieldById(id: string): UIFieldSpec | undefined {
  return UI_FIELDS_BY_ID.get(id);
}

export function fieldHelp(id: string): string {
  return fieldById(id)?.description ?? '';
}

export function precision(id: string): number {
  const spec = UI_FIELDS_BY_ID.get(id);
  if (!spec) throw new Error(`uiFields: no field "${id}" — add it to uiFields.ts`);
  if (spec.precision === undefined) throw new Error(`uiFields: field "${id}" is ${spec.kind}, has no precision`);
  return spec.precision;
}

export function limits(id: string): { min?: number; max?: number } {
  const spec = UI_FIELDS_BY_ID.get(id);
  if (!spec) throw new Error(`uiFields: no field "${id}" — add it to uiFields.ts`);
  return { min: spec.min, max: spec.max };
}
