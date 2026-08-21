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
      { formulaText: 'Qes = (2π × Fs × Mms × Re) / BL²', inputs: ['Fs', 'Mms', 'Re', 'BL'] }
    ]
  },
  Qms: {
    paths: [
      { formulaText: 'Qms = (Qts × Qes) / (Qes - Qts)', inputs: ['Qts', 'Qes'] },
      { formulaText: 'Qms = (2π × Fs × Mms) / Rms', inputs: ['Fs', 'Mms', 'Rms'] }
    ]
  },
  // Matches driver.ts's actual setVal('Fs', ...) sites, in their file/evaluation order
  // (lines 167, 181, 188, 229) -- NOT WinISD's own priority order (11 > 14 > 2 > 4 > 12, see
  // docs/design/WINISD_SCHEMA.md relation 11). That mismatch is a KNOWN BUG, already ruled on
  // (QO50: engine must match WinISD's five routes), not an open design question -- see
  // bugs/BUG_20260817_engine_is_missing_two_of_winisds_fs_routes_and_has_one_winisd_does_not.md.
  // This list must be updated in the SAME change that fixes driver.ts, not before.
  Fs: {
    paths: [
      { formulaText: 'Fs = 1 / (2π × √(Cms × Mms))', inputs: ['Cms', 'Mms'] },
      { formulaText: 'Fs = (Rms × Qms) / (2π × Mms)', inputs: ['Rms', 'Qms', 'Mms'] },
      { formulaText: 'Fs = (Qes × BL²) / (2π × Mms × Re)', inputs: ['Qes', 'BL', 'Mms', 'Re'] },
      { formulaText: 'Fs = ∛(no × Qes / (CONST_NO × Vas))', inputs: ['no', 'Qes', 'Vas'] }
    ]
  },
  Vas: {
    paths: [
      { formulaText: 'Vas = ρ × c² × Sd² × Cms', inputs: ['Sd', 'Cms'] },
      { formulaText: 'Vas = (Sd² × ρ × c²) / (4π² × Fs² × Mms)', inputs: ['Sd', 'Fs', 'Mms'] }
    ]
  },
  Mms: {
    paths: [
      { formulaText: 'Mms = 1 / (4π² × Fs² × Cms)', inputs: ['Fs', 'Cms'] },
      { formulaText: 'Mms = (BL² × Qes) / (2π × Fs × Re)', inputs: ['BL', 'Qes', 'Fs', 'Re'] }
    ]
  },
  Cms: {
    paths: [
      { formulaText: 'Cms = 1 / (4π² × Fs² × Mms)', inputs: ['Fs', 'Mms'] },
      { formulaText: 'Cms = Vas / (ρ × c² × Sd²)', inputs: ['Vas', 'Sd'] }
    ]
  },
  Rms: {
    paths: [
      { formulaText: 'Rms = (2π × Fs × Mms) / Qms', inputs: ['Fs', 'Mms', 'Qms'] }
    ]
  },
  Re: {
    paths: [
      { formulaText: 'Re = (BL² × Qes) / (2π × Fs × Mms)', inputs: ['BL', 'Qes', 'Fs', 'Mms'] }
    ]
  },
  BL: {
    paths: [
      { formulaText: 'BL = √(2π × Fs × Mms × Re / Qes)', inputs: ['Fs', 'Mms', 'Re', 'Qes'] }
    ]
  },
  Znom: {
    paths: [
      { formulaText: 'Znom = 2 × round_half_to_even(0.75 × Re)', inputs: ['Re'] }
    ]
  },
  // The DVol/Depth/MagDepth/Magnet geometry lock (WINISD_SCHEMA.md §3.10.1): with
  // S = Dd² + Dd·Vcd + Vcd², DVol = (π/4)·[ S·(Depth−MagDepth)/3 + Magnet²·MagDepth ],
  // and each sibling is that equation solved for itself (engine dvolRelation.ts).
  DVol: {
    paths: [
      { formulaText: 'DVol = (π/4)·[ (Dd² + Dd·Vcd + Vcd²)·(Depth − MagDepth)/3 + Magnet²·MagDepth ]',
        inputs: ['Dd', 'Vcd', 'Depth', 'MagDepth', 'Magnet'] }
    ]
  },
  Depth: {
    paths: [
      { formulaText: 'Depth = MagDepth + 3·(4·DVol/π − Magnet²·MagDepth) / (Dd² + Dd·Vcd + Vcd²)',
        inputs: ['Dd', 'Vcd', 'DVol', 'MagDepth', 'Magnet'] }
    ]
  },
  MagDepth: {
    paths: [
      { formulaText: 'MagDepth = (4·DVol/π − S·Depth/3) / (Magnet² − S/3),  S = Dd² + Dd·Vcd + Vcd²',
        inputs: ['Dd', 'Vcd', 'DVol', 'Depth', 'Magnet'] }
    ]
  },
  Magnet: {
    paths: [
      { formulaText: 'Magnet = √[ (4·DVol/π − S·(Depth − MagDepth)/3) / MagDepth ],  S = Dd² + Dd·Vcd + Vcd²',
        inputs: ['Dd', 'Vcd', 'DVol', 'Depth', 'MagDepth'] }
    ]
  },
  Sd: {
    paths: [
      { formulaText: 'Sd = π × (Dd / 2)²', inputs: ['Dd'] },
      { formulaText: 'Sd = √(Vas / (ρ × c² × Cms))', inputs: ['Vas', 'Cms'] }
    ]
  },
  Dd: {
    paths: [
      { formulaText: 'Dd = 2 × √(Sd / π)', inputs: ['Sd'] }
    ]
  },
  Xmax: {
    paths: [
      { formulaText: 'Xmax = |Hc - Hg| / 2', inputs: ['Hc', 'Hg'] }
    ]
  },
  Hc: {
    paths: [
      { formulaText: 'Hc = 2 × Xmax + Hg', inputs: ['Xmax', 'Hg'] }
    ]
  },
  Hg: {
    paths: [
      { formulaText: 'Hg = Hc - 2 × Xmax', inputs: ['Hc', 'Xmax'] }
    ]
  },
  Vd: {
    paths: [
      { formulaText: 'Vd = Sd × Xmax', inputs: ['Sd', 'Xmax'] }
    ]
  },
  no: {
    paths: [
      { formulaText: 'η₀ = (4π² / c³) × (Fs³ × Vas / Qes)', inputs: ['Fs', 'Vas', 'Qes'] }
    ]
  },
  SPL: {
    paths: [
      { formulaText: 'SPL = K + 10 × log₁₀(η₀),  K = 10 × log₁₀(ρ × c / (2π × p_ref²))', inputs: ['no'] }
    ]
  },
  USPL: {
    paths: [
      { formulaText: 'USPL = SPL + 10 × log₁₀(2.83² / Re)', inputs: ['SPL', 'Re'] }
    ]
  },
  EBP: {
    paths: [
      { formulaText: 'EBP = Fs / Qes', inputs: ['Fs', 'Qes'] }
    ]
  },
  Rme: {
    paths: [
      { formulaText: 'Rme = (2π × Fs × Mms) / Qes', inputs: ['Fs', 'Mms', 'Qes'] }
    ]
  },
  gamma: {
    paths: [
      { formulaText: 'γ = BL / Mms', inputs: ['BL', 'Mms'] }
    ]
  },
  // √Rme rather than BL/√Re: the two are the same quantity only on a record whose stored BL
  // agrees with its own Fs/Mms/Re/Qes, and the engine takes the Rme route (driver.ts block 13),
  // so naming BL and Re here would describe a derivation that did not happen.
  Mpow: {
    paths: [
      { formulaText: 'Mpow = √Rme', inputs: ['Rme'] }
    ]
  },
  SPLmax: {
    paths: [
      { formulaText: 'SPLmax = SPL + 10 × log₁₀(Pe) − 3', inputs: ['SPL', 'Pe'] }
    ]
  },
  // The three the solver fills in its full pass (engine driver.ts block 13). Gloss is the
  // FRACTION the .wdr carries; the editor's ×100 is display only.
  Gloss: {
    paths: [
      { formulaText: 'Gloss = g / ((2π × Fs)² × Xmax)', inputs: ['Fs', 'Xmax'] }
    ]
  },
  SPLmaxLF: {
    paths: [
      { formulaText: 'SPLmaxLF = 20 × log₁₀(ρ × (2π × 20)² × Vd / (2π√2) / p_ref)', inputs: ['Vd'] }
    ]
  },
  Mcost: {
    paths: [
      { formulaText: 'Mcost = Rme × (1 + Xmax / min(Hc, Hg))', inputs: ['Rme', 'Xmax', 'Hc', 'Hg'] }
    ]
  }
};

