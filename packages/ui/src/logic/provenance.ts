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
      { formulaText: 'Qes = (2π × Fs × Mms × Re) / BL²', inputs: ['Fs', 'Mms', 'Re', 'Bl'] }
    ]
  },
  Qms: {
    paths: [
      { formulaText: 'Qms = (Qts × Qes) / (Qes - Qts)', inputs: ['Qts', 'Qes'] },
      { formulaText: 'Qms = (2π × Fs × Mms) / Rms', inputs: ['Fs', 'Mms', 'Rms'] }
    ]
  },
  Fs: {
    paths: [
      { formulaText: 'Fs = 1 / (2π × √(Cms × Mms))', inputs: ['Cms', 'Mms'] },
      { formulaText: 'Fs = 1 / (2π × √(Vas × Mms / (ρ × c² × Sd²)))', inputs: ['Vas', 'Sd', 'Mms'] }
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
      { formulaText: 'Mms = (BL² × Qes) / (2π × Fs × Re)', inputs: ['Bl', 'Qes', 'Fs', 'Re'] }
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
      { formulaText: 'Re = (BL² × Qes) / (2π × Fs × Mms)', inputs: ['Bl', 'Qes', 'Fs', 'Mms'] }
    ]
  },
  Bl: {
    paths: [
      { formulaText: 'BL = √(2π × Fs × Mms × Re / Qes)', inputs: ['Fs', 'Mms', 'Re', 'Qes'] }
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
      { formulaText: 'SPL = 112 + 10 × log₁₀(η₀)', inputs: ['no'] }
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
      { formulaText: 'γ = BL / Mms', inputs: ['Bl', 'Mms'] }
    ]
  },
  Mpow: {
    paths: [
      { formulaText: 'Mpow = BL / √Re', inputs: ['Bl', 'Re'] }
    ]
  }
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
