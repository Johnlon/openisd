import {describe, it, expect} from 'vitest';
import {spinValue, spinStepAttr, shownSpinRule, type SpinRule} from '../../fields/spinnerStep.js';
import {NumberField} from '../../fields/field.js';

const UP = 1;
const DOWN = -1;
const OPEN = {min: -Infinity, max: Infinity};

function power(shown: string, dir: 1 | -1): number {
  const f = NumberField.SIGNAL_PIN_W;
  return spinValue(shown, dir, f.spinRule(), {min: f.limits.min, max: f.limits.max});
}

describe('spinValue — a tenth of the value\'s decade, never finer than shown', () => {
  it('System input power (2 dp) steps proportionally', () => {
    expect(power('0.05', UP)).toBe(0.06);
    expect(power('0.50', UP)).toBe(0.51);
    expect(power('1.00', UP)).toBe(1.1);
    expect(power('10.00', UP)).toBe(11);
    expect(power('100.00', UP)).toBe(110);
  });

  it('down from a power of ten uses the decade below', () => {
    expect(power('1.00', DOWN)).toBe(0.99);
    expect(power('10.00', DOWN)).toBe(9.9);
    expect(power('0.10', DOWN)).toBe(0.09);
  });

  it('up then down across a decade is symmetric', () => {
    expect(power('0.99', UP)).toBe(1);
    expect(power('9.90', UP)).toBe(10);
    expect(power('9.95', UP)).toBe(10);   // off-grid snaps onto the step grid
    expect(power('10.05', DOWN)).toBe(10);
  });

  it('never stalls at min, and clamps to it', () => {
    expect(power('0.02', DOWN)).toBe(0.01);
    expect(power('0.01', DOWN)).toBe(0.01);
    expect(power('0.01', UP)).toBe(0.02);
  });

  it('clamps at max', () => {
    expect(power('100000.00', UP)).toBe(100000);
  });

  it('a count steps by one', () => {
    const f = NumberField.DRIVER_NDRIVERS;
    expect(spinValue('3', UP, f.spinRule(), OPEN)).toBe(4);
    expect(spinValue('30', UP, f.spinRule(), OPEN)).toBe(31);
    expect(spinValue('3', DOWN, f.spinRule(), OPEN)).toBe(2);
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
    expect(spinValue('-10.000', UP, g, OPEN)).toBe(-9.9);
    expect(spinValue('-10.000', DOWN, g, OPEN)).toBe(-11);
  });

  it('a switchable field takes the decimals of the unit shown', () => {
    expect(NumberField.BOX_VB_L.spinRule('L')).toEqual({kind: 'decade', finestExp: -2});
    expect(spinValue('50.00', UP, NumberField.BOX_VB_L.spinRule('L'), OPEN)).toBe(51);
  });

  it('empty or unparsable text steps from 0 by the finest step', () => {
    expect(spinValue('', UP, {kind: 'decade', finestExp: -2}, OPEN)).toBe(0.01);
  });
});

describe('shownSpinRule — a field-less input never steps finer than its shown text', () => {
  it('takes the shown decimals as the finest step', () => {
    expect(shownSpinRule('0.7')).toEqual({kind: 'decade', finestExp: -1});
    expect(shownSpinRule('50')).toEqual({kind: 'decade', finestExp: 0});
    expect(spinValue('50', UP, shownSpinRule('50'), OPEN)).toBe(51);
    expect(spinValue('1234', UP, shownSpinRule('1234'), OPEN)).toBe(1300);   // off-grid snaps onto the step grid
  });
});

describe('spinStepAttr — the native step attribute: the upward step, never "any"', () => {
  const r: SpinRule = {kind: 'decade', finestExp: -2};
  it('is the step an up press takes', () => {
    expect(spinStepAttr('1.00', r)).toBe('0.1');
    expect(spinStepAttr('0.05', r)).toBe('0.01');
    expect(spinStepAttr('', r)).toBe('0.01');
    expect(spinStepAttr('3', {kind: 'integer'})).toBe('1');
  });

  // BUG_20261003_chart-tick-and-spinner-step-edge-cases: 10 ** -4 is 0.00009999999999999999.
  it('a step below 0.001 is a clean decimal, with no float tail', () => {
    expect(spinStepAttr('0.0045', {kind: 'decade', finestExp: -6})).toBe('0.0001');
    expect(spinStepAttr('0.00045', {kind: 'decade', finestExp: -6})).toBe('0.00001');
  });
});
