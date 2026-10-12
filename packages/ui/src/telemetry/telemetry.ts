import {type Fields, fieldsOf, type TelemetryEvent, type WireEvent} from './events.js';

/** What the app records events into. Fire-and-forget: nothing returns, nothing is awaited. */
export interface Telemetry {
  record(event: TelemetryEvent): void;
  flush(): void;
}

/** Records nothing and never sends: tests, localhost development. */
export class NoTelemetry implements Telemetry {
  record(): void { /* nothing */ }
  flush(): void { /* nothing */ }
}

export interface BeaconTelemetryDeps {
  readonly endpoint: string;
  readonly version: string;
  /** `navigator.sendBeacon`: true when the browser queued the body. */
  readonly beacon: (url: string, body: Blob) => boolean;
  readonly online: () => boolean;
  readonly now: () => number;
  readonly sessionId: string;
}

export const MAX_BATCH_EVENTS = 50;
export const MAX_BATCH_BYTES = 16 * 1024;

/** Queues events in memory and sends them as JSON arrays with `sendBeacon`. A failed or offline
 *  batch is lost: nothing is retried and nothing is stored. */
export class BeaconTelemetry implements Telemetry {
  private queue: WireEvent[] = [];

  constructor(private readonly deps: BeaconTelemetryDeps) {}

  record(event: TelemetryEvent): void {
    const fields: Fields = fieldsOf(event);
    this.queue.push({name: event.kind, ts: this.deps.now(), version: this.deps.version, session: this.deps.sessionId, fields});
  }

  flush(): void {
    const batch = this.queue;
    this.queue = [];
    if (batch.length === 0 || !this.deps.online()) return;
    for (const chunk of chunked(batch)) {
      this.deps.beacon(this.deps.endpoint, new Blob([JSON.stringify(chunk)], {type: 'application/json'}));
    }
  }
}

/** Splits so no chunk has more than 50 events or more than 16 KB of JSON. */
function chunked(events: readonly WireEvent[]): WireEvent[][] {
  const out: WireEvent[][] = [];
  let current: WireEvent[] = [];
  let bytes = 2;
  for (const e of events) {
    const size = JSON.stringify(e).length + 1;
    if (current.length > 0 && (current.length >= MAX_BATCH_EVENTS || bytes + size > MAX_BATCH_BYTES)) {
      out.push(current);
      current = [];
      bytes = 2;
    }
    current.push(e);
    bytes += size;
  }
  if (current.length > 0) out.push(current);
  return out;
}
