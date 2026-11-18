#!/usr/bin/env node
// dupscan: find duplicated logic in OpenISD and refuse NEW copies (a ratchet).
//
// Two deterministic checks, no AI:
//   1. Copy detector (jscpd) over packages/ (.ts, .vue; tests, generated files and node_modules left out).
//   2. Formula signatures: regexes for the physics and conversions the engine owns (driver-count
//      scaling, sealed resonance, resonance/compliance, dB, air, unit factors, rounding), plus "any
//      maths in packages/ui". Each hit is keyed by rule + file + the line's own text (no line number,
//      so moving code does not trip the gate; editing the line does).
//
// Every finding must be listed in the allow-list (dupscan-allow.json) with a reason; anything else
// fails the run (exit 1). The first run writes the current state as the baseline:
//   node dupscan.mjs <repo> --write-baseline     # record today's findings, each with reason "baseline"
//   node dupscan.mjs <repo>                      # gate: exit 1 on any finding not in the allow-list
//   node dupscan.mjs <repo> --report out.json    # also write every finding to a file
// Options: --allow <file> (default: dupscan-allow.json next to this script), --jscpd <path to jscpd bin>.
//
// A copy that has been consolidated into the engine is never deleted from the allow-list: its entry stays, marked
//   "resolved": true, "resolved_to": "<engine file>:<function>", "resolved_by": "<task id>", "ruling": "<questions.yml id>"
// (John, QO949, 18 Nov 2026: "old entries stay, marked 'resolved, resolved to <engine function> by T902'; a resolved copy
// that reappears fails"). A resolved entry never allows its key: the copy reappearing fails, naming the function to call.
// An allowed (unresolved) entry whose key no longer matches anything is stale and fails the run (exit 1) until it is
// marked resolved, so every consolidation is recorded.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const repo = args.find(a => !a.startsWith('--') && !isOptionValue(a));
function isOptionValue(a) { const i = args.indexOf(a); return i > 0 && ['--allow', '--jscpd', '--report'].includes(args[i - 1]); }
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
if (!repo) { console.error('usage: node dupscan.mjs <openisd checkout> [--write-baseline] [--allow file] [--report file] [--jscpd bin]'); process.exit(2); }
const allowPath = opt('--allow') ?? join(here, 'dupscan-allow.json');
const jscpdBin = opt('--jscpd') ?? join(repo, 'node_modules/.bin/jscpd');
const writeBaseline = args.includes('--write-baseline');

const IGNORE = ['**/node_modules/**', '**/test/**', '**/*.test.ts', '**/*.spec.ts', '**/generated/**', '**/*.generated.ts',
  '**/dist/**', '**/coverage/**', '**/ui-proposals/**', '**/*.config.ts'];

// ---- 1. copy detector ------------------------------------------------------------------------------
function copies() {
  if (!existsSync(jscpdBin)) { console.error(`jscpd not found at ${jscpdBin} (it is a devDependency: npm ci)`); process.exit(2); }
  const out = mkdtempSync(join(tmpdir(), 'dupscan-'));
  execFileSync(jscpdBin, ['packages', '--format', 'typescript,vue', '--min-tokens', '50', '--ignore', IGNORE.join(','),
    '--reporters', 'json', '--output', out, '--silent'], {cwd: repo, stdio: ['ignore', 'ignore', 'inherit']});
  // jscpd exits 0 and writes no report when it finds no clone at all (a tree with nothing to compare); a crash exits non-zero above
  if (!existsSync(join(out, 'jscpd-report.json'))) return [];
  const report = JSON.parse(readFileSync(join(out, 'jscpd-report.json'), 'utf8'));
  return report.duplicates.map(d => {
    const a = d.firstFile.name, b = d.secondFile.name;
    const norm = (d.fragment ?? '').replace(/\s+/g, ' ').trim();
    const hash = createHash('sha1').update(norm).digest('hex').slice(0, 12);
    const [f1, f2] = [a, b].sort();
    return {kind: 'copy', key: `copy|${f1}|${f2}|${hash}`, where: `${a}:${d.firstFile.start}-${d.firstFile.end} = ${b}:${d.secondFile.start}-${d.secondFile.end}`, lines: d.lines};
  });
}

