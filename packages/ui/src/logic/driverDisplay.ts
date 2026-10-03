/**
 * Display and search logic for one driver — what it is called, and what classification chips
 * it gets. Neither is a domain fact: `OpenISDDriver` states T/S parameters and a stated
 * `driver_type`, never a display string or a chip set, so this logic lives here rather than on
 * the driver itself (John, 2026-09-05: "this facade... it's not domain logic it's display and
 * search logic").
 */
import type {OpenISDDriver, OpenISDPassiveRadiatorStandalone, Readable} from '@openisd/design';
import type {BundledDriverIndexRow, BundledPassiveRadiatorIndexRow} from '@openisd/persistence';
import {Chip, DriverType} from '@openisd/design/filter';
import {NumberField} from '@openisd/design/fields';

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
  /** When true only subjects whose id is in `favorites` are admitted. */
  favoritesOnly: boolean;
  favorites: readonly string[];
}

/** What the filter bar reads about one candidate — named once, built two ways: from a bundled
 *  index row (the picker lists rows, no domain object) and from a My Drivers domain object. */
export interface SearchSubject {
  /** The record uuid — what a favourite is recognised by. */
  readonly id: string;
  readonly name: string;
  /** `chipsOf(...).types` — the type-chip vocabulary. */
  readonly chips: readonly string[];
  readonly Fs_hz: number | null;
  readonly Sd_m2: number | null;
  readonly Znom_ohm: number | null;
}

export function searchSubjectOfDriver(driver: OpenISDDriver): SearchSubject {
  const s = specSummaryOf(driver);
  return { id: driver.uuid(), name: displayNameOf(driver), chips: chipsOf(driver).types, Fs_hz: s.Fs, Sd_m2: s.Sd, Znom_ohm: s.Znom };
}

export function searchSubjectOfIndexRow(row: BundledDriverIndexRow): SearchSubject {
  return { id: row.uuid, name: row.name, chips: row.chips, Fs_hz: row.Fs_hz, Sd_m2: row.Sd_m2, Znom_ohm: row.Znom_ohm };
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
  const s = driver.specs;
  return {
    Fs: s.Fs_hz.value, Sd: s.Sd_m2.value, Re: s.Re_ohm.value,
    Qts: s.Qts.value, Qes: s.Qes.value, Qms: s.Qms.value,
    Vas: s.Vas_m3.value, Xmax: s.Xmax_m.value, Le: s.Le_H.value,
    Znom: s.Znom_ohm.value, Pe: s.Pe_W.value,
  };
}

/** The preview pane's spec table for one driver — formatted rows, zero/absent values dropped. */
export function previewSpecsOf(driver: OpenISDDriver): PreviewSpec[] {
  const n = specSummaryOf(driver);
  const fmtField = (field: NumberField, v: number | null): { value: string | null; unit?: string } => {
    if (v == null || !isFinite(v) || v === 0) return { value: null };
    return { value: field.format(v), unit: field.unitLabel() };
  };
  const canonical = chipsOf(driver).canonical;
  const ebpVal = driver.ebp();
  return [
    { label: 'Fs',   ...fmtField(NumberField.FS_HZ, n.Fs) },
    { label: 'Qts',  ...fmtField(NumberField.QTS, n.Qts) },
    { label: 'Qes',  ...fmtField(NumberField.QES, n.Qes) },
    { label: 'Qms',  ...fmtField(NumberField.QMS, n.Qms) },
    { label: 'Re',   ...fmtField(NumberField.RE_OHM, n.Re) },
    { label: 'Le',   ...fmtField(NumberField.LE_H, n.Le) },
    { label: 'Vas',  ...fmtField(NumberField.VAS_M3, n.Vas) },
    { label: 'Sd',   ...fmtField(NumberField.SD_M2, n.Sd) },
    { label: 'Xmax', ...fmtField(NumberField.XMAX_M, n.Xmax) },
    { label: 'Pe',   ...fmtField(NumberField.PE_W, n.Pe) },
    { label: 'Znom', ...fmtField(NumberField.ZNOM_OHM, n.Znom) },
    { label: 'Type', value: canonical && canonical !== DriverType.Unclassified.display ? canonical : null },
    { label: 'EBP',  value: ebpVal != null ? NumberField.EBP_HZ.format(ebpVal) : null, unit: NumberField.EBP_HZ.unitLabel() },
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
    brand: s(driver.brand.value),
    model: s(driver.model.value),
    series: s(driver.series.value),
    sku: s(driver.sku.value),
    manufacturer: s(driver.manufacturer.value),
    providedBy: s(driver.providedBy.value),
    added: s(driver.added.value),
    description: s(driver.description.value),
    comment: s(driver.comment.value),
  };
}

