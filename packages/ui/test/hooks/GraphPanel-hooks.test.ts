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
import {presentationState} from '../../src/logic/presentationState.js';
import {runHook} from './runHook.js';
import {setTraceVisible} from '../../src/logic/traceVisibility.js';

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

    // bugs/BUG_20261005_focused-project-trace-ignores-its-checkbox.md
    it('currentDesign carries the focused project\'s show-on-graphs flag', () => {
      const project = createTestProject();
      addProject(project);
      const api = runHook(computed(() => project), () => useGraphPanel({chartId: 'SPL'}, createEngine()));
      expect(api.currentDesign.value.visible).toBe(true);
      setTraceVisible(project, false);
      expect(api.currentDesign.value.visible).toBe(false);
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
    describe('Auto Y', () => {
      // Past the sweep's settle run (`SweepScheduler`), so the curves for the last edit have landed.
      const awaitSweep = () => new Promise(resolve => setTimeout(resolve, 200));

      it('off freezes the shown Y range as the chart override; a data change keeps it; on clears it', async () => {
        presentationState.yRanges = {};
        const project = createTestProject();
        project.driver.specs.Sd_m2.set(0.0094);
        project.driver.specs.Re_ohm.set(3.4);
        project.driver.specs.Le_H.set(0.34e-3);
        project.driver.specs.Xmax_m.set(0.00925);
        project.driver.specs.Pe_W.set(80);
        addProject(project);
        const api = runHook(computed(() => project), () => useGraphPanel({chartId: 'SPL'}, createEngine()));
        await awaitSweep();
        expect(api.autoY.value).toBe(true);
        const shown = api.viewPlot.value!.levelAxis;
        const label = api.yRangeLabel.value;

        api.setAutoY(false);
        expect(api.autoY.value).toBe(false);
        expect(presentationState.yRanges.SPL).toEqual({min: shown.min, max: shown.max});

        project.box.sealed.volume_m3.set(0.002);
        await awaitSweep();
        expect(presentationState.yRanges.SPL).toEqual({min: shown.min, max: shown.max});
        expect(api.viewPlot.value!.levelAxis.min).toBe(shown.min);
        expect(api.viewPlot.value!.levelAxis.max).toBe(shown.max);
        expect(api.yRangeLabel.value).toBe(label);

        api.setAutoY(true);
        expect(api.autoY.value).toBe(true);
        expect(presentationState.yRanges.SPL).toBeUndefined();
      });

      it('Reset to auto-scale (the override removed elsewhere) turns Auto Y back on', () => {
        presentationState.yRanges = {SPL: {min: 0, max: 100}};
        const project = createTestProject();
        const api = runHook(computed(() => project), () => useGraphPanel({chartId: 'SPL'}, createEngine()));
        expect(api.autoY.value).toBe(false);
        delete presentationState.yRanges.SPL;
        expect(api.autoY.value).toBe(true);
      });
    });

    describe('clickCursorAt', () => {
      function hookOn(project: OpenISDProject) {
        return runHook(computed(() => project), () => useGraphPanel({chartId: 'SPL'}, createEngine()));
      }

      it('a click on an unlocked chart locks the cursor at that frequency', () => {
        const project = createTestProject();
        hookOn(project).clickCursorAt(200);
        expect(project.cursorLocked.value).toBe(true);
        expect(project.pinnedF.value).toBe(200);
        expect(project.cursorF.value).toBe(200);
      });

      it('a click elsewhere while locked moves the cursor there and unlocks it', () => {
        const project = createTestProject();
        const api = hookOn(project);
        api.clickCursorAt(200);
        api.clickCursorAt(2000);
        expect(project.cursorLocked.value).toBe(false);
        expect(project.pinnedF.value).toBe(2000);
        expect(project.cursorF.value).toBe(2000);
      });

      it('a click near the pinned point while locked unlocks without moving it', () => {
        const project = createTestProject();
        const api = hookOn(project);
        api.clickCursorAt(200);
        api.clickCursorAt(201);
        expect(project.cursorLocked.value).toBe(false);
        expect(project.pinnedF.value).toBe(200);
      });
    });
  });
});
