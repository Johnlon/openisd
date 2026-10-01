import {describe, expect, it, vi} from 'vitest';
import {computed, h, provide} from 'vue';
import {renderToString} from 'vue/server-renderer';
import {usePREditModal, type PREditModalAPI} from '../../src/hooks/PREditModal-hooks.js';
import {APP_LOGIC} from '../../src/logic/app.js';
import {provideFocusedProject} from '../../src/logic/focusedProjectContext.js';
import {createEngine} from '@openisd/design/engine';
import {OpenISDPassiveRadiatorStandalone, ProjectBuilder} from '@openisd/design';
import type {MyPassiveRadiatorRepo} from '@openisd/persistence';
import {testAppLogic} from './testAppLogic.js';

describe('usePREditModal', () => {
  it('exposes passive radiator state and handles library actions', async () => {
    let hook!: PREditModalAPI;
    const engine = createEngine();
    const project = ProjectBuilder.empty(engine);
    project.box.boxType.set('box-passive-radiator');

    const prStandAlone = OpenISDPassiveRadiatorStandalone.empty();
    prStandAlone.brand.set('Dayton Audio');
    prStandAlone.model.set('SD270A-88');

    const myPassiveRadiators: MyPassiveRadiatorRepo = {
      read: () => ({ kind: 'ok', passiveRadiators: [], broken: [] }),
      list: vi.fn(() => [{ uuid: 'pr-1', passiveRadiator: prStandAlone }]),
      replaceAll: () => true,
      upsert: vi.fn(() => ({ uuid: 'pr-1', overwrote: true })),
      remove: vi.fn(() => true),
      removeBroken: () => true,
      exportRaw: () => null,
      deleteAll: () => undefined,
    };

    const emit = vi.fn();

    const TestComponent = {
      setup() {
        hook = usePREditModal(emit);
        return () => h('div');
      },
    };

    const Root = {
      setup() {
        provide(APP_LOGIC, testAppLogic({myPassiveRadiators}));
        provideFocusedProject(computed(() => project));
        return () => h(TestComponent);
      },
    };

    await renderToString(h(Root));

    expect(hook.radiator.value).toBeDefined();
    expect(hook.count.value).toBe(1);

    hook.setCount(2);
    expect(project.box.passiveRadiator.count.value).toBe(2);

    hook.saveCurrentPR();
    expect(myPassiveRadiators.upsert).toHaveBeenCalled();

    hook.close();
    expect(emit).toHaveBeenCalledWith('close');
    // "Browse PR library" now emits 'browse' straight from the template (PREditModal.vue),
    // sending the shell back to the ONE real picker (PRBrowser.vue — Saved + Bundled + Define
    // new) rather than a second cut-down saved-only list inline here — nothing for the hook
    // itself to own, so there is no hook-level method to test.
  });
});
