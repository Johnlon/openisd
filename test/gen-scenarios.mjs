/**
 * Compute and write the `resonate:` expected values in test/scenarios.js.
 *
 * Reads each scenario's driver + box params, runs the same core formula that
 * Resonate's stat bar uses, applies the same toFixed() precision, and rewrites
 * the `resonate:` block in scenarios.js in-place.
 *
 * Run after:
 *   1. Adding a new scenario to scenarios.js
 *   2. Running `npm run test:crosscheck` to fill in the `micka:` values
 *
 * Run before:
 *   Adding the Resonate UI wiring test to app.browser.spec.js
 *
 * Usage:
 *   node test/gen-scenarios.mjs        — dry run (prints what would change)
 *   node test/gen-scenarios.mjs --write — writes changes to scenarios.js
 *
 * DO NOT run in CI.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here    = dirname(fileURLToPath(import.meta.url));
const srcCore = join(here, '..', 'src', 'core');
const write   = process.argv.includes('--write');

// Import core functions directly — same code that Resonate's stat bar uses
const { sealedFromQtc, tuningFromLength, prTuning } =
  await import(pathToFileURL(join(srcCore, 'alignments.js')).href);

const { SCENARIOS } = await import(pathToFileURL(join(here, 'scenarios.js')).href);

// ── Compute resonate: values for each scenario ────────────────────────────────

for (const S of SCENARIOS) {
  const VAS_M3 = S.driver.Vas / 1000;   // litres → m³ (core units)
  const drv    = { Fs: S.driver.Fs, Qts: S.driver.Qts, Vas: VAS_M3 };

  if (S.box.type === 'sealed' && S.box.Qtc != null) {
    const Vb    = sealedFromQtc(drv, S.box.Qtc);
    const scale = Math.sqrt(1 + VAS_M3 / Vb);
    S._computed = {
      // StatBar.vue: Qtc.toFixed(3)  fc.toFixed(1)
      Qtc: (drv.Qts * scale).toFixed(3),
      fc:  (drv.Fs  * scale).toFixed(1),
    };

  } else if (S.box.type === 'vented' && S.box.Vb != null && S.box.ventL != null && S.box.ventD != null) {
    const Vb  = S.box.Vb  / 1000;         // litres → m³
    const L   = S.box.ventL / 100;        // cm → m (physical length)
    const Sp  = Math.PI * (S.box.ventD / 200) ** 2;  // cm bore diameter → m² area
    const fb  = tuningFromLength(Vb, L, Sp);
    S._computed = {
      // StatBar.vue: fb.toFixed(1)
      Fb: fb.toFixed(1),
    };

  } else if (S.box.type === 'pr') {
    // PR params must be in the scenario as box.pr: { Vb, Sd, Mms, Cms, Rms, Madd }
    // Units: Vb litres, Sd cm², Mms g, Cms mm/N, Rms kg/s, Madd g
    const pr = S.box.pr;
    if (!pr) { console.warn(`  SKIP  ${S.id}: no box.pr params`); continue; }
    const P = {
      Vb:     pr.Vb    / 1000,          // litres → m³
      prSd:   pr.Sd    / 1e4,           // cm²    → m²
      prMmd:  pr.Mms   / 1000,          // g      → kg
      prMadd: (pr.Madd ?? 0) / 1000,    // g      → kg
      prCms:  pr.Cms   / 1000,          // mm/N   → m/N
      prRms:  pr.Rms,                   // kg/s   (direct)
    };
    const fp = prTuning(P);
    S._computed = {
      // StatBar.vue: fp.toFixed(1)
      Fp: fp.toFixed(1),
    };

  } else {
    console.warn(`  SKIP  ${S.id}: box type '${S.box.type}' not handled or missing geometry`);
  }
}

// ── Report computed values ────────────────────────────────────────────────────

console.log('');
for (const S of SCENARIOS) {
  if (!S._computed) continue;
  const changed = JSON.stringify(S.resonate) !== JSON.stringify(S._computed);
  const tag = changed ? 'CHANGE' : 'ok    ';
  console.log(`  [${tag}]  ${S.id}`);
  if (changed) {
    console.log(`           was:  ${JSON.stringify(S.resonate)}`);
    console.log(`           now:  ${JSON.stringify(S._computed)}`);
  } else {
    console.log(`           ${JSON.stringify(S._computed)}`);
  }
}
console.log('');

if (!write) {
  console.log('Dry run — pass --write to update scenarios.js\n');
  process.exit(0);
}

// ── Write changes to scenarios.js ────────────────────────────────────────────

const scenariosPath = join(here, 'scenarios.js');
let lines = readFileSync(scenariosPath, 'utf8').split(/\r?\n/);

for (const S of SCENARIOS) {
  if (!S._computed) continue;
  lines = replaceResonateBlock(lines, S.id, S._computed);
  console.log(`  wrote  ${S.id}`);
}

writeFileSync(scenariosPath, lines.join('\n'), 'utf8');
console.log(`\nDone. Run npm test to confirm green, then commit.\n`);

// ── Helper: replace the resonate: block for one scenario ─────────────────────

function replaceResonateBlock(lines, id, computed) {
  // Find the id: line for this scenario
  const idIdx = lines.findIndex(l => l.includes(`'${id}'`) && l.trimStart().startsWith('id:'));
  if (idIdx < 0) throw new Error(`Scenario id '${id}' not found in scenarios.js`);

  // Find resonate: { after the id line (stop at the next id: to stay within this scenario)
  let resonateIdx = -1;
  for (let i = idIdx + 1; i < lines.length; i++) {
    const t = lines[i].trimStart();
    if (t.startsWith('id:') && lines[i].includes(`'`) && !lines[i].includes(`'${id}'`)) break;
    if (t.startsWith('resonate:')) { resonateIdx = i; break; }
  }
  if (resonateIdx < 0) throw new Error(`resonate: block not found for scenario '${id}'`);

  // Find the closing }, by counting braces from the resonate: { line
  let depth = 0, resonateEnd = -1;
  for (let i = resonateIdx; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') depth++;
      if (ch === '}') { depth--; if (depth === 0) { resonateEnd = i; break; } }
    }
    if (resonateEnd >= 0) break;
  }
  if (resonateEnd < 0) throw new Error(`resonate: block closing not found for '${id}'`);

  // Also absorb a preceding generated-comment line if present
  let blockStart = resonateIdx;
  if (blockStart > 0 && lines[blockStart - 1].trimStart().startsWith('// Generated by gen-scenarios')) {
    blockStart--;
  }

  // Infer indentation from the resonate: line
  const indent = lines[resonateIdx].match(/^(\s*)/)[1];

  // Build the replacement block
  const keys    = Object.keys(computed);
  const keyLen  = Math.max(...keys.map(k => k.length));
  const valLines = keys.map(k => `${indent}  ${k.padEnd(keyLen)}: '${computed[k]}',`);

  const newBlock = [
    `${indent}// Generated by gen-scenarios.mjs — run \`npm run gen-scenarios\` to update`,
    `${indent}resonate: {`,
    ...valLines,
    `${indent}},`,
  ];

  lines.splice(blockStart, resonateEnd - blockStart + 1, ...newBlock);
  return lines;
}
