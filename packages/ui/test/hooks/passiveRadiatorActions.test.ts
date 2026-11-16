import {describe, expect, it, vi} from 'vitest';
import {computed} from 'vue';
import {createPassiveRadiatorActions} from '../../src/hooks/passiveRadiatorActions.js';
import {createEngine} from '@openisd/design/engine';
import {OpenISDPassiveRadiatorStandalone, ProjectBuilder} from '@openisd/design';
import type {BundledPassiveRadiatorRepo, MyPassiveRadiatorRepo} from '@openisd/persistence';
import type {RadiatorPicks} from '../../src/logic/telemetry/radiatorPick.js';

function fakeMyPassiveRadiators(): MyPassiveRadiatorRepo {
  return {
    read: () => ({ kind: 'ok', passiveRadiators: [], broken: [] }),
    list: vi.fn(() => []),
    replaceAll: () => 'done',
    upsert: vi.fn(() => ({ uuid: 'pr-1', overwrote: false })),
    remove: vi.fn((): 'done' => 'done'),
    removeBroken: () => 'done',
    exportRaw: () => null,
    deleteAll: () => 'done',
  };
}

function setUp(bundled: OpenISDPassiveRadiatorStandalone = OpenISDPassiveRadiatorStandalone.empty()) {
  const engine = createEngine();
  const project = ProjectBuilder.empty(engine);
  project.box.boxType.set('box-passive-radiator');
  const myPassiveRadiators = fakeMyPassiveRadiators();
  const bundledPassiveRadiators: BundledPassiveRadiatorRepo = {
    index: vi.fn(async () => []),
    load: vi.fn(async () => bundled),
  };
  const radiatorPicks: RadiatorPicks = { bundled: vi.fn(), saved: vi.fn() };
  const actions = createPassiveRadiatorActions({ project: computed(() => project), myPassiveRadiators, bundledPassiveRadiators, radiatorPicks, engine });
  return { project, myPassiveRadiators, actions, radiatorPicks };
}

describe('createPassiveRadiatorActions', () => {
  // John, 16 Nov 2026 (QO946.c115): one passive-radiator editor; OK applies the edits to the project's radiator.
  it('Edit opens the editor on the project\'s radiator; OK puts the edits in the project, the build choices untouched', () => {
    const { project, actions } = setUp();
    project.box.passiveRadiator.radiator.model.set('Bench PR');
    project.box.passiveRadiator.count.set(2);

    actions.startEditPR();
    expect(actions.prEditor.name.value).toBe('Bench PR');
    actions.prEditor.setName('Edited PR');
    actions.prEditor.cells.value?.Xmax_m.set(0.015);
    expect(project.box.passiveRadiator.radiator.model.value).toBe('Bench PR');
    actions.prEditor.ok();

    expect(project.box.passiveRadiator.radiator.model.value).toBe('Edited PR');
    expect(project.box.passiveRadiator.radiator.spec.Xmax_m.value).toBe(0.015);
    expect(project.box.passiveRadiator.count.value).toBe(2);
  });

  it('Edit then Cancel leaves the project\'s radiator as it was', () => {
    const { project, actions } = setUp();
    project.box.passiveRadiator.radiator.model.set('Bench PR');
    actions.startEditPR();
    actions.prEditor.setName('Thrown away');
    actions.prEditor.cancel();
    expect(project.box.passiveRadiator.radiator.model.value).toBe('Bench PR');
  });

  it('Define new opens the editor on a blank radiator; OK makes it the project\'s and closes the Select popup', () => {
    const { project, actions } = setUp();
    project.box.passiveRadiator.radiator.model.set('Bench PR');
    actions.prBrowseOpen.value = true;

    actions.defineNewPREntry();
    expect(actions.prEditor.name.value).toBe('');
    expect(actions.prBrowseOpen.value).toBe(true);
    expect(project.box.passiveRadiator.radiator.model.value).toBe('Bench PR');
    actions.prEditor.setName('New PR');
    actions.prEditor.ok();

    expect(project.box.passiveRadiator.radiator.model.value).toBe('New PR');
    expect(actions.prBrowseOpen.value).toBe(false);
  });

  // John, 2026-10-05: a library copy shares nothing with the project. John, 16 Nov 2026 (QO946.c117, c118): Save to library
  // is the editor's Copy to My PRs, which files a detached copy (the editor's own tests: passiveRadiatorEditor.test.ts).
  it('Copy to My PRs from Edit files a copy that later edits to the project leave alone', () => {
    const { project, myPassiveRadiators, actions } = setUp();
    project.box.passiveRadiator.radiator.model.set('Bench PR');
    project.box.passiveRadiator.radiator.spec.Xmax_m.set(0.01);
    actions.startEditPR();
    actions.prEditor.saveToMyPRs();
    actions.prEditor.cancel();

    project.box.passiveRadiator.radiator.spec.Xmax_m.set(0.02);

    const filed = vi.mocked(myPassiveRadiators.upsert).mock.calls[0]?.[0];
    expect(filed?.model.value).toBe('Bench PR');
    expect(filed?.spec.Xmax_m.value).toBe(0.01);
  });


  it('loading a bundled passive radiator closes the browser and opens no editor', async () => {
    const { actions } = setUp();
    actions.prBrowseOpen.value = true;

    await actions.loadBundledPassiveRadiatorEntry('nd140');

    expect(actions.prBrowseOpen.value).toBe(false);
    expect(Object.keys(actions)).not.toContain('prEditOpen');
  });

  // John, 10 Nov 2026: "also record the pr picked either on Wiz or in main".
  it('loading a bundled passive radiator on the box page counts it as a bundled pick', async () => {
    const { actions, radiatorPicks } = setUp();
    await actions.loadBundledPassiveRadiatorEntry('nd140');
    expect(radiatorPicks.bundled).toHaveBeenCalledWith('nd140');
    expect(radiatorPicks.saved).not.toHaveBeenCalled();
  });

  it('loading a saved passive radiator on the box page counts it as my pick', () => {
    const { actions, myPassiveRadiators, radiatorPicks } = setUp();
    vi.mocked(myPassiveRadiators.list).mockReturnValue([{ uuid: 'mine-1', passiveRadiator: OpenISDPassiveRadiatorStandalone.empty() }]);
    actions.loadPREntry('mine-1');
    expect(radiatorPicks.saved).toHaveBeenCalledTimes(1);
    expect(radiatorPicks.bundled).not.toHaveBeenCalled();
  });
});
