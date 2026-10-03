/**
 * THE DOMAIN CALLING THE ENGINE — every group, driven through the published surface only.
 *
 * No UI, no component mounting, no browser. A scenario here builds a driver or a project from a
 * plain record, asks it for a figure, and checks the figure came from the engine rather than from
 * arithmetic written into the domain.
 *
 * Two things every scenario is built to catch:
 *   - a hardcoded or stubbed answer, by moving an input and requiring the answer to move;
 *   - a figure computed in the domain, by comparing against the engine called directly with the
 *     same inputs, which must agree EXACTLY.
 *
 * Every number a scenario depends on is written inside that scenario, so a failure is diagnosable
 * from the one `it()` block without opening anything else.
 */
import {describe, expect, it} from 'vitest';
import {type Engine, createEngine} from '@openisd/design/engine';
import {createEngine as rootCreateEngine, type FrequencyGrid, ProjectBuilder,} from '../domain/index.js';
import {driverFromSpec, radiatorFromSpec} from './fixtures/recordBuilders.js';

// Block A is GONE. It tested `ebp_hz`, `referenceEfficiency` and `spl_dB` on the driver — three
// methods that solved the whole group to pull out two or three numbers and hand them to the
// engine. They are deleted: the driver publishes state, the engine does the physics, and a caller
// holding `solveConsistencyGroup()` already has both. Equivalent coverage belongs on the engine's
// own tests for `ebp`, `referenceEfficiency` and `splFromEfficiency`.


