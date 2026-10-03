import {describe, expect, it} from 'vitest';
import {NumberField} from '../../fields/field.js';

describe('NumberField core methods', () => {
  it('format formats values according to field precision and unit scaling', () => {
    expect(NumberField.BOX_VB_L.format(0.025)).toBe('25.00'); // 0.025 m³ = 25.00 L (precision 2 in L)
    expect(NumberField.RE_OHM.format(6.2)).toBe('6.200'); // Re base precision 3
  });

  it('format respects halfWidth uncertainty intervals', () => {
    // 0.2200 m = 220.0 mm (halfWidthSI 0.00005 m = 0.05 mm -> 1 dp, clamped to field min dp 3 in mm)
    expect(NumberField.XMAX_M.format(0.22, 0.00005, 'mm')).toBe('220.000');
    // 0.02500 m³ = 25.00 L (halfWidthSI 0.000005 m³ = 0.005 L -> 2 dp in L)
    expect(NumberField.BOX_VB_L.format(0.025, 0.000005, 'L')).toBe('25.00');
  });

  it('parseEntry converts user input to SI and half-width', () => {
    const parsed = NumberField.BOX_VB_L.parseEntry('25.5', 'L');
    expect(parsed.kind).toBe('quantity');
    if (parsed.kind === 'quantity') {
      expect(parsed.valueSI).toBeCloseTo(0.0255, 5);
      expect(parsed.halfWidthSI).toBeCloseTo(0.00005, 7);
    }
  });

  it('nextToken cycles through switchable unit tokens', () => {
    expect(NumberField.BOX_VB_L.nextToken('L')).toBe('cuft');
    expect(NumberField.QTS.nextToken()).toBeUndefined(); // fixed unit
  });

  it('stepAttr produces step string for inputs', () => {
    expect(NumberField.BOX_VB_L.stepAttr('L')).toBe('0.01');
  });
});
