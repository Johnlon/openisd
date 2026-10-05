import {describe, expect, it, vi} from 'vitest';
import {computed} from 'vue';
import {createPassiveRadiatorActions} from '../../src/hooks/passiveRadiatorActions.js';
import {createEngine} from '@openisd/design/engine';
import {OpenISDPassiveRadiatorStandalone, ProjectBuilder} from '@openisd/design';
import type {BundledPassiveRadiatorRepo, MyPassiveRadiatorRepo} from '@openisd/persistence';

function fakeMyPassiveRadiators(): MyPassiveRadiatorRepo {
  return {
    read: () => ({ kind: 'ok', passiveRadiators: [], broken: [] }),
    list: vi.fn(() => []),
    replaceAll: () => true,
    upsert: vi.fn(() => ({ uuid: 'pr-1', overwrote: false })),
    remove: vi.fn(() => true),
    removeBroken: () => true,
    exportRaw: () => null,
    deleteAll: () => undefined,
  };
}

function setUp(bundled: OpenISDPassiveRadiatorStandalone = OpenISDPassiveRadiatorStandalone.empty()) {
  const project = ProjectBuilder.empty(createEngine());
  project.box.boxType.set('box-passive-radiator');
  const myPassiveRadiators = fakeMyPassiveRadiators();
  const bundledPassiveRadiators: BundledPassiveRadiatorRepo = {
    index: vi.fn(async () => []),
    load: vi.fn(async () => bundled),
  };
  const actions = createPassiveRadiatorActions({ project: computed(() => project), myPassiveRadiators, bundledPassiveRadiators });
  return { project, myPassiveRadiators, actions };
}

describe('createPassiveRadiatorActions', () => {
  // John, 2026-10-05: "Save PR to library needs to ask for a name confirmation dialog."
  it('opening Save to library prefills the name with the page\'s passive radiator name and saves nothing yet', () => {
    const { project, myPassiveRadiators, actions } = setUp();
    project.box.passiveRadiator.radiator.model.set('My bench PR');

    actions.openPRSave();

    expect(actions.prSaveOpen.value).toBe(true);
    expect(actions.prSaveName.value).toBe('My bench PR');
    expect(myPassiveRadiators.upsert).not.toHaveBeenCalled();
  });

  // John, 2026-10-05: the dialog's name names only the library entry. Save clones the project's
  // radiator, names the clone, and saves the clone; the project's radiator is never touched.
  it('Save stores a copy under the typed name and leaves the project\'s passive radiator unchanged', () => {
    const { project, myPassiveRadiators, actions } = setUp();
    project.box.passiveRadiator.radiator.model.set('My bench PR');
    actions.openPRSave();

    actions.prSaveName.value = '  Bench PR 2  ';
    actions.confirmPRSave();

    expect(myPassiveRadiators.upsert).toHaveBeenCalledTimes(1);
    const saved = vi.mocked(myPassiveRadiators.upsert).mock.calls[0][0];
    expect(saved.model.value).toBe('Bench PR 2');
    expect(vi.mocked(myPassiveRadiators.upsert).mock.calls[0][1]).toBeUndefined();
    expect(project.box.passiveRadiator.radiator.model.value).toBe('My bench PR');
    expect(actions.prSaveOpen.value).toBe(false);
  });

  it('the saved copy and the project\'s passive radiator share nothing: editing one leaves the other alone', () => {
    const { project, myPassiveRadiators, actions } = setUp();
    project.box.passiveRadiator.radiator.model.set('My bench PR');
    project.box.passiveRadiator.radiator.spec.Qms.set(5);
    actions.openPRSave();
    actions.prSaveName.value = 'Library PR';
    actions.confirmPRSave();
    const saved = vi.mocked(myPassiveRadiators.upsert).mock.calls[0][0];

    project.box.passiveRadiator.radiator.spec.Qms.set(9);
    project.box.passiveRadiator.radiator.model.set('Renamed on page');
    expect(saved.spec.Qms.value).toBe(5);
    expect(saved.model.value).toBe('Library PR');

    saved.spec.Qms.set(3);
    saved.model.set('Renamed in library');
    expect(project.box.passiveRadiator.radiator.spec.Qms.value).toBe(9);
    expect(project.box.passiveRadiator.radiator.model.value).toBe('Renamed on page');
  });

  it('Cancel closes the dialog and saves nothing', () => {
    const { project, myPassiveRadiators, actions } = setUp();
    project.box.passiveRadiator.radiator.model.set('My bench PR');
    actions.openPRSave();
    actions.prSaveName.value = 'Other name';

    actions.cancelPRSave();

    expect(actions.prSaveOpen.value).toBe(false);
    expect(myPassiveRadiators.upsert).not.toHaveBeenCalled();
    expect(project.box.passiveRadiator.radiator.model.value).toBe('My bench PR');
  });

  it('an empty name cannot be saved', () => {
    const { myPassiveRadiators, actions } = setUp();
    actions.openPRSave();
    actions.prSaveName.value = '   ';

    expect(actions.prSaveCanSave.value).toBe(false);
    actions.confirmPRSave();

    expect(myPassiveRadiators.upsert).not.toHaveBeenCalled();
    expect(actions.prSaveOpen.value).toBe(true);
  });

  // Same as My Drivers (QO81): entries are keyed by identity, not name, so a name already in the
  // library saves a second entry beside it and overwrites nothing; there is no overwrite question.
  it('a name already in the library saves a new entry and overwrites nothing', () => {
    const { project, myPassiveRadiators, actions } = setUp();
    const existing = project.box.passiveRadiator.radiator.detach();
    existing.model.set('Bench PR');
    vi.mocked(myPassiveRadiators.list).mockReturnValue([{ uuid: 'pr-old', passiveRadiator: existing }]);
    actions.openPRSave();
    actions.prSaveName.value = 'Bench PR';

    actions.confirmPRSave();

    expect(myPassiveRadiators.upsert).toHaveBeenCalledTimes(1);
    expect(vi.mocked(myPassiveRadiators.upsert).mock.calls[0][1]).toBeUndefined();
  });

  it('loading a bundled passive radiator closes the browser and opens no editor', async () => {
    const { actions } = setUp();
    actions.prBrowseOpen.value = true;

    await actions.loadBundledPassiveRadiatorEntry('nd140');

    expect(actions.prBrowseOpen.value).toBe(false);
    expect(Object.keys(actions)).not.toContain('prEditOpen');
  });
});
