/** REPO: domain access to the bundled driver collection. Takes a
 *  storage/bundle, returns domain objects. */
import { OpenISDDriver } from '@openisd/model';
// import type { OpenISDDriverJson, MetaField } from '@openisd/model';
// import { recordStandingIsOk } from '@openisd/model/driverStanding';
// import { driverIsSimulatable } from '@openisd/model/driverSimulatability';
import { DriverType, Chip } from '@openisd/design/filter';
// // //
// // // /** The fixed field set the driver-summary/preview panel shows — `SpecField` never crosses this
// // //  *  file's boundary (human ruling 2026-08-24, ENCAPSULATION_AND_LAYERING.md); this is the one
// // //  *  place a small closed field list needs generic dispatch, so it lives here as a switch, not as
// // //  *  a keyed method on `OpenISDDriver`. */
// // // export type DriverSummaryField = 'Fs' | 'Qts' | 'Qes' | 'Qms' | 'Re' | 'Le' | 'Vas' | 'Sd' | 'Xmax' | 'Pe' | 'Znom';
// //
// // function driverFieldValue(driver: OpenISDDriver, field: DriverSummaryField): number | null {
// //   switch (field) {
// //     case 'Fs': return driver.Fs();
// //     case 'Qts': return driver.Qts();
// //     case 'Qes': return driver.Qes();
// //     case 'Qms': return driver.Qms();
// //     case 'Re': return driver.Re();
// //     case 'Le': return driver.Le();
// //     case 'Vas': return driver.Vas();
// //     case 'Sd': return driver.Sd();
// //     case 'Xmax': return driver.Xmax();
// //     case 'Pe': return driver.Pe();
// //     case 'Znom': return driver.Znom();
// //   }
// // }
//
// function driverFieldMeta(driver: OpenISDDriver, field: MetaField): string {
//   switch (field) {
//     case 'brand': return driver.brand();
//     case 'model': return driver.model();
//     case 'manufacturer': return driver.manufacturer();
//     case 'provided_by': return driver.providedBy();
//     case 'comment': return driver.comment();
//     case 'added': return driver.added();
//   }
// }

// The driver commons — index, search, filter, lookup.
//
// A REPO: it answers questions about drivers and hands back records. It takes its
// bundle source as an argument, it does not know a dialog is open, it does not decide what
// happens next, and it never touches app state. "The user chose a driver" is a decision about
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
  /** Set on a bundled row: the driver, already constructed by the model — the composition
   *  root's ONE seam (`bundledEntry()` below) converts the bundle's raw JSON into this DOMAIN
   *  OBJECT; nothing downstream of that seam sees record data (SERIALIZATION_DOCTRINE.md edge 2). */
  record?: OpenISDDriver;
  path?: string; repo?: string | null; branch?: string | null;
  sourceKey?: string; sourceName?: string; sourceUrl?: string; sourceDesc?: string;
  Fs?: number | null; Sd?: number | null; Re?: number | null; Znom?: number | null; Pe?: number | null;
  types?: string[]; canonical?: string;
  freqRange?: { lo: number; hi: number } | null;
  normalisedDate?: string; isLatest?: boolean; isOlder?: boolean;
  /** Set on a My Drivers row: the saved driver itself. Its presence is what makes a row a
   *  user driver rather than a library one — there is no second marker. */
  myDriverData?: OpenISDDriver;
}

/**
 * One driver record in the pre-built bundle, as `scripts/bundle-drivers.mjs` emits it.
 *
 * `record` is typed `OpenISDDriverJson` — the honest name for what the bundler actually
 * wrote. `scripts/bundle-drivers.mjs` copies each driver's canonical record into the artifact
 * verbatim, so this field IS one; calling it anything wider or opaquer would hide that fact
 * from the reader without changing a single byte that crosses.
 *
 * The value is still only ever OPENED once, at `bundledEntry()`, via
 * `OpenISDDriver.fromJsonRecord()` — bundled drivers ship inside this build's own dist and
 * are always current, so no conformance check runs against them the way browser storage's
 * untrusted per-entry blobs need (`docs/design/MY_DRIVERS_STORAGE_FAILURES.md`: "bundled
 * drivers are always current, they ship with the dist").
 */
