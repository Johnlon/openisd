import {ref, type Ref} from 'vue';
import type {AppVersion, ToLocalTime} from '@openisd/design/fields';
import {formatAppVersion} from '@openisd/design/fields';

/** Narrowed dev version representing git commit info. */
export type DevAppVersion = Extract<AppVersion, { kind: 'dev' }>;

/** Source of hot update notifications from Vite. */
export interface HotUpdateSource {
  onUpdate(listener: () => void): void;
}

/** Minimal port for fetching the dev version from the vite dev server. */
export interface DevVersionPort {
  /** Fetch the dev version info; returns null on network/parsing failure. */
  fetchDevVersion(): Promise<DevAppVersion | null>;
}

/** Unified port for getting the running app version. */
export interface AppVersionPort {
  /** Reactive label for the running app version. */
  readonly label: Ref<string>;
  /** Get the version of the running app. */
  getVersion(): Promise<AppVersion>;
  /** Get the formatted version label for the running app. */
  getVersionLabel(): Promise<string>;
}

/** Parse a raw dev-version JSON response into the typed sum type. */
export function parseDevVersion(raw: unknown): AppVersion {
  if (raw && typeof raw === 'object' && 'sha' in raw && 'hasChanges' in raw) {
    const sha = raw.sha;
    const hasChanges = raw.hasChanges;
    const committedAt = 'committedAt' in raw && typeof raw.committedAt === 'string' ? raw.committedAt : '';
    if (typeof sha === 'string' && typeof hasChanges === 'boolean') {
      return { kind: 'dev', sha, hasChanges, committedAt };
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
  async function fetchDevVersion(): Promise<DevAppVersion | null> {
    try {
      const r = await fetchFn(`${baseUrl}dev-version.json`, { cache: 'no-store' });
      if (!r.ok) return null;
      const parsed = parseDevVersion(await r.json());
      return parsed.kind === 'dev' ? parsed : null;
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
  devPort: DevVersionPort | null,
  toLocalTime: ToLocalTime,
  hotUpdateSource?: HotUpdateSource | null,
): AppVersionPort {
  const initialVersion: AppVersion = isDev ? { kind: 'unknown' } : createPublishedVersion(bakedVersion);
  let currentVersion: AppVersion = initialVersion;
  const label = ref(isDev ? '' : formatAppVersion(initialVersion, toLocalTime));

  async function refresh(): Promise<string> {
    if (!isDev || !devPort) return label.value;
    try {
      const dev = await devPort.fetchDevVersion();
      if (dev) {
        currentVersion = dev;
        label.value = formatAppVersion(dev, toLocalTime);
      }
    } catch {
      // Keep previous label on refresh failure
    }
    return label.value;
  }

  if (isDev) {
    void refresh();
    hotUpdateSource?.onUpdate(() => {
      void refresh();
    });
  }

  async function getVersion(): Promise<AppVersion> {
    if (isDev) {
      if (!devPort) return { kind: 'unknown' };
      await refresh();
      return currentVersion;
    }
    return createPublishedVersion(bakedVersion);
  }

  async function getVersionLabel(): Promise<string> {
    if (isDev) {
      await refresh();
      return label.value || formatAppVersion(currentVersion, toLocalTime);
    }
    return label.value;
  }

  return { label, getVersion, getVersionLabel };
}