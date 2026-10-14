import { describe, it, expect } from 'vitest';
import {
  createCloudUiStore,
  OPENISD_CLOUD_UI_KEY,
  type CloudUiStorage,
} from '../../src/cloud/cloudUiStore.js';

function createMemoryStorage(initial: Record<string, string> = {}): CloudUiStorage {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    get(key: string): string | null {
      return map.get(key) ?? null;
    },
    set(key: string, value: string): void {
      map.set(key, value);
    },
  };
}

describe('cloudUiStore', () => {
  it('reads default state when storage is empty or invalid', () => {
    const emptyStore = createCloudUiStore(createMemoryStorage());
    expect(emptyStore.read()).toEqual({
      launches: 0,
      hintDismissed: false,
      conflictsSeen: 0,
    });

    const corruptStore = createCloudUiStore(createMemoryStorage({ [OPENISD_CLOUD_UI_KEY]: 'not-json{' }));
    expect(corruptStore.read()).toEqual({
      launches: 0,
      hintDismissed: false,
      conflictsSeen: 0,
    });

    const arrayStore = createCloudUiStore(createMemoryStorage({ [OPENISD_CLOUD_UI_KEY]: '[]' }));
    expect(arrayStore.read()).toEqual({
      launches: 0,
      hintDismissed: false,
      conflictsSeen: 0,
    });
  });

  it('reads and validates valid JSON state', () => {
    const storage = createMemoryStorage({
      [OPENISD_CLOUD_UI_KEY]: JSON.stringify({
        launches: 5,
        hintDismissed: true,
        conflictsSeen: 2,
      }),
    });
    const store = createCloudUiStore(storage);
    expect(store.read()).toEqual({
      launches: 5,
      hintDismissed: true,
      conflictsSeen: 2,
    });
  });

  it('safely parses boundary fields when types are invalid or missing', () => {
    const storage = createMemoryStorage({
      [OPENISD_CLOUD_UI_KEY]: JSON.stringify({
        launches: 'five',
        hintDismissed: 'yes',
        conflictsSeen: -3,
      }),
    });
    const store = createCloudUiStore(storage);
    expect(store.read()).toEqual({
      launches: 0,
      hintDismissed: false,
      conflictsSeen: 0,
    });
  });

  it('writes state to storage', () => {
    const storage = createMemoryStorage();
    const store = createCloudUiStore(storage);
    store.write({
      launches: 3,
      hintDismissed: false,
      conflictsSeen: 1,
    });
    expect(storage.get(OPENISD_CLOUD_UI_KEY)).toBe(
      JSON.stringify({
        launches: 3,
        hintDismissed: false,
        conflictsSeen: 1,
      }),
    );
    expect(store.read()).toEqual({
      launches: 3,
      hintDismissed: false,
      conflictsSeen: 1,
    });
  });

  it('increments launch count via recordLaunch', () => {
    const storage = createMemoryStorage();
    const store = createCloudUiStore(storage);
    const count1 = store.recordLaunch();
    expect(count1).toBe(1);
    expect(store.read().launches).toBe(1);

    const count2 = store.recordLaunch();
    expect(count2).toBe(2);
    expect(store.read().launches).toBe(2);
  });

  it('dismisses hint via dismissHint', () => {
    const storage = createMemoryStorage();
    const store = createCloudUiStore(storage);
    expect(store.read().hintDismissed).toBe(false);
    store.dismissHint();
    expect(store.read().hintDismissed).toBe(true);
  });

  it('updates conflicts seen via setConflictsSeen', () => {
    const storage = createMemoryStorage();
    const store = createCloudUiStore(storage);
    expect(store.read().conflictsSeen).toBe(0);
    store.setConflictsSeen(4);
    expect(store.read().conflictsSeen).toBe(4);
    store.setConflictsSeen(-2);
    expect(store.read().conflictsSeen).toBe(0);
  });
});