/**
 * The filter bar as a single predicate over a subject — every control at the top of the browser,
 * in one place. Shared by the bundled pool and by My Drivers because a filter that skips a section
 * is not a filter (`openisd-ui-design.md` §"Filters apply to every list").
 */
export function matchesCriteria(subject: SearchSubject, c: SearchCriteria): boolean {
  const name = subject.name.toLowerCase();
  const tokens = c.query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (tokens.length && !tokens.every(t => name.includes(t))) return false;

  const types = subject.chips;
  const included = Object.keys(c.typeStates).filter(k => c.typeStates[k] === 'include');
  const excluded = Object.keys(c.typeStates).filter(k => c.typeStates[k] === 'exclude');
  const UNCLASSIFIED = Chip.Unclassified.value;
  const isUnclassified = types.length === 0;
  if (included.length &&
      !((included.includes(UNCLASSIFIED) && isUnclassified) ||
        included.filter(t => t !== UNCLASSIFIED).some(t => types.includes(t)))) return false;
  if (excluded.includes(UNCLASSIFIED) && isUnclassified) return false;
  if (excluded.filter(t => t !== UNCLASSIFIED).some(t => types.includes(t))) return false;

  const { Fs_hz: Fs, Sd_m2: Sd, Znom_ohm: Znom } = subject;
  const fsMinV = parseFloat(c.fsMin), fsMaxV = parseFloat(c.fsMax);
  const sdMinV = parseFloat(c.sdMin), sdMaxV = parseFloat(c.sdMax);
  if (isFinite(fsMinV) && !(Fs != null && Fs >= fsMinV)) return false;
  if (isFinite(fsMaxV) && !(Fs != null && Fs <= fsMaxV)) return false;
  if (isFinite(sdMinV) && !(Sd != null && Sd * 1e4 >= sdMinV)) return false;
  if (isFinite(sdMaxV) && !(Sd != null && Sd * 1e4 <= sdMaxV)) return false;
  if (c.selZ.length &&
      !c.selZ.some(oz => Znom != null && Math.abs(Znom - parseFloat(oz)) < 1.5)) return false;

  if (c.favoritesOnly && !c.favorites.includes(subject.id)) return false;
  return true;
}

/** Whether a driver has missing core T/S fields or non-positive values that indicate DQ issues. */
export function driverHasDqIssues(driver: OpenISDDriver): boolean {
  const s = specSummaryOf(driver);
  return s.Fs === null || s.Fs <= 0 || s.Qts === null || s.Qts <= 0 || s.Vas === null || s.Vas <= 0;
}

/** The radiator's counterpart to `driverHasDqIssues` — the ⚠ on a bundled radiator row.
 *  What tuning one needs: Fs and Sd stated and positive, and a moving mass or a compliance
 *  usable. Proposed rule, 2026-09-14; John owns the physics call. */
export function radiatorHasDqIssues(radiator: OpenISDPassiveRadiatorStandalone): boolean {
  const s = radiator.spec;
  const Fs = s.Fs_hz.value, Sd = s.Sd_m2.value;
  const Mms = s.Mms_kg.value, Cms = s.Cms_m_per_N.value;
  const usable = (v: number | null): boolean => v !== null && v > 0;
  return !usable(Fs) || !usable(Sd) || !(usable(Mms) || usable(Cms));
}

