import {describe, expect, it, vi} from 'vitest';
import {computed, h, provide} from 'vue';
import {renderToString} from 'vue/server-renderer';
import {usePREditModal, type PREditModalAPI} from '../../src/hooks/PREditModal-hooks.js';
import {APP_LOGIC, type AppLogic} from '../../src/logic/app.js';
import {provideFocusedProject} from '../../src/logic/focusedProjectContext.js';
import {Engine} from '@openisd/design/engine';
import {OpenISDPassiveRadiatorStandalone, OpenISDProject} from '@openisd/design';

describe('usePREditModal', () => {
  it('exposes passive radiator state and handles library actions', async () => {
    let hook!: PREditModalAPI;
    const engine = new Engine();
    const project = OpenISDProject.empty(engine);
    project.box.boxType.set('box-passive-radiator');

    const prStandAlone = OpenISDPassiveRadiatorStandalone.empty(engine);
    prStandAlone.brand.set('Dayton Audio');
    prStandAlone.model.set('SD270A-88');

    const mockApp = {
      myPassiveRadiators: {
        list: vi.fn().mockReturnValue([
          {
            uuid: 'pr-1',
            passiveRadiator: prStandAlone,
          },
        ]),
        upsert: vi.fn(),
        remove: vi.fn(),
      },
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
        provide(APP_LOGIC, mockApp as unknown as AppLogic);
        provideFocusedProject(computed(() => project));
        return () => h(TestComponent);
      },
    };

    await renderToString(h(Root));

    expect(hook.radiator.value).toBeDefined();
    expect(hook.count.value).toBe(1);
    expect(hook.prLib.value.length).toBe(1);

    hook.setCount(2);
    expect(project.box.passiveRadiator.count.value).toBe(2);

    hook.saveCurrentPR();
    expect(mockApp.myPassiveRadiators.upsert).toHaveBeenCalled();

    hook.loadPR('pr-1');
    expect(hook.showPRLib.value).toBe(false);

    hook.removePR('pr-1');
    expect(mockApp.myPassiveRadiators.remove).toHaveBeenCalledWith('pr-1');

    hook.close();
    expect(emit).toHaveBeenCalledWith('close');
  });
});
