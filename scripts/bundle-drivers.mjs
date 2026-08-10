#!/usr/bin/env node
/**
 * bundle-drivers.mjs
 *
 * Pre-bundles the driver records of every bundled collection into
 * packages/ui/src/drivers-bundle.json, so the app loads them instantly without hitting
 * the GitHub API.
 *
 * "Bundled" = a source in drivers/sources.json whose GitHub URL names a repo that is
 * checked out locally: this repo, or a sibling beside it (winisd_drivers holds the
 * driver database). A source whose repo is not on disk stays federated — the app
 * fetches it live from the GitHub API at runtime.
 *
 * FORMAT — `openisd.yml` EXCLUSIVELY, at <collection>/<brand>/<sku>/openisd.yml. It is
 * the canonical driver record (ARCHITECTURE.md AD-8), written by winisd_tools.
 *
 * Nothing else is read. `.owdr` is purely a UI concern — the extension the app writes
 * and reads when a user saves a driver to their own disk — and never appears in a
 * collection. `.wdr` is WinISD's file format, which the app reads and writes in memory
 * from a driver record: an import/export concern, not a library record.
 *
 * PROJECTION — the bundle carries the app's own driver shape (`DriverJSON`), not the
 * raw record. `openisd.yml` states every value with its origin, its printed reading, its
 * precision and its definition; the browser needs the resolved numbers. Projecting one
 * canonical record onto a different output format is a required step (AD-8), and it is
 * what keeps the bundle at ~1 MB instead of the corpus's ~16 MB of provenance prose.
 *
 * Run automatically via `npm run dev` / `npm run build` (predev/prebuild hook).
 * Can also be run manually: node scripts/bundle-drivers.mjs
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'fs';
import { join, relative, resolve, sep } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

const RECORD_FILE = 'openisd.yml';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const WORKSPACE = join(ROOT, '..');
const sources = JSON.parse(
  readFileSync(join(ROOT, 'drivers/sources.json'), 'utf8')
).sources;

/**
 * Where a local source's records live. `path` is relative to this repo, so a sibling
 * repo is `../<repo>/…` — these repos reference each other by path, never by GitHub URL.
 * Anything resolving outside the workspace is refused rather than bundled.
 */
function localPathOf(src) {
  if (!src.path) return null;                       // no path ⇒ federated, not ours to bundle
  const resolved = resolve(ROOT, src.path);
  const inside = resolve(WORKSPACE);
  if (resolved !== inside && !resolved.startsWith(inside + sep)) {
    console.warn(`  REFUSED path outside the workspace: ${src.path}`);
    return null;
  }
  return existsSync(resolved) ? resolved : undefined;   // undefined ⇒ declared but absent
}

