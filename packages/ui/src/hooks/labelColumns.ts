import {DesktopSizes} from '@openisd/design/fields';

/**
 * Sizes every desktop field group's label column to the group's longest label (John, QO466.c12: "the input fields
 * are too far from the labels"; QO449.c16: "fix the gaps on all fields").
 *
 * A group is the field rows of one screen (a tab, or a dialog) whose labels start at one x: one column of labels.
 * Each row of the group gets `--label-w` = `DesktopSizes.labelColumnPx` of the group's label text widths, so the
 * boxes share one left edge, right after the longest label and its warning slot (a group with no common field
 * row, such as a pair of plain pick lists, has no warning and so no slot). Only rows whose label column is
 * `--label-w` take part; a row that sizes its labels some other way (a subgrid, a stacked caption) is left alone.
 *
 * It measures again whenever the DOM under `root` changes, `root` resizes or a font finishes loading, once per
 * frame and before the frame is painted.
 */
export interface LabelColumns {
  /** Stops watching and takes back every width it set (the phone skin sizes its own labels). */
  stop(): void;
}

/** A field row: the common field, or a plain row with its own label. */
const ROW = '.ui-field, .field';

export function createLabelColumns(root: HTMLElement): LabelColumns {
  const doc = root.ownerDocument;
  const view = doc.defaultView;
  if (view === null) throw new Error('Label columns need a live document');
  let frame: number | null = null;
  const sized = new Set<HTMLElement>();

  /** The row's label column width as its CSS says now, and whether it is `--label-w`. */
  const followsLabelWidth = (row: HTMLElement, label: HTMLElement): boolean => {
    const style = view.getComputedStyle(row);
    const wanted = parseFloat(style.getPropertyValue(DesktopSizes.LABEL_COLUMN_VAR) || style.getPropertyValue(DesktopSizes.DEFAULT_LABEL_COLUMN_VAR));
    if (Number.isNaN(wanted)) return false;
    const column = style.display.includes('grid') ? parseFloat(style.gridTemplateColumns.split(' ')[0] ?? '') : parseFloat(view.getComputedStyle(label).width);
    return Math.abs(column - wanted) < 0.5;
  };

  /** The screen a row is on: its tab, or the dialog or panel fixed over the page. */
  const screenOf = (row: HTMLElement): Element => {
    for (let el = row.parentElement; el !== null && el !== root; el = el.parentElement) {
      if (el.classList.contains('tab-section') || view.getComputedStyle(el).position === 'fixed') return el;
    }
    return root;
  };

  const measure = (): void => {
    frame = null;
    for (const row of sized) if (!row.isConnected) sized.delete(row);
    const groups = new Map<Element, Map<number, {row: HTMLElement; width: number; warns: boolean}[]>>();
    for (const row of root.querySelectorAll<HTMLElement>(ROW)) {
      const label = row.querySelector<HTMLElement>(':scope > label');
      if (label === null || (label.textContent ?? '').trim() === '' || label.getClientRects().length === 0) continue;
      if (!followsLabelWidth(row, label)) continue;
      const text = doc.createRange();
      text.selectNodeContents(label);
      const screen = screenOf(row);
      const x = Math.round(label.getBoundingClientRect().left);
      const columns = groups.get(screen) ?? new Map<number, {row: HTMLElement; width: number; warns: boolean}[]>();
      columns.set(x, [...(columns.get(x) ?? []), {row, width: text.getBoundingClientRect().width, warns: row.classList.contains('ui-field')}]);
      groups.set(screen, columns);
    }
    for (const columns of groups.values()) {
      for (const rows of columns.values()) {
        const px = `${DesktopSizes.labelColumnPx(rows.map(r => r.width), rows.some(r => r.warns))}px`;
        for (const {row} of rows) {
          sized.add(row);
          if (row.style.getPropertyValue(DesktopSizes.LABEL_COLUMN_VAR) !== px) row.style.setProperty(DesktopSizes.LABEL_COLUMN_VAR, px);
        }
      }
    }
  };

  const schedule = (): void => { if (frame === null) frame = view.requestAnimationFrame(measure); };
  const mutations = new view.MutationObserver(schedule);
  mutations.observe(root, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'style']});
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
      for (const row of sized) row.style.removeProperty(DesktopSizes.LABEL_COLUMN_VAR);
      sized.clear();
    },
  };
}
