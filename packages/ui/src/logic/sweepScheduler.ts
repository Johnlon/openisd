/**
 * When the chart sweep runs during a burst of edits (a held spinner, arrow-key repeat): at once on
 * the first edit, then at most once per `intervalMs` while edits keep coming, with a trailing run
 * for the final value. Max curves cost as much as the sweep and only the Max SPL / Max Power charts
 * draw them, so a burst step includes them only while `maxChartOpen()`; once edits stop for
 * `settleMs` a full run brings them (and the issues they report) up to date.
 */

/** Time and timers, injected so a test can drive them. `schedule` returns its own cancel. */
export interface SweepClock {
  now(): number;
  schedule(fn: () => void, ms: number): () => void;
}

export class SweepScheduler {
  private lastRun = Number.NEGATIVE_INFINITY;
  private cancelThrottle: (() => void) | null = null;
  private cancelSettle: (() => void) | null = null;
  private maxStale = false;

  constructor(
    private readonly run: (withMax: boolean) => void,
    private readonly maxChartOpen: () => boolean,
    private readonly clock: SweepClock,
    private readonly intervalMs: number,
    private readonly settleMs: number,
  ) {}

  /** An input the sweep reads has changed. */
  changed(): void {
    const leading = this.clock.now() - this.lastRun >= this.intervalMs;
    if (leading) {
      this.cancelThrottle?.();
      this.cancelThrottle = null;
      // A lone edit (nothing ran within the interval) is a full run; mid-burst steps are fast.
      this.step(this.cancelSettle === null || this.maxChartOpen());
    } else if (this.cancelThrottle === null) {
      this.cancelThrottle = this.clock.schedule(() => {
        this.cancelThrottle = null;
        this.step(this.maxChartOpen());
      }, this.intervalMs - (this.clock.now() - this.lastRun));
    }
    this.cancelSettle?.();
    this.cancelSettle = this.clock.schedule(() => {
      this.cancelSettle = null;
      if (this.maxStale) this.step(true);
    }, this.settleMs);
  }

  private step(withMax: boolean): void {
    this.lastRun = this.clock.now();
    this.maxStale = !withMax;
    this.run(withMax);
  }
}
