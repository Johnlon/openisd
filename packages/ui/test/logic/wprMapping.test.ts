import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { buildWprInput } from '../../src/logic/wprMapping.js';
import type { UiParams, ProjectMeta } from '../../src/types.js';

const emptyProject: ProjectMeta = { name: '', creator: '', created: '', modified: '', description: '' };

// Same values as @openisd/engine/src/constants.ts RHO/C, hand-copied (not imported) so the
// test's expected value is derived independently of the code path under test.
const RHO = 1.20095217714682;
const C = 343.684120962153;

function prParams(): UiParams {
  return {
    Vb: 0.02, Vf: 0.02, ventShape: 'round', ventD: 0.05, ventW: 0, ventH: 0, ventL: 0.1,
    Fb: 40, prFp: 40, entered: {}, Ql: 7, Qa: 100, Qp: 100, nDrivers: 1, wiring: 'parallel',
    Pin: 100, Rs: 0.1, prName: 'PR', prSd: 0.008, prNum: 1, prMmd: 0.02, prMadd: 0,
    prCms: 0.0006, prRms: 0.5, prXmax: 0.005, prMode: 'tuning', fmin: 10, fmax: 1000, N: 200,
    circuitModel: 'winisd', filters: [], vcTempRise: 0, alfaVC: 0.0039, driverAddedMass: 0,
    endCorrection: 0.732, rgAtDriverSide: false, tlPortModel: false, forceFlatResponse: false,
    splXmaxLimited: false,
  };
}

describe('buildWprInput — passive-radiator Vas unit', () => {
  it('writes [PassiveRadiator].Vas in cubic metres, WinISD\'s own file unit', () => {
    const P = prParams();
    // ventArea_m2 = 0: irrelevant for box === 'pr', which never reads it.
    const input = buildWprInput('pr', P, null, '[Driver]\n', emptyProject, new Date(2026, 0, 1), 0);

    // Vas = Cms * Sd^2 * rho * c^2, in m^3 -- no litres conversion. Computed independently of
    // prVas()'s own (correct, litres-for-display) implementation.
    const expectedM3 = P.prCms * P.prSd * P.prSd * RHO * C * C;

    assert.ok(input.pr, 'buildWprInput must populate [PassiveRadiator] for box === "pr"');
    const relErr = Math.abs(input.pr!.Vas - expectedM3) / expectedM3;
    assert.ok(relErr < 1e-6,
      `pr.Vas = ${input.pr!.Vas} m^3, expected ${expectedM3} m^3 (rel err ${relErr}). ` +
      `If this is exactly 1000x too large, wprMapping.ts is passing prVas()'s LITRES value ` +
      `straight into the SI [PassiveRadiator].Vas field.`);
  });
});
