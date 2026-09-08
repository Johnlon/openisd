/**
 * Display and search logic for one driver — what it is called, and what classification chips
 * it gets. Neither is a domain fact: `OpenISDDriver` states T/S parameters and a stated
 * `driver_type`, never a display string or a chip set, so this logic lives here rather than on
 * the driver itself (John, 2026-09-05: "this facade... it's not domain logic it's display and
 * search logic").
 */
import type { OpenISDDriver } from '@openisd/design';
import { DriverType, Chip } from '@openisd/design/filter';

/** One row of the preview pane's spec table. `value` is already formatted for display. */
export interface PreviewSpec { label: string; value: string | null; unit?: string }

/** Everything the filter bar can ask of a driver, as data. The controls holding these values
 *  live in `driverBrowsingState.ts`; the question they add up to is answered by `matchesCriteria`. */
export interface SearchCriteria {
  /** Space-separated tokens, all of which must appear in the driver's display name. */
  query: string;
  /** chip id → 'include' | 'exclude'. */
  typeStates: Record<string, string>;
  /** Hz */
  fsMin: string; fsMax: string;
  /** cm² */
  sdMin: string; sdMax: string;
  /** Nominal impedances to admit, as strings: '4', '8', '16'. */
  selZ: string[];
  /** When true only drivers whose id is in `favorites` are admitted. */
  favoritesOnly: boolean;
  favorites: readonly string[];
  /** How a driver's identity is minted, so a favourite can be recognised. */
  idOf: (d: OpenISDDriver) => string;
}

/** The stated T/S numbers of one driver's active section, plus its derived inductance — the
 *  one place those reads live for display and search. Values are SI, exactly as the record
 *  states them; `null` where the driver states nothing. */
export function specSummaryOf(driver: OpenISDDriver): {
  Fs: number | null; Sd: number | null; Re: number | null;
  Qts: number | null; Qes: number | null; Qms: number | null;
  Vas: number | null; Xmax: number | null; Le: number | null;
  Znom: number | null; Pe: number | null;
} {
  const s = driver.spec[driver.section];
  return {
    Fs: s.Fs_hz.get().value, Sd: s.Sd_m2.get().value, Re: s.Re_ohm.get().value,
    Qts: s.Qts.get().value, Qes: s.Qes.get().value, Qms: s.Qms.get().value,
    Vas: s.Vas_m3.get().value, Xmax: s.Xmax_m.get().value, Le: driver.Le_H() ?? null,
    Znom: s.Znom_ohm.get().value, Pe: s.Pe_W.get().value,
  };
}

/** The preview pane's spec table for one driver — formatted rows, zero/absent values dropped. */
export function previewSpecsOf(driver: OpenISDDriver): PreviewSpec[] {
  const n = specSummaryOf(driver);
  const scaled = (v: number | null, scale = 1): number | null =>
    (v != null && isFinite(v * scale) && v !== 0) ? v * scale : null;
  const canonical = chipsOf(driver).canonical;
  const Fs = n.Fs, Qes = n.Qes;
  return [
    { label: 'Fs',   value: scaled(n.Fs)?.toFixed(1) ?? null,          unit: 'Hz'  },
    { label: 'Qts',  value: scaled(n.Qts)?.toFixed(3) ?? null },
    { label: 'Qes',  value: scaled(n.Qes)?.toFixed(3) ?? null },
    { label: 'Qms',  value: scaled(n.Qms)?.toFixed(3) ?? null },
    { label: 'Re',   value: scaled(n.Re)?.toFixed(2) ?? null,          unit: 'Ω'   },
    { label: 'Le',   value: scaled(n.Le, 1000)?.toFixed(3) ?? null,    unit: 'mH'  },
    { label: 'Vas',  value: scaled(n.Vas, 1000)?.toFixed(2) ?? null,   unit: 'L'   },
    { label: 'Sd',   value: scaled(n.Sd, 1e4)?.toFixed(1) ?? null,     unit: 'cm²' },
    { label: 'Xmax', value: scaled(n.Xmax, 1000)?.toFixed(1) ?? null,  unit: 'mm'  },
    { label: 'Pe',   value: scaled(n.Pe)?.toFixed(0) ?? null,          unit: 'W'   },
    { label: 'Znom', value: scaled(n.Znom)?.toFixed(0) ?? null,        unit: 'Ω'   },
    { label: 'Type', value: canonical && canonical !== DriverType.Unclassified.display ? canonical : null },
    { label: 'EBP',  value: (Fs && Qes) ? (Fs / Qes).toFixed(0) : null },
  ].filter(s => s.value != null);
}

