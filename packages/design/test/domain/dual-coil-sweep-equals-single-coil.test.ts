/**
 * bugs/BUG_20261018_dual-coil-wpr-re-halved.md (T401): a dual-coil driver stores Re and BL per coil;
 * the amplifier sees the terminal values. Swept in the same sealed box it must behave exactly as the
 * single-coil driver that has those terminal values: SPL, excursion, impedance and max power.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import type {FrequencyGrid} from '../../domain/box/frequencyGrid.js';
import {VoiceCoilWiring} from '../../domain/voiceCoilWiring.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

const GRID: FrequencyGrid = {fmin: 10, fmax: 5000, N: 60};
const MOTOR = {Fs_hz: 40, Mms_kg: 0.0266, Cms_m_per_N: 0.0006, Sd_m2: 0.009503, Qms: 2.94, Le_H: 0.0016};

function curves(spec: Record<string, number | VoiceCoilWiring>) {
  const engine = createEngine();
  const project = new ProjectBuilder(driverFromSpec(engine, {...MOTOR, ...spec}), engine).sealed().volume_m3(0.03).build();
  const sweep = project.sweep(GRID);
  const max = project.maxCurves(GRID);
  if (sweep.values === null || max.values === null) throw new Error(JSON.stringify([...sweep.issues, ...max.issues].map(i => i.text)));
  return {spl: sweep.values.spl, exc: sweep.values.exc, zmag: sweep.values.zmag, zph: sweep.values.zph, maxpwr: max.values.maxpwr};
}

function expectSame(dual: ReturnType<typeof curves>, single: ReturnType<typeof curves>): void {
  for (const chart of ['spl', 'exc', 'zmag', 'zph', 'maxpwr'] as const) {
    const a = dual[chart], b = single[chart];
    if (a === undefined || b === undefined) throw new Error(`no ${chart} curve`);
    expect(a.length, chart).toBe(b.length);
    const worst = Math.max(...a.map((x, i) => Object.is(x, b[i]) ? 0 : Math.abs(x - b[i]!)));
    expect(worst, `${chart} worst deviation`).toBeLessThan(1e-12);
  }
}

describe('dual-coil driver swept like its single-coil equivalent', () => {
  it('parallel: per-coil Re 13.2, BL 9.8 equals single coil Re 6.6, BL 9.8', () => {
    expectSame(
      curves({numVC: 2, VCCon: VoiceCoilWiring.Parallel, Re_ohm: 13.2, BL_Tm: 9.8}),
      curves({numVC: 1, Re_ohm: 6.6, BL_Tm: 9.8}));
  });

  it('series: per-coil Re 3.3, BL 4.9 equals single coil Re 6.6, BL 9.8', () => {
    expectSame(
      curves({numVC: 2, VCCon: VoiceCoilWiring.Series, Re_ohm: 3.3, BL_Tm: 4.9}),
      curves({numVC: 1, Re_ohm: 6.6, BL_Tm: 9.8}));
  });
});

describe('dual-coil driver in the sealed alignment picker', () => {
  const volume = (spec: Record<string, number | VoiceCoilWiring>, winisdPicker: boolean): number | null =>
    driverFromSpec(createEngine(), {...MOTOR, ...spec})
      .sealedPickerVolume(0.707, 0.1, {Ql: 10, Qa: 100}, winisdPicker);

  it.each([true, false])('picks the single-coil volume (winisdPicker %s)', (winisdPicker) => {
    const single = volume({numVC: 1, Re_ohm: 6.6, BL_Tm: 9.8}, winisdPicker);
    const dual = volume({numVC: 2, VCCon: VoiceCoilWiring.Parallel, Re_ohm: 13.2, BL_Tm: 9.8}, winisdPicker);
    expect(single).not.toBeNull();
    expect(dual).toBeCloseTo(single!, 12);
  });
});
