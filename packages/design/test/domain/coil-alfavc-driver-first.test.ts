/**
 * T917, John's ruling QO953.c16 ("a"): the voice-coil temperature coefficient AlfaVC the sums heat Re with is the
 * DRIVER's when the driver's is not 0, else the project's (0.0039 /K by default). AlfaVC belongs to the coil wire's
 * metal (copper 0.00393 /K, aluminium about 0.0041-0.0043 /K); the temperature rise dTVC stays the project's.
 *
 * The WinISD bug switch "Coil coefficient from project" (`winisdProjectAlfaVC`) gives WinISD's sum back: the
 * project's value only. WinISD 0.7.0 and 0.50a7 both read only the project's `[Box] alfaVC`
 * (winisd_research/runs/s04-dtvc-20261118/, winisd_research/0.50a7/runs/050a7/coil-alfavc-20261118/).
 *
 * Every catalogue driver and every held .wdr stores alfaVC 0, so their results do not move (QO953.c17).
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import type {FrequencyGrid} from '../../domain/box/frequencyGrid.js';
import {DriverRecordConverter} from '../../domain/driverRecordConverter.js';
import type {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {CompatSwitch} from '../../domain/project/compatSwitch.js';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import {WinisdDeviation} from '../../fields/winisdDeviation.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

const engine = createEngine();
const here = dirname(fileURLToPath(import.meta.url));

function w5(driverAlfaVC_per_K: number, Re_ohm: number): OpenISDDriver {
  return driverFromSpec(engine, {
    Fs_hz: 45, Qes: 0.57, Qms: 3.56, Qts: 0.49, Re_ohm, Vas_m3: 0.00485, Sd_m2: 0.0094,
    BL_Tm: 7.17, Mms_kg: 0.02881, Cms_m_per_N: 0.00036872, Rms_kg_per_s: 2.2881560650261163, Xmax_m: 0.00925, Pe_W: 40,
    alfaVC_per_K: driverAlfaVC_per_K,
  });
}

function sealedProjectOf(driver: OpenISDDriver, projectAlfaVC_per_K: number, vcTempRise_K: number): OpenISDProject {
  const p = new ProjectBuilder(driver, engine).sealed().volume_m3(0.00448).build();
  p.Rs_ohm.set(0.1);
  p.box.sealed.losses.Ql.set(10);
  p.box.sealed.losses.Qa.set(100);
  p.nDrivers.set(1);
  p.alfaVC_per_K.set(projectAlfaVC_per_K);
  p.vcTempRise_K.set(vcTempRise_K);
  p.powerDrive_W.set(1);
  return p;
}

/** The Re the project's sums heat the coil to: the driver's Re at the project's coil temperature rise. */
function hotRe(p: OpenISDProject): number | null {
  const load = p.driveLoad;
  return p.driver.hotRe_ohm(load.alfaVC_per_K, load.vcTempRise_K);
}

describe('the engine chooses the coil coefficient (QO953.c16)', () => {
  it('the driver\'s when it is not 0', () => {
    expect(engine.driver.coilAlfaVC_per_K(0.0042, 0.0039, false)).toBe(0.0042);
  });
  it('the project\'s when the driver\'s is 0 or not stated', () => {
    expect(engine.driver.coilAlfaVC_per_K(0, 0.0039, false)).toBe(0.0039);
    expect(engine.driver.coilAlfaVC_per_K(null, 0.0039, false)).toBe(0.0039);
  });
  it('the project\'s for a negative driver value, which no coil metal has (input-limits sweep: driver AlfaVC -1)', () => {
    expect(engine.driver.coilAlfaVC_per_K(-1, 0.0039, false)).toBe(0.0039);
  });
  it('the project\'s only, whatever the driver says, with the WinISD switch ticked', () => {
    expect(engine.driver.coilAlfaVC_per_K(0.0042, 0.0039, true)).toBe(0.0039);
    expect(engine.driver.coilAlfaVC_per_K(0, 0.0039, true)).toBe(0.0039);
  });
});

