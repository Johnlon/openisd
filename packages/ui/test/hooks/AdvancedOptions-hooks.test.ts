import {describe, expect, it, vi} from 'vitest';
import {computed, defineComponent, h} from 'vue';
import {renderToString} from 'vue/server-renderer';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '@openisd/design';
import {provideFocusedProject} from '../../src/logic/focusedProjectContext.js';
import {useAdvancedOptions, type AdvancedOptionsAPI} from '../../src/hooks/AdvancedOptions-hooks.js';

function createProject(boxType: 'sealed' | 'vented' | 'bandpass4' = 'sealed') {
  const engine = createEngine();
  const project = ProjectBuilder.empty(engine);
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

  it('exposes the inputChecked helper', async () => {
    const api = await renderHook();

    class FakeHTMLInputElement {
      checked = true;
    }
    vi.stubGlobal('HTMLInputElement', FakeHTMLInputElement);

    const fakeInput = new FakeHTMLInputElement();
    const event = new Event('change');
    Object.defineProperty(event, 'target', {value: fakeInput, configurable: true});
    expect(api.inputChecked(event)).toBe(true);
  });
});
