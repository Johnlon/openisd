import {describe, expect, it, vi} from 'vitest';
import {defineComponent, h, provide} from 'vue';
import {renderToString} from 'vue/server-renderer';
import {APP_LOGIC} from '../../src/logic/app.js';
import {usePRBrowser, type PRBrowserAPI} from '../../src/hooks/PRBrowser-hooks.js';
import {testAppLogic} from './testAppLogic.js';
import {
  type BundledPassiveRadiatorRepo, type MyPassiveRadiatorRepo, type PrefsRepo,
  createMemoryStorage, createMyPassiveRadiatorRepo, createPrefsRepo,
} from '@openisd/persistence';
import {OpenISDPassiveRadiatorStandalone} from '@openisd/design';

async function renderHook(emit = vi.fn()): Promise<{api: PRBrowserAPI; emit: ReturnType<typeof vi.fn>}> {
  const myPassiveRadiators: MyPassiveRadiatorRepo = {
    read: () => ({ kind: 'ok', passiveRadiators: [], broken: [] }),
    list: () => [],
    replaceAll: () => true,
    upsert: () => null,
    remove: vi.fn(() => true),
    removeBroken: () => true,
    exportRaw: () => null,
    deleteAll: () => undefined,
  };
  const bundledPassiveRadiators: BundledPassiveRadiatorRepo = {
    index: () => Promise.resolve([]),
    load: () => Promise.reject(new Error('load not used in this test')),
  };

  let api!: PRBrowserAPI;
  const Child = defineComponent({
    setup() {
      api = usePRBrowser(emit);
      return () => null;
    },
  });
  const Root = defineComponent({
    setup() {
      provide(APP_LOGIC, testAppLogic({myPassiveRadiators, bundledPassiveRadiators}));
      return () => h(Child);
    },
  });
  await renderToString(h(Root));
  return {api, emit};
}

describe('PRBrowser-hooks', () => {
  it('initialises PR browser with empty filter and reactive row lists', async () => {
    const {api, emit} = await renderHook();

    expect(api.filter.value).toBe('');
    expect(Array.isArray(api.fSaved.value)).toBe(true);
    expect(Array.isArray(api.fBundled.value)).toBe(true);

    api.close();
    expect(emit).toHaveBeenCalledWith('close');
  });

  it('filters rows based on filter text input', async () => {
    const {api} = await renderHook();

    api.filter.value = 'nonexistent-pr-name-xyz';
    expect(api.fSaved.value).toHaveLength(0);
    expect(api.fBundled.value).toHaveLength(0);
  });
});

// bugs/BUG_20260909_passive_radiators_cannot_be_favourited_at_all.md
describe('PRBrowser-hooks — favourites', () => {
  async function renderWith(prefs: PrefsRepo): Promise<{api: PRBrowserAPI; savedId: string}> {
    const myPassiveRadiators = createMyPassiveRadiatorRepo(createMemoryStorage());
    const pr = OpenISDPassiveRadiatorStandalone.empty();
    pr.model.set('Saved PR');
    const saved = myPassiveRadiators.upsert(pr);
    if (saved === null) throw new Error('memory storage refused the save');
    const other = OpenISDPassiveRadiatorStandalone.empty();
    other.model.set('Other PR');
    myPassiveRadiators.upsert(other);
    const bundledPassiveRadiators: BundledPassiveRadiatorRepo = {
      index: () => Promise.resolve([]),
      load: () => Promise.reject(new Error('load not used in this test')),
    };
    let api!: PRBrowserAPI;
    const Child = defineComponent({ setup() { api = usePRBrowser(vi.fn()); return () => null; } });
    const Root = defineComponent({
      setup() {
        provide(APP_LOGIC, testAppLogic({myPassiveRadiators, bundledPassiveRadiators, prefs}));
        return () => h(Child);
      },
    });
    await renderToString(h(Root));
    return {api, savedId: saved.uuid};
  }

  it('starring a radiator marks it and keeps it for the next session', async () => {
    const storage = createMemoryStorage();
    const {api, savedId} = await renderWith(createPrefsRepo(storage));
    expect(api.isFavorite(savedId)).toBe(false);

    api.toggleFavorite(savedId);

    expect(api.isFavorite(savedId)).toBe(true);
    expect(createPrefsRepo(storage).favoritePassiveRadiators()).toEqual([savedId]);
    api.toggleFavorite(savedId);
    expect(api.isFavorite(savedId)).toBe(false);
  });

  it('Favorites shows only the starred radiators', async () => {
    const {api, savedId} = await renderWith(createPrefsRepo(createMemoryStorage()));
    api.toggleFavorite(savedId);

    api.toggleFavoritesOnly();

    expect(api.favoritesOnly.value).toBe(true);
    expect(api.fSaved.value.map(r => r.name)).toEqual(['Saved PR']);
    api.toggleFavoritesOnly();
    expect(api.fSaved.value).toHaveLength(2);
  });
});
