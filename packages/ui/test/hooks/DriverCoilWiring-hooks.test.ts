/**
 * The Driver tab's "Measured wiring" / "My wiring" rows (QO907, issue 512). Dayton MX6-22: measured
 * in series, Re 4.7 Ω, BL 12.3 T·m, 2 coils (datasheet); in parallel Re 1.175 Ω, BL 6.15 T·m
 * (Re ÷ 4, BL ÷ 2). Bliesma W137A-854-4 states no wiring.
 */
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {computed} from 'vue';
import {OpenISDDriver, ProjectBuilder} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import {useDriverCoilWiring} from '../../src/hooks/DriverCoilWiring-hooks.js';
import {runHook} from './runHook.js';
import {testAppLogic} from './testAppLogic.js';

function hookFor(path: string) {
  const logic = testAppLogic();
  const driver = OpenISDDriver.fromOwdrText(readFileSync(`packages/ui/public/drivers/${path}.json`, 'utf8'), createEngine());
  if (Array.isArray(driver)) throw new Error(driver.join('; '));
  const project = new ProjectBuilder(driver, logic.appState.engine).sealed().volume_m3(0.03).build();
  logic.appState.addProject(project);
  return {project, wiring: runHook(computed(() => project), () => useDriverCoilWiring(), logic)};
}

describe('useDriverCoilWiring', () => {
  it('MX6-22: shows the stated measured wiring, My wiring equal to it, both figure lines, and is enabled', () => {
    const {wiring} = hookFor('dayton-audio/mx6-22');
    expect(wiring.shown.value).toBe(true);
    expect(wiring.measuredText.value).toBe('Series (stated)');
    expect(wiring.mine.value).toBe('series');
    expect(wiring.disabled.value).toBe(false);
    expect(wiring.publishedFigures.value).toBe('Re 4.70 Ω · BL 12.30 Tm');
    expect(wiring.mineFigures.value).toBe('Re 4.70 Ω · BL 12.30 Tm');
    expect(wiring.options.value.map(o => o.value)).toEqual(['series', 'parallel']);
  });

  it('choosing parallel writes the project and shows the converted figures', () => {
    const {project, wiring} = hookFor('dayton-audio/mx6-22');
    wiring.choose('parallel');
    expect(project.coilWiring.mine).toBe('parallel');
    expect(wiring.mine.value).toBe('parallel');
    expect(wiring.mineFigures.value).toBe('Re 1.175 Ω · BL 6.15 Tm');
    expect(wiring.publishedFigures.value).toBe('Re 4.70 Ω · BL 12.30 Tm');
  });

  it('Bliesma W137A-854-4: wiring not stated, the choice is disabled and says why', () => {
    const {wiring} = hookFor('bliesma/w137a-854-4');
    expect(wiring.shown.value).toBe(true);
    expect(wiring.measuredText.value).toBe('Not stated');
    expect(wiring.disabled.value).toBe(true);
    expect(wiring.reason.value).toContain('not stated');
  });

  it('a single-coil driver shows nothing', () => {
    const {wiring} = hookFor('dayton-audio/ce28m-4');
    expect(wiring.shown.value).toBe(false);
  });
});
