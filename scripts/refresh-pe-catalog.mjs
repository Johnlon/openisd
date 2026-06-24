/**
 * refresh-pe-catalog.mjs
 *
 * Fetches all Parts Express speaker drivers that have T/S data from the
 * Parts Express internal JSON API and writes/updates WDR files in
 * drivers/parts-express/.
 *
 * API:  GET https://www.parts-express.com/api/items?q={QUERY}&fieldset=details&offset={N}&limit=50
 *       NetSuite SuiteCommerce Advanced (SCA) internal REST API — no auth, no CORS from Node.js.
 *       Discovered 2026-06-24 by inspecting browser network requests on a product page.
 *
 * Usage:
 *   node scripts/refresh-pe-catalog.mjs           # add new files, skip existing
 *   node scripts/refresh-pe-catalog.mjs --force   # overwrite all existing files too
 *   node scripts/refresh-pe-catalog.mjs --dry-run # print what would happen, write nothing
 *
 * Requirements: Node.js 18+ (built-in fetch). No npm dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir  = path.dirname(fileURLToPath(import.meta.url));
const PE_DIR = path.join(__dir, '..', 'drivers', 'parts-express');
const TODAY  = new Date().toISOString().slice(0, 10);
const DELAY  = 100; // ms between API requests — stay polite

const FORCE   = process.argv.includes('--force');
const DRY_RUN = process.argv.includes('--dry-run');

// ── Brands to search ──────────────────────────────────────────────────────────
// Sourced from the Parts Express brand facet list as of 2026-06-24.
// Add new entries here as PE adds brands; they are searched verbatim via ?q=.
const BRANDS = [
  'Aurum Cantus',
  'B&C Speakers',
  'Beston',
  'Beyma',
  'Celestion',
  'Ciare',
  'Coast Buyouts',
  'CSS',
  'Dayton Audio',
  'Eminence Speaker',
  'EPIQUE by Dayton Audio',
  'Factory Buyouts',
  'FaitalPRO',
  'Fountek',
  'Goldwood',
  'GRS',
  'HiVi',
  'JBL Professional',
  'Lavoce',
  'Morel',
  'Peerless by Tymphany',
  'PRV Audio',
  'Pyramid',
  'Quam',
  'Selenium',
  'Tang Band',
  'Tectonic',
  'Timpano Audio',
  'Visaton',
  'Wavecor',
];

// ── Driver categories to include ──────────────────────────────────────────────
// These are the custitem_itemcategoryfacet values that represent actual
// transducers with T/S parameters. Everything else (horns, amps, kits,
// replacement parts, refurb, accessories) is excluded.
const INCLUDE_CATS = new Set([
  'Woofers',
  'Subwoofer Drivers',
  'Tweeters',
  'Midrange / Midbass Drivers & Full-Range Speakers',
  'Planar / Ribbon Transducers',
  'Passive Radiators',
  'Car Audio Tweeters',
  'Car Audio Midbass Speakers',
  'Car Subwoofer Speakers',
  'Pro Woofers, Subwoofers & Midrange Speakers',
  'Horn Loaded Tweeters & Midranges',
  'Horn Drivers',
  'Pro Coaxial Full-Range Speakers',
]);

// ── Unit conversions: API → SI (WDR format) ───────────────────────────────────
const ft3_to_m3 = v => v * 0.0283168;   // Vas: ft³ → m³
const cm2_to_m2 = v => v / 10000;        // Sd:  cm² → m²
const mm_to_m   = v => v / 1000;         // Xmax: mm → m
const mH_to_H   = v => v / 1000;         // Le:   mH → H
const g_to_kg   = v => v / 1000;         // Mms:  g  → kg
const mmN_to_mN = v => v / 1000;         // Cms:  mm/N → m/N

const fmt = (v, p = 6) =>
  v == null || !isFinite(v) ? '' : String(+v.toPrecision(p));

// ── API helpers ───────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function apiFetch(query, offset = 0) {
  const url =
    'https://www.parts-express.com/api/items' +
    '?q=' + encodeURIComponent(query) +
    '&fieldset=details&offset=' + offset + '&limit=50';
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json();
}

/** Fetch every page of results for a brand query, return all items. */
async function fetchAllForBrand(brand) {
  const all = [];
  let offset = 0;
  while (true) {
    const d = await apiFetch(brand, offset);
    const items = d.items ?? [];
    all.push(...items);
    await sleep(DELAY);
    if (all.length >= (d.total ?? 0) || items.length === 0) break;
    offset += 50;
  }
  return all;
}