/** A device that states a brand and a model — what naming one on screen needs, and all it
 *  needs. Structural rather than `OpenISDDevice`, which `domain/index.ts` does not export: a
 *  driver and a passive radiator both satisfy it, and neither has to be named here. */
interface NameableDevice {
  readonly brand: Readable<string>;
  readonly model: Readable<string>;
}

/** What this device is called on screen: `<brand> <model>`, or `'Driver'` when it states
 *  neither. Single-device contexts (the editor, a preview pane) — a list across many devices
 *  reads this per row, not a separate flattened field. Serves passive radiators too: a radiator
 *  is named exactly as a driver is. */
export function displayNameOf(driver: NameableDevice): string {
  return [driver.brand.value, driver.model.value].filter(s => s.length > 0).join(' ').trim() || 'Driver';
}

/** One passive-radiator row, as the PR browser renders it: strings only. The radiator itself
 *  stops here — a component holding the domain object would bind its template to the record's
 *  shape and could not be mounted over a substitute (A9), so the row carries the `id` the
 *  component emits back and this layer looks the radiator up again. */
export interface PassiveRadiatorRow {
  /** What the caller identifies this radiator by, and what a click emits: the storage uuid for a
   *  saved radiator, the record uuid for a bundled one. */
  id: string;
  name: string;
  /** `radiatorHasDqIssues` — the ⚠ on the row. */
  dq: boolean;
  /** The three numbers the row's tooltip quotes, formatted with their unit. `'—'` when the
   *  radiator states nothing — a datasheet publishes Sd/Cms and routinely leaves Mms blank. */
  sd: string;
  mms: string;
  cms: string;
}

/** A radiator the caller knows by an id — a My PRs entry. */
export interface PassiveRadiatorEntry {
  readonly id: string;
  readonly radiator: OpenISDPassiveRadiatorStandalone;
}

/** The three figures a row's tooltip quotes, formatted with their unit; `'—'` when the radiator
 *  states nothing — a datasheet publishes Sd/Cms and routinely leaves Mms blank. */
function radiatorRow(id: string, name: string, dq: boolean, sd: number | null, mms: number | null, cms: number | null): PassiveRadiatorRow {
  return {
    id,
    name,
    dq,
    sd: sd === null ? '—' : NumberField.SD_M2.format(sd) + NumberField.SD_M2.unitLabel(),
    mms: mms === null ? '—' : NumberField.MMS_KG.format(mms) + NumberField.MMS_KG.unitLabel(),
    cms: cms === null ? '—' : NumberField.CMS_M_PER_N.format(cms) + NumberField.CMS_M_PER_N.unitLabel(),
  };
}

/** The PR browser's My PRs rows. Takes each radiator with the id its caller knows it by, and
 *  returns what the list renders — no radiator on the way out. */
export function passiveRadiatorRows(entries: readonly PassiveRadiatorEntry[]): PassiveRadiatorRow[] {
  return entries.map(({ id, radiator }) => radiatorRow(
    id, displayNameOf(radiator), radiatorHasDqIssues(radiator),
    radiator.spec.Sd_m2.value, radiator.spec.Mms_kg.value, radiator.spec.Cms_m_per_N.value,
  ));
}

/** The PR browser's bundled rows, straight off the index — the id is the record uuid, which is
 *  what `BundledPassiveRadiatorRepo.load()` takes. */
export function bundledPassiveRadiatorRows(rows: readonly BundledPassiveRadiatorIndexRow[]): PassiveRadiatorRow[] {
  return rows.map(r => radiatorRow(r.uuid, r.name, r.dq, r.Sd_m2, r.Mms_kg, r.Cms_m_per_N));
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
  const spec = driver.specs;
  const Fs = spec.Fs_hz.value;
  const Sd = spec.Sd_m2.value;
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