export interface BundleRecord {
  /** Path within its source, forward-slashed — half of the driver's identity. */
  path: string;
  /** Display name, taken from the record's own brand + model. */
  name: string;
  /** Canonical driver_type as the record states it — authoritative for the chips. */
  driverType?: string;
  /** The device record, unopened. Its shape is private to `@openisd/design`; this row only
   *  carries it as far as the seam that validates it. */
  record: unknown;
}

/** The whole artifact `scripts/bundle-drivers.mjs` writes to `packages/ui/src/drivers-bundle.json`. */
export interface DriverBundle {
  readonly sources: ReadonlyArray<{ readonly key: string; readonly files: readonly BundleRecord[] }>;
  readonly passiveRadiators: readonly BundleRecord[];
}

/**
 * The ONE description of the bundle's shape, and the only way a value becomes a `DriverBundle`.
 *
 * The bundle is a BUILD ARTIFACT: it does not exist when this code is compiled, so no compile-time
 * type can know what is in it and asserting one would be a guess. This looks at the value instead,
 * and it is a COMPLETE proof rather than a partial one — `BundleRecord.record` is `unknown`, so
 * every member of the type is checked here and nothing is left claimed-but-untested.
 *
 * Called from BOTH ends, which is why it lives here rather than in either of them: the bundler
 * runs it over what it assembled and refuses to write a bundle that fails (`bundle-drivers.mjs`
 * runs under vite-node, so it imports this same function), and the app runs it over what it
 * loaded. The build gate is what stops a bad bundle shipping; the startup check is what stops one
 * that shipped anyway from being read as if it were data.
 *
 * Answers EITHER the bundle or everything wrong with it — the same shape as the domain's own
 * record seam — so a caller that reads `.bundle` has been narrowed to a checked value by the
 * compiler, with no assertion anywhere on the path.
 */
