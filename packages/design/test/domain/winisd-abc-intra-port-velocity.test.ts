/**
 * "WinISD ABC intra-port velocity" (`winisdAbcIntraPortVelocity`): on by default (WinISD's chart),
 * ticked by "Reset to WinISD", saved with the project, applicable on an ABC box only.
 * Sizes are from the abc-w5-1 capture (bugs/BUG_20261003_winisd-abc-intra-port-velocity-drops-ricl.md).
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/index.js';
import {OpenISDProject} from '../../domain/index.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const here = dirname(fileURLToPath(import.meta.url));
const engine = createEngine();

function abcProject(): OpenISDProject {
  const text = readFileSync(join(here, '..', 'winisd', 'fixtures', 'abc-w5-1.wpr'), 'utf8');
  const {value, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
  if (value === null) throw new Error('import failed: ' + JSON.stringify(errors));
  value.applyWinisdSettings();
  value.rgAtDriverSide.set(false);
  return value;
}

function intraVelocity(p: OpenISDProject): {fs: readonly number[]; pv: readonly number[]} {
  const {values, issues} = p.sweep({fmin: 20, fmax: 20000, N: 400});
  if (values === null || values.pvIntra === null) throw new Error('no intra-port curve: ' + JSON.stringify(issues));
  return {fs: values.fs, pv: values.pvIntra};
}

function deviationDb(on: OpenISDProject, off: OpenISDProject, f: number): number {
  const a = intraVelocity(on), b = intraVelocity(off);
  let best = 0;
  for (let i = 1; i < a.fs.length; i++) if (Math.abs(Math.log(a.fs[i]! / f)) < Math.abs(Math.log(a.fs[best]! / f))) best = i;
  return 20 * Math.log10(a.pv[best]! / b.pv[best]!);
}

describe('winisdAbcIntraPortVelocity', () => {
  it('is on (WinISD) in a freshly imported project and a new project', () => {
    const text = readFileSync(join(here, '..', 'winisd', 'fixtures', 'abc-w5-1.wpr'), 'utf8');
    const {value} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    expect(value!.winisdAbcIntraPortVelocity.value).toBe(true);
  });

  it('"Reset to WinISD" ticks it', () => {
    const p = abcProject();
    p.winisdAbcIntraPortVelocity.set(false);
    p.applyWinisdSettings();
    expect(p.winisdAbcIntraPortVelocity.value).toBe(true);
  });

  it('is saved with the project and read back', () => {
    const p = abcProject();
    p.winisdAbcIntraPortVelocity.set(false);
    const back = OpenISDProject.fromOwprText(p.toOwprText(), engine);
    if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
    expect(back.winisdAbcIntraPortVelocity.value).toBe(false);
  });

  it('on and off differ by a small dropped term: 1.36 dB at 110 Hz at most, under 0.1 dB away from 80-150 Hz', {timeout: 30000}, () => {
    const on = abcProject(), off = abcProject();
    on.winisdAbcIntraPortVelocity.set(true);
    off.winisdAbcIntraPortVelocity.set(false);
    const gap = (f: number) => Math.abs(deviationDb(on, off, f));
    expect(gap(42)).toBeLessThan(0.01);
    expect(gap(60)).toBeLessThan(0.02);
    expect(Math.abs(gap(110) - 1.355)).toBeLessThan(0.01);
    expect(gap(200)).toBeLessThan(0.1);
    for (const f of [1000, 5000, 20000]) expect(gap(f)).toBeLessThan(0.01);
  });

  it('with a very large inter-chamber leak Q, on and off agree to 1e-9', () => {
    const on = abcProject(), off = abcProject();
    for (const p of [on, off]) p.box.abc.chambers.rear.losses.Qicl.set(1e12);
    on.winisdAbcIntraPortVelocity.set(true);
    off.winisdAbcIntraPortVelocity.set(false);
    const a = intraVelocity(on).pv, b = intraVelocity(off).pv;
    for (let i = 0; i < a.length; i++) expect(Math.abs(a[i]! - b[i]!) / b[i]!, `point ${i}`).toBeLessThan(1e-9);
  });
});
