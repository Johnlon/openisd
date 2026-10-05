/**
 * `useMobileTuneSheet` — opening begins the what-if, Done closes and keeps it, Cancel discards it
 * and closes.
 */
import {describe, expect, it} from 'vitest';
import {computed, ref} from 'vue';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '@openisd/design';
import {TuneField} from '@openisd/design/fields';
import {useMobileTuneSheet} from '../../src/hooks/MobileTuneSheet-hooks.js';
import {runHook} from './runHook.js';

function sheet() {
  const project = ProjectBuilder.empty(createEngine());
  project.driver.specs.Fs_hz.set(40);
  project.driver.specs.Qts.set(0.38);
  project.driver.specs.Vas_m3.set(0.03);
  project.box.sealed.volume_m3.set(0.012);
  const open = ref(false);
  const api = runHook(computed(() => project), () =>
    useMobileTuneSheet({ open: () => open.value, setOpen: v => { open.value = v; } }));
  return { project, open, api };
}

describe('useMobileTuneSheet', () => {
  it('opening begins a what-if', () => {
    const { project, open, api } = sheet();
    api.openSheet();
    expect(open.value).toBe(true);
    expect(api.isOpen.value).toBe(true);
    expect(project.isWhatIfActive()).toBe(true);
  });

  it('Done closes and keeps the tuned value', () => {
    const { project, open, api } = sheet();
    api.openSheet();
    api.setValue(TuneField.BOX_VOLUME, 0.02);
    api.done();
    expect(open.value).toBe(false);
    expect(project.box.sealed.volume_m3.value).toBe(0.02);
  });

  it('Cancel discards the tuned value and closes', () => {
    const { project, open, api } = sheet();
    api.openSheet();
    api.setValue(TuneField.BOX_VOLUME, 0.02);
    api.cancel();
    expect(open.value).toBe(false);
    expect(project.isWhatIfActive()).toBe(false);
    expect(project.box.sealed.volume_m3.value).toBe(0.012);
  });

  it('ignores an emptied field', () => {
    const { project, api } = sheet();
    api.openSheet();
    api.setValue(TuneField.BOX_VOLUME, null);
    expect(project.box.sealed.volume_m3.value).toBe(0.012);
  });
});