describe('a driver that states its own AlfaVC heats with it', () => {
  it('driver 0.0042, project 0.0039, dTVC 100, Re 3.2: hot Re 4.544 with the switch off', () => {
    const p = sealedProjectOf(w5(0.0042, 3.2), 0.0039, 100);
    expect(p.winisdProjectAlfaVC.value).toBe(false);
    expect(hotRe(p)!).toBeCloseTo(4.544, 9);
  });

  it('the same, ticked: WinISD\'s hot Re 4.448 from the project\'s 0.0039', () => {
    const p = sealedProjectOf(w5(0.0042, 3.2), 0.0039, 100);
    p.winisdProjectAlfaVC.set(true);
    expect(hotRe(p)!).toBeCloseTo(4.448, 9);
  });

  it('the sealed Box readout heats with the driver\'s value: driver 0.0039, project 0, dTVC 100 reads WinISD\'s hot Qtc 0.920', () => {
    // WinISD (runs/s04-dtvc-20261118): this project reads the cold 0.719 there, because WinISD reads the project's 0 only.
    const p = sealedProjectOf(w5(0.0039, 3.4), 0, 100);
    p.winisdChartFromFsVasQms.set(true);
    expect(p.box.sealed.q_tc.value!).toBeCloseTo(0.920, 3);
    expect(p.box.sealed.resonance_hz.value!).toBeCloseTo(66.64, 2);
    p.winisdProjectAlfaVC.set(true);
    expect(p.box.sealed.q_tc.value!).toBeCloseTo(0.719, 3);
    expect(p.box.sealed.resonance_hz.value!).toBeCloseTo(67.23, 2);
  });

  it('the charts heat with the same value as the readout: the driver\'s 0.0042 draws as a project 0.0042 with a 0 driver', () => {
    const grid: FrequencyGrid = {fmin: 10, fmax: 400, N: 200};
    const drivers = sealedProjectOf(w5(0.0042, 3.2), 0.0039, 100).sweep(grid).values!;
    const projects = sealedProjectOf(w5(0, 3.2), 0.0042, 100).sweep(grid).values!;
    const winisd = sealedProjectOf(w5(0.0042, 3.2), 0.0039, 100);
    winisd.winisdProjectAlfaVC.set(true);
    const winisdValues = winisd.sweep(grid).values!;
    const coolerProject = sealedProjectOf(w5(0, 3.2), 0.0039, 100).sweep(grid).values!;
    for (let i = 0; i < drivers.fs.length; i += 20) {
      expect(drivers.tfMag[i]!).toBeCloseTo(projects.tfMag[i]!, 9);
      expect(drivers.zmag[i]!).toBeCloseTo(projects.zmag[i]!, 9);
      expect(winisdValues.zmag[i]!).toBeCloseTo(coolerProject.zmag[i]!, 9);
    }
    // and the two coefficients do draw differently, so the comparisons above are not empty
    expect(Math.abs(drivers.zmag[0]! - winisdValues.zmag[0]!)).toBeGreaterThan(0.05);
  });

  it('a power typed in gives the voltage of the driver\'s hot Re', () => {
    const drivers = sealedProjectOf(w5(0.0042, 3.2), 0.0039, 100);
    const projects = sealedProjectOf(w5(0, 3.2), 0.0042, 100);
    expect(drivers.driveVoltage_V.value!).toBeCloseTo(projects.driveVoltage_V.value!, 9);
    const winisd = sealedProjectOf(w5(0.0042, 3.2), 0.0039, 100);
    winisd.winisdProjectAlfaVC.set(true);
    expect(winisd.driveVoltage_V.value!).not.toBeCloseTo(drivers.driveVoltage_V.value!, 3);
  });
});

