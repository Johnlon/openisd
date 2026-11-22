/**
 * `useChartStack` measures the stack element through a ResizeObserver. Its callback must not
 * change layout in the same frame (Chrome raises "ResizeObserver loop completed with undelivered
 * notifications", BUG_20261001_resize-observer-loop-fault-on-chart-grid): `deferredMeasurement`
 * applies a size on the next animation frame, and only when it changed.
 */
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {ref} from 'vue';
import {deferredMeasurement} from '../../src/hooks/chartStack.js';

type Frame = () => void;

describe('deferredMeasurement', () => {
  let frames: Frame[] = [];
  beforeEach(() => {
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (cb: Frame) => { frames.push(cb); return frames.length; });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('applies the size on the next animation frame, not when measured', () => {
    const width = ref(0), height = ref(0);
    const measured = deferredMeasurement(width, height);
    measured(800, 600);
    expect([width.value, height.value]).toEqual([0, 0]);
    expect(frames).toHaveLength(1);
    frames[0]!();
    expect([width.value, height.value]).toEqual([800, 600]);
  });

  it('schedules nothing when the size has not changed', () => {
    const width = ref(800), height = ref(600);
    deferredMeasurement(width, height)(800, 600);
    expect(frames).toHaveLength(0);
  });
});