/** The preview pane's text block for one driver — meta and provenance, read off the driver's
 *  own accessors. */
export function previewTextOf(driver: OpenISDDriver): {
  brand: string | null; model: string | null; series: string | null; sku: string | null;
  manufacturer: string | null; providedBy: string | null; added: string | null;
  description: string | null; comment: string | null;
} {
  const s = (v: string | null | undefined): string | null => (v && v.length > 0 ? v : null);
  return {
    brand: s(driver.brand.get().value),
    model: s(driver.model.get().value),
    series: s(driver.series),
    sku: s(driver.sku),
    manufacturer: s(driver.manufacturer.get().value),
    providedBy: s(driver.providedBy.get().value),
    added: s(driver.added.get().value),
    description: s(driver.description),
    comment: s(driver.comment.get().value),
  };
}

/**
 * The filter bar as ONE predicate over a driver — every control at the top of the browser, in
 * one place. Shared by the bundled pool and by My Drivers because a filter that skips a section
 * is not a filter (`openisd-ui-design.md` §"Filters apply to every list").
 */
export function matchesCriteria(driver: OpenISDDriver, c: SearchCriteria): boolean {
  const name = displayNameOf(driver).toLowerCase();
  const tokens = c.query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (tokens.length && !tokens.every(t => name.includes(t))) return false;

  const types = chipsOf(driver).types;
  const included = Object.keys(c.typeStates).filter(k => c.typeStates[k] === 'include');
  const excluded = Object.keys(c.typeStates).filter(k => c.typeStates[k] === 'exclude');
  const UNCLASSIFIED = Chip.Unclassified.value;
  const isUnclassified = types.length === 0;
  if (included.length &&
      !((included.includes(UNCLASSIFIED) && isUnclassified) ||
        included.filter(t => t !== UNCLASSIFIED).some(t => types.includes(t)))) return false;
  if (excluded.includes(UNCLASSIFIED) && isUnclassified) return false;
  if (excluded.filter(t => t !== UNCLASSIFIED).some(t => types.includes(t))) return false;

  const { Fs, Sd, Znom } = specSummaryOf(driver);
  const fsMinV = parseFloat(c.fsMin), fsMaxV = parseFloat(c.fsMax);
  const sdMinV = parseFloat(c.sdMin), sdMaxV = parseFloat(c.sdMax);
  if (isFinite(fsMinV) && !(Fs != null && Fs >= fsMinV)) return false;
  if (isFinite(fsMaxV) && !(Fs != null && Fs <= fsMaxV)) return false;
  if (isFinite(sdMinV) && !(Sd != null && Sd * 1e4 >= sdMinV)) return false;
  if (isFinite(sdMaxV) && !(Sd != null && Sd * 1e4 <= sdMaxV)) return false;
  if (c.selZ.length &&
      !c.selZ.some(oz => Znom != null && Math.abs(Znom - parseFloat(oz)) < 1.5)) return false;

  if (c.favoritesOnly && !c.favorites.includes(c.idOf(driver))) return false;
  return true;
}

/** What this driver is called on screen: `<brand> <model>`, or `'Driver'` when it states
 *  neither. Single-driver contexts (the editor, a preview pane) — a list across many drivers
 *  reads this per row, not a separate flattened field. */
export function displayNameOf(driver: OpenISDDriver): string {
  const brand = driver.brand.get().value ?? '';
  const model = driver.model.get().value ?? '';
  return [brand, model].filter(s => s.length > 0).join(' ').trim() || 'Driver';
}

