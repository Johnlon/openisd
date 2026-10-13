import {describe, expect, it} from 'vitest';
import {visibleViewportHeightPx} from '../../src/logic/visibleViewport.js';

describe('visible viewport height', () => {
  it('is the visual viewport height when the browser reports one at scale 1', () => {
    expect(visibleViewportHeightPx({innerHeight: 800, visualViewport: {height: 732.4, scale: 1}})).toBe(732);
  });

  it('falls back to the layout viewport when the browser has no visual viewport', () => {
    expect(visibleViewportHeightPx({innerHeight: 800, visualViewport: null})).toBe(800);
  });

  it('ignores a pinch-zoomed visual viewport so the layout does not shrink under zoom', () => {
    expect(visibleViewportHeightPx({innerHeight: 800, visualViewport: {height: 400, scale: 2}})).toBe(800);
  });
});
