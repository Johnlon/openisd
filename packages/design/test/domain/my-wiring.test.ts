/**
 * "Coil wiring" (John, 14 Nov 2026, QO907 / issue 512): a project setting, series or parallel, that
 * says how the user will wire a multi-coil driver. It defaults to the wiring the maker measured
 * in. Everything the amplifier side reads — impedance, SPL and excursion against voltage, power,
 * Rg loading — uses the figures converted to that wiring; the Thiele/Small quantities that do not
 * depend on the wiring stay as published.
 *
 * Expected values are worked by hand from the Dayton MX6-22 datasheet figures (measured with the
 * voice coils in series): Re 4.7 Ω, BL 12.3 T·m, Le 1.5 mH, Znom 4 Ω, 2 coils.
 *   series → parallel, N = 2: Re ÷ 4 = 1.175 Ω, BL ÷ 2 = 6.15 T·m, Le ÷ 4 = 0.375 mH, Znom ÷ 4 = 1 Ω.
 *   Qes = 2π·Fs·Mms·Re/BL²: 2π·30·0.0638·4.7/12.3² = 0.37360 (series), 2π·30·0.0638·1.175/6.15² =
 *   0.37360 (parallel): the same.
 * The conversion is proved against a SINGLE-coil driver stating the converted figures: the two
 * must give the same curves.
 */
import {z} from 'zod';
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import type {FrequencyGrid} from '../../domain/box/frequencyGrid.js';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import {VoiceCoilWiring} from '../../domain/voiceCoilWiring.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

const GRID: FrequencyGrid = {fmin: 10, fmax: 5000, N: 60};
const MOTOR = {Fs_hz: 30, Mms_kg: 0.0638, Cms_m_per_N: 0.00044, Sd_m2: 0.0214, Qms: 3.2};
const MX6_22 = {...MOTOR, numVC: 2, VCCon: VoiceCoilWiring.Series, Re_ohm: 4.7, BL_Tm: 12.3, Le_H: 0.0015, Znom_ohm: 4};

function projectOf(spec: Record<string, number | VoiceCoilWiring>): OpenISDProject {
  const engine = createEngine();
  return new ProjectBuilder(driverFromSpec(engine, spec), engine).sealed().volume_m3(0.03).build();
}

function curves(project: OpenISDProject) {
  const sweep = project.sweep(GRID);
  const max = project.maxCurves(GRID);
  if (sweep.values === null || max.values === null) throw new Error(JSON.stringify([...sweep.issues, ...max.issues].map(i => i.text)));
  return {spl: sweep.values.spl, exc: sweep.values.exc, zmag: sweep.values.zmag, zph: sweep.values.zph, maxpwr: max.values.maxpwr};
}

function expectSame(a: ReturnType<typeof curves>, b: ReturnType<typeof curves>): void {
  for (const chart of ['spl', 'exc', 'zmag', 'zph', 'maxpwr'] as const) {
    const x = a[chart], y = b[chart];
    if (x === undefined || y === undefined) throw new Error(`no ${chart} curve`);
    expect(x.length, chart).toBe(y.length);
    const worst = Math.max(...x.map((v, i) => Object.is(v, y[i]) ? 0 : Math.abs(v - y[i]!)));
    expect(worst, `${chart} worst deviation`).toBeLessThan(1e-12);
  }
}

describe('Coil wiring: the default is the measured wiring', () => {
  it('reports the measured wiring as stated, and Coil wiring equal to it', () => {
    const w = projectOf(MX6_22).coilWiring;
    expect(w.measured).toBe('series');
    expect(w.measuredBasis).toBe('stated');
    expect(w.mine).toBe('series');
    expect(w.canChoose).toBe(true);
    expect(w.unavailableReason).toBeNull();
  });

  it('a project that never chose is swept exactly as the single-coil driver with the published figures', () => {
    expectSame(
      curves(projectOf(MX6_22)),
      curves(projectOf({...MOTOR, numVC: 1, Re_ohm: 4.7, BL_Tm: 12.3, Le_H: 0.0015})));
  });

  it('saves no coil-wiring key until the user chooses one (a project saved before this loads as measured)', () => {
    const project = projectOf(MX6_22);
    const text = z.object({saved: z.object({driverEmbedding: z.object({}).passthrough()})}).parse(JSON.parse(project.toOwprText()));
    expect(text.saved.driverEmbedding).not.toHaveProperty('VCCon');
  });
});

