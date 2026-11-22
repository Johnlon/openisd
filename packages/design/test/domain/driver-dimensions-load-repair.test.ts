import {describe, expect, it} from 'vitest';
import {DriverRecordConverter} from '../../domain/driverRecordConverter.js';
import {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import type {DriverSpecsSection} from '../../domain/openisdSchema.js';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import {owprTextOf} from '../../domain/project/projectSerialization.js';
import {createEngine} from '../../engine/Engine.js';
import {WinISDDriver} from '../../winisd/winisdDriver.js';
import {DEFAULT_GRID, loadProject, projectFindings} from '../fixtures/inputLimitsSweep.js';

const engine = createEngine();
const dimensions = [
  ['Thick_m', 11], ['Depth_m', 22], ['MagDepth_m', 66], ['Magnet_m', 44], ['Outer_m', 66],
  ['OuterX_m', 66], ['OuterY_m', 66], ['Vcd_m', 77], ['DVol_m3', 88],
] as const;
const magnetGeometry = {
  Sd_m2: {state: 'E', value: 0.006361725123519331},
  Vcd_m: {state: 'E', value: 0.025},
  DVol_m3: {state: 'E', value: 0.00015711235760296454},
  Depth_m: {state: 'E', value: 0.055},
  Magnet_m: {state: 'E', value: 0.060},
} satisfies DriverSpecsSection;

function openingRecord(woofer: DriverSpecsSection) {
  const session = loadProject('sealed').cloneSession();
  const {saved} = session;
  const {driverEmbedding} = saved;
  const {device} = driverEmbedding;
  const withDimensions = {...device, specs: {...device.specs, woofer: {...device.specs.woofer, ...woofer}}};
  return {session: {...session, saved: {...saved, driverEmbedding: {...driverEmbedding, device: withDimensions}}, edited: null}, device: withDimensions};
}

function openBoth(woofer: DriverSpecsSection) {
  const {session, device} = openingRecord(woofer);
  const driver = OpenISDDriver.fromOwdrText(JSON.stringify(device), engine);
  const project = OpenISDProject.fromOwprTextRepairing(owprTextOf(session), engine);
  if (Array.isArray(driver)) throw new Error(driver.join('\n'));
  if (Array.isArray(project)) throw new Error(project.join('\n'));
  return {driver, project};
}

describe('Driver dimensions on opening', () => {
  it.each(dimensions)('keeps and flags an out-of-range %s in .owdr and .owpr files', (key, value) => {
    const {driver, project: {project, loadRepairs}} = openBoth({[key]: {state: 'E', value}});
    for (const {specs} of [driver, project.driver]) {
      expect(specs[key].value).toBe(value);
      expect(specs[key].entered).toBe(true);
      expect(specs[key].dq).toContainEqual(expect.objectContaining({kind: 'out-of-range', field: key}));
    }
    expect(loadRepairs).toEqual([]);
    expect(projectFindings(project, DEFAULT_GRID)).toMatchObject({findings: [], refused: false});
  });

  it('keeps a stated zero magnet depth and derives a genuinely empty magnet depth', () => {
    const {driver, project} = openBoth({
      ...magnetGeometry,
      MagDepth_m: {state: 'E', value: 0},
    });
    for (const {specs} of [driver, project.project.driver]) {
      expect(specs.MagDepth_m.value).toBe(0);
      expect(specs.MagDepth_m.entered).toBe(true);
      expect(specs.MagDepth_m.dq).toContainEqual(expect.objectContaining({kind: 'invalid-value', value: 0}));
    }
    expect(project.loadRepairs).toEqual([]);
    expect(projectFindings(project.project, DEFAULT_GRID)).toMatchObject({findings: [], refused: false});

    const empty = openBoth({...magnetGeometry, MagDepth_m: {state: 'N'}});
    for (const {specs} of [empty.driver, empty.project.project.driver]) {
      expect(specs.MagDepth_m.value).toBeCloseTo(0.020, 12);
      expect(specs.MagDepth_m.calculated).toBe(true);
      expect(specs.MagDepth_m.dq).toEqual([]);
    }
  });

  it('keeps and flags zero and negative dimensions, with finite chart data', () => {
    const keys = ['Thick_m', 'Basket_m', 'Outer_m', 'Vcd_m', 'MagDepth_m', 'Depth_m', 'Magnet_m',
      'OuterX_m', 'OuterY_m', 'DVol_m3'] as const;
    for (const [state, value] of [['E', 0], ['E', -0.002], ['C', -0.002]] as const) {
      const entry = {state, value};
      const {driver, project} = openBoth(Object.fromEntries(keys.map(key => [key, entry])));
      for (const loaded of [driver, project.project.driver]) {
        for (const key of keys) {
          expect(loaded.toOpenIsdDeviceJson().specs.woofer[key]).toEqual(entry);
          expect(loaded.specs[key].value).toBe(value);
          expect(loaded.specs[key].dq).toContainEqual(expect.objectContaining({kind: 'invalid-value', value}));
        }
      }
      expect(project.loadRepairs).toEqual([]);
      expect(projectFindings(project.project, DEFAULT_GRID)).toMatchObject({findings: [], refused: false});
    }
  });

  it('keeps the separate saved and unsaved dimensions and flags both', async () => {
    const {session} = openingRecord({MagDepth_m: {state: 'E', value: 0}});
    const {session: {saved: edited}} = openingRecord({MagDepth_m: {state: 'E', value: 66}});
    const opened = OpenISDProject.fromOwprTextRepairing(owprTextOf({...session, edited}), engine);
    if (Array.isArray(opened)) throw new Error(opened.join('\n'));
    expect(opened.project.isModified()).toBe(true);
    expect(opened.project.cloneSession().saved.driverEmbedding.device.specs.woofer.MagDepth_m)
      .toEqual({state: 'E', value: 0});
    expect(opened.project.driver.specs.MagDepth_m.value).toBe(66);
    expect(opened.project.driver.specs.MagDepth_m.dq).toContainEqual(expect.objectContaining({kind: 'out-of-range'}));
    expect(opened.loadRepairs).toEqual([]);
    expect(projectFindings(opened.project, DEFAULT_GRID)).toMatchObject({findings: [], refused: false});

    await opened.project.cancel(async () => true);
    expect(opened.project.driver.specs.MagDepth_m.value).toBe(0);
    expect(opened.project.driver.specs.MagDepth_m.dq).toContainEqual(expect.objectContaining({kind: 'invalid-value', value: 0}));
    expect(projectFindings(opened.project, DEFAULT_GRID)).toMatchObject({findings: [], refused: false});
  });

  it('keeps the file’s dimensions marked entered through two WinISD exports', () => {
    const converter = new DriverRecordConverter(engine);
    function exportDriver(text: string) {
      const {value: driver, errors} = converter.winIsdDriverToOpenIsdDriver(text);
      if (driver === null) throw new Error(JSON.stringify(errors));
      const out = driver.toWdrIniText();
      if (out.value === null) throw new Error(JSON.stringify(out.errors));
      return out.value;
    }

    const first = exportDriver('[Driver]\r\nBrand=Test\r\nModel=Dimensions\r\nnumVC=1\r\nDepth=12\r\nMagDepth=13\r\nMagnet=14\r\n');
    const second = exportDriver(first);
    expect(second).toBe(first);
    const wdr = WinISDDriver.fromWdrIni(second);
    for (const [key, value] of [['Depth', '12'], ['MagDepth', '13'], ['Magnet', '14']]) {
      expect(wdr.cell(key)).toEqual({state: 'entered', value});
    }
  });
});
