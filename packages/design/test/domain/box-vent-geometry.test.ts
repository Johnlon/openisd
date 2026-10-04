import {describe, expect, it} from 'vitest';
import {type Engine, createEngine} from '@openisd/design/engine';
import {ProjectBuilder, type FrequencyGrid} from '../../domain/index.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

describe('OpenISDBox vent geometry', () => {
  const project = (engine: Engine) => new ProjectBuilder(
    driverFromSpec(engine, { Fs_hz: 30, Qes: 0.4, Qms: 4, Sd_m2: 0.02, Cms_m_per_N: 0.0005 }), engine)
    .vented().volume_m3(0.03).tuning_goal_hz(30).build();

  it('effectiveLength_m() is longer than the port measures, by the engine\'s end correction', () => {
    const engine = createEngine();
    const p = project(engine);
    p.box.vented.vent.diameter_m.set(0.1);
    p.box.vented.vent.length_m.set(0.2);

    const area = Math.PI * 0.05 ** 2;
    expect(p.box.vented.vent.effectiveLength_m()).toBe(
      engine.vent.effectiveLength(0.2, area, 1, p.box.vented.vent.endCorrection_m.value),
    );
    expect(p.box.vented.vent.effectiveLength_m()!).toBeGreaterThan(0.2);
  });

  it('a SLOTTED port of the same area gets the same acoustic length as a round one', () => {
    const engine = createEngine();
    const p = project(engine);
    p.box.vented.vent.diameter_m.set(0.1);
    p.box.vented.vent.length_m.set(0.2);
    const round = p.box.vented.vent.effectiveLength_m()!;

    // A slot with exactly the round port's area: the equivalent diameter must come out the same.
    const area = Math.PI * 0.05 ** 2;
    p.box.vented.vent.shape.set('slotted');
    p.box.vented.vent.width_m.set(0.05);
    p.box.vented.vent.height_m.set(area / 0.05);

    expect(p.box.vented.vent.effectiveLength_m()!).toBeCloseTo(round, 12);
  });

  it('tuning and length are inverses of each other, both through the engine', () => {
    const engine = createEngine();
    const p = project(engine);
    p.box.vented.vent.diameter_m.set(0.1);

    const length = p.box.vented.vent.lengthForTuning_m(0.03, 30)!;
    p.box.vented.vent.length_m.set(length);

    expect(p.box.vented.vent.tuningIn_hz(0.03)!).toBeCloseTo(30, 8);
  });

  it('lengthForTuning_m answers null once any of volume_m3/fb_hz/the vent\'s own area is missing', () => {
    const engine = createEngine();
    const p = project(engine);
    p.box.vented.vent.diameter_m.set(0.1);

    expect(p.box.vented.vent.lengthForTuning_m(null, 30)).toBeNull();
    expect(p.box.vented.vent.lengthForTuning_m(0.03, 0)).toBeNull();
    p.box.vented.vent.diameter_m.clear();
    expect(p.box.vented.vent.lengthForTuning_m(0.03, 30)).toBeNull();
  });

  it('a LONGER port tunes the same box LOWER', () => {
    const engine = createEngine();
    const p = project(engine);
    p.box.vented.vent.diameter_m.set(0.1);

    p.box.vented.vent.length_m.set(0.10);
    const shortPort = p.box.vented.vent.tuningIn_hz(0.03)!;
    p.box.vented.vent.length_m.set(0.30);

    expect(p.box.vented.vent.tuningIn_hz(0.03)!).toBeLessThan(shortPort);
  });

  it('a port with no dimensions reports null, and so does a zero-volume box', () => {
    const engine = createEngine();
    const p = project(engine);
    p.box.vented.vent.diameter_m.clear();   // the build gave it the 50 mm starting diameter

    expect(p.box.vented.vent.effectiveLength_m()).toBeNull();
    p.box.vented.vent.diameter_m.set(0.1);
    p.box.vented.vent.length_m.set(0.2);
    expect(p.box.vented.vent.tuningIn_hz(0)).toBeNull();
  });

  // bugs/archive/BUG_20260927_tuning-absent-when-port-length-entered.md — WHEN A PORT IS SET BY LENGTH
  // (tuning frequency blank), `winisd-lossy`'s Fb/Ff must still be the tuning that length
  // achieves, or the port-mass term (`Map = 1/(ωb²·Cab)`) divides by zero-derived NaN
  // (`VentedBox.ts`/`Bandpass4Box.ts`: "P.Fb absent poisons every value below with NaN").
  //
  // `#boxSpecificParams` reads `tuning_goal_hz.value` directly, with no fallback to
  // `ventAchievedFb`-style readout. That already works FOR THIS EXACT CASE: `solveVent`
  // (`engine/vent/VentEngine.ts`, the vent handle solve run on every `#resolve()`) already
  // writes the length-achieved tuning back onto `tuning_goal_hz` itself via `setCalculated()`
  // whenever the length is entered and the goal is not — verified below by checking
  // `tuning_goal_hz.value` against `ventAchievedFb.value` (the same `tuningFromLength` formula,
  // called through a different door) and confirming BOTH regimes agree on the swept curve to
  // the ticket's own 1e-12 tolerance. No `#boxSpecificParams`/domain change was needed — this
  // pair of tests is the ticket's own "Verification" section, kept as regression coverage.
  const completeDriver = (engine: Engine) => driverFromSpec(engine, {
    Fs_hz: 30, Qes: 0.4, Qms: 4, Qts: 1 / (1 / 4 + 1 / 0.4), Re_ohm: 6.4,
    Sd_m2: 0.02, Cms_m_per_N: 0.0005, Vas_m3: 0.05, BL_Tm: 8, Mms_kg: 0.05, Xmax_m: 0.008, Pe_W: 100,
  });

  it('BUG_20260927: vented, port set by length (tuning blank), sweeps finite and matches the same project entered by its achieved tuning', () => {
    const engine = createEngine();
    const byLength = new ProjectBuilder(completeDriver(engine), engine)
      .vented().volume_m3(0.03).tuning_goal_hz(30).build();
    byLength.powerDrive_W.set(1);
    byLength.winisdDriverModel.set(false);
    byLength.box.vented.vent.diameter_m.set(0.1);
    byLength.box.vented.vent.length_m.set(0.2);
    const achieved = byLength.ventAchievedFb.value;
    expect(achieved).not.toBeNull();

    const byTuning = new ProjectBuilder(completeDriver(engine), engine)
      .vented().volume_m3(0.03).tuning_goal_hz(achieved!).build();
    byTuning.powerDrive_W.set(1);
    byTuning.winisdDriverModel.set(false);
    byTuning.box.vented.vent.diameter_m.set(0.1);

    const P: FrequencyGrid = { fmin: 10, fmax: 1000, N: 20 };
    const swLength = byLength.sweep(P);
    const swTuning = byTuning.sweep(P);
    expect(swLength.issues).toEqual([]);
    expect(swLength.values).not.toBeNull();
    expect(swLength.values!.spl.every(Number.isFinite)).toBe(true);
    for (let i = 0; i < swLength.values!.spl.length; i++) {
      const a = swLength.values!.spl[i];
      const b = swTuning.values!.spl[i];
      expect(Math.abs(a - b) / Math.abs(b)).toBeLessThanOrEqual(1e-12);
    }
  });

  it('BUG_20260927: bandpass4, front port set by length (tuning blank), sweeps finite and matches the same project entered by its achieved tuning', () => {
    const engine = createEngine();
    const byLength = new ProjectBuilder(completeDriver(engine), engine)
      .bandpass4().rearVolume_m3(0.02).frontVolume_m3(0.03).frontTuning_hz(40).build();
    byLength.powerDrive_W.set(1);
    byLength.winisdDriverModel.set(false);
    byLength.box.bandpass4.vents.front.diameter_m.set(0.1);
    byLength.box.bandpass4.vents.front.length_m.set(0.2);
    const achieved = byLength.box.bandpass4.chambers.front.tuning_goal_hz.value;
    expect(achieved).not.toBeNull();

    const byTuning = new ProjectBuilder(completeDriver(engine), engine)
      .bandpass4().rearVolume_m3(0.02).frontVolume_m3(0.03).frontTuning_hz(achieved!).build();
    byTuning.powerDrive_W.set(1);
    byTuning.winisdDriverModel.set(false);
    byTuning.box.bandpass4.vents.front.diameter_m.set(0.1);

    const P: FrequencyGrid = { fmin: 10, fmax: 1000, N: 20 };
    const swLength = byLength.sweep(P);
    const swTuning = byTuning.sweep(P);
    expect(swLength.issues).toEqual([]);
    expect(swLength.values).not.toBeNull();
    expect(swLength.values!.spl.every(Number.isFinite)).toBe(true);
    for (let i = 0; i < swLength.values!.spl.length; i++) {
      const a = swLength.values!.spl[i];
      const b = swTuning.values!.spl[i];
      expect(Math.abs(a - b) / Math.abs(b)).toBeLessThanOrEqual(1e-12);
    }
  });

});