// ── WDR builder ───────────────────────────────────────────────────────────────
function buildWdr(it) {
  const brand = it.custitem_pe_brand ?? '';
  const displayName = it.storedisplayname2 ?? it.itemid ?? '';
  // Strip leading "Brand " prefix from model name
  const model = displayName.startsWith(brand + ' ')
    ? displayName.slice(brand.length + 1)
    : displayName;
  const url = it.urlcomponent
    ? 'https://www.parts-express.com/' + it.urlcomponent
    : '';

  const Fs  = it.custitem_pe_resonant_frequency_fs   ?? null;
  const Qts = it.custitem_pe_total_q_qts             ?? null;
  const Qes = it.custitem_pe_electromagnetic_q_qes   ?? null;
  const Qms = it.custitem_pe_mechanical_q_qms        ?? null;
  const Re  = it.custitem_pe_dc_resistance_re        ?? null;
  const Le  = it.custitem_pe_voice_coil_inductance_le  != null ? mH_to_H(it.custitem_pe_voice_coil_inductance_le)  : null;
  const BL  = it.custitem_pe_bl_product_bl           ?? null;
  const Mms = it.custitem_pe_diaphragm_mass_airload    != null ? g_to_kg(it.custitem_pe_diaphragm_mass_airload)    : null;
  const Sd  = it.custitem_pe_surface_area_of_cone_sd   != null ? cm2_to_m2(it.custitem_pe_surface_area_of_cone_sd) : null;
  const Vas = it.custitem_pe_compliance_equiv_volume   != null ? ft3_to_m3(it.custitem_pe_compliance_equiv_volume) : null;
  const Xmax = it.custitem_pe_max_linear_excursion     != null ? mm_to_m(it.custitem_pe_max_linear_excursion)      : null;
  const Znom = it.custitem_pe_impedance               ?? null;
  const Pe   = it.custitem_pe_power_handling_rms      ?? null;

  // Cms sanity check: API occasionally returns implausible values (e.g. 790 mm/N
  // instead of ~0.7). Reject anything ≥ 100 mm/N — no real driver has Cms that high.
  const rawCms = it.custitem_pe_mech_comp_suspension;
  const Cms = (rawCms != null && rawCms < 100) ? mmN_to_mN(rawCms) : null;

  // Derived parameters
  const Rms = (Qms && Mms && Fs) ? (2 * Math.PI * Fs * Mms / Qms) : null;
  const Dd  = Sd  ? 2 * Math.sqrt(Sd / Math.PI) : null;
  const Vd  = (Sd && Xmax) ? Sd * Xmax : null;

  return [
    '[Driver]',
    `Brand=${brand}`,
    `Model=${model}`,
    'Manufacturer=',
    `ProvidedBy=Parts Express (fetched ${TODAY})`,
    `Comment=Source: Parts Express (fetched ${TODAY}) — ${url}`,
    'DateAdded=',
    `DateModified=${TODAY}`,
    `Qts=${fmt(Qts)}`,
    `Znom=${fmt(Znom)}`,
    `Fs=${fmt(Fs)}`,
    `Pe=${fmt(Pe)}`,
    `Re=${fmt(Re)}`,
    `Le=${fmt(Le)}`,
    `BL=${fmt(BL)}`,
    `Xmax=${fmt(Xmax)}`,
    `Cms=${fmt(Cms)}`,
    `Qms=${fmt(Qms)}`,
    `Qes=${fmt(Qes)}`,
    `Rms=${fmt(Rms)}`,
    `Mms=${fmt(Mms)}`,
    `Sd=${fmt(Sd)}`,
    `Vas=${fmt(Vas)}`,
    `Vd=${fmt(Vd)}`,
    `Dd=${fmt(Dd)}`,
    'numVC=1',
    'VCCon=2',
    'ParState=EEECEENNEENEEEEEEEEEEECENNCCCNNNCCCCECNNNNNNNNECC',
    '',
  ].join('\n');
}

function safeFilename(brand, model) {
  return `${brand} ${model}.wdr`.replace(/[\\/:*?"<>|]/g, '_');
}

// ── Main ──────────────────────────────────────────────────────────────────────
let totalFetched = 0, written = 0, skipped = 0, noTs = 0, wrongCat = 0;
const seen = new Set(); // deduplicate across brand queries

for (const brand of BRANDS) {
  process.stdout.write(`${brand}… `);
  let items;
  try {
    items = await fetchAllForBrand(brand);
  } catch (e) {
    console.log(`ERROR: ${e.message}`);
    continue;
  }
  totalFetched += items.length;

  let brandWritten = 0, brandSkipped = 0;
  for (const it of items) {
    if (seen.has(it.itemid)) continue;
    seen.add(it.itemid);

    const cat = it.custitem_itemcategoryfacet ?? '';
    if (!INCLUDE_CATS.has(cat)) { wrongCat++; continue; }
    if (!it.custitem_pe_resonant_frequency_fs) { noTs++; continue; }

    const brandName = it.custitem_pe_brand ?? '';
    const displayName = it.storedisplayname2 ?? it.itemid ?? '';
    const model = displayName.startsWith(brandName + ' ')
      ? displayName.slice(brandName.length + 1)
      : displayName;
    const fname = safeFilename(brandName, model);
    const fpath = path.join(PE_DIR, fname);

    if (fs.existsSync(fpath) && !FORCE) {
      brandSkipped++;
      skipped++;
      continue;
    }

    if (!DRY_RUN) {
      fs.writeFileSync(fpath, buildWdr(it), 'utf8');
    }
    brandWritten++;
    written++;
  }
  console.log(`${items.length} fetched → ${brandWritten} written, ${brandSkipped} skipped`);
}

console.log('\n════ SUMMARY ════');
console.log(`Brands searched   : ${BRANDS.length}`);
console.log(`API items fetched : ${totalFetched}`);
console.log(`Wrong category    : ${wrongCat}`);
console.log(`No T/S data (Fs)  : ${noTs}`);
console.log(`Written           : ${written}${DRY_RUN ? ' (dry-run, nothing written)' : ''}`);
console.log(`Skipped (exists)  : ${skipped}`);
console.log(`Total in PE dir   : ${fs.readdirSync(PE_DIR).filter(f => f.endsWith('.wdr')).length}`);
