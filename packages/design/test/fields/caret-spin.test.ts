import {describe, it, expect} from 'vitest';
import {CARET_HOLD_START_MS, caretRepeatDelayMs, caretSpin, spinStep, steppingCaret, tenthsCaret, type StepAt} from '../../fields/caretSpin.js';

const NONE: StepAt = {kind: 'none'};
const caretAt = (at: number): StepAt => ({kind: 'caret', at});
const digitAt = (at: number): StepAt => ({kind: 'digit', at});

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
    expect(r).toEqual({text: '1.26', value: 1.26, caret: 4, decimals: 2, place: -2, mark: 3});
  });
});

// John, 2026-10-16: "The mark follows place value (tenths stays tenths across 9.9 → 10.0), not
// character index." The result carries the PLACE VALUE of the stepped digit (power of ten:
// tenths = -1, tens = 1) and the mark position in the NEW text, recomputed from that place.
describe('caretSpin: the stepped digit carries its place value', () => {
  it('9.9 up a tenth keeps the tenths place through the carry to 10.0', () => {
    const r = caretSpin('9.9', 3, 1, OPEN);
    expect(r?.text).toBe('10.0');
    expect(r?.place).toBe(-1);
    expect(r?.mark).toBe(3);     // the 0 of ".0"
    expect(r?.caret).toBe(4);    // just right of it
  });
  it('10.0 down a tenth keeps the tenths place through the borrow to 9.9', () => {
    const r = caretSpin('10.0', 4, -1, OPEN);
    expect(r?.text).toBe('9.9');
    expect(r?.place).toBe(-1);
    expect(r?.mark).toBe(2);
    expect(r?.caret).toBe(3);
  });
  it('99 up a unit keeps the units place through the carry to 100', () => {
    const r = caretSpin('99', 2, 1, OPEN);
    expect(r?.text).toBe('100');
    expect(r?.place).toBe(0);
    expect(r?.mark).toBe(2);
    expect(r?.caret).toBe(3);
  });
  it('0.99 up a hundredth carries to 1.00 at the hundredths place', () => {
    const r = caretSpin('0.99', 4, 1, OPEN);
    expect(r?.text).toBe('1.00');
    expect(r?.place).toBe(-2);
    expect(r?.mark).toBe(3);
    expect(r?.caret).toBe(4);
  });
  it('0.95 up a hundredth steps 0.96, hundredths mark and all', () => {
    const r = caretSpin('0.95', 4, 1, OPEN);
    expect(r?.text).toBe('0.96');
    expect(r?.place).toBe(-2);
    expect(r?.mark).toBe(3);
  });
  it('a negative keeps its place and marks the digit in the signed text', () => {
    const down = caretSpin('-9.9', 4, -1, OPEN);
    expect(down?.text).toBe('-10.0');
    expect(down?.place).toBe(-1);
    expect(down?.mark).toBe(4);
    expect(down?.caret).toBe(5);
    const unit = caretSpin('-5', 2, -1, OPEN);
    expect(unit?.text).toBe('-6');
    expect(unit?.place).toBe(0);
    expect(unit?.mark).toBe(1);
  });
  it('a field with no decimal point steps units and marks the units digit', () => {
    const down = caretSpin('100', 3, -1, OPEN);
    expect(down?.text).toBe('99');
    expect(down?.place).toBe(0);
    expect(down?.mark).toBe(1);
    const tens = caretSpin('100', 2, 1, OPEN);
    expect(tens?.text).toBe('110');
    expect(tens?.place).toBe(1);
    expect(tens?.mark).toBe(1);
  });
  it('marks the leading digit when the stepped place no longer exists (100 down to 0)', () => {
    const r = caretSpin('100', 0, -1, OPEN);
    expect(r?.text).toBe('0');
    expect(r?.place).toBe(2);
    expect(r?.mark).toBe(0);
    expect(r?.caret).toBe(0);
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

describe('tenthsCaret — where a number with no remembered caret steps', () => {
  it('sits just after the tenths digit, so a step is 0.1', () => {
    expect(tenthsCaret('6.00')).toBe(3);
    expect(tenthsCaret('12.345')).toBe(4);
    expect(tenthsCaret('6,5')).toBe(3);
    expect(caretSpin('6.00', tenthsCaret('6.00'), 1, {min: 0, max: undefined})?.text).toBe('6.10');
  });
  it('sits at the last digit when no decimals are shown, since a step never adds decimals', () => {
    expect(tenthsCaret('600')).toBe(3);
    expect(tenthsCaret('6.')).toBe(2);
  });
});

describe('a remembered caret', () => {
  it('on the units steps 1, and carries', () => {
    expect(caretSpin('9.5', 1, 1, {min: 0, max: undefined})?.text).toBe('10.5');
    expect(caretSpin('6.50', 1, 1, {min: 0, max: undefined})?.text).toBe('7.50');
  });
  it('lands on the same digit after the step, so a repeat steps the same digit', () => {
    const first = caretSpin('6.00', 3, 1, {min: 0, max: undefined});
    expect(first).not.toBeNull();
    const second = caretSpin(first?.text ?? '', first?.caret ?? -1, 1, {min: 0, max: undefined});
    expect(second?.text).toBe('6.20');
  });
});

// John, 2026-10-21 (QO291.c153): "if I was spinning 10s then it needs to move to 100s as the number
// grows .. unless human intervenes to move the focus digit". A step after a step steps the same place.
describe('spinStep: the next step keeps the place until the caret moves', () => {
  it('with no last step, steps at the caret like caretSpin, and at the tenths with no caret', () => {
    expect(spinStep('9.5', caretAt(1), null, 1, OPEN)?.text).toBe('10.5');
    expect(spinStep('6.00', NONE, null, 1, OPEN)?.text).toBe('6.10');
    expect(spinStep('6.00', caretAt(4), null, 1, OPEN)?.text).toBe('6.01');
  });
  it('keeps the tens through a lost digit: 10.5 down is 0.5, up again is 10.5', () => {
    const down = spinStep('10.5', caretAt(0), null, -1, OPEN);
    expect(down?.text).toBe('0.5');
    expect(down?.place).toBe(1);
    const left = caretAt(down?.caret ?? -1);
    const up = spinStep(down?.text ?? '', left, {place: 1, at: left}, 1, OPEN);
    expect(up?.text).toBe('10.5');
    expect(up?.place).toBe(1);
    expect(up?.mark).toBe(0);
  });
  it('keeps the hundreds through 105 down to 5 and back', () => {
    const last = {place: 2, at: caretAt(0)};
    expect(spinStep('5', caretAt(0), last, 1, OPEN)?.text).toBe('105');
    expect(spinStep('5', caretAt(0), last, -1, OPEN)?.text).toBe('-95');
  });
  it('keeps the tens as 90 becomes 100 and the tenths as 9.9 becomes 10.0', () => {
    expect(spinStep('90', caretAt(2), {place: 1, at: caretAt(2)}, 1, OPEN)?.text).toBe('100');
    const tenths = spinStep('9.9', caretAt(3), {place: -1, at: caretAt(3)}, 1, OPEN);
    expect(tenths?.text).toBe('10.0');
    expect(tenths?.mark).toBe(3);
    expect(tenths?.caret).toBe(4);
  });
  it('keeps a place the text has too few decimals for, and shows it', () => {
    expect(spinStep('100', caretAt(3), {place: -1, at: caretAt(3)}, 1, OPEN)?.text).toBe('100.1');
  });
  it('follows the caret once the person has moved it', () => {
    expect(spinStep('0.5', caretAt(1), {place: 1, at: caretAt(0)}, 1, OPEN)?.text).toBe('1.5');
  });
  it('clamps to the limits at the kept place', () => {
    expect(spinStep('0.5', caretAt(0), {place: 1, at: caretAt(0)}, 1, {min: 0, max: 8})?.text).toBe('8.0');
    expect(spinStep('5', caretAt(0), {place: 1, at: caretAt(0)}, -1, {min: 0, max: undefined})?.text).toBe('0');
  });
});

// fable, 21 Oct 2026 (bugs/BUG_20261021_last-decimal-digit-cannot-spin.md): a selected digit spins its
// own place wherever it sits. John,27 October2026: an explicit end caret chooses the final digit too.
describe('a selected digit chooses its place', () => {
  it('the last digit of 1.05 selected spins the hundredths', () => {
    expect(steppingCaret('1.05', digitAt(3))).toBe(4);
    const r = spinStep('1.05', digitAt(3), null, 1, OPEN);
    expect(r?.text).toBe('1.06');
    expect(r?.place).toBe(-2);
    expect(r?.mark).toBe(3);
  });
  it('a bare caret after the last digit spins that last digit', () => {
    expect(spinStep('1.05', caretAt(4), null, 1, OPEN)?.text).toBe('1.06');
  });
  it('any other selected digit spins its place, as a caret right of it does', () => {
    expect(spinStep('1.05', digitAt(0), null, 1, OPEN)?.text).toBe('2.05');
    expect(spinStep('1.05', digitAt(2), null, 1, OPEN)?.text).toBe('1.15');
  });
  it('the next step keeps the place while the same digit is still selected', () => {
    expect(spinStep('1.09', digitAt(3), {place: -2, at: digitAt(3)}, 1, OPEN)?.text).toBe('1.10');
    expect(spinStep('9.99', digitAt(3), {place: -2, at: digitAt(3)}, 1, OPEN)?.text).toBe('10.00');
  });
  it('a caret and a selection at the same index are different positions', () => {
    expect(spinStep('0.5', digitAt(0), {place: 1, at: caretAt(0)}, 1, OPEN)?.text).toBe('1.5');
  });
});

describe('caretRepeatDelayMs — the hold-to-repeat schedule', () => {
  it('starts after 400 ms at about 3 steps a second', () => {
    expect(CARET_HOLD_START_MS).toBe(400);
    expect(caretRepeatDelayMs(400)).toBeCloseTo(1000 / 3, 6);
    expect(caretRepeatDelayMs(0)).toBeCloseTo(1000 / 3, 6);
  });
  it('eases up to about 12 steps a second over roughly 3 seconds, and stays there', () => {
    expect(caretRepeatDelayMs(400 + 3000)).toBeCloseTo(1000 / 12, 6);
    expect(caretRepeatDelayMs(60000)).toBeCloseTo(1000 / 12, 6);
  });
  it('speeds up smoothly: every later step is no slower than the one before', () => {
    let last = Infinity;
    for (let held = 400; held <= 3600; held += 100) {
      const delay = caretRepeatDelayMs(held);
      expect(delay).toBeLessThanOrEqual(last);
      last = delay;
    }
  });
});

describe('steppingCaret — a step starts at the tenths unless the person moved the digit (John, 21 Oct 2026)', () => {
  it('uses the tenths digit when no caret was ever set', () => {
    expect(steppingCaret('20.00', NONE)).toBe(4);
  });
  it('keeps the caret after the final digit, including trailing precision zeroes', () => {
    expect(steppingCaret('20.00', caretAt(5))).toBe(5);
    expect(steppingCaret('4.8', caretAt(3))).toBe(3);
  });
  it('keeps a caret the person put on another digit', () => {
    expect(steppingCaret('20.00', caretAt(1))).toBe(1);
    expect(steppingCaret('20.00', caretAt(2))).toBe(2);
  });
  it('a number with no decimals steps its units digit', () => {
    expect(steppingCaret('600', NONE)).toBe(3);
    expect(steppingCaret('600', caretAt(3))).toBe(3);
  });
});

describe('a caret after the final displayed digit', () => {
  it.each([
    ['123.4500', '123.4501', 7, -4],
    ['1,05', '1.06', 3, -2],
    ['-1.05', '-1.04', 4, -2],
    ['99', '100', 2, 0],
  ] as const)('steps and marks the last digit of %s', (text, expected, mark, place) => {
    const result = spinStep(text, caretAt(text.length), null, 1, OPEN);
    expect(result?.text).toBe(expected);
    expect(result?.mark).toBe(mark);
    expect(result?.place).toBe(place);
  });
});
