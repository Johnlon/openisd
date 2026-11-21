import {describe, expect, it} from 'vitest';
import {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import {DriverRecordConverter} from '../../domain/driverRecordConverter.js';
import type {DriverDeviceJson, SpecEntryJson} from '../../domain/openisdSchema.js';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import {owprTextOf} from '../../domain/project/projectSerialization.js';
import {createEngine} from '../../engine/Engine.js';
import {DEFAULT_GRID, loadProject, projectFindings} from '../fixtures/inputLimitsSweep.js';

const engine = createEngine();
const zeroBasketNotice = 'Basket Diameter (Basket) 0 mm in the file: set to the 10 mm minimum';

function driverWith(driver: DriverDeviceJson, basket: SpecEntryJson): DriverDeviceJson {
  return {...driver, specs: {...driver.specs, woofer: {...driver.specs.woofer, Basket_m: basket}}};
}

describe('Basket Diameter on opening', () => {
  it('repairs a zero basket in both project layers, reports it once, and gives finite chart data', () => {
    const session = loadProject('sealed').cloneSession();
    const {saved: project} = session;
    const device = driverWith(project.driverEmbedding.device, {state: 'E', value: 0});
    const saved = {...project, driverEmbedding: {...project.driverEmbedding, device}};
    const opened = OpenISDProject.fromOwprTextRepairing(owprTextOf({...session, saved, edited: saved}), engine);
    if (Array.isArray(opened)) throw new Error(opened.join('\n'));
    const basket = opened.project.driver.specs.Basket_m;
    expect(basket.value).toBe(0.01);
    expect(basket.dq).toEqual([]);
    expect(opened.project.cloneSession().saved.driverEmbedding.device.specs.woofer.Basket_m)
      .toEqual({state: 'C', value: 0.01});
    expect(opened.loadRepairs).toEqual([expect.objectContaining({loaded: 0, repaired: 0.01, text: zeroBasketNotice})]);
    expect(opened.project.sweep(DEFAULT_GRID).values?.tfMag.length).toBeGreaterThan(0);
    expect(projectFindings(opened.project, DEFAULT_GRID)).toMatchObject({findings: [], refused: false});
  });

  it.each([['0', 0], ['-0.01', -0.01], ['1e999', Infinity]])('repairs Basket=%s from a .wdr file', (text, loaded) => {
    const {value: driver, errors} = new DriverRecordConverter(engine).winIsdDriverToOpenIsdDriver(
      `[Driver]\r\nBrand=Fixture\r\nModel=Basket\r\nnumVC=1\r\nBasket=${text}\r\n`);
    if (!driver) throw new Error(JSON.stringify(errors));
    expect(driver.specs.Basket_m.value).toBe(0.01);
    expect(driver.specs.Basket_m.dq).toEqual([]);
    expect(driver.loadRepairs).toEqual([expect.objectContaining({loaded, repaired: 0.01})]);
  });

  it('repairs an overflowing JSON number in both .owdr and .owpr files', () => {
    const session = loadProject('sealed').cloneSession();
    const device = driverWith(session.saved.driverEmbedding.device, {state: 'E', value: 1234});
    const saved = {...session.saved, driverEmbedding: {...session.saved.driverEmbedding, device}};
    const driver = OpenISDDriver.fromOwdrText(JSON.stringify(device).replace('"value":1234', '"value":1e999'), engine);
    const opened = OpenISDProject.fromOwprTextRepairing(owprTextOf({...session, saved, edited: null}).replace('"value": 1234', '"value": 1e999'), engine);
    if (Array.isArray(driver)) throw new Error(driver.join('\n'));
    if (Array.isArray(opened)) throw new Error(opened.join('\n'));
    for (const [loaded, repairs] of [[driver, driver.loadRepairs], [opened.project.driver, opened.loadRepairs]] as const) {
      expect(loaded.specs.Basket_m.value).toBe(0.01);
      expect(loaded.specs.Basket_m.dq).toEqual([]);
      expect(repairs).toEqual([expect.objectContaining({loaded: Infinity, repaired: 0.01})]);
    }
    expect(opened.repaired).toEqual([]);
  });

  it('keeps a 55 m basket from an .owpr file, warns, and still gives finite chart data', () => {
    const session = loadProject('sealed').cloneSession();
    const project = session.saved;
    const device = driverWith(project.driverEmbedding.device, {state: 'E', value: 55});
    const saved = {...project, driverEmbedding: {...project.driverEmbedding, device}};
    const opened = OpenISDProject.fromOwprTextRepairing(owprTextOf({...session, saved, edited: saved}), engine);
    if (Array.isArray(opened)) throw new Error(opened.join('\n'));
    const basket = opened.project.driver.specs.Basket_m;
    expect(basket.value).toBe(55);
    expect(basket.dq).toContainEqual(expect.objectContaining({kind: 'outside-normal-band'}));
    expect(opened.project.cloneSession().saved.driverEmbedding.device.specs.woofer.Basket_m)
      .toEqual({state: 'E', value: 55});
    expect(opened.loadRepairs).toEqual([]);
    expect(opened.project.sweep(DEFAULT_GRID).values?.tfMag.length).toBeGreaterThan(0);
    const charts = projectFindings(opened.project, DEFAULT_GRID);
    expect(charts.findings).toEqual([]);
    expect(charts.refused).toBe(false);
  });

  it('keeps the unusual basket in an old Dayton DSA115-8 record and warns', () => {
    const device = loadProject('sealed').cloneSession().saved.driverEmbedding.device;
    const dayton = {...device, brand: {value: 'Dayton Audio'}, model: {value: 'DSA115-8'}};
    const driver = OpenISDDriver.fromConformingRecord(driverWith(dayton, {state: 'E', value: 2.37744}), engine);
    if (Array.isArray(driver)) throw new Error(driver.join('\n'));
    expect(driver.specs.Basket_m.value).toBe(2.37744);
    expect(driver.specs.Basket_m.dq).toContainEqual(expect.objectContaining({kind: 'outside-normal-band'}));
  });

  it.each([0.75, 55])('keeps a %s m basket from an .owdr file with a warning', value => {
    const device = loadProject('sealed').cloneSession().saved.driverEmbedding.device;
    const driver = OpenISDDriver.fromOwdrText(JSON.stringify(driverWith(device, {state: 'E', value})), engine);
    if (Array.isArray(driver)) throw new Error(driver.join('\n'));
    expect(driver.specs.Basket_m.value).toBe(value);
    expect(driver.specs.Basket_m.dq).toContainEqual(expect.objectContaining({kind: 'outside-normal-band'}));
  });
});
