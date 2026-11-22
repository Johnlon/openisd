/**
 * What text a number field accepts, and what a paste becomes. Pure: no DOM. The UI hands over the
 * text in the box, the selection and what is being inserted; it gets back the text to put there or
 * a refusal.
 */

/** Text that is a number, or the start of one ("", "-", "1.", ".5"). "," is a decimal mark too. */
export const NUMBER_TEXT = /^-?\d*[.,]?\d*$/;
/** The first number in a pasted text: "12.5 Hz", "-3", "1,5", ".5", "7.". */
const NUMBER_IN_TEXT = /-?(?:\d+[.,]?\d*|[.,]\d+)/;

/** A text edit that is allowed: the whole text after it, and where the caret then sits. */
export type NumberEdit =
  | {readonly kind: 'accept'; readonly text: string; readonly caret: number}
  | {readonly kind: 'refuse'};

export interface NumberBox {
  readonly text: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
}

const REFUSED: NumberEdit = {kind: 'refuse'};

/** Typing `inserted` at the caret, or over the selection: allowed when what is left is a number or the start of one. */
export function typedEdit(box: NumberBox, inserted: string): NumberEdit {
  const text = box.text.slice(0, box.selectionStart) + inserted + box.text.slice(box.selectionEnd);
  if (!NUMBER_TEXT.test(text)) return REFUSED;
  return {kind: 'accept', text, caret: box.selectionStart + inserted.length};
}

/** The number a pasted text carries ("12.5 Hz" gives "12.5", "1,5" gives "1.5"), or null when it has none. */
export function numberInPaste(pasted: string): string | null {
  const found = NUMBER_IN_TEXT.exec(pasted);
  return found === null ? null : found[0].replace(',', '.');
}

/** Pasting `pasted` at the caret, or over the selection: its number goes in; with no number, or a result that is no number, the paste is refused. */
export function pastedEdit(box: NumberBox, pasted: string): NumberEdit {
  const number = numberInPaste(pasted);
  if (number === null) return REFUSED;
  return typedEdit(box, number);
}
