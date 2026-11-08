import {describe, expect, it} from 'vitest';
import {intersect, NOTE_GAP, placeNote} from '../../src/hooks/fieldNotePlacement.js';

const WINDOW = {left: 0, top: 0, right: 1000, bottom: 800};
const NOTE = {width: 320, height: 60};
const fieldAt = (left: number, top: number) => ({left, top, right: left + 200, bottom: top + 20});

describe('placeNote', () => {
  it('opens under the field, left edges aligned, when it fits', () => {
    expect(placeNote(fieldAt(100, 100), NOTE, WINDOW)).toEqual({left: 0, top: 20 + NOTE_GAP});
  });

  it('near the right edge it shifts left so its right edge is inside the bounds', () => {
    const offset = placeNote(fieldAt(900, 100), NOTE, WINDOW);
    expect(900 + offset.left + NOTE.width).toBe(WINDOW.right);
  });

  it('near the bottom it opens above the field', () => {
    const field = fieldAt(100, 780);
    const offset = placeNote(field, NOTE, WINDOW);
    expect(field.top + offset.top + NOTE.height).toBe(field.top - NOTE_GAP);
  });

  it('with no room above or below it stays below', () => {
    expect(placeNote(fieldAt(100, 30), NOTE, {...WINDOW, bottom: 60}).top).toBe(20 + NOTE_GAP);
  });

  it('never goes past the left bound', () => {
    expect(placeNote(fieldAt(10, 100), NOTE, {...WINDOW, left: 0, right: 200}).left + 10).toBe(0);
  });
});

describe('intersect', () => {
  it('is the overlap of two rects', () => {
    expect(intersect({left: 0, top: 0, right: 10, bottom: 10}, {left: 5, top: 2, right: 20, bottom: 8})).toEqual({left: 5, top: 2, right: 10, bottom: 8});
  });
});
