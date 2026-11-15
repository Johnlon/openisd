/**
 * Multi-coil drivers use their published Re and BL (QO900 R1, QO904 A1;
 * bugs/BUG_20261114_engine-per-coil-basis.md, bugs/BUG_20261114_vccon-default-feeds-maths.md).
 * A datasheet's Re/BL are the whole driver's in the wiring it was measured in, so the T/S
 * relations run on them as stated: no per-coil conversion, and VCCon is not read.
 *
 * Also the wiring inference (QO903 R4) and the wiring data-quality issues (QO909).
 *
 * Figures are each record's datasheet values with their printed precision, as the catalogue
 * snapshot holds them (winisd_drivers/snapshot/datasheets/<brand>/<model>/openisd.json).
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import {CURRENT_SCHEMA_VERSION} from '../../domain/schemaVersion.js';
import {VoiceCoilWiring} from '../../domain/voiceCoilWiring.js';

const engine = createEngine();

/** One datasheet value and its printed half-width. */
interface Stated {
  readonly value: number;
  readonly precision: number;
}

interface DriverFixture {
  readonly model: string;
  readonly woofer: Readonly<Record<string, Stated>>;
  /** The record's VCCon, entered; absent when the sheet does not say. */
  readonly enteredVCCon?: VoiceCoilWiring;
}

function driverOf(fixture: DriverFixture): OpenISDDriver {
  const woofer: Record<string, {state: 'E'; value: number | VoiceCoilWiring; precision?: number}> = {};
  for (const [key, stated] of Object.entries(fixture.woofer)) {
    woofer[key] = {state: 'E', value: stated.value, precision: stated.precision};
  }
  if (fixture.enteredVCCon !== undefined) woofer.VCCon = {state: 'E', value: fixture.enteredVCCon};
  const result = OpenISDDriver.fromConformingRecord({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    uuid: {value: '00000000-0000-4000-8000-000000000788'},
    manufacturer: {value: 'Test'}, brand: {value: 'Test'}, model: {value: fixture.model}, sku: {value: ''},
    driver_type: {value: ['woofer']}, data_sources: {value: {}},
    specs: {woofer},
  }, engine);
  if (Array.isArray(result)) throw new Error(result.join('; '));
  result.resolve();
  return result;
}

const s = (value: number, precision: number): Stated => ({value, precision});

/** Dayton MX6-22. Datasheet: "All specifications measured with voice coils wired in series". */
const MX6_22: Readonly<Record<string, Stated>> = {
  numVC: s(2, 0.5), Re_ohm: s(4.7, 0.05), BL_Tm: s(12.3, 0.05), Fs_hz: s(30, 0.5),
  Mms_kg: s(0.0638, 0.00005), Qes: s(0.37, 0.005), Cms_m_per_N: s(0.00044, 0.000005),
  Qms: s(2.99, 0.005), Qts: s(0.33, 0.005), Sd_m2: s(0.01263, 0.000005), Vas_m3: s(0.01, 0.0005),
};
const MX6_22_MODEL = 'MX6-22 6-1/2" Max-X High Excursion DVC Subwoofer Driver 2 Ohms Per Coil';

/** Dayton RSS265HO-44: the sheet states no wiring. */
const RSS265HO_44: Readonly<Record<string, Stated>> = {
  numVC: s(2, 0.5), Re_ohm: s(1.6, 0.05), BL_Tm: s(9.39, 0.005), Fs_hz: s(27.6, 0.05),
  Mms_kg: s(0.161, 0.0005), Qes: s(0.5, 0.005), Qms: s(4.42, 0.005), Qts: s(0.45, 0.005),
};
const RSS265HO_44_MODEL = 'RSS265HO-44 10" Reference HO DVC Subwoofer 4 Ohms Per Coil';

/** Bliesma W137A-854-4: three coils, figures as published, no wiring stated. */
const W137A_854_4: Readonly<Record<string, Stated>> = {
  numVC: s(3, 0.5), Re_ohm: s(3.4, 0.05), BL_Tm: s(6.7, 0.05), Fs_hz: s(31.5, 0.05),
  Mms_kg: s(0.0271, 0.00005), Qes: s(0.41, 0.005), Qms: s(7.35, 0.005), Qts: s(0.39, 0.005),
  Cms_m_per_N: s(0.00094, 0.000005),
};

