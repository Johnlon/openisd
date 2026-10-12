import {shallowRef, type ShallowRef} from 'vue';
import {errorEventOf, MAX_CONTACT, MAX_NOTE} from './events.js';
import type {Telemetry} from './telemetry.js';

/** The newest uncaught error, waiting for the user to say what they were doing. */
export interface PendingCrash {
  readonly message: string;
  readonly frames: string;
}

/** Records an uncaught error and, when the user chooses, their report of it. */
export class CrashReports {
  readonly pending: ShallowRef<PendingCrash | null> = shallowRef(null);

  constructor(
    private readonly telemetry: Telemetry,
    private readonly box: () => string,
    private readonly hashOf: (message: string, frames: string) => Promise<string>,
  ) {}

  /** Anything thrown and not caught: record it, send it now, offer the report box. */
  capture(thrown: unknown): void {
    const event = errorEventOf(thrown, this.box());
    this.telemetry.record(event);
    this.telemetry.flush();
    this.pending.value = {message: event.message, frames: event.frames};
  }

  /** Send the user's report. Not awaited by anyone; the box closes at once. */
  submit(note: string, contact: string): void {
    const crash = this.pending.value;
    this.pending.value = null;
    if (crash === null) return;
    void this.hashOf(crash.message, crash.frames).then(hash => {
      this.telemetry.record({kind: 'report', hash, note: note.slice(0, MAX_NOTE), contact: contact.slice(0, MAX_CONTACT)});
      this.telemetry.flush();
    });
  }

  dismiss(): void {
    this.pending.value = null;
  }
}
