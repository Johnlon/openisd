import {describe, expect, it, vi} from 'vitest';
import {computed, defineComponent, h} from 'vue';
import {renderToString} from 'vue/server-renderer';
import {Engine} from '@openisd/design/engine';
import {OpenISDProject} from '@openisd/design';
import {provideFocusedProject} from '../../src/logic/focusedProjectContext.js';
import {useAdvancedOptions, type AdvancedOptionsAPI} from '../../src/hooks/AdvancedOptions-hooks.js';

function createProject(boxType: 'sealed' | 'vented' | 'bandpass4' = 'sealed') {
  const engine = new Engine();
  const project = OpenISDProject.empty(engine);
  project.box.boxType.set(boxType);
  return project;
}

async function renderHook(project = createProject()): Promise<AdvancedOptionsAPI> {
  let api!: AdvancedOptionsAPI;
  const Child = defineComponent({
    setup() {
      api = useAdvancedOptions();
      return () => null;
    },
  });
  const Root = defineComponent({
    setup() {
      provideFocusedProject(computed(() => project));
      return () => h(Child);
    },
  });
  await renderToString(h(Root));
  return api;
}

describe('AdvancedOptions-hooks', () => {
  it('identifies when box has a vent', async () => {
    const sealedApi = await renderHook(createProject('sealed'));
    expect(sealedApi.hasVent.value).toBe(false);

    const ventedApi = await renderHook(createProject('vented'));
    expect(ventedApi.hasVent.value).toBe(true);

    const bp4Api = await renderHook(createProject('bandpass4'));
    expect(bp4Api.hasVent.value).toBe(true);
  });

  it('exposes inputChecked and fieldHelp helpers', async () => {
    const api = await renderHook();
    expect(typeof api.fieldHelp).toBe('function');
    expect(api.fieldHelp('simVcInductance')).toBeTruthy();

    class FakeHTMLInputElement {
      checked = true;
    }
    vi.stubGlobal('HTMLInputElement', FakeHTMLInputElement);

    const fakeInput = new FakeHTMLInputElement();
    expect(api.inputChecked({target: fakeInput} as unknown as Event)).toBe(true);
  });
});