// Name-based matching takes priority over T/S params.
//   sub ⊂ woofer ⊂ bass · mid-bass ⊂ woofer + mid · full-range = woofer + mid + tweet + bass
//   BMR = mid + tweet · PR = orthogonal
const TWEET_PAT     = /\btweet(er)?\b|dome.tweeter|ribbon.tweeter|\bplanar\b|\bAMT\b|air.motion/i;
const SUB_PAT       = /\bsub(woofer)?\b|sub[-_ ]/i;
const WOOFER_PAT    = /\bwoofer\b/i;
const MIDBASS_PAT   = /\bmid[-_ ]?(bass|woof(er)?)\b|\bmidbass\b/i;
const MIDRANGE_PAT  = /\bmid[-_ ]?range\b|\bmidrange\b/i;
const FULLRANGE_PAT = /\bfull[-_ ]?range\b|\bfullrange\b/i;
const BMR_PAT       = /\bBMR\b|balanced.mode/i;
const PR_PAT        = /\bpassive.radiator\b|\bP\.?R\.?\b/i;
const COAX_PAT      = /\bcoax(ial)?\b|coaxial/i;

/**
 * Classification chips for one driver — the scraper-stated `driver_type` when it names a
 * canonical `DriverType`, else the display name, else T/S parameters.
 *
 * Returns chip `.value` strings, not `Chip` members: the result is stored in a Vue ref, and the
 * reactive proxy would break `===` identity on a member held there. `.value` is the serialised
 * form, exactly as for the `driver_type` wire string.
 */
export function chipsOf(driver: OpenISDDriver): { types: string[]; canonical: string } {
  const nm = displayNameOf(driver);
  const spec = driver.spec[driver.section];
  const Fs = spec.Fs_hz.get().value;
  const Sd = spec.Sd_m2.get().value;
  const driverType = driver.driverType();

  const of = (t: DriverType) => ({ types: t.chips.map(c => c.value), canonical: t.display });

  // 1. The scraper-written `driver_type` is authoritative when it is a canonical
  //    DriverType — project it onto the chips the member itself carries and stop.
  //    Never compare against a bare string; DriverType.parse is the one boundary.
  const dt = DriverType.parse(driverType);
  if (dt !== null && dt !== DriverType.Unclassified) return of(dt);

  // 2. No usable driver_type — most bundled records carry `driver_type: null` — so
  //    fall back to the product name, then to T/S parameters.
  const types = new Set<Chip>();
  const canonical: string[] = [];

  if (PR_PAT.test(nm))   return of(DriverType.PassiveRadiator);
  if (COAX_PAT.test(nm)) return of(DriverType.Coaxial);

  if (TWEET_PAT.test(nm)) {
    types.add(Chip.Tweet);
    // Name-only refinement: the wire contract has no ribbon/planar member, so these
    // labels are display detail the enum deliberately does not carry.
    if (/\bAMT\b|air.motion/i.test(nm))  canonical.push(DriverType.Amt.display);
    else if (/\bribbon\b/i.test(nm))     canonical.push('Ribbon Tweeter');
    else if (/\bplanar\b/i.test(nm))     canonical.push('Planar Tweeter');
    else                                 canonical.push(DriverType.Tweeter.display);
  }
  const add = (t: DriverType) => {
    for (const c of t.chips) types.add(c);
    canonical.push(t.display);
  };
  if (SUB_PAT.test(nm))                              add(DriverType.Subwoofer);
  if (MIDBASS_PAT.test(nm))                          add(DriverType.MidBass);
  if (WOOFER_PAT.test(nm) && !MIDBASS_PAT.test(nm))  add(DriverType.Woofer);
  if (MIDRANGE_PAT.test(nm))                         add(DriverType.Midrange);
  if (FULLRANGE_PAT.test(nm))                        add(DriverType.FullRange);
  if (BMR_PAT.test(nm))                              add(DriverType.Bmr);

  if (types.size > 0) return { types: [...types].map(c => c.value), canonical: canonical.join(' / ') };

  const SdCm2 = Sd != null ? Sd * 1e4 : null;
  if (SdCm2 != null && SdCm2 < 12) return of(DriverType.Tweeter);
  if (Fs != null && Fs < 40)       return of(DriverType.Subwoofer);
  return { types: [], canonical: DriverType.Unclassified.display };
}
