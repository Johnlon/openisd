/**
 * The Filters tab's list-row caption — WinISD's own wording for each filter type
 * (winisd_research: `filter-add-all-1`, `filter-editor-3`/`filter-editor-4`). Pure and
 * exhaustive over `Filter['type']`: a new variant fails to compile here rather than falling
 * through to a generic caption nobody asked for.
 */
import type {Filter, PassFamily} from '@openisd/design/engine';

/** WinISD's Subtype wording, as it appears inside a low/high-pass caption. */
function familyWord(family: PassFamily): string {
  switch (family) {
    case 'butterworth':   return 'Butterworth';
    case 'linkwitzRiley': return 'Linkwitz-Riley';
    case 'bessel':        return 'Bessel';
    case 'sos':           return 'User SOS';
  }
  // No default arm: `PassFamily` is a closed 4-member union.
}

/** Lowpass and highpass share this shape; only the leading word differs. Linkwitz-Riley is
 *  4th order only, so its caption always shows n=4 — never the stored `order` — and only the
 *  User SOS family (fc/Q entered directly, not derived from a Butterworth/Bessel/LR table)
 *  states Q. */
function passCaption(label: 'Lowpass' | 'Highpass', f: Filter & { type: 'lowpass' | 'highpass' }): string {
  const n = f.family === 'linkwitzRiley' ? 4 : f.order;
  const q = f.family === 'sos' ? `, Q=${f.Q.toFixed(3)}` : '';
  return `${label} (${familyWord(f.family)}, n=${n}, fc=${f.fc.toFixed(2)} Hz${q})`;
}

export function filterCaption(f: Filter): string {
  switch (f.type) {
    case 'lowpass':  return passCaption('Lowpass', f);
    case 'highpass': return passCaption('Highpass', f);
    case 'allpass': {
      const q = f.order >= 2 ? `, Q=${f.Q.toFixed(2)}` : '';
      return `Allpass (n=${f.order}, t=${f.t.toFixed(3)} s${q})`;
    }
    case 'linkwitz':
      return `Linkwitz transform (f0=${f.f0.toFixed(2)} Q0=${f.Q0.toFixed(2)} fp=${f.fp.toFixed(2)} Qp=${f.Qp.toFixed(2)})`;
    case 'peaking':
      return `Parametric EQ (fc=${f.fc.toFixed(2)} Hz, Q=${f.Q.toFixed(2)}, Gain=${f.gain.toFixed(2)} dB)`;
    case 'peakHighpass':
      return `Peaking 2nd order highpass (Gpk=${f.gainPk.toFixed(2)} dB fpk=${f.fpk.toFixed(2)} Hz)`;
    case 'staticGain':
      return `Static gain (Gain=${f.gain.toFixed(2)} dB)`;
    case 'raisedCosine':
      return `DLP Raised Cosine (fc=${f.fc.toFixed(2)} Hz, BW=${f.bwOct.toFixed(2)} oct, Gain=${f.gain.toFixed(2)} dB)`;
    case 'lowshelf':
      return `Low shelf (fc ${f.fc.toFixed(0)} Hz · Q ${f.Q.toFixed(2)} · ${f.gain.toFixed(1)} dB)`;
    case 'highshelf':
      return `High shelf (fc ${f.fc.toFixed(0)} Hz · Q ${f.Q.toFixed(2)} · ${f.gain.toFixed(1)} dB)`;
  }
  // No default arm: `Filter['type']` is a closed 10-member union.
}
