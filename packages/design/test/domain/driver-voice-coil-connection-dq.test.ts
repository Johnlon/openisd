/**
 * QO432 (John, 6 Nov 2026): the driver is marked when its voice coil connection is Parallel but it
 * has 1 voice coil. Marked on both boxes it is about (Voicecoils, Connection); nothing is changed.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import {VoiceCoilWiring} from '../../domain/voiceCoilWiring.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

const engine = createEngine();
const BASE = {Fs_hz: 45, Qes: 0.57, Qms: 3.56, Vas_m3: 0.00485, Sd_m2: 0.0094, Re_ohm: 3.4, BL_Tm: 7.17};
const marked = (d: ReturnType<typeof driverFromSpec>) => ({
  coils: d.specs.numVC.dq.some(i => i.kind === 'parallel-needs-two-coils'),
  connection: d.specs.VCCon.dq.some(i => i.kind === 'parallel-needs-two-coils'),
});

describe('voice coil connection against the voice coil count', () => {
  it('marks Parallel with 1 voice coil on both boxes', () => {
    const d = driverFromSpec(engine, {...BASE, numVC: 1, VCCon: VoiceCoilWiring.Parallel});
    expect(marked(d)).toEqual({coils: true, connection: true});
    expect(d.specs.numVC.dq[0]?.text).toBe('Connection is Parallel but the driver has 1 voice coil. Parallel needs 2 voice coils.');
  });

  it('does not mark Parallel with 2 voice coils', () => {
    expect(marked(driverFromSpec(engine, {...BASE, numVC: 2, VCCon: VoiceCoilWiring.Parallel}))).toEqual({coils: false, connection: false});
  });

  it('does not mark Series with 2 voice coils', () => {
    expect(marked(driverFromSpec(engine, {...BASE, numVC: 2, VCCon: VoiceCoilWiring.Series}))).toEqual({coils: false, connection: false});
  });

  it('does not mark Series with 1 voice coil', () => {
    expect(marked(driverFromSpec(engine, {...BASE, numVC: 1, VCCon: VoiceCoilWiring.Series}))).toEqual({coils: false, connection: false});
  });

  it('does not mark when the voice coil count is blank', () => {
    expect(marked(driverFromSpec(engine, {...BASE, VCCon: VoiceCoilWiring.Parallel}))).toEqual({coils: false, connection: false});
  });
});
