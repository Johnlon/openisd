/** STORAGE (port): where bytes live, keyed by string. Knows keys and strings, never what a
 *  driver or a preference is. */
//
// The one storage abstraction the repositories are built on.
//
// A repository does not know whether it is talking to a browser or to a test: it is handed a
// KeyValueStorage and asks it for strings. `localStorage` is one implementation and an
// in-memory map is another, which is what lets My Drivers, favourites and the PR repo be
// exercised without a DOM.

export interface KeyValueStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  /** Call `onChange` whenever ANOTHER tab changes `key` — never for this tab's own writes, and
   *  never for a write that leaves the value as it was. Returns the call that stops it. */
  watch(key: string, onChange: () => void): () => void;
}

/**
 * The browser's own storage. Every call is guarded: storage can be disabled by the user or
 * full, and neither is a reason for the app to stop — a preference that cannot be written is
 * a preference that does not persist, not a crash.
 */
export function createLocalStorage(): KeyValueStorage {
  return {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* disabled or full */ } },
    remove(key) { try { localStorage.removeItem(key); } catch { /* disabled */ } },
    watch(key, onChange) {
      // The browser raises `storage` in every OTHER tab of the origin, and only when the value
      // actually changed. A null key is a whole-storage clear.
      const listener = (event: StorageEvent) => { if (event.key === key || event.key === null) onChange(); };
      window.addEventListener('storage', listener);
      return () => window.removeEventListener('storage', listener);
    },
  };
}

/** Storage shared by several tabs with no browser behind it — what a test injects to play more
 *  than one tab. Each `tab()` behaves as the browser's storage does in one tab. */
export interface SharedMemoryStorage {
  tab(): KeyValueStorage;
}

export function createSharedMemoryStorage(initial: Record<string, string> = {}): SharedMemoryStorage {
  const map = new Map<string, string>(Object.entries(initial));
  const watchers = new Set<{tab: KeyValueStorage; key: string; onChange: () => void}>();
  function changed(writer: KeyValueStorage, key: string): void {
    for (const w of [...watchers]) if (w.tab !== writer && w.key === key) w.onChange();
  }
  return {
    tab() {
      const tab: KeyValueStorage = {
        get(key) { return map.get(key) ?? null; },
        set(key, value) {
          if (map.get(key) === value) return;
          map.set(key, value);
          changed(tab, key);
        },
        remove(key) {
          if (!map.delete(key)) return;
          changed(tab, key);
        },
        watch(key, onChange) {
          const watcher = {tab, key, onChange};
          watchers.add(watcher);
          return () => { watchers.delete(watcher); };
        },
      };
      return tab;
    },
  };
}

/** An equivalent storage with no browser behind it, and no other tab — what a test injects. */
export function createMemoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  return createSharedMemoryStorage(initial).tab();
}
