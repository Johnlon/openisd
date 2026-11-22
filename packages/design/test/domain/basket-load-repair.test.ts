import {describe, expect, it} from 'vitest';
import {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import {DriverRecordConverter} from '../../domain/driverRecordConverter.js';
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
  it('keeps a zero basket in both project layers, flags it, and gives finite chart data', () => {
    const session = loadProject('sealed').cloneSession();
    const {saved: project} = session;
    const device = driverWith(project.driverEmbedding.device, {state: 'E', value: 0});
    const saved = {...project, driverEmbedding: {...project.driverEmbedding, device}};
    const opened = OpenISDProject.fromOwprTextRepairing(owprTextOf({...session, saved, edited: saved}), engine);
    if (Array.isArray(opened)) throw new Error(opened.join('\n'));
    const basket = opened.project.driver.specs.Basket_m;
    expect(basket.value).toBe(0);
    expect(basket.dq).toContainEqual(expect.objectContaining({kind: 'invalid-value', value: 0}));
    expect(opened.project.cloneSession().saved.driverEmbedding.device.specs.woofer.Basket_m)
      .toEqual({state: 'E', value: 0});
    expect(opened.loadRepairs).toEqual([]);
    expect(opened.project.sweep(DEFAULT_GRID).values?.tfMag.length).toBeGreaterThan(0);
    expect(projectFindings(opened.project, DEFAULT_GRID)).toMatchObject({findings: [], refused: false});
  });

  it.each([['0', 0], ['-0.01', -0.01], ['1e999', Infinity]])('keeps and flags Basket=%s from a .wdr file and gives finite chart data', (text, loaded) => {
    const project = loadProject('sealed');
    project.driver.specs.Basket_m.set(0.15);
    const fixture = project.driver.toWdrIniText();
    if (fixture.value === null) throw new Error(JSON.stringify(fixture.errors));
    const {value: driver, errors} = new DriverRecordConverter(engine).winIsdDriverToOpenIsdDriver(
      fixture.value.replace(/^Basket=.*$/m, `Basket=${text}`));
    if (!driver) throw new Error(JSON.stringify(errors));
    expect(driver.specs.Basket_m.value).toBe(loaded);
    expect(driver.specs.Basket_m.dq).toContainEqual(expect.objectContaining({kind: 'invalid-value', value: loaded}));
    project.loadDriver(driver);
    expect(projectFindings(project, DEFAULT_GRID)).toMatchObject({findings: [], refused: false});
  });

  it('keeps and flags an overflowing JSON number in .owdr and .owpr files and gives finite chart data', () => {
    const session = loadProject('sealed').cloneSession();
    const device = driverWith(session.saved.driverEmbedding.device, {state: 'E', value: 1234});
    const saved = {...session.saved, driverEmbedding: {...session.saved.driverEmbedding, device}};
    const driver = OpenISDDriver.fromOwdrText(JSON.stringify(device).replace('"value":1234', '"value":1e999'), engine);
    const opened = OpenISDProject.fromOwprTextRepairing(owprTextOf({...session, saved, edited: null}).replace('"value": 1234', '"value": 1e999'), engine);
    if (Array.isArray(driver)) throw new Error(driver.join('\n'));
    if (Array.isArray(opened)) throw new Error(opened.join('\n'));
    const projectWithDriver = loadProject('sealed');
    projectWithDriver.loadDriver(driver);
    for (const project of [projectWithDriver, opened.project]) {
      expect(project.driver.specs.Basket_m.value).toBe(Infinity);
      expect(project.driver.specs.Basket_m.dq).toContainEqual(expect.objectContaining({kind: 'invalid-value', value: Infinity}));
      expect(projectFindings(project, DEFAULT_GRID)).toMatchObject({findings: [], refused: false});
    }
    expect(opened.loadRepairs).toEqual([]);
    expect(opened.repaired).toEqual([]);
    const reloaded = OpenISDProject.fromOwprText(opened.project.toOwprText(), engine);
    if (Array.isArray(reloaded)) throw new Error(reloaded.join('\n'));
    expect(reloaded.driver.specs.Basket_m.value).toBe(Infinity);
  });

  it('saves a loaded 1e999 basket as the same literal and reads it back as the same value with its warning', () => {
    const session = loadProject('sealed').cloneSession();
    const device = driverWith(session.saved.driverEmbedding.device, {state: 'E', value: 1234});
    const driver = OpenISDDriver.fromOwdrText(JSON.stringify(device).replace('"value":1234', '"value":1e999'), engine);
    if (Array.isArray(driver)) throw new Error(driver.join('\n'));
    const driverText = driver.toOwdrText();
    expect(driverText).toContain('1e999');
    expect(driverText).not.toMatch(/"Basket_m":\s*\{[^}]*null/);
    const driverAgain = OpenISDDriver.fromOwdrText(driverText, engine);
    if (Array.isArray(driverAgain)) throw new Error(driverAgain.join('\n'));
    expect(driverAgain.specs.Basket_m.value).toBe(Infinity);
    expect(driverAgain.specs.Basket_m.dq).toContainEqual(expect.objectContaining({kind: 'invalid-value', value: Infinity}));
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
