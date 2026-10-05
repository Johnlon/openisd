import {createEngine} from '../engine/index.js';
import {AREAS} from './consistency/areas/index.js';
import {agrees, runCase, type CaseResult} from './consistency/harness.js';

const args = process.argv.slice(2);

if (args.includes('--list') || args.length === 0) {
  console.log('OpenISD consistency tests (same value loaded from a file vs entered by hand).\nusage: bash scripts/compat.sh <area ...|all>   (--list shows this)\n');
  for (const a of AREAS) console.log(`  ${a.name.padEnd(10)} ${a.cases.length + (a.textCases?.length ?? 0) + (a.readoutCases?.length ?? 0)} cases  ${a.summary}`);
  process.exit(args.length === 0 ? 1 : 0);
}

const wanted = args.includes('all') ? AREAS : AREAS.filter(a => args.includes(a.name));
const unknown = args.filter(a => a !== 'all' && !AREAS.some(x => x.name === a));
if (unknown.length > 0) {
  console.error(`unknown area: ${unknown.join(', ')}`);
  process.exit(2);
}

const engine = createEngine();
const verdict = (r: CaseResult): string => (r.error !== null ? `ERROR ${r.error.slice(0, 80)}` : agrees(r) ? 'agree' : 'DISAGREE');
let bad = 0;
for (const area of wanted) {
  console.log(`\n## ${area.name} — ${area.summary}\n`);
  console.log('| case | hand edit moves results | file load moves results | hand vs load, worst relative | verdict |');
  console.log('|---|---|---|---|---|');
  for (const c of [...area.cases, ...(area.textCases ?? []), ...(area.readoutCases ?? [])]) {
    const r = runCase(engine, c);
    if (!agrees(r)) bad++;
    console.log(`| ${r.label} | ${r.handMoves ? 'yes' : 'no'} | ${r.loadMoves ? 'yes' : 'no'} | ${r.handVsLoad.toExponential(2)} | ${verdict(r)} |`);
  }
}
console.log(`\n${bad === 0 ? 'All cases agree.' : `${bad} case(s) disagree or failed.`}`);
process.exit(bad === 0 ? 0 : 1);
