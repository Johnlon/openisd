import type {PerfStep, Skin} from './events.js';
import type {Telemetry} from './telemetry.js';

/** The memory sizes the collector accepts: the browser reports RAM in these steps. */
const MEMORY_GB: readonly number[] = [0.25, 0.5, 1, 2, 4, 8, 16, 32];
/** The longest duration the collector accepts, in ms. */
export const MAX_PERF_MS = 600000;
const wholeMs = (ms: number): number => Math.min(MAX_PERF_MS, Math.max(0, Math.round(ms)));

/** What the device says of itself: logical cores and RAM in GB; null where the browser does not say. */
export interface DeviceFacts {
  readonly cores: number | null;
  readonly memoryGb: number | null;
}

/** `navigator.hardwareConcurrency` and `navigator.deviceMemory`, for the browsers that have them. */
export function deviceFactsOf(nav: object): DeviceFacts {
  const cores = 'hardwareConcurrency' in nav && typeof nav.hardwareConcurrency === 'number' && Number.isInteger(nav.hardwareConcurrency) ? nav.hardwareConcurrency : null;
  const memoryGb = 'deviceMemory' in nav && typeof nav.deviceMemory === 'number' && MEMORY_GB.some(gb => gb === nav.deviceMemory) ? nav.deviceMemory : null;
  return {cores, memoryGb};
}

export interface PerfDeps {
  readonly telemetry: Telemetry;
  /** `performance.now()`: milliseconds since navigation start. */
  readonly now: () => number;
  /** Runs `done` once the browser has drawn the frame that follows the work done so far. */
  readonly afterPaint: (done: () => void) => void;
  readonly skin: () => Skin;
  readonly device: DeviceFacts;
}

/** What the rest of the app is given of the timings: the moments it can mark. Nothing here changes what the app does. */
export interface Perf {
  /** The app script started running `scriptStartMs` after navigation start. */
  bootDownload(scriptStartMs: number): void;
  /** Wraps a loader: the first call is timed until it succeeds. */
  timedCatalogue<T>(load: () => Promise<T>): () => Promise<T>;
  /** Times the restore of stored projects. */
  restoring<T>(work: () => Promise<T>): Promise<T>;
  /** The app can be used now: reported once the screen is drawn. */
  bootReady(): void;
  /** A chart has just been drawn. */
  chartDrawn(): void;
  /** A project was just opened: reported once the screen is drawn. */
  projectOpened(): void;
  /** The driver list was opened; `rowsShown` settles true when it has rows to show, false when it has none. */
  driverListOpened(rowsShown: Promise<boolean>): void;
  /** The user changed a value: the time to the next drawn frame is one recalculation sample. */
  edited(): void;
  /** The session is over: sends the one recalculation summary. */
  sessionEnded(): void;
}

/** Times the app's key steps and reports each as a `perf` event: boot steps and the first chart once per page load, the first project
 *  open and driver list open once per session, and every recalculation summarised in one event at session end. Only durations and
 *  device facts are sent, never what was typed or opened. */
export class PerfReporter implements Perf {
  private readonly reported = new Set<PerfStep>();
  private pendingEdit: number | null = null;
  private readonly recalcs: number[] = [];
  private ended = false;

  constructor(private readonly d: PerfDeps) {}

  private send(step: PerfStep, ms: number, maxMs: number | null, count: number | null): void {
    this.d.telemetry.record({
      kind: 'perf', step, ms: wholeMs(ms), maxMs: maxMs === null ? null : wholeMs(maxMs), count, skin: this.d.skin(), cores: this.d.device.cores, memoryGb: this.d.device.memoryGb,
    });
  }

  /** Reports `step` once per reporter lifetime. */
  private once(step: PerfStep, ms: number): void {
    if (this.reported.has(step)) return;
    this.reported.add(step);
    this.send(step, ms, null, null);
  }

  bootDownload(scriptStartMs: number): void {
    this.once('boot_download', scriptStartMs);
  }

  timedCatalogue<T>(load: () => Promise<T>): () => Promise<T> {
    return () => {
      if (this.reported.has('boot_catalogue')) return load();
      const start = this.d.now();
      const loading = load();
      void loading.then(() => this.once('boot_catalogue', this.d.now() - start), () => undefined);
      return loading;
    };
  }

  async restoring<T>(work: () => Promise<T>): Promise<T> {
    const start = this.d.now();
    const result = await work();
    this.once('boot_restore', this.d.now() - start);
    return result;
  }

  bootReady(): void {
    if (this.reported.has('boot_ready')) return;
    this.d.afterPaint(() => this.once('boot_ready', this.d.now()));
  }

  chartDrawn(): void {
    if (this.reported.has('first_chart')) return;
    this.d.afterPaint(() => this.once('first_chart', this.d.now()));
  }

  private readonly opening = new Set<PerfStep>();

  /** Starts a timing that is reported once, when its end is drawn. */
  private firstOf(step: PerfStep, start: number, end: (done: () => void) => void): void {
    if (this.reported.has(step) || this.opening.has(step)) return;
    this.opening.add(step);
    end(() => this.d.afterPaint(() => this.once(step, this.d.now() - start)));
  }

  projectOpened(): void {
    this.firstOf('project_open', this.d.now(), done => done());
  }

  driverListOpened(rowsShown: Promise<boolean>): void {
    this.firstOf('driver_list_open', this.d.now(), done => {
      void rowsShown.then(shown => {
        if (shown) done(); else this.opening.delete('driver_list_open');
      });
    });
  }

  edited(): void {
    if (this.pendingEdit !== null) return;
    const start = this.d.now();
    this.pendingEdit = start;
    this.d.afterPaint(() => {
      this.pendingEdit = null;
      this.recalcs.push(this.d.now() - start);
    });
  }

  sessionEnded(): void {
    if (this.ended) return;
    this.ended = true;
    if (this.recalcs.length === 0) return;
    const sorted = [...this.recalcs].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    this.send('recalc', median, sorted[sorted.length - 1], sorted.length);
  }
}

/** `requestAnimationFrame` then a task: the frame has been drawn when `done` runs. */
export function afterPaintOf(raf: (callback: () => void) => unknown, later: (callback: () => void) => unknown): (done: () => void) => void {
  return done => { raf(() => { later(done); }); };
}
