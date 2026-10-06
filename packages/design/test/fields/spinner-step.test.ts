import {describe, it, expect} from 'vitest';
import {spinValue, roundSpun, holdStage, HOLD_START_MS, spinStepAttr, shownSpinRule, type SpinRule} from '../../fields/spinnerStep.js';
import {NumberField} from '../../fields/field.js';

const UP = 1;
const DOWN = -1;
const OPEN = {min: -Infinity, max: Infinity};

function power(shown: string, dir: 1 | -1): number {
  const f = NumberField.SIGNAL_PIN_W;
  return spinValue(shown, dir, f.spinRule(), {min: f.limits.min, max: f.limits.max});
}

function powerFast(shown: string, dir: 1 | -1): number {
  const f = NumberField.SIGNAL_PIN_W;
  return spinValue(shown, dir, f.spinRule(), {min: f.limits.min, max: f.limits.max}, 'fast');
}

describe('spinValue fine — one unit of the 3rd significant digit, never finer than shown', () => {
  it('System input power (2 dp) steps about 1 % a press', () => {
    expect(power('0.05', UP)).toBe(0.06);
    expect(power('0.50', UP)).toBe(0.51);
    expect(power('1.00', UP)).toBe(1.01);
    expect(power('10.70', UP)).toBe(10.8);
    expect(power('100.00', UP)).toBe(101);
  });

  it('down from a power of ten uses the decade below', () => {
    expect(power('1.00', DOWN)).toBe(0.99);
    expect(power('10.00', DOWN)).toBe(9.99);
    expect(power('0.10', DOWN)).toBe(0.09);
  });

  it('up then down across a decade is symmetric', () => {
    expect(power('0.99', UP)).toBe(1);
    expect(power('9.99', UP)).toBe(10);
    expect(power('10.05', DOWN)).toBe(10);   // off-grid snaps onto the step grid
  });

  it('never stalls at min, and clamps to it', () => {
    expect(power('0.02', DOWN)).toBe(0.01);
    expect(power('0.01', DOWN)).toBe(0.01);
    expect(power('0.01', UP)).toBe(0.02);
  });

  it('clamps at max', () => {
    expect(power('100000.00', UP)).toBe(100000);
  });

  it('a count steps by one at either speed', () => {
    const f = NumberField.DRIVER_NDRIVERS;
    expect(spinValue('3', UP, f.spinRule(), OPEN)).toBe(4);
    expect(spinValue('30', UP, f.spinRule(), OPEN)).toBe(31);
    expect(spinValue('3', DOWN, f.spinRule(), OPEN)).toBe(2);
    expect(spinValue('3', UP, f.spinRule(), OPEN, 'fast')).toBe(4);
    expect(NumberField.FILTER_ORDER.spinRule()).toEqual({kind: 'integer'});
    expect(NumberField.VENT_COUNT.spinRule()).toEqual({kind: 'integer'});
    expect(NumberField.PR_NUM.spinRule()).toEqual({kind: 'integer'});
    expect(NumberField.NUMVC.spinRule()).toEqual({kind: 'integer'});
  });

  it('a signed gain steps on |v|, never finer than 0.1 dB, through 0', () => {
    const g = NumberField.FILTER_GAIN_DB.spinRule();
    expect(spinValue('0.000', UP, g, OPEN)).toBe(0.1);
    expect(spinValue('0.000', DOWN, g, OPEN)).toBe(-0.1);
    expect(spinValue('-3.000', DOWN, g, OPEN)).toBe(-3.1);
    expect(spinValue('-3.000', UP, g, OPEN)).toBe(-2.9);
    expect(spinValue('-0.100', UP, g, OPEN)).toBe(0);
    expect(Object.is(spinValue('-0.100', UP, g, OPEN), 0)).toBe(true);   // never -0
    expect(spinValue('-10.000', UP, g, OPEN)).toBe(-9.9);
    expect(spinValue('-10.000', DOWN, g, OPEN)).toBe(-10.1);
  });

  it('a switchable field takes the decimals of the unit shown', () => {
    expect(NumberField.BOX_VB_L.spinRule('L')).toEqual({kind: 'proportional', finestExp: -2});
    expect(spinValue('50.00', UP, NumberField.BOX_VB_L.spinRule('L'), OPEN)).toBe(50.1);
  });

  it('empty or unparsable text steps from 0 by the finest step', () => {
    expect(spinValue('', UP, {kind: 'proportional', finestExp: -2}, OPEN)).toBe(0.01);
  });
});

