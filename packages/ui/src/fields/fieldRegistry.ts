import type { BoxType } from '@openisd/engine';

/**
 * Field registry — the single source of truth for OpenISD's numeric input fields.
 *
 * Each entry captures what every skin and every test needs to agree on for a field:
 * its label, unit, fixed display precision (decimal places), lower bound, whether the
 * value is human-Entered or app-Calculated, the box types it applies to, and — for
 * calculated fields — the closed form and the fields it depends on. The dependency
 * edges (`dependsOn`) turn the flat list into a small knowledge graph of the design's
 * quantities (e.g. `driveV` ← `Pin`, `Re`).
 *
 * Why this is CODE, not a Markdown table: the UI imports `precision(id)` to set each
 * `NumInput :precision`, and the tests import the registry to assert conformance — a
 * prose table can do neither, so it drifts. `docs/winisd/INPUT_PARITY.md` documents the
 * WinISD-sourced dp evidence and points here as the SSOT.
 *
 * Precision is the fixed number of DECIMAL PLACES the field always shows (WinISD
 * convention). It is sourced from the WinISD 0.7.0.950 screenshots — see INPUT_PARITY.md.
 *
 * Scope: the Original (WinISD) skin's numeric fields. Filters and Tune T/S fields are not
 * yet enrolled; add them here (do not reintroduce per-field literals elsewhere).
 */

/** Whether a field's value is supplied by the human or derived by the app. */
export type Provenance = 'entered' | 'calculated';

export interface FieldSpec {
  /** Stable field id — the key the UI and tests reference. */
  id: string;
  /** Human label as shown in the UI (matches the WinISD screenshots). */
  label: string;
  /** Display unit symbol, or '' for dimensionless (e.g. Q). */
  unit: string;
  /** Fixed decimal places the field always shows. */
  precision: number;
  /** Lower bound for entry; omitted where a field may legitimately be any real. */
  min?: number;
  /** Entered by the human, or Calculated by the app. */
  provenance: Provenance;
  /** Box types the field applies to, or 'all' when it is box-type-independent. */
  appliesTo: BoxType[] | 'all';
  /** For calculated fields: the closed form, for documentation and traceability. */
  formula?: string;
  /** For calculated fields: the field ids this value is derived from (graph edges). */
  dependsOn?: string[];
  /** One-line description of what the field is / why it matters. */
  description: string;
}

const FIELDS: FieldSpec[] = [
  // ---- Box / enclosure geometry ------------------------------------------------
  {
    id: 'Vb', label: 'Volume', unit: 'l', precision: 2, min: 0, provenance: 'entered',
    appliesTo: 'all',
    description: 'Net internal enclosure volume (rear chamber for bandpass). WinISD shows 2 dp.',
  },
  {
    id: 'Vf', label: 'Front volume', unit: 'l', precision: 2, min: 0, provenance: 'entered',
    appliesTo: ['bandpass4'],
    description: 'Front (sealed/vented) chamber volume of a bandpass enclosure.',
  },
  {
    id: 'ventD', label: 'Vent diameter', unit: 'cm', precision: 1, min: 0, provenance: 'entered',
    appliesTo: ['vented', 'bandpass4'],
    description: 'Circular port diameter; feeds the tuning solver via port area.',
  },
  {
    id: 'ventL', label: 'Vent length', unit: 'cm', precision: 1, min: 0, provenance: 'entered',
    appliesTo: ['vented', 'bandpass4'],
    description: 'Port length; with diameter sets the tuning frequency Fb.',
  },

  // ---- Passive radiator --------------------------------------------------------
  {
    id: 'prSd', label: 'Sd', unit: 'cm²', precision: 1, min: 0, provenance: 'entered',
    appliesTo: ['pr'],
    description: 'Passive-radiator effective piston area.',
  },
  {
    id: 'prXmax', label: 'Xmax', unit: 'mm', precision: 1, min: 0, provenance: 'entered',
    appliesTo: ['pr'],
    description: 'Passive-radiator peak linear excursion.',
  },
  {
    id: 'prNum', label: 'Num. of PRs', unit: '', precision: 0, min: 0, provenance: 'entered',
    appliesTo: ['pr'],
    description: 'Count of passive radiators (integer).',
  },
  {
    id: 'prMadd', label: 'Added mass to cone', unit: 'g', precision: 1, min: 0, provenance: 'entered',
    appliesTo: ['pr'],
    description: 'Mass added to the passive radiator to tune its Fp.',
  },

  // ---- Signal source -----------------------------------------------------------
  {
    id: 'Pin', label: 'System input power', unit: 'W', precision: 1, min: 0, provenance: 'entered',
    appliesTo: 'all',
    description: 'Primary drive level (power). Voltage is derived from it (P = V²/Re).',
  },
  {
    id: 'driveV', label: 'Driver input voltage (each)', unit: 'V', precision: 1, min: 0,
    provenance: 'calculated', formula: 'driveV = √(Pin · Re)', dependsOn: ['Pin', 'Re'],
    appliesTo: 'all',
    description: 'Per-driver drive voltage; editable and bidirectional with Pin via P = V²/Re.',
  },
  {
    id: 'Rs', label: 'Series resistance', unit: 'ohm', precision: 3, min: 0, provenance: 'entered',
    appliesTo: 'all',
    description: 'Amplifier output + cabling resistance in series with the driver. WinISD shows 3 dp.',
  },

  // ---- Box losses --------------------------------------------------------------
  {
    id: 'Ql', label: 'Leakage Ql', unit: '', precision: 1, min: 0, provenance: 'entered',
    appliesTo: 'all',
    description: 'Enclosure leakage loss Q.',
  },
  {
    id: 'Qa', label: 'Absorption Qa', unit: '', precision: 1, min: 0, provenance: 'entered',
    appliesTo: 'all',
    description: 'Enclosure absorption (fill) loss Q.',
  },
  {
    id: 'Qp', label: 'Port Qp', unit: '', precision: 1, min: 0, provenance: 'entered',
    appliesTo: ['vented', 'bandpass4'],
    description: 'Port (vent) loss Q.',
  },

  // ---- Environment (Advanced) --------------------------------------------------
  {
    id: 'advHumidity', label: 'Relative humidity', unit: '%', precision: 0, min: 0, provenance: 'entered',
    appliesTo: 'all',
    description: 'Ambient relative humidity; contributes to sound velocity / air density.',
  },
  {
    id: 'advPressure', label: 'Air pressure', unit: 'kPa', precision: 1, min: 0, provenance: 'entered',
    appliesTo: 'all',
    description: 'Ambient air pressure; contributes to sound velocity / air density.',
  },
];

const BY_ID = new Map<string, FieldSpec>(FIELDS.map((f) => [f.id, f]));

/** All registered field specs (read-only view). */
export const fieldSpecs: readonly FieldSpec[] = FIELDS;

/** Look up a field spec by id, or undefined if not registered. */
export function fieldById(id: string): FieldSpec | undefined {
  return BY_ID.get(id);
}

/**
 * Fixed display precision (decimal places) for a field. Throws on an unknown id so a
 * typo surfaces at test time rather than silently falling back to a wrong dp.
 */
export function precision(id: string): number {
  const spec = BY_ID.get(id);
  if (!spec) throw new Error(`fieldRegistry: no field "${id}" — add it to fieldRegistry.ts`);
  return spec.precision;
}
