import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import type {SimulatableBoxType, SweepParams} from '../../engine/index.js';
import {Engine} from '../../engine/index.js';
import {driverParams, solveConsistencyGroup} from './testSolver.js';

/**
 * `boxModel()` (engine/boxes/index.ts) — the exhaustive factory that gives each
 * `SimulatableBoxType` its own circuit class (`SealedBox`/`VentedBox`/`PassiveRadiatorBox`/
 * `Bandpass4Box`), mirroring `filterModel()` for the filter chain. Reached only through
 * `Engine.sweep`, same as the rest of `circuit.ts` — the engine's one door forbids importing
 * `boxes/` directly (architecture-engine-boundary.test.ts).
 */
describe('boxModel — one class per simulatable box type', () => {
  const engine = new Engine();
  const LE_H = 0.7e-3;
  const DRV = driverParams(solveConsistencyGroup({
    Fs_hz: 37, Qts: 0.378, Qes: 0.40, Qms: 7.0, Vas_m3: 0.0300,
    Sd_m2: 0.0133, Re_ohm: 5.6, Xmax_m: 0.0050, Pe_W: 60, Znom_ohm: 8,
  }));

  // `conventional-lossy` so every branch reads geometry (Sp/Leff, prMmd/prCms/prSd) rather than
  // a fixed-tuning `Fb`/`Fr` — no need to hand-tune a resonance for a dispatch-only test.
  const P_SEALED: SweepParams = {Vb: 0.030, eg: 2.83, Ql: 10, fmin: 30, fmax: 300, N: 5, lossMode: 'conventional-lossy'};
  const P_VENTED: SweepParams = {...P_SEALED, Sp: Math.PI * 0.025 ** 2, Leff: 0.1366};
  const P_PR: SweepParams = {...P_SEALED, prSd: 0.0133, prNum: 1, prMmd: 0.030, prMadd: 0, prCms: 0.0008, prRms: 1.0};
  const P_BP4: SweepParams = {...P_VENTED, Vf: 0.020};
  // `bandpass6`/`abc` read Fr/Ff (chamber tuning) for their own port mass in EVERY lossMode,
  // never Leff/Sp geometry (`Bandpass6Box.ts`'s own doc) — unlike `vented`/`bandpass4` above,
  // `conventional-lossy` buys nothing here, so a resonance is hand-tuned regardless.
  const P_BP6: SweepParams = {...P_SEALED, Vf: 0.020, Fr: 45, Ff: 60};
  const P_ABC: SweepParams = {...P_BP6, SpIntra: Math.PI * 0.02 ** 2, LeffIntra: 0.05};

  const PARAMS: Record<SimulatableBoxType, SweepParams> = {
    sealed: P_SEALED, vented: P_VENTED, 'box-passive-radiator': P_PR, bandpass4: P_BP4,
    bandpass6: P_BP6, abc: P_ABC,
  };
  const boxes = Object.keys(PARAMS) as SimulatableBoxType[];

  for (const box of boxes) {
    it(`${box}: dispatches to a working circuit class — a clean, finite sweep`, () => {
      const result = engine.simulation.sweep(DRV, LE_H, box, PARAMS[box]);
      assert.ok(result.values, `${box}: the factory must produce a class that sweeps successfully`);
      assert.equal(engine.simulation.classifyFinite(result.values!), null,
        `${box}: a valid design of this topology must not be classified as non-finite`);
    });
  }

  it('each box type produces its own Zbox — the factory is not one model silently reused for every topology', () => {
    const zmagAt = (box: SimulatableBoxType) => engine.simulation.sweep(DRV, LE_H, box, PARAMS[box]).values!.zmag[0];
    const zmags = boxes.map(zmagAt);
    for (let i = 0; i < zmags.length; i++)
      for (let j = i + 1; j < zmags.length; j++)
        assert.notEqual(zmags[i], zmags[j],
          `${boxes[i]} and ${boxes[j]} must not read identically — each has its own model`);
  });
});
