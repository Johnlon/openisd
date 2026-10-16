/**
 * `useMobileWhatIfSheet` — opening begins the What-if; every way out (Close, and dragging the
 * sheet down, which the browser spec covers) ends it, so the project is as it was and not modified. Reset puts the project's values
 * back and keeps the sheet open.
 */
import {describe, expect, it} from 'vitest';
import {computed, effectScope, ref} from 'vue';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '@openisd/design';
import {SheetField} from '@openisd/design/fields';
import {useMobileWhatIfSheet} from '../../src/hooks/MobileWhatIfSheet-hooks.js';
import {runHook} from './runHook.js';

function sheet() {
  const project = ProjectBuilder.empty(createEngine());
  project.driver.specs.Fs_hz.set(40);
  project.driver.specs.Qts.set(0.38);
  project.driver.specs.Vas_m3.set(0.03);
  project.box.sealed.volume_m3.set(0.012);
  project.save();
  const open = ref(false);
  const api = runHook(computed(() => project), () =>
    useMobileWhatIfSheet({ open: () => open.value, setOpen: v => { open.value = v; } }));
  return { project, open, api };
}

describe('useMobileWhatIfSheet', () => {
  it('opening begins a What-if', () => {
    const { project, open, api } = sheet();
    api.openSheet();
    expect(open.value).toBe(true);
    expect(api.isOpen.value).toBe(true);
    expect(project.isWhatIfActive()).toBe(true);
  });

  it('a value stepped on the sheet shows in the What-if but leaves the project unmodified', () => {
    const { project, api } = sheet();
    api.openSheet();
    api.setValue(SheetField.BOX_VOLUME, 0.02);
    expect(project.box.sealed.volume_m3.value).toBe(0.02);
    expect(project.isModified()).toBe(false);
  });

  it('Close ends the What-if: the project values are as before and not modified', () => {
    const { project, open, api } = sheet();
    api.openSheet();
    api.setValue(SheetField.BOX_VOLUME, 0.02);
    api.close();
    expect(open.value).toBe(false);
    expect(project.isWhatIfActive()).toBe(false);
    expect(project.box.sealed.volume_m3.value).toBe(0.012);
    expect(project.isModified()).toBe(false);
  });

  it('leaving the Graph page with the sheet open ends the What-if', () => {
    const project = ProjectBuilder.empty(createEngine());
    project.box.sealed.volume_m3.set(0.012);
    project.save();
    const open = ref(false);
    const scope = effectScope();
    const api = scope.run(() => runHook(computed(() => project), () =>
      useMobileWhatIfSheet({ open: () => open.value, setOpen: v => { open.value = v; } })));
    if (api === undefined) throw new Error('the hook did not run');
    api.openSheet();
    api.setValue(SheetField.BOX_VOLUME, 0.02);
    scope.stop();
    expect(project.isWhatIfActive()).toBe(false);
    expect(project.box.sealed.volume_m3.value).toBe(0.012);
    expect(project.isModified()).toBe(false);
  });

  it('Reset puts the project values back and keeps the sheet open', () => {
    const { project, open, api } = sheet();
    api.openSheet();
    api.setValue(SheetField.BOX_VOLUME, 0.02);
    api.reset();
    expect(open.value).toBe(true);
    expect(project.isWhatIfActive()).toBe(true);
    expect(project.box.sealed.volume_m3.value).toBe(0.012);
  });

  it('ignores an emptied field', () => {
    const { project, api } = sheet();
    api.openSheet();
    api.setValue(SheetField.BOX_VOLUME, null);
    expect(project.box.sealed.volume_m3.value).toBe(0.012);
  });

  describe('the port overlay', () => {
    function ventedSheet() {
      const made = sheet();
      made.project.box.boxType.set('vented');
      made.project.box.vented.volume_m3.set(0.05);
      made.project.box.vented.vent.diameter_m.set(0.06);
      made.project.box.vented.tuning_goal_hz.set(35);
      made.project.save();
      return made;
    }
    function press(type: string) {
      const event = {type, defaultPrevented: false, preventDefault() { event.defaultPrevented = true; }};
      return event;
    }

    it('a click on a port-area value opens that port\'s fields, and Close puts them away', () => {
      const { api } = ventedSheet();
      api.openSheet();
      const row = api.rows.value.find(r => r.field === SheetField.PORT_AREA);
      expect(row).toBeDefined();
      if (row === undefined) return;
      const down = press('pointerdown');
      api.portValuePress(down, row);
      expect(down.defaultPrevented).toBe(true);
      expect(api.portEditor.value).toBeNull();
      api.portValuePress(press('click'), row);
      expect(api.portEditor.value?.field.label).toBe(SheetField.PORT_AREA.label);
      api.closePortEditor();
      expect(api.portEditor.value).toBeNull();
    });

    it('a press on any other row opens nothing', () => {
      const { api } = ventedSheet();
      api.openSheet();
      const row = api.rows.value.find(r => r.field === SheetField.TUNING);
      if (row === undefined) throw new Error('no tuning row');
      const click = press('click');
      api.portValuePress(click, row);
      expect(click.defaultPrevented).toBe(false);
      expect(api.portEditor.value).toBeNull();
    });

    it('closing the sheet puts the overlay away too', () => {
      const { api } = ventedSheet();
      api.openSheet();
      const row = api.rows.value.find(r => r.field === SheetField.PORT_AREA);
      if (row === undefined) throw new Error('no port area row');
      api.portValuePress(press('click'), row);
      api.close();
      expect(api.portEditor.value).toBeNull();
    });
  });
});
