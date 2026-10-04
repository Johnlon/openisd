import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/index.js';
import {specSection, driverFrom} from '../fixtures/domainBuilders.js';

describe('ProjectBuilder', () => {
  describe('OpenISDProject.builder — bandpass6 and abc share TwoChamberProjectBuilder, both chambers independently tunable', () => {
    const driver = () => {
      const d = driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
      });
      // The field-only tests below never sweep, but this describe block's own sweep test does,
      // and a sweep needs a usable electrical side `specSection` alone does not state.
      d.specs.Re_ohm.set(6);
      d.specs.BL_Tm.set(7);
      return d;
    };

    it('bandpass6() builds a project whose rear chamber carries its own volume AND tuning, unlike bandpass4\'s sealed rear', () => {
      const p = new ProjectBuilder(driver(), createEngine())
        .bandpass6().rearVolume_m3(0.02).rearTuning_hz(50).frontVolume_m3(0.03).frontTuning_hz(40).build();
      expect(p.box.bandpass6.chambers.rear.volume_m3.value).toBe(0.02);
      expect(p.box.bandpass6.chambers.rear.tuning_goal_hz.value).toBe(50);
      expect(p.box.bandpass6.chambers.front.volume_m3.value).toBe(0.03);
      expect(p.box.bandpass6.chambers.front.tuning_goal_hz.value).toBe(40);
    });

    it('abc() builds the same two independently-tunable chambers under the abc box type', () => {
      const p = new ProjectBuilder(driver(), createEngine())
        .abc().rearVolume_m3(0.025).rearTuning_hz(45).frontVolume_m3(0.035).frontTuning_hz(38).build();
      expect(p.box.abc.chambers.rear.volume_m3.value).toBe(0.025);
      expect(p.box.abc.chambers.rear.tuning_goal_hz.value).toBe(45);
      expect(p.box.abc.chambers.front.volume_m3.value).toBe(0.035);
      expect(p.box.abc.chambers.front.tuning_goal_hz.value).toBe(38);
    });

    it('sweep()/maxCurves()/boxParamsIssues() simulate a bandpass6 box — see bp6-abc-wpr.test.ts for the WinISD-matched engine coverage', () => {
      const p = new ProjectBuilder(driver(), createEngine())
        .bandpass6().rearVolume_m3(0.02).rearTuning_hz(50).frontVolume_m3(0.03).frontTuning_hz(40).build();

      expect(p.sweep({fmin: 10, fmax: 100, N: 10}).values).not.toBeNull();
      expect(p.maxCurves({fmin: 10, fmax: 100, N: 10}).values).not.toBeNull();
      expect(p.boxParamsIssues()).toEqual([]);
    });
  });

  describe('BoxProjectBuilder — the shared build() guards', () => {
    const driver = () => driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    });

    it('build() without a volume ships the type\'s starting values, never a half-stated box (box-starting-values.test.ts)', () => {
      const p = new ProjectBuilder(driver(), createEngine()).sealed().build();
      expect(p.box.sealed.volume_m3.value).toBeGreaterThan(0);
    });
  });
});
