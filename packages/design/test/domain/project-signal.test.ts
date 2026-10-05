import {describe, expect, it} from 'vitest';
import {type Engine, createEngine} from '@openisd/design/engine';
import {ProjectBuilder, type FrequencyGrid} from '../../domain/index.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';
import {sealedProject} from '../fixtures/domainBuilders.js';

describe('OpenISDProject signal', () => {
  describe('engine-driven drive power and voltage', () => {
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

  describe('drive power and voltage on a sealed project', () => {
      it('pre: Re none, P N, V 1 C | set Re 6, type P 4 | post: P 4 E, V √24 C', () => {
        const p = sealedProject();
        expect(p.driveVoltage_V.value).toBe(1);
        expect(p.driveVoltage_V.calculated).toBe(true);
        expect(p.powerDrive_W.value).toBe(null);

        p.driver.specs.Re_ohm.set(6);
        p.powerDrive_W.set(4);
        expect(p.powerDrive_W.entered).toBe(true);
        expect(p.driveVoltage_V.calculated).toBe(true);
        expect(p.driveVoltage_V.value).toBeCloseTo(Math.sqrt(4 * 6.1), 6);
      });

      it('driveVoltage_V and powerDrive_W each carry both the owner\'s and the solver\'s writes', () => {
        const p = sealedProject();
        for (const f of [p.driveVoltage_V, p.powerDrive_W]) {
          expect('set' in f).toBe(true);
          expect('clear' in f).toBe(true);
          expect('setCalculated' in f).toBe(true);
          expect('entered' in f).toBe(true);
        }
        // V is never absent, so the solver has no "could not derive" write on it.
        expect('setNotAvailable' in p.driveVoltage_V).toBe(false);
        expect('setNotAvailable' in p.powerDrive_W).toBe(true);
      });

      it('pre: Re 6, P 1 E, V √6 C | save | post: the record stores P as E and V as C', () => {
        const p = sealedProject();
        p.driver.specs.Re_ohm.set(6);
        expect(p.powerDrive_W.value).toBe(1);
        p.save();
        expect(p.cloneSavedProject().signal.power_W).toMatchObject({ state: 'E', value: 1 });
        expect(p.cloneSavedProject().signal.voltage_V).toMatchObject({ state: 'C' });
      });

      it('pre: Re none, P N, V 1 C | read P | post: P N, dq names Re_ohm', () => {
        const p = sealedProject();
        const dq = p.powerDrive_W.dq[0];
        expect(dq).toMatchObject({ kind: 'missing-dependencies', target: 'power_W' });
        if (dq?.kind === 'missing-dependencies') expect(dq.routes[0].missing).toContain('Re_ohm');
      });

      // "Driver input voltage (each)": N drivers share the power, each fed P/N, so
      // V_each = √(P/N · (Re+Rs)) and P = N·V_each²/(Re+Rs) (WinISD, winisd_research nd-1).
      // BUG_20261005_drive-voltage-each-stale-with-driver-count.
      it('pre: Re 6, P 1 E, N 1 | N → 4 | post: V each = √(6.1/4) C, P 1 E', () => {
        const p = sealedProject();
        p.driver.specs.Re_ohm.set(6);
        p.nDrivers.set(4);
        expect(p.powerDrive_W.value).toBe(1);
        expect(p.powerDrive_W.entered).toBe(true);
        expect(p.driveVoltage_V.value).toBeCloseTo(Math.sqrt(6.1 / 4), 12);
        expect(p.driveVoltage_V.calculated).toBe(true);
      });

      it('pre: Re 6, N 4 | type V each 2 | post: P = 4·4/6.1 C', () => {
        const p = sealedProject();
        p.driver.specs.Re_ohm.set(6);
        p.nDrivers.set(4);
        p.driveVoltage_V.set(2);
        expect(p.driveVoltage_V.value).toBe(2);
        expect(p.powerDrive_W.calculated).toBe(true);
        expect(p.powerDrive_W.value).toBeCloseTo(16 / 6.1, 12);
      });

      it('pre: Re 6, N 4, V each 2 E | N → 1 | post: P = 4/6.1 C, V 2 E', () => {
        const p = sealedProject();
        p.driver.specs.Re_ohm.set(6);
        p.nDrivers.set(4);
        p.driveVoltage_V.set(2);
        p.nDrivers.set(1);
        expect(p.driveVoltage_V.value).toBe(2);
        expect(p.driveVoltage_V.entered).toBe(true);
        expect(p.powerDrive_W.value).toBeCloseTo(4 / 6.1, 12);
      });

      it('pre: Re 6, N 4 | the sweep runs at V each', () => {
        const p = sealedProject();
        p.driver.specs.Re_ohm.set(6);
        p.nDrivers.set(4);
        const plan = p.sweepPlan({fmin: 10, fmax: 1000, N: 10});
        if (plan.kind !== 'ready') throw new Error('sweep blocked');
        expect(plan.job.sweep.eg).toBeCloseTo(Math.sqrt(6.1 / 4), 12);
      });

      it('pre: Re none, P N, V 1 C | type V 10 | post: P N, V 10 E', () => {
        const p = sealedProject();
        p.driveVoltage_V.set(10);
        expect(p.driveVoltage_V.value).toBe(10);
        expect(p.driveVoltage_V.entered).toBe(true);
        expect(p.powerDrive_W.value).toBe(null);
      });
  });
});
