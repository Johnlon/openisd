/** The browser's storage manager, behind a port: whether it keeps OpenISD's data, and how much it
 *  holds and allows. */
import type {PersistOutcome, StorageEstimate} from '@openisd/design/fields';
import type {KeyValueStorage} from './keyValueStorage.js';

/** The parts of the browser's `navigator.storage` the port uses; any may be missing. */
export interface StorageManagerLike {
  readonly persisted?: () => Promise<boolean>;
  readonly persist?: () => Promise<boolean>;
  readonly estimate?: () => Promise<{readonly usage?: number; readonly quota?: number}>;
}

export interface BrowserStoragePort {
  /** Asks the browser to keep this site's data; granted at once when it already does. */
  persist(): Promise<PersistOutcome>;
  /** What the site uses and is allowed; null when the browser cannot say. */
  estimate(): Promise<StorageEstimate | null>;
}

export function createBrowserStoragePort(manager: StorageManagerLike | undefined): BrowserStoragePort {
  return {
    async persist() {
      if (manager?.persist === undefined) return 'unsupported';
      try {
        if (manager.persisted !== undefined && await manager.persisted()) return 'granted';
        return await manager.persist() ? 'granted' : 'refused';
      } catch {
        return 'unsupported';
      }
    },
    async estimate() {
      if (manager?.estimate === undefined) return null;
      try {
        const {usage, quota} = await manager.estimate();
        return typeof usage === 'number' && typeof quota === 'number' ? {usage, quota} : null;
      } catch {
        return null;
      }
    },
  };
}

/** Whether the browser keeps OpenISD's data: asked once, the answer kept for the session. */
export interface PersistenceStatus {
  /** Asks the browser, once; later calls wait on the same answer. */
  ask(): Promise<PersistOutcome>;
  /** The answer; null until the browser gives it. */
  outcome(): PersistOutcome | null;
  /** Call `onChange` when the answer comes. Returns the call that stops it. */
  watch(onChange: () => void): () => void;
  /** Whether the user dismissed the startup warning in this browser. */
  bannerDismissed(): boolean;
  dismissBanner(): void;
}

/** Where the dismissal of the startup warning is remembered. */
export const PERSIST_BANNER_DISMISSED_KEY = 'openisd_persist_warning_dismissed';

export function createPersistenceStatus(port: BrowserStoragePort, storage: KeyValueStorage): PersistenceStatus {
  let answer: Promise<PersistOutcome> | null = null;
  let outcome: PersistOutcome | null = null;
  const listeners = new Set<() => void>();
  return {
    ask() {
      answer ??= port.persist().then(result => {
        outcome = result;
        for (const listener of listeners) listener();
        return result;
      });
      return answer;
    },
    outcome: () => outcome,
    watch(onChange) {
      listeners.add(onChange);
      return () => { listeners.delete(onChange); };
    },
    bannerDismissed: () => storage.get(PERSIST_BANNER_DISMISSED_KEY) === '1',
    dismissBanner() {
      storage.set(PERSIST_BANNER_DISMISSED_KEY, '1');
      for (const listener of listeners) listener();
    },
  };
}

/** Where this tab remembers it showed the startup storage notice: session storage, so once per tab. */
export const USAGE_NOTICE_SHOWN_KEY = 'openisd_usage_notice_shown';

/** Whether this tab still has to show the startup storage notice. */
export interface UsageNoticeTab {
  due(): boolean;
  shown(): void;
}

export function createUsageNoticeTab(tabStorage: KeyValueStorage): UsageNoticeTab {
  return {
    due: () => tabStorage.get(USAGE_NOTICE_SHOWN_KEY) !== '1',
    shown() { tabStorage.set(USAGE_NOTICE_SHOWN_KEY, '1'); },
  };
}
