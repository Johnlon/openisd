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

export interface VisualViewportLike {
  readonly height: number;
  readonly scale: number;
}

export interface ViewportSource {
  readonly innerHeight: number;
  readonly visualViewport: VisualViewportLike | null;
}

const UNZOOMED_TOLERANCE = 0.01;

export function visibleViewportHeightPx(w: ViewportSource): number {
  const vv = w.visualViewport;
  if (vv === null) return w.innerHeight;
  if (Math.abs(vv.scale - 1) > UNZOOMED_TOLERANCE) return w.innerHeight;
  return Math.round(vv.height);
}