const inconsistencies = (d: OpenISDDriver): string[] =>
  d.issues().filter(i => i.kind === 'inconsistent-inputs').map(i => i.text);

describe('multi-coil T/S relations run on the published Re and BL', () => {
  it('MX6-22 (2 coils, wiring unknown): no inconsistency', () => {
    expect(inconsistencies(driverOf({model: MX6_22_MODEL, woofer: MX6_22}))).toEqual([]);
  });

  // Rme and Mpow on the published figures: Rme = 2π·Fs·Mms/Qes = 2π·30·0.0638/0.37 = 32.50 (the
  // route the solver takes with Qes stated), Mpow = BL/√Re = 12.3/√4.7 = 5.674. BL²/Re = 32.19 and
  // Mpow² = 32.19 agree with Rme to 1%, inside the printed precision. Per coil (Re 2.35, the #512
  // defect) BL²/Re was 64.4 and Mpow 8.02.
  it('MX6-22: Rme 32.50, Mpow 5.674, Mpow² within 1% of Rme', () => {
    const d = driverOf({model: MX6_22_MODEL, woofer: MX6_22});
    const Rme = d.specs.Rme_kg_per_s.value ?? NaN;
    const Mpow = d.specs.Mpow_N_per_sqrtW.value ?? NaN;
    expect(Rme).toBeCloseTo(2 * Math.PI * 30 * 0.0638 / 0.37, 10);
    expect(Mpow).toBeCloseTo(12.3 / Math.sqrt(4.7), 10);
    expect(Math.abs(Mpow ** 2 - Rme) / Rme).toBeLessThan(0.01);
  });

  it('MX6-22 with its wiring entered as series: still no inconsistency, same Rme', () => {
    const d = driverOf({model: MX6_22_MODEL, woofer: MX6_22, enteredVCCon: VoiceCoilWiring.Series});
    expect(inconsistencies(d)).toEqual([]);
    expect(d.specs.Rme_kg_per_s.value).toBeCloseTo(2 * Math.PI * 30 * 0.0638 / 0.37, 10);
  });

  it('RSS265HO-44 (2 coils): no inconsistency', () => {
    expect(inconsistencies(driverOf({model: RSS265HO_44_MODEL, woofer: RSS265HO_44}))).toEqual([]);
  });

  it('Bliesma W137A-854-4 (3 coils): no inconsistency', () => {
    expect(inconsistencies(driverOf({model: 'W137A-854 4 Ω', woofer: W137A_854_4}))).toEqual([]);
  });

  it('the terminal Re and BL the sweep reads are the stored ones', () => {
    const p = driverOf({model: MX6_22_MODEL, woofer: MX6_22, enteredVCCon: VoiceCoilWiring.Parallel}).specs.solverParams();
    expect(p.Re_terminal_ohm.value).toBe(4.7);
    expect(p.BL_terminal_Tm.value).toBe(12.3);
  });
});

describe('no voice-coil default (QO900 R1)', () => {
  it('a record stating neither VCCon nor numVC keeps both empty after resolve', () => {
    const d = driverOf({model: 'Plain', woofer: {Re_ohm: s(6, 0.05)}});
    expect(d.specs.VCCon.value).toBeNull();
    expect(d.specs.numVC.value).toBeNull();
  });

  it('a 2-coil record with no wiring and nothing to infer from keeps VCCon empty', () => {
    const d = driverOf({model: 'W137A-854 4 Ω', woofer: W137A_854_4});
    expect(d.specs.VCCon.value).toBeNull();
  });
});

