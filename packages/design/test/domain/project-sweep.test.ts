import {describe, expect, it} from 'vitest';
import {type Engine, createEngine} from '@openisd/design/engine';
import {ProjectBuilder, type FrequencyGrid} from '../../domain/index.js';
import {driverFromSpec, radiatorFromSpec} from '../fixtures/recordBuilders.js';

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

describe('OpenISDProject sweep', () => {
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

  it('sweep() is null for a box with a chamber volume missing, and NOT for a stated one', () => {
    const engine = createEngine();
    const project = drivenSealed(engine, 0.03);
    const P: FrequencyGrid = { fmin: 10, fmax: 1000, N: 50 };

    expect(project.sweep(P).values).not.toBeNull();

    // A new bandpass6 states its starting volumes; with the rear one retracted there is nothing to simulate.
    project.box.boxType.set('bandpass6');
    expect(project.sweep(P).values).not.toBeNull();
    project.box.bandpass6.chambers.rear.volume_m3.clear();
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

  // Regression for bugs/archive/BUG_20261003*.md
  it('editing the radiator Qms moves the sweep; Qms sets the radiator loss', () => {
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

  // Regression for bugs/archive/BUG_20261003*.md
  it('a radiator Qms, Sd, Fs or Vas edit (not Xmax) notifies the project and changes its sweep job', () => {
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
