/** The part of a chart's readout box that `showReadout` touches. */
export interface ReadoutBox {
  innerHTML: string;
  readonly style: {display: string};
}

/** What each box was last given, so a redraw with the same text leaves the box's elements alone. */
const lastShown = new WeakMap<object, string>();

/** Shows `html` in the readout box. The box is rebuilt only when the text differs from what it shows: a redraw that
 *  changes nothing (the sweep's settle run) must not replace the elements a user is looking at or has selected. */
export function showReadout(box: ReadoutBox, html: string): void {
  if (lastShown.get(box) !== html) {
    box.innerHTML = html;
    lastShown.set(box, html);
  }
  box.style.display = 'block';
}
