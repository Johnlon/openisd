import {describe, expect, it} from 'vitest';
import {computed, defineComponent, h} from 'vue';
import {renderToString} from 'vue/server-renderer';
import {Engine} from '@openisd/design/engine';
import {OpenISDProject} from '@openisd/design';
import {addProject, removeProject, openProjects} from '../../src/logic/appState.js';
import {provideFocusedProject} from '../../src/logic/focusedProjectContext.js';
import {useOgTune, type OgTuneAPI} from '../../src/hooks/OgTune-hooks.js';

function createProject() {
  const engine = new Engine();
  const project = OpenISDProject.empty(engine);
  project.driver.specs.Fs_hz.set(40);
  project.driver.specs.Qts.set(0.38);
  project.driver.specs.Qes.set(0.45);
  project.driver.specs.Vas_m3.set(0.03);
  project.driver.specs.Sd_m2.set(0.02);
  project.box.sealed.volume_m3.set(0.012);
  return project;
}

async function renderHook(project = createProject()): Promise<OgTuneAPI> {
  let api!: OgTuneAPI;
  const Child = defineComponent({
    setup() {
      api = useOgTune();
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

describe('OgTune-hooks', () => {
  it('reads numeric driver fields and calculates ebp', async () => {
    const api = await renderHook();
    expect(api.cellVal('Fs_hz')).toBe(40);
    expect(api.cellVal('Qes')).toBe(0.45);
    expect(api.ebp.value).toBeCloseTo(40 / 0.45, 1);
  });

  it('updates and clears field values through enterField and clearField', async () => {
    const project = createProject();
    const api = await renderHook(project);

    api.enterField('Fs_hz', 55);
    expect(project.driver.specs.Fs_hz.value).toBe(55);
    expect(api.cellVal('Fs_hz')).toBe(55);

    api.clearField('Fs_hz');
    expect(project.driver.specs.Fs_hz.value).toBeNull();
  });

  it('provides cellClass and dqNote for fields', async () => {
    const api = await renderHook();
    expect(api.cellClass('Fs_hz')).toBeDefined();
    expect(typeof api.dqNote('Fs_hz')).toBe('string');
  });

  it('Mms is calculated by default, becomes entered when set, and returns to calculated when cleared', async () => {
    const api = await renderHook();
    expect(api.fieldCell('Mms_kg').calculated).toBe(true);

    api.enterField('Mms_kg', 0.0125);
    const entered = api.fieldCell('Mms_kg');
    expect(entered.entered).toBe(true);
    expect(entered.value).toBeCloseTo(0.0125, 6);

    api.clearField('Mms_kg');
    expect(api.fieldCell('Mms_kg').calculated).toBe(true);
  });

  it('BL_Tm becomes entered when set directly', async () => {
    const api = await renderHook();
    api.enterField('BL_Tm', 9.5);
    const blCell = api.fieldCell('BL_Tm');
    expect(blCell.entered).toBe(true);
    expect(blCell.value).toBeCloseTo(9.5, 6);
  });

  it('a blank Q auto-solves from the other two, and re-tracks when a sibling changes', async () => {
    const project = createProject();
    project.driver.specs.Qms.set(4.0);
    const api = await renderHook(project);

    expect(api.fieldCell('Qms').entered).toBe(true);

    api.clearField('Qms');
    expect(api.fieldCell('Qms').calculated).toBe(true);
    const solved = api.fieldCell('Qms').value;
    expect(solved).not.toBeNull();

    api.enterField('Qes', 0.55);
    expect(api.fieldCell('Qms').value).not.toBeCloseTo(solved!, 6);
  });

  it('clearing a second Q of the trio leaves the dependents not-available, not falsely calculated', async () => {
    const project = createProject();
    project.driver.specs.Qms.set(4.0);
    const api = await renderHook(project);

    api.clearField('Qms');
    api.clearField('Qes');
    expect(api.fieldCell('Qes').value).toBe(null);
    expect(api.fieldCell('Qms').value).toBe(null);
    expect(api.fieldCell('Qts').entered).toBe(true);
  });

  it('setVb_m3 writes and reads back through vb_m3 for every box type', async () => {
    const boxTypes = ['sealed', 'vented', 'bandpass4', 'bandpass6', 'abc', 'box-passive-radiator'] as const;
    for (const boxType of boxTypes) {
      const project = createProject();
      project.box.boxType.set(boxType);
      const api = await renderHook(project);
      api.setVb_m3(0.02);
      expect(api.vb_m3.value).toBeCloseTo(0.02, 9);
    }
  });

  it('setVb_m3 keeps full precision across write and read', async () => {
    const api = await renderHook();
    api.setVb_m3(0.012345678);
    expect(api.vb_m3.value).toBeCloseTo(0.012345678, 12);
  });

  it('keeps a Vb typed in Tune when the what-if layer is active', async () => {
    const project = createProject();
    project.beginWhatIf();
    const api = await renderHook(project);

    api.setVb_m3(0.02);
    expect(api.vb_m3.value).toBeCloseTo(0.02, 9);
    expect(project.isWhatIfActive()).toBe(true);

    // Blurring the field is a pure display event — nothing the panel does after a write may
    // put the committed volume back.
    api.enterField('Fs_hz', 55);
    expect(api.vb_m3.value).toBeCloseTo(0.02, 9);
  });

  /**
   * John, 2026-09-25: "its happening when I lose focus on the field in the tuner … Vb is the only
   * one that's a problem". `vb_m3` and `ebp` are CACHED computeds, and reading `project.value`
   * alone does not invalidate them: the registry hands out the same instance for the project's
   * whole life, so a write leaves their caches untouched. They must read `projectChanged` too —
   * the same rule `createBoxVolume` in `OriginalShell-hooks.ts` already carries. The panel's
   * driver fields are plain render-time functions and never had the problem; Vb kept answering
   * the volume it held when the panel opened, and NumInput's blur reformat put that stale number
   * back on screen.
   */
  it('re-reads Vb after a write rather than answering the cached one', async () => {
    const project = createProject();
    const opened = openProjects().length;
    addProject(project);
    try {
      const api = await renderHook(project);
      // Evaluate FIRST — this is the read whose cache the write has to invalidate.
      expect(api.vb_m3.value).toBeCloseTo(0.012, 9);
      api.setVb_m3(0.02);
      expect(api.vb_m3.value).toBeCloseTo(0.02, 9);
    } finally {
      removeProject(openProjects().length - 1);
      expect(openProjects().length).toBe(opened);
    }
  });

  it('re-reads ebp after a write rather than answering the cached one', async () => {
    const project = createProject();
    const opened = openProjects().length;
    addProject(project);
    try {
      const api = await renderHook(project);
      expect(api.ebp.value).toBeCloseTo(40 / 0.45, 6);
      api.enterField('Fs_hz', 80);
      expect(api.ebp.value).toBeCloseTo(80 / 0.45, 6);
    } finally {
      removeProject(openProjects().length - 1);
      expect(openProjects().length).toBe(opened);
    }
  });
});
