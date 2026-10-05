import {describe, expect, it} from 'vitest';
import {computed, defineComponent, h} from 'vue';
import {renderToString} from 'vue/server-renderer';
import {createEngine} from '@openisd/design/engine';
import {OpenISDProject, ProjectBuilder} from '@openisd/design';
import {provideFocusedProject} from '../../src/logic/focusedProjectContext.js';
import {
  useGraphPanel,
  type GraphPanelAPI,
  type GraphPanelProps,
} from '../../src/hooks/GraphPanel-hooks.js';
import {DPAL, TAB_META} from '@openisd/design/chart';
import {addProject} from '../../src/logic/appState.js';
import {runHook} from './runHook.js';

function createTestProject(): OpenISDProject {
  const engine = createEngine();
  const project = ProjectBuilder.empty(engine);
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
      api = useGraphPanel(props, createEngine());
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
  describe('useGraphPanel', () => {
    it('currentDesign follows the box type when it changes after the first read', () => {
      const project = createTestProject();
      addProject(project);   // the change tick only fires for a project appState holds
      const api = runHook(computed(() => project), () => useGraphPanel({chartId: 'SPL'}, createEngine()));
      expect(api.currentDesign.value.box).toBe('sealed');
      project.box.boxType.set('vented');
      expect(api.currentDesign.value.box).toBe('vented');
    });

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
      expect(api.currentDesign.value.driver?.values.Fs_hz).toBe(40);
    });

    it('honours custom primaryColor when provided in props', async () => {
      const api = await renderHook({chartId: 'SPL', primaryColor: '#ff0000'});
      expect(api.currentDesign.value.color).toBe('#ff0000');
    });

    describe('clickAt — a click on the chart', () => {
      function clickHarness() {
        const project = createTestProject();
        const api = runHook(computed(() => project), () => useGraphPanel({chartId: 'SPL'}, createEngine()));
        return {project, api};
      }

      it('locks the cursor at the clicked frequency', () => {
        const {project, api} = clickHarness();
        api.clickAt(100);
        expect(project.cursorLocked.value).toBe(true);
        expect(project.pinnedF.value).toBe(100);
        expect(project.cursorF.value).toBe(100);
      });

      it('clicking elsewhere while locked moves the cursor there and unlocks it', () => {
        const {project, api} = clickHarness();
        api.clickAt(100);
        api.clickAt(1000);
        expect(project.cursorLocked.value).toBe(false);
        expect(project.pinnedF.value).toBe(1000);
        expect(project.cursorF.value).toBe(1000);
      });

      it('clicking near the pinned point unlocks it and leaves it where it was', () => {
        const {project, api} = clickHarness();
        api.clickAt(100);
        api.clickAt(102);   // within 0.02 decades of 100
        expect(project.cursorLocked.value).toBe(false);
        expect(project.pinnedF.value).toBe(100);
      });
    });

    it('tracks warningsDismissed state and resets when dismissWarnings is called', async () => {
      const api = await renderHook({chartId: 'SPL'});
      expect(api.warningsDismissed.value).toBe(false);
      api.dismissWarnings();
      expect(api.warningsDismissed.value).toBe(true);
    });
  });
});
