import type {RouteFormula, RouteFormulas} from '@openisd/design/engine';

export interface ProvenancePath {
  id: string;
  color: string;
  colorName: string;
  formulaText: string;
  substitutedText?: string;
  inputs: readonly string[];
}

export interface ProvenanceInfo {
  targetField: string;
  paths: ProvenancePath[];
}

// Field keys are the field table's schema names (`@openisd/design/fields`); the inspector looks
// up a clicked field's key directly, so no label→key map or runtime guard is needed here.

// Assigned to a field's formula paths by index, cycling via modulo if there are more paths
// than colors (see getProvenanceInfo) — not tied to what any given path computes.
export const PATH_COLORS = [
  { color: '#3b82f6', name: 'Primary Formula (Blue)' },
  { color: '#ec4899', name: 'Alternative Formula (Pink)' },
  { color: '#10b981', name: 'Acoustic/Geometry Formula (Emerald)' },
];

/** Each field's formulas in the panel's shape: one per engine route to it, in the order the solver tries them, with the
 *  route's own text and inputs. A field no route works out has no entry. */
export type ProvenanceMap = Readonly<Record<string, {readonly paths: readonly RouteFormula[]}>>;

/** The panel's formulas, from the engine (`engine.driver.routeFormulas()`); T902: this was a hand-typed copy of the
 *  engine's formulas, which drifted from them. */
export function provenanceMap(formulas: RouteFormulas): ProvenanceMap {
  return Object.freeze(Object.fromEntries(Object.entries(formulas).map(([field, paths]) => [field, {paths}])));
}

/**
 * Rendered `<label>` text → the field key everything else in this module speaks. The editor
 * identifies a clicked field by reading its label, so a label edit that misses the table
 * silently kills provenance inspection for that field. Lives on the FIELDS table in
 * fieldKeys.ts (derived from it), never maintained here. Full names are WinISD's own
 * (docs/winisd_helpfiles/help/thielesmall.html).
 */

export function getProvenanceInfo(map: ProvenanceMap, targetField: string, currentValues?: Record<string, number | null>): ProvenanceInfo | null {
  if (!Object.hasOwn(map, targetField)) return null;
  const spec = map[targetField];

  const paths: ProvenancePath[] = spec.paths.map((p, idx) => {
    const colorSpec = PATH_COLORS[idx % PATH_COLORS.length];
    let substitutedText = p.formulaText;

    if (currentValues) {
      for (const inputKey of p.inputs) {
        const val = currentValues[inputKey];
        const valStr = typeof val === 'number' && Number.isFinite(val) ? String(val) : '?';
        substitutedText = substitutedText.replace(new RegExp(`\\b${inputKey}\\b`, 'g'), valStr);
      }
    }

    return {
      id: `path-${idx + 1}`,
      color: colorSpec.color,
      colorName: colorSpec.name,
      formulaText: p.formulaText,
      substitutedText,
      inputs: p.inputs,
    };
  });

  return {
    targetField,
    paths,
  };
}
