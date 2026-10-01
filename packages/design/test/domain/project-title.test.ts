/**
 * `OpenISDProject.title()` — the name a layout shows for a project: its own name, else its
 * driver's brand and model. The mobile top bar shows the focused project's title (John, 2026-10-01).
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/index.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

const engine = createEngine();
function project() {
  const driver = driverFromSpec(engine, {Fs_hz: 30, Qes: 0.4, Qms: 4, Sd_m2: 0.02, Cms_m_per_N: 0.0005});
  driver.brand.set('SB Acoustics');
  driver.model.set('SB17');
  return new ProjectBuilder(driver, engine).sealed().volume_m3(0.03).build();
}

describe('OpenISDProject.title', () => {
  it('is the project name when it has one', () => {
    const p = project();
    p.name.set('Living room sub');
    expect(p.title()).toBe('Living room sub');
  });

  it('falls back to the driver brand and model', () => {
    const p = project();
    p.name.set('');
    expect(p.title()).toBe('SB Acoustics SB17');
  });
});