export function readBundle(json: unknown): { bundle: DriverBundle } | { problems: string[] } {
  const problems: string[] = [];

  function record(v: unknown, where: string): BundleRecord | null {
    if (typeof v !== 'object' || v === null) {
      problems.push(`${where}: expected an object, got ${v === null ? 'null' : typeof v}`);
      return null;
    }
    const row: { path?: unknown; name?: unknown; driverType?: unknown; record?: unknown } = v;
    if (typeof row.path !== 'string') { problems.push(`${where}.path: expected a string`); return null; }
    if (typeof row.name !== 'string') { problems.push(`${where}.name: expected a string`); return null; }
    if (row.driverType !== undefined && typeof row.driverType !== 'string') {
      problems.push(`${where}.driverType: expected a string when present`);
      return null;
    }
    // `.record` is `unknown` — carried, never opened here. The seam that opens it
    // (`driverFromConformingRecord`) is what says whether it is a usable device.
    return row.driverType === undefined
      ? { path: row.path, name: row.name, record: row.record }
      : { path: row.path, name: row.name, driverType: row.driverType, record: row.record };
  }

  function rows(v: unknown, where: string): BundleRecord[] {
    if (!Array.isArray(v)) { problems.push(`${where}: expected an array`); return []; }
    const out: BundleRecord[] = [];
    v.forEach((r, i) => { const row = record(r, `${where}[${i}]`); if (row !== null) out.push(row); });
    return out;
  }

  if (typeof json !== 'object' || json === null) {
    return { problems: [`the bundle: expected an object, got ${json === null ? 'null' : typeof json}`] };
  }
  const top: { sources?: unknown; passiveRadiators?: unknown } = json;

  const sources: Array<{ key: string; files: BundleRecord[] }> = [];
  if (top.sources !== undefined) {
    if (!Array.isArray(top.sources)) problems.push('sources: expected an array when present');
    else top.sources.forEach((s, i) => {
      if (typeof s !== 'object' || s === null) { problems.push(`sources[${i}]: expected an object`); return; }
      const src: { key?: unknown; files?: unknown } = s;
      if (typeof src.key !== 'string') { problems.push(`sources[${i}].key: expected a string`); return; }
      sources.push({ key: src.key, files: rows(src.files, `sources[${i}].files`) });
    });
  }

  const passiveRadiators = top.passiveRadiators === undefined
    ? []
    : rows(top.passiveRadiators, 'passiveRadiators');

  return problems.length > 0 ? { problems } : { bundle: { sources, passiveRadiators } };
}
//
// /**
//  * A row's identity — what a star is hung on, and what keys the list's `v-for`.
//  *
//  * NOT the display name. A saved driver IS its `<brand>/<model>` (`driverId()` in
//  * myDrivers.ts), which is also the scheme the driver database uses for its folders; a pool
//  * row is its source plus the path it was bundled from. Editing a saved driver's brand or
//  * model therefore produces a DIFFERENT driver, by design — Clone ("Copy of …") is the
//  * deliberate way to fork one — so a star follows the identity, not the row it was clicked on.
//  *
//  * Every route into My Drivers supplies a brand and a model, so a saved driver always has an
//  * identity: the editor's OK is disabled without both, Clone forks to "Copy of …", and a file
//  * loaded from disk takes its model from the file name when the file itself names none.
//  */
// export function driverKey(f: FileEntry, identityOf: (d: OpenISDDriver) => string): string {
//   const my = f.myDriverData;
//   if (my) return `my:${identityOf(my)}`;
//   return `${f.sourceKey || f.sourceName || ''}/${f.path || f.fileName || f.name}`;
// }

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
//
// export function fmtHz(hz: number | string | null | undefined): string | null {
//   if (hz == null) return null;
//   const v = parseFloat(String(hz));
//   if (!isFinite(v)) return null;
//   return v >= 1000 ? (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + 'kHz' : Math.round(v) + 'Hz';
// }

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
// function parseWdrLoose(content: string | undefined): Record<string, string> {
//   const raw: Record<string, string> = {};
//   for (const line of (content || '').split(/\r?\n/)) {
//     const i = line.indexOf('=');
//     if (i < 0 || line.startsWith('[')) continue;
//     raw[line.slice(0, i).trim()] = line.slice(i + 1).trim();
//   }
//   return raw;
// }
//
// /** Shorter source label for the list; the full name stays in the hover tooltip. */
// export function shortSource(name: string | undefined): string {
//   return (name || '').replace(/\s*\([^)]*bundled[^)]*\)/gi, '').trim();
// }

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
export function myDriverName(d: OpenISDDriver): string { return d.displayName(); }
// // // // // // //
// // // // // // // /**
// // // // // // //  * A saved driver as a pool row — the shape selection takes.
// // // // // // //  *
// // // // // // //  * It carries the SAME derived columns a bundled row does (`Fs`, `Sd`, `Znom`, `types`,
// // // // // // //  * …), classified by the one `classifyTypes` the pool uses, because the filter bar reads
// // // // // // //  * those columns and a row that cannot answer them cannot be filtered — which is precisely
// // // // // // //  * how My Drivers came to ignore the type chips and the Fs/Sd/Znom bounds.
// // // // // // //  */
// // // // // // // export function myDriverEntry(d: OpenISDDriver): FileEntry {
// // // // // // //   const name = myDriverName(d);
// // // // // // //   // Read the summary columns through the driver's own accessors, so a value the record STATES
// // // // // // //   // and one the solver DERIVES are both available — the filter bar asks "what is this driver's
// // // // // // //   // Fs", not "did someone type an Fs".
// // // // // // //   const ct = classifyTypes(d.Fs(), d.Sd(), name, d.previewField('driver_type'));
// // // // // // //   return {
// // // // // // //     name, myDriverData: d,
// // // // // // //     Fs: d.Fs(), Sd: d.Sd(), Re: d.Re(),
// // // // // // //     Znom: d.Znom(), Pe: d.Pe(),
// // // // // // //     types: ct.types, canonical: ct.canonical,
// // // // // // //   };
// // // // // // // }
// // // // // //
// // // // // // /**
// // // // // //  * True when a FileEntry is not simulatable (`driverIsSimulatable`,
// // // // // //  * `packages/model/src/driverSimulatability.ts` — Fs, Re, Sd-or-Vas, and at least 2 of
// // // // // //  * {Qts, Qes, Qms}) or the driver's own standing (`recordStandingIsOk`,
// // // // // //  * `packages/model/src/driverStanding.ts`, derived from `quality.missing`/`quality.parse_errors`
// // // // // //  * via `OpenISDDriver.standingEvidence()`) is not OK. THIS is the ⚠ health-warning badge — the
// // // // // //  * ONLY consumer of both predicates. Neither gates bundling or listing (QO79/QO81, John, final
// // // // // //  * ruling: no driver is ever excluded for missing spec params — every structurally readable
// // // // // //  * record bundles and lists; a record missing Fs, or every T/S field, still ships, and this is
// // // // // //  * the flag that surfaces it).
// // // // // //  *
// // // // // //  * For domain objects (bundled or My Drivers, the SAME shape) both checks run directly against
// // // // // //  * the driver. Every driver reaching this function was already constructed at its own read seam
// // // // // //  * — `myDriverRepo.ts`'s `readFull()` (`OpenISDDriver.upgrade()`) for browser storage,
// // // // // //  * `bundledEntry()` above (`OpenISDDriver.fromJsonRecord()`) for the driver corpus (see
// // // // // //  * `bugs/BUG_20260822_driverstanding_throws_on_a_record_with_no_quality_block.md`) — so `quality`
// // // // // //  * is guaranteed present. For federated rows (content not yet fetched) the summary `Fs` / `Re` /
// // // // // //  * `Sd` pre-computed fields are the available proxy — no quality block exists yet to check
// // // // // //  * standing against.
// // // // // //  */
// // // // // // export function driverHasDqIssues(f: FileEntry): boolean {
// // // // // //   // A saved driver and a bundled record are the SAME shape, so one path reads both.
// // // // // //   const driver = f.myDriverData ?? f.record;
// // // // // //   if (driver) {
// // // // // //     return !driverIsSimulatable(driver) || !recordStandingIsOk(driver.standingEvidence());
// // // // // //   }
// // // // // //   // Federated row (content not yet fetched): fall back to pre-computed summary fields.
// // // // // //   const pos2 = (v: number | null | undefined) => typeof v === 'number' && v > 0;
// // // // // //   if (!pos2(f.Fs) || !pos2(f.Re)) return true;
// // // // // //   // Sd summary is in SI (m²); treat null as missing
// // // // // //   if (f.Sd != null && !pos2(f.Sd)) return true;
// // // // // //   return false;
// // // // // // }
// // // // //
// // // // // // ---- search ----------------------------------------------------------------------------
// // // // //
// // // // // /** Everything the filter bar can ask of a row, as data. The controls holding these values
// // // // //  *  live in `logic`; the question they add up to is answered here. */
// // // // // export interface SearchCriteria {
// // // // //   /** Space-separated tokens, all of which must appear in the row's name. */
// // // // //   query: string;
// // // // //   /** chip id → 'include' | 'exclude'. */
// // // // //   typeStates: Record<string, string>;
// // // // //   fsMin: string; fsMax: string;
// // // // //   /** cm² */
// // // // //   sdMin: string; sdMax: string;
// // // // //   /** Nominal impedances to admit, as strings: '4', '8', '16'. */
// // // // //   selZ: string[];
// // // // //   /** When true only rows whose key is in `favorites` are admitted. */
// // // // //   favoritesOnly: boolean;
// // // // //   favorites: readonly string[];
// // // // //   /** How a row's identity is minted, so a favourite can be recognised. */
// // // // //   keyOf: (f: FileEntry) => string;
// // // // // }
// // // //
// // // // /**
// // // //  * The filter bar, as ONE predicate over a pool row — every control at the top of the browser,
// // // //  * in one place.
// // // //  *
// // // //  * It is shared by the bundled pool and by My Drivers because a filter that skips a section is
// // // //  * not a filter: a query matching nothing must not leave unrelated saved drivers on screen
// // // //  * (`_agent_files/rules/openisd-ui-design.md` §"Filters apply to every list"). Two copies of
// // // //  * this logic is how the sections drifted apart in the first place — My Drivers honoured the
// // // //  * text search and Favorites and silently ignored type, Fs, Sd and Znom.
// // // //  *
// // // //  * The scope chip is what selects between the two halves of the library; everything in here
// // // //  * narrows whichever halves it admits.
// // // //  */
// // // // export function matchesCriteria(f: FileEntry, c: SearchCriteria): boolean {
// // // //   const tokens = c.query.toLowerCase().trim().split(/\s+/).filter(Boolean);
// // // //   if (tokens.length && !tokens.every(t => f.name.toLowerCase().includes(t))) return false;
// // // //
// // // //   const included = Object.keys(c.typeStates).filter(k => c.typeStates[k] === 'include');
// // // //   const excluded = Object.keys(c.typeStates).filter(k => c.typeStates[k] === 'exclude');
// // // //   // `unclassified` is derived, never carried in types — a driver is unclassified
// // // //   // exactly when it got no chips at all, so it is filtered separately from the rest.
// // // //   const UNCLASSIFIED = Chip.Unclassified.value;
// // // //   const isUnclassified = !f.types?.length;
// // // //   if (included.length &&
// // // //       !((included.includes(UNCLASSIFIED) && isUnclassified) ||
// // // //         included.filter(t => t !== UNCLASSIFIED).some(t => f.types?.includes(t)))) return false;
// // // //   if (excluded.includes(UNCLASSIFIED) && isUnclassified) return false;
// // // //   if (excluded.filter(t => t !== UNCLASSIFIED).some(t => f.types?.includes(t))) return false;
// // // //
// // // //   const fsMinV = parseFloat(c.fsMin), fsMaxV = parseFloat(c.fsMax);
// // // //   const sdMinV = parseFloat(c.sdMin), sdMaxV = parseFloat(c.sdMax);
// // // //   if (isFinite(fsMinV) && !(f.Fs != null && f.Fs >= fsMinV)) return false;
// // // //   if (isFinite(fsMaxV) && !(f.Fs != null && f.Fs <= fsMaxV)) return false;
// // // //   if (isFinite(sdMinV) && !(f.Sd != null && f.Sd * 1e4 >= sdMinV)) return false;
// // // //   if (isFinite(sdMaxV) && !(f.Sd != null && f.Sd * 1e4 <= sdMaxV)) return false;
// // // //   if (c.selZ.length &&
// // // //       !c.selZ.some(oz => f.Znom != null && Math.abs(f.Znom - parseFloat(oz)) < 1.5)) return false;
// // // //
// // // //   if (c.favoritesOnly && !c.favorites.includes(c.keyOf(f))) return false;
// // // //   return true;
// // // // }
// // //
// // // // ---- preview ---------------------------------------------------------------------------
// // //
// // // export interface PreviewSpec { label: string; value?: string | null; unit?: string }
// // export interface Preview {
// //   name: string;
// //   source?: string;
// //   sourceUrl: string;
// //   providedBy: string | null;
// //   brand: string | null;
// //   model: string | null;
// //   sku?: string | null;
// //   series?: string | null;
// //   description?: string | null;
// //   productImage?: string | null;
// //   manufacturer: string | null;
// //   notes: string | null;
// //   added: string | null;
// //   links: Array<{ href: string; label: string }>;
// //   specs: PreviewSpec[];
// // }
//
// /** Everything the summary pane shows about one row, read straight off the record. */
// export function previewOf(f: FileEntry): Preview {
//   const links = [];
//   if (f.datasheet) links.push({ href: f.datasheet, label: 'Datasheet (PDF)' });
//   if (f.manupage) links.push({ href: f.manupage, label: 'Manufacturer page' });
//   if (f.vendorpage && f.vendorpage !== f.manupage) links.push({ href: f.vendorpage, label: 'Vendor page' });
//   if (f.frd) links.push({ href: f.frd, label: 'FRD / ZMA data' });
//
//   // A saved My Driver and a bundled openisd record are the SAME shape, so one path reads both.
//   // Only a federated `.wdr` needs the text parse below.
//   const driver = f.myDriverData ?? f.record;
//   if (driver) {
//     const scaled = (v: number | null, scale = 1): number | null =>
//       (v != null && isFinite(v * scale) && v !== 0) ? v * scale : null;
//     const n = (field: DriverSummaryField, scale = 1): number | null => scaled(driverFieldValue(driver, field), scale);
//     const meta = (field: MetaField): string | null =>
//       driverFieldMeta(driver, field) || null;
//     const Fs = n('Fs'), Qes = n('Qes');
//     const pathSku = f.path ? f.path.split('/')[1] : null;
//
//     return {
//       name: myDriverName(driver) !== 'Driver' ? myDriverName(driver) : (f.name || 'My Driver'),
//       source: f.myDriverData ? 'My Drivers' : f.sourceName,
//       sourceUrl: f.sourceUrl || '',
//       providedBy: meta('provided_by') ?? '',
//       brand: meta('brand'),
//       model: meta('model'),
//       sku: driver.sku() || pathSku || null,
//       series: driver.previewField('series') || null,
//       description: driver.description() || null,
//       productImage: driver.previewField('product_image') || null,
//       manufacturer: meta('manufacturer'),
//       notes: meta('comment'),
//       added: meta('added'),
//       links,
//       specs: [
//         { label: 'Fs',   value: Fs?.toFixed(1),                            unit: 'Hz'  },
//         { label: 'Qts',  value: n('Qts')?.toFixed(3) },
//         { label: 'Qes',  value: Qes?.toFixed(3) },
//         { label: 'Qms',  value: n('Qms')?.toFixed(3) },
//         { label: 'Re',   value: n('Re')?.toFixed(2),                       unit: 'Ω'   },
//         { label: 'Le',   value: n('Le', 1000)?.toFixed(3),                 unit: 'mH'  },
//         { label: 'Vas',  value: n('Vas', 1000)?.toFixed(2),                unit: 'L'   },
//         { label: 'Sd',   value: n('Sd', 1e4)?.toFixed(1),                  unit: 'cm²' },
//         { label: 'Xmax', value: n('Xmax', 1000)?.toFixed(1),               unit: 'mm'  },
//         { label: 'Pe',   value: n('Pe')?.toFixed(0),                       unit: 'W'   },
//         { label: 'Znom', value: n('Znom')?.toFixed(0),                     unit: 'Ω'   },
//         { label: 'Type', value: f.canonical && f.canonical !== 'Unclassified' ? f.canonical : null },
//         { label: 'EBP',  value: (Fs && Qes) ? (Fs / Qes).toFixed(0) : null },
//       ].filter(s => s.value != null),
//     };
//   }
//
//   const raw = parseWdrLoose(f.content);
//   const n = (k: string): number | null => { const v = parseFloat(raw[k]); return isFinite(v) && v !== 0 ? v : null; };
//   const str = (k: string): string | null => (raw[k] || '').trim() || null;
//   const Fs = n('Fs'), Qes = n('Qes'), Le = n('Le'), Vas = n('Vas'), Sd = n('Sd'), Xmax = n('Xmax');
//   const Mms = n('Mms'), Cms = n('Cms'), Rms = n('Rms'), Vd = n('Vd'), Dia = n('Dia'), noEff = n('no');
//   return {
//     name: f.name,
//     source: f.sourceName,
//     sourceUrl: f.sourceUrl || '',
//     providedBy: str('ProvidedBy'),
//     brand: str('Brand'),
//     model: str('Model'),
//     manufacturer: str('Manufacturer'),
//     notes: str('Comment'),
//     added: str('DateAdded'),
//     links,
//     specs: [
//       { label: 'Fs',     value: Fs?.toFixed(1),                          unit: 'Hz'    },
//       { label: 'Qts',    value: n('Qts')?.toFixed(3) },
//       { label: 'Qes',    value: Qes?.toFixed(3) },
//       { label: 'Qms',    value: n('Qms')?.toFixed(3) },
//       { label: 'Re',     value: n('Re')?.toFixed(2),                     unit: 'Ω'     },
//       { label: 'Znom',   value: n('Znom')?.toFixed(0),                   unit: 'Ω'     },
//       { label: 'Le',     value: Le ? (Le * 1000).toFixed(3) : null,      unit: 'mH'    },
//       { label: 'Bl',     value: n('BL')?.toFixed(2),                     unit: 'T·m'   },
//       { label: 'Vas',    value: Vas ? (Vas * 1000).toFixed(2) : null,    unit: 'L'     },
//       { label: 'Sd',     value: Sd ? (Sd * 1e4).toFixed(1) : null,       unit: 'cm²'   },
//       { label: 'Xmax',   value: Xmax ? (Xmax * 1000).toFixed(1) : null,  unit: 'mm'    },
//       { label: 'Pe',     value: n('Pe')?.toFixed(0),                     unit: 'W'     },
//       { label: 'SPL',    value: n('SPL')?.toFixed(1),                    unit: 'dB'    },
//       { label: 'SPLmax', value: n('SPLmax')?.toFixed(1),                 unit: 'dB'    },
//       { label: 'Mms',    value: Mms ? (Mms * 1000).toFixed(1) : null,    unit: 'g'     },
//       { label: 'Cms',    value: Cms ? (Cms * 1000).toFixed(3) : null,    unit: 'mm/N'  },
//       { label: 'Rms',    value: Rms?.toFixed(2),                         unit: 'N·s/m' },
//       { label: 'Vd',     value: Vd ? (Vd * 1e6).toFixed(1) : null,       unit: 'cm³'   },
//       { label: 'Dia',    value: Dia ? (Dia * 1000).toFixed(0) : null,    unit: 'mm'    },
//       { label: 'η₀',     value: noEff ? (noEff * 100).toFixed(3) : null, unit: '%'     },
//       { label: 'Type',   value: f.canonical && f.canonical !== 'Unclassified' ? f.canonical : null },
//       { label: 'Freq',   value: f.freqRange ? fmtHz(f.freqRange.lo) + '–' + fmtHz(f.freqRange.hi) : null },
//       { label: 'EBP',    value: (Fs && Qes) ? (Fs / Qes).toFixed(0) : null },
//     ].filter(sp => sp.value != null),
//   };
// }