function walkRecords(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith('_')) continue;   // _ dirs are cache/scratch — never bundled
      files.push(...walkRecords(join(dir, entry.name)));
    } else if (entry.name.toLowerCase() === RECORD_FILE) {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

// openisd.yml spec key → the Driver model's own field name. The two differ for Znom→Z
// and BL→Bl; `packages/winisd/src/parstate.ts` MODELED_SLOTS is the authority, and this
// map covers exactly the slots it declares. Everything else a record carries
// (voice_coil_dia_mm, Hg_mm, weight_kg, …) is not modelled by the app and is not bundled.
const SPEC_TO_FIELD = {
  Znom: 'Z', Fs: 'Fs', Pe: 'Pe', Re: 'Re', Le: 'Le', BL: 'Bl', Xmax: 'Xmax',
  Cms: 'Cms', Qms: 'Qms', Qes: 'Qes', Qts: 'Qts', Rms: 'Rms', Mms: 'Mms',
  Sd: 'Sd', Vas: 'Vas', numVC: 'numVC', VCCon: 'VCCon',
};

// data_sources role → the app's link field.
const SOURCE_TO_LINK = {
  manufacturer_datasheet: 'datasheetUrl',
  manufacturer_product_page: 'manuPageUrl',
  distributor_page: 'distributorPageUrl',
};

/** A record-level `{ value, origin, definition }` wrapper's value. */
const valueOf = node => (node && typeof node === 'object' && 'value' in node ? node.value : undefined);

/**
 * A spec entry's number. The value lives at readings[origin].read_value — there is no
 * flat copy, by design: the origin names which source won, and each source keeps its own
 * reading. Falls back to the sole reading when a record names no winner.
 */
function specValue(entry) {
  const readings = entry?.readings;
  if (!readings || typeof readings !== 'object') return undefined;
  const chosen = readings[entry.origin] ?? Object.values(readings)[0];
  const v = chosen?.read_value;
  return typeof v === 'number' && isFinite(v) ? v : undefined;
}

/** The specs section this driver's numbers live in. A coax bundles its woofer half. */
function specSection(specs, driverType) {
  if (!specs) return null;
  if (driverType === 'tweeter' && specs.tweeter) return specs.tweeter;
  return specs.woofer ?? specs.tweeter ?? Object.values(specs)[0] ?? null;
}

/** Project one openisd.yml record onto the app's DriverJSON shape. */
function project(record) {
  const inputs = {};
  const driverType = valueOf(record.driver_type);
  const section = specSection(record.specs, driverType);

  for (const [specKey, field] of Object.entries(SPEC_TO_FIELD)) {
    const v = specValue(section?.[specKey]);
    if (v !== undefined) inputs[field] = v;
  }

  const brand = valueOf(record.brand);
  const rawModel = valueOf(record.model);
  const sku = valueOf(record.sku);
  const series = valueOf(record.series);

  // Model slug used for display title: uppercase SKU when present, else rawModel
  const modelSlug = sku ? sku.toUpperCase() : rawModel;
  if (brand) inputs.brand = brand;
  if (rawModel) inputs.model = rawModel;
  if (sku) inputs.sku = sku;
  if (series) inputs.series = series;
  const manufacturer = valueOf(record.manufacturer);
  if (manufacturer) inputs.manufacturer = manufacturer;
  const description = valueOf(record.description);
  if (description) inputs.description = description;
  const productImage = valueOf(record.product_image);
  if (productImage) inputs.productImage = productImage;

  const lead = brand || manufacturer;
  const parts = [lead, series, modelSlug].filter(Boolean);
  const name = parts.join(' - ').trim();

  for (const [role, url] of Object.entries(valueOf(record.data_sources) ?? {})) {
    const field = SOURCE_TO_LINK[role];
    if (field && url) inputs[field] = url;
    if (role === valueOf(record.authoritative) && url) inputs.sourceUrl = url;
  }

  const disposition = valueOf(record.disposition);
  return { inputs, driverType, name, disposition };
}

const bundle = {
  _generated: 'AUTO-GENERATED by scripts/bundle-drivers.mjs — DO NOT EDIT MANUALLY. ' +
    'See packages/ui/src/drivers-bundle.README.md for full details.',
  sources: [],
};

for (const [key, src] of Object.entries(sources)) {
  const localPath = localPathOf(src);
  if (localPath === null) continue;                  // federated — fetched at runtime
  if (localPath === undefined) {
    console.warn(`  SKIP ${key} (${src.name}) — ${src.path} is not checked out; the app will show none of its drivers`);
    continue;
  }

  console.log(`\n${key} (${src.name})\n  reading ${src.path}`);

  let recordPaths;
  try { recordPaths = walkRecords(localPath); }
  catch { console.warn(`  SKIP ${key} (${src.name}) — path not found: ${localPath}`); continue; }
  console.log(`  found ${recordPaths.length} ${RECORD_FILE} files`);

  const files = [];
  const skipped = [];
  const perGroup = new Map();          // top path segment (the brand) → kept count
  let done = 0;

  for (const p of recordPaths) {
    const rel = relative(localPath, p).replace(/\\/g, '/');
    const group = rel.split('/')[0];
    const record = parseYaml(readFileSync(p, 'utf8'));
    const { inputs, driverType, name, disposition } = project(record ?? {});

    // A record with no resonance and no cone area cannot be simulated or filtered;
    // it would render as an unusable row. Listed below, never silently dropped.
    // Also skip if disposition is explicitly set and not "ok".
    if ((inputs.Fs === undefined && inputs.Sd === undefined) || (disposition !== undefined && disposition !== 'ok')) {
      skipped.push(rel + (disposition && disposition !== 'ok' ? ` (${disposition})` : ''));
    } else {
      files.push({
        // path within the source (forward-slashed) — the unique id together with the
        // source key; never rely on the display name, which can repeat.
        path: rel,
        name: name || rel,
        ...(driverType ? { driverType } : {}),
        record: { inputs },
      });
      perGroup.set(group, (perGroup.get(group) ?? 0) + 1);
    }

    if (++done % 250 === 0 || done === recordPaths.length) {
      console.log(`  ${String(done).padStart(5)}/${recordPaths.length} projected — ${files.length} usable, ${skipped.length} unusable`);
    }
  }

  for (const [group, n] of [...perGroup].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${group.padEnd(24)} ${String(n).padStart(4)}`);
  }
  if (skipped.length) {
    console.log(`  ${skipped.length} records carry neither Fs nor Sd and are NOT bundled, first 5:`);
    for (const rel of skipped.slice(0, 5)) console.log(`    - ${rel}`);
  }

  bundle.sources.push({ key, name: src.name, files });
  console.log(`  → ${files.length} records bundled from ${key}`);
}

const total = bundle.sources.reduce((n, s) => n + s.files.length, 0);
const outPath = join(ROOT, 'packages', 'ui', 'src', 'drivers-bundle.json');
writeFileSync(outPath, JSON.stringify(bundle));

const kb = Math.round(JSON.stringify(bundle).length / 1024);
console.log(`\nBundled ${total} driver records → packages/ui/src/drivers-bundle.json (${kb} KB raw)`);
if (total === 0) console.warn('WARNING: the bundle is EMPTY — the app will show no bundled drivers.');