// ---- 2. formula signatures -------------------------------------------------------------------------
// Each rule: id, what it means in plain words, regex, and (optional) the directories it applies to.
const RULES = [
  {id: 'driver-count-scaling', what: 'N drivers scaled into one (n x Sd, Mms/n, Vb/n, x nDrivers)',
    re: /\b(nDrivers|numDrivers|driverCount)\b(\(\))?\s*\|*\s*\d*\)?\s*[*\/][^>]|[*\/]\s*\(?\s*(P\.|this\.#|p\.)?(nDrivers|numDrivers)\b|Sd_m2\s*\*\s*n\b|[^<]\/\s*n\s*[,;)]|\bVb\s*\/\s*n\b/},
  {id: 'coil-wiring-scaling', what: 'voice-coil wiring scaling of Re/BL/Znom (numVC, series/parallel factor)',
    re: /\bnumVC\b\s*[*\/]|[*\/]\s*numVC\b|wiring(\.value)?\s*===\s*["'](series|parallel)["']\s*\?\s*[A-Za-z]+\s*:\s*1\s*\//},
  {id: 'sealed-box-ratio', what: 'sealed resonance factor sqrt(1 + Vas/Vb) or its inverse (Qtc/Qts)^2 - 1',
    re: /sqrt\(\s*1\s*\+\s*[A-Za-z_.]*[Vv]as|\(\s*[A-Za-z_.]*Q[a-z]*c\s*\/\s*[A-Za-z_.]*Q[a-z]*s?\s*\)\s*\*\*\s*2\s*-\s*1/},
  {id: 'resonance-mass-compliance', what: 'resonance from mass and compliance 1/(2 pi sqrt(M C)) or its inverse',
    re: /1\s*\/\s*\(\s*(2\s*\*\s*Math\.PI|TAU)\s*\*\s*Math\.sqrt|1\s*\/\s*\(\s*\(\s*(2\s*\*\s*Math\.PI|TAU)\s*\*[^)]*\)\s*\*\*\s*2/},
  {id: 'q-parallel', what: 'Qts from Qes and Qms, or a source-loaded Qes',
    re: /Qes[A-Za-z_]*\s*\*\s*[A-Za-z_.]*Qms|Qms[A-Za-z_]*\s*\*\s*[A-Za-z_.]*Qes|1\s*\/\s*\(\s*1\s*\/\s*[A-Za-z_.]*Q[a-z]*s[A-Za-z_]*\s*\+\s*1\s*\/|\(\s*[A-Za-z_.]*(re|Re)[A-Za-z_]*\s*\+\s*[^)]*(rg|Rg|RG|rs|Rs)[A-Za-z_]*\)\s*\)?\s*\/\s*[A-Za-z_.]*(re|Re)\b/},
  {id: 'bl-from-qes', what: 'BL from Re, Fs, Qes and Cms',
    re: /Math\.sqrt\([^)]*Re[A-Za-z_]*\s*\/\s*\(\s*(2\s*\*\s*Math\.PI|TAU)\s*\*[^)]*Qes/},
  {id: 'air-compliance', what: 'acoustic compliance V/(rho c^2) or Vas = rho c^2 Sd^2 Cms',
    re: /(rho|roo)[A-Za-z_()]*\s*\*\s*[A-Za-z_.]*c[A-Za-z_()]*\s*\*\s*[A-Za-z_.]*c\b(\(\))?/},
  {id: 'circle-area', what: 'port or cone area from diameter, or diameter from area',
    re: /Math\.PI\s*\*\s*\(?\s*[A-Za-z_.!]+\s*\/\s*2\s*\)?\s*\*\*\s*2|2\s*\*\s*Math\.sqrt\(\s*[A-Za-z_.!]+\s*\/\s*Math\.PI\s*\)/},
  {id: 'displacement', what: 'displacement Vd = Sd x Xmax',
    re: /[Ss]d[A-Za-z_0-9]*\s*\*\s*[A-Za-z_.0-9!]*[Xx]max|[Xx]max[A-Za-z_0-9]*\s*\*\s*[A-Za-z_.0-9!]*[Ss]d\b/},
  {id: 'decibel', what: 'dB conversion 10 log10 / 20 log10 / 10^(x/20)',
    re: /(10|20)\s*\*\s*Math\.log10|Math\.pow\(\s*10\s*,[^)]*\/\s*(10|20)\s*\)|10\s*\*\*\s*\([^)]*\/\s*(10|20)\s*\)/},
  {id: 'drive-voltage-power', what: 'power and voltage through Re (V^2/R, sqrt(P R), the 2.83 V reference)',
    re: /\b2\.83\b|Math\.sqrt\(\s*[A-Za-z_.]*(pin|power|Pe|P)[A-Za-z_]*\s*\*\s*\(?\s*[A-Za-z_.]*(re|Re)/},
  {id: 'end-correction', what: 'port end correction constant or literal',
    re: /\b0\.732\b|\b0\.613\b|END_CORRECTION\b/},
  {id: 'air-defaults', what: 'reference air: 293.15 K, 101325 Pa, 30 %',
    re: /\b293\.15\b|\b101325\b/},
  {id: 'unit-factor', what: 'hand-written unit conversion (litres, cm, mm, inches, cm2, cm3)',
    re: /[*\/]\s*(1000|1e3|1e-3|1e6|1e-6|10_?000|0\.0254|2\.54|25\.4|100)\b(?!\s*\*\s*1000)/,
    skip: /setTimeout|ms\b|_ms|Ms\b|Date|delay|seconds|bytes|interval|elapsed|percent|Pct|pct|%|devicePixelRatio|scale\b/},
  {id: 'display-rounding', what: 'rounding a number for display outside the field formatter',
    re: /\.toFixed\(|\.toPrecision\(|Math\.round\([^)]*\*\s*(10|100|1000|scale)\b/},
  {id: 'ui-maths', what: 'arithmetic maths in packages/ui (the UI is display only)', dirs: ['packages/ui/src/'],
    re: /Math\.(sqrt|pow|log|log10|exp|PI|hypot)\b|\*\*\s*\d/},
];

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (['node_modules', 'test', 'dist', 'coverage', 'generated', 'ui-proposals'].includes(name)) continue;
    const s = statSync(p);
    if (s.isDirectory()) walk(p, files);
    else if (/\.(ts|vue)$/.test(name) && !/\.(test|spec|generated)\.ts$|\.config\.ts$|\.d\.ts$/.test(name)) files.push(p);
  }
  return files;
}

function signatures() {
  const hits = [];
  for (const file of walk(join(repo, 'packages'))) {
    const rel = relative(repo, file);
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const t = line.trim();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('<!--') || t.startsWith('import ')) return;
      for (const r of RULES) {
        if (r.dirs && !r.dirs.some(d => rel.startsWith(d))) continue;
        if (!r.re.test(line) || (r.skip && r.skip.test(line))) continue;
        hits.push({kind: 'signature', rule: r.id, what: r.what, key: `sig|${r.id}|${rel}|${t.replace(/\s+/g, ' ')}`, where: `${rel}:${i + 1}`, layer: layerOf(rel)});
      }
    });
  }
  return hits;
}

function layerOf(rel) {
  if (rel.startsWith('packages/design/engine/')) return 'engine';
  if (rel.startsWith('packages/design/domain/')) return 'domain';
  if (rel.startsWith('packages/ui/')) return 'ui';
  return rel.split('/').slice(0, 3).join('/');
}

// ---- gate ------------------------------------------------------------------------------------------
const findings = [...copies(), ...signatures()];
const groups = {};
for (const f of findings.filter(f => f.kind === 'signature')) (groups[f.rule] ??= new Set()).add(f.layer);

if (opt('--report')) writeFileSync(opt('--report'), JSON.stringify({findings, layersPerRule: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, [...v]]))}, null, 2));

