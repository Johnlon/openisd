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
  it('repairs an impossible embedded value once, clears its flag and still draws charts', () => {
    const session = loadProject('sealed').cloneSession();
    const project = session.saved;
    const device = driverWith(project.driverEmbedding.device, {state: 'E', value: 2.37744});
    const saved = {...project, driverEmbedding: {...project.driverEmbedding, device}};
    const opened = OpenISDProject.fromOwprTextRepairing(owprTextOf({...session, saved, edited: saved}), engine);
    if (Array.isArray(opened)) throw new Error(opened.join('\n'));
    const basket = opened.project.driver.specs.Basket_m;
    expect(basket.value).toBe(0.01);
    expect(basket.dq).toEqual([]);
    expect(opened.loadRepairs).toEqual([expect.objectContaining({
      loaded: 2.37744, repaired: 0.01,
      text: 'Basket Diameter (Basket) 2377.44 mm in the file: set to the 10 mm minimum',
    })]);
    const charts = projectFindings(opened.project, DEFAULT_GRID);
    expect(charts.findings).toEqual([]);
    expect(charts.refused).toBe(false);
  });

  it('applies the general basket repair to an old Dayton DSA115-8 record', () => {
    const device = loadProject('sealed').cloneSession().saved.driverEmbedding.device;
    const dayton = {...device, brand: {value: 'Dayton Audio'}, model: {value: 'DSA115-8'}};
    const driver = OpenISDDriver.fromConformingRecord(driverWith(dayton, {state: 'E', value: 2.37744}), engine);
    if (Array.isArray(driver)) throw new Error(driver.join('\n'));
    expect(driver.specs.Basket_m.value).toBe(0.01);
    expect(driver.specs.Basket_m.dq).toEqual([]);
    expect(driver.loadRepairs.map(repair => repair.repaired)).toEqual([0.01]);
  });

  it('keeps an odd but possible value from a standalone driver file with a warning', () => {
    const device = loadProject('sealed').cloneSession().saved.driverEmbedding.device;
    const driver = OpenISDDriver.fromOwdrText(JSON.stringify(driverWith(device, {state: 'E', value: 0.75})), engine);
    if (Array.isArray(driver)) throw new Error(driver.join('\n'));
    expect(driver.specs.Basket_m.value).toBe(0.75);
    expect(driver.specs.Basket_m.dq).toContainEqual(expect.objectContaining({kind: 'outside-normal-band'}));
    expect(driver.loadRepairs).toEqual([]);
  });
});
