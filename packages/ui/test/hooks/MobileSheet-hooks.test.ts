/**
 * `useMobileSheet` — opening begins the What-if in Learn mode; every way out (Close, and dragging the
 * sheet down, which the browser spec covers) ends it, so the project is as it was and not modified. Reset puts the project's values
 * back and keeps the sheet open. In Tune mode, writes land directly in the project.
 */
import {describe, expect, it} from 'vitest';
import {computed, effectScope, ref} from 'vue';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '@openisd/design';
import {SheetField, SheetMode} from '@openisd/design/fields';
import {useMobileSheet} from '../../src/hooks/MobileSheet-hooks.js';
import {FeatureUse} from '../../src/logic/telemetry/featureUse.js';
import {NoTelemetry, type Telemetry} from '../../src/logic/telemetry/telemetry.js';
import {CrashReports} from '../../src/logic/telemetry/crashReports.js';
import {InstallMarker} from '../../src/logic/telemetry/install.js';
import {LaunchReporter, type LaunchEnvironment} from '../../src/logic/telemetry/launch.js';
import {createMemoryStorage} from '@openisd/persistence';
import type {TelemetryEvent} from '../../src/logic/telemetry/events.js';
import type {TelemetryUi} from '../../src/hooks/telemetryContext.js';
import {runHook} from './runHook.js';

const LAUNCH_ENV: LaunchEnvironment = {
  standalone: false, platformHint: undefined, userAgent: 'test',
  screenW: 390, screenH: 844, lang: 'en-GB', referrer: '', keysLost: [],
};

function sheet(mode = ref(SheetMode.LEARN), telemetryUi?: TelemetryUi) {
  const project = ProjectBuilder.empty(createEngine());
  project.driver.specs.Fs_hz.set(40);
  project.driver.specs.Qts.set(0.38);
  project.driver.specs.Vas_m3.set(0.03);
  project.box.sealed.volume_m3.set(0.012);
  project.save();
  const open = ref(false);
  const api = runHook(computed(() => project), () =>
    useMobileSheet({ open: () => open.value, setOpen: v => { open.value = v; }, mode }), undefined, telemetryUi);
  return { project, open, mode, api };
}

describe('useMobileSheet', () => {

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
      useMobileSheet({ open: () => open.value, setOpen: v => { open.value = v; }, mode: ref(SheetMode.LEARN) })));
    if (api === undefined) throw new Error('the hook did not run');
    api.openSheet();
    api.setValue(SheetField.BOX_VOLUME, 0.02);
    scope.stop();
    expect(project.isWhatIfActive()).toBe(false);
    expect(project.box.sealed.volume_m3.value).toBe(0.012);
    expect(project.isModified()).toBe(false);
  });

  it('opening in Tune records tune, in Learn whatif', () => {
    const events: TelemetryEvent[] = [];
    const fakeTelemetry: Telemetry = { record: e => events.push(e), flush: () => {} };
    const featureUse = new FeatureUse(fakeTelemetry);
    const telemetryUi: TelemetryUi = {
      featureUse,
      crashReports: new CrashReports(fakeTelemetry, () => '', async () => ''),
      launch: new LaunchReporter(fakeTelemetry, () => LAUNCH_ENV, work => work(), new InstallMarker(new NoTelemetry(), createMemoryStorage())),
    };

    const tune = sheet(ref(SheetMode.TUNE), telemetryUi);
    tune.api.openSheet();
    expect(events).toContainEqual({ kind: 'feature', name: 'tune' });

    events.length = 0;
    const learn = sheet(ref(SheetMode.LEARN), telemetryUi);
    learn.api.openSheet();
    expect(events).toContainEqual({ kind: 'feature', name: 'whatif' });
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
    function ventedSheet(mode = ref(SheetMode.LEARN)) {
      const made = sheet(mode);
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

    it('a press on a port-area value in Tune does not begin a What-if layer; in Learn it does', () => {
      const learn = ventedSheet(ref(SheetMode.LEARN));
      learn.api.openSheet();
      const rowLearn = learn.api.rows.value.find(r => r.field === SheetField.PORT_AREA);
      if (!rowLearn) throw new Error('no port area row');
      learn.api.portValuePress(press('click'), rowLearn);
      expect(learn.project.isWhatIfActive()).toBe(true);
      expect(learn.api.portEditor.value?.field.label).toBe(SheetField.PORT_AREA.label);

      const tune = ventedSheet(ref(SheetMode.TUNE));
      tune.api.openSheet();
      const rowTune = tune.api.rows.value.find(r => r.field === SheetField.PORT_AREA);
      if (!rowTune) throw new Error('no port area row');
      tune.api.portValuePress(press('click'), rowTune);
      expect(tune.project.isWhatIfActive()).toBe(false);
      expect(tune.api.portEditor.value?.field.label).toBe(SheetField.PORT_AREA.label);

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

