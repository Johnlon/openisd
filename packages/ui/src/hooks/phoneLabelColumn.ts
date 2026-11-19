import {PhoneRowColumns} from '@openisd/design/fields';

/**
 * Sizes a phone page's (or popup's) label column to its longest label (John, 10 Nov 2026: "there is tons of
 * empty space between the label and the text box"). Every row of the page reads `--mob-col-label`; this sets
 * it on the page root to `PhoneRowColumns.labelColumnPx` of the labels shown, so the box takes the rest.
 * It is the only writer of that property on `root` (no style binding of the root carries it; see
 * `PhoneRowColumns.cssVarsWithoutLabelColumn`); with no label to size to it writes the design's default column.
 * `reserved` are labels a row of the page may show later (a row that appears only for some drivers): the column
 * is wide enough for them whether or not they are on screen, so the page does not move when the driver changes
 * (lead, QO923: a layout that moves when you change driver is a defect). It measures again whenever the DOM under `root` changes, `root` resizes or a font finishes loading.
 */
export interface PhoneLabelColumn {
  /** Stops watching and takes back the width it set (the design's default column applies again). */
  stop(): void;
}

const LABELS = '.ui-field > label, .mob-crow-label, .mob-row-label';
/** The box a label sits before: a number box, text box or dropdown. A row with none (a button row) does not size the column (John, 10 Nov 2026: "there is tons of empty space, don't blame the label"). */
const BOX = 'input:not([type=checkbox]):not([type=radio]):not([type=file]), select';

export function createPhoneLabelColumn(root: HTMLElement, reserved: readonly string[] = []): PhoneLabelColumn {
  const doc = root.ownerDocument;
  const view = doc.defaultView;
  if (view === null) throw new Error('A phone label column needs a live document');
  const canvas = doc.createElement('canvas').getContext('2d');
  if (canvas === null) throw new Error('A phone label column needs a canvas to measure text');
  let frame: number | null = null;

  const measure = (): void => {
    frame = null;
    const widths: number[] = [];
    let font: CSSStyleDeclaration | null = null;
    for (const label of root.querySelectorAll<HTMLElement>(LABELS)) {
      const text = (label.textContent ?? '').trim();
      if (text === '' || label.getClientRects().length === 0) continue;
      if (label.closest('.ui-field, .mob-crow, .mob-row')?.querySelector(BOX) == null) continue;
      const style = view.getComputedStyle(label);
      font = style;
      canvas.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`; // the font shorthand reads back empty
      widths.push(canvas.measureText(text).width + (parseFloat(style.marginRight) || 0));
    }
    // The canvas still holds the last label's font: a reserved label is measured in the same font as the shown ones.
    if (font !== null) {
      const margin = parseFloat(font.marginRight) || 0;
      for (const text of reserved) widths.push(canvas.measureText(text).width + margin);
    }
    // No label to size to: the design's default column (no element's style binding writes it any more).
    const px = `${widths.length === 0 ? PhoneRowColumns.STANDARD.labelPx : PhoneRowColumns.labelColumnPx(widths)}px`;
    if (root.style.getPropertyValue(PhoneRowColumns.LABEL_COLUMN_VAR) !== px) root.style.setProperty(PhoneRowColumns.LABEL_COLUMN_VAR, px);
  };

  const schedule = (): void => { if (frame === null) frame = view.requestAnimationFrame(measure); };
  const mutations = new view.MutationObserver(schedule);
  mutations.observe(root, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class']});
  const resizes = new view.ResizeObserver(schedule);
  resizes.observe(root);
  doc.fonts.addEventListener('loadingdone', schedule);
  void doc.fonts.ready.then(schedule);
  measure();

  return {
    stop(): void {
      mutations.disconnect();
      resizes.disconnect();
      doc.fonts.removeEventListener('loadingdone', schedule);
      if (frame !== null) view.cancelAnimationFrame(frame);
      frame = null;
      root.style.removeProperty(PhoneRowColumns.LABEL_COLUMN_VAR);
    },
  };
}
