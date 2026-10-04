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
import {OpenISDProject} from '../../domain/index.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';
import {LossMode, WinisdDeviation, WinisdFilterDeviation} from '../../fields/index.js';
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
  it('ABC velocity: marked, applicable on an ABC box only, reproducing the error while ticked (the default)', () => {
    const p = abcProject();
    expect(p.errorSwitches.abcIntraPortVelocity).toEqual({marked: true, applicable: true, reproducesError: true});
    p.winisdAbcIntraPortVelocity.set(false);
    expect(p.errorSwitches.abcIntraPortVelocity).toEqual({marked: true, applicable: true, reproducesError: false});
    p.box.boxType.set('vented');
    expect(p.errorSwitches.abcIntraPortVelocity.applicable).toBe(false);
    expect(p.errorSwitches.abcIntraPortVelocity.marked).toBe(true);
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
    p.lossMode.set(LossMode.parse('winisd-lossy'));
    p.box.boxType.set('box-passive-radiator');
    expect('prLossModel' in p.errorSwitches).toBe(false);
  });
});

const ALLPASS_4: Filter = {type: 'allpass', enabled: true, order: 4, t: 0.003, Q: 0.6};

describe('winisdAllpassOrder', () => {
  it('is off in a freshly imported project; "Reset to WinISD" ticks it; it is saved', () => {
    const p = abcProject();
    expect(p.winisdAllpassOrder.value).toBe(false);
    p.applyWinisdSettings();
    expect(p.winisdAllpassOrder.value).toBe(true);
    const back = OpenISDProject.fromOwprText(p.toOwprText(), engine);
    if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
    expect(back.winisdAllpassOrder.value).toBe(true);
  });

  it('is applicable only while an enabled allpass of order 2 or more exists', () => {
    const p = abcProject();
    expect(p.errorSwitches.allpassOrder).toEqual({marked: true, applicable: false, reproducesError: false});
    p.filters.set([ALLPASS_4]);
    expect(p.errorSwitches.allpassOrder).toEqual({marked: true, applicable: true, reproducesError: false});
    p.winisdAllpassOrder.set(true);
    expect(p.errorSwitches.allpassOrder.reproducesError).toBe(true);
    p.filters.set([{...ALLPASS_4, enabled: false}]);
    expect(p.errorSwitches.allpassOrder.applicable).toBe(false);
    p.filters.set([{...ALLPASS_4, order: 1}]);
    expect(p.errorSwitches.allpassOrder.applicable).toBe(false);
  });

  it('moves the system response through an allpass of order 4', () => {
    const p = abcProject();
    p.filters.set([ALLPASS_4]);
    const phaseAt = (): number => {
      const {values, issues} = p.sweep({fmin: 60, fmax: 60, N: 0});
      if (values === null) throw new Error('sweep refused: ' + JSON.stringify(issues));
      return values.fltPhase[0]!;
    };
    const off = phaseAt();
    p.winisdAllpassOrder.set(true);
    expect(Math.abs(phaseAt() - off)).toBeGreaterThan(0.01);
  });
});

describe('WinISD deviation cues', () => {
  it('every deviation names its switch and explains the bug and its size', () => {
    for (const d of [...WinisdDeviation.ALL, ...WinisdFilterDeviation.ALL]) {
      expect(d.title.length, d.title).toBeGreaterThan(0);
      expect(d.explanation.length, d.title).toBeGreaterThan(0);
      expect(d.size.length, d.title).toBeGreaterThan(0);
      expect(d.switchLabel.length, d.title).toBeGreaterThan(0);
    }
    expect(WinisdDeviation.ALL).toHaveLength(4);
    expect(WinisdFilterDeviation.ALL).toEqual([WinisdFilterDeviation.ALLPASS_ORDER, WinisdFilterDeviation.BESSEL_HIGHPASS]);
  });

  it('allpass order: in effect for an enabled allpass of order 2 or more while the switch is off', () => {
    const p = abcProject();
    const cue = WinisdFilterDeviation.ALLPASS_ORDER;
    p.filters.set([ALLPASS_4]);
    expect(cue.inEffectFor(p.errorSwitches, ALLPASS_4)).toBe(true);
    expect(cue.inEffectFor(p.errorSwitches, {...ALLPASS_4, order: 1})).toBe(false);
    expect(cue.inEffectFor(p.errorSwitches, {...ALLPASS_4, enabled: false})).toBe(false);
    p.winisdAllpassOrder.set(true);
    expect(cue.inEffectFor(p.errorSwitches, ALLPASS_4)).toBe(false);
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
