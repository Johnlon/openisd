/**
 * `.wpr` project export writes the figures in the user's wiring with that wiring (QO907, plan A4):
 * a project of the series-measured Dayton MX6-22 (Re 4.7 Ω, BL 12.3 T·m, Le 1.5 mH, Znom 4 Ω) set to
 * parallel writes Re 1.175, BL 6.15, Le 0.375 mH, Znom 1 and VCCon parallel (code 1). A project that
 * kept the measured wiring writes the published figures with VCCon series (code 2). The saved
 * driver (`.wdr`) keeps the published figures with the measured wiring.
 */
import {describe, expect, it} from 'vitest';
import {WinISDDriver} from '@openisd/design/winisd';
import {createEngine} from '../../engine/Engine.js';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';
import {VoiceCoilWiring} from '../../domain/voiceCoilWiring.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';
import type {OpenISDProject} from '../../domain/project/openISDProject.js';

const MX6_22 = {
  Fs_hz: 30, Mms_kg: 0.0638, Cms_m_per_N: 0.00044, Sd_m2: 0.0214, Qms: 3.2,
  numVC: 2, VCCon: VoiceCoilWiring.Series, Re_ohm: 4.7, BL_Tm: 12.3, Le_H: 0.0015, Znom_ohm: 4,
};

function project(): OpenISDProject {
  const engine = createEngine();
  return new ProjectBuilder(driverFromSpec(engine, MX6_22), engine).sealed().volume_m3(0.03).build();
}

function driverOfWpr(p: OpenISDProject): WinISDDriver {
  const {value, errors} = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(p);
  if (value === null) throw new Error(errors.map(e => e.message).join('; '));
  return WinISDDriver.fromWdrIni(value.driverWdrText());
}

describe('.wpr export and Coil wiring', () => {
  it('the measured wiring kept: published figures, VCCon series', () => {
    const w = driverOfWpr(project());
    expect(w.cell('Re').value).toBe('4.7');
    expect(w.cell('BL').value).toBe('12.3');
    expect(w.cell('VCCon').value).toBe('2');
  });

  it('parallel chosen: Re 1.175, BL 6.15, Le 0.000375, Znom 1, VCCon parallel (1)', () => {
    const p = project();
    p.coilWiring.choose('parallel');
    const w = driverOfWpr(p);
    expect(Number(w.cell('Re').value)).toBeCloseTo(1.175, 9);
    expect(Number(w.cell('BL').value)).toBeCloseTo(6.15, 9);
    expect(Number(w.cell('Le').value)).toBeCloseTo(0.000375, 12);
    expect(Number(w.cell('Znom').value)).toBeCloseTo(1, 9);
    expect(w.cell('VCCon').value).toBe('1');
    expect(w.cell('VCCon').state).toBe('entered');
  });

  it('importing that .wpr gives a driver whose figures and wiring are the ones written, and the same Qes', () => {
    const p = project();
    p.coilWiring.choose('parallel');
    const converter = new WinIsdProjectConverter(createEngine());
    const {value} = converter.openIsdProjectToWinIsdProject(p);
    const {value: back} = converter.winIsdProjectToOpenIsdProject(value!.toWpr());
    expect(back!.driver.specs.Re_ohm.value).toBeCloseTo(1.175, 9);
    expect(back!.driver.specs.VCCon.value).toBe('parallel');
    expect(back!.coilWiring.mine).toBe('parallel');
    expect(back!.driver.specs.Qes.value).toBeCloseTo(p.driver.specs.Qes.value!, 6);
  });

  it('the driver on its own still exports the published figures with the measured wiring', () => {
    const p = project();
    p.coilWiring.choose('parallel');
    const out = p.driver.toWdrIniText();
    const w = WinISDDriver.fromWdrIni(out.value!);
    expect(w.cell('Re').value).toBe('4.7');
    expect(w.cell('VCCon').value).toBe('2');
  });
});
