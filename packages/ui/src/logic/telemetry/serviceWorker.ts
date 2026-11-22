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
    const registration = await host.register(url, {scope, updateViaCache: 'none'});
    // A blocking host may resolve without a registration instead of rejecting.
    // Never hand an absent registration to the update listener owner.
    if (registration === undefined || registration === null) {
      telemetry.record({kind: 'sw_blocked', platform});
      return null;
    }
    return registration;
  } catch {
    telemetry.record({kind: 'sw_blocked', platform});
    return null;
  }
}
