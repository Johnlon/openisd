import {describe, it, expect} from 'vitest';
import {NUMBER_TEXT, numberInPaste, pastedEdit, typedEdit, type NumberBox, type NumberEdit} from '../../fields/numberText.js';

/** A box from marked text: `|` is the caret, `[..]` a selection. */
function box(marked: string): NumberBox {
  const s = marked.indexOf('[');
  if (s >= 0) {
    const e = marked.indexOf(']');
    return {text: marked.slice(0, s) + marked.slice(s + 1, e) + marked.slice(e + 1), selectionStart: s, selectionEnd: e - 1};
  }
  const c = marked.indexOf('|');
  return {text: marked.replace('|', ''), selectionStart: c, selectionEnd: c};
}
function result(e: NumberEdit): string | null {
  return e.kind === 'refuse' ? null : e.text.slice(0, e.caret) + '|' + e.text.slice(e.caret);
}

describe('NUMBER_TEXT', () => {
  it('takes numbers and the start of one', () => {
    for (const t of ['', '-', '.', ',', '1.', '.5', '-0,5', '12.5']) expect(NUMBER_TEXT.test(t)).toBe(true);
  });
  it('refuses anything else', () => {
    for (const t of ['a', '12a', '1.2.3', '--1', '1-', '1e5', ' 1', '12 Hz']) expect(NUMBER_TEXT.test(t)).toBe(false);
  });
});

describe('typedEdit', () => {
  it('lets digits, a point and a leading minus in', () => {
    expect(result(typedEdit(box('12|'), '3'))).toBe('123|');
    expect(result(typedEdit(box('12|'), '.'))).toBe('12.|');
    expect(result(typedEdit(box('|12'), '-'))).toBe('-|12');
  });
  it('refuses letters, at the end, the start and over a selection', () => {
    expect(result(typedEdit(box('12|'), 'a'))).toBeNull();
    expect(result(typedEdit(box('|12'), 'a'))).toBeNull();
    expect(result(typedEdit(box('[12]'), 'a'))).toBeNull();
  });
  it('refuses a second point or a minus in the middle', () => {
    expect(result(typedEdit(box('1.2|'), '.'))).toBeNull();
    expect(result(typedEdit(box('1|2'), '-'))).toBeNull();
  });
  it('a typed digit replaces the selection', () => {
    expect(result(typedEdit(box('[12]'), '7'))).toBe('7|');
  });
});

describe('numberInPaste', () => {
  it('takes the number out of the text', () => {
    expect(numberInPaste('12.5 Hz')).toBe('12.5');
    expect(numberInPaste('1,5')).toBe('1.5');
    expect(numberInPaste(' -3 dB')).toBe('-3');
    expect(numberInPaste('.5')).toBe('.5');
  });
  it('is null when there is no number', () => {
    expect(numberInPaste('abc')).toBeNull();
    expect(numberInPaste('')).toBeNull();
    expect(numberInPaste('-')).toBeNull();
  });
});

describe('pastedEdit', () => {
  it('puts the number of "12.5 Hz" into an empty box', () => {
    expect(result(pastedEdit(box('|'), '12.5 Hz'))).toBe('12.5|');
  });
  it('replaces the selection', () => {
    expect(result(pastedEdit(box('[12]'), '1,5'))).toBe('1.5|');
  });
  it('refuses a paste with no number, and the box is left as it was', () => {
    expect(result(pastedEdit(box('12|'), 'abc'))).toBeNull();
  });
  it('refuses a paste that would leave something that is not a number', () => {
    expect(result(pastedEdit(box('12|'), '-3'))).toBeNull();
    expect(result(pastedEdit(box('1.2|'), '3.4'))).toBeNull();
  });
  it('adds at the caret in the middle', () => {
    expect(result(pastedEdit(box('1|3'), 'x 2 y'))).toBe('12|3');
  });
});
