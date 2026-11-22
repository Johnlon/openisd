/**
 * The Driver tab's "Driver wiring" row (ticket 519, plan sections 3.1 and 3.2): drawn only with 2 or more drivers, Parallel by
 * default, writes the project's wiring only; the Advanced switch "Impedance of one driver" applies from 2 drivers.
 */
import {describe, expect, it} from 'vitest';
import {computed} from 'vue';
import {OpenISDDriver, ProjectBuilder} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import {readFileSync} from 'node:fs';
import {useDriverWiring} from '../../src/hooks/DriverWiring-hooks.js';
import {runHook} from './runHook.js';
import {testAppLogic} from './testAppLogic.js';

function hookFor(nDrivers: number) {
  const logic = testAppLogic();
  const driver = OpenISDDriver.fromOwdrText(readFileSync('packages/ui/public/drivers/dayton-audio/da215-8.json', 'utf8'), createEngine());
  if (Array.isArray(driver)) throw new Error(driver.join('; '));
  const project = new ProjectBuilder(driver, logic.appState.engine).sealed().volume_m3(0.16).build();
  project.nDrivers.set(nDrivers);
  logic.appState.addProject(project);
  return {project, wiring: runHook(computed(() => project), () => useDriverWiring(), logic)};
}

describe('useDriverWiring', () => {
  it('1 driver: the row is not drawn', () => {
    expect(hookFor(1).wiring.shown.value).toBe(false);
  });

  it('4 drivers: drawn, Parallel first and by default, then Series', () => {
    const {wiring} = hookFor(4);
    expect(wiring.shown.value).toBe(true);
    expect(wiring.mine.value).toBe('parallel');
    expect(wiring.options.map(o => o.label)).toEqual(['Parallel', 'Series']);
  });

  it('choosing Series writes the project and the row follows; the count going 4 to 1 to 4 keeps it', () => {
    const {project, wiring} = hookFor(4);
    wiring.choose('series');
    expect(project.driverWiring.value).toBe('series');
    expect(wiring.mine.value).toBe('series');
    project.nDrivers.set(1);
    expect(wiring.shown.value).toBe(false);
    project.nDrivers.set(4);
    expect(wiring.shown.value).toBe(true);
    expect(wiring.mine.value).toBe('series');
  });
});
