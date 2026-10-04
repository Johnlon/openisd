import {describe, expect, it, vi} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {OpenISDProject, ProjectBuilder} from '../../domain/index.js';
import {isRecord, at, ignoredIssue, specSection, specSectionNoRms, tuneSpec, driverFrom} from '../fixtures/domainBuilders.js';

describe('OpenISDBox alignments', () => {
  describe('OpenISDBox — every alignment, as a window onto the project record', () => {
    const project = () => new ProjectBuilder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), createEngine()).sealed().volume_m3(0.03).build();

    it('new projects use the copper voice-coil temperature coefficient default', () => {
      expect(project().alfaVC_per_K.value).toBe(0.0039);
    });

    it('writes the sealed volume through to the project', () => {
      const p = project();
      p.box.sealed.volume_m3.set(0.03);
      expect(p.box.sealed.volume_m3.value).toBe(0.03);
    });

    it('gets sealed resonance FROM THE INJECTED ENGINE, and it rises above the driver\'s Fs', () => {
      // The domain does none of this arithmetic — it hands the driver's stored values, the volume,
      // the losses and the project's environment to the engine and reports what comes back
      // (John 2026-08-26: "geom is in and accoustic is absolutely out").
      const p = project();
      p.box.sealed.volume_m3.set(0.03);

      const fc = p.box.sealed.resonance_hz.value;
      // A sealed box always raises resonance above the driver's free-air Fs of 30 Hz.
      expect(fc).not.toBeNull();
      expect(fc!).toBeGreaterThan(30);
    });

    it('answers null for sealed resonance when there is no enclosure to resonate', () => {
      // Absence is null here as everywhere — never NaN, never 0, and never a throw. A zero volume
      // is not a very small box; it is no box.
      const p = project();
      p.box.sealed.volume_m3.set(0);
      expect(p.box.sealed.resonance_hz.value).toBeNull();
    });

    it('still resolves a resonance when the source-loaded Q feed is missing Qms/Qes/Re_ohm', () => {
      // `sourceLoadedQts` falls back to NaN for whichever of Qms/Qes/Re_ohm is unstated (its own
      // contract). Without `Rms_kg_per_s` there is no mechanical route to Qms either, so all three
      // are genuinely unstated here — Fs/Vas/Qts alone are enough to keep resonance itself answerable.
      const p = new ProjectBuilder(driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSectionNoRms({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Xmax_m: 0.008 }),
      }), createEngine()).sealed().volume_m3(0.03).build();
      const ts = p.driver.specs;
      expect(ts.Qms.value).toBeNull();
      expect(ts.Qes.value).toBeNull();
      expect(ts.Re_ohm.value).toBeNull();

      expect(p.box.sealed.resonance_hz.value).not.toBeNull();
    });

    it('answers null for sealed resonance when the driver states no Q at all — nothing to invert', () => {
      // No `Qts` and no `Qes`/`Qms` pair to derive it from either: the guard is about Q, not
      // volume, so the box volume here is the same real 0.03 m³ the passing tests use.
      const p = new ProjectBuilder(driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSectionNoRms({ Fs_hz: 30, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Xmax_m: 0.008 }),
      }), createEngine()).sealed().volume_m3(0.03).build();
      expect(p.driver.specs.Qts.value).toBeNull();

      expect(p.box.sealed.resonance_hz.value).toBe(null);
      expect(p.box.sealed.resonance_hz.value).toBeNull();
    });

    it('exposes sealed resonance as a precomputed field whose cell state follows the data', () => {
      // The upgrade contract (Task 1/3): a ReadonlyField, not a method — its cell state
      // reports not-available until the volume is known, calculated once it is.
      const p = project();
      expect(p.box.sealed.resonance_hz.calculated).toBe(true);
      expect(p.box.sealed.resonance_hz.value).not.toBeNull();
      const ventedOnly = new ProjectBuilder(driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
      }), createEngine()).vented().volume_m3(0.05).tuning_goal_hz(40).build();
      expect(ventedOnly.box.sealed.resonance_hz.value).toBe(null);
      expect(ventedOnly.box.sealed.resonance_hz.value).toBeNull();
    });

    it('a smaller box raises the resonance further — the engine is really being consulted', () => {
      // Non-vacuity: a hardcoded or stubbed value would not move with the volume.
      const big = project();  big.box.sealed.volume_m3.set(0.060);
      const small = project(); small.box.sealed.volume_m3.set(0.015);
      expect(small.box.sealed.resonance_hz.value!).toBeGreaterThan(big.box.sealed.resonance_hz.value!);
    });

    it('the sealed resonance is the LOSSY one — it moves when only the leakage changes', () => {
      // The property that separates lossy from lossless, and the one real WinISD demonstrably has:
      // at a fixed volume, `Fr` shifts 5.8 Hz between Ql=10000 and Ql=5 (winisd_research
      // FINDING-007). The lossless formula `Fs·√(1 + Vas/Vb)` cannot see Ql at all, so it returns
      // the same number for both — which is exactly the defect this pins.
      const leaky = new ProjectBuilder(driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
      }), createEngine()).sealed().volume_m3(0.03).build();
      const tight = new ProjectBuilder(driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
      }), createEngine()).sealed().volume_m3(0.03).build();

      leaky.box.sealed.losses.Ql.set(5);
      tight.box.sealed.losses.Ql.set(10000);

      expect(leaky.box.sealed.resonance_hz.value).not.toBeCloseTo(tight.box.sealed.resonance_hz.value!, 3);
    });

    it('feeds the engine the driver\'s SOLVED Vas and the Rg-loaded Qts, not compliance-route Vas and bare Qts (golden Fsc 63.1762 Hz / Qtc 0.5995)', () => {
      // The user-verified golden scene (sealed-fsc-winisd-golden.browser.spec.ts): Fs=40 Vas=7.65 L
      // Qes=0.450 Qms=2.940 Re=6.6 Rg=0.1 Vb=6 L Ql=10 Qa=100 → Fsc 63.1762 Hz, Qtc 0.5995.
      //
      // This is WinISD SEALED, and the engine already reproduces it: the parity feed
      // (winisd-parity-goldens.test.ts "Box.Fr") passes exactly the driver's stored Vas and
      // `sourceLoadedQts(Qms, Qes, Re, Rg, Qts)`. The domain must hand the engine the same two
      // facts — THE SOLVED Vas_m3 (entered, not `Cms·Sd²·ρc²`, which this record does not even
      // carry) and Qts as the amplifier's source impedance loads it — instead of the compliance
      // reconstruction and the bare stored Qts the current feed passes.
      //
      // The bare-Qts feed alone is wrong by 0.040 Hz here, and the compliance feed cannot answer
      // this record at all (Sd/Cms are null), so today the cell reads not-available:
      const p = new ProjectBuilder(driverFrom({
        brand: 'Dayton', model: 'E150HE', section: 'woofer',
        spec: tuneSpec({Fs_hz: 40, Vas_m3: 0.00765, Qes: 0.45, Qms: 2.94, Re_ohm: 6.6}),
      }), createEngine()).sealed().volume_m3(0.006).build();
      p.Rs_ohm.set(0.1);
      p.box.sealed.losses.Ql.set(10);
      p.box.sealed.losses.Qa.set(100);

      // The engine-level numbers, matching the golden to the two display decimals:
      expect(p.box.sealed.resonance_hz.calculated).toBe(true);
      expect(p.box.sealed.resonance_hz.value!).toBeCloseTo(63.1762, 2);
      expect(p.box.sealed.q_tc.value!).toBeCloseTo(0.5995, 2);
    });

    it('computes the sealed system Q (Qtc) — a closed box raises Q above the driver\'s Qts', () => {
      const p = project();   // driver Qts 0.4, sealed volume 0.03
      const q = p.box.sealed.q_tc.value;
      expect(q).not.toBeNull();
      expect(q!).toBeGreaterThan(0.4);
      expect(p.box.sealed.q_tc.calculated).toBe(true);
    });

    it('answers null for sealed Qtc when the enclosure is not set', () => {
      // The sealed box is dormant in a vented project — no volume, so no Q.
      const ventedOnly = new ProjectBuilder(driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
      }), createEngine()).vented().volume_m3(0.05).tuning_goal_hz(40).build();
      expect(ventedOnly.box.sealed.q_tc.value).toBeNull();
      expect(ventedOnly.box.sealed.q_tc.value).toBe(null);
    });

    it('STILL computes plain geometry — a port area is πr², which no model can disagree about', () => {
      const p = project();
      p.box.vented.vent.diameter_m.set(0.1);
      expect(p.box.vented.vent.area_m2.value).toBeCloseTo(Math.PI * 0.05 ** 2, 12);
    });

    it('solves diameter ↔ area for a round vent — entering one calculates the other', () => {
      const p = project();
      p.box.vented.vent.shape.set('round');
      p.box.vented.vent.diameter_m.set(0.1);
      expect(p.box.vented.vent.diameter_m.entered).toBe(true);
      expect(p.box.vented.vent.area_m2.calculated).toBe(true);
      expect(p.box.vented.vent.area_m2.value).toBeCloseTo(Math.PI * 0.05 ** 2, 12);

      p.box.vented.vent.area_m2.set(Math.PI * 0.06 ** 2);
      expect(p.box.vented.vent.area_m2.entered).toBe(true);
      expect(p.box.vented.vent.diameter_m.calculated).toBe(true);
      expect(p.box.vented.vent.diameter_m.value).toBeCloseTo(0.12, 12);
    });

    it('entering the diameter atomically clears a previously entered area, and vice versa', () => {
      const p = project();
      p.box.vented.vent.shape.set('round');
      p.box.vented.vent.area_m2.set(Math.PI * 0.05 ** 2);
      expect(p.box.vented.vent.area_m2.entered).toBe(true);

      p.box.vented.vent.diameter_m.set(0.2);
      expect(p.box.vented.vent.diameter_m.entered).toBe(true);
      expect(p.box.vented.vent.area_m2.entered).toBe(false);
      expect(p.box.vented.vent.area_m2.calculated).toBe(true);
      expect(p.box.vented.vent.area_m2.value).toBeCloseTo(Math.PI * 0.1 ** 2, 12);
    });

    it('solves height ↔ area for a slotted vent against the CURRENT width, itself never solved', () => {
      const p = project();
      p.box.vented.vent.shape.set('slotted');
      p.box.vented.vent.width_m.set(0.2);
      p.box.vented.vent.height_m.set(0.05);
      expect(p.box.vented.vent.area_m2.calculated).toBe(true);
      expect(p.box.vented.vent.area_m2.value).toBeCloseTo(0.01, 12);

      p.box.vented.vent.area_m2.set(0.02);
      expect(p.box.vented.vent.height_m.calculated).toBe(true);
      expect(p.box.vented.vent.height_m.value).toBeCloseTo(0.1, 12);

      // Width moves independently and the solved side tracks it live.
      p.box.vented.vent.width_m.set(0.1);
      expect(p.box.vented.vent.height_m.value).toBeCloseTo(0.2, 12);
    });

    it('a slotted vent cannot solve height from area while width is unset', () => {
      const p = project();
      p.box.vented.vent.shape.set('slotted');
      p.box.vented.vent.area_m2.set(0.02);
      expect(p.box.vented.vent.area_m2.entered).toBe(true);
      expect(p.box.vented.vent.height_m.value).toBeNull();
    });

    it('pre: slotted, width N | trigger: height 0.05 | post: area N — nothing to multiply by', () => {
      const p = project();
      p.box.vented.vent.shape.set('slotted');
      p.box.vented.vent.height_m.set(0.05);
      expect(p.box.vented.vent.area_m2.value).toBeNull();
    });

    it('the sealed volume refuses a solver write — Vb is always the entered side of the alignment', () => {
      const engine = createEngine();
      const solve = vi.spyOn(engine.sealed, 'solve').mockImplementation((params) => {
        params.Vb_m3.setCalculated(0.01);
        return [];
      });
      expect(() => new ProjectBuilder(driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: tuneSpec({Fs_hz: 40, Vas_m3: 0.00765, Qes: 0.45, Qms: 2.94, Re_ohm: 8}),
      }), engine).sealed().volume_m3(0.03).build()).toThrow(/structurally unreachable/);
      expect(solve).toHaveBeenCalled();
    });

    it('sweepN stores a point count and clears back to absent', () => {
      const p = project();
      p.sweepN.set(200);
      expect(p.sweepN.value).toBe(200);
      p.sweepN.set(null);
      expect(p.sweepN.value).toBeNull();
    });

    it('P and V dq writes carry the issue\'s own sentence into the record trail', () => {
      const engine = createEngine();
      const p = new ProjectBuilder(driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: tuneSpec({Fs_hz: 40, Vas_m3: 0.00765, Qes: 0.45, Qms: 2.94, Re_ohm: 8}),
      }), engine).sealed().volume_m3(0.03).build();
      const mark = ignoredIssue('power_W');

      p.powerDrive_W.setDq([mark]);
      p.driveVoltage_V.setDq([mark]);

      const owpr: unknown = JSON.parse(p.toOwprText());
      if (!isRecord(owpr)) throw new Error('expected an object');
      const branch = owpr.edited ?? owpr.saved;
      expect(at(branch, 'signal', 'power_W', 'dq_calculated', 0, 'detail')).toBe(mark.text);
    });

    it('a vent with no stated count STORES one port as a calculated entry — the same route numVC takes', () => {
      const p = project();
      expect(p.box.vented.vent.count.value).toBe(1);
      expect(p.box.vented.vent.count.calculated).toBe(true);
      expect(at(JSON.parse(p.toOwprText()), 'saved', 'box', 'vented', 'vent', 'count')).toMatchObject({ state: 'C', value: 1 });

      // A project saved before ports had a count carries no `count` key at all.
      const parsed: unknown = JSON.parse(p.toOwprText());
      if (!isRecord(parsed)) throw new Error('expected an object');
      const vent = at(parsed, 'saved', 'box', 'vented', 'vent');
      if (!isRecord(vent)) throw new Error('expected saved.box.vented.vent to be an object');
      delete vent.count;
      parsed.edited = null;
      const back = OpenISDProject.fromOwprText(JSON.stringify(parsed), createEngine());
      if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
      expect(back.box.vented.vent.count.value).toBe(1);
      expect(back.box.vented.vent.count.calculated).toBe(true);
    });

    it('a stated count is entered; a count that is not a whole number of at least one is REPAIRED to the calculated 1, not refused', () => {
      const p = project();
      p.box.vented.vent.count.set(2);
      expect(p.box.vented.vent.count.value).toBe(2);
      expect(p.box.vented.vent.count.entered).toBe(true);
      for (const bad of [0, -1, 1.5]) {
        const parsed: unknown = JSON.parse(p.toOwprText());
        if (!isRecord(parsed)) throw new Error('expected an object');
        const vent = at(parsed, 'saved', 'box', 'vented', 'vent');
        if (!isRecord(vent)) throw new Error('expected saved.box.vented.vent to be an object');
        vent.count = { state: 'E', value: bad };
        parsed.edited = null;
        const back = OpenISDProject.fromOwprText(JSON.stringify(parsed), createEngine());
        if (Array.isArray(back)) throw new Error(`count ${bad}: fromOwprText returned problems: ` + back.join(', '));
        expect(back.box.vented.vent.count.value, `count ${bad} reads as 1`).toBe(1);
        expect(back.box.vented.vent.count.calculated, `count ${bad} reads as calculated`).toBe(true);
        // The repair is WRITTEN: the record states the count it is read as, never the bad number.
        expect(at(JSON.parse(back.toOwprText()), 'saved', 'box', 'vented', 'vent', 'count'), `count ${bad} is repaired in the record`)
          .toMatchObject({ state: 'C', value: 1 });
      }
    });

    it('count.clear() restores the stored calculated default, and the field carries the usual write surface', () => {
      const p = project();
      p.box.vented.vent.count.set(3);
      p.save();
      expect(p.box.vented.vent.count.entered).toBe(true);
      expect(at(JSON.parse(p.toOwprText()), 'saved', 'box', 'vented', 'vent', 'count')).toMatchObject({ state: 'E', value: 3 });

      p.box.vented.vent.count.clear();
      p.save();
      expect(p.box.vented.vent.count.value).toBe(1);
      expect(p.box.vented.vent.count.calculated).toBe(true);
      expect(at(JSON.parse(p.toOwprText()), 'saved', 'box', 'vented', 'vent', 'count')).toMatchObject({ state: 'C', value: 1 });

      // Entry-backed like every other field: the same writes, so the resolve can stamp the default.
      expect('setCalculated' in p.box.vented.vent.count).toBe(true);
      expect('setDq' in p.box.vented.vent.count).toBe(true);
    });

    it('reports the TOTAL opening as count × one port\'s area — still plain geometry', () => {
      const p = project();
      p.box.vented.vent.diameter_m.set(0.1);
      p.box.vented.vent.count.set(2);
      expect(p.box.vented.vent.area_m2.value).toBeCloseTo(Math.PI * 0.05 ** 2, 12);
      expect(p.box.vented.vent.totalArea_m2()).toBeCloseTo(2 * Math.PI * 0.05 ** 2, 12);
      p.box.vented.vent.diameter_m.clear();
      expect(p.box.vented.vent.totalArea_m2()).toBeNull();
    });

    // Regression for bugs/archive/BUG_20260924*.md
    it('a driver\'s own c_m_per_s/roo_kg_per_m3 has no effect on box calculations — display only', () => {
      const engine = createEngine();
      const p = new ProjectBuilder(driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
      }), engine).sealed().volume_m3(0.03).build();
      p.box.boxType.set('vented');
      p.box.vented.volume_m3.set(0.05);
      p.box.vented.vent.diameter_m.set(0.1);
      p.box.vented.tuning_goal_hz.set(40);

      // An embedded driver never keeps an entered air of its own — an attempt to set one is
      // always overwritten back to the project's air on the next resolve.
      p.driver.specs.c_m_per_s.set(999);
      p.driver.specs.roo_kg_per_m3.set(999);
      expect(p.driver.specs.c_m_per_s.value).not.toBe(999);
      expect(p.driver.specs.c_m_per_s.entered).toBe(false);
      expect(p.driver.specs.roo_kg_per_m3.value).not.toBe(999);
      expect(p.driver.specs.roo_kg_per_m3.entered).toBe(false);

      // The box's own calculation reaches the project's air directly, not through the driver —
      // flipping the project's air model changes the port length, and matches the engine's own
      // resolve for that model exactly.
      p.envUseWinisdAirModel.set(false);
      const physical = engine.environment.solve({ useWinisdAirModel: false }).values;
      const lengthPhysical = p.box.vented.vent.length_m.value;
      p.envUseWinisdAirModel.set(true);
      const winisd = engine.environment.solve({ useWinisdAirModel: true }).values;
      const lengthWinisd = p.box.vented.vent.length_m.value;

      expect(physical).not.toEqual(winisd);
      expect(lengthPhysical).not.toBeCloseTo(lengthWinisd!, 12);
      expect(p.driver.specs.c_m_per_s.value).toBeCloseTo(winisd.c, 9);
      expect(p.driver.specs.roo_kg_per_m3.value).toBeCloseTo(winisd.rho, 9);
    });

    it('two ports of the same size need a LONGER port than one for the same tuning', () => {
      const p = project();
      p.box.boxType.set('vented');
      p.box.vented.volume_m3.set(0.05);
      p.box.vented.vent.diameter_m.set(0.1);
      p.box.vented.tuning_goal_hz.set(40);
      const one = p.box.vented.vent.length_m.value;
      p.box.vented.vent.count.set(2);
      const two = p.box.vented.vent.length_m.value;
      if (one === null || two === null) throw new Error('port length did not solve');
      expect(two).toBeGreaterThan(one);
    });

    it('a vent defaults to TWO FREE ENDS end correction (0.613), not a value no option matches', () => {
      // BUG_20260912 #10: the old 0.6 default matched none of the UI's END_CORRECTION_OPTIONS, so
      // the end-correction select rendered blank. The default is WinISD's "two free ends", 0.613.
      const p = project();
      expect(p.box.vented.vent.endCorrection_m.value).toBe(0.613);
    });

    it('gets the port\'s ACOUSTIC length from the engine, end correction and all', () => {
      const p = project();
      p.box.vented.vent.diameter_m.set(0.1);
      p.box.vented.vent.length_m.set(0.2);

      const area = Math.PI * 0.05 ** 2;
      const engine = createEngine();
      expect(p.box.vented.vent.effectiveLength_m()).toBe(
        engine.vent.effectiveLength(0.2, area, 1, p.box.vented.vent.endCorrection_m.value),
      );
      // And it is LONGER than the port measures — that is what an end correction does.
      expect(p.box.vented.vent.effectiveLength_m()!).toBeGreaterThan(0.2);
    });

    it('reports an unset tuning as not-available rather than zero', () => {
      const p = project();
      p.box.vented.volume_m3.set(0.05);

      expect(p.box.vented.volume_m3.value).toBe(0.05);
      expect(p.box.vented.tuning_goal_hz.value).toBe(null);
      expect(p.box.vented.tuning_goal_hz.value).toBeNull();
    });

    it('computes vent area from whichever dimensions the vent SHAPE actually uses', () => {
      const p = project();
      p.box.vented.vent.shape.set('round');
      p.box.vented.vent.diameter_m.set(0.1);
      expect(p.box.vented.vent.area_m2.value).toBeCloseTo(Math.PI * 0.05 ** 2, 12);

      p.box.vented.vent.shape.set('slotted');
      // Round diameter is still stored but no longer consulted — area is unanswerable until the
      // slot's own dimensions are given, and unanswerable is null, the same as everywhere else.
      expect(p.box.vented.vent.area_m2.value).toBeNull();
      p.box.vented.vent.width_m.set(0.2);
      p.box.vented.vent.height_m.set(0.05);
      expect(p.box.vented.vent.area_m2.value).toBeCloseTo(0.01, 12);
    });

    it('gives ABC three ports, none of them owned by a chamber', () => {
      const p = project();
      p.box.abc.vents.rear.diameter_m.set(0.08);
      p.box.abc.vents.front.diameter_m.set(0.09);
      p.box.abc.vents.intra.diameter_m.set(0.05);

      expect(p.box.abc.vents.rear.diameter_m.value).toBe(0.08);
      expect(p.box.abc.vents.front.diameter_m.value).toBe(0.09);
      expect(p.box.abc.vents.intra.diameter_m.value).toBe(0.05);
      // Two chambers only — the connecting port is not a third one.
      expect(Object.keys(p.box.abc.chambers)).toEqual(['rear', 'front']);
    });

    it('tunes bandpass6 chambers independently of each other', () => {
      const p = project();
      p.box.bandpass6.chambers.rear.tuning_goal_hz.set(40);
      p.box.bandpass6.chambers.front.tuning_goal_hz.set(80);

      expect(p.box.bandpass6.chambers.rear.tuning_goal_hz.value).toBe(40);
      expect(p.box.bandpass6.chambers.front.tuning_goal_hz.value).toBe(80);
    });

    // Regression for bugs/archive/BUG_20260824*.md
    it('keeps per-chamber losses separate', () => {
      const p = project();
      p.box.bandpass4.chambers.rear.losses.Ql.set(5);
      p.box.bandpass4.chambers.front.losses.Ql.set(9);

      expect(p.box.bandpass4.chambers.rear.losses.Ql.value).toBe(5);
      expect(p.box.bandpass4.chambers.front.losses.Ql.value).toBe(9);
    });

    it('exposes bandpass4 rear resonance as a precomputed field, null until the rear volume is known', () => {
      // Task 4/5: the rear chamber is sealed, so its resonance (WinISD's "Frc") is a
      // ReadonlyField — read as precomputed state, never a method.
      const p = project(); // a sealed project — bandpass4 is dormant, so its rear volume is unset
      expect(p.box.bandpass4.chambers.rear.resonance_hz.value).toBe(null);
      expect(p.box.bandpass4.chambers.rear.resonance_hz.value).toBeNull();

      const bp4 = new ProjectBuilder(driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
      }), createEngine()).bandpass4().rearVolume_m3(0.02).frontVolume_m3(0.03).frontTuning_hz(40).build();
      expect(bp4.box.bandpass4.chambers.rear.resonance_hz.calculated).toBe(true);
      expect(bp4.box.bandpass4.chambers.rear.resonance_hz.value).not.toBeNull();
    });

    it('exposes bandpass4 rear Qtc on the same lossless model as Frc', () => {
      const bp4 = new ProjectBuilder(driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
      }), createEngine()).bandpass4().rearVolume_m3(0.02).frontVolume_m3(0.03).frontTuning_hz(40).build();
      const qtc = bp4.box.bandpass4.chambers.rear.q_tc;
      expect(qtc.calculated).toBe(true);
      // Qtc/Qts = Frc/Fs for a lossless sealed chamber (Qts is the source-loaded one, ≈0.4 here).
      const frc = bp4.box.bandpass4.chambers.rear.resonance_hz.value ?? 0;
      expect(qtc.value).toBeCloseTo(0.4 * frc / 30, 1);
    });

    it('gives the bandpass4 front volume a Field readout like every other chamber', () => {
      // The front chamber volume carries entered/calculated status like the rear chamber,
      // not a bare SimpleField.
      const bp4 = new ProjectBuilder(driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
      }), createEngine()).bandpass4().rearVolume_m3(0.02).frontVolume_m3(0.03).frontTuning_hz(40).build();
      expect(bp4.box.bandpass4.chambers.front.volume_m3.value).toBe(0.03);
      expect(bp4.box.bandpass4.chambers.front.volume_m3.entered).toBe(true);
    });
  });

  describe('sealed joins the cascade: box.sealed.q_tc is an entry the resolve writes', () => {
    const sealedProject = () => new ProjectBuilder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), createEngine()).sealed().volume_m3(0.03).build();

    it('a sealed project gets its Qtc solved into the record as a calculated entry, not a ' +
       'live recompute — it round-trips through .owpr text as a stored "C" entry', () => {
      const p = sealedProject();
      const cell = p.box.sealed.q_tc;
      expect(cell.calculated).toBe(true);
      expect(cell.value).toBeCloseTo(p.box.sealed.q_tc.value!, 12);

      const parsed: unknown = JSON.parse(p.toOwprText());
      expect(at(parsed, 'saved', 'box', 'sealed', 'Qtc')).toMatchObject({ state: 'C' });
      expect(at(parsed, 'saved', 'box', 'sealed', 'Qtc', 'value')).toBeCloseTo(cell.value!, 6);
    });

    it('exactly one engine.solveSealedAlignment call per field set(), and zero for a bare ' +
       'project.box read', () => {
      const engine = createEngine();
      const p = new ProjectBuilder(driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
      }), engine).sealed().volume_m3(0.03).build();

      const readSpy = vi.spyOn(engine.sealed, 'solve');
      void p.box;
      void p.box.sealed.q_tc.value;
      expect(readSpy).toHaveBeenCalledTimes(0);
      readSpy.mockRestore();

      const writeSpy = vi.spyOn(engine.sealed, 'solve');
      p.box.sealed.losses.Ql.set(12);
      expect(writeSpy).toHaveBeenCalledTimes(1);
    });

    it('a vented project leaves box.sealed.Qtc not-available — only the active box type ' +
       'joins the cascade', () => {
      const ventedOnly = new ProjectBuilder(driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
      }), createEngine()).vented().volume_m3(0.05).tuning_goal_hz(40).build();
      expect(ventedOnly.box.sealed.q_tc.value).toBe(null);
    });
  });

  describe('box tuning/length/mass slots load as entries', () => {
    function ventedProject() {
      return new ProjectBuilder(driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
      }), createEngine()).vented().volume_m3(0.05).tuning_goal_hz(40).build();
    }

    /** Round-trips `project` through `.owpr` text with `mutate` applied to the parsed JSON's
     *  `saved` (and `edited`, when present) sections first — the seam every box-slot-entry test
     *  below drives a stored JSON shape through. */
    function reloadWith(project: OpenISDProject, mutate: (box: unknown) => void): OpenISDProject | string[] {
      const parsed: unknown = JSON.parse(project.toOwprText());
      if (!isRecord(parsed)) throw new Error('expected an object');
      mutate(at(parsed, 'saved', 'box'));
      const edited = parsed.edited;
      if (edited) mutate(at(edited, 'box'));
      return OpenISDProject.fromOwprText(JSON.stringify(parsed), createEngine());
    }

    it('a vent length_m entry with state "C" loads as a calculated cell', () => {
      // boxType stays 'sealed' in this fixture's mutation (S2-7d2: the project cascade only
      // re-solves the ACTIVE box type's vent pair) — this test is about JSON round-trip fidelity
      // for the entry SHAPE, not about whether a resolve leaves an inactive pair alone.
      const back = reloadWith(ventedProject(), (box) => {
        if (!isRecord(box)) throw new Error('expected the box object');
        box.boxType = 'sealed';
        const vent = at(box, 'vented', 'vent');
        if (!isRecord(vent)) throw new Error('expected box.vented.vent to be an object');
        vent.length_m = { state: 'C', value: 0.2 };
      });
      if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
      const cell = back.box.vented.vent.length_m;
      expect(cell.value).toBe(0.2);
      expect(cell.calculated).toBe(true);
    });

    it('the legacy null shape for a box entry slot is rejected, not silently accepted', () => {
      const back = reloadWith(ventedProject(), (box) => {
        const vent = at(box, 'vented', 'vent');
        if (!isRecord(vent)) throw new Error('expected box.vented.vent to be an object');
        vent.length_m = null;
      });
      if (!Array.isArray(back)) throw new Error('expected problems, got a project');
      expect(back.length).toBeGreaterThan(0);
    });

  });
});