export interface DriverRepo {
  /** Every driver in the pre-built bundle, as pool rows. No network, no file parsing. */
  bundledEntries(): FileEntry[];
}

export interface DriverRepoDeps {
  /** The declared sources, keyed by their short stable id (`drivers/sources.json` v2). */
  sources: Record<string, Omit<SourceEntry, 'key'>>;
  /** The pre-built driver bundle, already checked by `readBundle` — the only way to obtain one. */
  bundle: DriverBundle;
}

export function createDriverRepo(deps: DriverRepoDeps): DriverRepo {
  const sources: SourceEntry[] = Object.entries(deps.sources)
    .map(([key, s]) => ({ key, ...s }));

  // The sources this repo ships inside its own build output, by key. Each file is an
  // `openisd.yml` record (ARCHITECTURE.md AD-8) — the app's own driver shape, already parsed
  // by the bundler, so nothing here parses a file format.
  const bundledByKey: Record<string, readonly BundleRecord[]> = Object.fromEntries(
    deps.bundle.sources.map(s => [s.key, s.files]),
  );

  /**
   * A bundled openisd record as a pool row. THE composition-root seam
   * (SERIALIZATION_DOCTRINE.md edge 2): the bundle's raw JSON is passed through the model
   * ONCE, right here, into a domain object — every downstream reader (the filter bar, the
   * preview pane, the DQ badge) sees `FileEntry.record` as an `OpenISDDriver`, never as data.
   *
   * `f.record` is already typed `OpenISDDriverJson` — the bundler wrote it, so `fromJsonRecord`
   * constructs directly with no conformance check and no `null` outcome.
   */
  function bundledEntry(f: BundleRecord, src: SourceEntry): FileEntry {
    const driver = OpenISDDriver.fromJsonRecord(f.record);
    // `myDriverName()` is the ONE place that decides what a driver is called. A bundled row must
    // read exactly as the same driver reads everywhere else, so it asks rather than rebuilding
    // the rule. The bundler's own path is the only fallback, for a record nothing else names.
    const short = myDriverName(driver);
    const displayName = short === 'Driver' ? f.name : short;

    const ct = classifyTypes(driver.Fs(), driver.Sd(), displayName + ' ' + f.name, f.driverType);
    return {
      name: displayName,
      fileName: f.name,
      record: driver,
      date: normaliseDate(driver.added()),
      // Source links live in the record's own provenance index, keyed by SourceRole — a URL is
      // not a driver field.
      datasheet: driver.dataSourceUrl('manufacturer_datasheet'),
      manupage: driver.dataSourceUrl('manufacturer_product_page'),
      vendorpage: driver.dataSourceUrl('distributor_product_page'),
      frd: '',
      impedance: '',
      path: f.path, repo: null, branch: null,
      sourceKey: src.key,
      sourceName: src.name,
      sourceUrl: src.url || '',
      sourceDesc: src.description || '',
      Fs: driver.Fs(), Sd: driver.Sd(), Re: driver.Re(),
      Znom: driver.Znom(), Pe: driver.Pe(),
      types: ct.types, canonical: ct.canonical,
    };
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
  };
}
