import {describe, it, expect} from 'vitest';
import {DRAG_SPIN_THRESHOLD_PX, DragSpin, dragSpinRate, pressedDigit} from '../../fields/dragSpin.js';
import {spinStep} from '../../fields/caretSpin.js';

/** A font where every character is 10 px wide. */
const widthOf = (s: string): number => s.length * 10;
const LEFT = {contentWidth: 200, align: 'left'} as const;

describe('pressedDigit: the digit pressed sets the step', () => {
  it('37.25: 3 steps 10, 7 steps 1, 2 steps 0.1, 5 steps 0.01', () => {
    const steps = [5, 15, 35, 45].map(x => {
      const at = pressedDigit('37.25', x, LEFT, widthOf);
      const r = spinStep('37.25', at, null, 1, {min: 0, max: undefined});
      return r === null ? null : r.text;
    });
    expect(steps).toEqual(['47.25', '38.25', '37.35', '37.26']);
  });
  it('is none on the point, left or right of the text', () => {
    expect(pressedDigit('37.25', 25, LEFT, widthOf)).toEqual({kind: 'none'});
    expect(pressedDigit('37.25', 150, LEFT, widthOf)).toEqual({kind: 'none'});
    expect(pressedDigit('37.25', -3, LEFT, widthOf)).toEqual({kind: 'none'});
  });
  it('is none on a minus sign', () => {
    expect(pressedDigit('-3.5', 5, LEFT, widthOf)).toEqual({kind: 'none'});
    expect(pressedDigit('-3.5', 15, LEFT, widthOf)).toEqual({kind: 'digit', at: 1});
  });
  it('follows right-aligned and centred text', () => {
    expect(pressedDigit('12', 185, {contentWidth: 200, align: 'right'}, widthOf)).toEqual({kind: 'digit', at: 0});
    expect(pressedDigit('12', 105, {contentWidth: 200, align: 'center'}, widthOf)).toEqual({kind: 'digit', at: 1});
    expect(pressedDigit('12', 10, {contentWidth: 200, align: 'right'}, widthOf)).toEqual({kind: 'none'});
  });
});

describe('dragSpinRate: dead zone, direction, stretch', () => {
  it('is zero under the threshold, both sides', () => {
    expect(dragSpinRate(0)).toBe(0);
    expect(dragSpinRate(DRAG_SPIN_THRESHOLD_PX - 1)).toBe(0);
    expect(dragSpinRate(-(DRAG_SPIN_THRESHOLD_PX - 1))).toBe(0);
  });
  it('is positive to the right and negative to the left', () => {
    expect(dragSpinRate(20)).toBeGreaterThan(0);
    expect(dragSpinRate(-20)).toBe(-dragSpinRate(20));
  });
  it('grows with the distance and has a ceiling', () => {
    expect(dragSpinRate(40)).toBeGreaterThan(dragSpinRate(20));
    expect(dragSpinRate(100000)).toBe(dragSpinRate(200000));
  });
});

describe('DragSpin: steps over time', () => {
  it('takes no steps at 0 px, however long it is held', () => {
    const d = new DragSpin();
    expect([1000, 1000, 1000].map(t => d.advance(0, t))).toEqual([0, 0, 0]);
  });
  it('takes one step at once when the dead zone is left', () => {
    expect(new DragSpin().advance(20, 0)).toBe(1);
    expect(new DragSpin().advance(-20, 0)).toBe(-1);
  });
  it('keeps stepping while held still, more per second the further out', () => {
    const near = new DragSpin();
    const far = new DragSpin();
    let nearSteps = 0;
    let farSteps = 0;
    for (let i = 0; i < 20; i++) { nearSteps += near.advance(20, 50); farSteps += far.advance(80, 50); }
    expect(nearSteps).toBeGreaterThan(5);
    expect(farSteps).toBeGreaterThan(nearSteps);
  });
  it('left steps are negative', () => {
    const d = new DragSpin();
    let total = 0;
    for (let i = 0; i < 20; i++) total += d.advance(-40, 50);
    expect(total).toBeLessThan(-5);
  });
  it('a late tick (page stalled for 20 s) adds no more than a normal one', () => {
    const d = new DragSpin();
    d.advance(40, 0);
    expect(d.advance(40, 20000)).toBeLessThanOrEqual(2);
  });
  it('stops when the pointer returns inside the dead zone', () => {
    const d = new DragSpin();
    d.advance(40, 50);
    expect(d.advance(2, 1000)).toBe(0);
  });
});

/** What the box does with a drag: each whole step from `advance` is one spinStep of the text as it is now. */
function runDrag(text: string, pressedX: number, legs: ReadonlyArray<{distance: number; ticks: number}>): {text: string; steps: number} {
  const at = pressedDigit(text, pressedX, LEFT, widthOf);
  const spin = new DragSpin();
  let shown = text;
  let steps = 0;
  let last: {place: number; at: typeof at} | null = null;
  let first = true;
  for (const leg of legs) {
    for (let i = 0; i < leg.ticks; i++) {
      const n = spin.advance(leg.distance, 40);
      for (let k = 0; k < Math.abs(n); k++) {
        const r = spinStep(shown, last === null ? at : last.at, last, n < 0 ? -1 : 1, {min: 0, max: undefined});
        if (r === null) throw new Error('no step');
        shown = r.text;
        last = {place: r.place, at: {kind: 'digit', at: r.mark}};
        steps += n < 0 ? -1 : 1;
        first = false;
      }
    }
  }
  expect(first).toBe(false);
  return {text: shown, steps};
}

describe('a drag steps from the value now, never from the value at the press', () => {
  it('dragging left after right continues from the raised value', () => {
    const up = runDrag('37.25', 35, [{distance: 40, ticks: 25}]);
    const upThenDown = runDrag('37.25', 35, [{distance: 40, ticks: 25}, {distance: -40, ticks: 25}]);
    expect(Number(up.text)).toBeGreaterThan(37.25);
    expect(upThenDown.steps).toBeLessThan(up.steps + 1);
    expect(Number(upThenDown.text)).toBeCloseTo(37.25 + upThenDown.steps * 0.1, 9);
  });
  it('going left from the start lowers it step by step from where it is', () => {
    const down = runDrag('37.25', 35, [{distance: -40, ticks: 25}]);
    expect(down.steps).toBeLessThan(-3);
    expect(Number(down.text)).toBeCloseTo(37.25 + down.steps * 0.1, 9);
  });
});

describe('every digit runs at the same steps a second for the same stretch', () => {
  it('the step count over a hold is the same whichever digit was pressed', () => {
    const counts = [5, 15, 35, 45].map(x => runDrag('37.25', x, [{distance: 40, ticks: 25}]).steps);
    expect(new Set(counts).size).toBe(1);
    const left = [5, 15, 35, 45].map(x => runDrag('37.25', x, [{distance: -40, ticks: 25}]).steps);
    expect(new Set(left).size).toBe(1);
    expect(left[0]).toBe(-counts[0]);
  });
});
