#!/usr/bin/env node
/**
 * bundle-drivers.mjs
 *
 * Pre-bundles all WDR files from bundled driver collections into
 * src/drivers-bundle.json so the app can load them instantly without
 * hitting the GitHub API.
 *
 * "Bundled" = sources whose URL points at this repo
 * (github.com/Johnlon/resonate). Federated third-party sources are
 * still fetched live from GitHub at runtime.
 *
 * Run automatically via `npm run build` → prebuild script.
 * Can also be run manually: node scripts/bundle-drivers.mjs
 */

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const sources = JSON.parse(
  readFileSync(join(ROOT, 'drivers/sources.json'), 'utf8')
).sources;

// Sources whose URLs match this repo are bundled locally
const REPO_RE = /github\.com\/Johnlon\/resonate\/tree\/[^/]+\/(.+)/i;

function walkWdr(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === '_html' || entry.name === 'datasheets') continue;
      files.push(...walkWdr(join(dir, entry.name)));
    } else if (extname(entry.name).toLowerCase() === '.wdr') {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

const bundle = { sources: [] };

for (const src of sources) {
  const m = src.url?.match(REPO_RE);
  if (!m) continue;

  const localPath = join(ROOT, m[1]);
  let wdrPaths;
  try { wdrPaths = walkWdr(localPath); }
  catch { console.warn(`  SKIP ${src.name} — path not found: ${localPath}`); continue; }

  const files = wdrPaths.map(p => ({
    name: p.split(/[\\/]/).pop().replace(/\.wdr$/i, ''),
    content: readFileSync(p, 'utf8'),
  }));

  bundle.sources.push({ name: src.name, files });
  console.log(`  ${src.name}: ${files.length} drivers`);
}

const total = bundle.sources.reduce((n, s) => n + s.files.length, 0);
const outPath = join(ROOT, 'src', 'drivers-bundle.json');
writeFileSync(outPath, JSON.stringify(bundle));

const kb = Math.round(JSON.stringify(bundle).length / 1024);
console.log(`\nBundled ${total} WDR files → src/drivers-bundle.json (${kb} KB raw)`);
