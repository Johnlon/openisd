// The one storage abstraction the repositories are built on.
//
// A repository does not know whether it is talking to a browser or to a test: it is handed a
// KeyValueStore and asks it for strings. `localStorage` is one implementation and an
// in-memory map is another, which is what lets My Drivers, favourites and the PR library be
// exercised without a DOM.

export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/**
 * The browser's own storage. Every call is guarded: storage can be disabled by the user or
 * full, and neither is a reason for the app to stop — a preference that cannot be written is
 * a preference that does not persist, not a crash.
 */
export function createLocalStorageStore(): KeyValueStore {
  return {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* disabled or full */ } },
    remove(key) { try { localStorage.removeItem(key); } catch { /* disabled */ } },
  };
}

/** An equivalent store with no browser behind it — what a test injects. */
export function createMemoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    get(key) { return map.has(key) ? map.get(key)! : null; },
    set(key, value) { map.set(key, value); },
    remove(key) { map.delete(key); },
  };
}
