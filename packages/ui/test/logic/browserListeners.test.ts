/**
 * `installBrowserListeners` — what the window's uncaught-error and rejection events forward to the
 * crash reporter, including a browser-masked "Script error." that keeps only the place.
 */
import {describe, expect, it, vi} from 'vitest';
import {installBrowserListeners, type ListenerTarget, type MaskableErrorEvent} from '../../src/logic/telemetry/browserListeners.js';
import {NoTelemetry} from '../../src/logic/telemetry/telemetry.js';
import {InstallMarker} from '../../src/logic/telemetry/install.js';
import {SessionEnd} from '../../src/logic/telemetry/sessionEnd.js';
import {FeatureUse} from '../../src/logic/telemetry/featureUse.js';
import {createMemoryStorage} from '@openisd/persistence';

/** Everything the window's error and rejection events may carry, so one fake can fire both. */
type FiredEvent = MaskableErrorEvent & {readonly reason: unknown};

/** A window stand-in that keeps the listeners by event name so a test can fire them. */
class FakeTarget implements ListenerTarget {
  private readonly listeners = new Map<string, ((e: FiredEvent) => void)[]>();
  addEventListener(type: 'visibilitychange' | 'pagehide' | 'appinstalled', listener: () => void): void;
  addEventListener(type: 'error', listener: (e: MaskableErrorEvent) => void): void;
  addEventListener(type: 'unhandledrejection', listener: (e: {reason: unknown}) => void): void;
  addEventListener(type: string, listener: (e: FiredEvent) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  fire(type: string, e: FiredEvent): void { for (const l of this.listeners.get(type) ?? []) l(e); }
}

function install(onUncaught: (thrown: unknown) => void): (type: string, e: FiredEvent) => void {
  const target = new FakeTarget();
  const telemetry = new NoTelemetry();
  installBrowserListeners({
    target,
    visibility: () => 'visible',
    telemetry,
    onUncaught,
    install: new InstallMarker(telemetry, createMemoryStorage()),
    session: new SessionEnd(telemetry, new FeatureUse(telemetry), () => 0, 0),
  });
  return (type, e) => target.fire(type, e);
}

describe('installBrowserListeners — uncaught errors', () => {
  it('forwards the thrown Error itself when the event carries one', () => {
    const onUncaught = vi.fn();
    const fire = install(onUncaught);
    const thrown = new Error('boom');
    fire('error', {error: thrown, message: 'Uncaught Error: boom', reason: undefined});
    expect(onUncaught).toHaveBeenCalledWith(thrown);
  });

  it('names the file and line when the browser masked the error (iOS "Script error.")', () => {
    const onUncaught = vi.fn();
    const fire = install(onUncaught);
    fire('error', {error: null, message: 'Script error.', filename: 'https://openisd.app/assets/main-abc.js', lineno: 12, colno: 34, reason: undefined});
    expect(onUncaught).toHaveBeenCalledWith('Script error. at https://openisd.app/assets/main-abc.js:12:34');
  });

  it('sends the bare message when the masked error names no file', () => {
    const onUncaught = vi.fn();
    const fire = install(onUncaught);
    fire('error', {error: undefined, message: 'Script error.', filename: '', lineno: 0, colno: 0, reason: undefined});
    expect(onUncaught).toHaveBeenCalledWith('Script error.');
  });

  it('forwards the rejection reason', () => {
    const onUncaught = vi.fn();
    const fire = install(onUncaught);
    const reason = new Error('late');
    fire('unhandledrejection', {message: '', reason});
    expect(onUncaught).toHaveBeenCalledWith(reason);
  });
});