describe('B — the project runs the engine sweep on its own driver and box', () => {
  /** A driver complete enough for `deriveEngineDriver()` to succeed. */
  const complete = (engine: Engine) => driverFromSpec(engine, {
    Fs_hz: 30, Qes: 0.4, Qms: 4, Qts: 1 / (1 / 4 + 1 / 0.4), Re_ohm: 6.4,
    Sd_m2: 0.02, Cms_m_per_N: 0.0005, Vas_m3: 0.05, BL_Tm: 8, Mms_kg: 0.05, Xmax_m: 0.008, Pe_W: 100,
  });

  /** A sealed project driven at 1 W — every scenario below states the box volume and drive power
   *  itself, so the assembled `Vb`/`eg` are never stubbed. */
  const drivenSealed = (engine: Engine, volume_m3: number) => {
    const project = new ProjectBuilder(complete(engine), engine).sealed().volume_m3(volume_m3).build();
    project.powerDrive_W.set(1);
    // Off, so `project.driver.specs.solverParams()` — which knows nothing of the flag — is the same driver
    // the project sweeps. On (the default) the project substitutes the WinISD parameter set and
    // this scenario would be comparing two different drivers, not two paths to one answer.
    project.winisdDriverModel.set(false);
    return project;
  };

  it('sweep() returns a response, and it is the ENGINE that produced it', () => {
    const engine = createEngine();
    const project = drivenSealed(engine, 0.03);
    const P: FrequencyGrid = { fmin: 10, fmax: 1000, N: 100 };

    const mine = project.sweep(P).values;
    expect(mine).not.toBeNull();
    const theirs = engine.simulation.sweep(
      project.driver.specs.sweepDriver(), project.driver.specs.Le_H.value!, 'sealed',
      {
        Vb: 0.03, eg: project.driveVoltage_V.value!, fmin: 10, fmax: 1000, N: 100,
        Ql: project.box.sealed.losses.Ql.value, Qa: project.box.sealed.losses.Qa.value,
        Rs: project.Rs_ohm.value,
        lossMode: project.lossMode.value.value,
        useWinisdAirModel: project.envUseWinisdAirModel.value,
      },
    ).values!;
    expect(mine!.spl).toEqual(theirs.spl);
  });

  it('the response MOVES with the box volume — nothing is stubbed', () => {
    const engine = createEngine();
    const small = drivenSealed(engine, 0.010);
    const big = drivenSealed(engine, 0.100);
    const P: FrequencyGrid = { fmin: 10, fmax: 1000, N: 100 };

    expect(small.sweep(P).values!.spl).not.toEqual(big.sweep(P).values!.spl);
  });

  it('sweep() is null when the driver is too incomplete to simulate', () => {
    const engine = createEngine();
    const project = new ProjectBuilder(driverFromSpec(engine, { Fs_hz: 30 }), engine).sealed().volume_m3(0.03).build();

    expect(project.sweep({}).values).toBeNull();
  });

  it('sweep() is null for a topology the engine has no model for, and NOT for one it has', () => {
    const engine = createEngine();
    const project = drivenSealed(engine, 0.03);
    const P: FrequencyGrid = { fmin: 10, fmax: 1000, N: 50 };

    expect(project.sweep(P).values).not.toBeNull();

    // bandpass6 is a topology the domain names and the engine does not simulate.
    project.box.boxType.set('bandpass6');
    expect(project.sweep(P).values).toBeNull();
  });

  it('a passive-radiator box simulates, under the ONE box vocabulary', () => {
    // There is no domain-to-engine translation left to test: BoxType is declared once, in
    // engine/types.ts, and `box-passive-radiator` carries its prefix because `passive-radiator`
    // already names a DRIVER type (John's ruling D7, 2026-08-28). What this still pins is that
    // the enclosure reaches the engine and simulates, reading the PR chamber's own stored fields.
    const engine = createEngine();
    const project = drivenSealed(engine, 0.03);
    project.box.boxType.set('box-passive-radiator');
    project.box.passiveRadiator.configurePR(radiatorFromSpec(engine, {
      Fs_hz: 12, Sd_m2: 0.025, Vas_m3: 0.03, Xmax_m: 0.015,
    }));
    project.box.passiveRadiator.count.set(1);
    project.box.passiveRadiator.losses.Ql.set(7);
    project.box.passiveRadiator.losses.Qa.set(30);

    const P: FrequencyGrid = { fmin: 10, fmax: 1000, N: 50 };
    const mine = project.sweep(P).values;
    expect(mine).not.toBeNull();
  });

  it('BUG_20261003: editing the radiator Qms moves the sweep; Qms sets the radiator loss', () => {
    const engine = createEngine();
    const sweepWithQms = (qms: number) => {
      const project = drivenSealed(engine, 0.03);
      project.box.boxType.set('box-passive-radiator');
      project.box.passiveRadiator.configurePR(radiatorFromSpec(engine, {
        Fs_hz: 12, Sd_m2: 0.025, Vas_m3: 0.03, Xmax_m: 0.015,
      }));
      project.box.passiveRadiator.count.set(1);
      project.box.passiveRadiator.losses.Ql.set(7);
      project.box.passiveRadiator.losses.Qa.set(30);
      project.box.passiveRadiator.radiator.spec.Qms.set(qms);
      return project.sweep({ fmin: 10, fmax: 1000, N: 50 }).values!.spl;
    };
    expect(sweepWithQms(3.3)).not.toEqual(sweepWithQms(4.02));
  });

  it('BUG_20261003: a radiator Qms, Sd, Fs or Vas edit (not Xmax) notifies the project and changes its sweep job', () => {
    const engine = createEngine();
    const project = drivenSealed(engine, 0.03);
    project.box.boxType.set('box-passive-radiator');
    project.box.passiveRadiator.configurePR(radiatorFromSpec(engine, {
      Fs_hz: 44.2, Qms: 4.02, Vas_m3: 0.0084, Sd_m2: 0.00866, Xmax_m: 0.009,
    }));
    project.box.passiveRadiator.count.set(1);
    project.box.passiveRadiator.losses.Ql.set(7);
    project.box.passiveRadiator.losses.Qa.set(30);
    const grid: FrequencyGrid = { fmin: 10, fmax: 1000, N: 50 };
    const spec = project.box.passiveRadiator.radiator.spec;
    const edits = [
      ['Qms', () => spec.Qms.set(1)],
      ['Sd', () => spec.Sd_m2.set(0.01)],
      ['Xmax', () => spec.Xmax_m.set(0.02)],
      ['Fs', () => spec.Fs_hz.set(20)],
      ['Vas', () => spec.Vas_m3.set(0.02)],
    ] as const;
    const report = edits.map(([name, edit]) => {
      let notified = 0;
      const stop = project.subscribe(() => { notified++; });
      const before = JSON.stringify(project.sweepPlan(grid));
      edit();
      const after = JSON.stringify(project.sweepPlan(grid));
      stop();
      return `${name}: notified=${notified} jobChanged=${before !== after}`;
    });
    expect(report).toEqual([
      'Qms: notified=1 jobChanged=true', 'Sd: notified=1 jobChanged=true', 'Xmax: notified=1 jobChanged=false',
      'Fs: notified=1 jobChanged=true', 'Vas: notified=1 jobChanged=true',
    ]);
  });

  it('maxCurves() and its finiteness check come from the engine', () => {
    const engine = createEngine();
    const project = drivenSealed(engine, 0.03);
    const P: FrequencyGrid = { fmin: 10, fmax: 1000, N: 100 };

    const mx = project.maxCurves(P).values;
    expect(mx).not.toBeNull();
    expect(project.classifyMaxFinite(mx!)).toBe(engine.simulation.classifyMaxFinite(mx!));
  });

  it('rolloffFreq() finds F3 below the passband, and F6 below F3', () => {
    const engine = createEngine();
    const project = drivenSealed(engine, 0.03);
    const sw = project.sweep({ fmin: 10, fmax: 1000, N: 400 }).values!;

    const f3 = project.rolloffFreq(sw, 3);
    const f6 = project.rolloffFreq(sw, 6);

    expect(f3).toBe(engine.simulation.rolloffFreq(sw, 3));
    expect(f6!).toBeLessThan(f3!);
  });

  it('passbandRef() and the response classifiers agree with the engine', () => {
    const engine = createEngine();
    const project = drivenSealed(engine, 0.03);
    const sw = project.sweep({ fmin: 10, fmax: 1000, N: 200 }).values!;

    expect(project.passbandRef(sw.spl)).toBe(engine.simulation.passbandRef(sw.spl));
    expect(project.classifyFinite(sw)).toBe(engine.simulation.classifyFinite(sw));
    expect(project.classifyFlatClamp(sw)).toBe(engine.simulation.classifyFlatClamp(sw));
  });

  it('classifyFiniteIssues() — the per-output finiteness check — also comes from the engine', () => {
    // BUG_20260906: a UI-layer caller wanting the per-output variant (one chart needs one
    // specific cause) had no project delegate to ask, so it reached around the project and
    // constructed its own `createEngine()` — the exact "a UI layer decides a domain question for
    // itself" shape the project's other three classify delegates already exist to prevent.
    const engine = createEngine();
    const project = drivenSealed(engine, 0.03);
    const sw = project.sweep({ fmin: 10, fmax: 1000, N: 200 }).values!;

    expect(project.classifyFiniteIssues(sw)).toEqual(engine.simulation.classifyFiniteIssues(sw));
  });

  it('boxParamsIssues() reports a bad parameter set BEFORE a sweep is attempted', () => {
    const engine = createEngine();
    const project = drivenSealed(engine, 0.03);

    expect(project.boxParamsIssues()).toEqual([]);
    // A zero-volume box is not a very small box; it is no box. Entered after the build, since a
    // builder fills an unstated volume with the type's starting value.
    const zeroVolume = drivenSealed(engine, 0.03);
    zeroVolume.box.sealed.volume_m3.set(0);
    expect(zeroVolume.boxParamsIssues().length).toBeGreaterThan(0);
  });

  it('impedancePeak() reads the resonance off the CURVE, near the sealed prediction', () => {
    const engine = createEngine();
    const project = drivenSealed(engine, 0.03);
    const sw = project.sweep({ fmin: 10, fmax: 1000, N: 800 }).values!;

    const peak = project.impedancePeak(sw);
    expect(peak).not.toBeNull();
    // A sealed box always raises resonance above the driver's free-air Fs of 30 Hz.
    expect(peak!.Fsc).toBeGreaterThan(30);
  });
});

