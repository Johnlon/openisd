import { Provenance as ModelProvenance } from '@openisd/model';
import type { BoxType } from '@openisd/engine';
import type { UnitGroup } from './units.js';

/**
 * Field registry — the single, canonical data model for every field OpenISD shows (and every
 * field WinISD shows that OpenISD may model later). It is the SSOT that other layers refer
 * back to: the UI reads `precision(id)` / `limits(id)`; data-quality (DQ) checks and UI design
 * cite the same description, unit, derivation (`formula`), dependencies (`dependsOn`), and
 * sanity bounds (`min`/`max`).
 *
 * Coverage is deliberately COMPLETE — every field on the WinISD 0.7.0.950 screens
 * (docs/winisd_screenshots/info/*.md) is catalogued, whether or not OpenISD renders/computes it.
 * Where OpenISD uses a DIFFERENT unit than WinISD, the dp is unit-ADJUSTED to keep WinISD's
 * resolution — noted in `description`.
 *
 * Precision is the fixed number of DECIMAL PLACES a numeric field always shows (WinISD
 * convention). dp evidence + the per-field screenshot source live in docs/research/WINISD_PARITY.md.
 *
 * Why CODE not Markdown: the UI imports `precision(id)` and tests import the registry to assert
 * conformance — a prose table can do neither, so it drifts.
 */

/** Kind of field — only 'number' carries a `precision`. */
export type FieldKind = 'number' | 'enum' | 'text' | 'toggle' | 'date' | 'control';
/** Whether a field's value is supplied by the human or derived by the app. A registry entry
 *  declares an AUTHORING kind, so `NotAvailable` can never appear here — the type is the
 *  narrower union derived from the model's own `Provenance` enum, never a second
 *  declaration of the concept. */
type FieldProvenance = `${ModelProvenance.Entered}` | `${ModelProvenance.Calculated}`;

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
  /** Display unit symbol, or '' for dimensionless (e.g. Q). For a field a skin binds (via
   *  `field=`), this is OpenISD's unit (which may differ from WinISD's); for an entry no skin
   *  binds yet, it is WinISD's unit, carried as documentation. */
  unit: string;
  /** Interchangeable-unit group this field belongs to (fields/units.ts) — lets the UI offer a
   *  click-to-rotate toggle among the group's spellings. Omitted for fields with no alternate
   *  spelling. */
  unitGroup?: UnitGroup;
  /** Fixed decimal places a numeric field always shows. Present for kind==='number' only. */
  precision?: number;
  /** Sanity lower bound for entry, in the unit NumInput emits: for a field a skin binds (via
   *  `field=`) this is ENFORCED by the UI (NumInput / v-limits) in SI base (m³, m, m², kg, Pa,
   *  H, 1/K …); for an entry no skin binds yet, the bound is in the field's own `unit` column
   *  and unenforced. REQUIRED for every numeric field. */
  min?: number;
  /** Sanity upper bound — a plausibility ceiling, in the same unit space as `min` and enforced
   *  (or not) on the same terms. REQUIRED for every numeric field. */
  max?: number;
  /** Entered by the human, or Calculated by the app. */
  provenance: FieldProvenance;
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

/**
 * Port end-correction presets (WinISD parity) — the SINGLE source for the coefficient values
 * and their labels, consumed by every skin's End Correction dropdown. Coefficient × vent
 * diameter is added to the physical length to get the acoustic Leff that sets tuning Fb.
 */
export const END_CORRECTION_OPTIONS = [
  { value: 0.613, label: 'Two free ends' },
  { value: 0.732, label: 'One flanged end' },
  { value: 0.849, label: 'Two flanged ends' },
] as const;

