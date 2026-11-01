import type {InstallMarker} from './install.js';
import type {SessionEnd} from './sessionEnd.js';
import type {Telemetry} from './telemetry.js';

/** The slice of `window` the listeners use. */
export interface ListenerTarget {
  addEventListener(type: 'visibilitychange' | 'pagehide' | 'appinstalled', listener: () => void): void;
  addEventListener(type: 'error', listener: (e: MaskableErrorEvent) => void): void;
  addEventListener(type: 'unhandledrejection', listener: (e: {reason: unknown}) => void): void;
}

/** The window's `error` event. `error` is what was thrown; a browser that hides a cross-origin or
 *  worker error leaves it out and says "Script error.", keeping only the place. */
export interface MaskableErrorEvent {
  readonly error?: unknown;
  readonly message: string;
  readonly filename?: string;
  readonly lineno?: number;
  readonly colno?: number;
}

/** The thrown value when the event has one; otherwise the message with the place the browser kept. */
export function uncaughtOf(e: MaskableErrorEvent): unknown {
  if (e.error !== undefined && e.error !== null) return e.error;
  return placeOf(e.message, e.filename, e.lineno, e.colno);
}

/** "message at file:line:col", or the message alone when the browser kept no file. */
export function placeOf(message: string, filename: string | undefined, lineno: number | undefined, colno: number | undefined): string {
  if (filename === undefined || filename === '') return message;
  return `${message} at ${filename}:${lineno ?? 0}:${colno ?? 0}`;
}

export interface ListenerDeps {
  readonly target: ListenerTarget;
  readonly visibility: () => string;
  readonly telemetry: Telemetry;
  readonly onUncaught: (thrown: unknown) => void;
  readonly install: InstallMarker;
  readonly session: SessionEnd;
}

/** Flush when the page is hidden or closing, record the session end and the install, forward uncaught errors. */
export function installBrowserListeners(d: ListenerDeps): void {
  d.target.addEventListener('visibilitychange', () => { if (d.visibility() === 'hidden') d.telemetry.flush(); });
  d.target.addEventListener('pagehide', () => { d.session.end(); d.telemetry.flush(); });
  d.target.addEventListener('appinstalled', () => d.install.noteInstalled());
  d.target.addEventListener('error', e => d.onUncaught(uncaughtOf(e)));
  d.target.addEventListener('unhandledrejection', e => d.onUncaught(e.reason));
}
