/**
 * The error switches: controls that reproduce a known WinISD error. The design package says which
 * controls are marked, whether each applies to the open box, and whether it is reproducing the
 * error now; the UI only reads these.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/index.js';
import {CompatPreset, OpenISDProject} from '../../domain/index.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';
import {WinisdDeviation, WinisdFilterDeviation} from '../../fields/index.js';
import type {Filter} from '../../engine/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const engine = createEngine();

function abcProject(): OpenISDProject {
  const text = readFileSync(join(here, '..', 'winisd', 'fixtures', 'abc-w5-1.wpr'), 'utf8');
  const {value, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
  if (value === null) throw new Error('import failed: ' + JSON.stringify(errors));
  return value;
}

describe('errorSwitches', () => {
  it('ABC velocity: a WinISD convention, not an error switch; its switch acts on an ABC box only', () => {
    const p = abcProject();
    expect('abcIntraPortVelocity' in p.errorSwitches).toBe(false);
    expect(p.winisdAbcIntraPortVelocityApplies).toBe(true);
    p.box.boxType.set('vented');
    expect(p.winisdAbcIntraPortVelocityApplies).toBe(false);
  });

  it('driver model and VA model: always marked and applicable, reproducing the error while ticked', () => {
    const p = abcProject();
    p.winisdDriverModel.set(true);
    p.winisdVaModel.set(false);
    expect(p.errorSwitches.driverModel).toEqual({marked: true, applicable: true, reproducesError: true});
    expect(p.errorSwitches.vaModel).toEqual({marked: true, applicable: true, reproducesError: false});
    p.winisdVaModel.set(true);
    p.winisdDriverModel.set(false);
    expect(p.errorSwitches.vaModel.reproducesError).toBe(true);
    expect(p.errorSwitches.driverModel.reproducesError).toBe(false);
  });

  it('PR Npr resonance: marked and applicable on a passive radiator box only, reproducing the error only when ticked', () => {
    const p = abcProject();
    expect(p.errorSwitches.prNprResonance).toEqual({marked: true, applicable: false, reproducesError: false});
    p.box.boxType.set('box-passive-radiator');
    expect(p.errorSwitches.prNprResonance).toEqual({marked: true, applicable: true, reproducesError: false});
    p.winisdPrNprResonance.set(true);
    expect(p.errorSwitches.prNprResonance).toEqual({marked: true, applicable: true, reproducesError: true});
  });

  it('loss model: not an error switch, whatever the box and model', () => {
    const p = abcProject();
    p.box.boxType.set('box-passive-radiator');
    expect('prLossModel' in p.errorSwitches).toBe(false);
  });
});

const ALLPASS_4: Filter = {type: 'allpass', enabled: true, order: 4, t: 0.003, Q: 0.6};

describe('WinISD deviation cues', () => {
  it('every deviation names its switch and explains the bug and its size', () => {
    for (const d of [...WinisdDeviation.ALL, ...WinisdFilterDeviation.ALL]) {
      expect(d.title.length, d.title).toBeGreaterThan(0);
      expect(d.explanation.length, d.title).toBeGreaterThan(0);
      expect(d.size.length, d.title).toBeGreaterThan(0);
      expect(d.remedy.length, d.title).toBeGreaterThan(0);
    }
    expect(WinisdDeviation.ALL).toEqual([WinisdDeviation.DRIVER_MODEL, WinisdDeviation.VA_MODEL, WinisdDeviation.PR_NPR_RESONANCE]);
    expect(WinisdFilterDeviation.ALL).toEqual([WinisdFilterDeviation.ALLPASS_ORDER, WinisdFilterDeviation.LINKWITZ_RILEY_ORDER, WinisdFilterDeviation.BESSEL_HIGHPASS]);
    expect(WinisdFilterDeviation.BESSEL_HIGHPASS.remedy).toMatch(/"WinISD Bessel high-pass"/);
    expect(WinisdFilterDeviation.ALLPASS_ORDER.remedy).toMatch(/no switch/);
  });

  it('allpass order (no switch): in effect for an enabled allpass above order 2', () => {
    const p = abcProject();
    const cue = WinisdFilterDeviation.ALLPASS_ORDER;
    p.filters.set([ALLPASS_4]);
    expect(cue.inEffectFor(p.errorSwitches, ALLPASS_4)).toBe(true);
    expect(cue.inEffectFor(p.errorSwitches, {...ALLPASS_4, order: 3})).toBe(true);
    expect(cue.inEffectFor(p.errorSwitches, {...ALLPASS_4, order: 2})).toBe(false);
    expect(cue.inEffectFor(p.errorSwitches, {...ALLPASS_4, enabled: false})).toBe(false);
    p.applyCompatPreset(CompatPreset.WINISD_WITH_BUGS);
    expect(cue.inEffectFor(p.errorSwitches, ALLPASS_4)).toBe(true);
  });

  it('Linkwitz-Riley order (no switch): in effect for an enabled Linkwitz-Riley of order other than 4', () => {
    const p = abcProject();
    const cue = WinisdFilterDeviation.LINKWITZ_RILEY_ORDER;
    const lr: Filter = {type: 'lowpass', enabled: true, family: 'linkwitzRiley', order: 2, fc: 80, Q: 0.707};
    expect(cue.inEffectFor(p.errorSwitches, lr)).toBe(true);
    expect(cue.inEffectFor(p.errorSwitches, {...lr, type: 'highpass', order: 8})).toBe(true);
    expect(cue.inEffectFor(p.errorSwitches, {...lr, order: 4})).toBe(false);
    expect(cue.inEffectFor(p.errorSwitches, {...lr, family: 'butterworth'})).toBe(false);
    expect(cue.inEffectFor(p.errorSwitches, {...lr, enabled: false})).toBe(false);
  });

  it('Bessel high-pass: in effect for an enabled Bessel high-pass of order 2 or more while the switch is off', () => {
    const p = abcProject();
    const cue = WinisdFilterDeviation.BESSEL_HIGHPASS;
    const hp: Filter = {type: 'highpass', enabled: true, family: 'bessel', order: 4, fc: 25, Q: 0.707};
    p.filters.set([hp]);
    expect(cue.inEffectFor(p.errorSwitches, hp)).toBe(true);
    expect(cue.inEffectFor(p.errorSwitches, {...hp, order: 1})).toBe(false);
    expect(cue.inEffectFor(p.errorSwitches, {...hp, family: 'butterworth'})).toBe(false);
    expect(cue.inEffectFor(p.errorSwitches, {...hp, type: 'lowpass'})).toBe(false);
    expect(cue.inEffectFor(p.errorSwitches, ALLPASS_4)).toBe(false);
    p.winisdBesselHighpass.set(true);
    expect(cue.inEffectFor(p.errorSwitches, hp)).toBe(false);
  });

  it('VA model: its cue belongs to the VA chart, in effect while the switch is off', () => {
    const p = abcProject();
    const cue = WinisdDeviation.VA_MODEL;
    p.winisdVaModel.set(false);
    expect(cue.inEffectOnChart(p.errorSwitches, 'VA')).toBe(true);
    expect(cue.inEffectOnChart(p.errorSwitches, 'SPL')).toBe(false);
    expect(WinisdDeviation.PR_NPR_RESONANCE.inEffectOnChart(p.errorSwitches, 'VA')).toBe(false);
    p.winisdVaModel.set(true);
    expect(cue.inEffectOnChart(p.errorSwitches, 'VA')).toBe(false);
  });

  it('PR Npr resonance: in effect on a passive radiator box while the switch is off', () => {
    const p = abcProject();
    const cue = WinisdDeviation.PR_NPR_RESONANCE;
    expect(cue.inEffect(p.errorSwitches)).toBe(false);
    p.box.boxType.set('box-passive-radiator');
    expect(cue.inEffect(p.errorSwitches)).toBe(true);
    p.winisdPrNprResonance.set(true);
    expect(cue.inEffect(p.errorSwitches)).toBe(false);
  });
});
