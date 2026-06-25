/**
 * Cross-reference matt/ WDRs against other collections that already have
 * boxbench_ links. Applies only exact brand+model matches (case-insensitive,
 * whitespace-normalised). Does not guess; skips anything ambiguous.
 *
 * Run: node scripts/backfill-matt-links.mjs [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');
const DRIVERS_DIR = new URL('../drivers/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

// Collections to harvest links FROM (already populated)
const SOURCE_DIRS = ['soundimports', 'parts-express', 'sb-acoustics', 'scan-speak', 'wavecor'];
// Collection to patch
const TARGET_DIR = 'matt';

// Fields we want to copy when found
const LINK_FIELDS = ['boxbench_manu_page', 'boxbench_datasheet', 'boxbench_frd', 'boxbench_vendor_page', 'boxbench_impedance'];

function parseWdrFields(text) {
  const fields = {};
  for (const line of text.split(/\r?\n/)) {
    const eq = line.indexOf('=');
    if (eq < 0 || line[0] === '[') continue;
    fields[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return fields;
}

function normalise(s) {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// ── 1. Build lookup from source collections ───────────────────────────────────
const lookup = new Map(); // key: "brand|model" → { manu_page, datasheet, ... }

for (const dir of SOURCE_DIRS) {
  const dirPath = path.join(DRIVERS_DIR, dir);
  if (!fs.existsSync(dirPath)) continue;
  for (const fname of fs.readdirSync(dirPath)) {
    if (!fname.endsWith('.wdr')) continue;
    const text = fs.readFileSync(path.join(dirPath, fname), 'utf8');
    const f = parseWdrFields(text);
    const brand = normalise(f.Brand);
    const model = normalise(f.Model);
    if (!brand || !model) continue;

    const links = {};
    for (const field of LINK_FIELDS) {
      if (f[field]) links[field] = f[field].trim();
    }
    if (!Object.keys(links).length) continue;

    const key = `${brand}|${model}`;
    if (!lookup.has(key)) {
      lookup.set(key, { links, sources: [path.join(dir, fname)] });
    } else {
      // Merge additional fields, track multiple source files
      const entry = lookup.get(key);
      for (const [k, v] of Object.entries(links)) {
        if (!entry.links[k]) entry.links[k] = v;
      }
      entry.sources.push(path.join(dir, fname));
    }
  }
}

console.log(`Built lookup: ${lookup.size} unique brand+model combinations with links`);

// ── 2. Process matt/ WDRs ─────────────────────────────────────────────────────
const mattDir = path.join(DRIVERS_DIR, TARGET_DIR);
const files = fs.readdirSync(mattDir).filter(f => f.endsWith('.wdr')).sort();

let matched = 0, skipped = 0, alreadyFull = 0, noMatch = 0;
const report = [];

for (const fname of files) {
  const fpath = path.join(mattDir, fname);
  const text = fs.readFileSync(fpath, 'utf8');
  const f = parseWdrFields(text);

  const brand = normalise(f.Brand);
  const model = normalise(f.Model);
  const key = `${brand}|${model}`;

  // Check which link fields are already set
  const alreadySet = LINK_FIELDS.filter(field => f[field]);
  const missing = LINK_FIELDS.filter(field => !f[field]);

  if (!missing.length) { alreadyFull++; continue; }

  const entry = lookup.get(key);
  if (!entry) { noMatch++; continue; }

  // Only add fields that are missing
  const toAdd = {};
  for (const field of missing) {
    if (entry.links[field]) toAdd[field] = entry.links[field];
  }
  if (!Object.keys(toAdd).length) { skipped++; continue; }

  report.push({ fname, toAdd, sources: entry.sources });

  if (!DRY_RUN) {
    let updated = text.trimEnd();
    for (const [field, value] of Object.entries(toAdd)) {
      updated += `\n${field}=${value}`;
    }
    fs.writeFileSync(fpath, updated + '\n', 'utf8');
  }

  matched++;
}

// ── 3. Report ─────────────────────────────────────────────────────────────────
console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}Results:`);
console.log(`  Matched + patched : ${matched}`);
console.log(`  Already complete  : ${alreadyFull}`);
console.log(`  Match found, nothing new to add : ${skipped}`);
console.log(`  No match in lookup: ${noMatch}`);
console.log(`  Total matt/ WDRs  : ${files.length}`);

if (report.length) {
  console.log('\nPatched files:');
  for (const { fname, toAdd, sources } of report) {
    console.log(`  ${fname}`);
    for (const [k, v] of Object.entries(toAdd)) {
      console.log(`    ${k}=${v}`);
    }
    console.log(`    (from: ${sources.join(', ')})`);
  }
}
