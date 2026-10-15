import type {Platform} from './events.js';
import type {Telemetry} from './telemetry.js';

/** The slice of `navigator.serviceWorker` the registration uses. */
export interface ServiceWorkerHost {
  register(url: string, options: {scope: string}): Promise<unknown>;
}

/** Registers the service worker. A browser, extension or in-app browser that refuses is not a crash:
 *  the app runs without offline support and a quiet `sw_blocked` event says so. */
export async function registerServiceWorker(
  host: ServiceWorkerHost, url: string, scope: string, telemetry: Telemetry, platform: Platform,
): Promise<void> {
  try {
    await host.register(url, {scope});
  } catch {
    telemetry.record({kind: 'sw_blocked', platform});
  }
}
