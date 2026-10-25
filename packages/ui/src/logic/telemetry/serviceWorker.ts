import type {Platform} from './events.js';
import type {Telemetry} from './telemetry.js';

/** The slice of `navigator.serviceWorker` the registration uses. */
export interface ServiceWorkerHost<Registration> {
  register(url: string, options: {scope: string; updateViaCache: 'none'}): Promise<Registration>;
}

/** Registers the service worker and hands back its registration. A browser, extension or in-app
 *  browser that refuses is not a crash: the app runs without offline support, a quiet `sw_blocked`
 *  event says so, and the answer is null. */
export async function registerServiceWorker<Registration>(
  host: ServiceWorkerHost<Registration>, url: string, scope: string, telemetry: Telemetry, platform: Platform,
): Promise<Registration | null> {
  try {
    return await host.register(url, {scope, updateViaCache: 'none'});
  } catch {
    telemetry.record({kind: 'sw_blocked', platform});
    return null;
  }
}
