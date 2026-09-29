import {describe, expect, it, vi} from 'vitest';
import {defineComponent, h, provide} from 'vue';
import {renderToString} from 'vue/server-renderer';
import {APP_LOGIC} from '../../src/logic/app.js';
import {usePRBrowser, type PRBrowserAPI} from '../../src/hooks/PRBrowser-hooks.js';
import {testAppLogic} from './testAppLogic.js';
import type {MyPassiveRadiatorRepo, BundledPassiveRadiatorRepo} from '@openisd/persistence';

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
