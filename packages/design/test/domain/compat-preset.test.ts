/**
 * The WinISD Compatibility presets (John, 2026-10-04): "Recommended (debugged)", "WinISD-ish" and
 * "WinISD incl. bugs". A preset sets every WinISD-vs-conventional choice and every WinISD error
 * switch; it never touches a native WinISD control or project data. A new project, and a file that
 * does not say, is WinISD-ish.
 */
import {describe, expect, it} from 'vitest';
import {LossMode} from '@openisd/design/fields';
import {CompatPreset, OpenISDProject} from '../../domain/index.js';
import {sealedProject} from '../fixtures/domainBuilders.js';
import {createEngine} from '../../engine/index.js';

describe('CompatPreset', () => {
  it('Recommended (debugged): every choice on OpenISD\'s best model, every WinISD error off', () => {
    expect(CompatPreset.DEBUGGED.choices).toEqual({
      lossMode: LossMode.ConventionalLossy,
      winisdWrapPhase: false,
      winisdDriverCountModel: false,
      winisdFlatModel: false,
      winisdAbcIntraPortVelocity: false,
      winisdDriverModel: false,
      winisdVaModel: false,
      winisdPrNprResonance: false,
      winisdBesselHighpass: false,
    });
  });

  it('WinISD-ish: every choice on WinISD\'s side, every WinISD error off', () => {
    expect(CompatPreset.WINISD_ISH.choices).toEqual({
      lossMode: LossMode.WinisdLossy,
      winisdWrapPhase: true,
      winisdDriverCountModel: true,
      winisdFlatModel: true,
      winisdAbcIntraPortVelocity: true,
      winisdDriverModel: false,
      winisdVaModel: false,
      winisdPrNprResonance: false,
      winisdBesselHighpass: false,
    });
  });

  it('WinISD incl. bugs: every choice on WinISD\'s side, every WinISD error reproduced', () => {
    expect(CompatPreset.WINISD_WITH_BUGS.choices).toEqual({
      ...CompatPreset.WINISD_ISH.choices,
      winisdDriverModel: true,
      winisdVaModel: true,
      winisdPrNprResonance: true,
      winisdBesselHighpass: true,
    });
  });

  it('labels, in the order the buttons show', () => {
    expect(CompatPreset.ALL.map(p => p.label)).toEqual(['Recommended (debugged)', 'WinISD-ish', 'WinISD incl. bugs']);
  });

  it('a new project is WinISD-ish', () => {
    const p = sealedProject();
    expect(p.compatPreset).toBe(CompatPreset.WINISD_ISH);
    expect(p.winisdDriverModel.value).toBe(false);
    expect(p.winisdVaModel.value).toBe(false);
  });

  it('a project file that does not say is WinISD-ish', () => {
    const p = sealedProject();
    p.save();
    const text = p.toOwprText().replace(/"winisd[A-Za-z]+": (true|false),?/g, '').replace(/,(\s*})/g, '$1');
    const back = OpenISDProject.fromOwprText(text, createEngine());
    if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
    expect(back.compatPreset).toBe(CompatPreset.WINISD_ISH);
  });

  for (const preset of CompatPreset.ALL) {
    it(`applying "${preset.label}" makes the project match it, from any other preset`, () => {
      for (const from of CompatPreset.ALL) {
        const p = sealedProject();
        p.applyCompatPreset(from);
        p.applyCompatPreset(preset);
        expect(p.compatPreset).toBe(preset);
        expect(p.compatChoices).toEqual(preset.choices);
      }
    });
  }

  it('one switch off its preset reads as custom (null)', () => {
    const p = sealedProject();
    p.winisdWrapPhase.set(false);
    expect(p.compatPreset).toBeNull();
    expect(CompatPreset.labelOf(p.compatPreset)).toBe('Custom');
    expect(CompatPreset.labelOf(CompatPreset.DEBUGGED)).toBe('Recommended (debugged)');
  });

  it('a preset leaves native WinISD controls and project data as they were (John, 2026-09-26)', () => {
    for (const preset of CompatPreset.ALL) {
      const p = sealedProject();
      p.rgAtDriverSide.set(true);
      p.circuitModel.set('gyrator');
      p.forceFlatResponse.set(true);
      p.driver.specs.Mms_kg.set(0.04);
      p.applyCompatPreset(preset);
      expect(p.rgAtDriverSide.value).toBe(true);
      expect(p.circuitModel.value).toBe('gyrator');
      expect(p.forceFlatResponse.value).toBe(true);
      expect(p.driver.specs.Mms_kg.entered).toBe(true);
    }
  });
});
