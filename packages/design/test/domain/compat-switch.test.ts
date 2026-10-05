/**
 * The WinISD Compatibility switches (John, 2026-10-05): each is a WinISD bug or a WinISD option.
 * A bug switch's title reads "Enable WinISD <name> bug"; an option's "Enable WinISD style <name>".
 * A new project, and a file that does not say, has every bug unticked and every option ticked.
 */
import {describe, expect, it} from 'vitest';
import {CompatSwitch, OpenISDProject} from '../../domain/index.js';
import {sealedProject} from '../fixtures/domainBuilders.js';
import {createEngine} from '../../engine/index.js';

describe('CompatSwitch', () => {
  it('lists the six WinISD bugs and the three options', () => {
    expect(CompatSwitch.BUGS.map(s => s.field.label)).toEqual([
      'Enable WinISD two-BL driver bug',
      'Enable WinISD Re without Rg bug',
      'Enable WinISD PR Npr resonance bug',
      'Enable WinISD Bessel high-pass bug',
      'Enable WinISD ABC group delay bug',
      'Enable WinISD per-driver impedance bug',
    ]);
    expect(CompatSwitch.OPTIONS.map(s => s.field.label)).toEqual([
      'Enable WinISD style phase wrapping',
      'Enable WinISD style uncapped flat response',
      'Enable WinISD style simplified ABC intra-port velocity',
    ]);
    expect(CompatSwitch.ALL).toEqual([...CompatSwitch.BUGS, ...CompatSwitch.OPTIONS]);
  });

  it('a bug title says "bug", an option title says "optional", and each tooltip says what ticked and unticked do', () => {
    for (const s of CompatSwitch.BUGS) expect(s.field.label).toMatch(/^Enable WinISD .+ bug$/);
    for (const s of CompatSwitch.OPTIONS) expect(s.field.label).toMatch(/^Enable WinISD style .+$/);
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

