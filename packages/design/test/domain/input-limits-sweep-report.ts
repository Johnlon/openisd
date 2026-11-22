/**
 * The input-limits sweep's report (T915): runs every case of `../fixtures/inputLimitsSweep.ts` and
 * prints, as Markdown, the counts and one row per box and value that breaks, with the projects it
 * breaks on, the symptom, the engine outputs that went bad, whether the screen would store the value
 * and whether the app's own finiteness check says so on screen. No judgement: the rows are exactly
 * the cases whose `runCase` findings are not empty. The section "Generated table" of
 * bugs/BUG_20261118_input-limits-sweep.md is this output.
 *
 *   npx vite-node packages/design/test/domain/input-limits-sweep-report.ts
 */
import {allCases, runCase, screenAccepts, sweptInputs, type SweepCase, type CaseResult} from '../fixtures/inputLimitsSweep.js';

interface Row {
  readonly c: SweepCase;
  readonly r: CaseResult;
}

function main(): void {
  const cases = allCases();
  const rows: Row[] = [];
  let refused = 0;
  for (const c of cases) {
    const r = runCase(c.input, c.trial, c.project);
    if (r.findings.length > 0) rows.push({c, r});
    else if (r.refused) refused++;
  }
  const fields = new Set(sweptInputs().map(i => i.field));
  const bySymptom = new Map<string, number>();
  for (const {r} of rows) for (const s of new Set(r.findings.map(f => f.symptom))) bySymptom.set(s, (bySymptom.get(s) ?? 0) + 1);

  const out: string[] = [];
  out.push(`Swept ${sweptInputs().length} boxes (${fields.size} distinct number fields), ${cases.length} cases.`);
  out.push(`Breaking cases: ${rows.length}. Refused with a message, nothing broken: ${refused}.`);
  out.push(`By symptom (a case can have more than one): ${[...bySymptom].map(([s, n]) => `${s} ${n}`).join(', ')}.`);
  out.push(`Breaking cases the screen would store: ${rows.filter(({c}) => screenAccepts(c.input, c.trial)).length}.`);
  out.push('');
  out.push('| box (as labelled) | where | value | projects | symptom | engine output | screen stores it | app says so |');
  out.push('|---|---|---|---|---|---|---|---|');
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const k = `${row.c.input.id}|${row.c.trial.name}`;
    groups.set(k, [...(groups.get(k) ?? []), row]);
  }
  for (const group of groups.values()) {
    const first = group[0];
    if (first === undefined) continue;
    const {input, trial} = first.c;
    const symptoms = [...new Set(group.flatMap(({r}) => r.findings.map(f => `${f.symptom} (${f.call})`)))].join(', ');
    const where = [...new Set(group.flatMap(({r}) => r.findings.map(f => f.where)))];
    const outputs = where.length > 4 ? `${where.slice(0, 4).join(', ')} and ${where.length - 4} more` : where.join(', ');
    const says = [...new Set(group.map(({r}) => r.appSaysSo ? 'yes' : 'no'))].join('/');
    out.push(`| ${input.label} \`${input.id}\` | ${input.where} | ${trial.name} | ${group.map(({c}) => c.project).join(', ')} | ${symptoms} | ${outputs} | ${screenAccepts(input, trial) ? 'yes' : 'no'} | ${says} |`);
  }
  console.log(out.join('\n'));
}

main();
