import {describe, expect, it} from 'vitest';
import {visibleViewportHeightPx, visibleViewportTopPx} from '../../src/logic/visibleViewport.js';

describe('visible viewport height', () => {
  it('is the visual viewport height when the browser reports one at scale 1', () => {
    expect(visibleViewportHeightPx({innerHeight: 800, visualViewport: {height: 732.4, scale: 1, offsetTop: 0}})).toBe(732);
  });

  it('falls back to the layout viewport when the browser has no visual viewport', () => {
    expect(visibleViewportHeightPx({innerHeight: 800, visualViewport: null})).toBe(800);
  });

  it('ignores a pinch-zoomed visual viewport so the layout does not shrink under zoom', () => {
    expect(visibleViewportHeightPx({innerHeight: 800, visualViewport: {height: 400, scale: 2, offsetTop: 0}})).toBe(800);
  });
});

describe('visible viewport top', () => {
  it('is how far the browser panned the page, at scale 1', () => {
    expect(visibleViewportTopPx({innerHeight: 800, visualViewport: {height: 400, scale: 1, offsetTop: 212.6}})).toBe(213);
  });

  it('is 0 with no visual viewport, and under pinch-zoom', () => {
    expect(visibleViewportTopPx({innerHeight: 800, visualViewport: null})).toBe(0);
    expect(visibleViewportTopPx({innerHeight: 800, visualViewport: {height: 400, scale: 2, offsetTop: 300}})).toBe(0);
  });
});
