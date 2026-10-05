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
import {reproduceWinisdBugs} from '../fixtures/domainBuilders.js';
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

  it('driver model and VA model: always marked, applicable and in scope, reproducing the error while ticked', () => {
    const p = abcProject();
    p.winisdDriverModel.set(true);
    p.winisdVaModel.set(false);
    expect(p.errorSwitches.driverModel).toEqual({marked: true, applicable: true, inScope: true, reproducesError: true});
    expect(p.errorSwitches.vaModel).toEqual({marked: true, applicable: true, inScope: true, reproducesError: false});
    p.winisdVaModel.set(true);
    p.winisdDriverModel.set(false);
    expect(p.errorSwitches.vaModel.reproducesError).toBe(true);
    expect(p.errorSwitches.driverModel.reproducesError).toBe(false);
  });

  it('PR Npr resonance: in scope on a passive radiator box; applicable there with more than one radiator only; reproducing the error only when ticked', () => {
    const p = abcProject();
    expect(p.errorSwitches.prNprResonance).toEqual({marked: true, applicable: false, inScope: false, reproducesError: false});
    p.box.boxType.set('box-passive-radiator');
    // One radiator: Npr = 1, so WinISD's mass × Npr and the tuning's ÷ Npr agree; the switch does nothing (John, 2026-10-05).
    p.box.passiveRadiator.count.set(1);
    expect(p.errorSwitches.prNprResonance).toEqual({marked: true, applicable: false, inScope: true, reproducesError: false});
    p.box.passiveRadiator.count.set(2);
    expect(p.errorSwitches.prNprResonance).toEqual({marked: true, applicable: true, inScope: true, reproducesError: false});
    p.winisdPrNprResonance.set(true);
    expect(p.errorSwitches.prNprResonance).toEqual({marked: true, applicable: true, inScope: true, reproducesError: true});
  });

  it('per-driver impedance: in scope on every box; applicable with more than one driver only; reproducing the bug only when ticked', () => {
    const p = abcProject();
    p.nDrivers.set(1);
    expect(p.errorSwitches.driverCount).toEqual({marked: true, applicable: false, inScope: true, reproducesError: false});
    p.nDrivers.set(2);
    expect(p.errorSwitches.driverCount).toEqual({marked: true, applicable: true, inScope: true, reproducesError: false});
    p.winisdDriverCountModel.set(true);
    expect(p.errorSwitches.driverCount).toEqual({marked: true, applicable: true, inScope: true, reproducesError: true});
  });

  it('per-driver impedance: the cue shows at any driver count while the switch is off (John, 2026-10-05)', () => {
    const p = abcProject();
    p.nDrivers.set(1);
    expect(WinisdDeviation.DRIVER_COUNT.cueShown(p.errorSwitches)).toBe(true);
    p.nDrivers.set(2);
    expect(WinisdDeviation.DRIVER_COUNT.cueShown(p.errorSwitches)).toBe(true);
    expect(WinisdDeviation.DRIVER_COUNT.remedy).toMatch(/"Per-driver impedance"/);
    p.winisdDriverCountModel.set(true);
    expect(WinisdDeviation.DRIVER_COUNT.cueShown(p.errorSwitches)).toBe(false);
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
    expect(WinisdDeviation.ALL).toEqual([WinisdDeviation.DRIVER_MODEL, WinisdDeviation.VA_MODEL, WinisdDeviation.PR_NPR_RESONANCE, WinisdDeviation.ABC_GROUP_DELAY, WinisdDeviation.DRIVER_COUNT]);
    expect(WinisdFilterDeviation.ALL).toEqual([WinisdFilterDeviation.ALLPASS_ORDER, WinisdFilterDeviation.LINKWITZ_RILEY_ORDER, WinisdFilterDeviation.BESSEL_HIGHPASS]);
    expect(WinisdFilterDeviation.BESSEL_HIGHPASS.remedy).toMatch(/"Bessel high-pass"/);
    expect(WinisdFilterDeviation.ALLPASS_ORDER.remedy).toMatch(/no switch/);
  });

  it('allpass order (no switch): the cue shows on every allpass, whatever its order or enabled state', () => {
    const p = abcProject();
    const cue = WinisdFilterDeviation.ALLPASS_ORDER;
    p.filters.set([ALLPASS_4]);
    expect(cue.cueShownFor(p.errorSwitches, ALLPASS_4)).toBe(true);
    expect(cue.cueShownFor(p.errorSwitches, {...ALLPASS_4, order: 2})).toBe(true);
    expect(cue.cueShownFor(p.errorSwitches, {...ALLPASS_4, enabled: false})).toBe(true);
    expect(cue.cueShownFor(p.errorSwitches, {type: 'lowpass', enabled: true, family: 'butterworth', order: 2, fc: 80, Q: 0.707})).toBe(false);
    reproduceWinisdBugs(p);
    expect(cue.cueShownFor(p.errorSwitches, ALLPASS_4)).toBe(true);
  });

  it('Linkwitz-Riley order (no switch): the cue shows on every Linkwitz-Riley low- or high-pass, order 4 included', () => {
    const p = abcProject();
    const cue = WinisdFilterDeviation.LINKWITZ_RILEY_ORDER;
    const lr: Filter = {type: 'lowpass', enabled: true, family: 'linkwitzRiley', order: 2, fc: 80, Q: 0.707};
    expect(cue.cueShownFor(p.errorSwitches, lr)).toBe(true);
    expect(cue.cueShownFor(p.errorSwitches, {...lr, type: 'highpass', order: 8})).toBe(true);
    expect(cue.cueShownFor(p.errorSwitches, {...lr, order: 4})).toBe(true);
    expect(cue.cueShownFor(p.errorSwitches, {...lr, enabled: false})).toBe(true);
    expect(cue.cueShownFor(p.errorSwitches, {...lr, family: 'butterworth'})).toBe(false);
  });

  it('Bessel high-pass: the cue shows on every Bessel high-pass, order 1 included, while the switch is off', () => {
    const p = abcProject();
    const cue = WinisdFilterDeviation.BESSEL_HIGHPASS;
    const hp: Filter = {type: 'highpass', enabled: true, family: 'bessel', order: 4, fc: 25, Q: 0.707};
    expect(cue.cueShownFor(p.errorSwitches, hp)).toBe(true);
    expect(cue.cueShownFor(p.errorSwitches, {...hp, order: 1})).toBe(true);
    expect(cue.cueShownFor(p.errorSwitches, {...hp, enabled: false})).toBe(true);
    expect(cue.cueShownFor(p.errorSwitches, {...hp, family: 'butterworth'})).toBe(false);
    expect(cue.cueShownFor(p.errorSwitches, {...hp, type: 'lowpass'})).toBe(false);
    expect(cue.cueShownFor(p.errorSwitches, ALLPASS_4)).toBe(false);
    p.filters.set([hp]);
    p.winisdBesselHighpass.set(true);
    expect(cue.cueShownFor(p.errorSwitches, hp)).toBe(false);
  });

  it('VA model: its cue belongs to the VA chart, shown while the switch is off', () => {
    const p = abcProject();
    const cue = WinisdDeviation.VA_MODEL;
    p.winisdVaModel.set(false);
    expect(cue.cueShownOnChart(p.errorSwitches, 'VA')).toBe(true);
    expect(cue.cueShownOnChart(p.errorSwitches, 'SPL')).toBe(false);
    expect(WinisdDeviation.PR_NPR_RESONANCE.cueShownOnChart(p.errorSwitches, 'VA')).toBe(false);
    p.winisdVaModel.set(true);
    expect(cue.cueShownOnChart(p.errorSwitches, 'VA')).toBe(false);
  });

  it('PR Npr resonance: the cue shows on a passive radiator box at any radiator count while the switch is off (John, 2026-10-05)', () => {
    const p = abcProject();
    const cue = WinisdDeviation.PR_NPR_RESONANCE;
    expect(cue.cueShown(p.errorSwitches)).toBe(false);
    p.box.boxType.set('box-passive-radiator');
    p.box.passiveRadiator.count.set(1);
    expect(cue.cueShown(p.errorSwitches)).toBe(true);
    p.box.passiveRadiator.count.set(2);
    expect(cue.cueShown(p.errorSwitches)).toBe(true);
    p.winisdPrNprResonance.set(true);
    expect(cue.cueShown(p.errorSwitches)).toBe(false);
  });
});