describe('a driver with AlfaVC 0 (every catalogue driver) is unchanged', () => {
  it.each([false, true])('driver 0, project 0.0039, dTVC 100, Re 3.2: hot Re 4.448 (switch %s)', (ticked) => {
    const p = sealedProjectOf(w5(0, 3.2), 0.0039, 100);
    p.winisdProjectAlfaVC.set(ticked);
    expect(hotRe(p)!).toBeCloseTo(4.448, 9);
  });

  it('a .wdr with alfaVC=0 (Dayton E150HE-44, Re 6.6) heats with the project\'s 0.0039: hot Re 9.174, as before', () => {
    const text = readFileSync(join(here, '..', '..', '..', '..', 'docs', 'samples', 'sample_drive_Dayton_Audio_Epique_E150HE-44.wdr'), 'utf8');
    const imported = new DriverRecordConverter(engine).winIsdDriverToOpenIsdDriver(text);
    if (imported.value === null) throw new Error(imported.errors.map(e => e.message).join('; '));
    expect(imported.value.specs.alfaVC_per_K.value ?? 0).toBe(0);
    for (const ticked of [false, true]) {
      const p = new ProjectBuilder(imported.value, engine).sealed().volume_m3(0.006).build();
      p.alfaVC_per_K.set(0.0039);
      p.vcTempRise_K.set(100);
      p.winisdProjectAlfaVC.set(ticked);
      expect(hotRe(p)!).toBeCloseTo(6.6 * (1 + 0.0039 * 100), 9);
    }
  });
});

describe('"Coil coefficient from project" (winisdProjectAlfaVC)', () => {
  it('is an unticked bug switch in a new project', () => {
    expect(sealedProjectOf(w5(0, 3.2), 0.0039, 0).winisdProjectAlfaVC.value).toBe(false);
    expect(CompatSwitch.PROJECT_ALFAVC.kind).toBe('bug');
    expect(CompatSwitch.PROJECT_ALFAVC.winisdValue).toBe(false);
    expect(CompatSwitch.PROJECT_ALFAVC.field.label).toBe('Coil coefficient from project');
  });

  it('is saved with the project', () => {
    const p = sealedProjectOf(w5(0.0042, 3.2), 0.0039, 100);
    p.winisdProjectAlfaVC.set(true);
    const back = OpenISDProject.fromOwprText(p.toOwprText(), engine);
    if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
    expect(back.winisdProjectAlfaVC.value).toBe(true);
  });

  it('a file that does not say loads it unticked (OpenISD\'s sum)', () => {
    const p = sealedProjectOf(w5(0.0042, 3.2), 0.0039, 100);
    const text = p.toOwprText();
    expect(text).not.toContain('winisdProjectAlfaVC');
    const back = OpenISDProject.fromOwprText(text, engine);
    if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
    expect(back.winisdProjectAlfaVC.value).toBe(false);
    expect(hotRe(back)!).toBeCloseTo(4.544, 9);
  });

  it('applies, and its ≠W cue shows, only where it changes a sum: a hot coil and a driver AlfaVC other than the project\'s', () => {
    const differs = sealedProjectOf(w5(0.0042, 3.2), 0.0039, 100);
    expect(differs.errorSwitches.projectAlfaVC).toEqual({marked: true, applicable: true, inScope: true, reproducesError: false});
    expect(WinisdDeviation.PROJECT_ALFAVC.cueShown(differs.errorSwitches)).toBe(true);
    differs.winisdProjectAlfaVC.set(true);
    expect(WinisdDeviation.PROJECT_ALFAVC.cueShown(differs.errorSwitches)).toBe(false);

    for (const p of [sealedProjectOf(w5(0, 3.2), 0.0039, 100), sealedProjectOf(w5(0.0042, 3.2), 0.0039, 0), sealedProjectOf(w5(0.0039, 3.2), 0.0039, 100)]) {
      expect(p.errorSwitches.projectAlfaVC.applicable).toBe(false);
      expect(WinisdDeviation.PROJECT_ALFAVC.cueShown(p.errorSwitches)).toBe(false);
    }
  });
});
