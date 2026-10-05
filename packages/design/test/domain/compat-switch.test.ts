/**
 * The WinISD Compatibility switches (John, 2026-10-05): each is a WinISD bug or a WinISD option.
 * A bug switch's title reads "Enable WinISD <name> bug"; an option's "Enable optional <name>".
 * "Reset to WinISD" sets every option to WinISD's side and leaves every bug unticked (fixed); it
 * never ticks a bug, never changes a native WinISD control, never changes project data.
 */
import {describe, expect, it} from 'vitest';
import {CompatSwitch, OpenISDProject} from '../../domain/index.js';
import {sealedProject} from '../fixtures/domainBuilders.js';
import {createEngine} from '../../engine/index.js';

describe('CompatSwitch', () => {
  it('lists the five WinISD bugs and the four WinISD options', () => {
    expect(CompatSwitch.BUGS.map(s => s.field.label)).toEqual([
      'Enable WinISD two-BL driver bug',
      'Enable WinISD VA model bug',
      'Enable WinISD PR Npr resonance bug',
      'Enable WinISD Bessel high-pass bug',
      'Enable WinISD ABC group delay bug',
    ]);
    expect(CompatSwitch.OPTIONS.map(s => s.field.label)).toEqual([
      'Enable optional phase wrapping',
      'Enable optional per-driver boxes',
      'Enable optional uncapped flat response',
      'Enable optional simplified ABC intra-port velocity',
    ]);
    expect(CompatSwitch.ALL).toEqual([...CompatSwitch.BUGS, ...CompatSwitch.OPTIONS]);
  });

  it('a bug title says "bug", an option title says "optional", and each tooltip says what ticked and unticked do', () => {
    for (const s of CompatSwitch.BUGS) expect(s.field.label).toMatch(/^Enable WinISD .+ bug$/);
    for (const s of CompatSwitch.OPTIONS) expect(s.field.label).toMatch(/^Enable optional .+$/);
    for (const s of CompatSwitch.ALL) {
      expect(s.field.description).toMatch(/\nTicked/);
      expect(s.field.description).toMatch(/\nUnticked/);
    }
  });

  it('a new project has every bug unticked and every option on WinISD\'s side', () => {
    const p = sealedProject();
    for (const s of CompatSwitch.BUGS) expect(s.of(p).value, s.field.label).toBe(false);
    for (const s of CompatSwitch.OPTIONS) expect(s.of(p).value, s.field.label).toBe(true);
  });

  it('a project file that does not say reads the same as a new project', () => {
    const p = sealedProject();
    p.save();
    const text = p.toOwprText().replace(/"winisd[A-Za-z]+": (true|false),?/g, '').replace(/,(\s*})/g, '$1');
    const back = OpenISDProject.fromOwprText(text, createEngine());
    if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
    for (const s of CompatSwitch.ALL) expect(s.of(back).value, s.field.label).toBe(s.of(p).value);
  });
});

describe('OpenISDProject.resetToWinisd', () => {
  it('sets every option to WinISD\'s side and unticks every bug', () => {
    const p = sealedProject();
    for (const s of CompatSwitch.BUGS) s.of(p).set(true);
    for (const s of CompatSwitch.OPTIONS) s.of(p).set(false);
    p.resetToWinisd();
    for (const s of CompatSwitch.BUGS) expect(s.of(p).value, s.field.label).toBe(false);
    for (const s of CompatSwitch.OPTIONS) expect(s.of(p).value, s.field.label).toBe(true);
  });

  it('never ticks a bug', () => {
    const p = sealedProject();
    p.resetToWinisd();
    p.resetToWinisd();
    expect(CompatSwitch.BUGS.filter(s => s.of(p).value)).toEqual([]);
  });

  it('leaves native WinISD controls and project data as they were (John, 2026-09-26)', () => {
    const p = sealedProject();
    p.rgAtDriverSide.set(true);
    p.circuitModel.set('gyrator');
    p.forceFlatResponse.set(true);
    p.driver.specs.Mms_kg.set(0.04);
    p.resetToWinisd();
    expect(p.rgAtDriverSide.value).toBe(true);
    expect(p.circuitModel.value).toBe('gyrator');
    expect(p.forceFlatResponse.value).toBe(true);
    expect(p.driver.specs.Mms_kg.entered).toBe(true);
  });
});
