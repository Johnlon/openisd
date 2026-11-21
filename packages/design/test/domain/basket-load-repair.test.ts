import {describe, expect, it} from 'vitest';
import {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import type {DriverDeviceJson, SpecEntryJson} from '../../domain/openisdSchema.js';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import {owprTextOf} from '../../domain/project/projectSerialization.js';
import {createEngine} from '../../engine/Engine.js';
import {DEFAULT_GRID, loadProject, projectFindings} from '../fixtures/inputLimitsSweep.js';

const engine = createEngine();

function driverWith(driver: DriverDeviceJson, basket: SpecEntryJson): DriverDeviceJson {
  return {...driver, specs: {...driver.specs, woofer: {...driver.specs.woofer, Basket_m: basket}}};
}

describe('Basket Diameter on opening', () => {
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
