import {describe, expect, it} from 'vitest';
import {isSidewaysPhone} from '../../src/logic/viewport.js';
import {shellHeightPx, visibleViewportHeightPx, visibleViewportTopPx} from '../../src/logic/visibleViewport.js';

describe('visible viewport height', () => {
  it('is the visual viewport height when the browser reports one at scale 1', () => {
    expect(visibleViewportHeightPx({innerWidth: 400, innerHeight: 800, visualViewport: {height: 732.4, scale: 1, offsetTop: 0}})).toBe(732);
  });

  it('falls back to the layout viewport when the browser has no visual viewport', () => {
    expect(visibleViewportHeightPx({innerWidth: 400, innerHeight: 800, visualViewport: null})).toBe(800);
  });

  it('ignores a pinch-zoomed visual viewport so the layout does not shrink under zoom', () => {
    expect(visibleViewportHeightPx({innerWidth: 400, innerHeight: 800, visualViewport: {height: 400, scale: 2, offsetTop: 0}})).toBe(800);
  });
});

describe('visible viewport top', () => {
  it('is how far the browser panned the page, at scale 1', () => {
    expect(visibleViewportTopPx({innerWidth: 400, innerHeight: 800, visualViewport: {height: 400, scale: 1, offsetTop: 212.6}})).toBe(213);
  });

  it('is 0 with no visual viewport, and under pinch-zoom', () => {
    expect(visibleViewportTopPx({innerWidth: 400, innerHeight: 800, visualViewport: null})).toBe(0);
    expect(visibleViewportTopPx({innerWidth: 400, innerHeight: 800, visualViewport: {height: 400, scale: 2, offsetTop: 300}})).toBe(0);
  });
});

describe('phone turned sideways', () => {
  const kbd = {height: 150, scale: 1, offsetTop: 100};
  it('is a short window wider than tall; upright, desktop and tall wide windows are not', () => {
    expect(isSidewaysPhone({innerWidth: 705, innerHeight: 374})).toBe(true);
    expect(isSidewaysPhone({innerWidth: 850, innerHeight: 390})).toBe(true);
    expect(isSidewaysPhone({innerWidth: 374, innerHeight: 705})).toBe(false);
    expect(isSidewaysPhone({innerWidth: 1280, innerHeight: 720})).toBe(false);
  });
  it('gives the shell the window width as height, with or without the keyboard, and no pan offset', () => {
    expect(shellHeightPx({innerWidth: 705, innerHeight: 374, visualViewport: null})).toBe(705);
    expect(shellHeightPx({innerWidth: 705, innerHeight: 374, visualViewport: kbd})).toBe(705);
    expect(visibleViewportTopPx({innerWidth: 705, innerHeight: 374, visualViewport: kbd})).toBe(0);
  });
  it('upright keeps the visible height', () => {
    expect(shellHeightPx({innerWidth: 374, innerHeight: 705, visualViewport: {height: 600, scale: 1, offsetTop: 0}})).toBe(600);
  });
});
