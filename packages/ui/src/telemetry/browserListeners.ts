import type {Telemetry} from './telemetry.js';

/** The slice of `window` the listeners use. */
export interface ListenerTarget {
  addEventListener(type: 'visibilitychange' | 'pagehide' | 'appinstalled', listener: () => void): void;
  addEventListener(type: 'error', listener: (e: {error?: unknown; message: string}) => void): void;
  addEventListener(type: 'unhandledrejection', listener: (e: {reason: unknown}) => void): void;
}

export interface ListenerDeps {
  readonly target: ListenerTarget;
  readonly visibility: () => string;
  readonly telemetry: Telemetry;
  readonly onUncaught: (thrown: unknown) => void;
}

/** Flush when the page is hidden or closing, record the install, forward uncaught errors. */
export function installBrowserListeners(d: ListenerDeps): void {
  d.target.addEventListener('visibilitychange', () => { if (d.visibility() === 'hidden') d.telemetry.flush(); });
  d.target.addEventListener('pagehide', () => d.telemetry.flush());
  d.target.addEventListener('appinstalled', () => { d.telemetry.record({kind: 'install'}); d.telemetry.flush(); });
  d.target.addEventListener('error', e => d.onUncaught(e.error ?? e.message));
  d.target.addEventListener('unhandledrejection', e => d.onUncaught(e.reason));
}
