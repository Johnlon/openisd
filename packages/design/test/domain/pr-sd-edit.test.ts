/**
 * bugs/BUG_20261003_winisd-pr-sd-edit-ignored.md: WinISD ignores a typed passive radiator Sd.
 * In OpenISD a typed Sd takes effect: PR excursion and PR velocity scale as 1/Sd.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {OpenISDPassiveRadiatorStandalone, ProjectBuilder} from '../../domain/index.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

const nd140Path = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'ui', 'public', 'drivers', 'dayton-audio', 'nd140-pr.json');

describe('passive radiator Sd edit', () => {
  it('doubling Sd halves PR excursion and PR velocity, at the same frequency', () => {
    const engine = createEngine();
    const driver = driverFromSpec(engine, {
      Fs_hz: 30, Qes: 0.4, Qms: 4, Qts: 1 / (1 / 4 + 1 / 0.4), Re_ohm: 6.4,
      Sd_m2: 0.02, Cms_m_per_N: 0.0005, Vas_m3: 0.05, BL_Tm: 8, Mms_kg: 0.05, Xmax_m: 0.008, Pe_W: 100,
    });
    const project = new ProjectBuilder(driver, engine).sealed().volume_m3(0.03).build();
    project.powerDrive_W.set(1);
    project.box.boxType.set('box-passive-radiator');
    const nd140: unknown = JSON.parse(readFileSync(nd140Path, 'utf8'));
    const radiator = OpenISDPassiveRadiatorStandalone.fromConformingRecord(nd140);
    if (Array.isArray(radiator)) throw new Error(`ND140-PR is invalid: ${radiator.join(', ')}`);
    project.box.passiveRadiator.configurePR(radiator);
    project.box.passiveRadiator.count.set(1);
    project.box.passiveRadiator.losses.Ql.set(7);
    project.box.passiveRadiator.losses.Qa.set(30);

    const grid = {fmin: 10, fmax: 1000, N: 50};
    const before = project.sweep(grid).values;
    project.box.passiveRadiator.radiator.spec.Sd_m2.set(project.box.passiveRadiator.radiator.spec.Sd_m2.value! * 2);
    const after = project.sweep(grid).values;
    if (before === null || after === null) throw new Error('sweep did not run');

    expect(after.fs).toEqual(before.fs);
    const i = before.excPR.indexOf(Math.max(...before.excPR));
    expect(before.excPR[i]).toBeGreaterThan(0);
    expect(before.pv[i]).toBeGreaterThan(0);
    expect(after.excPR[i]).toBeCloseTo(before.excPR[i]! / 2, 9);
    expect(after.pv[i]).toBeCloseTo(before.pv[i]! / 2, 9);
  });
});
