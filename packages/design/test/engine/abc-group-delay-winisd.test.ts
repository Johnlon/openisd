/**
 * ABC group delay and the "Enable WinISD ABC group delay bug" switch (`winisdAbcGroupDelay`).
 *
 * WinISD's ABC group delay (routine 0x4591b0, chart byte 12) steps the box to f ± 1e-10 Hz but
 * hands the driver routine the project frequency f, so the driver part stays at f and the group
 * delay is the slope of the box alone. It contradicts WinISD's own plotted phase.
 * Off (the default): −dφ/dω of the plotted phase. On: WinISD's frozen-driver form.
 * Evidence: winisd_research GHIDRA_FINDINGS.md "Group delay of the 6th-order bandpass and ABC —
 * chart byte 12 (2026-10-05)", runs/abc-w5-gd2 (inputs identical to abc-w5-base2), and
 * bugs/archive/BUG_20261005_winisd-abc-group-delay-driver-not-stepped.md.
 *
 * Tolerance 1.5e-3 ms: two 1e-10 Hz central differences are compared, each with a rounding
 * staircase of up to 7.3e-4 ms on this grid (WinISD against the exact derivative, all 2082
 * points). Over all 2082 points the switch-on curve is within 1.03e-3 ms of WinISD (129.5 Hz).
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/index.js';
import {OpenISDProject, type FrequencyGrid} from '../../domain/index.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'winisd', 'fixtures');
/** WinISD's grid for abc-w5-base2 / abc-w5-gd2: point i is 20095.22^(i/2086) Hz. */
const GRID: FrequencyGrid = {fmin: 1.0, fmax: 20095.223453196217, N: 2086};
const STAIRCASE_MS = 1.5e-3;

function project(wpr: string): OpenISDProject {
  const {value, errors} = new WinIsdProjectConverter(createEngine()).winIsdProjectToOpenIsdProject(readFileSync(join(FIXTURES, wpr), 'utf8'));
  if (value === null) throw new Error('winIsdProjectToOpenIsdProject returned problems: ' + JSON.stringify(errors));
  value.winisdDriverModel.set(true);
  value.rgAtDriverSide.set(false);
  return value;
}

function groupDelay(p: OpenISDProject): readonly number[] {
  const {values, issues} = p.sweep(GRID);
  if (values === null) throw new Error('sweep refused: ' + JSON.stringify(issues));
  return values.gd;
}

interface GdPoint { readonly i: number; readonly f: number; readonly winisd_ms: number; readonly phaseSlope_ms: number }

/** WinISD's plotted value (runs/abc-w5-gd2 gdb.log, kind=3) and −dφ/dω of the plotted phase
 *  (closed form, exact derivative: scratch/gd_bp6_abc.py). */
const POINTS: readonly GdPoint[] = [
  {i: 1,    f: 1.004761172659811,  winisd_ms: -40.958473009038705,   phaseSlope_ms: -33.858433},
  {i: 100,  f: 1.6079939568818524, winisd_ms: -36.59386885978821,    phaseSlope_ms: -29.495619},
  {i: 500,  f: 10.750336570403508, winisd_ms: -3.3129891703320586,   phaseSlope_ms: 3.622579},
  {i: 1000, f: 115.56973637695505, winisd_ms: 1.4576398667718293,    phaseSlope_ms: 2.387217},
  {i: 1320, f: 528.3895766528382,  winisd_ms: 0.00445963058534974,   phaseSlope_ms: 0.055862},
  {i: 1500, f: 1242.4135634050724, winisd_ms: 0.000794785648874211,  phaseSlope_ms: 0.010059},
  {i: 1746, f: 3996.923518692612,  winisd_ms: 0.00014902230916391456, phaseSlope_ms: 0.000971},
];

describe('ABC group delay (abc-w5-base2)', () => {
  it('off (the default): the slope of the plotted phase', () => {
    const p = project('abc-w5-base2.wpr');
    expect(p.winisdAbcGroupDelay.value).toBe(false);
    const gd = groupDelay(p);
    for (const pt of POINTS) expect(Math.abs(gd[pt.i]! - pt.phaseSlope_ms), `${pt.f} Hz: ${gd[pt.i]}`).toBeLessThan(STAIRCASE_MS);
  });

  it('on: WinISD\'s value, driver part held at the project frequency', () => {
    const p = project('abc-w5-base2.wpr');
    p.winisdAbcGroupDelay.set(true);
    const gd = groupDelay(p);
    for (const pt of POINTS) expect(Math.abs(gd[pt.i]! - pt.winisd_ms), `${pt.f} Hz: ${gd[pt.i]}`).toBeLessThan(STAIRCASE_MS);
  });

  it('on: every other chart is unchanged', () => {
    const p = project('abc-w5-base2.wpr');
    const off = p.sweep(GRID).values!;
    p.winisdAbcGroupDelay.set(true);
    const on = p.sweep(GRID).values!;
    expect(on.phase).toEqual(off.phase);
    expect(on.spl).toEqual(off.spl);
    expect(on.fltGd).toEqual(off.fltGd);
  });
});

describe('6th-order bandpass group delay (bp6-w5-base2)', () => {
  it('the ABC switch does not act on it', () => {
    const p = project('bp6-w5-base2.wpr');
    const off = groupDelay(p);
    p.winisdAbcGroupDelay.set(true);
    expect(groupDelay(p)).toEqual(off);
  });
});
