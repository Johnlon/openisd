/**
 * `createTuneSession` — the Tune what-if shared by both skins: rows per box type, writes that land
 * in the what-if layer, Reset back to the committed design, Cancel discarding the layer.
 */
import {describe, expect, it} from 'vitest';
import {computed, ref} from 'vue';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '@openisd/design';
import {TuneField} from '@openisd/design/fields';
import {createTuneSession} from '../../src/hooks/tuneSession.js';

function sealedProject() {
  const project = ProjectBuilder.empty(createEngine());
  project.driver.specs.Fs_hz.set(40);
  project.driver.specs.Qts.set(0.38);
  project.driver.specs.Qes.set(0.45);
  project.driver.specs.Vas_m3.set(0.03);
  project.driver.specs.Sd_m2.set(0.02);
  project.box.sealed.volume_m3.set(0.012);
  return project;
}

function session(project = sealedProject()) {
  const changed = ref(0);
  const s = createTuneSession({ project: computed(() => project), projectChanged: changed });
  return { project, changed, s };
}

describe('createTuneSession', () => {
  it('lists the box type\'s rows with their current values', () => {
    const { s } = session();
    expect(s.rows.value.map(r => r.tune)).toEqual(TuneField.forBox('sealed'));
    expect(s.rows.value.find(r => r.tune === TuneField.BOX_VOLUME)?.value).toBe(0.012);
    expect(s.rows.value.find(r => r.tune === TuneField.DRIVER_FS)?.value).toBe(40);
  });

  it('writes into a what-if, which Cancel discards', () => {
    const { project, s } = session();
    s.set(TuneField.BOX_VOLUME, 0.02);
    expect(project.isWhatIfActive()).toBe(true);
    expect(project.box.sealed.volume_m3.value).toBe(0.02);
    s.cancel();
    expect(project.isWhatIfActive()).toBe(false);
    expect(project.box.sealed.volume_m3.value).toBe(0.012);
  });

  it('Reset puts the committed design back and keeps the what-if open', () => {
    const { project, s } = session();
    s.begin();
    s.set(TuneField.DRIVER_VAS, 0.05);
    s.reset();
    expect(project.isWhatIfActive()).toBe(true);
    expect(project.driver.specs.Vas_m3.value).toBe(0.03);
  });

  it('refreshes a row\'s value when the project changes', () => {
    const { changed, s } = session();
    s.set(TuneField.DRIVER_COUNT, 2);
    changed.value++;
    expect(s.rows.value.find(r => r.tune === TuneField.DRIVER_COUNT)?.value).toBe(2);
  });

  it('moves the port length when the vented tuning is stepped', () => {
    const project = sealedProject();
    project.box.boxType.set('vented');
    project.box.vented.volume_m3.set(0.05);
    project.box.vented.vent.diameter_m.set(0.05);
    project.box.vented.tuning_goal_hz.set(35);
    const before = project.box.vented.vent.length_m.value;
    const { s } = session(project);
    s.set(TuneField.TUNING, 45);
    expect(project.box.vented.tuning_goal_hz.value).toBe(45);
    expect(project.box.vented.vent.length_m.value).not.toBe(before);
  });
});
