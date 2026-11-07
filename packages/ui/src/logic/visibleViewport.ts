// The height the user can actually see, in CSS pixels.
//
// `window.innerHeight` is the LAYOUT viewport. Chrome shrinks it when its address bar shows and
// fires `resize`, so sizing the mobile shell from it kept the bottom bar visible there. Firefox
// Android and DuckDuckGo do not: their layout viewport stays at the toolbar-hidden height and no
// `resize` fires when the toolbar comes back, so the shell was taller than the screen and the
// bottom bar sat under the toolbar — it only showed after a scroll happened to hide the toolbar
// again (John, 13 Oct 2026: "Firefox loses the footer but it randomly reappears if I drag the
// screen up then a tiny bit down, duck duck is a little too long for screen").
//
// `window.visualViewport.height` is the VISUAL viewport: every one of those browsers shrinks it
// for every bar they show, and fires its own `resize`. It also shrinks under pinch-zoom, which
// must NOT shrink the layout, so at any scale other than 1 the layout viewport is used instead.

import {isSidewaysPhone} from './viewport.js';

export interface VisualViewportLike {
  readonly height: number;
  readonly scale: number;
  /** How far the browser has panned the page down, e.g. to show a box above the keyboard. */
  readonly offsetTop: number;
}

export interface ViewportSource {
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly visualViewport: VisualViewportLike | null;
}

const UNZOOMED_TOLERANCE = 0.01;

/** The width the window had the last time it was upright (taller than wide), or null if never. */
export type UprightWidthPx = number | null;

/** The phone is turned sideways: a short window wider than tall, whose width is not the upright one.
 *  A keyboard that shrinks an upright phone's layout (374 x 705 to 374 x 341, John's Pixel 9, 6 Nov 2026)
 *  also makes a short window wider than tall, but its width is the upright width: not sideways. */
export function isSidewaysShell(w: ViewportSource, uprightWidth: UprightWidthPx): boolean {
  return isSidewaysPhone(w) && w.innerWidth !== uprightWidth;
}

/** The phone shell's height: the visible height, or sideways the upright height (the window
 *  width) so the page is the normal phone page seen through a window. */
export function shellHeightPx(w: ViewportSource, uprightWidth: UprightWidthPx): number {
  return isSidewaysShell(w, uprightWidth) ? w.innerWidth : visibleViewportHeightPx(w);
}

export function visibleViewportHeightPx(w: ViewportSource): number {
  const vv = w.visualViewport;
  if (vv === null) return w.innerHeight;
  if (Math.abs(vv.scale - 1) > UNZOOMED_TOLERANCE) return w.innerHeight;
  return Math.round(vv.height);
}

// The keyboard makes the phone pan the page up. The shell, sized to the visible height, is moved
// down by the same amount so it stays on screen: without it the top bar is off screen and a band
// of nothing shows above the keyboard (John's Pixel 9, 19 Oct 2026). 0 under pinch-zoom, as above.
export function visibleViewportTopPx(w: ViewportSource, uprightWidth: UprightWidthPx): number {
  const vv = w.visualViewport;
  // Sideways the document itself scrolls, so the browser's pan needs no compensation.
  if (isSidewaysShell(w, uprightWidth) || vv === null || Math.abs(vv.scale - 1) > UNZOOMED_TOLERANCE) return 0;
  return Math.round(vv.offsetTop);
}

/** Where `el` sits on the screen the user sees, in CSS px. */
export function screenTopPx(el: Element, w: ViewportSource): number {
  // Unknown upright width: a keyboard-shrunk upright layout reads as sideways here and gets pan 0,
  // which is right, since a browser that shrinks the layout does not also pan the page.
  return el.getBoundingClientRect().top - visibleViewportTopPx(w, null);
}

/** The keyboard is up when the shell is much shorter than the tallest it has been at this width. */
const KEYBOARD_UP_BELOW_FRACTION = 0.8;
export function keyboardIsUp(shellHeight: number, tallestShellHeight: number): boolean {
  return shellHeight < tallestShellHeight * KEYBOARD_UP_BELOW_FRACTION;
}
