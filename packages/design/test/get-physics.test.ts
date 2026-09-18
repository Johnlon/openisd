import { test } from 'vitest';
import { Engine } from '../engine/Engine';

test('get physics', () => {
  const drvGeneric = {
    Fs: 37, Qts: 0.38, Vas: 0.030,
    Mms: 0.02, Re: 6, Bl: 10, Sd: 0.02, Qms: 3, Qes: 0.43, Le: 0.001, Xmax: 0.005, Pe: 100
  };

  const sealedState = {
    environment: { tempK: 293.15, humidityPct: 30, pressurePa: 101325, useWinisdAirModel: true },
    driver: { count: 1, wiring: 'normal', params: drvGeneric },
    box: {
      type: 'sealed',
      sealed: { Vb: 0.020, Qa: 100, Ql: 10, Qp: 100 }
    },
    filters: [], signal: { eg: 2.83, r_out: 0 }
  };

  const engine = new Engine();
  const resSealed = engine.solveProject(sealedState as any);
  console.log('Sealed generic:');
  console.log('Qtc =', resSealed.design.box.Qtc);
  console.log('fc =', resSealed.design.box.fc);

  const sealedBWState = { ...sealedState, box: { type: 'sealed', sealed: { Vb: 0.012165, Qa: 100, Ql: 10, Qp: 100 } } };
  const resBW = engine.solveProject(sealedBWState as any);
  console.log('Sealed Butterworth generic:');
  console.log('Qtc =', resBW.design.box.Qtc);
  console.log('fc =', resBW.design.box.fc);

  const ventedState = { ...sealedState, box: { type: 'vented', vented: { Vb: 0.030, Qa: 100, Ql: 10, Qp: 100, vents: [{ shape: 'round', diameter: 0.05, length: 0.10, count: 1, endCorrection: 'both' }] } } };
  const resVented = engine.solveProject(ventedState as any);
  console.log('Vented generic:');
  console.log('Fb =', resVented.design.box.Fb);
  
  const bp4State = { ...sealedState, box: { type: 'bandpass4', bandpass4: { Vrear: 0.015, Qa_rear: 100, Ql_rear: 10, Vfront: 0.020, Qa_front: 100, Ql_front: 10, Qp_front: 100, vents: [{ shape: 'round', diameter: 0.05, length: 0.10, count: 1, endCorrection: 'both' }] } } };
  const resBp4 = engine.solveProject(bp4State as any);
  console.log('Bandpass4 generic:');
  console.log('Vrear =', resBp4.design.box.Vrear);
  console.log('peak port velocity is', resBp4.design.box.peakPortVelocity);
  
  const prState = { ...sealedState, box: { type: 'box-passive-radiator', 'box-passive-radiator': { Vb: 0.030, Qa: 100, Ql: 10, Qp: 100, radiators: [{ count: 1, params: { Sd: 0.02, Mms: 0.05, Cms: 0.0005, Rms: 1, Xmax: 0.005 } }] } } };
  const resPr = engine.solveProject(prState as any);
  console.log('Passive Radiator generic:');
  console.log('Fp =', resPr.design.box.radiators[0].Fp);
});
