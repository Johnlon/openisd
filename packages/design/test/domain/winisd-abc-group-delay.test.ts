/**
 * "Enable WinISD ABC group delay bug" (`winisdAbcGroupDelay`): off by default, unticked by "Reset to
 * WinISD", saved with the project, applicable on an ABC box only; while off on an ABC box its
 * cue sits by the group delay chart.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/index.js';
import {CompatSwitch, OpenISDProject} from '../../domain/index.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';
import {WinisdDeviation} from '../../fields/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const engine = createEngine();

function abcProject(): OpenISDProject {
  const text = readFileSync(join(here, '..', 'winisd', 'fixtures', 'abc-w5-1.wpr'), 'utf8');
  const {value, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
  if (value === null) throw new Error('import failed: ' + JSON.stringify(errors));
  return value;
}

describe('winisdAbcGroupDelay', () => {
  it('is a WinISD bug switch, off in a freshly imported project', () => {
    expect(CompatSwitch.ABC_GROUP_DELAY.kind).toBe('bug');
    expect(abcProject().winisdAbcGroupDelay.value).toBe(false);
  });

  it('"Reset to WinISD" unticks it', () => {
    const p = abcProject();
    p.winisdAbcGroupDelay.set(true);
    p.resetToWinisd();
    expect(p.winisdAbcGroupDelay.value).toBe(false);
  });

  it('is saved with the project', () => {
    const p = abcProject();
    p.winisdAbcGroupDelay.set(true);
    const back = OpenISDProject.fromOwprText(p.toOwprText(), engine);
    if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
    expect(back.winisdAbcGroupDelay.value).toBe(true);
  });

  it('a file without the key loads it off', () => {
    const p = abcProject();
    p.winisdAbcGroupDelay.set(true);
    const text = p.toOwprText().replace(/"winisdAbcGroupDelay": true,?/, '').replace(/,(\s*})/g, '$1');
    expect(text).not.toMatch(/winisdAbcGroupDelay/);
    const back = OpenISDProject.fromOwprText(text, engine);
    if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
    expect(back.winisdAbcGroupDelay.value).toBe(false);
  });

  it('is applicable on an ABC box only', () => {
    const p = abcProject();
    expect(p.errorSwitches.abcGroupDelay).toEqual({marked: true, applicable: true, reproducesError: false});
    p.winisdAbcGroupDelay.set(true);
    expect(p.errorSwitches.abcGroupDelay.reproducesError).toBe(true);
    for (const box of ['sealed', 'vented', 'bandpass4', 'bandpass6', 'box-passive-radiator'] as const) {
      p.box.boxType.set(box);
      expect(p.errorSwitches.abcGroupDelay.applicable, box).toBe(false);
    }
  });

  it('its cue belongs to the group delay chart, in effect on an ABC box while the switch is off', () => {
    const p = abcProject();
    const cue = WinisdDeviation.ABC_GROUP_DELAY;
    expect(cue.inEffectOnChart(p.errorSwitches, 'GD')).toBe(true);
    expect(cue.inEffectOnChart(p.errorSwitches, 'Phase')).toBe(false);
    expect(cue.remedy).toMatch(/"Enable WinISD ABC group delay bug"/);
    p.winisdAbcGroupDelay.set(true);
    expect(cue.inEffectOnChart(p.errorSwitches, 'GD')).toBe(false);
    p.winisdAbcGroupDelay.set(false);
    p.box.boxType.set('bandpass6');
    expect(cue.inEffectOnChart(p.errorSwitches, 'GD')).toBe(false);
  });
});
