import {describe, expect, it} from 'vitest';
import {computed, defineComponent, h} from 'vue';
import {renderToString} from 'vue/server-renderer';
import {Engine} from '@openisd/design/engine';
import {OpenISDProject} from '@openisd/design';
import {provideFocusedProject} from '../../src/logic/focusedProjectContext.js';
import {
  createMockGraphPanelAPI,
  useGraphPanel,
  type GraphPanelAPI,
  type GraphPanelProps,
} from '../../src/hooks/GraphPanel-hooks.js';
import {DPAL, TAB_META} from '../../src/logic/series.js';

function createTestProject(): OpenISDProject {
  const engine = new Engine();
  const project = OpenISDProject.empty(engine);
  project.driver.specs.Fs_hz.set(40);
  project.driver.specs.Qts.set(0.38);
  project.driver.specs.Qes.set(0.45);
  project.driver.specs.Vas_m3.set(0.03);
  project.box.sealed.volume_m3.set(0.012);
  project.name.set('W5 sealed');
  return project;
}

async function renderHook(props: GraphPanelProps, project = createTestProject()): Promise<GraphPanelAPI> {
  let api!: GraphPanelAPI;
  const Child = defineComponent({
    setup() {
      api = useGraphPanel(props);
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

describe('GraphPanel-hooks', () => {
  describe('createMockGraphPanelAPI', () => {
    it('returns default mock values for graph panel', () => {
      const mock = createMockGraphPanelAPI();
      expect(mock.meta.value).toEqual(TAB_META['SPL']);
      expect(mock.currentDesign.value.name).toBe('Current');
      expect(mock.currentDesign.value.box).toBe('vented');
      expect(mock.plotData.value).toBeNull();
      expect(mock.blockErrors.value).toEqual([]);
      expect(mock.blocked.value).toBe(false);
      expect(mock.warnings.value).toEqual([]);
      expect(mock.warningsDismissed.value).toBe(false);

      mock.dismissWarnings();
      expect(mock.warningsDismissed.value).toBe(true);
    });

    it('accepts partial overrides', () => {
      const mock = createMockGraphPanelAPI({
        blocked: computed(() => true),
      });
      expect(mock.blocked.value).toBe(true);
    });
  });

  describe('useGraphPanel', () => {
    it('computes tab metadata corresponding to requested chartId', async () => {
      const apiSpl = await renderHook({chartId: 'SPL'});
      expect(apiSpl.meta.value).toEqual(TAB_META['SPL']);

      const apiPhase = await renderHook({chartId: 'Phase'});
      expect(apiPhase.meta.value).toEqual(TAB_META['Phase']);
    });

    it('builds currentDesign with focused project solverParams and box type', async () => {
      const project = createTestProject();
      const api = await renderHook({chartId: 'SPL'}, project);
      expect(api.currentDesign.value.box).toBe('sealed');
      expect(api.currentDesign.value.color).toBe(DPAL[0]);
      expect(api.currentDesign.value.name).toBe('W5 sealed');
      expect(api.currentDesign.value.driver?.Fs_hz.value).toBe(40);
    });

    it('honours custom primaryColor when provided in props', async () => {
      const api = await renderHook({chartId: 'SPL', primaryColor: '#ff0000'});
      expect(api.currentDesign.value.color).toBe('#ff0000');
    });

    it('tracks warningsDismissed state and resets when dismissWarnings is called', async () => {
      const api = await renderHook({chartId: 'SPL'});
      expect(api.warningsDismissed.value).toBe(false);
      api.dismissWarnings();
      expect(api.warningsDismissed.value).toBe(true);
    });
  });
});
