import {describe, expect, it} from 'vitest';
import {OpenISDDriver} from '@openisd/design';
import {DEFAULT_SEALED_QTC, DEFAULT_SEALED_VOLUME_L, NumberField} from '@openisd/design/fields';
import {createMemoryStorage} from '@openisd/persistence';
import {useOgNewProject} from '../../src/hooks/OriginalNewProject-hooks.js';
import {createAppStateFixture} from '../fixtures/appStateFixture.js';
import {testAppLogic} from '../hooks/testAppLogic.js';
import {myPassiveRadiatorRepoOn} from '../fixtures/repoOn.js';

/** T726: the wizard and a project opened from a bare driver file start from the same sealed box. */
describe('wizard and project defaults agree', () => {
  it('the wizard and a bare driver file both start at the one sealed volume and Qtc', () => {
    const app = testAppLogic();
    const wizard = useOgNewProject({appState: createAppStateFixture().appState, passiveRadiators: {
      saved: myPassiveRadiatorRepoOn(createMemoryStorage()),
      bundled: {index: () => Promise.reject(new Error('no catalogue')), load: () => Promise.reject(new Error('no catalogue'))},
    }, areas: app.engine});
    const expected_m3 = NumberField.BOX_VB_L.toSI(DEFAULT_SEALED_VOLUME_L);
    expect(wizard.sealedVolume_m3.value).toBe(expected_m3);
    expect(wizard.targetQtc.value).toBe(DEFAULT_SEALED_QTC);

    app.appState.openProjectFromDriver(OpenISDDriver.empty(app.engine), 'Bare');
    expect(app.appState.focusedProject()!.box.sealed.volume_m3.value).toBe(expected_m3);
  });
});
