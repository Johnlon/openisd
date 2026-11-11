/**
 * QO532 (John, 11 Nov 2026, on the "Blue dot" picture: "do this"): a box the charts read carries a blue dot just right of its
 * label text. These read the screen only: the dot as drawn, what covers or clips it, and each box's size and type.
 */
import type {Locator, Page} from '@playwright/test';

/** One accented field's dot as the browser draws it. */
export interface DrawnDot {
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly colour: string;
  readonly round: boolean;
  /** The blank between the end of the label's text and the dot. */
  readonly gapFromText: number;
  /** What the browser hits at the dot's centre: 'label' when it is the dot's own label (the dot is drawn on top), else what covers it. */
  readonly hit: string;
  /** Every ancestor that clips and cuts the dot, by class. */
  readonly clippedBy: readonly string[];
  /** Every control of the field the dot runs into (the box, its unit, its buttons, its warning). */
  readonly overlaps: readonly string[];
}

/** Reads the dot of every accented field under `root`, each scrolled into view first. */
export async function drawnDots(page: Page, root: string): Promise<DrawnDot[]> {
  const fields = page.locator(`${root} .ui-field-drives-charts`);
  const dots: DrawnDot[] = [];
  for (const field of await fields.all()) {
    await field.scrollIntoViewIfNeeded();
    dots.push(await field.evaluate(readDot));
  }
  return dots;
}

function readDot(field: Element): DrawnDot {
  const label = field.querySelector(':scope > label');
  if (!(label instanceof HTMLElement)) throw new Error('an accented field has no label');
  const doc = field.ownerDocument;
  const view = doc.defaultView;
  if (view === null) throw new Error('an accented field is not in a live document');
  const getComputedStyle = view.getComputedStyle.bind(view);
  const style = getComputedStyle(label, '::after');
  const name = (label.textContent ?? '').trim().split(/\s/)[0] ?? '';
  if (style.content === 'none') return {label: name, width: 0, height: 0, colour: '', round: false, gapFromText: NaN, hit: 'no dot', clippedBy: [], overlaps: []};
  const box = label.getBoundingClientRect();
  const width = parseFloat(style.width);
  const height = parseFloat(style.height);
  // The dot's border box: its containing block is the label's padding box.
  const x = box.left + label.clientLeft + parseFloat(style.left) + parseFloat(style.marginLeft);
  const y = box.top + label.clientTop + parseFloat(style.top) + parseFloat(style.marginTop);
  const dot = {left: x, top: y, right: x + width, bottom: y + height};
  const text = doc.createRange();
  text.selectNodeContents(label);
  const textRight = Math.max(...[...text.getClientRects()].map(r => r.right));
  const centre = doc.elementFromPoint(x + width / 2, y + height / 2);
  const cuts = (r: DOMRect) => dot.left < r.left - 0.5 || dot.top < r.top - 0.5 || dot.right > r.right + 0.5 || dot.bottom > r.bottom + 0.5;
  const clippedBy: string[] = [];
  for (let el = label.parentElement; el !== null; el = el.parentElement) {
    const s = getComputedStyle(el);
    if ((s.overflowX !== 'visible' || s.overflowY !== 'visible') && cuts(el.getBoundingClientRect())) clippedBy.push(`${el.tagName}.${el.className}`);
  }
  const meets = (r: DOMRect) => r.width > 0 && dot.left < r.right && dot.right > r.left && dot.top < r.bottom && dot.bottom > r.top;
  const overlaps = [...field.querySelectorAll('input, select, button, .ui-field-value > *, .ui-field-unit, .num-stepper, .ui-field-dev > *')]
    .filter(el => meets(el.getBoundingClientRect())).map(el => `${el.tagName}.${el.className}`);
  return {
    label: name, width, height, colour: style.backgroundColor,
    round: style.content !== 'none' && style.borderRadius === '50%' && style.display !== 'none' && style.visibility === 'visible' && style.opacity === '1',
    gapFromText: Math.round((x - textRight) * 10) / 10,
    hit: centre === label ? 'label' : centre === null ? 'nothing' : `${centre.tagName}.${centre.className}`,
    clippedBy, overlaps,
  };
}

/** A number box as the user sees its shape and type: where it is, how big, and how its text is set. */
export interface BoxLook {
  readonly accented: boolean;
  readonly x: number;
  readonly width: number;
  readonly height: number;
  readonly look: string;
  /** The box's border and shadow, or 'warning' when its warning mark paints them. */
  readonly ring: string;
}

/** Every box under `root`: an accented box must look exactly like a plain box in its column. */
export async function boxLooks(boxes: Locator): Promise<BoxLook[]> {
  return boxes.evaluateAll(els => els.map(el => {
    const r = el.getBoundingClientRect();
    const view = el.ownerDocument.defaultView;
    if (view === null) throw new Error('a box is not in a live document');
    const s = view.getComputedStyle(el);
    return {
      accented: el.closest('.ui-field-drives-charts') !== null, x: Math.round(r.x), width: Math.round(r.width * 10) / 10, height: Math.round(r.height * 10) / 10,
      // The right padding holds the unit chip, and a warning paints its own ring: neither is the accent's, so neither is compared.
      look: [s.paddingTop, s.paddingBottom, s.paddingLeft, s.fontFamily, s.fontSize, s.fontWeight, s.fontStyle, s.letterSpacing, s.lineHeight].join(' | '),
      ring: el.closest('.ui-field')?.querySelector('.ui-field-dq-btn') == null ? `${s.borderWidth} ${s.boxShadow}` : 'warning',
    };
  }));
}

/** The accented boxes that differ from every plain box in their column (same x): none, when the accent leaves boxes alone. */
export function boxesChangedByAccent(looks: readonly BoxLook[]): BoxLook[] {
  const plain = looks.filter(l => !l.accented);
  const plainRings = new Set(plain.map(p => p.ring));
  return looks.filter(l => l.accented).filter(a => !plain.some(p => p.x === a.x && p.width === a.width && p.height === a.height && p.look === a.look)
    || (a.ring !== 'warning' && !plainRings.has(a.ring)));
}
