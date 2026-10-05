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
  it('saveToLibrary saves the project\'s passive radiator to My passive radiators under its name', () => {
    const { project, myPassiveRadiators, actions } = setUp();
    project.box.passiveRadiator.radiator.model.set('My bench PR');

    actions.saveToLibrary();

    expect(myPassiveRadiators.upsert).toHaveBeenCalledTimes(1);
    const saved = vi.mocked(myPassiveRadiators.upsert).mock.calls[0][0];
    expect(saved.model.value).toBe('My bench PR');
  });

  it('loading a bundled passive radiator closes the browser and opens no editor', async () => {
    const { actions } = setUp();
    actions.prBrowseOpen.value = true;

    await actions.loadBundledPassiveRadiatorEntry('nd140');

    expect(actions.prBrowseOpen.value).toBe(false);
    expect(Object.keys(actions)).not.toContain('prEditOpen');
  });
});