describe('Coil wiring: parallel for the series-measured MX6-22', () => {
  it('sweeps like a single-coil driver stating Re 1.175 Ω, BL 6.15 T·m, Le 0.375 mH', () => {
    const project = projectOf(MX6_22);
    project.coilWiring.choose('parallel');
    expectSame(
      curves(project),
      curves(projectOf({...MOTOR, numVC: 1, Re_ohm: 1.175, BL_Tm: 6.15, Le_H: 0.000375})));
  });

  it('shows the converted figures beside the published ones', () => {
    const project = projectOf(MX6_22);
    project.coilWiring.choose('parallel');
    const w = project.coilWiring;
    expect(w.mine).toBe('parallel');
    expect(w.published).toEqual({Re_ohm: 4.7, BL_Tm: 12.3, Le_H: 0.0015, Znom_ohm: 4});
    expect(w.atMine.Re_ohm).toBeCloseTo(1.175, 12);
    expect(w.atMine.BL_Tm).toBeCloseTo(6.15, 12);
    expect(w.atMine.Le_H).toBeCloseTo(0.000375, 15);
    expect(w.atMine.Znom_ohm).toBeCloseTo(1, 12);
  });

  it('leaves the stored figures and every wiring-independent quantity as published', () => {
    const project = projectOf(MX6_22);
    const before = {Qes: project.driver.specs.Qes.value, Qts: project.driver.specs.Qts.value, Mms: project.driver.specs.Mms_kg.value};
    project.coilWiring.choose('parallel');
    const s = project.driver.specs;
    expect(s.Re_ohm.value).toBe(4.7);
    expect(s.BL_Tm.value).toBe(12.3);
    expect(s.Le_H.value).toBe(0.0015);
    expect(s.Znom_ohm.value).toBe(4);
    expect(s.Qes.value).toBeCloseTo(0.37360, 5);
    expect(s.Qes.value).toBe(before.Qes);
    expect(s.Qts.value).toBe(before.Qts);
    expect(s.Mms_kg.value).toBe(before.Mms);
    expect(s.Fs_hz.value).toBe(30);
  });

  it('the 1 W reference drive is a different voltage: V = √(P·(Re+Rs)), Rs 0.1 Ω: 2.1909 V at Re 4.7 Ω, 1.1292 V at Re 1.175 Ω', () => {
    const project = projectOf(MX6_22);
    expect(project.powerDrive_W.value).toBe(1);
    expect(project.driveVoltage_V.value).toBeCloseTo(Math.sqrt(4.8), 9);
    project.coilWiring.choose('parallel');
    expect(project.powerDrive_W.value).toBe(1);
    expect(project.driveVoltage_V.value).toBeCloseTo(Math.sqrt(1.275), 9);
  });

  it('Rg loads the converted Re: Qes·(Re+Rg)/Re with Rg 0.1 Ω is Qes·4.8/4.7 (series) and Qes·1.275/1.175 (parallel)', () => {
    const project = projectOf(MX6_22);
    const Qes = project.driver.specs.Qes.value!;
    const loaded = (): number => {
      const Qts = project.driver.sourceLoadedQts(0.1)!;
      return 1 / (1 / project.driver.specs.Qms.value! + 1 / (project.driver.specs.Qes.value! * 0)) * 0 + Qts;
    };
    const qesLoaded = (q: number): number => 1 / (1 / q - 1 / project.driver.specs.Qms.value!);
    expect(qesLoaded(loaded())).toBeCloseTo(Qes * 4.8 / 4.7, 6);
    project.coilWiring.choose('parallel');
    expect(qesLoaded(loaded())).toBeCloseTo(Qes * 1.275 / 1.175, 6);
  });

  it('choosing the measured wiring again changes nothing', () => {
    const project = projectOf(MX6_22);
    const before = curves(project);
    project.coilWiring.choose('parallel');
    project.coilWiring.choose('series');
    expectSame(curves(project), before);
  });

  it('is saved with the project and read back', () => {
    const project = projectOf(MX6_22);
    project.coilWiring.choose('parallel');
    const back = OpenISDProject.fromOwprText(project.toOwprText(), createEngine());
    if (Array.isArray(back)) throw new Error(back.join('; '));
    expect(back.coilWiring.mine).toBe('parallel');
    expectSame(curves(back), curves(project));
  });

  it('a different driver resets the choice to that driver\'s measured wiring', () => {
    const project = projectOf(MX6_22);
    project.coilWiring.choose('parallel');
    const engine = createEngine();
    project.setDriver(driverFromSpec(engine, MX6_22));
    expect(project.coilWiring.mine).toBe('series');
  });
});