if (writeBaseline) {
  // Resolved entries are the record of consolidations (QO949): a new baseline keeps them.
  const previous = existsSync(allowPath) ? JSON.parse(readFileSync(allowPath, 'utf8')) : {};
  const entries = Object.fromEntries(Object.entries(previous).filter(([, e]) => e.resolved === true));
  for (const f of findings) {
    const e = entries[f.key] ??= {reason: 'baseline 2026-11-18 (QO946.c256)', where: f.where, count: 0};
    e.count += 1;
  }
  writeFileSync(allowPath, JSON.stringify(entries, null, 1) + '\n');
  console.log(`wrote ${Object.keys(entries).length} allow-list entries to ${allowPath}`);
  process.exit(0);
}

const allowFile = existsSync(allowPath) ? JSON.parse(readFileSync(allowPath, 'utf8')) : {};
const resolved = Object.fromEntries(Object.entries(allowFile).filter(([, e]) => e.resolved === true));
const allow = Object.fromEntries(Object.entries(allowFile).filter(([, e]) => e.resolved !== true));
const incomplete = Object.keys(resolved).filter(k => !['resolved_to', 'resolved_by', 'ruling'].every(f => typeof resolved[k][f] === 'string' && resolved[k][f] !== ''));
const seen = new Set(findings.map(f => f.key));
const counts = {};
const fresh = findings.filter(f => { counts[f.key] = (counts[f.key] ?? 0) + 1; return !(f.key in allow) || counts[f.key] > (allow[f.key].count ?? 1); });
const back = fresh.filter(f => f.key in resolved);
const unlisted = fresh.filter(f => !(f.key in resolved));
const stale = Object.keys(allow).filter(k => !seen.has(k));

