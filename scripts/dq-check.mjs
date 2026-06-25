/**
 * Data quality check across all WDR files.
 * Flags physically impossible or highly suspicious T/S parameter values.
 * Run: node scripts/dq-check.mjs [--collection <name>]
 */
import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';
const DRIVERS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'drivers');
const _ci = process.argv.indexOf('--collection');
const filterColl = _ci >= 0 ? process.argv[_ci + 1] : null;

function parseFields(text) {
  const f = {};
  for (const line of text.split(/\r?\n/)) {
    const eq = line.indexOf('=');
    if (eq < 0 || line[0] === '[') continue;
    f[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return f;
}
const n = (f, k) => { const v = parseFloat(f[k]); return isFinite(v) ? v : null; };

// ── DQ rules ─────────────────────────────────────────────────────────────────
// Each rule: { id, desc, test(fields) → string|null }
// test returns null (pass) or a short description of what's wrong.
const RULES = [
  // Core params present
  { id: 'missing_Fs',  desc: 'Fs missing or zero',
    test: f => (!n(f,'Fs') || n(f,'Fs') <= 0) ? `Fs=${f.Fs}` : null },
  { id: 'missing_Sd',  desc: 'Sd missing or zero',
    test: f => (!n(f,'Sd') || n(f,'Sd') <= 0) ? `Sd=${f.Sd}` : null },
  { id: 'missing_Re',  desc: 'Re missing or zero',
    test: f => (!n(f,'Re') || n(f,'Re') <= 0) ? `Re=${f.Re}` : null },

  // Fs range
  { id: 'Fs_low',  desc: 'Fs < 5 Hz — below any physical driver',
    test: f => { const v = n(f,'Fs'); return v && v < 5  ? `Fs=${v}` : null; } },
  { id: 'Fs_high', desc: 'Fs > 5000 Hz — implausible for a cone driver',
    test: f => { const v = n(f,'Fs'); return v && v > 5000 ? `Fs=${v}` : null; } },

  // Sd range
  { id: 'Sd_huge', desc: 'Sd > 3000 cm² — larger than any real driver (21" sub ≈ 1700 cm², 24" ≈ 2300 cm²)',
    test: f => { const v = n(f,'Sd'); return v && v*1e4 > 3000 ? `Sd=${(v*1e4).toFixed(0)} cm²` : null; } },
  { id: 'Sd_tiny', desc: 'Sd < 0.5 cm² — smaller than any real driver',
    test: f => { const v = n(f,'Sd'); return v && v*1e4 < 0.5 ? `Sd=${(v*1e4).toFixed(2)} cm²` : null; } },

  // Re range
  { id: 'Re_low',  desc: 'Re < 1 Ω — below DC resistance of any voice coil',
    test: f => { const v = n(f,'Re'); return v && v < 1   ? `Re=${v}` : null; } },
  { id: 'Re_high', desc: 'Re > 64 Ω — implausibly high voice coil resistance',
    test: f => { const v = n(f,'Re'); return v && v > 64  ? `Re=${v}` : null; } },

  // Q values
  { id: 'Qts_impossible', desc: 'Qts > Qes — thermodynamically impossible (Qts must be < Qes)',
    test: f => { const qts = n(f,'Qts'), qes = n(f,'Qes'); return qts && qes && qts >= qes ? `Qts=${qts} Qes=${qes}` : null; } },
  { id: 'Qts_impossible2', desc: 'Qts > Qms — thermodynamically impossible',
    test: f => { const qts = n(f,'Qts'), qms = n(f,'Qms'); return qts && qms && qts >= qms ? `Qts=${qts} Qms=${qms}` : null; } },
  { id: 'Qts_high', desc: 'Qts > 5 — physically unreasonable for any driver',
    test: f => { const v = n(f,'Qts'); return v && v > 5  ? `Qts=${v}` : null; } },
  { id: 'Qes_zero', desc: 'Qes ≤ 0 — impossible',
    test: f => { const v = n(f,'Qes'); return v !== null && v <= 0 ? `Qes=${v}` : null; } },
  { id: 'Qms_low', desc: 'Qms < 0.5 — extremely lossy suspension, unusual',
    test: f => { const v = n(f,'Qms'); return v && v < 0.5 ? `Qms=${v}` : null; } },

  // Pe — the comma-bug trap
  { id: 'Pe_one',  desc: 'Pe = 1 W — almost certainly a comma parse bug (e.g. "1,000" → 1)',
    test: f => { const v = n(f,'Pe'); return v === 1 ? `Pe=${v}` : null; } },
  { id: 'Pe_zero', desc: 'Pe = 0 — missing power handling',
    test: f => { const v = n(f,'Pe'); return v !== null && v === 0 ? `Pe=${v}` : null; } },

  // Xmax
  { id: 'Xmax_zero', desc: 'Xmax = 0 — missing excursion data',
    test: f => { const v = n(f,'Xmax'); return v !== null && v === 0 ? 'Xmax=0' : null; } },
  { id: 'Xmax_huge', desc: 'Xmax > 100 mm — implausible',
    test: f => { const v = n(f,'Xmax'); return v && v*1000 > 100 ? `Xmax=${(v*1000).toFixed(0)} mm` : null; } },

  // Vas
  { id: 'Vas_huge', desc: 'Vas > 2000 L — implausible (would need a room-sized box)',
    test: f => { const v = n(f,'Vas'); return v && v*1000 > 2000 ? `Vas=${(v*1000).toFixed(0)} L` : null; } },

  // Sd vs Fs cross-check: a tiny Sd with very low Fs is suspicious
  { id: 'tweeter_fs', desc: 'Sd < 5 cm² but Fs < 100 Hz — tiny piston with woofer-range Fs',
    test: f => {
      const sd = n(f,'Sd'), fs = n(f,'Fs');
      return sd && fs && sd*1e4 < 5 && fs < 100 ? `Sd=${(sd*1e4).toFixed(1)} cm² Fs=${fs}` : null;
    }},

  // SPL sanity
  { id: 'SPL_high', desc: 'SPL > 120 dB/1W/1m — physically implausible for a passive driver',
    test: f => { const v = n(f,'SPL'); return v && v > 120 ? `SPL=${v}` : null; } },
  { id: 'SPL_low',  desc: 'SPL < 65 dB/1W/1m — implausibly inefficient',
    test: f => { const v = n(f,'SPL'); return v && v < 65  ? `SPL=${v}` : null; } },
];

// ── Scan all collections ──────────────────────────────────────────────────────
const issues = []; // { collection, fname, ruleId, desc, detail }

for (const coll of fs.readdirSync(DRIVERS_DIR).sort()) {
  if (filterColl && coll !== filterColl) continue;
  const collPath = path.join(DRIVERS_DIR, coll);
  if (!fs.statSync(collPath).isDirectory()) continue;
  for (const fname of fs.readdirSync(collPath).sort()) {
    if (!fname.endsWith('.wdr')) continue;
    const text = fs.readFileSync(path.join(collPath, fname), 'utf8');
    const f    = parseFields(text);
    for (const rule of RULES) {
      const hit = rule.test(f);
      if (hit) issues.push({ collection: coll, fname, ruleId: rule.id, desc: rule.desc, detail: hit });
    }
  }
}

// ── Report grouped by rule ────────────────────────────────────────────────────
const byRule = {};
for (const iss of issues) {
  if (!byRule[iss.ruleId]) byRule[iss.ruleId] = { desc: iss.desc, hits: [] };
  byRule[iss.ruleId].hits.push(iss);
}

let total = 0;
for (const [ruleId, { desc, hits }] of Object.entries(byRule).sort()) {
  console.log(`\n── ${ruleId} (${hits.length}) — ${desc}`);
  for (const h of hits) {
    console.log(`   ${h.collection}/${h.fname}  [${h.detail}]`);
  }
  total += hits.length;
}
console.log(`\nTotal issues: ${total} across ${issues.map(i=>i.collection+'/'+i.fname).filter((v,i,a)=>a.indexOf(v)===i).length} files`);