describe('Coil wiring: parallel-measured driver, series wanted (RSS265HO-44: Re 1.6 Ω, BL 9.39 T·m)', () => {
  const RSS265 = {...MOTOR, numVC: 2, VCCon: VoiceCoilWiring.Parallel, Re_ohm: 1.6, BL_Tm: 9.39};

  it('series is Re × 4 = 6.4 Ω and BL × 2 = 18.78 T·m', () => {
    const project = projectOf(RSS265);
    project.coilWiring.choose('series');
    expect(project.coilWiring.atMine.Re_ohm).toBeCloseTo(6.4, 12);
    expect(project.coilWiring.atMine.BL_Tm).toBeCloseTo(18.78, 12);
    expectSame(curves(project), curves(projectOf({...MOTOR, numVC: 1, Re_ohm: 6.4, BL_Tm: 18.78})));
  });
});

describe('Coil wiring is not offered when it cannot be applied', () => {
  it('measured wiring not stated: disabled, with the reason, and the figures are used as published', () => {
    const project = projectOf({...MOTOR, numVC: 2, Re_ohm: 4.7, BL_Tm: 12.3});
    const w = project.coilWiring;
    expect(w.measured).toBeNull();
    expect(w.measuredBasis).toBe('not-stated');
    expect(w.mine).toBeNull();
    expect(w.canChoose).toBe(false);
    expect(w.unavailableReason).toBe('Measured wiring not stated, so the figures cannot be converted. If you know it, set it on the driver (Edit).');
    expect(() => w.choose('parallel')).toThrow('Measured wiring not stated');
    expectSame(curves(project), curves(projectOf({...MOTOR, numVC: 1, Re_ohm: 4.7, BL_Tm: 12.3})));
  });

  it('three coils with a known wiring: can be chosen, as in WinISD (any numVC above 1; QO941)', () => {
    const w = projectOf({...MOTOR, numVC: 3, VCCon: VoiceCoilWiring.Series, Re_ohm: 9, BL_Tm: 6}).coilWiring;
    expect(w.canChoose).toBe(true);
    w.choose('parallel');
    expect(w.atMine.Re_ohm).toBeCloseTo(1, 12);
    expect(w.atMine.BL_Tm).toBeCloseTo(2, 12);
  });

  it('one coil: nothing to choose', () => {
    const w = projectOf({...MOTOR, numVC: 1, Re_ohm: 4.7, BL_Tm: 12.3}).coilWiring;
    expect(w.canChoose).toBe(false);
    expect(w.measuredBasis).toBe('single-coil');
    expect(w.unavailableReason).toBe('This driver has one voice coil, so there is no wiring to choose.');
  });
});

describe('Coil wiring: the figures behind the control', () => {
  it('stated series, nothing chosen: published and amplifier-side figures agree', () => {
    const w = projectOf(MX6_22).coilWiring;
    expect(w.measuredBasis).toBe('stated');
    expect(w.published.Re_ohm).toBeCloseTo(4.7, 9);
    expect(w.atMine.Re_ohm).toBeCloseTo(4.7, 9);
    expect(w.atMine.BL_Tm).toBeCloseTo(12.3, 9);
  });

  it('parallel chosen: the amplifier-side figures are converted, the stored ones are not', () => {
    const p = projectOf(MX6_22);
    p.coilWiring.choose('parallel');
    // the stored driver is never overwritten; only the amplifier-side figures are converted (QO946.c35)
    expect(p.coilWiring.published.Re_ohm).toBeCloseTo(4.7, 9);
    expect(p.driver.specs.Re_ohm.value).toBeCloseTo(4.7, 9);
    expect(p.coilWiring.atMine.Re_ohm).toBeCloseTo(1.175, 9);
    expect(p.coilWiring.atMine.BL_Tm).toBeCloseTo(6.15, 9);
  });

  it('not stated and one coil', () => {
    expect(projectOf({...MOTOR, numVC: 2, Re_ohm: 4.7, BL_Tm: 12.3}).coilWiring.measuredBasis).toBe('not-stated');
    expect(projectOf({...MOTOR, numVC: 1, Re_ohm: 4.7, BL_Tm: 12.3}).coilWiring.measuredBasis).toBe('single-coil');
  });

  it('inferred from the title: says so, with the reason', () => {
    const engine = createEngine();
    const driver = driverFromSpec(engine, {...MOTOR, numVC: 2, Re_ohm: 1.6, BL_Tm: 9.39});
    // The title prints a per-coil nominal of 4 Ω; Re 1.6 Ω is 0.4 of it, so the coils are in parallel (QO903 R4).
    driver.model.set('RSS265HO-44 Dual 4 Ohm');
    const w = new ProjectBuilder(driver, engine).sealed().volume_m3(0.03).build().coilWiring;
    expect(w.measuredBasis).toBe('inferred');
  });
});
