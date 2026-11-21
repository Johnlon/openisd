import {describe, expect, it, vi} from 'vitest';
import {createRenderer, defineComponent, ref} from 'vue';
import {NumberField, PhoneHelpSection} from '@openisd/design/fields';
import {MY_DRIVERS_KEY, createMemoryStorage} from '@openisd/persistence';
import {OpenISDDriver, OpenISDDriverStandalone} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import {commitMyDriver, ebpVal, useDriverDimensionLabels, useDriverEditorHelp} from '../../src/hooks/DriverEditorModal-hooks.js';
import {recordingTelemetryUi} from '../fixtures/recordingTelemetryUi.js';
import {myDriverRepoOn} from '../fixtures/repoOn.js';

function completeDriver(): OpenISDDriverStandalone {
  const engine = createEngine();
  const driver = OpenISDDriver.empty(engine);
  driver.specs.Fs_hz.set(40);
  driver.specs.Qes.set(0.45);
  driver.specs.Qms.set(4);
  driver.specs.Vas_m3.set(0.03);
  driver.specs.Re_ohm.set(6);
  driver.specs.Sd_m2.set(0.02);
  return driver;
}

describe('DriverEditorModal-hooks', () => {
  it('pairs every dimension field name with its figure in the selected unit', () => {
    const driver = completeDriver();
    driver.specs.Basket_m.set(0.101);
    driver.specs.MagDepth_m.set(0.006893, 0.0000005);
    const tokens = ref<Readonly<Record<string, string>>>({});
    const figures = useDriverDimensionLabels(key => driver.specField(key), () => tokens.value);

    expect(figures.value).toEqual({
      basket: {label: NumberField.BASKET_M.label, figure: '101.00 mm'},
      magnetDepth: {label: NumberField.MAGDEPTH_M.label, figure: '6.893 mm'},
      thick: {label: NumberField.THICK_M.label, figure: ''},
      outer: {label: NumberField.OUTER_M.label, figure: ''},
      magnet: {label: NumberField.MAGNET_M.label, figure: ''},
      depth: {label: NumberField.DEPTH_M.label, figure: ''},
    });
    tokens.value = NumberField.BASKET_M.withNextUnit(tokens.value);
    expect(figures.value.basket).toEqual({label: NumberField.BASKET_M.label, figure: '3.976 in'});
    expect(figures.value.magnetDepth).toEqual({label: NumberField.MAGDEPTH_M.label, figure: '6.893 mm'});
  });

  describe('ebpVal', () => {
    it('reads the driver EBP once Fs and Qes are both known', () => {
      const driver = completeDriver();
      expect(ebpVal(driver)).toBeCloseTo(40 / 0.45, 1);
    });

    it('is null before the driver can derive it', () => {
      const driver = OpenISDDriver.empty(createEngine());
      expect(ebpVal(driver)).toBeNull();
    });
  });

  describe('commitMyDriver', () => {
    function savedWith(model: string) {
      const myDrivers = myDriverRepoOn(createMemoryStorage(), createEngine());
      const driver = completeDriver();
      driver.brand.set('Test');
      driver.model.set(model);
      const saved = myDrivers.upsert(driver);
      if (saved === null) throw new Error('memory storage refused a save');
      return {myDrivers, driver, uuid: saved.uuid};
    }

    it('overwrites the opened row, so an edit never appends a twin', () => {
      const {myDrivers, driver, uuid} = savedWith('Fixture');
      driver.model.set('Fixture Mk2');
      expect(commitMyDriver(myDrivers, recordingTelemetryUi().telemetryUi.featureUse, driver, uuid)).toBe(true);
      expect(myDrivers.list().map(e => [e.uuid, e.driver.model.value])).toEqual([[uuid, 'Fixture Mk2']]);
    });

    it('files a new row when nothing was opened', () => {
      const {myDrivers, driver} = savedWith('Fixture');
      expect(commitMyDriver(myDrivers, recordingTelemetryUi().telemetryUi.featureUse, driver.copyAsNew(() => 'minted-copy'), '')).toBe(true);
      expect(myDrivers.list()).toHaveLength(2);
    });

    // John, 10 Nov 2026: "scan rest of app for missed telemetry".
    it('counts a save to My Drivers that worked, and not one that was refused', () => {
      const {myDrivers, driver, uuid} = savedWith('Fixture');
      const saved = recordingTelemetryUi();
      commitMyDriver(myDrivers, saved.telemetryUi.featureUse, driver, uuid);
      expect(saved.events).toEqual([{kind: 'feature', name: 'save_my_driver'}]);

      const storage = createMemoryStorage();
      storage.set(MY_DRIVERS_KEY, 'not json');
      const refused = recordingTelemetryUi();
      commitMyDriver(myDriverRepoOn(storage, createEngine()), refused.telemetryUi.featureUse, completeDriver(), '');
      expect(refused.events).toEqual([]);
    });

    it('answers false while My Drivers is unreadable (read-only)', () => {
      const storage = createMemoryStorage();
      const myDrivers = myDriverRepoOn(storage, createEngine());
      storage.set(MY_DRIVERS_KEY, 'not json');
      expect(commitMyDriver(myDrivers, recordingTelemetryUi().telemetryUi.featureUse, completeDriver(), '')).toBe(false);
    });
  });

  it('opens and closes the selected field-help section', () => {
    const listeners = new Map<string, EventListener>();
    const windowStub = {
      addEventListener: (type: string, listener: EventListener) => listeners.set(type, listener),
      removeEventListener: (type: string) => listeners.delete(type),
    };
    vi.stubGlobal('window', windowStub);
    type HostNode = {children: HostNode[]; parent: HostNode | null};
    const renderer = createRenderer<HostNode, HostNode>({
      patchProp: () => undefined,
      insert: (child, parent) => { child.parent = parent; parent.children.push(child); },
      remove: child => { child.parent = null; },
      createElement: () => ({children: [], parent: null}),
      createText: () => ({children: [], parent: null}),
      createComment: () => ({children: [], parent: null}),
      setText: () => undefined,
      setElementText: () => undefined,
      parentNode: node => node.parent,
      nextSibling: () => null,
    });
    let help!: ReturnType<typeof useDriverEditorHelp>;
    const app = renderer.createApp(defineComponent({
      setup() {
        help = useDriverEditorHelp();
        return () => null;
      },
    }));
    app.mount({children: [], parent: null});
    const section = new PhoneHelpSection('Key fields', 'The values needed for the charts.', []);

    expect(help.helpSection.value).toBeNull();
    help.showHelp(section);
    expect(help.helpSection.value).toBe(section);
    const keydown = listeners.get('keydown');
    expect(keydown).toBeDefined();
    keydown?.(Object.assign(new Event('keydown'), {key: 'Escape'}));
    expect(help.helpSection.value).toBeNull();
    app.unmount();
    expect(listeners.has('keydown')).toBe(false);
    vi.unstubAllGlobals();
  });
});