// Block C is GONE. It tested `vas_m3`, `cmsForVas_m_per_N`, `fsWithAddedMass_hz`, `mmdForFs_kg`,
// `qms` and `rmsForQms_kg_per_s` on the radiator — six engine delegations with no production
// caller. The engine's `prVas`/`prCmsFromVas`/`prFsWithMass`/`prMmdFromFs`/`prQms`/`prRmsFromQms`
// are where those relations live and where they should be tested.


describe('D — the vent', () => {
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

describe('E — the signal', () => {
  const complete = (engine: Engine) => driverFromSpec(engine, {
    Fs_hz: 30, Qes: 0.4, Qms: 4, Qts: 1 / (1 / 4 + 1 / 0.4), Re_ohm: 6.4,
    Sd_m2: 0.02, Cms_m_per_N: 0.0005, Vas_m3: 0.05, BL_Tm: 8, Mms_kg: 0.05,
  });

  // Drive power P and drive voltage V (John 2026-09-24, docs/plans/PLAN_RADIATOR_ALWAYS_PRESENT_AND_SIGNAL_PAIR.md
  // Part 2). V is never absent: a sweep always has a voltage. While Re is known, P = V²/Re and
  // whichever of P/V was entered last is the entered one.
  const withRe = (engine: Engine) => driverFromSpec(engine, { Fs_hz: 30, Re_ohm: 8 });
  const noRe = (engine: Engine) => driverFromSpec(engine, { Fs_hz: 30 });
  const projectOf = (engine: Engine, driver: ReturnType<typeof withRe>) =>
    new ProjectBuilder(driver, engine).sealed().volume_m3(0.03).build();

  it('new project — pre: Re 8, nothing stated | trigger: build | post: P 1 E, V 2.83 C', () => {
    const engine = createEngine();
    const p = projectOf(engine, withRe(engine));
    expect(p.powerDrive_W.value).toBe(1);
    expect(p.powerDrive_W.entered).toBe(true);
    expect(p.driveVoltage_V.value).toBeCloseTo(Math.sqrt(8.1), 12);
    expect(p.driveVoltage_V.calculated).toBe(true);
  });

  it('scenario 1 — pre: Re none, nothing stated | trigger: build | post: P N, V 1 C', () => {
    const engine = createEngine();
    const p = projectOf(engine, noRe(engine));
    expect(p.powerDrive_W.value).toBe(null);
    expect(p.driveVoltage_V.value).toBe(1);
    expect(p.driveVoltage_V.calculated).toBe(true);
  });

  it('scenario 2 — pre: Re none, P N, V 1 C | trigger: type V 4 | post: P N, V 4 E', () => {
    const engine = createEngine();
    const p = projectOf(engine, noRe(engine));
    p.driveVoltage_V.set(4);
    expect(p.driveVoltage_V.value).toBe(4);
    expect(p.driveVoltage_V.entered).toBe(true);
    expect(p.powerDrive_W.value).toBe(null);
  });

  it('scenario 3 — pre: Re none, P N, V 3 E | trigger: type P 2 | post: refused; P N with dq naming Re, V 3 E', () => {
    const engine = createEngine();
    const p = projectOf(engine, noRe(engine));
    p.driveVoltage_V.set(3);
    expect(() => p.powerDrive_W.set(2)).toThrow(/Re_ohm/);
    expect(p.driveVoltage_V.value).toBe(3);
    expect(p.driveVoltage_V.entered).toBe(true);
    expect(p.powerDrive_W.value).toBe(null);
    const dq = p.powerDrive_W.dq[0];
    expect(dq).toMatchObject({ kind: 'missing-dependencies', target: 'power_W' });
    if (dq?.kind === 'missing-dependencies') expect(dq.routes[0].missing).toContain('Re_ohm');
  });

  it('scenario 4 — pre: Re 8, P 2 E, V 4 C | trigger: clear V | post: P 1 E, V 2.83 C', () => {
    const engine = createEngine();
    const p = projectOf(engine, withRe(engine));
    p.powerDrive_W.set(2);
    expect(p.driveVoltage_V.value).toBeCloseTo(Math.sqrt(16.2), 12);
    p.driveVoltage_V.clear();
    expect(p.powerDrive_W.value).toBe(1);
    expect(p.powerDrive_W.entered).toBe(true);
    expect(p.driveVoltage_V.value).toBeCloseTo(Math.sqrt(8.1), 12);
    expect(p.driveVoltage_V.calculated).toBe(true);
  });

  it('scenario 5 — pre: Re 8, P 2 E, V 4 C | trigger: clear P | post: P 2 C, V 4 E', () => {
    const engine = createEngine();
    const p = projectOf(engine, withRe(engine));
    p.powerDrive_W.set(2);
    p.powerDrive_W.clear();
    expect(p.driveVoltage_V.value).toBeCloseTo(Math.sqrt(16.2), 12);
    expect(p.driveVoltage_V.entered).toBe(true);
    expect(p.powerDrive_W.value).toBeCloseTo(2, 12);
    expect(p.powerDrive_W.calculated).toBe(true);
  });

  it('scenario 6 — pre: Re 8, P 5 E, V 6.32 C | trigger: remove Re | post: P N, V 6.32 E; then trigger: Re 8 | post: P 5 C, V 6.32 E', () => {
    const engine = createEngine();
    const p = projectOf(engine, withRe(engine));
    p.powerDrive_W.set(5);
    p.driver.specs.Re_ohm.clear();
    expect(p.powerDrive_W.value).toBe(null);
    expect(p.driveVoltage_V.value).toBeCloseTo(Math.sqrt(40.5), 12);
    expect(p.driveVoltage_V.entered).toBe(true);

    p.driver.specs.Re_ohm.set(8);
    expect(p.driveVoltage_V.value).toBeCloseTo(Math.sqrt(40.5), 12);
    expect(p.driveVoltage_V.entered).toBe(true);
    expect(p.powerDrive_W.value).toBeCloseTo(5, 12);
    expect(p.powerDrive_W.calculated).toBe(true);
  });

  it('scenario 7 — pre: Re 8, P 2 C, V 4 E | trigger: remove Re | post: P N, V 4 E', () => {
    const engine = createEngine();
    const p = projectOf(engine, withRe(engine));
    p.driveVoltage_V.set(4);
    expect(p.powerDrive_W.value).toBeCloseTo(16 / 8.1, 12);
    expect(p.powerDrive_W.calculated).toBe(true);
    p.driver.specs.Re_ohm.clear();
    expect(p.driveVoltage_V.value).toBe(4);
    expect(p.driveVoltage_V.entered).toBe(true);
    expect(p.powerDrive_W.value).toBe(null);
  });

  it('pre: Re 8, P 2 C, V 4 E | trigger: type P 8 | post: P 8 E, V 8 C', () => {
    const engine = createEngine();
    const p = projectOf(engine, withRe(engine));
    p.driveVoltage_V.set(4);
    p.powerDrive_W.set(8);
    expect(p.powerDrive_W.entered).toBe(true);
    expect(p.driveVoltage_V.calculated).toBe(true);
    expect(p.driveVoltage_V.value).toBeCloseTo(Math.sqrt(64.8), 12);
  });

  it('pre: Re none, P N, V 4 E | trigger: clear V | post: P N, V 1 C', () => {
    const engine = createEngine();
    const p = projectOf(engine, noRe(engine));
    p.driveVoltage_V.set(4);
    p.driveVoltage_V.clear();
    expect(p.driveVoltage_V.value).toBe(1);
    expect(p.driveVoltage_V.calculated).toBe(true);
  });

  it('pre: Re none, P N, V 1 C | trigger: Re 8 | post: P 1 E, V 2.83 C', () => {
    const engine = createEngine();
    const p = projectOf(engine, noRe(engine));
    p.driver.specs.Re_ohm.set(8);
    expect(p.powerDrive_W.value).toBe(1);
    expect(p.powerDrive_W.entered).toBe(true);
    expect(p.driveVoltage_V.value).toBeCloseTo(Math.sqrt(8.1), 12);
  });

  it('pre: Re 8, P 1 E, V 2.83 C | trigger: type V 0.005 or a P driving below 10 mV | post: refused, unchanged', () => {
    const engine = createEngine();
    const p = projectOf(engine, withRe(engine));
    expect(() => p.driveVoltage_V.set(0.005)).toThrow(/10 mV/);
    expect(() => p.driveVoltage_V.set(0)).toThrow(/10 mV/);
    expect(() => p.powerDrive_W.set(0)).toThrow(/10 mV/);
    expect(() => p.powerDrive_W.set(0.00001)).toThrow(/10 mV/);
    expect(p.powerDrive_W.value).toBe(1);
    expect(p.driveVoltage_V.value).toBeCloseTo(Math.sqrt(8.1), 12);
    p.driveVoltage_V.set(0.01);
    expect(p.driveVoltage_V.value).toBe(0.01);
  });

  it('pre: Re 6.4, P 1 E, V 2.53 C | trigger: clear P | post: P 1 C, V 2.53 E, sweep draws', () => {
    const engine = createEngine();
    const project = new ProjectBuilder(complete(engine), engine).sealed().volume_m3(0.03).build();
    const grid: FrequencyGrid = { fmin: 10, fmax: 1000, N: 50 };
    project.powerDrive_W.clear();
    expect(project.powerDrive_W.value).toBeCloseTo(1, 12);
    expect(project.powerDrive_W.calculated).toBe(true);
    expect(project.driveVoltage_V.value).toBeCloseTo(Math.sqrt(6.5), 12);
    expect(project.driveVoltage_V.entered).toBe(true);
    expect(project.sweep(grid).values).not.toBeNull();
  });

  it('pre: Re 6.4, P 1 E, V 2.53 C | trigger: swap to a driver with Re 8 | post: P 1 E, V 2.83 C', () => {
    const engine = createEngine();
    const project = new ProjectBuilder(complete(engine), engine).sealed().volume_m3(0.03).build();
    const replacement = complete(engine);
    replacement.specs.Re_ohm.set(8);

    project.setDriver(replacement);

    expect(project.powerDrive_W.value).toBe(1);
    expect(project.driveVoltage_V.value).toBeCloseTo(Math.sqrt(8.1), 12);
    expect(project.powerDrive_W.dq).toEqual([]);
    expect(project.driveVoltage_V.dq).toEqual([]);
  });

  it('sourceLoadedQts() RAISES Qts as the source impedance grows, and matches the engine', () => {
    const engine = createEngine();
    const project = new ProjectBuilder(complete(engine), engine).sealed().volume_m3(0.03).build();
    const Qts = 1 / (1 / 4 + 1 / 0.4);

    // A perfect voltage source (Rs = 0) leaves Qts alone.
    expect(project.driver.sourceLoadedQts(0)!).toBeCloseTo(Qts, 10);
    expect(project.driver.sourceLoadedQts(2)!).toBe(engine.driver.sourceLoadedQts(4, 0.4, 6.4, 2, Qts));
    expect(project.driver.sourceLoadedQts(2)!).toBeGreaterThan(project.driver.sourceLoadedQts(0)!);
  });

  it('sourceLoadedQts() is null when the driver\'s Q group cannot be resolved', () => {
    const engine = createEngine();
    const project = new ProjectBuilder(driverFromSpec(engine, { Fs_hz: 30 }), engine).sealed().volume_m3(0.03).build();

    expect(project.driver.sourceLoadedQts(2)).toBeNull();
  });
});

describe('K — the root surface names the engine door', () => {
  it('@openisd/design (the root barrel) re-exports createEngine — the same factory the engine door exports', () => {
    // `.` in the design package exports map resolves to `domain/index.ts`, so a consumer that
    // wants to build a project that runs the engine gets ONE import specifier — no need to reach
    // into `@openisd/design/engine` for the factory the domain already takes as a collaborator.
    expect(rootCreateEngine).toBe(createEngine);
    expect(typeof rootCreateEngine).toBe('function');
    expect(rootCreateEngine().simulation.sweep).toBe(createEngine().simulation.sweep);
  });
});

// The voice-coil block is GONE. It tested `terminalRe_ohm`/`terminalBL_Tm` as driver methods.
// They are now engine functions, and the terminal values are their OWN fields on
// `DriverSolverQuantities` rather than a rewrite of `Re_ohm`/`BL_Tm` — so what needs covering is that
// the stated per-coil value SURVIVES, which is a different assertion from the one this block made.
