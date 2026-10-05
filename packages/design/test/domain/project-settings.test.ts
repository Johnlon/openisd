import {describe, expect, it} from 'vitest';
import {type Engine, createEngine, DEFAULT_VENTED_DESIGN_LIMITS} from '@openisd/design/engine';
import {OpenISDProject, ProjectBuilder, type FrequencyGrid} from '../../domain/index.js';
import {fixedAppContext, specSection, driverFrom, sealedProject} from '../fixtures/domainBuilders.js';

describe('OpenISDProject settings', () => {
    it('sweep() reads Options → Environment for an unstated environment — the same SPL as entering those values', () => {
      // bugs/archive/BUG_20260924_sweep-ignores-options-environment-setting.md
      const grid: FrequencyGrid = {fmin: 20, fmax: 200, N: 8};
      const options = {tempK: 263.15, humidityPct: 90, pressurePa: 85000};
      const sealedOn = (engine: Engine) => {
        const driver = driverFrom({
          brand: 'Dayton', model: 'RS225', section: 'woofer',
          spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
        });
        driver.specs.Re_ohm.set(6);
        driver.specs.BL_Tm.set(7);
        return new ProjectBuilder(driver, engine).sealed().volume_m3(0.03).build();
      };
      const onOptions = sealedOn(createEngine({
        ventedLimits: () => DEFAULT_VENTED_DESIGN_LIMITS, envDefaults: () => options,
      }));
      const entered = sealedOn(createEngine());
      entered.envTempK.set(options.tempK);
      entered.envHumidityPct.set(options.humidityPct);
      entered.envPressurePa.set(options.pressurePa);

      const spl = onOptions.sweep(grid).values?.spl;
      expect(spl).toBeDefined();
      expect(spl).toEqual(entered.sweep(grid).values?.spl);
      expect(spl).not.toEqual(sealedOn(createEngine()).sweep(grid).values?.spl);
    });

    it('loading defaults to standard, and can be set to isobaric', () => {
      const p = sealedProject();
      expect(p.loading.value).toBe('standard');

      p.loading.set('isobaric');
      expect(p.loading.value).toBe('isobaric');
    });

    it('splGraphIsXmaxLimited defaults false, and can be toggled', () => {
      const p = sealedProject();
      expect(p.splGraphIsXmaxLimited.value).toBe(false);

      p.splGraphIsXmaxLimited.set(true);
      expect(p.splGraphIsXmaxLimited.value).toBe(true);
    });

    it('uuid() answers the identity a fixed AppContext minted at wrap time', () => {
      const p = OpenISDProject.wrap(sealedProject().cloneSavedProject(), createEngine(), fixedAppContext('proj-fixed-id'));
      expect(p.uuid()).toBe('proj-fixed-id');
    });

    it('cloneSavedProject answers the last-saved record, never the live edited one', () => {
      const p = sealedProject();
      p.name.set('edited but not saved');

      const saved = p.cloneSavedProject();
      expect(saved.meta.name).not.toBe('edited but not saved');
    });

    it('cloneSavedProject hands out an independent clone — mutating the answer never reaches the project', () => {
      const p = sealedProject();
      const saved = p.cloneSavedProject();
      saved.meta.name = 'mutated the clone';

      expect(p.cloneSavedProject().meta.name).not.toBe('mutated the clone');
    });

    it('circuitModel "winisdGyrator" (WinISD-compatible inductance) survives a save and reload through .owpr text', () => {
      const p = sealedProject();
      p.circuitModel.set('winisdGyrator');
      p.save();

      const back = OpenISDProject.fromOwprText(p.toOwprText(), createEngine());
      if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
      expect(back.circuitModel.value).toBe('winisdGyrator');
    });

    it('applyWinisdSettings sets the compat switches to WinISD', () => {
      const p = sealedProject();
      p.envUseWinisdAirModel.set(false);
      p.winisdDriverModel.set(false);

      p.applyWinisdSettings();

      expect(p.envUseWinisdAirModel.value).toBe(true);
      expect(p.winisdDriverModel.value).toBe(true);
    });

    it('applyWinisdSettings leaves native WinISD controls and project data as they were (John, 2026-09-26)', () => {
      for (const rgAtDriverSide of [true, false]) {
        const p = sealedProject();
        p.rgAtDriverSide.set(rgAtDriverSide);
        p.driver.specs.Mms_kg.set(0.04);

        p.applyWinisdSettings();

        expect(p.rgAtDriverSide.value).toBe(rgAtDriverSide);
        expect(p.driver.specs.Mms_kg.entered).toBe(true);
      }
    });

    it('applyWinisdSettings keeps voice coil inductance on or off — the driver-calculations switch picks WinISD\'s inductance model', () => {
      const off = sealedProject();
      off.circuitModel.set('winisd');
      off.applyWinisdSettings();
      expect(off.circuitModel.value).toBe('winisd');

      const on = sealedProject();
      on.circuitModel.set('gyrator');
      on.winisdDriverModel.set(false);
      on.applyWinisdSettings();
      expect(on.circuitModel.value).toBe('gyrator');
      expect(on.winisdDriverModel.value).toBe(true);
    });

    it('description is a project note, never solver-derived — no solver write exists on it', () => {
      const p = sealedProject();
      p.description.set('my note');

      expect('setCalculated' in p.description).toBe(false);
      expect('setDq' in p.description).toBe(false);
      expect(p.description.value).toBe('my note');
      expect(p.description.entered).toBe(true);

      expect('clear' in p.description).toBe(false);
      p.description.set('');
      expect(p.description.value).toBe('');
      expect(p.description.entered).toBe(true);
    });
});
