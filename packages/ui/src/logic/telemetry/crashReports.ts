import {shallowRef, type ShallowRef} from 'vue';
import {
  errorEventOf,
  MAX_CONTACT,
  MAX_MESSAGE,
  MAX_NOTE,
  type AnonymousErrorContext,
} from './events.js';
import type {Telemetry} from './telemetry.js';
import type {ErrorContext} from './errorContext.js';

/** The newest uncaught error, waiting for the user to say what they were doing. */
export interface PendingCrash {
  readonly message: string;
  readonly frames: string;
  readonly context: AnonymousErrorContext;
}

/** Records an uncaught error and, when the user chooses, their report of it. */
export class CrashReports {
  /** Messages already sent this page session: one report per message. */
  private readonly sent = new Set<string>();
  readonly pending: ShallowRef<PendingCrash | null> = shallowRef(null);

  constructor(
    private readonly telemetry: Telemetry,
    private readonly contextProvider: ErrorContext,
    private readonly hashOf: (message: string, frames: string) => Promise<string>,
  ) {}

  /** Anything thrown and not caught: record it, send it now, offer the report box. */
  capture(thrown: unknown): void {
    this.pending.value = this.logOnly(thrown);
  }

  /** An error the shell handles without a crash screen: send it with its context, offer no report box. */
  logOnly(thrown: unknown): PendingCrash {
    const context = this.contextProvider.snapshot();
    const event = errorEventOf(thrown, context);
    if (!this.sent.has(event.message)) {
      this.sent.add(event.message);
      this.telemetry.record(event);
      this.telemetry.flush();
    }
    return {message: event.message, frames: event.frames, context};
  }

  /** Send the user's report. Not awaited by anyone; the box closes at once. */
  submit(note: string, contact: string): void {
    const crash = this.pending.value;
    this.pending.value = null;
    if (crash === null) return;
    void this.hashOf(crash.message, crash.frames).then(hash => {
      this.telemetry.record({
        kind: 'report',
        hash,
        message: crash.message.slice(0, MAX_MESSAGE),
        note: note.slice(0, MAX_NOTE),
        contact: contact.slice(0, MAX_CONTACT),
        box: crash.context.box,
        screen: crash.context.screen,
        dialog: crash.context.dialog,
        projects: crash.context.projects,
        actions: crash.context.actions,
        device: crash.context.device,
      });
      this.telemetry.flush();
    });
  }

  dismiss(): void {
    this.pending.value = null;
  }
}
