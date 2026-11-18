import type {Telemetry} from '../telemetry/telemetry.js';
import type {TelemetryEvent} from '../telemetry/events.js';

/** Passes every event to the real telemetry and tells listeners when the user saved a project: the moment
 *  the feedback prompt may ask. Wrapping the telemetry keeps the save code unaware of feedback. */
export class SaveTappedTelemetry implements Telemetry {
  private readonly listeners = new Set<() => void>();

  readonly flush: () => void;

  constructor(private readonly inner: Telemetry) {
    this.flush = inner.flush.bind(inner);
  }

  record(event: TelemetryEvent): void {
    this.inner.record(event);
    if (event.kind === 'project_save') for (const listener of [...this.listeners]) listener();
  }

  /** Call `listener` after each user save. Returns the call that stops it. */
  onUserSave(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
}