describe('spinValue fast — 10 % a press, on the grid of the shown decimals', () => {
  it('up multiplies by 1.1, down divides by it', () => {
    expect(powerFast('1.00', UP)).toBe(1.1);
    expect(powerFast('10.00', UP)).toBe(11);
    expect(powerFast('11.00', UP)).toBe(12.1);
    expect(powerFast('11.00', DOWN)).toBe(10);
  });

  it('never stalls where 10 % is under one shown unit, and clamps to min', () => {
    expect(powerFast('0.01', UP)).toBe(0.02);
    expect(powerFast('0.02', DOWN)).toBe(0.01);
    expect(powerFast('0.01', DOWN)).toBe(0.01);
  });

  it('a signed gain shrinks towards 0 and lands on it', () => {
    const g = NumberField.FILTER_GAIN_DB.spinRule();
    expect(spinValue('-3.000', DOWN, g, OPEN, 'fast')).toBe(-3.3);
    expect(spinValue('-0.100', UP, g, OPEN, 'fast')).toBe(0);
  });
});

describe('roundSpun — where a long spin lands on release', () => {
  const r: SpinRule = {kind: 'proportional', finestExp: -2};
  it('rounds to 2 significant digits', () => {
    expect(roundSpun(13.27, r, OPEN)).toBe(13);
    expect(roundSpun(12.1, r, OPEN)).toBe(12);
    expect(roundSpun(1234.5, r, OPEN)).toBe(1200);
    expect(roundSpun(-13.27, r, OPEN)).toBe(-13);
  });

  it('is never finer than the shown decimals, and stays in bounds', () => {
    expect(roundSpun(0.0456, r, OPEN)).toBe(0.05);
    expect(roundSpun(0.0456, r, {min: 0.06, max: 1})).toBe(0.06);
  });

  it('leaves a count and 0 alone', () => {
    expect(roundSpun(17, {kind: 'integer'}, OPEN)).toBe(17);
    expect(roundSpun(0, r, OPEN)).toBe(0);
  });
});

describe('holdStage — what a held ▲▼ does as the hold goes on', () => {
  it('fine steps for the first second, 150 ms apart', () => {
    expect(holdStage(0)).toEqual({speed: 'fine', repeatMs: 150, roundsOnRelease: false});
    expect(holdStage(999)).toEqual({speed: 'fine', repeatMs: 150, roundsOnRelease: false});
  });

  it('10 % steps from 1 s, still 150 ms apart, rounded on release', () => {
    expect(holdStage(1000)).toEqual({speed: 'fast', repeatMs: 150, roundsOnRelease: true});
    expect(holdStage(2999)).toEqual({speed: 'fast', repeatMs: 150, roundsOnRelease: true});
  });

  it('from 3 s the same steps repeat every 60 ms', () => {
    expect(holdStage(3000)).toEqual({speed: 'fast', repeatMs: 60, roundsOnRelease: true});
    expect(holdStage(60000)).toEqual({speed: 'fast', repeatMs: 60, roundsOnRelease: true});
  });

  it('the first repeat waits so a tap never double-fires', () => {
    expect(HOLD_START_MS).toBe(450);
  });
});

describe('shownSpinRule — a field-less input never steps finer than its shown text', () => {
  it('takes the shown decimals as the finest step', () => {
    expect(shownSpinRule('0.7')).toEqual({kind: 'proportional', finestExp: -1});
    expect(shownSpinRule('50')).toEqual({kind: 'proportional', finestExp: 0});
    expect(spinValue('50', UP, shownSpinRule('50'), OPEN)).toBe(51);
    expect(spinValue('1234', UP, shownSpinRule('1234'), OPEN)).toBe(1240);   // off-grid snaps onto the step grid
  });
});

describe('spinStepAttr — the native step attribute: the finest step, never "any"', () => {
  const r: SpinRule = {kind: 'proportional', finestExp: -2};
  it('is one unit of the shown decimals, whatever the value', () => {
    expect(spinStepAttr('1.00', r)).toBe('0.01');
    expect(spinStepAttr('0.05', r)).toBe('0.01');
    expect(spinStepAttr('', r)).toBe('0.01');
    expect(spinStepAttr('3', {kind: 'integer'})).toBe('1');
  });

  // BUG_20261003_chart-tick-and-spinner-step-edge-cases: 10 ** -4 is 0.00009999999999999999.
  it('a step below 0.001 is a clean decimal, with no float tail', () => {
    expect(spinStepAttr('0.0045', {kind: 'proportional', finestExp: -4})).toBe('0.0001');
    expect(spinStepAttr('0.00045', {kind: 'proportional', finestExp: -5})).toBe('0.00001');
  });
});
