import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';
import {driverFrom, specSection} from '../fixtures/domainBuilders.js';

/** bugs/BUG_20261017_air-has-hidden-sources.md: air always comes from its owner, never from a constant in a calc. */
describe('a project switched to passive radiator uses its own air for the starting radiator', () => {
  const build = () => new ProjectBuilder(driverFrom({
    brand: 'Dayton', model: 'RS225', section: 'woofer',
    spec: specSection({Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008}),
  }), createEngine()).sealed().volume_m3(0.03).build();

  it('preserves an existing radiator Vas when air changes before the type switch', () => {
    const project = build();
    project.box.passiveRadiator.radiator.spec.Vas_m3.set(0.0123);
    project.envTempK.set(330);
    project.envPressurePa.set(90000);
    project.box.boxType.set('box-passive-radiator');
    expect(project.box.passiveRadiator.radiator.spec.Vas_m3.value).toBe(0.0123);
  });

  it('the starting Vas follows the project air: Vas = Cms·Sd²·ρ·c² in that air', () => {
    const factory = build();
    // New projects already contain the complete dummy. Clear the value being seeded so
    // this checks starting-value air ownership rather than overwriting an existing value.
    factory.box.passiveRadiator.radiator.spec.Vas_m3.clear();
    factory.box.boxType.set('box-passive-radiator');
    const factoryVas = factory.box.passiveRadiator.radiator.spec.Vas_m3.value;

    const hot = build();
    hot.envTempK.set(330);
    hot.envPressurePa.set(90000);
    hot.box.passiveRadiator.radiator.spec.Vas_m3.clear();
    hot.box.boxType.set('box-passive-radiator');
    const hotVas = hot.box.passiveRadiator.radiator.spec.Vas_m3.value;

    expect(factoryVas).not.toBeNull();
    expect(hotVas).not.toBeNull();
    expect(hotVas).not.toBeCloseTo(factoryVas ?? 0, 6);
  });
});

describe('a .wpr export carries the project\'s own air', () => {
  it('writes the project\'s T, p and phi, not WinISD\'s template values', () => {
    const p = new ProjectBuilder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008}),
    }), createEngine()).sealed().volume_m3(0.03).build();
    p.envTempK.set(300.15);
    p.envPressurePa.set(95000);
    p.envHumidityPct.set(55);

    const out = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(p);
    const text = out.value?.toWpr() ?? '';

    expect(text).toMatch(/^T=300\.15$/m);
    expect(text).toMatch(/^p=95000$/m);
    expect(text).toMatch(/^phi=0\.55$/m);
  });
});
