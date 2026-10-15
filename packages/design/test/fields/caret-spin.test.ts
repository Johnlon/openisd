import {describe, it, expect} from 'vitest';
import {caretSpin} from '../../fields/caretSpin.js';

const OPEN = {min: -Infinity, max: undefined};

/** Steps `text` with the caret at the `|` in `marked`; the result shows its caret as `|` again. */
function spin(marked: string, dir: 1 | -1, bounds = OPEN): string | null {
  const caret = marked.indexOf('|');
  const r = caretSpin(marked.replace('|', ''), caret, dir, bounds);
  return r === null ? null : r.text.slice(0, r.caret) + '|' + r.text.slice(r.caret);
}

describe('caretSpin: the digit at the caret sets the step', () => {
  it('steps the units digit by 1 with the caret just right of it', () => {
    expect(spin('19|.9', 1)).toBe('20|.9');
    expect(spin('19|.9', -1)).toBe('18|.9');
  });
  it('steps the tenths digit by 0.1 with the caret just right of it', () => {
    expect(spin('19.5|', 1)).toBe('19.6|');
    expect(spin('19.5|', -1)).toBe('19.4|');
  });
  it('steps the tens digit by 10 with the caret just right of it', () => {
    expect(spin('1|9.5', 1)).toBe('2|9.5');
  });
  it('uses the digit to the right where nothing digit is on the left', () => {
    expect(spin('|19.5', 1)).toBe('|29.5');
    expect(spin('19.|5', 1)).toBe('19.|6');
    expect(spin('-|19.5', -1)).toBe('-|29.5');
  });
  it('steps hundredths and thousandths', () => {
    expect(spin('1.23|', 1)).toBe('1.24|');
    expect(spin('0.12|5', 1)).toBe('0.13|5');
    expect(spin('1.2|34', 1)).toBe('1.3|34');
  });
});

describe('caretSpin: carries and the caret', () => {
  it('carries 19.9 to 20.0 at the tenths and keeps the caret on the tenths digit', () => {
    expect(spin('19.9|', 1)).toBe('20.0|');
  });
  it('carries into a new leading digit and the caret stays on its digit', () => {
    expect(spin('99.9|', 1)).toBe('100.0|');
    expect(spin('99|.9', 1)).toBe('100|.9');
    expect(spin('9|9.9', 1)).toBe('10|9.9');
  });
  it('borrows down: 20.0 to 19.9 and 100 to 99', () => {
    expect(spin('20.0|', -1)).toBe('19.9|');
    expect(spin('100|', -1)).toBe('99|');
  });
  it('keeps the shown decimals and never shrinks or gains them', () => {
    expect(spin('1.50|', 1)).toBe('1.51|');
    expect(spin('10|', 1)).toBe('11|');
    expect(spin('10.0|', 1)).toBe('10.1|');
  });
  it('lets the caret stay where its digit no longer exists', () => {
    expect(spin('|100', -1)).toBe('|0');
  });
  it('reports the value, the decimals the digit needs, and accepts a comma', () => {
    const r = caretSpin('1,25', 4, 1, OPEN);
    expect(r).toEqual({text: '1.26', value: 1.26, caret: 4, decimals: 2});
  });
});

describe('caretSpin: negatives', () => {
  it('steps away from zero downward and towards zero upward', () => {
    expect(spin('-5.2|', 1)).toBe('-5.1|');
    expect(spin('-5.2|', -1)).toBe('-5.3|');
  });
  it('crosses zero without a negative zero', () => {
    expect(spin('-0.1|', 1)).toBe('0.0|');
    expect(spin('0.0|', -1)).toBe('-0.1|');
  });
  it('carries a negative: -9.9 down is -10.0', () => {
    expect(spin('-9.9|', -1)).toBe('-10.0|');
  });
  it('does nothing with the caret left of the sign', () => {
    expect(spin('|-5.2', 1)).toBeNull();
  });
});

describe('caretSpin: limits', () => {
  it('clamps to the minimum and the maximum', () => {
    expect(spin('0.5|', -1, {min: 0.5, max: undefined})).toBe('0.5|');
    expect(caretSpin('9.5', 3, 1, {min: 0, max: 9.8})?.value).toBe(9.6);
    expect(caretSpin('9.9', 3, 1, {min: 0, max: 10})?.text).toBe('10.0');
    expect(caretSpin('9.9', 3, 1, {min: 0, max: 9.9})?.text).toBe('9.9');
    expect(caretSpin('0.0', 3, -1, {min: 0, max: undefined})?.text).toBe('0.0');
  });
});

describe('caretSpin: nothing to step', () => {
  it('returns null for empty, sign only, exponent, words and a bare point', () => {
    for (const text of ['', '-', '1e3', 'abc', '.', '1 2']) {
      expect(caretSpin(text, text.length, 1, OPEN), text).toBeNull();
    }
  });
  it('returns null with a caret outside the text', () => {
    expect(caretSpin('1.5', 9, 1, OPEN)).toBeNull();
    expect(caretSpin('1.5', -1, 1, OPEN)).toBeNull();
  });
  it('returns null just after a trailing point, with no digit beside the caret', () => {
    expect(caretSpin('19.', 3, 1, OPEN)).toBeNull();
  });
});
