/**
 * "Sealed picker volume" (`winisdSealedPicker`): off by default, saved with the project.
 * Ticked, the sealed alignment picker gives WinISD's volume (function 0x45c140): Rg fixed at 0.1 and
 * Qa fixed at 100, the project's Rg, Ql and Qa ignored. The expected volumes are WinISD's own, read from
 * its New Project wizard (winisd_research/runs/sealed_picker_formula.jsonl).
 */
import {describe, expect, it} from 'vitest';
import {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import {CompatSwitch} from '../../domain/project/compatSwitch.js';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import {createEngine} from '../../engine/Engine.js';
import {sealedProject} from '../fixtures/domainBuilders.js';
import {WinisdDeviation} from '../../fields/winisdDeviation.js';

const engine = createEngine();

interface Capture {readonly Qts: number; readonly Qms: number; readonly Qes: number; readonly Re: number; readonly Fs: number; readonly Vas_m3: number}
const W5: Capture = {Qts: 0.49, Qms: 3.56, Qes: 0.57, Re: 3.4, Fs: 45, Vas_m3: 0.00485};
const E150: Capture = {Qts: 0.39, Qms: 2.94, Qes: 0.45, Re: 6.6, Fs: 40, Vas_m3: 0.007645536};
const SA: Capture = {Qts: 0.25, Qms: 4.2, Qes: 0.265823, Re: 4, Fs: 33, Vas_m3: 0.0201};
const SB: Capture = {Qts: 0.55, Qms: 5.5, Qes: 0.611111, Re: 8, Fs: 55, Vas_m3: 0.0123};

function driverOf(c: Capture): OpenISDDriver {
  const d = OpenISDDriver.empty(engine);
  d.specs.Fs_hz.set(c.Fs);
  d.specs.Qts.set(c.Qts);
  d.specs.Qes.set(c.Qes);
  d.specs.Qms.set(c.Qms);
  d.specs.Re_ohm.set(c.Re);
  d.specs.Vas_m3.set(c.Vas_m3);
  return d;
}

/** [driver, picked Qtc, WinISD's picker volume in m3 as captured] */
const WINISD_CAPTURES: readonly (readonly [string, Capture, number, number])[] = [
  ['W5', W5, 0.577, 0.0149103381441313],
  ['W5', W5, 1 / Math.sqrt(2), 0.00489735363302949],
  ['W5', W5, 0.8, 0.00313383736670561],
  ['W5', W5, 1.2, 0.00102490354570616],
  ['E150', E150, 0.8, 0.00244548104236309],
  ['E150', E150, 1.0, 0.00140349706945348],
  ['SA', SA, 0.5, 0.00708205927502769],
  ['SA', SA, 1.2, 0.000952255181277349],
  ['SB', SB, 1.5, 0.00193555025897117],
];

describe('winisdSealedPicker', () => {
  it('is off in a new project, and its switch is a bug switch', () => {
    expect(sealedProject().winisdSealedPicker.value).toBe(false);
    expect(CompatSwitch.SEALED_PICKER.kind).toBe('bug');
    expect(CompatSwitch.SEALED_PICKER.field.label).toBe('Sealed picker volume');
  });

  it('is saved with the project', () => {
    const p = sealedProject();
    p.winisdSealedPicker.set(true);
    const back = OpenISDProject.fromOwprText(p.toOwprText(), engine);
    if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
    expect(back.winisdSealedPicker.value).toBe(true);
  });

  it.each(WINISD_CAPTURES)('ticked, %s Qtc %f gives WinISD\'s picker volume', (_name, capture, qtc, wanted_m3) => {
    const d = driverOf(capture);
    // the losses and Rs given are ignored: WinISD uses its own Rg 0.1 and Qa 100
    for (const [Rs, losses] of [[0.1, {Ql: 10, Qa: 100}], [2, {Ql: 3, Qa: 7}]] as const) {
      const vb = d.sealedPickerVolume(qtc, Rs, losses, true);
      expect(Math.abs(vb! / wanted_m3 - 1)).toBeLessThan(1e-9);
    }
  });

  it('ticked, W5-1138SMF Qtc 0.800 gives 3.1338 L', () => {
    expect(driverOf(W5).sealedPickerVolume(0.8, 0.1, {Ql: 10, Qa: 100}, true)! * 1000).toBeCloseTo(3.1338, 4);
  });

  it.each(WINISD_CAPTURES)('unticked, %s Qtc %f is unchanged: the volume at which the Box tab shows the picked Qtc', (_name, capture, qtc) => {
    const d = driverOf(capture);
    const losses = {Ql: 10, Qa: 100};
    expect(d.sealedPickerVolume(qtc, 0.1, losses, false)).toBe(d.sealedVolumeForQtc(qtc, 0.1, losses));
  });

  it('gives null when a value WinISD\'s formula needs is missing, or no volume reaches the Qtc', () => {
    expect(OpenISDDriver.empty(engine).sealedPickerVolume(0.8, 0.1, {Ql: 10, Qa: 100}, true)).toBeNull();
    expect(driverOf(W5).sealedPickerVolume(0.3, 0.1, {Ql: 10, Qa: 100}, true)).toBeNull();
  });

  it('the Box tab then shows a Qtc a little off the picked one (W5 0.800 -> 0.787)', () => {
    const d = driverOf(W5);
    const vb = d.sealedPickerVolume(0.8, 0.1, {Ql: 10, Qa: 100}, true)!;
    expect(d.sealedQtc(vb, 0.1, {Ql: 10, Qa: 100})).toBeCloseTo(0.7873, 3);
  });

  it('the ≠W cue shows while the switch is off, and not once ticked', () => {
    const p = sealedProject();
    expect(WinisdDeviation.SEALED_PICKER.cueShown(p.errorSwitches)).toBe(true);
    expect(p.errorSwitches.sealedPicker).toEqual({marked: true, applicable: true, inScope: true, reproducesError: false});
    p.winisdSealedPicker.set(true);
    expect(WinisdDeviation.SEALED_PICKER.cueShown(p.errorSwitches)).toBe(false);
  });
});
