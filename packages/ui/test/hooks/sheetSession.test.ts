/**
 * `createSheetSession` — the bottom sheet session shared by both skins: rows/lines per box type
 * and mode, Tune writes to the project, Learn writes to the What-if layer, Reset back to the
 * project's values, Close discarding the layer.
 */
import {describe, expect, it} from 'vitest';
import {computed, ref} from 'vue';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '@openisd/design';
import {SheetField, SheetMode} from '@openisd/design/fields';
import {createSheetSession} from '../../src/hooks/sheetSession.js';

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

function session(project = sealedProject(), mode = ref(SheetMode.LEARN)) {
  const changed = ref(0);
  const s = createSheetSession({ project: computed(() => project), projectChanged: changed, mode });
  return { project, changed, mode, s };
}

describe('createSheetSession', () => {
  it('Tune set changes the project and opens no What-if layer', () => {
    const project = sealedProject();
    project.save();
    const { s } = session(project, ref(SheetMode.TUNE));
    s.set(SheetField.BOX_VOLUME, 0.02);
    expect(project.isWhatIfActive()).toBe(false);
    expect(project.isModified()).toBe(true);
    expect(project.box.sealed.volume_m3.value).toBe(0.02);
  });

  it('Learn set leaves the project alone', () => {
    const project = sealedProject();
    project.save();
    const { s } = session(project, ref(SheetMode.LEARN));
    s.set(SheetField.BOX_VOLUME, 0.02);
    expect(project.isWhatIfActive()).toBe(true);
    expect(project.isModified()).toBe(false);
    expect(project.box.sealed.volume_m3.value).toBe(0.02);
  });

  it('Learn -> Tune discards the layer, and Tune -> Learn begins one', () => {
    const project = sealedProject();
    project.save();
    const { s, mode } = session(project, ref(SheetMode.LEARN));
    s.set(SheetField.BOX_VOLUME, 0.02);
    expect(project.isWhatIfActive()).toBe(true);
    expect(project.box.sealed.volume_m3.value).toBe(0.02);

    s.setMode(SheetMode.TUNE);
    expect(mode.value).toStrictEqual(SheetMode.TUNE);
    expect(project.isWhatIfActive()).toBe(false);
    expect(project.box.sealed.volume_m3.value).toBe(0.012);

    s.setMode(SheetMode.LEARN);
    expect(mode.value).toStrictEqual(SheetMode.LEARN);
    expect(project.isWhatIfActive()).toBe(true);

  });

  it('lines for each box type equals mode.lines(type) mapped to rows', () => {
    for (const boxType of ['sealed', 'vented', 'abc'] as const) {
      for (const sheetMode of [SheetMode.TUNE, SheetMode.LEARN]) {
        const project = sealedProject();
        project.box.boxType.set(boxType);
        const { s } = session(project, ref(sheetMode));
        const expectedLines = sheetMode.lines(boxType);
        expect(s.lines.value.length).toBe(expectedLines.length);
        for (let i = 0; i < expectedLines.length; i++) {
          const expectedFields = expectedLines[i];
          const actualLine = s.lines.value[i];
          expect(actualLine.map(r => r.field)).toEqual(expectedFields);
          for (const row of actualLine) {
            expect(row.value).not.toBeUndefined();
          }
        }
      }
    }
  });

  it('lists the box type\'s rows with their current values', () => {
    const { s } = session();
    expect(s.rows.value.map(r => r.field)).toEqual(SheetField.forBox('sealed'));
    expect(s.rows.value.find(r => r.field === SheetField.BOX_VOLUME)?.value).toBe(0.012);
    expect(s.rows.value.find(r => r.field === SheetField.DRIVER_FS)?.value).toBe(40);
  });


  it('writes into a What-if, never the project, and Close discards it', () => {
    const project = sealedProject();
    project.save();
    const { s } = session(project);
    const before = project.cloneSession();
    s.set(SheetField.BOX_VOLUME, 0.02);
    expect(project.isWhatIfActive()).toBe(true);
    expect(project.box.sealed.volume_m3.value).toBe(0.02);
    expect(project.isModified()).toBe(false);
    expect(project.cloneSession()).toEqual(before);
    s.close();
    expect(project.isWhatIfActive()).toBe(false);
    expect(project.box.sealed.volume_m3.value).toBe(0.012);
    expect(project.isModified()).toBe(false);
  });

  it('Reset puts the committed design back and keeps the what-if open', () => {
    const { project, s } = session();
    s.begin();
    s.set(SheetField.DRIVER_VAS, 0.05);
    s.reset();
    expect(project.isWhatIfActive()).toBe(true);
    expect(project.driver.specs.Vas_m3.value).toBe(0.03);
  });

  it('refreshes a row\'s value when the project changes', () => {
    const { changed, s } = session();
    s.set(SheetField.DRIVER_COUNT, 2);
    changed.value++;
    expect(s.rows.value.find(r => r.field === SheetField.DRIVER_COUNT)?.value).toBe(2);
  });

  it('moves the port length when the vented tuning is stepped', () => {
    const project = sealedProject();
    project.box.boxType.set('vented');
    project.box.vented.volume_m3.set(0.05);
    project.box.vented.vent.diameter_m.set(0.05);
    project.box.vented.tuning_goal_hz.set(35);
    const before = project.box.vented.vent.length_m.value;
    const { s } = session(project);
    s.set(SheetField.TUNING, 45);
    expect(project.box.vented.tuning_goal_hz.value).toBe(45);
    expect(project.box.vented.vent.length_m.value).not.toBe(before);
  });

  describe('port area', () => {
    function ventedProject() {
      const project = sealedProject();
      project.box.boxType.set('vented');
      project.box.vented.volume_m3.set(0.05);
      project.box.vented.vent.diameter_m.set(0.06);
      project.box.vented.tuning_goal_hz.set(35);
      return project;
    }
    const value = (rows: readonly {readonly field: SheetField; readonly value: number | null}[], f: SheetField) => rows.find(r => r.field === f)?.value;

    it('shows one port\'s area, and a diameter entered on the Vents tab comes back as that area', () => {
      const { s } = session(ventedProject());
      expect(value(s.rows.value, SheetField.PORT_AREA)).toBeCloseTo(Math.PI * 0.03 ** 2, 12);
    });

    it('turns an area into the round port\'s diameter and back', () => {
      const project = ventedProject();
      const { s } = session(project);
      s.set(SheetField.PORT_AREA, Math.PI * 0.04 ** 2);
      expect(project.box.vented.vent.diameter_m.value).toBeCloseTo(0.08, 9);
      s.set(SheetField.PORT_AREA, Math.PI * 0.03 ** 2);
      expect(project.box.vented.vent.diameter_m.value).toBeCloseTo(0.06, 9);
    });

    it('turns an area into a slotted port\'s height at the stated width', () => {
      const project = ventedProject();
      project.box.vented.vent.shape.set('slotted');
      project.box.vented.vent.width_m.set(0.1);
      const { s } = session(project);
      s.set(SheetField.PORT_AREA, 0.002);
      expect(project.box.vented.vent.height_m.value).toBeCloseTo(0.02, 9);
      expect(project.box.vented.vent.width_m.value).toBe(0.1);
    });

    it('keeps the target tuning and makes a new length for the new area', () => {
      const project = ventedProject();
      const vent = project.box.vented.vent;
      const lengthBefore = vent.length_m.value;
      const area = vent.area_m2.value;
      expect(area).not.toBeNull();
      const { s } = session(project);
      s.set(SheetField.PORT_AREA, (area ?? 0) * 2);
      expect(project.box.vented.tuning_goal_hz.value).toBe(35);
      expect(vent.length_m.value).not.toBe(lengthBefore);
      expect(vent.tuningIn_hz(0.05) ?? 0).toBeCloseTo(35, 3);
    });

    it('gives a port-area row its port, so the value can open that port\'s fields, and no other row one', () => {
      const project = ventedProject();
      const { s } = session(project);
      for (const row of s.rows.value) {
        expect(row.vent !== null, row.field.label).toBe(row.field === SheetField.PORT_AREA);
      }
      expect(s.rows.value.find(r => r.field === SheetField.PORT_AREA)?.vent?.area_m2.value).toBe(project.box.vented.vent.area_m2.value);
    });

    it('lists a rear and a front port on a 6th-order bandpass and an intra port on an ABC', () => {
      for (const [type, labels] of [['bandpass6', ['Rear port area', 'Front port area']], ['abc', ['Rear port area', 'Front port area', 'Intra port area']]] as const) {
        const project = sealedProject();
        project.box.boxType.set(type);
        const { s } = session(project);
        for (const label of labels) {
          const row = s.rows.value.find(r => r.field.label === label);
          expect(row?.value, `${type} ${label}`).not.toBeNull();
        }
      }
    });
  });
});
