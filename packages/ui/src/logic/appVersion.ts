import type {AppVersion} from '@openisd/design/fields';

/** Minimal port for fetching the dev version from the vite dev server. */
export interface DevVersionPort {
  /** Fetch the dev version info; returns null on network/parsing failure. */
  fetchDevVersion(): Promise<{ sha: string; hasChanges: boolean } | null>;
}

/** Unified port for getting the running app version. */
export interface AppVersionPort {
  /** Get the version of the running app. */
  getVersion(): Promise<AppVersion>;
}

/** Parse a raw dev-version JSON response into the typed sum type. */
export function parseDevVersion(raw: unknown): AppVersion {
  if (raw && typeof raw === 'object' && 'sha' in raw && 'hasChanges' in raw) {
    const sha = raw.sha;
    const hasChanges = raw.hasChanges;
    if (typeof sha === 'string' && typeof hasChanges === 'boolean') {
      return { kind: 'dev', sha, hasChanges };
    }
  }
  return { kind: 'unknown' };
}

/** Create the published version value from the baked-in build version. */
export function createPublishedVersion(version: string): AppVersion {
  return version ? { kind: 'published', version } : { kind: 'unknown' };
}

/** Create a DevVersionPort that fetches from the given base URL. */
export function createDevVersionPort(baseUrl: string, fetchFn: typeof fetch): DevVersionPort {
  async function fetchDevVersion(): Promise<{ sha: string; hasChanges: boolean } | null> {
    try {
      const r = await fetchFn(`${baseUrl}dev-version.json`, { cache: 'no-store' });
      if (!r.ok) return null;
      const raw: unknown = await r.json();
      if (raw && typeof raw === 'object' && 'sha' in raw && 'hasChanges' in raw) {
        const sha = raw.sha;
        const hasChanges = raw.hasChanges;
        if (typeof sha === 'string' && typeof hasChanges === 'boolean') {
          return { sha, hasChanges };
        }
      }
      return null;
    } catch {
      return null;
    }
  }
  return { fetchDevVersion };
}

/** Create an AppVersionPort that works in both dev and production. */
export function createAppVersionPort(
  isDev: boolean,
  bakedVersion: string,
  devPort: DevVersionPort | null
): AppVersionPort {
  async function getVersion(): Promise<AppVersion> {
    if (isDev) {
      if (!devPort) return { kind: 'unknown' };
      const raw = await devPort.fetchDevVersion();
      return raw ? parseDevVersion(raw) : { kind: 'unknown' };
    }
    return createPublishedVersion(bakedVersion);
  }
  return { getVersion };
}