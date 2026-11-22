/** Every bottom-sheet slot reads and writes the project field it names, for each box type. */
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../../engine/Engine.js';
import type {BoxType} from '../../../engine/index.js';
import type {SheetSlot} from '../../../fields/sheetField.js';
import {ProjectBuilder} from '../../../domain/openisdTransforms.js';
import type {OpenISDProject} from '../../../domain/project/openISDProject.js';
import {driverSpecOfSlot, readSheetSlot, ventOfSlot, writeSheetSlot} from '../../../domain/project/sheetSlots.js';
import {driverFrom, spec, specSection} from '../../fixtures/domainBuilders.js';

const engine = createEngine();

const driver = () => driverFrom({
  brand: 'Dayton', model: 'RS225', section: 'woofer',
  spec: {...specSection({Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008}), Re_ohm: spec(6), Qes: spec(0.45), Qms: spec(3.6)},
});

const builder = () => new ProjectBuilder(driver(), engine);

function projectOf(type: BoxType): OpenISDProject {
  switch (type) {
    case 'sealed': return builder().sealed().volume_m3(0.03).build();
    case 'vented': return builder().vented().volume_m3(0.05).tuning_goal_hz(35).build();
    case 'bandpass4': return builder().bandpass4().rearVolume_m3(0.03).frontVolume_m3(0.02).frontTuning_hz(60).build();
    case 'bandpass6': return builder().bandpass6().rearVolume_m3(0.03).rearTuning_hz(40).frontVolume_m3(0.02).frontTuning_hz(60).build();
    case 'abc': return builder().abc().rearVolume_m3(0.03).rearTuning_hz(40).frontVolume_m3(0.02).frontTuning_hz(60).build();
    case 'box-passive-radiator': return builder().passiveRadiator().volume_m3(0.05).tuning_goal_hz(35).build();
  }
}

const ALL_SLOTS: readonly SheetSlot[] = [
  'volume', 'frontVolume', 'ventTuning', 'rearTuning', 'ventArea', 'rearVentArea', 'frontVentArea', 'intraVentArea',
  'prAddedMass', 'prCount', 'driverFs', 'driverQes', 'driverQms', 'driverVas', 'driverCount', 'inputPower',
];

describe('driverSpecOfSlot', () => {
  it('names the spec of the four driver slots and nothing else', () => {
    const named = ALL_SLOTS.map(slot => [slot, driverSpecOfSlot(slot)]);
    expect(named.filter(([, spec]) => spec !== null)).toEqual([
      ['driverFs', 'Fs_hz'], ['driverQes', 'Qes'], ['driverQms', 'Qms'], ['driverVas', 'Vas_m3'],
    ]);
  });
});

describe('ventOfSlot', () => {
  it('finds the port a port slot names, and none for any other slot', () => {
    const abc = projectOf('abc');
    const areaOf = (slot: SheetSlot) => ventOfSlot(abc, 'abc', slot)?.area_m2.value;
    expect(areaOf('ventArea')).toBe(abc.box.ventGroupOf('abc').vent.area_m2.value);
    expect(areaOf('frontVentArea')).toBe(abc.box.ventGroupOf('abc').vent.area_m2.value);
    expect(areaOf('rearVentArea')).toBe(abc.box.rearVentGroupOf('abc')?.vent.area_m2.value);
    expect(areaOf('intraVentArea')).toBe(abc.box.ventPortsOf('abc').find(port => port.name === 'Intra')?.vent.area_m2.value);
    expect(ventOfSlot(abc, 'abc', 'intraVentArea')).not.toBeNull();
    expect(ventOfSlot(abc, 'abc', 'rearVentArea')).not.toBeNull();
    for (const slot of ['volume', 'frontVolume', 'ventTuning', 'rearTuning', 'prAddedMass', 'prCount', 'driverFs', 'driverQes',
      'driverQms', 'driverVas', 'driverCount', 'inputPower'] as const) {
      expect(ventOfSlot(abc, 'abc', slot)).toBeNull();
    }
  });

  it('finds no rear or intra port on a box without one', () => {
    const vented = projectOf('vented');
    expect(ventOfSlot(vented, 'vented', 'rearVentArea')).toBeNull();
    expect(ventOfSlot(vented, 'vented', 'intraVentArea')).toBeNull();
  });
});

describe('readSheetSlot and writeSheetSlot', () => {
  it('write a value and read it back, for every slot a box has', () => {
    for (const type of ['sealed', 'vented', 'bandpass4', 'bandpass6', 'abc', 'box-passive-radiator'] as const) {
      const p = projectOf(type);
      for (const slot of ALL_SLOTS) {
        if (readSheetSlot(p, type, slot) === null) continue;
        const v = slot === 'prCount' || slot === 'driverCount' ? 2 : 0.0123;
        writeSheetSlot(p, type, slot, v);
        expect(readSheetSlot(p, type, slot), `${type} ${slot}`).toBeCloseTo(v, 9);
      }
    }
  });

  it('round a count to a whole number', () => {
    const p = projectOf('box-passive-radiator');
    writeSheetSlot(p, 'box-passive-radiator', 'prCount', 2.6);
    expect(readSheetSlot(p, 'box-passive-radiator', 'prCount')).toBe(3);
    writeSheetSlot(p, 'box-passive-radiator', 'driverCount', 1.4);
    expect(readSheetSlot(p, 'box-passive-radiator', 'driverCount')).toBe(1);
  });

  it('read nothing for the slots a box lacks, and writing them changes nothing', () => {
    const p = projectOf('sealed');
    for (const slot of ['frontVolume', 'rearTuning', 'rearVentArea', 'intraVentArea'] as const) {
      expect(readSheetSlot(p, 'sealed', slot)).toBeNull();
      writeSheetSlot(p, 'sealed', slot, 1);
      expect(readSheetSlot(p, 'sealed', slot)).toBeNull();
    }
  });

  it('a port area write notifies the vent in the same batch', () => {
    const p = projectOf('vented');
    const before = readSheetSlot(p, 'vented', 'ventArea');
    writeSheetSlot(p, 'vented', 'ventArea', 0.004);
    expect(readSheetSlot(p, 'vented', 'ventArea')).toBeCloseTo(0.004, 12);
    expect(before).not.toBe(0.004);
  });
});
