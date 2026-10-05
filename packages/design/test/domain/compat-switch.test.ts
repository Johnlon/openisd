/**
 * The WinISD Compatibility switches (John, 2026-10-05): each is a WinISD bug or a WinISD option.
 * A bug switch sits under the "Enable WinISD bugs" heading and is named by the bug ("Re without Rg");
 * an option sits under "Enable WinISD style" and is named by the calculation ("Phase wrapping").
 * A new project, and a file that does not say, has every bug unticked and every option ticked.
 */
import {describe, expect, it} from 'vitest';
import {CompatSwitch, OpenISDProject} from '../../domain/index.js';
import {sealedProject} from '../fixtures/domainBuilders.js';
import {createEngine} from '../../engine/index.js';
import {CompatSwitchGroup, ToggleField, WinisdDeviation} from '../../fields/index.js';

describe('CompatSwitch', () => {
  it('lists the six WinISD bugs and the three options', () => {
    expect(CompatSwitch.BUGS.map(s => s.field.label)).toEqual([
      'Two-BL driver',
      'Re without Rg',
      'PR Npr resonance',
      'Bessel high-pass',
      'ABC group delay',
      'Per-driver impedance',
    ]);
    expect(CompatSwitch.OPTIONS.map(s => s.field.label)).toEqual([
      'Phase wrapping',
      'Uncapped flat response',
      'Simplified ABC intra-port velocity',
    ]);
    expect(CompatSwitch.ALL).toEqual([...CompatSwitch.BUGS, ...CompatSwitch.OPTIONS]);
  });

  it('the group headings carry "Enable WinISD"; the switch titles do not; each tooltip says what ticked and unticked do', () => {
    expect(CompatSwitchGroup.BUGS.heading).toBe('Enable WinISD bugs');
    expect(CompatSwitchGroup.BUGS.tooltip).toMatch(/^Enable WinISD bugs: /);
    expect(CompatSwitchGroup.OPTIONS.heading).toBe('Enable WinISD style');
    expect(CompatSwitchGroup.OPTIONS.tooltip).toMatch(/^Enable WinISD style: /);
    for (const s of CompatSwitch.ALL) expect(s.field.label).not.toMatch(/Enable WinISD|bug$/);
    for (const s of CompatSwitch.ALL) {
      expect(s.field.description).toMatch(/\nTicked/);
      expect(s.field.description).toMatch(/\nUnticked/);
    }
  });

  it('every bug switch tooltip ends with where the bug is seen; options have no such line', () => {
    for (const s of CompatSwitch.BUGS) {
      expect(s.field.seenIn, s.field.label).not.toBeNull();
      expect(s.field.description.endsWith(`\nSeen in: ${s.field.seenIn}`), s.field.label).toBe(true);
    }
    for (const s of CompatSwitch.OPTIONS) expect(s.field.seenIn, s.field.label).toBeNull();
  });

  it('a bug\'s ≠W popup shows its switch\'s "Seen in" line', () => {
    expect(WinisdDeviation.VA_MODEL.seenIn).toBe(ToggleField.ADV_WINISDVAMODEL.seenIn);
    expect(WinisdDeviation.VA_MODEL.seenIn).toMatch(/Amplifier apparent load power \(VA\) chart.*System input power readout, 4\.0 W against 3\.91 W/);
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

