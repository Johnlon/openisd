/**
 * The Driver tab's "My wiring" row; no measured-wiring row (QO941) (QO907, issue 512). Dayton MX6-22: measured
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
  it('MX6-22: My wiring equal to the measured wiring, no separate published line, enabled', () => {
    const {wiring} = hookFor('dayton-audio/mx6-22');
    expect(wiring.shown.value).toBe(true);
    expect('measuredText' in wiring).toBe(false);
    expect(wiring.showPublished.value).toBe(false);
    expect(wiring.mine.value).toBe('series');
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
    expect(wiring.showPublished.value).toBe(true);
    expect(wiring.publishedFigures.value).toBe('Re 4.70 Ω · BL 12.30 Tm');
  });

  it('Bliesma W137A-854-4: wiring not stated, so nothing is drawn (the data-quality mark in the editor is the only sign)', () => {
    const {wiring} = hookFor('bliesma/w137a-854-4');
    expect(wiring.shown.value).toBe(false);
    expect('disabled' in wiring).toBe(false);
    expect('reason' in wiring).toBe(false);
  });

  it('a single-coil driver shows nothing', () => {
    const {wiring} = hookFor('dayton-audio/ce28m-4');
    expect(wiring.shown.value).toBe(false);
  });
});
