import type {ReleasePort} from './releaseWatch.js';

/** The slice of the browser the port uses, handed in so a test can fake it. */
export interface BrowserReleaseDeps {
  readonly baseUrl: string;
  readonly fetch: typeof fetch;
  /** `navigator.serviceWorker`; undefined where the browser has none. */
  readonly serviceWorker: Pick<ServiceWorkerContainer, 'getRegistration' | 'addEventListener'> | undefined;
  readonly location: Pick<Location, 'reload'>;
}

/** How long to wait for the new service worker to take over before reloading anyway. */
const TAKE_OVER_WAIT_MS = 3000;

export function createBrowserReleasePort(deps: BrowserReleaseDeps): ReleasePort {
  async function latestVersion(): Promise<string | null> {
    try {
      const r = await deps.fetch(`${deps.baseUrl}build-info.json`, { cache: 'no-store' });
      if (!r.ok) return null;
      const info: unknown = await r.json();
      return info && typeof info === 'object' && 'version' in info && typeof info.version === 'string' ? info.version : null;
    } catch {
      return null;
    }
  }

  async function reloadOntoLatest(): Promise<void> {
    // The installed app serves its shell from the service worker's cache, so a bare reload would
    // show the old build again: ask the worker to update and wait for it to take over first.
    const registration = await deps.serviceWorker?.getRegistration();
    if (deps.serviceWorker && registration) {
      const tookOver = new Promise<void>(resolve => {
        deps.serviceWorker?.addEventListener('controllerchange', () => resolve(), { once: true });
        setTimeout(resolve, TAKE_OVER_WAIT_MS);
      });
      await registration.update();
      await tookOver;
    }
    deps.location.reload();
  }

  return { latestVersion, reloadOntoLatest };
}
