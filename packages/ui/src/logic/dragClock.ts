import type {InjectionKey} from 'vue';

/** The clock a drag-to-spin runs on: a test supplies its own to step time by hand. */
export interface DragClock {
  now(): number;
  /** Runs `run` every `ms` until `clear` is given the returned handle. */
  every(run: () => void, ms: number): number;
  clear(handle: number): void;
}

export const REAL_DRAG_CLOCK: DragClock = {
  now: () => performance.now(),
  every: (run, ms) => window.setInterval(run, ms),
  clear: handle => window.clearInterval(handle),
};

export const DRAG_CLOCK: InjectionKey<DragClock> = Symbol('openisd.dragClock');
