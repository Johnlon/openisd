import type { BoxType } from '@openisd/engine';

/**
 * Field registry — the single, canonical data model for every field OpenISD shows (and every
 * field WinISD shows that OpenISD may model later). It is the SSOT that other layers refer
 * back to: the UI reads `precision(id)` / `limits(id)`; data-quality (DQ) checks and UI design
 * cite the same description, unit, derivation (`formula`), dependencies (`dependsOn`), and
 * sanity bounds (`min`/`max`).
 *
 * Coverage is deliberately COMPLETE — every field on the WinISD 0.7.0.950 screens
 * (docs/winisd/info/*.md) is catalogued, whether or not OpenISD models it:
 *   - `modeled: true`  — OpenISD renders/computes this; its `precision`/`unit` are OpenISD's
 *     (a skin binds `NumInput :precision="precision(id)"`). Where OpenISD uses a DIFFERENT unit
 *     than WinISD, the dp is unit-ADJUSTED to keep WinISD's resolution — noted in `description`.
 *   - `modeled: false` — WinISD-only reference field; recorded for parity/DQ/roadmap. Its
 *     `precision`/`unit` are WinISD's, as documentation. No skin binds to it yet.
 *
 * Precision is the fixed number of DECIMAL PLACES a numeric field always shows (WinISD
 * convention). dp evidence + the per-field screenshot source live in docs/winisd/INPUT_PARITY.md.
 *
 * Why CODE not Markdown: the UI imports `precision(id)` and tests import the registry to assert
 * conformance — a prose table can do neither, so it drifts.
 */

/** Kind of field — only 'number' carries a `precision`. */
export type FieldKind = 'number' | 'enum' | 'text' | 'toggle' | 'date' | 'control';
/** Whether a field's value is supplied by the human or derived by the app. */
export type Provenance = 'entered' | 'calculated';

export interface FieldSpec {
  /** Stable field id — the key the UI and tests reference. */
  id: string;
  /** Human label as shown in the UI (matches the WinISD screenshots). */
  label: string;
  /** Which WinISD/OpenISD pane the field lives on (Box, Vents, PR, Signal, Advanced, Project,
   *  Driver: General/Parameters/Advanced/Dimensions, Filters, Options). */
  pane: string;
  /** Field kind — number / enum / text / toggle / date / control. */
  kind: FieldKind;
  /** Display unit symbol, or '' for dimensionless (e.g. Q). For `modeled` fields this is
   *  OpenISD's unit (which may differ from WinISD's). */
  unit: string;
  /** Fixed decimal places a numeric field always shows. Present for kind==='number' only. */
  precision?: number;
  /** Sanity lower bound for entry; omitted where a field may legitimately be any real. */
  min?: number;
  /** Sanity upper bound — a plausibility ceiling for DQ/validation, not a hard physical law.
   *  Omitted where no meaningful ceiling applies. */
  max?: number;
  /** Entered by the human, or Calculated by the app. */
  provenance: Provenance;
  /** Does OpenISD render/compute this field today? false = WinISD-only reference/roadmap. */
  modeled: boolean;
  /** Box types the field applies to, or 'all' when it is box-type-independent. */
  appliesTo: BoxType[] | 'all';
  /** For calculated fields: the closed form (derivation), for documentation and traceability. */
  formula?: string;
  /** For calculated fields: the field ids this value is derived from (graph edges). */
  dependsOn?: string[];
  /** For enum fields: the selectable options. */
  options?: string[];
  /** One-line description of what the field is / why it matters. */
  description: string;
}