/**
 * Rendered `<label>` text → the field key everything else in this module speaks. The editor
 * identifies a clicked field by reading its label, so a label edit that misses this table
 * silently kills provenance inspection for that field. Full names are WinISD's own
 * (docs/winisd_helpfiles/help/thielesmall.html).
 */
export const LABEL_TO_FIELD_KEY: Record<string, string> = {
  Qes: 'Qes', Qms: 'Qms', Qts: 'Qts', Fs: 'Fs', Vas: 'Vas', Mms: 'Mms', Cms: 'Cms', Rms: 'Rms', Re: 'Re', BL: 'BL',
  Dd: 'Dd', Le: 'Le', Sd: 'Sd', fLe: 'fLe', KLe: 'Le2', Xmax: 'Xmax', Hc: 'Hc', Hg: 'Hg', Vd: 'Vd', Xlim: 'Xlim',
  Pe: 'Pe', no: 'no', Znom: 'Znom', USPL: 'USPL', SPL: 'SPL', Voicecoils: 'numVC',
  AlfaVC: 'tc', 'R(t)': 'Rth', 'C(t)': 'Cth', SPLmaxLF: 'SPLmaxLF', SPLmax: 'SPLmax', Rme: 'Rme',
  gamma: 'gamma', Mpow: 'Mpow', Mcost: 'Mcost', EBP: 'EBP', Gloss: 'Gloss',
  'Basket Plate Thickness (Thick)': 'Thick', 'Driver Depth (Depth)': 'Depth',
  'Magnet Depth (MagDepth)': 'MagDepth', 'Magnet Diameter (Magnet)': 'Magnet',
  'Basket Diameter (Basket)': 'Basket', 'Outer Diameter (Outer)': 'Outer',
  'Voice Coil Dia (Vcd)': 'Vcd', 'Driver Displacement Volume (DVol)': 'DVol',
};

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
