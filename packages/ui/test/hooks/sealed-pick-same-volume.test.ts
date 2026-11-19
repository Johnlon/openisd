import {describe, expect, it} from 'vitest';
import {computed, ref, shallowRef} from 'vue';
import {createEngine} from '@openisd/design/engine';
import {OpenISDDriver} from '@openisd/design';
import {createMemoryStorage} from '@openisd/persistence';
import {useOgNewProject} from '../../src/hooks/OriginalNewProject-hooks.js';
import {SealedAlignmentEditor} from '../../src/hooks/SealedAlignment-hooks.js';
import {createAppStateFixture} from '../fixtures/appStateFixture.js';
import {myPassiveRadiatorRepoOn} from '../fixtures/repoOn.js';
import {recordingTelemetryUi} from '../fixtures/recordingTelemetryUi.js';

/**
 * T902, bugs/BUG_20261118_wizard-rounds-the-picked-sealed-volume.md: the New-project wizard and the Box tab's
 * alignment picker are two ways to pick one sealed Qtc. Both store the volume the engine gives for it; the wizard used to
 * round it to the volume field's display digits first (Qtc 0.707: 4.803 L reads 0.70699 on the Box tab, the picker's
 * 4.802824 L reads 0.70700).
 */
describe('picking a sealed Qtc stores one volume, whichever picker is used', () => {
  for (const qtc of [0.6, 0.707, 0.8]) {
    it(`Qtc ${qtc}: the wizard stores the same volume the Box tab picker stores for the same project`, () => {
      const engine = createEngine();
      const driver = OpenISDDriver.empty(engine);
      driver.model.set('W5');
      driver.specs.Fs_hz.set(45);
      driver.specs.Qes.set(0.57);
      driver.specs.Qms.set(3.56);
      driver.specs.Re_ohm.set(3.4);
      driver.specs.Vas_m3.set(0.00485);
      driver.specs.Sd_m2.set(0.0094);
      const wizard = useOgNewProject({appState: createAppStateFixture().appState, passiveRadiators: {
        saved: myPassiveRadiatorRepoOn(createMemoryStorage()),
        bundled: {index: () => Promise.reject(new Error('no catalogue')), load: () => Promise.reject(new Error('no catalogue'))},
      }, areas: engine});
      wizard.selectDriver(driver);
      wizard.projName.value = 'Pick';
      wizard.selectSealedAlignment(qtc);
      const project = wizard.createProject();
      if (project === null) throw new Error('the wizard made no project');
      const fromWizard = project.box.sealed.volume_m3.value;

      const projectRef = shallowRef(project);
      const editor = new SealedAlignmentEditor(computed(() => projectRef.value), ref(0), engine.sealed, engine.driver,
        recordingTelemetryUi().telemetryUi.featureUse);
      editor.openEditor();
      editor.selectQtc(qtc);
      editor.accept();

      expect(fromWizard).toBe(project.box.sealed.volume_m3.value);
    });
  }
});
