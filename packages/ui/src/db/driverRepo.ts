/* eslint-disable @typescript-eslint/no-explicit-any */
import type { DriverRaw } from '@openisd/engine';
import type { DriverJSON } from '@openisd/winisd';
import { DriverType, Chip } from '../driverType.js';
import { driverShort } from '../driverName.js';

// The driver commons — index, search, filter, lookup.
//
// A REPOSITORY: it answers questions about drivers and hands back records. It takes its
// bundle source as an argument, it does not know a dialog is open, it does not decide what
// happens next, and it never touches the store. "The user chose a driver" is a decision about
// what the app does next and lives in `logic/`, which calls this to fetch the record.

export interface SourceEntry {
  key: string; name: string; type?: string;
  url?: string; description?: string;
  repo?: string; branch?: string; path?: string;
}

export interface FileEntry {
  name: string;
  fileName?: string;
  content?: string;
  date?: string;
  datasheet?: string; manupage?: string; vendorpage?: string; frd?: string; impedance?: string;
  /** Set on a bundled row: the openisd record itself, already parsed. */
  record?: DriverJSON;
  path?: string; repo?: string | null; branch?: string | null;
  sourceKey?: string; sourceName?: string; sourceUrl?: string; sourceDesc?: string;
  _Fs?: number | null; _Sd?: number | null; _Re?: number | null; _Znom?: number | null; _Pe?: number | null;
  _types?: string[]; _canonical?: string;
  _freqRange?: { lo: number; hi: number } | null;
  _nd?: string; _isLatest?: boolean; _isOlder?: boolean;
  /** Set on a My Drivers row: the saved driver itself. Its presence is what makes a row a
   *  user driver rather than a library one — there is no second marker. */
  myDriverData?: DriverRaw;
}

/** One driver record in the pre-built bundle, as `scripts/bundle-drivers.mjs` emits it. */
export interface BundleRecord {
  /** Path within its source, forward-slashed — half of the driver's identity. */
  path: string;
  /** Display name, taken from the record's own brand + model. */
  name: string;
  /** Canonical driver_type as the record states it — authoritative for the chips. */
  driverType?: string;
  record: DriverJSON;
}

/**
 * A row's identity — what a star is hung on, and what keys the list's `v-for`.
 *
 * NOT the display name. A saved driver IS its `<brand>/<model>` (`driverId()` in
 * myDrivers.ts), which is also the scheme the driver database uses for its folders; a pool
 * row is its source plus the path it was bundled from. Editing a saved driver's brand or
 * model therefore produces a DIFFERENT driver, by design — Clone ("Copy of …") is the
 * deliberate way to fork one — so a star follows the identity, not the row it was clicked on.
 *
 * Every route into My Drivers supplies a brand and a model, so a saved driver always has an
 * identity: the editor's OK is disabled without both, Clone forks to "Copy of …", and a file
 * loaded from disk takes its model from the file name when the file itself names none.
 */
export function driverKey(f: FileEntry, identityOf: (d: DriverRaw) => string): string {
  const my = f.myDriverData;
  if (my) return `my:${identityOf(my)}`;
  return `${f.sourceKey || f.sourceName || ''}/${f.path || f.fileName || f.name}`;
}

// ---- classification -------------------------------------------------------------------
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

