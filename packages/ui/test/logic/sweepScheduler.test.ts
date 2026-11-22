/**
 * `SweepScheduler` — when the chart sweep runs during a burst of edits (a held spinner): at once
 * on the first edit, then at most once per interval, with the max curves only while a chart that
 * reads them is open, and a full run (max curves included) once the edits stop.
 */
import {describe, expect, it} from 'vitest';
import {SweepScheduler, type SweepClock} from '../../src/logic/sweepScheduler.js';

interface PendingTimer {
  at: number;
  fn: () => void;
  id: number;
}

/** A clock the test advances by hand. */
class FakeClock implements SweepClock {
  t = 0;
  private timers: PendingTimer[] = [];
  private nextId = 1;
  now(): number { return this.t; }
  schedule(fn: () => void, ms: number): () => void {
    const id = this.nextId++;
    this.timers.push({ at: this.t + ms, fn, id });
    return () => { this.timers = this.timers.filter(x => x.id !== id); };
  }
  advance(ms: number): void {
    const end = this.t + ms;
    for (;;) {
      const due = this.timers.filter(x => x.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      this.timers = this.timers.filter(x => x !== due);
      this.t = due.at;
      due.fn();
    }
    this.t = end;
  }
}

function setup(maxChartOpen: boolean) {
  const clock = new FakeClock();
  const runs: boolean[] = [];
  const s = new SweepScheduler((withMax) => runs.push(withMax), () => maxChartOpen, clock, 32, 150);
  return { clock, runs, s };
}

describe('SweepScheduler', () => {
  it('runs at once, with max curves, on a single edit', () => {
    const { runs, s } = setup(false);
    s.changed();
    expect(runs).toEqual([true]);
  });

  it('a burst runs at most once per interval, plus one trailing run', () => {
    const { clock, runs, s } = setup(true);
    for (let i = 0; i < 10; i++) { s.changed(); clock.advance(10); }  // 100 ms of edits
    clock.advance(1000);
    // t=0 leading, then one per 32 ms while edits keep coming, then the trailing catch-up.
    expect(runs.length).toBeGreaterThanOrEqual(3);
    expect(runs.length).toBeLessThanOrEqual(6);
  });

  it('with no max chart open, burst steps skip max curves and a full run follows once edits stop', () => {
    const { clock, runs, s } = setup(false);
    s.changed();                                   // leading: full
    for (let i = 0; i < 9; i++) { clock.advance(10); s.changed(); }
    const duringBurst = runs.slice(1);
    expect(duringBurst.length).toBeGreaterThan(0);
    expect(duringBurst.every(withMax => withMax === false)).toBe(true);
    clock.advance(1000);
    expect(runs[runs.length - 1]).toBe(true);
  });

  it('with a max chart open, every run includes max curves', () => {
    const { clock, runs, s } = setup(true);
    for (let i = 0; i < 10; i++) { s.changed(); clock.advance(10); }
    clock.advance(1000);
    expect(runs.every(withMax => withMax)).toBe(true);
  });

  it('no extra full run when the last run already had max curves', () => {
    const { clock, runs, s } = setup(false);
    s.changed();
    clock.advance(1000);
    expect(runs).toEqual([true]);
  });
});