describe('measured wiring inferred from a printed per-coil nominal (QO903 R4)', () => {
  const inferred = (model: string, woofer: Readonly<Record<string, Stated>>, enteredVCCon?: VoiceCoilWiring) =>
    driverOf({model, woofer, enteredVCCon}).specs.VCCon;

  it('MX6-22, "2 Ohms Per Coil", Re 4.7 (2.35×): series, calculated', () => {
    const vc = inferred(MX6_22_MODEL, MX6_22);
    expect(vc.value).toBe(VoiceCoilWiring.Series);
    expect(vc.calculated).toBe(true);
    expect(vc.entered).toBe(false);
  });

  it('RSS265HO-44, "4 Ohms Per Coil", Re 1.6 (0.4×): parallel, calculated', () => {
    const vc = inferred(RSS265HO_44_MODEL, RSS265HO_44);
    expect(vc.value).toBe(VoiceCoilWiring.Parallel);
    expect(vc.calculated).toBe(true);
  });

  it('Visaton "2 x 4 Ohm", Re 2.9 (0.725×): unknown', () => {
    expect(inferred('W 130 X 2 x 4 Ohm', {numVC: s(2, 0.5), Re_ohm: s(2.9, 0.05)}).value).toBeNull();
  });

  it('no printed per-coil nominal: unknown', () => {
    expect(inferred('MX6-22 6-1/2" Subwoofer', MX6_22).value).toBeNull();
  });

  it('a stated wiring overrides the inference', () => {
    const vc = inferred(MX6_22_MODEL, MX6_22, VoiceCoilWiring.Parallel);
    expect(vc.value).toBe(VoiceCoilWiring.Parallel);
    expect(vc.entered).toBe(true);
  });

  it.each([
    ['Dual 4 Ohm', 9.6, VoiceCoilWiring.Series],
    ['Sub 12" 2 x 4 ohm', 1.9, VoiceCoilWiring.Parallel],
    ['SA12-D4', 7.0, VoiceCoilWiring.Series],
    ['SA12 D4', 1.8, VoiceCoilWiring.Parallel],
    ['Sub 4 + 4 Ω', 8.2, VoiceCoilWiring.Series],
  ])('"%s", Re %s: %s', (model, Re, expected) => {
    expect(inferred(model, {numVC: s(2, 0.5), Re_ohm: s(Re, 0.05)}).value).toBe(expected);
  });

  it('a single-coil driver is never inferred', () => {
    expect(inferred(MX6_22_MODEL, {...MX6_22, numVC: s(1, 0.5)}).value).toBeNull();
  });
});

describe('wiring data quality (QO909)', () => {
  const wiringIssues = (d: OpenISDDriver) =>
    d.issues().filter(i => i.kind === 'wiring-not-stated' || i.kind === 'wiring-inferred' || i.kind === 'multi-coil-without-numvc');

  it('2 coils, wiring not stated, nothing to infer: a "measured wiring not stated" warning', () => {
    const d = driverOf({model: 'W137A-854 4 Ω', woofer: W137A_854_4});
    expect(wiringIssues(d).map(i => i.kind)).toEqual(['wiring-not-stated']);
    expect(d.dataQualityWarnings().map(w => w.message)).toContain('Measured wiring not stated: the datasheet gives 3 voice coils but not how they were wired when Re and BL were measured.');
  });

  it('2 coils, wiring inferred: a note naming the reason, and no warning', () => {
    const d = driverOf({model: MX6_22_MODEL, woofer: MX6_22});
    const issues = wiringIssues(d);
    expect(issues.map(i => i.kind)).toEqual(['wiring-inferred']);
    expect(issues[0].text).toBe('Wiring inferred: series (Re 4.7 Ω on 2 Ω coils).');
    expect(d.dataQualityWarnings().filter(w => w.field === 'VCCon')).toEqual([]);
  });

  it('2 coils, wiring stated: no wiring issue', () => {
    expect(wiringIssues(driverOf({model: MX6_22_MODEL, woofer: MX6_22, enteredVCCon: VoiceCoilWiring.Series}))).toEqual([]);
  });

  it('a single coil: no wiring issue', () => {
    expect(wiringIssues(driverOf({model: 'Plain', woofer: {numVC: s(1, 0.5), Re_ohm: s(6, 0.05)}}))).toEqual([]);
  });

  it('a multi-coil title with no numVC: a warning', () => {
    const d = driverOf({model: MX6_22_MODEL, woofer: {Re_ohm: s(4.7, 0.05)}});
    expect(wiringIssues(d).map(i => i.kind)).toEqual(['multi-coil-without-numvc']);
    expect(d.dataQualityWarnings().map(w => w.field)).toContain('numVC');
  });
});
