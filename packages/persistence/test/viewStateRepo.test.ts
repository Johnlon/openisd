/**
 * The chart view — swept frequency range and per-chart Y ranges — is app-level state and must
 * survive a restart. bugs/archive/BUG_20260926_sweep-range-and-y-ranges-not-persisted.md
 */
import {describe, expect, it} from 'vitest';
import {createViewStateRepo, VIEW_STATE_KEY} from '../src/repos/viewStateRepo.js';
import {OPENISD_BACKUP_KEYS} from '../src/repos/storageKeys.js';
import {createSharedMemoryStorage} from '../src/storage/keyValueStorage.js';

describe('view state repo — chart ranges', () => {
  it('round-trips the sweep range and per-chart Y ranges', () => {
    const repo = createViewStateRepo(createSharedMemoryStorage().tab());
    repo.save({ui: {}, chart: {sweepRange: {min: 1.111, max: 22222}, yRanges: {SPL: {min: -11, max: 111}}}});

    expect(repo.load()?.chart).toEqual({sweepRange: {min: 1.111, max: 22222}, yRanges: {SPL: {min: -11, max: 111}}});
  });

  it('drops a stored chart view whose sweep range is inside out', () => {
    const storage = createSharedMemoryStorage().tab();
    const repo = createViewStateRepo(storage);
    repo.save({ui: {}, chart: {sweepRange: {min: 999, max: 1}, yRanges: {}}});
    expect(repo.load()?.chart).toBeUndefined();
  });

  it('drops only a Y range with an unset end, keeping the rest of the chart view', () => {
    const storage = createSharedMemoryStorage().tab();
    storage.set(VIEW_STATE_KEY, JSON.stringify({ui: {}, chart: {sweepRange: {min: 2, max: 3000}, yRanges: {SPL: {min: null, max: 111}, Zmag: {min: 1, max: 99}}}}));
    expect(createViewStateRepo(storage).load()?.chart).toEqual({sweepRange: {min: 2, max: 3000}, yRanges: {Zmag: {min: 1, max: 99}}});
  });

  it('saving over a stored view it could not read backs the original text up first', () => {
    const storage = createSharedMemoryStorage().tab();
    storage.set(VIEW_STATE_KEY, 'not json');
    createViewStateRepo(storage).save({ui: {}});
    expect(storage.get(OPENISD_BACKUP_KEYS.view)).toBe('not json');
  });

  it('saving over a readable view takes no backup', () => {
    const storage = createSharedMemoryStorage().tab();
    const repo = createViewStateRepo(storage);
    repo.save({ui: {}});
    repo.save({ui: {}});
    expect(storage.get(OPENISD_BACKUP_KEYS.view)).toBeNull();
  });
});

describe('view shared between tabs', () => {
  it('a tab hears another tab save the view', () => {
    const store = createSharedMemoryStorage();
    const first = createViewStateRepo(store.tab());
    const second = createViewStateRepo(store.tab());
    let heard = 0;
    second.watch(() => { heard++; });

    first.save({ui: {a: 111111}});

    expect(heard).toBe(1);
  });

  it('the same view saved with its fields in another order is not a change', () => {
    const store = createSharedMemoryStorage();
    const first = createViewStateRepo(store.tab());
    const second = createViewStateRepo(store.tab());
    first.save({ui: {a: 111111, b: {c: 1, d: 2}}});
    let heard = 0;
    first.watch(() => { heard++; });

    second.save({ui: {b: {d: 2, c: 1}, a: 111111}});

    expect(heard).toBe(0);
  });
});