const FIELDS: FieldSpec[] = [
  // ============================ BOX / ENCLOSURE ============================
  {
    id: 'Vb', label: 'Volume', pane: 'Box', kind: 'number', unit: 'l', precision: 2, min: 0.0001, max: 100,
    provenance: 'entered', appliesTo: 'all',
    description: 'Net internal enclosure volume (rear chamber for bandpass). WinISD shows 2 dp.',
  },
  {
    id: 'Vf', label: 'Front volume', pane: 'Box', kind: 'number', unit: 'l', precision: 2, min: 0.0001, max: 100,
    provenance: 'entered', appliesTo: ['bandpass4'],
    description: 'Front (sealed/vented) chamber volume of a bandpass enclosure.',
  },
  {
    id: 'Fb', label: 'Target Tuning Freq (Fb)', pane: 'Box', kind: 'number', unit: 'Hz', precision: 2, min: 0, max: 1000,
    provenance: 'entered', appliesTo: ['vented', 'bandpass4', 'pr'],
    description: 'The tuning the design is aimed at — an INPUT the port solver designs to, not a readout: the vent length is solved from it (logic/useVentGroup.ts, human ruling QO11). Entering a vent length instead swaps the roles within the vent group and Fb becomes the solved member. Shown and editable on both the Box tab and the Vents pane, one stored value. `Fh` is the symbol the passive-radiator system tuning uses on WinISD\'s Box screen (docs/winisd_screenshots/view_2_box.png, 40.25 Hz), so it is not this quantity\'s symbol. WinISD shows 2 dp.',
  },

  // ============================ VENTS / PORTED ============================
  {
    id: 'ventShape', label: 'Vent shape', pane: 'Vents', kind: 'enum', unit: '',
    provenance: 'entered', appliesTo: ['vented', 'bandpass4'],
    options: ['round', 'slotted'],
    description: 'Circular or rectangular/slotted port geometry.',
  },
  {
    id: 'ventD', label: 'Vent diameter', pane: 'Vents', kind: 'number', unit: 'cm', precision: 2, min: 0.001, max: 2,
    provenance: 'entered', appliesTo: ['vented', 'bandpass4'],
    description: 'Circular port diameter; feeds the tuning solver via port area. WinISD 2 dp (10.20 cm).',
  },
  {
    id: 'ventW', label: 'Slot width', pane: 'Vents', kind: 'number', unit: 'cm', precision: 2, min: 0.001, max: 2,
    provenance: 'entered', appliesTo: ['vented', 'bandpass4'],
    description: 'Slotted port width.',
  },
  {
    id: 'ventH', label: 'Slot height', pane: 'Vents', kind: 'number', unit: 'cm', precision: 2, min: 0.001, max: 2,
    provenance: 'entered', appliesTo: ['vented', 'bandpass4'],
    description: 'Slotted port height.',
  },
  {
    id: 'ventL', label: 'Vent length', pane: 'Vents', kind: 'number', unit: 'cm', precision: 2, min: 0.001, max: 10,
    provenance: 'entered', appliesTo: ['vented', 'bandpass4'],
    description: 'Port length; with diameter sets Fb. OpenISD enters it in cm (editable) — WinISD derives it in m; 1 dp cm keeps sub-mm resolution.',
  },
  {
    id: 'endCorrection', label: 'End Correction', pane: 'Vents', kind: 'enum', unit: '',
    provenance: 'entered', appliesTo: ['vented', 'bandpass4'],
    options: END_CORRECTION_OPTIONS.map((o) => String(o.value)),
    description: 'Port end-correction coefficient × vent diameter, added to the physical length to get the acoustic Leff that sets tuning Fb. Two free ends 0.613 / one flanged 0.732 (default) / two flanged 0.849. Selectable on the Vents pane. WinISD parity.',
  },
  {
    id: 'ventCrossArea', label: 'Cross area', pane: 'Vents', kind: 'number', unit: 'm²', precision: 4, min: 0, max: 10,
    provenance: 'calculated', appliesTo: ['vented', 'bandpass4'],
    formula: 'π·(ventD/2)²', dependsOn: ['ventD'],
    description: 'Port cross-sectional area (WinISD derived readout, 4 dp). Surfaced as a readonly readout on the Original Vents pane.',
  },
  {
    id: 'portResonance', label: '1st port resonance', pane: 'Vents', kind: 'number', unit: 'Hz', precision: 2, min: 0, max: 20000,
    provenance: 'calculated', appliesTo: ['vented', 'bandpass4'],
    formula: 'c / (2·ventL) — open-open duct fundamental (physical vent length, matching WinISD; end correction applies to the tuning Fb, not this)',
    dependsOn: ['ventL'],
    description: 'First organ-pipe (standing-wave) resonance of the vent tube itself — distinct from the box Helmholtz tuning (Fb). Surfaced on the Original Vents pane. WinISD 2 dp (86.87 Hz).',
  },

  // ============================ PASSIVE RADIATOR ============================
  {
    id: 'prSd', label: 'Sd', pane: 'PassiveRadiator', kind: 'number', unit: 'cm²', precision: 2, min: 0.0001, max: 10,
    provenance: 'entered', appliesTo: ['pr'],
    description: 'Passive-radiator effective piston area. OpenISD 2 dp.',
  },
  {
    id: 'prXmax', label: 'Xmax', pane: 'PassiveRadiator', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 0.5,
    provenance: 'entered', appliesTo: ['pr'],
    description: 'Passive-radiator peak linear excursion. OpenISD 2 dp.',
  },
  {
    id: 'prNum', label: 'Num. of PRs', pane: 'PassiveRadiator', kind: 'number', unit: '', precision: 0, min: 1, max: 16,
    provenance: 'entered', appliesTo: ['pr'],
    description: 'Count of passive radiators (integer).',
  },
  {
    id: 'prMadd', label: 'Added mass to cone', pane: 'PassiveRadiator', kind: 'number', unit: 'g', precision: 2, min: 0, max: 5,
    provenance: 'entered', appliesTo: ['pr'],
    description: 'Mass added to the passive radiator to tune its Fp. WinISD 1 dp (g).',
  },
  {
    id: 'prVas', label: 'Vas', pane: 'PassiveRadiator', kind: 'number', unit: 'l', precision: 2, min: 0, max: 100,
    provenance: 'calculated', appliesTo: ['pr'],
    formula: 'Vas = Cms·Sd²·ρ·c²·1000', dependsOn: ['prCms', 'prSd'],
    description: 'PR compliance-equivalent volume. WinISD 2 dp (4.80 l).',
  },
  {
    id: 'prFs', label: 'Fpr', pane: 'PassiveRadiator', kind: 'number', unit: 'Hz', precision: 2, min: 0, max: 1000,
    provenance: 'calculated', appliesTo: ['pr'],
    formula: 'Fpr = 1/(2π·√(Mmd·Cms))', dependsOn: ['prMmd', 'prCms'],
    description: 'The RADIATOR\'s own free-air resonance — no box in it. WinISD prints it as "Fs" on its PR screen (docs/winisd_screenshots/view_3_passive_radiator.png, 30.00 Hz), which collides with the driver\'s [Fs]; `Fpr` is this app\'s symbol. Distinct from the PR SYSTEM tuning, which is the Box screen\'s Fh (view_2_box.png, 40.25 Hz on the same project). WinISD 2 dp.',
  },
  {
    id: 'prQms', label: 'Qms', pane: 'PassiveRadiator', kind: 'number', unit: '', precision: 3, min: 0, max: 100,
    provenance: 'calculated', appliesTo: ['pr'],
    formula: 'Qms = √(Mmd/Cms)/Rms', dependsOn: ['prMmd', 'prCms', 'prRms'],
    description: 'PR mechanical Q. WinISD 3 dp (3.300).',
  },
  {
    id: 'prFsMass', label: 'Fpr (with added mass)', pane: 'PassiveRadiator', kind: 'number', unit: 'Hz', precision: 2, min: 0, max: 1000,
    provenance: 'calculated', appliesTo: ['pr'],
    formula: 'Fpr = 1/(2π·√((Mmd+Madd)·Cms))', dependsOn: ['prMmd', 'prMadd', 'prCms'],
    description: 'The radiator\'s free-air resonance loaded with the added tuning mass — still no box in it. WinISD 2 dp.',
  },

  // ============================ SIGNAL ============================
  {
    id: 'Pin', label: 'System input power', pane: 'Signal', kind: 'number', unit: 'W', precision: 2, min: 0, max: 100000,
    provenance: 'entered', appliesTo: 'all',
    description: 'Primary drive level (power). Voltage is derived from it (P = V²/Re). OpenISD 2 dp.',
  },
  {
    id: 'driveV', label: 'Driver input voltage (each)', pane: 'Signal', kind: 'number', unit: 'V', precision: 2, min: 0, max: 1000,
    provenance: 'calculated', appliesTo: 'all',
    formula: 'driveV = √(Pin · Re)', dependsOn: ['Pin', 'Re'],
    description: 'Per-driver drive voltage; editable and bidirectional with Pin via P = V²/Re. WinISD 1 dp (15.2 V).',
  },
  {
    id: 'Rs', label: 'Series resistance', pane: 'Signal', kind: 'number', unit: 'ohm', precision: 3, min: 0, max: 1000,
    provenance: 'entered', appliesTo: 'all',
    description: 'Amplifier output + cabling resistance in series with the driver. WinISD 3 dp (0.100 ohm).',
  },
  {
    id: 'listenDistance', label: 'Distance', pane: 'Signal', kind: 'number', unit: 'm', precision: 3, min: 0, max: 100,
    provenance: 'entered', appliesTo: 'all',
    description: 'Listening distance (WinISD 3 dp, 1.000 m). OpenISD is fixed at 1 m on-axis — not modelled yet.',
  },
  {
    id: 'listenAngle', label: 'Angle', pane: 'Signal', kind: 'number', unit: 'rad', precision: 4, min: 0, max: 3.1416,
    provenance: 'entered', appliesTo: 'all',
    description: 'Off-axis listening angle (WinISD 4 dp, 0.0000 rad). Not modelled in OpenISD.',
  },
  {
    id: 'genHz', label: 'Signal generator frequency', pane: 'Signal', kind: 'number', unit: 'Hz', precision: 2, min: 1, max: 20000,
    provenance: 'entered', appliesTo: 'all',
    description: 'Tone-generator frequency. WinISD 2 dp (13.20 Hz).',
  },

  // ============================ BOX LOSSES ============================
  {
    id: 'Ql', label: 'Leakage Ql', pane: 'Box losses', kind: 'number', unit: '', precision: 2, min: 0.1, max: 1000,
    provenance: 'entered', appliesTo: 'all',
    description: 'Enclosure leakage loss Q.',
  },
  {
    id: 'Qa', label: 'Absorption Qa', pane: 'Box losses', kind: 'number', unit: '', precision: 2, min: 0.1, max: 1000,
    provenance: 'entered', appliesTo: 'all',
    description: 'Enclosure absorption (fill) loss Q.',
  },
  {
    id: 'Qp', label: 'Port Qp', pane: 'Box losses', kind: 'number', unit: '', precision: 2, min: 0.1, max: 1000,
    provenance: 'entered', appliesTo: ['vented', 'bandpass4'],
    description: 'Port (vent) loss Q.',
  },

  // ============================ ADVANCED (ENVIRONMENT) ============================
  {
    id: 'advTemp', label: 'Temperature', pane: 'Advanced', kind: 'number', unit: 'K', precision: 2, min: 0, max: 400,
    provenance: 'entered', appliesTo: 'all',
    description: 'Ambient temperature; feeds sound velocity + air density. WinISD 2 dp (293.15 K).',
  },
  {
    id: 'advHumidity', label: 'Relative humidity', pane: 'Advanced', kind: 'number', unit: '%', precision: 2, min: 0, max: 100,
    provenance: 'entered', appliesTo: 'all',
    description: 'Ambient relative humidity. WinISD prints 4 dp (30.0000 %) but that is spurious precision; OpenISD uses 1 dp (deliberate, documented divergence — a percentage needs no more).',
  },
  {
    id: 'advPressure', label: 'Air pressure', pane: 'Advanced', kind: 'number', unit: 'kPa', precision: 2, min: 1000, max: 200000,
    provenance: 'entered', appliesTo: 'all',
    description: 'Ambient air pressure. WinISD shows Pa at 1 dp (101325.0); OpenISD shows kPa at 2 dp (101.33 kPa) — sane unit + resolution. MUST guard an empty entry (see docs/research/WINISD_PARITY.md: clearing this crashes WinISD).',
  },
  {
    id: 'advSoundVelocity', label: 'Sound velocity', pane: 'Advanced', kind: 'number', unit: 'm/s', precision: 2, min: 0, max: 1000,
    provenance: 'calculated', appliesTo: 'all',
    formula: 'c = √(γ·p/ρ), γ = 1.4', dependsOn: ['advTemp', 'advHumidity', 'advPressure'],
    description: 'Derived speed of sound (engine air.ts). Laplace\'s adiabatic relation at the moist-air density below — the pairing WinISD\'s own stored c/roo satisfy to 1.2e-15. At 293.15 K / 30 % / 101325 Pa it gives 343.68270 m/s, 4.1 ppm from WinISD\'s measured 343.684120962152. WinISD 2 dp (343.68 m/s). Ticking [ignoreHumidityAndPressure] switches to the WinISD-anchored model (engine WINISD_MEASURED_C_REF, ratio-scaled) fed by the app-level Options environment instead of this pane\'s humidity/pressure — exactly WinISD\'s value at the Options defaults.',
  },
  {
    id: 'advAirDensity', label: 'Air density', pane: 'Advanced', kind: 'number', unit: 'kg/m³', precision: 5, min: 0, max: 10,
    provenance: 'calculated', appliesTo: 'all',
    formula: 'ρ = p·Ma/(R·T)·[1 − xv(1 − Mv/Ma)] — CIPM-2007 moist air',
    dependsOn: ['advTemp', 'advHumidity', 'advPressure'],
    description: 'Air density readout, live from T/RH/p (engine air.ts, CIPM-2007 composition as an ideal gas). At 293.15 K / 30 % / 101325 Pa it gives 1.2009621 kg/m³, 8.3 ppm from WinISD\'s measured 1.20095217714682. WinISD 5 dp (1.20095 kg/m³). Ticking [ignoreHumidityAndPressure] switches to the WinISD-anchored model (engine WINISD_MEASURED_RHO_REF, ratio-scaled) fed by the app-level Options environment instead of this pane\'s humidity/pressure — exactly WinISD\'s value at the Options defaults.',
  },

  // ---- Advanced pane: the five simulation-fidelity toggles --------------------------------
  // WinISD's own checkbox column (docs/winisd_screenshots/info/view_6_advanced.md). Three of the five are
  // per-project in WinISD's file format (.wpr [SimulatorOptions] VCInd / FlatResponse /
  // TLPorts); the other two have no known .wpr key. Their exact WinISD behaviour is ⚠ unverified
  // (every sampled .wpr has all three flags at 0) — the semantics OpenISD implements are
  // documented per field below and in docs/research/WINISD_PARITY.md. Design: PLAN_ADVANCED_SIM_OPTIONS.md.
  // Every toggle below must be bound in the shared AdvancedOptions.vue, so none of these can go
  // back to being a decorative checkbox.
  {
    id: 'simVcInductance', label: 'Simulate voice coil inductance', pane: 'Advanced', kind: 'toggle', unit: '',
    provenance: 'entered', appliesTo: 'all',
    description: 'Include voice-coil inductance Le in the ACOUSTIC circuit, not just the impedance plot. WinISD: Advanced → "Simulate voice coil inductance" (.wpr VCInd), default off. This is an alias over OpenISD\'s existing circuit-model switch (store.simVcInductance ↔ P.circuitModel: off = "winisd", on = "gyrator"), not a separate stored flag — docs/research/WINISD_PARITY.md §9. Le stays in the impedance plot either way (⚠ assumption).',
  },
  {
    id: 'forceFlatResponse', label: 'Force flat response', pane: 'Advanced', kind: 'toggle', unit: '',
    provenance: 'entered', appliesTo: 'all',
    description: 'Auto-EQ the system flat: apply the line-level gain that lifts every point to the passband reference, so the excursion / port-velocity / max-SPL curves show what flattening costs. Boost is capped at FLAT_MAX_BOOST_DB (20 dB) and a warn names the frequency where the cap binds. WinISD: Advanced → "Force flat response" (.wpr FlatResponse), default off. ⚠ WinISD\'s own behaviour is unverified — this is the auto-EQ reading, chosen because the flag lives in [SimulatorOptions] beside two physics-model flags rather than in [PlotSettings].',
  },
  {
    id: 'tlPortModel', label: 'Use "transmission line"-model for port simulation', pane: 'Advanced', kind: 'toggle', unit: '',
    provenance: 'entered', appliesTo: ['vented', 'bandpass4'],
    description: 'Model the vent as a lossy acoustic transmission line instead of a lumped air mass, adding the duct\'s own half-wave pipe resonances at c/(2·Leff) — the frequency the Vents pane already reports as "1st port resonance". Reduces to the lumped model exactly as ω→0, so the box tuning is unchanged. This is a transmission-line PORT, not a transmission-line ENCLOSURE (quarter-wave box — still BACKLOG P3). WinISD: Advanced → \'Use "transmission line"-model for port simulation\' (.wpr TLPorts), default off.',
  },
  {
    id: 'rgAtDriverSide', label: 'Rg is at driver side', pane: 'Advanced', kind: 'toggle', unit: '',
    provenance: 'entered', appliesTo: 'all',
    description: 'Place the source/series resistance Rg in series with EACH driver (on) rather than as a single Rg at the amplifier feeding the whole array (off). Only differs when more than one driver is wired: n in parallel see Rg/n at the driver side but a full Rg at the amp side. WinISD: Advanced → "Rg is at driver side"; no known .wpr key. OpenISD defaults this ON (its historic behaviour) where WinISD ships it unchecked — PLAN_ADVANCED_SIM_OPTIONS.md Q3.',
  },
  {
    id: 'splXmaxLimited', label: 'SPL graph is Xmax limited', pane: 'Advanced', kind: 'toggle', unit: '',
    provenance: 'entered', appliesTo: 'all',
    description: 'Plot the SPL chart with the drive backed off wherever peak excursion would exceed Xmax, and shade the limited region. Xmax only — the separate Maximum SPL chart keeps applying the Pe thermal limit as well. The unclamped curve still feeds the transfer-function chart, the F3/F6/F10 read-outs and every compare trace (engine sweep().splXlim is its own array). WinISD: Advanced → "SPL graph is Xmax limited"; no known .wpr key.',
  },
  {
    id: 'ignoreHumidityAndPressure', label: 'Ignore humidity and air pressure (as WinISD does)', pane: 'Advanced', kind: 'toggle', unit: '',
    provenance: 'entered', appliesTo: 'all',
    description: 'Compute air density and sound velocity from the app-level Options environment instead of this project\'s [advHumidity]/[advPressure] (temperature stays the project\'s own), on the WinISD-anchored model (engine air.ts airFor(), WINISD_MEASURED_C_REF/RHO_REF). WinISD stores T/p/phi in the .wpr [Box] section and reads NONE of them — its c/roo come live from its own app-level Options dialog (WINISD_SCHEMA.md §12/§13), which at factory defaults lands on 343.684120962152 / 1.20095217714682. Ledger QO7 rules that OpenISD does the physics by DEFAULT and offers WinISD\'s behaviour as this opt-in, so it ships OFF. Cost of ticking it: SPL differs by about 0.07 dB at 30 °C. PER PROJECT, because T/p/phi are per project in WinISD too.',
  },

  // ============================ DRIVER EDITOR — T/S (Parameters tab) ============================
  // Modeled T/S params. Where OpenISD shows a different unit than WinISD, the dp is unit-adjusted
  // to keep WinISD's resolution (noted per field).
  {
    id: 'Fs', label: 'Fs', pane: 'Driver: Parameters', kind: 'number', unit: 'Hz', precision: 2, min: 1, max: 5000,
    provenance: 'entered', appliesTo: 'all',
    description: 'Driver free-air resonance. WinISD 2 dp (Hz).',
  },
  {
    id: 'Qts', label: 'Qts', pane: 'Driver: Parameters', kind: 'number', unit: '', precision: 3, min: 0, max: 5,
    provenance: 'calculated', appliesTo: 'all',
    formula: 'Qts = Qes·Qms/(Qes+Qms)', dependsOn: ['Qes', 'Qms'],
    description: 'Total driver Q. WinISD 3 dp.',
  },
  {
    id: 'Qes', label: 'Qes', pane: 'Driver: Parameters', kind: 'number', unit: '', precision: 3, min: 0, max: 5,
    provenance: 'entered', appliesTo: 'all',
    description: 'Electrical Q. WinISD 3 dp.',
  },
  {
    id: 'Qms', label: 'Qms', pane: 'Driver: Parameters', kind: 'number', unit: '', precision: 3, min: 0, max: 50,
    provenance: 'entered', appliesTo: 'all',
    description: 'Mechanical Q. WinISD 3 dp.',
  },
  {
    id: 'Vas', label: 'Vas', pane: 'Driver: Parameters', kind: 'number', unit: 'l', precision: 2, min: 0, max: 100,
    provenance: 'entered', appliesTo: 'all',
    description: 'Compliance-equivalent volume. OpenISD shows litres at 2 dp (WinISD editor shows imperial in³; its native metric resolution is ~2 dp l).',
  },
  {
    id: 'Re', label: 'Re', pane: 'Driver: Parameters', kind: 'number', unit: 'ohm', precision: 3, min: 0.01, max: 1000,
    provenance: 'entered', appliesTo: 'all',
    description: 'DC voice-coil resistance. WinISD 3 dp (ohm).',
  },
  {
    id: 'Le', label: 'Le', pane: 'Driver: Parameters', kind: 'number', unit: 'mH', precision: 3, min: 0, max: 0.1,
    provenance: 'entered', appliesTo: 'all',
    description: 'Voice-coil inductance. OpenISD shows mH at 3 dp — equivalent to WinISD\'s 6 dp in H (×1000).',
  },
  {
    id: 'Mms', label: 'Mms', pane: 'Driver: Parameters', kind: 'number', unit: 'g', precision: 2, min: 0, max: 10,
    provenance: 'calculated', appliesTo: 'all',
    formula: 'Mms = 1/((2π·Fs)²·Cms)', dependsOn: ['Fs', 'Cms'],
    description: 'Moving mass. OpenISD shows grams at 2 dp — equivalent to WinISD\'s 5 dp in kg (×1000).',
  },
  {
    id: 'Sd', label: 'Sd', pane: 'Driver: Parameters', kind: 'number', unit: 'cm²', precision: 2, min: 0.0001, max: 10,
    provenance: 'entered', appliesTo: 'all',
    description: 'Effective piston area. OpenISD shows cm² at 2 dp.',
  },
  {
    id: 'Xmax', label: 'Xmax', pane: 'Driver: Parameters', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 0.5,
    provenance: 'entered', appliesTo: 'all',
    description: 'Peak linear excursion. OpenISD shows mm at 2 dp.',
  },
  {
    id: 'Pe', label: 'Pe', pane: 'Driver: Parameters', kind: 'number', unit: 'W', precision: 2, min: 0, max: 100000,
    provenance: 'entered', appliesTo: 'all',
    description: 'Thermal power handling. WinISD 1 dp (W).',
  },
  {
    id: 'Z', label: 'Znom', pane: 'Driver: Parameters', kind: 'number', unit: 'ohm', precision: 3, min: 0, max: 1000,
    provenance: 'entered', appliesTo: 'all',
    description: 'Nominal impedance. WinISD 3 dp (ohm).',
  },
  {
    id: 'Bl', label: 'BL', pane: 'Driver: Parameters', kind: 'number', unit: 'Tm', precision: 3, min: 0, max: 1000,
    provenance: 'calculated', appliesTo: 'all',
    formula: 'Bl = √(2π·Fs·Mms·Re/Qes)', dependsOn: ['Fs', 'Mms', 'Re', 'Qes'],
    description: 'Force factor. OpenISD shows 3 dp; WinISD shows 5 dp — 3 dp is ample for a Tm value.',
  },
  {
    id: 'Cms', label: 'Cms', pane: 'Driver: Parameters', kind: 'number', unit: 'mm/N', precision: 4, min: 0, max: 0.1,
    provenance: 'calculated', appliesTo: 'all',
    formula: 'Cms = Vas/(ρ·c²·Sd²)', dependsOn: ['Vas', 'Sd'],
    description: 'Mechanical compliance. OpenISD shows mm/N at 4 dp (WinISD µm/N, 1 dp).',
  },
  {
    id: 'Rms', label: 'Rms', pane: 'Driver: Parameters', kind: 'number', unit: 'Ns/m', unitGroup: 'resistance', precision: 4, min: 0, max: 1000,
    provenance: 'calculated', appliesTo: 'all',
    formula: 'Rms = 2π·Fs·Mms/Qms', dependsOn: ['Fs', 'Mms', 'Qms'],
    description: 'Mechanical loss resistance. WinISD 5 dp (Ns/m); OpenISD 4 dp.',
  },

  // ============================ DRIVER EDITOR — reference-only (Parameters/Advanced/Dimensions) ============================
  // WinISD fields OpenISD does not model. Recorded for parity/DQ/roadmap; precision/unit are WinISD's.
  { id: 'Dd', label: 'Dd', pane: 'Driver: Parameters', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 2, provenance: 'entered', appliesTo: 'all', description: 'Effective piston diameter, interchangeable with Sd (Sd = π·(Dd/2)²). Rendered on the driver editor in mm at 2 dp — 0.01 mm, finer than WinISD\'s 3 dp of a metre; WinISD offers the same m/mm/cm/in cycle on this field. Stored in metres.' },
  { id: 'fLe', label: 'fLe', pane: 'Driver: Parameters', kind: 'number', unit: 'kHz', precision: 5, min: 0, max: 100000, provenance: 'entered', appliesTo: 'all', description: 'Semi-inductance reference frequency — the frequency at which Le and KLe were measured; 0 = standard Le model only. Raw passthrough (not simulated). STORED IN HERTZ (docs/design/WINISD_SCHEMA.md) and rendered in kHz at 5 dp, as WinISD does, so the editor binds :scale=1e-3.' },
  { id: 'KLe', label: 'KLe', pane: 'Driver: Parameters', kind: 'number', unit: 'H·√Hz', precision: 6, min: 0, max: 10, provenance: 'entered', appliesTo: 'all', description: 'Semi-inductance coefficient (WinISD 6 dp). Raw passthrough only.' },
  { id: 'Hc', label: 'Hc', pane: 'Driver: Parameters', kind: 'number', unit: 'm', precision: 3, min: 0, max: 1, provenance: 'entered', appliesTo: 'all', description: 'Voice-coil height (WinISD 3 dp). Not modelled.' },
  { id: 'Hg', label: 'Hg', pane: 'Driver: Parameters', kind: 'number', unit: 'm', precision: 3, min: 0, max: 1, provenance: 'entered', appliesTo: 'all', description: 'Magnetic gap height (WinISD 3 dp). Not modelled.' },
  { id: 'Vd', label: 'Vd', pane: 'Driver: Parameters', kind: 'number', unit: 'cm³', precision: 0, min: 0, max: 100000, provenance: 'calculated', appliesTo: 'all', description: 'Peak displacement volume = Sd·Xmax (WinISD 0 dp). Not surfaced.' },
  { id: 'Xlim', label: 'Xlim', pane: 'Driver: Parameters', kind: 'number', unit: 'm', precision: 3, min: 0, max: 1, provenance: 'entered', appliesTo: 'all', description: 'Mechanical excursion limit, distinct from Xmax (WinISD 3 dp). Not modelled.' },
  { id: 'no', label: 'no (η₀)', pane: 'Driver: Parameters', kind: 'number', unit: '%', precision: 4, min: 0, max: 100, provenance: 'calculated', appliesTo: 'all', description: 'Reference efficiency (WinISD 4 dp).' },
  { id: 'USPL', label: 'USPL', pane: 'Driver: Parameters', kind: 'number', unit: 'dB', precision: 2, min: 0, max: 200, provenance: 'calculated', appliesTo: 'all', formula: 'USPL = SPL + 10·log₁₀(8/Re)', dependsOn: ['SPL', 'Re'], description: 'Sensitivity referred to a 2.83 V drive rather than 1 W — the 8 is 2.83². An offset from the ONE reference sensitivity (engine efficiency.ts splFromEfficiency), not a second SPL formula. WinISD 2 dp.' },
  { id: 'SPLref', label: 'SPL', pane: 'Driver: Parameters', kind: 'number', unit: 'dB', precision: 2, min: 0, max: 200, provenance: 'calculated', appliesTo: 'all', description: 'Reference sensitivity SPL (WinISD 2 dp).' },
  { id: 'Voicecoils', label: 'Voicecoils', pane: 'Driver: Parameters', kind: 'number', unit: '', precision: 0, min: 1, max: 4, provenance: 'entered', appliesTo: 'all', description: 'Number of voice coils (WinISD integer). OpenISD single-VC only.' },
  { id: 'Connection', label: 'Connection', pane: 'Driver: Parameters', kind: 'enum', unit: '', provenance: 'entered', appliesTo: 'all', options: ['Parallel', 'Series'], description: 'Dual-VC wiring (WinISD). OpenISD models multi-driver wiring separately.' },
  { id: 'AlfaVC', label: 'AlfaVC', pane: 'Driver: Advanced', kind: 'number', unit: '1000/K', precision: 4, min: 0, max: 0.1, provenance: 'entered', appliesTo: 'all', description: 'Voice-coil resistance temperature coefficient — how fast Re grows as the coil heats (copper ≈ 3.9000 = 0.0039/K; also labelled "Voice coil resistance TC" on the Driver placement pane). One HALF of the power-compression pair: it acts ONLY as the product alfaVC·ΔT together with [vcTempRise] — with temp rise 0 it does nothing. Model: Re_hot = Re·(1 + alfaVC·ΔT) (engine hotRe, applied in circuit.ts). Units: UI shows 1000/K; stored/engine SI value = display ÷ 1000 (NumInput :scale=1000). WinISD parity, docs/research/WINISD_PARITY.md.' },
  { id: 'Rt', label: 'R(t)', pane: 'Driver: Advanced', kind: 'number', unit: 'K/W', precision: 5, min: 0, max: 1000, provenance: 'entered', appliesTo: 'all', description: 'Thermal resistance (WinISD 5 dp). Not simulated.' },
  { id: 'Ct', label: 'C(t)', pane: 'Driver: Advanced', kind: 'number', unit: 'J/K', precision: 5, min: 0, max: 10000, provenance: 'entered', appliesTo: 'all', description: 'Thermal capacitance (WinISD 5 dp). Not simulated.' },
  { id: 'EBP', label: 'EBP', pane: 'Driver: Advanced', kind: 'number', unit: 'Hz', precision: 2, min: 0, max: 1000, provenance: 'calculated', appliesTo: 'all', formula: 'EBP = Fs/Qes', dependsOn: ['Fs', 'Qes'], description: 'Efficiency bandwidth product (WinISD 2 dp). OpenISD shows it as a gauge.' },
  { id: 'SPLmaxLF', label: 'SPLmaxLF', pane: 'Driver: Advanced', kind: 'number', unit: 'dB', precision: 2, min: 0, max: 200, provenance: 'calculated', appliesTo: 'all', formula: 'SPLmaxLF = 20·log₁₀(ρ₀·(2π·20)²·Vd / (2π√2) / P0)', dependsOn: ['Vd'], description: 'Excursion-limited max SPL at 20 Hz, closed box (WinISD 2 dp). ρ₀ is the air density in force, so this follows temperature, humidity and pressure unless the WinISD-compatibility toggle is on. Recovered from live WinISD probes to 6.8e-16 (ledger QO32).' },
  { id: 'SPLmax', label: 'SPLmax', pane: 'Driver: Advanced', kind: 'number', unit: 'dB', precision: 2, min: 0, max: 200, provenance: 'calculated', appliesTo: 'all', formula: 'SPLmax = SPL + 10·log₁₀(Pe) − 3', dependsOn: ['SPL', 'Pe'], description: 'Thermally-limited max SPL: the reference sensitivity driven at the rated power. An offset from the ONE reference sensitivity (engine efficiency.ts splFromEfficiency), not a second SPL formula. Blank without a Pe. WinISD 2 dp.' },
  { id: 'Rme', label: 'Rme', pane: 'Driver: Advanced', kind: 'number', unit: 'Ns/m', unitGroup: 'resistance', precision: 5, min: 0, max: 1000, provenance: 'calculated', appliesTo: 'all', formula: 'Rme = 2π·Fs·Mms/Qes (= Bl²/Re)', dependsOn: ['Fs', 'Mms', 'Qes'], description: 'Motional resistance at resonance (WinISD 5 dp). TWO routes, and the order is settled: 2π·Fs·Mms/Qes WINS, Bl²/Re is only the fallback when that one cannot be evaluated. They agree unless the record\'s stored Bl disagrees with its own Fs/Mms/Re/Qes — on Beyma 10BR60/V2 the motional route gives 18.22124 and Bl²/Re gives 18.27846, and WinISD prints the first.' },
  { id: 'gamma', label: 'gamma', pane: 'Driver: Advanced', kind: 'number', unit: 'N/(A·kg)', precision: 5, min: 0, max: 100000, provenance: 'calculated', appliesTo: 'all', formula: 'gamma = Bl/Mms', dependsOn: ['Bl', 'Mms'], description: 'Motor force per unit moving mass — the acceleration one amp buys (WinISD 5 dp).' },
  { id: 'Mpow', label: 'Mpow', pane: 'Driver: Advanced', kind: 'number', unit: 'N/√W', precision: 5, min: 0, max: 1000, provenance: 'calculated', appliesTo: 'all', formula: 'Mpow = √Rme (= Bl/√Re)', dependsOn: ['Rme'], description: 'Motor force per square root of input power (WinISD 5 dp). Taken as √Rme so it cannot contradict the [Rme] beside it; Bl/√Re is the same quantity only on a self-consistent record. ⚠ WinISD\'s own choice between the two routes is unverified.' },
  { id: 'Mcost', label: 'Mcost', pane: 'Driver: Advanced', kind: 'number', unit: 'kg/s', unitGroup: 'resistance', precision: 5, min: 0, max: 1000, provenance: 'calculated', appliesTo: 'all', formula: 'Mcost = Rme·(1 + Xmax/min(Hc, Hg))', dependsOn: ['Rme', 'Xmax', 'Hc', 'Hg'], description: 'Motor figure of merit (WinISD 5 dp). Blank when Hc or Hg is absent or zero, since they are the divisor — which is why it reads 0 across most of the library. Reduces to [Rme] exactly at Xmax = 0. Recovered from live WinISD probes to 1.5e-15 (ledger QO32).' },
  { id: 'Gloss', label: 'Gloss', pane: 'Driver: Advanced', kind: 'number', unit: '%', precision: 4, min: 0, max: 100, provenance: 'calculated', appliesTo: 'all', formula: 'Gloss = g/((2π·Fs)²·Xmax), g = 9.80665', dependsOn: ['Fs', 'Xmax'], description: 'Cone sag under gravity when the driver is mounted horizontally, as a fraction of Xmax (WinISD 4 dp). The record and the .wdr carry the FRACTION; this pane shows the percent, and the ×100 lives only in the input\'s scale. Recovered from live WinISD probes to 3.6e-15 (ledger QO32).' },
  // The Dimensions tab. Every length here is STORED IN METRES and RENDERED IN MILLIMETRES at
  // 2 dp — 0.01 mm, finer than WinISD's 3 dp of a metre, and the same unit the Parameters tab
  // already uses for Xmax/Hc/Hg/Dd. mm is one of the units WinISD itself offers on each of
  // these fields (its unit label cycles m/mm/cm/in/ft/yd — docs/research/WINISD_PARITY.md),
  // so this is a choice of default within WinISD's own set, not a divergence from it.
  // `min`/`max` are in the MODEL's unit (metres, m³) because these fields are rendered.
  { id: 'dimThick', label: 'Basket Plate Thickness (Thick)', pane: 'Driver: Dimensions', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 0.3, provenance: 'entered', appliesTo: 'all', description: 'Frame flange thickness. Carried through .wdr export; not simulated.' },
  { id: 'dimDepth', label: 'Driver Depth (Depth)', pane: 'Driver: Dimensions', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 5, provenance: 'entered', appliesTo: 'all', description: 'Overall driver depth. Carried through .wdr export; not simulated.' },
  { id: 'dimMagnetDepth', label: 'Magnet Depth', pane: 'Driver: Dimensions', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 5, provenance: 'entered', appliesTo: 'all', description: 'Magnet assembly depth. Carried through .wdr export; not simulated.' },
  { id: 'dimMagnet', label: 'Magnet Diameter (Magnet)', pane: 'Driver: Dimensions', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 5, provenance: 'entered', appliesTo: 'all', description: 'Magnet diameter. Not simulated.' },
  { id: 'dimBasket', label: 'Basket Diameter (Basket)', pane: 'Driver: Dimensions', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 5, provenance: 'entered', appliesTo: 'all', description: 'Basket/frame diameter. Not simulated.' },
  { id: 'dimOuter', label: 'Outer Diameter (Outer)', pane: 'Driver: Dimensions', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 5, provenance: 'entered', appliesTo: 'all', description: 'Outer mounting diameter. Not simulated.' },
  { id: 'dimVCd', label: 'Voice Coil Dia (Vcd)', pane: 'Driver: Dimensions', kind: 'number', unit: 'mm', precision: 2, min: 0, max: 1, provenance: 'entered', appliesTo: 'all', description: 'Voice-coil diameter. Not simulated.' },
  { id: 'dimDvol', label: 'Driver Displacement Volume (DVol)', pane: 'Driver: Dimensions', kind: 'number', unit: 'cm³', precision: 2, min: 0, max: 1, provenance: 'entered', appliesTo: 'all', description: 'Basket displacement volume — the box volume the driver itself takes up. Stored in m³, rendered in cm³ (WinISD shows in³ by default and cycles to cm³). Not simulated.' },

  // ============================ DRIVER PLACEMENT ============================
  {
    id: 'nDrivers', label: 'Num. of drivers', pane: 'Driver', kind: 'number', unit: '', precision: 0, min: 1, max: 64,
    provenance: 'entered', appliesTo: 'all',
    description: 'Number of drivers in the system (integer). Drives SPL summation.',
  },
  { id: 'vcTempRise', label: 'Voice coil temp rise', pane: 'Driver', kind: 'number', unit: 'K', precision: 2, min: 0, max: 500, provenance: 'entered', appliesTo: 'all', description: 'Voice-coil temperature rise above ambient (K). The OTHER half of the power-compression pair with [AlfaVC]: together they raise the coil resistance Re_hot = Re·(1 + alfaVC·ΔT) (engine hotRe, circuit.ts), so the same drive voltage pushes less current → SPL drops and the impedance floor rises. Drive voltage eg stays on the cold reference Re, so the drop is real. Stored in K (NumInput :scale=1). 0 = no compression (exact no-op — goldens unchanged). WinISD parity, docs/research/WINISD_PARITY.md.' },
  { id: 'driverAddedMass', label: 'Added mass to cone', pane: 'Driver', kind: 'number', unit: 'g', precision: 5, min: 0, max: 5, provenance: 'entered', appliesTo: 'all', description: 'Mass added to the ACTIVE DRIVER\'s cone (native grams, 5 dp — distinct from [prMadd], the passive-radiator added mass). Model: Mms += Madd, holding Cms/Rms/Bl/Re/Sd/Vas fixed, so Fs = 1/(2π√(Mms·Cms)) lowers and Qms/Qes/Qts rise (engine withAddedMass, applied in sweep()). Units: UI grams, stored/engine kg = display ÷ 1000 (NumInput :scale=1000). Verified vs WinISD: +100 g on a ~14.6 g cone shifts Fs 70→25 Hz (docs/research/WINISD_PARITY.md). 0 = exact no-op.' },

  // ============================ FILTERS ============================
  // OpenISD models 4 filter types (highpass, lowpass, linkwitz, peaking). WinISD's filter fields
  // all display at 3 dp. Filter params are edited via OgFilters; enrolled here for the catalog.
  { id: 'filterFc', label: 'Cutoff / Center freq', pane: 'Filters', kind: 'number', unit: 'Hz', precision: 3, min: 1, max: 20000, provenance: 'entered', appliesTo: 'all', description: 'Filter cutoff / centre frequency. WinISD 3 dp.' },
  { id: 'filterQ', label: 'Q', pane: 'Filters', kind: 'number', unit: '', precision: 3, min: 0.1, max: 100, provenance: 'entered', appliesTo: 'all', description: 'Filter Q. WinISD 3 dp (0.707).' },
  { id: 'filterGain', label: 'Gain', pane: 'Filters', kind: 'number', unit: 'dB', precision: 3, min: -60, max: 60, provenance: 'entered', appliesTo: 'all', description: 'Filter gain (peaking/EQ/static). WinISD 3 dp.' },
  { id: 'filterOrder', label: 'Order', pane: 'Filters', kind: 'number', unit: '', precision: 3, min: 1, max: 8, provenance: 'entered', appliesTo: 'all', description: 'Filter order. Semantically an integer, but WinISD literally displays it at 3 dp (e.g. "2.000") — precision 3 matches that evidence.' },
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
