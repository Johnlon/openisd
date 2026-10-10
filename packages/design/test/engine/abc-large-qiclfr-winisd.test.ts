/**
 * ABC intra-port velocity with the inter-chamber leak removed (Qiclfr 1e6), against WinISD's own chart.
 * Golden data: `../fixtures/winisdAbcHugeQiclCapture.ts` (winisd_research runs/abc-w5-qicl1e6) — the
 * abc-w5-1 project with only Qiclfr changed from 20 to 1e6.
 *
 * WinISD's chart V/(jωMai + Zf) drops the term Zf·jωMai/Ricl from the port-mass current
 * V/[jωMai + Zf(1 + jωMai/Ricl)]. With a leak this large the term vanishes and the two coincide.
 * Measured at Qiclfr 1e6: the switch on matches WinISD at 4e-15 (pinned at 1e-9), the switch off at
 * 3.3e-6 (Ricl is large, not infinite); the gap between off and on shrinks as 1/Qiclfr. At Qiclfr 20
 * (abc-w5-1) the switch off differs from WinISD's chart by 0.14 relative (1.35 dB), the switch on
 * matches (`abc-winisd.test.ts`). Evidence: winisd_research/PROBE_FINDINGS.md (abc velocity
 * self-consistency), bugs/archive/BUG_20261003_winisd-abc-intra-port-velocity-drops-ricl.md.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/index.js';
import {type FrequencyGrid, OpenISDProject} from '../../domain/index.js';
import {reproduceWinisdBugs} from '../fixtures/domainBuilders.js';
import {WINISD_ABC_CAPTURE} from '../fixtures/winisdAbcCapture.js';
import {WINISD_ABC_HUGE_QICL_CAPTURE} from '../fixtures/winisdAbcHugeQiclCapture.js';
import type {WinIsdComplexPoint} from '../fixtures/winisdVentedCapture.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const here = dirname(fileURLToPath(import.meta.url));

function setUpProject(wprFile: string, winisdChart: boolean, Qicl: number | null = null): OpenISDProject {
  const engine = createEngine();
  const text = readFileSync(join(here, '..', 'winisd', 'fixtures', wprFile), 'utf8');
  const {value: project, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
  if (project === null) throw new Error('winIsdProjectToOpenIsdProject returned problems: ' + JSON.stringify(errors));
  reproduceWinisdBugs(project);
  project.rgAtDriverSide.set(false);
  project.winisdAbcIntraPortVelocity.set(winisdChart);
  if (Qicl !== null) project.box.abc.Qiclfr.set(Qicl);
  return project;
}

/** Worst relative error of the project's intra-port velocity against the capture (WinISD's √2 applied). */
function worstIntraError(wprFile: string, winisdChart: boolean, fixture: readonly WinIsdComplexPoint[]): number {
  const project = setUpProject(wprFile, winisdChart);
  const {values: sw, issues} = project.sweep({fmin: fixture[0]!.f, fmax: fixture[fixture.length - 1]!.f, N: fixture.length - 1});
  if (sw === null) throw new Error('sweep refused: ' + JSON.stringify(issues));
  assert.ok(sw.pvIntra !== null, 'abc must produce an intra-port velocity curve');
  assert.equal(sw.fs.length, fixture.length);
  let worst = 0;
  for (let i = 0; i < fixture.length; i++) {
    const point = fixture[i]!;
    const want = Math.SQRT2 * Math.hypot(point.re, point.im);
    worst = Math.max(worst, Math.abs(sw.pvIntra![i]! - want) / want);
  }
  return worst;
}

const HUGE = WINISD_ABC_HUGE_QICL_CAPTURE.intraPortVelocity;

/** Worst relative gap between the switch off and on, at one Qiclfr, over the capture's grid. */
function offOnGap(Qicl: number): number {
  const params: FrequencyGrid = {fmin: HUGE[0]!.f, fmax: HUGE[HUGE.length - 1]!.f, N: HUGE.length - 1};
  const sweepOf = (winisdChart: boolean) => {
    const {values} = setUpProject('abc-w5-qicl1e6.wpr', winisdChart, Qicl).sweep(params);
    if (values === null || values.pvIntra === null) throw new Error('abc sweep gave no intra-port velocity');
    return values.pvIntra;
  };
  const off = sweepOf(false), on = sweepOf(true);
  let worst = 0;
  for (let i = 0; i < off.length; i++) worst = Math.max(worst, Math.abs(off[i]! - on[i]!) / on[i]!);
  return worst;
}

describe('ABC intra-port velocity, Qiclfr 1e6: WinISD\'s chart and the corrected one nearly coincide', () => {
  it('switch off (port-mass current) matches WinISD at 1e-5 (measured 3.3e-6: Ricl is large, not infinite)', {timeout: 30000}, () => {
    const worst = worstIntraError('abc-w5-qicl1e6.wpr', false, HUGE);
    assert.ok(worst <= 1e-5, `worst relative error ${worst.toExponential(3)}`);
  });

  it('the gap between switch off and on shrinks as 1/Qiclfr', {timeout: 30000}, () => {
    const at1e6 = offOnGap(1e6), at1e9 = offOnGap(1e9);
    assert.ok(at1e9 <= 1e-8, `gap at 1e9 ${at1e9.toExponential(3)}`);
    assert.ok(at1e6 / at1e9 > 500 && at1e6 / at1e9 < 2000, `gap ratio 1e6/1e9 ${(at1e6 / at1e9).toFixed(0)}`);
  });

  it('switch on (WinISD\'s V/(jωMai + Zf)) matches WinISD at 1e-9', () => {
    const worst = worstIntraError('abc-w5-qicl1e6.wpr', true, HUGE);
    assert.ok(worst <= 1e-9, `worst relative error ${worst.toExponential(3)}`);
  });
});

describe('ABC intra-port velocity, Qiclfr 20: the port-mass chart is not WinISD\'s, by the dropped term', () => {
  it('switch off differs from the abc-w5-1 capture by 0.14 relative (1.35 dB) at most', () => {
    const worst = worstIntraError('abc-w5-1.wpr', false, WINISD_ABC_CAPTURE.intraPortVelocity);
    assert.ok(worst > 0.1 && worst < 0.2, `worst relative error ${worst.toExponential(3)}`);
  });

  it('switch on matches the abc-w5-1 capture at 1e-9', () => {
    const worst = worstIntraError('abc-w5-1.wpr', true, WINISD_ABC_CAPTURE.intraPortVelocity);
    assert.ok(worst <= 1e-9, `worst relative error ${worst.toExponential(3)}`);
  });
});
