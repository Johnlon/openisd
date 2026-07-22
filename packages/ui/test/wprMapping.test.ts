/**
 * buildWprInput — maps OpenISD's live design (state.box/state.P + the derived driver) to
 * the WprInput shape @openisd/winisd's toWpr() serializes. Pure glue: it calls INTO the
 * engine's existing alignment/PR formulas (sealedFc, tuningFromLength, prTuning, prVas,
 * prQms, prFsWithMass) rather than re-deriving box tuning itself — no physics duplicated
 * here (ARCHITECTURE.md: utils/ has no physics; packages/engine/src/ does).
 */
import { describe, it, expect } from 'vitest';
import { sealedFc, tuningFromLength, prTuning, prVas, prQms, prFsWithMass } from '@openisd/engine';
import { buildWprInput } from '../src/utils/wprMapping.js';
import type { UiParams, ProjectMeta } from '../src/types.js';
import type { Driver } from '@openisd/engine';

const P_DEFAULTS: UiParams = {
  Vb: 0.030, Vf: 0.015, ventD: 0.05, ventL: 0.10, Ql: 10, Qa: 100, Qp: 100,
  nDrivers: 1, wiring: 'parallel', Pin: 40, Rs: 0.1,
  prName: 'Custom PR', prSd: 0.0095, prNum: 1, prMmd: 0.010, prMadd: 0,
  prCms: 0.0008, prRms: 1.0, prXmax: 0.012, prMode: 'winisd',
  fmin: 1, fmax: 20000, N: 400, circuitModel: 'winisd', filters: [],
  vcTempRise: 0, alfaVC: 0.0039, driverAddedMass: 0, endCorrection: 0.732,
};

const DRIVER: Driver = { Fs: 37, Qts: 0.38, Qes: 0.40, Qms: 7.0, Vas: 0.030, Sd: 0.0133, Re: 5.6 } as Driver;

const PROJECT: ProjectMeta = { name: 'x', creator: 'johnl', created: '', modified: '', description: '' };

const NOW = new Date('2026-07-22T12:00:00Z');
const DRIVER_SECTION = '[Driver]\nBrand=Test\nModel=Unit\nParState=EEEEEE';

describe('buildWprInput — box-type mapping to WinISD BType + [Box] physics', () => {
  it('sealed → BType 0, Fr = sealedFc(driver, Vb), no ports', () => {
    const input = buildWprInput('sealed', P_DEFAULTS, DRIVER, DRIVER_SECTION, PROJECT, NOW);
    expect(input.box.bType).toBe(0);
    expect(input.box.Vr).toBe(P_DEFAULTS.Vb);
    expect(input.box.Fr).toBe(sealedFc(DRIVER, P_DEFAULTS.Vb));
    expect(input.box.SdRear ?? 0).toBe(0);
    expect(input.box.SdFront ?? 0).toBe(0);
    expect(input.box.npr).toBeUndefined();
    expect(input.pr).toBeFalsy();
  });

  it('vented → BType 1, Fr from port physics via tuningFromLength, Sdrport = port area', () => {
    const input = buildWprInput('vented', P_DEFAULTS, DRIVER, DRIVER_SECTION, PROJECT, NOW);
    const Sp = Math.PI * (P_DEFAULTS.ventD / 2) ** 2;
    expect(input.box.bType).toBe(1);
    expect(input.box.Fr).toBe(tuningFromLength(P_DEFAULTS.Vb, P_DEFAULTS.ventL, Sp, P_DEFAULTS.endCorrection));
    expect(input.box.SdRear).toBeCloseTo(Sp, 12);
    expect(input.ventRear?.dia).toBe(P_DEFAULTS.ventD);
    expect(input.ventRear?.len).toBe(P_DEFAULTS.ventL);
  });

  it('bandpass4 → BType 2, rear = sealed (sealedFc on Vb), front = vented (tuningFromLength on Vf)', () => {
    const input = buildWprInput('bandpass4', P_DEFAULTS, DRIVER, DRIVER_SECTION, PROJECT, NOW);
    const Sp = Math.PI * (P_DEFAULTS.ventD / 2) ** 2;
    expect(input.box.bType).toBe(2);
    expect(input.box.Fr).toBe(sealedFc(DRIVER, P_DEFAULTS.Vb)); // rear chamber: sealed, driver's own
    expect(input.box.Vf).toBe(P_DEFAULTS.Vf);
    expect(input.box.Ff).toBe(tuningFromLength(P_DEFAULTS.Vf, P_DEFAULTS.ventL, Sp, P_DEFAULTS.endCorrection));
    expect(input.box.SdFront).toBeCloseTo(Sp, 12);
    expect(input.ventFront?.dia).toBe(P_DEFAULTS.ventD);
  });

  it('pr → BType 4, Fr = prTuning(P), Npr = prNum, [PassiveRadiator] from the PR T/S formulas', () => {
    const input = buildWprInput('pr', P_DEFAULTS, DRIVER, DRIVER_SECTION, PROJECT, NOW);
    expect(input.box.bType).toBe(4);
    expect(input.box.Fr).toBe(prTuning(P_DEFAULTS));
    expect(input.box.npr).toBe(P_DEFAULTS.prNum);
    expect(input.box.SdRear ?? 0).toBe(0);
    expect(input.pr).toEqual({
      Vas: prVas(P_DEFAULTS.prCms, P_DEFAULTS.prSd),
      Qms: prQms(P_DEFAULTS.prMmd, P_DEFAULTS.prCms, P_DEFAULTS.prRms),
      Fs: prFsWithMass(P_DEFAULTS.prMmd, P_DEFAULTS.prMadd, P_DEFAULTS.prCms),
      Sd: P_DEFAULTS.prSd,
      Xmax: P_DEFAULTS.prXmax,
      Me: P_DEFAULTS.prMadd,
    });
  });

  it('carries the driver section verbatim and the signal power', () => {
    const input = buildWprInput('sealed', P_DEFAULTS, DRIVER, DRIVER_SECTION, PROJECT, NOW);
    expect(input.driverSection).toBe(DRIVER_SECTION);
    expect(input.signal.P).toBe(P_DEFAULTS.Pin);
  });

  it('stamps ModifyDate from the given "now" (never fabricates CreateDate when project.created is unset)', () => {
    const input = buildWprInput('sealed', P_DEFAULTS, DRIVER, DRIVER_SECTION, PROJECT, NOW);
    expect(input.project.modifyDate).toBe('20260722');
    expect(input.project.createDate).toBe(''); // PROJECT.created is '' — no invented history
    expect(input.project.creator).toBe('johnl');
  });

  it('normalises an ISO (YYYY-MM-DD) project.created into WinISD YYYYMMDD', () => {
    const withCreated = { ...PROJECT, created: '2026-06-21' };
    const input = buildWprInput('sealed', P_DEFAULTS, DRIVER, DRIVER_SECTION, withCreated, NOW);
    expect(input.project.createDate).toBe('20260621');
  });

  it('with no driver (null), sealed/bandpass4 Fr falls back to 0 rather than throwing', () => {
    const sealed = buildWprInput('sealed', P_DEFAULTS, null, DRIVER_SECTION, PROJECT, NOW);
    expect(sealed.box.Fr).toBe(0);
    const bp4 = buildWprInput('bandpass4', P_DEFAULTS, null, DRIVER_SECTION, PROJECT, NOW);
    expect(bp4.box.Fr).toBe(0);
  });
});
