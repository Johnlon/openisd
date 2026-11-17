/**
 * The Driver tab's "Coil wiring" row; no measured-wiring row (QO941) (QO907, issue 512). Dayton MX6-22: measured
 * in series, Re 4.7 Ω, BL 12.3 T·m, 2 coils (datasheet); in parallel Re 1.175 Ω, BL 6.15 T·m
 * (Re ÷ 4, BL ÷ 2). Dayton SD215A-88 (2 coils) states no wiring.
 */
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {computed} from 'vue';
import {OpenISDDriver, ProjectBuilder} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import {useDriverCoilWiring} from '../../src/hooks/DriverCoilWiring-hooks.js';
import {runHook} from './runHook.js';
import {testAppLogic} from './testAppLogic.js';

function hookFor(path: string, phone = true) {
  const logic = testAppLogic();
  const driver = OpenISDDriver.fromOwdrText(readFileSync(`packages/ui/public/drivers/${path}.json`, 'utf8'), createEngine());
  if (Array.isArray(driver)) throw new Error(driver.join('; '));
  const project = new ProjectBuilder(driver, logic.appState.engine).sealed().volume_m3(0.03).build();
  logic.appState.addProject(project);
  return {project, wiring: runHook(computed(() => project), () => useDriverCoilWiring(phone), logic)};
}

describe('useDriverCoilWiring', () => {
  it('MX6-22: Coil wiring equal to the driver own wiring, enabled', () => {
    const {wiring} = hookFor('dayton-audio/mx6-22');
    expect(wiring.shown.value).toBe(true);
    expect(wiring.disabled.value).toBe(false);
    expect(wiring.mine.value).toBe('series');
    expect(wiring.options.value.map(o => o.value)).toEqual(['series', 'parallel']);
  });

  it('choosing parallel writes the project; the stored figures stay', () => {
    const {project, wiring} = hookFor('dayton-audio/mx6-22');
    wiring.choose('parallel');
    expect(project.coilWiring.mine).toBe('parallel');
    expect(wiring.mine.value).toBe('parallel');
    expect(project.coilWiring.atMine.Re_ohm).toBeCloseTo(1.175, 9);
    expect(project.driver.specs.Re_ohm.value).toBeCloseTo(4.7, 9);
  });

  it('Dayton SD215A-88 (2 coils): wiring not stated: omitted on the phone, greyed on the desktop with its own message (QO942.c90, c91)', () => {
    expect(hookFor('dayton-audio/sd215a-88', true).wiring.shown.value).toBe(false);
    const desktop = hookFor('dayton-audio/sd215a-88', false).wiring;
    expect(desktop.shown.value).toBe(true);
    expect(desktop.disabled.value).toBe(true);
    expect(desktop.message.value).toBeNull();
    desktop.explain();
    expect(desktop.message.value).toBe('The datasheet does not say how the coils were wired when measured, so the wiring cannot be changed. The figures are used as published.');
  });

  it('a one-coil or no-coil-count driver: nothing on the phone, the control greyed on the desktop as in WinISD (QO941)', () => {
    expect(hookFor('dayton-audio/ce28m-4', true).wiring.shown.value).toBe(false);
    const desktop = hookFor('dayton-audio/ce28m-4', false).wiring;
    expect(desktop.shown.value).toBe(true);
    expect(desktop.disabled.value).toBe(true);
    expect(desktop.mine.value).toBe('parallel');
  });
});