// Returns chip `.value` strings, not Chip members: the result is stored in a Vue ref,
// and the reactive proxy would break `===` identity on a member held there. `.value`
// is the serialised form, exactly as for the driver_type wire string.
export function classifyTypes(
  Fs: number | null, Sd: number | null, nameStr: string, driverType?: string,
): { types: string[]; canonical: string } {
  const nm = nameStr || '';

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

export function fmtHz(hz: number | string | null | undefined): string | null {
  if (hz == null) return null;
  const v = parseFloat(String(hz));
  if (!isFinite(v)) return null;
  return v >= 1000 ? (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + 'kHz' : Math.round(v) + 'Hz';
}

/** Normalise any date string to YYYY-MM-DD for comparison and display. */
export function normaliseDate(raw: string | undefined): string {
  if (!raw) return '';
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s;
}

/** Lightweight WDR reader for the preview pane — returns whatever it finds, never throws. */
function parseWdrLoose(content: string | undefined): Record<string, string> {
  const raw: Record<string, string> = {};
  for (const line of (content || '').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i < 0 || line.startsWith('[')) continue;
    raw[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return raw;
}

/** Shorter source label for the list; the full name stays in the hover tooltip. */
export function shortSource(name: string | undefined): string {
  return (name || '').replace(/\s*\([^)]*bundled[^)]*\)/gi, '').trim();
}

/**
 * What a saved driver is called on screen. A My Driver need not carry a `name` — one
 * saved from a record whose brand/model are known has those instead — so the label is
 * derived by the same `driverShort()` the rest of the app displays, never read raw off
 * `.name`.
 *
 * The label is for READING. A driver is IDENTIFIED by `driverId()` (`<brand>/<model>`),
 * which is what the list key and deletion use — two saved drivers may legitimately read
 * the same on screen, and neither may then be undeletable or delete the other.
 */
export function myDriverName(d: DriverRaw): string { return driverShort(d); }

/**
 * A saved driver as a pool row — the shape selection takes.
 *
 * It carries the SAME derived columns a bundled row does (`_Fs`, `_Sd`, `_Znom`, `_types`,
 * …), classified by the one `classifyTypes` the pool uses, because the filter bar reads
 * those columns and a row that cannot answer them cannot be filtered — which is precisely
 * how My Drivers came to ignore the type chips and the Fs/Sd/Znom bounds.
 */
export function myDriverEntry(d: DriverRaw): FileEntry {
  const name = myDriverName(d);
  // No declared type argument: DriverRaw carries no driver_type — that field belongs to the
  // bundled RECORD, not to the driver itself — so a saved driver is classified from its
  // name, Fs and Sd, the same fallback path a .wdr from a GitHub source takes.
  const ct = classifyTypes(d.Fs ?? null, d.Sd ?? null, name);
  return {
    name, myDriverData: d,
    _Fs: d.Fs ?? null, _Sd: d.Sd ?? null, _Re: d.Re ?? null,
    _Znom: d.Z ?? null, _Pe: d.Pe ?? null,
    _types: ct.types, _canonical: ct.canonical,
  };
}

/**
 * True when a FileEntry is missing core simulation fields, or has a required field entered
 * as ≤ 0 (e.g. Fs=0, Re=0), which would block a meaningful simulation.
 *
 * Core required fields for any graph: Fs, Re, Sd or Vas, and at least 2 of {Qts, Qes, Qms}.
 * A driver in the database SHOULD have all of these; flagging the ones that don't lets the
 * user spot incomplete or suspect records at a glance.
 *
 * For bundled records `record.inputs` carries the full DriverRaw bag so every numeric field
 * is checked directly. For federated / My Drivers rows the summary `_Fs` / `_Re` / `_Sd`
 * pre-computed fields are the available proxy.
 */
export function driverHasDqIssues(f: FileEntry): boolean {
  // My Drivers row or bundled record: read directly from the driver bag.
  const inp = (f.myDriverData ?? (f.record?.inputs as DriverRaw | undefined)) as DriverRaw | undefined;
  if (inp) {
    const pos = (v: number | undefined) => typeof v === 'number' && v > 0;
    const hasFsOk  = pos(inp.Fs);
    const hasReOk  = pos(inp.Re);
    const hasSdOk  = pos(inp.Sd) || pos(inp.Vas);   // Sd or Vas is enough for area
    const qCount   = [inp.Qts, inp.Qes, inp.Qms].filter(pos).length;
    return !hasFsOk || !hasReOk || !hasSdOk || qCount < 2;
  }
  // Federated row (content not yet fetched): fall back to pre-computed summary fields.
  const pos2 = (v: number | null | undefined) => typeof v === 'number' && v > 0;
  if (!pos2(f._Fs) || !pos2(f._Re)) return true;
  // Sd summary is in SI (m²); treat null as missing
  if (f._Sd != null && !pos2(f._Sd)) return true;
  return false;
}

// ---- search ----------------------------------------------------------------------------

/** Everything the filter bar can ask of a row, as data. The controls holding these values
 *  live in `logic`; the question they add up to is answered here. */
export interface SearchCriteria {
  /** Space-separated tokens, all of which must appear in the row's name. */
  query: string;
  /** chip id → 'include' | 'exclude'. */
  typeStates: Record<string, string>;
  fsMin: string; fsMax: string;
  /** cm² */
  sdMin: string; sdMax: string;
  /** Nominal impedances to admit, as strings: '4', '8', '16'. */
  selZ: string[];
  /** When true only rows whose key is in `favorites` are admitted. */
  favoritesOnly: boolean;
  favorites: readonly string[];
  /** How a row's identity is minted, so a favourite can be recognised. */
  keyOf: (f: FileEntry) => string;
}

/**
 * The filter bar, as ONE predicate over a pool row — every control at the top of the browser,
 * in one place.
 *
 * It is shared by the bundled pool and by My Drivers because a filter that skips a section is
 * not a filter: a query matching nothing must not leave unrelated saved drivers on screen
 * (`_agent_files/rules/openisd-ui-design.md` §"Filters apply to every list"). Two copies of
 * this logic is how the sections drifted apart in the first place — My Drivers honoured the
 * text search and Favorites and silently ignored type, Fs, Sd and Znom.
 *
 * The scope chip is what selects between the two halves of the library; everything in here
 * narrows whichever halves it admits.
 */
export function matchesCriteria(f: FileEntry, c: SearchCriteria): boolean {
  const tokens = c.query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (tokens.length && !tokens.every(t => f.name.toLowerCase().includes(t))) return false;

  const included = Object.keys(c.typeStates).filter(k => c.typeStates[k] === 'include');
  const excluded = Object.keys(c.typeStates).filter(k => c.typeStates[k] === 'exclude');
  // `unclassified` is derived, never carried in _types — a driver is unclassified
  // exactly when it got no chips at all, so it is filtered separately from the rest.
  const UNCLASSIFIED = Chip.Unclassified.value;
  const isUnclassified = !f._types?.length;
  if (included.length &&
      !((included.includes(UNCLASSIFIED) && isUnclassified) ||
        included.filter(t => t !== UNCLASSIFIED).some(t => f._types?.includes(t)))) return false;
  if (excluded.includes(UNCLASSIFIED) && isUnclassified) return false;
  if (excluded.filter(t => t !== UNCLASSIFIED).some(t => f._types?.includes(t))) return false;

  const fsMinV = parseFloat(c.fsMin), fsMaxV = parseFloat(c.fsMax);
  const sdMinV = parseFloat(c.sdMin), sdMaxV = parseFloat(c.sdMax);
  if (isFinite(fsMinV) && !(f._Fs != null && f._Fs >= fsMinV)) return false;
  if (isFinite(fsMaxV) && !(f._Fs != null && f._Fs <= fsMaxV)) return false;
  if (isFinite(sdMinV) && !(f._Sd != null && f._Sd * 1e4 >= sdMinV)) return false;
  if (isFinite(sdMaxV) && !(f._Sd != null && f._Sd * 1e4 <= sdMaxV)) return false;
  if (c.selZ.length &&
      !c.selZ.some(oz => f._Znom != null && Math.abs(f._Znom - parseFloat(oz)) < 1.5)) return false;

  if (c.favoritesOnly && !c.favorites.includes(c.keyOf(f))) return false;
  return true;
}

// ---- preview ---------------------------------------------------------------------------

export interface PreviewSpec { label: string; value?: string | null; unit?: string }
export interface Preview {
  name: string;
  source?: string;
  sourceUrl: string;
  providedBy: string | null;
  brand: string | null;
  model: string | null;
  sku?: string | null;
  series?: string | null;
  description?: string | null;
  productImage?: string | null;
  manufacturer: string | null;
  notes: string | null;
  added: string | null;
  links: Array<{ href: string; label: string }>;
  specs: PreviewSpec[];
}

/** Everything the summary pane shows about one row, read straight off the record. */
export function previewOf(f: FileEntry): Preview {
  const links = [];
  if (f.datasheet) links.push({ href: f.datasheet, label: 'Datasheet (PDF)' });
  if (f.manupage) links.push({ href: f.manupage, label: 'Manufacturer page' });
  if (f.vendorpage && f.vendorpage !== f.manupage) links.push({ href: f.vendorpage, label: 'Vendor page' });
  if (f.frd) links.push({ href: f.frd, label: 'FRD / ZMA data' });

  // A saved My Driver and a bundled openisd record are both the app's own driver bag —
  // one path reads both. Only a federated `.wdr` needs the text parse below.
  const d = f.myDriverData ?? (f.record?.inputs as DriverRaw | undefined);
  if (d) {
    const n = (v: number | undefined, scale = 1): number | null => (v != null && isFinite(v * scale) && v !== 0) ? v * scale : null;
    const Fs = n(d.Fs), Qes = n(d.Qes);
    const pathSku = f.path ? f.path.split('/')[1] : null;
    const sku = (d as any).sku || pathSku || null;
    const series = (d as any).series || null;
    const description = (d as any).description || null;
    const productImage = (d as any).productImage || null;

    return {
      name: d.name || f.name || 'My Driver',
      source: f.myDriverData ? 'My Drivers' : f.sourceName,
      sourceUrl: f.sourceUrl || '',
      providedBy: d.providedBy || '',
      brand: d.brand || null,
      model: d.model || null,
      sku,
      series,
      description,
      productImage,
      manufacturer: d.manufacturer || null,
      notes: d.comment || null,
      added: d.added || null,
      links,
      specs: [
        { label: 'Fs',   value: Fs?.toFixed(1),                            unit: 'Hz'  },
        { label: 'Qts',  value: n(d.Qts)?.toFixed(3) },
        { label: 'Qes',  value: Qes?.toFixed(3) },
        { label: 'Qms',  value: n(d.Qms)?.toFixed(3) },
        { label: 'Re',   value: n(d.Re)?.toFixed(2),                       unit: 'Ω'   },
        { label: 'Le',   value: d.Le ? (d.Le * 1000).toFixed(3) : null,    unit: 'mH'  },
        { label: 'Vas',  value: d.Vas ? (d.Vas * 1000).toFixed(2) : null,  unit: 'L'   },
        { label: 'Sd',   value: d.Sd ? (d.Sd * 1e4).toFixed(1) : null,     unit: 'cm²' },
        { label: 'Xmax', value: d.Xmax ? (d.Xmax * 1000).toFixed(1) : null, unit: 'mm' },
        { label: 'Pe',   value: n(d.Pe)?.toFixed(0),                       unit: 'W'   },
        { label: 'Znom', value: n(d.Z)?.toFixed(0),                        unit: 'Ω'   },
        { label: 'Type', value: f._canonical && f._canonical !== 'Unclassified' ? f._canonical : null },
        { label: 'EBP',  value: (Fs && Qes) ? (Fs / Qes).toFixed(0) : null },
      ].filter(s => s.value != null),
    };
  }

  const raw = parseWdrLoose(f.content);
  const n = (k: string): number | null => { const v = parseFloat(raw[k]); return isFinite(v) && v !== 0 ? v : null; };
  const str = (k: string): string | null => (raw[k] || '').trim() || null;
  const Fs = n('Fs'), Qes = n('Qes'), Le = n('Le'), Vas = n('Vas'), Sd = n('Sd'), Xmax = n('Xmax');
  const Mms = n('Mms'), Cms = n('Cms'), Rms = n('Rms'), Vd = n('Vd'), Dia = n('Dia'), noEff = n('no');
  return {
    name: f.name,
    source: f.sourceName,
    sourceUrl: f.sourceUrl || '',
    providedBy: str('ProvidedBy'),
    brand: str('Brand'),
    model: str('Model'),
    manufacturer: str('Manufacturer'),
    notes: str('Comment'),
    added: str('DateAdded'),
    links,
    specs: [
      { label: 'Fs',     value: Fs?.toFixed(1),                          unit: 'Hz'    },
      { label: 'Qts',    value: n('Qts')?.toFixed(3) },
      { label: 'Qes',    value: Qes?.toFixed(3) },
      { label: 'Qms',    value: n('Qms')?.toFixed(3) },
      { label: 'Re',     value: n('Re')?.toFixed(2),                     unit: 'Ω'     },
      { label: 'Znom',   value: n('Znom')?.toFixed(0),                   unit: 'Ω'     },
      { label: 'Le',     value: Le ? (Le * 1000).toFixed(3) : null,      unit: 'mH'    },
      { label: 'Bl',     value: n('BL')?.toFixed(2),                     unit: 'T·m'   },
      { label: 'Vas',    value: Vas ? (Vas * 1000).toFixed(2) : null,    unit: 'L'     },
      { label: 'Sd',     value: Sd ? (Sd * 1e4).toFixed(1) : null,       unit: 'cm²'   },
      { label: 'Xmax',   value: Xmax ? (Xmax * 1000).toFixed(1) : null,  unit: 'mm'    },
      { label: 'Pe',     value: n('Pe')?.toFixed(0),                     unit: 'W'     },
      { label: 'SPL',    value: n('SPL')?.toFixed(1),                    unit: 'dB'    },
      { label: 'SPLmax', value: n('SPLmax')?.toFixed(1),                 unit: 'dB'    },
      { label: 'Mms',    value: Mms ? (Mms * 1000).toFixed(1) : null,    unit: 'g'     },
      { label: 'Cms',    value: Cms ? (Cms * 1000).toFixed(3) : null,    unit: 'mm/N'  },
      { label: 'Rms',    value: Rms?.toFixed(2),                         unit: 'N·s/m' },
      { label: 'Vd',     value: Vd ? (Vd * 1e6).toFixed(1) : null,       unit: 'cm³'   },
      { label: 'Dia',    value: Dia ? (Dia * 1000).toFixed(0) : null,    unit: 'mm'    },
      { label: 'η₀',     value: noEff ? (noEff * 100).toFixed(3) : null, unit: '%'     },
      { label: 'Type',   value: f._canonical && f._canonical !== 'Unclassified' ? f._canonical : null },
      { label: 'Freq',   value: f._freqRange ? fmtHz(f._freqRange.lo) + '–' + fmtHz(f._freqRange.hi) : null },
      { label: 'EBP',    value: (Fs && Qes) ? (Fs / Qes).toFixed(0) : null },
    ].filter(sp => sp.value != null),
  };
}

// ---- federated GitHub sources ----------------------------------------------------------

/** owner/repo, or a github.com URL with an optional branch and subfolder. */
export function parseRepoInput(s: string): SourceEntry | null {
  s = s.trim(); if (!s) return null;
  let m = s.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+)(?:\/(.*))?)?$/i);
  if (m) return { key: m[1] + '/' + m[2], name: m[1] + '/' + m[2], type: 'github', repo: m[1] + '/' + m[2], branch: m[3] || '', path: m[4] || '' };
  m = s.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (m) return { key: s, name: s, type: 'github', repo: s, branch: '', path: '' };
  return null;
}