const FIELDS: FieldSpec[] = [
  // ============================ BOX / ENCLOSURE ============================
  {
    id: 'Vb', label: 'Volume', pane: 'Box', kind: 'number', unit: 'l', precision: 2, min: 0, max: 100000,
    provenance: 'entered', modeled: true, appliesTo: 'all',
    description: 'Net internal enclosure volume (rear chamber for bandpass). WinISD shows 2 dp.',
  },
  {
    id: 'Vf', label: 'Front volume', pane: 'Box', kind: 'number', unit: 'l', precision: 2, min: 0, max: 100000,
    provenance: 'entered', modeled: true, appliesTo: ['bandpass4'],
    description: 'Front (sealed/vented) chamber volume of a bandpass enclosure.',
  },
  {
    id: 'Fb', label: 'Fh (tuning frequency)', pane: 'Box', kind: 'number', unit: 'Hz', precision: 2, min: 0, max: 1000,
    provenance: 'calculated', modeled: true, appliesTo: ['vented', 'bandpass4', 'pr'],
    formula: 'Helmholtz tuning from box volume + port/PR', dependsOn: ['Vb', 'ventD', 'ventL'],
    description: 'Box tuning frequency (WinISD "Fh"). WinISD shows 2 dp (e.g. 40.25 Hz).',
  },

  // ============================ VENTS / PORTED ============================
  {
    id: 'ventD', label: 'Vent diameter', pane: 'Vents', kind: 'number', unit: 'cm', precision: 2, min: 0, max: 200,
    provenance: 'entered', modeled: true, appliesTo: ['vented', 'bandpass4'],
    description: 'Circular port diameter; feeds the tuning solver via port area. WinISD 2 dp (10.20 cm).',
  },
  {
    id: 'ventL', label: 'Vent length', pane: 'Vents', kind: 'number', unit: 'cm', precision: 1, min: 0, max: 1000,
    provenance: 'entered', modeled: true, appliesTo: ['vented', 'bandpass4'],
    description: 'Port length; with diameter sets Fb. OpenISD enters it in cm (editable) — WinISD derives it in m; 1 dp cm keeps sub-mm resolution.',
  },
  {
    id: 'endCorrection', label: 'End Correction', pane: 'Vents', kind: 'enum', unit: '',
    provenance: 'entered', modeled: false, appliesTo: ['vented', 'bandpass4'],
    options: ['0.613', '0.732', '0.849'],
    description: 'Port end-correction coefficient (one-free/one-flanged variants). OpenISD uses a fixed 0.732; the selector is WinISD-only for now.',
  },
  {
    id: 'ventCrossArea', label: 'Cross area', pane: 'Vents', kind: 'number', unit: 'm²', precision: 4, min: 0,
    provenance: 'calculated', modeled: true, appliesTo: ['vented', 'bandpass4'],
    formula: 'π·(ventD/2)²', dependsOn: ['ventD'],
    description: 'Port cross-sectional area (WinISD derived readout, 4 dp). Surfaced as a readonly readout on the Original Vents pane.',
  },
  {
    id: 'portResonance', label: '1st port resonance', pane: 'Vents', kind: 'number', unit: 'Hz', precision: 2, min: 0, max: 2000,
    provenance: 'calculated', modeled: false, appliesTo: ['vented', 'bandpass4'],
    description: 'First pipe/organ resonance of the vent (WinISD derived, 2 dp, 86.87 Hz). Not yet surfaced in OpenISD.',
  },

  // ============================ PASSIVE RADIATOR ============================
  {
    id: 'prSd', label: 'Sd', pane: 'PassiveRadiator', kind: 'number', unit: 'cm²', precision: 1, min: 0, max: 100000,
    provenance: 'entered', modeled: true, appliesTo: ['pr'],
    description: 'Passive-radiator effective piston area. WinISD 1 dp (95.0 cm²).',
  },
  {
    id: 'prXmax', label: 'Xmax', pane: 'PassiveRadiator', kind: 'number', unit: 'mm', precision: 1, min: 0, max: 100,
    provenance: 'entered', modeled: true, appliesTo: ['pr'],
    description: 'Passive-radiator peak linear excursion. WinISD 1 dp (mm).',
  },
  {
    id: 'prNum', label: 'Num. of PRs', pane: 'PassiveRadiator', kind: 'number', unit: '', precision: 0, min: 1, max: 16,
    provenance: 'entered', modeled: true, appliesTo: ['pr'],
    description: 'Count of passive radiators (integer).',
  },
  {
    id: 'prMadd', label: 'Added mass to cone', pane: 'PassiveRadiator', kind: 'number', unit: 'g', precision: 1, min: 0, max: 5000,
    provenance: 'entered', modeled: true, appliesTo: ['pr'],
    description: 'Mass added to the passive radiator to tune its Fp. WinISD 1 dp (g).',
  },
  {
    id: 'prVas', label: 'Vas', pane: 'PassiveRadiator', kind: 'number', unit: 'l', precision: 2, min: 0, max: 100000,
    provenance: 'calculated', modeled: true, appliesTo: ['pr'],
    formula: 'Vas = Cms·Sd²·ρ·c²·1000', dependsOn: ['prCms', 'prSd'],
    description: 'PR compliance-equivalent volume. WinISD 2 dp (4.80 l).',
  },
  {
    id: 'prFs', label: 'Fs', pane: 'PassiveRadiator', kind: 'number', unit: 'Hz', precision: 2, min: 0, max: 1000,
    provenance: 'calculated', modeled: true, appliesTo: ['pr'],
    formula: 'Fs = 1/(2π·√(Mmd·Cms))', dependsOn: ['prMmd', 'prCms'],
    description: 'PR free-air resonance. WinISD 2 dp (30.00 Hz).',
  },
  {
    id: 'prQms', label: 'Qms', pane: 'PassiveRadiator', kind: 'number', unit: '', precision: 3, min: 0, max: 100,
    provenance: 'calculated', modeled: true, appliesTo: ['pr'],
    formula: 'Qms = √(Mmd/Cms)/Rms', dependsOn: ['prMmd', 'prCms', 'prRms'],
    description: 'PR mechanical Q. WinISD 3 dp (3.300).',
  },
  {
    id: 'prFsMass', label: 'Fs (with added mass)', pane: 'PassiveRadiator', kind: 'number', unit: 'Hz', precision: 2, min: 0, max: 1000,
    provenance: 'calculated', modeled: true, appliesTo: ['pr'],
    formula: 'Fs = 1/(2π·√((Mmd+Madd)·Cms))', dependsOn: ['prMmd', 'prMadd', 'prCms'],
    description: 'PR resonance loaded with the added tuning mass. WinISD 2 dp.',
  },

  // ============================ SIGNAL ============================
  {
    id: 'Pin', label: 'System input power', pane: 'Signal', kind: 'number', unit: 'W', precision: 1, min: 0, max: 100000,
    provenance: 'entered', modeled: true, appliesTo: 'all',
    description: 'Primary drive level (power). Voltage is derived from it (P = V²/Re). WinISD 1 dp (140.0 W).',
  },
  {
    id: 'driveV', label: 'Driver input voltage (each)', pane: 'Signal', kind: 'number', unit: 'V', precision: 1, min: 0, max: 1000,
    provenance: 'calculated', modeled: true, appliesTo: 'all',
    formula: 'driveV = √(Pin · Re)', dependsOn: ['Pin', 'Re'],
    description: 'Per-driver drive voltage; editable and bidirectional with Pin via P = V²/Re. WinISD 1 dp (15.2 V).',
  },
  {
    id: 'Rs', label: 'Series resistance', pane: 'Signal', kind: 'number', unit: 'ohm', precision: 3, min: 0, max: 1000,
    provenance: 'entered', modeled: true, appliesTo: 'all',
    description: 'Amplifier output + cabling resistance in series with the driver. WinISD 3 dp (0.100 ohm).',
  },
  {
    id: 'listenDistance', label: 'Distance', pane: 'Signal', kind: 'number', unit: 'm', precision: 3, min: 0, max: 100,
    provenance: 'entered', modeled: false, appliesTo: 'all',
    description: 'Listening distance (WinISD 3 dp, 1.000 m). OpenISD is fixed at 1 m on-axis — not modelled yet.',
  },
  {
    id: 'listenAngle', label: 'Angle', pane: 'Signal', kind: 'number', unit: 'rad', precision: 4, min: 0, max: 3.1416,
    provenance: 'entered', modeled: false, appliesTo: 'all',
    description: 'Off-axis listening angle (WinISD 4 dp, 0.0000 rad). Not modelled in OpenISD.',
  },
  {
    id: 'genHz', label: 'Signal generator frequency', pane: 'Signal', kind: 'number', unit: 'Hz', precision: 2, min: 20, max: 20000,
    provenance: 'entered', modeled: true, appliesTo: 'all',
    description: 'Tone-generator frequency. WinISD 2 dp (13.20 Hz).',
  },

  // ============================ BOX LOSSES ============================
  {
    id: 'Ql', label: 'Leakage Ql', pane: 'Box losses', kind: 'number', unit: '', precision: 1, min: 0, max: 100,
    provenance: 'entered', modeled: true, appliesTo: 'all',
    description: 'Enclosure leakage loss Q.',
  },
  {
    id: 'Qa', label: 'Absorption Qa', pane: 'Box losses', kind: 'number', unit: '', precision: 1, min: 0, max: 1000,
    provenance: 'entered', modeled: true, appliesTo: 'all',
    description: 'Enclosure absorption (fill) loss Q.',
  },
  {
    id: 'Qp', label: 'Port Qp', pane: 'Box losses', kind: 'number', unit: '', precision: 1, min: 0, max: 1000,
    provenance: 'entered', modeled: true, appliesTo: ['vented', 'bandpass4'],
    description: 'Port (vent) loss Q.',
  },

  // ============================ ADVANCED (ENVIRONMENT) ============================
  {
    id: 'advTemp', label: 'Temperature', pane: 'Advanced', kind: 'number', unit: 'K', precision: 2, min: 0, max: 400,
    provenance: 'entered', modeled: true, appliesTo: 'all',
    description: 'Ambient temperature; feeds sound velocity + air density. WinISD 2 dp (293.15 K).',
  },
  {
    id: 'advHumidity', label: 'Relative humidity', pane: 'Advanced', kind: 'number', unit: '%', precision: 1, min: 0, max: 100,
    provenance: 'entered', modeled: true, appliesTo: 'all',
    description: 'Ambient relative humidity. WinISD prints 4 dp (30.0000 %) but that is spurious precision; OpenISD uses 1 dp (deliberate, documented divergence — a percentage needs no more).',
  },
  {
    id: 'advPressure', label: 'Air pressure', pane: 'Advanced', kind: 'number', unit: 'kPa', precision: 2, min: 0, max: 200,
    provenance: 'entered', modeled: true, appliesTo: 'all',
    description: 'Ambient air pressure. WinISD shows Pa at 1 dp (101325.0); OpenISD shows kPa at 2 dp (101.33 kPa) — sane unit + resolution. MUST guard an empty entry (see WINISD.md §12b: clearing this crashes WinISD).',
  },
  {
    id: 'advSoundVelocity', label: 'Sound velocity', pane: 'Advanced', kind: 'number', unit: 'm/s', precision: 2, min: 0, max: 1000,
    provenance: 'calculated', modeled: true, appliesTo: 'all',
    formula: 'c = 20.05·√(T[K])', dependsOn: ['advTemp'],
    description: 'Derived speed of sound. WinISD 2 dp (343.68 m/s).',
  },
  {
    id: 'advAirDensity', label: 'Air density', pane: 'Advanced', kind: 'number', unit: 'kg/m³', precision: 5, min: 0, max: 10,
    provenance: 'calculated', modeled: true, appliesTo: 'all',
    formula: 'ρ = f(T, RH, P) — ideal-gas air density from the environment inputs',
    dependsOn: ['advTemp', 'advHumidity', 'advPressure'],
    description: 'Air density readout. WinISD 5 dp (1.20095 kg/m³) derived from T/RH/P. NOTE: OpenISD currently DISPLAYS the fixed RHO constant at this dp — the T/RH/P environment model (the formula/dependsOn above) is not yet implemented (BACKLOG); the dependency edges document the intended derivation, not today\'s behaviour.',
  },

  // ============================ DRIVER EDITOR — T/S (Parameters tab) ============================
  // Modeled T/S params. Where OpenISD shows a different unit than WinISD, the dp is unit-adjusted
  // to keep WinISD's resolution (noted per field).
  {
    id: 'Fs', label: 'Fs', pane: 'Driver: Parameters', kind: 'number', unit: 'Hz', precision: 2, min: 1, max: 5000,
    provenance: 'entered', modeled: true, appliesTo: 'all',
    description: 'Driver free-air resonance. WinISD 2 dp (Hz).',
  },
  {
    id: 'Qts', label: 'Qts', pane: 'Driver: Parameters', kind: 'number', unit: '', precision: 3, min: 0, max: 5,
    provenance: 'calculated', modeled: true, appliesTo: 'all',
    formula: 'Qts = Qes·Qms/(Qes+Qms)', dependsOn: ['Qes', 'Qms'],
    description: 'Total driver Q. WinISD 3 dp.',
  },
  {
    id: 'Qes', label: 'Qes', pane: 'Driver: Parameters', kind: 'number', unit: '', precision: 3, min: 0, max: 5,
    provenance: 'entered', modeled: true, appliesTo: 'all',
    description: 'Electrical Q. WinISD 3 dp.',
  },
  {
    id: 'Qms', label: 'Qms', pane: 'Driver: Parameters', kind: 'number', unit: '', precision: 3, min: 0, max: 50,
    provenance: 'entered', modeled: true, appliesTo: 'all',
    description: 'Mechanical Q. WinISD 3 dp.',
  },
  {
    id: 'Vas', label: 'Vas', pane: 'Driver: Parameters', kind: 'number', unit: 'l', precision: 2, min: 0, max: 100000,
    provenance: 'entered', modeled: true, appliesTo: 'all',
    description: 'Compliance-equivalent volume. OpenISD shows litres at 2 dp (WinISD editor shows imperial in³; its native metric resolution is ~2 dp l).',
  },
  {
    id: 'Re', label: 'Re', pane: 'Driver: Parameters', kind: 'number', unit: 'ohm', precision: 3, min: 0, max: 1000,
    provenance: 'entered', modeled: true, appliesTo: 'all',
    description: 'DC voice-coil resistance. WinISD 3 dp (ohm).',
  },
  {
    id: 'Le', label: 'Le', pane: 'Driver: Parameters', kind: 'number', unit: 'mH', precision: 3, min: 0, max: 100,
    provenance: 'entered', modeled: true, appliesTo: 'all',
    description: 'Voice-coil inductance. OpenISD shows mH at 3 dp — equivalent to WinISD\'s 6 dp in H (×1000).',
  },
  {
    id: 'Mms', label: 'Mms', pane: 'Driver: Parameters', kind: 'number', unit: 'g', precision: 2, min: 0, max: 10000,
    provenance: 'calculated', modeled: true, appliesTo: 'all',
    formula: 'Mms = 1/((2π·Fs)²·Cms)', dependsOn: ['Fs', 'Cms'],
    description: 'Moving mass. OpenISD shows grams at 2 dp — equivalent to WinISD\'s 5 dp in kg (×1000).',
  },
  {
    id: 'Sd', label: 'Sd', pane: 'Driver: Parameters', kind: 'number', unit: 'cm²', precision: 1, min: 0, max: 100000,
    provenance: 'entered', modeled: true, appliesTo: 'all',
    description: 'Effective piston area. OpenISD shows cm² at 1 dp — WinISD\'s 4 dp in m² (≈1 cm² steps) is too coarse; 1 dp cm² keeps sub-cm² resolution (documented divergence).',
  },
  {
    id: 'Xmax', label: 'Xmax', pane: 'Driver: Parameters', kind: 'number', unit: 'mm', precision: 1, min: 0, max: 100,
    provenance: 'entered', modeled: true, appliesTo: 'all',
    description: 'Peak linear excursion. OpenISD shows mm at 1 dp — WinISD\'s 3 dp in m (=1 mm steps) is too coarse; 1 dp mm keeps 0.1 mm resolution (documented divergence).',
  },
  {
    id: 'Pe', label: 'Pe', pane: 'Driver: Parameters', kind: 'number', unit: 'W', precision: 1, min: 0, max: 100000,
    provenance: 'entered', modeled: true, appliesTo: 'all',
    description: 'Thermal power handling. WinISD 1 dp (W).',
  },
  {
    id: 'Z', label: 'Znom', pane: 'Driver: Parameters', kind: 'number', unit: 'ohm', precision: 3, min: 0, max: 1000,
    provenance: 'entered', modeled: true, appliesTo: 'all',
    description: 'Nominal impedance. WinISD 3 dp (ohm).',
  },
  {
    id: 'Bl', label: 'BL', pane: 'Driver: Parameters', kind: 'number', unit: 'Tm', precision: 3, min: 0, max: 1000,
    provenance: 'calculated', modeled: true, appliesTo: 'all',
    formula: 'Bl = √(2π·Fs·Mms·Re/Qes)', dependsOn: ['Fs', 'Mms', 'Re', 'Qes'],
    description: 'Force factor. OpenISD shows 3 dp; WinISD shows 5 dp — 3 dp is ample for a Tm value.',
  },
  {
    id: 'Cms', label: 'Cms', pane: 'Driver: Parameters', kind: 'number', unit: 'mm/N', precision: 4, min: 0, max: 100,
    provenance: 'calculated', modeled: true, appliesTo: 'all',
    formula: 'Cms = Vas/(ρ·c²·Sd²)', dependsOn: ['Vas', 'Sd'],
    description: 'Mechanical compliance. OpenISD shows mm/N at 4 dp (WinISD µm/N, 1 dp).',
  },
  {
    id: 'Rms', label: 'Rms', pane: 'Driver: Parameters', kind: 'number', unit: 'Ns/m', precision: 4, min: 0, max: 1000,
    provenance: 'calculated', modeled: true, appliesTo: 'all',
    formula: 'Rms = 2π·Fs·Mms/Qms', dependsOn: ['Fs', 'Mms', 'Qms'],
    description: 'Mechanical loss resistance. WinISD 5 dp (Ns/m); OpenISD 4 dp.',
  },

  // ============================ DRIVER EDITOR — reference-only (Parameters/Advanced/Dimensions) ============================
  // WinISD fields OpenISD does not model. Recorded for parity/DQ/roadmap; precision/unit are WinISD's.
  { id: 'Dd', label: 'Dd', pane: 'Driver: Parameters', kind: 'number', unit: 'm', precision: 3, min: 0, provenance: 'entered', modeled: false, appliesTo: 'all', description: 'Effective piston diameter (WinISD 3 dp). OpenISD derives Sd instead.' },
  { id: 'fLe', label: 'fLe', pane: 'Driver: Parameters', kind: 'number', unit: 'kHz', precision: 5, min: 0, provenance: 'entered', modeled: false, appliesTo: 'all', description: 'Semi-inductance reference frequency (WinISD 5 dp). Raw passthrough only.' },
  { id: 'KLe', label: 'KLe', pane: 'Driver: Parameters', kind: 'number', unit: 'H·√Hz', precision: 6, min: 0, provenance: 'entered', modeled: false, appliesTo: 'all', description: 'Semi-inductance coefficient (WinISD 6 dp). Raw passthrough only.' },
  { id: 'Hc', label: 'Hc', pane: 'Driver: Parameters', kind: 'number', unit: 'm', precision: 3, min: 0, provenance: 'entered', modeled: false, appliesTo: 'all', description: 'Voice-coil height (WinISD 3 dp). Not modelled.' },
  { id: 'Hg', label: 'Hg', pane: 'Driver: Parameters', kind: 'number', unit: 'm', precision: 3, min: 0, provenance: 'entered', modeled: false, appliesTo: 'all', description: 'Magnetic gap height (WinISD 3 dp). Not modelled.' },
  { id: 'Vd', label: 'Vd', pane: 'Driver: Parameters', kind: 'number', unit: 'cm³', precision: 0, min: 0, provenance: 'calculated', modeled: false, appliesTo: 'all', description: 'Peak displacement volume = Sd·Xmax (WinISD 0 dp). Not surfaced.' },
  { id: 'Xlim', label: 'Xlim', pane: 'Driver: Parameters', kind: 'number', unit: 'm', precision: 3, min: 0, provenance: 'entered', modeled: false, appliesTo: 'all', description: 'Mechanical excursion limit, distinct from Xmax (WinISD 3 dp). Not modelled.' },
  { id: 'no', label: 'no (η₀)', pane: 'Driver: Parameters', kind: 'number', unit: '%', precision: 4, min: 0, provenance: 'calculated', modeled: false, appliesTo: 'all', description: 'Reference efficiency (WinISD 4 dp).' },
  { id: 'USPL', label: 'USPL', pane: 'Driver: Parameters', kind: 'number', unit: 'dB', precision: 2, provenance: 'calculated', modeled: false, appliesTo: 'all', description: 'Reference SPL variant (WinISD 2 dp). Not modelled.' },
  { id: 'SPLref', label: 'SPL', pane: 'Driver: Parameters', kind: 'number', unit: 'dB', precision: 2, provenance: 'calculated', modeled: false, appliesTo: 'all', description: 'Reference sensitivity SPL (WinISD 2 dp).' },
  { id: 'Voicecoils', label: 'Voicecoils', pane: 'Driver: Parameters', kind: 'number', unit: '', precision: 0, min: 1, max: 4, provenance: 'entered', modeled: false, appliesTo: 'all', description: 'Number of voice coils (WinISD integer). OpenISD single-VC only.' },
  { id: 'Connection', label: 'Connection', pane: 'Driver: Parameters', kind: 'enum', unit: '', provenance: 'entered', modeled: false, appliesTo: 'all', options: ['Parallel', 'Series'], description: 'Dual-VC wiring (WinISD). OpenISD models multi-driver wiring separately.' },
  { id: 'AlfaVC', label: 'AlfaVC', pane: 'Driver: Advanced', kind: 'number', unit: '1000/K', precision: 4, min: 0, provenance: 'entered', modeled: false, appliesTo: 'all', description: 'Voice-coil resistance temperature coefficient (WinISD 4 dp). Stored, not simulated.' },
  { id: 'Rt', label: 'R(t)', pane: 'Driver: Advanced', kind: 'number', unit: 'K/W', precision: 5, min: 0, provenance: 'entered', modeled: false, appliesTo: 'all', description: 'Thermal resistance (WinISD 5 dp). Not simulated.' },
  { id: 'Ct', label: 'C(t)', pane: 'Driver: Advanced', kind: 'number', unit: 'J/K', precision: 5, min: 0, provenance: 'entered', modeled: false, appliesTo: 'all', description: 'Thermal capacitance (WinISD 5 dp). Not simulated.' },
  { id: 'EBP', label: 'EBP', pane: 'Driver: Advanced', kind: 'number', unit: 'Hz', precision: 2, min: 0, provenance: 'calculated', modeled: true, appliesTo: 'all', formula: 'EBP = Fs/Qes', dependsOn: ['Fs', 'Qes'], description: 'Efficiency bandwidth product (WinISD 2 dp). OpenISD shows it as a gauge.' },
  { id: 'SPLmaxLF', label: 'SPLmaxLF', pane: 'Driver: Advanced', kind: 'number', unit: 'dB', precision: 2, provenance: 'calculated', modeled: false, appliesTo: 'all', description: 'Low-frequency max SPL figure of merit (WinISD 2 dp).' },
  { id: 'SPLmax', label: 'SPLmax', pane: 'Driver: Advanced', kind: 'number', unit: 'dB', precision: 2, provenance: 'calculated', modeled: false, appliesTo: 'all', description: 'Max SPL figure of merit (WinISD 2 dp).' },
  { id: 'Rme', label: 'Rme', pane: 'Driver: Advanced', kind: 'number', unit: 'Ns/m', precision: 5, min: 0, provenance: 'calculated', modeled: false, appliesTo: 'all', description: 'Figure of merit (WinISD 5 dp).' },
  { id: 'gamma', label: 'gamma', pane: 'Driver: Advanced', kind: 'number', unit: 'N/(A·kg)', precision: 5, provenance: 'calculated', modeled: false, appliesTo: 'all', description: 'Figure of merit (WinISD 5 dp).' },
  { id: 'Mpow', label: 'Mpow', pane: 'Driver: Advanced', kind: 'number', unit: 'N/√W', precision: 5, provenance: 'calculated', modeled: false, appliesTo: 'all', description: 'Figure of merit (WinISD 5 dp).' },
  { id: 'Mcost', label: 'Mcost', pane: 'Driver: Advanced', kind: 'number', unit: 'kg/s', precision: 5, provenance: 'calculated', modeled: false, appliesTo: 'all', description: 'Figure of merit (WinISD 5 dp).' },
  { id: 'Gloss', label: 'Gloss', pane: 'Driver: Advanced', kind: 'number', unit: '%', precision: 4, provenance: 'calculated', modeled: false, appliesTo: 'all', description: 'Figure of merit (WinISD 4 dp).' },
  { id: 'dimThick', label: 'Thick', pane: 'Driver: Dimensions', kind: 'number', unit: 'in', precision: 2, min: 0, provenance: 'entered', modeled: false, appliesTo: 'all', description: 'Baffle cutout thickness (WinISD 2 dp). Not modelled.' },
  { id: 'dimDepth', label: 'Depth', pane: 'Driver: Dimensions', kind: 'number', unit: 'm', precision: 3, min: 0, provenance: 'entered', modeled: false, appliesTo: 'all', description: 'Overall driver depth (WinISD 3 dp). Not modelled.' },
  { id: 'dimMagnetDepth', label: 'Magnet Depth', pane: 'Driver: Dimensions', kind: 'number', unit: 'm', precision: 3, min: 0, provenance: 'entered', modeled: false, appliesTo: 'all', description: 'Magnet assembly depth (WinISD 3 dp). Not modelled.' },
  { id: 'dimMagnet', label: 'Magnet', pane: 'Driver: Dimensions', kind: 'number', unit: 'm', precision: 3, min: 0, provenance: 'entered', modeled: false, appliesTo: 'all', description: 'Magnet diameter (WinISD 3 dp). Not modelled.' },
  { id: 'dimBasket', label: 'Basket', pane: 'Driver: Dimensions', kind: 'number', unit: 'm', precision: 3, min: 0, provenance: 'entered', modeled: false, appliesTo: 'all', description: 'Basket/frame diameter (WinISD 3 dp). Not modelled.' },
  { id: 'dimOuter', label: 'Outer', pane: 'Driver: Dimensions', kind: 'number', unit: 'm', precision: 3, min: 0, provenance: 'entered', modeled: false, appliesTo: 'all', description: 'Outer mounting diameter (WinISD 3 dp). Not modelled.' },
  { id: 'dimVCd', label: 'VCd', pane: 'Driver: Dimensions', kind: 'number', unit: 'm', precision: 3, min: 0, provenance: 'entered', modeled: false, appliesTo: 'all', description: 'Voice-coil diameter (WinISD 3 dp). Not modelled.' },
  { id: 'dimDvol', label: 'Dvol', pane: 'Driver: Dimensions', kind: 'number', unit: 'in³', precision: 1, min: 0, provenance: 'entered', modeled: false, appliesTo: 'all', description: 'Driver displacement volume (WinISD 1 dp). OpenISD has a Weight field instead.' },

  // ============================ DRIVER PLACEMENT ============================
  {
    id: 'nDrivers', label: 'Num. of drivers', pane: 'Driver', kind: 'number', unit: '', precision: 0, min: 1, max: 64,
    provenance: 'entered', modeled: true, appliesTo: 'all',
    description: 'Number of drivers in the system (integer). Drives SPL summation.',
  },
  { id: 'vcTempRise', label: 'Voice coil temp rise', pane: 'Driver', kind: 'number', unit: 'K', precision: 2, min: 0, provenance: 'entered', modeled: false, appliesTo: 'all', description: 'Power-compression temperature rise (WinISD 2 dp). Not modelled.' },
  { id: 'driverAddedMass', label: 'Added mass to cone', pane: 'Driver', kind: 'number', unit: 'g', precision: 2, min: 0, provenance: 'entered', modeled: false, appliesTo: 'all', description: 'Driver-side added cone mass (WinISD kg 5 dp → g 2 dp). OpenISD models PR added mass only.' },

  // ============================ FILTERS ============================
  // OpenISD models 4 filter types (highpass, lowpass, linkwitz, peaking). WinISD's filter fields
  // all display at 3 dp. Filter params are edited via OgFilters; enrolled here for the catalog.
  { id: 'filterFc', label: 'Cutoff / Center freq', pane: 'Filters', kind: 'number', unit: 'Hz', precision: 3, min: 0, max: 20000, provenance: 'entered', modeled: true, appliesTo: 'all', description: 'Filter cutoff / centre frequency. WinISD 3 dp.' },
  { id: 'filterQ', label: 'Q', pane: 'Filters', kind: 'number', unit: '', precision: 3, min: 0, max: 100, provenance: 'entered', modeled: true, appliesTo: 'all', description: 'Filter Q. WinISD 3 dp (0.707).' },
  { id: 'filterGain', label: 'Gain', pane: 'Filters', kind: 'number', unit: 'dB', precision: 3, min: -60, max: 60, provenance: 'entered', modeled: true, appliesTo: 'all', description: 'Filter gain (peaking/EQ/static). WinISD 3 dp.' },
  { id: 'filterOrder', label: 'Order', pane: 'Filters', kind: 'number', unit: '', precision: 3, min: 1, max: 8, provenance: 'entered', modeled: true, appliesTo: 'all', description: 'Filter order. Semantically an integer, but WinISD literally displays it at 3 dp (e.g. "2.000") — precision 3 matches that evidence.' },
];

