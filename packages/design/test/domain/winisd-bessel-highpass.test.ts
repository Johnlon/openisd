/**
 * "Enable WinISD Bessel high-pass bug" (`winisdBesselHighpass`): off by default, unticked by "Reset to WinISD",
 * saved with the project, applicable only while an enabled Bessel high-pass filter exists.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/index.js';
import type {Filter} from '../../engine/index.js';
import {OpenISDProject} from '../../domain/index.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const here = dirname(fileURLToPath(import.meta.url));
const engine = createEngine();

function project(): OpenISDProject {
  const text = readFileSync(join(here, '..', 'winisd', 'fixtures', 'abc-w5-1.wpr'), 'utf8');
  const {value, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
  if (value === null) throw new Error('import failed: ' + JSON.stringify(errors));
  return value;
}

const BESSEL_HP: Filter = {type: 'highpass', enabled: true, family: 'bessel', order: 4, fc: 25, Q: 0.707};

function splAt(p: OpenISDProject, f: number): number {
  const {values, issues} = p.sweep({fmin: f, fmax: f, N: 0});
  if (values === null) throw new Error('sweep refused: ' + JSON.stringify(issues));
  return values.spl[0]!;
}

describe('winisdBesselHighpass', () => {
  it('is off in a freshly imported project', () => {
    expect(project().winisdBesselHighpass.value).toBe(false);
  });

  it('"Reset to WinISD" unticks it', () => {
    const p = project();
    p.winisdBesselHighpass.set(true);
    p.resetToWinisd();
    expect(p.winisdBesselHighpass.value).toBe(false);
  });

  it('is saved with the project', () => {
    const p = project();
    p.winisdBesselHighpass.set(true);
    const back = OpenISDProject.fromOwprText(p.toOwprText(), engine);
    if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
    expect(back.winisdBesselHighpass.value).toBe(true);
  });

  it('is applicable only while an enabled Bessel high-pass exists', () => {
    const p = project();
    expect(p.errorSwitches.besselHighpass).toEqual({marked: true, applicable: false, reproducesError: false});
    p.filters.set([BESSEL_HP]);
    expect(p.errorSwitches.besselHighpass).toEqual({marked: true, applicable: true, reproducesError: false});
    p.winisdBesselHighpass.set(true);
    expect(p.errorSwitches.besselHighpass.reproducesError).toBe(true);
    p.filters.set([{...BESSEL_HP, enabled: false}]);
    expect(p.errorSwitches.besselHighpass.applicable).toBe(false);
    p.filters.set([{...BESSEL_HP, family: 'butterworth'}]);
    expect(p.errorSwitches.besselHighpass.applicable).toBe(false);
  });

  it('moves the system response through a Bessel high-pass, and not without one', () => {
    const p = project();
    const bare = splAt(p, 14);
    p.winisdBesselHighpass.set(true);
    expect(splAt(p, 14)).toBe(bare);
    p.filters.set([BESSEL_HP]);
    const on = splAt(p, 14);
    p.winisdBesselHighpass.set(false);
    expect(Math.abs(splAt(p, 14) - on)).toBeGreaterThan(0.01);
  });
});
