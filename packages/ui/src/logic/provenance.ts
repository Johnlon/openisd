export interface ProvenancePath {
  id: string;
  color: string;
  colorName: string;
  formulaText: string;
  substitutedText?: string;
  inputs: string[];
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

export const PROVENANCE_MAP: Record<string, { paths: Array<{ formulaText: string; inputs: string[] }> }> = {
Qts: {
    paths: [
      { formulaText: 'Qts = (Qes × Qms) / (Qes + Qms)', inputs: ['Qes', 'Qms'] }
    ]
  },
Qes: {
    paths: [
      { formulaText: 'Qes = (Qts × Qms) / (Qms - Qts)', inputs: ['Qts', 'Qms'] },
      { formulaText: 'Qes = (2π × Fs_hz × Mms_kg × Re_ohm) / BL²', inputs: ['Fs_hz', 'Mms_kg', 'Re_ohm', 'BL_Tm'] }
    ]
  },
Qms: {
    paths: [
      { formulaText: 'Qms = (Qts × Qes) / (Qes - Qts)', inputs: ['Qts', 'Qes'] },
      { formulaText: 'Qms = (2π × Fs_hz × Mms_kg) / Rms_kg_per_s', inputs: ['Fs_hz', 'Mms_kg', 'Rms_kg_per_s'] }
    ]
  },
  // One entry per setVal('Fs_hz', ...) site in driver.ts, in that file's evaluation order -- NOT
  // WinISD's own priority order (11 > 14 > 2 > 4 > 12, docs/design/WINISD_SCHEMA.md relation 11).
  // That ordering mismatch is ruled on separately (QO50: the engine must match WinISD's five
  // routes) -- see
  // bugs/BUG_20260817_engine_is_missing_two_of_winisds_fs_routes_and_has_one_winisd_does_not.md.
  // provenance-matches-engine.test.ts holds this list to the engine's site count, so a route
  // added to driver.ts fails there until it is declared here too.
Fs_hz: {
    paths: [
      { formulaText: 'Fs_hz = 1 / (2π × √(Cms_m_per_N × Mms_kg))', inputs: ['Cms_m_per_N', 'Mms_kg'] },
      { formulaText: 'Fs_hz = (Rme_kg_per_s × Qes) / (2π × Mms_kg)', inputs: ['Rme_kg_per_s', 'Qes', 'Mms_kg'] },
      { formulaText: 'Fs_hz = (Qes × BL²) / (2π × Mms_kg × Re_ohm)', inputs: ['Qes', 'BL_Tm', 'Mms_kg', 'Re_ohm'] },
      { formulaText: 'Fs_hz = ∛(no × Qes / (CONST_NO × Vas_m3))', inputs: ['no', 'Qes', 'Vas_m3'] },
      { formulaText: 'Fs_hz = EBP_hz × Qes', inputs: ['EBP_hz', 'Qes'] }
    ]
  },
Vas_m3: {
    paths: [
      { formulaText: 'Vas_m3 = ρ × c² × Sd² × Cms_m_per_N', inputs: ['Sd_m2', 'Cms_m_per_N'] },
      { formulaText: 'Vas_m3 = (Sd² × ρ × c²) / (4π² × Fs² × Mms_kg)', inputs: ['Sd_m2', 'Fs_hz', 'Mms_kg'] }
    ]
  },
Mms_kg: {
    paths: [
      { formulaText: 'Mms_kg = 1 / (4π² × Fs² × Cms_m_per_N)', inputs: ['Fs_hz', 'Cms_m_per_N'] },
      { formulaText: 'Mms_kg = (BL² × Qes) / (2π × Fs_hz × Re_ohm)', inputs: ['BL_Tm', 'Qes', 'Fs_hz', 'Re_ohm'] }
    ]
  },
Cms_m_per_N: {
    paths: [
      { formulaText: 'Cms_m_per_N = 1 / (4π² × Fs² × Mms_kg)', inputs: ['Fs_hz', 'Mms_kg'] },
      { formulaText: 'Cms_m_per_N = Vas_m3 / (ρ × c² × Sd²)', inputs: ['Vas_m3', 'Sd_m2'] }
    ]
  },
Rms_kg_per_s: {
    paths: [
      { formulaText: 'Rms_kg_per_s = (2π × Fs_hz × Mms_kg) / Qms', inputs: ['Fs_hz', 'Mms_kg', 'Qms'] }
    ]
  },
Re_ohm: {
    paths: [
      { formulaText: 'Re_ohm = (BL² × Qes) / (2π × Fs_hz × Mms_kg)', inputs: ['BL_Tm', 'Qes', 'Fs_hz', 'Mms_kg'] }
    ]
  },
BL_Tm: {
    paths: [
      { formulaText: 'BL_Tm = √(2π × Fs_hz × Mms_kg × Re_ohm / Qes)', inputs: ['Fs_hz', 'Mms_kg', 'Re_ohm', 'Qes'] }
    ]
  },
Znom_ohm: {
    paths: [
      { formulaText: 'Znom_ohm = 2 × round_half_to_even(0.75 × Re_ohm)', inputs: ['Re_ohm'] }
    ]
  },
  // The DVol_m3/Depth_m/MagDepth_m/Magnet_m geometry lock (WINISD_SCHEMA.md §3.10.1): with
  // S = Dd² + Dd_m·Vcd_m + Vcd², DVol_m3 = (π/4)·[ S·(Depth_m−MagDepth_m)/3 + Magnet²·MagDepth_m ],
  // and each sibling is that equation solved for itself (engine dvolRelation.ts).
DVol_m3: {
    paths: [
      { formulaText: 'DVol_m3 = (π/4)·[ (Dd² + Dd_m·Vcd_m + Vcd²)·(Depth_m − MagDepth_m)/3 + Magnet²·MagDepth_m ]',
        inputs: ['Dd_m', 'Vcd_m', 'Depth_m', 'MagDepth_m', 'Magnet_m'] }
    ]
  },
Depth_m: {
    paths: [
      { formulaText: 'Depth_m = MagDepth_m + 3·(4·DVol_m3/π − Magnet²·MagDepth_m) / (Dd² + Dd_m·Vcd_m + Vcd²)',
        inputs: ['Dd_m', 'Vcd_m', 'DVol_m3', 'MagDepth_m', 'Magnet_m'] }
    ]
  },
MagDepth_m: {
    paths: [
      { formulaText: 'MagDepth_m = (4·DVol_m3/π − S·Depth_m/3) / (Magnet² − S/3),  S = Dd² + Dd_m·Vcd_m + Vcd²',
        inputs: ['Dd_m', 'Vcd_m', 'DVol_m3', 'Depth_m', 'Magnet_m'] }
    ]
  },
Magnet_m: {
    paths: [
      { formulaText: 'Magnet_m = √[ (4·DVol_m3/π − S·(Depth_m − MagDepth_m)/3) / MagDepth_m ],  S = Dd² + Dd_m·Vcd_m + Vcd²',
        inputs: ['Dd_m', 'Vcd_m', 'DVol_m3', 'Depth_m', 'MagDepth_m'] }
    ]
  },
Sd_m2: {
    paths: [
      { formulaText: 'Sd_m2 = π × (Dd_m / 2)²', inputs: ['Dd_m'] },
      { formulaText: 'Sd_m2 = √(Vas_m3 / (ρ × c² × Cms_m_per_N))', inputs: ['Vas_m3', 'Cms_m_per_N'] }
    ]
  },
Dd_m: {
    paths: [
      { formulaText: 'Dd_m = 2 × √(Sd_m2 / π)', inputs: ['Sd_m2'] }
    ]
  },
Xmax_m: {
    paths: [
      { formulaText: 'Xmax_m = |Hc_m - Hg_m| / 2', inputs: ['Hc_m', 'Hg_m'] }
    ]
  },
Hc_m: {
    paths: [
      { formulaText: 'Hc_m = 2 × Xmax_m + Hg_m', inputs: ['Xmax_m', 'Hg_m'] }
    ]
  },
Hg_m: {
    paths: [
      { formulaText: 'Hg_m = Hc_m - 2 × Xmax_m', inputs: ['Hc_m', 'Xmax_m'] }
    ]
  },
Vd_m3: {
    paths: [
      { formulaText: 'Vd_m3 = Sd_m2 × Xmax_m', inputs: ['Sd_m2', 'Xmax_m'] }
    ]
  },
no: {
    paths: [
      { formulaText: 'η₀ = (4π² / c³) × (Fs³ × Vas_m3 / Qes)', inputs: ['Fs_hz', 'Vas_m3', 'Qes'] }
    ]
  },
SPL_dB: {
    paths: [
      { formulaText: 'SPL_dB = K + 10 × log₁₀(η₀),  K = 10 × log₁₀(ρ × c / (2π × p_ref²))', inputs: ['no'] }
    ]
  },
USPL_dB: {
    paths: [
      { formulaText: 'USPL = SPL_dB + 10 × log₁₀(2.83² / Re_ohm)', inputs: ['SPL_dB', 'Re_ohm'] }
    ]
  },
EBP_hz: {
    paths: [
      { formulaText: 'EBP_hz = Fs_hz / Qes', inputs: ['Fs_hz', 'Qes'] }
    ]
  },
Rme_kg_per_s: {
    paths: [
      { formulaText: 'Rme_kg_per_s = (2π × Fs_hz × Mms_kg) / Qes', inputs: ['Fs_hz', 'Mms_kg', 'Qes'] }
    ]
  },
gamma_m_per_s2_A: {
    paths: [
      { formulaText: 'γ = BL_Tm / Mms_kg', inputs: ['BL_Tm', 'Mms_kg'] }
    ]
  },
  // √Rme_kg_per_s rather than BL_Tm/√Re_ohm: the two are the same quantity only on a record whose stored BL_Tm
  // agrees with its own Fs_hz/Mms_kg/Re_ohm/Qes, and the engine takes the Rme_kg_per_s route (driver.ts block 13),
  // so naming BL_Tm and Re_ohm here would describe a derivation that did not happen.
Mpow_N_per_sqrtW: {
    paths: [
      { formulaText: 'Mpow_N_per_sqrtW = √Rme_kg_per_s', inputs: ['Rme_kg_per_s'] }
    ]
  },
SPLmax_dB: {
    paths: [
      { formulaText: 'SPLmax_dB = SPL_dB + 10 × log₁₀(Pe_W) − 3', inputs: ['SPL_dB', 'Pe_W'] }
    ]
  },
  // The three the solver fills in its full pass (engine driver.ts block 13). Gloss is the
  // FRACTION the .wdr carries; the editor's ×100 is display only.
Gloss: {
    paths: [
      { formulaText: 'Gloss = g / ((2π × Fs_hz)² × Xmax_m)', inputs: ['Fs_hz', 'Xmax_m'] }
    ]
  },
SPLmaxLF_dB: {
    paths: [
      { formulaText: 'SPLmaxLF_dB = 20 × log₁₀(ρ × (2π × 20)² × Vd_m3 / (2π√2) / p_ref)', inputs: ['Vd_m3'] }
    ]
  },
Mcost_kg_per_s: {
    paths: [
      { formulaText: 'Mcost_kg_per_s = Rme_kg_per_s × (1 + Xmax_m / min(Hc_m, Hg_m))', inputs: ['Rme_kg_per_s', 'Xmax_m', 'Hc_m', 'Hg_m'] }
    ]
  },
numVC: {
    paths: [
      { formulaText: 'numVC = 1 — the default single voice coil, applied when no count is entered', inputs: [] }
    ]
  }
};

/**
 * Rendered `<label>` text → the field key everything else in this module speaks. The editor
 * identifies a clicked field by reading its label, so a label edit that misses the table
 * silently kills provenance inspection for that field. Lives on the FIELDS table in
 * fieldKeys.ts (derived from it), never maintained here. Full names are WinISD's own
 * (docs/winisd_helpfiles/help/thielesmall.html).
 */

export function getProvenanceInfo(targetField: string, currentValues?: Record<string, number | null>): ProvenanceInfo | null {
  const spec = PROVENANCE_MAP[targetField];
  if (!spec) return null;

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
