/**
 * ND140-PR passive radiator box: calculation parity after ONE typed edit in the PR pane (T429). Golden data: `../fixtures/winisd-edit-captures/nd140-pr/*.json`,
 * WinISD 0.7.0.950 charts logged by debugger after ONE value was typed into the running WinISD
 * (winisd_research runs/sweep-t429-nd140pr-pr-edit-*).
 * One block per run: load parity, every captured chart (including the PR transfer function and PR excursion),
 * the Box tab readouts (Vb, Fp).
 */
import {describe, it} from 'vitest';
import {
  BOX_VOLUME, GROUP_DELAY_BOUND_MS, PR_TUNING, applyPrEdit, assertChartMatches, assertLoadParity, assertPrLoadParity,
  assertReadout, chartRules, loadBase, loadEditCapture, sweepAfterEdit,
} from '../fixtures/winisdEditCapture.js';
import type {PrEditTarget, Quantity} from '../fixtures/winisdEditCapture.js';

const BUG_PR_SD = 'bugs/BUG_20261003_winisd-pr-sd-edit-ignored.md';
const BUG_PR_VAS = 'bugs/BUG_20261019_winisd-pr-vas-edit-rounded-to-4-decimals.md';

/** A check that deviates, pinned: `it.fails` names the bug file. Key: `<fixture>|<check label>`. */
const KNOWN: ReadonlyMap<string, string> = new Map<string, string>([
  ['pr-prsd|prexcursion', BUG_PR_SD],
  ...['tfmag', 'spl', 'tfphase', 'excursion', 'impedance', 'prtfmag', 'prexcursion', 'Box tab: Fp'].map((label): [string, string] => [`pr-prvas|${label}`, BUG_PR_VAS]),
]);

interface Run { readonly fixture: string; readonly title: string; readonly edit: PrEditTarget }

function describeRun(run: Run): void {
  describe(`ND140-PR ${run.title} (sweep-t429-nd140pr-${run.fixture})`, () => {
    const capture = loadEditCapture('nd140-pr', run.fixture);
    const project = loadBase(capture);
    it('the base file loads as the file states', () => {
      assertLoadParity(loadBase(capture), capture);
      assertPrLoadParity(loadBase(capture), capture);
    });
    applyPrEdit(project, capture, run.edit);
    const swept = sweepAfterEdit(project, capture);
    const rules = chartRules(GROUP_DELAY_BOUND_MS);
    const pr = project.box.passiveRadiator;
    const checks: {readonly label: string; readonly check: () => void}[] = [
      ...[...capture.charts.keys()].map((q: Quantity) => ({label: q, check: () => assertChartMatches(capture, swept, q, rules)})),
      {label: 'Box tab: Vb', check: () => assertReadout(capture, BOX_VOLUME, pr.volume_m3.value, 'Box tab: Vb')},
      {label: 'Box tab: Fp', check: () => assertReadout(capture, PR_TUNING, pr.systemTuning_hz.value, 'Box tab: Fp')},
    ];
    for (const c of checks) {
      const bug = KNOWN.get(`${run.fixture}|${c.label}`);
      if (bug === undefined) it(`${c.label} matches`, c.check);
      else it.fails(`${c.label} after PR ${run.edit.field} — ${bug}`, c.check);
    }
  });
}

const pr = (field: string, prSpec: PrEditTarget['prSpec']): PrEditTarget => ({pane: 'PR', field, prSpec});
describeRun({fixture: 'pr-prfs', title: 'PR Fs typed in the PR pane', edit: pr('Fs', 'Fs_hz')});
describeRun({fixture: 'pr-prqms', title: 'PR Qms typed in the PR pane', edit: pr('Qms', 'Qms')});
describeRun({fixture: 'pr-prvas', title: 'PR Vas typed in the PR pane', edit: pr('Vas', 'Vas_m3')});
describeRun({fixture: 'pr-prxmax', title: 'PR Xmax typed in the PR pane', edit: pr('Xmax', 'Xmax_m')});
describeRun({fixture: 'pr-prsd', title: 'PR Sd typed in the PR pane', edit: pr('Sd', 'Sd_m2')});
describeRun({fixture: 'pr-prme', title: 'PR Me typed in the PR pane', edit: pr('Me', 'addedMass_kg')});
describeRun({fixture: 'pr-prnpr', title: 'PR Npr typed in the PR pane', edit: pr('Npr', 'count')});