const BY_ID = new Map<string, FieldSpec>(FIELDS.map((f) => [f.id, f]));

/** All registered field specs (read-only view). */
export const fieldSpecs: readonly FieldSpec[] = FIELDS;

/** Look up a field spec by id, or undefined if not registered. */
export function fieldById(id: string): FieldSpec | undefined {
  return BY_ID.get(id);
}

/**
 * Fixed display precision (decimal places) for a numeric field. Throws on an unknown id, or
 * on a non-numeric field with no precision, so a typo/misuse surfaces at test time rather than
 * silently falling back to a wrong dp.
 */
export function precision(id: string): number {
  const spec = BY_ID.get(id);
  if (!spec) throw new Error(`fieldRegistry: no field "${id}" — add it to fieldRegistry.ts`);
  if (spec.precision === undefined) throw new Error(`fieldRegistry: field "${id}" is ${spec.kind}, has no precision`);
  return spec.precision;
}

/** Sanity bounds { min, max } for a field (either may be undefined). Throws on unknown id. */
export function limits(id: string): { min?: number; max?: number } {
  const spec = BY_ID.get(id);
  if (!spec) throw new Error(`fieldRegistry: no field "${id}" — add it to fieldRegistry.ts`);
  return { min: spec.min, max: spec.max };
}