/** What one source contributed, and anything the caller should tell the user. */
export interface SourceFetch {
  sourceName: string;
  /** The rows this source contributes, or null when it could not be listed at all — a
   *  source that will not list is reported by its absence, not by a crash. */
  entries: FileEntry[] | null;
  /** A message the caller should show, or null when there is nothing to say. */
  error: string | null;
}

export interface DriverRepo {
  /** Every driver in the pre-built bundle, as pool rows. No network, no file parsing. */
  bundledEntries(): FileEntry[];
  /** The declared sources that are NOT bundled, resolved to owner/repo/branch/path. */
  liveSources(): SourceEntry[];
  /** List one GitHub source's `.wdr` files as pool rows. */
  fetchSource(src: SourceEntry): Promise<SourceFetch>;
}

export interface DriverRepoDeps {
  /** The declared sources, keyed by their short stable id (`drivers/sources.json` v2). */
  sources: Record<string, Omit<SourceEntry, 'key'>>;
  /** The pre-built driver bundle: `{ sources: [{ key, files }] }`. */
  bundle: { sources?: Array<{ key: string; files: BundleRecord[] }> };
}

export function createDriverRepo(deps: DriverRepoDeps): DriverRepo {
  const sources: SourceEntry[] = Object.entries(deps.sources)
    .map(([key, s]) => ({ key, ...s }));

  // The sources this repo ships inside its own build output, by key. Each file is an
  // `openisd.yml` record (ARCHITECTURE.md AD-8) — the app's own driver shape, already parsed
  // by the bundler, so nothing here parses a file format. A source that is bundled is not
  // fetched from GitHub: bundled and federated are exclusive.
  const bundledByKey: Record<string, BundleRecord[]> = Object.fromEntries(
    (deps.bundle.sources ?? []).map(s => [s.key, s.files]),
  );

  /**
   * A bundled openisd record as a pool row. The record is the app's own driver shape, so
   * every field is read straight off `inputs` — no file format is parsed here.
   */
  function bundledEntry(f: BundleRecord, src: SourceEntry): FileEntry {
    const inp = (f.record?.inputs ?? {}) as DriverRaw;

    // `driverShort()` is the ONE place that decides what a driver is called — brand-led, with
    // manufacturer trailing only when it differs. A bundled row must read exactly as the same
    // driver reads everywhere else, so it asks rather than rebuilding the rule. The bundler's
    // own path is the only fallback, for a record with nothing to name it by.
    const short = driverShort(inp);
    const displayName = short === 'Driver' ? f.name : short;

    const ct = classifyTypes(inp.Fs ?? null, inp.Sd ?? null, displayName + ' ' + f.name, f.driverType);
    return {
      name: displayName,
      fileName: f.name,
      record: f.record,
      date: normaliseDate(inp.added),
      datasheet: inp.datasheetUrl || '',
      manupage: inp.manuPageUrl || '',
      vendorpage: inp.distributorPageUrl || '',
      frd: inp.frdUrl || '',
      impedance: inp.impedanceUrl || '',
      path: f.path, repo: null, branch: null,
      sourceKey: src.key,
      sourceName: src.name,
      sourceUrl: src.url || '',
      sourceDesc: src.description || '',
      _Fs: inp.Fs ?? null, _Sd: inp.Sd ?? null, _Re: inp.Re ?? null,
      _Znom: inp.Z ?? null, _Pe: inp.Pe ?? null,
      _types: ct.types, _canonical: ct.canonical,
    };
  }

  async function ghDefaultBranch(repo: string): Promise<string> {
    const r = await fetch(`https://api.github.com/repos/${repo}`);
    if (!r.ok) throw new Error('repo not found (' + r.status + ')');
    return (await r.json()).default_branch || 'main';
  }

  return {
    bundledEntries() {
      const out: FileEntry[] = [];
      for (const src of sources) {
        const files = bundledByKey[src.key];
        if (!files) continue;
        for (const f of files) out.push(bundledEntry(f, src));
      }
      return out;
    },

    liveSources() {
      return sources
        .filter(src => !bundledByKey[src.key])
        .map(src => {
          const m = src.url?.match(/github\.com\/([^/]+\/[^/]+?)(?:\/tree\/([^/]+)(?:\/(.*?))?)?(?:\.git)?$/i);
          return m ? { ...src, repo: m[1], branch: m[2] || '', path: m[3] || '' } : src;
        })
        .filter(s => s.repo);
    },

    async fetchSource(src) {
      try {
        const branch = src.branch || await ghDefaultBranch(src.repo!);
        const r = await fetch(`https://api.github.com/repos/${src.repo}/git/trees/${branch}?recursive=1`);
        if (!r.ok) return { sourceName: src.name, entries: null, error: null };
        const result = await r.json();
        if (result.truncated) {
          return {
            sourceName: src.name,
            entries: null,
            error: `Repo "${src.name}" is too large to list fully. Specify a direct subfolder in the URL — e.g. github.com/${src.repo}/tree/main/drivers — so only that folder is scanned.`,
          };
        }
        const tree: Array<{ path: string; type: string }> = result.tree || [];
        const base = (src.path || '').replace(/^\/|\/$/g, '');
        const entries = tree
          .filter(t => t.type === 'blob' && t.path.toLowerCase().endsWith('.wdr')
            && (!base || t.path.toLowerCase().startsWith(base.toLowerCase() + '/')))
          .map(t => {
            const nm = t.path.split('/').pop()!.replace(/\.wdr$/i, '');
            const ct = classifyTypes(null, null, nm);
            return {
              path: t.path, branch, repo: src.repo,
              name: nm,
              sourceKey: src.key,
              sourceName: src.name,
              sourceUrl: src.url || '',
              sourceDesc: src.description || '',
              // _ properties are computed at client runtime from WDR content — not in the bundle JSON
              _Fs: null, _Sd: null, _Re: null, _Znom: null, _Pe: null,
              _types: ct.types, _canonical: ct.canonical,
            } satisfies FileEntry;
          });
        return { sourceName: src.name, entries, error: null };
      } catch {
        return { sourceName: src.name, entries: null, error: null };
      }
    },
  };
}
