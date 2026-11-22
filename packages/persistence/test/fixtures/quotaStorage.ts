/** A memory storage with a browser-like quota: a write that would take the total past `limit`
 *  characters is dropped silently, as `createLocalStorage` drops it. */
import {createMemoryStorage, type ListableStorage} from '../../src/storage/keyValueStorage.js';

export function createQuotaStorage(limit: number, initial: Record<string, string> = {}): ListableStorage {
  const inner = createMemoryStorage(initial);
  function total(): number {
    return inner.keys().reduce((sum, key) => sum + key.length + (inner.get(key) ?? '').length, 0);
  }
  return {
    ...inner,
    set(key, value) {
      const after = total() - (inner.get(key) === null ? 0 : key.length + (inner.get(key) ?? '').length) + key.length + value.length;
      if (after > limit) return;
      inner.set(key, value);
    },
  };
}