console.log(`dupscan: ${findings.length} findings (${findings.filter(f => f.kind === 'copy').length} copies, ${findings.filter(f => f.kind === 'signature').length} formula signatures), ${Object.keys(allow).length} allowed, ${Object.keys(resolved).length} resolved`);
for (const [rule, layers] of Object.entries(groups)) console.log(`  ${rule.padEnd(26)} in: ${[...layers].join(', ')}`);
const where = f => f.kind === 'copy' ? `copy ${f.lines} lines: ${f.where}` : `${f.rule} (${f.layer}) ${f.where}: ${f.what}`;
if (incomplete.length) {
  console.log(`\nFAIL: ${incomplete.length} resolved allow-list entries lack resolved_to, resolved_by or ruling (${allowPath}):`);
  for (const k of incomplete) console.log(`  ${resolved[k].where}  ${k.slice(0, 140)}`);
}
if (stale.length) {
  console.log(`\nFAIL: ${stale.length} allowed entries no longer match (copy removed or line edited). Never delete one: mark it resolved, with resolved_to (the engine function now used), resolved_by (the task) and ruling (QO949):`);
  for (const k of stale) console.log(`  ${allow[k].where}  ${k.slice(0, 140)}`);
}
if (back.length) {
  console.log(`\nFAIL: ${back.length} consolidated copies are back:`);
  for (const f of back) { const e = resolved[f.key]; console.log(`  ${where(f)}\n    this copy was consolidated into ${e.resolved_to} by ${e.resolved_by}; call ${e.resolved_to}`); }
}
if (unlisted.length) {
  console.log(`\nFAIL: ${unlisted.length} new duplicated logic not in the allow-list (${allowPath}):`);
  for (const f of unlisted) console.log(`  ${where(f)}`);
  console.log('\nMove the calculation into the engine and call it, or, if the copy is right, add its key to the allow-list with a reason (a ruling, quoted).');
}
if (incomplete.length || stale.length || back.length || unlisted.length) process.exit(1);
console.log('\nOK: no new duplicated logic.');
